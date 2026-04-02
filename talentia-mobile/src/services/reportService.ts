import { worlds } from '../data/worlds';
import type { TopicProgress } from '../store/progressStore';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export type ParentReport = {
  strongSides: string[];
  weakSides: string[];
  commonMistakes?: string[];
  advice: string;
  howToHelpAtHome?: string;
};

export type WeeklyReport = {
  lessonsThisWeek: number;
  correctThisWeek: number;
  streakCount: number;
  topSubject: string;
  insights: string[];
  advice: string;
};

export type ReportStats = {
  accuracyBySubject: Record<string, number>;
  totalCorrect: number;
  totalAttempts: number;
  streakCount: number;
  childMode: string;
  methodology: string | null;
  /** Language for AI-generated text (en, ru, ky) */
  language?: string;
};

export type WeeklyStats = ReportStats & {
  lessonsThisWeek: number;
  correctThisWeek: number;
  weekStartDate: string;
};

const STUB_REPORTS: Record<string, ParentReport> = {
  en: {
    strongSides: ['Counting and number recognition', 'Following instructions'],
    weakSides: ['Word reading under time pressure'],
    commonMistakes: ['Skipping words when reading', 'Rushing through math'],
    advice: 'Keep practice sessions short and playful. Praise effort as much as correct answers.',
    howToHelpAtHome: 'Read together daily. Use real objects for counting. Celebrate small wins.',
  },
  ru: {
    strongSides: ['Счёт и узнавание чисел', 'Следование инструкциям'],
    weakSides: ['Чтение слов при ограничении по времени'],
    commonMistakes: ['Пропуск слов при чтении', 'Спешка в заданиях по математике'],
    advice: 'Делайте занятия короткими и в игровой форме. Хвалите за старание не меньше, чем за правильные ответы.',
    howToHelpAtHome: 'Читайте вместе каждый день. Считайте на предметах. Отмечайте маленькие успехи.',
  },
  ky: {
    strongSides: ['Саноо жана сандарды таануу', 'Көрсөтмөлөрдү аткаруу'],
    weakSides: ['Убакыт чектөөсүндө сөздөрдү окуу'],
    commonMistakes: ['Окууда сөздөрдү өткөрүп жиберүү', 'Математикада шашылышуу'],
    advice: 'Сабактарды кыска жана оюн формасында өткөрүңүз. Туура жоопко эмес, аракетке баа бериңиз.',
    howToHelpAtHome: 'Күн сайын бирге окуңуз. Нерселер менен эсептөө. Кичине ийгиликтерди белгилеңиз.',
  },
};

function getStubReport(lang?: string): ParentReport {
  const key = lang === 'ru' || lang === 'ky' ? lang : 'en';
  return STUB_REPORTS[key];
}

/** Returns true if text appears to be in the expected language for Cyrillic locales. */
function isExpectedLanguage(text: string | undefined, lang?: string): boolean {
  if (!text) return false;
  if (lang !== 'ru' && lang !== 'ky') return true; // No check needed for English
  return /[а-яёА-ЯЁ]/.test(text);
}

const STUB_WEEKLY_BY_LANG: Record<
  string,
  Pick<WeeklyReport, 'topSubject' | 'insights' | 'advice'>
> = {
  en: {
    topSubject: 'Math',
    insights: [
      'Your child enjoyed the Jungle of Numbers world this week.',
      'Addition tasks were completed quickly and accurately.',
    ],
    advice: 'Try the Word Canyon world next — reading practice will complement the math progress!',
  },
  ru: {
    topSubject: 'Математика',
    insights: [
      'На этой неделе ребёнку понравился мир «Джунгли чисел».',
      'Задания на сложение выполнялись быстро и точно.',
    ],
    advice: 'Попробуйте следующим мир «Каньон слов» — чтение дополнит успехи по математике!',
  },
  ky: {
    topSubject: 'Математика',
    insights: [
      'Бул жума балаңызга «Сандар токою» дүйнөсү жакты.',
      'Кошуу тапшырмалары тез жана так аткарылды.',
    ],
    advice: 'Кийинки кадамда «Сөздөр капчыгайы» дүйнөсүн сынап көрүңүз — окуу математикага жардам берет!',
  },
};

function getStubWeeklyParts(lang?: string): Pick<WeeklyReport, 'topSubject' | 'insights' | 'advice'> {
  const key = lang === 'ru' || lang === 'ky' ? lang : 'en';
  return STUB_WEEKLY_BY_LANG[key];
}

