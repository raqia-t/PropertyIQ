"""Phase 3/4 — Ollama (Qwen) NL search parser with JSON Schema + Phase 4 prompts."""

from __future__ import annotations

import json
import logging
import os
import re
from typing import Any, Dict, Optional, Tuple

import httpx

from prompt_search import PROMPT_VERSION, build_chat_messages
from search_schema import (
    AllowedCity,
    LandAreaUnitValue,
    NaturalLanguageSearchRequest,
    PropertyPurposeValue,
    PropertyTypeValue,
    StructuredSearchFilter,
    build_ollama_json_schema,
    normalize_search_filter,
)

logger = logging.getLogger("propertyiq.ai.ollama")

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:7b")
OLLAMA_TIMEOUT_SEC = float(os.getenv("OLLAMA_TIMEOUT_SEC", "150"))
AI_PARSER_MODE = os.getenv("AI_PARSER_MODE", "hybrid").strip().lower()  # hybrid|llm|rules
AI_PARSER_MIN_CONFIDENCE = float(os.getenv("AI_PARSER_MIN_CONFIDENCE", "0.55"))


def get_parser_config() -> Dict[str, Any]:
    return {
        "mode": AI_PARSER_MODE,
        "ollama_base_url": OLLAMA_BASE_URL,
        "ollama_model": OLLAMA_MODEL,
        "timeout_sec": OLLAMA_TIMEOUT_SEC,
        "min_confidence": AI_PARSER_MIN_CONFIDENCE,
        "prompt_version": PROMPT_VERSION,
    }


def check_ollama_health() -> Dict[str, Any]:
    """Return llm status for /health."""
    try:
        with httpx.Client(timeout=3.0) as client:
            r = client.get(f"{OLLAMA_BASE_URL}/api/tags")
            r.raise_for_status()
            names = [m.get("name", "") for m in r.json().get("models", [])]
            has_model = any(
                n == OLLAMA_MODEL or n.startswith(f"{OLLAMA_MODEL}") or n.startswith("qwen2.5:7b")
                for n in names
            )
            return {
                "status": "up" if has_model else "model_missing",
                "base_url": OLLAMA_BASE_URL,
                "model": OLLAMA_MODEL,
                "model_present": has_model,
                "models": names[:12],
            }
    except Exception as ex:  # noqa: BLE001
        return {
            "status": "down",
            "base_url": OLLAMA_BASE_URL,
            "model": OLLAMA_MODEL,
            "model_present": False,
            "error": str(ex),
        }


def _extract_json_object(text: str) -> Dict[str, Any]:
    text = (text or "").strip()
    if not text:
        raise ValueError("empty model response")
    # Strip markdown fences if the model ignores instructions
    fence = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL | re.IGNORECASE)
    if fence:
        text = fence.group(1)
    else:
        start = text.find("{")
        end = text.rfind("}")
        if start >= 0 and end > start:
            text = text[start : end + 1]
    data = json.loads(text)
    if not isinstance(data, dict):
        raise ValueError("model JSON was not an object")
    return data


def parse_with_ollama(
    request: NaturalLanguageSearchRequest,
) -> Tuple[Optional[StructuredSearchFilter], Optional[str]]:
    """
    Returns (filter, error).
    On success error is None; on failure filter is None and error explains why.
    """
    preferred = request.preferred_city or AllowedCity.LAHORE.value
    messages = build_chat_messages(request.query, preferred)

    payload = {
        "model": OLLAMA_MODEL,
        "stream": False,
        "format": build_ollama_json_schema(),
        "messages": messages,
        "options": {
            "temperature": 0.1,
            "num_predict": 512,
        },
    }

    try:
        with httpx.Client(timeout=OLLAMA_TIMEOUT_SEC) as client:
            resp = client.post(f"{OLLAMA_BASE_URL}/api/chat", json=payload)
            if resp.status_code >= 400:
                return None, f"ollama HTTP {resp.status_code}: {resp.text[:300]}"
            body = resp.json()
    except Exception as ex:  # noqa: BLE001
        logger.warning("Ollama chat failed: %s", ex)
        return None, f"ollama unreachable: {ex}"

    content = ""
    try:
        content = body.get("message", {}).get("content") or ""
        raw = _extract_json_object(content)
    except Exception as ex:  # noqa: BLE001
        logger.warning("Ollama JSON parse failed: %s | content=%r", ex, content[:400])
        return None, f"invalid JSON from model: {ex}"

    raw["raw_query"] = request.query
    if not raw.get("city"):
        raw["city"] = preferred

    try:
        normalized = normalize_search_filter(raw, preferred_city=preferred)
    except Exception as ex:  # noqa: BLE001
        return None, f"schema normalize failed: {ex}"

    # Soft sanity: property_type/purpose must be known enums if set
    if normalized.property_type and normalized.property_type not in {p.value for p in PropertyTypeValue}:
        return None, f"invalid property_type {normalized.property_type}"
    if normalized.purpose and normalized.purpose not in {p.value for p in PropertyPurposeValue}:
        return None, f"invalid purpose {normalized.purpose}"
    if normalized.land_area_unit and normalized.land_area_unit not in {u.value for u in LandAreaUnitValue}:
        return None, f"invalid land_area_unit {normalized.land_area_unit}"

    if normalized.confidence_score < AI_PARSER_MIN_CONFIDENCE:
        return None, f"confidence {normalized.confidence_score} below {AI_PARSER_MIN_CONFIDENCE}"

    return normalized, None
