/**
 * Вход и выход сессии ABA для экранов (этап 11): что мешает начать, вход `startAbaSession` из состояния ребёнка,
 * вход сопряжения, данные для `finishAbaSession`. Только чтение: старт пишет экран через `saveAbaSessionStep`
 * (там же проверяются согласие и пауза — `withAbaWrite`).
 *
 * Цели — только допущенные (`readyAbaTargets`: у каждой карточки есть картинка). В сборке разработчика (`__DEV__`)
 * у каждого предмета своя различимая заглушка (решение владельца 2026-10-27) — цели открыты, чтобы пройти занятие;
 * в сборке для детей цели ждут картинок.
 */
import { ABA_TARGETS, readyAbaTargets } from '../../content/aba';
import { REINFORCERS } from '../../content/aba/reinforcers';
import { ABA_STIMULI } from '../../content/aba/stimuli';
import { consentStatus, type ConsentStatus } from '../../domain/consent';
import { CURRENT_CONSENT_TEXTS } from '../../domain/consentTexts';
import { reinforcerPoolFor } from '../../domain/abaReinforcerCatalog';
import { sessionSignals, type SessionSignal, type SignalSession } from '../../domain/abaBarriers';
import { initialTokenTraining, workingBoardSize, EXCHANGE_ACCESS_MS } from '../../domain/abaTokenTraining';
import { boardRevOf, MIN_REINFORCER_POOL } from '../../domain/abaTokens';
import { finishAbaSession, stopSession, type AbaSessionState, type StartInput } from '../../domain/abaSession';
import type { RandomBytes } from '../../domain/ids';
import { targetForBand } from '../../domain/abaTargetRules';
import type { AbaConfig, AbaObserver, AbaTarget } from '../../types/aba';
import type { AgeBand } from '../../types/task';
import { newAbaId } from '../abaIds';
import { randomSeed } from '../random';
import { pastSessionsOfTarget, reinforcerHistoryOf, sessionsOf, trialsOfSession } from './abaLog';
import { loadChildState } from './childState';
import { commitAbaSession, routineExchangeInSessionWindow } from './commit';
import { readConsentLog } from './consentLog';
import type { SqlDb } from './sql';

/** Различимые заглушки предметов в сборке разработчика: экран рисует их по id (`StimulusPlate`). */
export const DEV_PLACEHOLDER_ART: Readonly<Record<string, unknown>> = Object.fromEntries(
  ABA_STIMULI.filter((s) => s.kind === 'object').map((s) => [s.id, { placeholder: true }]),
);

export type AbaBlock = 'no_consent' | 'outdated' | 'paused' | 'in_progress' | 'pairing_needed' | 'no_ready_targets' | 'pool_small';

export type AbaOverview = {
  consent: ConsentStatus;
  paused: boolean;
  inProgress: AbaSessionState | null;
  pairingDone: boolean;
  readyTargets: number;
};

