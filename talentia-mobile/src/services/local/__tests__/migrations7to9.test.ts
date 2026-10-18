/**
 * Накат локальных миграций 8 и 9 на базу версии 7 С ДАННЫМИ (раунд 3) и триггер отзыва по журналу
 * выборов подкрепителя (миграция 9) отдельно от остальных причин блокировки.
 */
import { appendReinforcerChoice, reinforcerHistoryOf } from '../abaLog';
import type { ConsentEvent } from '../../../domain/consent';
import { appendConsentEvent, insertConsentEvent } from '../consentLog';
import { MIGRATIONS, migrate } from '../schema';
import type { SqlDb } from '../sql';
import { asAbaWriter, memoryDb } from './nodeSql';

const NOW = '2026-10-11T10:00:00Z';
const ABA_TEXT = 'ru-draft-1';

const abaConsent = (action: 'grant' | 'revoke', childId = 'kid', at = NOW): ConsentEvent => ({
  id: `aba-${action}-${childId}-${at}`,
  scope: 'aba_processing',
  action,
  childId,
  textVersion: ABA_TEXT,
  confirmedBy: 'biometric',
  actorId: 'parent',
  at,
});

const TABLES_V7 = ['aba_trials', 'aba_sessions', 'aba_ioa', 'lesson_runs', 'child_state', 'consent_events', 'sync_cursor'] as const;

/** Состояние всех таблиц, которые знала версия 7, как есть — для сравнения до и после наката. */
async function dump(db: SqlDb): Promise<Record<string, unknown[]>> {
  const out: Record<string, unknown[]> = {};
  for (const t of TABLES_V7) out[t] = await db.all(`SELECT * FROM ${t} ORDER BY 1, 2`);
  return out;
}

const session = (id: string, index: number, reinforcerId: string | undefined, chosenBy?: string) =>
  JSON.stringify({ id, index, reinforcerId, ...(chosenBy ? { reinforcerChosenBy: chosenBy } : {}) });

/** База «как была на версии 7»: два ребёнка, журналы, состояние, согласие и забытые открытые ворота. */
async function v7WithData(sessionOverride?: { id: string; body: string }): Promise<SqlDb> {
  const db = await memoryDb(7);
  await db.transaction(async (tx) => {
    await tx.run("INSERT INTO aba_write_gate (child_id) VALUES ('kid'), ('sib')");
    // сессии вставлены не по порядку номеров: перенос выборов идёт по session_index
    const rows: [string, string, number, string][] = [
      ['kid', 's-3', 3, session('s-3', 3, 'drum', 'adult')],
      ['kid', 's-1', 1, session('s-1', 1, 'puzzle')],
      ['kid', 's-2', 2, session('s-2', 2, '')],
      ['sib', 's-4', 4, session('s-4', 4, 'bubbles', 'child')],
      ['kid', 's-5', 5, session('s-5', 5, undefined)],
    ];
    for (const [child, id, index, body] of rows) {
      const b = sessionOverride && sessionOverride.id === id ? sessionOverride.body : body;
      await tx.run('INSERT INTO aba_sessions (child_id, id, session_index, body, recorded_at) VALUES (?, ?, ?, ?, ?)', [
        child,
        id,
        index,
        b,
        `2026-10-0${index}T10:00:00.000Z`,
      ]);
    }
    await tx.run("INSERT INTO aba_trials (child_id, id, session_id, target_id, body, recorded_at) VALUES ('kid', 'tr-1', 's-1', 'A', '{\"x\":1}', '2026-10-01T10:01:00.000Z')");
    await tx.run("INSERT INTO aba_ioa (child_id, id, session_id, body, recorded_at) VALUES ('kid', 'ioa-1', 's-1', '{\"y\":2}', '2026-10-02T10:00:00.000Z')");
    await tx.run("INSERT INTO lesson_runs (child_id, id, lesson_id, started_at, body) VALUES ('kid', 'lr-1', 'L1', '2026-10-01T09:00:00.000Z', '{}')");
    await tx.run("INSERT INTO child_state (child_id, key, body, updated_at) VALUES ('kid', 'abaSessionIndex', '5', '2026-10-05T10:00:00.000Z')");
    await tx.run("INSERT INTO sync_cursor (child_id, stream, position) VALUES ('kid', 'lesson_runs', '12')");
    await tx.run(
      `INSERT INTO consent_events (id, scope, action, child_id, text_version, confirmed_by, actor_id, at)
       VALUES ('c-1', 'aba_processing', 'grant', 'kid', ?, 'biometric', 'parent', '2026-10-01T08:00:00.000Z')`,
      [ABA_TEXT],
    );
    await tx.run("INSERT INTO purge_gate (child_id) VALUES ('sib')");
    await tx.run("INSERT INTO retention_gate (before) VALUES ('2000-01-01')");
  });
  return db;
}

