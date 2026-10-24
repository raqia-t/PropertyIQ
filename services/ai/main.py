from typing import Optional, List, Dict, Any
import logging
import time

from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from search_schema import (
    NaturalLanguageSearchRequest,
    StructuredSearchFilter,
    schema_catalog,
)
from rule_parser import parse_with_rules
from ollama_parser import (
    AI_PARSER_MODE,
    check_ollama_health,
    get_parser_config,
    parse_with_ollama,
)
from prompt_search import PROMPT_VERSION, prompt_catalog
from parse_logging import LOG_FILE, log_parse_event
from ollama_listing_draft import generate_listing_draft, get_listing_draft_config
from property_scenario import compute_scenario
from ollama_scenario_explain import explain_scenario_with_ollama, get_scenario_explain_config
from image_classifier import (
    check_vision_model,
    classify_property_image,
    get_image_classify_config,
)
from agent_ops import get_agent_ops_config, run_agent_ops

logger = logging.getLogger("propertyiq.ai")
logging.basicConfig(level=logging.INFO)

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

class PropertyCompSnapshot(BaseModel):
    property_id: Optional[str] = None
    title: Optional[str] = None
    city: Optional[str] = None
    area: Optional[str] = None
    property_type: Optional[str] = None
    purpose: Optional[str] = None
    price: float = 0
    size: float = 0
    size_unit: str = "Marla"
    bedrooms: Optional[int] = None
    expected_rent_min: Optional[float] = None
    expected_rent_max: Optional[float] = None


class PropertyScenarioRequest(BaseModel):
    property_id: Optional[str] = None
    city: str
    area: str
    property_type: str
    size: float
    size_unit: str = "Marla"
    asking_price: float
    bedrooms: Optional[int] = None
    purpose: Optional[str] = "Sale"
    sale_comps: List[PropertyCompSnapshot] = Field(default_factory=list)
    rent_comps: List[PropertyCompSnapshot] = Field(default_factory=list)


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
    sale_comp_count: int = 0
    rent_comp_count: int = 0
    valuation_source: str = "formula"
    explain_source: str = "none"

class ImageClassificationRequest(BaseModel):
    image_url: Optional[str] = ""
    image_base64: Optional[str] = None
    filename: Optional[str] = None
    property_type: Optional[str] = "House"


class ImageClassificationResponse(BaseModel):
    classified_room: str
    ui_category: str = "Living Room / Hall"
    confidence: float
    detected_features: List[str]
    quality_issues: List[str]
    missing_media_suggestions: List[str]
    source: str = "filename_fallback"


@app.get("/health")
def health_check():
    llm = check_ollama_health()
    llm_ok = llm.get("status") == "up"
    parser_mode = get_parser_config().get("mode", "hybrid")
    # Degraded when hybrid/llm expected but Ollama is down (rules still work)
    overall = "healthy"
    if parser_mode in ("hybrid", "llm") and not llm_ok:
        overall = "degraded"

    return {
        "status": overall,
        "service": "PropertyIQ AI Microservice",
        "market": "Pakistan",
        "search_schema_version": "1.0.0",
        "prompt_version": PROMPT_VERSION,
        "parser": get_parser_config(),
        "llm": llm,
        "ops": {
            "parse_log_file": str(LOG_FILE),
            "ready_for_nl_search": True,
            "ollama_required_for_best_quality": parser_mode in ("hybrid", "llm"),
            "listing_draft": get_listing_draft_config(),
            "scenario_explain": get_scenario_explain_config(),
            "image_classify": get_image_classify_config(),
            "vision": check_vision_model(),
            "agent_ops": get_agent_ops_config(),
        },
    }


@app.get("/health/ready")
def health_ready():
    """Phase 8 readiness probe for start-dev / orchestrators."""
    body = health_check()
    llm = body.get("llm") or {}
    ready = body.get("status") in ("healthy", "degraded")
    return {
        "ready": ready,
        "status": body.get("status"),
        "llm": llm.get("status"),
        "prompt_version": body.get("prompt_version"),
        "parser_mode": (body.get("parser") or {}).get("mode"),
    }


@app.get("/ai/search-schema")
def get_search_schema():
    """Phase 2 contract: enums + JSON Schema for Ollama / clients."""
    return schema_catalog()


@app.get("/ai/search-prompt")
def get_search_prompt():
    """Phase 4 prompt catalog (glossary, enums, few-shots)."""
    return prompt_catalog()


@app.post("/ai/search-parser", response_model=StructuredSearchFilter)
def parse_natural_language_search(request: NaturalLanguageSearchRequest, response: Response):
    """
    Phase 3 hybrid parser (+ Phase 8 structured ops logging):
      hybrid (default) -> Ollama then rule fallback
      llm              -> Ollama preferred; still falls back to rules if Ollama fails
      rules            -> rule parser only
    """
    mode = AI_PARSER_MODE
    source = "rules"
    fallback_reason: Optional[str] = None
    t0 = time.perf_counter()

    if mode in ("hybrid", "llm"):
        result, err = parse_with_ollama(request)
        if result is not None:
            source = "ollama"
            response.headers["X-PropertyIQ-Parser"] = source
            latency_ms = int((time.perf_counter() - t0) * 1000)
            log_parse_event(
                raw_query=request.query,
                preferred_city=request.preferred_city,
                source=source,
                result=result,
                latency_ms=latency_ms,
                mode=mode,
            )
            return result
        fallback_reason = err or "ollama_unavailable"
        logger.warning("search-parser ollama miss (%s); falling back to rules", fallback_reason)

    result = parse_with_rules(request)
    # Tag rule fallback slightly lower when hybrid wanted LLM
    if mode in ("hybrid", "llm") and source != "ollama":
        result.confidence_score = min(result.confidence_score, 0.85)
        source = "rules_fallback"
    else:
        source = "rules"
        fallback_reason = None

    response.headers["X-PropertyIQ-Parser"] = source
    latency_ms = int((time.perf_counter() - t0) * 1000)
    log_parse_event(
        raw_query=request.query,
        preferred_city=request.preferred_city,
        source=source,
        result=result,
        latency_ms=latency_ms,
        mode=mode,
        fallback_reason=fallback_reason,
    )
    return result


