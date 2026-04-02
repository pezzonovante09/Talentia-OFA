import { corsJson } from "@/lib/api-cors";
import {
  buildStandardReport,
  normalizeLanguage,
  type ReportStatsInput,
} from "@/lib/report";

export const runtime = "nodejs";

export async function OPTIONS() {
  return corsJson({}, 200);
}

export async function GET() {
  return new Response("ok", { status: 200 });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as ReportStatsInput & {
      language?: string;
    };
    const lang = normalizeLanguage(body.language);
    const payload = buildStandardReport(body, lang);
    return corsJson(payload);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return corsJson({ error: "Server error", details: msg }, 500);
  }
}
