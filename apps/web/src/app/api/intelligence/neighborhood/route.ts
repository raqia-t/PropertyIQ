import { NextRequest, NextResponse } from "next/server";

/**
 * Longer proxy for neighborhood POI enrichment (Nominatim / Places can take 20–45s).
 */
export const runtime = "nodejs";
export const maxDuration = 90;
export const dynamic = "force-dynamic";

const API_ORIGIN = process.env.PROPERTYIQ_API_ORIGIN || "http://localhost:5000";

export async function GET(req: NextRequest) {
  try {
    const qs = req.nextUrl.searchParams.toString();
    if (!qs) {
      return NextResponse.json(
        { message: "city and area query params are required." },
        { status: 400 }
      );
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90_000);

    let upstream: Response;
    try {
      upstream = await fetch(`${API_ORIGIN}/api/intelligence/neighborhood?${qs}`, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
        cache: "no-store",
      });
    } finally {
      clearTimeout(timer);
    }

    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return NextResponse.json(
      {
        message: aborted
          ? "Neighborhood POI lookup timed out. Try again shortly."
          : e instanceof Error
            ? e.message
            : "Neighborhood proxy failed.",
      },
      { status: aborted ? 504 : 502 }
    );
  }
}
