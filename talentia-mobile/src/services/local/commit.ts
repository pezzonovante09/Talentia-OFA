/**
 * Фиксация итогов — одной транзакцией (аудит 2026-09-30, блокер 8).
 *
 * Итог урока и итог ABA-сессии — это несколько записей: журнал и сводное состояние. По
 * одной они расходились: приложение убили после записи сессии с номером N, но до
 * сохранения счётчика N+1 — следующая сессия снова получала N и на каждом конце падала
 * на `UNIQUE(child_id, session_index)`; ABA у ребёнка ломалось навсегда. Здесь — или всё,
 * или ничего.
 */
import type { AbaIoaRecord, AbaObserver, AbaTargetState, AbaTrial } from '../../types/aba';
import { resumeAbaSession as resumeSessionState, type AbaSessionResult, type AbaSessionState } from '../../domain/abaSession';
import { settleRoutineBoard, type RoutineRunResult, type RoutineRunState } from '../../domain/abaRoutineRun';
import { boardRevOf, reinforcerChoices, type BoardRecord } from '../../domain/abaTokens';
import { workingBoardSize } from '../../domain/abaTokenTraining';
import { seeded } from '../../domain/abaRandom';
import type { AtlasEntry } from '../../domain/lessonAssembly';
import type { SkillState } from '../../domain/mastery';
import type { LessonRun } from '../../domain/parentReport';
import { ioaRecordErrors } from '../../domain/abaIoa';
import {
  AbaBoardConflictError,
  AbaSessionMissingError,
  RoutineAlreadyRunError,
  RoutineStateConflictError,
  RoutineWindowNotAccountedError,
  appendIoa,
  appendReinforcerChoice,
  appendRoutineRun,
  appendSession,
  appendTrial,
  reinforcerHistoryOf,
  routineExchangedSince,
  withAbaWrite,
  type ReinforcerChoice,
} from './abaLog';
import { loadChildState, saveChildState } from './childState';
import { readConsentLog } from './consentLog';
import { consentStatus, type GuardianRole } from '../../domain/consent';
import { CURRENT_CONSENT_TEXTS } from '../../domain/consentTexts';
import { appendLessonRun } from './lessonRuns';
import type { SqlDb } from './sql';

export type LessonCommit = {
  run: LessonRun;
  skills: SkillState[];
  atlas: AtlasEntry[];
  /** Номер следующего урока: `lastSeenLesson` у двух уроков совпасть не должен. */
  nextLessonNumber: number;
};

/** Итог урока: прохождение, навыки, атлас и счётчик уроков — вместе. */
export async function commitLesson(db: SqlDb, childId: string, c: LessonCommit, at: string): Promise<void> {
  if (c.run.childId !== childId) throw new Error('Прохождение другого ребёнка');
  await db.transaction(async (tx) => {
    await appendLessonRun(tx, c.run);
    await saveChildState(tx, childId, 'skills', c.skills, at);
    await saveChildState(tx, childId, 'atlas', c.atlas, at);
    await saveChildState(tx, childId, 'lessonCounter', c.nextLessonNumber, at);
  });
}

const EMPTY_BOARD: BoardRecord = { earned: 0, nonContingent: 0 };

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
    const routineExchanged = await routineExchangedSince(tx, childId, since);
    const options = routineExchanged
      ? reinforcerChoices(reinforcerPool, await reinforcerHistoryOf(tx, childId), seeded(state.seed + boardRevOf(live)).rng)
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
    await saveChildState(tx, childId, 'abaTargets', { ...targets, ...result.states }, at);
    await saveChildState(tx, childId, 'tokenTraining', result.tokenTraining, at);
    await saveChildState(tx, childId, 'identifySets', result.identifySets, at);
    await saveChildState(tx, childId, 'abaSessionIndex', result.session.index + 1, at);
    await saveChildState(tx, childId, 'abaSessionInProgress', null, at);
  });
}

/**
 * Звено прогона рутины — сразу в журнал проб вместе со снимком прогона (`abaRoutineRunInProgress`):
 * свёрнутый посреди прогон продолжится с записанного звена. Только при согласии и не на паузе.
 * Доски звено не трогает.
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
  });
}

/** Что решила доска после прогона: экран показывает жетон и обмен по этому, а не по снимку прогона. */
export type RoutineCommitOutcome = {
  token: RoutineRunResult['claim']['token'];
  board: Pick<BoardRecord, 'earned' | 'nonContingent'>;
  /** Доска заполнилась — обмен: выбор из `options`, затем `recordRoutineExchangeChoice`. */
  exchange?: { tokens: number; options: string[] };
};

/**
 * Итог прогона рутины — одной транзакцией: запись прогона, состояние этой рутины в карте целей,
 * доска (общая с сессиями), и свёрнутый прогон снимается. Номер сессии не меняется: прогон
 * его не двигает (методист, Р3).
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
    if (current && JSON.stringify(current) !== JSON.stringify(result.before)) throw new RoutineStateConflictError();
    await appendRoutineRun(
      tx,
      childId,
      {
        ...result.record,
        token: settled.token,
        exchanged: settled.exchange?.tokens ?? 0,
        ...(settled.exchange ? { exchangeOptions: settled.exchange.options } : {}),
      },
      at,
    );
    await saveChildState(tx, childId, 'abaTargets', { ...targets, [result.record.targetId]: result.state }, at);
    if (settled.board.earned !== live.earned || settled.board.nonContingent !== live.nonContingent) {
      await saveChildState(tx, childId, 'abaBoard', { ...settled.board, rev: boardRevOf(live) + 1 }, at);
    }
    await saveChildState(tx, childId, 'abaRoutineRunInProgress', null, at);
    outcome = { token: settled.token, board: settled.board, ...(settled.exchange ? { exchange: settled.exchange } : {}) };
  });
  return outcome!;
}

/**
 * Выбор подкрепителя для обмена после прогона рутины — в историю в момент выбора. Один на прогон;
 * только из вариантов этого обмена (они записаны в прогоне). Приложение убили до выбора — при
 * следующем открытии `pendingRoutineExchanges` вернёт тот же обмен с теми же вариантами.
 */
export async function recordRoutineExchangeChoice(
  db: SqlDb,
  childId: string,
  runId: string,
  reinforcerId: string,
  chosenBy: 'child' | 'adult',
  at: string,
): Promise<void> {
  await withAbaWrite(db, childId, async (tx) => {
    const [row] = await tx.all<{ body: string }>('SELECT body FROM aba_routine_runs WHERE child_id = ? AND id = ?', [childId, runId]);
    const run = row ? (JSON.parse(row.body) as { exchanged: number; exchangeOptions?: string[] }) : null;
    if (!run || run.exchanged <= 0) throw new Error('Обмена в этом прогоне не было');
    if (!run.exchangeOptions?.includes(reinforcerId)) throw new Error('Этот подкрепитель не предлагался');
    await appendReinforcerChoice(tx, childId, { source: 'routine', sourceId: runId, reinforcerId, chosenBy }, at);
  });
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
 * в одной эксклюзивной транзакции: отзыв не встанет между ними.
 */
export async function setAbaPaused(db: SqlDb, childId: string, paused: boolean, at: string): Promise<AbaPauseResult> {
  return db.transaction(async (tx) => {
    const status = consentStatus(await readConsentLog(tx), 'aba_processing', childId, CURRENT_CONSENT_TEXTS.aba_processing);
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
    await saveChildState(tx, childId, 'abaTargets', { ...targets, ...states }, at);
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
    await saveChildState(tx, childId, 'abaTargets', { ...targets, ...states }, at);
  });
}
