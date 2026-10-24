import { NextRequest, NextResponse } from "next/server";

/** Long-timeout proxy for vision / filename image classification. */
export const runtime = "nodejs";
export const maxDuration = 180;
export const dynamic = "force-dynamic";

const API_ORIGIN = process.env.PROPERTYIQ_API_ORIGIN || "http://localhost:5000";

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const auth = req.headers.get("authorization");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 180_000);

    let upstream: Response;
    try {
      upstream = await fetch(`${API_ORIGIN}/api/ai/classify-image`, {
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
    const src = upstream.headers.get("X-PropertyIQ-Image-Source");
    if (src) headers.set("X-PropertyIQ-Image-Source", src);
    return new NextResponse(text, { status: upstream.status, headers });
  } catch (e: unknown) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return NextResponse.json(
      {
        message: aborted
          ? "Image classification timed out. Filename fallback may still apply on retry."
          : e instanceof Error
            ? e.message
            : "Classify proxy failed.",
      },
      { status: aborted ? 504 : 502 }
    );
  }
}
