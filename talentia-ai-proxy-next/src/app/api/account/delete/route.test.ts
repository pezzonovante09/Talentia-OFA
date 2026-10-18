import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  admin: null as unknown,
  steps: [] as string[],
}));

vi.mock("@/lib/verifyAuth", () => ({
  verifyAuth: vi.fn(async () => ({ ok: true, userId: "parent-1" })),
  authJsonError: vi.fn((_req: unknown, auth: { error: string; status: number }) =>
    NextResponse.json({ error: auth.error }, { status: auth.status }),
  ),
}));
vi.mock("@/lib/supabaseUser", () => ({
  supabaseAsUser: vi.fn(),
  bearerToken: vi.fn(() => "jwt-placeholder"),
}));
vi.mock("@/lib/supabaseAdmin", () => ({
  get supabaseAdmin() {
    return state.admin;
  },
}));
vi.mock("@/lib/reportError", () => ({ reportError: vi.fn() }));
vi.mock("@/lib/ratelimit", () => ({
  enforceRateLimit: vi.fn(async () => null),
  ratelimitAccount: "ip",
  ratelimitAccountUser: "user",
}));

import { reportError } from "@/lib/reportError";
import { enforceRateLimit } from "@/lib/ratelimit";
import { bearerToken, supabaseAsUser } from "@/lib/supabaseUser";
import { verifyAuth } from "@/lib/verifyAuth";
import { POST } from "./route";

const CHILD = "00000000-0000-4000-8000-0000000000c1";
const OWNER2 = "00000000-0000-4000-8000-0000000000a2";
const NOW = 1_800_000_000;

function jwtWithOtp(timestamp: number | null): string {
  const payload = timestamp === null ? { amr: [{ method: "password", timestamp }] } : { amr: [{ method: "otp", timestamp }] };
  return `h.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.sig`;
}

function req(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/account/delete", {
    method: "POST",
    headers: { authorization: "Bearer x", "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const OK_BODY = { confirm: "DELETE_MY_ACCOUNT", children: [] };

let deleteUser: ReturnType<typeof vi.fn>;
let transferRpc: ReturnType<typeof vi.fn>;
let owned: string[];

function setup() {
  deleteUser = vi.fn(async () => {
    state.steps.push("deleteUser");
    return { error: null };
  });
  transferRpc = vi.fn(async () => {
    state.steps.push("transfer");
    return { error: null };
  });
  state.admin = { auth: { admin: { deleteUser } } };
  const query = {
    select: () => query,
    eq: () => query,
    then: (resolve: (v: unknown) => void) => {
      state.steps.push("ownedChildren");
      resolve({ data: owned.map((child_id) => ({ child_id })), error: null });
    },
  };
  vi.mocked(supabaseAsUser).mockReturnValue({ from: () => query, rpc: transferRpc } as never);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW * 1000);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  state.steps = [];
  owned = [];
  vi.mocked(verifyAuth).mockReset().mockImplementation(async () => {
    state.steps.push("auth");
    return { ok: true, userId: "parent-1" };
  });
  vi.mocked(enforceRateLimit).mockReset().mockImplementation(async (_r, limiter) => {
    state.steps.push(`limit:${String(limiter)}`);
    return null;
  });
  vi.mocked(bearerToken).mockReturnValue(jwtWithOtp(NOW - 60));
  vi.mocked(reportError).mockClear();
  setup();
});

