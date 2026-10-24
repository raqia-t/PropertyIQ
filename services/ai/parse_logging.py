"""Phase 8 — structured search-parser ops logging."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

from search_schema import StructuredSearchFilter

LOG_DIR = Path(__file__).resolve().parent / "logs"
LOG_FILE = LOG_DIR / "search-parser.jsonl"

_file_logger = logging.getLogger("propertyiq.ai.parse_file")
_file_logger.setLevel(logging.INFO)
_file_logger.propagate = False


def _ensure_handler() -> None:
    if _file_logger.handlers:
        return
    try:
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        handler = logging.FileHandler(LOG_FILE, encoding="utf-8")
        handler.setFormatter(logging.Formatter("%(message)s"))
        _file_logger.addHandler(handler)
    except OSError:
        # Fall back to stdout-only if logs dir is not writable
        pass


def log_parse_event(
    *,
    raw_query: str,
    preferred_city: Optional[str],
    source: str,
    result: StructuredSearchFilter,
    latency_ms: int,
    mode: str,
    fallback_reason: Optional[str] = None,
) -> Dict[str, Any]:
    """Emit one JSON line: query, parsed filters, confidence, latency, source."""
    _ensure_handler()
    event = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "event": "search_parser",
        "mode": mode,
        "source": source,
        "latency_ms": latency_ms,
        "fallback_reason": fallback_reason,
        "preferred_city": preferred_city,
        "raw_query": raw_query,
        "parsed": result.model_dump(),
        "confidence_score": result.confidence_score,
    }
    line = json.dumps(event, ensure_ascii=False, default=str)
    _file_logger.info(line)
    logging.getLogger("propertyiq.ai").info(
        "search-parser source=%s latency_ms=%s conf=%.2f city=%s type=%s purpose=%s query=%r fallback=%s",
        source,
        latency_ms,
        result.confidence_score,
        result.city,
        result.property_type,
        result.purpose,
        raw_query[:120],
        fallback_reason or "-",
    )
    return event
