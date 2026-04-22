import { corsJson, corsPreflight } from "@/lib/api-cors";
import { verifyTalentiaSecret } from "@/lib/api-secret";
import { buildCorsHeaders } from "@/lib/cors-strict";
import {
  buildWorldReport,
  normalizeLanguage,
  type ReportStatsInput,
} from "@/lib/report";

export const runtime = "nodejs";

export async function OPTIONS(req: Request) {
  return corsPreflight(req);
}

export async function GET(req: Request) {
  const denied = verifyTalentiaSecret(req);
  if (denied) return denied;
  return new Response("ok", {
    status: 200,
    headers: { "Content-Type": "text/plain", ...buildCorsHeaders(req) },
  });
}

type WorldBody = {
  worldId?: string;
  worldName?: string;
  stats?: ReportStatsInput;
  language?: string;
};

export async function POST(req: Request) {
  const denied = verifyTalentiaSecret(req);
  if (denied) return denied;
  try {
    const body = (await req.json().catch(() => ({}))) as WorldBody;
    const lang = normalizeLanguage(body.language);

    if (!body.worldId || String(body.worldId).trim() === "") {
      return corsJson({ error: "worldId is required" }, 400, req);
    }
    if (!body.worldName || String(body.worldName).trim() === "") {
      return corsJson({ error: "worldName is required" }, 400, req);
    }
    if (!body.stats || typeof body.stats !== "object") {
      return corsJson({ error: "stats object is required" }, 400, req);
    }

    const payload = buildWorldReport(
      String(body.worldName).trim(),
      body.stats,
      lang
    );
    return corsJson(payload, 200, req);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return corsJson({ error: "Server error", details: msg }, 500, req);
  }
}