describe('накат миграций 7 → 9 на базе с данными', () => {
  it('данные версии 7 целы: ни одна строка не потеряна и не изменена', async () => {
    const db = await v7WithData();
    const before = await dump(db);
    await migrate(db);
    expect(await dump(db)).toEqual(before);
  });

  it('user_version после наката — последняя версия (11)', async () => {
    const db = await v7WithData();
    await migrate(db);
    const [{ user_version }] = await db.all<{ user_version: number }>('PRAGMA user_version');
    expect([user_version, MIGRATIONS.length]).toEqual([11, 11]);
  });

  it('журнал выборов перенесён из сессий: по порядку номеров сессий, без пустых, chosen_by по умолчанию child', async () => {
    const db = await v7WithData();
    await migrate(db);
    const rows = await db.all(
      'SELECT child_id, chosen_at, source, source_id, reinforcer_id, chosen_by FROM aba_reinforcer_choices ORDER BY seq',
    );
    expect(rows).toEqual([
      { child_id: 'kid', chosen_at: '2026-10-01T10:00:00.000Z', source: 'session', source_id: 's-1', reinforcer_id: 'puzzle', chosen_by: 'child' },
      { child_id: 'kid', chosen_at: '2026-10-03T10:00:00.000Z', source: 'session', source_id: 's-3', reinforcer_id: 'drum', chosen_by: 'adult' },
      { child_id: 'sib', chosen_at: '2026-10-04T10:00:00.000Z', source: 'session', source_id: 's-4', reinforcer_id: 'bubbles', chosen_by: 'child' },
    ]);
  });

  it('история выборов ребёнка после наката читается API: свежие в конце, чужой ребёнок не примешан', async () => {
    const db = await v7WithData();
    await migrate(db);
    expect(await reinforcerHistoryOf(db, 'kid')).toEqual(['puzzle', 'drum']);
    expect(await reinforcerHistoryOf(db, 'sib')).toEqual(['bubbles']);
  });

  it('триггеры миграции 8 на месте', async () => {
    const db = await v7WithData();
    await migrate(db);
    const names = (await db.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'trigger'")).map((r) => r.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'aba_routine_runs_no_update',
        'aba_routine_runs_no_delete',
        'aba_routine_runs_need_consent',
        'child_state_aba_need_consent_insert',
        'child_state_aba_need_consent_update',
        'consent_events_aba_revoke_needs_purge',
      ]),
    );
  });

  it('триггеры миграции 8 действуют: прогон без ворот, правка и удаление прогона отклоняются', async () => {
    const db = await v7WithData();
    await migrate(db);
    const insert = "INSERT INTO aba_routine_runs (child_id, id, target_id, day, body, recorded_at) VALUES ('kid', 'r', 'R', '2026-10-11', '{}', '2026-10-11T08:00:00.000Z')";
    await expect(db.run(insert)).rejects.toThrow(/при согласии/);
    await asAbaWriter(db, 'kid', async (tx) => {
      await tx.run(insert);
    });
    await expect(db.run("UPDATE aba_routine_runs SET body = '{}'")).rejects.toThrow(/только дописывание/);
    await expect(db.run('DELETE FROM aba_routine_runs')).rejects.toThrow(/только дописывание/);
    await expect(
      db.run("INSERT INTO child_state (child_id, key, body, updated_at) VALUES ('kid', 'abaRoutineRunInProgress', '{}', ?)", [NOW]),
    ).rejects.toThrow(/при согласии/);
  });

  it('триггеры миграции 9 действуют: журнал выборов без ворот не пишется, не правится и не удаляется', async () => {
    const db = await v7WithData();
    await migrate(db);
    const insert = "INSERT INTO aba_reinforcer_choices (child_id, chosen_at, source, source_id, reinforcer_id, chosen_by) VALUES ('kid', '2026-10-11T08:00:00.000Z', 'routine', 'run-9', 'drum', 'child')";
    await expect(db.run(insert)).rejects.toThrow(/при согласии/);
    await expect(db.run("UPDATE aba_reinforcer_choices SET reinforcer_id = 'x'")).rejects.toThrow(/только дописывание/);
    await expect(db.run('DELETE FROM aba_reinforcer_choices')).rejects.toThrow(/только дописывание/);
  });

  it('отзыв согласия при оставшихся данных ABA после наката блокируется', async () => {
    const db = await v7WithData();
    await migrate(db);
    await expect(db.transaction((tx) => insertConsentEvent(tx, abaConsent('revoke', 'kid', '2026-10-12T09:00:00.000Z'), 'owner'))).rejects.toThrow(
      /вместе с удалением/,
    );
  });

  it('ворота, забытые открытыми в версии 7, после наката закрыты', async () => {
    const db = await v7WithData();
    expect(await db.all('SELECT child_id FROM aba_write_gate')).toHaveLength(2); // предпосылка
    await migrate(db);
    const gates = await Promise.all(['aba_write_gate', 'purge_gate', 'retention_gate'].map((t) => db.all(`SELECT * FROM ${t}`)));
    expect(gates).toEqual([[], [], []]);
  });

  it('сбой миграции 9 откатывает её целиком: версия 8, таблицы выборов нет, триггер отзыва прежний, данные целы', async () => {
    // выбор сессии с недопустимым chosen_by роняет перенос уже ПОСЛЕ CREATE TABLE
    const db = await v7WithData({ id: 's-3', body: session('s-3', 3, 'drum', 'robot') });
    const before = await dump(db);
    await expect(migrate(db)).rejects.toThrow();

    const [{ user_version }] = await db.all<{ user_version: number }>('PRAGMA user_version');
    expect(user_version).toBe(8);
    const tables = (await db.all<{ name: string }>("SELECT name FROM sqlite_master WHERE name LIKE 'aba_reinforcer_choices%'")).map((r) => r.name);
    expect(tables).toEqual([]);
    const [revoke] = await db.all<{ sql: string }>("SELECT sql FROM sqlite_master WHERE name = 'consent_events_aba_revoke_needs_purge'");
    expect(revoke.sql).not.toContain('aba_reinforcer_choices');
    expect(revoke.sql).toContain('aba_routine_runs'); // триггер версии 8, не потерян
    expect(await dump(db)).toEqual(before);
  });

  it('сбой миграции 9 не мешает миграции 8: прогоны рутин по-прежнему охраняются', async () => {
    const db = await v7WithData({ id: 's-3', body: session('s-3', 3, 'drum', 'robot') });
    // забытые ворота версии 7 закрывает только успешный накат; здесь он упал — закрываем вручную
    await db.exec('DELETE FROM aba_write_gate; DELETE FROM purge_gate; DELETE FROM retention_gate;');
    await expect(migrate(db)).rejects.toThrow();
    await expect(
      db.run("INSERT INTO aba_routine_runs (child_id, id, target_id, day, body, recorded_at) VALUES ('kid', 'r', 'R', '2026-10-11', '{}', ?)", [NOW]),
    ).rejects.toThrow(/при согласии/);
  });
});

