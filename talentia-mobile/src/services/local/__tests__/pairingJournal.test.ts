/**
 * Журнал сессий сопряжения `aba_pairing_sessions` (№164, миграция 16) — проверки, которые назвал
 * `child-privacy-compliance` к коммиту b434d65:
 * - срок хранения (12 месяцев) и удержание при скачке часов учитывают таблицу;
 * - триггер отзыва `aba_processing` отклоняет отзыв при оставшейся записи сопряжения — сам по себе;
 * - только дописывание: правка и удаление мимо ворот отклоняются, вставка — только через ворота согласия;
 * - посторонний ребёнок: запись, отзыв, удаление и экспорт одного не задевают другого;
 * - общий гард: каждая таблица с `child_id` — в `JOURNALS` purge.ts или в явном списке исключений;
 * - день выборов сопряжения у специалиста — локальный день записи при поясе UTC+6 около 02:00;
 * - накат v15 → v16 на базе с данными (шаг, не «последняя»): триггер отзыва пересоздан со всеми прежними таблицами
 *   и ключами; после полного наката он знает и журналы, пришедшие позже.
 */
import { CURRENT_CONSENT_TEXTS } from '../../../domain/consentTexts';
import * as fs from 'fs';
import * as path from 'path';
import type { AbaPairingSession } from '../../../types/aba';
import type { ConsentEvent } from '../../../domain/consent';
import type { PairingResult } from '../../../domain/abaPairing';
import { initialTokenTraining } from '../../../domain/abaTokenTraining';
import { AbaConsentRequiredError, abaLocalDay, appendPairingSession } from '../abaLog';
import { loadChildState, saveChildState } from '../childState';
import { commitPairingSession, setAbaObservers } from '../commit';
import { appendConsentEvent, insertConsentEvent } from '../consentLog';
import {
  abaDataSummary,
  applyRetention,
  clearChildProgress,
  confirmClockJump,
  exportChild,
  exportForSpecialist,
  purgeChild,
  retentionCutoff,
  revokeAbaProcessing,
  runRetention,
  wipeDevice,
} from '../purge';
import { CLOCK_JUMP_HOLD_DAYS, MIGRATIONS, migrate } from '../schema';
import type { SqlDb } from '../sql';
import { asAbaWriter, memoryDb } from './nodeSql';

const ABA_TEXT = CURRENT_CONSENT_TEXTS.aba_processing[0];
const DAY = 24 * 60 * 60 * 1000;
const KID_A = 'kid-a';
const KID_B = 'kid-b';
/** UUIDv4: из id сопряжения время не читается (`leaksTime`). */
const SID_A = '7b0e9a52-4d1c-4f3a-9a1e-2c6d8f0b1a3e';
const SID_B = '0c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f';
const PSEUDONYM = '9f1c2b3a-4d5e-4f60-8a7b-1c2d3e4f5a6b';

const grant = (childId: string, at = '2026-10-25T09:00:00.000Z'): ConsentEvent => ({
  id: `aba-grant-${childId}`,
  scope: 'aba_processing',
  action: 'grant',
  childId,
  textVersion: ABA_TEXT,
  confirmedBy: 'biometric',
  actorId: 'parent',
  at,
});
const revoke = (childId: string, at = '2026-10-27T09:00:00.000Z'): ConsentEvent => ({
  ...grant(childId, at),
  id: `aba-revoke-${childId}`,
  action: 'revoke',
  confirmedBy: 'pin',
});

/** Итог сопряжения из четырёх выборов ребёнка, начиная с `t0`, с шагом в минуту. */
const result = (sessionId: string, t0 = Date.parse('2026-10-25T10:00:00.000Z'), over: Partial<PairingResult> = {}): PairingResult => ({
  sessionId,
  config: 'with_adult',
  options: ['puzzle', 'bubbles', 'drum'],
  endReason: 'completed',
  cycles: 4,
  startedAt: t0,
  endedAt: t0 + 4 * 60_000,
  chosenBy: 'child',
  choices: ['puzzle', 'bubbles', 'drum', 'puzzle'].map((reinforcerId, i) => ({ reinforcerId, by: 'child' as const, at: t0 + i * 60_000 + 5_000, latencyMs: 4_200 })),
  ...over,
});

/** Запись сопряжения как есть — для тестов, которым согласие и итог не предмет. */
const rec = (id: string, over: Partial<AbaPairingSession> = {}): AbaPairingSession => ({
  id,
  day: '2026-10-25',
  startedAt: '2026-10-25T10:00:00.000Z',
  endedAt: '2026-10-25T10:04:00.000Z',
  config: 'with_adult',
  endReason: 'completed',
  cycles: 4,
  chosenBy: 'child',
  choicesByChild: 4,
  choicesByAdult: 0,
  options: ['puzzle', 'bubbles', 'drum'],
  choices: ['puzzle', 'bubbles', 'drum', 'puzzle'].map((reinforcerId) => ({ reinforcerId, by: 'child' as const, latencyMs: 4_200, prompted: false })),
  primaryObserverId: null,
  ...over,
});
const writePairing = (db: SqlDb, childId: string, id: string, recordedAt: string) =>
  asAbaWriter(db, childId, (tx) => appendPairingSession(tx, childId, rec(id), recordedAt));

const pairingIds = async (db: SqlDb, childId?: string) =>
  (
    await db.all<{ id: string }>(
      `SELECT id FROM aba_pairing_sessions ${childId ? 'WHERE child_id = ?' : ''} ORDER BY seq`,
      childId ? [childId] : [],
    )
  ).map((r) => r.id);
