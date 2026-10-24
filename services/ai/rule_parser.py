"""Deterministic Pakistan-market NL → StructuredSearchFilter (Phase 3 fallback)."""

from __future__ import annotations

import re
from typing import Optional

from search_schema import NaturalLanguageSearchRequest, StructuredSearchFilter, normalize_search_filter


def _extract_max_price_pkr(q: str) -> Optional[float]:
    """Parse under/below/budget/max amounts in crore, lakh/lac, or thousand."""
    m = re.search(r"(?:under|below|budget|max|upto|up to)\s+(\d+(?:\.\d+)?)\s*(crore|cr)\b", q)
    if m:
        return float(m.group(1)) * 10_000_000
    m = re.search(r"(?:under|below|budget|max|upto|up to)\s+(\d+(?:\.\d+)?)\s*(lakh|lac|lacs)\b", q)
    if m:
        return float(m.group(1)) * 100_000
    m = re.search(r"(?:under|below|budget|max|upto|up to)\s+(\d+(?:\.\d+)?)\s*(thousand|k)\b", q)
    if m:
        return float(m.group(1)) * 1_000
    # bare "3 crore" as ceiling when paired with under already handled; also "3 cr budget"
    m = re.search(r"(\d+(?:\.\d+)?)\s*(crore|cr)\b", q)
    if m and any(w in q for w in ("under", "below", "budget", "max", "upto", "up to")):
        return float(m.group(1)) * 10_000_000
    return None


def parse_with_rules(request: NaturalLanguageSearchRequest) -> StructuredSearchFilter:
    q = request.query.lower()

    city = request.preferred_city or "Lahore"
    if "lahore" in q:
        city = "Lahore"
    elif "islamabad" in q:
        city = "Islamabad"
    elif "rawalpindi" in q:
        city = "Rawalpindi"
    elif "karachi" in q:
        city = "Karachi"
    elif "faisalabad" in q:
        city = "Faisalabad"
    elif "multan" in q:
        city = "Multan"
    elif "peshawar" in q:
        city = "Peshawar"

    prop_type = None
    if "house" in q or "kothi" in q or "bungalow" in q:
        prop_type = "House"
    elif "flat" in q or "apartment" in q:
        prop_type = "ApartmentFlat"
    elif "plot" in q:
        prop_type = "Plot"
    elif "commercial" in q or "shop" in q:
        prop_type = "CommercialShop"
    elif "office" in q:
        prop_type = "Office"
    elif "farmhouse" in q or "farm house" in q:
        prop_type = "Farmhouse"

    purpose = None
    if "for rent" in q or "to rent" in q or " on rent" in q:
        purpose = "Rent"
    elif "for sale" in q or "to buy" in q or "purchase" in q:
        purpose = "Sale"
    elif "rent" in q and "for sale" not in q and "to buy" not in q:
        purpose = "Rent"

    land_area = None
    land_unit = "Marla"
    if "5 marla" in q or "5-marla" in q:
        land_area = 5.0
        land_unit = "Marla"
    elif "10 marla" in q or "10-marla" in q:
        land_area = 10.0
        land_unit = "Marla"
    elif "7 marla" in q or "7-marla" in q:
        land_area = 7.0
        land_unit = "Marla"
    elif "1 kanal" in q or "1-kanal" in q:
        land_area = 1.0
        land_unit = "Kanal"

    max_price = _extract_max_price_pkr(q)

    lifestyle = []
    if "school" in q:
        lifestyle.append("Near reputable schools")
    if "hospital" in q:
        lifestyle.append("Near medical facilities / hospital")
    if "park" in q:
        lifestyle.append("Near parks / green area")
    if "mosque" in q or "masjid" in q:
        lifestyle.append("Walking distance to mosque")

    investment_intent = (
        "Rental & Capital Appreciation"
        if ("rental" in q or "yield" in q or "investment" in q)
        else "Personal Residence"
    )

    area = None
    if "dha" in q:
        area = "dha 6" if ("phase 6" in q or "dha 6" in q or "dha6" in q) else "dha"
    elif "bahria" in q:
        area = "bahria"
    elif "gulberg" in q:
        area = "gulberg"
    elif "johar" in q:
        area = "johar town"
    elif "model town" in q:
        area = "model town"

    bedrooms: Optional[int] = None
    if "3 bed" in q:
        bedrooms = 3
    elif "2 bed" in q:
        bedrooms = 2
    elif "4 bed" in q:
        bedrooms = 4
    elif "5 bed" in q:
        bedrooms = 5

    return normalize_search_filter(
        {
            "raw_query": request.query,
            "city": city,
            "area": area,
            "property_type": prop_type,
            "purpose": purpose,
            "min_price": None,
            "max_price": max_price,
            "bedrooms": bedrooms,
            "land_area": land_area,
            "land_area_unit": land_unit if land_area is not None else None,
            "lifestyle_preferences": lifestyle,
            "investment_intent": investment_intent,
            "confidence_score": 0.85,
        },
        preferred_city=request.preferred_city,
    )
