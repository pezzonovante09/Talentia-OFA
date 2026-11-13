/**
 * Накат миграции 17 на базу версии 16 С ДАННЫМИ (фаза 8, №172 п. 2): таблица `aba_session_tails` —
 * хвост конца сессии. Данные версии 16 не теряются, новая таблица под теми же охранами, что прогоны:
 * вставка только через ворота согласия, только дописывание, удаление — по ребёнку или сроку, отзыв
 * согласия при оставшемся хвосте база не принимает. Строк на сессию может быть несколько (уход, затем
 * доигранный возврат): уникальности нет, чтение идёт по индексу, действует последняя по `seq`.
 */
import { CURRENT_CONSENT_TEXTS } from '../../../domain/consentTexts';
import type { ConsentEvent } from '../../../domain/consent';
import { insertConsentEvent } from '../consentLog';
import { MIGRATIONS, migrate } from '../schema';
import type { SqlDb } from '../sql';
import { asAbaWriter, memoryDb } from './nodeSql';

const ABA_TEXT = CURRENT_CONSENT_TEXTS.aba_processing[0];

const revoke = (childId = 'kid'): ConsentEvent => ({
  id: `aba-revoke-${childId}`,
  scope: 'aba_processing',
  action: 'revoke',
  childId,
  textVersion: ABA_TEXT,
  confirmedBy: 'pin',
  actorId: 'parent',
  at: '2026-11-06T12:00:00.000Z',
});

const TABLES_V16 = [
  'aba_trials',
  'aba_sessions',
  'aba_ioa',
  'aba_routine_runs',
  'aba_reinforcer_choices',
  'aba_trial_corrections',
  'aba_routine_run_amendments',
  'aba_pairing_sessions',
  'lesson_runs',
  'child_state',
  'consent_events',
  'sync_cursor',
  'sync_problems',
  'retention_clock',
] as const;

async function dump(db: SqlDb): Promise<Record<string, unknown[]>> {
  const out: Record<string, unknown[]> = {};
  for (const t of TABLES_V16) out[t] = await db.all(`SELECT * FROM ${t} ORDER BY 1, 2`);
  return out;
}

const userVersion = async (db: SqlDb) => (await db.all<{ user_version: number }>('PRAGMA user_version'))[0].user_version;
const tailCount = async (db: SqlDb, childId?: string) =>
  (await db.all<{ n: number }>(`SELECT COUNT(*) AS n FROM aba_session_tails ${childId ? 'WHERE child_id = ?' : ''}`, childId ? [childId] : []))[0].n;

/** База «как была на версии 16»: сессия с пробой, доска, номер сессии, свёрнутая сессия, согласие на ABA. */
async function v16WithData(): Promise<SqlDb> {
  const db = await memoryDb(16);
  await asAbaWriter(db, 'kid', async (tx) => {
    await tx.run("INSERT INTO aba_sessions (child_id, id, session_index, body, recorded_at) VALUES ('kid', 's-1', 1, '{\"id\":\"s-1\"}', '2026-11-01T10:00:00.000Z')");
    await tx.run("INSERT INTO aba_trials (child_id, id, session_id, target_id, body, recorded_at) VALUES ('kid', 'tr-1', 's-1', 'A', '{\"x\":1}', '2026-11-01T10:01:00.000Z')");
    await tx.run("INSERT INTO child_state (child_id, key, body, updated_at) VALUES ('kid', 'abaBoard', '{\"earned\":1,\"nonContingent\":0,\"rev\":2}', '2026-11-01T10:05:00.000Z')");
    await tx.run("INSERT INTO child_state (child_id, key, body, updated_at) VALUES ('kid', 'abaSessionIndex', '2', '2026-11-01T10:05:00.000Z')");
    await tx.run(
      "INSERT INTO child_state (child_id, key, body, updated_at) VALUES ('kid', 'abaSessionInProgress', '{\"sessionId\":\"s-2\",\"startedAt\":1762424400000}', '2026-11-06T09:00:00.000Z')",
    );
  });
  await db.run(
    `INSERT INTO consent_events (id, scope, action, child_id, text_version, confirmed_by, actor_id, at)
     VALUES ('c-1', 'aba_processing', 'grant', 'kid', ?, 'biometric', 'parent', '2026-11-01T08:00:00.000Z')`,
    [ABA_TEXT],
  );
  return db;
}

