/**
 * №147 + child-privacy-compliance 2026-10-25: при удержании срока хранения лист называет, у скольких
 * детей вместе с журналами уйдут цели и настройки ABA (`abaGoalsChildren`). Число обязано совпадать с
 * тем, что на самом деле удалит `confirmClockJump` по дате с листа: меньше — родитель подтверждает
 * удаление, о котором не знал; больше — пугаем зря.
 */
import type { AbaTrial } from '../../../types/aba';
import { appendTrial } from '../abaLog';
import { ABA_STATE_KEYS, saveChildState } from '../childState';
import { confirmClockJump, runRetention } from '../purge';
import { CLOCK_JUMP_HOLD_DAYS } from '../schema';
import type { SqlDb } from '../sql';
import { asAbaWriter, memoryDb, writeLessonRun } from './nodeSql';

const DAY = 24 * 60 * 60 * 1000;
const at = (iso: string, days = 0) => new Date(Date.parse(iso) + days * DAY);
const iso = (d: Date) => d.toISOString();

/** Прошлый запуск. */
const SEEN = '2026-10-20T10:00:00.000Z';
/** Скачок часов на 46 дней — удержание. */
const JUMP = at(SEEN, CLOCK_JUMP_HOLD_DAYS + 1);
/** Старше 12 месяцев и от SEEN, и от JUMP. */
const OLD = '2025-10-01T10:00:00.000Z';
/** В сроке от SEEN, но старше 12 месяцев от JUMP. */
const MID = '2025-11-20T10:00:00.000Z';
const FRESH = '2026-10-15T10:00:00.000Z';

const trial = (id: string, sdEndedAt: string): AbaTrial => ({
  id,
  sessionId: 's',
  targetId: 'A',
  exemplarId: 'A-1',
  index: 0,
  kind: 'teaching',
  startPromptLevel: 0,
  promptLevelUsed: 0,
  presentations: 1,
  response: 'independent',
  emittedBeforePrompt: true,
  latencyMs: 900,
  latencyFromFirstSdMs: 900,
  latencySource: 'adult_press',
  promptDelayMs: 3000,
  responseWindowMs: 5000,
  presentationLog: [],
  sdEndedAt,
  scoredBy: 'adult',
  tokens: 0,
});

const goals = (db: SqlDb, childId: string, updatedAt: string) =>
  asAbaWriter(db, childId, (tx) => saveChildState(tx, childId, 'abaTargets', { A: { targetId: 'A', phase: 'acquisition' } } as never, updatedAt));
const board = (db: SqlDb, childId: string, updatedAt: string) =>
  asAbaWriter(db, childId, (tx) => saveChildState(tx, childId, 'abaBoard', { earned: 1, nonContingent: 0 }, updatedAt));
const trialAt = (db: SqlDb, childId: string, id: string, recordedAt: string) =>
  asAbaWriter(db, childId, (tx) => appendTrial(tx, childId, trial(id, recordedAt), recordedAt));

/** Дети, у которых в базе есть хоть один ключ состояния ABA. */
async function withAbaState(db: SqlDb): Promise<string[]> {
  const rows = await db.all<{ child_id: string }>(
    `SELECT DISTINCT child_id FROM child_state WHERE key IN (${ABA_STATE_KEYS.map(() => '?').join(', ')}) ORDER BY child_id`,
    [...ABA_STATE_KEYS],
  );
  return rows.map((r) => r.child_id);
}

async function baseDb(): Promise<SqlDb> {
  const db = await memoryDb();
  await db.run('INSERT INTO retention_clock (id, last_seen) VALUES (1, ?)', [SEEN]);
  return db;
}

/** Удержание по JUMP → подтверждение той же даты → сколько детей потеряли состояние ABA. */
async function heldThenConfirmed(db: SqlDb, builtAt: string | null = null) {
  const out = await runRetention(db, { deviceNow: JUMP, builtAt });
  if (out.kind !== 'held') throw new Error(`ожидалось удержание, а не ${out.kind}`);
  const before = await withAbaState(db);
  await confirmClockJump(db, { observedNow: out.deviceNow, deviceNow: JUMP, builtAt });
  const after = await withAbaState(db);
  return { shown: out.abaGoalsChildren, removed: before.filter((c) => !after.includes(c)) };
}

