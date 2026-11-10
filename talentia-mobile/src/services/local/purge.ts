/**
 * Удаление и экспорт на устройстве. Спецификация — PARENT.md, «Удаление и экспорт».
 *
 * Журналы удалить обычным запросом нельзя (`schema.ts`). Эти функции — единственный
 * путь: они открывают `purge_gate` для одного ребёнка (или `*` — для всего) внутри одной
 * транзакции и закрывают его в той же транзакции. Без корзины и «7 дней на
 * восстановление»: данные ребёнка не держат в корзине.
 */
import {
  MASTERY,
  type AbaFlag,
  type AbaIoaRecord,
  type AbaObserver,
  type AbaPairingSession,
  type AbaPhase,
  type AbaRoutineRun,
  type AbaSession,
  type AbaSessionEndReason,
  type AbaSessionEvent,
  type AbaSessionTail,
  type AbaTarget,
  type AbaTargetState,
  type AbaTrial,
  type AbaTrialKind,
  type LatencySource,
  type PromptLevel,
  type ScoringSource,
} from '../../types/aba';
import { ABA_TARGETS } from '../../content/aba';
import type { ConsentEvent, GuardianRole } from '../../domain/consent';
import { criterionGaps, generalizationPasses, isRoutine, summarizeSession, type CriterionGap, type SessionOutcome } from '../../domain/abaCriterion';
import { fadeClass, type FadeClass } from '../../domain/abaPrompting';
import type { TokenTrainingState } from '../../domain/abaTokenTraining';
import { withAmendments, type RoutineRunAmendment } from './abaLog';
import { ABA_DELETED_KEYS, ABA_STATE_KEYS, loadChildState } from './childState';
import { insertConsentEvent, readConsentLog } from './consentLog';
import { EXPORT_DIR, type DeviceStore } from './device';
import { withDbLock } from './lock';
import { leaksTime } from '../../domain/ids';
import { CLOCK_DRIFT_STEP_DAYS, CLOCK_JUMP_HOLD_DAYS, RETENTION_MONTHS } from './schema';
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
      /**
       * Накопленный подозрительный сдвиг часов вместе с этим шагом, в днях (Ж2). Больше порога при малом
       * шаге — удержание набралось несколькими переводами, а не одним скачком.
       */
      driftDays: number;
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

/** Накопленный подозрительный сдвиг часов, мс (миграция 18); строки нет — 0. */
async function driftOf(db: SqlDb): Promise<number> {
  const [row] = await db.all<{ drift_ms: number | null }>('SELECT drift_ms FROM retention_clock WHERE id = 1');
  return row?.drift_ms ?? 0;
}

/**
 * Время только растёт: `MAX` с прежним; триггер миграции 15 держит то же в самой базе. Сдвиг пишется как есть:
 * подтверждение взрослого обнуляет его (`confirmClockJump`).
 */