/** База версии 17 (после наката) с теми же данными. */
async function migrated(): Promise<SqlDb> {
  const db = await v16WithData();
  await migrate(db);
  return db;
}

const TAIL_BODY = JSON.stringify({
  sessionId: 's-1',
  accessScene: [{ startedAt: '2026-11-01T10:06:00.000Z', endedAt: '2026-11-01T10:06:30.000Z' }],
  pairingTokenAt: null,
  leftAtStep: null,
  leftAt: null,
  completed: true,
});

const insertTail = (tx: SqlDb, over: { childId?: string; sessionId?: string; recordedAt?: string } = {}) =>
  tx.run('INSERT INTO aba_session_tails (child_id, session_id, body, recorded_at) VALUES (?, ?, ?, ?)', [
    over.childId ?? 'kid',
    over.sessionId ?? 's-1',
    TAIL_BODY,
    over.recordedAt ?? '2026-11-01T10:07:00.000Z',
  ]);

const revokeTriggerSql = async (db: SqlDb) =>
  (await db.all<{ sql: string }>("SELECT sql FROM sqlite_master WHERE name = 'consent_events_aba_revoke_needs_purge'"))[0].sql;
const tablesIn = (sql: string) => [...sql.matchAll(/EXISTS \(SELECT 1 FROM (\w+) WHERE/g)].map((m) => m[1]).filter((t) => t !== 'child_state');
const keysIn = (sql: string) => {
  const m = /key IN\s*\(([^)]*)\)/.exec(sql);
  return m ? [...m[1].matchAll(/'(\w+)'/g)].map((k) => k[1]) : [];
};
const triggers = async (db: SqlDb) =>
  (await db.all<{ name: string; sql: string }>("SELECT name, sql FROM sqlite_master WHERE type = 'trigger' ORDER BY name")).filter(
    (t) => t.name !== 'consent_events_aba_revoke_needs_purge',
  );

