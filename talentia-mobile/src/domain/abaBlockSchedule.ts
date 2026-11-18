/**
 * Расписание ребёнку (решение методиста 34): сколько рабочих блоков осталось в плане сессии и последний ли следующий.
 * Только чтение очереди — план не меняется; без I/O.
 *
 * Правило счёта (структурное, без id целей — новый вид блока считается так же):
 * - очередь режется перерывами (`break`) на отрезки;
 * - в отрезке блок — это пробы, закрытые `block_end`; `block_end` без проб перед ним (блок уже доигран) не считается;
 * - пробы отрезка без единого закрытого блока (поддержание и обобщение в конце, после перерыва) — один блок;
 *   хвост проб после последнего `block_end` в том же отрезке — часть того же отрезка, отдельно не считается.
 * Перерыв в голове очереди (идёт сейчас) ничего не меняет: пустой отрезок даёт 0.
 * Лимит времени может кончить сессию раньше — «последнее» обещает план, а не часы (таймера ребёнку нет).
 */
import type { AbaSessionState } from './abaSession';

type Queue = AbaSessionState['queue'];

export type BlockSchedule = {
  /** Рабочих блоков впереди, считая следующий. 0 — работы больше нет: расписание не показывается. */
  blocksLeft: number;
  /** Следующий блок — последний: значок «последнее» вместо точек. */
  isLast: boolean;
};

export function blockSchedule(queue: Queue): BlockSchedule {
  let total = 0;
  let closed = 0; // закрытых блоков в текущем отрезке
  let trials = 0; // проб с прошлого `block_end` или начала отрезка
  let anyTrial = false; // проба в отрезке вообще
  const closeStretch = () => {
    total += closed > 0 ? closed : anyTrial ? 1 : 0;
    closed = 0;
    trials = 0;
    anyTrial = false;
  };
  for (const item of queue) {
    if (item.kind === 'break') closeStretch();
    else if (item.kind === 'trial') {
      trials += 1;
      anyTrial = true;
    } else if (item.kind === 'block_end') {
      if (trials > 0) closed += 1;
      trials = 0;
    }
  }
  closeStretch();
  return { blocksLeft: total, isLast: total === 1 };
}
