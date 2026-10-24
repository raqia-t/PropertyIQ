"""
Phase 4 offline/live eval for prompt quality.
Run (AI service up on 8001 by default):
  .venv\\Scripts\\python.exe eval_phase4.py
  .venv\\Scripts\\python.exe eval_phase4.py --base http://127.0.0.1:8001
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from typing import Any, Dict, List, Tuple

import httpx

from prompt_search import EVAL_CASES, PROMPT_VERSION


def _match_case(data: Dict[str, Any], expect: Dict[str, Any]) -> Tuple[bool, List[str]]:
    errors: List[str] = []
    for key, wanted in expect.items():
        if key == "area_contains":
            area = data.get("area") or ""
            if wanted.lower() not in str(area).lower():
                errors.append(f"area_contains {wanted!r} not in {area!r}")
            continue
        if key == "max_price_max":
            mx = data.get("max_price")
            if mx is None:
                errors.append("max_price missing")
            elif float(mx) > float(wanted):
                errors.append(f"max_price {mx} > {wanted}")
            continue
        got = data.get(key)
        if key in ("max_price", "min_price", "land_area", "bedrooms", "confidence_score"):
            if got is None and wanted is not None:
                errors.append(f"{key}=None want {wanted}")
            elif got is not None and wanted is not None and float(got) != float(wanted):
                # allow land_area 10.0 vs 10
                if abs(float(got) - float(wanted)) > 0.01:
                    errors.append(f"{key}={got} want {wanted}")
        else:
            if got != wanted:
                errors.append(f"{key}={got!r} want {wanted!r}")
    return (len(errors) == 0), errors


def run_eval(base: str, timeout: float) -> int:
    print(f"Phase 4 eval | prompt={PROMPT_VERSION} | base={base}")
    # Sanity: prompt endpoint
    with httpx.Client(timeout=30.0) as client:
        try:
            pr = client.get(f"{base}/ai/search-prompt")
            pr.raise_for_status()
            catalog = pr.json()
            assert catalog.get("version") == PROMPT_VERSION
            print(f"[PASS] GET /ai/search-prompt version={catalog['version']} shots={catalog['few_shot_count']}")
        except Exception as ex:
            print(f"[FAIL] GET /ai/search-prompt: {ex}")
            return 1

        passed = 0
        failed = 0
        warned = 0
        for case in EVAL_CASES:
            cid = case["id"]
            body = {"query": case["query"], "preferred_city": case["preferred_city"]}
            t0 = time.time()
            try:
                r = client.post(f"{base}/ai/search-parser", json=body, timeout=timeout)
                ms = int((time.time() - t0) * 1000)
                r.raise_for_status()
                data = r.json()
                source = r.headers.get("x-propertyiq-parser", "?")
                ok, errs = _match_case(data, case["expect"])
                summary = (
                    f"source={source} city={data.get('city')} type={data.get('property_type')} "
                    f"purpose={data.get('purpose')} max={data.get('max_price')} "
                    f"land={data.get('land_area')}{data.get('land_area_unit')} ms={ms}"
                )
                if ok:
                    if source and "ollama" in source:
                        print(f"[PASS] {cid} - {summary}")
                        passed += 1
                    else:
                        print(f"[WARN] {cid} - rules fallback but fields ok - {summary}")
                        warned += 1
                        passed += 1
                else:
                    print(f"[FAIL] {cid} - {errs} - {summary}")
                    failed += 1
            except Exception as ex:
                print(f"[FAIL] {cid} - {ex}")
                failed += 1

    print(f"Result: {passed} PASS, {warned} WARN, {failed} FAIL")
    return 0 if failed == 0 else 1


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default="http://127.0.0.1:8001")
    parser.add_argument("--timeout", type=float, default=120.0)
    args = parser.parse_args()
    sys.exit(run_eval(args.base, args.timeout))


if __name__ == "__main__":
    main()