@app.post("/ai/property-scenario", response_model=PropertyScenarioResponse)
def calculate_property_scenario(request: PropertyScenarioRequest, response: Response):
    """Phase B: comps-aware valuation + optional Ollama explanation (numbers stay locked)."""
    sale = [c.model_dump() for c in request.sale_comps]
    rent = [c.model_dump() for c in request.rent_comps]
    result, source = compute_scenario(
        city=request.city,
        area=request.area,
        property_type=request.property_type,
        size=request.size,
        size_unit=request.size_unit,
        asking_price=request.asking_price,
        bedrooms=request.bedrooms,
        sale_comps=sale,
        rent_comps=rent,
        purpose=request.purpose,
    )

    explain_source = "none"
    bullets = explain_scenario_with_ollama(
        city=request.city,
        area=request.area,
        property_type=request.property_type,
        size=request.size,
        size_unit=request.size_unit,
        asking_price=request.asking_price,
        scenario=result,
    )
    if bullets:
        # Keep deterministic assumptions, append AI narrative
        result["assumptions"] = list(result.get("assumptions") or []) + bullets
        explain_source = "ollama"

    result["explain_source"] = explain_source
    response.headers["X-PropertyIQ-Valuation"] = source
    response.headers["X-PropertyIQ-Scenario-Explain"] = explain_source
    logger.info(
        "property-scenario source=%s explain=%s sale_comps=%s rent_comps=%s city=%s",
        source,
        explain_source,
        result.get("sale_comp_count"),
        result.get("rent_comp_count"),
        request.city,
    )
    return PropertyScenarioResponse(**result)


@app.post("/ai/image-classification", response_model=ImageClassificationResponse)
def classify_property_image_endpoint(request: ImageClassificationRequest, response: Response):
    """Phase C: Ollama vision classify with filename fallback."""
    if not (request.image_url or request.image_base64):
        raise HTTPException(status_code=400, detail="image_url or image_base64 required")

    result, source = classify_property_image(
        image_url=request.image_url or "",
        image_base64=request.image_base64,
        filename=request.filename or "",
        property_type=request.property_type or "House",
    )
    response.headers["X-PropertyIQ-Image-Source"] = source
    logger.info(
        "image-classify source=%s room=%s conf=%s",
        source,
        result.get("classified_room"),
        result.get("confidence"),
    )
    return ImageClassificationResponse(**result)


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
def generate_listing_draft_endpoint(request: GenerateListingDraftRequest, response: Response):
    """Phase A: Ollama listing draft with template fallback."""
    payload = request.model_dump()
    draft, source = generate_listing_draft(payload)
    response.headers["X-PropertyIQ-Listing-Draft"] = source
    logger.info(
        "listing-draft source=%s city=%s area=%s type=%s score=%s",
        source,
        request.city,
        request.area,
        request.property_type,
        draft.get("completeness_score"),
    )
    return AiListingDraftResponse(**draft)


class AgentOpsAlertIn(BaseModel):
    property_id: str
    title: Optional[str] = None
    issue: Optional[str] = None
    recommendation: Optional[str] = None
    alert_type: Optional[str] = None
    city: Optional[str] = None
    area: Optional[str] = None
    asking_price: Optional[float] = None


class AgentOpsRequest(BaseModel):
    stats: Dict[str, Any] = Field(default_factory=dict)
    fallback_brief: Optional[str] = None
    alerts: List[AgentOpsAlertIn] = Field(default_factory=list)
    audience: str = "agent"  # agent | agency | developer


class AgentOpsRecommendationOut(BaseModel):
    property_id: str
    recommendation: str
    source: str = "rules"


class AgentOpsResponse(BaseModel):
    briefing: str
    briefing_source: str
    recommendations: List[AgentOpsRecommendationOut]
    fallback_reason: Optional[str] = None


@app.post("/ai/agent-ops", response_model=AgentOpsResponse)
def agent_ops_endpoint(request: AgentOpsRequest, response: Response):
    """Phase D: polish daily brief + optimizer recommendations over locked dashboard stats."""
    result = run_agent_ops(
        stats=request.stats or {},
        fallback_brief=request.fallback_brief,
        alerts=[a.model_dump() for a in request.alerts],
        audience=request.audience or "agent",
    )
    response.headers["X-PropertyIQ-Agent-Ops"] = result.get("briefing_source") or "rules"
    logger.info(
        "agent-ops briefing_source=%s alerts=%s",
        result.get("briefing_source"),
        len(result.get("recommendations") or []),
    )
    return AgentOpsResponse(**result)
