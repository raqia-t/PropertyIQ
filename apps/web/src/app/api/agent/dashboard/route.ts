import { NextRequest, NextResponse } from "next/server";

/**
 * Longer proxy for agent dashboard (optional Ollama brief polish).
 * Generic /api rewrite can fail when the ASP.NET call waits on AI.
 */
export const runtime = "nodejs";
export const maxDuration = 90;
export const dynamic = "force-dynamic";

const API_ORIGIN = process.env.PROPERTYIQ_API_ORIGIN || "http://localhost:5000";

export async function GET(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90_000);

    let upstream: Response;
    try {
      upstream = await fetch(`${API_ORIGIN}/api/agent/dashboard`, {
        method: "GET",
        headers: {
          ...(auth ? { Authorization: auth } : {}),
          Accept: "application/json",
        },
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
          ? "Agent dashboard timed out. Ensure the API is on :5000 and try again."
          : e instanceof Error
            ? e.message
            : "Dashboard proxy failed.",
      },
      { status: aborted ? 504 : 502 }
    );
  }
}
