"""
Phase 2 — PropertyIQ AI Search filter contract.

Canonical snake_case JSON used by POST /ai/search-parser (and future Ollama output).
Enums match ASP.NET DomainEnums where possible so filters bind cleanly to GET /api/properties.
"""

from __future__ import annotations

import json
import re
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

from pydantic import BaseModel, Field, field_validator, model_validator


# ---------------------------------------------------------------------------
# Domain enums (aligned with PropertyIQ.Domain.Enums)
# ---------------------------------------------------------------------------

class AllowedCity(str, Enum):
    LAHORE = "Lahore"
    ISLAMABAD = "Islamabad"
    RAWALPINDI = "Rawalpindi"
    KARACHI = "Karachi"
    FAISALABAD = "Faisalabad"
    MULTAN = "Multan"
    PESHAWAR = "Peshawar"


class PropertyTypeValue(str, Enum):
    HOUSE = "House"
    APARTMENT_FLAT = "ApartmentFlat"
    PLOT = "Plot"
    COMMERCIAL_SHOP = "CommercialShop"
    OFFICE = "Office"
    WAREHOUSE = "Warehouse"
    FARMHOUSE = "Farmhouse"
    AGRICULTURAL_LAND = "AgriculturalLand"
    BUILDING = "Building"
    ROOM_PORTION = "RoomPortion"
    OTHER = "Other"


class PropertyPurposeValue(str, Enum):
    SALE = "Sale"
    RENT = "Rent"


class LandAreaUnitValue(str, Enum):
    MARLA = "Marla"
    KANAL = "Kanal"
    SQ_YARDS = "SqYards"
    SQ_FT = "SqFt"
    ACRES = "Acres"


class InvestmentIntentValue(str, Enum):
    PERSONAL_RESIDENCE = "Personal Residence"
    RENTAL_YIELD = "Rental & Capital Appreciation"
    FLIP_RESALE = "Flip / Resale"
    UNKNOWN = "Unknown"


# Canonical area labels we prefer when the model/rules emit slang
AREA_ALIASES: Dict[str, str] = {
    "dha": "DHA",
    "dha 1": "DHA Phase 1",
    "dha phase 1": "DHA Phase 1",
    "dha 5": "DHA Phase 5",
    "dha phase 5": "DHA Phase 5",
    "dha 6": "DHA Phase 6",
    "dha phase 6": "DHA Phase 6",
    "dha 7": "DHA Phase 7",
    "dha phase 7": "DHA Phase 7",
    "dha 8": "DHA Phase 8",
    "dha phase 8": "DHA Phase 8",
    "bahria": "Bahria Town",
    "bahria town": "Bahria Town",
    "gulberg": "Gulberg",
    "model town": "Model Town",
    "johar town": "Johar Town",
    "askari": "Askari",
    "cantt": "Cantt",
    "defence": "DHA",
    "clifton": "Clifton",
    "gulshan": "Gulshan-e-Iqbal",
    "f-6": "F-6",
    "f-7": "F-7",
    "f-8": "F-8",
    "f-10": "F-10",
    "f-11": "F-11",
    "g-11": "G-11",
    "blue area": "Blue Area",
}

CITY_ALIASES: Dict[str, str] = {
    "lhr": "Lahore",
    "lahore": "Lahore",
    "isb": "Islamabad",
    "islamabad": "Islamabad",
    "rwp": "Rawalpindi",
    "rawalpindi": "Rawalpindi",
    "khi": "Karachi",
    "karachi": "Karachi",
    "fsd": "Faisalabad",
    "faisalabad": "Faisalabad",
    "mul": "Multan",
    "multan": "Multan",
    "pew": "Peshawar",
    "peshawar": "Peshawar",
}

