/**
 * Сводки специалисту в файле выгрузки (Ж12, ABA.md «Данные» :564–567 и «Решения методиста после проверки D1 и D2»
 * :881–884): считаются при экспорте функциями домена (`summarizeSession`, `fadeClass`, `criterionGaps`,
 * `generalizationPasses`), своих данных не несут. Проверяется:
 * - счёт на сессию × цель совпадает с доменом: зачёт, доля, исход; популяция затухания — обучение и перенос без
 *   прерванных и без подсказки взрослого вне процедуры; исходные пробы исправленных отметок исключены;
 * - медиана латентности L0 — только самостоятельные ответы обучения; исходы переноса делят пробы без остатка;
 * - на цель: отсечки смены фазы из событий `phase`, объединённая доля с последнего входа в обучение, состояние;
 * - цепочка считается прогонами и по звеньям, рутина — только в `byTarget`, удалённая из каталога цель — `catalogMissing`;
 * - приватность: метки сессий те же, что в `abaSessions`, в сводках нет времени суток и абсолютных миллисекунд.
 */
import { CURRENT_CONSENT_TEXTS } from '../../../domain/consentTexts';
import { initialTargetState } from '../../../domain/abaPrompting';
import type { AbaSessionResult, AbaSessionState } from '../../../domain/abaSession';
import { initialTokenTraining, type TokenTrainingState } from '../../../domain/abaTokenTraining';
import type { ConsentEvent } from '../../../domain/consent';
import { ABA_TARGETS } from '../../../content/aba';
import { MASTERY, type AbaSession, type AbaTarget, type AbaTargetState, type AbaTrial } from '../../../types/aba';
import { abaIdGuard, appendTrialCorrection } from '../abaLog';
import { saveChildState } from '../childState';
import { commitAbaSession, recordAbaTrial } from '../commit';
import { appendConsentEvent } from '../consentLog';
import { exportForSpecialist, specialistSummaries } from '../purge';
import { asAbaWriter, memoryDb } from './nodeSql';

const NOW = '2026-10-12T10:00:00Z';
const TARGET = ABA_TARGETS.find((t) => t.id === 'match-same-2')!;
/** uuid v7 — читается время: в файле становится меткой `A1` (раунд 3, В11). */
const SESSION_ID = '01929c7a-1234-7abc-8def-0123456789ab';
const START = '2026-10-11T07:31:15.000Z';
const at = (ms: number) => new Date(Date.parse(START) + ms).toISOString();
const TRAINED: TokenTrainingState = { ...initialTokenTraining(), pairingDone: true, stage: 5 };

const grant = (childId: string): ConsentEvent => ({
  id: `aba-grant-${childId}`,
  scope: 'aba_processing',
  action: 'grant',
  childId,
  textVersion: CURRENT_CONSENT_TEXTS.aba_processing[0],
  confirmedBy: 'biometric',
  actorId: 'parent',
  at: '2026-10-11T06:00:00Z',
});

const base: AbaTrial = {
  id: 'tr-0',
  sessionId: SESSION_ID,
  targetId: TARGET.id,
  exemplarId: 'e1',
  index: 0,
  kind: 'teaching',
  startPromptLevel: 0,
  promptLevelUsed: 0,
  presentations: 1,
  response: 'independent',
  emittedBeforePrompt: true,
  latencyMs: 700,
  latencyFromFirstSdMs: 700,
  latencySource: 'adult_press',
  promptDelayMs: 3000,
  responseWindowMs: 10_000,
  presentationLog: [],
  sdEndedAt: at(5000),
  scoredBy: 'adult',
  tokens: 1,
};
/** Проба по инвариантам домена (`trialInvariantErrors`): время от первого SD по умолчанию равно латентности. */
const tr = (id: string, over: Partial<AbaTrial>): AbaTrial => {
  const t: AbaTrial = { ...base, id, ...over };
  if (!('latencyFromFirstSdMs' in over)) t.latencyFromFirstSdMs = t.latencyMs;
  return t;
};

