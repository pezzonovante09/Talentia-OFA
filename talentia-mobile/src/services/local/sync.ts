/**
 * Фоновая синхронизация локальных данных с облаком. Спецификация — PARENT.md («Согласие»,
 * «Ребёнок попадает в облако только вместе с согласием на облако», «Данные на
 * устройстве»); серверные правила — миграции `20260924*` (проверено
 * `child-privacy-compliance`).
 *
 * **Согласия** уходят по одному и в серверном порядке. Согласие на облако сервер не
 * принимает вставкой — его пишут функции создания ребёнка, выдачи и отзыва; `RemotePort`
 * сопоставляет событие функции. Поэтому:
 * - первым уходит событие, которое создаёт ребёнка в облаке (согласие на облако), а
 *   согласия, данные до него (например, на разговор с Tali), — сразу после;
 * - события ребёнка уходят, только пока он в облаке: от согласия на облако до отзыва
 *   включительно. После отзыва ребёнка на сервере нет, и событие про него отклонялось бы
 *   вечно; при новом согласии облако создаёт ребёнка заново, и накопленное уходит после;
 * - событие, которое сервер отклонил по существу (устаревший текст, часы устройства),
 *   не повторяется, а ждёт родителя в `sync_problems`.
 *
 * **Данные ребёнка** (навыки, прохождения) — только при действующем согласии на облако на
 * текущий текст **и** когда оно уже дошло до сервера. Согласие проверяется ещё раз прямо
 * перед каждой отправкой, под замком общим с записью согласия: отзыв посреди прохода не
 * пропускает данные. Отзыв или сменившийся текст обнуляют курсоры: при новом согласии
 * копия собирается заново целиком (согласие на облако покрывает и историю до него — это
 * написано в его тексте). Облачные строки при сменившемся тексте не удаляются, но новое не
 * уходит.
 *
 * **Пробы ABA в облако не уходят**: облачной копии пока нет — решение владельца.
 *
 * Каждый проход — через `syncWithRetry`: сбой не блокирует игру и не пропадает молча.
 * Операции `RemotePort` обязаны быть идемпотентными: курсор пишется после отправки, и
 * пачка после сбоя уходит повторно.
 */
import { isGranted, type ConsentEvent } from '../../domain/consent';
import type { SkillState } from '../../domain/mastery';
import type { LessonRun } from '../../domain/parentReport';
import { syncWithRetry } from '../syncStatus';
import { childStateUpdatedAt, loadChildState } from './childState';
import { readConsentLog } from './consentLog';
import { lessonRunsAfter } from './lessonRuns';
import { withDbLock } from './lock';
import type { SqlDb } from './sql';

/** Сервер отклонил событие по существу — повтор не поможет, нужен родитель. */
export class UndeliverableError extends Error {
  constructor(readonly reason: string) {
    super(reason);
  }
}

/**
 * Куда уходят данные. Реализация — поверх Supabase от имени пользователя
 * (`supabaseAsUser`), без service-role. Все операции идемпотентны: событие согласия с тем
 * же id — не ошибка (`ON CONFLICT DO NOTHING`), отзыв для уже удалённого ребёнка —
 * доставка; прохождения и навыки — upsert по id. Отказ по существу — `UndeliverableError`.
 */
export interface RemotePort {
  /**
   * Одно событие. Согласие на облако: первое — создание ребёнка, повторное — выдача,
   * отзыв — отзыв; прочие — вставка колонок `id, scope, action, child_id, text_version,
   * confirmed_by, client_at` (`actor_id` и `received_at` ставит сервер).
   */
  pushConsentEvent(event: ConsentEvent): Promise<void>;
  pushSkillStates(childId: string, skills: SkillState[]): Promise<void>;
  pushLessonRuns(childId: string, runs: LessonRun[]): Promise<void>;
}

export type SyncStream = 'skill_state' | 'lesson_runs';
const DATA_STREAMS: readonly SyncStream[] = ['skill_state', 'lesson_runs'];

const isCloud = (e: ConsentEvent) => e.scope === 'cloud_sync';

async function delivered(db: SqlDb): Promise<Set<string>> {
  return new Set((await db.all<{ id: string }>('SELECT id FROM consent_delivered')).map((r) => r.id));
}

async function problems(db: SqlDb): Promise<Set<string>> {
  return new Set((await db.all<{ event_id: string }>('SELECT event_id FROM sync_problems')).map((r) => r.event_id));
}

/**
 * Что из событий отправлять и в каком порядке. Проход по журналу: согласие на облако
 * открывает окно и тянет за собой накопленные до него события ребёнка, отзыв облака
 * закрывает окно; вне окна события копятся до следующего согласия на облако.
 */
