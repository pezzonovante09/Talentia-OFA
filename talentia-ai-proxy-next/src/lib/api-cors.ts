import { buildCorsHeaders } from "@/lib/cors-strict";

/** CORS + JSON response. Pass `req` so strict CORS and preflight headers apply. */
export function corsJson(data: unknown, status = 200, req: Request | null = null) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...buildCorsHeaders(req),
    },
  });
}

/** Binary audio response with the same CORS policy as JSON routes. */
export function corsAudioMpegResponse(
  body: ArrayBuffer,
  status = 200,
  req: Request | null = null,
) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "audio/mpeg",
      ...buildCorsHeaders(req),
    },
  });
}

/** OPTIONS preflight — no body; does not require X-Talentia-Secret. */
export function corsPreflight(req: Request): Response {
  return new Response(null, { status: 204, headers: buildCorsHeaders(req) });
}
