/**
 * Удаление и экспорт на устройстве. Спецификация — PARENT.md, «Удаление и экспорт».
 *
 * Журналы удалить обычным запросом нельзя (`schema.ts`). Эти функции — единственный
 * путь: они открывают `purge_gate` для одного ребёнка (или `*` — для всего) внутри одной
 * транзакции и закрывают его в той же транзакции. Без корзины и «7 дней на
 * восстановление»: данные ребёнка не держат в корзине.
 */
import type { AbaIoaRecord, AbaObserver, AbaPairingSession, AbaRoutineRun, AbaSession, AbaSessionTail } from '../../types/aba';
import type { ConsentEvent, GuardianRole } from '../../domain/consent';
import type { TokenTrainingState } from '../../domain/abaTokenTraining';
import { withAmendments, type RoutineRunAmendment } from './abaLog';
import { ABA_DELETED_KEYS, ABA_STATE_KEYS, loadChildState } from './childState';
import { insertConsentEvent, readConsentLog } from './consentLog';
import { EXPORT_DIR, type DeviceStore } from './device';
import { withDbLock } from './lock';
import { leaksTime } from '../../domain/ids';
import { CLOCK_JUMP_HOLD_DAYS, RETENTION_MONTHS } from './schema';
import type { SqlDb } from './sql';

const JOURNALS = [
  'aba_trials',
  'aba_sessions',
  'aba_ioa',
  'aba_routine_runs',
  'aba_reinforcer_choices',
  'aba_trial_corrections',
  'aba_routine_run_amendments',
  'aba_pairing_sessions',
  'aba_session_tails',
  'lesson_runs',
] as const;

/** Журналы ABA — всё из `JOURNALS`, кроме уроков: по ним идёт отзыв согласия `aba_processing`. */
const ABA_JOURNALS = JOURNALS.filter((t) => t !== 'lesson_runs');

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
  'breakCard',
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

/** Журналы и их колонка времени — по ним срок хранения и опорная дата часов. */
const RETENTION_COLUMNS = [
  ['aba_trials', 'recorded_at'],
  ['aba_sessions', 'recorded_at'],
  ['aba_ioa', 'recorded_at'],
  ['aba_routine_runs', 'recorded_at'],
  ['aba_reinforcer_choices', 'chosen_at'],
  ['aba_trial_corrections', 'recorded_at'],
  ['aba_routine_run_amendments', 'recorded_at'],
  ['aba_pairing_sessions', 'recorded_at'],
  ['aba_session_tails', 'recorded_at'],
  ['lesson_runs', 'started_at'],
] as const;

/** Граница срока хранения: всё раньше неё удаляется (`RETENTION_MONTHS`). */
export function retentionCutoff(now: Date, months = RETENTION_MONTHS): string {
  const d = new Date(now.getTime());
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString();
}

/**
 * Дети, у которых последняя активность ABA раньше границы срока (решение №105: сводное состояние
 * ABA живёт 12 месяцев с последней сессии или прогона). Активность — самая свежая запись журналов
 * ABA (пробы, сессии, прогоны рутин) и самая свежая запись состояния ABA: ребёнок, у которого
 * сессий ещё не было (сопряжение, наблюдатели), не теряет состояние на следующий день.
 */
async function abaIdleChildren(tx: SqlDb, before: string): Promise<string[]> {
  const latest = new Map<string, number>();
  const bump = (childId: string, at: string) => {
    const ms = Date.parse(at);
    if (Number.isFinite(ms)) latest.set(childId, Math.max(latest.get(childId) ?? -Infinity, ms));
    else if (!latest.has(childId)) latest.set(childId, -Infinity);
  };
  const keys = ABA_STATE_KEYS.map(() => '?').join(', ');
  for (const r of await tx.all<{ child_id: string; at: string }>(
    `SELECT child_id, updated_at AS at FROM child_state WHERE key IN (${keys})`,
    [...ABA_STATE_KEYS],
  )) {
    bump(r.child_id, r.at);
  }
  // сопряжение — тоже занятие: ребёнок, у которого были только сессии сопряжения, не теряет состояние
  for (const t of ['aba_trials', 'aba_sessions', 'aba_routine_runs', 'aba_pairing_sessions']) {
    for (const r of await tx.all<{ child_id: string; at: string }>(
      `SELECT child_id, MAX(recorded_at) AS at FROM ${t} GROUP BY child_id`,
    )) {
      if (latest.has(r.child_id)) bump(r.child_id, r.at);
    }
  }
  const cutoff = Date.parse(before);
  return [...latest.entries()].filter(([, ms]) => ms < cutoff).map(([id]) => id);
}

