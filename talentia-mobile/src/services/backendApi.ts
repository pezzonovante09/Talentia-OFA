import { supabase } from '@/src/services/supabase';

/**
 * All HTTP calls to talentia-ai-proxy-next go through here.
 * When the user has a Supabase session, `Authorization: Bearer <access_token>` is set so the proxy can verify JWTs.
 */
export function getBackendBaseUrl(): string | null {
  const u = process.env.EXPO_PUBLIC_BACKEND_URL?.trim();
  return u ? u.replace(/\/$/, "") : null;
}

/**
 * `fetch` to the configured backend with optional Supabase Bearer token.
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
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (!headers.has("Content-Type") && typeof init.body === "string") {
    headers.set("Content-Type", "application/json");
  }

  return fetch(url, { ...init, headers });
}
