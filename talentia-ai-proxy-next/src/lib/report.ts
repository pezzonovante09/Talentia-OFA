export type ReportLanguage = "en" | "ru" | "ky";

export type ReportClientResponse = {
  strongSides: string[];
  weakSides: string[];
  commonMistakes?: string[];
  advice: string;
  howToHelpAtHome?: string;
};

export type WeeklyClientResponse = {
  lessonsThisWeek: number;
  correctThisWeek: number;
  streakCount: number;
  topSubject: string;
  insights: string[];
  advice: string;
};

export type ReportStatsInput = {
  totalCorrect?: number;
  totalAttempts?: number;
  streakCount?: number;
  accuracyBySubject?: Record<string, number>;
  childMode?: string;
  methodology?: string;
};

const SUBJECT_LABELS: Record<ReportLanguage, Record<string, string>> = {
  en: {
    math: "Math",
    reading: "Reading (English)",
    reading_ru: "Reading (Russian)",
    writing: "Writing",
    science: "Science",
    logic: "Logic",
    social: "Social skills",
    general: "General",
    mixed: "Mixed topics",
  },
  ru: {
    math: "Математика",
    reading: "Чтение (английский)",
    reading_ru: "Чтение (русский)",
    writing: "Письмо",
    science: "Естествознание",
    logic: "Логика",
    social: "Социальные навыки",
    general: "Общее",
    mixed: "Смешанные темы",
  },
  ky: {
    math: "Математика",
    reading: "Окуу (англисче)",
    reading_ru: "Окуу (орусча)",
    writing: "Жазуу",
    science: "Илим",
    logic: "Логика",
    social: "Социалдык көндүмдөр",
    general: "Жалпы",
    mixed: "Аралаш темалар",
  },
};

function subjectLabel(lang: ReportLanguage, key: string): string {
  const k = key.trim().toLowerCase();
  return SUBJECT_LABELS[lang][k] ?? key;
}

export function normalizeLanguage(raw: unknown): ReportLanguage {
  const v = String(raw ?? "en").toLowerCase();
  if (v === "ru" || v === "ky") return v;
  return "en";
}

