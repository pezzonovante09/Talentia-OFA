/**
 * Фиксация итогов — одной транзакцией (аудит 2026-09-30, блокер 8).
 *
 * Итог урока и итог ABA-сессии — это несколько записей: журнал и сводное состояние. По
 * одной они расходились: приложение убили после записи сессии с номером N, но до
 * сохранения счётчика N+1 — следующая сессия снова получала N и на каждом конце падала
 * на `UNIQUE(child_id, session_index)`; ABA у ребёнка ломалось навсегда. Здесь — или всё,
 * или ничего.
 */
import type { AbaIoaRecord, AbaObserver, AbaTargetState, AbaTrial, RoutineSetting } from '../../types/aba';
import { resumeAbaSession as resumeSessionState, type AbaSessionResult, type AbaSessionState } from '../../domain/abaSession';
import {
  finishRoutineRun,
  routineResultWithSetting,
  settleRoutineBoard,
  type RoutineRunResult,
  type RoutineRunState,
  type RoutineSettingOpen,
} from '../../domain/abaRoutineRun';
import { boardRevOf, reinforcerChoices, type BoardRecord } from '../../domain/abaTokens';
import { workingBoardSize } from '../../domain/abaTokenTraining';
import {
  applyBreakCardRoutine,
  applyBreakCardSession,
  applyBreakCardTraining,
  breakCardPlan,
  breakCardRequestsOf,
  initialBreakCard,
  type BreakCardPlan,
} from '../../domain/abaBreakCard';
import { seeded } from '../../domain/abaRandom';
import type { AtlasEntry } from '../../domain/lessonAssembly';
import type { SkillState } from '../../domain/mastery';
import type { LessonRun } from '../../domain/parentReport';
import { ioaRecordErrors } from '../../domain/abaIoa';
import { deepEqual } from '../../domain/deepEqual';
import {
  AbaBoardConflictError,
  AbaSessionMissingError,
  ExchangeNotOpenError,
  RoutineAlreadyRunError,
  RoutineRunClosedError,
  RoutineStateConflictError,
  RoutineWindowNotAccountedError,
  appendIoa,
  appendReinforcerChoice,
  appendRoutineAmendment,
  appendRoutineRun,
  appendSession,
  appendTrial,
  appendTrialCorrection,
  openRoutineOfferOf,
  reinforcerHistoryOf,
  routineExchangedSince,
  withAbaWrite,
  type ReinforcerChoice,
  type TrialCorrectionRow,
} from './abaLog';
import { loadChildState, saveChildState } from './childState';
import { readConsentLog } from './consentLog';
import { consentStatus, isGranted, type GuardianRole } from '../../domain/consent';
import { CURRENT_CONSENT_TEXTS } from '../../domain/consentTexts';
import { appendLessonRun, withLessonWrite } from './lessonRuns';
import type { TaskFormat } from '../../types/task';
import type { SqlDb } from './sql';

export type LessonCommit = {
  run: LessonRun;
  skills: SkillState[];
  atlas: AtlasEntry[];
  /** Номер следующего урока: `lastSeenLesson` у двух уроков совпасть не должен. */
  nextLessonNumber: number;
  /** Составные форматы, которые ребёнок уже видел (история + этот урок). */
  formatsSeen?: TaskFormat[];
};

/**
 * Итог собран от устаревшего счётчика уроков: пока этот урок шёл (снимок, второй экран), другой
 * уже записан. Записать — значит откатить счётчик и дать двум урокам один `lastSeenLesson`.
 */
export class LessonStaleError extends Error {
  constructor(
    readonly expected: number,
    readonly actual: number,
  ) {
    super(`Счётчик уроков ${actual}, итог ждёт ${expected}`);
    this.name = 'LessonStaleError';
  }
}

/**
 * Итог урока: прохождение, навыки, атлас и счётчик уроков — вместе. Только при согласии
 * `account_local`; иначе `LessonConsentRequiredError` и не пишется ничего — прогон теряется (№124).
 * Счётчик сверяется в той же транзакции: `nextLessonNumber` обязан быть больше записанного,
 * иначе `LessonStaleError` и ничего не пишется (ревью К1, 2026-10-24).
 */
