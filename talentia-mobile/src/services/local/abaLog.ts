/**
 * Журнал проб и сессий ABA на устройстве. Спецификация — ABA.md, «Данные» и «Хранение».
 *
 * Каждая проба пишется сразу, отдельной строкой, без троттлинга и без пачек: прогресс
 * считается только отсюда, а не из сводных полей живой сессии — они приблизительны по
 * построению. Противоречивая проба (`trialInvariantErrors`) в журнал не попадает.
 */
import type { AbaSession, AbaTrial } from '../../types/aba';
import { trialInvariantErrors, type SessionTrials } from '../../domain/abaPrompting';
import type { SqlDb } from './sql';

export async function appendTrial(db: SqlDb, childId: string, trial: AbaTrial, recordedAt: string): Promise<void> {
  const errors = trialInvariantErrors(trial);
  if (errors.length) throw new Error(`Проба ${trial.id} не записана: ${errors.join('; ')}`);
  await db.run(
    'INSERT INTO aba_trials (child_id, id, session_id, target_id, body, recorded_at) VALUES (?, ?, ?, ?, ?, ?)',
    [childId, trial.id, trial.sessionId, trial.targetId, JSON.stringify(trial), recordedAt],
  );
}

export async function appendSession(db: SqlDb, childId: string, session: AbaSession, recordedAt: string): Promise<void> {
  await db.run(
    'INSERT INTO aba_sessions (child_id, id, session_index, body, recorded_at) VALUES (?, ?, ?, ?, ?)',
    [childId, session.id, session.index, JSON.stringify(session), recordedAt],
  );
}

const parse = <T>(rows: { body: string }[]): T[] => rows.map((r) => JSON.parse(r.body) as T);

/** Пробы цели ребёнка в порядке записи. */
export async function trialsOfTarget(db: SqlDb, childId: string, targetId: string): Promise<AbaTrial[]> {
  return parse(
    await db.all<{ body: string }>(
      'SELECT body FROM aba_trials WHERE child_id = ? AND target_id = ? ORDER BY seq',
      [childId, targetId],
    ),
  );
}

export async function trialsOfSession(db: SqlDb, childId: string, sessionId: string): Promise<AbaTrial[]> {
  return parse(
    await db.all<{ body: string }>(
      'SELECT body FROM aba_trials WHERE child_id = ? AND session_id = ? ORDER BY seq',
      [childId, sessionId],
    ),
  );
}

export async function sessionsOf(db: SqlDb, childId: string): Promise<AbaSession[]> {
  return parse(
    await db.all<{ body: string }>('SELECT body FROM aba_sessions WHERE child_id = ? ORDER BY session_index', [childId]),
  );
}

/**
 * Прошлые сессии цели для проверки зависимости от подсказки (`isPromptDependent`),
 * свежие в конце: номер сессии и пробы этой цели в ней. Сессии без проб цели не
 * попадают.
 */
export async function pastSessionsOfTarget(
  db: SqlDb,
  childId: string,
  targetId: string,
  limit = 10,
): Promise<SessionTrials[]> {
  const rows = await db.all<{ session_index: number; body: string }>(
    `SELECT s.session_index, t.body
       FROM aba_trials t JOIN aba_sessions s ON s.id = t.session_id AND s.child_id = t.child_id
      WHERE t.child_id = ? AND t.target_id = ?
      ORDER BY s.session_index, t.seq`,
    [childId, targetId],
  );
  const bySession = new Map<number, AbaTrial[]>();
  for (const r of rows) bySession.set(r.session_index, [...(bySession.get(r.session_index) ?? []), JSON.parse(r.body)]);
  return [...bySession.entries()].map(([index, trials]) => ({ index, trials })).slice(-limit);
}
