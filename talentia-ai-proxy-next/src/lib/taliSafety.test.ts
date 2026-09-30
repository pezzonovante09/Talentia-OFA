import { describe, expect, it } from "vitest";

import { CRISIS_REPLY, isCrisis, replyProblems, SAFE_FALLBACK, screenReply } from "./taliSafety";

describe("тревожные сообщения", () => {
  it.each([
    "я не хочу жить",
    "Меня бьёт папа",
    "I want to die",
    "someone hurts me at home",
    "өлгүм келет",
  ])("«%s» — тревожное", (text) => {
    expect(isCrisis(text)).toBe(true);
  });

  it.each(["сколько будет два плюс два?", "I like dinosaurs", "Мен сүрөт тартканды жакшы көрөм"])(
    "«%s» — обычное",
    (text) => {
      expect(isCrisis(text)).toBe(false);
    },
  );

  it("реплика на тревожное есть на всех трёх языках", () => {
    expect(Object.keys(CRISIS_REPLY).sort()).toEqual(["en", "ky", "ru"]);
  });
});

describe("фильтр ответа модели", () => {
  it.each([
    ["ссылка", "Посмотри на https://example.com", "link"],
    ["сайт без протокола", "Зайди на dino-games.ru", "link"],
    ["почта", "Напиши мне: tali@mail.ru", "email"],
    ["телефон", "Позвони +996 555 123 456", "phone"],
    ["ник", "Найди меня @tali_friend", "handle"],
    ["мессенджер", "Давай дружить в Telegram", "app"],
  ])("%s — не показывается ребёнку", (_, reply, problem) => {
    expect(replyProblems(reply)).toContain(problem);
    expect(screenReply(reply, "ru")).toEqual({ reply: SAFE_FALLBACK.ru, replaced: true });
  });

  it("обычная подсказка про счёт проходит", () => {
    const reply = "Посчитай камни по одному: раз, два… Сколько вышло?";
    expect(screenReply(reply, "ru")).toEqual({ reply, replaced: false });
    expect(replyProblems("2 + 2 = 4, а 10 − 3 = 7")).toEqual([]);
  });

  it("пустой ответ — реплика из банка на языке ребёнка", () => {
    expect(screenReply("", "ky").reply).toBe(SAFE_FALLBACK.ky);
    expect(screenReply(undefined, "en").reply).toBe(SAFE_FALLBACK.en);
  });
});
