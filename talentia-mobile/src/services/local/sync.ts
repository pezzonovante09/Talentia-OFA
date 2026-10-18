/**
 * Фоновая синхронизация локальных данных с облаком. Спецификация — PARENT.md («Согласие»,
 * «Ребёнок попадает в облако только вместе с согласием на облако», «Данные на
 * устройстве»); серверные правила — миграции `20260924*` и `20261010120000` (проверено
 * `child-privacy-compliance`); идемпотентность и пачки — `backend-auditor`, аудит
 * 2026-10-06, А6, А7.
 *
 * **Согласия** уходят по одному и в порядке журнала. Согласие на облако сервер не принимает
 * вставкой — его пишут функции создания ребёнка, выдачи и отзыва (`CloudConsent`). Поэтому:
 * - первым уходит событие, которое создаёт ребёнка в облаке (`open` — с полосой ребёнка;
 *   имя не отправляется, оно нужно только репликам Tali на устройстве), а согласия, данные
 *   до него (например, на разговор с Tali), — сразу после;
 * - события ребёнка уходят, только пока он в облаке: от согласия на облако до отзыва
 *   включительно. После отзыва ребёнка на сервере нет; при новом согласии облако создаёт
 *   ребёнка заново, и накопленное уходит после;
 * - порядок строгий: сбой сети на событии обрывает проход, следующее событие не уходит
 *   раньше него. Не дошедший create и записанный после него отзыв уходят оба и по порядку —
 *   create мог дойти без ответа, и пропустить его нельзя (`child-privacy-compliance`);
 * - событие, которое сервер отклонил по существу, не повторяется, а ждёт родителя в
 *   `sync_problems`.
 *
 * **Данные ребёнка** (навыки, прохождения) — только при действующем согласии на облако на
 * текущий текст **и** когда оно уже дошло до сервера. Согласие проверяется прямо перед
 * каждой отправкой, под замком общим с записью согласия: отзыв посреди прохода не
 * пропускает данные. Замок берётся **на каждый удалённый вызов**, а не на весь проход, и у
 * вызова таймаут `REMOTE_TIMEOUT_MS`: отзыв ждёт не дольше одного вызова. Прохождения —
 * пачками по `LESSON_RUNS_BATCH`, не больше `MAX_BATCHES_PER_PASS` за проход, курсор — после
 * каждой пачки. Отзыв или сменившийся текст обнуляют курсоры: при новом согласии копия
 * собирается заново целиком.
 *
 * **Отказ по существу у данных** (`UndeliverableError`) — конечное состояние, а не вечный
 * повтор: проблема в `sync_problems`, поток ребёнка стоит, пока проблема открыта; доставка
 * нового согласия на облако её закрывает, кнопка «повторить» — `retrySyncProblem`. Плохое
 * прохождение (`invalid_data`) отправляется по одному и обходится, чтобы одна строка не
 * остановила историю навсегда.
 *
 * **Пробы ABA в облако не уходят**: облачной копии пока нет — решение владельца. Согласие
 * на данные ABA тоже не уходит (решение №18) — `LOCAL_ONLY_SCOPES`.
 *
 * Каждый проход — через `syncWithRetry`: сбой не блокирует игру и не пропадает молча.
 */
import { isGranted, type ConsentEvent } from '../../domain/consent';
import type { SkillState } from '../../domain/mastery';
import type { LessonRun } from '../../domain/parentReport';
import type { AgeBand } from '../../types/task';
import { syncWithRetry } from '../syncStatus';
import { childStateUpdatedAt, loadChildState } from './childState';
import { readConsentLog } from './consentLog';
import { lessonRunById, lessonRunsAfter } from './lessonRuns';
import { withDbLock } from './lock';
import type { SqlDb } from './sql';

/**
 * Почему сервер отказал по существу — стабильный код для экрана родителя
 * (`t('sync.problem.' + code)`), а не текст сервера: сырые сообщения в базу не попадают.
 * Код по SQLSTATE ставит адаптер: 22023 устаревший текст — `outdated_text`, 23514 —
 * `device_clock` (только у выдачи: время отзыва сервер ограничивает своим, миграция
 * `20261011120000`), 42501 — `no_access` (у `create_child` — `child_id_taken`), 23503 —
 * `child_gone`, 22P02 / 23505 — `invalid_data`.
 */
