/**
 * Выдуманная выгрузка специалисту для тестов отчёта и образца `docs/aba-center/specialist-report-generated-sample.html`:
 * шесть занятий «Со взрослым» 3–14 ноября 2026, «Одинаковые из двух» от базовой линии до освоения, «По форме» —
 * в обучении с сигналом. Сводки считает настоящая `specialistSummaries` из проб и записей сессий; записи
 * `abaSessions` / `abaTrials` — в том виде, в каком их пишет `exportForSpecialist` (дни, длительность, смещения
 * в мс, метка наблюдателя `O1`). Идентификаторы записей — UUIDv4 (в файле не заменяются): отчёт не должен их показывать.
 *
 * Журнал «Для специалиста» согласован с записями: до первого занятия — одна цель в обучении (занятия до 12.11 учат
 * только «Одинаковые из двух»), 7.11 — длительность 10 минут (все занятия короче), 10.11 — наблюдатель-родитель
 * обучен (в состоянии `trained: true`), 12.11 — снова по умолчанию две цели (в этот день начинается «По форме»).
 * Окно ответа не менялось: у проб `responseWindowMs` 10 000 мс с начала. Текущие параметры — только длительность.
 */
import { ABA_TARGETS } from '../content/aba';
import { initialTargetState } from '../domain/abaPrompting';
import { specialistSummaries, type SpecialistExport } from '../services/local/purge';
import type { AbaSession, AbaSessionEvent, AbaTargetState, AbaTrial, PromptLevel } from '../types/aba';

const target = (id: string) => ABA_TARGETS.find((t) => t.id === id)!;
const SAME2 = 'match-same-2';
const SHAPE = 'match-shape';

/** UUIDv4 записи: последние 12 знаков — номер. */
export const fixtureId = (n: number) => `6f1c2a7e-3b4d-4e5f-9a0b-${String(n).padStart(12, '0')}`;
/** Наблюдатель на устройстве — до замены меткой `O1`. */
export const FIXTURE_OBSERVER = '7d3e9c1a-0b2f-4c6d-8e9f-a1b2c3d4e5f6';

type TrialSpec = { kind?: AbaTrial['kind']; target?: string; start?: PromptLevel; used?: PromptLevel; response?: AbaTrial['response']; latency?: number | null; delay?: number | null; observing?: number | null; exemplar?: string };

let trialSeq = 0;
function trialsOf(sessionId: string, specs: TrialSpec[]): AbaTrial[] {
  return specs.map((s, i) => {
    const response = s.response ?? 'independent';
    const start = s.start ?? 0;
    const latency = s.latency === undefined ? (response === 'independent' ? 1000 : 3500) : s.latency;
    return {
      id: fixtureId(100 + ++trialSeq),
      sessionId,
      targetId: s.target ?? SAME2,
      exemplarId: s.exemplar ?? 'e1',
      index: i,
      kind: s.kind ?? 'teaching',
      startPromptLevel: start,
      promptLevelUsed: s.used ?? (response === 'independent' ? start : start === 0 ? 1 : start),
      presentations: 1,
      response,
      emittedBeforePrompt: response !== 'prompted',
      latencyMs: latency,
      latencyFromFirstSdMs: latency,
      latencySource: 'adult_press',
      promptDelayMs: s.delay === undefined ? (start === 0 ? 2000 : null) : s.delay,
      responseWindowMs: 10_000,
      presentationLog: [],
      sdEndedAt: '2026-11-03T10:00:00.000Z',
      scoredBy: 'adult',
      ...(s.observing !== undefined ? { observingLatencyMs: s.observing } : {}),
      tokens: response === 'independent' ? 1 : 0,
    } as AbaTrial;
  });
}

const rep = <T>(n: number, x: T): T[] => Array.from({ length: n }, () => x);

/** Журнал «Для специалиста» в виде файла (`exportForSpecialist`): день, роль со слов, поле, было → стало. */
export const FIXTURE_CHANGES = [
  { order: 1, day: '2026-11-01', role: 'specialist', claimed: true, field: 'maxTeachingTargets', from: null, to: 1 },
  { order: 2, day: '2026-11-07', role: 'specialist', claimed: true, field: 'timeLimitMs', from: null, to: 600_000 },
  { order: 3, day: '2026-11-10', role: 'specialist', claimed: true, field: 'observerTrained', from: false, to: true, observerRole: 'parent' },
  { order: 4, day: '2026-11-12', role: 'specialist', claimed: true, field: 'maxTeachingTargets', from: 1, to: null },
];

