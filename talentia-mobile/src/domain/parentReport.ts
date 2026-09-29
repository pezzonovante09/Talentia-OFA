/**
 * Отчёт родителю. Спецификация — «Состав экрана» и «Чего не хватает» в `PARENT.md`.
 *
 * Строится **из локальных данных**, без сети и без ИИ: прежний отчёт отправлял
 * проценты по предметам в модель и получал «сильные стороны» ребёнка —
 * диагностику без данных для диагностики. Здесь только то, что посчитано.
 *
 * XP, уровень, звёзды и серия дней сюда не входят: это мотивационные счётчики
 * ребёнка, а не показатели обучения. «Вчера 140 XP» не значит ничего.
 */
import type { SkillState } from './mastery';

/** Прохождение урока — то, из чего считаются время и активность. */
export type LessonRun = {
  id: string;
  /**
   * Ребёнок. Отчёт фильтрует по нему: на планшете с двумя детьми иначе одни
   * прохождения попали бы в отчёт обоих.
   */
  childId: string;
  lessonId: string;
  startedAt: string;
  /** Секунды на каждое задание урока, как измерены. Потолок применяется при подсчёте. */
  taskSeconds: number[];
  /** Сколько заданий урока были повторением, а не новым материалом. */
  reviewTasks: number;
};

/**
 * Потолок на задание. Иначе брошенное посреди задания приложение даст «занимался
 * четыре часа» — а родитель спрашивает про экранное время первым.
 */
export const TASK_SECONDS_CAP = 120;

export function runSeconds(run: LessonRun): number {
  return run.taskSeconds.reduce((sum, s) => sum + Math.min(TASK_SECONDS_CAP, Math.max(0, s)), 0);
}

/** Календарный день прохождения в часовом поясе устройства, `YYYY-MM-DD`. */
export type DayOf = (iso: string) => string;

const pad = (n: number) => String(n).padStart(2, '0');
const formatDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * День по локальному времени устройства, а не по UTC: урок в Бишкеке в 5 утра по
 * UTC приходится на предыдущий день, и неделя в отчёте сдвинулась бы.
 */
export const localDay: DayOf = (iso) => formatDay(new Date(iso));

/** Семь дней, заканчивая `today`, от старых к новым. */
export function lastSevenDays(today: string): string[] {
  const [y, m, d] = today.split('-').map(Number);
  return Array.from({ length: 7 }, (_, i) => formatDay(new Date(y, m - 1, d - 6 + i)));
}

export type WeekSummary = {
  /** Полоса из семи клеток, от старого дня к сегодняшнему. Рисуется заливкой против пунктира, не цветом. */
  days: { day: string; active: boolean }[];
  activeDays: number;
  minutes: number;
  lessons: number;
  reviewTasks: number;
};

export function weekSummary(runs: readonly LessonRun[], today: string, dayOf: DayOf = localDay): WeekSummary {
  const week = lastSevenDays(today);
  const inWeek = runs.filter((r) => week.includes(dayOf(r.startedAt)));
  const active = new Set(inWeek.map((r) => dayOf(r.startedAt)));
  const seconds = inWeek.reduce((sum, r) => sum + runSeconds(r), 0);
  return {
    days: week.map((day) => ({ day, active: active.has(day) })),
    activeDays: active.size,
    minutes: Math.round(seconds / 60),
    lessons: inWeek.length,
    reviewTasks: inWeek.reduce((sum, r) => sum + r.reviewTasks, 0),
  };
}

/** Сколько строк в блоке «даётся тяжело». Больше — это уже не подсказка родителю, а тревога. */
export const HARD_LIMIT = 5;

/** С какого числа попыток навык можно назвать трудным. Раньше это шум, а не трудность. */
export const HARD_MIN_ATTEMPTS = 3;

/**
 * Навык даётся тяжело: младшие коробки при накопленных попытках. Одна неудача на
 * новом навыке — не трудность.
 */
export function isHard(s: SkillState): boolean {
  return s.box <= 2 && s.attempts >= HARD_MIN_ATTEMPTS;
}

export type SkillsSummary = {
  /** Коробка 4. Единственное место, где родитель видит результат, а не активность. */
  mastered: SkillState[];
  /** Самые трудные первыми. Пустой список — экран пишет «сейчас ничего не застряло», а не прячет блок. */
  hard: SkillState[];
  /**
   * Середина между «освоено» и «тяжело» — коробки 2–3, кроме уже показанных в
   * «тяжело». Нужна, чтобы блок трудностей не читался как «всё плохо».
   */
  inProgress: number;
};

export function skillsSummary(skills: readonly SkillState[]): SkillsSummary {
  const accuracy = (s: SkillState) => (s.attempts ? s.correct / s.attempts : 0);
  const hard = skills
    .filter(isHard)
    .sort((a, b) => accuracy(a) - accuracy(b) || b.attempts - a.attempts || a.skill.localeCompare(b.skill))
    .slice(0, HARD_LIMIT);
  const shown = new Set(hard.map((s) => s.skill));
  return {
    mastered: skills.filter((s) => s.box === 4).sort((a, b) => a.skill.localeCompare(b.skill)),
    hard,
    inProgress: skills.filter((s) => (s.box === 2 || s.box === 3) && !shown.has(s.skill)).length,
  };
}

export type ParentReport = {
  childId: string;
  /** Последнее прохождение — «последний раз вчера». `null` — ещё не занимался. */
  lastRunAt: string | null;
  week: WeekSummary;
  skills: SkillsSummary;
};

/**
 * Отчёт по одному ребёнку. `skills` — навыки **этого** ребёнка: коробки Лейтнера
 * разделены по ребёнку так же, как прохождения.
 */
export function buildParentReport(
  childId: string,
  runs: readonly LessonRun[],
  skills: readonly SkillState[],
  today: string,
  dayOf: DayOf = localDay,
): ParentReport {
  const own = runs.filter((r) => r.childId === childId);
  const lastRunAt = own.reduce<string | null>((max, r) => (max === null || r.startedAt > max ? r.startedAt : max), null);
  return { childId, lastRunAt, week: weekSummary(own, today, dayOf), skills: skillsSummary(skills) };
}
