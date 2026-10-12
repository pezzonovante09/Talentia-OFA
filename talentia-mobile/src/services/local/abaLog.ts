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
 * Обе ошибки — штатный ход, а не сбой: в отчёты об ошибках их не отправлять, само сообщение
 * связывает устройство с ABA-режимом (ABA.md, «Согласие `aba_processing`»).
 */
import type { AbaIoaRecord, AbaRoutineRun, AbaSession, AbaTrial } from '../../types/aba';
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

/**
 * IOA для сессии, которой нет на устройстве (не записана, удалена отзывом или сроком хранения).
 * Срок хранения IOA считается по дате сессии — без сессии запись пережила бы её; экран
 * предлагает выбрать сессию заново.
 */
export class AbaSessionMissingError extends Error {
  constructor(readonly sessionId: string) {
    super('Нет сессии для IOA: запись не сделана');
  }
}

/**
 * Доску изменила другая процедура (рутина) между сверкой сессии и этой записью: не записано
 * ничего. Экран возобновляет сессию (`resumeAbaSession`) и повторяет шаг по живой доске.
 */
export class AbaBoardConflictError extends Error {
  constructor(
    readonly expectedRev: number,
    readonly actualRev: number,
  ) {
    super('Доска жетонов изменилась: шаг не записан, сессию нужно возобновить');
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
 * Запись данных ABA ребёнка: проверка согласия и паузы, ворота открыты только на время
 * `fn` и закрываются в той же транзакции. Транзакцию открывает сама — вызов на `tx`
 * идёт в той же, вызов на базе открывает свою: сбой внутри откатывает и ворота.
 */
export async function withAbaWrite(db: SqlDb, childId: string, fn: (tx: SqlDb) => Promise<void>): Promise<void> {
  await db.transaction(async (tx) => {
    await requireAbaConsent(tx, childId);
    await tx.run('INSERT INTO aba_write_gate (child_id) VALUES (?)', [childId]);
    await fn(tx);
    await tx.run('DELETE FROM aba_write_gate WHERE child_id = ?', [childId]);
  });
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

/** Прогон рутины — кирпич для `commit.ts` (раунд 2, Р3). */
export async function appendRoutineRun(db: SqlDb, childId: string, run: AbaRoutineRun, recordedAt: string): Promise<void> {
  await db.run(
    'INSERT INTO aba_routine_runs (child_id, id, target_id, day, body, recorded_at) VALUES (?, ?, ?, ?, ?, ?)',
    [childId, run.id, run.targetId, run.day, JSON.stringify(run), recordedAt],
  );
}

export type ReinforcerChoice = {
  source: 'session' | 'routine';
  sourceId: string;
  reinforcerId: string;
  chosenBy: 'child' | 'adult';
};

/**
 * Выбор подкрепителя — в историю в момент выбора (только дописывание). Кирпич для `commit.ts`.
 * Пустой `reinforcerId` (выбора не было) не пишется.
 */
export async function appendReinforcerChoice(db: SqlDb, childId: string, c: ReinforcerChoice, chosenAt: string): Promise<void> {
  if (!c.reinforcerId) throw new Error('Выбор без подкрепителя в историю не пишется');
  // порядок истории — по строке chosen_at: формат один (UTC, миллисекунды), иначе сравнение собьётся
  const at = new Date(chosenAt);
  if (Number.isNaN(at.getTime())) throw new Error('Время выбора — не дата');
  await db.run(
    'INSERT INTO aba_reinforcer_choices (child_id, chosen_at, source, source_id, reinforcer_id, chosen_by) VALUES (?, ?, ?, ?, ?, ?)',
    [childId, at.toISOString(), c.source, c.sourceId, c.reinforcerId, c.chosenBy],
  );
}

/**
 * История выборов подкрепителя, свежие в конце: по времени выбора, затем по порядку записи. Входит
 * любой выбор, в том числе взрослого. Читать в той же транзакции, где считаются варианты.
 */
export async function reinforcerHistoryOf(db: SqlDb, childId: string): Promise<string[]> {
  return (
    await db.all<{ reinforcer_id: string }>(
      'SELECT reinforcer_id FROM aba_reinforcer_choices WHERE child_id = ? ORDER BY chosen_at, seq',
      [childId],
    )
  ).map((r) => r.reinforcer_id);
}

/**
 * Был ли после `sinceMs` обмен рутины — прогон с `exchanged > 0`, зафиксированный позже. По журналу
 * прогонов, а не выборов: обмен, после которого приложение убили до выбора, тоже обмен.
 */
export async function routineExchangedSince(db: SqlDb, childId: string, sinceMs: number): Promise<boolean> {
  // по времени фиксации (recorded_at), а не конца последнего звена: между ними идут выбор «где и с
  // кем» и PIN, и сессия, возобновлённая в этом промежутке, обмена иначе не заметила бы
  const rows = await db.all<{ n: number }>(
    "SELECT 1 AS n FROM aba_routine_runs WHERE child_id = ? AND json_extract(body, '$.exchanged') > 0 AND recorded_at > ? LIMIT 1",
    [childId, new Date(sinceMs).toISOString()],
  );
  return rows.length > 0;
}

/** Обмен рутины, после которого выбор подкрепителя не сделан (приложение убили): прогон и его варианты. */
export type PendingRoutineExchange = { runId: string; tokens: number; options: string[] };

export async function pendingRoutineExchanges(db: SqlDb, childId: string): Promise<PendingRoutineExchange[]> {
  const runs = await db.all<{ body: string }>(
    `SELECT body FROM aba_routine_runs
      WHERE child_id = ? AND json_extract(body, '$.exchanged') > 0
        AND id NOT IN (SELECT source_id FROM aba_reinforcer_choices WHERE child_id = ? AND source = 'routine')
      ORDER BY seq`,
    [childId, childId],
  );
  return parse<AbaRoutineRun>(runs).map((r) => ({ runId: r.id, tokens: r.exchanged, options: r.exchangeOptions ?? [] }));
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

/** Запись IOA — отдельный журнал (вносится после сессии). Кирпич для `commit.ts`. */
export async function appendIoa(db: SqlDb, childId: string, record: AbaIoaRecord, recordedAt: string): Promise<void> {
  await db.run('INSERT INTO aba_ioa (child_id, id, session_id, body, recorded_at) VALUES (?, ?, ?, ?, ?)', [
    childId,
    record.id,
    record.sessionId,
    JSON.stringify(record),
    recordedAt,
  ]);
}

/** Записи IOA сессии ребёнка. */
export async function ioaOfSession(db: SqlDb, childId: string, sessionId: string): Promise<AbaIoaRecord[]> {
  return parse(
    await db.all<{ body: string }>('SELECT body FROM aba_ioa WHERE child_id = ? AND session_id = ? ORDER BY seq', [
      childId,
      sessionId,
    ]),
  );
}

/** Прогоны рутины ребёнка в порядке записи. */
export async function routineRunsOf(db: SqlDb, childId: string, targetId?: string): Promise<AbaRoutineRun[]> {
  return parse(
    targetId
      ? await db.all<{ body: string }>('SELECT body FROM aba_routine_runs WHERE child_id = ? AND target_id = ? ORDER BY seq', [childId, targetId])
      : await db.all<{ body: string }>('SELECT body FROM aba_routine_runs WHERE child_id = ? ORDER BY seq', [childId]),
  );
}
