/**
 * Фоновая синхронизация локальных данных с облаком. Спецификация — PARENT.md («Согласие»,
 * «Ребёнок попадает в облако только вместе с согласием на облако»), REBUILD.md
 * (локальный слой).
 *
 * - **Данные ребёнка уходят только при действующем согласии на облако** на текущий
 *   текст: `cloud_sync` отозвано, не спрашивали или дано на прежний текст — не уходит
 *   ничего. Проверка — на каждом проходе, по локальному журналу согласий.
 * - **События согласия ребёнка** уходят, если ребёнок хоть раз давал согласие на облако:
 *   сервер о нём знает, и отзыв обязан до сервера дойти — по нему там удаляются облачные
 *   строки. Ребёнка, который в облаке не был, сервер не видит, и его журнал остаётся
 *   локальным. События аккаунта уходят всегда.
 * - **Отзыв** обнуляет курсоры данных ребёнка: сервер удаляет его строки, и при новом
 *   согласии копия собирается заново целиком.
 * - **Пробы ABA в облако не уходят**: серверной таблицы для них нет. Журнал проб живёт
 *   на устройстве; решение о его копии — отдельное, с проверкой приватности.
 *
 * Каждый проход — через `syncWithRetry`: сбой не блокирует игру ребёнка и не пропадает
 * молча в `.catch(() => {})`.
 */
import { isGranted, type ConsentEvent } from '../../domain/consent';
import type { SkillState } from '../../domain/mastery';
import type { LessonRun } from '../../domain/parentReport';
import { syncWithRetry } from '../syncStatus';
import { childStateUpdatedAt, loadChildState } from './childState';
import { consentEventsAfter, readConsentLog } from './consentLog';
import { lessonRunsAfter } from './lessonRuns';
import type { SqlDb } from './sql';

/** Куда уходят данные. Реализация — поверх Supabase, от имени пользователя. */
export interface RemotePort {
  pushConsentEvents(events: ConsentEvent[]): Promise<void>;
  pushSkillStates(childId: string, skills: SkillState[]): Promise<void>;
  pushLessonRuns(childId: string, runs: LessonRun[]): Promise<void>;
}

export type SyncStream = 'consent' | 'skill_state' | 'lesson_runs';

/** Потоки данных ребёнка — они и только они закрыты согласием на облако. */
const DATA_STREAMS: readonly SyncStream[] = ['skill_state', 'lesson_runs'];

const ACCOUNT = '';

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

async function pushConsent(db: SqlDb, remote: RemotePort, childId: string | null): Promise<number> {
  const key = childId ?? ACCOUNT;
  const after = Number((await cursor(db, key, 'consent')) ?? 0);
  const rows = await consentEventsAfter(db, childId, after);
  if (!rows.length) return 0;
  await remote.pushConsentEvents(rows.map((r) => r.event));
  await setCursor(db, key, 'consent', String(rows[rows.length - 1].seq));
  return rows.length;
}

export type SyncReport = {
  consent: number;
  lessonRuns: number;
  skills: boolean;
  /** Согласия на облако нет — данные не ушли. */
  blocked: boolean;
};

/** Один проход по ребёнку. Бросает при сбое сети — повторы делает `runBackgroundSync`. */
export async function syncChild(
  db: SqlDb,
  remote: RemotePort,
  childId: string,
  cloudTextVersion: string,
): Promise<SyncReport> {
  const log = await readConsentLog(db);
  const everInCloud = log.some((e) => e.scope === 'cloud_sync' && e.childId === childId && e.action === 'grant');
  const report: SyncReport = { consent: 0, lessonRuns: 0, skills: false, blocked: true };
  if (everInCloud) report.consent = await pushConsent(db, remote, childId);

  if (!isGranted(log, 'cloud_sync', childId, cloudTextVersion)) {
    // сервер удаляет строки по отзыву — при новом согласии копия собирается заново
    for (const s of DATA_STREAMS) await db.run('DELETE FROM sync_cursor WHERE child_id = ? AND stream = ?', [childId, s]);
    return report;
  }
  report.blocked = false;

  const runs = await lessonRunsAfter(db, childId, Number((await cursor(db, childId, 'lesson_runs')) ?? 0));
  if (runs.length) {
    await remote.pushLessonRuns(childId, runs.map((r) => r.run));
    await setCursor(db, childId, 'lesson_runs', String(runs[runs.length - 1].seq));
    report.lessonRuns = runs.length;
  }

  const changed = await childStateUpdatedAt(db, childId, 'skills');
  const pushed = await cursor(db, childId, 'skill_state');
  if (changed && changed !== pushed) {
    await remote.pushSkillStates(childId, (await loadChildState(db, childId, 'skills')) ?? []);
    await setCursor(db, childId, 'skill_state', changed);
    report.skills = true;
  }
  return report;
}

/** События согласия аккаунта — уходят всегда: аккаунт на сервере есть всегда. */
export async function syncAccount(db: SqlDb, remote: RemotePort): Promise<number> {
  return pushConsent(db, remote, null);
}

/**
 * Фоновый проход по аккаунту и всем детям. Никогда не бросает: сбои копятся в
 * `useSyncStatusStore`, игра ребёнка от них не зависит.
 */
export async function runBackgroundSync(
  db: SqlDb,
  remote: RemotePort,
  childIds: readonly string[],
  cloudTextVersion: string,
  retry?: { retries?: number; baseDelayMs?: number },
): Promise<void> {
  await syncWithRetry('local-sync:account', () => syncAccount(db, remote), retry);
  for (const childId of childIds) {
    await syncWithRetry(`local-sync:${childId}`, () => syncChild(db, remote, childId, cloudTextVersion), retry);
  }
}
