/**
 * Проба шага «коснись картинки» на экране (решение 1, часть В; `domain/abaSampleTouch.ts`). Модель чистая: время приходит
 * в событиях, срок следующего — `sampleTouchDueAt`; итог — `SampleTouchInput` для `recordSampleTouch`.
 *
 * - На экране только образец и инструкция «коснись». Лестница L0 → L1 → L3 (L2 нет), не больше трёх предъявлений:
 *   L0 ждёт задержку по полосе, метка (L1) и модель (L3) — окно касания.
 * - После модели без касания: L4 разрешена — карточка L4 взрослому (`l4_done` / `l4_resisted` / `l4_skipped`), иначе
 *   проба кончается без касания.
 * - «Была подсказка» делает пробу подсказанной (касание — «принято», а не жетон); «Отказ» кончает шаг на сегодня.
 */
import { SAMPLE_TOUCH_LADDER, SAMPLE_TOUCH_MAX_PRESENTATIONS, type SampleTouchInput, type SampleTouchLevel } from '../../../domain/abaSampleTouch';
import type { AbaStep } from '../../../domain/abaSession';
import type { PanelButton } from '../../../domain/abaScoring';
import type { SampleTouchOutcome } from '../../../types/aba';

export type SampleTouchStep = Extract<AbaStep, { kind: 'sample_touch' }>;

export type SampleTouchRun = {
  step: SampleTouchStep;
  shownAt: number;
  /** Предъявления приложения: уровень и начало. */
  log: { level: SampleTouchLevel; startedAt: number }[];
  touchedAt: number | null;
  adultPrompted: boolean;
  /** Модель без касания и L4 разрешена: ждём кнопку взрослого на карточке L4. */
  awaitingL4: boolean;
  outcome: SampleTouchOutcome | null;
  done: boolean;
};

export type SampleTouchEvent =
  | { type: 'tap_sample'; at: number }
  | { type: 'adult'; button: PanelButton; at: number }
  | { type: 'due'; at: number };

/** Кнопки панели: в пробе — «Была подсказка» и «Отказ»; на карточке L4 — её кнопки и «Отказ». */
export const TOUCH_PANEL: readonly PanelButton[] = ['adult_prompted', 'refusal'];
export const TOUCH_L4_PANEL: readonly PanelButton[] = ['l4_done', 'l4_resisted', 'l4_skipped', 'refusal'];

export function startSampleTouch(step: SampleTouchStep, shownAt: number): SampleTouchRun {
  return { step, shownAt, log: [{ level: step.startLevel, startedAt: shownAt }], touchedAt: null, adultPrompted: false, awaitingL4: false, outcome: null, done: false };
}

/** Уровень текущего предъявления приложения: от него метка (L1+) и рука-модель (L3). */
export const touchLevel = (r: SampleTouchRun): SampleTouchLevel => r.log[r.log.length - 1].level;

export function sampleTouchDueAt(r: SampleTouchRun): number | null {
  if (r.done || r.awaitingL4) return null;
  const cur = r.log[r.log.length - 1];
  return cur.startedAt + (cur.level === 0 ? r.step.delayMs : r.step.windowMs);
}

const close = (r: SampleTouchRun, outcome: SampleTouchOutcome, touchedAt: number | null = null): SampleTouchRun => ({
  ...r,
  outcome,
  touchedAt,
  awaitingL4: false,
  done: true,
});

export function stepSampleTouch(r: SampleTouchRun, e: SampleTouchEvent): SampleTouchRun {
  if (r.done) return r;
  switch (e.type) {
    case 'tap_sample':
      return r.awaitingL4 ? r : close(r, 'touched', e.at);
    case 'adult':
      if (e.button === 'refusal') return close(r, 'refusal');
      if (e.button === 'l4_done' || e.button === 'l4_resisted' || e.button === 'l4_skipped') return r.awaitingL4 ? close(r, e.button) : r;
      if (e.button === 'adult_prompted' && !r.awaitingL4) return { ...r, adultPrompted: true };
      return r;
    case 'due': {
      const due = sampleTouchDueAt(r);
      if (due === null || e.at < due) return r;
      const level = touchLevel(r);
      if (level >= 3 || r.log.length >= SAMPLE_TOUCH_MAX_PRESENTATIONS) {
        return r.step.l4Available ? { ...r, awaitingL4: true } : close(r, 'no_response');
      }
      // третье предъявление — сразу модель (как `nextEscalation`: последняя эскалация — полная модель)
      const next = r.log.length + 1 === SAMPLE_TOUCH_MAX_PRESENTATIONS ? 3 : (SAMPLE_TOUCH_LADDER.find((l) => l > level) ?? 3);
      return { ...r, log: [...r.log, { level: next, startedAt: due }] };
    }
  }
}

/** Запись пробы для `recordSampleTouch`; только у законченной пробы. */
export function sampleTouchInput(r: SampleTouchRun): SampleTouchInput {
  if (!r.done || r.outcome === null) throw new Error('проба шага не закончена');
  return {
    startLevel: r.step.startLevel,
    levelUsed: r.outcome === 'l4_done' ? 4 : touchLevel(r),
    outcome: r.outcome,
    adultPrompted: r.adultPrompted,
    latencyMs: r.touchedAt === null ? null : r.touchedAt - r.shownAt,
  };
}