const T = {
  en: {
    accuracyHigh: "Good accuracy and stable understanding.",
    accuracyMid: "Shows partial understanding and can improve with practice.",
    accuracyLowWeak: "Needs more support with core concepts.",
    mistakesRepeated: "Makes repeated mistakes in some tasks.",
    streakGood: "Good learning consistency.",
    routineWeak: "Learning routine is not stable yet.",
    engaging: "The child is engaging with the app.",
    noMajorWeak: "No major weak areas detected yet.",
    adviceDaily: "Try 5–10 minutes of practice every day.",
    adviceBasics: "Repeat easier tasks before moving to harder ones.",
    adviceHints: "Use short guided hints and celebrate small wins.",
    adviceVariety: "Gradually increase difficulty and add variety.",
    adviceDefault: "Keep a steady routine and encourage curiosity.",
    mistakeGeneric:
      "Rushing or guessing without checking the steps is common at this stage.",
    mistakeSubject: (name: string) =>
      `More errors show up in ${name}—review examples slowly and aloud.`,
    weakSubject: (name: string) => `${name} looks harder right now.`,
    strongSubject: (name: string) => `${name} looks relatively strong.`,
    methodology: (m: string) => `Method focus: ${m}.`,
    homeDefault:
      "At home: short sessions, calm tone, and praise effort—not only correct answers.",
    homePlayful:
      "At home: keep it playful—short games, no pressure, end on a win.",
    homeFocus:
      "At home: reduce distractions, one task at a time, then a quick break.",
    homeCalm:
      "At home: slower pace, repeat in different words, and model the first step.",
    topMixed: "Mixed practice across topics",
    worldLine: (world: string) => `Progress in “${world}” is included below.`,
    weeklyGreat: "Strong week—most answers were correct.",
    weeklyMid: "Solid week with room to tighten accuracy.",
    weeklyLow: "This week had more mistakes—revisit the basics briefly.",
    weeklyStreak: "Streak is growing—nice habit building.",
    weeklyNoStreak: "A short daily routine will help stabilize results.",
    weeklyVolumeLow: "Few lessons this week—even one short session helps.",
    weeklyVolumeOk: "Good number of lessons this week.",
    weeklyAdviceHigh:
      "Next week: add a bit of variety while keeping tasks short.",
    weeklyAdviceLow:
      "Next week: repeat easier items, then slowly raise difficulty.",
    weeklyTop: (name: string) => `Relative strength: ${name}.`,
    weeklyPeriod: (iso: string) => `Week starting ${iso}.`,
  },
  ru: {
    accuracyHigh: "Хорошая точность и устойчивое понимание.",
    accuracyMid: "Есть частичное понимание; можно усилить практикой.",
    accuracyLowWeak: "Нужна больше поддержка по базовым понятиям.",
    mistakesRepeated: "Встречаются повторяющиеся ошибки в отдельных заданиях.",
    streakGood: "Хорошая регулярность занятий.",
    routineWeak: "Режим обучения пока нестабилен.",
    engaging: "Ребёнок вовлечён в приложение.",
    noMajorWeak: "Серьёзных слабых зон пока не видно.",
    adviceDaily: "Пробуйте 5–10 минут практики каждый день.",
    adviceBasics: "Повторите более простые задания, прежде чем усложнять.",
    adviceHints: "Давайте короткие подсказки и отмечайте маленькие успехи.",
    adviceVariety: "Постепенно повышайте сложность и добавляйте разнообразие.",
    adviceDefault: "Сохраняйте спокойный режим и поощряйте любопытство.",
    mistakeGeneric:
      "Часто встречается спешка или угадывание без проверки шагов.",
    mistakeSubject: (name: string) =>
      `Больше ошибок в теме «${name}»—разберите примеры медленно и вслух.`,
    weakSubject: (name: string) => `Сейчас сложнее даётся: ${name}.`,
    strongSubject: (name: string) => `Относительно сильнее: ${name}.`,
    methodology: (m: string) => `Фокус методики: ${m}.`,
    homeDefault:
      "Дома: короткие занятия, спокойный тон, хвалите усилие, а не только верные ответы.",
    homePlayful:
      "Дома: лёгкий игровой формат, без давления, завершайте на успехе.",
    homeFocus:
      "Дома: меньше отвлечений, одно задание за раз, затем короткий перерыв.",
    homeCalm:
      "Дома: медленнее темп, перефразируйте объяснение и покажите первый шаг.",
    topMixed: "Смешанная практика по темам",
    worldLine: (world: string) => `Ниже — прогресс в мире «${world}».`,
    weeklyGreat: "Сильная неделя — большинство ответов верные.",
    weeklyMid: "Неделя неплохая, точность можно подтянуть.",
    weeklyLow: "На этой неделе больше ошибок — кратко повторите основы.",
    weeklyStreak: "Серия дней растёт — хорошая привычка.",
    weeklyNoStreak: "Короткая ежедневная привычка поможет стабилизировать результат.",
    weeklyVolumeLow: "Мало уроков на неделе — даже короткая сессия полезна.",
    weeklyVolumeOk: "Хороший объём занятий на этой неделе.",
    weeklyAdviceHigh:
      "На следующей неделе: чуть больше разнообразия при коротких заданиях.",
    weeklyAdviceLow:
      "На следующей неделе: повторите простое, затем медленно усложняйте.",
    weeklyTop: (name: string) => `Относительная сила: ${name}.`,
    weeklyPeriod: (iso: string) => `Неделя с ${iso}.`,
  },
  ky: {
    accuracyHigh: "Тактык жакшы жана түшүнүк туруктуу.",
    accuracyMid: "Жарым-жартылай түшүнүү бар; практика менен күчөтсө болот.",
    accuracyLowWeak: "Негизги түшүнүктөр боюнча көбүрөөк колдоо керек.",
    mistakesRepeated: "Айрым тапшырмаларда кайталанган ката бар.",
    streakGood: "Окуу адаты жакшы.",
    routineWeak: "Окуу режими азырынча туруктуу эмес.",
    engaging: "Бала колдонмого кызыгып жатат.",
    noMajorWeak: "Чоң алаксыздыктар азырынча көрүнбөйт.",
    adviceDaily: "Күнүнө 5–10 мүнөт практика кылып көрүңүз.",
    adviceBasics: "Кыйындатмай эле, алды менен жөнөкөй тапшырмаларды кайталоо.",
    adviceHints: "Кыска көрсөтмө берип, кичине ийгиликти да белгилеңиз.",
    adviceVariety: "Аз-аздан кыйынчылыкты көбөйтүп, ар түрдүүлүк кошуңуз.",
    adviceDefault: "Тынч режимди сактап, кызыгууну колдоно бериңиз.",
    mistakeGeneric: "Көп учурда шашылыш же текшерүүсүз болжолдоо кездешет.",
    mistakeSubject: (name: string) =>
      `«${name}» боюнча каталар көбүрөөк—мисалдарды жай жана үн чыгарып караңыз.`,
    weakSubject: (name: string) => `Азыр кыйынраак: ${name}.`,
    strongSubject: (name: string) => `Салыштырмалуу күчтүү: ${name}.`,
    methodology: (m: string) => `Методика фокусу: ${m}.`,
    homeDefault:
      "Үйдө: кыска сессиялар, тынч тон, аракетти да мактоо — гана туура жоопту эмес.",
    homePlayful:
      "Үйдө: оюнчаа формат, басым жок, ийгилик менен аяктоо.",
    homeFocus:
      "Үйдө: аз алаксытуу, бир тапшырма, андан кийин кыска тыныгуу.",
    homeCalm:
      "Үйдө: жай темп, башка сөз менен кайталоо, биринчи кадамды көрсөтүү.",
    topMixed: "Темалар боюнча аралаш практика",
    worldLine: (world: string) => `Төмөндө «${world}» дүйнөсүндөгү прогресс.`,
    weeklyGreat: "Күчтүү апта — көбүнчө жооптор туура.",
    weeklyMid: "Апта жакшы, тактыкты дагы жакшыртууга болот.",
    weeklyLow: "Бул аптада каталар көбүрөөк — негиздерди кыска кайталоо.",
    weeklyStreak: "Күн сериясы өсүүдө — жакшы адат.",
    weeklyNoStreak: "Күнүнө кыска адат натыйжаны туруктуулоого жардам берет.",
    weeklyVolumeLow: "Бул аптада сабак аз — кыска сессия да пайдалуу.",
    weeklyVolumeOk: "Бул аптада сабактын саны жакшы.",
    weeklyAdviceHigh:
      "Кийинки апта: кыска тапшырмалар менен аздап ар түрдүүлүк кошуңуз.",
    weeklyAdviceLow:
      "Кийинки апта: жөнөкөйдү кайталаңыз, андан кийин жай кыйындатыңыз.",
    weeklyTop: (name: string) => `Салыштырмалуу күч: ${name}.`,
    weeklyPeriod: (iso: string) => `Апта: ${iso}.`,
  },
} satisfies Record<
  ReportLanguage,
  Record<string, string | ((a: string) => string)>