describe('накат миграции 17 на базе версии 16 с данными', () => {
  it('фиксатор: база версии 16 без таблицы хвостов, триггер отзыва о ней не знает', async () => {
    const db = await v16WithData();
    expect([await userVersion(db), (await db.all("SELECT 1 FROM sqlite_master WHERE name = 'aba_session_tails'")).length]).toEqual([16, 0]);
    expect(await revokeTriggerSql(db)).not.toContain('aba_session_tails');
  });

  it('база после наката — последняя версия (MIGRATIONS.length, не меньше 17)', async () => {
    const db = await migrated();
    expect(MIGRATIONS.length).toBeGreaterThanOrEqual(17);
    expect(await userVersion(db)).toBe(MIGRATIONS.length);
  });

  it('данные версии 16 целы: ни одна строка таблиц версии 16 не потеряна и не изменена', async () => {
    const db = await v16WithData();
    const before = await dump(db);
    await migrate(db);
    expect(await dump(db)).toEqual(before);
  });

  it('снимок свёрнутой сессии и его updated_at не тронуты: момент ухода в фон хранится там, отдельного ключа нет', async () => {
    const db = await migrated();
    expect(await db.all("SELECT body, updated_at FROM child_state WHERE child_id = 'kid' AND key = 'abaSessionInProgress'")).toEqual([
      { body: '{"sessionId":"s-2","startedAt":1762424400000}', updated_at: '2026-11-06T09:00:00.000Z' },
    ]);
    expect(await db.all("SELECT key FROM child_state WHERE child_id = 'kid' ORDER BY key")).toEqual([
      { key: 'abaBoard' },
      { key: 'abaSessionInProgress' },
      { key: 'abaSessionIndex' },
    ]);
  });

  it('повторное открытие базы ничего не меняет и не падает', async () => {
    const db = await migrated();
    const once = { ...(await dump(db)), aba_session_tails: await db.all('SELECT * FROM aba_session_tails') };
    await migrate(db);
    expect({ ...(await dump(db)), aba_session_tails: await db.all('SELECT * FROM aba_session_tails') }).toEqual(once);
    expect(await userVersion(db)).toBe(MIGRATIONS.length);
  });

  it('триггер отзыва пересоздан: все прежние таблицы на месте плюс aba_session_tails, ключи состояния те же', async () => {
    const db = await v16WithData();
    const v16 = await revokeTriggerSql(db);
    await migrate(db);
    const v17 = await revokeTriggerSql(db);
    expect(tablesIn(v16)).toContain('aba_pairing_sessions'); // предпосылка: разбор SQL работает и видит таблицу 16
    expect(tablesIn(v17)).toEqual([...tablesIn(v16), 'aba_session_tails']);
    expect(keysIn(v17)).toEqual(keysIn(v16));
    expect(keysIn(v16).length).toBeGreaterThanOrEqual(12);
  });

  it('прочие триггеры версии 16 не тронуты, добавлены ровно три триггера хвостов', async () => {
    const db = await v16WithData();
    const before = await triggers(db);
    await migrate(db);
    const after = await triggers(db);
    expect(after.filter((t) => !t.name.startsWith('aba_session_tails_'))).toEqual(before);
    expect(after.filter((t) => t.name.startsWith('aba_session_tails_')).map((t) => t.name)).toEqual([
      'aba_session_tails_need_consent',
      'aba_session_tails_no_delete',
      'aba_session_tails_no_update',
    ]);
  });
});