export type SyncProblemCode = 'outdated_text' | 'device_clock' | 'no_access' | 'child_id_taken' | 'child_gone' | 'invalid_data';

/** Сервер отклонил по существу — повтор не поможет, нужен родитель. */
export class UndeliverableError extends Error {
  constructor(readonly reason: SyncProblemCode) {
    super(reason);
  }
}

/** Удалённый вызов не уложился в `REMOTE_TIMEOUT_MS` — повторяемо: запрос мог дойти. */
export class RemoteTimeoutError extends Error {
  constructor() {
    super('remote timeout');
  }
}

/** Профиль для создания ребёнка в облаке — только полоса: имя на сервер не уходит. */
export type ChildProfile = { band: AgeBand };

/** Событие согласия на облако — какой серверной функцией его доставить. */
export type CloudConsent =
  /** `create_child`: ребёнка в облаке нет (первое согласие или после отзыва). */
  | { kind: 'open'; event: ConsentEvent; profile: ChildProfile }
  /** `grant_cloud_sync`: сменился текст. Профиль — на случай, если ребёнка на сервере нет (P0002). */
  | { kind: 'regrant'; event: ConsentEvent; profile: ChildProfile }
  /** `revoke_cloud_sync`. */
  | { kind: 'revoke'; event: ConsentEvent };

/**
 * Куда уходят данные. Реализация — поверх Supabase от имени пользователя
 * (`supabaseAsUser`), без service-role; `signal` пробрасывается в запрос. Все операции
 * идемпотентны: повтор события — не ошибка, отзыв для удалённого ребёнка — доставка;
 * прохождения — вставка `ON CONFLICT (id) DO NOTHING`, навыки — upsert. Отказ по существу —
 * `UndeliverableError`.
 */
export interface RemotePort {
  pushCloudConsent(cmd: CloudConsent, signal: AbortSignal): Promise<void>;
  /** Не облачное событие: вставка `id, scope, action, child_id, text_version, confirmed_by, client_at`. */
  pushConsentEvent(event: ConsentEvent, signal: AbortSignal): Promise<void>;
  pushSkillStates(childId: string, skills: SkillState[], signal: AbortSignal): Promise<void>;
  pushLessonRuns(childId: string, runs: LessonRun[], signal: AbortSignal): Promise<void>;
}

export type SyncStream = 'skill_state' | 'lesson_runs';
const DATA_STREAMS: readonly SyncStream[] = ['skill_state', 'lesson_runs'];

export const REMOTE_TIMEOUT_MS = 10_000;
export const LESSON_RUNS_BATCH = 200;
export const MAX_BATCHES_PER_PASS = 10;

const isCloud = (e: ConsentEvent) => e.scope === 'cloud_sync';

/** Согласия, которые живут только на устройстве и в облако не отправляются никогда. */
export const LOCAL_ONLY_SCOPES: ReadonlySet<ConsentEvent['scope']> = new Set(['aba_processing']);

async function delivered(db: SqlDb): Promise<Set<string>> {
  return new Set((await db.all<{ id: string }>('SELECT id FROM consent_delivered')).map((r) => r.id));
}

async function failedEvents(db: SqlDb): Promise<Set<string>> {
  return new Set(
    (await db.all<{ event_id: string }>("SELECT event_id FROM sync_problems WHERE kind = 'consent'")).map((r) => r.event_id),
  );
}

async function streamBlocked(db: SqlDb, childId: string, stream: SyncStream): Promise<boolean> {
  const [row] = await db.all<{ n: number }>('SELECT count(*) AS n FROM sync_problems WHERE child_id = ? AND kind = ?', [childId, stream]);
  return row.n > 0;
}

async function addProblem(db: SqlDb, childId: string, kind: SyncProblemKind, ref: string, reason: SyncProblemCode, now: string) {
  await db.run('INSERT OR IGNORE INTO sync_problems (child_id, event_id, reason, noticed_at, kind) VALUES (?, ?, ?, ?, ?)', [
    childId,
    ref,
    reason,
    now,
    kind,
  ]);
}

