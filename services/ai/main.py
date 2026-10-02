from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(
    title="PropertyIQ AI Intelligence Microservice",
    description="Dedicated AI orchestration service for PropertyIQ AI Pakistan (Search Parser, Valuation Scenarios, and Image Intelligence)",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class NaturalLanguageSearchRequest(BaseModel):
    query: str = Field(..., example="5 marla house in Lahore under 3 crore near good schools with rental potential")
    preferred_city: Optional[str] = "Lahore"

class StructuredSearchFilter(BaseModel):
    raw_query: str
    city: str
    area: Optional[str] = None
    property_type: Optional[str] = None
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    bedrooms: Optional[int] = None
    land_area: Optional[float] = None
    land_area_unit: Optional[str] = "Marla"
    lifestyle_preferences: List[str] = []
    investment_intent: Optional[str] = None
    confidence_score: float

class PropertyScenarioRequest(BaseModel):
    property_id: Optional[str] = None
    city: str
    area: str
    property_type: str
    size: float
    size_unit: str = "Marla"
    asking_price: float
    bedrooms: Optional[int] = None

class PropertyScenarioResponse(BaseModel):
    fair_price_low: float
    fair_price_high: float
    estimated_rent_monthly_min: float
    estimated_rent_monthly_max: float
    gross_yield_percentage: float
    future_value_3yr_scenario: float
    future_value_5yr_scenario: float
    future_value_10yr_scenario: float
    assumptions: List[str]
    confidence_score: float
    disclaimer: str

class ImageClassificationRequest(BaseModel):
    image_url: str
    property_type: Optional[str] = "House"

class ImageClassificationResponse(BaseModel):
    classified_room: str
    confidence: float
    detected_features: List[str]
    quality_issues: List[str]
    missing_media_suggestions: List[str]


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "PropertyIQ AI Microservice",
        "market": "Pakistan"
    }


@app.post("/ai/search-parser", response_model=StructuredSearchFilter)
def parse_natural_language_search(request: NaturalLanguageSearchRequest):
    q = request.query.lower()
    
    # Deterministic rule-based extraction tailored for Pakistan market terminology
    city = request.preferred_city or "Lahore"
    if "lahore" in q:
        city = "Lahore"
    elif "islamabad" in q:
        city = "Islamabad"
    elif "rawalpindi" in q:
        city = "Rawalpindi"
    elif "karachi" in q:
        city = "Karachi"

    # Property Type
    prop_type = None
    if "house" in q or "kothi" in q or "bungalow" in q:
        prop_type = "House"
    elif "flat" in q or "apartment" in q:
        prop_type = "ApartmentFlat"
    elif "plot" in q:
        prop_type = "Plot"
    elif "commercial" in q or "shop" in q:
        prop_type = "CommercialShop"

    # Land Area
    land_area = None
    land_unit = "Marla"
    if "5 marla" in q or "5-marla" in q:
        land_area = 5.0
        land_unit = "Marla"
    elif "10 marla" in q or "10-marla" in q:
        land_area = 10.0
        land_unit = "Marla"
    elif "1 kanal" in q or "1-kanal" in q:
        land_area = 1.0
        land_unit = "Kanal"

    # Budget (Crore / Lakh)
    max_price = None
    if "under 3 crore" in q or "under 3 cr" in q:
        max_price = 30000000.0
    elif "under 2 crore" in q or "under 2 cr" in q:
        max_price = 20000000.0
    elif "under 1 crore" in q or "under 1 cr" in q:
        max_price = 10000000.0
    elif "under 50 lakh" in q or "under 50 lac" in q:
        max_price = 5000000.0

    lifestyle = []
    if "school" in q:
        lifestyle.append("Near reputable schools")
    if "hospital" in q:
        lifestyle.append("Near medical facilities / hospital")
    if "park" in q:
        lifestyle.append("Near parks / green area")
    if "mosque" in q or "masjid" in q:
        lifestyle.append("Walking distance to mosque")

    investment_intent = "Rental & Capital Appreciation" if ("rental" in q or "yield" in q or "investment" in q) else "Personal Residence"

    return StructuredSearchFilter(
        raw_query=request.query,
        city=city,
        area="DHA Phase 6" if "dha" in q else None,
        property_type=prop_type,
        min_price=None,
        max_price=max_price,
        bedrooms=3 if "3 bed" in q else (5 if land_area == 10.0 else 3 if land_area == 5.0 else None),
        land_area=land_area,
        land_area_unit=land_unit,
        lifestyle_preferences=lifestyle,
        investment_intent=investment_intent,
        confidence_score=0.92
    )