const countOf = async (db: SqlDb, table: string, childId: string) =>
  (await db.all<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table} WHERE child_id = ?`, [childId]))[0].n;

/** База с согласием у переданных детей. */
async function dbWithConsent(...kids: string[]): Promise<SqlDb> {
  const db = await memoryDb();
  for (const [i, kid] of kids.entries()) await appendConsentEvent(db, grant(kid, `2026-10-25T09:0${i}:00.000Z`), 'owner');
  return db;
}

/** Всё, что о сопряжении ребёнка лежит в базе: записи, выборы, состояние обучения доске. */
async function pairingFootprint(db: SqlDb, childId: string) {
  return {
    sessions: await countOf(db, 'aba_pairing_sessions', childId),
    choices: await countOf(db, 'aba_reinforcer_choices', childId),
    tokenTraining: (await loadChildState(db, childId, 'tokenTraining')) ?? null,
  };
}

// --- 1. срок хранения ----------------------------------------------------------------------------

describe('сопряжение: срок хранения', () => {
  const NOW = '2026-10-28T10:00:00.000Z';
  const OLD = '2025-10-01T10:00:00.000Z';
  const FRESH = '2026-10-20T10:00:00.000Z';

  it('applyRetention удаляет запись сопряжения старше 12 месяцев, свежая остаётся', async () => {
    const db = await memoryDb();
    await writePairing(db, KID_A, 'p-old', OLD);
    await writePairing(db, KID_A, 'p-fresh', FRESH);
    const removed = await applyRetention(db, new Date(NOW));
    expect([removed, await pairingIds(db)]).toEqual([1, ['p-fresh']]);
  });

  it('запись ровно на границе срока не удаляется (граница — строго «раньше»)', async () => {
    const db = await memoryDb();
    await writePairing(db, KID_A, 'p-edge', retentionCutoff(new Date(NOW)));
    await applyRetention(db, new Date(NOW));
    expect(await pairingIds(db)).toEqual(['p-edge']);
  });

  it('свежая запись сопряжения — активность: старое состояние обучения доске не удаляется', async () => {
    const db = await memoryDb();
    await asAbaWriter(db, KID_A, (tx) => saveChildState(tx, KID_A, 'tokenTraining', initialTokenTraining(), OLD));
    await writePairing(db, KID_A, 'p-fresh', FRESH);
    await applyRetention(db, new Date(NOW));
    expect(await loadChildState(db, KID_A, 'tokenTraining')).toEqual(initialTokenTraining());
  });

  it('контроль: без свежего сопряжения то же состояние уходит по сроку', async () => {
    const db = await memoryDb();
    await asAbaWriter(db, KID_A, (tx) => saveChildState(tx, KID_A, 'tokenTraining', initialTokenTraining(), OLD));
    await writePairing(db, KID_A, 'p-old', OLD);
    await applyRetention(db, new Date(NOW));
    expect([await loadChildState(db, KID_A, 'tokenTraining'), await pairingIds(db)]).toEqual([undefined, []]);
  });

  it('опорная дата часов без retention_clock берётся и из журнала сопряжения: +30 дней от записи — не скачок', async () => {
    // единственная поздняя запись базы — сопряжение; согласие аккаунта memoryDb — 2026-01-01
    const db = await memoryDb();
    const P = '2026-12-20T10:00:00.000Z';
    await writePairing(db, KID_A, 'p-late', P);
    const out = await runRetention(db, { deviceNow: new Date(Date.parse(P) + 30 * DAY), builtAt: null });
    expect(out.kind).toBe('applied');
  });

  it(`скачок больше ${CLOCK_JUMP_HOLD_DAYS} дней: удержание считает запись сопряжения и не удаляет её, подтверждение удаляет`, async () => {
    const db = await memoryDb();
    const SEEN = '2026-10-20T10:00:00.000Z';
    // внутри срока от SEEN, но старше 12 месяцев от SEEN + 46 дней
    await writePairing(db, KID_A, 'p-mid', '2025-11-20T10:00:00.000Z');
    await db.run('INSERT INTO retention_clock (id, last_seen) VALUES (1, ?)', [SEEN]);
    const jump = new Date(Date.parse(SEEN) + (CLOCK_JUMP_HOLD_DAYS + 1) * DAY);
    const held = await runRetention(db, { deviceNow: jump, builtAt: null });
    expect([held.kind, held.kind === 'held' ? held.wouldRemove : null, await pairingIds(db)]).toEqual(['held', 1, ['p-mid']]);
    const removed = await confirmClockJump(db, { observedNow: jump.toISOString(), deviceNow: jump, builtAt: null });
    expect([removed, await pairingIds(db)]).toEqual([1, []]);
  });
});

// --- 2. триггер отзыва напрямую ------------------------------------------------------------------

describe('сопряжение: триггер отзыва aba_processing', () => {
  const REVOKE_SQL = `INSERT INTO consent_events (id, scope, action, child_id, text_version, confirmed_by, actor_id, at)
    VALUES (?, 'aba_processing', 'revoke', ?, ?, 'pin', 'parent', '2026-10-27T09:00:00.000Z')`;
  const rawRevoke = (db: SqlDb, childId = KID_A) => db.run(REVOKE_SQL, [`raw-revoke-${childId}`, childId, ABA_TEXT]);

  /** У ребёнка — только запись сопряжения: ни выборов, ни состояния ABA. */
  async function onlyPairing(): Promise<SqlDb> {
    const db = await dbWithConsent(KID_A);
    await writePairing(db, KID_A, 'p-1', '2026-10-25T10:04:00.000Z');
    return db;
  }

  it('предпосылка: кроме записи сопряжения, отзыву у ребёнка мешать нечему', async () => {
    const db = await onlyPairing();
    const tables = ['aba_trials', 'aba_sessions', 'aba_ioa', 'aba_routine_runs', 'aba_reinforcer_choices', 'aba_trial_corrections', 'aba_routine_run_amendments', 'child_state'];
    expect(await Promise.all(tables.map((t) => countOf(db, t, KID_A)))).toEqual(tables.map(() => 0));
  });

  it('прямая вставка отзыва при оставшейся записи сопряжения отклоняется базой', async () => {
    const db = await onlyPairing();
    await expect(rawRevoke(db)).rejects.toThrow(/вместе с удалением/);
  });

  it('отзыв через insertConsentEvent (мимо revokeAbaProcessing) тоже отклоняется, запись цела', async () => {
    const db = await onlyPairing();
    await expect(db.transaction((tx) => insertConsentEvent(tx, revoke(KID_A), 'owner'))).rejects.toThrow(/вместе с удалением/);
    expect(await pairingIds(db, KID_A)).toEqual(['p-1']);
  });

  it('запись сопряжения другого ребёнка отзыву этого не мешает', async () => {
    const db = await dbWithConsent(KID_A);
    await writePairing(db, KID_B, 'p-b', '2026-10-25T10:04:00.000Z');
    await expect(rawRevoke(db)).resolves.toEqual({ changes: 1 });
  });

  it('после удаления записи по праву на удаление отзыв принимается — отклоняла именно она', async () => {
    const db = await onlyPairing();
    await db.transaction(async (tx) => {
      await tx.run('INSERT INTO purge_gate (child_id) VALUES (?)', [KID_A]);
      await tx.run('DELETE FROM aba_pairing_sessions WHERE child_id = ?', [KID_A]);
      await tx.run('DELETE FROM purge_gate WHERE child_id = ?', [KID_A]);
    });
    await expect(rawRevoke(db)).resolves.toEqual({ changes: 1 });
  });
});

// --- 3. только дописывание -----------------------------------------------------------------------

describe('сопряжение: журнал только дописывается', () => {
  async function withRow(): Promise<SqlDb> {
    const db = await dbWithConsent(KID_A);
    await commitPairingSession(db, KID_A, result(SID_A), '2026-10-25T10:05:00.000Z');
    return db;
  }

  it('прямой UPDATE отклоняется', async () => {
    const db = await withRow();
    await expect(db.run("UPDATE aba_pairing_sessions SET body = '{}'")).rejects.toThrow(/только дописывание/);
  });

  it('UPDATE отклоняется и при открытых воротах удаления ребёнка', async () => {
    const db = await withRow();
    await expect(
      db.transaction(async (tx) => {
        await tx.run('INSERT INTO purge_gate (child_id) VALUES (?)', [KID_A]);
        await tx.run("UPDATE aba_pairing_sessions SET day = '2000-01-01'");
      }),
    ).rejects.toThrow(/только дописывание/);
  });

  it('прямой DELETE отклоняется, запись цела', async () => {
    const db = await withRow();
    await expect(db.run('DELETE FROM aba_pairing_sessions')).rejects.toThrow(/только дописывание/);
    expect(await pairingIds(db)).toEqual([SID_A]);
  });

  it('DELETE при воротах срока, граница которых раньше записи, отклоняется', async () => {
    const db = await withRow();
    await expect(
      db.transaction(async (tx) => {
        await tx.run("INSERT INTO retention_gate (before) VALUES ('2026-01-01T00:00:00.000Z')");
        await tx.run('DELETE FROM aba_pairing_sessions');
      }),
    ).rejects.toThrow(/только дописывание/);
  });

  it('DELETE при открытых воротах удаления другого ребёнка отклоняется', async () => {
    const db = await withRow();
    await expect(
      db.transaction(async (tx) => {
        await tx.run('INSERT INTO purge_gate (child_id) VALUES (?)', [KID_B]);
        await tx.run('DELETE FROM aba_pairing_sessions');
      }),
    ).rejects.toThrow(/только дописывание/);
  });

  it('appendPairingSession без ворот согласия отклоняется базой, даже при согласии ребёнка в журнале', async () => {
    const db = await dbWithConsent(KID_A);
    await expect(appendPairingSession(db, KID_A, rec('p-1'), '2026-10-25T10:05:00.000Z')).rejects.toThrow(/при согласии/);
    expect(await pairingIds(db)).toEqual([]);
  });

  it('appendPairingSession при воротах, открытых для другого ребёнка, отклоняется', async () => {
    const db = await memoryDb();
    await expect(asAbaWriter(db, KID_A, (tx) => appendPairingSession(tx, KID_B, rec('p-b'), '2026-10-25T10:05:00.000Z'))).rejects.toThrow(
      /при согласии/,
    );
    expect(await pairingIds(db)).toEqual([]);
  });
});

// --- 4. посторонний ребёнок ----------------------------------------------------------------------

describe('сопряжение: посторонний ребёнок', () => {
  it('согласие только у kid-a: коммит для kid-b отклонён и не пишет ничего', async () => {
    const db = await dbWithConsent(KID_A);
    await expect(commitPairingSession(db, KID_B, result(SID_B), '2026-10-25T10:05:00.000Z')).rejects.toBeInstanceOf(AbaConsentRequiredError);
    expect(await pairingFootprint(db, KID_B)).toEqual({ sessions: 0, choices: 0, tokenTraining: null });
  });

  it('согласие только у kid-a: итог kid-b с id сессии kid-a тоже не пишется и запись kid-a не меняет', async () => {
    const db = await dbWithConsent(KID_A);
    await commitPairingSession(db, KID_A, result(SID_A), '2026-10-25T10:05:00.000Z');
    const before = await pairingFootprint(db, KID_A);
    await expect(commitPairingSession(db, KID_B, result(SID_A), '2026-10-25T10:06:00.000Z')).rejects.toThrow();
    expect([await pairingFootprint(db, KID_A), await pairingFootprint(db, KID_B)]).toEqual([before, { sessions: 0, choices: 0, tokenTraining: null }]);
  });

  it('наблюдатель kid-b, переданный в итог kid-a, не пишется', async () => {
    const db = await dbWithConsent(KID_A, KID_B);
    await setAbaObservers(db, KID_B, [{ id: 'obs-b', role: 'parent', trained: false }], '2026-10-25T09:30:00.000Z');
    await commitPairingSession(db, KID_A, result(SID_A), '2026-10-25T10:05:00.000Z', { primaryObserverId: 'obs-b' });
    const [row] = await db.all<{ body: string }>('SELECT body FROM aba_pairing_sessions WHERE child_id = ?', [KID_A]);
    expect(JSON.parse(row.body).primaryObserverId).toBeNull();
  });

  /** Два ребёнка с согласием и сопряжением у каждого. */
  async function siblings(): Promise<SqlDb> {
    const db = await dbWithConsent(KID_A, KID_B);
    await commitPairingSession(db, KID_A, result(SID_A), '2026-10-25T10:05:00.000Z');
    await commitPairingSession(db, KID_B, result(SID_B, Date.parse('2026-10-25T11:00:00.000Z')), '2026-10-25T11:05:00.000Z');
    return db;
  }

  it('отзыв у kid-a удаляет его сопряжение и не трогает сопряжение kid-b', async () => {
    const db = await siblings();
    const b = await pairingFootprint(db, KID_B);
    await revokeAbaProcessing(db, revoke(KID_A), 'owner');
    expect([await pairingFootprint(db, KID_A), await pairingFootprint(db, KID_B)]).toEqual([{ sessions: 0, choices: 0, tokenTraining: null }, b]);
  });

  it('purgeChild kid-a не трогает сопряжение kid-b', async () => {
    const db = await siblings();
    const b = await pairingFootprint(db, KID_B);
    await purgeChild(db, KID_A, PSEUDONYM);
    expect([await pairingFootprint(db, KID_A), await pairingFootprint(db, KID_B)]).toEqual([{ sessions: 0, choices: 0, tokenTraining: null }, b]);
  });

  it('clearChildProgress kid-a не трогает сопряжение kid-b', async () => {
    const db = await siblings();
    const b = await pairingFootprint(db, KID_B);
    await clearChildProgress(db, KID_A);
    expect([await pairingFootprint(db, KID_A), await pairingFootprint(db, KID_B)]).toEqual([{ sessions: 0, choices: 0, tokenTraining: null }, b]);
  });

  it('exportChild(kid-a) не содержит записей и выборов kid-b', async () => {
    const db = await siblings();
    const out = await exportChild(db, KID_A, '2026-10-27T00:00:00.000Z', {});
    expect((out.abaPairingSessions as { id: string }[]).map((p) => p.id)).toEqual([SID_A]);
    expect((out.abaReinforcerChoices as { sourceId: string }[]).every((c) => c.sourceId === SID_A)).toBe(true);
    expect(JSON.stringify(out)).not.toContain(SID_B);
    expect(JSON.stringify(out)).not.toContain(KID_B);
  });

  it('exportForSpecialist(kid-a) и сводка перед отзывом не содержат kid-b', async () => {
    const db = await siblings();
    const spec = await exportForSpecialist(db, KID_A, '2026-10-27T00:00:00.000Z');
    expect([spec.abaPairingSessions.length, spec.abaReinforcerChoices.length, JSON.stringify(spec).includes(SID_B)]).toEqual([1, 4, false]);
    expect((await abaDataSummary(db, KID_A)).pairingSessions).toBe(1);
  });
});

// --- 5. общий гард журналов и удаление ------------------------------------------------------------

describe('журналы: каждая таблица с child_id учтена в удалении', () => {
  const PURGE_SRC = fs.readFileSync(path.join(__dirname, '..', 'purge.ts'), 'utf8');
  /** Литерал массива `const <name> = [ ... ] as const;` из purge.ts — список не экспортируется. */
  const literal = (name: string): string => {
    const m = new RegExp(`const ${name} = \\[([\\s\\S]*?)\\] as const;`).exec(PURGE_SRC);
    if (!m) throw new Error(`В purge.ts нет const ${name} = [...] as const`);
    return m[1];
  };
  const JOURNALS = [...literal('JOURNALS').matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
  const RETAINED = [...literal('RETENTION_COLUMNS').matchAll(/\['([a-z_]+)',/g)].map((m) => m[1]);

  /**
   * Таблицы с `child_id`, которые не журналы — и почему. Новая таблица с `child_id` должна попасть
   * либо в `JOURNALS` (и тогда в удаление, очистку, срок, экспорт), либо сюда с причиной.
   */
  const NOT_JOURNALS: Record<string, string> = {
    purge_gate: 'ворота удаления — пусты вне транзакции',
    aba_write_gate: 'ворота записи ABA — пусты вне транзакции',
    lesson_write_gate: 'ворота записи урока — пусты вне транзакции',
    consent_events: 'журнал согласий — псевдоним вместо удаления (purgeChild)',
    child_state: 'сводное состояние — удаляется отдельной строкой purgeChild / clearChildProgress',
    sync_cursor: 'курсоры синхронизации — удаляются отдельной строкой',
    sync_problems: 'проблемы синхронизации — удаляются отдельной строкой purgeChild',
  };

  async function tablesWithChildId(db: SqlDb): Promise<string[]> {
    const tables = await db.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
    const out: string[] = [];
    for (const { name } of tables) {
      const cols = await db.all<{ name: string }>('SELECT name FROM pragma_table_info(?)', [name]);
      if (cols.some((c) => c.name === 'child_id')) out.push(name);
    }
    return out;
  }

  it('фиксатор: списки из purge.ts прочитаны и содержат журнал сопряжения', () => {
    expect(JOURNALS).toContain('aba_pairing_sessions');
    expect(RETAINED).toContain('aba_pairing_sessions');
    expect(JOURNALS.length).toBeGreaterThanOrEqual(9);
  });

  it('каждая таблица с child_id — в JOURNALS или в списке исключений с причиной', async () => {
    const db = await memoryDb();
    const missing = (await tablesWithChildId(db)).filter((t) => !JOURNALS.includes(t) && !(t in NOT_JOURNALS));
    expect(missing).toEqual([]);
  });

  it('в списках нет лишнего: каждая запись — настоящая таблица с child_id, и ни одна не в обоих', async () => {
    const db = await memoryDb();
    const real = await tablesWithChildId(db);
    expect([...JOURNALS, ...Object.keys(NOT_JOURNALS)].filter((t) => !real.includes(t))).toEqual([]);
    expect(JOURNALS.filter((t) => t in NOT_JOURNALS)).toEqual([]);
  });

  it('каждый журнал — в сроке хранения (RETENTION_COLUMNS) и охраняется триггерами правки и удаления', async () => {
    const db = await memoryDb();
    const triggers = (await db.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'trigger'")).map((r) => r.name);
    expect(JOURNALS.filter((t) => !RETAINED.includes(t))).toEqual([]);
    expect(JOURNALS.filter((t) => !triggers.includes(`${t}_no_update`) || !triggers.includes(`${t}_no_delete`))).toEqual([]);
    expect(JOURNALS.filter((t) => !triggers.includes(`${t}_need_consent`))).toEqual([]);
  });

  it('каждый журнал ABA — в триггере отзыва aba_processing', async () => {
    const db = await memoryDb();
    const [{ sql }] = await db.all<{ sql: string }>("SELECT sql FROM sqlite_master WHERE name = 'consent_events_aba_revoke_needs_purge'");
    expect(JOURNALS.filter((t) => t.startsWith('aba_') && !sql.includes(`FROM ${t} WHERE`))).toEqual([]);
  });

  /** Ребёнок с сопряжением, выборами, состоянием и наблюдателем. */
  async function withPairing(): Promise<SqlDb> {
    const db = await dbWithConsent(KID_A);
    await setAbaObservers(db, KID_A, [{ id: 'obs-1', role: 'parent', trained: false }], '2026-10-25T09:30:00.000Z');
    await commitPairingSession(db, KID_A, result(SID_A), '2026-10-25T10:05:00.000Z', { primaryObserverId: 'obs-1' });
    expect(await pairingFootprint(db, KID_A)).toMatchObject({ sessions: 1, choices: 4 }); // предпосылка
    return db;
  }

  it('purgeChild: ни в одной таблице с child_id не остаётся строк ребёнка, сопряжение удалено', async () => {
    const db = await withPairing();
    await purgeChild(db, KID_A, PSEUDONYM);
    const left: Record<string, number> = {};
    for (const t of await tablesWithChildId(db)) {
      const n = await countOf(db, t, KID_A);
      if (n) left[t] = n;
    }
    expect(left).toEqual({});
  });

  it('clearChildProgress удаляет сопряжение и его выборы, согласие остаётся', async () => {
    const db = await withPairing();
    await clearChildProgress(db, KID_A);
    expect(await pairingFootprint(db, KID_A)).toEqual({ sessions: 0, choices: 0, tokenTraining: null });
    expect(await countOf(db, 'consent_events', KID_A)).toBe(1);
  });

  it('wipeDevice удаляет сопряжение и его выборы', async () => {
    const db = await withPairing();
    await wipeDevice(db);
    expect((await db.all('SELECT 1 FROM aba_pairing_sessions')).length + (await db.all('SELECT 1 FROM aba_reinforcer_choices')).length).toBe(0);
  });
});

// --- 6. день выборов сопряжения при поясе UTC+6 ---------------------------------------------------

describe('экспорт специалисту: день выборов сопряжения при поясе Asia/Bishkek', () => {
  /**
   * Пояс процесса в Jest не переключить (`localDayTz.test.ts`): `process.env` песочницы — копия. Подмена —
   * локальные геттеры даты, которыми считает `abaLocalDay`, сдвигаются на +6 ч (в Бишкеке нет летнего
   * времени). Остальное (`toISOString`, `Date.parse`) — UTC, как и без подмены.
   */
  const BISHKEK_MS = 6 * 60 * 60 * 1000;
  let restore: (() => void) | null = null;
  beforeEach(() => {
    const shifted = (d: Date) => new Date(d.getTime() + BISHKEK_MS);
    const spies = [
      jest.spyOn(Date.prototype, 'getFullYear').mockImplementation(function (this: Date) {
        return shifted(this).getUTCFullYear();
      }),
      jest.spyOn(Date.prototype, 'getMonth').mockImplementation(function (this: Date) {
        return shifted(this).getUTCMonth();
      }),
      jest.spyOn(Date.prototype, 'getDate').mockImplementation(function (this: Date) {
        return shifted(this).getUTCDate();
      }),
      jest.spyOn(Date.prototype, 'getHours').mockImplementation(function (this: Date) {
        return shifted(this).getUTCHours();
      }),
      jest.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(-360),
    ];
    restore = () => spies.forEach((s) => s.mockRestore());
  });
  afterEach(() => restore?.());

  // 02:10 по Бишкеку 26 октября = 20:10 UTC 25 октября
  const T0 = Date.parse('2026-10-25T20:10:00.000Z');

  it('предпосылка: подмена действует — 20:10 UTC это уже 26-е по Бишкеку', () => {
    expect([abaLocalDay(T0), new Date(T0).toISOString().slice(0, 10)]).toEqual(['2026-10-26', '2026-10-25']);
  });

  it('сопряжение около 02:00 локального: day записи — локальный, day каждого выбора совпадает с ним', async () => {
    const db = await dbWithConsent(KID_A);
    await commitPairingSession(db, KID_A, result(SID_A, T0), '2026-10-25T20:15:00.000Z');
    const spec = await exportForSpecialist(db, KID_A, '2026-10-27T00:00:00.000Z');
    const [pairing] = spec.abaPairingSessions as { day: string }[];
    const days = (spec.abaReinforcerChoices as { day: string; source: string }[]).map((c) => [c.source, c.day]);
    expect(pairing.day).toBe('2026-10-26');
    expect(days).toEqual([0, 1, 2, 3].map(() => ['pairing', '2026-10-26']));
  });

  it('выбор после полуночи UTC той же сессии — тот же day, что у записи', async () => {
    // начало 23:58 UTC (05:58 по Бишкеку 26-го), выборы уходят за полночь UTC
    const db = await dbWithConsent(KID_A);
    const t0 = Date.parse('2026-10-25T23:58:00.000Z');
    await commitPairingSession(db, KID_A, result(SID_A, t0), '2026-10-26T00:03:00.000Z');
    const spec = await exportForSpecialist(db, KID_A, '2026-10-27T00:00:00.000Z');
    const pairingDay = (spec.abaPairingSessions[0] as { day: string }).day;
    expect(new Set((spec.abaReinforcerChoices as { day: string }[]).map((c) => c.day))).toEqual(new Set([pairingDay]));
  });
});

// --- 7. накат v15 → v16 на базе с данными ---------------------------------------------------------

describe('накат миграции 15 → 16 на базе с данными', () => {
  const NOW = '2026-10-25T10:00:00.000Z';
  const TABLES_V15 = [
    'aba_trials',
    'aba_sessions',
    'aba_ioa',
    'aba_routine_runs',
    'aba_reinforcer_choices',
    'aba_trial_corrections',
    'aba_routine_run_amendments',
    'lesson_runs',
    'child_state',
    'consent_events',
    'sync_cursor',
    'sync_problems',
    'retention_clock',
  ] as const;

  async function dump(db: SqlDb): Promise<Record<string, unknown[]>> {
    const out: Record<string, unknown[]> = {};
    // колонки версии 15: поздние миграции вправе добавлять свои (18 — `retention_clock.drift_ms` с нулём,
    // проверена в `retentionClock.test.ts`); здесь держится, что прежние строки и значения целы
    const cols: Partial<Record<(typeof TABLES_V15)[number], string>> = { retention_clock: 'id, last_seen' };
    for (const t of TABLES_V15) out[t] = await db.all(`SELECT ${cols[t] ?? '*'} FROM ${t} ORDER BY 1, 2`);
    return out;
  }

  /** База «как была на версии 15»: строка в каждом журнале и состоянии, согласие, забытые ворота. */
  async function v15WithData(): Promise<SqlDb> {
    const db = await memoryDb(15);
    await db.transaction(async (tx) => {
      await tx.run("INSERT INTO aba_write_gate (child_id) VALUES ('kid'), ('sib')");
      await tx.run("INSERT INTO lesson_write_gate (child_id) VALUES ('kid')");
      await tx.run("INSERT INTO aba_trials (child_id, id, session_id, target_id, body, recorded_at) VALUES ('kid', 'tr-1', 's-1', 'A', '{}', ?)", [NOW]);
      await tx.run("INSERT INTO aba_sessions (child_id, id, session_index, body, recorded_at) VALUES ('kid', 's-1', 1, '{}', ?)", [NOW]);
      await tx.run("INSERT INTO aba_ioa (child_id, id, session_id, body, recorded_at) VALUES ('kid', 'ioa-1', 's-1', '{}', ?)", [NOW]);
      await tx.run("INSERT INTO aba_routine_runs (child_id, id, target_id, day, body, recorded_at) VALUES ('kid', 'r-1', 'R', '2026-10-25', '{}', ?)", [NOW]);
      await tx.run(
        "INSERT INTO aba_reinforcer_choices (child_id, chosen_at, source, source_id, reinforcer_id, chosen_by, tokens) VALUES ('sib', ?, 'routine', 'r-9', 'drum', 'child', 3)",
        [NOW],
      );
      await tx.run(
        `INSERT INTO aba_trial_corrections (child_id, trial_id, replacement_id, session_id, recorded_at, ms_since_original, from_response, to_response, token_kept, token_added, reason)
         VALUES ('kid', 'tr-1', 'tr-1~c1', 's-1', ?, 2000, 'independent', 'incorrect', 0, 0, 'adult_misentry')`,
        [NOW],
      );
      await tx.run("INSERT INTO aba_routine_run_amendments (child_id, run_id, body, recorded_at) VALUES ('kid', 'r-1', '{}', ?)", [NOW]);
      await tx.run("INSERT INTO lesson_runs (child_id, id, lesson_id, started_at, body) VALUES ('kid', 'lr-1', 'L1', ?, '{}')", [NOW]);
      await tx.run("INSERT INTO child_state (child_id, key, body, updated_at) VALUES ('kid', 'tokenTraining', '{}', ?)", [NOW]);
      await tx.run("INSERT INTO sync_cursor (child_id, stream, position) VALUES ('kid', 'lesson_runs', '3')");
      await tx.run("INSERT INTO sync_problems (child_id, event_id, reason, noticed_at, kind, retry) VALUES ('kid', 'lesson_runs', 'x', ?, 'lesson_runs', 0)", [NOW]);
      await tx.run('INSERT INTO retention_clock (id, last_seen) VALUES (1, ?)', [NOW]);
      await tx.run(
        `INSERT INTO consent_events (id, scope, action, child_id, text_version, confirmed_by, actor_id, at)
         VALUES ('c-kid', 'aba_processing', 'grant', 'kid', ?, 'biometric', 'parent', '2026-10-25T09:00:00.000Z')`,
        [ABA_TEXT],
      );
      await tx.run("INSERT INTO purge_gate (child_id) VALUES ('sib')");
      await tx.run("INSERT INTO retention_gate (before) VALUES ('2000-01-01')");
    });
    return db;
  }

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
  const userVersion = async (db: SqlDb) => (await db.all<{ user_version: number }>('PRAGMA user_version'))[0].user_version;

  /**
   * Один шаг наката — ровно так, как `migrate` делает каждый свой шаг (миграция и номер версии одной
   * транзакцией). Миграция 16 проверяется как шаг 15 → 16, а не как «последняя»: после неё есть
   * следующие, и полный `migrate` проверяется отдельно.
   */
  async function stepTo(db: SqlDb, version: number): Promise<void> {
    const current = await userVersion(db);
    expect(current).toBe(version - 1); // предпосылка: шаг именно с предыдущей версии
    await db.transaction(async (tx) => {
      await tx.exec(MIGRATIONS[version - 1]);
      await tx.exec(`PRAGMA user_version = ${version}`);
    });
  }

  it('фиксатор: база версии 15 без журнала сопряжения, триггер отзыва о нём не знает', async () => {
    const db = await v15WithData();
    const [{ user_version }] = await db.all<{ user_version: number }>('PRAGMA user_version');
    expect([user_version, (await db.all("SELECT 1 FROM sqlite_master WHERE name = 'aba_pairing_sessions'")).length]).toEqual([15, 0]);
    expect(await revokeTriggerSql(db)).not.toContain('aba_pairing_sessions');
  });

  it('данные версии 15 целы: ни одна строка не потеряна и не изменена', async () => {
    const db = await v15WithData();
    const before = await dump(db);
    await migrate(db);
    expect(await dump(db)).toEqual(before);
  });

  it('шаг 15 → 16 даёт версию 16 с журналом сопряжения; полный накат с версии 15 — последняя версия (MIGRATIONS.length ≥ 17)', async () => {
    const db = await v15WithData();
    await stepTo(db, 16);
    expect([await userVersion(db), (await db.all("SELECT 1 FROM sqlite_master WHERE name = 'aba_pairing_sessions'")).length]).toEqual([16, 1]);
    await migrate(db);
    expect(MIGRATIONS.length).toBeGreaterThanOrEqual(17);
    expect(await userVersion(db)).toBe(MIGRATIONS.length);
  });

  it('шаг 15 → 16: триггер отзыва пересоздан — все прежние таблицы на месте плюс aba_pairing_sessions, ключи состояния те же', async () => {
    const db = await v15WithData();
    const v15 = await revokeTriggerSql(db);
    await stepTo(db, 16);
    const v16 = await revokeTriggerSql(db);
    expect(tablesIn(v15).length).toBeGreaterThanOrEqual(7); // предпосылка: разбор SQL работает
    expect(tablesIn(v16)).toEqual([...tablesIn(v15), 'aba_pairing_sessions']);
    expect(keysIn(v16)).toEqual(keysIn(v15));
    expect(keysIn(v15).length).toBeGreaterThanOrEqual(12);
  });

  it('после полного наката триггер отзыва знает и сопряжение, и все журналы, пришедшие позже (aba_session_tails)', async () => {
    const db = await v15WithData();
    const v15 = await revokeTriggerSql(db);
    await migrate(db);
    const last = await revokeTriggerSql(db);
    expect(tablesIn(last).slice(0, tablesIn(v15).length)).toEqual(tablesIn(v15));
    expect(tablesIn(last)).toEqual(expect.arrayContaining(['aba_pairing_sessions', 'aba_session_tails']));
    expect(keysIn(last)).toEqual(keysIn(v15));
  });

  it('шаг 15 → 16: прочие триггеры версии 15 не тронуты, добавлены ровно три триггера журнала сопряжения', async () => {
    const db = await v15WithData();
    const before = await triggers(db);
    await stepTo(db, 16);
    const after = await triggers(db);
    expect(after.filter((t) => !t.name.startsWith('aba_pairing_sessions_'))).toEqual(before);
    expect(after.filter((t) => t.name.startsWith('aba_pairing_sessions_')).map((t) => t.name)).toEqual([
      'aba_pairing_sessions_need_consent',
      'aba_pairing_sessions_no_delete',
      'aba_pairing_sessions_no_update',
    ]);
  });

  it('после полного наката триггеры версии 15 по-прежнему не тронуты', async () => {
    const db = await v15WithData();
    const before = await triggers(db);
    await migrate(db);
    const after = await triggers(db);
    const names15 = new Set(before.map((t) => t.name));
    expect(after.filter((t) => names15.has(t.name))).toEqual(before);
  });

  it('после полного наката отзыв блокирует каждая таблица триггера (включая пришедшие после 16) и каждый ключ состояния по отдельности', async () => {
    const db = await memoryDb(15, { account: false });
    await migrate(db);
    const sql = await revokeTriggerSql(db);
    const tryRevoke = (n: number) =>
      db.run(
        `INSERT INTO consent_events (id, scope, action, child_id, text_version, confirmed_by, actor_id, at)
         VALUES (?, 'aba_processing', 'revoke', 'kid', ?, 'pin', 'parent', ?)`,
        [`rv-${n}`, ABA_TEXT, NOW],
      );
    const rows: Record<string, string> = {
      aba_trials: "INSERT INTO aba_trials (child_id, id, session_id, target_id, body, recorded_at) VALUES ('kid', 'x', 's', 'A', '{}', '2026-10-25T10:00:00.000Z')",
      aba_sessions: "INSERT INTO aba_sessions (child_id, id, session_index, body, recorded_at) VALUES ('kid', 'x', 1, '{}', '2026-10-25T10:00:00.000Z')",
      aba_ioa: "INSERT INTO aba_ioa (child_id, id, session_id, body, recorded_at) VALUES ('kid', 'x', 's', '{}', '2026-10-25T10:00:00.000Z')",
      aba_routine_runs: "INSERT INTO aba_routine_runs (child_id, id, target_id, day, body, recorded_at) VALUES ('kid', 'x', 'R', '2026-10-25', '{}', '2026-10-25T10:00:00.000Z')",
      aba_reinforcer_choices:
        "INSERT INTO aba_reinforcer_choices (child_id, chosen_at, source, source_id, reinforcer_id, chosen_by) VALUES ('kid', '2026-10-25T10:00:00.000Z', 'session', 'x', 'drum', 'child')",
      aba_trial_corrections: `INSERT INTO aba_trial_corrections (child_id, trial_id, replacement_id, session_id, recorded_at, ms_since_original, from_response, to_response, token_kept, token_added, reason)
        VALUES ('kid', 'x', 'x~c1', 's', '2026-10-25T10:00:00.000Z', 1, 'independent', 'incorrect', 0, 0, 'adult_misentry')`,
      aba_routine_run_amendments: "INSERT INTO aba_routine_run_amendments (child_id, run_id, body, recorded_at) VALUES ('kid', 'x', '{}', '2026-10-25T10:00:00.000Z')",
      aba_pairing_sessions: "INSERT INTO aba_pairing_sessions (child_id, id, day, body, recorded_at) VALUES ('kid', 'x', '2026-10-25', '{}', '2026-10-25T10:00:00.000Z')",
      aba_session_tails: "INSERT INTO aba_session_tails (child_id, session_id, body, recorded_at) VALUES ('kid', 's', '{}', '2026-10-25T10:00:00.000Z')",
    };
    const cases = [
      ...tablesIn(sql).map((t) => ({ what: t, insert: rows[t], table: t })),
      ...keysIn(sql).map((k) => ({
        what: `child_state.${k}`,
        insert: `INSERT INTO child_state (child_id, key, body, updated_at) VALUES ('kid', '${k}', '{}', '2026-10-25T10:00:00.000Z')`,
        table: 'child_state',
      })),
    ];
    expect(tablesIn(sql).filter((t) => !rows[t])).toEqual([]); // для каждой таблицы триггера есть строка
    const notBlocking: string[] = [];
    for (const [i, c] of cases.entries()) {
      await db.transaction(async (tx) => {
        await tx.run("INSERT INTO aba_write_gate (child_id) VALUES ('kid')");
        await tx.run("INSERT INTO lesson_write_gate (child_id) VALUES ('kid')");
        await tx.run(c.insert);
        await tx.run('DELETE FROM aba_write_gate');
        await tx.run('DELETE FROM lesson_write_gate');
      });
      const blocked = await tryRevoke(i).then(
        () => false,
        (e: Error) => /вместе с удалением/.test(e.message),
      );
      if (!blocked) notBlocking.push(c.what);
      await db.transaction(async (tx) => {
        await tx.run("INSERT INTO purge_gate (child_id) VALUES ('*')");
        await tx.run(`DELETE FROM ${c.table}`);
        await tx.run("DELETE FROM consent_events WHERE scope = 'aba_processing'");
        await tx.run('DELETE FROM purge_gate');
      });
    }
    expect(notBlocking).toEqual([]);
  });
});