/** Вызов с таймаутом: сигнал отменяет запрос, `Promise.race` не даёт порту держать замок. */
async function timed<T>(fn: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const ctrl = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      fn(ctrl.signal),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          // сначала своя ошибка: порт, отклоняющий промис прямо в обработчике abort, не
          // подменит причину в `errorsBySource`
          reject(new RemoteTimeoutError());
          ctrl.abort();
        }, ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Устаревшие события: не доставлены, а более позднее событие той же области и того же
 * ребёнка уже на сервере. Их отправка переставила бы журнал — «повторить» на давно
 * отклонённом согласии после доставленного отзыва снова открыло бы облако или ИИ на сервере
 * (`backend-auditor` 2026-10-10, B2). Область в ключе: отложенные события других областей
 * после облачного согласия устаревшими не становятся.
 */
export function supersededEvents(events: readonly ConsentEvent[], done: ReadonlySet<string>): Set<string> {
  const key = (e: ConsentEvent) => `${e.scope}|${e.childId ?? ''}`;
  const lastDone = new Map<string, number>();
  events.forEach((e, i) => {
    if (done.has(e.id)) lastDone.set(key(e), i);
  });
  return new Set(events.filter((e, i) => !done.has(e.id) && (lastDone.get(key(e)) ?? -1) > i).map((e) => e.id));
}

/**
 * Что из событий отправлять и в каком порядке. Проход по журналу: согласие на облако
 * открывает окно и тянет за собой накопленные до него события ребёнка, отзыв облака
 * закрывает окно; вне окна события копятся до следующего согласия на облако. Устаревшие
 * (`supersededEvents`) не отправляются никогда.
 */
export function consentPlan(
  events: readonly ConsentEvent[],
  done: ReadonlySet<string>,
  failed: ReadonlySet<string>,
): ConsentEvent[] {
  const plan: ConsentEvent[] = [];
  let pending: ConsentEvent[] = [];
  let inCloud = false;
  const stale = supersededEvents(events, done);
  for (const e of events) {
    if (failed.has(e.id) || stale.has(e.id) || LOCAL_ONLY_SCOPES.has(e.scope)) continue;
    if (isCloud(e) && e.action === 'grant') {
      plan.push(e);
      plan.push(...pending);
      pending = [];
      inCloud = true;
    } else if (isCloud(e)) {
      plan.push(e);
      inCloud = false;
    } else if (inCloud) plan.push(e);
    else pending.push(e);
  }
  return plan.filter((e) => !done.has(e.id));
}

/**
 * Какой функцией доставить облачное событие. Grant — `open`, если предыдущее облачное
 * событие ребёнка (не отклонённое сервером) отсутствует или это отзыв; иначе `regrant`.
 * Ошибка классификации данных не ломает: сервер терпим к обоим путям.
 */
export function cloudKind(
  events: readonly ConsentEvent[],
  e: ConsentEvent,
  failed: ReadonlySet<string>,
): CloudConsent['kind'] {
  if (e.action === 'revoke') return 'revoke';
  const before = events.slice(0, events.indexOf(e)).filter((x) => isCloud(x) && !failed.has(x.id));
  const prev = before[before.length - 1];
  return !prev || prev.action === 'revoke' ? 'open' : 'regrant';
}

/** Дошло ли до сервера действующее согласие на облако: последнее событие облака — доставленный grant. */
function cloudDelivered(events: readonly ConsentEvent[], done: ReadonlySet<string>, failed: ReadonlySet<string>): boolean {
  const last = [...events].reverse().find((e) => isCloud(e) && !failed.has(e.id));
  return !!last && last.action === 'grant' && done.has(last.id);
}

async function markDelivered(db: SqlDb, id: string, at: string): Promise<void> {
  await db.run('INSERT OR IGNORE INTO consent_delivered (id, delivered_at) VALUES (?, ?)', [id, at]);
}

async function cursor(db: SqlDb, childId: string, stream: SyncStream): Promise<string | undefined> {
  const [row] = await db.all<{ position: string }>('SELECT position FROM sync_cursor WHERE child_id = ? AND stream = ?', [
    childId,
    stream,
  ]);
  return row?.position;
}