export async function commitLesson(db: SqlDb, childId: string, c: LessonCommit, at: string): Promise<void> {
  if (c.run.childId !== childId) throw new Error('Прохождение другого ребёнка');
  await withLessonWrite(db, childId, async (tx) => {
    const counter = (await loadChildState(tx, childId, 'lessonCounter')) ?? 0;
    if (c.nextLessonNumber <= counter) throw new LessonStaleError(counter + 1, c.nextLessonNumber);
    await appendLessonRun(tx, c.run);
    await saveChildState(tx, childId, 'skills', c.skills, at);
    await saveChildState(tx, childId, 'atlas', c.atlas, at);
    await saveChildState(tx, childId, 'lessonCounter', c.nextLessonNumber, at);
    if (c.formatsSeen) await saveChildState(tx, childId, 'formatsSeen', c.formatsSeen, at);
  });
}

const EMPTY_BOARD: BoardRecord = { earned: 0, nonContingent: 0 };

/**
 * Слияние состояний целей по ключам (`commitAbaSession`, `commitIoa`, `saveAbaTargets`): пишутся
 * только переданные цели, остальные не тронуты. Состояние рутины только «растёт»: день прогона
 * (`lastRoutineRunDay`), счётчик прогонов (`routineRunSeq`), окно прогонов и срывов, флаг
 * зависимости. Устаревшая копия — даже с тем же днём — стёрла бы прогоны и флаги, и хранилище
 * приняло бы второй прогон за день (аудит раунда 3, В-1/В-3). Такая запись —
 * `RoutineStateConflictError`, ничего не пишется.
 */
function isStaleRoutineState(stored: AbaTargetState | undefined, s: AbaTargetState): boolean {
  if (!stored) return false;
  if (stored.lastRoutineRunDay !== undefined && (s.lastRoutineRunDay === undefined || s.lastRoutineRunDay < stored.lastRoutineRunDay)) {
    return true;
  }
  if ((s.routineRunSeq ?? 0) < (stored.routineRunSeq ?? 0)) return true;
  // тот же счётчик, но записей меньше или флаг зависимости снят — копия снята до прогона/флага
  if ((s.routineRuns?.length ?? 0) < (stored.routineRuns?.length ?? 0)) return true;
  if ((s.routineBreakdowns?.length ?? 0) < (stored.routineBreakdowns?.length ?? 0)) return true;
  return (s.dependenceFlaggedAtSession ?? -1) < (stored.dependenceFlaggedAtSession ?? -1);
}

function mergeTargets(
  current: Record<string, AbaTargetState>,
  incoming: Record<string, AbaTargetState>,
): Record<string, AbaTargetState> {
  for (const [id, s] of Object.entries(incoming)) {
    if (isStaleRoutineState(current[id], s)) throw new RoutineStateConflictError();
  }
  return { ...current, ...incoming };
}

/** Доска на устройстве вместе с версией. */
async function readBoard(tx: SqlDb, childId: string): Promise<BoardRecord> {
  return (await loadChildState(tx, childId, 'abaBoard')) ?? EMPTY_BOARD;
}

/**
 * Запись доски сессией (Р3, «живая доска»): версия на устройстве обязана совпасть с той, с которой
 * сессия сверялась, иначе `AbaBoardConflictError` и откат — доску изменила рутина. Доска пишется
 * с версией +1, только если она изменилась; возвращается версия, которую сессия теперь помнит.
 */
async function writeSessionBoard(
  tx: SqlDb,
  childId: string,
  board: Pick<BoardRecord, 'earned' | 'nonContingent'>,
  expectedRev: number,
  at: string,
): Promise<number> {
  const live = await readBoard(tx, childId);
  if (boardRevOf(live) !== expectedRev) throw new AbaBoardConflictError(expectedRev, boardRevOf(live));
  if (live.earned === board.earned && live.nonContingent === board.nonContingent) return expectedRev;
  const rev = expectedRev + 1;
  await saveChildState(tx, childId, 'abaBoard', { earned: board.earned, nonContingent: board.nonContingent, rev }, at);
  return rev;
}

