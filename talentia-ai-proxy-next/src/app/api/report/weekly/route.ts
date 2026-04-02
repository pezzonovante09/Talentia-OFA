import { corsJson } from "@/lib/api-cors";
import {
  buildWeeklyReport,
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

type WeeklyBody = ReportStatsInput & {
  language?: string;
  lessonsThisWeek?: number;
  correctThisWeek?: number;
  weekStartDate?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as WeeklyBody;
    const lang = normalizeLanguage(body.language);

    if (body.weekStartDate === undefined || body.weekStartDate === null) {
      return corsJson({ error: "weekStartDate is required" }, 400);
    }
    if (body.lessonsThisWeek === undefined || body.lessonsThisWeek === null) {
      return corsJson({ error: "lessonsThisWeek is required" }, 400);
    }
    if (body.correctThisWeek === undefined || body.correctThisWeek === null) {
      return corsJson({ error: "correctThisWeek is required" }, 400);
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
    return corsJson(payload);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return corsJson({ error: "Server error", details: msg }, 500);
  }
}