async function setCursor(db: SqlDb, childId: string, stream: SyncStream, position: string): Promise<void> {
  await db.run(
    `INSERT INTO sync_cursor (child_id, stream, position) VALUES (?, ?, ?)
     ON CONFLICT (child_id, stream) DO UPDATE SET position = excluded.position`,
    [childId, stream, position],
  );
}

export type SyncReport = {
  consent: number;
  lessonRuns: number;
  skills: boolean;
  /** Данные не ушли: нет действующего согласия на облако, оно ещё не на сервере или нет профиля. */
  blocked: boolean;
  /** Сервер отклонил по существу — ждёт родителя. */
  problem: boolean;
};

export type SyncOptions = {
  /** Профиль ребёнка для создания в облаке; нет профиля — облачное событие ждёт, не ошибка. */
  profileOf?: (childId: string) => Promise<ChildProfile | null>;
  timeoutMs?: number;
};

/** Один проход по ребёнку. Бросает при сбое сети и таймауте — повторы делает `runBackgroundSync`. */
export async function syncChild(
  db: SqlDb,
  remote: RemotePort,
  childId: string,
  cloudTextVersion: string,
  now: string,
  opts: SyncOptions = {},
): Promise<SyncReport> {
  const ms = opts.timeoutMs ?? REMOTE_TIMEOUT_MS;
  const report: SyncReport = { consent: 0, lessonRuns: 0, skills: false, blocked: true, problem: false };

  // --- согласия: по одному, каждое — своя секция под замком
  for (;;) {
    const step = await withDbLock(db, async () => {
      const events = (await readConsentLog(db)).filter((e) => e.childId === childId);
      const failed = await failedEvents(db);
      const [e] = consentPlan(events, await delivered(db), failed);
      if (!e) return 'done' as const;
      try {
        if (isCloud(e)) {
          const kind = cloudKind(events, e, failed);
          if (kind === 'revoke') {
            await timed((s) => remote.pushCloudConsent({ kind, event: e }, s), ms);
          } else {
            const found = await timed(async () => (await opts.profileOf?.(childId)) ?? null, ms);
            if (!found) return 'no_profile' as const;
            // профиль собирается заново: адаптер может вернуть полную запись ребёнка, а имя в
            // облако не уходит (PARENT.md «Минимизация»)
            const profile: ChildProfile = { band: found.band };
            await timed((s) => remote.pushCloudConsent({ kind, event: e, profile }, s), ms);
          }
        } else {
          await timed((s) => remote.pushConsentEvent(e, s), ms);
        }
      } catch (err) {
        if (!(err instanceof UndeliverableError)) throw err;
        await addProblem(db, childId, 'consent', e.id, err.reason, now);
        return 'problem' as const;
      }
      await markDelivered(db, e.id, now);
      // новое согласие на облако дошло — проблемы потоков данных ребёнка закрыты
      if (isCloud(e) && e.action === 'grant') {
        await db.run("DELETE FROM sync_problems WHERE child_id = ? AND kind IN ('lesson_runs', 'skill_state')", [childId]);
        // отклонённые по одному прохождения — переотправить при новом согласии
        await db.run("UPDATE sync_problems SET retry = 1 WHERE child_id = ? AND kind = 'lesson_run'", [childId]);
      }
      // отзыв дошёл — сервер удалил копию: при новом согласии она собирается заново целиком,
      // даже если отзыв и новое согласие ушли одним проходом (B1)
      if (isCloud(e) && e.action === 'revoke') {
        for (const s of DATA_STREAMS) await db.run('DELETE FROM sync_cursor WHERE child_id = ? AND stream = ?', [childId, s]);
      }
      return 'sent' as const;
    });
    if (step === 'done') break;
    if (step === 'no_profile') return report;
    if (step === 'problem') {
      report.problem = true;
      return report;
    }
    report.consent += 1;
  }

  // перед каждой отправкой данных — снова: согласие действует и дошло до сервера
  const allowed = async () => {
    const log = await readConsentLog(db);
    const mine = log.filter((e) => e.childId === childId);
    return isGranted(log, 'cloud_sync', childId, cloudTextVersion) && cloudDelivered(mine, await delivered(db), await failedEvents(db));
  };
  const open = await withDbLock(db, async () => {
    if (await allowed()) return true;
    for (const s of DATA_STREAMS) await db.run('DELETE FROM sync_cursor WHERE child_id = ? AND stream = ?', [childId, s]);
    return false;
  });
  if (!open) return report;
  report.blocked = false;

  // --- отдельные прохождения, которые родитель попросил отправить снова; не больше пачки за проход
  for (let i = 0; i < LESSON_RUNS_BATCH; i += 1) {
    const step = await withDbLock(db, async () => {
      if (!(await allowed()) || (await streamBlocked(db, childId, 'lesson_runs'))) return 'stop' as const;
      const [p] = await db.all<{ event_id: string }>(
        "SELECT event_id FROM sync_problems WHERE child_id = ? AND kind = 'lesson_run' AND retry = 1 ORDER BY noticed_at LIMIT 1",
        [childId],
      );
      if (!p) return 'stop' as const;
      const r = await lessonRunById(db, childId, p.event_id);
      try {
        if (r) await timed((s) => remote.pushLessonRuns(childId, [r], s), ms);
      } catch (err) {
        if (!(err instanceof UndeliverableError)) throw err;
        await db.run('UPDATE sync_problems SET retry = 0, reason = ?, noticed_at = ? WHERE child_id = ? AND event_id = ?', [
          err.reason,
          now,
          childId,
          p.event_id,
        ]);
        report.problem = true;
        return 'more' as const;
      }
      // доставлено или уже удалено сроком хранения — проблемы больше нет
      await db.run('DELETE FROM sync_problems WHERE child_id = ? AND event_id = ?', [childId, p.event_id]);
      if (r) report.lessonRuns += 1;
      return 'more' as const;
    });
    if (step === 'stop') break;
  }

  // --- прохождения: пачками, курсор после каждой. Пачка отклонена как плохие данные — её
  // строки уходят по одной, и каждая — своя секция под замком: отзыв ждёт не дольше одного
  // вызова (B3)
  let singleUntil = 0;
  let batches = 0;
  for (;;) {
    const step = await withDbLock(db, async () => {
      if (!(await allowed()) || (await streamBlocked(db, childId, 'lesson_runs'))) return 'stop' as const;
      const after = Number((await cursor(db, childId, 'lesson_runs')) ?? 0);
      const one = after < singleUntil;
      if (!one && batches >= MAX_BATCHES_PER_PASS) return 'stop' as const;
      const rows = await lessonRunsAfter(db, childId, after, one ? 1 : LESSON_RUNS_BATCH);
      if (!rows.length) return 'stop' as const;
      if (!one) batches += 1;
      try {
        await timed((s) => remote.pushLessonRuns(childId, rows.map((r) => r.run), s), ms);
        report.lessonRuns += rows.length;
      } catch (err) {
        if (!(err instanceof UndeliverableError)) throw err;
        if (err.reason !== 'invalid_data') {
          // отказ всему потоку (устаревший текст, нет доступа) — одна проблема, курсор стоит.
          // ref — имя потока, а не id строки: у строки может уже быть своя проблема (M2)
          await addProblem(db, childId, 'lesson_runs', 'lesson_runs', err.reason, now);
          report.problem = true;
          return 'stop' as const;
        }
        if (!one) {
          singleUntil = rows[rows.length - 1].seq;
          return 'more' as const;
        }
        // виноватая строка — в проблемы, курсор — дальше неё
        await addProblem(db, childId, 'lesson_run', rows[0].run.id, err.reason, now);
        report.problem = true;
      }
      await setCursor(db, childId, 'lesson_runs', String(rows[rows.length - 1].seq));
      return 'more' as const;
    });
    if (step === 'stop') break;
  }

  // --- навыки: целиком, если изменились
  await withDbLock(db, async () => {
    if (!(await allowed()) || (await streamBlocked(db, childId, 'skill_state'))) return;
    const changed = await childStateUpdatedAt(db, childId, 'skills');
    if (!changed || changed === (await cursor(db, childId, 'skill_state'))) return;
    const skills = (await loadChildState(db, childId, 'skills')) ?? [];
    try {
      await timed((s) => remote.pushSkillStates(childId, skills, s), ms);
    } catch (err) {
      if (!(err instanceof UndeliverableError)) throw err;
      await addProblem(db, childId, 'skill_state', 'skill_state', err.reason, now);
      report.problem = true;
      return;
    }
    await setCursor(db, childId, 'skill_state', changed);
    report.skills = true;
  });
  return report;
}

