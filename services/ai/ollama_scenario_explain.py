"""Phase B — optional Ollama narrative over locked scenario numbers."""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict, List, Optional

import httpx

from ollama_parser import OLLAMA_BASE_URL, OLLAMA_MODEL, _extract_json_object

logger = logging.getLogger("propertyiq.ai.scenario_explain")

# Keep explain short so rent scenario stays responsive (hard-cap 8s even if env is higher).
AI_SCENARIO_EXPLAIN = os.getenv("AI_SCENARIO_EXPLAIN", "hybrid").strip().lower()
EXPLAIN_TIMEOUT_SEC = min(float(os.getenv("AI_SCENARIO_EXPLAIN_TIMEOUT_SEC", "8")), 8.0)


def get_scenario_explain_config() -> Dict[str, Any]:
    return {
        "mode": AI_SCENARIO_EXPLAIN,
        "timeout_sec": EXPLAIN_TIMEOUT_SEC,
        "model": OLLAMA_MODEL,
    }


def explain_scenario_with_ollama(
    *,
    city: str,
    area: str,
    property_type: str,
    size: float,
    size_unit: str,
    asking_price: float,
    scenario: Dict[str, Any],
) -> Optional[List[str]]:
    """
    Returns 2–4 short narrative bullets, or None on failure.
    Must not invent different numbers than those provided.
    """
    if AI_SCENARIO_EXPLAIN in ("off", "none", "false", "0"):
        return None
    if AI_SCENARIO_EXPLAIN == "template":
        return None

    locked = {
        "city": city,
        "area": area,
        "property_type": property_type,
        "size": size,
        "size_unit": size_unit,
        "asking_price": asking_price,
        "fair_price_low": scenario.get("fair_price_low"),
        "fair_price_high": scenario.get("fair_price_high"),
        "rent_min": scenario.get("estimated_rent_monthly_min"),
        "rent_max": scenario.get("estimated_rent_monthly_max"),
        "gross_yield_pct": scenario.get("gross_yield_percentage"),
        "sale_comp_count": scenario.get("sale_comp_count"),
        "rent_comp_count": scenario.get("rent_comp_count"),
        "valuation_source": scenario.get("valuation_source"),
        "confidence": scenario.get("confidence_score"),
    }

    schema = {
        "type": "object",
        "properties": {
            "bullets": {
                "type": "array",
                "items": {"type": "string"},
                "minItems": 2,
                "maxItems": 4,
            }
        },
        "required": ["bullets"],
    }

    messages = [
        {
            "role": "system",
            "content": (
                "You are a Pakistan real-estate analyst for PropertyIQ. "
                "Write 2–4 short bullets explaining the PROVIDED valuation numbers. "
                "Do NOT invent different prices, rents, or yields. "
                "Do NOT claim live POI or bank rates. Mention comps count if present. "
                "English only. Be concise."
            ),
        },
        {
            "role": "user",
            "content": "Locked scenario JSON:\n" + json.dumps(locked, ensure_ascii=False),
        },
    ]

    payload = {
        "model": OLLAMA_MODEL,
        "stream": False,
        "format": schema,
        "messages": messages,
        "options": {"temperature": 0.2, "num_predict": 280},
    }

    try:
        with httpx.Client(timeout=EXPLAIN_TIMEOUT_SEC) as client:
            resp = client.post(f"{OLLAMA_BASE_URL}/api/chat", json=payload)
            if resp.status_code >= 400:
                return None
            content = resp.json().get("message", {}).get("content") or ""
            raw = _extract_json_object(content)
            bullets = raw.get("bullets") or []
            out = [str(b).strip() for b in bullets if str(b).strip()][:4]
            return out if len(out) >= 2 else None
    except Exception as ex:  # noqa: BLE001
        logger.warning("scenario explain skipped: %s", ex)
        return None
