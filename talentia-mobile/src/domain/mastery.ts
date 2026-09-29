/**
 * Освоение навыка и интервальное повторение.
 *
 * Прежняя модель держала на теме число `skill` от 0 до 100 и двигала его на +3
 * за верный ответ и на −2 за неверный. Она не отвечала ни на один вопрос,
 * который реально задают: освоен ли навык, когда его пора повторить, что
 * показать родителю. «Навык 47» не значит ничего.
 *
 * Здесь вместо этого коробки Лейтнера — приём старше компьютеров и понятный
 * без объяснений: ответил уверенно — навык уезжает в коробку подальше и
 * спрашивается реже; ошибся — возвращается в первую и спрашивается сразу.
 *
 * Считается по **навыку**, а не по уроку: один навык живёт в нескольких уроках
 * и в разных формулировках, и повторять надо именно его.
 */

/** Коробка: 1 — только что ошибся, 4 — освоено. */
export type Box = 1 | 2 | 3 | 4;

export type SkillState = {
  skill: string;
  box: Box;
  /** Верных подряд без помощи. Сбрасывается при любой ошибке. */
  correctInRow: number;
  attempts: number;
  correct: number;
  /** Номер урока, на котором навык встретился в последний раз. */
  lastSeenLesson: number;
};

/**
 * Через сколько уроков спросить снова.
 *
 * Шаг растёт неравномерно: между первой и второй коробкой мало, между третьей
 * и четвёртой много. Навык, который ребёнок только что вспомнил с трудом, надо
 * трогать часто; тот, что держится третий раз подряд, — редко, иначе уроки
 * заполняются повторением вместо нового.
 */
export const REVIEW_GAP: Record<Box, number> = { 1: 1, 2: 2, 3: 5, 4: 12 };

/**
 * Исход попытки.
 *
 * - `helped` — ответ показали: после второй ошибки или сразу, когда сужать было
 *   некуда (SCREENS.md, 2.6). В корпусе это почти не встречается: оценочное
 *   задание обязано давать ≥ 3 альтернатив, два варианта — только в знакомстве,
 *   которое в зачёт не идёт вовсе (`lessonFlow.countsTowardMastery`).
 * - `transfer_correct` — верный ответ в пробе переноса: то же задание вернулось
 *   позже в уроке после показа. Отдельная проба, коробку не двигает — ответ
 *   получен в той же сессии после коррекции; самостоятельной считается следующая
 *   встреча с навыком по `isDue`. Звёзды не меняет.
 */
export type Outcome = 'correct' | 'hinted' | 'helped' | 'transfer_correct';

export function emptySkill(skill: string): SkillState {
  return { skill, box: 1, correctInRow: 0, attempts: 0, correct: 0, lastSeenLesson: -1 };
}

/**
 * Ответ с подсказки не двигает навык вперёд, но и не отбрасывает назад:
 * ребёнок справился, просто не сам. Показанный ответ возвращает в первую
 * коробку — засчитывать его как знание нельзя.
 */
export function applyOutcome(s: SkillState, outcome: Outcome, lesson: number): SkillState {
  const attempts = s.attempts + 1;
  const correct = s.correct + (outcome === 'correct' ? 1 : 0);
  const base = { ...s, attempts, correct, lastSeenLesson: lesson };

  if (outcome === 'transfer_correct') return { ...base, correct: s.correct + 1 };
  if (outcome === 'helped') return { ...base, box: 1, correctInRow: 0 };
  if (outcome === 'hinted') return { ...base, correctInRow: 0 };

  const correctInRow = s.correctInRow + 1;
  const box = Math.min(4, s.box + 1) as Box;
  return { ...base, box, correctInRow };
}

/**
 * Все попытки навыка за один урок — одним шагом коробки.
 *
 * Коробка — это интервал до следующей встречи, а не счётчик верных. В уроке часто
 * два-три задания на один навык, и если двигать коробку на каждое, безошибочный
 * первый урок сразу даёт «освоено»: навык уезжает в четвёртую коробку и не
 * всплывает двенадцать уроков, хотя его ни разу не вспоминали после перерыва.
 * Поэтому за урок коробка сдвигается не больше чем на шаг, и решает худший исход:
 * хоть раз показали ответ — первая коробка; хоть раз с подсказкой — на месте;
 * всё сам — на одну дальше. Счётчики попыток и серия верных копятся как обычно.
 *
 * Вперёд — только если навыку **подошёл срок** (или он встретился впервые). Иначе
 * три урока одной темы с общим навыком, пройденные за вечер, дают четвёртую коробку
 * без единого перерыва — та же ошибка в масштабе темы. Назад — при любом сроке:
 * показанный ответ знанием не бывает.
 */
export function applyLessonOutcomes(s: SkillState, outcomes: readonly Outcome[], lesson: number): SkillState {
  if (outcomes.length === 0) return s;
  const counted = outcomes.reduce((acc, o) => applyOutcome(acc, o, lesson), s);
  const forBox = outcomes.filter((o) => o !== 'transfer_correct');
  const due = s.lastSeenLesson < 0 || isDue(s, lesson);
  let box = s.box;
  if (forBox.includes('helped')) box = 1;
  else if (due && forBox.length > 0 && !forBox.includes('hinted')) box = Math.min(4, s.box + 1) as Box;
  return { ...counted, box };
}

/** Освоен ли навык: дошёл до последней коробки. */
export function isMastered(s: SkillState): boolean {
  return s.box === 4;
}

/** Пора ли повторить навык на уроке с этим номером. */
export function isDue(s: SkillState, lesson: number): boolean {
  if (s.lastSeenLesson < 0) return false;
  return lesson - s.lastSeenLesson >= REVIEW_GAP[s.box];
}

/**
 * Какие навыки подмешать в урок повторением.
 *
 * Не больше двух: урок из пяти заданий, где три — повторение, перестаёт быть
 * новым уроком. Первыми идут навыки из младших коробок — те, что хуже держатся.
 */
export function skillsToReview(all: SkillState[], lesson: number, limit = 2): SkillState[] {
  return all
    .filter((s) => isDue(s, lesson))
    .sort((a, b) => a.box - b.box || a.lastSeenLesson - b.lastSeenLesson)
    .slice(0, limit);
}

/**
 * Звёзды за урок. Три градации, и различает их не цвет, а причина:
 * без единой ошибки, с одной, и «прошёл, но ответ показывали».
 */
export function starsForLesson(all: Outcome[]): 1 | 2 | 3 {
  // проба переноса — повтор уже засчитанного задания, звёзды она не меняет
  const outcomes = all.filter((o) => o !== 'transfer_correct');
  if (outcomes.some((o) => o === 'helped')) return 1;
  const hints = outcomes.filter((o) => o === 'hinted').length;
  if (hints === 0) return 3;
  if (hints === 1) return 2;
  return 1;
}