/** Пробы одной сессии: 4 самостоятельных L0, «дождался», ошибка, коррекция, три переноса, прерванная, подсказка вне процедуры. */
const TRIALS: AbaTrial[] = [
  tr('tr-1', { latencyMs: 700 }),
  tr('tr-2', { latencyMs: 900, scoredBy: 'device_tap', latencySource: 'device_tap' }),
  tr('tr-3', { latencyMs: 1100, exemplarId: 'e2' }),
  tr('tr-4', { latencyMs: 500 }),
  tr('tr-5', { response: 'prompted', promptLevelUsed: 1, emittedBeforePrompt: false, latencyMs: 2000, latencyFromFirstSdMs: 5000, tokens: 0 }),
  tr('tr-6', { response: 'incorrect', emittedBeforePrompt: true, latencyMs: 400, promptDelayMs: 4000, tokens: 0 }),
  tr('tr-7', { kind: 'correction', response: 'prompted', startPromptLevel: 1, promptLevelUsed: 1, emittedBeforePrompt: false, promptDelayMs: null, tokens: 0 }),
  tr('tr-8', { kind: 'transfer', latencyMs: 800 }),
  tr('tr-9', { kind: 'transfer', response: 'prompted', promptLevelUsed: 3, emittedBeforePrompt: false, latencyFromFirstSdMs: 4000, tokens: 0 }),
  tr('tr-10', { kind: 'transfer', response: 'no_response', promptLevelUsed: 4, emittedBeforePrompt: false, latencyMs: null, latencySource: null, tokens: 0 }),
  tr('tr-11', { response: 'interrupted', latencyMs: null, latencySource: null, tokens: 0, interruptedBy: 'child_break' }),
  tr('tr-12', { response: 'prompted', promptLevelUsed: 1, emittedBeforePrompt: false, adultUnplannedPrompt: true, tokens: 0 }),
  // исправленная отметка: исходная «неверно» и замена «сам» — считается только замена
  tr('tr-orig', { response: 'incorrect', emittedBeforePrompt: true, latencyMs: 300, tokens: 0 }),
  tr('tr-orig~c1', { latencyMs: 650, promptDelayMs: 3500 }),
];
const CORRECTED = new Set(['tr-orig']);

const SESSION: AbaSession = {
  id: SESSION_ID,
  index: 3,
  day: '2026-10-11',
  startedAt: START,
  endedAt: at(600_000),
  config: 'with_adult',
  targetIds: [TARGET.id],
  reinforcerId: 'puzzle',
  reinforcerChosenBy: 'child',
  tokensEarned: 5,
  exchangesMade: 1,
  endReason: 'completed',
  brokenTargetId: null,
  boardSize: 5,
  endedOnSuccess: true,
  events: [
    { kind: 'phase', at: at(1000), targetId: TARGET.id, from: 'baseline', to: 'acquisition', reason: 'baseline' },
    { kind: 'exchange', at: at(500_000), tokens: 5 },
  ],
  primaryObserverId: null,
};

const TARGET_STATE = {
  ...initialTargetState(TARGET),
  phase: 'acquisition' as const,
  sessionsAtCriterion: 1,
  criterionDays: ['2026-10-11'],
  criterionSessions: [{ sessionIndex: 3, verified: true }],
  recentIndependentRates: [0.625],
  generalizationProbes: [{ response: 'independent' as const, exemplarId: 'g1', sdVariantKey: 'adult_f' }],
};

