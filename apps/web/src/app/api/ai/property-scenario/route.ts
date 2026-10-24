import { NextRequest, NextResponse } from "next/server";

/**
 * Longer proxy for property scenarios (comps + optional Ollama explain ~25s).
 */
export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

const API_ORIGIN = process.env.PROPERTYIQ_API_ORIGIN || "http://localhost:5000";

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const auth = req.headers.get("authorization");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120_000);

    let upstream: Response;
    try {
      upstream = await fetch(`${API_ORIGIN}/api/ai/property-scenario`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(auth ? { Authorization: auth } : {}),
        },
        body,
        signal: controller.signal,
        cache: "no-store",
      });
    } finally {
      clearTimeout(timer);
    }

    const text = await upstream.text();
    const headers = new Headers({ "Content-Type": "application/json" });
    const valuation = upstream.headers.get("X-PropertyIQ-Valuation");
    const explain = upstream.headers.get("X-PropertyIQ-Scenario-Explain");
    if (valuation) headers.set("X-PropertyIQ-Valuation", valuation);
    if (explain) headers.set("X-PropertyIQ-Scenario-Explain", explain);

    return new NextResponse(text, { status: upstream.status, headers });
  } catch (e: unknown) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return NextResponse.json(
      {
        message: aborted
          ? "Property scenario timed out. Check API / Ollama and retry."
          : e instanceof Error
            ? e.message
            : "Scenario proxy failed.",
      },
      { status: aborted ? 504 : 502 }
    );
  }
}
