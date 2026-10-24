"""
Phase 4 — Pakistan NL search extraction prompt.

Builds the system prompt + few-shot chat turns from the Phase 2 schema enums
so the Ollama model stays aligned with allowed cities/types/units.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List

from search_schema import (
    ALLOWED_LIFESTYLE,
    AllowedCity,
    InvestmentIntentValue,
    LandAreaUnitValue,
    PropertyPurposeValue,
    PropertyTypeValue,
)

PROMPT_VERSION = "4.0.0"

# Few-shot pairs: (user_query, preferred_city, expected_filter_dict)
FEW_SHOTS: List[Dict[str, Any]] = [
    {
        "query": "5 marla house in DHA Lahore under 3 crore for sale",
        "preferred_city": "Lahore",
        "expected": {
            "raw_query": "5 marla house in DHA Lahore under 3 crore for sale",
            "city": "Lahore",
            "area": "DHA Phase 6",
            "property_type": "House",
            "purpose": "Sale",
            "min_price": None,
            "max_price": 30000000,
            "bedrooms": None,
            "land_area": 5,
            "land_area_unit": "Marla",
            "lifestyle_preferences": [],
            "investment_intent": "Personal Residence",
            "confidence_score": 0.93,
        },
    },
    {
        "query": "2 bed flat for rent in Bahria Islamabad under 50 lac",
        "preferred_city": "Islamabad",
        "expected": {
            "raw_query": "2 bed flat for rent in Bahria Islamabad under 50 lac",
            "city": "Islamabad",
            "area": "Bahria Town",
            "property_type": "ApartmentFlat",
            "purpose": "Rent",
            "min_price": None,
            "max_price": 5000000,
            "bedrooms": 2,
            "land_area": None,
            "land_area_unit": None,
            "lifestyle_preferences": [],
            "investment_intent": None,
            "confidence_score": 0.91,
        },
    },
    {
        "query": "1 kanal plot Gulberg near schools",
        "preferred_city": "Lahore",
        "expected": {
            "raw_query": "1 kanal plot Gulberg near schools",
            "city": "Lahore",
            "area": "Gulberg",
            "property_type": "Plot",
            "purpose": None,
            "min_price": None,
            "max_price": None,
            "bedrooms": None,
            "land_area": 1,
            "land_area_unit": "Kanal",
            "lifestyle_preferences": ["Near reputable schools"],
            "investment_intent": None,
            "confidence_score": 0.88,
        },
    },
    {
        "query": "sasti 3 bed apartment karachi clifton rent budget 1.5 lac",
        "preferred_city": "Lahore",
        "expected": {
            "raw_query": "sasti 3 bed apartment karachi clifton rent budget 1.5 lac",
            "city": "Karachi",
            "area": "Clifton",
            "property_type": "ApartmentFlat",
            "purpose": "Rent",
            "min_price": None,
            "max_price": 150000,
            "bedrooms": 3,
            "land_area": None,
            "land_area_unit": None,
            "lifestyle_preferences": [],
            "investment_intent": None,
            "confidence_score": 0.86,
        },
    },
    {
        "query": "shop for sale in Blue Area Islamabad under 2 crore investment",
        "preferred_city": "Islamabad",
        "expected": {
            "raw_query": "shop for sale in Blue Area Islamabad under 2 crore investment",
            "city": "Islamabad",
            "area": "Blue Area",
            "property_type": "CommercialShop",
            "purpose": "Sale",
            "min_price": None,
            "max_price": 20000000,
            "bedrooms": None,
            "land_area": None,
            "land_area_unit": None,
            "lifestyle_preferences": [],
            "investment_intent": "Rental & Capital Appreciation",
            "confidence_score": 0.9,
        },
    },
]


def _csv(values: List[str]) -> str:
    return ", ".join(values)


def build_system_prompt() -> str:
    cities = _csv([c.value for c in AllowedCity])
    types = _csv([p.value for p in PropertyTypeValue])
    purposes = _csv([p.value for p in PropertyPurposeValue])
    units = _csv([u.value for u in LandAreaUnitValue])
    lifestyles = _csv(ALLOWED_LIFESTYLE)
    intents = _csv([i.value for i in InvestmentIntentValue])

    return f"""You are PropertyIQ AI Search Intent Extractor for the Pakistan property market.
Your ONLY job: convert a natural-language buyer/renter query into ONE JSON object.
Never chat. Never explain. Never wrap JSON in markdown.

PROMPT_VERSION={PROMPT_VERSION}

=== Allowed enums (use exactly these strings or null) ===
city: {cities}
property_type: {types}
purpose: {purposes}
land_area_unit: {units}
investment_intent: {intents} (or null)
lifestyle_preferences: prefer these labels when relevant: {lifestyles}

=== Pakistan glossary ===
Money (always emit absolute PKR integers/floats, never "crore"/"lac" strings):
  - 1 crore / 1 cr = 10000000 PKR
  - 1.5 crore = 15000000 PKR
  - 2.5 crore = 25000000 PKR
  - 1 lakh / 1 lac = 100000 PKR
  - "under X" / "below X" / "budget X" / "max X" => max_price
  - "above X" / "from X" / "min X" => min_price
