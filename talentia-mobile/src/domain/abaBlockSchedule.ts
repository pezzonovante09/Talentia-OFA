/**
 * Расписание ребёнку (решение методиста 34, ревью методиста): сколько отрезков работы осталось в плане сессии,
 * последний ли следующий и что «потом». Только чтение очереди и доски — план не меняется; без I/O.
 *
 * Правило счёта (структурное, без id целей): очередь режется перерывами (`break`) на отрезки, отрезок с хотя бы
 * одной пробой — одна точка. Считаются отрезки, а не блоки: расписание видно только на перерыве, и два блока в одном
 * отрезке сняли бы две точки разом. `block_end` без проб (блок уже доигран), доступ и выбор награды — не работа.
 * Перерыв в голове очереди (идёт сейчас) ничего не меняет: пустой отрезок даёт 0.
 * Лимит времени может кончить сессию раньше — «последнее» обещает план, а не часы (таймера ребёнку нет).
 */
import type { AbaSessionState } from './abaSession';
import { breakEndsWithExchange } from './abaSession';

type Queue = AbaSessionState['queue'];

export type BlockSchedule = {
  /** Отрезков работы впереди, считая следующий. 0 — работы больше нет: расписание не показывается. */
  blocksLeft: number;
  /** Следующий отрезок — последний. */
  isLast: boolean;
};

export function blockSchedule(queue: Queue): BlockSchedule {
  let total = 0;
  let anyTrial = false; // проба в текущем отрезке
  for (const item of queue) {
    if (item.kind === 'break') {
      if (anyTrial) total += 1;
      anyTrial = false;
    } else if (item.kind === 'trial') anyTrial = true;
  }
  if (anyTrial) total += 1;
  return { blocksLeft: total, isLast: total === 1 };
}

/**
 * Что «потом» в расписании. Наверняка за работой следуют только жетоны: обмен бывает лишь на полной доске, цикл
 * сопряжения в конце — лишь в сессии без обучения и обменов. Поэтому «потом» — доска (заработанные и пустые
 * ячейки) с наградой при ней («жетоны → награда»). Награда одна — только когда обмен в ближайшей точке гарантирован
 * (`breakEndsWithExchange`); заполнение доски «по плану» не предсказуемо и не считается.
 */
export type ScheduleThen =
  | { kind: 'board'; size: number; earned: number }
  | { kind: 'reward' };

export type ChildScheduleView = BlockSchedule & { reinforcerId: string | null; then: ScheduleThen };

/**
 * Расписание для экрана. Выбор награды ещё впереди (рутина обменяла жетоны, пока сессия была свёрнута, —
 * `reinforcerStale`, или выбор из трёх стоит в очереди) — прежняя картинка была бы ложным обещанием: награды нет,
 * и расписание не показывается.
 */
export function childSchedule(
  state: Pick<AbaSessionState, 'queue' | 'reinforcerId' | 'reinforcerStale' | 'board'>,
): ChildScheduleView {
  const rechoice = state.reinforcerStale === true || state.queue.some((q) => q.kind === 'reinforcer');
  const { size, earned } = state.board;
  const then: ScheduleThen = breakEndsWithExchange(state)
    ? { kind: 'reward' }
    : { kind: 'board', size, earned: Math.max(0, Math.min(earned, size)) };
  return { ...blockSchedule(state.queue), reinforcerId: rechoice ? null : state.reinforcerId, then };
}
