/**
 * Накат миграции 10 на базу версии 9 С ДАННЫМИ (раунд 3, методист 2026-10-12): колонка
 * `aba_reinforcer_choices.tokens`, таблица `aba_trial_corrections`, ключ `breakCard` в триггерах
 * согласия и отзыва. Данные версии 9 не теряются, новые охранные триггеры работают.
 */
import { openRoutineOfferOf, routineRunsOf } from '../abaLog';
import type { ConsentEvent } from '../../../domain/consent';
import { insertConsentEvent } from '../consentLog';
import { MIGRATIONS, migrate } from '../schema';
import type { SqlDb } from '../sql';
import { asAbaWriter, memoryDb } from './nodeSql';

const ABA_TEXT = 'ru-draft-1';

const revoke = (childId = 'kid'): ConsentEvent => ({
  id: `aba-revoke-${childId}`,
  scope: 'aba_processing',
  action: 'revoke',
  childId,
  textVersion: ABA_TEXT,
  confirmedBy: 'biometric',
  actorId: 'parent',
  at: '2026-10-12T09:00:00.000Z',
});

const TABLES_V9 = ['aba_trials', 'aba_sessions', 'aba_ioa', 'aba_routine_runs', 'lesson_runs', 'child_state', 'consent_events', 'sync_cursor'] as const;

async function dump(db: SqlDb): Promise<Record<string, unknown[]>> {
  const out: Record<string, unknown[]> = {};
  for (const t of TABLES_V9) out[t] = await db.all(`SELECT * FROM ${t} ORDER BY 1, 2`);
  return out;
}

/** Прогон рутины в формате версии 9: `exchanged` и `exchangeOptions` вместо `exchangeOffer`. */
const oldRun = JSON.stringify({
  id: 'run-old',
  targetId: 'R',
  day: '2026-10-10',
  kind: 'teaching',
  startedAt: '2026-10-10T08:00:00.000Z',
  endedAt: '2026-10-10T08:05:00.000Z',
  interrupted: null,
  setting: 'usual',
  token: 'at_start_level',
  exchanged: 5,
  exchangeOptions: ['a', 'b', 'c'],
  phase: null,
  primaryObserverId: null,
});

/** База «как была на версии 9»: журналы, выбор рутины и сессии, состояние, согласие. */
async function v9WithData(): Promise<SqlDb> {
  const db = await memoryDb(9);
  await asAbaWriter(db, 'kid', async (tx) => {
    await tx.run("INSERT INTO aba_sessions (child_id, id, session_index, body, recorded_at) VALUES ('kid', 's-1', 1, '{\"id\":\"s-1\"}', '2026-10-01T10:00:00.000Z')");
    await tx.run("INSERT INTO aba_trials (child_id, id, session_id, target_id, body, recorded_at) VALUES ('kid', 'tr-1', 's-1', 'A', '{\"x\":1}', '2026-10-01T10:01:00.000Z')");
    await tx.run("INSERT INTO aba_trials (child_id, id, session_id, target_id, body, recorded_at) VALUES ('kid', 'tr-2', 's-1', 'A', '{\"x\":2}', '2026-10-01T10:02:00.000Z')");
    await tx.run("INSERT INTO aba_routine_runs (child_id, id, target_id, day, body, recorded_at) VALUES ('kid', 'run-old', 'R', '2026-10-10', ?, '2026-10-10T08:06:00.000Z')", [oldRun]);
    await tx.run("INSERT INTO aba_reinforcer_choices (child_id, chosen_at, source, source_id, reinforcer_id, chosen_by) VALUES ('kid', '2026-10-01T10:00:00.000Z', 'session', 's-1', 'puzzle', 'child')");
    await tx.run("INSERT INTO aba_reinforcer_choices (child_id, chosen_at, source, source_id, reinforcer_id, chosen_by) VALUES ('kid', '2026-10-10T08:07:00.000Z', 'routine', 'run-old', 'drum', 'adult')");
    await tx.run("INSERT INTO child_state (child_id, key, body, updated_at) VALUES ('kid', 'abaBoard', '{\"earned\":0,\"nonContingent\":0,\"rev\":3}', '2026-10-10T08:07:00.000Z')");
    await tx.run("INSERT INTO child_state (child_id, key, body, updated_at) VALUES ('kid', 'abaSessionIndex', '2', '2026-10-01T10:05:00.000Z')");
  });
  await db.run(
    `INSERT INTO consent_events (id, scope, action, child_id, text_version, confirmed_by, actor_id, at)
     VALUES ('c-1', 'aba_processing', 'grant', 'kid', ?, 'biometric', 'parent', '2026-10-01T08:00:00.000Z')`,
    [ABA_TEXT],
  );
  return db;
}

