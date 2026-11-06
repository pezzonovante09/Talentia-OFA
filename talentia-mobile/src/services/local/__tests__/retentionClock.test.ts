/**
 * №147: срок хранения при скачке часов. Опорная дата — строка `retention_clock` (миграция 15,
 * время в ней только растёт), а у базы без неё — самая поздняя запись журналов и согласий. Скачок
 * вперёд больше `CLOCK_JUMP_HOLD_DAYS` не удаляет ничего и не двигает дату, пока взрослый не
 * подтвердит (`confirmClockJump`); часы назад и дата раньше сборки срок не продлевают.
 */
import type { AbaTrial } from '../../../types/aba';
import { appendTrial } from '../abaLog';
import { appendConsentEvent } from '../consentLog';
import { confirmClockJump, runRetention, StaleClockConfirmationError } from '../purge';
import { CLOCK_JUMP_HOLD_DAYS, migrate } from '../schema';
import type { SqlDb } from '../sql';
import { asAbaWriter, memoryDb, TEST_ACCOUNT_CONSENT, writeLessonRun } from './nodeSql';

const DAY = 24 * 60 * 60 * 1000;
const at = (iso: string, days = 0) => new Date(Date.parse(iso) + days * DAY);
const iso = (d: Date) => d.toISOString();

/** Последний запуск (строка `retention_clock`). */
const SEEN = '2026-10-20T10:00:00.000Z';
/** Старше 12 месяцев от SEEN и от SEEN + сутки. */
const OLD = '2025-10-01T10:00:00.000Z';
/** Внутри срока от SEEN, но старше 12 месяцев от SEEN + 46 дней. */
const MID = '2025-11-20T10:00:00.000Z';
const FRESH = '2026-10-15T10:00:00.000Z';
const KID = 'kid-1';

const run = (id: string, startedAt: string) => ({ id, childId: KID, lessonId: 'l', startedAt, taskSeconds: [10], reviewTasks: 0 });

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

const lastSeen = async (db: SqlDb) => (await db.all<{ last_seen: string }>('SELECT last_seen FROM retention_clock WHERE id = 1'))[0]?.last_seen ?? null;
const runIds = async (db: SqlDb) => (await db.all<{ id: string }>('SELECT id FROM lesson_runs ORDER BY seq')).map((r) => r.id);
const setSeen = (db: SqlDb, v: string) => db.run('INSERT INTO retention_clock (id, last_seen) VALUES (1, ?)', [v]);

/** База с прошлым запуском SEEN и прохождениями OLD, MID, FRESH. */
async function seeded(): Promise<SqlDb> {
  const db = await memoryDb();
  await writeLessonRun(db, run('old', OLD));
  await writeLessonRun(db, run('mid', MID));
  await writeLessonRun(db, run('fresh', FRESH));
  await setSeen(db, SEEN);
  return db;
}

describe('обычный ход часов', () => {
  it('+1 день: удаляется то, что старше 12 месяцев, остальное на месте', async () => {
    const db = await seeded();
    const out = await runRetention(db, { deviceNow: at(SEEN, 1), builtAt: null });
    expect(out).toEqual({ kind: 'applied', removed: 1, now: iso(at(SEEN, 1)) });
    expect(await runIds(db)).toEqual(['mid', 'fresh']);
  });

  it('+1 день: last_seen сдвигается на текущую дату', async () => {
    const db = await seeded();
    await runRetention(db, { deviceNow: at(SEEN, 1), builtAt: null });
    expect(await lastSeen(db)).toBe(iso(at(SEEN, 1)));
  });

  it(`ровно ${CLOCK_JUMP_HOLD_DAYS} дней — ещё обычный ход: удаляет, не удерживает`, async () => {
    const db = await seeded();
    const out = await runRetention(db, { deviceNow: at(SEEN, CLOCK_JUMP_HOLD_DAYS), builtAt: null });
    expect(out.kind).toBe('applied');
    expect(await lastSeen(db)).toBe(iso(at(SEEN, CLOCK_JUMP_HOLD_DAYS)));
  });
});

