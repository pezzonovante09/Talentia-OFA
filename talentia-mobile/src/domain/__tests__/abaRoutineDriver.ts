/**
 * Драйвер прогона рутины для тестов исправления звена и фиксации (раунд 4, Д2, Д3, В7): цель-рутина
 * из трёх звеньев, детерминированные журналы предъявлений и моменты записи (минута на пробу от
 * старта прогона) — без реальных часов.
 */
import type { AbaObserver, AbaPresentation, AbaTarget, AbaTargetState, AbaTrial, PresentationOutcome, PromptLevel } from '../../types/aba';
import { initialTargetState } from '../abaPrompting';
import { nextRoutineStep, recordRoutineStep, startRoutineRun, type RoutineRunInput, type RoutineRunState } from '../abaRoutineRun';
import { initialTokenTraining, type TokenTrainingState } from '../abaTokenTraining';
import type { AbaTrialInput, TrialStep } from '../abaTrialStep';

/** Ступень 5 — сохранённая запись старого формата: доска 3 на всех полосах, 5 работает как 3. */
export const ROUTINE_TRAINED: TokenTrainingState = { ...initialTokenTraining(), pairingDone: true, stage: 5 };
export const ROUTINE_POOL = ['puzzle', 'bubbles', 'drum', 'paint_drop', 'kaleidoscope', 'pinwheel'];
export const ROUTINE_SPEC: AbaObserver = { id: 'obs-spec', role: 'specialist', trained: true };

export const RT: AbaTarget = {
  id: 'R',
  programId: 'p-self',
  format: 'do_action',
  band: '7',
  level: 'cross',
  area: 'self_care',
  sdKind: 'instruction',
  sdKey: 'sd.R',
  chaining: 'total_task',
  steps: ['1', '2', '3'].map((n, i) => ({
    id: `R-s${n}`,
    order: i + 1,
    sdKey: `sd.R.${n}`,
    criterionKey: `c.R.${n}`,
    modelKey: `m.R.${n}`,
    image: `img-R-${n}`,
  })),
  exemplars: [{ id: 'R-e', role: 'teaching', targetKey: 'k', modelKey: 'm', partialModelKeys: [] }],
  delayMs: 3000,
  delayMode: 'constant',
  blockSize: 5,
  scoredBy: 'adult',
};

/** День `n` октября 2026, локальный. */
export const rday = (n: number) => `2026-10-${String(n).padStart(2, '0')}`;

/** Рутина в обучении со стартом звеньев с L0. */
export const racq = (over: Partial<AbaTargetState> = {}): AbaTargetState => ({
  ...initialTargetState(RT),
  phase: 'acquisition',
  startPromptLevel: 0,
  lastSuccessfulPromptLevel: 0,
  ...over,
});

export function rstart(state: AbaTargetState | undefined, d: string, over: Partial<RoutineRunInput> = {}): RoutineRunState {
  return startRoutineRun({
    runId: `run-${d.replace(/-/g, "x")}`,
    day: d,
    target: RT,
    state,
    band: '7',
    tokenTraining: ROUTINE_TRAINED,
    reinforcerPool: ROUTINE_POOL,
    observers: [ROUTINE_SPEC],
    primaryObserverId: ROUTINE_SPEC.id,
    startedAt: Date.parse(`${d}T08:00:00Z`),
    seed: 7,
    ...over,
  });
}

/** Момент записи звена: минута на пробу от старта прогона. */
export const rnow = (run: RoutineRunState) => run.startedAt + (run.trials.length + 1) * 60_000;

/** `ok` — верно на стартовом уровне; `break` — детская карточка «перерыв»; `refuse` — «Отказ». */
export type RHow = 'ok' | 'break' | 'refuse';

let seq = 0;

export function rinput(run: RoutineRunState, how: RHow = 'ok'): AbaTrialInput {
  const step = nextRoutineStep(run);
  if (step.kind !== 'trial') throw new Error(`ждали звено, а шаг ${step.kind}`);
  const ts: TrialStep = step;
  const t0 = rnow(run) - 5000;
  const outcome: PresentationOutcome = how === 'ok' ? 'correct' : how === 'break' ? 'child_break' : 'refusal';
  const log: AbaPresentation[] = [
    {
      level: ts.startPromptLevel as PromptLevel,
      by: 'app',
      startedAt: new Date(t0).toISOString(),
      endedAt: new Date(t0 + 1000).toISOString(),
      windowMs: ts.promptDelayMs ?? ts.responseWindowMs,
      outcome,
      ...(how !== 'refuse' ? { respondedAt: new Date(t0 + 1500).toISOString() } : {}),
    },
  ];
  seq += 1;
  return {
    id: `rt-${seq}`,
    sessionId: run.runId,
    targetId: ts.targetId,
    exemplarId: ts.exemplarId,
    ...(ts.stepId ? { stepId: ts.stepId } : {}),
    ...(ts.runIndex !== undefined ? { runIndex: ts.runIndex } : {}),
    index: run.trials.length,
    kind: ts.trialKind,
    startPromptLevel: ts.startPromptLevel,
    presentationLog: log,
    promptDelayMs: ts.promptDelayMs,
    responseWindowMs: ts.responseWindowMs,
    sdEndedAt: new Date(t0 + 1000).toISOString(),
    scoredBy: ts.scoredBy,
  };
}

/** Записать звено: прогон до, вход, проба, прогон после, момент записи. */
export function rstep(before: RoutineRunState, how: RHow = 'ok') {
  const input = rinput(before, how);
  const at = rnow(before);
  const res = recordRoutineStep(before, input, at);
  if (!res.ok) throw new Error(res.errors.join('; '));
  return { before, input, trial: res.trial as AbaTrial, run: res.run, at };
}

export const rplay = (run: RoutineRunState, hows: RHow[]) => hows.reduce((r, h) => rstep(r, h).run, run);