/**
 * Проба ABA — сразу в журнал и вместе со снимком сессии в работе и доской: свёрнутое посреди
 * приложение продолжит с той пробы, что уже записана, а не с предыдущей.
 *
 * Только при согласии на данные ABA и не на паузе; иначе `AbaConsentRequiredError` или
 * `AbaPausedError`, и не пишется ничего — ни проба, ни снимок. Доску изменила рутина —
 * `AbaBoardConflictError`, не пишется ничего: экран возобновляет сессию и повторяет `recordTrial`.
 * Возвращает снимок с версией доски, которую сессия теперь помнит: дальше работать с ним.
 */
export async function recordAbaTrial(
  db: SqlDb,
  childId: string,
  trial: AbaTrial,
  inProgress: AbaSessionState,
  at: string,
): Promise<AbaSessionState> {
  let saved = inProgress;
  await withAbaWrite(db, childId, async (tx) => {
    const boardRev = await writeSessionBoard(tx, childId, inProgress.board, inProgress.boardRev, at);
    saved = { ...inProgress, boardRev };
    await appendTrial(tx, childId, trial, at);
    await saveChildState(tx, childId, 'abaSessionInProgress', saved, at);
  });
  return saved;
}

/**
 * Исправление последней отметки взрослого (`abaUndo.ts`) — одной транзакцией: доска (могла получить
 * недостающий жетон; версия сверяется), замена пробы в журнале, строка исправления, снимок сессии.
 * Исходная проба остаётся в `aba_trials` и читателями не видна (`EFFECTIVE`). Возвращает снимок с
 * новой версией доски.
 */
export async function commitTrialCorrection(
  db: SqlDb,
  childId: string,
  correction: TrialCorrectionRow,
  replacement: AbaTrial,
  inProgress: AbaSessionState,
  at: string,
): Promise<AbaSessionState> {
  let saved = inProgress;
  await withAbaWrite(db, childId, async (tx) => {
    const boardRev = await writeSessionBoard(tx, childId, inProgress.board, inProgress.boardRev, at);
    saved = { ...inProgress, boardRev };
    await appendTrial(tx, childId, replacement, at);
    await appendTrialCorrection(tx, childId, correction, at);
    await saveChildState(tx, childId, 'abaSessionInProgress', saved, at);
  });
  return saved;
}

/**
 * Шаг сессии без пробы — обмен в `finishBreak`, выбор подкрепителя, доступ: снимок и доска вместе,
 * та же проверка версии. `choice` — выбор подкрепителя, если он сделан на этом шаге: в историю в
 * той же транзакции, в момент выбора. Возвращает снимок с новой версией доски.
 */
export async function saveAbaSessionStep(
  db: SqlDb,
  childId: string,
  inProgress: AbaSessionState,
  at: string,
  choice?: ReinforcerChoice,
): Promise<AbaSessionState> {
  let saved = inProgress;
  await withAbaWrite(db, childId, async (tx) => {
    const boardRev = await writeSessionBoard(tx, childId, inProgress.board, inProgress.boardRev, at);
    saved = { ...inProgress, boardRev };
    if (choice) await appendReinforcerChoice(tx, childId, choice, at);
    await saveChildState(tx, childId, 'abaSessionInProgress', saved, at);
  });
  return saved;
}

/**
 * Возобновить свёрнутую сессию — единственный путь продолжить (и при возврате фокуса на экран,
 * и после `AbaBoardConflictError`). Доска — с устройства; если пока сессия была свёрнута, рутина
 * обменяла жетоны, выбор подкрепителя предлагается заново из вариантов по живой истории.
 * `null` — сессии в работе нет. Ничего не пишет: снимок сохранится следующим шагом.
 *
 * `reinforcerPool` — пул подкрепителей ребёнка (он в состоянии сессии не хранится).
 */
export async function resumeAbaSession(db: SqlDb, childId: string, reinforcerPool: string[]): Promise<AbaSessionState | null> {
  return db.transaction(async (tx) => {
    const state = await loadChildState(tx, childId, 'abaSessionInProgress');
    if (!state) return null;
    const live = await readBoard(tx, childId);
    const since = Math.max(state.startedAt, state.reinforcerChosenAt ?? 0);
    // обмен рутины после выбора сессии ИЛИ открытое предложение рутины: жетоны рутины нельзя обменять
    // по утреннему подкрепителю — выбор заново (методист 2026-10-12)
    const exchangedByRoutine = await routineExchangedSince(tx, childId, since);
    const openOffer = await openRoutineOfferOf(tx, childId, state.day);
    const routineExchanged = exchangedByRoutine || openOffer !== null;
    const options = routineExchanged
      ? (openOffer?.options ??
        reinforcerChoices(reinforcerPool, await reinforcerHistoryOf(tx, childId), seeded(state.seed + boardRevOf(live)).rng))
      : undefined;
    return resumeSessionState(
      state,
      { earned: live.earned, nonContingent: live.nonContingent, rev: boardRevOf(live) },
      { routineExchanged, ...(options ? { options } : {}) },
    );
  });
}