>;

function parseAccuracyBySubject(
  raw: unknown
): Record<string, number> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const n = Number(v);
    if (Number.isFinite(n)) out[k] = n;
  }
  return Object.keys(out).length ? out : undefined;
}

function bestWorstSubjects(abs?: Record<string, number>) {
  if (!abs || !Object.keys(abs).length) return { best: null as string | null, worst: null as string | null, weak: [] as string[] };
  let bestK: string | null = null;
  let bestV = -1;
  let worstK: string | null = null;
  let worstV = 101;
  const weak: string[] = [];
  for (const [k, v] of Object.entries(abs)) {
    if (v > bestV) {
      bestV = v;
      bestK = k;
    }
    if (v < worstV) {
      worstV = v;
      worstK = k;
    }
    if (v < 60) weak.push(k);
  }
  return { best: bestK, worst: worstK, weak };
}

export function buildStandardReport(
  body: ReportStatsInput,
  lang: ReportLanguage,
  opts?: { worldName?: string }
): ReportClientResponse {
  const t = T[lang];
  const totalCorrect = Number(body.totalCorrect ?? 0);
  const totalAttempts = Number(body.totalAttempts ?? 0);
  const streakCount = Number(body.streakCount ?? 0);
  const accuracy =
    totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;
  const abs = parseAccuracyBySubject(body.accuracyBySubject);
  const { best, worst, weak } = bestWorstSubjects(abs);

  const strongSides: string[] = [];
  const weakSides: string[] = [];
  const commonMistakes: string[] = [];
  const adviceParts: string[] = [];

  if (opts?.worldName) {
    strongSides.push(t.worldLine(opts.worldName));
  }

  if (accuracy >= 80) {
    strongSides.push(t.accuracyHigh);
  } else if (accuracy >= 50) {
    strongSides.push(t.accuracyMid);
    weakSides.push(t.mistakesRepeated);
  } else if (totalAttempts > 0) {
    weakSides.push(t.accuracyLowWeak);
  }

  if (streakCount >= 3) strongSides.push(t.streakGood);
  else weakSides.push(t.routineWeak);

  if (best != null && abs && (abs[best] ?? 0) >= 70) {
    strongSides.push(t.strongSubject(subjectLabel(lang, best)));
  }
  if (worst != null && abs && (abs[worst] ?? 0) < 60) {
    weakSides.push(t.weakSubject(subjectLabel(lang, worst)));
  }

  if (accuracy < 70 && totalAttempts > 0) {
    commonMistakes.push(t.mistakeGeneric);
  }
  for (const w of weak.slice(0, 3)) {
    commonMistakes.push(t.mistakeSubject(subjectLabel(lang, w)));
  }

  if (streakCount < 3) adviceParts.push(t.adviceDaily);
  if (accuracy < 70) {
    adviceParts.push(t.adviceBasics);
    adviceParts.push(t.adviceHints);
  } else {
    adviceParts.push(t.adviceVariety);
  }

  if (body.methodology && String(body.methodology).trim()) {
    adviceParts.push(t.methodology(String(body.methodology).trim()));
  }

  const worldIntro = opts?.worldName ? t.worldLine(opts.worldName) : null;
  const substantiveStrong = strongSides.filter((s) => s !== worldIntro);
  if (substantiveStrong.length === 0) {
    strongSides.push(t.engaging);
  }
  if (weakSides.length === 0) weakSides.push(t.noMajorWeak);
  if (adviceParts.length === 0) adviceParts.push(t.adviceDefault);

  const mode = String(body.childMode ?? "").toLowerCase();
  let howToHelpAtHome: string | undefined;
  if (mode.includes("play")) howToHelpAtHome = t.homePlayful;
  else if (mode.includes("focus")) howToHelpAtHome = t.homeFocus;
  else if (mode.includes("calm")) howToHelpAtHome = t.homeCalm;
  else howToHelpAtHome = t.homeDefault;

  const out: ReportClientResponse = {
    strongSides,
    weakSides,
    advice: adviceParts.join(" "),
  };
  if (commonMistakes.length) out.commonMistakes = commonMistakes;
  out.howToHelpAtHome = howToHelpAtHome;
  return out;
}

