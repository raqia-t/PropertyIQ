"""Phase C — property photo classification (Ollama vision + filename fallback)."""

from __future__ import annotations

import base64
import json
import logging
import os
import re
from typing import Any, Dict, List, Optional, Tuple

import httpx

from ollama_parser import OLLAMA_BASE_URL, _extract_json_object

logger = logging.getLogger("propertyiq.ai.image")

OLLAMA_VISION_MODEL = os.getenv("OLLAMA_VISION_MODEL", "llava:7b").strip()
OLLAMA_VISION_TIMEOUT_SEC = float(os.getenv("OLLAMA_VISION_TIMEOUT_SEC", "180"))
# Interactive classify must stay snappy; full vision pull can still use OLLAMA_VISION_TIMEOUT_SEC elsewhere.
AI_IMAGE_CLASSIFY_TIMEOUT_SEC = float(
    os.getenv("AI_IMAGE_CLASSIFY_TIMEOUT_SEC", "18")
)
AI_IMAGE_CLASSIFY_MODE = os.getenv("AI_IMAGE_CLASSIFY_MODE", "hybrid").strip().lower()

ALLOWED_ROOMS = [
    "Exterior",
    "LivingRoom",
    "Kitchen",
    "Bedroom",
    "Bathroom",
    "DiningRoom",
    "TerraceGarden",
    "FloorPlan",
    "Other",
]

ROOM_TO_UI_CATEGORY = {
    "Exterior": "Exterior / Elevation",
    "LivingRoom": "Living Room / Hall",
    "Kitchen": "Kitchen",
    "Bedroom": "Bedroom",
    "Bathroom": "Bathroom / Powder Room",
    "DiningRoom": "Dining Room",
    "TerraceGarden": "Terrace / Garden",
    "FloorPlan": "Floor Plan / Layout",
    "Other": "Living Room / Hall",
}


def get_image_classify_config() -> Dict[str, Any]:
    return {
        "mode": AI_IMAGE_CLASSIFY_MODE,
        "vision_model": OLLAMA_VISION_MODEL,
        "timeout_sec": AI_IMAGE_CLASSIFY_TIMEOUT_SEC,
        "vision_timeout_sec": OLLAMA_VISION_TIMEOUT_SEC,
        "allowed_rooms": ALLOWED_ROOMS,
    }


def check_vision_model() -> Dict[str, Any]:
    try:
        with httpx.Client(timeout=3.0) as client:
            r = client.get(f"{OLLAMA_BASE_URL}/api/tags")
            r.raise_for_status()
            names = [m.get("name", "") for m in r.json().get("models", [])]
            present = any(
                n == OLLAMA_VISION_MODEL
                or n.startswith(OLLAMA_VISION_MODEL)
                or n.startswith(OLLAMA_VISION_MODEL.split(":")[0])
                for n in names
            )
            return {
                "status": "up" if present else "model_missing",
                "model": OLLAMA_VISION_MODEL,
                "model_present": present,
                "models": names[:16],
            }
    except Exception as ex:  # noqa: BLE001
        return {
            "status": "down",
            "model": OLLAMA_VISION_MODEL,
            "model_present": False,
            "error": str(ex),
        }


_FILENAME_KEYWORDS = (
    "exterior",
    "front",
    "elevation",
    "facade",
    "gate",
    "driveway",
    "kitchen",
    "cook",
    "bath",
    "wash",
    "toilet",
    "powder",
    "dining",
    "terrace",
    "balcony",
    "garden",
    "lawn",
    "roof",
    "plan",
    "blueprint",
    "layout",
    "bed",
    "master",
    "living",
    "lounge",
    "hall",
    "drawing",
)


def _filename_has_strong_hints(name_or_url: str) -> bool:
    f = (name_or_url or "").lower()
    return any(k in f for k in _FILENAME_KEYWORDS)