describe('aba_session_tails после миграции 17', () => {
  it('таблица создана и пуста', async () => {
    const db = await migrated();
    expect(await db.all('SELECT * FROM aba_session_tails')).toEqual([]);
  });

  it('вставка мимо ворот согласия отклоняется базой — и при согласии ребёнка в журнале', async () => {
    const db = await migrated();
    await expect(insertTail(db)).rejects.toThrow(/только через commit\.ts/);
    expect(await tailCount(db)).toBe(0);
  });

  it('вставка при воротах, открытых для другого ребёнка, отклоняется', async () => {
    const db = await migrated();
    await expect(asAbaWriter(db, 'sib', (tx) => insertTail(tx).then(() => undefined))).rejects.toThrow(/только через commit\.ts/);
    expect(await tailCount(db)).toBe(0);
  });

  it('через ворота записывается, тело читается как есть', async () => {
    const db = await migrated();
    await asAbaWriter(db, 'kid', (tx) => insertTail(tx).then(() => undefined));
    expect(await db.all("SELECT child_id, session_id, body, recorded_at FROM aba_session_tails")).toEqual([
      { child_id: 'kid', session_id: 's-1', body: TAIL_BODY, recorded_at: '2026-11-01T10:07:00.000Z' },
    ]);
  });

  it('две строки одной сессии разрешены: уход, затем доигранный возврат; порядок — seq', async () => {
    const db = await migrated();
    await asAbaWriter(db, 'kid', (tx) => insertTail(tx).then(() => undefined));
    await asAbaWriter(db, 'kid', (tx) => insertTail(tx, { recordedAt: '2026-11-01T10:08:00.000Z' }).then(() => undefined));
    expect(await db.all('SELECT recorded_at FROM aba_session_tails ORDER BY seq')).toEqual([
      { recorded_at: '2026-11-01T10:07:00.000Z' },
      { recorded_at: '2026-11-01T10:08:00.000Z' },
    ]);
  });

  it('индекс aba_session_tails_by_session есть: (child_id, session_id, seq), не уникальный, и других индексов с уникальностью нет', async () => {
    const db = await migrated();
    const columns = await db.all<{ name: string }>("SELECT name FROM pragma_index_info('aba_session_tails_by_session') ORDER BY seqno");
    expect(columns.map((c) => c.name)).toEqual(['child_id', 'session_id', 'seq']);
    const indexes = await db.all<{ name: string; unique: number }>("SELECT name, \"unique\" FROM pragma_index_list('aba_session_tails')");
    expect(indexes.find((i) => i.name === 'aba_session_tails_by_session')).toMatchObject({ unique: 0 });
    expect(indexes.filter((i) => i.unique === 1)).toEqual([]);
  });

  it('чтение хвостов сессии идёт по индексу, а не перебором таблицы', async () => {
    const db = await migrated();
    const plan = await db.all<{ detail: string }>("EXPLAIN QUERY PLAN SELECT body FROM aba_session_tails WHERE child_id = 'kid' AND session_id = 's-1' ORDER BY seq");
    expect(plan.map((p) => p.detail).join('; ')).toContain('aba_session_tails_by_session');
  });

  it('другая сессия того же ребёнка и та же сессия другого ребёнка пишутся', async () => {
    const db = await migrated();
    await asAbaWriter(db, 'kid', (tx) => insertTail(tx).then(() => undefined));
    await asAbaWriter(db, 'kid', (tx) => insertTail(tx, { sessionId: 's-2' }).then(() => undefined));
    await asAbaWriter(db, 'sib', (tx) => insertTail(tx, { childId: 'sib' }).then(() => undefined));
    expect(await tailCount(db)).toBe(3);
  });

  it('журнал только дописывается: UPDATE и DELETE отклоняются', async () => {
    const db = await migrated();
    await asAbaWriter(db, 'kid', (tx) => insertTail(tx).then(() => undefined));
    await expect(db.run("UPDATE aba_session_tails SET body = '{}'")).rejects.toThrow(/только дописывание/);
    await expect(db.run('DELETE FROM aba_session_tails')).rejects.toThrow(/только дописывание/);
    expect(await db.all('SELECT body FROM aba_session_tails')).toEqual([{ body: TAIL_BODY }]);
  });

  it('UPDATE отклоняется и при открытых воротах удаления ребёнка', async () => {
    const db = await migrated();
    await asAbaWriter(db, 'kid', (tx) => insertTail(tx).then(() => undefined));
    await expect(
      db.transaction(async (tx) => {
        await tx.run("INSERT INTO purge_gate (child_id) VALUES ('kid')");
        await tx.run("UPDATE aba_session_tails SET body = '{}' WHERE child_id = 'kid'");
      }),
    ).rejects.toThrow(/только дописывание/);
    expect(await db.all('SELECT body FROM aba_session_tails')).toEqual([{ body: TAIL_BODY }]);
  });

  it('purge_gate чужого ребёнка не пускает удаление, своего — пускает', async () => {
    const db = await migrated();
    await asAbaWriter(db, 'kid', (tx) => insertTail(tx).then(() => undefined));
    await db.run("INSERT INTO purge_gate (child_id) VALUES ('sib')");
    await expect(db.run("DELETE FROM aba_session_tails WHERE child_id = 'kid'")).rejects.toThrow(/только дописывание/);
    await db.run("DELETE FROM purge_gate WHERE child_id = 'sib'");
    expect(await tailCount(db, 'kid')).toBe(1);

    await db.run("INSERT INTO purge_gate (child_id) VALUES ('kid')");
    await db.run("DELETE FROM aba_session_tails WHERE child_id = 'kid'");
    await db.run("DELETE FROM purge_gate WHERE child_id = 'kid'");
    expect(await tailCount(db, 'kid')).toBe(0);
  });

  it('retention_gate: граница раньше recorded_at — отклонено, позже — удалено', async () => {
    const db = await migrated();
    await asAbaWriter(db, 'kid', (tx) => insertTail(tx).then(() => undefined));
    await db.run("INSERT INTO retention_gate (before) VALUES ('2026-10-01T00:00:00.000Z')");
    await expect(db.run('DELETE FROM aba_session_tails')).rejects.toThrow(/только дописывание/); // запись свежее границы
    await db.run('DELETE FROM retention_gate');
    expect(await tailCount(db)).toBe(1);

    await db.run("INSERT INTO retention_gate (before) VALUES ('2026-12-01T00:00:00.000Z')");
    await db.run('DELETE FROM aba_session_tails');
    await db.run('DELETE FROM retention_gate');
    expect(await tailCount(db)).toBe(0);
  });

  it('retention_gate: запись ровно на границе не удаляется (граница — строго «раньше»)', async () => {
    const db = await migrated();
    await asAbaWriter(db, 'kid', (tx) => insertTail(tx).then(() => undefined));
    await db.run("INSERT INTO retention_gate (before) VALUES ('2026-11-01T10:07:00.000Z')");
    await expect(db.run('DELETE FROM aba_session_tails')).rejects.toThrow(/только дописывание/);
    await db.run('DELETE FROM retention_gate');
    expect(await tailCount(db)).toBe(1);
  });

  it('отзыв согласия блокируется одним лишь хвостом: данные удаляются вместе с отзывом', async () => {
    const db = await memoryDb(16, { account: false });
    await migrate(db);
    await db.run(
      `INSERT INTO consent_events (id, scope, action, child_id, text_version, confirmed_by, actor_id, at)
       VALUES ('c-1', 'aba_processing', 'grant', 'kid', ?, 'biometric', 'parent', '2026-11-01T08:00:00.000Z')`,
      [ABA_TEXT],
    );
    await asAbaWriter(db, 'kid', (tx) => insertTail(tx).then(() => undefined));
    // предпосылка: кроме хвоста, отзыву мешать нечему
    expect(await db.all("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'aba_%' AND name NOT IN ('aba_session_tails', 'aba_write_gate')")).not.toEqual([]);
    expect((await db.all("SELECT 1 FROM child_state WHERE child_id = 'kid'")).length).toBe(0);
    await expect(db.transaction((tx) => insertConsentEvent(tx, revoke(), 'owner'))).rejects.toThrow(/вместе с удалением/);
    expect(await tailCount(db, 'kid')).toBe(1);

    // после удаления хвоста по праву на удаление отзыв принимается — отклонял именно он
    await db.transaction(async (tx) => {
      await tx.run("INSERT INTO purge_gate (child_id) VALUES ('kid')");
      await tx.run("DELETE FROM aba_session_tails WHERE child_id = 'kid'");
      await tx.run("DELETE FROM purge_gate WHERE child_id = 'kid'");
    });
    await db.transaction((tx) => insertConsentEvent(tx, revoke(), 'owner'));
    expect(await db.all("SELECT action FROM consent_events WHERE scope = 'aba_processing' ORDER BY seq")).toEqual([{ action: 'grant' }, { action: 'revoke' }]);
  });

  it('хвост другого ребёнка отзыву этого не мешает', async () => {
    const db = await memoryDb(16, { account: false });
    await migrate(db);
    await db.run(
      `INSERT INTO consent_events (id, scope, action, child_id, text_version, confirmed_by, actor_id, at)
       VALUES ('c-1', 'aba_processing', 'grant', 'kid', ?, 'biometric', 'parent', '2026-11-01T08:00:00.000Z')`,
      [ABA_TEXT],
    );
    await asAbaWriter(db, 'sib', (tx) => insertTail(tx, { childId: 'sib' }).then(() => undefined));
    await db.transaction((tx) => insertConsentEvent(tx, revoke(), 'owner'));
    expect(await tailCount(db, 'sib')).toBe(1);
  });
});