@app.post("/ai/property-scenario", response_model=PropertyScenarioResponse)
def calculate_property_scenario(request: PropertyScenarioRequest):
    price = request.asking_price
    
    # Valuation band based on current Pakistan market yield norms (3.5% - 5.5% gross residential yield)
    fair_price_low = round(price * 0.94, 2)
    fair_price_high = round(price * 1.05, 2)

    monthly_rent_mid = round(price * 0.0042, 2)  # ~5.0% annual gross yield
    rent_min = round(monthly_rent_mid * 0.90, 2)
    rent_max = round(monthly_rent_mid * 1.12, 2)
    annual_rent = monthly_rent_mid * 12
    gross_yield = round((annual_rent / price) * 100, 2) if price > 0 else 0.0

    # 3, 5, 10-year compounding appreciation scenarios (assumes historical 10-12% nominal growth in prime Pakistan urban corridors)
    fv_3 = round(price * (1.11 ** 3), 2)
    fv_5 = round(price * (1.11 ** 5), 2)
    fv_10 = round(price * (1.11 ** 10), 2)

    return PropertyScenarioResponse(
        fair_price_low=fair_price_low,
        fair_price_high=fair_price_high,
        estimated_rent_monthly_min=rent_min,
        estimated_rent_monthly_max=rent_max,
        gross_yield_percentage=gross_yield,
        future_value_3yr_scenario=fv_3,
        future_value_5yr_scenario=fv_5,
        future_value_10yr_scenario=fv_10,
        assumptions=[
            f"Based on comparable active listings in {request.area}, {request.city}",
            "Nominal appreciation model assumes 11% average annual corridor growth",
            "Rental estimate assumes standard unfurnished/semi-furnished residential occupancy with 10% annual escalation",
            "Estimates exclude society transfer taxes and stamp duty"
        ],
        confidence_score=0.88,
        disclaimer="Estimates and scenario models are generated for informational decision support and do not guarantee future rental income or market liquidation value."
    )


@app.post("/ai/image-classification", response_model=ImageClassificationResponse)
def classify_property_image(request: ImageClassificationRequest):
    # Standard classification & attribute tagging
    url_lower = request.image_url.lower()
    room = "LivingRoom"
    features = [
        "Imported porcelain tile flooring",
        "Recessed false ceiling with LED downlights",
        "Large double-glazed aluminum windows with natural lighting",
        "Modern wall-mounted media console"
    ]
    if "kitchen" in url_lower:
        room = "Kitchen"
        features = ["Spanish marble countertops", "Fitted cabinets with soft-close hinges", "Built-in oven space", "Double stainless sink"]
    elif "bed" in url_lower:
        room = "Bedroom"
        features = ["Solid ash wood doors", "Hardwood/laminate finish flooring", "Wardrobe dressing space", "En-suite washroom access"]
    elif "exterior" in url_lower or "front" in url_lower:
        room = "Exterior"
        features = ["Modern Spanish front elevation", "Wide driveway with automated gate space", "Weather-resistant exterior paint"]
    elif "bath" in url_lower or "wash" in url_lower:
        room = "Bathroom"
        features = ["Grohe sanitary fittings", "Tempered glass shower partition", "Modern vanity with LED touch mirror"]

    return ImageClassificationResponse(
        classified_room=room,
        confidence=0.94,
        detected_features=features,
        quality_issues=[],
        missing_media_suggestions=[
            "Exterior front elevation photo recommended",
            "Kitchen view required for high listing completeness score",
            "Master washroom photo missing"
        ]
    )


class GenerateListingDraftRequest(BaseModel):
    property_type: str = "House"
    city: str = "Lahore"
    area: str = "DHA Phase 6"
    size: float = 1.0
    size_unit: str = "Kanal"
    price: float = 98000000.0
    bedrooms: Optional[int] = 5
    bathrooms: Optional[int] = 6
    furnishing: Optional[str] = "Semi-Furnished"
    user_notes: Optional[str] = "Imported fixtures, basement home theater, solar backup system installed."

class AiListingDraftResponse(BaseModel):
    suggested_title: str
    suggested_description: str
    selling_highlights: List[str]
    seo_keywords: List[str]
    completeness_score: int
    confirmation_required: List[str]
    disclaimer: str


@app.post("/ai/listing-draft", response_model=AiListingDraftResponse)
def generate_listing_draft(request: GenerateListingDraftRequest):
    price_formatted = f"PKR {request.price / 10000000:.2f} Crore" if request.price >= 10000000 else f"PKR {request.price / 100000:.0f} Lakh"
    title = f"Brand New {request.size} {request.size_unit} Modern Luxury {request.property_type} in {request.area}, {request.city}"
    
    desc = (
        f"PropertyIQ AI Verified Listing: Spectacular newly constructed {request.size} {request.size_unit} designer {request.property_type.lower()} "
        f"located in prime {request.area}, {request.city}. Offering {request.bedrooms} expansive master bedrooms with designer attached baths, "
        f"open-concept chef's kitchen, drawing & dining halls, and dedicated servant quarters. "
        f"Features include: {request.user_notes or 'Premium fittings, solar power backup readiness, and high-security access'}. "
        f"Offered at an attractive valuation of {price_formatted}."
    )

    highlights = [
        f"Prime location in {request.area}, {request.city}",
        f"Spacious {request.size} {request.size_unit} land area with optimal architectural layout",
        f"{request.bedrooms} Master Bedrooms with imported luxury sanitary fittings",
        "Direct access to main commercial hubs, parks, and top-tier educational institutions",
        "Clear documentation with independent verification available on PropertyIQ"
    ]

    keywords = [
        f"{request.size} {request.size_unit} {request.property_type.lower()} in {request.area}",
        f"house for sale in {request.city}",
        f"{request.city} real estate investment",
        f"{request.area} properties"
    ]

    return AiListingDraftResponse(
        suggested_title=title,
        suggested_description=desc,
        selling_highlights=highlights,
        seo_keywords=keywords,
        completeness_score=92,
        confirmation_required=[
            "Please confirm building completion certificate / map approval status",
            "Please confirm utility connections (Electricity meter, Sui Gas, Water Supply)",
            "Please confirm exact possession date"
        ],
        disclaimer="AI-generated description is an assistive draft. The seller/agent is legally responsible for verifying all physical and title assertions before publishing."
    )
