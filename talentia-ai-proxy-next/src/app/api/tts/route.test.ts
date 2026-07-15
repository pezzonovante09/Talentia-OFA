import { describe, expect, it } from "vitest";

import { TtsRequestSchema } from "./route";

describe("TtsRequestSchema", () => {
  it("accepts valid text + supported language", () => {
    expect(TtsRequestSchema.safeParse({ text: "Привет!", language: "ru" }).success).toBe(true);
    expect(TtsRequestSchema.safeParse({ text: "Hello!", language: "en" }).success).toBe(true);
    expect(TtsRequestSchema.safeParse({ text: "Салам!", language: "ky" }).success).toBe(true);
  });

  it("rejects an unsupported language", () => {
    expect(TtsRequestSchema.safeParse({ text: "Hola", language: "es" }).success).toBe(false);
  });

  it("requires text and rejects oversized text", () => {
    expect(TtsRequestSchema.safeParse({ language: "en" }).success).toBe(false);
    expect(TtsRequestSchema.safeParse({ text: "a".repeat(2501), language: "en" }).success).toBe(false);
    expect(TtsRequestSchema.safeParse({ text: "a".repeat(2500), language: "en" }).success).toBe(true);
  });
});
