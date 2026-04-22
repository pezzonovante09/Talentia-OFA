import { corsJson, corsPreflight } from "@/lib/api-cors";
import { verifyTalentiaSecret } from "@/lib/api-secret";

export const runtime = "nodejs";

export async function OPTIONS(req: Request) {
  return corsPreflight(req);
}

/** Minimal GET health check — if this 404/405, the latest code is not deployed on Vercel. */
export async function GET(req: Request) {
  const denied = verifyTalentiaSecret(req);
  if (denied) return denied;
  return corsJson({ ping: true, at: new Date().toISOString() }, 200, req);
}
