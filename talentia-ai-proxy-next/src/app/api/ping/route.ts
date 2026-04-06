import { corsJson } from "@/lib/api-cors";

export const runtime = "nodejs";

/** Minimal GET health check — if this 404/405, the latest code is not deployed on Vercel. */
export async function GET() {
  return corsJson({ ping: true, at: new Date().toISOString() }, 200);
}