async function advanceLastSeen(db: SqlDb, at: string, driftMs: number): Promise<void> {
  await db.run(
    `INSERT INTO retention_clock (id, last_seen, drift_ms) VALUES (1, ?, ?)
     ON CONFLICT (id) DO UPDATE SET last_seen = MAX(last_seen, excluded.last_seen), drift_ms = excluded.drift_ms`,
    [at, Math.round(driftMs)],
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
 *
 * Шаги короче порога тоже копятся (контрольный аудит 2026-11-09, Ж2): каждый шаг вперёд от
 * `CLOCK_DRIFT_STEP_DAYS` прибавляется к `drift_ms`, и сумма больше `CLOCK_JUMP_HOLD_DAYS` — то же удержание.
 * Иначе девять переводов по +40 дней стёрли бы журналы за год, а один перевод на +44 дня навсегда укоротил бы
 * срок на 44 дня. Подтверждение взрослого обнуляет сумму.
 */
export async function runRetention(
  db: SqlDb,
  { deviceNow, builtAt }: { deviceNow: Date; builtAt: string | null },
): Promise<RetentionOutcome> {
  const device = deviceNow.toISOString();
  const lastSeen = await lastSeenOf(db);
  const stepMs = lastSeen ? deviceNow.getTime() - msOf(lastSeen) : 0;
  // копится только превышение над порогом шага: занятия раз в неделю-полторы дают сумму около нуля, а перевод
  // на +40 дней — 33 (`backend-auditor` по диффу: иначе честные перерывы давали бы ложное «часы переведены»)
  const stepFloor = CLOCK_DRIFT_STEP_DAYS * DAY_MS;
  const suspicious = stepMs > stepFloor ? stepMs - stepFloor : 0;
  const driftMs = (await driftOf(db)) + suspicious;
  if (lastSeen && (stepMs > CLOCK_JUMP_HOLD_DAYS * DAY_MS || driftMs > CLOCK_JUMP_HOLD_DAYS * DAY_MS)) {
    // опорную дату — в строку, если её не было: иначе урок при сбитых часах сдвинул бы опору журналов
    // в будущее, и следующий старт удалил бы всё без подтверждения
    await db.run('INSERT INTO retention_clock (id, last_seen) VALUES (1, ?) ON CONFLICT (id) DO NOTHING', [lastSeen]);
    // считать от той же даты, от которой удалит подтверждение (`confirmClockJump`): дата сборки может быть позже часов
    const effective = maxIso(device, builtAt, lastSeen)!;
    const abaGoalsChildren = (await abaIdleChildren(db, retentionCutoff(new Date(effective)))).length;
    return {
      kind: 'held',
      reason: 'clock_jump',
      deviceNow: device,
      lastSeen,
      wouldRemove: await countExpired(db, effective),
      abaGoalsChildren,
      driftDays: Math.round(driftMs / DAY_MS),
    };
  }
  const now = maxIso(device, builtAt, lastSeen)!;
  const removed = await applyRetention(db, new Date(now));
  await advanceLastSeen(db, now, driftMs);
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
  // взрослый видел дату и подтвердил её: накопленный сдвиг обнуляется (Ж2)
  await advanceLastSeen(db, now, 0);
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
  /**
   * Производные сводки (Ж12; ABA.md «Данные» и «Решения методиста после проверки D1 и D2»): на сессию и цель и на цель
   * целиком — считаются при выгрузке из тех же проб функциями домена, своих данных не несут. Без времени суток: дни и
   * номера сессий, как у записей; `sessionId` — те же метки, что у сессий.
   */
  summaries: SpecialistSummaries;
  /** Состояние ABA; наблюдатели — метками `O1`, `O2`… с ролью и обучен ли. */
  state: Record<string, unknown>;
};

/** Счётчики проб по уровню подсказки 0–4 (ключи JSON — `"0"`…`"4"`). */
export type PromptLevelCounts = Record<PromptLevel, number>;

/**
 * Исходы переноса (методист 2026-10-01, ABA.md «Решения методиста после проверки D1 и D2»): «сам / дождался /
 * подсказан / провал», приближение отдельно. Пять классов делят пробы переноса без остатка; прерванные и с подсказкой
 * взрослого вне процедуры — вне пятёрки, отдельными числами. «Подсказан» (`prompted`) — ответ с подсказкой, кроме
 * «дождался» (`fadeClass`): уровень выше старта, стартовый уровень > 0, а также L1 со старта L0 после попытки ответить
 * или после ненаблюдения образца `match`.
 */
export type TransferOutcomes = {
  independent: number;
  waited: number;
  prompted: number;
  /** Из `prompted` — понадобился уровень выше стартового. */
  promptedAbove: number;
  failed: number;
  approximation: number;
  interrupted: number;
  adultUnplanned: number;
};

/**
 * Распределения по пробам одной выборки (сессия × цель или вся цель). Популяция затухания та же, что у домена
 * (`applyTrialToFading`): обучение и перенос, не прерванные, без подсказки взрослого вне процедуры. Исходные пробы
 * исправленных отметок (`aba_trial_corrections.trialId`) исключены везде: их замены — отдельные строки `abaTrials`.
 */
export type TrialDistribution = {
  /** Проб затухания в выборке. */
  fadeTrials: number;
  byStartLevel: PromptLevelCounts;
  byUsedLevel: PromptLevelCounts;
  fade: Record<FadeClass, number>;
  /** Все не прерванные пробы выборки по виду: сколько и сколько из них самостоятельных. */
  byKind: Partial<Record<AbaTrialKind, { trials: number; independent: number }>>;
  /** Кто оценивал (все не прерванные пробы) и доля проб, оценённых человеком (`adult`); `null` — проб нет. */
  byScoredBy: Partial<Record<ScoringSource, number>>;
  adultScoredRate: number | null;
  /**
   * Латентность самостоятельных ответов со старта L0 в обучении (ABA.md: «только по `independent`»): медиана `latencyMs`
   * (у самостоятельного ответа равна времени от первого SD — инвариант пробы), число проб и чем измерено (`adult_press`
   * отстаёт на 0,3–0,5 с). `null` — таких проб нет.
   */
  l0Latency: { medianMs: number; n: number; bySource: Partial<Record<LatencySource, number>> } | null;
  /**
   * Задержка до подсказки на старте L0 (обучение и перенос): история за выборку, `last` — по порядку записи (у цели —
   * по номеру сессии и пробы); `null` — проб со старта L0 не было.
   */
  promptDelayMs: { min: number; max: number; last: number } | null;
  /**
   * Среди несамостоятельных обучающих проб со старта L0 — доля с попыткой до подсказки (та же выборка, что у детектора
   * зависимости домена: при старте выше L0 подсказка идёт вместе с SD, и попытка до неё невозможна по построению).
   * Зависимый от подсказки молчит до неё, не умеющий пробует и ошибается. `null` — таких проб не было.
   */
  emittedBeforePromptRate: number | null;
  transfer: TransferOutcomes;
  /** Проб коррекции (нагрузка ошибок) и проб с подсказкой взрослого вне процедуры (точность процедуры). */
  corrections: number;
  adultUnplannedPrompts: number;
  interrupted: number;
  /** Цель-цепочка: по звеньям — пробы затухания звена, доля самостоятельных среди них и уровни. */
  byStep?: Record<string, { trials: number; independentRate: number | null; byUsedLevel: PromptLevelCounts }>;
};

/** Итог сессии по цели — `summarizeSession` домена: тот же счёт, что двигает критерий. */
export type SessionTargetSummary = TrialDistribution & {
  sessionId: string;
  sessionIndex: number;
  day: string;
  targetId: string;
  endReason: AbaSessionEndReason | null;
  /** Записи конца нет (`endedAt === null`): итог не окончательный. */
  incomplete: boolean;
  /**
   * Чем была сессия для цели: `teaching` — обучали (пробы обучения, коррекции, переноса), `baseline` — базовая линия,
   * `probe_only` — только пробы поддержания, разогрева, закрывающие или проверочные. Счёт критерия — только у `teaching`:
   * домен применяет итог сессии лишь к целям, которые в ней учили.
   */
  role: 'teaching' | 'baseline' | 'probe_only';
  /** Чем считает критерий: пробами (дискретная цель) или полными прогонами (цепочка). */
  unit: 'trials' | 'runs' | null;
  /**
   * Проб или прогонов в зачёт критерия; `null` — цель не учили (`role`) или её нет в каталоге (`catalogMissing`), счёт
   * домена недоступен.
   */
  trials: number | null;
  independentRate: number | null;
  /**
   * Как в домене при записи сессии: `meets` продлевает серию критерия, `breaks` рвёт, `neutral` — проб мало и 80% ещё
   * достижимы, либо `meets` снят: конец по отказу ребёнка, снятая и не предъявленная снова проба цели, цель отмечена
   * ненадёжной (`measurement: unreliable`). Срыв (`breakdown`) рвёт серию только сорвавшейся цели (`brokenTargetId`).
   */
  outcome: SessionOutcome | null;
  counted: boolean | null;
  catalogMissing?: true;
};

export type TargetSummary = TrialDistribution & {
  targetId: string;
  catalogMissing?: true;
  routine?: true;
  /** Сессий (у рутины — прогонов) с пробами цели в файле. */
  sessions: number;
  /**
   * Объединённая доля самостоятельных: все пробы с правом на критерий (у цепочки — полные прогоны) из записанных
   * обучающих сессий с последнего входа в обучение (событие `phase` с `to: 'acquisition'`), включая короткие сессии, где
   * проб не хватило для `state.recentIndependentRates`, и сессии с итогом `neutral`. Критерий же считается по сессиям.
   */
  pooledIndependentRate: number | null;
  /** Номер сессии, с которой считается `pooledIndependentRate`; `null` — с начала файла. */
  pooledFromSessionIndex: number | null;
  /** Отсечки смены фазы на графике (ABA.md «Данные») — из событий `phase` записей сессий. */
  phaseChanges: { sessionIndex: number; day: string; from: AbaPhase; to: AbaPhase; reason: Extract<AbaSessionEvent, { kind: 'phase' }>['reason'] }[];
  /**
   * Из состояния цели на день выгрузки; `null` — состояния нет. У рутины `criterionGaps` не считается; у неполного
   * состояния (старая запись без списков критерия) `criterionGaps` и `generalizationPasses` — `null`, не ошибка выгрузки.
   */
  state: {
    phase: AbaPhase;
    criterionGaps: CriterionGap[] | null;
    sessionsAtCriterion: number;
    verifiedCriterionSessions: number;
    criterionDays: number;
    generalizationPasses: number | null;
    recentIndependentRates: number[];
    flags: AbaFlag[];
    startPromptLevel: PromptLevel | null;
    currentDelayMs: number | null;
    lastSuccessfulPromptLevel: PromptLevel | null;
    maintenanceFailsInRow: number;
  } | null;
};

export type SpecialistSummaries = {
  /** Критерий освоения целиком (`MASTERY`): линия 80% для графика и пороги, по которым читать `criterionGaps`. */
  criterion: typeof MASTERY;
  bySession: SessionTargetSummary[];
  byTarget: TargetSummary[];
};

// --- сводки специалисту (Ж12) --------------------------------------------------------------------

const LEVELS: readonly PromptLevel[] = [0, 1, 2, 3, 4];
const FADE_CLASSES: readonly FadeClass[] = ['at_start', 'waited', 'above', 'approximation'];
const FAILED: ReadonlySet<AbaTrial['response']> = new Set(['incorrect', 'no_response']);

const levelCounts = (): PromptLevelCounts => Object.fromEntries(LEVELS.map((l) => [l, 0])) as PromptLevelCounts;

function median(xs: readonly number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const rate = (part: number, whole: number): number | null => (whole ? part / whole : null);

/** Проба затухания — популяция `applyTrialToFading`: обучение и перенос, не прерванная, без подсказки взрослого вне процедуры. */
const isFadeTrial = (t: AbaTrial): boolean => (t.kind === 'teaching' || t.kind === 'transfer') && t.response !== 'interrupted' && !t.adultUnplannedPrompt;

/** Распределения по одной выборке проб (уже без исходных проб исправленных отметок). */
function distributionOf(trials: readonly AbaTrial[], target: AbaTarget | undefined): TrialDistribution {
  const live = trials.filter((t) => t.response !== 'interrupted');
  const fadeTrials = trials.filter(isFadeTrial);
  const byStartLevel = levelCounts();
  const byUsedLevel = levelCounts();
  const fade = Object.fromEntries(FADE_CLASSES.map((c) => [c, 0])) as Record<FadeClass, number>;
  for (const t of fadeTrials) {
    byStartLevel[t.startPromptLevel] += 1;
    byUsedLevel[t.promptLevelUsed] += 1;
    fade[fadeClass(t)] += 1;
  }
  const byKind: TrialDistribution['byKind'] = {};
  const byScoredBy: TrialDistribution['byScoredBy'] = {};
  for (const t of live) {
    const k = (byKind[t.kind] ??= { trials: 0, independent: 0 });
    k.trials += 1;
    if (t.response === 'independent') k.independent += 1;
    byScoredBy[t.scoredBy] = (byScoredBy[t.scoredBy] ?? 0) + 1;
  }
  // латентность — только самостоятельные ответы со старта L0 в обучении: подсказанный ответ приходит после задержки по построению
  const l0 = fadeTrials.filter((t) => t.kind === 'teaching' && t.startPromptLevel === 0 && t.response === 'independent' && t.latencyMs !== null);
  const bySource: Partial<Record<LatencySource, number>> = {};
  for (const t of l0) if (t.latencySource) bySource[t.latencySource] = (bySource[t.latencySource] ?? 0) + 1;
  const delays = fadeTrials.filter((t) => t.startPromptLevel === 0 && t.promptDelayMs !== null).map((t) => t.promptDelayMs!);
  // та же выборка, что у `dependenceTrials` домена: обучение со старта L0, без самостоятельных
  const notIndependent = fadeTrials.filter((t) => t.kind === 'teaching' && t.startPromptLevel === 0 && t.response !== 'independent');
  const transferAll = trials.filter((t) => t.kind === 'transfer');
  const transferLive = transferAll.filter(isFadeTrial);
  const transfer: TransferOutcomes = {
    independent: transferLive.filter((t) => t.response === 'independent').length,
    waited: transferLive.filter((t) => fadeClass(t) === 'waited').length,
    prompted: transferLive.filter((t) => t.response === 'prompted' && fadeClass(t) !== 'waited').length,
    promptedAbove: transferLive.filter((t) => t.response === 'prompted' && fadeClass(t) !== 'waited' && t.promptLevelUsed > t.startPromptLevel).length,
    failed: transferLive.filter((t) => FAILED.has(t.response)).length,
    approximation: transferLive.filter((t) => t.response === 'approximation').length,
    interrupted: transferAll.filter((t) => t.response === 'interrupted').length,
    adultUnplanned: transferAll.filter((t) => t.response !== 'interrupted' && t.adultUnplannedPrompt).length,
  };
  const out: TrialDistribution = {
    fadeTrials: fadeTrials.length,
    byStartLevel,
    byUsedLevel,
    fade,
    byKind,
    byScoredBy,
    adultScoredRate: rate(byScoredBy.adult ?? 0, live.length),
    l0Latency: l0.length ? { medianMs: median(l0.map((t) => t.latencyMs!)), n: l0.length, bySource } : null,
    promptDelayMs: delays.length ? { min: Math.min(...delays), max: Math.max(...delays), last: delays[delays.length - 1] } : null,
    emittedBeforePromptRate: rate(notIndependent.filter((t) => t.emittedBeforePrompt).length, notIndependent.length),
    transfer,
    corrections: live.filter((t) => t.kind === 'correction').length,
    adultUnplannedPrompts: live.filter((t) => t.adultUnplannedPrompt).length,
    interrupted: trials.length - live.length,
  };
  if (target?.steps?.length) {
    out.byStep = Object.fromEntries(
      target.steps.map((st) => {
        const own = fadeTrials.filter((t) => t.stepId === st.id);
        const used = levelCounts();
        for (const t of own) used[t.promptLevelUsed] += 1;
        return [st.id, { trials: own.length, independentRate: rate(own.filter((t) => t.response === 'independent').length, own.length), byUsedLevel: used }];
      }),
    );
  }
  return out;
}

/**
 * Проба цели снята (перерыв, отказ, сопротивление) и в этой сессии не предъявлена снова — повтор `hasUnpresentedDrop`
 * домена (`abaSession.ts`, не экспортируется; домен заморожен №134 — при разморозке звать его, а копию убрать).
 */
function hasUnpresentedDrop(trials: readonly AbaTrial[], targetId: string): boolean {
  const presented = new Set(trials.filter((t) => t.response !== 'interrupted').map((t) => t.requeuedFromTrialId));
  return trials.some((t) => t.targetId === targetId && t.response === 'interrupted' && t.interruptedBy !== undefined && !presented.has(t.requeuedFromTrialId ?? t.id));
}

const TEACHING_KINDS: ReadonlySet<AbaTrialKind> = new Set(['teaching', 'correction', 'transfer']);

/**
 * Итог сессии по цели так, как его применил домен при записи (`finishSession`): срыв рвёт серию только сорвавшейся цели;
 * конец по отказу, снятая и не предъявленная снова проба и ненадёжная цель снимают `meets` до `neutral`.
 */
function sessionOutcomeOf(target: AbaTarget, s: AbaSession, own: readonly AbaTrial[], mine: readonly AbaTrial[]) {
  const raw = summarizeSession(target, [...mine], s.endReason === 'breakdown' && s.brokenTargetId === target.id ? 'breakdown' : null);
  const unreliable = s.events.some((e) => e.kind === 'measurement' && e.targetId === target.id && e.action === 'unreliable');
  const neutral = s.endReason === 'assent_withdrawn' || hasUnpresentedDrop(own, target.id) || unreliable;
  return neutral && raw.outcome === 'meets' ? { ...raw, outcome: 'neutral' as const } : raw;
}

/**
 * Сводки на сессию × цель и на цель — функциями домена (`summarizeSession`, `fadeClass`, `criterionGaps`,
 * `generalizationPasses`); домен не меняется. Цели нет в каталоге (удалена) — счёт критерия недоступен, остаются
 * распределения; рутина — только в `byTarget`: её прогоны не сессии.
 */
export function specialistSummaries(o: {
  sessions: readonly AbaSession[];
  trials: readonly AbaTrial[];
  correctedTrialIds: ReadonlySet<string>;
  targetStates: Record<string, AbaTargetState>;
  /** Каталог целей; в тестах — синтетические цепочки и рутины, которых в каталоге пока нет. */
  catalog?: readonly AbaTarget[];
}): SpecialistSummaries {
  const catalog = o.catalog ?? ABA_TARGETS;
  const trials = o.trials.filter((t) => !o.correctedTrialIds.has(t.id));
  const targetOf = (id: string) => catalog.find((t) => t.id === id);
  const sessions = [...o.sessions].sort((a, b) => a.index - b.index);
  const dayOf = (s: AbaSession) => s.day ?? s.startedAt.slice(0, 10);

  const bySession: SessionTargetSummary[] = [];
  /** Зачётные пробы по сессиям и целям — для объединённой доли на цель. */
  const counted = new Map<string, { sessionIndex: number; trials: number; independent: number }[]>();
  for (const s of sessions) {
    const own = trials.filter((t) => t.sessionId === s.id);
    const targetIds = [...new Set([...s.targetIds, ...own.map((t) => t.targetId)])].filter((id) => own.some((t) => t.targetId === id));
    for (const targetId of targetIds) {
      const target = targetOf(targetId);
      if (target && isRoutine(target)) continue;
      const mine = own.filter((t) => t.targetId === targetId);
      const baseline = mine.some((t) => t.kind === 'baseline') || s.events.some((e) => e.kind === 'phase' && e.targetId === targetId && e.reason === 'baseline');
      const role = mine.some((t) => TEACHING_KINDS.has(t.kind)) ? 'teaching' : baseline ? 'baseline' : 'probe_only';
      const summary = target && role === 'teaching' ? sessionOutcomeOf(target, s, own, mine) : null;
      if (summary) {
        counted.set(targetId, [...(counted.get(targetId) ?? []), { sessionIndex: s.index, trials: summary.trials, independent: Math.round(summary.independentRate * summary.trials) }]);
      }
      bySession.push({
        sessionId: s.id,
        sessionIndex: s.index,
        day: dayOf(s),
        targetId,
        endReason: s.endReason,
        incomplete: s.endedAt === null,
        role,
        unit: summary ? (target!.steps?.length ? 'runs' : 'trials') : null,
        trials: summary?.trials ?? null,
        independentRate: summary?.independentRate ?? null,
        outcome: summary?.outcome ?? null,
        counted: summary?.counted ?? null,
        ...(target ? {} : { catalogMissing: true as const }),
        ...distributionOf(mine, target),
      });
    }
  }

  const targetIds = [...new Set([...trials.map((t) => t.targetId), ...Object.keys(o.targetStates)])].sort();
  const indexOf = new Map(sessions.map((x) => [x.id, x.index]));
  const byTarget: TargetSummary[] = targetIds.map((targetId) => {
    const target = targetOf(targetId);
    const routine = target ? isRoutine(target) : false;
    // порядок проб цели — по номеру сессии, затем по номеру пробы: `promptDelayMs.last` — из последней сессии
    const mine = trials
      .filter((t) => t.targetId === targetId)
      .map((t, i) => ({ t, i }))
      .sort((a, b) => (indexOf.get(a.t.sessionId) ?? Infinity) - (indexOf.get(b.t.sessionId) ?? Infinity) || a.t.index - b.t.index || a.i - b.i)
      .map((x) => x.t);
    const phaseChanges: TargetSummary['phaseChanges'] = sessions.flatMap((s) =>
      s.events.flatMap((e) => (e.kind === 'phase' && e.targetId === targetId ? [{ sessionIndex: s.index, day: dayOf(s), from: e.from, to: e.to, reason: e.reason }] : [])),
    );
    const lastAcquisition = [...phaseChanges].reverse().find((p) => p.to === 'acquisition') ?? null;
    const pooled = (counted.get(targetId) ?? []).filter((c) => lastAcquisition === null || c.sessionIndex >= lastAcquisition.sessionIndex);
    const pooledTrials = pooled.reduce((n, c) => n + c.trials, 0);
    const st = o.targetStates[targetId];
    // состояние может быть неполным (старая запись, тестовая заглушка): домен на таком падает — сводка нет
    const criterionComplete = !!st && Array.isArray(st.criterionDays) && Array.isArray(st.exemplarsAtCriterion) && Array.isArray(st.generalizationProbes);
    return {
      targetId,
      ...(target ? {} : { catalogMissing: true as const }),
      ...(routine ? { routine: true as const } : {}),
      sessions: new Set(mine.map((t) => t.sessionId)).size,
      pooledIndependentRate: target && !routine ? rate(pooled.reduce((n, c) => n + c.independent, 0), pooledTrials) : null,
      pooledFromSessionIndex: lastAcquisition?.sessionIndex ?? null,
      phaseChanges,
      state: st
        ? {
            phase: st.phase,
            criterionGaps: routine || !criterionComplete ? null : criterionGaps(st),
            sessionsAtCriterion: st.sessionsAtCriterion ?? 0,
            verifiedCriterionSessions: (st.criterionSessions ?? []).filter((c) => c.verified).length,
            criterionDays: st.criterionDays?.length ?? 0,
            generalizationPasses: Array.isArray(st.generalizationProbes) ? generalizationPasses(st) : null,
            recentIndependentRates: st.recentIndependentRates ?? [],
            flags: st.flags ?? [],
            startPromptLevel: st.startPromptLevel ?? null,
            currentDelayMs: st.currentDelayMs ?? null,
            lastSuccessfulPromptLevel: st.lastSuccessfulPromptLevel ?? null,
            maintenanceFailsInRow: st.maintenanceFailsInRow ?? 0,
          }
        : null,
      ...distributionOf(mine, target),
    };
  });

  return { criterion: MASTERY, bySession, byTarget };
}

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
    const trials = await bodies<AbaTrial>('aba_trials');
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
    const corrections = (await correctionsOf(tx, childId)) as { trialId: string }[];
    // сводки (Ж12) — из тех же проб и записей, до замены id: метки сессий в них должны совпасть с `abaSessions`
    const summaries = specialistSummaries({
      sessions,
      trials,
      correctedTrialIds: new Set(corrections.map((c) => c.trialId)),
      targetStates: (state.abaTargets ?? {}) as Record<string, AbaTargetState>,
    });
    const [trialsOut, sessionsOut, ioaOut, correctionsOut, routineRunsOut, choicesOut, pairingOut, bySessionOut, byTargetOut] = aliasTimeLeakingIds([
      abaTrials,
      abaSessions,
      abaIoa,
      corrections,
      abaRoutineRuns,
      abaReinforcerChoices,
      abaPairingSessions,
      summaries.bySession,
      summaries.byTarget,
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
      summaries: { criterion: summaries.criterion, bySession: bySessionOut, byTarget: byTargetOut },
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