const correction = (trial = 'tr-1', replacement = 'tr-1~c1', over: Record<string, unknown> = {}) => ({
  trial,
  replacement,
  reason: 'adult_misentry',
  keep: 1,
  add: 0,
  ...over,
});

const insertCorrection = (tx: SqlDb, c = correction()) =>
  tx.run(
    `INSERT INTO aba_trial_corrections
       (child_id, trial_id, replacement_id, session_id, recorded_at, ms_since_original, from_response, to_response, token_kept, token_added, reason)
     VALUES ('kid', ?, ?, 's-1', '2026-10-01T10:01:03.000Z', 3000, 'independent', 'incorrect', ?, ?, ?)`,
    [c.trial, c.replacement, c.keep, c.add, c.reason],
  );

describe('накат миграции 10 на базе с данными', () => {
  it('миграций тринадцать, база после наката — версия 13', async () => {
    const db = await v9WithData();
    await migrate(db);
    const [{ user_version }] = await db.all<{ user_version: number }>('PRAGMA user_version');
    expect([MIGRATIONS.length, user_version]).toEqual([13, 13]);
  });

  it('миграция 11: история выборов по ребёнку и seq идёт по индексу, а не сортировкой', async () => {
    const db = await v9WithData();
    await migrate(db);
    const plan = await db.all<{ detail: string }>(
      "EXPLAIN QUERY PLAN SELECT reinforcer_id FROM aba_reinforcer_choices WHERE child_id = 'kid' ORDER BY seq",
    );
    const details = plan.map((r) => r.detail).join(' | ');
    expect(details).toContain('aba_reinforcer_choices_seq');
    expect(details).not.toContain('TEMP B-TREE');
  });

  it('данные версии 9 целы: ни одна строка таблиц версии 9 не потеряна и не изменена', async () => {
    const db = await v9WithData();
    const before = await dump(db);
    await migrate(db);
    expect(await dump(db)).toEqual(before);
  });

  it('выборы подкрепителя целы, у старых строк число жетонов не задано (NULL)', async () => {
    const db = await v9WithData();
    await migrate(db);
    const rows = await db.all('SELECT source, source_id AS sourceId, reinforcer_id AS reinforcerId, chosen_by AS chosenBy, tokens FROM aba_reinforcer_choices ORDER BY seq');
    expect(rows).toEqual([
      { source: 'session', sourceId: 's-1', reinforcerId: 'puzzle', chosenBy: 'child', tokens: null },
      { source: 'routine', sourceId: 'run-old', reinforcerId: 'drum', chosenBy: 'adult', tokens: null },
    ]);
  });

  it('повторное открытие базы ничего не меняет и не падает', async () => {
    const db = await v9WithData();
    await migrate(db);
    const once = await dump(db);
    await migrate(db);
    expect(await dump(db)).toEqual(once);
  });

  it('прогон в формате версии 9 читается и не создаёт ожидающего обмена: предложения нет', async () => {
    const db = await v9WithData();
    await migrate(db);
    expect(await routineRunsOf(db, 'kid')).toHaveLength(1);
    expect(await openRoutineOfferOf(db, 'kid', '2026-10-10')).toBeNull();
  });

  it('новый выбор рутины пишется с числом жетонов', async () => {
    const db = await v9WithData();
    await migrate(db);
    await asAbaWriter(db, 'kid', (tx) =>
      tx
        .run("INSERT INTO aba_reinforcer_choices (child_id, chosen_at, source, source_id, reinforcer_id, chosen_by, tokens) VALUES ('kid', '2026-10-12T08:00:00.000Z', 'routine', 'run-9', 'train', 'child', 6)")
        .then(() => undefined),
    );
    expect(await db.all("SELECT tokens FROM aba_reinforcer_choices WHERE source_id = 'run-9'")).toEqual([{ tokens: 6 }]);
  });
});

