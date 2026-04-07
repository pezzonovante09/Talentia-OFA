const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

// Offline fallback responses shown when backend is unreachable
const OFFLINE_FALLBACKS: Record<string, Record<TaliMode, string>> = {
  ru: {
    chat: 'Я сейчас не могу подключиться к серверу, но я здесь! Продолжай учиться — ты молодец.',
    hint: 'Подсказка сейчас недоступна. Попробуй ещё раз — ты справишься!',
    explain_error: 'Не переживай! Ошибки помогают учиться. Попробуй ещё раз внимательно.',
    science_fact: 'Интересный факт временно недоступен. Зато ты уже знаешь столько всего!',
    motivation: 'Ты отлично справляешься! Каждый урок делает тебя умнее.',
  },
  ky: {
    chat: 'Азыр серверге туташа албай жатам, бирок мен бул жердемин! Окууңду уланта бер — сен эргежеклисиң.',
    hint: 'Сунуш азыр жеткиликсиз. Кайра аракет кыл — сен аткара аласың!',
    explain_error: 'Ойлонбо! Каталар окууга жардам берет. Дагы бир жолу аракет кыл.',
    science_fact: 'Кызыктуу факт убактылуу жеткиликсиз. Бирок сен буга чейин көп нерсе билесиң!',
    motivation: 'Сен абдан жакшы иштедиң! Ар бир сабак сени акылдуу кылат.',
  },
  en: {
    chat: "I can't reach the server right now, but I'm here! Keep learning — you're doing great.",
    hint: "Hint not available right now. Try again — you've got this!",
    explain_error: "Don't worry! Mistakes help us learn. Try again carefully.",
    science_fact: 'Interesting fact is temporarily unavailable. But you already know so much!',
    motivation: "You're doing amazing! Every lesson makes you smarter.",
  },
};

function getOfflineFallback(mode: TaliMode, language: string): string {
  const lang = language in OFFLINE_FALLBACKS ? language : 'ru';
  return OFFLINE_FALLBACKS[lang][mode];
}

export type TaliMode = 'chat' | 'hint' | 'explain_error' | 'science_fact' | 'motivation';

/** Task context for lesson help. Backend may use correctAnswer for hints but must NEVER reveal it. */
export type TaskContext = {
  questionPrompt: string;
  answerOptions?: string[];
  subjectId: string;
  topicId: string;
  lessonId: string;
  childMode: string;
  methodology: string | null;
  /** For backend context only. Tali must NEVER reveal the final answer directly. */
  correctAnswer?: string;
  /** Whether the child answered incorrectly (for explain_error mode) */
  wasIncorrect?: boolean;
  /** The answer the child gave (for explain_error mode) */
  childAnswer?: string;
};

export type CompanionFlags = {
  /** Клиент определил, что ребёнок назвал верный ответ — ИИ должен похвалить. */
  childGaveCorrectAnswer?: boolean;
};

type CompanionRequest = {
  message: string;
  language: string;
  mode?: TaliMode;
  topicId?: string;
  lessonId?: string;
  /** Parent report + child mode context when "Discuss with Tali" from Profile */
  parentContext?: string;
  /** Task context when helping during a lesson */
  taskContext?: TaskContext;
  flags?: CompanionFlags;
};

type CompanionResponse = {
  reply?: string;
};

export async function sendToCompanion(payload: CompanionRequest): Promise<string | null> {
  const mode: TaliMode = payload.mode ?? 'chat';

  if (!BACKEND_URL) {
    return getOfflineFallback(mode, payload.language);
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    const response = await fetch(`${BACKEND_URL}/api/tali`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, mode: payload.mode ?? 'chat' }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return getOfflineFallback(mode, payload.language);
    }

    const data: CompanionResponse = await response.json();
    return data.reply ?? getOfflineFallback(mode, payload.language);
  } catch {
    // Network error or timeout → show offline message
    return getOfflineFallback(mode, payload.language);
  }
}

/** Ask Tali for a hint without revealing the answer. */
export async function getHint(taskContext: TaskContext, language: string): Promise<string | null> {
  return sendToCompanion({
    message: 'Give me a hint for this task',
    language,
    mode: 'hint',
    taskContext,
  });
}

/** Ask Tali to explain why the child's answer was wrong. */
export async function explainError(
  taskContext: TaskContext,
  childAnswer: string,
  language: string,
): Promise<string | null> {
  return sendToCompanion({
    message: 'Explain why my answer was wrong',
    language,
    mode: 'explain_error',
    taskContext: { ...taskContext, wasIncorrect: true, childAnswer },
  });
}

/** Ask Tali to share an interesting science fact about the topic. */
export async function getScienceFact(
  subjectId: string,
  topicId: string,
  language: string,
  childMode = 'standard',
  methodology: string | null = null,
): Promise<string | null> {
  return sendToCompanion({
    message: 'Tell me an interesting fact about this topic',
    language,
    mode: 'science_fact',
    taskContext: {
      questionPrompt: '',
      subjectId,
      topicId,
      lessonId: '',
      childMode,
      methodology,
    },
  });
}

/** Ask Tali for a motivational message. */
export async function getMotivation(language: string): Promise<string | null> {
  return sendToCompanion({
    message: 'Give me encouragement',
    language,
    mode: 'motivation',
  });
}
