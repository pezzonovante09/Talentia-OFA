/**
 * Фиксация итогов — одной транзакцией (аудит 2026-09-30, блокер 8).
 *
 * Итог урока и итог ABA-сессии — это несколько записей: журнал и сводное состояние. По
 * одной они расходились: приложение убили после записи сессии с номером N, но до
 * сохранения счётчика N+1 — следующая сессия снова получала N и на каждом конце падала
 * на `UNIQUE(child_id, session_index)`; ABA у ребёнка ломалось навсегда. Здесь — или всё,
 * или ничего.
 */
import type { AbaTrial } from '../../types/aba';
import type { AbaSessionResult, AbaSessionState } from '../../domain/abaSession';
import type { AtlasEntry } from '../../domain/lessonAssembly';
import type { SkillState } from '../../domain/mastery';
import type { LessonRun } from '../../domain/parentReport';
import { appendSession, appendTrial } from './abaLog';
import { saveChildState } from './childState';
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
 */
export async function recordAbaTrial(
  db: SqlDb,
  childId: string,
  trial: AbaTrial,
  inProgress: AbaSessionState,
  at: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    await appendTrial(tx, childId, trial, at);
    await saveChildState(tx, childId, 'abaSessionInProgress', inProgress, at);
  });
}

/**
 * Итог ABA-сессии: запись сессии, состояния целей, доска, обучение доске, наборы, номер
 * следующей сессии, и сессия в работе снимается — вместе.
 */
export async function commitAbaSession(
  db: SqlDb,
  childId: string,
  result: AbaSessionResult,
  at: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    await appendSession(tx, childId, result.session, at);
    await saveChildState(tx, childId, 'abaTargets', result.states, at);
    await saveChildState(tx, childId, 'abaBoard', { earned: result.board.earned, nonContingent: result.board.nonContingent }, at);
    await saveChildState(tx, childId, 'tokenTraining', result.tokenTraining, at);
    await saveChildState(tx, childId, 'identifySets', result.identifySets, at);
    await saveChildState(tx, childId, 'abaSessionIndex', result.session.index + 1, at);
    await saveChildState(tx, childId, 'abaSessionInProgress', null, at);
  });
}
