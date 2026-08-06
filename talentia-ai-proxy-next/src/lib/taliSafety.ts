/**
 * Child-safety filters for Tali (input + output).
 * Prompt guardrails are necessary but not sufficient — block unsafe model output
 * and refuse unsafe child/parent text before calling the upstream LLM.
 *
 * Strict for ages ~4–10: prefer false positives (safe fallback) over leaks.
 */

export type TaliSafetyCategory =
  | "violence"
  | "self_harm"
  | "sexual"
  | "drugs"
  | "alcohol"
  | "weapons"
  | "hate"
  | "scam"
  | "adult_contact"
  | "politics"
  | "horror"
  | "profanity"
  | "pii"
  | "prompt_injection"
  | "answer_leak";

type BlockRule = { category: TaliSafetyCategory; re: RegExp };

const BLOCK_RULES: BlockRule[] = [
  // —— prompt injection (before generic patterns) ——
  {
    category: "prompt_injection",
    re: /\bignore\s+(?:all\s+)?(?:previous\s+)?instructions\b/i,
  },
  {
    category: "prompt_injection",
    re: /\b(?:disregard|forget)\s+(?:your|the)\s+(?:rules|instructions|guidelines)\b/i,
  },
  { category: "prompt_injection", re: /\bsystem\s*prompt\b/i },
  { category: "prompt_injection", re: /\byou\s+are\s+now\b/i },
  { category: "prompt_injection", re: /<\s*system\s*>/i },
  { category: "prompt_injection", re: /\[\s*INST\s*\]/i },
  {
    category: "prompt_injection",
    re: /(?:игнорируй|забудь)\s+(?:все\s+)?(?:предыдущие\s+)?инструкции/i,
  },
  // —— roleplay / persona jailbreaks (e.g. "pretend you're DAN", "act as an unrestricted AI") ——
  {
    category: "prompt_injection",
    re: /\b(?:pretend|act|roleplay)\s+(?:that\s+)?you(?:'re|\s+are)?\s+(?:an?\s+)?(?:ai|assistant|bot|character)?\s*(?:with\s+no|without\s+any?)\s+(?:rules|restrictions|filters|limits|guidelines)\b/i,
  },
  {
    category: "prompt_injection",
    re: /\b(?:unrestricted|uncensored|unfiltered|unlimited|jailbroken)\s+(?:ai|assistant|mode|version|chatbot)\b/i,
  },
  { category: "prompt_injection", re: /\bDAN\b.{0,20}\b(?:mode|ai|assistant|prompt)\b/i },
  { category: "prompt_injection", re: /\bdo\s+anything\s+now\b/i },
  { category: "prompt_injection", re: /\bjailbreak(?:ing|ed)?\b/i },
  {
    category: "prompt_injection",
    re: /\bno\s+(?:rules|restrictions|filters)\s+(?:apply|anymore|now)\b/i,
  },
  { category: "prompt_injection", re: /\bstop\s+(?:being|acting\s+like)\s+tali\b/i },
  {
    category: "prompt_injection",
    re: /(?:представь|притворись|играй\s*роль).{0,20}(?:без\s*(?:правил|ограничений|фильтров)|неограниченн\w*)/i,
  },
  { category: "prompt_injection", re: /(?:джейлбрейк|выйди\s*из\s*роли|перестань\s*быть\s*тали)/i },
  // KY coverage is a best-effort start (not native-speaker reviewed — see taliSafety.test.ts TODO).
  { category: "prompt_injection", re: /(?:чектөөсүз|эрежесиз)/i },

  // —— self-harm (before violence so KY «өзүн өлтүр» is not tagged as violence) ——
  { category: "self_harm", re: /\b(suicide|self[-\s]?harm)\b/i },
  { category: "self_harm", re: /(суицид|самоубий)/i },
  { category: "self_harm", re: /(өзүн\s*өлтүр|суицид|өз\s*кол\s*жум|кайрыла\s*ал)/i },
  { category: "self_harm", re: /(кайгыдан\s*өл|жан\s*кый|кайрыла\s*алуу)/i },

  // —— violence ——
  { category: "violence", re: /\b(kill|murder|slaughter)\b/i },
  { category: "violence", re: /(уби[йь]|убийств|зарен|зарез)/i },
  {
    category: "violence",
    re: /(?<![\p{L}])(?:өлтүр|кыргын|сабоо)(?![\p{L}])|(?<![\p{L}])өлтүр/iu,
  },
  {
    category: "violence",
    re: /(?<![\p{L}])(?:ур|кан)(?![\p{L}])/iu,
  },

  // —— sexual ——
  { category: "sexual", re: /\b(sex|porn|nude|naked|xxx)\b/i },
  { category: "sexual", re: /(секс|порно|голы[йе]|эротик)/i },
  { category: "sexual", re: /(секс|порно|жылаңач|жыныстык)/i },

  // —— drugs ——
  { category: "drugs", re: /\b(drug|cocaine|heroin|meth|marijuana|weed)\b/i },
  { category: "drugs", re: /(наркотик|кокаин|героин|марихуан)/i },
  { category: "drugs", re: /(баңги|баңгизат|кокаин|героин)/i },

  // —— alcohol ——
  { category: "alcohol", re: /\b(vodka|whiskey|whisky|beer|alcohol|drunk)\b/i },
  { category: "alcohol", re: /(водк[ауеи]|пиво|алкогол|пьян)/i },
  { category: "alcohol", re: /(арак|пиво|алкогол)/i },

  // —— weapons / terror ——
  { category: "weapons", re: /\b(weapon|gun|bomb|terror|shoot|rifle|pistol)\b/i },
  { category: "weapons", re: /(оружие|бомб|террор|пистолет|выстрел)/i },
  { category: "weapons", re: /(курал|бомба|террор|пистолет|атуу|аткан|курок|ок\s*ат)/i },

  // —— hate ——
  { category: "hate", re: /\b(hate\s*speech|nazi|racist)\b/i },
  { category: "hate", re: /(?<![\p{L}])наци(?:зм|ст)(?![\p{L}])|расист|ненавист/iu },
  { category: "hate", re: /(?<![\p{L}])наци(?:зм|ст)(?![\p{L}])|расист|жек\s*көр/iu },

  // —— scam / credential fishing ——
  { category: "scam", re: /\b(password|credit\s*card|send\s*money|bank\s*pin|wire\s*transfer)\b/i },
  { category: "scam", re: /(пароль|парол|номер\s*карты|перевод\s*денег|пин[-\s]?код)/i },
  { category: "scam", re: /(сырсөз|картанын\s*номери|акча\s*жөнөт)/i },

  // —— adult contact / grooming-adjacent ——
  {
    category: "adult_contact",
    re: /\b(meet\s*me\s*alone|send\s*(your\s*)?(address|phone|photo)|where\s*do\s*you\s*live)\b/i,
  },
  {
    category: "adult_contact",
    re: /(встретимся\s*наедине|пришли\s*(свой\s*)?(адрес|телефон|фото)|где\s*ты\s*жив|где\s*живёшь)/i,
  },
  {
    category: "adult_contact",
    re: /(жалгыз\s*кел|дарек(иң|иңди)?\s*жибер|телефон(уң|ун)?\s*жибер|кай\s*жашайсың|сүрөт\s*жибер|фото\s*жибер)/i,
  },

  // —— politics ——
  { category: "politics", re: /\b(election|president|politician|propaganda|vote\s+for)\b/i },
  { category: "politics", re: /(выборы|президент|политик|пропаганда|голосуй\s+за)/i },
  { category: "politics", re: /(шайлоо|президент|саясат|пропаганда)/i },

  // —— horror ——
  { category: "horror", re: /\b(zombie|ghost|demon|nightmare|bloodbath|horror)\b/i },
  { category: "horror", re: /(зомби|призрак|кошмар|ужас|кровав)/i },
  { category: "horror", re: /(зомби|кошмур|коркунуч|кан\s*кеч)/i },

  // —— profanity ——
  { category: "profanity", re: /\b(fuck|shit|bitch|asshole|damn\s*you)\b/i },
  { category: "profanity", re: /(хуй|бля|пизд|еб[аоу]|сука\b)/i },
  // KY list is a best-effort start covering common mild-to-strong insults;
  // not yet reviewed by a native speaker — expand/correct before relying on it alone.
  { category: "profanity", re: /(согун|салак|акмак|жинди|эшек|маскара|иттин\s*баласы)/i },

  // —— PII (phone / email / street address) ——
  { category: "pii", re: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/ },
  {
    category: "pii",
    re: /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{2,4}[-.\s]?\d{2,6}\b/,
  },
  {
    category: "pii",
    re: /\b\d{1,5}\s+[\w\u0400-\u04FF]+\s+(?:street|st|avenue|ave|road|rd|ул\.?|улица|көчө)\b/i,
  },
];

/** Minimum correct-answer length for leak detection (avoid blocking "4", "a"). */
const ANSWER_LEAK_MIN_LEN = 3;

export type TaliFilterResult =
  | { ok: true; reply: string }
  | { ok: false; reason: "blocked" | "empty"; category?: TaliSafetyCategory };

export type TaliFilterableRequest = {
  message?: string | null;
  parentContext?: string | null;
  taskContext?: {
    questionPrompt?: string | null;
    answerOptions?: string[] | null;
    subjectId?: string | null;
    topicId?: string | null;
    lessonId?: string | null;
    childMode?: string | null;
    methodology?: string | null;
    correctAnswer?: string | null;
    childAnswer?: string | null;
  } | null;
};

/** First matching rule, or null. */
export function matchBlocklist(
  text: string,
): { category: TaliSafetyCategory } | null {
  for (const rule of BLOCK_RULES) {
    if (rule.re.test(text)) return { category: rule.category };
  }
  return null;
}

/** Collect all free-text request fields that must pass the blocklist before LLM call. */
export function collectTextFieldsForFilter(data: TaliFilterableRequest): string[] {
  const fields: string[] = [];
  const push = (value: string | null | undefined) => {
    const trimmed = (value ?? "").trim();
    if (trimmed) fields.push(trimmed);
  };

  push(data.message);
  push(data.parentContext);

  const tc = data.taskContext;
  if (tc) {
    push(tc.questionPrompt);
    push(tc.correctAnswer);
    push(tc.childAnswer);
    push(tc.subjectId);
    push(tc.topicId);
    push(tc.lessonId);
    if (tc.answerOptions) {
      for (const option of tc.answerOptions) push(option);
    }
  }

  return fields;
}

/** Pre-filter every text field in a Tali request (Phase B). */
export function filterTaliRequestFields(data: TaliFilterableRequest): TaliFilterResult {
  for (const text of collectTextFieldsForFilter(data)) {
    const result = filterTaliInput(text);
    if (!result.ok) return result;
  }
  return { ok: true, reply: "" };
}

/** Post-filter model replies before returning to the client. */
export function filterTaliReply(
  raw: string | null | undefined,
  options?: { correctAnswer?: string | null },
): TaliFilterResult {
  const reply = (raw ?? "").trim();
  if (!reply) return { ok: false, reason: "empty" };

  const hit = matchBlocklist(reply);
  if (hit) return { ok: false, reason: "blocked", category: hit.category };

  const secret = (options?.correctAnswer ?? "").trim();
  if (secret.length >= ANSWER_LEAK_MIN_LEN) {
    if (reply.toLowerCase().includes(secret.toLowerCase())) {
      return { ok: false, reason: "blocked", category: "answer_leak" };
    }
  }

  return { ok: true, reply };
}

/**
 * Pre-filter child/parent free-text before calling the upstream LLM.
 * Empty input is allowed (hint/parent modes may omit message).
 */
export function filterTaliInput(raw: string | null | undefined): TaliFilterResult {
  const text = (raw ?? "").trim();
  if (!text) return { ok: true, reply: "" };
  const hit = matchBlocklist(text);
  if (hit) return { ok: false, reason: "blocked", category: hit.category };
  return { ok: true, reply: text };
}

/** Safe short fallbacks when filtered (language-aware). */
export function taliSafeFallback(language: string): string {
  if (language === "en") {
    return "Let's stay on our lesson — try the next small step together!";
  }
  if (language === "ky") {
    return "Сабакка кайталы — кичине бир кадам менен аракет кылалы!";
  }
  return "Давай вернёмся к уроку — сделаем ещё один маленький шаг вместе!";
}
