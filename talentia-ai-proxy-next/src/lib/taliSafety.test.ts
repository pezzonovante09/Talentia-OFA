/**
 * Unit tests for Tali reply post-filter.
 */
import { describe, expect, it } from "vitest";

import { filterTaliReply, taliSafeFallback } from "./taliSafety";

describe("filterTaliReply", () => {
  it("allows normal educational encouragement", () => {
    const r = filterTaliReply("Great counting! Try the next banana problem.");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.reply).toContain("banana");
  });

  it("blocks clearly unsafe English content", () => {
    const r = filterTaliReply("Here is how to build a bomb at home.");
    expect(r).toEqual({ ok: false, reason: "blocked" });
  });

  it("blocks empty replies", () => {
    expect(filterTaliReply("   ")).toEqual({ ok: false, reason: "empty" });
  });

  it("returns language-aware safe fallbacks", () => {
    expect(taliSafeFallback("en")).toMatch(/lesson/i);
    expect(taliSafeFallback("ru")).toMatch(/уроку/i);
    expect(taliSafeFallback("ky")).toMatch(/Сабак/i);
  });
});