PROPERTY_TYPE_ALIASES: Dict[str, str] = {
    "house": "House",
    "kothi": "House",
    "bungalow": "House",
    "home": "House",
    "flat": "ApartmentFlat",
    "apartment": "ApartmentFlat",
    "appartments": "ApartmentFlat",
    "apt": "ApartmentFlat",
    "plot": "Plot",
    "land": "Plot",
    "commercial": "CommercialShop",
    "shop": "CommercialShop",
    "office": "Office",
    "warehouse": "Warehouse",
    "godown": "Warehouse",
    "farmhouse": "Farmhouse",
    "farm house": "Farmhouse",
    "agricultural": "AgriculturalLand",
    "agri": "AgriculturalLand",
    "building": "Building",
    "portion": "RoomPortion",
    "room": "RoomPortion",
}

PURPOSE_ALIASES: Dict[str, str] = {
    "sale": "Sale",
    "buy": "Sale",
    "purchase": "Sale",
    "for sale": "Sale",
    "rent": "Rent",
    "rental": "Rent",
    "for rent": "Rent",
    "lease": "Rent",
}

UNIT_ALIASES: Dict[str, str] = {
    "marla": "Marla",
    "marlas": "Marla",
    "kanal": "Kanal",
    "kanals": "Kanal",
    "sqyard": "SqYards",
    "sq yards": "SqYards",
    "sq. yards": "SqYards",
    "sqyards": "SqYards",
    "square yards": "SqYards",
    "sqft": "SqFt",
    "sq ft": "SqFt",
    "sq. ft": "SqFt",
    "square feet": "SqFt",
    "acre": "Acres",
    "acres": "Acres",
}

ALLOWED_LIFESTYLE = [
    "Near reputable schools",
    "Near medical facilities / hospital",
    "Near parks / green area",
    "Walking distance to mosque",
    "Near metro / public transport",
    "Gated society",
    "Corner plot preference",
]


# ---------------------------------------------------------------------------
# Pydantic contract
# ---------------------------------------------------------------------------

class NaturalLanguageSearchRequest(BaseModel):
    query: str = Field(
        ...,
        min_length=1,
        examples=["5 marla house in Lahore under 3 crore near good schools"],
    )
    preferred_city: Optional[str] = Field(default="Lahore")


class StructuredSearchFilter(BaseModel):
    """Canonical search-parser response (snake_case JSON)."""

    raw_query: str
    city: str = Field(..., description="Canonical city name, e.g. Lahore")
    area: Optional[str] = None
    property_type: Optional[str] = Field(
        default=None,
        description="Domain PropertyType string, e.g. House, ApartmentFlat",
    )
    purpose: Optional[str] = Field(
        default=None,
        description="Sale or Rent; null if not specified in the query",
    )
    min_price: Optional[float] = Field(default=None, description="PKR absolute amount")
    max_price: Optional[float] = Field(default=None, description="PKR absolute amount")
    bedrooms: Optional[int] = Field(default=None, ge=0, le=20)
    land_area: Optional[float] = Field(default=None, ge=0)
    land_area_unit: Optional[str] = Field(default=None, description="Marla|Kanal|SqYards|SqFt|Acres")
    lifestyle_preferences: List[str] = Field(default_factory=list)
    investment_intent: Optional[str] = None
    confidence_score: float = Field(default=0.5, ge=0.0, le=1.0)

    @field_validator("city", mode="before")
    @classmethod
    def _city_nonempty(cls, v: Any) -> Any:
        if v is None or (isinstance(v, str) and not v.strip()):
            return AllowedCity.LAHORE.value
        return v

    @field_validator("lifestyle_preferences", mode="before")
    @classmethod
    def _lifestyle_list(cls, v: Any) -> Any:
        if v is None:
            return []
        return v

    @model_validator(mode="after")
    def _normalize(self) -> "StructuredSearchFilter":
        normalized = normalize_search_filter(self.model_dump())
        for key, value in normalized.model_dump().items():
            setattr(self, key, value)
        return self