describe(`скачок вперёд больше ${CLOCK_JUMP_HOLD_DAYS} дней`, () => {
  const JUMP = at(SEEN, CLOCK_JUMP_HOLD_DAYS + 1);

  it('удалено 0: все прохождения на месте', async () => {
    const db = await seeded();
    await runRetention(db, { deviceNow: JUMP, builtAt: null });
    expect(await runIds(db)).toEqual(['old', 'mid', 'fresh']);
  });

  it('результат — held с датой устройства, прошлой датой и числом, которое удалил бы срок', async () => {
    const db = await seeded();
    const out = await runRetention(db, { deviceNow: JUMP, builtAt: null });
    // от SEEN + 46 дней старше 12 месяцев — OLD и MID
    expect(out).toEqual({ kind: 'held', reason: 'clock_jump', deviceNow: iso(JUMP), lastSeen: SEEN, wouldRemove: 2, abaGoalsChildren: 0 });
  });

  it('wouldRemove считает все журналы, а не только уроки', async () => {
    const db = await seeded();
    await asAbaWriter(db, KID, (tx) => appendTrial(tx, KID, trial('tr-old', OLD), OLD));
    await asAbaWriter(db, KID, (tx) => appendTrial(tx, KID, trial('tr-fresh', FRESH), FRESH));
    const out = await runRetention(db, { deviceNow: JUMP, builtAt: null });
    expect(out.kind === 'held' && out.wouldRemove).toBe(3);
  });

  it('last_seen не меняется', async () => {
    const db = await seeded();
    await runRetention(db, { deviceNow: JUMP, builtAt: null });
    expect(await lastSeen(db)).toBe(SEEN);
  });

  it('повторный старт с теми же часами снова даёт held и ничего не удаляет', async () => {
    const db = await seeded();
    await runRetention(db, { deviceNow: JUMP, builtAt: null });
    const again = await runRetention(db, { deviceNow: at(SEEN, CLOCK_JUMP_HOLD_DAYS + 2), builtAt: null });
    expect(again).toMatchObject({ kind: 'held', lastSeen: SEEN });
    expect(await runIds(db)).toEqual(['old', 'mid', 'fresh']);
  });

  it('ребёнок занимался при сбитых часах: следующий старт всё равно held — опорная дата из retention_clock', async () => {
    const db = await seeded();
    await runRetention(db, { deviceNow: JUMP, builtAt: null });
    await writeLessonRun(db, run('in-future', iso(JUMP)));
    const again = await runRetention(db, { deviceNow: JUMP, builtAt: null });
    expect(again).toMatchObject({ kind: 'held', lastSeen: SEEN });
    expect(await runIds(db)).toEqual(['old', 'mid', 'fresh', 'in-future']);
  });

  it('пять лет вперёд: held, сводное число по всем журналам, ничего не удалено', async () => {
    const db = await seeded();
    const out = await runRetention(db, { deviceNow: at(SEEN, 5 * 365), builtAt: null });
    expect(out).toMatchObject({ kind: 'held', wouldRemove: 3 });
    expect(await runIds(db)).toEqual(['old', 'mid', 'fresh']);
  });

  it('дата сборки позже опорной на годы не обходит удержание', async () => {
    const db = await seeded();
    const out = await runRetention(db, { deviceNow: at(SEEN, 400), builtAt: iso(at(SEEN, 399)) });
    expect(out.kind).toBe('held');
    expect(await runIds(db)).toEqual(['old', 'mid', 'fresh']);
  });
});

describe('два скачка по полгода подряд', () => {
  it('+6 месяцев, затем ещё +6: оба раза held, ничего не удалено, опорная дата прежняя', async () => {
    const db = await seeded();
    const first = await runRetention(db, { deviceNow: at(SEEN, 183), builtAt: null });
    const second = await runRetention(db, { deviceNow: at(SEEN, 366), builtAt: null });
    expect([first.kind, second.kind]).toEqual(['held', 'held']);
    expect(await runIds(db)).toEqual(['old', 'mid', 'fresh']);
    expect(await lastSeen(db)).toBe(SEEN);
  });

  it('между скачками ребёнок занимался: второй скачок всё равно удержан', async () => {
    const db = await seeded();
    await runRetention(db, { deviceNow: at(SEEN, 183), builtAt: null });
    await writeLessonRun(db, run('half-year', iso(at(SEEN, 183))));
    const second = await runRetention(db, { deviceNow: at(SEEN, 366), builtAt: null });
    expect(second).toMatchObject({ kind: 'held', lastSeen: SEEN });
    expect(await runIds(db)).toEqual(['old', 'mid', 'fresh', 'half-year']);
  });
});

describe('часы назад', () => {
  it('после старта часы ушли на год назад: срок считается от last_seen', async () => {
    const db = await seeded();
    const out = await runRetention(db, { deviceNow: at(SEEN, -365), builtAt: null });
    expect(out).toEqual({ kind: 'applied', removed: 1, now: SEEN });
    expect(await runIds(db)).toEqual(['mid', 'fresh']);
  });

  it('после старта часы ушли назад: last_seen не уменьшился', async () => {
    const db = await seeded();
    await runRetention(db, { deviceNow: at(SEEN, -30), builtAt: null });
    expect(await lastSeen(db)).toBe(SEEN);
  });

  it('прямой UPDATE last_seen на меньшую дату отклоняет триггер миграции 15', async () => {
    const db = await seeded();
    await expect(db.run('UPDATE retention_clock SET last_seen = ? WHERE id = 1', [OLD])).rejects.toThrow(/время не идёт назад/);
    expect(await lastSeen(db)).toBe(SEEN);
  });

  it('UPDATE на большую дату триггер пропускает', async () => {
    const db = await seeded();
    await db.run('UPDATE retention_clock SET last_seen = ? WHERE id = 1', [iso(at(SEEN, 1))]);
    expect(await lastSeen(db)).toBe(iso(at(SEEN, 1)));
  });

  it('вторая строка в retention_clock не вставляется (id = 1)', async () => {
    const db = await seeded();
    await expect(db.run("INSERT INTO retention_clock (id, last_seen) VALUES (2, '2030-01-01T00:00:00.000Z')")).rejects.toThrow();
  });
});

