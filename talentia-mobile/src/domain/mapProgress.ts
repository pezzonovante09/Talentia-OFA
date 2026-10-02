/**
 * Открытие уроков на карте. Решение №41 — правила `child-ux-specialist` 2026-10-02 (AUDIT.md,
 * С14, С16; REBUILD.md, «Карта: порции, повторение, старт не с начала»); №26 и №40 — старт
 * не с начала.
 *
 * Зачем порции: полоса 5-6 — 36 уроков, а это два года. Без порций ребёнок «закрывает карту»
 * за выходные и упирается в тупик, где нажать нечего. Порция одна на ребёнка, общая для всех
 * регионов: по порции на регион дала бы пятилетке четыре урока в день, около получаса.
 *
 * Чистая логика без I/O: состояние порции хранится в `child_state`, завершения — в журнале.
 */
import { daysBetween } from './mastery';
import type { AgeBand } from '../types/task';

const BANDS: readonly AgeBand[] = ['5-6', '7', '8', '9-10'];
const bandIndex = (b: AgeBand) => BANDS.indexOf(b);

/** Новых уроков в день. Меньше не делать: уроков мало из-за объёма сетки, а не из-за порции. */
export const DAILY_NEW_LESSONS: Record<AgeBand, number> = { '5-6': 2, '7': 2, '8': 3, '9-10': 3 };

/**
 * Потолок накопления. Ребёнку, которому играть разрешают только по выходным, порции копятся,
 * но не выше потолка — чтобы полосу нельзя было проглотить за раз.
 */
export const NEW_LESSONS_CAP: Record<AgeBand, number> = { '5-6': 3, '7': 4, '8': 5, '9-10': 6 };

/** Час, в который начинается игровой день: игра в 23:50 и в 00:10 — один день, а не две порции. */
export const DAY_STARTS_AT_HOUR = 4;

const pad = (n: number) => String(n).padStart(2, '0');