describe('abaGoalsChildren = число детей, чьё ABA-состояние удалит подтверждение', () => {
  it('нет ABA ни у кого (только уроки) — 0, и подтверждение ничего ABA не удаляет', async () => {
    const db = await baseDb();
    await writeLessonRun(db, { id: 'r', childId: 'kid-lessons', lessonId: 'l', startedAt: OLD, taskSeconds: [10], reviewTasks: 0 });
    const { shown, removed } = await heldThenConfirmed(db);
    expect([shown, removed]).toEqual([0, []]);
  });

  it('цели старше года без занятий — ребёнок посчитан и его цели удалены', async () => {
    const db = await baseDb();
    await goals(db, 'kid-idle', OLD);
    const { shown, removed } = await heldThenConfirmed(db);
    expect([shown, removed]).toEqual([1, ['kid-idle']]);
  });

  it('цели старые, но свежая проба — не посчитан и не удалён', async () => {
    const db = await baseDb();
    await goals(db, 'kid-active', OLD);
    await trialAt(db, 'kid-active', 'tr-fresh', FRESH);
    const { shown, removed } = await heldThenConfirmed(db);
    expect([shown, removed]).toEqual([0, []]);
  });

  it('состояние в сроке от прошлого запуска, но за сроком от даты на листе — посчитан: граница по дате листа', async () => {
    const db = await baseDb();
    await goals(db, 'kid-mid', MID);
    const { shown, removed } = await heldThenConfirmed(db);
    expect([shown, removed]).toEqual([1, ['kid-mid']]);
  });

  it('у одного ребёнка несколько ключей ABA — считается один раз', async () => {
    const db = await baseDb();
    await goals(db, 'kid-two-keys', OLD);
    await board(db, 'kid-two-keys', OLD);
    const { shown, removed } = await heldThenConfirmed(db);
    expect([shown, removed]).toEqual([1, ['kid-two-keys']]);
  });

  it('смешанный набор детей — число на листе равно числу удалённых', async () => {
    const db = await baseDb();
    await goals(db, 'kid-idle', OLD);
    await goals(db, 'kid-mid', MID);
    await goals(db, 'kid-active', OLD);
    await trialAt(db, 'kid-active', 'tr-fresh', FRESH);
    await goals(db, 'kid-fresh', FRESH);
    await trialAt(db, 'kid-trial-only', 'tr-old', OLD);
    const { shown, removed } = await heldThenConfirmed(db);
    expect(removed.sort()).toEqual(['kid-idle', 'kid-mid']);
    expect(shown).toBe(removed.length);
  });

  /**
   * Регрессия (исправлено 2026-10-25): `runRetention` в ветке удержания считает и `wouldRemove`, и
   * `abaGoalsChildren` от `deviceNow` (purge.ts:251–252), а `confirmClockJump` удаляет от
   * `max(observedNow, builtAt, lastSeen)` (purge.ts:271). Если дата сборки позже часов устройства
   * (часы отстают, но всё равно больше чем на 45 дней впереди прошлого запуска — например, приложение
   * не открывали полтора года, а дата на телефоне сбита назад на полгода), подтверждение удаляет
   * больше, чем назвал лист.
   */
  it('дата сборки позже часов на листе — число на листе всё равно равно числу удалённых', async () => {
    const db = await baseDb();
    // в сроке от JUMP, но за сроком от даты сборки (JUMP + 60 дней)
    const nearEdge = iso(at(SEEN, CLOCK_JUMP_HOLD_DAYS + 1 - 365 + 30));
    await goals(db, 'kid-edge', nearEdge);
    const { shown, removed } = await heldThenConfirmed(db, iso(at(SEEN, CLOCK_JUMP_HOLD_DAYS + 61)));
    expect(shown).toBe(removed.length);
  });
});
