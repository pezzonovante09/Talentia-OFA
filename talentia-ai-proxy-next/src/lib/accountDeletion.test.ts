import { describe, expect, it, vi } from "vitest";

import {
  AccountDeletionBodySchema,
  checkDecisions,
  deleteAccount,
  FRESH_TOKEN_SECONDS,
  isFreshToken,
  tokenIssuedAt,
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

describe("свежесть токена", () => {
  const jwtWith = (payload: object) =>
    `h.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.s`;

  it("читает iat из тела токена", () => {
    expect(tokenIssuedAt(jwtWith({ iat: 1700000000 }))).toBe(1700000000);
    expect(tokenIssuedAt("garbage")).toBeNull();
    expect(tokenIssuedAt(jwtWith({ sub: "x" }))).toBeNull();
  });

  it("годится только токен не старше пяти минут", () => {
    const now = 1_700_000_000;
    expect(isFreshToken(now - 60, now)).toBe(true);
    expect(isFreshToken(now - FRESH_TOKEN_SECONDS - 1, now)).toBe(false);
    expect(isFreshToken(null, now)).toBe(false);
  });

  it("токен из будущего не принимается", () => {
    const now = 1_700_000_000;
    expect(isFreshToken(now + 3600, now)).toBe(false);
  });
});