export function consentPlan(
  events: readonly ConsentEvent[],
  done: ReadonlySet<string>,
  failed: ReadonlySet<string>,
): ConsentEvent[] {
  const plan: ConsentEvent[] = [];
  let pending: ConsentEvent[] = [];
  let inCloud = false;
  for (const e of events) {
    if (failed.has(e.id)) continue;
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

/** Дошло ли до сервера действующее согласие на облако: последнее событие облака — доставленный grant. */
function cloudDelivered(events: readonly ConsentEvent[], done: ReadonlySet<string>, failed: ReadonlySet<string>): boolean {
  const last = [...events].reverse().find((e) => isCloud(e) && !failed.has(e.id));
  return !!last && last.action === 'grant' && done.has(last.id);
}

async function markDelivered(db: SqlDb, id: string, at: string): Promise<void> {
  await db.run('INSERT OR IGNORE INTO consent_delivered (id, delivered_at) VALUES (?, ?)', [id, at]);
}

async function pushEvents(db: SqlDb, remote: RemotePort, childId: string, plan: ConsentEvent[], now: string) {
  let sent = 0;
  for (const e of plan) {
    try {
      await remote.pushConsentEvent(e);
    } catch (err) {
      if (!(err instanceof UndeliverableError)) throw err;
      await db.run(
        'INSERT OR IGNORE INTO sync_problems (child_id, event_id, reason, noticed_at) VALUES (?, ?, ?, ?)',
        [childId, e.id, err.reason, now],
      );
      return { sent, stopped: true };
    }
    await markDelivered(db, e.id, now);
    sent += 1;
  }
  return { sent, stopped: false };
}

async function cursor(db: SqlDb, childId: string, stream: SyncStream): Promise<string | undefined> {
  const [row] = await db.all<{ position: string }>(
    'SELECT position FROM sync_cursor WHERE child_id = ? AND stream = ?',
    [childId, stream],
  );
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
  /** Данные не ушли: нет действующего согласия на облако или оно ещё не на сервере. */
  blocked: boolean;
  /** Событие отклонено сервером по существу — ждёт родителя. */
  problem: boolean;
};

/** Один проход по ребёнку. Бросает при сбое сети — повторы делает `runBackgroundSync`. */
export function syncChild(
  db: SqlDb,
  remote: RemotePort,
  childId: string,
  cloudTextVersion: string,
  now: string,
): Promise<SyncReport> {
  return withDbLock(db, async () => {
    const report: SyncReport = { consent: 0, lessonRuns: 0, skills: false, blocked: true, problem: false };
    const events = (await readConsentLog(db)).filter((e) => e.childId === childId);
    const failed = await problems(db);
    const pushed = await pushEvents(db, remote, childId, consentPlan(events, await delivered(db), failed), now);
    report.consent = pushed.sent;
    if (pushed.stopped) {
      report.problem = true;
      return report;
    }

    // перед каждой отправкой данных — снова: согласие действует и дошло до сервера
    const allowed = async () => {
      const log = await readConsentLog(db);
      const mine = log.filter((e) => e.childId === childId);
      return isGranted(log, 'cloud_sync', childId, cloudTextVersion) && cloudDelivered(mine, await delivered(db), failed);
    };
    if (!(await allowed())) {
      for (const s of DATA_STREAMS) await db.run('DELETE FROM sync_cursor WHERE child_id = ? AND stream = ?', [childId, s]);
      return report;
    }
    report.blocked = false;

    const runs = await lessonRunsAfter(db, childId, Number((await cursor(db, childId, 'lesson_runs')) ?? 0));
    if (runs.length && (await allowed())) {
      await remote.pushLessonRuns(childId, runs.map((r) => r.run));
      await setCursor(db, childId, 'lesson_runs', String(runs[runs.length - 1].seq));
      report.lessonRuns = runs.length;
    }

    const changed = await childStateUpdatedAt(db, childId, 'skills');
    if (changed && changed !== (await cursor(db, childId, 'skill_state')) && (await allowed())) {
      await remote.pushSkillStates(childId, (await loadChildState(db, childId, 'skills')) ?? []);
      await setCursor(db, childId, 'skill_state', changed);
      report.skills = true;
    }
    return report;
  });
}

/** События согласия аккаунта — уходят всегда: аккаунт на сервере есть всегда. */
export function syncAccount(db: SqlDb, remote: RemotePort, now: string): Promise<number> {
  return withDbLock(db, async () => {
    const events = (await readConsentLog(db)).filter((e) => e.childId === null);
    const done = await delivered(db);
    const pushed = await pushEvents(db, remote, '', events.filter((e) => !done.has(e.id)), now);
    return pushed.sent;
  });
}

/** Что не доставляется и ждёт родителя — для экрана родительского раздела. */
export async function syncProblems(db: SqlDb): Promise<{ childId: string; eventId: string; reason: string }[]> {
  return (
    await db.all<{ child_id: string; event_id: string; reason: string }>(
      'SELECT child_id, event_id, reason FROM sync_problems ORDER BY noticed_at',
    )
  ).map((r) => ({ childId: r.child_id, eventId: r.event_id, reason: r.reason }));
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
): Promise<void> {
  await syncWithRetry('local-sync:account', () => syncAccount(db, remote, now()), retry);
  for (const childId of childIds) {
    await syncWithRetry(`local-sync:${childId}`, () => syncChild(db, remote, childId, cloudTextVersion, now()), retry);
  }
}
