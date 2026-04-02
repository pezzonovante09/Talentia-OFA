import { corsJson } from "@/lib/api-cors";
import {
  buildWorldReport,
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

type WorldBody = {
  worldId?: string;
  worldName?: string;
  stats?: ReportStatsInput;
  language?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as WorldBody;
    const lang = normalizeLanguage(body.language);

    if (!body.worldId || String(body.worldId).trim() === "") {
      return corsJson({ error: "worldId is required" }, 400);
    }
    if (!body.worldName || String(body.worldName).trim() === "") {
      return corsJson({ error: "worldName is required" }, 400);
    }
    if (!body.stats || typeof body.stats !== "object") {
      return corsJson({ error: "stats object is required" }, 400);
    }

    const payload = buildWorldReport(
      String(body.worldName).trim(),
      body.stats,
      lang
    );
    return corsJson(payload);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return corsJson({ error: "Server error", details: msg }, 500);
  }
}
