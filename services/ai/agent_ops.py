"""Phase D — agent daily brief + optimizer copy (Ollama polish over locked stats)."""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict, List, Optional, Tuple

import httpx

from ollama_parser import OLLAMA_BASE_URL, OLLAMA_MODEL, _extract_json_object

logger = logging.getLogger("propertyiq.ai.agent_ops")

AI_AGENT_OPS_MODE = os.getenv("AI_AGENT_OPS_MODE", "hybrid").strip().lower()
# Keep short so ASP.NET agent dashboard stays under Next.js proxy budgets.
AGENT_OPS_TIMEOUT_SEC = float(os.getenv("AI_AGENT_OPS_TIMEOUT_SEC", "12"))


def get_agent_ops_config() -> Dict[str, Any]:
    return {
        "mode": AI_AGENT_OPS_MODE,
        "timeout_sec": AGENT_OPS_TIMEOUT_SEC,
        "model": OLLAMA_MODEL,
    }


def build_rules_brief(stats: Dict[str, Any], *, audience: str = "agent") -> str:
    active = int(stats.get("active_listings") or 0)
    pending = int(stats.get("pending_leads") or 0)
    total_leads = int(stats.get("total_leads") or 0)
    views = int(stats.get("total_views") or 0)
    saves = int(stats.get("total_saves") or 0)
    visits = int(stats.get("upcoming_visits") or 0)
    in_review = int(stats.get("in_review") or 0)
    unverified = int(stats.get("unverified") or 0)
    weak = int(stats.get("weak_listing_count") or 0)
    brokers = int(stats.get("active_brokers") or 0)
    monthly = int(stats.get("monthly_leads") or 0)
    org = str(stats.get("org_name") or "").strip()
    aud = audience.strip().lower()
    is_agency = aud in ("agency", "firm", "agency_director")
    is_developer = aud in ("developer", "developer_firm", "dev")

    if is_developer:
        firm = org or "Your development firm"
        total_units = int(stats.get("total_units") or active or 0)
        available = int(stats.get("available_units") or pending or 0)
        booked_or_sold = int(stats.get("booked_or_sold_units") or 0)
        absorption = float(stats.get("absorption_rate_pct") or 0)
        bookings_month = int(stats.get("bookings_this_month") or monthly or 0)
        projects = int(stats.get("project_count") or brokers or 0)
        proofs = int(stats.get("pending_proofs") or 0)
        parts = [
            f"{firm} has {projects} project{'s' if projects != 1 else ''} and {total_units} inventory unit{'s' if total_units != 1 else ''} "
            f"({available} available, {booked_or_sold} booked/sold, {absorption:.1f}% absorption).",
            f"{bookings_month} booking{'s' if bookings_month != 1 else ''} this month.",
        ]
        if proofs > 0:
            parts.append(f"{proofs} payment proof{'s' if proofs != 1 else ''} await verification.")
    elif is_agency:
        firm = org or "Your firm"
        parts = [
            f"{firm} has {brokers} active broker{'s' if brokers != 1 else ''} and {active} active listing{'s' if active != 1 else ''}.",
            f"{pending} new lead{'s' if pending != 1 else ''} need follow-up ({total_leads} firm total; {monthly} this month).",
            f"{views} listing view{'s' if views != 1 else ''} and {saves} wishlist save{'s' if saves != 1 else ''} across firm inventory.",
        ]
    else:
        parts = [
            f"You have {active} active listing{'s' if active != 1 else ''}.",
            f"{pending} new lead{'s' if pending != 1 else ''} need follow-up ({total_leads} total).",
            f"{views} listing view{'s' if views != 1 else ''} and {saves} wishlist save{'s' if saves != 1 else ''} so far.",
        ]
    if visits > 0:
        parts.append(f"{visits} upcoming site visit{'s' if visits != 1 else ''}.")
    if in_review > 0:
        parts.append(f"{in_review} listing{'s' if in_review != 1 else ''} in verification review.")
    if unverified > 0:
        parts.append(f"{unverified} still unverified.")
    if weak > 0:
        parts.append(f"{weak} listing{'s' if weak != 1 else ''} need optimization.")
    return " ".join(parts)


def _schema() -> Dict[str, Any]:
    return {
        "type": "object",
        "properties": {
            "briefing": {"type": "string"},
            "recommendations": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "property_id": {"type": "string"},
                        "recommendation": {"type": "string"},
                    },
                    "required": ["property_id", "recommendation"],
                },
            },
        },
        "required": ["briefing", "recommendations"],
    }