describe('aba_trial_corrections после миграции 10', () => {
  it('таблица создана и пуста', async () => {
    const db = await v9WithData();
    await migrate(db);
    expect(await db.all('SELECT * FROM aba_trial_corrections')).toEqual([]);
  });

  it('запись мимо ворот согласия отклоняется базой', async () => {
    const db = await v9WithData();
    await migrate(db);
    await expect(insertCorrection(db)).rejects.toThrow(/только через commit\.ts/);
  });

  it('через ворота записывается; исходная проба в aba_trials остаётся нетронутой', async () => {
    const db = await v9WithData();
    await migrate(db);
    await asAbaWriter(db, 'kid', async (tx) => {
      await insertCorrection(tx);
    });
    expect(await db.all("SELECT trial_id AS t, replacement_id AS r, reason FROM aba_trial_corrections")).toEqual([{ t: 'tr-1', r: 'tr-1~c1', reason: 'adult_misentry' }]);
    expect(await db.all("SELECT body FROM aba_trials WHERE id = 'tr-1'")).toEqual([{ body: '{"x":1}' }]);
  });

  it('одна проба — одно исправление: второе на ту же пробу и ту же замену отклоняется', async () => {
    const db = await v9WithData();
    await migrate(db);
    await asAbaWriter(db, 'kid', async (tx) => {
      await insertCorrection(tx);
    });
    await expect(asAbaWriter(db, 'kid', async (tx) => {
      await insertCorrection(tx, correction('tr-1', 'tr-1~c2'));
    })).rejects.toThrow(/UNIQUE/);
    await expect(asAbaWriter(db, 'kid', async (tx) => {
      await insertCorrection(tx, correction('tr-2', 'tr-1~c1'));
    })).rejects.toThrow(/UNIQUE/);
  });

  it('причина — только adult_misentry, свободного текста нет; токен-флаги только 0 или 1', async () => {
    const db = await v9WithData();
    await migrate(db);
    await expect(asAbaWriter(db, 'kid', async (tx) => {
      await insertCorrection(tx, correction('tr-1', 'x', { reason: 'ребёнок плакал' }));
    })).rejects.toThrow(/CHECK/);
    await expect(asAbaWriter(db, 'kid', async (tx) => {
      await insertCorrection(tx, correction('tr-1', 'x', { keep: 2 }));
    })).rejects.toThrow(/CHECK/);
    await expect(asAbaWriter(db, 'kid', async (tx) => {
      await insertCorrection(tx, correction('tr-1', 'x', { add: -1 }));
    })).rejects.toThrow(/CHECK/);
  });

  it('журнал только дописывается: UPDATE и DELETE отклоняются', async () => {
    const db = await v9WithData();
    await migrate(db);
    await asAbaWriter(db, 'kid', async (tx) => {
      await insertCorrection(tx);
    });
    await expect(db.run("UPDATE aba_trial_corrections SET to_response = 'independent'")).rejects.toThrow(/только дописывание/);
    await expect(db.run('DELETE FROM aba_trial_corrections')).rejects.toThrow(/только дописывание/);
  });

  it('удаление по ребёнку (purge_gate) и по сроку (retention_gate) разрешено, чужого ребёнка не касается', async () => {
    const db = await v9WithData();
    await migrate(db);
    await asAbaWriter(db, 'kid', async (tx) => {
      await insertCorrection(tx);
    });
    await db.run("INSERT INTO purge_gate (child_id) VALUES ('sib')");
    await expect(db.run("DELETE FROM aba_trial_corrections WHERE child_id = 'kid'")).rejects.toThrow(/только дописывание/);
    await db.run("DELETE FROM purge_gate WHERE child_id = 'sib'");

    await db.run("INSERT INTO retention_gate (before) VALUES ('2026-09-01T00:00:00.000Z')");
    await expect(db.run('DELETE FROM aba_trial_corrections')).rejects.toThrow(/только дописывание/); // запись свежее границы
    await db.run('DELETE FROM retention_gate');
    await db.run("INSERT INTO retention_gate (before) VALUES ('2026-11-01T00:00:00.000Z')");
    await db.run('DELETE FROM aba_trial_corrections');
    await db.run('DELETE FROM retention_gate');
    expect(await db.all('SELECT * FROM aba_trial_corrections')).toEqual([]);
  });
});