export async function generateReport(stats: ReportStats, language?: string): Promise<ParentReport> {
  const stub = getStubReport(language ?? stats.language);
  if (!BACKEND_URL) {
    return stub;
  }
  try {
    const res = await fetch(`${BACKEND_URL}/api/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...stats, language: language ?? stats.language ?? 'en' }),
    });
    if (!res.ok) throw new Error('Report failed');
    const data = await res.json();
    // If the backend returned content in the wrong language, fall back to local stubs
    const lang = language ?? stats.language;
    const contentOk = isExpectedLanguage(data.strongSides?.[0], lang);
    return {
      strongSides: (contentOk ? data.strongSides : null) ?? stub.strongSides,
      weakSides: (contentOk ? data.weakSides : null) ?? stub.weakSides,
      commonMistakes: (contentOk ? data.commonMistakes : null) ?? stub.commonMistakes,
      advice: (contentOk ? data.advice : null) ?? stub.advice,
      howToHelpAtHome: (contentOk ? data.howToHelpAtHome : null) ?? stub.howToHelpAtHome,
    };
  } catch (err) {
    console.error('[reportService] generateReport failed:', err);
    return stub;
  }
}

const SUBJECT_LABEL: Record<string, string> = {
  math: 'Math',
  reading: 'English',
  reading_ru: 'Russian',
  logic: 'Science',
};

/** Stats for a single world, for AI report generation */
export function getWorldStats(
  worldId: string,
  topics: Record<string, TopicProgress>,
): Pick<ReportStats, 'accuracyBySubject' | 'totalCorrect' | 'totalAttempts'> | null {
  const world = worlds.find((w) => w.id === worldId);
  if (!world) return null;
  const bySubject: Record<string, { correct: number; attempts: number }> = {};
  let totalCorrect = 0;
  let totalAttempts = 0;
  for (const topic of world.topics) {
    const tp = topics[topic.id];
    if (!tp) continue;
    const label = SUBJECT_LABEL[topic.subject] ?? topic.subject;
    if (!bySubject[label]) bySubject[label] = { correct: 0, attempts: 0 };
    bySubject[label].correct += tp.totalCorrect;
    bySubject[label].attempts += tp.totalAttempts;
    totalCorrect += tp.totalCorrect;
    totalAttempts += tp.totalAttempts;
  }
  const accuracyBySubject: Record<string, number> = {};
  for (const [label, data] of Object.entries(bySubject)) {
    accuracyBySubject[label] = data.attempts > 0 ? Math.round((data.correct / data.attempts) * 100) : 0;
  }
  return { accuracyBySubject, totalCorrect, totalAttempts };
}

export type WorldReport = ParentReport;

const STUB_WORLD_REPORTS: Record<string, WorldReport> = {
  en: {
    strongSides: ['Successfully completed the island tasks.', 'Follows instructions well.'],
    weakSides: ['Some topics need more practice.'],
    advice: 'Keep practicing regularly. Praise your child for effort.',
    howToHelpAtHome: 'Play board games together, read aloud.',
  },
  ru: {
    strongSides: ['Успешно освоил задания острова.', 'Хорошо справляется с инструкциями.'],
    weakSides: ['Требуется больше практики в некоторых темах.'],
    advice: 'Продолжайте заниматься регулярно. Хвалите ребёнка за усилия.',
    howToHelpAtHome: 'Играйте в настольные игры, читайте вместе.',
  },
  ky: {
    strongSides: ['Аралдагы тапшырмаларды ийгиликтүү аяктады.', 'Көрсөтмөлөрдү жакшы аткарат.'],
    weakSides: ['Кээ бир темаларда көбүрөөк көнүгүү керек.'],
    advice: 'Түздүктөн менен машыгууну улантыңыз. Балаңызды аракет үчүн мактаңыз.',
    howToHelpAtHome: 'Бирге настолка оюндарын ойноңуз, китеп окуңуз.',
  },
};

export async function generateWorldReport(params: {
  worldId: string;
  worldName: string;
  stats: ReportStats;
  language: string;
}): Promise<WorldReport> {
  const { worldId, worldName, stats, language } = params;
  const stub = STUB_WORLD_REPORTS[language] ?? STUB_WORLD_REPORTS.en;
  if (!BACKEND_URL) return stub;
  try {
    const res = await fetch(`${BACKEND_URL}/api/report/world`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ worldId, worldName, stats, language }),
    });
    if (!res.ok) throw new Error('World report failed');
    const data = await res.json();
    const contentOk = isExpectedLanguage(data.strongSides?.[0], language);
    return {
      strongSides: (contentOk ? data.strongSides : null) ?? stub.strongSides,
      weakSides: (contentOk ? data.weakSides : null) ?? stub.weakSides,
      commonMistakes: (contentOk ? data.commonMistakes : null) ?? stub.commonMistakes,
      advice: (contentOk ? data.advice : null) ?? stub.advice,
      howToHelpAtHome: (contentOk ? data.howToHelpAtHome : null) ?? stub.howToHelpAtHome,
    };
  } catch (err) {
    console.error('[reportService] generateWorldReport failed:', err);
    return stub;
  }
}

export async function getWeeklyReport(stats: WeeklyStats): Promise<WeeklyReport> {
  const stubParts = getStubWeeklyParts(stats.language);
  if (!BACKEND_URL) {
    return {
      lessonsThisWeek: stats.lessonsThisWeek,
      correctThisWeek: stats.correctThisWeek,
      streakCount: stats.streakCount,
      topSubject: stubParts.topSubject,
      insights: stubParts.insights,
      advice: stubParts.advice,
    };
  }
  try {
    const res = await fetch(`${BACKEND_URL}/api/report/weekly`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...stats, language: stats.language ?? 'en' }),
    });
    if (!res.ok) throw new Error('Weekly report failed');
    const data = await res.json();
    const contentOk = isExpectedLanguage(data.advice ?? data.insights?.[0], stats.language);
    return {
      lessonsThisWeek: data.lessonsThisWeek ?? stats.lessonsThisWeek,
      correctThisWeek: data.correctThisWeek ?? stats.correctThisWeek,
      streakCount: data.streakCount ?? stats.streakCount,
      topSubject: (contentOk ? data.topSubject : null) ?? stubParts.topSubject,
      insights: (contentOk ? data.insights : null) ?? stubParts.insights,
      advice: (contentOk ? data.advice : null) ?? stubParts.advice,
    };
  } catch (err) {
    console.error('[reportService] getWeeklyReport failed:', err);
    return {
      lessonsThisWeek: stats.lessonsThisWeek,
      correctThisWeek: stats.correctThisWeek,
      streakCount: stats.streakCount,
      topSubject: stubParts.topSubject,
      insights: stubParts.insights,
      advice: stubParts.advice,
    };
  }
}
