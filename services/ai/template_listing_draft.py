"""Phase A — deterministic listing draft fallback (pre-LLM template)."""

from __future__ import annotations

from typing import Any, Dict, List

from prompt_listing_draft import DISCLAIMER


def _format_price_pkr(price: float) -> str:
    if price >= 10_000_000:
        return f"PKR {price / 10_000_000:.2f} Crore"
    if price >= 100_000:
        return f"PKR {price / 100_000:.0f} Lakh"
    return f"PKR {price:,.0f}"


def build_template_listing_draft(payload: Dict[str, Any]) -> Dict[str, Any]:
    property_type = str(payload.get("property_type") or "House")
    city = str(payload.get("city") or "Lahore")
    area = str(payload.get("area") or city)
    size = float(payload.get("size") or 1)
    size_unit = str(payload.get("size_unit") or "Marla")
    price = float(payload.get("price") or 0)
    bedrooms = payload.get("bedrooms")
    bathrooms = payload.get("bathrooms")
    furnishing = payload.get("furnishing") or "Semi-Furnished"
    user_notes = (payload.get("user_notes") or "").strip()

    price_formatted = _format_price_pkr(price)
    title = f"{size:g} {size_unit} {property_type} in {area}, {city}"

    bed_line = ""
    if bedrooms is not None:
        bed_line = f" Offers {bedrooms} bedroom(s)"
        if bathrooms is not None:
            bed_line += f" and {bathrooms} bathroom(s)."

    desc = (
        f"Well-presented {size:g} {size_unit} {property_type.lower()} in {area}, {city}. "
        f"{bed_line} Furnishing: {furnishing}."
    )
    if user_notes:
        desc += f" Agent notes: {user_notes}."
    desc += f" Asking price: {price_formatted}."

    highlights: List[str] = [
        f"Location: {area}, {city}",
        f"{size:g} {size_unit} {property_type.lower()}",
    ]
    if bedrooms is not None:
        highlights.append(f"{bedrooms} bedrooms")
    if user_notes:
        highlights.append(user_notes[:120])
    highlights.append("Verify title and possession with listing agent before booking")

    keywords = [
        f"{size:g} {size_unit} {property_type.lower()} {area}",
        f"{property_type.lower()} for sale {city}",
        f"{area} {city} property",
    ]

    score = 72
    if user_notes:
        score += 8
    if bedrooms is not None:
        score += 5

    return {
        "suggested_title": title,
        "suggested_description": desc,
        "selling_highlights": highlights[:8],
        "seo_keywords": keywords[:10],
        "completeness_score": min(88, score),
        "confirmation_required": [
            "Confirm society / LDA approval and title documents",
            "Confirm utility connections and possession timeline",
            "Confirm exact land area and covered area on ground",
        ],
        "disclaimer": DISCLAIMER,
    }