type SessionSpec = { day: string; minutes: number; trials: TrialSpec[]; events?: AbaSessionEvent[]; targets?: string[]; endReason?: AbaSession['endReason'] };

const SESSIONS: SessionSpec[] = [
  {
    day: '2026-11-03',
    minutes: 5,
    trials: [...rep(3, { kind: 'baseline', observing: 2600 } as TrialSpec), ...rep(2, { kind: 'baseline', response: 'incorrect', observing: 2600 } as TrialSpec)],
    events: [{ kind: 'phase', at: '', targetId: SAME2, from: 'baseline', to: 'acquisition', reason: 'baseline' }],
  },
  {
    day: '2026-11-05',
    minutes: 7,
    trials: [
      { start: 3, used: 3, response: 'prompted', observing: 2400 },
      { start: 3, used: 3, response: 'prompted', observing: 2400 },
      { start: 1, used: 1, response: 'prompted', observing: 2400 },
      { start: 1, used: 1, response: 'prompted', observing: 2400 },
      { start: 0, observing: 2400, latency: 900, delay: 1000 },
    ],
  },
  {
    day: '2026-11-07',
    minutes: 8,
    trials: [{ start: 0, delay: 1000, latency: 800, observing: 2000 }, { start: 0, delay: 1000, latency: 800, observing: 2000 }, { start: 0, delay: 1000, latency: 800 }, { start: 0, response: 'prompted', delay: 1000 }, { start: 0, response: 'prompted', delay: 1000 }],
    // перерыв по карточке пишет и `assent` от карточки — в «Отказ» взрослого он не идёт
    events: [
      { kind: 'assent', at: '', by: 'child_card', action: 'break', between: true, targetId: SAME2 },
      { kind: 'break', startedAt: '', endedAt: '', initiatedBy: 'child_card', cardTaken: true, between: true },
    ],
  },
  {
    day: '2026-11-10',
    minutes: 8,
    trials: [
      ...rep(4, { start: 0, delay: 2000, latency: 1300, observing: 1600 } as TrialSpec),
      { start: 0, response: 'incorrect', delay: 2000 },
      { kind: 'correction', start: 1, used: 1, response: 'prompted', delay: null },
      { kind: 'generalization', exemplar: 'e7', latency: 1200 },
    ],
    events: [{ kind: 'assent', at: '', by: 'adult_observed', action: 'break', targetId: SAME2 }],
  },
  {
    day: '2026-11-12',
    minutes: 7,
    trials: [
      ...rep(5, { start: 0, delay: 2000, latency: 1100, observing: 1500 } as TrialSpec),
      { kind: 'generalization', exemplar: 'e8', response: 'incorrect' },
      { target: SHAPE, kind: 'teaching', start: 3, used: 3, response: 'prompted' },
      { target: SHAPE, kind: 'teaching', start: 3, used: 3, response: 'prompted' },
      { target: SHAPE, kind: 'teaching', start: 1, used: 1, response: 'prompted' },
      { target: SHAPE, kind: 'teaching', start: 1, used: 1, response: 'prompted' },
      { target: SHAPE, kind: 'teaching', start: 0, delay: 1000 },
    ],
    targets: [SAME2, SHAPE],
  },
  {
    day: '2026-11-14',
    minutes: 7,
    trials: [
      ...rep(4, { start: 0, delay: 3000, latency: 1000, observing: 1300 } as TrialSpec),
      { start: 0, response: 'prompted', delay: 3000 },
      { kind: 'generalization', exemplar: 'e8', latency: 1100 },
      { target: SHAPE, start: 1, used: 1, response: 'prompted' },
      { target: SHAPE, start: 0, delay: 1000 },
      { target: SHAPE, start: 0, delay: 1000 },
      { target: SHAPE, start: 0, delay: 1000, response: 'incorrect' },
      { target: SHAPE, start: 0, delay: 1000 },
    ],
    targets: [SAME2, SHAPE],
    events: [{ kind: 'phase', at: '', targetId: SAME2, from: 'acquisition', to: 'mastered', reason: 'criterion' }],
  },
];