def _filename_hints(name_or_url: str) -> Tuple[str, List[str]]:
    f = (name_or_url or "").lower()
    if any(x in f for x in ("exterior", "front", "elevation", "facade", "gate", "driveway")):
        return "Exterior", ["Front elevation", "Street-facing view", "Driveway / gate"]
    if any(x in f for x in ("kitchen", "cook")):
        return "Kitchen", ["Cabinets", "Countertop", "Kitchen view"]
    if any(x in f for x in ("bath", "wash", "toilet", "powder")):
        return "Bathroom", ["Fixtures", "Vanity", "Washroom"]
    if "dining" in f:
        return "DiningRoom", ["Dining area"]
    if any(x in f for x in ("terrace", "balcony", "garden", "lawn", "roof")):
        return "TerraceGarden", ["Outdoor space"]
    if any(x in f for x in ("plan", "blueprint", "layout", "map")):
        return "FloorPlan", ["Layout drawing"]
    if "bed" in f or "master" in f:
        return "Bedroom", ["Bedroom view", "Wardrobe space"]
    if any(x in f for x in ("living", "lounge", "hall", "drawing")):
        return "LivingRoom", ["Living area", "Natural light"]
    return "LivingRoom", ["Interior photo"]


def classify_by_filename(image_url: str = "", filename: str = "") -> Dict[str, Any]:
    room, features = _filename_hints(filename or image_url)
    strong = _filename_has_strong_hints(filename or image_url)
    return {
        "classified_room": room,
        "ui_category": ROOM_TO_UI_CATEGORY.get(room, "Living Room / Hall"),
        "confidence": 0.72 if strong else 0.55,
        "detected_features": features,
        "quality_issues": [],
        "missing_media_suggestions": [
            "Add exterior / front elevation if missing",
            "Add kitchen photo for completeness",
            "Add at least one bedroom and washroom photo",
        ],
        "source": "filename_fallback",
    }


def _build_vision_schema() -> Dict[str, Any]:
    return {
        "type": "object",
        "properties": {
            "classified_room": {"type": "string", "enum": ALLOWED_ROOMS},
            "confidence": {"type": "number"},
            "detected_features": {
                "type": "array",
                "items": {"type": "string"},
                "maxItems": 6,
            },
            "quality_issues": {
                "type": "array",
                "items": {"type": "string"},
                "maxItems": 4,
            },
            "missing_media_suggestions": {
                "type": "array",
                "items": {"type": "string"},
                "maxItems": 4,
            },
        },
        "required": [
            "classified_room",
            "confidence",
            "detected_features",
            "quality_issues",
            "missing_media_suggestions",
        ],
    }


def _normalize_vision(raw: Dict[str, Any]) -> Dict[str, Any]:
    room = str(raw.get("classified_room") or "Other").strip()
    if room not in ALLOWED_ROOMS:
        # fuzzy map
        rl = room.lower().replace(" ", "")
        mapped = None
        for allowed in ALLOWED_ROOMS:
            if allowed.lower() in rl or rl in allowed.lower():
                mapped = allowed
                break
        room = mapped or "Other"

    def _list(key: str, n: int) -> List[str]:
        val = raw.get(key) or []
        if not isinstance(val, list):
            return []
        return [str(x).strip() for x in val if str(x).strip()][:n]

    conf = raw.get("confidence", 0.75)
    try:
        conf = float(conf)
    except (TypeError, ValueError):
        conf = 0.75
    conf = max(0.0, min(1.0, conf))

    return {
        "classified_room": room,
        "ui_category": ROOM_TO_UI_CATEGORY.get(room, "Living Room / Hall"),
        "confidence": round(conf, 2),
        "detected_features": _list("detected_features", 6) or ["Property interior/exterior photo"],
        "quality_issues": _list("quality_issues", 4),
        "missing_media_suggestions": _list("missing_media_suggestions", 4)
        or [
            "Ensure exterior elevation is included",
            "Include kitchen and bathroom photos",
        ],
        "source": "ollama_vision",
    }


