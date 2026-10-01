/**
 * Журнал проб и сессий ABA на устройстве. Спецификация — ABA.md, «Данные» и «Хранение».
 *
 * Каждая проба пишется сразу, отдельной строкой, без троттлинга и без пачек: прогресс
 * считается только отсюда, а не из сводных полей живой сессии — они приблизительны по
 * построению. Противоречивая проба (`trialInvariantErrors`) в журнал не попадает.
 *
 * **Без согласия на данные ABA не пишется ничего** (`aba_processing`, решение владельца
 * 2026-10-01, №1), и на паузе тоже. Экраны пишут только через `commit.ts`: он вызывает
 * `withAbaWrite`, который проверяет согласие и паузу внутри той же эксклюзивной
 * транзакции, что и запись, — отзыв не проскочит между проверкой и вставкой. На время
 * записи открываются ворота `aba_write_gate`; без них вставку проб, сессий и состояния ABA
 * отклоняет сама база (`schema.ts`, миграция 3). `appendTrial` и `appendSession` —
 * кирпичи для `commit.ts`, а не вход для экранов.
 *
 * Обе ошибки — штатный ход, а не сбой: в Sentry их не отправлять, само сообщение связывает
 * устройство с ABA-режимом (ABA.md, «Согласие `aba_processing`»).
 */
import type { AbaSession, AbaTrial } from '../../types/aba';
import { trialInvariantErrors, type SessionTrials } from '../../domain/abaPrompting';
import { isGranted } from '../../domain/consent';
import { CURRENT_CONSENT_TEXTS } from '../../domain/consentTexts';
import { loadChildState } from './childState';
import { readConsentLog } from './consentLog';
import type { SqlDb } from './sql';

/** Согласия на данные ABA нет, оно отозвано или дано на прежний текст. Экран закрывает режим. */
export class AbaConsentRequiredError extends Error {
  constructor(readonly childId: string) {
    super('Нет согласия на данные ABA: проба не записана');
  }
}

/** Режим на паузе: сессию не начать, пробы не пишутся. */
export class AbaPausedError extends Error {
  constructor(readonly childId: string) {
    super('ABA на паузе: проба не записана');
  }
}

/** Согласие на текущий текст (любой язык) и не на паузе. Вызывать внутри транзакции записи. */
export async function requireAbaConsent(tx: SqlDb, childId: string): Promise<void> {
  if (!isGranted(await readConsentLog(tx), 'aba_processing', childId, CURRENT_CONSENT_TEXTS.aba_processing)) {
    throw new AbaConsentRequiredError(childId);
  }
  if (await loadChildState(tx, childId, 'abaPaused')) throw new AbaPausedError(childId);
}

/**
 * Запись данных ABA ребёнка внутри транзакции `tx`: проверка согласия и паузы, ворота
 * открыты только на время `fn` и закрываются в той же транзакции.
 */
export async function withAbaWrite(tx: SqlDb, childId: string, fn: () => Promise<void>): Promise<void> {
  await requireAbaConsent(tx, childId);
  await tx.run('INSERT INTO aba_write_gate (child_id) VALUES (?)', [childId]);
  await fn();
  await tx.run('DELETE FROM aba_write_gate WHERE child_id = ?', [childId]);
}

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