/** Выгрузка целиком; `over` — правки для отдельных тестов. */
export function fabricatedExport(): SpecialistExport {
  trialSeq = 0;
  const sessions: AbaSession[] = [];
  const trials: AbaTrial[] = [];
  SESSIONS.forEach((s, i) => {
    const id = fixtureId(i + 1);
    const start = `${s.day}T10:00:00.000Z`;
    sessions.push({
      id,
      index: i + 1,
      day: s.day,
      startedAt: start,
      endedAt: new Date(Date.parse(start) + s.minutes * 60_000).toISOString(),
      config: 'with_adult',
      targetIds: s.targets ?? [SAME2],
      reinforcerId: 'puzzle',
      reinforcerChosenBy: 'child',
      tokensEarned: 4,
      exchangesMade: 1,
      endReason: s.endReason ?? 'completed',
      brokenTargetId: null,
      boardSize: 5,
      endedOnSuccess: true,
      events: (s.events ?? []).map((e) => ('at' in e ? { ...e, at: start } : 'startedAt' in e ? { ...e, startedAt: start, endedAt: start } : e)) as AbaSessionEvent[],
      primaryObserverId: FIXTURE_OBSERVER,
    });
    trials.push(...trialsOf(id, s.trials));
  });
  const states: Record<string, AbaTargetState> = {
    [SAME2]: {
      ...initialTargetState(target(SAME2)),
      phase: 'mastered',
      startPromptLevel: 0,
      sessionsAtCriterion: 3,
      criterionDays: ['2026-11-10', '2026-11-12', '2026-11-14'],
      exemplarsAtCriterion: ['e1', 'e2'],
      generalizationProbes: [
        { response: 'independent', exemplarId: 'e7' },
        { response: 'incorrect', exemplarId: 'e8' },
        { response: 'independent', exemplarId: 'e8' },
      ],
      recentIndependentRates: [0.2, 0.6, 0.8, 1, 0.8],
      criterionSessions: [{ sessionIndex: 4, verified: true }, { sessionIndex: 5, verified: true }, { sessionIndex: 6, verified: true }],
      currentDelayMs: 3000,
    },
    [SHAPE]: {
      ...initialTargetState(target(SHAPE)),
      phase: 'acquisition',
      startPromptLevel: 0,
      sessionsAtCriterion: 0,
      recentIndependentRates: [0.2, 0.6],
      currentDelayMs: 1000,
      flags: ['position_bias'],
    },
    'match-same-3': { ...initialTargetState(target('match-same-3')) },
  };
  const summaries = specialistSummaries({ sessions, trials, correctedTrialIds: new Set(), targetStates: states });
  return {
    exportedAt: '2026-11-15',
    abaTrials: trials.map(({ sdEndedAt: _s, ...t }) => ({ ...t, sdEndedAt: 0 })),
    abaSessions: sessions.map(({ startedAt, endedAt, ...s }) => ({
      ...s,
      events: s.events.map((e) => Object.fromEntries(Object.entries(e).map(([k, v]) => [k, typeof v === 'string' && /T\d\d:/.test(v) ? 0 : v]))),
      durationSec: Math.round((Date.parse(endedAt!) - Date.parse(startedAt)) / 1000),
      exchangesGiven: s.exchangesMade,
      primaryObserverId: 'O1',
      tail: null,
    })),
    abaIoa: [],
    abaTrialCorrections: [],
    abaRoutineRuns: [],
    abaReinforcerChoices: [],
    abaPairingSessions: [{ id: fixtureId(900), day: '2026-10-31', durationSec: 240, config: 'with_adult', endReason: 'completed', primaryObserverId: 'O1' }],
    abaSpecialistEvents: FIXTURE_CHANGES,
    summaries,
    state: {
      abaSessionParams: { timeLimitMs: 600_000 },
      abaTargets: states,
      abaObservers: [{ id: 'O1', role: 'parent', trained: true }],
      tokenTraining: { pairingDone: true, pairingConfirmed: { observerId: 'O1', byRole: 'owner', at: '2026-10-31' }, pairingSessions: 2, pairingStreak: 2, stage: 5, atStage: [], flags: [] },
    },
  };
}
