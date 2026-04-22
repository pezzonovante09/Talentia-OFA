/**
 * All HTTP calls to talentia-ai-proxy-next go through here so X-Talentia-Secret is applied consistently.
 * Secret: EXPO_PUBLIC_TALENTIA_API_SECRET (must match proxy TALENTIA_API_SECRET when the proxy enforces auth).
 */
export function getBackendBaseUrl(): string | null {
  const u = process.env.EXPO_PUBLIC_BACKEND_URL?.trim();
  return u ? u.replace(/\/$/, "") : null;
}

function talentiaSecret(): string {
  return process.env.EXPO_PUBLIC_TALENTIA_API_SECRET?.trim() ?? "";
}

/**
 * `fetch` to the configured backend with optional Talentia secret header.
 * @param path Absolute path starting with `/`, e.g. `/api/tali`
 */
export async function backendFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const base = getBackendBaseUrl();
  if (!base) {
    throw new Error("EXPO_PUBLIC_BACKEND_URL is not set");
  }

  const p = path.startsWith("/") ? path : `/${path}`;
  const url = `${base}${p}`;

  const headers = new Headers(init.headers);
  const secret = talentiaSecret();
  if (secret) {
    headers.set("X-Talentia-Secret", secret);
  }

  if (!headers.has("Content-Type") && typeof init.body === "string") {
    headers.set("Content-Type", "application/json");
  }

  return fetch(url, { ...init, headers });
}
