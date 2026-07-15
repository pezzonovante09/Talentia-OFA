import type { NextRequest } from "next/server";

import { corsJson, corsPreflight } from "@/lib/api-cors";
import { buildCorsHeaders } from "@/lib/cors-strict";
import { enforceRateLimit, ratelimitApi } from "@/lib/ratelimit";
import { authJsonError, verifyAuth } from "@/lib/verifyAuth";
import { buildWorldReport, normalizeLanguage } from "@/lib/report";
import { WorldReportBodySchema } from "@/lib/reportSchemas";

export const runtime = "nodejs";

export async function OPTIONS(req: Request) {
  return corsPreflight(req);
}

export async function GET(req: NextRequest) {
  const limited = await enforceRateLimit(req, ratelimitApi);
  if (limited) return limited;
  const auth = await verifyAuth(req);
  if (!auth.ok) return authJsonError(req, auth);
  return new Response("ok", {
    status: 200,
    headers: { "Content-Type": "text/plain", ...buildCorsHeaders(req) },
  });
}

export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(req, ratelimitApi);
  if (limited) return limited;
  const auth = await verifyAuth(req);
  if (!auth.ok) return authJsonError(req, auth);
  try {
    const rawBody = await req.json().catch(() => ({}));
    const parsed = WorldReportBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return corsJson(
        { error: "Invalid request", details: parsed.error.flatten() },
        400,
        req,
      );
    }
    const body = parsed.data;
    const lang = normalizeLanguage(body.language);

    const payload = buildWorldReport(
      body.worldName.trim(),
      body.stats,
      lang
    );
    return corsJson(payload, 200, req);
  } catch (e: unknown) {
    console.error("[report/world] Server error", e);
    return corsJson({ error: "Server error" }, 500, req);
  }
}