describe('часы раньше даты сборки', () => {
  /** Без строки retention_clock: опорная дата — согласие TEST_ACCOUNT_CONSENT (2026-01-01). */
  async function noClockRow(): Promise<SqlDb> {
    const db = await memoryDb();
    await writeLessonRun(db, run('edge', EDGE));
    await writeLessonRun(db, run('fresh', FRESH));
    return db;
  }
  const BUILT = '2026-10-20T00:00:00.000Z';
  /** Внутри 12 месяцев от FRESH, но старше 12 месяцев от BUILT. */
  const EDGE = '2025-10-17T10:00:00.000Z';

  it('часы «2000 год», сборка новее опорной даты: срок от даты сборки', async () => {
    const db = await noClockRow();
    const out = await runRetention(db, { deviceNow: new Date('2000-01-01T00:00:00Z'), builtAt: BUILT });
    expect(out).toEqual({ kind: 'applied', removed: 1, now: BUILT });
    expect(await runIds(db)).toEqual(['fresh']);
  });

  it('часы «2000 год», builtAt = null: срок без нижней границы сборки — от опорной даты журналов', async () => {
    const db = await noClockRow();
    // опорная дата = max(FRESH, согласие) = FRESH; от неё EDGE внутри 12 месяцев
    const out = await runRetention(db, { deviceNow: new Date('2000-01-01T00:00:00Z'), builtAt: null });
    expect(out).toEqual({ kind: 'applied', removed: 0, now: FRESH });
    expect(await runIds(db)).toEqual(['edge', 'fresh']);
  });
});

describe('база v14 без retention_clock', () => {
  /** Данные версии 14: журналы и согласия, таблицы retention_clock ещё нет. */
  async function v14(): Promise<SqlDb> {
    const db = await memoryDb(14);
    await writeLessonRun(db, run('old', OLD));
    await writeLessonRun(db, run('fresh', FRESH));
    await migrate(db);
    return db;
  }

  it('после миграции строки нет', async () => {
    const db = await v14();
    expect(await lastSeen(db)).toBeNull();
  });

  it('опорная дата — самая поздняя запись журналов: скачок от неё удержан', async () => {
    const db = await v14();
    const out = await runRetention(db, { deviceNow: at(FRESH, CLOCK_JUMP_HOLD_DAYS + 1), builtAt: null });
    expect(out).toMatchObject({ kind: 'held', lastSeen: FRESH });
    expect(await runIds(db)).toEqual(['old', 'fresh']);
  });

  it('согласие позже журналов — опорная дата по согласию', async () => {
    const db = await v14();
    const consentAt = iso(at(FRESH, 30));
    await appendConsentEvent(db, { id: 'late', scope: 'cloud_sync', action: 'grant', childId: KID, textVersion: 'ru-1', confirmedBy: 'pin', actorId: 'p', at: consentAt }, 'owner');
    // от согласия 20 дней, от журналов 50: не удержано
    const out = await runRetention(db, { deviceNow: at(FRESH, 50), builtAt: null });
    expect(out).toMatchObject({ kind: 'applied', now: iso(at(FRESH, 50)) });
  });

  it('журналов нет — опорная дата по согласию account_local', async () => {
    const db = await memoryDb(14);
    await migrate(db);
    const out = await runRetention(db, { deviceNow: at(TEST_ACCOUNT_CONSENT.at, 100), builtAt: null });
    expect(out).toMatchObject({ kind: 'held', lastSeen: TEST_ACCOUNT_CONSENT.at });
  });

  it('первый обычный старт записывает строку retention_clock', async () => {
    const db = await v14();
    await runRetention(db, { deviceNow: at(FRESH, 1), builtAt: null });
    expect(await lastSeen(db)).toBe(iso(at(FRESH, 1)));
  });

  /**
   * Регрессия (№147, исправлено): `runRetention` при удержании строку `retention_clock` не пишет, а `lastSeenOf` без
   * строки берёт самую позднюю запись журналов. Если первый же старт после обновления — скачок, то
   * первый урок при сбитых часах сдвигает «опорную дату» на сбитую, следующий старт идёт как обычный
   * ход и удаляет все журналы старше «сбитая дата − 12 месяцев». purge.ts:192–202, 237–240.
   */
  it('скачок на первом старте, ребёнок занимался при сбитых часах: повторный старт всё равно held', async () => {
    const db = await v14();
    const JUMP = at(FRESH, 5 * 365);
    expect((await runRetention(db, { deviceNow: JUMP, builtAt: null })).kind).toBe('held');
    await writeLessonRun(db, run('in-future', iso(JUMP)));
    const again = await runRetention(db, { deviceNow: JUMP, builtAt: null });
    expect(again.kind).toBe('held');
  });
});