describe('specialistSummaries: сессия × цель', () => {
  const out = specialistSummaries({ sessions: [SESSION], trials: TRIALS, correctedTrialIds: CORRECTED, targetStates: { [TARGET.id]: TARGET_STATE } });
  const [s] = out.bySession;

  it('одна строка на пару сессия × цель; критерий — весь MASTERY', () => {
    expect(out.bySession).toHaveLength(1);
    expect(out.criterion).toEqual(MASTERY);
    expect(s).toMatchObject({ sessionId: SESSION_ID, sessionIndex: 3, day: '2026-10-11', targetId: TARGET.id, endReason: 'completed', incomplete: false, unit: 'trials' });
    expect(s.catalogMissing).toBeUndefined();
  });

  it('зачёт критерия как в домене: 8 проб (обучение, не прерванные, источник с правом; исходная исправленной — нет), 5 самостоятельных, серия рвётся', () => {
    expect([s.trials, s.independentRate, s.outcome, s.counted]).toEqual([8, 0.625, 'breaks', true]);
  });

  it('популяция затухания — обучение и перенос без прерванных и без подсказки вне процедуры: 10 проб, уровни и классы', () => {
    expect(s.fadeTrials).toBe(10);
    expect(s.byStartLevel).toEqual({ 0: 10, 1: 0, 2: 0, 3: 0, 4: 0 });
    expect(s.byUsedLevel).toEqual({ 0: 7, 1: 1, 2: 0, 3: 1, 4: 1 });
    expect(s.fade).toEqual({ at_start: 6, waited: 1, above: 3, approximation: 0 });
  });

  it('медиана латентности L0 — только самостоятельные ответы обучения: 5 проб, медиана 700, источники', () => {
    expect(s.l0Latency).toEqual({ medianMs: 700, n: 5, bySource: { adult_press: 4, device_tap: 1 } });
  });

  it('исходы переноса делят пробы переноса без остатка: сам 1, дождался 0, подсказан 1 (выше старта 1), провал 1', () => {
    expect(s.transfer).toEqual({ independent: 1, waited: 0, prompted: 1, promptedAbove: 1, failed: 1, approximation: 0, interrupted: 0, adultUnplanned: 0 });
    const t = s.transfer;
    expect(t.independent + t.waited + t.prompted + t.failed + t.approximation).toBe(TRIALS.filter((x) => x.kind === 'transfer').length);
  });

  it('по виду и по источнику оценки — все не прерванные пробы; коррекции, подсказки вне процедуры и прерванные — отдельно', () => {
    expect(s.byKind).toEqual({ teaching: { trials: 8, independent: 5 }, correction: { trials: 1, independent: 0 }, transfer: { trials: 3, independent: 1 } });
    expect(s.byScoredBy).toEqual({ adult: 11, device_tap: 1 });
    expect([s.corrections, s.adultUnplannedPrompts, s.interrupted]).toEqual([1, 1, 1]);
  });

  it('задержка до подсказки — история по пробам со старта L0; попытка до подсказки — доля среди несамостоятельных проб затухания', () => {
    expect(s.promptDelayMs).toEqual({ min: 3000, max: 4000, last: 3500 });
    expect(s.emittedBeforePromptRate).toBe(0.25);
  });

  it('исправленная отметка: исходная проба не считается нигде — без неё медиана и зачёт другие', () => {
    const raw = specialistSummaries({ sessions: [SESSION], trials: TRIALS, correctedTrialIds: new Set(), targetStates: {} }).bySession[0];
    expect([raw.trials, raw.independentRate, raw.fadeTrials, raw.fade.above]).toEqual([9, 5 / 9, 11, 4]);
  });
});

