"""Phase A — Ollama prompts + JSON schema for agent listing drafts."""

from __future__ import annotations

import json
from typing import Any, Dict, List

LISTING_DRAFT_PROMPT_VERSION = "1.0.0"

DISCLAIMER = (
    "AI-generated description is an assistive draft. The seller/agent is legally "
    "responsible for verifying all physical and title assertions before publishing."
)


def build_listing_draft_json_schema() -> Dict[str, Any]:
    return {
        "type": "object",
        "properties": {
            "suggested_title": {"type": "string"},
            "suggested_description": {"type": "string"},
            "selling_highlights": {
                "type": "array",
                "items": {"type": "string"},
                "maxItems": 8,
            },
            "seo_keywords": {
                "type": "array",
                "items": {"type": "string"},
                "maxItems": 10,
            },
            "completeness_score": {"type": "integer", "minimum": 0, "maximum": 100},
            "confirmation_required": {
                "type": "array",
                "items": {"type": "string"},
                "maxItems": 6,
            },
        },
        "required": [
            "suggested_title",
            "suggested_description",
            "selling_highlights",
            "seo_keywords",
            "completeness_score",
            "confirmation_required",
        ],
    }


def _format_price_pkr(price: float) -> str:
    if price >= 10_000_000:
        return f"PKR {price / 10_000_000:.2f} Crore"
    if price >= 100_000:
        return f"PKR {price / 100_000:.0f} Lakh"
    return f"PKR {price:,.0f}"


def build_listing_draft_messages(payload: Dict[str, Any]) -> List[Dict[str, str]]:
    """Chat messages for Ollama — only facts from the listing form."""
    facts = {
        "property_type": payload.get("property_type"),
        "city": payload.get("city"),
        "area": payload.get("area"),
        "size": payload.get("size"),
        "size_unit": payload.get("size_unit"),
        "price_pkr": payload.get("price"),
        "price_display": _format_price_pkr(float(payload.get("price") or 0)),
        "bedrooms": payload.get("bedrooms"),
        "bathrooms": payload.get("bathrooms"),
        "furnishing": payload.get("furnishing"),
        "user_notes": payload.get("user_notes"),
    }

    system = f"""You write professional property listings for PropertyIQ Pakistan (Lahore, Islamabad, Karachi, etc.).

Rules:
1. Use ONLY the facts in the user JSON. Do NOT invent bedrooms, amenities, NOC status, or a different price.
2. If user_notes mention features, you may reflect them; otherwise use neutral wording (no fake "basement cinema" etc.).
3. Title: concise, under 120 characters, include size + type + area + city when possible.
4. Description: 2–4 short paragraphs, buyer-friendly English (Roman Urdu phrases OK sparingly).
5. selling_highlights: 4–6 bullet-style strings (no markdown bullets in strings).
6. seo_keywords: 4–8 search phrases buyers might type.
7. confirmation_required: 2–4 items the agent must verify (title docs, utilities, possession) — generic is OK.
8. completeness_score: 0–100 based on how rich the input was (notes, beds, furnishing), not your creativity.

Output MUST match the JSON schema exactly. Prompt version: {LISTING_DRAFT_PROMPT_VERSION}."""

    user = "Listing form facts (JSON):\n" + json.dumps(facts, ensure_ascii=False)

    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]
