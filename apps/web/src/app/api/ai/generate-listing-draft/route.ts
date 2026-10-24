import { NextRequest, NextResponse } from "next/server";

/**
 * Long-timeout proxy for Ollama listing drafts.
 * Next.js rewrite to :5000 often dies around 30–60s; drafts need up to ~180s.
 */
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
      upstream = await fetch(`${API_ORIGIN}/api/ai/generate-listing-draft`, {
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
    const draftSource =
      upstream.headers.get("X-PropertyIQ-Listing-Draft") ||
      upstream.headers.get("x-propertyiq-listing-draft");

    const headers = new Headers({ "Content-Type": "application/json" });
    if (draftSource) headers.set("X-PropertyIQ-Listing-Draft", draftSource);

    return new NextResponse(text, { status: upstream.status, headers });
  } catch (e: unknown) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return NextResponse.json(
      {
        message: aborted
          ? "AI draft timed out after 3 minutes. Ensure Ollama is running (qwen2.5:7b), then try again."
          : e instanceof Error
            ? e.message
            : "Draft proxy failed.",
      },
      { status: aborted ? 504 : 502 }
    );
  }
}
