import { describe, expect, it, vi } from "vitest";

import {
  AccountDeletionBodySchema,
  checkDecisions,
  deleteAccount,
  emailOtpVerifiedAt,
  FRESH_OTP_SECONDS,
  isRecentEmailOtp,
  type AccountDeletionPort,
} from "./accountDeletion";

const USER = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const K1 = "00000000-0000-4000-8000-0000000000c1";
const K2 = "00000000-0000-4000-8000-0000000000c2";

function port(owned: string[], opts: { failTransfer?: string; failDelete?: boolean } = {}) {
  const calls: string[] = [];
  const p: AccountDeletionPort = {
    ownedChildren: vi.fn(async () => owned),
    transfer: vi.fn(async (childId: string, newOwner: string) => {
      calls.push(`transfer:${childId}->${newOwner}`);
      if (opts.failTransfer === childId) throw new Error("not a guardian");
    }),
    deleteUser: vi.fn(async (userId: string) => {
      calls.push(`delete:${userId}`);
      if (opts.failDelete) throw new Error("gotrue down");
    }),
  };
  return { p, calls };
}

const body = (children: unknown[]) => AccountDeletionBodySchema.parse({ confirm: "DELETE_MY_ACCOUNT", children });

describe("AccountDeletionBodySchema", () => {
  it("принимает решение по каждому ребёнку", () => {
    const r = AccountDeletionBodySchema.safeParse({
      confirm: "DELETE_MY_ACCOUNT",
      children: [
        { childId: K1, action: "delete" },
        { childId: K2, action: "transfer", newOwnerId: B },
      ],
    });
    expect(r.success).toBe(true);
  });

  it("не принимает user_id в теле — удаляется только владелец JWT", () => {
    const r = AccountDeletionBodySchema.safeParse({ confirm: "DELETE_MY_ACCOUNT", children: [], userId: B });
    expect(r.success).toBe(false);
  });

  it("без подтверждения — отказ", () => {
    expect(AccountDeletionBodySchema.safeParse({ confirm: "yes", children: [] }).success).toBe(false);
  });

  it("передача без нового владельца — отказ", () => {
    const r = AccountDeletionBodySchema.safeParse({
      confirm: "DELETE_MY_ACCOUNT",
      children: [{ childId: K1, action: "transfer" }],
    });
    expect(r.success).toBe(false);
  });

  it("не uuid — отказ", () => {
    const r = AccountDeletionBodySchema.safeParse({
      confirm: "DELETE_MY_ACCOUNT",
      children: [{ childId: "'; drop table children; --", action: "delete" }],
    });
    expect(r.success).toBe(false);
  });
});

describe("checkDecisions", () => {
  it("решение по каждому своему ребёнку обязательно", () => {
    expect(checkDecisions([K1, K2], [{ childId: K1, action: "delete" }])).toBe("every owned child needs a decision");
  });

  it("решение о чужом ребёнке — отказ", () => {
    expect(checkDecisions([K1], [
      { childId: K1, action: "delete" },
      { childId: K2, action: "delete" },
    ])).toBe("decision for a child you do not own");
  });

  it("два решения об одном ребёнке — отказ", () => {
    expect(checkDecisions([K1], [
      { childId: K1, action: "delete" },
      { childId: K1, action: "transfer", newOwnerId: B },
    ])).toBe("duplicate decision");
  });
});

describe("deleteAccount", () => {
  it("сначала передачи, потом удаление аккаунта", async () => {
    const { p, calls } = port([K1, K2]);
    const r = await deleteAccount(USER, body([
      { childId: K1, action: "transfer", newOwnerId: B },
      { childId: K2, action: "delete" },
    ]), p);
    expect(r).toEqual({ ok: true, transferred: [K1], deletedChildren: [K2] });
    expect(calls).toEqual([`transfer:${K1}->${B}`, `delete:${USER}`]);
  });

  it("не удалось передать — аккаунт не удаляется", async () => {
    const { p, calls } = port([K1], { failTransfer: K1 });
    const r = await deleteAccount(USER, body([{ childId: K1, action: "transfer", newOwnerId: B }]), p);
    expect(r).toMatchObject({ ok: false, status: 409 });
    expect(calls).not.toContain(`delete:${USER}`);
  });

  it("не хватает решения — ничего не происходит", async () => {
    const { p, calls } = port([K1, K2]);
    const r = await deleteAccount(USER, body([{ childId: K1, action: "delete" }]), p);
    expect(r).toMatchObject({ ok: false, status: 409 });
    expect(calls).toEqual([]);
  });

  it("аккаунт без детей удаляется", async () => {
    const { p, calls } = port([]);
    expect(await deleteAccount(USER, body([]), p)).toEqual({ ok: true, transferred: [], deletedChildren: [] });
    expect(calls).toEqual([`delete:${USER}`]);
  });

  it("сбой удаления — ошибка, а не молчаливый успех", async () => {
    const { p } = port([], { failDelete: true });
    expect(await deleteAccount(USER, body([]), p)).toMatchObject({ ok: false, status: 502 });
  });
});

describe("подтверждение кодом из письма", () => {
  const jwtWith = (payload: object) =>
    `h.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.s`;
  const now = 1_700_000_000;

  it("берёт время входа по коду из amr, а не время выдачи токена", () => {
    const jwt = jwtWith({ iat: now, amr: [{ method: "otp", timestamp: now - 100 }] });
    expect(emailOtpVerifiedAt(jwt)).toBe(now - 100);
  });

  it("свежий токен после обновления сессии без кода — не подтверждение", () => {
    // iat свежий, вход был паролем неделю назад: обновление сессии кода не заменяет
    const jwt = jwtWith({ iat: now, amr: [{ method: "password", timestamp: now - 7 * 86400 }] });
    expect(isRecentEmailOtp(emailOtpVerifiedAt(jwt), now)).toBe(false);
  });

  it("код пятиминутной давности годится, старше — нет", () => {
    expect(isRecentEmailOtp(now - 60, now)).toBe(true);
    expect(isRecentEmailOtp(now - FRESH_OTP_SECONDS - 1, now)).toBe(false);
  });

  it("из нескольких входов берётся последний вход по коду", () => {
    const jwt = jwtWith({
      amr: [
        { method: "otp", timestamp: now - 9000 },
        { method: "password", timestamp: now - 10 },
        { method: "otp", timestamp: now - 120 },
      ],
    });
    expect(emailOtpVerifiedAt(jwt)).toBe(now - 120);
  });

  it("мусор и отсутствие amr — не подтверждение", () => {
    expect(emailOtpVerifiedAt("garbage")).toBeNull();
    expect(emailOtpVerifiedAt(jwtWith({ sub: "x" }))).toBeNull();
    expect(emailOtpVerifiedAt(jwtWith({ amr: "otp" }))).toBeNull();
    expect(isRecentEmailOtp(null, now)).toBe(false);
  });

  it("время из будущего не принимается", () => {
    expect(isRecentEmailOtp(now + 3600, now)).toBe(false);
  });
});