describe('specialistSummaries: цель', () => {
  const out = specialistSummaries({ sessions: [SESSION], trials: TRIALS, correctedTrialIds: CORRECTED, targetStates: { [TARGET.id]: TARGET_STATE } });
  const [t] = out.byTarget;

  it('отсечки смены фазы — из событий phase записей сессий, с номером сессии и днём', () => {
    expect(t.phaseChanges).toEqual([{ sessionIndex: 3, day: '2026-10-11', from: 'baseline', to: 'acquisition', reason: 'baseline' }]);
  });

  it('объединённая доля — по зачётным пробам с последнего входа в обучение', () => {
    expect([t.sessions, t.pooledIndependentRate, t.pooledFromSessionIndex]).toEqual([1, 0.625, 3]);
  });

  it('состояние: фаза, пробелы критерия домена, серия, подтверждённые сессии, дни, зачётные переносы, флаги, уровень и задержка', () => {
    expect(t.state).toEqual({
      phase: 'acquisition',
      criterionGaps: ['sessions', 'distinct_days', 'exemplars', 'generalization'],
      sessionsAtCriterion: 1,
      verifiedCriterionSessions: 1,
      criterionDays: 1,
      generalizationPasses: 1,
      recentIndependentRates: [0.625],
      flags: [],
      startPromptLevel: TARGET_STATE.startPromptLevel,
      currentDelayMs: TARGET_STATE.currentDelayMs,
      lastSuccessfulPromptLevel: TARGET_STATE.lastSuccessfulPromptLevel,
      maintenanceFailsInRow: 0,
    });
  });

  it('распределения на цель — по всем её пробам файла', () => {
    expect([t.fadeTrials, t.fade, t.l0Latency?.medianMs]).toEqual([10, { at_start: 6, waited: 1, above: 3, approximation: 0 }, 700]);
  });

  it('цель есть в состоянии, но проб нет — строка с нулями и состоянием; состояния нет — state null', () => {
    const r = specialistSummaries({ sessions: [], trials: [], correctedTrialIds: new Set(), targetStates: { [TARGET.id]: TARGET_STATE } });
    expect(r.byTarget[0]).toMatchObject({ targetId: TARGET.id, sessions: 0, pooledIndependentRate: null, fadeTrials: 0, l0Latency: null, promptDelayMs: null, emittedBeforePromptRate: null });
    expect(r.byTarget[0].state?.phase).toBe('acquisition');
    const noState = specialistSummaries({ sessions: [SESSION], trials: TRIALS, correctedTrialIds: CORRECTED, targetStates: {} });
    expect(noState.byTarget[0].state).toBeNull();
  });

  it('неполное состояние (старая запись без списков критерия) не роняет выгрузку: пробелы критерия и зачётные переносы — null', () => {
    const partial = { targetId: TARGET.id, phase: 'mastered' } as AbaTargetState;
    const r = specialistSummaries({ sessions: [], trials: [], correctedTrialIds: new Set(), targetStates: { [TARGET.id]: partial } });
    expect(r.byTarget[0].state).toMatchObject({ phase: 'mastered', criterionGaps: null, generalizationPasses: null, criterionDays: 0, flags: [], startPromptLevel: null });
  });

  it('после повторного входа в обучение объединённая доля считается с той сессии', () => {
    const again: AbaSession = { ...SESSION, id: 's-again', index: 9, day: '2026-10-20', events: [{ kind: 'phase', at: at(1000), targetId: TARGET.id, from: 'maintenance', to: 'acquisition', reason: 'maintenance_failed' }] };
    const later = TRIALS.slice(0, 6).map((x) => ({ ...x, id: `${x.id}-b`, sessionId: 's-again' }));
    const r = specialistSummaries({ sessions: [SESSION, again], trials: [...TRIALS, ...later], correctedTrialIds: CORRECTED, targetStates: {} });
    expect(r.bySession.map((x) => x.sessionIndex)).toEqual([3, 9]);
    // в сессии 9 — 6 зачётных, 4 самостоятельных
    expect(r.byTarget[0]).toMatchObject({ sessions: 2, pooledIndependentRate: 4 / 6, pooledFromSessionIndex: 9 });
    expect(r.byTarget[0].phaseChanges.map((p) => p.sessionIndex)).toEqual([3, 9]);
  });
});

