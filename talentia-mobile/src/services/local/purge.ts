/**
 * Удаление и экспорт на устройстве. Спецификация — PARENT.md, «Удаление и экспорт».
 *
 * Журналы удалить обычным запросом нельзя (`schema.ts`). Эти функции — единственный
 * путь: они открывают `purge_gate` для одного ребёнка (или `*` — для всего) внутри одной
 * транзакции и закрывают его в той же транзакции. Без корзины и «7 дней на
 * восстановление»: данные ребёнка не держат в корзине.
 */
import type { ConsentEvent } from '../../domain/consent';
import { readConsentLog } from './consentLog';
import { RETENTION_MONTHS } from './schema';
import type { SqlDb } from './sql';

const JOURNALS = ['aba_trials', 'aba_sessions', 'lesson_runs'] as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function withGate(db: SqlDb, id: string, fn: () => Promise<void>): Promise<void> {
  await db.transaction(async () => {
    await db.run('INSERT INTO purge_gate (child_id) VALUES (?)', [id]);
    await fn();
    await db.run('DELETE FROM purge_gate WHERE child_id = ?', [id]);
  });
  await compactAfterDelete(db);
}

/**
 * Удалённое не должно оставаться на диске: страницы затирает `secure_delete`, а журнал
 * WAL после удаления сжимается до нуля.
 */
export async function compactAfterDelete(db: SqlDb): Promise<void> {
  await db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
}

/** Граница срока хранения: всё раньше неё удаляется (`RETENTION_MONTHS`). */
export function retentionCutoff(now: Date, months = RETENTION_MONTHS): string {
  const d = new Date(now.getTime());
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString();
}

/**
 * Удалить журналы старше срока хранения — при старте приложения. Только их: база
 * пускает удаление по сроку, но не по выбору.
 */
export async function applyRetention(db: SqlDb, now: Date): Promise<number> {
  const before = retentionCutoff(now);
  let removed = 0;
  await db.transaction(async () => {
    await db.run('INSERT INTO retention_gate (before) VALUES (?)', [before]);
    for (const [t, col] of [
      ['aba_trials', 'recorded_at'],
      ['aba_sessions', 'recorded_at'],
      ['lesson_runs', 'started_at'],
    ] as const) {
      removed += (await db.run(`DELETE FROM ${t} WHERE ${col} < ?`, [before])).changes;
    }
    await db.run('DELETE FROM retention_gate');
  });
  if (removed) await compactAfterDelete(db);
  return removed;
}

/**
 * Удалить ребёнка из базы: пробы, сессии, прохождения, состояние, курсоры. Журнал
 * согласий остаётся доказательством, что согласие было получено и отозвано, — с
 * псевдонимом вместо id ребёнка. Псевдоним — **случайный uuid**, не хеш от id: хеш
 * связывается обратно. Вызывается из `deleteChildEverywhere`, после того как отзыв дошёл
 * до сервера.
 */
export async function purgeChild(db: SqlDb, childId: string, childPseudonym: string): Promise<void> {
  if (childPseudonym === childId) throw new Error('Псевдоним совпадает с id ребёнка');
  if (!UUID.test(childPseudonym)) throw new Error('Псевдоним — случайный uuid');
  await withGate(db, childId, async () => {
    for (const t of JOURNALS) await db.run(`DELETE FROM ${t} WHERE child_id = ?`, [childId]);
    await db.run('DELETE FROM child_state WHERE child_id = ?', [childId]);
    await db.run('DELETE FROM sync_cursor WHERE child_id = ?', [childId]);
    await db.run('DELETE FROM sync_problems WHERE child_id = ?', [childId]);
    await db.run('UPDATE consent_events SET child_id = ? WHERE child_id = ?', [childPseudonym, childId]);
  });
}

/**
 * Очистить прогресс — профиль остаётся. Родители просят это чаще удаления. Согласия не
 * трогаются; курсоры синхронизации начинаются заново.
 */
export async function clearChildProgress(db: SqlDb, childId: string): Promise<void> {
  await withGate(db, childId, async () => {
    for (const t of JOURNALS) await db.run(`DELETE FROM ${t} WHERE child_id = ?`, [childId]);
    await db.run('DELETE FROM child_state WHERE child_id = ?', [childId]);
    await db.run('DELETE FROM sync_cursor WHERE child_id = ?', [childId]);
  });
}

/**
 * Все строки аккаунта прочь, включая журнал согласий: он переживает удаление на
 * сервере, с псевдонимами, — об этом говорит экран удаления. При удалении аккаунта после
 * этого удаляется и сам файл (`deleteLocalDb`).
 */
export async function wipeDevice(db: SqlDb): Promise<void> {
  await withGate(db, '*', async () => {
    for (const t of [...JOURNALS, 'consent_events', 'child_state', 'sync_cursor', 'consent_delivered', 'sync_problems']) {
      await db.run(`DELETE FROM ${t}`);
    }
  });
}

export type ChildExport = {
  childId: string;
  exportedAt: string;
  /** Профиль (имя в игре, полоса, язык, режим) — он не в SQLite, его передаёт вызывающий. */
  profile: Record<string, unknown>;
  abaTrials: unknown[];
  abaSessions: unknown[];
  lessonRuns: unknown[];
  state: Record<string, unknown>;
  consentEvents: ConsentEvent[];
};

/**
 * Экспорт для родителя — буквально всё, что о ребёнке есть на устройстве: профиль,
 * прохождения, навыки и прочее состояние, пробы ABA, согласия ребёнка и аккаунта (база —
 * своя у аккаунта, чужих согласий в ней нет). Собирается локально одной транзакцией и
 * отдаётся файлом (JSON; CSV строится из того же). Экспорт для специалиста — отдельный,
 * без данных взрослых.
 */
export async function exportChild(
  db: SqlDb,
  childId: string,
  exportedAt: string,
  profile: Record<string, unknown>,
): Promise<ChildExport> {
  return db.transaction(() => collectExport(db, childId, exportedAt, profile));
}

async function collectExport(
  db: SqlDb,
  childId: string,
  exportedAt: string,
  profile: Record<string, unknown>,
): Promise<ChildExport> {
  const bodies = async (table: string) =>
    (await db.all<{ body: string }>(`SELECT body FROM ${table} WHERE child_id = ? ORDER BY seq`, [childId])).map((r) =>
      JSON.parse(r.body),
    );
  const state = Object.fromEntries(
    (await db.all<{ key: string; body: string }>('SELECT key, body FROM child_state WHERE child_id = ?', [childId])).map(
      (r) => [r.key, JSON.parse(r.body)],
    ),
  );
  return {
    childId,
    exportedAt,
    profile,
    abaTrials: await bodies('aba_trials'),
    abaSessions: await bodies('aba_sessions'),
    lessonRuns: await bodies('lesson_runs'),
    state,
    consentEvents: (await readConsentLog(db)).filter((e) => e.childId === childId || e.childId === null),
  };
}