describe("/api/account/delete", () => {
  it("лимит по IP исчерпан — 429, до проверки JWT", async () => {
    vi.mocked(enforceRateLimit).mockResolvedValueOnce(NextResponse.json({ error: "limit" }, { status: 429 }));
    const res = await POST(req(OK_BODY));
    expect(res.status).toBe(429);
    expect(verifyAuth).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("нет или невалидный JWT — 401, удаление не вызвано", async () => {
    vi.mocked(verifyAuth).mockResolvedValue({ ok: false, error: "Unauthorized", status: 401 });
    const res = await POST(req(OK_BODY));
    expect(res.status).toBe(401);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("лимит на пользователя исчерпан — 429, раньше проверки OTP", async () => {
    vi.mocked(bearerToken).mockReturnValue(jwtWithOtp(NOW - 9999));
    vi.mocked(enforceRateLimit).mockImplementation(async (_r, limiter) =>
      limiter === ("user" as never) ? NextResponse.json({ error: "limit" }, { status: 429 }) : null,
    );
    const res = await POST(req(OK_BODY));
    expect(res.status).toBe(429);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("JWT без входа по коду из письма — 401", async () => {
    vi.mocked(bearerToken).mockReturnValue(jwtWithOtp(null));
    const res = await POST(req(OK_BODY));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Email code confirmation required" });
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("вход по коду старше 300 секунд — 401", async () => {
    vi.mocked(bearerToken).mockReturnValue(jwtWithOtp(NOW - 301));
    expect((await POST(req(OK_BODY))).status).toBe(401);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("вход по коду ровно 300 секунд назад — ещё принимается", async () => {
    vi.mocked(bearerToken).mockReturnValue(jwtWithOtp(NOW - 300));
    expect((await POST(req(OK_BODY))).status).toBe(200);
  });

  it("нет confirm — 400, удаление не вызвано", async () => {
    const res = await POST(req({ children: [] }));
    expect(res.status).toBe(400);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("лишнее поле (user_id) — 400, удаление не вызвано", async () => {
    const res = await POST(req({ ...OK_BODY, user_id: "someone-else" }));
    expect(res.status).toBe(400);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("невалидный JSON — 400", async () => {
    const res = await POST(req("{not json"));
    expect(res.status).toBe(400);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("успех без детей — 200, deleteUser вызван с userId из JWT (hard delete)", async () => {
    const res = await POST(req(OK_BODY));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, transferred: [], deletedChildren: [] });
    expect(deleteUser).toHaveBeenCalledTimes(1);
    expect(deleteUser).toHaveBeenCalledWith("parent-1", false);
  });

  it("передача и удаление ребёнка: transfer под JWT пользователя, затем deleteUser", async () => {
    owned = [CHILD];
    const res = await POST(req({ confirm: "DELETE_MY_ACCOUNT", children: [{ childId: CHILD, action: "transfer", newOwnerId: OWNER2 }] }));
    expect(res.status).toBe(200);
    expect(transferRpc).toHaveBeenCalledWith("transfer_child_ownership", { target_child: CHILD, new_owner: OWNER2 });
    expect(state.steps.indexOf("transfer")).toBeLessThan(state.steps.indexOf("deleteUser"));
  });

  it("supabaseAdmin не настроен — 500 «Server is not configured», удаления нет", async () => {
    state.admin = null;
    const res = await POST(req(OK_BODY));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Server is not configured" });
  });

  it("клиент от имени пользователя не создан — 500", async () => {
    vi.mocked(supabaseAsUser).mockReturnValue(null);
    expect((await POST(req(OK_BODY))).status).toBe(500);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("нет решения по ребёнку — 409, аккаунт не удалён", async () => {
    owned = [CHILD];
    const res = await POST(req(OK_BODY));
    expect(res.status).toBe(409);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("передача не удалась — 409, deleteUser не вызван, ошибка в Sentry без id", async () => {
    owned = [CHILD];
    transferRpc.mockResolvedValue({ error: new Error(`no access to ${CHILD}`) });
    const res = await POST(req({ confirm: "DELETE_MY_ACCOUNT", children: [{ childId: CHILD, action: "transfer", newOwnerId: OWNER2 }] }));
    expect(res.status).toBe(409);
    expect(deleteUser).not.toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(CHILD);
  });

  it("сбой deleteUser в Supabase — 502, reportError вызван", async () => {
    deleteUser.mockResolvedValue({ error: new Error("auth down") });
    const res = await POST(req(OK_BODY));
    expect(res.status).toBe(502);
    expect(reportError).toHaveBeenCalledWith("account/delete.deleteUser", expect.any(Error));
  });

  it("исключение verifyAuth — 500 «Server error» через общий catch, reportError вызван", async () => {
    const boom = new TypeError("network");
    vi.mocked(verifyAuth).mockRejectedValue(boom);
    const res = await POST(req(OK_BODY));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Server error" });
    expect(reportError).toHaveBeenCalledWith("account/delete", boom);
  });

  it("порядок: IP → auth → лимит пользователя → ownedChildren/удаление (OTP и схема — до базы)", async () => {
    await POST(req(OK_BODY));
    expect(state.steps).toEqual(["limit:ip", "auth", "limit:user", "ownedChildren", "deleteUser"]);
  });

  it("OTP проверяется раньше схемы: старый вход и кривое тело дают 401, а не 400", async () => {
    vi.mocked(bearerToken).mockReturnValue(jwtWithOtp(NOW - 9999));
    expect((await POST(req({ nonsense: true }))).status).toBe(401);
  });

  it("при кривом теле база не читается", async () => {
    await POST(req({ nonsense: true }));
    expect(state.steps).toEqual(["limit:ip", "auth", "limit:user"]);
  });
});
