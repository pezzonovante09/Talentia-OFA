/**
 * Удаление и экспорт на устройстве. Спецификация — PARENT.md, «Удаление и экспорт».
 *
 * Журналы удалить обычным запросом нельзя (`schema.ts`). Эти функции — единственный
 * путь: они открывают `purge_gate` для одного ребёнка (или `*` — для всего) внутри одной
 * транзакции и закрывают его в той же транзакции. Без корзины и «7 дней на
 * восстановление»: данные ребёнка не держат в корзине.
 */
import type { AbaIoaRecord, AbaObserver, AbaRoutineRun, AbaSession } from '../../types/aba';
import type { ConsentEvent, GuardianRole } from '../../domain/consent';
import { ABA_DELETED_KEYS, ABA_STATE_KEYS, loadChildState } from './childState';
import { insertConsentEvent, readConsentLog } from './consentLog';
import { withDbLock } from './lock';
import { RETENTION_MONTHS } from './schema';
import type { SqlDb } from './sql';

const JOURNALS = ['aba_trials', 'aba_sessions', 'aba_ioa', 'aba_routine_runs', 'aba_reinforcer_choices', 'lesson_runs'] as const;

/**
 * Состояние ABA для специалиста — явный список, а не все ключи ABA (`child-privacy-compliance`,
 * раунд 2, Р3): снимки «в работе» (`abaSessionInProgress`, `abaRoutineRunInProgress`) несут
 * настоящие uuid наблюдателей, а их пробы и так в `abaTrials`. Новый ключ ABA специалисту не
 * уходит сам — нужно решение и строка здесь.
 */
export const SPECIALIST_STATE_KEYS = [
  'abaTargets',
  'tokenTraining',
  'identifySets',
  'abaBoard',
  'abaSessionIndex',
  'physicalPromptAllowed',
  'abaObservers',
] as const satisfies readonly (typeof ABA_STATE_KEYS)[number][];

