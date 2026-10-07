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

/** Ссылки, почта, ники и телефоны — общие для входа и выхода, чтобы проверки не разошлись. */
function contactProblems(text: string, { phone = true } = {}): string[] {
  const problems: string[] = [];
  if (LINK.test(text)) problems.push("link");
  if (EMAIL.test(text)) problems.push("email");
  if (HANDLE.test(text)) problems.push("handle");
  const digits = text.match(PHONE)?.[0]?.replace(/\D/g, "") ?? "";
  if (phone && digits.length >= 7) problems.push("phone");
  return problems;
}

/** Что в ответе модели делает его непригодным для ребёнка. */
export function replyProblems(reply: string): string[] {
  const problems = contactProblems(reply);
  if (APPS.test(reply)) problems.push("app");
  if (isCrisis(reply)) problems.push("crisis");
  return problems;
}

/**
 * Личные данные во входе ребёнка — до модели (аудит 2026-10-06, А2). При срабатывании модель
 * не вызывается: ребёнок получает `PRIVACY_NUDGE` (решение владельца №73). Вырезать
 * найденное и отправить остаток нельзя — шаблон, поймавший номер дома, не видит улицу.
 *
 * Только по маркерам: имя без «меня зовут» не ловится — это закрывает правило промпта.
 * Названия приложений («играю в тикток») — не личные данные, во входе не ищутся.
 */
const ZERO_WIDTH = new RegExp(`[${String.fromCharCode(0x200b)}-${String.fromCharCode(0x200d, 0x2060, 0xfeff)}]`, "g");
/** «kid собака mail.ru», «kid (at) mail.ru» → «kid@mail.ru». */
const AT_WORD = /\s*(?:\(at\)|\[at\]|(?<=\s)собака(?=\s))\s*(?=[a-z0-9-]+\.[a-z])/gi;

const SELF_INTRO = [
  "меня зовут", "мое имя", "моя фамилия",
  "my name is", "my name's", "i'm called", "i am called", "my surname",
  "менин атым", "менин фамилиям",
];
/**
 * Имя родных: «маму зовут Гуля», «my mom's name is Sara», «апамдын аты Гүля». Маркер и имя с
 * большой буквы — по исходному тексту: «как зовут кошку?» и «как тебя зовут?» не ловятся.
 */
const NAME_AFTER = /(?<![a-zа-яёөүң])(?:зовут|звать|name is|name's|аты|атым)\s+[A-ZА-ЯЁӨҮҢ]/;
/** Где живёт ребёнок — без адреса целиком: город тоже место. «Где живут медведи?» — не о нём. */
const LIVES = /(?<![a-zа-яөүң])(?:живу|живем|i live|we live|жашайм|жашаймын|жашайбыз)(?![a-zа-яөүң])/;
/** Маркер улицы или квартиры рядом с числом. */
const STREET_MARKER =
  "(?:улиц[а-я]*|ул\\.|проспект[а-я]*|пр-т|переул[а-я]*|микрорайон[а-я]*|мкр\\.?|квартир[а-я]*|кв\\.|street|st\\.|avenue|ave\\.?|road|apt\\.?|apartment|көчө[а-яөүң]*|батир[а-яөүң]*)";
const ADDRESS = new RegExp(
  `(?<![a-zа-яөүң])${STREET_MARKER}(?![a-zа-яөүң]).{0,24}\\d|\\d.{0,24}(?<![a-zа-яөүң])${STREET_MARKER}(?![a-zа-яөүң])`,
  "i",
);
/** Школа, гимназия, лицей, сад с номером: «школа № 61», «61-мектеп», «садик № 12», «kindergarten 3». */
const INSTITUTION =
  "(?:школ[а-я]*|гимнази[а-я]*|лице[йяеюм][а-я]*|детск[а-я]* сад[а-я]*|садик[а-я]*|бала бакча[а-яөүң]*|kindergarten|school|мектеп[а-яөүң]*)";
const SCHOOL = new RegExp(`${INSTITUTION}\\s*(?:№|no\\.?|#)?\\s*\\d+|\\d+\\s*-?\\s*${INSTITUTION}`, "i");

function normalizeInput(text: string): string {
  return normalize(text.normalize("NFKC").replace(ZERO_WIDTH, "")).replace(AT_WORD, "@");
}

/**
 * Что во входе ребёнка нельзя отправлять модели. `plainNumberIsAnswer` — для ответа на
 * задание: число без `+`, скобок и дефисов (1000000 на 9–10) — ответ, а не телефон.
 */
export function inputProblems(text: string, { plainNumberIsAnswer = false } = {}): string[] {
  const t = normalizeInput(text);
  const plainNumber = plainNumberIsAnswer && /^\d+$/.test(t.trim());
  const problems = contactProblems(t, { phone: !plainNumber });
  const original = text.normalize("NFKC").replace(ZERO_WIDTH, "");
  if (SELF_INTRO.some((s) => t.includes(s)) || NAME_AFTER.test(original)) problems.push("name");
  if (LIVES.test(t) || ADDRESS.test(t)) problems.push("address");
  if (SCHOOL.test(t)) problems.push("school");
  return problems;
}

/**
 * Реплика, если ребёнок написал личное: без упрёка и без повтора его слов. Кыргызский —
 * черновик, проверяет `localization-qa` с носителем.
 */
export const PRIVACY_NUDGE: Record<TaliLanguage, string> = {
  ru: "Это лучше никому не рассказывать в интернете — даже мне. Давай вернёмся к заданию!",
  en: "That's private — better not to share it online, even with me. Let's get back to our task!",
  ky: "Муну интернетте эч кимге айтпай эле кой — мага да. Тапшырмага кайтабыз!",
};

/** Ответ, который можно показать ребёнку: как есть или реплика из банка. */
export function screenReply(reply: string | undefined, language: TaliLanguage): { reply: string; replaced: boolean } {
  const text = (reply ?? "").trim();
  if (!text || replyProblems(text).length > 0) return { reply: SAFE_FALLBACK[language], replaced: true };
  return { reply: text, replaced: false };
}