/** События согласия аккаунта — уходят всегда: аккаунт на сервере есть всегда. */
export async function syncAccount(db: SqlDb, remote: RemotePort, now: string, opts: SyncOptions = {}): Promise<number> {
  const ms = opts.timeoutMs ?? REMOTE_TIMEOUT_MS;
  let sent = 0;
  for (;;) {
    const step = await withDbLock(db, async () => {
      const done = await delivered(db);
      const failed = await failedEvents(db);
      const account = (await readConsentLog(db)).filter((x) => x.childId === null);
      const stale = supersededEvents(account, done);
      const e = account.find((x) => !done.has(x.id) && !failed.has(x.id) && !stale.has(x.id));
      if (!e) return 'done' as const;
      try {
        await timed((s) => remote.pushConsentEvent(e, s), ms);
      } catch (err) {
        if (!(err instanceof UndeliverableError)) throw err;
        await addProblem(db, '', 'consent', e.id, err.reason, now);
        return 'problem' as const;
      }
      await markDelivered(db, e.id, now);
      return 'sent' as const;
    });
    if (step !== 'sent') return sent;
    sent += 1;
  }
}

/** Вид проблемы: событие согласия, поток данных ребёнка или одно отклонённое прохождение. */
export type SyncProblemKind = 'consent' | SyncStream | 'lesson_run';