/** Был ли обмен рутины в окне сессии (старт → сейчас): вход `finishAbaSession` для ступени доски. */
export async function routineExchangeInSessionWindow(db: SqlDb, childId: string, session: AbaSessionState): Promise<boolean> {
  return routineExchangedSince(db, childId, session.startedAt);
}

/**
 * Итог ABA-сессии: запись сессии, состояния целей, доска, обучение доске, наборы, номер
 * следующей сессии, и сессия в работе снимается — вместе. Тоже только при согласии на
 * данные ABA и не на паузе. Доска пишется при совпадении версии (`AbaBoardConflictError`: экран
 * возобновляет сессию и завершает её заново — `finishAbaSession` чистая).
 */
export async function commitAbaSession(
  db: SqlDb,
  childId: string,
  result: AbaSessionResult,
  at: string,
): Promise<void> {
  await withAbaWrite(db, childId, async (tx) => {
    await writeSessionBoard(tx, childId, result.board, result.boardRev, at);
    // с нулём обменов и обменом рутины в окне без учёта признака ступень решилась бы ложно
    if (
      result.routineExchangeInWindow === undefined &&
      result.session.exchangesMade === 0 &&
      (await routineExchangedSince(tx, childId, Date.parse(result.session.startedAt)))
    ) {
      throw new RoutineWindowNotAccountedError();
    }
    await appendSession(tx, childId, result.session, at);
    // слияние с текущей картой: рутины меняет только прогон рутины, и его итог, записанный, пока
    // сессия была свёрнута, не затирается (методист, раунд 2, Р3)
    const targets = (await loadChildState(tx, childId, 'abaTargets')) ?? {};
    await saveChildState(tx, childId, 'abaTargets', mergeTargets(targets, result.states), at);
    await saveChildState(tx, childId, 'tokenTraining', result.tokenTraining, at);
    // карточка «перерыв» на ребёнке: обучающие возможности и просьбы в пробе — из событий хода сессии
    const events = result.session.events;
    const card0 = (await loadChildState(tx, childId, 'breakCard')) ?? initialBreakCard();
    const day = result.session.day ?? result.session.startedAt.slice(0, 10);
    const trained = applyBreakCardTraining(
      card0,
      events.flatMap((e) => (e.kind === 'break_card_training' ? [{ step: e.step, touched: e.touched, gestureGiven: e.gestureGiven, latencyMs: e.latencyMs }] : [])),
      { day, observerId: result.session.primaryObserverId },
    );
    const asked = breakCardRequestsOf(events);
    await saveChildState(
      tx,
      childId,
      'breakCard',
      applyBreakCardSession(
        trained,
        { sessionIndex: result.session.index, day, requests: asked.requests, byLimit: asked.byLimit, endReason: result.session.endReason },
        { observerId: result.session.primaryObserverId },
      ),
      at,
    );
    await saveChildState(tx, childId, 'identifySets', result.identifySets, at);
    await saveChildState(tx, childId, 'abaSessionIndex', result.session.index + 1, at);
    await saveChildState(tx, childId, 'abaSessionInProgress', null, at);
  });
}

/**
 * Звено прогона рутины — сразу в журнал проб вместе со снимком прогона (`abaRoutineRunInProgress`):
 * свёрнутый посреди прогон продолжится с записанного звена. Только при согласии и не на паузе.
 * Доски звено не трогает. Звено нового прогона закрывает форму места прошлого (Д2).
 */
