import { describe, expect, it } from "vitest";

import {
  AccuracyBySubjectSchema,
  ReportStatsInputSchema,
  StandardReportBodySchema,
  WeeklyReportBodySchema,
  WorldReportBodySchema,
} from "./reportSchemas";

describe("AccuracyBySubjectSchema", () => {
  it("accepts a small record of subject -> accuracy", () => {
    const result = AccuracyBySubjectSchema.safeParse({ math: 0.8, reading: 1 });
    expect(result.success).toBe(true);
  });

  it("rejects more than 50 subjects", () => {
    const big: Record<string, number> = {};
    for (let i = 0; i < 51; i++) big[`subject_${i}`] = 0.5;
    const result = AccuracyBySubjectSchema.safeParse(big);
    expect(result.success).toBe(false);
  });

  it("rejects non-finite values", () => {
    const result = AccuracyBySubjectSchema.safeParse({ math: Number.POSITIVE_INFINITY });
    expect(result.success).toBe(false);
  });
});

describe("ReportStatsInputSchema", () => {
  it("accepts an empty object (all fields optional)", () => {
    expect(ReportStatsInputSchema.safeParse({}).success).toBe(true);
  });

  it("rejects negative counters", () => {
    expect(ReportStatsInputSchema.safeParse({ totalCorrect: -1 }).success).toBe(false);
  });

  it("caps childMode/methodology string length", () => {
    const tooLong = "a".repeat(101);
    expect(ReportStatsInputSchema.safeParse({ childMode: tooLong }).success).toBe(false);
    expect(ReportStatsInputSchema.safeParse({ methodology: "aba" }).success).toBe(true);
  });
});

describe("StandardReportBodySchema", () => {
  it("accepts valid stats + language", () => {
    const result = StandardReportBodySchema.safeParse({
      totalCorrect: 10,
      totalAttempts: 12,
      language: "ru",
    });
    expect(result.success).toBe(true);
  });
});

describe("WeeklyReportBodySchema", () => {
  it("requires lessonsThisWeek/correctThisWeek/weekStartDate", () => {
    const missing = WeeklyReportBodySchema.safeParse({});
    expect(missing.success).toBe(false);

    const ok = WeeklyReportBodySchema.safeParse({
      lessonsThisWeek: 3,
      correctThisWeek: "5",
      weekStartDate: "2026-07-13",
    });
    expect(ok.success).toBe(true);
  });

  it("rejects oversized string counters / weekStartDate", () => {
    expect(
      WeeklyReportBodySchema.safeParse({
        lessonsThisWeek: "a".repeat(33),
        correctThisWeek: 1,
        weekStartDate: "2026-07-13",
      }).success,
    ).toBe(false);
    expect(
      WeeklyReportBodySchema.safeParse({
        lessonsThisWeek: 1,
        correctThisWeek: 1,
        weekStartDate: "x".repeat(65),
      }).success,
    ).toBe(false);
  });
});

describe("WorldReportBodySchema", () => {
  it("requires worldId, worldName and stats", () => {
    expect(WorldReportBodySchema.safeParse({}).success).toBe(false);
    expect(
      WorldReportBodySchema.safeParse({ worldId: "w1", worldName: "World 1", stats: {} }).success,
    ).toBe(true);
  });

  it("rejects an empty worldId", () => {
    expect(
      WorldReportBodySchema.safeParse({ worldId: "", worldName: "World 1", stats: {} }).success,
    ).toBe(false);
  });
});
