/**
 * Проба `match` на экране (раздел 5 направления, спецификация п. 4–5, «Журнал пробы `match`» 2026-10-27, Ц2.2 / №159).
 * Модель чистая: время приходит в событиях, срок следующего — `matchDueAt`; итог — `AbaTrialInput` для `recordTrial`.
 *
 * - Конец SD — кадр показа (`sdEndedAt`): звука в этапе 11 нет. Варианты неактивны, пока не коснулись образца.
 * - Предъявление кончается позднее из своего начала и касания образца (`endedAt`); окно выбора — от него. Касания
 *   образца нет — проба ждёт `MATCH_OBSERVING_MS` от конца предъявления (не меньше его окна).
 * - Старт L0, образца не коснулись — L1 приложения (`observingPrompted`, метка над образцом); и после неё нет касания —
 *   `no_response`. Старт L1+: отдельной L1 наблюдения нет, дальше `nextEscalation` по лестнице цели.
 * - Окно истекло без ответа — `nextEscalation`, не больше трёх предъявлений; измерительная проба подсказок не даёт.
 *   После полной модели при `askAdultForL4` — карточка L4 взрослому.
 * - Ответ — первое касание активного варианта; верный — образец. Неверный в пробе коррекции поднимает уровень сразу.
 * - Панель взрослого (`adultPanelButtons`): «Была подсказка» — предъявление `by: 'adult'` внутри окна текущего, в
 *   очереди `childTapLockMs` после касания ребёнка (первая побеждает); «Отказ» и «Сопротивляется» не блокируются и
 *   снимают отложенную отметку. Карточка «перерыв» — `child_break` с моментом касания.
 * - `tapCount` — все касания плит, одна плита чаще 150 мс — одно.
 */
import { abaAdultPanel } from '../../../design/abaTokens';
import { nextEscalation, promptLadder, promptVisualFor, type PromptVisualPlan } from '../../../domain/abaPrompting';
import type { PanelButton } from '../../../domain/abaScoring';
import type { AbaTrialInput, TrialStep } from '../../../domain/abaSession';
import { MATCH_OBSERVING_MS, type AbaPresentation, type AbaTarget, type PresentationOutcome, type PromptLevel } from '../../../types/aba';

/** Одна плита чаще этого — одно касание (`tapCount`). */
export const SAME_TILE_MS = 150;

type Pres = {
  level: PromptLevel;
  by: 'app' | 'adult';
  startedAt: number;
  endedAt: number;
  windowMs: number;
  outcome: PresentationOutcome | null;
  respondedAt?: number;
  activity?: true;
};

export type MatchTrialRun = {
  step: TrialStep;
  target: Pick<AbaTarget, 'format' | 'sdKind' | 'fieldSize' | 'matchMode'>;
  config: 'with_adult' | 'alone';
  /** `seed` того `nextStep`, что выложил поле: дистрактор L2 тот же при восстановлении. */
  seed: number;
  trialId: string;
  sessionId: string;
  index: number;
  sdEndedAt: number;
  log: Pres[];
  sampleTouchedAt: number | null;
  observingPrompted: boolean;
  taps: { id: string; at: number }[];
  tapCount: number;
  lastChildTapAt: number | null;
  /** «Была подсказка», нажатая в окне `childTapLockMs` после касания ребёнка: применится по снятии окна. */
  pending: { at: number } | null;
  /** Полная модель без ответа и `askAdultForL4`: ждём кнопку взрослого на карточке L4. */
  awaitingL4: boolean;
  chosenCardId: string | null;
  fieldSizeAtResponse: number | null;
  done: boolean;
  /**
   * «Была подсказка» в пробеле наблюдения (образца не коснулись, окно задержки прошло): домен такое предъявление
   * не принимает, а без него пишется ложный самостоятельный ответ. Проба не пишется и предъявляется заново с SD,
   * как свёрнутая (№155; методист 2026-10-31) — до точечной правки домена.
   */
  voided: boolean;
};

export type MatchEvent =
  | { type: 'tap_sample'; at: number }
  | { type: 'tap_option'; id: string; at: number }
  | { type: 'break_card'; at: number }
  | { type: 'adult'; button: PanelButton; at: number }
  | { type: 'due'; at: number };