export async function recordRoutineStep(
  db: SqlDb,
  childId: string,
  trial: AbaTrial,
  inProgress: RoutineRunState,
  at: string,
): Promise<void> {
  await withAbaWrite(db, childId, async (tx) => {
    await appendTrial(tx, childId, trial, at);
    await saveChildState(tx, childId, 'abaRoutineRunInProgress', inProgress, at);
    const open = await loadChildState(tx, childId, 'abaRoutineSettingOpen');
    if (open && open.run.runId !== inProgress.runId) await saveChildState(tx, childId, 'abaRoutineSettingOpen', null, at);
  });
}

/** Что решила доска после прогона: экран показывает жетон и обмен по этому, а не по снимку прогона. */
export type RoutineCommitOutcome = {
  token: RoutineRunResult['claim']['token'];
  board: Pick<BoardRecord, 'earned' | 'nonContingent'>;
  /** Доска заполнилась — предложен обмен: выбор из `options`, затем `commitRoutineExchange`. Доска не обнулена. */
  offer?: { tokens: number; boardSize: number; options: string[] };
};

/**
 * Итог прогона рутины (Т1, раунд 4, Д2) — сразу после последнего звена, обрыва или довода взрослым,
 * **до** формы «где и с кем» и PIN: жетон выдаётся за секунды, а не после передачи устройства. Одной
 * транзакцией: запись прогона (место — каким оно в прогоне, по умолчанию «как обычно»), состояние
 * этой рутины в карте целей, доска (общая с сессиями), просьбы о перерыве на карточке ребёнка;
 * свёрнутый прогон снимается, открывается форма места (`abaRoutineSettingOpen`; у внешнего обрыва —
 * нет). Номер сессии не меняется: прогон его не двигает (методист, Р3).
 *
 * Жетон и обмен решаются здесь, по доске на момент фиксации, текущей ступени и живой истории
 * выборов (`settleRoutineBoard`), а не по снимку со старта: сессия, свёрнутая на время прогона,
 * и прогон не расходятся в доске. Доска пишется с версией +1, если изменилась.
 */
export async function commitRoutineRun(
  db: SqlDb,
  childId: string,
  result: RoutineRunResult,
  at: string,
): Promise<RoutineCommitOutcome> {
  let outcome: RoutineCommitOutcome | undefined;
  await withAbaWrite(db, childId, async (tx) => {
    const live = await readBoard(tx, childId);
    const training = await loadChildState(tx, childId, 'tokenTraining');
    if (!training) throw new Error('Сопряжение не закончено: прогон рутины без обучения доске записать нельзя');
    const settled = settleRoutineBoard(live, workingBoardSize(training, result.band), result.claim, {
      pool: result.reinforcerPool,
      history: await reinforcerHistoryOf(tx, childId),
      seed: result.seed,
    });
    const targets = (await loadChildState(tx, childId, 'abaTargets')) ?? {};
    const current = targets[result.record.targetId];
    // один прогон рутины в календарный день; внешний обрыв день не занимает и сюда не попадает
    if (current?.lastRoutineRunDay === result.record.day && result.record.interrupted !== 'external') {
      throw new RoutineAlreadyRunError();
    }
    // итог посчитан от состояния на старте: чужая запись той же цели за время прогона — конфликт
    if (current && !deepEqual(current, result.before)) throw new RoutineStateConflictError();
    await appendRoutineRun(
      tx,
      childId,
      {
        ...result.record,
        token: settled.token,
        ...(settled.offer ? { exchangeOffer: settled.offer } : {}),
      },
      at,
    );
    await saveChildState(tx, childId, 'abaTargets', { ...targets, [result.record.targetId]: result.state }, at);
    if (settled.board.earned !== live.earned || settled.board.nonContingent !== live.nonContingent) {
      await saveChildState(tx, childId, 'abaBoard', { ...settled.board, rev: boardRevOf(live) + 1 }, at);
    }
    // просьбы о перерыве в звеньях — на карточку ребёнка, не в срывы рутины (Д3)
    if (result.breakRequests.requests > 0) {
      const card = (await loadChildState(tx, childId, 'breakCard')) ?? initialBreakCard();
      await saveChildState(
        tx,
        childId,
        'breakCard',
        applyBreakCardRoutine(card, { runId: result.record.id, day: result.record.day, ...result.breakRequests }),
        at,
      );
    }
    await saveChildState(tx, childId, 'abaRoutineRunInProgress', null, at);
    await saveChildState(
      tx,
      childId,
      'abaRoutineSettingOpen',
      result.record.interrupted === 'external'
        ? null
        : { run: result.run, t1State: result.state, sessionIndex: result.sessionIndex, history: result.history },
      at,
    );
    outcome = { token: settled.token, board: settled.board, ...(settled.offer ? { offer: settled.offer } : {}) };
  });
  return outcome!;
}