def _fetch_image_bytes(image_url: str) -> Optional[bytes]:
    if not image_url:
        return None
    if image_url.startswith("data:"):
        # data:image/jpeg;base64,...
        m = re.match(r"data:[^;]+;base64,(.+)", image_url, re.DOTALL)
        if not m:
            return None
        try:
            return base64.b64decode(m.group(1))
        except Exception:  # noqa: BLE001
            return None
    try:
        with httpx.Client(timeout=30.0, follow_redirects=True) as client:
            r = client.get(image_url)
            if r.status_code >= 400:
                return None
            return r.content
    except Exception as ex:  # noqa: BLE001
        logger.warning("image fetch failed: %s", ex)
        return None


def classify_with_ollama_vision(
    *,
    image_b64: Optional[str] = None,
    image_url: str = "",
    property_type: str = "House",
    timeout_sec: Optional[float] = None,
) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    vision = check_vision_model()
    if not vision.get("model_present"):
        return None, f"vision model missing: {OLLAMA_VISION_MODEL}"

    b64 = (image_b64 or "").strip()
    if b64.startswith("data:"):
        m = re.match(r"data:[^;]+;base64,(.+)", b64, re.DOTALL)
        b64 = m.group(1) if m else b64
    if not b64 and image_url:
        raw = _fetch_image_bytes(image_url)
        if raw:
            b64 = base64.b64encode(raw).decode("ascii")
    if not b64:
        return None, "no image bytes"

    # Keep payload reasonable for local models
    if len(b64) > 8_000_000:
        return None, "image too large for vision request"

    prompt = (
        f"You classify a Pakistan real-estate listing photo for a {property_type}. "
        "Pick classified_room from the allowed enum. "
        "List up to 6 short factual detected_features visible in the image. "
        "List quality_issues only if blurry/dark/obstructed. "
        "Suggest missing_media_suggestions for a complete listing. "
        "Do not invent luxury brands not visible."
    )

    payload = {
        "model": OLLAMA_VISION_MODEL,
        "stream": False,
        "format": _build_vision_schema(),
        "messages": [
            {
                "role": "user",
                "content": prompt,
                "images": [b64],
            }
        ],
        "options": {"temperature": 0.1, "num_predict": 400},
    }

    timeout = timeout_sec if timeout_sec is not None else AI_IMAGE_CLASSIFY_TIMEOUT_SEC
    try:
        with httpx.Client(timeout=timeout) as client:
            resp = client.post(f"{OLLAMA_BASE_URL}/api/chat", json=payload)
            if resp.status_code >= 400:
                return None, f"ollama HTTP {resp.status_code}: {resp.text[:200]}"
            content = resp.json().get("message", {}).get("content") or ""
            raw = _extract_json_object(content)
            return _normalize_vision(raw), None
    except Exception as ex:  # noqa: BLE001
        logger.warning("vision classify failed: %s", ex)
        return None, str(ex)


def classify_property_image(
    *,
    image_url: str = "",
    image_base64: Optional[str] = None,
    filename: str = "",
    property_type: str = "House",
) -> Tuple[Dict[str, Any], str]:
    mode = AI_IMAGE_CLASSIFY_MODE
    fb = classify_by_filename(image_url=image_url, filename=filename)

    # Hybrid + clear photo name → instant tags (user expectation: tags from filename).
    # Vision only when the name is generic / missing.
    if mode == "hybrid" and _filename_has_strong_hints(filename or image_url):
        fb["source"] = "filename_fallback"
        return fb, "filename_fallback"

    if mode in ("hybrid", "vision", "llm"):
        result, err = classify_with_ollama_vision(
            image_b64=image_base64,
            image_url=image_url,
            property_type=property_type,
            timeout_sec=AI_IMAGE_CLASSIFY_TIMEOUT_SEC,
        )
        if result is not None:
            return result, "ollama_vision"
        logger.warning("image classify vision miss (%s); filename fallback", err)

    source = "filename_fallback" if mode in ("hybrid", "vision", "llm") else "filename"
    fb["source"] = source
    return fb, source
