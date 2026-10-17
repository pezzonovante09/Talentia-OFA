import { describe, expect, it } from "vitest";

import { AI_PROVIDER, aiEnabled } from "./aiConfig";

describe("aiEnabled", () => {
  it.each([
    ["не задан", {}],
    ["пустая строка", { TALI_AI_ENABLED: "" }],
    ["false", { TALI_AI_ENABLED: "false" }],
    ["1", { TALI_AI_ENABLED: "1" }],
    ["TRUE", { TALI_AI_ENABLED: "TRUE" }],
    ["yes", { TALI_AI_ENABLED: "yes" }],
    ["true с пробелом", { TALI_AI_ENABLED: " true" }],
  ])("%s — выключен", (_, env) => {
    expect(aiEnabled(env)).toBe(false);
  });

  it("только строка «true» включает", () => {
    expect(aiEnabled({ TALI_AI_ENABLED: "true" })).toBe(true);
  });

  it("по умолчанию читает process.env", () => {
    const before = process.env.TALI_AI_ENABLED;
    process.env.TALI_AI_ENABLED = "true";
    expect(aiEnabled()).toBe(true);
    delete process.env.TALI_AI_ENABLED;
    expect(aiEnabled()).toBe(false);
    if (before !== undefined) process.env.TALI_AI_ENABLED = before;
  });
});

describe("AI_PROVIDER", () => {
  it("называет провайдера, endpoint по https, модель и переменную ключа", () => {
    expect(AI_PROVIDER.name).toBeTruthy();
    expect(AI_PROVIDER.endpoint).toMatch(/^https:\/\//);
    expect(AI_PROVIDER.model).toBeTruthy();
    expect(AI_PROVIDER.apiKeyEnv).toMatch(/_API_KEY$/);
  });
});