/** Открытая форма места этого прогона в этот день, иначе `RoutineRunClosedError`. */
async function openSettingOf(tx: SqlDb, childId: string, runId: string, today: string): Promise<RoutineSettingOpen> {
  const open = await loadChildState(tx, childId, 'abaRoutineSettingOpen');
  if (!open || open.run.runId !== runId || open.run.day !== today) throw new RoutineRunClosedError();
  return open;
}

/** Итог прогона пересчитан от того же состояния, что Т1: чужая запись цели после Т1 — конфликт. */
async function writeRecomputed(
  tx: SqlDb,
  childId: string,
  open: RoutineSettingOpen,
  next: RoutineRunResult,
  reason: 'setting' | 'correction',
  at: string,
): Promise<void> {
  const targets = (await loadChildState(tx, childId, 'abaTargets')) ?? {};
  const targetId = open.run.target.id;
  if (!deepEqual(targets[targetId], open.t1State)) throw new RoutineStateConflictError();
  await saveChildState(tx, childId, 'abaTargets', { ...targets, [targetId]: next.state }, at);
  await appendRoutineAmendment(tx, childId, { runId: open.run.runId, reason, setting: next.record.setting, phase: next.record.phase }, at);
}

/**
 * Отметка «где и с кем» после записи прогона (Т2, раунд 4, Д2; методист 2026-10-19, переспросить):
 * не «как обычно» — итог прогона пересчитывается с этим местом (окно, перенос, фаза, детектор) от
 * состояния до прогона, `runNo` тот же; место и фаза — строкой журнала поправок. Доску и жетон не
 * трогает: жетон уже выдан. «Как обычно» — просто закрывает форму. Форма закрыта (другой прогон,
 * другой день) — `RoutineRunClosedError`; цель изменилась после Т1 — `RoutineStateConflictError`;
 * в обоих случаях место остаётся «как обычно». `today` — локальный день устройства.
 */
export async function commitRoutineSetting(
  db: SqlDb,
  childId: string,
  runId: string,
  setting: RoutineSetting,
  today: string,
  at: string,
): Promise<void> {
  await withAbaWrite(db, childId, async (tx) => {
    const open = await openSettingOf(tx, childId, runId, today);
    if (setting !== open.run.setting) await writeRecomputed(tx, childId, open, routineResultWithSetting(open, setting), 'setting', at);
    await saveChildState(tx, childId, 'abaRoutineSettingOpen', null, at);
  });
}

/** Закрыть форму места без отметки: брошенная форма — «как обычно», итог Т1 окончателен. */
export async function closeRoutineSettingForm(db: SqlDb, childId: string, at: string): Promise<void> {
  await withAbaWrite(db, childId, async (tx) => {
    if (await loadChildState(tx, childId, 'abaRoutineSettingOpen')) await saveChildState(tx, childId, 'abaRoutineSettingOpen', null, at);
  });
}

/**
 * Исправление отметки звена рутины (`undoRoutineStep`, раунд 4, В7) — одной транзакцией: замена
 * пробы в журнале, строка исправления и снимок. Прогон ещё идёт — снимок `abaRoutineRunInProgress`.
 * Последнее звено исправлено уже после записи прогона (Т1) — итог пересчитывается с местом формы,
 * сверка с состоянием Т1, поправка фазы в журнал; жетон и доска не меняются. Иначе —
 * `RoutineRunClosedError`, не пишется ничего.
 */
