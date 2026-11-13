/**
 * Возобновление и закрытие свёрнутой сессии ABA (фаза 8). Только то, что экрану нужно от базы:
 *
 * - `loadAbaResume` — что делать со снимком `abaSessionInProgress` при старте экрана и при возврате из фона: нет
 *   снимка, блок (согласие, пауза), просрочка (`awayOutcome` → `abandon`) или продолжение по живой доске
 *   (`commit.resumeAbaSession`). Момент ухода — `updated_at` снимка: экран пересохраняет снимок на `background`
 *   (`markAbaSessionLeft`), отдельного ключа нет (`backend-auditor` 2026-11-06).
 * - `closeSession` — запись итога с повтором после конфликта доски (≤ `MAX_BOARD_CONFLICT_RETRIES`); один путь для
 *   экрана (`finish`, аварийный конец) и для закрытия у родителя (`abandonInProgressSession` в `abaStart.ts`).
 * - `classifyAbaWriteError` — разбор ошибок записи вместо общего «нейтральный конец»: конфликт доски — повторить,
 *   пауза и отзыв — закончить без записи, остальное — записать итог как программную ошибку.
 *
 * Ничего из этого не логируется вне `__DEV__`: сообщения ошибок записи связывают устройство с режимом (`abaLog.ts`).
 */
import { awayOutcome, finishAbaSession, resumeAbaSession as resumeSessionState, type AbaSessionResult, type AbaSessionState } from '../../domain/abaSession';
import { liveBoardOf } from '../../domain/abaTokens';
import { AbaBoardConflictError, AbaConsentRequiredError, AbaPausedError, abaLocalDay } from './abaLog';
import { abaOverview, loadFinishInputs, resumePoolFor, type AbaBlock } from './abaStart';
import { loadChildState } from './childState';
import { commitAbaSession, resumeAbaSession, saveAbaSessionStep } from './commit';
import type { SqlDb } from './sql';

/** Сколько раз экран повторяет запись после конфликта доски, прежде чем закончить без итога (план фазы 8, д). */
export const MAX_BOARD_CONFLICT_RETRIES = 2;

export type AbaResume =
  | { kind: 'none' }
  | { kind: 'blocked'; reason: Extract<AbaBlock, 'no_consent' | 'outdated' | 'paused'> }
  /** Свёрнуто дольше `AWAY_ABANDON_MS` или до другого дня: закрыть `app_backgrounded` моментом ухода, без экрана конца. */
  | { kind: 'abandon'; state: AbaSessionState; leftAt: number }
  /** Продолжить: состояние уже по живой доске, с `rechooseNow` при 2–30 мин (и высоковероятной пробой). */
  | { kind: 'resume'; state: AbaSessionState; leftAt: number; awayMs: number; outcome: 'same_trial' | 'rechoose' };

export type ResumeOptions = { soundOn: boolean; now: number; art?: Readonly<Record<string, unknown>> };

/**
 * Что делать со снимком при старте экрана сессии и при возврате из фона. `leftAt` — `updated_at` снимка; без него
 * (не должно быть) — `now`, то есть «ушли только что».
 */
export async function loadAbaResume(db: SqlDb, childId: string, o: ResumeOptions): Promise<AbaResume> {
  const ov = await abaOverview(db, childId, o.art);
  if (ov.consent === 'outdated') return { kind: 'blocked', reason: 'outdated' };
  if (ov.consent !== 'granted') return { kind: 'blocked', reason: 'no_consent' };
  if (ov.paused) return { kind: 'blocked', reason: 'paused' };
  if (!ov.inProgress) return { kind: 'none' };
  const parsed = Date.parse(ov.inProgressLeftAt ?? '');
  const leftAt = Number.isFinite(parsed) ? Math.min(parsed, o.now) : o.now;
  const awayMs = Math.max(0, o.now - leftAt);
  const outcome = awayOutcome(awayMs, ov.inProgress.day === abaLocalDay(o.now));
  if (outcome === 'abandon') return { kind: 'abandon', state: ov.inProgress, leftAt };
  const state = await resumeAbaSession(db, childId, resumePoolFor(ov.inProgress, o.soundOn, o.art), awayMs);
  if (!state) return { kind: 'none' };
  return { kind: 'resume', state, leftAt, awayMs, outcome };
}

/**
 * Уход в фон: снимок пересохраняется, и его `updated_at` становится моментом ухода. Та же запись, что у шага
 * (`saveAbaSessionStep`): сверка версии доски, ворота согласия.
 */
export function markAbaSessionLeft(db: SqlDb, childId: string, state: AbaSessionState, at: string): Promise<AbaSessionState> {
  return saveAbaSessionStep(db, childId, state, at);
}

export type AbaWriteErrorKind = 'conflict' | 'blocked' | 'other';

/** Конфликт доски — повторить по живой доске; пауза или отзыв согласия — закончить без записи; прочее — ошибка программы. */
export function classifyAbaWriteError(e: unknown): AbaWriteErrorKind {
  if (e instanceof AbaBoardConflictError) return 'conflict';
  if (e instanceof AbaPausedError || e instanceof AbaConsentRequiredError) return 'blocked';
  return 'other';
}

export type CloseOutcome =
  | { kind: 'ok'; result: AbaSessionResult }
  /** Пауза или отзыв: писать нельзя, снимок остаётся (при отзыве его уже нет). */
  | { kind: 'blocked' }
  /** Конфликт доски не разрешился за `maxConflicts` повторов или другая ошибка: итога нет, снимок остаётся. */
  | { kind: 'failed'; error: unknown };

/**
 * Записать итог законченной сессии (`endReason` уже стоит): `loadFinishInputs` → `finishAbaSession` →
 * `commitAbaSession`, при конфликте доски — живая доска и версия с устройства и повтор. `endedAt` — момент конца
 * сессии (при закрытии после ухода — момент ухода), `now` — момент записи.
 */
export async function closeSession(
  db: SqlDb,
  childId: string,
  state: AbaSessionState,
  o: { endedAt: number; now: number; maxConflicts?: number },
): Promise<CloseOutcome> {
  let s = state;
  const max = o.maxConflicts ?? MAX_BOARD_CONFLICT_RETRIES;
  for (let attempt = 0; ; attempt += 1) {
    try {
      const inputs = await loadFinishInputs(db, childId, s);
      const result = finishAbaSession(s, o.endedAt, inputs.pastSessions, undefined, inputs.signalHistory, inputs.extra);
      await commitAbaSession(db, childId, result, new Date(o.now).toISOString());
      return { kind: 'ok', result };
    } catch (e) {
      const kind = classifyAbaWriteError(e);
      if (kind === 'blocked') return { kind: 'blocked' };
      if (kind !== 'conflict' || attempt >= max) return { kind: 'failed', error: e };
      // рутина сменила доску, пока сессия шла: итог считается по живой доске (`resumeAbaSession`, `awayMs = 0`)
      const live = await loadChildState(db, childId, 'abaBoard');
      s = resumeSessionState(s, liveBoardOf(live), { routineExchanged: false });
    }
  }
}
