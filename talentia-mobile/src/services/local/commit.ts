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
import type { AbaSessionResult, AbaSessionState } from '../../domain/abaSession';
import type { AtlasEntry } from '../../domain/lessonAssembly';
import type { SkillState } from '../../domain/mastery';
import type { LessonRun } from '../../domain/parentReport';
import { ioaRecordErrors } from '../../domain/abaIoa';
import { appendIoa, appendSession, appendTrial, withAbaWrite } from './abaLog';
import { saveChildState } from './childState';
import { readConsentLog } from './consentLog';
import type { GuardianRole } from '../../domain/consent';
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

/**
 * Проба ABA — сразу в журнал и вместе со снимком сессии в работе: свёрнутое посреди
 * приложение продолжит с той пробы, что уже записана, а не с предыдущей.
 *
 * Только при согласии на данные ABA и не на паузе; иначе `AbaConsentRequiredError` или
 * `AbaPausedError`, и не пишется ничего — ни проба, ни снимок.
 */
export async function recordAbaTrial(
  db: SqlDb,
  childId: string,
  trial: AbaTrial,
  inProgress: AbaSessionState,
  at: string,
): Promise<void> {
  await withAbaWrite(db, childId, async (tx) => {
    await appendTrial(tx, childId, trial, at);
    await saveChildState(tx, childId, 'abaSessionInProgress', inProgress, at);
  });
}

/**
 * Итог ABA-сессии: запись сессии, состояния целей, доска, обучение доске, наборы, номер
 * следующей сессии, и сессия в работе снимается — вместе. Тоже только при согласии на
 * данные ABA и не на паузе.
 */
export async function commitAbaSession(
  db: SqlDb,
  childId: string,
  result: AbaSessionResult,
  at: string,
): Promise<void> {
  await withAbaWrite(db, childId, async (tx) => {
    await appendSession(tx, childId, result.session, at);
    await saveChildState(tx, childId, 'abaTargets', result.states, at);
    await saveChildState(tx, childId, 'abaBoard', { earned: result.board.earned, nonContingent: result.board.nonContingent }, at);
    await saveChildState(tx, childId, 'tokenTraining', result.tokenTraining, at);
    await saveChildState(tx, childId, 'identifySets', result.identifySets, at);
    await saveChildState(tx, childId, 'abaSessionIndex', result.session.index + 1, at);
    await saveChildState(tx, childId, 'abaSessionInProgress', null, at);
  });
}

/**
 * Пауза ABA — без удаления и без согласия: выключить режим можно всегда. Сессия в работе
 * не снимается — после паузы её можно продолжить, а при отзыве её удалит отзыв.
 *
 * У ребёнка, которому согласие на ABA не давали ни разу, паузы не бывает: строка
 * `abaPaused` сама была бы меткой «режим был». Снятие паузы возобновляет запись — экран
 * ставит его за гейт (уровень 1+), включение — без гейта.
 */
export async function setAbaPaused(db: SqlDb, childId: string, paused: boolean, at: string): Promise<void> {
  const asked = (await readConsentLog(db)).some((e) => e.scope === 'aba_processing' && e.childId === childId);
  if (!asked) return;
  await saveChildState(db, childId, 'abaPaused', paused, at);
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
 * Без комментариев, свободного текста и фото листа (условия приватности).
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
    await appendIoa(tx, childId, record, session?.recorded_at ?? at);
    await saveChildState(tx, childId, 'abaTargets', states, at);
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
  await withAbaWrite(db, childId, (tx) => saveChildState(tx, childId, 'abaTargets', states, at));
}