export function buildWeeklyReport(
  body: ReportStatsInput & {
    lessonsThisWeek: number;
    correctThisWeek: number;
    weekStartDate: string;
  },
  lang: ReportLanguage
): WeeklyClientResponse {
  const t = T[lang];
  const lessonsThisWeek = Math.max(0, Number(body.lessonsThisWeek ?? 0));
  const correctThisWeek = Math.max(0, Number(body.correctThisWeek ?? 0));
  const streakCount = Number(body.streakCount ?? 0);
  const abs = parseAccuracyBySubject(body.accuracyBySubject);
  const weekRate =
    lessonsThisWeek > 0 ? correctThisWeek / lessonsThisWeek : 0;
  const insights: string[] = [];
  const weekLabel = String(body.weekStartDate ?? "").trim();
  if (weekLabel) insights.push(t.weeklyPeriod(weekLabel));

  if (weekRate >= 0.8) insights.push(t.weeklyGreat);
  else if (weekRate >= 0.5) insights.push(t.weeklyMid);
  else if (lessonsThisWeek > 0) insights.push(t.weeklyLow);

  if (streakCount >= 3) insights.push(t.weeklyStreak);
  else insights.push(t.weeklyNoStreak);

  if (lessonsThisWeek < 3) insights.push(t.weeklyVolumeLow);
  else insights.push(t.weeklyVolumeOk);

  const { best } = bestWorstSubjects(abs);
  const topSubject =
    best != null
      ? `${subjectLabel(lang, best)} (${Math.round(abs![best])}%)`
      : t.topMixed;

  if (best != null) insights.push(t.weeklyTop(subjectLabel(lang, best)));

  let advice =
    weekRate >= 0.7 ? t.weeklyAdviceHigh : t.weeklyAdviceLow;
  if (body.methodology && String(body.methodology).trim()) {
    advice = `${advice} ${t.methodology(String(body.methodology).trim())}`;
  }

  return {
    lessonsThisWeek,
    correctThisWeek,
    streakCount,
    topSubject,
    insights,
    advice,
  };
}

export function buildWorldReport(
  worldName: string,
  stats: ReportStatsInput,
  lang: ReportLanguage
): ReportClientResponse {
  return buildStandardReport(stats, lang, { worldName });
}