def polish_agent_ops_with_ollama(
    *,
    stats: Dict[str, Any],
    fallback_brief: str,
    alerts: List[Dict[str, Any]],
    audience: str = "agent",
) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    if AI_AGENT_OPS_MODE in ("off", "none", "rules", "false", "0"):
        return None, "mode_rules"

    aud = audience.strip().lower()
    is_agency = aud in ("agency", "firm", "agency_director")
    is_developer = aud in ("developer", "developer_firm", "dev")
    locked = {
        "audience": "developer" if is_developer else ("agency" if is_agency else "agent"),
        "stats": stats,
        "fallback_brief": fallback_brief,
        "alerts": [
            {
                "property_id": str(a.get("property_id") or ""),
                "title": a.get("title"),
                "issue": a.get("issue"),
                "recommendation": a.get("recommendation"),
                "alert_type": a.get("alert_type"),
                "city": a.get("city"),
                "area": a.get("area"),
                "asking_price": a.get("asking_price"),
            }
            for a in alerts
        ],
    }

    if is_developer:
        system = (
            "You are PropertyIQ's developer coach for Pakistan housing schemes. "
            "Rewrite the firm daily briefing into 2–4 short actionable English sentences for the "
            "developer director (inventory release, absorption, payment-proof ops, pricing). "
            "For each alert, rewrite recommendation into one concrete next step. "
            "Use ONLY the locked stats and alert facts — do not invent search volumes, diaspora shares, "
            "market prices, or counts. Keep property_id unchanged."
        )
        user_label = "Locked developer dashboard JSON:\n"
    elif is_agency:
        system = (
            "You are PropertyIQ's agency director coach for Pakistan real estate brokerages. "
            "Rewrite the firm daily briefing into 2–4 short actionable English sentences for the "
            "agency director (team coaching, lead follow-up, inventory health). "
            "For each alert, rewrite recommendation into one concrete next step. "
            "Use ONLY the locked stats and alert facts — do not invent market prices, "
            "lead names, broker performance claims, or counts. Keep property_id unchanged."
        )
        user_label = "Locked agency dashboard JSON:\n"
    else:
        system = (
            "You are PropertyIQ's agent coach for Pakistan real estate. "
            "Rewrite the daily briefing into 2–4 short actionable English sentences. "
            "For each alert, rewrite recommendation into one concrete next step. "
            "Use ONLY the locked stats and alert facts — do not invent market prices, "
            "lead names, or counts. Keep property_id unchanged. Be direct and practical."
        )
        user_label = "Locked agent dashboard JSON:\n"

    payload = {
        "model": OLLAMA_MODEL,
        "stream": False,
        "format": _schema(),
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user_label + json.dumps(locked, ensure_ascii=False)},
        ],
        "options": {"temperature": 0.25, "num_predict": 500},
    }

    try:
        with httpx.Client(timeout=AGENT_OPS_TIMEOUT_SEC) as client:
            resp = client.post(f"{OLLAMA_BASE_URL}/api/chat", json=payload)
            if resp.status_code >= 400:
                return None, f"ollama HTTP {resp.status_code}"
            content = resp.json().get("message", {}).get("content") or ""
            raw = _extract_json_object(content)
            briefing = str(raw.get("briefing") or "").strip()
            if len(briefing) < 20:
                return None, "briefing too short"
            recs_in = raw.get("recommendations") or []
            recs: List[Dict[str, str]] = []
            if isinstance(recs_in, list):
                for item in recs_in:
                    if not isinstance(item, dict):
                        continue
                    pid = str(item.get("property_id") or "").strip()
                    rec = str(item.get("recommendation") or "").strip()
                    if pid and rec:
                        recs.append({"property_id": pid, "recommendation": rec[:400]})
            return {"briefing": briefing[:1200], "recommendations": recs}, None
    except Exception as ex:  # noqa: BLE001
        logger.warning("agent ops polish failed: %s", ex)
        return None, str(ex)


def run_agent_ops(
    *,
    stats: Dict[str, Any],
    fallback_brief: Optional[str] = None,
    alerts: Optional[List[Dict[str, Any]]] = None,
    audience: str = "agent",
) -> Dict[str, Any]:
    alerts = alerts or []
    brief = (fallback_brief or "").strip() or build_rules_brief(stats, audience=audience)

    polished, err = polish_agent_ops_with_ollama(
        stats=stats,
        fallback_brief=brief,
        alerts=alerts,
        audience=audience,
    )

    if polished is None:
        return {
            "briefing": brief,
            "briefing_source": "rules",
            "recommendations": [
                {
                    "property_id": str(a.get("property_id") or ""),
                    "recommendation": str(a.get("recommendation") or ""),
                    "source": "rules",
                }
                for a in alerts
                if a.get("property_id")
            ],
            "fallback_reason": err or "rules",
        }

    # Merge polished recs onto alerts; keep rules text if model skipped an id
    by_id = {r["property_id"]: r["recommendation"] for r in polished.get("recommendations") or []}
    merged = []
    for a in alerts:
        pid = str(a.get("property_id") or "")
        if not pid:
            continue
        if pid in by_id:
            merged.append(
                {"property_id": pid, "recommendation": by_id[pid], "source": "ollama"}
            )
        else:
            merged.append(
                {
                    "property_id": pid,
                    "recommendation": str(a.get("recommendation") or ""),
                    "source": "rules",
                }
            )

    return {
        "briefing": polished["briefing"],
        "briefing_source": "ollama",
        "recommendations": merged,
        "fallback_reason": None,
    }
