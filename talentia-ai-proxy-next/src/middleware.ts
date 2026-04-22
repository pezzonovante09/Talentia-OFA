import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  clientIpFromRequest,
  rateLimitAllow,
  rateLimitedResponse,
} from "@/lib/rate-limit-edge";

/**
 * @todo For production-scale abuse prevention, replace the in-memory limiter in
 * `rate-limit-edge` with @upstash/ratelimit + Vercel KV (Edge-compatible, global).
 */
export function middleware(req: NextRequest) {
  const ip = clientIpFromRequest(req);
  if (!rateLimitAllow(ip)) return rateLimitedResponse();
  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
