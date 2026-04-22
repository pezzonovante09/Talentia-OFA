import { corsJson, corsPreflight } from "@/lib/api-cors";
import { verifyTalentiaSecret } from "@/lib/api-secret";
import { buildCorsHeaders } from "@/lib/cors-strict";
import {
  buildStandardReport,
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

export async function POST(req: Request) {
  const denied = verifyTalentiaSecret(req);
  if (denied) return denied;
  try {
    const body = (await req.json().catch(() => ({}))) as ReportStatsInput & {
      language?: string;
    };
    const lang = normalizeLanguage(body.language);
    const payload = buildStandardReport(body, lang);
    return corsJson(payload, 200, req);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return corsJson({ error: "Server error", details: msg }, 500, req);
  }
}
