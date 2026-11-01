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
import { lastSessionSummary, parentTargetStatus, sortForParent, type LastSessionSummary, type ParentTargetStatus } from '../../domain/abaParentProgress';
import { aloneFormatKey, formatUnlockedAlone } from '../../domain/abaPlacement';
import { finishAbaSession, stopSession, type AbaSessionState, type StartInput } from '../../domain/abaSession';
import type { RandomBytes } from '../../domain/ids';
import { targetForBand } from '../../domain/abaTargetRules';
import type { AbaConfig, AbaObserver, AbaPairingSession, AbaTarget } from '../../types/aba';
import type { AgeBand } from '../../types/task';
import { newAbaId } from '../abaIds';
import { randomSeed } from '../random';
import { abaLocalDay, pastSessionsOfTarget, reinforcerHistoryOf, sessionsOf, trialsOfSession } from './abaLog';
import { REINFORCER_APART } from './abaCatalog';
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
  /** Обученный наблюдатель, записанный у ребёнка (первый по списку), — ему доступно «сопряжение подтверждено». */
  trainedObserverId: string | null;
  readyTargets: number;
  /**
   * Можно ли выбрать «Сам» (этап G1, вопрос 59): до знакомства с жетонами — всегда (сопряжение в «Сам» допустимо);
   * после — только когда формат хотя бы одной готовой цели открыт освоением со взрослым (`formatUnlockedAlone`, №60).
   * Иначе домен в «Сам» не нашёл бы обучаемых целей, и родитель видел бы «Можно начинать» и пустую сессию.
   */
  aloneAvailable: boolean;
  /** Подсказка «лучше вместе» перед сопряжением (№166) — решение готово до первого кадра карточки, предвыбор «Со взрослым». */
  suggestAdult: boolean;
};

const localDay = abaLocalDay;

export { abaLocalDay };

/** Сессий сопряжения подряд в «Сам» без выбора или с уходом, после которых 2.6 подсказывает «вместе» (№166). */
export const PAIRING_ALONE_MISSES_TO_HINT = 2;

/**
 * Подсказать взрослому на 2.6 перед сопряжением «лучше вместе» и отметить «Со взрослым» (№166): последние
 * `PAIRING_ALONE_MISSES_TO_HINT` сессий сопряжения прошли в «Сам» и кончились без выбора (`no_choice`), уходом
 * (`abandoned`) или свёрнутым приложением — в «Сам» это тоже уход, как в `applyPairingSession`. Сопряжение — связь «взрослый рядом — хорошо»; одному ребёнку она не даётся. Выбор остаётся за взрослым.
 */
export async function pairingSuggestsAdult(db: SqlDb, childId: string): Promise<boolean> {
  const rows = await db.all<{ body: string }>('SELECT body FROM aba_pairing_sessions WHERE child_id = ? ORDER BY seq DESC LIMIT ?', [
    childId,
    PAIRING_ALONE_MISSES_TO_HINT,
  ]);
  if (rows.length < PAIRING_ALONE_MISSES_TO_HINT) return false;
  return rows.every((r) => {
    const p = JSON.parse(r.body) as Pick<AbaPairingSession, 'config' | 'endReason'>;
    return p.config === 'alone' && (p.endReason === 'no_choice' || p.endReason === 'abandoned' || p.endReason === 'app_backgrounded');
  });
}