export async function commitRoutineCorrection(
  db: SqlDb,
  childId: string,
  c: { correction: TrialCorrectionRow; replacement: AbaTrial; run: RoutineRunState },
  today: string,
  at: string,
): Promise<void> {
  await withAbaWrite(db, childId, async (tx) => {
    const inProgress = await loadChildState(tx, childId, 'abaRoutineRunInProgress');
    if (inProgress?.runId === c.run.runId) {
      await appendTrial(tx, childId, c.replacement, at);
      await appendTrialCorrection(tx, childId, c.correction, at);
      await saveChildState(tx, childId, 'abaRoutineRunInProgress', c.run, at);
      return;
    }
    const open = await openSettingOf(tx, childId, c.run.runId, today);
    const run = { ...c.run, setting: open.run.setting };
    const next = finishRoutineRun(run, open.sessionIndex, open.history);
    await writeRecomputed(tx, childId, open, next, 'correction', at);
    await appendTrial(tx, childId, c.replacement, at);
    await appendTrialCorrection(tx, childId, c.correction, at);
    await saveChildState(tx, childId, 'abaRoutineSettingOpen', { ...open, run, t1State: next.state }, at);
  });
}

/**
 * Обмен после рутины: выбор подкрепителя и обнуление доски — **одной транзакцией**. Жетоны уходят
 * только вместе с выбором (методист 2026-10-12, пересмотр В4): полная доска и есть ожидающий обмен.
 * Подкрепитель — из вариантов последнего предложения; доска ещё полна (сессия могла обменять
 * раньше); по этому прогону выбора ещё нет. Иначе `ExchangeNotOpenError` — экран молча идёт
 * дальше, без доступа. Уходят все жетоны, включая сверх доски. Возвращает сколько ушло.
 */
export async function commitRoutineExchange(
  db: SqlDb,
  childId: string,
  runId: string,
  reinforcerId: string,
  chosenBy: 'child' | 'adult',
  at: string,
): Promise<{ tokens: number; boardSize: number }> {
  let spent: { tokens: number; boardSize: number } | undefined;
  await withAbaWrite(db, childId, async (tx) => {
    const [last] = await tx.all<{ id: string; body: string }>(
      "SELECT id, body FROM aba_routine_runs WHERE child_id = ? AND json_extract(body, '$.exchangeOffer') IS NOT NULL ORDER BY seq DESC LIMIT 1",
      [childId],
    );
    const offer = last ? (JSON.parse(last.body) as { exchangeOffer: { boardSize: number; options: string[] } }).exchangeOffer : null;
    const [done] = await tx.all<{ n: number }>(
      "SELECT 1 AS n FROM aba_reinforcer_choices WHERE child_id = ? AND source = 'routine' AND source_id = ?",
      [childId, runId],
    );
    const live = await readBoard(tx, childId);
    if (!last || last.id !== runId || !offer || done || live.earned < offer.boardSize || !offer.options.includes(reinforcerId)) {
      throw new ExchangeNotOpenError();
    }
    await appendReinforcerChoice(tx, childId, { source: 'routine', sourceId: runId, reinforcerId, chosenBy, tokens: live.earned }, at);
    await saveChildState(tx, childId, 'abaBoard', { earned: 0, nonContingent: 0, rev: boardRevOf(live) + 1 }, at);
    spent = { tokens: live.earned, boardSize: offer.boardSize };
  });
  return spent!;
}

/**
 * Итог паузы: `no_consent` — согласия на ABA нет или оно отозвано, режим и так выключен,
 * ничего не записано; `consent_required` — снять паузу нельзя, согласие дано на прежний
 * текст: экран ведёт в согласие.
 */
export type AbaPauseResult = 'saved' | 'no_consent' | 'consent_required';

/**
 * Пауза ABA — без удаления: выключить режим можно всегда, пока согласие не отозвано, в том
 * числе при согласии на прежний текст. Сессия в работе не снимается — после паузы её можно
 * продолжить, а при отзыве её удалит отзыв. Снятие паузы возобновляет запись, поэтому
 * требует согласия на текущий текст; экран ставит его за гейт (уровень 1+), включение — без
 * гейта.
 *
 * Без действующего согласия — ни разу не давали или отозвано — строка `abaPaused` не пишется:
 * она сама метка «режим был», а отзыв её удаляет (аудит 2026-10-06, А1). Проверка и запись —
 * в одной эксклюзивной транзакции: отзыв не встанет между ними. Без `account_local` — тоже
 * `no_consent`: без аккаунта на устройство не пишется ничего о ребёнке (№124).
 */