const localDay = (ms: number) => {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export const abaLocalDay = localDay;

function artFor(art?: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> | undefined {
  if (art) return art;
  return typeof __DEV__ !== 'undefined' && __DEV__ ? DEV_PLACEHOLDER_ART : undefined;
}

/** Что видит раздел родителя: согласие, пауза, незаконченное занятие, сопряжение, сколько целей готово. */
export async function abaOverview(db: SqlDb, childId: string, art?: Readonly<Record<string, unknown>>): Promise<AbaOverview> {
  const log = await readConsentLog(db);
  return {
    consent: consentStatus(log, 'aba_processing', childId, CURRENT_CONSENT_TEXTS.aba_processing),
    paused: (await loadChildState(db, childId, 'abaPaused')) === true,
    inProgress: (await loadChildState(db, childId, 'abaSessionInProgress')) ?? null,
    pairingDone: ((await loadChildState(db, childId, 'tokenTraining')) ?? initialTokenTraining()).pairingDone,
    readyTargets: readyAbaTargets(ABA_TARGETS, artFor(art)).length,
  };
}

/** Первая причина, по которой занятие не начать; `null` — можно. */
export function abaBlockOf(o: AbaOverview): AbaBlock | null {
  if (o.consent === 'outdated') return 'outdated';
  if (o.consent !== 'granted') return 'no_consent';
  if (o.paused) return 'paused';
  if (o.inProgress) return 'in_progress';
  if (o.readyTargets === 0) return 'no_ready_targets';
  if (!o.pairingDone) return 'pairing_needed';
  return null;
}

export type StartOptions = {
  config: AbaConfig;
  band: AgeBand;
  soundOn: boolean;
  observers: AbaObserver[];
  primaryObserverId: string | null;
  now: number;
  art?: Readonly<Record<string, unknown>>;
  randomBytes?: RandomBytes;
};

/** Пул подкрепителей под сессию: фильтры каталога и классы стимулов допущенных целей. */
function poolFor(targets: readonly AbaTarget[], o: Pick<StartOptions, 'config' | 'soundOn'>, accessMs: number): string[] {
  const byId = new Map(ABA_STIMULI.map((s) => [s.id, s]));
  const classes = [...new Set(targets.flatMap((t) => t.exemplars.flatMap((e) => e.cards ?? [])).map((id) => byId.get(id)?.class ?? ''))];
  return reinforcerPoolFor(REINFORCERS, { config: o.config, soundOn: o.soundOn, accessMs, stimulusClasses: classes.filter(Boolean) });
}

/** Вход рабочей сессии — или причина, почему её не начать. */
export async function loadAbaStart(db: SqlDb, childId: string, o: StartOptions): Promise<{ kind: 'ready'; input: StartInput } | { kind: 'blocked'; reason: AbaBlock }> {
  const art = artFor(o.art);
  const block = abaBlockOf(await abaOverview(db, childId, art));
  if (block) return { kind: 'blocked', reason: block };
  const targets = readyAbaTargets(ABA_TARGETS, art).map((t) => targetForBand(t, o.band));
  const tokenTraining = (await loadChildState(db, childId, 'tokenTraining')) ?? initialTokenTraining();
  const accessMs = EXCHANGE_ACCESS_MS[workingBoardSize(tokenTraining, o.band)];
  const pool = poolFor(targets, o, accessMs);
  if (pool.length < MIN_REINFORCER_POOL) return { kind: 'blocked', reason: 'pool_small' };
  const board = await loadChildState(db, childId, 'abaBoard');
  return {
    kind: 'ready',
    input: {
      sessionId: newAbaId(o.randomBytes),
      sessionIndex: (await loadChildState(db, childId, 'abaSessionIndex')) ?? 0,
      day: localDay(o.now),
      config: o.config,
      band: o.band,
      targets,
      states: (await loadChildState(db, childId, 'abaTargets')) ?? {},
      reinforcerPool: pool,
      reinforcerHistory: await reinforcerHistoryOf(db, childId),
      tokenTraining,
      startedAt: o.now,
      seed: randomSeed(o.randomBytes),
      ...(board ? { board: { earned: board.earned, nonContingent: board.nonContingent }, boardRev: boardRevOf(board) } : {}),
      identifySets: (await loadChildState(db, childId, 'identifySets')) ?? [],
      physicalPromptAllowed: (await loadChildState(db, childId, 'physicalPromptAllowed'))?.value ?? false,
      observers: o.observers,
      primaryObserverId: o.primaryObserverId,
    },
  };
}

/** Вход сопряжения: пул под доступ сопряжения (20 с) и история выборов. */
export async function loadPairingStart(
  db: SqlDb,
  childId: string,
  o: Pick<StartOptions, 'config' | 'soundOn' | 'art'>,
): Promise<{ pool: string[]; history: string[] } | { blocked: AbaBlock }> {
  const art = artFor(o.art);
  const ov = await abaOverview(db, childId, art);
  const block = abaBlockOf(ov);
  if (block && block !== 'pairing_needed') return { blocked: block };
  const pool = poolFor(readyAbaTargets(ABA_TARGETS, art), o, EXCHANGE_ACCESS_MS[1]);
  if (pool.length < MIN_REINFORCER_POOL) return { blocked: 'pool_small' };
  return { pool, history: await reinforcerHistoryOf(db, childId) };
}

/** Данные для `finishAbaSession`: прошлые сессии затронутых целей, сигналы, обмен рутины в окне. */
export async function loadFinishInputs(db: SqlDb, childId: string, state: AbaSessionState) {
  const touched = [...new Set(state.trials.map((t) => t.targetId))];
  const pastSessions = Object.fromEntries(await Promise.all(touched.map(async (id) => [id, await pastSessionsOfTarget(db, childId, id)] as const)));
  const formatOf = (targetId: string) => state.targets[targetId]?.format ?? 'match';
  const recent = (await sessionsOf(db, childId)).slice(-6);
  const sessions: SignalSession[] = [];
  for (const s of recent) sessions.push({ index: s.index, trials: await trialsOfSession(db, childId, s.id), formatOf });
  const previous: SessionSignal[] = sessions.length > 1 ? sessionSignals(sessions.slice(0, -1)) : [];
  return {
    pastSessions,
    signalHistory: { sessions, previous },
    extra: { routineExchangeInWindow: await routineExchangeInSessionWindow(db, childId, state) },
  };
}

/**
 * «Закончить без продолжения» у родителя: незаконченное занятие закрывается остановкой взрослого — без закрывающей
 * пробы и без жетона за участие (`stopSession`), итог пишется как обычно.
 */
export async function finishInProgressSession(db: SqlDb, childId: string, now: number): Promise<boolean> {
  const inProgress = await loadChildState(db, childId, 'abaSessionInProgress');
  if (!inProgress) return false;
  const stopped = stopSession(inProgress, 'adult_stopped', now);
  const f = await loadFinishInputs(db, childId, stopped);
  await commitAbaSession(db, childId, finishAbaSession(stopped, now, f.pastSessions, undefined, f.signalHistory, f.extra), new Date(now).toISOString());
  return true;
}