/** Снимки «в работе»: срок хранения — по их началу (копии проб в них живут не дольше журнала). */
const IN_PROGRESS_KEYS = ['abaSessionInProgress', 'abaRoutineRunInProgress'] as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function withGate(db: SqlDb, id: string, fn: (tx: SqlDb) => Promise<void>): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.run('INSERT INTO purge_gate (child_id) VALUES (?)', [id]);
    await fn(tx);
    await tx.run('DELETE FROM purge_gate WHERE child_id = ?', [id]);
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
  await db.transaction(async (tx) => {
    await tx.run('INSERT INTO retention_gate (before) VALUES (?)', [before]);
    for (const [t, col] of [
      ['aba_trials', 'recorded_at'],
      ['aba_sessions', 'recorded_at'],
      ['aba_ioa', 'recorded_at'],
      ['aba_routine_runs', 'recorded_at'],
      ['aba_reinforcer_choices', 'chosen_at'],
      ['lesson_runs', 'started_at'],
    ] as const) {
      removed += (await tx.run(`DELETE FROM ${t} WHERE ${col} < ?`, [before])).changes;
    }
    // брошенный снимок «в работе» старше срока — копии его проб не переживают журнал
    removed += (
      await tx.run(
        `DELETE FROM child_state WHERE key IN (${IN_PROGRESS_KEYS.map(() => '?').join(', ')})
           AND json_extract(body, '$.startedAt') < ?`,
        [...IN_PROGRESS_KEYS, Date.parse(before)],
      )
    ).changes;
    await tx.run('DELETE FROM retention_gate');
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
  await withGate(db, childId, async (tx) => {
    for (const t of JOURNALS) await tx.run(`DELETE FROM ${t} WHERE child_id = ?`, [childId]);
    await tx.run('DELETE FROM child_state WHERE child_id = ?', [childId]);
    await tx.run('DELETE FROM sync_cursor WHERE child_id = ?', [childId]);
    await tx.run('DELETE FROM sync_problems WHERE child_id = ?', [childId]);
    await tx.run('UPDATE consent_events SET child_id = ? WHERE child_id = ?', [childPseudonym, childId]);
  });
}

/**
 * Очистить прогресс — профиль остаётся. Родители просят это чаще удаления. Согласия не
 * трогаются; курсоры синхронизации начинаются заново.
 */
export async function clearChildProgress(db: SqlDb, childId: string): Promise<void> {
  await withGate(db, childId, async (tx) => {
    for (const t of JOURNALS) await tx.run(`DELETE FROM ${t} WHERE child_id = ?`, [childId]);
    await tx.run('DELETE FROM child_state WHERE child_id = ?', [childId]);
    await tx.run('DELETE FROM sync_cursor WHERE child_id = ?', [childId]);
  });
}

/**
 * Отзыв согласия на данные ABA: событие отзыва и удаление проб, сессий и состояния ABA
 * ребёнка — одной транзакцией. Или отзыв записан и данных нет, или не случилось ничего:
 * отзыв без удаления оставил бы данные о здоровье без основания, удаление без отзыва —
 * режим, который снова пишет. Остальное о ребёнке (уроки, навыки, согласия) не трогается.
 * Экспорт — до вызова: после него экспортировать нечего. Отзыв не отклоняется и при сбитых
 * часах (`placeConsentEvent`); отклоняется только чужая роль — отзывает владелец.
 */
export async function revokeAbaProcessing(db: SqlDb, revoke: ConsentEvent, actorRole: GuardianRole): Promise<void> {
  if (revoke.scope !== 'aba_processing' || revoke.action !== 'revoke' || !revoke.childId) {
    throw new Error('Ожидается отзыв согласия на данные ABA для ребёнка');
  }
  const childId = revoke.childId;
  await withDbLock(db, () =>
    db.transaction(async (tx) => {
      await tx.run('INSERT INTO purge_gate (child_id) VALUES (?)', [childId]);
      await tx.run('DELETE FROM aba_trials WHERE child_id = ?', [childId]);
      await tx.run('DELETE FROM aba_sessions WHERE child_id = ?', [childId]);
      await tx.run('DELETE FROM aba_ioa WHERE child_id = ?', [childId]);
      await tx.run('DELETE FROM aba_routine_runs WHERE child_id = ?', [childId]);
      await tx.run('DELETE FROM aba_reinforcer_choices WHERE child_id = ?', [childId]);
      await tx.run(
        `DELETE FROM child_state WHERE child_id = ? AND key IN (${ABA_DELETED_KEYS.map(() => '?').join(', ')})`,
        [childId, ...ABA_DELETED_KEYS],
      );
      await tx.run('DELETE FROM purge_gate WHERE child_id = ?', [childId]);
      // событие — после удаления: отзыв при оставшихся данных база не примет (миграция 4)
      await insertConsentEvent(tx, revoke, actorRole);
    }),
  );
  await compactAfterDelete(db);
}

/** Сколько удалит отзыв — для экрана перед отзывом: «будет удалено N сессий». */
export async function abaDataSummary(
  db: SqlDb,
  childId: string,
): Promise<{
  sessions: number;
  trials: number;
  ioaRecords: number;
  routineRuns: number;
  reinforcerChoices: number;
  observers: number;
  settings: boolean;
}> {
  const count = async (table: string) =>
    (await db.all<{ n: number }>(`SELECT count(*) AS n FROM ${table} WHERE child_id = ?`, [childId]))[0].n;
  const observers = await loadChildState(db, childId, 'abaObservers');
  const [settings] = await db.all<{ n: number }>(
    "SELECT count(*) AS n FROM child_state WHERE child_id = ? AND key IN ('physicalPromptAllowed', 'abaPaused')",
    [childId],
  );
  // экран перед отзывом называет и состояние: наблюдателей и разрешение физической подсказки
  return {
    sessions: await count('aba_sessions'),
    trials: await count('aba_trials'),
    ioaRecords: await count('aba_ioa'),
    routineRuns: await count('aba_routine_runs'),
    reinforcerChoices: await count('aba_reinforcer_choices'),
    observers: observers?.length ?? 0,
    settings: settings.n > 0,
  };
}

/**
 * Все строки аккаунта прочь, включая журнал согласий: он переживает удаление на
 * сервере, с псевдонимами, — об этом говорит экран удаления. При удалении аккаунта после
 * этого удаляется и сам файл (`deleteLocalDb`).
 */
export async function wipeDevice(db: SqlDb): Promise<void> {
  await withGate(db, '*', async (tx) => {
    for (const t of [...JOURNALS, 'consent_events', 'child_state', 'sync_cursor', 'consent_delivered', 'sync_problems']) {
      await tx.run(`DELETE FROM ${t}`);
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
  abaIoa: unknown[];
  abaRoutineRuns: unknown[];
  /** История выборов подкрепителя (по порядку выбора). */
  abaReinforcerChoices: unknown[];
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
  return db.transaction((tx) => collectExport(tx, childId, exportedAt, profile));
}

async function choicesOf(db: SqlDb, childId: string): Promise<unknown[]> {
  return db.all(
    `SELECT chosen_at AS chosenAt, source, source_id AS sourceId, reinforcer_id AS reinforcerId, chosen_by AS chosenBy
       FROM aba_reinforcer_choices WHERE child_id = ? ORDER BY chosen_at, seq`,
    [childId],
  );
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
    abaIoa: await bodies('aba_ioa'),
    abaRoutineRuns: await bodies('aba_routine_runs'),
    abaReinforcerChoices: await choicesOf(db, childId),
    lessonRuns: await bodies('lesson_runs'),
    state,
    consentEvents: (await readConsentLog(db)).filter((e) => e.childId === childId || e.childId === null),
  };
}

const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

/** Все строки-даты внутри значения заменены смещением в мс от `origin` (не дата — без изменений). */
function relativeTimes<T>(value: T, origin: number): T {
  if (typeof value === 'string' && ISO_TIME.test(value)) {
    const ms = Date.parse(value) - origin;
    return (Number.isFinite(ms) ? ms : null) as T;
  }
  if (Array.isArray(value)) return value.map((v) => relativeTimes(v, origin)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, relativeTimes(v, origin)])) as T;
  }
  return value;
}

