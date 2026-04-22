import { corsJson, corsPreflight } from "@/lib/api-cors";
import { verifyTalentiaSecret } from "@/lib/api-secret";
import { buildCorsHeaders } from "@/lib/cors-strict";
import {
  buildWeeklyReport,
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

type WeeklyBody = ReportStatsInput & {
  language?: string;
  lessonsThisWeek?: number;
  correctThisWeek?: number;
  weekStartDate?: string;
};

export async function POST(req: Request) {
  const denied = verifyTalentiaSecret(req);
  if (denied) return denied;
  try {
    const body = (await req.json().catch(() => ({}))) as WeeklyBody;
    const lang = normalizeLanguage(body.language);

    if (body.weekStartDate === undefined || body.weekStartDate === null) {
      return corsJson({ error: "weekStartDate is required" }, 400, req);
    }
    if (body.lessonsThisWeek === undefined || body.lessonsThisWeek === null) {
      return corsJson({ error: "lessonsThisWeek is required" }, 400, req);
    }
    if (body.correctThisWeek === undefined || body.correctThisWeek === null) {
      return corsJson({ error: "correctThisWeek is required" }, 400, req);
    }

    const payload = buildWeeklyReport(
      {
        ...body,
        lessonsThisWeek: Number(body.lessonsThisWeek),
        correctThisWeek: Number(body.correctThisWeek),
        weekStartDate: String(body.weekStartDate),
      },
      lang
    );
    return corsJson(payload, 200, req);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return corsJson({ error: "Server error", details: msg }, 500, req);
  }
}
