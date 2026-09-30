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
import type { SqlDb } from './sql';

const JOURNALS = ['aba_trials', 'aba_sessions', 'lesson_runs'] as const;

async function withGate(db: SqlDb, id: string, fn: () => Promise<void>): Promise<void> {
  await db.transaction(async () => {
    await db.run('INSERT INTO purge_gate (child_id) VALUES (?)', [id]);
    await fn();
    await db.run('DELETE FROM purge_gate WHERE child_id = ?', [id]);
  });
}

/**
 * Удалить ребёнка с устройства: пробы, сессии, прохождения, состояние, курсоры. Журнал
 * согласий остаётся доказательством, что согласие было получено и отозвано, — с
 * псевдонимом вместо id ребёнка.
 */
export async function purgeChild(db: SqlDb, childId: string, childPseudonym: string): Promise<void> {
  if (childPseudonym === childId) throw new Error('Псевдоним совпадает с id ребёнка');
  await withGate(db, childId, async () => {
    for (const t of JOURNALS) await db.run(`DELETE FROM ${t} WHERE child_id = ?`, [childId]);
    await db.run('DELETE FROM child_state WHERE child_id = ?', [childId]);
    await db.run('DELETE FROM sync_cursor WHERE child_id = ?', [childId]);
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
 * Удаление аккаунта: на устройстве не остаётся ничего, включая журнал согласий. Он
 * переживает удаление на сервере, с псевдонимами, — об этом говорит экран удаления.
 */
export async function wipeDevice(db: SqlDb): Promise<void> {
  await withGate(db, '*', async () => {
    for (const t of [...JOURNALS, 'consent_events', 'child_state', 'sync_cursor']) await db.run(`DELETE FROM ${t}`);
  });
}

export type ChildExport = {
  childId: string;
  exportedAt: string;
  abaTrials: unknown[];
  abaSessions: unknown[];
  lessonRuns: unknown[];
  state: Record<string, unknown>;
  consentEvents: ConsentEvent[];
};

/**
 * Экспорт — буквально всё, что о ребёнке есть на устройстве, собирается локально и
 * отдаётся файлом (JSON; CSV строится из того же).
 */
export async function exportChild(db: SqlDb, childId: string, exportedAt: string): Promise<ChildExport> {
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
    abaTrials: await bodies('aba_trials'),
    abaSessions: await bodies('aba_sessions'),
    lessonRuns: await bodies('lesson_runs'),
    state,
    consentEvents: (await readConsentLog(db)).filter((e) => e.childId === childId || e.childId === null),
  };
}
