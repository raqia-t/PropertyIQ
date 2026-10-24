"""Phase A — Ollama listing draft generation."""

from __future__ import annotations

import logging
import os
from typing import Any, Dict, Optional, Tuple

import httpx

from ollama_parser import OLLAMA_BASE_URL, OLLAMA_MODEL, OLLAMA_TIMEOUT_SEC, _extract_json_object
from prompt_listing_draft import (
    DISCLAIMER,
    LISTING_DRAFT_PROMPT_VERSION,
    build_listing_draft_json_schema,
    build_listing_draft_messages,
)
from template_listing_draft import build_template_listing_draft

logger = logging.getLogger("propertyiq.ai.listing_draft")

AI_LISTING_DRAFT_MODE = os.getenv("AI_LISTING_DRAFT_MODE", "hybrid").strip().lower()


def get_listing_draft_config() -> Dict[str, Any]:
    return {
        "mode": AI_LISTING_DRAFT_MODE,
        "ollama_model": OLLAMA_MODEL,
        "prompt_version": LISTING_DRAFT_PROMPT_VERSION,
    }


def _normalize_draft(raw: Dict[str, Any], payload: Dict[str, Any]) -> Dict[str, Any]:
    title = (raw.get("suggested_title") or "").strip()
    desc = (raw.get("suggested_description") or "").strip()
    if len(title) < 8:
        raise ValueError("title too short")
    if len(desc) < 40:
        raise ValueError("description too short")

    def _str_list(key: str, max_n: int) -> list[str]:
        val = raw.get(key) or []
        if not isinstance(val, list):
            return []
        out = [str(x).strip() for x in val if str(x).strip()]
        return out[:max_n]

    score = raw.get("completeness_score", 80)
    try:
        score = int(score)
    except (TypeError, ValueError):
        score = 80
    score = max(0, min(100, score))

    return {
        "suggested_title": title[:200],
        "suggested_description": desc[:4000],
        "selling_highlights": _str_list("selling_highlights", 8),
        "seo_keywords": _str_list("seo_keywords", 10),
        "completeness_score": score,
        "confirmation_required": _str_list("confirmation_required", 6),
        "disclaimer": DISCLAIMER,
    }


def draft_with_ollama(payload: Dict[str, Any]) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    messages = build_listing_draft_messages(payload)
    body_payload = {
        "model": OLLAMA_MODEL,
        "stream": False,
        "format": build_listing_draft_json_schema(),
        "messages": messages,
        "options": {"temperature": 0.3, "num_predict": 700},
    }

    content = ""
    try:
        with httpx.Client(timeout=OLLAMA_TIMEOUT_SEC) as client:
            resp = client.post(f"{OLLAMA_BASE_URL}/api/chat", json=body_payload)
            if resp.status_code >= 400:
                return None, f"ollama HTTP {resp.status_code}"
            body = resp.json()
            content = body.get("message", {}).get("content") or ""
            raw = _extract_json_object(content)
    except Exception as ex:  # noqa: BLE001
        logger.warning("listing-draft ollama failed: %s", ex)
        return None, str(ex)

    try:
        return _normalize_draft(raw, payload), None
    except Exception as ex:  # noqa: BLE001
        logger.warning("listing-draft normalize failed: %s | content=%r", ex, content[:300])
        return None, str(ex)


def generate_listing_draft(payload: Dict[str, Any]) -> Tuple[Dict[str, Any], str]:
    """
    Returns (draft_dict, source) where source is ollama | template_fallback | template.
    """
    mode = AI_LISTING_DRAFT_MODE
    if mode in ("hybrid", "llm"):
        draft, err = draft_with_ollama(payload)
        if draft is not None:
            return draft, "ollama"
        logger.warning("listing-draft fallback to template (%s)", err)

    draft = build_template_listing_draft(payload)
    source = "template_fallback" if mode in ("hybrid", "llm") else "template"
    return draft, source