export function startMatchTrial(input: {
  step: TrialStep;
  target: MatchTrialRun['target'];
  config: 'with_adult' | 'alone';
  seed: number;
  trialId: string;
  sessionId: string;
  index: number;
  /** Кадр с SD показан: без звука это и конец SD. */
  shownAt: number;
}): MatchTrialRun {
  const { step } = input;
  if (!step.field || !step.sampleCardId) throw new Error('проба match без поля или образца');
  if (input.target.matchMode === 'sort') throw new Error('сортировка — не в этапе 11');
  const first: Pres = {
    level: Math.min(step.startPromptLevel, 3) as PromptLevel,
    by: 'app',
    startedAt: input.shownAt,
    endedAt: input.shownAt,
    windowMs: step.promptDelayMs ?? step.responseWindowMs,
    outcome: null,
  };
  return {
    step,
    target: input.target,
    config: input.config,
    seed: input.seed,
    trialId: input.trialId,
    sessionId: input.sessionId,
    index: input.index,
    sdEndedAt: input.shownAt,
    log: [first],
    sampleTouchedAt: null,
    observingPrompted: false,
    taps: [],
    tapCount: 0,
    lastChildTapAt: null,
    pending: null,
    awaitingL4: false,
    chosenCardId: null,
    fieldSizeAtResponse: null,
    done: false,
    voided: false,
  };
}

const current = (r: MatchTrialRun) => r.log[r.log.length - 1];
const lastApp = (r: MatchTrialRun) => [...r.log].reverse().find((p) => p.by === 'app')!;
const appCount = (r: MatchTrialRun) => r.log.filter((p) => p.by === 'app').length;
const withCurrent = (r: MatchTrialRun, p: Partial<Pres>): MatchTrialRun => ({ ...r, log: [...r.log.slice(0, -1), { ...current(r), ...p }] });

/** Что рисовать: подсказка по уровню текущего предъявления приложения. */
export function matchVisual(r: MatchTrialRun): PromptVisualPlan {
  return promptVisualFor(r.target, lastApp(r).level, { correctId: r.step.sampleCardId!, choiceIds: r.step.field!, sampleId: r.step.sampleCardId }, r.seed);
}

/** Активны ли сейчас варианты для касания ребёнка. */
export function optionActive(r: MatchTrialRun, id: string): boolean {
  return !r.done && !r.awaitingL4 && r.sampleTouchedAt !== null && matchVisual(r).activeChoiceIds.includes(id);
}

/** Срок окна текущего предъявления: от касания образца — его окно, без касания — не меньше окна наблюдения. */
function windowEnd(r: MatchTrialRun): number {
  const p = current(r);
  return r.sampleTouchedAt === null ? p.endedAt + Math.max(p.windowMs, MATCH_OBSERVING_MS) : p.endedAt + p.windowMs;
}

const lockEnd = (r: MatchTrialRun) => (r.lastChildTapAt ?? -Infinity) + abaAdultPanel.childTapLockMs;

export function matchDueAt(r: MatchTrialRun): number | null {
  if (r.done || r.awaitingL4) return null;
  const end = windowEnd(r);
  return r.pending ? Math.min(Math.max(lockEnd(r), r.pending.at), end) : end;
}

function tapped(r: MatchTrialRun, id: string, at: number): MatchTrialRun {
  const prev = [...r.taps].reverse().find((t) => t.id === id);
  const counts = !prev || at - prev.at >= SAME_TILE_MS;
  return { ...withCurrent(r, { activity: true }), taps: [...r.taps, { id, at }], tapCount: r.tapCount + (counts ? 1 : 0), lastChildTapAt: at };
}

function close(r: MatchTrialRun, p: Partial<Pres>): MatchTrialRun {
  return { ...withCurrent(r, p), pending: null, awaitingL4: false, done: true };
}

/** Следующее предъявление приложения после `none` / неверного в коррекции, или конец пробы. */
function escalate(r: MatchTrialRun, at: number, outcome: PresentationOutcome): MatchTrialRun {
  const ended = withCurrent(r, { outcome });
  if (!r.step.allowEscalation) return close(r, { outcome });
  // L1 наблюдения уже была и образца так и не коснулись — `no_response` (ABA.md, «Реакция наблюдения»)
  if (r.observingPrompted && r.sampleTouchedAt === null) return close(r, { outcome });
  const app = lastApp(r);
  const next = nextEscalation({ kind: r.step.trialKind }, app.level, appCount(r), promptLadder(r.target));
  if (next.kind === 'close') {
    if (app.level === 3 && r.step.askAdultForL4 && r.config === 'with_adult' && outcome === 'none') {
      return { ...ended, pending: null, awaitingL4: true };
    }
    return close(r, { outcome });
  }
  // L1 наблюдения — только сразу за SD: после «Была подсказка» журнал уже не «SD → L1 приложения»
  const observing = r.sampleTouchedAt === null && r.step.startPromptLevel === 0 && r.log.length === 1;
  return {
    ...ended,
    pending: null,
    observingPrompted: r.observingPrompted || observing,
    log: [...ended.log, { level: next.level, by: 'app', startedAt: at, endedAt: at, windowMs: r.step.responseWindowMs, outcome: null }],
  };
}

