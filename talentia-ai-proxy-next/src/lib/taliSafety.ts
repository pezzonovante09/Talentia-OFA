/**
 * Безопасность живого разговора с Tali. Аудит 2026-09-30 (AUDIT.md, блокер 1):
 * ответ модели показывался ребёнку как есть — без фильтра ссылок и контактов и без
 * сценария на тревожные темы.
 *
 * - **Тревожное сообщение** ребёнка (вред себе, насилие над ним) в модель не уходит:
 *   ребёнок сразу получает спокойную реплику «расскажи взрослому, которому доверяешь».
 *   Дальше сообщение не передаётся никуда — ни родителю, ни в логи.
 * - **Ответ модели** со ссылкой, почтой, телефоном, ником или тревожной темой ребёнку не
 *   показывается — вместо него реплика из банка.
 * - **Правила промпта**: не спрашивать и не повторять личные данные, не давать ссылок.
 *
 * Список тревожных слов — первая версия; его проверяют `child-privacy-compliance` и
 * `localization-qa` на всех трёх языках.
 */

export type TaliLanguage = "ru" | "en" | "ky";

/** Реплика, если ответ модели показать нельзя. */
export const SAFE_FALLBACK: Record<TaliLanguage, string> = {
  ru: "Давай попробуем ещё один маленький шаг вместе!",
  en: "Let's try one small step together — you've got this!",
  ky: "Кичине бир кадам менен аракет кылалы!",
};

/** Реплика на тревожное сообщение: без расспросов, без оценки, к взрослому. */
export const CRISIS_REPLY: Record<TaliLanguage, string> = {
  ru: "Это очень важно. Расскажи об этом взрослому, которому доверяешь: маме, папе или учителю. Я рядом.",
  en: "This is really important. Please tell a grown-up you trust — a parent or a teacher. I'm here with you.",
  ky: "Бул абдан маанилүү. Ишенген чоң кишиге айтып бер: апаңа, атаңа же мугалимиңе. Мен жаныңдамын.",
};

/** Правила для системного промпта — на каждый запрос. */
export const PRIVACY_RULES: readonly string[] = [
  "PRIVACY (strict): Never ask for or repeat personal information — name, surname, age, address, school, phone, e-mail, photos, where the child is. If the child shares any, do not repeat it; gently go back to learning.",
  "Never give links, websites, apps, usernames, phone numbers or any way to contact anyone.",
  "Never say you are a real person or a friend who can meet; you are Tali, a learning companion in the app.",
];

/** Основы тревожных слов по языкам. Сравнение — по нижнему регистру, ё → е. */
const CRISIS_STEMS: readonly string[] = [
  // ru
  "убить себя", "убью себя", "покончить с собой", "самоубий", "суицид", "не хочу жить", "хочу умереть",
  "порежу себя", "режу себя", "сделать себе больно", "меня бьют", "меня бьет", "бьет меня", "трогает меня",
  "меня трогают", "меня обижают взрослые",
  // en
  "kill myself", "suicide", "want to die", "don't want to live", "hurt myself", "cut myself", "hits me",
  "touches me", "someone hurts me",
  // ky
  "өзүмдү өлтүр", "өлгүм келет", "жашагым келбейт", "мени урат", "мени ура", "өзүмө зыян",
];

function normalize(text: string): string {
  return text.toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ");
}

/** Есть ли в тексте тревожная тема. */
export function isCrisis(text: string): boolean {
  const t = normalize(text);
  return CRISIS_STEMS.some((stem) => t.includes(stem));
}

const LINK = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|ru|kg|org|net|io|me|app|link|ly)\b)/i;
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const HANDLE = /(^|\s)@[a-z0-9_]{3,}/i;
/** Семь и больше цифр подряд, с пробелами, дефисами, скобками и плюсом между ними. */
const PHONE = /(\+?\d[\d\s().-]{5,}\d)/;
const APPS = /\b(telegram|whatsapp|instagram|tiktok|discord|snapchat|vk\.com|вконтакте|телеграм|ватсап)\b/i;

/** Что в ответе модели делает его непригодным для ребёнка. */
export function replyProblems(reply: string): string[] {
  const problems: string[] = [];
  if (LINK.test(reply)) problems.push("link");
  if (EMAIL.test(reply)) problems.push("email");
  if (HANDLE.test(reply)) problems.push("handle");
  const digits = reply.match(PHONE)?.[0]?.replace(/\D/g, "") ?? "";
  if (digits.length >= 7) problems.push("phone");
  if (APPS.test(reply)) problems.push("app");
  if (isCrisis(reply)) problems.push("crisis");
  return problems;
}

/** Ответ, который можно показать ребёнку: как есть или реплика из банка. */
export function screenReply(reply: string | undefined, language: TaliLanguage): { reply: string; replaced: boolean } {
  const text = (reply ?? "").trim();
  if (!text || replyProblems(text).length > 0) return { reply: SAFE_FALLBACK[language], replaced: true };
  return { reply: text, replaced: false };
}