export async function setAbaPaused(db: SqlDb, childId: string, paused: boolean, at: string): Promise<AbaPauseResult> {
  return db.transaction(async (tx) => {
    const log = await readConsentLog(tx);
    if (!isGranted(log, 'account_local', null, CURRENT_CONSENT_TEXTS.account_local)) return 'no_consent';
    const status = consentStatus(log, 'aba_processing', childId, CURRENT_CONSENT_TEXTS.aba_processing);
    switch (status) {
      case 'not_asked':
      case 'revoked':
        return 'no_consent';
      case 'outdated':
        if (!paused) return 'consent_required';
        break;
      case 'granted':
        break;
      default: {
        // новый статус согласия не дойдёт до записи молча: его надо разобрать здесь
        const unhandled: never = status;
        throw new Error(`Пауза ABA: необработанный статус согласия ${String(unhandled)}`);
      }
    }
    await saveChildState(tx, childId, 'abaPaused', paused, at);
    return 'saved';
  });
}

/**
 * Разрешение физической подсказки (L4) — в ABA-состоянии ребёнка, только при согласии на
 * данные ABA. Включение экран ставит за PIN (уровень 1+) и после правила «мягко направлять,
 * прекращать при сопротивлении»; выключение — без гейта. Без имени — только роль.
 */
export async function setPhysicalPromptAllowed(
  db: SqlDb,
  childId: string,
  value: boolean,
  at: string,
  setByRole: GuardianRole,
): Promise<void> {
  await withAbaWrite(db, childId, (tx) => saveChildState(tx, childId, 'physicalPromptAllowed', { value, setAt: at, setByRole }, at));
}

/**
 * IOA сессии и состояния целей после него (`abaIoa.applyLateIoa`) — вместе, при согласии.
 * Без комментариев, свободного текста и фото листа (условия приватности). Сессии нет —
 * `AbaSessionMissingError`, ничего не пишется.
 */
export async function commitIoa(
  db: SqlDb,
  childId: string,
  record: AbaIoaRecord,
  states: Record<string, AbaTargetState>,
  at: string,
): Promise<void> {
  const errors = ioaRecordErrors(record);
  if (errors.length) throw new Error(`IOA не записан: ${errors.join('; ')}`);
  await withAbaWrite(db, childId, async (tx) => {
    // срок хранения — по дате сессии, а не ввода: запись IOA не переживает свою сессию
    const [session] = await tx.all<{ recorded_at: string }>(
      'SELECT recorded_at FROM aba_sessions WHERE child_id = ? AND id = ?',
      [childId, record.sessionId],
    );
    if (!session) throw new AbaSessionMissingError(record.sessionId);
    await appendIoa(tx, childId, record, session.recorded_at);
    // слияние по ключам: рутины и другие цели, записанные за это время, не затираются
    const targets = (await loadChildState(tx, childId, 'abaTargets')) ?? {};
    await saveChildState(tx, childId, 'abaTargets', mergeTargets(targets, states), at);
  });
}

/** Наблюдатели ребёнка — без имён; при согласии. */
export async function setAbaObservers(db: SqlDb, childId: string, observers: AbaObserver[], at: string): Promise<void> {
  await withAbaWrite(db, childId, (tx) => saveChildState(tx, childId, 'abaObservers', observers, at));
}

/** Состояния целей вне итога сессии — например, «цель пересмотрена» (`reviewAssentConcern`). */
export async function saveAbaTargets(
  db: SqlDb,
  childId: string,
  states: Record<string, AbaTargetState>,
  at: string,
): Promise<void> {
  await withAbaWrite(db, childId, async (tx) => {
    // слияние по ключам, как в `commitIoa`: пишутся только переданные цели
    const targets = (await loadChildState(tx, childId, 'abaTargets')) ?? {};
    await saveChildState(tx, childId, 'abaTargets', mergeTargets(targets, states), at);
  });
}

/**
 * План обучения карточке «перерыв» на сессию (`breakCardPlan`): три возможности, повтор или ничего.
 * Читается перед стартом; состояние карточки на ребёнке.
 */
export async function loadBreakCardPlan(
  db: SqlDb,
  childId: string,
  ctx: { config: 'with_adult' | 'alone'; day: string; observerId: string | null; deviceId?: string | null },
): Promise<BreakCardPlan> {
  return breakCardPlan((await loadChildState(db, childId, 'breakCard')) ?? initialBreakCard(), ctx);
}