/** Игровой день `YYYY-MM-DD` по локальному календарю устройства, со сменой в 04:00. */
export function gameDay(now: Date): string {
  const d = new Date(now.getTime() - DAY_STARTS_AT_HOUR * 3_600_000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Остаток порции и день последнего начисления (`null` — профиль ещё не запускался). */
export type Portion = { left: number; grantedDay: string | null };

export const NEW_PORTION: Portion = { left: 0, grantedDay: null };

/**
 * Начислить порцию на `today`. Первый запуск — сразу полный потолок: первое впечатление не
 * должно быть стеной. Начисляется только если день строго позже прошлого начисления; часы,
 * переведённые назад, ничего не дают и ничего не отнимают.
 */
export function accruePortion(p: Portion, today: string, band: AgeBand): Portion {
  if (p.grantedDay === null) return { left: NEW_LESSONS_CAP[band], grantedDay: today };
  const days = daysBetween(p.grantedDay, today);
  if (!(days > 0)) return p;
  return { left: Math.min(NEW_LESSONS_CAP[band], p.left + days * DAILY_NEW_LESSONS[band]), grantedDay: today };
}

/**
 * Откуда ребёнок начал: полоса (№26) и на 9-10 — класс (№40). Уроки до точки старта —
 * «исследованная земля».
 */
export type StartPoint = { band: AgeBand; grade?: 3 | 4 };

/** Урок на карте: порядок в регионе — порядок тем и уроков в корпусе. */
export type MapLesson = { id: string; band: AgeBand; grade?: 3 | 4 };

/**
 * - `explored` — до точки старта: открыт, приглушён, без пустых слотов звёзд; проходить
 *   можно, порцию не тратит, указатель на него не ставится, догонять его не нужно;
 * - `done` — пройден; повторять можно без лимита и без порции;
 * - `open` — следующий по порядку, и порция есть (или урок уже начат: брошенный урок всегда
 *   можно продолжить);
 * - `sleeping` — следующий, но порция на сегодня потрачена: не спрятан и не под замком,
 *   «спит» — по тапу Tali говорит, что урок откроется завтра;
 * - `ahead` — дальше по порядку: внутри региона уроки открываются строго по очереди.
 */
export type NodeState = 'explored' | 'done' | 'open' | 'sleeping' | 'ahead';

export function beforeStart(lesson: MapLesson, start: StartPoint): boolean {
  const d = bandIndex(lesson.band) - bandIndex(start.band);
  if (d !== 0) return d < 0;
  return start.grade !== undefined && lesson.grade !== undefined && lesson.grade < start.grade;
}

export type RegionInput = {
  lessons: readonly MapLesson[];
  /** Уроки, завершённые хотя бы раз (получена страница атласа). */
  completed: ReadonlySet<string>;
  /** Начатые и не завершённые. */
  started: ReadonlySet<string>;
};

const pendingStarted = (r: RegionInput, start: StartPoint) =>
  r.lessons.filter((l) => r.started.has(l.id) && !r.completed.has(l.id) && !beforeStart(l, start)).length;

/**
 * Узлы всех регионов. Следующая часть региона (полоса) открывается сама, когда пройдены все
 * уроки текущей: она просто следующая по порядку, день рождения не важен.
 *
 * Начатый и не завершённый урок занимает место в порции заранее: иначе с порцией 1 можно
 * начать по уроку в четырёх регионах и завершить все. Сам он открыт всегда.
 */
export function mapNodes(regions: readonly RegionInput[], start: StartPoint, portionLeft: number): NodeState[][] {
  const free = portionLeft - regions.reduce((n, r) => n + pendingStarted(r, start), 0);
  return regions.map(({ lessons, completed, started }) => {
    let nextFound = false;
    return lessons.map((l) => {
      if (beforeStart(l, start)) return 'explored';
      if (completed.has(l.id)) return 'done';
      if (nextFound) return 'ahead';
      nextFound = true;
      return started.has(l.id) || free > 0 ? 'open' : 'sleeping';
    });
  });
}

/**
 * Полоса, по которой считается порция, — старшая среди текущих частей регионов
 * (предложение `child-ux-specialist`; лимиты задания при этом берутся по полосе урока).
 * Текущая часть региона — полоса его первого непройденного урока после точки старта.
 */
export function portionBand(regions: readonly RegionInput[], start: StartPoint): AgeBand {
  let best = bandIndex(start.band);
  for (const r of regions) {
    const next = r.lessons.find((l) => !beforeStart(l, start) && !r.completed.has(l.id));
    if (next) best = Math.max(best, bandIndex(next.band));
  }
  return BANDS[best];
}

/**
 * Порция после завершения урока. Тратит её только первое завершение урока, который был
 * `open`; повтор пройденного и «исследованная земля» порцию не тратят.
 */
export function afterCompletion(p: Portion, stateBefore: NodeState): Portion {
  return stateBefore === 'open' ? { ...p, left: Math.max(0, p.left - 1) } : p;
}

/**
 * Узел «повторение» всегда на карте — нечитающий ребёнок ориентируется по тому, где что
 * стоит, и исчезнувший узел перестроил бы карту. `active` — есть навыки, которым подошёл срок
 * (`skillsToReview`); `quiet` — повторять нечего, узел приглушён, по тапу Tali: «всё
 * повторено». В порцию не входит и за день не ограничен; одна сессия — не больше
 * `SESSION_TASKS_MAX` заданий полосы. На 5-6 число навыков цифрой не показывается.
 */
export type ReviewNode = 'active' | 'quiet';

export const reviewNode = (dueSkills: number): ReviewNode => (dueSkills > 0 ? 'active' : 'quiet');

/**
 * Куда указывает Tali: на первый открытый урок в порядке регионов; когда порция потрачена,
 * а повторять есть что, — на узел «повторение». Никогда — на «исследованную землю».
 */
export function pointer(regions: readonly NodeState[][], review: ReviewNode): { region: number; lesson: number } | 'review' | null {
  for (let r = 0; r < regions.length; r++) {
    const lesson = regions[r].indexOf('open');
    if (lesson >= 0) return { region: r, lesson };
  }
  return review === 'active' ? 'review' : null;
}