function artFor(art?: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> | undefined {
  if (art) return art;
  return typeof __DEV__ !== 'undefined' && __DEV__ ? DEV_PLACEHOLDER_ART : undefined;
}

/** Что видит раздел родителя: согласие, пауза, незаконченное занятие, сопряжение, сколько целей готово. */
export async function abaOverview(db: SqlDb, childId: string, art?: Readonly<Record<string, unknown>>): Promise<AbaOverview> {
  const log = await readConsentLog(db);
  const pairingDone = ((await loadChildState(db, childId, 'tokenTraining')) ?? initialTokenTraining()).pairingDone;
  const ready = readyAbaTargets(ABA_TARGETS, artFor(art));
  const states = (await loadChildState(db, childId, 'abaTargets')) ?? {};
  return {
    consent: consentStatus(log, 'aba_processing', childId, CURRENT_CONSENT_TEXTS.aba_processing),
    paused: (await loadChildState(db, childId, 'abaPaused')) === true,
    inProgress: (await loadChildState(db, childId, 'abaSessionInProgress')) ?? null,
    pairingDone,
    trainedObserverId: ((await loadChildState(db, childId, 'abaObservers')) ?? []).find((o) => o.trained)?.id ?? null,
    readyTargets: ready.length,
    aloneAvailable: !pairingDone || ready.some((t) => formatUnlockedAlone(aloneFormatKey(t), ABA_TARGETS, states)),
    suggestAdult: !pairingDone && (await pairingSuggestsAdult(db, childId)),
  };
}

export type AbaParentProgress = {
  /** Цели программы в порядке «учим → почти → освоено»; цель без состояния — «учим» (ещё впереди). */
  targets: { id: string; status: ParentTargetStatus; started: boolean }[];
  /** Последнее занятие: пробы и самостоятельные; `null` — занятий не было. */
  last: LastSessionSummary | null;
};

/** Прогресс ABA для экрана родителя (вопрос 66): три слова на цель, две цифры за занятие — ничего больше. */
export async function loadAbaParentProgress(db: SqlDb, childId: string, targets: readonly AbaTarget[] = ABA_TARGETS): Promise<AbaParentProgress> {
  const states = (await loadChildState(db, childId, 'abaTargets')) ?? {};
  const rows = targets.map((tg) => {
    const s = states[tg.id];
    // состояние цели заводится при планировании сессии — «начата» только та, до которой дошли (методист 2026-11-01)
    return { id: tg.id, status: s ? parentTargetStatus(s) : ('learning' as const), started: s !== undefined && (s.lastSessionIndex >= 0 || s.phase !== 'baseline') };
  });
  const sessions = await sessionsOf(db, childId);
  const lastSession = sessions.at(-1) ?? null;
  const trials = lastSession ? await trialsOfSession(db, childId, lastSession.id) : [];
  let last = lastSessionSummary(lastSession, trials);
  if (!last) {
    // рабочих сессий не было, но сопряжение шло — родитель должен видеть, что занятие было, без цифр
    const pairing = await db.all<{ day: string }>('SELECT day FROM aba_pairing_sessions WHERE child_id = ? ORDER BY seq DESC LIMIT 1', [childId]);
    if (pairing[0]) last = { kind: 'pairing_only', day: pairing[0].day };
  }
  return { targets: sortForParent(rows), last };
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
      reinforcerApart: REINFORCER_APART,
      reinforcerHistory: await reinforcerHistoryOf(db, childId),
      tokenTraining,
      startedAt: o.now,
      seed: randomSeed(o.randomBytes),
      ...(board ? { board: { earned: board.earned, nonContingent: board.nonContingent }, boardRev: boardRevOf(board) } : {}),
      identifySets: (await loadChildState(db, childId, 'identifySets')) ?? [],
      physicalPromptAllowed: (await loadChildState(db, childId, 'physicalPromptAllowed'))?.value ?? false,
      // проверка сверху вниз включена (вопрос 63, 2026-10-31): домен сам ограничивает её «со взрослым»
      autoPlacement: true,
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
): Promise<{ pool: string[]; history: string[]; apart: readonly [string, string][] } | { blocked: AbaBlock }> {
  const art = artFor(o.art);
  const ov = await abaOverview(db, childId, art);
  const block = abaBlockOf(ov);
  if (block && block !== 'pairing_needed') return { blocked: block };
  const pool = poolFor(readyAbaTargets(ABA_TARGETS, art), o, EXCHANGE_ACCESS_MS[1]);
  if (pool.length < MIN_REINFORCER_POOL) return { blocked: 'pool_small' };
  return { pool, history: await reinforcerHistoryOf(db, childId), apart: REINFORCER_APART };
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