/** Все строки-даты внутри значения заменены датой без времени суток (`YYYY-MM-DD`). */
function dayOnly<T>(value: T): T {
  if (typeof value === 'string' && ISO_TIME.test(value)) return value.slice(0, 10) as T;
  if (Array.isArray(value)) return value.map(dayOnly) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, dayOnly(v)])) as T;
  }
  return value;
}

/** Экспорт для специалиста центра: только данные ABA, без данных взрослых. */
export type SpecialistExport = {
  exportedAt: string;
  /** Пробы рутин и сессий: время — смещения в мс от начала прогона или сессии (№95, №96). */
  abaTrials: unknown[];
  /** Сессии: `day`, `durationSec`, прочее время — смещения в мс от начала сессии (№96). */
  abaSessions: unknown[];
  /** IOA: `enteredDay` вместо времени ввода (№96). Состояние ниже — даты без времени суток. */
  abaIoa: unknown[];
  /**
   * Прогоны рутин: день и длительность в секундах, без точных `startedAt` / `endedAt` (№95);
   * ведущий наблюдатель — той же меткой.
   */
  abaRoutineRuns: unknown[];
  /** Состояние ABA; наблюдатели — метками `O1`, `O2`… с ролью и обучен ли. */
  state: Record<string, unknown>;
};

/**
 * Экспорт для специалиста — отдельный от родительского: без профиля, согласий, уроков и
 * идентификаторов взрослых. id наблюдателей заменены метками `O1`, `O2`… в пределах файла:
 * между двумя выгрузками «O1» может быть разными людьми (условия приватности, ABA.md). Копии, переданные в центр, приложение не удаляет —
 * это сказано в тексте согласия.
 */
