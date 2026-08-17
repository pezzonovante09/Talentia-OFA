import { describe, expect, it } from "vitest";

import { TaliRequestSchema, TaskContextSchema } from "./route";

describe("TaskContextSchema", () => {
  it("accepts a well-formed task context", () => {
    const result = TaskContextSchema.safeParse({
      questionPrompt: "2 + 2 = ?",
      answerOptions: ["3", "4", "5"],
      subjectId: "math",
      topicId: "addition",
      lessonId: "lesson-1",
      correctAnswer: "4",
    });
    expect(result.success).toBe(true);
  });

  it("caps questionPrompt length to guard against oversized prompt-injection payloads", () => {
    const result = TaskContextSchema.safeParse({ questionPrompt: "a".repeat(1001) });
    expect(result.success).toBe(false);
  });

  it("caps the number of answer options", () => {
    const result = TaskContextSchema.safeParse({ answerOptions: Array.from({ length: 13 }, (_, i) => `opt${i}`) });
    expect(result.success).toBe(false);
  });

  it("caps each answer option's length", () => {
    const result = TaskContextSchema.safeParse({ answerOptions: ["a".repeat(301)] });
    expect(result.success).toBe(false);
  });

  it("caps correctAnswer and childAnswer length", () => {
    expect(TaskContextSchema.safeParse({ correctAnswer: "a".repeat(501) }).success).toBe(false);
    expect(TaskContextSchema.safeParse({ childAnswer: "a".repeat(501) }).success).toBe(false);
  });
});

describe("TaliRequestSchema", () => {
  it("defaults message/language/mode when omitted", () => {
    const result = TaliRequestSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.message).toBe("");
      expect(result.data.language).toBe("ru");
      expect(result.data.mode).toBe("chat");
    }
  });

  it("rejects an unsupported language", () => {
    expect(TaliRequestSchema.safeParse({ language: "fr" }).success).toBe(false);
  });

  it("rejects an unsupported mode", () => {
    expect(TaliRequestSchema.safeParse({ mode: "not_a_mode" }).success).toBe(false);
  });

  it("caps message length", () => {
    expect(TaliRequestSchema.safeParse({ message: "a".repeat(2001) }).success).toBe(false);
  });

  it("caps parentContext length", () => {
    expect(TaliRequestSchema.safeParse({ parentContext: "a".repeat(4001) }).success).toBe(false);
  });

  it("rejects an oversized nested taskContext (caught by TaskContextSchema)", () => {
    const result = TaliRequestSchema.safeParse({
      taskContext: { questionPrompt: "a".repeat(1001) },
    });
    expect(result.success).toBe(false);
  });

  it("accepts recentMessages up to 2 entries", () => {
    const result = TaliRequestSchema.safeParse({ recentMessages: ["hi", "how are you"] });
    expect(result.success).toBe(true);
  });

  it("allows recentMessages to be omitted", () => {
    const result = TaliRequestSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.recentMessages).toBeUndefined();
  });

  it("rejects more than 2 recentMessages entries", () => {
    const result = TaliRequestSchema.safeParse({ recentMessages: ["a", "b", "c"] });
    expect(result.success).toBe(false);
  });

  it("caps each recentMessages entry's length", () => {
    const result = TaliRequestSchema.safeParse({ recentMessages: ["a".repeat(501)] });
    expect(result.success).toBe(false);
  });
});