Size:
  - marla / marlas => land_area_unit Marla
  - kanal / kanals => Kanal
  - sq yards / gaz => SqYards ; sq ft => SqFt ; acre(s) => Acres
Property slang:
  - house / kothi / bungalow / home => House
  - flat / apartment / apt / flaton => ApartmentFlat
  - plot / empty plot / residential plot => Plot
  - shop / commercial / showroom => CommercialShop
  - office => Office ; farmhouse => Farmhouse ; warehouse/godown => Warehouse
Purpose slang:
  - for sale / buy / purchase / kharidna => Sale
  - for rent / on rent / kiraya / rental (housing) => Rent
  - if only "investment" without rent/sale, purpose may be null; set investment_intent
Areas (normalize common names; keep null if unknown):
  - DHA / Defence / DHA 5 / DHA Phase 5 => DHA Phase 5 (or DHA / DHA Phase 6 when phase unclear)
  - Bahria / Bahria Town => Bahria Town
  - Gulberg, Model Town, Johar Town, Askari, Cantt, Clifton, Blue Area, F-6/F-7/F-10/F-11
Language:
  - Accept Roman Urdu and mixed Urdu/English (sasti, mehangi, kothi, flat, kiraya, etc.)
  - City nicknames: LHR=Lahore, ISB=Islamabad, KHI=Karachi, RWP=Rawalpindi

=== Hard rules ===
1. Output a single JSON object with exactly these keys:
   raw_query, city, area, property_type, purpose, min_price, max_price,
   bedrooms, land_area, land_area_unit, lifestyle_preferences, investment_intent, confidence_score
2. raw_query MUST equal the user's original query text (verbatim).
3. If a field is not clearly stated, use null (or [] for lifestyle_preferences). Do NOT invent bedrooms, prices, or land size.
4. If city is missing from the query, use preferred_city from the user message.
5. property_type / purpose / land_area_unit must be enum values above or null — never free text like "apartment".
6. confidence_score is 0.0–1.0 (higher when city+type+budget are explicit).
7. lifestyle_preferences is an array; only add items clearly implied (schools, hospital, park, mosque, metro, gated, corner).
"""


def build_user_turn(query: str, preferred_city: str) -> str:
    return (
        f"preferred_city: {preferred_city}\n"
        f"query: {query}\n"
        "Extract search filters as one JSON object."
    )


def build_chat_messages(query: str, preferred_city: str) -> List[Dict[str, str]]:
    """System + few-shot user/assistant turns + final user turn."""
    messages: List[Dict[str, str]] = [
        {"role": "system", "content": build_system_prompt()},
    ]
    for shot in FEW_SHOTS:
        messages.append(
            {
                "role": "user",
                "content": build_user_turn(shot["query"], shot["preferred_city"]),
            }
        )
        messages.append(
            {
                "role": "assistant",
                "content": json.dumps(shot["expected"], ensure_ascii=False),
            }
        )
    messages.append(
        {
            "role": "user",
            "content": build_user_turn(query, preferred_city),
        }
    )
    return messages


def prompt_catalog() -> Dict[str, Any]:
    return {
        "version": PROMPT_VERSION,
        "phase": 4,
        "few_shot_count": len(FEW_SHOTS),
        "few_shot_queries": [s["query"] for s in FEW_SHOTS],
        "system_prompt_preview": build_system_prompt()[:500] + "...",
        "system_prompt": build_system_prompt(),
    }


# Offline eval expectations used by verify-phase4 (not sent to the model)
EVAL_CASES: List[Dict[str, Any]] = [
    {
        "id": "sale_house_dha",
        "query": "10 marla house DHA Phase 6 Lahore under 4 crore for sale",
        "preferred_city": "Lahore",
        "expect": {
            "city": "Lahore",
            "property_type": "House",
            "purpose": "Sale",
            "max_price": 40000000,
            "land_area": 10,
            "land_area_unit": "Marla",
        },
    },
    {
        "id": "rent_flat_bahria",
        "query": "2 bed flat for rent Bahria Town Islamabad under 80 lac",
        "preferred_city": "Islamabad",
        "expect": {
            "city": "Islamabad",
            "property_type": "ApartmentFlat",
            "purpose": "Rent",
            "max_price": 8000000,
            "bedrooms": 2,
        },
    },
    {
        "id": "plot_gulberg",
        "query": "1 kanal plot in Gulberg Lahore near parks",
        "preferred_city": "Lahore",
        "expect": {
            "city": "Lahore",
            "property_type": "Plot",
            "land_area": 1,
            "land_area_unit": "Kanal",
            "area_contains": "Gulberg",
        },
    },
    {
        "id": "roman_urdu_rent",
        "query": "sasti flat karachi mein kiraya pe 2 bed clifton",
        "preferred_city": "Lahore",
        "expect": {
            "city": "Karachi",
            "property_type": "ApartmentFlat",
            "purpose": "Rent",
            "bedrooms": 2,
            "area_contains": "Clifton",
        },
    },
    {
        "id": "commercial_isb",
        "query": "commercial shop for sale Blue Area Islamabad under 3 crore",
        "preferred_city": "Islamabad",
        "expect": {
            "city": "Islamabad",
            "property_type": "CommercialShop",
            "purpose": "Sale",
            "max_price": 30000000,
        },
    },
]