describe('отзыв согласия блокируется журналом выборов подкрепителя сам по себе (миграция 9)', () => {
  /** База без `tokenTraining` и прочего состояния ABA: единственное, что мешает отзыву, — журнал выборов. */
  async function onlyChoices(source: 'session' | 'routine') {
    const db = await memoryDb();
    await appendConsentEvent(db, abaConsent('grant'), 'owner');
    await asAbaWriter(db, 'kid', (tx) =>
      appendReinforcerChoice(tx, 'kid', { source, sourceId: 'x-1', reinforcerId: 'puzzle', chosenBy: 'child' }, NOW),
    );
    return db;
  }
  const revoke = (db: SqlDb) => db.transaction((tx) => insertConsentEvent(tx, abaConsent('revoke', 'kid', '2026-10-12T09:00:00.000Z'), 'owner'));

  it.each(['session', 'routine'] as const)('выбор источника %s: отзыв отклонён', async (source) => {
    const db = await onlyChoices(source);
    const others = await Promise.all(
      ['aba_trials', 'aba_sessions', 'aba_ioa', 'aba_routine_runs', 'child_state'].map(async (t) => (await db.all(`SELECT 1 FROM ${t}`)).length),
    );
    expect(others).toEqual([0, 0, 0, 0, 0]); // предпосылка: ничто другое отзыву не мешает
    await expect(revoke(db)).rejects.toThrow(/вместе с удалением/);
  });

  it('выбор другого ребёнка отзыву этого не мешает', async () => {
    const db = await memoryDb();
    await appendConsentEvent(db, abaConsent('grant'), 'owner');
    await asAbaWriter(db, 'sib', (tx) =>
      appendReinforcerChoice(tx, 'sib', { source: 'session', sourceId: 'x-1', reinforcerId: 'puzzle', chosenBy: 'child' }, NOW),
    );
    await expect(revoke(db)).resolves.toBeUndefined();
  });

  it('без выбора отзыв принимается — отклонял именно журнал выборов', async () => {
    const db = await memoryDb();
    await appendConsentEvent(db, abaConsent('grant'), 'owner');
    await expect(revoke(db)).resolves.toBeUndefined();
  });

  it('после удаления выборов по праву на удаление отзыв принимается', async () => {
    const db = await onlyChoices('routine');
    await db.transaction(async (tx) => {
      await tx.run("INSERT INTO purge_gate (child_id) VALUES ('kid')");
      await tx.run("DELETE FROM aba_reinforcer_choices WHERE child_id = 'kid'");
      await tx.run("DELETE FROM purge_gate WHERE child_id = 'kid'");
    });
    await expect(revoke(db)).resolves.toBeUndefined();
  });
});