describe('specialistSummaries: цепочка, рутина, удалённая цель', () => {
  const steps = [
    { id: 's1', order: 1, sdKey: 'a' },
    { id: 's2', order: 2, sdKey: 'b' },
  ];
  const chain = { ...TARGET, id: 'chain-1', area: 'motor_imitation', steps } as AbaTarget;
  const routine = { ...TARGET, id: 'routine-1', area: 'self_care', steps } as AbaTarget;
  const catalog = [TARGET, chain, routine];
  const step = (id: string, targetId: string, runIndex: number, stepId: string, over: Partial<AbaTrial> = {}) =>
    tr(id, { targetId, runIndex, stepId, exemplarId: 'r', ...over });
  const chainTrials = [
    step('c-1', 'chain-1', 0, 's1'),
    step('c-2', 'chain-1', 0, 's2'),
    step('c-3', 'chain-1', 1, 's1'),
    step('c-4', 'chain-1', 1, 's2', { response: 'prompted', promptLevelUsed: 2, emittedBeforePrompt: false }),
  ];
  const routineTrials = [step('r-1', 'routine-1', 0, 's1', { sessionId: 'run-1' }), step('r-2', 'routine-1', 0, 's2', { sessionId: 'run-1', response: 'prompted', promptLevelUsed: 1, emittedBeforePrompt: false })];
  const missingTrials = [tr('m-1', { targetId: 'gone' }), tr('m-2', { targetId: 'gone', response: 'incorrect' })];
  const session = { ...SESSION, targetIds: [TARGET.id, 'chain-1', 'gone'], events: [] };
  const out = specialistSummaries({ sessions: [session], trials: [...chainTrials, ...routineTrials, ...missingTrials], correctedTrialIds: new Set(), targetStates: {}, catalog });

  it('цепочка: единица — прогоны, зачёт домена (2 прогона, 1 целиком сам, мало для зачёта), по звеньям — пробы и уровни', () => {
    const c = out.bySession.find((x) => x.targetId === 'chain-1')!;
    expect(c).toMatchObject({ unit: 'runs', trials: 2, independentRate: 0.5, outcome: 'breaks', counted: false, fadeTrials: 4 });
    expect(c.byStep).toEqual({
      s1: { trials: 2, independentRate: 1, byUsedLevel: { 0: 2, 1: 0, 2: 0, 3: 0, 4: 0 } },
      s2: { trials: 2, independentRate: 0.5, byUsedLevel: { 0: 1, 1: 0, 2: 1, 3: 0, 4: 0 } },
    });
  });

  it('рутина: не в bySession (её прогоны — не сессии); в byTarget — распределения и состояние без критерия', () => {
    expect(out.bySession.some((x) => x.targetId === 'routine-1')).toBe(false);
    const r = out.byTarget.find((x) => x.targetId === 'routine-1')!;
    expect(r).toMatchObject({ routine: true, sessions: 1, pooledIndependentRate: null, fadeTrials: 2, state: null });
    expect(r.byStep?.s2).toMatchObject({ trials: 1, independentRate: 0 });
  });

  it('цели нет в каталоге: catalogMissing, счёт критерия недоступен (null), распределения на месте', () => {
    const m = out.bySession.find((x) => x.targetId === 'gone')!;
    expect(m).toMatchObject({ catalogMissing: true, unit: null, trials: null, independentRate: null, outcome: null, counted: null, fadeTrials: 2 });
    expect(m.fade).toEqual({ at_start: 1, waited: 0, above: 1, approximation: 0 });
    expect(out.byTarget.find((x) => x.targetId === 'gone')).toMatchObject({ catalogMissing: true, pooledIndependentRate: null });
  });

  it('цель сессии без проб в ней строки не получает', () => {
    expect(out.bySession.map((x) => x.targetId).sort()).toEqual(['chain-1', 'gone']);
  });
});