describe('ключ breakCard в триггерах согласия и отзыва', () => {
  const put = (db: SqlDb) =>
    db.run("INSERT INTO child_state (child_id, key, body, updated_at) VALUES ('kid', 'breakCard', '{}', '2026-10-12T08:00:00.000Z')");

  it('до миграции ключ не охранялся (контроль), после — запись мимо ворот отклоняется', async () => {
    const before = await v9WithData();
    await expect(put(before)).resolves.toBeDefined();
    const db = await v9WithData();
    await migrate(db);
    await expect(put(db)).rejects.toThrow(/только через commit\.ts/);
  });

  it('через ворота breakCard пишется и обновляется', async () => {
    const db = await v9WithData();
    await migrate(db);
    await asAbaWriter(db, 'kid', async (tx) => {
      await put(tx);
    });
    await expect(db.run("UPDATE child_state SET body = '{\"a\":1}' WHERE key = 'breakCard'")).rejects.toThrow(/только через commit\.ts/);
  });

  it('отзыв согласия блокируется одним лишь breakCard: данные удаляются вместе с отзывом', async () => {
    const db = await memoryDb();
    await db.run(
      `INSERT INTO consent_events (id, scope, action, child_id, text_version, confirmed_by, actor_id, at)
       VALUES ('c-1', 'aba_processing', 'grant', 'kid', ?, 'biometric', 'parent', '2026-10-01T08:00:00.000Z')`,
      [ABA_TEXT],
    );
    await asAbaWriter(db, 'kid', async (tx) => {
      await put(tx);
    });
    await expect(db.transaction((tx) => insertConsentEvent(tx, revoke(), 'owner'))).rejects.toThrow(/вместе с удалением/);
  });

  it('отзыв блокируется одним лишь исправлением отметки', async () => {
    const db = await v9WithData();
    await migrate(db);
    // оставляем только исправление: остальное ABA-состояние ребёнка удалено через purge_gate
    await asAbaWriter(db, 'kid', async (tx) => {
      await insertCorrection(tx);
    });
    await db.run("INSERT INTO purge_gate (child_id) VALUES ('kid')");
    for (const t of ['aba_trials', 'aba_sessions', 'aba_ioa', 'aba_routine_runs', 'aba_reinforcer_choices']) {
      await db.run(`DELETE FROM ${t} WHERE child_id = 'kid'`);
    }
    await db.run("DELETE FROM child_state WHERE child_id = 'kid'");
    await db.run("DELETE FROM purge_gate WHERE child_id = 'kid'");
    expect(await db.all("SELECT COUNT(*) AS n FROM aba_trial_corrections WHERE child_id = 'kid'")).toEqual([{ n: 1 }]);
    await expect(db.transaction((tx) => insertConsentEvent(tx, revoke(), 'owner'))).rejects.toThrow(/вместе с удалением/);
  });
});