/**
 * Что не доставляется и ждёт родителя — для экрана родительского раздела. `childId` пустой —
 * проблема аккаунта. `ref` — id события, прохождения или имя потока.
 */
export async function syncProblems(
  db: SqlDb,
): Promise<{ childId: string; kind: SyncProblemKind; ref: string; reason: SyncProblemCode }[]> {
  return (
    await db.all<{ child_id: string; event_id: string; reason: SyncProblemCode; kind: SyncProblemKind }>(
      // поставленные на повтор — уже не ждут родителя
      'SELECT child_id, event_id, reason, kind FROM sync_problems WHERE retry = 0 ORDER BY noticed_at',
    )
  ).map((r) => ({ childId: r.child_id, kind: r.kind, ref: r.event_id, reason: r.reason }));
}

/**
 * Кнопка «повторить» в родительском разделе: следующий проход пробует снова. Событие и поток
 * повторяются по курсору — проблема снимается; отдельное прохождение курсор уже обошёл —
 * оно ставится в очередь переотправки.
 */
export async function retrySyncProblem(db: SqlDb, childId: string, ref: string): Promise<void> {
  await withDbLock(db, async () => {
    await db.run("UPDATE sync_problems SET retry = 1 WHERE child_id = ? AND event_id = ? AND kind = 'lesson_run'", [childId, ref]);
    await db.run("DELETE FROM sync_problems WHERE child_id = ? AND event_id = ? AND kind <> 'lesson_run'", [childId, ref]);
  });
}

/**
 * Фоновый проход по аккаунту и всем детям. Никогда не бросает: сбои копятся в
 * `useSyncStatusStore`, игра ребёнка от них не зависит. После отзыва согласия его стоит
 * запускать сразу, чтобы отзыв дошёл до сервера как можно раньше.
 */
export async function runBackgroundSync(
  db: SqlDb,
  remote: RemotePort,
  childIds: readonly string[],
  cloudTextVersion: string,
  now: () => string,
  retry?: { retries?: number; baseDelayMs?: number },
  opts: SyncOptions = {},
): Promise<void> {
  await syncWithRetry('local-sync:account', () => syncAccount(db, remote, now(), opts), retry);
  for (const childId of childIds) {
    await syncWithRetry(`local-sync:${childId}`, () => syncChild(db, remote, childId, cloudTextVersion, now(), opts), retry);
  }
}
