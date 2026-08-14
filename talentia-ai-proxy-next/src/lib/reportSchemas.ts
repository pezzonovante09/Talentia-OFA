import { z } from "zod";

/**
 * Shared Zod validation for the /api/report* endpoints. These previously
 * accepted arbitrary JSON bodies validated only by ad-hoc `if` checks (or, for
 * accuracyBySubject, no validation at all), which allowed oversized/garbage
 * payloads to reach the report builder.
 */
export const AccuracyBySubjectSchema = z
  .record(z.string().max(100), z.number().finite())
  .refine((obj) => Object.keys(obj).length <= 50, {
    message: "accuracyBySubject must have at most 50 subjects",
  });

export const ReportStatsInputSchema = z.object({
  totalCorrect: z.number().finite().min(0).optional(),
  totalAttempts: z.number().finite().min(0).optional(),
  streakCount: z.number().finite().min(0).optional(),
  accuracyBySubject: AccuracyBySubjectSchema.optional(),
  childMode: z.string().max(100).optional(),
  methodology: z.string().max(100).optional(),
});

export const ReportLanguageSchema = z.string().max(10).optional();

export const StandardReportBodySchema = ReportStatsInputSchema.extend({
  language: ReportLanguageSchema,
});

export const WeeklyReportBodySchema = ReportStatsInputSchema.extend({
  language: ReportLanguageSchema,
  // z.coerce.number() accepts numbers and numeric strings but rejects anything
  // that doesn't actually parse to a finite number (e.g. "abc" -> NaN fails
  // .finite()) instead of silently flowing through as NaN into the report.
  lessonsThisWeek: z.coerce.number().finite().min(0),
  correctThisWeek: z.coerce.number().finite().min(0),
  weekStartDate: z.union([z.string().max(64), z.number().finite()]),
});

export const WorldReportBodySchema = z.object({
  worldId: z.string().min(1).max(200),
  worldName: z.string().min(1).max(200),
  stats: ReportStatsInputSchema,
  language: ReportLanguageSchema,
});