export async function exportForSpecialist(db: SqlDb, childId: string, exportedAt: string): Promise<SpecialistExport> {
  return db.transaction(async (tx) => {
    const bodies = async <T>(table: string) =>
      (await tx.all<{ body: string }>(`SELECT body FROM ${table} WHERE child_id = ? ORDER BY seq`, [childId])).map(
        (r) => JSON.parse(r.body) as T,
      );
    const state = Object.fromEntries(
      (
        await tx.all<{ key: string; body: string }>(
          `SELECT key, body FROM child_state WHERE child_id = ? AND key IN (${SPECIALIST_STATE_KEYS.map(() => '?').join(', ')})`,
          [childId, ...SPECIALIST_STATE_KEYS],
        )
      ).map((r) => [r.key, JSON.parse(r.body)]),
    );
    const sessions = await bodies<AbaSession>('aba_sessions');
    const ioa = await bodies<AbaIoaRecord>('aba_ioa');
    const routineRuns = await bodies<AbaRoutineRun>('aba_routine_runs');
    const observers = (state.abaObservers ?? []) as AbaObserver[];

    const labels = new Map<string, string>();
    const label = (id: string | null) => {
      if (id === null) return null;
      // метка без языка; номера стабильны только в пределах одного файла
      if (!labels.has(id)) labels.set(id, `O${labels.size + 1}`);
      return labels.get(id)!;
    };
    // время суток сессий и IOA — тот же режим дня дома (№96): день, длительность и смещения в мс
    // от начала сессии; день — по UTC-дате метки (локальный день в записи сессии не хранится)
    const sessionStart = new Map(sessions.map((s) => [s.id, Date.parse(s.startedAt)]));
    const abaSessions = sessions.map(({ startedAt, endedAt, ...s }) => {
      const origin = Date.parse(startedAt);
      const seconds = endedAt === null ? NaN : Math.round((Date.parse(endedAt) - origin) / 1000);
      return {
        ...relativeTimes(s, origin),
        day: startedAt.slice(0, 10),
        durationSec: Number.isFinite(seconds) ? Math.max(0, seconds) : null,
        primaryObserverId: label(s.primaryObserverId),
      };
    });
    const abaIoa = ioa.map(({ enteredAt, ...r }) => ({
      ...r,
      enteredDay: String(enteredAt).slice(0, 10),
      secondaryObserverId: label(r.secondaryObserverId),
    }));
    // точное время прогона выдаёт расписание дня ребёнка дома (туалет, одевание) — решение №95:
    // специалисту день и длительность; варианты обмена — тоже не его данные
    const abaRoutineRuns = routineRuns.map(({ startedAt, endedAt, exchangeOptions: _options, ...r }) => {
      const seconds = Math.round((Date.parse(endedAt) - Date.parse(startedAt)) / 1000);
      return {
        ...r,
        durationSec: Number.isFinite(seconds) ? Math.max(0, seconds) : null,
        primaryObserverId: label(r.primaryObserverId),
      };
    });
    // пробы звеньев рутины несут абсолютное время (`sdEndedAt`, журнал предъявлений) — то же
    // расписание дома: вместо дат смещения в мс от начала прогона (латентности — отдельные числа)
    const runStart = new Map([...sessionStart, ...routineRuns.map((r): [string, number] => [r.id, Date.parse(r.startedAt)])]);
    const trials = await bodies<{ sessionId: string; sdEndedAt?: string }>('aba_trials');
    // проба свёрнутой, ещё не записанной сессии: записи сессии нет — отсчёт от самой ранней пробы
    // этой сессии, чтобы абсолютное время не ушло специалисту
    const orphanStart = new Map<string, number>();
    for (const t of trials) {
      if (runStart.has(t.sessionId)) continue;
      const at = Date.parse(t.sdEndedAt ?? '');
      if (Number.isFinite(at)) orphanStart.set(t.sessionId, Math.min(orphanStart.get(t.sessionId) ?? at, at));
    }
    // нет отсчёта вовсе (проба без парсируемого времени и без записи сессии) — даты вымываются в null, а не в абсолютные мс
    const abaTrials = trials.map((t) => relativeTimes(t, runStart.get(t.sessionId) ?? orphanStart.get(t.sessionId) ?? Number.NaN));
    return {
      exportedAt,
      abaTrials,
      abaSessions,
      abaIoa,
      abaRoutineRuns,
      state: { ...dayOnly(state), abaObservers: observers.map((o) => ({ id: label(o.id), role: o.role, trained: o.trained })) },
    };
  });
}
