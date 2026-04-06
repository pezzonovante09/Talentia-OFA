/** Shared CORS headers for API routes (JSON and binary). */
export const API_CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function corsJson(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...API_CORS_HEADERS,
    },
  });
}

/** Binary audio response with the same CORS policy as JSON routes. */
export function corsAudioMpegResponse(body: ArrayBuffer, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "audio/mpeg",
      ...API_CORS_HEADERS,
    },
  });
}
