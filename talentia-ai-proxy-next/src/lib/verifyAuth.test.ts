import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    auth: {
      getUser: vi.fn(),
    },
  },
}));

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyAuth } from "./verifyAuth";

function makeRequest(auth?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (auth) headers.authorization = auth;
  return new NextRequest("http://localhost/api/test", { headers });
}

describe("verifyAuth", () => {
  const getUser = supabaseAdmin!.auth.getUser as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    getUser.mockReset();
  });

  it("rejects missing Authorization header", async () => {
    const res = await verifyAuth(makeRequest());
    expect(res).toEqual({
      ok: false,
      error: "Missing or invalid Authorization header",
      status: 401,
    });
    expect(getUser).not.toHaveBeenCalled();
  });

  it("rejects empty bearer token", async () => {
    const res = await verifyAuth(makeRequest("Bearer "));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(401);
  });

  it("returns generic Unauthorized when getUser fails (no upstream leak)", async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "JWT expired secret internals" },
    });
    const res = await verifyAuth(makeRequest("Bearer abc.def.ghi"));
    expect(res).toEqual({ ok: false, error: "Unauthorized", status: 401 });
  });

  it("отклоняет анонимную сессию: это не родитель", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "anon-1", is_anonymous: true } }, error: null });
    const res = await verifyAuth(makeRequest("Bearer anon.token"));
    expect(res).toEqual({ ok: false, error: "Anonymous sessions are not allowed", status: 403 });
  });

  it("returns userId on success", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    const res = await verifyAuth(makeRequest("Bearer good.token"));
    expect(res).toEqual({ ok: true, userId: "user-123" });
    expect(getUser).toHaveBeenCalledWith("good.token");
  });
});