describe('exportForSpecialist: сводки в файле', () => {
  async function exported() {
    const db = await memoryDb();
    await appendConsentEvent(db, grant('kid'), 'owner');
    await asAbaWriter(db, 'kid', async (tx) => {
      await saveChildState(tx, 'kid', 'tokenTraining', TRAINED, NOW);
      await saveChildState(tx, 'kid', 'abaTargets', { [TARGET.id]: TARGET_STATE }, NOW);
    });
    // id сессии читает время — гард записи такие не пускает (`newAbaId`); здесь он отключён нарочно: проверяется замена на метку
    abaIdGuard.enabled = false;
    const snap = { sessionId: SESSION_ID, board: { size: 5, earned: 0, nonContingent: 0 }, boardRev: 0, observers: [], primaryObserverId: null } as unknown as AbaSessionState;
    for (const t of TRIALS) await recordAbaTrial(db, 'kid', t, snap, NOW);
    await asAbaWriter(db, 'kid', (tx) =>
      appendTrialCorrection(tx, 'kid', { trialId: 'tr-orig', replacementId: 'tr-orig~c1', sessionId: SESSION_ID, msSinceOriginal: 4000, fromResponse: 'incorrect', toResponse: 'independent', tokenKept: 0, tokenAdded: 1 }, NOW),
    );
    const result = { session: SESSION, states: {}, trials: [], board: { size: 5, earned: 0, nonContingent: 0 }, boardRev: 0, exchanged: 1, tokenTraining: TRAINED, identifySets: [] } as unknown as AbaSessionResult;
    try {
      await commitAbaSession(db, 'kid', result, NOW);
    } finally {
      abaIdGuard.enabled = true;
    }
    return exportForSpecialist(db, 'kid', '2026-10-12T13:37:00.000Z');
  }

  it('сводки на месте и совпадают с чистым счётом по тем же пробам; исходная исправленной пробы исключена по журналу исправлений', async () => {
    const out = await exported();
    expect(out.summaries.criterion).toEqual(MASTERY);
    expect(out.summaries.bySession).toHaveLength(1);
    expect(out.summaries.bySession[0]).toMatchObject({ sessionIndex: 3, day: '2026-10-11', trials: 8, independentRate: 0.625, outcome: 'breaks', fadeTrials: 10 });
    expect(out.summaries.bySession[0].l0Latency).toEqual({ medianMs: 700, n: 5, bySource: { adult_press: 4, device_tap: 1 } });
    expect(out.summaries.byTarget[0]).toMatchObject({ targetId: TARGET.id, pooledIndependentRate: 0.625, phaseChanges: [expect.objectContaining({ sessionIndex: 3, to: 'acquisition' })] });
    expect(out.summaries.byTarget[0].state?.criterionGaps).toEqual(['sessions', 'distinct_days', 'exemplars', 'generalization']);
  });

  it('метка сессии в сводках — та же, что у записи сессии (id, читающий время, заменён на A1 везде)', async () => {
    const out = await exported();
    const [session] = out.abaSessions as { id: string }[];
    expect(session.id).toBe('A1');
    expect(out.summaries.bySession[0].sessionId).toBe('A1');
    expect(JSON.stringify(out)).not.toContain(SESSION_ID);
  });

  it('в сводках нет времени суток, ISO-дат со временем, абсолютных миллисекунд и uuid', async () => {
    const json = JSON.stringify((await exported()).summaries);
    expect(json).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}|\d{2}:\d{2}/);
    expect(json).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    const numbers = (v: unknown): number[] => (typeof v === 'number' ? [v] : Array.isArray(v) ? v.flatMap(numbers) : v && typeof v === 'object' ? Object.values(v).flatMap(numbers) : []);
    expect(numbers((await exported()).summaries).filter((n) => Math.abs(n) > 1e6)).toEqual([]);
  });

  it('в сводках нет полей с именами, childId и id наблюдателей — только явные поля', async () => {
    const out = await exported();
    const keys = new Set<string>();
    const walk = (v: unknown) => {
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') {
        for (const [k, x] of Object.entries(v)) {
          keys.add(k);
          walk(x);
        }
      }
    };
    walk(out.summaries);
    expect([...keys].filter((k) => /name|child|observer|deviceId|account/i.test(k))).toEqual([]);
    expect(JSON.stringify(out.summaries)).not.toContain('kid');
  });
});
