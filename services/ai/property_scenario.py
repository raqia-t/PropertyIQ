"""Phase B — comps-aware property valuation / rent scenario (deterministic)."""

from __future__ import annotations

import statistics
from typing import Any, Dict, List, Optional, Tuple

DISCLAIMER = (
    "Estimates and scenario models are generated for informational decision support "
    "and do not guarantee future rental income or market liquidation value."
)

ANNUAL_APPRECIATION = 0.11
DEFAULT_GROSS_YIELD = 0.05  # ~5% when no rent comps


def to_marla(size: float, size_unit: str) -> float:
    unit = (size_unit or "Marla").strip().lower()
    if unit.startswith("kanal"):
        return float(size) * 20.0
    return float(size) if size else 1.0


def _median(values: List[float]) -> Optional[float]:
    if not values:
        return None
    return float(statistics.median(values))


def _price_per_marla(price: float, size: float, size_unit: str) -> Optional[float]:
    m = to_marla(size, size_unit)
    if m <= 0 or price <= 0:
        return None
    return price / m


def compute_scenario(
    *,
    city: str,
    area: str,
    property_type: str,
    size: float,
    size_unit: str,
    asking_price: float,
    bedrooms: Optional[int],
    sale_comps: List[Dict[str, Any]],
    rent_comps: List[Dict[str, Any]],
    purpose: Optional[str] = None,
) -> Tuple[Dict[str, Any], str]:
    """
    Returns (result_dict, valuation_source).
    valuation_source: comps | hybrid_formula | formula
    """
    subject_marla = to_marla(size, size_unit)
    asking = float(asking_price or 0)
    purpose_norm = (purpose or "Sale").strip().lower()
    is_rent_purpose = purpose_norm == "rent"

    sale_ppm: List[float] = []
    for c in sale_comps:
        ppm = _price_per_marla(
            float(c.get("price") or 0),
            float(c.get("size") or 0),
            str(c.get("size_unit") or "Marla"),
        )
        if ppm and ppm > 0:
            sale_ppm.append(ppm)

    # Prefer true Rent-purpose comps; ExpectedRent on Sale listings is secondary
    rent_from_rent_listings: List[float] = []
    rent_from_sale_expected: List[float] = []
    for c in rent_comps:
        c_purpose = str(c.get("purpose") or "").lower()
        rmin = c.get("expected_rent_min")
        rmax = c.get("expected_rent_max")
        p = float(c.get("price") or 0)
        if c_purpose == "rent" and p > 0:
            rent_from_rent_listings.append(p)
        elif rmin is not None and rmax is not None:
            rent_from_sale_expected.append((float(rmin) + float(rmax)) / 2.0)
        elif p > 0 and p < 5_000_000:
            # Heuristic: small "price" on a non-rent row may still be monthly rent
            rent_from_rent_listings.append(p)

    rent_monthly = rent_from_rent_listings if rent_from_rent_listings else rent_from_sale_expected

    med_sale_ppm = _median(sale_ppm)
    med_rent = _median(rent_monthly)

    assumptions: List[str] = []
    source = "formula"
    confidence = 0.72

    # Comp-implied capital value (before blending asking)
    comps_fair_mid: Optional[float] = None
    if med_sale_ppm is not None and subject_marla > 0:
        comps_fair_mid = med_sale_ppm * subject_marla

    # Asking looks like monthly rent (not sale capital) — e.g. 350,000 on a 1 Kanal house
    asking_is_rent_like = is_rent_purpose or (
        comps_fair_mid is not None and asking > 0 and asking < comps_fair_mid * 0.08
    ) or (comps_fair_mid is None and is_rent_purpose)

    if comps_fair_mid is not None:
        if asking_is_rent_like:
            fair_mid = comps_fair_mid
            assumptions.append(
                "Asking treated as rent-scale (not sale capital) — fair band uses sale comps only."
            )
        else:
            # Blend with asking so outlier asks don't ignore market
            fair_mid = 0.65 * comps_fair_mid + 0.35 * asking
        fair_low = round(fair_mid * 0.94, 2)
        fair_high = round(fair_mid * 1.05, 2)
        source = "comps"
        confidence = min(0.92, 0.70 + 0.04 * len(sale_ppm))
        assumptions.append(
            f"Fair band from {len(sale_ppm)} sale comps in/near {area}, {city} "
            f"(median ~PKR {med_sale_ppm:,.0f}/marla)."
        )
    elif not asking_is_rent_like:
        fair_low = round(asking * 0.94, 2)
        fair_high = round(asking * 1.05, 2)
        assumptions.append(
            f"No tight sale comps for {property_type} in {area}, {city} — "
            "fair band is ±6%/±5% of asking price."
        )
    else:
        # Rent-scale asking + no sale comps — fair filled later via reverse yield
        fair_low = 0.0
        fair_high = 0.0

    if med_rent is not None:
        if is_rent_purpose and asking > 0:
            # Blend subject asking rent with market rent comps
            blended = 0.5 * med_rent + 0.5 * asking
            rent_min = round(blended * 0.90, 2)
            rent_max = round(blended * 1.12, 2)
            assumptions.append(
                f"Rent band blends your asking ({asking:,.0f}) with "
                f"{len(rent_monthly)} rent comps (median ~PKR {med_rent:,.0f}/mo)."
            )
        else:
            rent_min = round(med_rent * 0.90, 2)
            rent_max = round(med_rent * 1.12, 2)
            assumptions.append(
                f"Rent band from {len(rent_monthly)} rent comps (median ~PKR {med_rent:,.0f}/mo)."
            )
        if source != "comps":
            source = "hybrid_formula" if source == "formula" else source
        confidence = max(confidence, min(0.90, 0.68 + 0.05 * len(rent_monthly)))
    elif asking_is_rent_like and asking > 0:
        rent_min = round(asking * 0.90, 2)
        rent_max = round(asking * 1.12, 2)
        assumptions.append("No rent comps — rent band centered on your asking monthly rent.")
        if source == "comps":
            source = "hybrid_formula"
    else:
        capital_for_yield = (
            (fair_low + fair_high) / 2.0
            if fair_high > 0
            else asking
        )
        monthly_mid = round(capital_for_yield * (DEFAULT_GROSS_YIELD / 12.0), 2)
        rent_min = round(monthly_mid * 0.90, 2)
        rent_max = round(monthly_mid * 1.12, 2)
        assumptions.append(
            f"No rent comps — estimated from ~{DEFAULT_GROSS_YIELD * 100:.0f}% gross yield on capital value."
        )
        if source == "comps":
            source = "hybrid_formula"

    rent_mid = (rent_min + rent_max) / 2.0

    # If we still lack capital value (Rent listing, no sale comps), imply it from rent / yield
    if fair_high <= 0 and rent_mid > 0:
        implied_capital = rent_mid * 12.0 / DEFAULT_GROSS_YIELD
        fair_low = round(implied_capital * 0.94, 2)
        fair_high = round(implied_capital * 1.05, 2)
        source = "hybrid_formula"
        assumptions.append(
            f"No sale comps — illustrative capital value implied from rent at "
            f"~{DEFAULT_GROSS_YIELD * 100:.0f}% gross yield (not a market sale comp)."
        )

    # Yield must use capital value, never monthly asking rent as denominator
    capital_basis = (fair_low + fair_high) / 2.0 if fair_high > 0 else (
        0.0 if asking_is_rent_like else asking
    )
    if capital_basis > 0:
        gross_yield = round((rent_mid * 12.0 / capital_basis) * 100.0, 2)
    else:
        gross_yield = 0.0
        assumptions.append("Gross yield omitted — no reliable capital value for denominator.")

    # Appreciation on fair mid (or asking if sale-scale)
    base = capital_basis if capital_basis > 0 else asking
    fv_3 = round(base * ((1 + ANNUAL_APPRECIATION) ** 3), 2) if base > 0 else 0.0
    fv_5 = round(base * ((1 + ANNUAL_APPRECIATION) ** 5), 2) if base > 0 else 0.0
    fv_10 = round(base * ((1 + ANNUAL_APPRECIATION) ** 10), 2) if base > 0 else 0.0

    assumptions.append(
        f"Nominal appreciation assumes {ANNUAL_APPRECIATION * 100:.0f}% average annual corridor growth."
    )
    assumptions.append("Estimates exclude society transfer taxes, stamp duty, and agency commission.")
    if bedrooms is not None:
        assumptions.append(f"Subject bedrooms noted as {bedrooms} (not used as hard filter when comps are thin).")

    result = {
        "fair_price_low": fair_low,
        "fair_price_high": fair_high,
        "estimated_rent_monthly_min": rent_min,
        "estimated_rent_monthly_max": rent_max,
        "gross_yield_percentage": gross_yield,
        "future_value_3yr_scenario": fv_3,
        "future_value_5yr_scenario": fv_5,
        "future_value_10yr_scenario": fv_10,
        "assumptions": assumptions,
        "confidence_score": round(confidence, 2),
        "disclaimer": DISCLAIMER,
        "sale_comp_count": len(sale_ppm),
        "rent_comp_count": len(rent_monthly),
        "valuation_source": source,
    }
    return result, source
