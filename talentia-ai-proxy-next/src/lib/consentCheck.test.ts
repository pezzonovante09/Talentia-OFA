import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { hasConsent } from "./consentCheck";

const KID = "00000000-0000-4000-8000-0000000000c1";

function clientReturning(result: { data: unknown; error: unknown } | Error) {
  const rpc = vi.fn(async () => {
    if (result instanceof Error) throw result;
    return result;
  });
  return { client: { rpc } as unknown as SupabaseClient, rpc };
}

describe("hasConsent", () => {
  it("спрашивает has_consent от имени пользователя, а не consent_active", async () => {
    const { client, rpc } = clientReturning({ data: true, error: null });
    expect(await hasConsent(client, KID, "companion_ai")).toBe(true);
    expect(rpc).toHaveBeenCalledWith("has_consent", { target_child: KID, consent_scope: "companion_ai" });
  });

  it("нет согласия — нет", async () => {
    const { client } = clientReturning({ data: false, error: null });
    expect(await hasConsent(client, KID, "voice_asr")).toBe(false);
  });

  it("ошибка базы — нет: без подтверждённого согласия наружу ничего не уходит", async () => {
    expect(await hasConsent(clientReturning({ data: null, error: { message: "boom" } }).client, KID, "companion_ai")).toBe(false);
    expect(await hasConsent(clientReturning(new Error("network")).client, KID, "companion_ai")).toBe(false);
  });

  it("не булев ответ — нет", async () => {
    const { client } = clientReturning({ data: "true", error: null });
    expect(await hasConsent(client, KID, "companion_ai")).toBe(false);
  });
});
