import { describe, expect, it } from "vitest";

import { AI_PROVIDER, aiEnabled, type AiProvider } from "./aiConfig";

/** Провайдер для проверки самого флага: в коде провайдера нет (П3). */
const PROVIDER: AiProvider = { name: "TestAI", endpoint: "https://ai.test/v1/chat", model: "test-model", apiKeyEnv: "TEST_AI_API_KEY" };

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
    expect(aiEnabled(env, PROVIDER)).toBe(false);
  });

  it("только строка «true» включает — и только при провайдере", () => {
    expect(aiEnabled({ TALI_AI_ENABLED: "true" }, PROVIDER)).toBe(true);
  });

  it("без провайдера ложно при любом окружении", () => {
    expect(aiEnabled({ TALI_AI_ENABLED: "true" }, null)).toBe(false);
  });

  it("по умолчанию читает process.env и провайдера из конфига", () => {
    const before = process.env.TALI_AI_ENABLED;
    process.env.TALI_AI_ENABLED = "true";
    expect(aiEnabled()).toBe(AI_PROVIDER !== null);
    delete process.env.TALI_AI_ENABLED;
    expect(aiEnabled()).toBe(false);
    if (before !== undefined) process.env.TALI_AI_ENABLED = before;
  });
});

describe("AI_PROVIDER", () => {
  // Провайдера нет, пока нет договора и текста согласия (№4, П3). Когда появится — этот тест
  // меняется на проверку полей (https-endpoint, модель, `*_API_KEY`) вместе с текстом `companion_ai`.
  it("в коде нет провайдера: TALI_AI_ENABLED один ничего не включает", () => {
    expect(AI_PROVIDER).toBeNull();
    expect(aiEnabled({ TALI_AI_ENABLED: "true" })).toBe(false);
  });
});