def _blank_to_none(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    s = str(value).strip()
    return s if s else None


def normalize_city(value: Optional[str], preferred: Optional[str] = None) -> str:
    raw = (value or preferred or AllowedCity.LAHORE.value).strip()
    key = raw.lower()
    if key in CITY_ALIASES:
        return CITY_ALIASES[key]
    for city in AllowedCity:
        if city.value.lower() == key:
            return city.value
    # Title-case unknown but keep something usable
    return raw[:1].upper() + raw[1:] if raw else AllowedCity.LAHORE.value


def normalize_area(value: Optional[str]) -> Optional[str]:
    value = _blank_to_none(value)
    if not value:
        return None
    key = re.sub(r"\s+", " ", value.lower().strip())
    if key in AREA_ALIASES:
        return AREA_ALIASES[key]
    return value


def normalize_property_type(value: Optional[str]) -> Optional[str]:
    value = _blank_to_none(value)
    if not value:
        return None
    key = value.lower().strip()
    if key in PROPERTY_TYPE_ALIASES:
        return PROPERTY_TYPE_ALIASES[key]
    for pt in PropertyTypeValue:
        if pt.value.lower() == key:
            return pt.value
    # Reject unknown inventiveness for LLM outputs
    return None


def normalize_purpose(value: Optional[str]) -> Optional[str]:
    value = _blank_to_none(value)
    if not value:
        return None
    key = value.lower().strip()
    if key in PURPOSE_ALIASES:
        return PURPOSE_ALIASES[key]
    for p in PropertyPurposeValue:
        if p.value.lower() == key:
            return p.value
    return None


def normalize_land_unit(value: Optional[str]) -> Optional[str]:
    value = _blank_to_none(value)
    if not value:
        return None
    key = value.lower().strip()
    if key in UNIT_ALIASES:
        return UNIT_ALIASES[key]
    for u in LandAreaUnitValue:
        if u.value.lower() == key:
            return u.value
    return None


def normalize_search_filter(
    data: Union[StructuredSearchFilter, Dict[str, Any]],
    *,
    preferred_city: Optional[str] = None,
) -> StructuredSearchFilter:
    """Validate + canonicalize a raw dict or model into StructuredSearchFilter."""
    if isinstance(data, StructuredSearchFilter):
        payload = data.model_dump()
    else:
        payload = dict(data)

    city = normalize_city(payload.get("city"), preferred_city or payload.get("preferred_city"))
    area = normalize_area(payload.get("area"))
    prop_type = normalize_property_type(payload.get("property_type"))
    purpose = normalize_purpose(payload.get("purpose"))
    unit = normalize_land_unit(payload.get("land_area_unit"))

    land_area = payload.get("land_area")
    if land_area is not None:
        try:
            land_area = float(land_area)
            if land_area <= 0:
                land_area = None
        except (TypeError, ValueError):
            land_area = None
    if land_area is None:
        unit = None
    elif unit is None:
        unit = LandAreaUnitValue.MARLA.value

    min_price = payload.get("min_price")
    max_price = payload.get("max_price")
    try:
        min_price = float(min_price) if min_price is not None else None
    except (TypeError, ValueError):
        min_price = None
    try:
        max_price = float(max_price) if max_price is not None else None
    except (TypeError, ValueError):
        max_price = None
    if min_price is not None and min_price < 0:
        min_price = None
    if max_price is not None and max_price < 0:
        max_price = None
    if min_price is not None and max_price is not None and min_price > max_price:
        min_price, max_price = max_price, min_price

    bedrooms = payload.get("bedrooms")
    try:
        bedrooms = int(bedrooms) if bedrooms is not None else None
    except (TypeError, ValueError):
        bedrooms = None
    if bedrooms is not None and (bedrooms < 0 or bedrooms > 20):
        bedrooms = None

    lifestyle = payload.get("lifestyle_preferences") or []
    if not isinstance(lifestyle, list):
        lifestyle = [str(lifestyle)]
    lifestyle = [str(x).strip() for x in lifestyle if str(x).strip()]

    intent = _blank_to_none(payload.get("investment_intent"))
    if intent:
        for known in InvestmentIntentValue:
            if known.value.lower() == intent.lower():
                intent = known.value
                break

    conf = payload.get("confidence_score", 0.5)
    try:
        conf = float(conf)
    except (TypeError, ValueError):
        conf = 0.5
    conf = max(0.0, min(1.0, conf))

    # Bypass model_validator recursion: construct then update fields directly
    obj = StructuredSearchFilter.model_construct(
        raw_query=str(payload.get("raw_query") or ""),
        city=city,
        area=area,
        property_type=prop_type,
        purpose=purpose,
        min_price=min_price,
        max_price=max_price,
        bedrooms=bedrooms,
        land_area=land_area,
        land_area_unit=unit,
        lifestyle_preferences=lifestyle,
        investment_intent=intent,
        confidence_score=conf,
    )
    return obj


def build_ollama_json_schema() -> Dict[str, Any]:
    """JSON Schema object suitable for Ollama chat `format` parameter."""
    return {
        "type": "object",
        "properties": {
            "raw_query": {"type": "string"},
            "city": {
                "type": "string",
                "enum": [c.value for c in AllowedCity],
            },
            "area": {"type": ["string", "null"]},
            "property_type": {
                "type": ["string", "null"],
                "enum": [None] + [p.value for p in PropertyTypeValue],
            },
            "purpose": {
                "type": ["string", "null"],
                "enum": [None, "Sale", "Rent"],
            },
            "min_price": {"type": ["number", "null"], "description": "Absolute PKR"},
            "max_price": {"type": ["number", "null"], "description": "Absolute PKR"},
            "bedrooms": {"type": ["integer", "null"], "minimum": 0, "maximum": 20},
            "land_area": {"type": ["number", "null"]},
            "land_area_unit": {
                "type": ["string", "null"],
                "enum": [None] + [u.value for u in LandAreaUnitValue],
            },
            "lifestyle_preferences": {
                "type": "array",
                "items": {"type": "string"},
            },
            "investment_intent": {"type": ["string", "null"]},
            "confidence_score": {"type": "number", "minimum": 0, "maximum": 1},
        },
        "required": [
            "raw_query",
            "city",
            "area",
            "property_type",
            "purpose",
            "min_price",
            "max_price",
            "bedrooms",
            "land_area",
            "land_area_unit",
            "lifestyle_preferences",
            "investment_intent",
            "confidence_score",
        ],
        "additionalProperties": False,
    }


def schema_catalog() -> Dict[str, Any]:
    """Human + machine readable catalog for GET /ai/search-schema."""
    return {
        "version": "1.0.0",
        "phase": 2,
        "description": "PropertyIQ Pakistan NL search filter contract",
        "response_model": "StructuredSearchFilter",
        "price_unit": "PKR (absolute; 1 crore = 10000000, 1 lakh = 100000)",
        "allowed_cities": [c.value for c in AllowedCity],
        "allowed_property_types": [p.value for p in PropertyTypeValue],
        "allowed_purposes": [p.value for p in PropertyPurposeValue],
        "allowed_land_area_units": [u.value for u in LandAreaUnitValue],
        "allowed_lifestyle_preferences": ALLOWED_LIFESTYLE,
        "allowed_investment_intents": [i.value for i in InvestmentIntentValue],
        "area_aliases": AREA_ALIASES,
        "json_schema": build_ollama_json_schema(),
        "example": {
            "raw_query": "5 marla house in DHA Lahore under 3 crore for sale",
            "city": "Lahore",
            "area": "DHA Phase 6",
            "property_type": "House",
            "purpose": "Sale",
            "min_price": None,
            "max_price": 30000000.0,
            "bedrooms": 3,
            "land_area": 5.0,
            "land_area_unit": "Marla",
            "lifestyle_preferences": [],
            "investment_intent": "Personal Residence",
            "confidence_score": 0.92,
        },
    }


def write_schema_json(path: Optional[Path] = None) -> Path:
    out = path or (Path(__file__).resolve().parent / "search_filter.schema.json")
    out.write_text(json.dumps(build_ollama_json_schema(), indent=2), encoding="utf-8")
    return out


# Emit schema file at import so Phase 3 / docs always have a snapshot
try:
    write_schema_json()
except OSError:
    pass