describe('новый аккаунт до первого старта', () => {
  /**
   * Регрессия (№147, исправлено), тот же корень: у аккаунта, созданного в этой сессии, строки `retention_clock` нет до
   * первого `boot` (её пишет только `runRetention` в ветке applied). Настройка сегодня → часы +5 лет →
   * старт: held, но строка не записана → урок при сбитых часах → следующий старт: опорная дата = урок
   * «через 5 лет», удаляются все настоящие журналы.
   */
  it('held на первом старте нового аккаунта переживает урок при сбитых часах', async () => {
    const db = await memoryDb();
    await writeLessonRun(db, run('today', FRESH));
    const JUMP = at(FRESH, 5 * 365);
    expect((await runRetention(db, { deviceNow: JUMP, builtAt: null })).kind).toBe('held');
    await writeLessonRun(db, run('in-future', iso(JUMP)));
    await runRetention(db, { deviceNow: JUMP, builtAt: null });
    expect(await runIds(db)).toEqual(['today', 'in-future']);
  });
});

describe('confirmClockJump', () => {
  const JUMP = at(SEEN, 60);

  it('подтверждение удаляет то, что старше 12 месяцев от показанной даты', async () => {
    const db = await seeded();
    const removed = await confirmClockJump(db, { observedNow: iso(JUMP), deviceNow: JUMP, builtAt: null });
    expect(removed).toBe(2);
    expect(await runIds(db)).toEqual(['fresh']);
  });

  it('после подтверждения last_seen = observedNow, следующий старт с теми же часами — applied', async () => {
    const db = await seeded();
    await confirmClockJump(db, { observedNow: iso(JUMP), deviceNow: at(SEEN, 60.5), builtAt: null });
    expect(await lastSeen(db)).toBe(iso(JUMP));
    expect((await runRetention(db, { deviceNow: at(SEEN, 61), builtAt: null })).kind).toBe('applied');
  });

  it('wouldRemove на листе совпадает с тем, что удалит подтверждение', async () => {
    const db = await seeded();
    const held = await runRetention(db, { deviceNow: JUMP, builtAt: null });
    if (held.kind !== 'held') throw new Error('ожидалось удержание');
    expect(await confirmClockJump(db, { observedNow: held.deviceNow, deviceNow: JUMP, builtAt: null })).toBe(held.wouldRemove);
  });

  it.each([
    ['вперёд на 2 дня', 2],
    ['назад на 2 дня', -2],
  ])('часы ушли от показанной даты %s: StaleClockConfirmationError', async (_, shift) => {
    const db = await seeded();
    await expect(confirmClockJump(db, { observedNow: iso(JUMP), deviceNow: at(iso(JUMP), shift), builtAt: null })).rejects.toBeInstanceOf(
      StaleClockConfirmationError,
    );
  });

  it('устаревшее подтверждение ничего не удаляет и last_seen не трогает', async () => {
    const db = await seeded();
    await confirmClockJump(db, { observedNow: iso(JUMP), deviceNow: at(iso(JUMP), 1.01), builtAt: null }).catch(() => undefined);
    expect(await runIds(db)).toEqual(['old', 'mid', 'fresh']);
    expect(await lastSeen(db)).toBe(SEEN);
  });

  it('ровно сутки разницы — ещё не устарело', async () => {
    const db = await seeded();
    await expect(confirmClockJump(db, { observedNow: iso(JUMP), deviceNow: at(iso(JUMP), 1), builtAt: null })).resolves.toBe(2);
  });

  it('observedNow не дата: StaleClockConfirmationError', async () => {
    const db = await seeded();
    await expect(confirmClockJump(db, { observedNow: 'вчера', deviceNow: JUMP, builtAt: null })).rejects.toBeInstanceOf(StaleClockConfirmationError);
  });

  it('observedNow раньше last_seen: срок от last_seen, дата не уменьшается', async () => {
    const db = await seeded();
    const past = at(SEEN, -100);
    await confirmClockJump(db, { observedNow: iso(past), deviceNow: past, builtAt: null });
    expect(await lastSeen(db)).toBe(SEEN);
    expect(await runIds(db)).toEqual(['mid', 'fresh']);
  });
});
