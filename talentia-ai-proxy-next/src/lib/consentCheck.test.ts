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
    expect(await hasConsent(client, KID, "companion_ai")).toBe("granted");
    expect(rpc).toHaveBeenCalledWith("has_consent", { target_child: KID, consent_scope: "companion_ai" });
  });

  it("нет согласия — нет", async () => {
    const { client } = clientReturning({ data: false, error: null });
    expect(await hasConsent(client, KID, "voice_asr")).toBe("denied");
  });

  it("ошибка базы — нет: без подтверждённого согласия наружу ничего не уходит", async () => {
    expect(await hasConsent(clientReturning({ data: null, error: { message: "boom" } }).client, KID, "companion_ai")).toBe("unavailable");
    expect(await hasConsent(clientReturning(new Error("network")).client, KID, "companion_ai")).toBe("unavailable");
  });

  it("ошибка RPC и сетевое исключение — unavailable по отдельности, не denied", async () => {
    const rpcError = await hasConsent(clientReturning({ data: null, error: { code: "PGRST301" } }).client, KID, "companion_ai");
    const thrown = await hasConsent(clientReturning(new TypeError("fetch failed")).client, KID, "companion_ai");
    expect([rpcError, thrown]).toEqual(["unavailable", "unavailable"]);
  });

  it("ошибка RPC с data: false — всё равно unavailable (error важнее data)", async () => {
    const { client } = clientReturning({ data: false, error: { code: "57014" } });
    expect(await hasConsent(client, KID, "companion_ai")).toBe("unavailable");
  });

  it("при сбое в лог идёт код/класс, но не childId и не текст ошибки", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await hasConsent(clientReturning({ data: null, error: { code: "PGRST301", message: `bad ${KID}` } }).client, KID, "companion_ai");
    await hasConsent(clientReturning(new TypeError(`fetch ${KID}`)).client, KID, "companion_ai");
    const logged = JSON.stringify(spy.mock.calls);
    expect(logged).toContain("PGRST301");
    expect(logged).toContain("TypeError");
    expect(logged).not.toContain(KID);
    spy.mockRestore();
  });

  it("не булев ответ — нет", async () => {
    const { client } = clientReturning({ data: "true", error: null });
    expect(await hasConsent(client, KID, "companion_ai")).toBe("denied");
  });
});
