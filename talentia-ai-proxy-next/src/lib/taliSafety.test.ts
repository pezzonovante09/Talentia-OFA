import { describe, expect, it } from "vitest";

import {
  CRISIS_REPLY,
  inputProblems,
  isCrisis,
  PRIVACY_NUDGE,
  replyProblems,
  SAFE_FALLBACK,
  screenReply,
} from "./taliSafety";

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

describe("личные данные во входе ребёнка (А2)", () => {
  it.each([
    ["телефон КР", "мой номер +996 555 123 456"],
    ["телефон КР без кода", "звони 0555 123 456"],
    ["телефон РФ", "8 (912) 345-67-89"],
    ["почта", "пиши kid@mail.ru"],
    ["почта словом «собака»", "kid собака mail.ru"],
    ["почта с (at)", "kid (at) gmail.com"],
    ["ник", "мой ник @kid_123"],
    ["ссылка", "заходи на roblox.com"],
    ["улица", "я на улице Ленина 5"],
    ["живу", "живу на Советской"],
    ["квартира", "дом 3, кв. 12"],
    ["көчө", "Чүй көчөсү 100"],
    ["street", "12 Baker Street"],
    ["меня зовут", "Меня зовут Айпери"],
    ["менин атым", "менин атым Нурлан"],
    ["my name is", "My name is Tom"],
    ["школа", "я учусь в школе № 61"],
    ["мектеп", "61-мектепте окуйм"],
    ["невидимые символы", "kid​@mail.ru"],
    ["я живу", "я живу в Бишкеке"],
    ["имя мамы", "маму зовут Гуля"],
    ["имя мамы en", "my mom's name is Sara"],
    ["имя мамы ky", "апамдын аты Гүля"],
    ["садик", "хожу в садик № 12"],
    ["гимназия", "учусь в гимназии 5"],
  ])("%s — ловится", (_, text) => {
    expect(inputProblems(text)).not.toEqual([]);
  });

  it.each([
    "2+2=4",
    "125 + 340",
    "у меня 3 кошки",
    "это дом",
    "у меня собака и кошка",
    "я играю в тикток",
    "где живут динозавры?",
    "Where do bears live?",
    "аюулар кайда жашайт?",
    "как зовут кошку?",
    "Tali, как тебя зовут?",
    "на лице 2 глаза",
    "сколько будет 7 плюс 5?",
    "I like dinosaurs",
    "Мен сүрөт тартканды жакшы көрөм",
  ])("«%s» — не ловится", (text) => {
    expect(inputProblems(text)).toEqual([]);
  });

  it("число-ответ на задание — не телефон, а «+996…» в ответе — телефон", () => {
    expect(inputProblems("1000000", { plainNumberIsAnswer: true })).toEqual([]);
    expect(inputProblems("1000000")).toEqual(["phone"]);
    expect(inputProblems("+996555123456", { plainNumberIsAnswer: true })).toEqual(["phone"]);
    // договор с клиентом: число без разделителей; «1 000 000» неотличим от телефона
    expect(inputProblems("1 000 000", { plainNumberIsAnswer: true })).toEqual(["phone"]);
  });

  it("реплика есть на всех трёх языках", () => {
    expect(Object.keys(PRIVACY_NUDGE).sort()).toEqual(["en", "ky", "ru"]);
  });
});