/**
 * Удалить журналы старше срока хранения — при старте приложения. Только их: база
 * пускает удаление по сроку, но не по выбору. И сводное состояние ABA ребёнка, у которого
 * за срок не было ни сессии, ни прогона (№105): цели, доска, наборы, наблюдатели — иначе
 * «данные о ходе занятий» жили бы бессрочно после журналов. Пауза (`abaPaused`) — настройка
 * родителя, а не данные о ребёнке: остаётся. Согласие не трогается.
 *
 * Низкий уровень: удаляет всё раньше `now − 12 месяцев`, `now` не проверяет. На старте зовётся
 * только через `runRetention` — она решает, можно ли верить часам (№147). `null` — ничего.
 */
export async function applyRetention(db: SqlDb, now: Date | null): Promise<number> {
  if (now === null) return 0;
  const before = retentionCutoff(now);
  let removed = 0;
  await db.transaction(async (tx) => {
    // до удаления журналов: свежие записи журналов — активность
    for (const childId of await abaIdleChildren(tx, before)) {
      removed += (
        await tx.run(
          `DELETE FROM child_state WHERE child_id = ? AND key IN (${ABA_STATE_KEYS.map(() => '?').join(', ')})`,
          [childId, ...ABA_STATE_KEYS],
        )
      ).changes;
    }
    await tx.run('INSERT INTO retention_gate (before) VALUES (?)', [before]);
    for (const [t, col] of RETENTION_COLUMNS) {
      removed += (await tx.run(`DELETE FROM ${t} WHERE ${col} < ?`, [before])).changes;
    }
    // открытая форма места с копиями проб прогона — по началу прогона, как снимки «в работе»
    removed += (
      await tx.run(
        "DELETE FROM child_state WHERE key = 'abaRoutineSettingOpen' AND json_extract(body, '$.run.startedAt') < ?",
        [Date.parse(before)],
      )
    ).changes;
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

/** Срок хранения на старте (№147): удалено — или удержано до подтверждения взрослого. */
export type RetentionOutcome =
  | { kind: 'applied'; removed: number; now: string }
  | {
      kind: 'held';
      reason: 'clock_jump';
      deviceNow: string;
      lastSeen: string;
      /** Журнальных записей под удаление. */
      wouldRemove: number;
      /** Детей, у которых вместе с журналами уйдут цели и настройки ABA (нет занятий 12 месяцев). */
      abaGoalsChildren: number;
    };

/** Подтверждение устарело: часы ушли от показанных на листе больше чем на сутки — показать заново. */
export class StaleClockConfirmationError extends Error {
  constructor() {
    super('Часы изменились после показа листа');
    this.name = 'StaleClockConfirmationError';
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;
const msOf = (iso: string | null | undefined) => (iso ? Date.parse(iso) : NaN);
const maxIso = (...xs: (string | null | undefined)[]): string | null => {
  const ok = xs.map(msOf).filter(Number.isFinite);
  return ok.length ? new Date(Math.max(...ok)).toISOString() : null;
};

/**
 * Последняя виденная дата: строка `retention_clock`, а у базы, где её ещё нет, — самая поздняя
 * запись журналов и согласий (у живого аккаунта есть хотя бы согласие `account_local`).
 */
async function lastSeenOf(db: SqlDb): Promise<string | null> {
  const [row] = await db.all<{ last_seen: string }>('SELECT last_seen FROM retention_clock WHERE id = 1');
  if (row) return row.last_seen;
  const marks: (string | null)[] = [];
  for (const [t, col] of RETENTION_COLUMNS) {
    const [r] = await db.all<{ at: string | null }>(`SELECT MAX(${col}) AS at FROM ${t}`);
    marks.push(r?.at ?? null);
  }
  const [c] = await db.all<{ at: string | null }>('SELECT MAX(at) AS at FROM consent_events');
  return maxIso(...marks, c?.at ?? null);
}

/** Время только растёт: `MAX` с прежним; триггер миграции 15 держит то же в самой базе. */
async function advanceLastSeen(db: SqlDb, at: string): Promise<void> {
  await db.run(
    `INSERT INTO retention_clock (id, last_seen) VALUES (1, ?)
     ON CONFLICT (id) DO UPDATE SET last_seen = MAX(last_seen, excluded.last_seen)`,
    [at],
  );
}

/** Сколько журнальных записей удалил бы срок от `now` — число на листе подтверждения. */
async function countExpired(db: SqlDb, now: string): Promise<number> {
  const before = retentionCutoff(new Date(now));
  let n = 0;
  for (const [t, col] of RETENTION_COLUMNS) {
    const [r] = await db.all<{ n: number }>(`SELECT COUNT(*) AS n FROM ${t} WHERE ${col} < ?`, [before]);
    n += r?.n ?? 0;
  }
  return n;
}

/**
 * Срок хранения на старте по часам устройства (№131, №147). Время — `max(часы, дата сборки,
 * последняя виденная)`: часы назад не продлевают хранение, дата «2000 год» не обходит срок. Если
 * часы ушли вперёд от последней виденной даты больше чем на `CLOCK_JUMP_HOLD_DAYS`, ничего не
 * удаляется и дата не двигается: удаление ждёт взрослого (`confirmClockJump`), иначе ребёнок,
 * переведя дату «ради игр», стёр бы журналы всех детей без возврата. Удержание не хранится —
 * его заново находит каждый старт.
 */
export async function runRetention(
  db: SqlDb,
  { deviceNow, builtAt }: { deviceNow: Date; builtAt: string | null },
): Promise<RetentionOutcome> {
  const device = deviceNow.toISOString();
  const lastSeen = await lastSeenOf(db);
  if (lastSeen && deviceNow.getTime() - msOf(lastSeen) > CLOCK_JUMP_HOLD_DAYS * DAY_MS) {
    // опорную дату — в строку, если её не было: иначе урок при сбитых часах сдвинул бы опору журналов
    // в будущее, и следующий старт удалил бы всё без подтверждения
    await db.run('INSERT INTO retention_clock (id, last_seen) VALUES (1, ?) ON CONFLICT (id) DO NOTHING', [lastSeen]);
    // считать от той же даты, от которой удалит подтверждение (`confirmClockJump`): дата сборки может быть позже часов
    const effective = maxIso(device, builtAt, lastSeen)!;
    const abaGoalsChildren = (await abaIdleChildren(db, retentionCutoff(new Date(effective)))).length;
    return { kind: 'held', reason: 'clock_jump', deviceNow: device, lastSeen, wouldRemove: await countExpired(db, effective), abaGoalsChildren };
  }
  const now = maxIso(device, builtAt, lastSeen)!;
  const removed = await applyRetention(db, new Date(now));
  await advanceLastSeen(db, now);
  return { kind: 'applied', removed, now };
}

/**
 * Взрослый за PIN подтвердил дату, которую видел на листе (`observedNow`). Если часы с тех пор
 * ушли больше чем на сутки — `StaleClockConfirmationError`, и лист пересчитывается.
 */
export async function confirmClockJump(
  db: SqlDb,
  { observedNow, deviceNow, builtAt }: { observedNow: string; deviceNow: Date; builtAt: string | null },
): Promise<number> {
  if (!Number.isFinite(msOf(observedNow)) || Math.abs(deviceNow.getTime() - msOf(observedNow)) > DAY_MS) {
    throw new StaleClockConfirmationError();
  }
  const now = maxIso(observedNow, builtAt, await lastSeenOf(db))!;
  const removed = await applyRetention(db, new Date(now));
  await advanceLastSeen(db, now);
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
 * трогаются; курсоры синхронизации начинаются заново. С `device` снимается и каталог файла
 * экспорта (вопрос 54, m5): файл из него — копия удалённых записей.
 */
export async function clearChildProgress(db: SqlDb, childId: string, device?: DeviceStore): Promise<void> {
  await withGate(db, childId, async (tx) => {
    for (const t of JOURNALS) await tx.run(`DELETE FROM ${t} WHERE child_id = ?`, [childId]);
    await tx.run('DELETE FROM child_state WHERE child_id = ?', [childId]);
    await tx.run('DELETE FROM sync_cursor WHERE child_id = ?', [childId]);
  });
  await device?.deleteCacheDir(EXPORT_DIR);
}

/**
 * Отзыв согласия на данные ABA: событие отзыва и удаление проб, сессий и состояния ABA
 * ребёнка — одной транзакцией. Или отзыв записан и данных нет, или не случилось ничего:
 * отзыв без удаления оставил бы данные о здоровье без основания, удаление без отзыва —
 * режим, который снова пишет. Остальное о ребёнке (уроки, навыки, согласия) не трогается.
 * Экспорт — до вызова: после него экспортировать нечего. Отзыв не отклоняется и при сбитых
 * часах (`placeConsentEvent`); отклоняется только чужая роль — отзывает владелец. С `device`
 * после отзыва снимается каталог файла экспорта (вопрос 54, m5): оставшийся там файл — те же
 * данные о здоровье без основания.
 */
export async function revokeAbaProcessing(db: SqlDb, revoke: ConsentEvent, actorRole: GuardianRole, device?: DeviceStore): Promise<void> {
  if (revoke.scope !== 'aba_processing' || revoke.action !== 'revoke' || !revoke.childId) {
    throw new Error('Ожидается отзыв согласия на данные ABA для ребёнка');
  }
  const childId = revoke.childId;
  await withDbLock(db, () =>
    db.transaction(async (tx) => {
      await tx.run('INSERT INTO purge_gate (child_id) VALUES (?)', [childId]);
      // по списку журналов ABA, а не поимённо: новый журнал, забытый здесь, сделал бы отзыв невозможным
      // (триггер отзыва его знает) — `backend-auditor` 2026-11-06
      for (const table of ABA_JOURNALS) await tx.run(`DELETE FROM ${table} WHERE child_id = ?`, [childId]);
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
  await device?.deleteCacheDir(EXPORT_DIR);
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
  pairingSessions: number;
  /** Строки журнала хвоста конца (фаза 8): на сессию их может быть несколько. */
  sessionTails: number;
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
    pairingSessions: await count('aba_pairing_sessions'),
    sessionTails: await count('aba_session_tails'),
    observers: observers?.length ?? 0,
    settings: settings.n > 0,
  };
}

/**
 * Все строки аккаунта прочь, включая журнал согласий (№117): он переживает удаление только на
 * сервере, с псевдонимами, и только для облачных областей — об этом говорит экран удаления.
 * Недоставленные отзывы доставляет до вызова `wipeAccountEverywhere`. При удалении аккаунта после
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
  /** Поправки прогонов (место «где и с кем», смена фазы после пересчёта) — журнал только дописывается. */
  abaRoutineRunAmendments: unknown[];
  /** История выборов подкрепителя (по порядку выбора), с жетонами обмена рутины. */
  abaReinforcerChoices: unknown[];
  /** Сессии сопряжения (№164): конфигурация, исход, циклы, кто выбирал. */
  abaPairingSessions: unknown[];
  /** Хвосты конца сессий (фаза 8, №172 п. 2): сделанное после записанного итога — отрезки доступа, жетон цикла, уход. */
  abaSessionTails: unknown[];
  /** Исправления отметок взрослого: исходные пробы остаются в `abaTrials`, замены — отдельными строками. */
  abaTrialCorrections: unknown[];
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
    `SELECT chosen_at AS chosenAt, source, source_id AS sourceId, reinforcer_id AS reinforcerId, chosen_by AS chosenBy, tokens
       FROM aba_reinforcer_choices WHERE child_id = ? ORDER BY seq`,
    [childId],
  );
}

async function correctionsOf(db: SqlDb, childId: string): Promise<unknown[]> {
  return db.all(
    `SELECT trial_id AS trialId, replacement_id AS replacementId, session_id AS sessionId, ms_since_original AS msSinceOriginal,
            from_response AS fromResponse, to_response AS toResponse, token_kept AS tokenKept, token_added AS tokenAdded, reason
       FROM aba_trial_corrections WHERE child_id = ? ORDER BY seq`,
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
    abaRoutineRunAmendments: await bodies('aba_routine_run_amendments'),
    abaReinforcerChoices: await choicesOf(db, childId),
    abaPairingSessions: await bodies('aba_pairing_sessions'),
    abaSessionTails: await bodies('aba_session_tails'),
    abaTrialCorrections: await correctionsOf(db, childId),
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

/** Карточка «перерыв» специалисту — без uuid наблюдателя и устройства (остаются только на ребёнке). */
function withoutBreakCardIds(state: Record<string, unknown>): Record<string, unknown> {
  const card = state.breakCard as Record<string, unknown> | undefined;
  if (!card) return state;
  const { observerId: _o, deviceId: _d, ...rest } = card;
  return { ...state, breakCard: rest };
}

/** Поля записей ABA, в которых лежат идентификаторы журнала (`ids.ts`). */
const ID_FIELDS = ['id', 'sessionId', 'fromSessionId', 'requeuedFromTrialId', 'trialId', 'replacementId', 'sourceId'];

function collectIds(value: unknown, into: Set<string>): void {
  if (Array.isArray(value)) value.forEach((v) => collectIds(v, into));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (typeof v === 'string' && ID_FIELDS.includes(k)) into.add(v);
      else collectIds(v, into);
    }
  }
}

function renameStrings<T>(value: T, rename: ReadonlyMap<string, string>): T {
  if (typeof value === 'string') return (rename.get(value) ?? value) as T;
  if (Array.isArray(value)) return value.map((v) => renameStrings(v, rename)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, renameStrings(v, rename)])) as T;
  }
  return value;
}

/**
 * Идентификатор, из которого читается время (UUID v1/v6/v7, ULID, метка времени, дата), заменяется
 * меткой `A1`, `A2`… в пределах файла — одинаково везде, где встречается, чтобы связи проб, сессий и
 * исправлений не порвались. Идентификаторы UUIDv4 и не из времени не меняются. Без этого вся работа
 * по смещениям вместо времени суток (№95, №96) терялась бы через id (раунд 3, В11).
 */
function aliasTimeLeakingIds<T extends unknown[]>(collections: T): T {
  const ids = new Set<string>();
  collectIds(collections, ids);
  const rename = new Map<string, string>();
  for (const id of ids) if (leaksTime(id)) rename.set(id, `A${rename.size + 1}`);
  return rename.size === 0 ? collections : (renameStrings(collections, rename) as T);
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
  /** День выгрузки `YYYY-MM-DD`, без времени суток. */
  exportedAt: string;
  /** Пробы рутин и сессий: время — смещения в мс от начала прогона или сессии (№95, №96). */
  abaTrials: unknown[];
  /**
   * Сессии: `day`, `durationSec`, прочее время — смещения в мс от начала сессии (№96). `tail` — хвост конца (фаза 8):
   * сделанное после записанного итога — `accessScene` (отрезки), `pairingTokenAt`, `leftAtStep`, `leftAt`, `completed`;
   * `null` — хвост не записан: шаги после итога «неизвестно», не «выдано». События самой записи остаются «назначено».
   * `exchangesGiven` — выдано обменов (№183): `exchangesMade` без обмена в конце, жетоны которого хвост вернул на доску
   * (`tail.exchangeReturned`); `exchangesMade` записи остаётся как было записано.
   */
  abaSessions: unknown[];
  /** IOA: `enteredDay` вместо времени ввода (№96). Состояние ниже — даты без времени суток. */
  abaIoa: unknown[];
  /** Исправления отметок: без времени суток (только `msSinceOriginal`); исходные пробы остаются в `abaTrials`. */
  abaTrialCorrections: unknown[];
  /**
   * Прогоны рутин: день и длительность в секундах, без точных `startedAt` / `endedAt` (№95);
   * ведущий наблюдатель — той же меткой.
   */
  abaRoutineRuns: unknown[];
  /**
   * Выборы подкрепителя по порядку (раунд 4, В6): `day`, `order`, `source` (`session` · `routine` · `pairing`),
   * `sourceId`, `reinforcerId`, `chosenBy`, `tokens`, `boardSize`. Без предложенных вариантов и времени суток.
   */
  abaReinforcerChoices: unknown[];
  /**
   * Сессии сопряжения (№164): `day`, `durationSec`, конфигурация, исход, циклы, кто выбирал; предложенная тройка (id каталога) и
   * выборы с латентностью ребёнка, мс, и признаком «после подсказки» (№165), `firstTappedId` — первая карточка, если
   * ребёнок перенёс выбор (№166); `chosenBy: 'none'` — выборов не было; ведущий наблюдатель — меткой. Без `startedAt` / `endedAt`: время суток — режим дня дома (№96).
   */
  abaPairingSessions: unknown[];
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
    // место и фаза — с поправками (Т2, исправление последнего звена): специалисту итоговая запись
    const routineRuns = withAmendments(
      await bodies<AbaRoutineRun>('aba_routine_runs'),
      await bodies<RoutineRunAmendment>('aba_routine_run_amendments'),
    );
    const observers = (state.abaObservers ?? []) as AbaObserver[];
    const tokenTraining = state.tokenTraining as TokenTrainingState | undefined;

    const labels = new Map<string, string>();
    const label = (id: string | null) => {
      if (id === null) return null;
      // метка без языка; номера стабильны только в пределах одного файла
      if (!labels.has(id)) labels.set(id, `O${labels.size + 1}`);
      return labels.get(id)!;
    };
    // время суток сессий и IOA — тот же режим дня дома (№96): день, длительность и смещения в мс
    // от начала сессии; день — локальный `day` записи сессии (старые записи — UTC-дата метки)
    const sessionStart = new Map(sessions.map((s) => [s.id, Date.parse(s.startedAt)]));
    // хвост конца (фаза 8): что было сделано после записанного итога; `null` — хвост не записан, то есть «неизвестно», не
    // «выдано». Времена — те же смещения от начала сессии; хвост без записи сессии не экспортируется (отсчёта нет)
    // строки — по `seq`: у сессии действует последняя (уход, затем доигранный возврат)
    const tailRows = await bodies<AbaSessionTail>('aba_session_tails');
    const tailBySession = new Map(tailRows.map((t) => [t.sessionId, t]));
    // возврат жетонов (№181) — один на сессию и в любой её строке: доска уже вернула жетоны, даже если позже легла строка без отметки
    const returnedBySession = new Map(tailRows.flatMap((t) => (t.exchangeReturned ? [[t.sessionId, t.exchangeReturned] as const] : [])));
    const abaSessions = sessions.map(({ startedAt, endedAt, ...s }) => {
      const origin = Date.parse(startedAt);
      const seconds = endedAt === null ? NaN : Math.round((Date.parse(endedAt) - origin) / 1000);
      const t = tailBySession.get(s.id);
      const returned = returnedBySession.get(s.id);
      // хвост — по явному списку полей: новое поле не уходит специалисту само; момент возврата жетонов не связан с сессией
      // (его подобрали позже), поэтому только факт и число
      const tail = t
        ? {
            accessScene: t.accessScene,
            pairingTokenAt: t.pairingTokenAt,
            leftAtStep: t.leftAtStep,
            leftAt: t.leftAt,
            completed: t.completed,
            ...(t.sceneStarted !== undefined ? { sceneStarted: t.sceneStarted } : {}),
            ...(returned
              ? { exchangeReturned: { tokens: returned.tokens, nonContingent: returned.nonContingent, ...(returned.belowBoard ? { belowBoard: true } : {}) } }
              : {}),
          }
        : null;
      return {
        ...relativeTimes({ ...s, tail }, origin),
        // локальный день записи сессии; старые записи без него — UTC-дата метки
        day: s.day ?? startedAt.slice(0, 10),
        durationSec: Number.isFinite(seconds) ? Math.max(0, seconds) : null,
        // выдано обменов (№183): обмен в конце, жетоны которого вернулись на доску, не выдан; снятый остановкой (`exchange_returned`)
        // уже вычтен из `exchangesMade` доменом
        exchangesGiven: Math.max(0, s.exchangesMade - (returned ? 1 : 0)),
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
    const abaRoutineRuns = routineRuns.map(({ startedAt, endedAt, exchangeOffer, ...r }) => {
      const seconds = Math.round((Date.parse(endedAt) - Date.parse(startedAt)) / 1000);
      return {
        ...r,
        // сколько жетонов предложено на обмен — да, варианты подкрепителей специалисту не нужны
        ...(exchangeOffer ? { exchangeOffer: { tokens: exchangeOffer.tokens, boardSize: exchangeOffer.boardSize } } : {}),
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
    // выборы подкрепителя (раунд 4, В6): день, порядок, источник, кто выбрал, сколько жетонов ушло и
    // размер доски — без вариантов, предложенных на выбор, и без времени суток
    const sessionById = new Map(sessions.map((s) => [s.id, s]));
    const runById = new Map(routineRuns.map((r) => [r.id, r]));
    const pairings = await bodies<AbaPairingSession>('aba_pairing_sessions');
    const pairingById = new Map(pairings.map((p) => [p.id, p]));
    const choiceRows = await tx.all<{
      chosen_at: string;
      source: 'session' | 'routine';
      source_id: string;
      reinforcer_id: string;
      chosen_by: 'child' | 'adult';
      tokens: number | null;
    }>(
      'SELECT chosen_at, source, source_id, reinforcer_id, chosen_by, tokens FROM aba_reinforcer_choices WHERE child_id = ? ORDER BY seq',
      [childId],
    );
    const abaReinforcerChoices = choiceRows.map((c, i) => {
      const session = c.source === 'session' ? sessionById.get(c.source_id) : undefined;
      const run = c.source === 'routine' ? runById.get(c.source_id) : undefined;
      // выбор сопряжения пишется с `source: 'session'`, но записи рабочей сессии у него нет: день — локальный день
      // записи сопряжения, доска — из одной ячейки, источник назван явно (№164)
      const pairing = c.source === 'session' && !session ? pairingById.get(c.source_id) : undefined;
      if (pairing) {
        return { order: i + 1, day: pairing.day, source: 'pairing' as const, sourceId: c.source_id, reinforcerId: c.reinforcer_id, chosenBy: c.chosen_by, tokens: c.tokens, boardSize: 1 };
      }
      // у выбора сессии жетонов своих нет: выбор делается до обменов, а обменов за сессию бывает
      // несколько — сумма приписала бы каждому выбору чужие жетоны; обмены с жетонами специалист
      // видит в событиях `exchange` записи сессии
      return {
        order: i + 1,
        day: session ? (session.day ?? session.startedAt.slice(0, 10)) : run ? run.day : c.chosen_at.slice(0, 10),
        source: c.source,
        sourceId: c.source_id,
        reinforcerId: c.reinforcer_id,
        chosenBy: c.chosen_by,
        tokens: c.tokens,
        boardSize: session ? session.boardSize : (run?.exchangeOffer?.boardSize ?? null),
      };
    });
    // предложенная тройка и латентности выборов сопряжения — специалисту (№165): у сопряжения это главные данные
    // о силе подкрепителя; варианты обмена рутины — по-прежнему нет
    const abaPairingSessions = pairings.map(({ startedAt, endedAt, ...p }) => {
      const seconds = Math.round((Date.parse(endedAt) - Date.parse(startedAt)) / 1000);
      return { ...p, durationSec: Number.isFinite(seconds) ? Math.max(0, seconds) : null, primaryObserverId: label(p.primaryObserverId) };
    });
    const [trialsOut, sessionsOut, ioaOut, correctionsOut, routineRunsOut, choicesOut, pairingOut] = aliasTimeLeakingIds([
      abaTrials,
      abaSessions,
      abaIoa,
      await correctionsOf(tx, childId),
      abaRoutineRuns,
      abaReinforcerChoices,
      abaPairingSessions,
    ]);
    return {
      // единственная метка с временем в файле — тоже только день (вопрос 67, `child-privacy-compliance` 2026-11-01):
      // время выгрузки выдавало бы, когда родитель был у телефона
      exportedAt: exportedAt.slice(0, 10),
      abaTrials: trialsOut,
      abaSessions: sessionsOut,
      abaIoa: ioaOut,
      abaTrialCorrections: correctionsOut,
      abaRoutineRuns: routineRunsOut,
      abaReinforcerChoices: choicesOut,
      abaPairingSessions: pairingOut,
      state: {
        ...dayOnly(withoutBreakCardIds(state)),
        abaObservers: observers.map((o) => ({ id: label(o.id), role: o.role, trained: o.trained })),
        // ручное подтверждение сопряжения — с той же меткой наблюдателя, что в сессиях
        ...(tokenTraining?.pairingConfirmed
          ? { tokenTraining: dayOnly({ ...tokenTraining, pairingConfirmed: { ...tokenTraining.pairingConfirmed, observerId: label(tokenTraining.pairingConfirmed.observerId) } }) }
          : {}),
      },
    };
  });
}