/** «Была подсказка»: внутри окна текущего предъявления приложения, на его уровне; вне окна — не принимается. */
function adultPrompt(r: MatchTrialRun, at: number): MatchTrialRun {
  const app = lastApp(r);
  if (at < current(r).startedAt) return { ...r, pending: null };
  if (at > app.endedAt + app.windowMs) return r.sampleTouchedAt === null ? { ...r, pending: null, done: true, voided: true } : { ...r, pending: null };
  const ended = withCurrent(r, { outcome: 'none' });
  return {
    ...ended,
    pending: null,
    log: [...ended.log, { level: app.level, by: 'adult', startedAt: at, endedAt: at, windowMs: r.step.responseWindowMs, outcome: null }],
  };
}

export function stepMatchTrial(r: MatchTrialRun, e: MatchEvent): MatchTrialRun {
  if (r.done) return r;
  switch (e.type) {
    case 'tap_sample': {
      const t = tapped(r, r.step.sampleCardId!, e.at);
      if (r.sampleTouchedAt !== null || r.awaitingL4) return t;
      return { ...withCurrent(t, { endedAt: Math.max(current(t).endedAt, e.at) }), sampleTouchedAt: e.at };
    }
    case 'tap_option': {
      const t = tapped(r, e.id, e.at);
      if (!optionActive(r, e.id)) return t;
      const answered: MatchTrialRun = { ...t, chosenCardId: e.id, fieldSizeAtResponse: matchVisual(r).activeChoiceIds.length };
      const correct = e.id === r.step.sampleCardId;
      const outcome: PresentationOutcome = correct ? 'correct' : 'incorrect';
      if (!correct && r.step.escalateOnIncorrect && current(r).by === 'app') {
        return escalate(withCurrent(answered, { respondedAt: e.at }), e.at, 'incorrect');
      }
      return close(answered, { outcome, respondedAt: e.at });
    }
    case 'break_card':
      return close(r, { outcome: 'child_break', respondedAt: e.at });
    case 'adult': {
      if (e.button === 'refusal') return close(r, { outcome: 'refusal' });
      if (e.button === 'l4_done' || e.button === 'l4_resisted' || e.button === 'l4_skipped') {
        return r.awaitingL4 ? close(r, { outcome: e.button }) : r;
      }
      if (e.button !== 'adult_prompted' || r.awaitingL4) return r;
      if (r.pending) return r; // первая побеждает
      if (e.at < lockEnd(r)) return { ...r, pending: { at: e.at } };
      return adultPrompt(r, e.at);
    }
    case 'due': {
      if (r.pending && e.at >= Math.max(lockEnd(r), r.pending.at) && r.pending.at <= windowEnd(r)) {
        const applied = adultPrompt(r, r.pending.at);
        return e.at >= windowEnd(applied) ? escalate(applied, windowEnd(applied), 'none') : applied;
      }
      if (e.at < windowEnd(r)) return r;
      return escalate(r, windowEnd(r), 'none');
    }
  }
}

const iso = (ms: number) => new Date(ms).toISOString();

/** Запись пробы для `recordTrial`; только у законченной пробы. */
export function matchTrialInput(r: MatchTrialRun): AbaTrialInput {
  if (!r.done || r.voided) throw new Error('проба не закончена или снята');
  const { step } = r;
  const log: AbaPresentation[] = r.log.map((p) => ({
    level: p.level,
    by: p.by,
    startedAt: iso(p.startedAt),
    endedAt: iso(p.endedAt),
    windowMs: p.windowMs,
    outcome: p.outcome ?? 'none',
    ...(p.respondedAt !== undefined && p.outcome !== 'refusal' ? { respondedAt: iso(p.respondedAt) } : {}),
    ...(p.activity ? { activity: true } : {}),
  }));
  return {
    id: r.trialId,
    sessionId: r.sessionId,
    targetId: step.targetId,
    exemplarId: step.exemplarId,
    ...(step.stepId ? { stepId: step.stepId } : {}),
    ...(step.runIndex !== undefined ? { runIndex: step.runIndex } : {}),
    ...(step.sdVariantKey ? { sdVariantKey: step.sdVariantKey } : {}),
    ...(step.closes ? { closes: step.closes } : {}),
    field: step.field,
    sampleCardId: step.sampleCardId,
    ...(r.chosenCardId !== null ? { chosenCardId: r.chosenCardId, fieldSizeAtResponse: r.fieldSizeAtResponse! } : {}),
    tapCount: r.tapCount,
    index: r.index,
    kind: step.trialKind,
    startPromptLevel: step.startPromptLevel,
    presentationLog: log,
    promptDelayMs: step.promptDelayMs,
    responseWindowMs: step.responseWindowMs,
    sdEndedAt: iso(r.sdEndedAt),
    scoredBy: step.scoredBy,
    ...(r.observingPrompted ? { observingPrompted: true as const } : {}),
    observingLatencyMs: r.sampleTouchedAt === null ? null : r.sampleTouchedAt - r.sdEndedAt,
  };
}
