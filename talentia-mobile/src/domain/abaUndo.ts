/**
 * Отмена последней отметки взрослого (раунд 3; `aba-pedagogy-specialist` 2026-10-12, ABA.md
 * «Отмена отметки и карточка «перерыв»»). Взрослый нажал не ту кнопку («Верно» вместо «Неверно»):
 * в течение 5 с, пока не начался следующий SD, обмен, доступ или перерыв, отметку можно исправить
 * один раз.
 *
 * Журнал только дописывается: исходная проба остаётся, замена пишется отдельной строкой
 * (`~c1`), связь — журнал исправлений. Состояние пробы, цели, очереди и счётчиков проигрывается
 * заново штатным `recordTrial` от снимка «до пробы» (детерминированно: семя в снимке). **Слой
 * жетонов запечатан**: жетон за исходную отметку не отнимается никогда (`tokenKept`), расписание
 * жетонов назад не откатывается, недостающий жетон выдаётся, пока окно открыто.
 *
 * Отменяются только оценки взрослого в `with_adult`. Не отменяются «Отказ», детская карточка и
 * «Сопротивляется» (их последствие ребёнок видит сразу): `childBreaks`, `refusals` и `l4Stopped`
 * после отмены равны значениям снимка. Известная дыра v1: ошибочно нажатый «Отказ» остаётся в данных
 * (постфактум-метки в v1 нет, №99). Снимок живёт только в памяти экрана: сворачивание — отмены нет.
 */
import type { AbaPresentation, AbaTrial, PresentationOutcome } from '../types/aba';
import { recordTrial, type AbaSessionState, type RecordResult } from './abaSession';
import type { AbaTrialInput } from './abaTrialStep';

/** Окно отмены, мс. */
export const UNDO_WINDOW_MS = 5000;

/** Исходы, которые нельзя ни отменить, ни выставить отменой: последствие видно ребёнку сразу. */
const NOT_UNDOABLE: ReadonlySet<PresentationOutcome> = new Set<PresentationOutcome>([
  'refusal',
  'child_break',
  'l4_resisted',
  'l4_skipped',
]);

export type UndoContext = {
  trialId: string;
  /** Состояние сессии до пробы. */
  snapshot: AbaSessionState;
  /** Вход пробы, как он был записан. */
  input: AbaTrialInput;
  markedAt: number;
  /** Жетонов за исходную отметку: 0 или 1. */
  tokens: 0 | 1;
  /** Обменов, случившихся на отметке (> 0 — отмены нет). */
  exchangedAtMark: number;
  /** Версия доски сразу после отметки: другая процедура её сменила — отмены нет. */
  boardRevAfterMark: number;
  /** Экран ставит `true`, когда показал следующий SD. */
  sdStarted: boolean;
};

/** Снимок для отмены — сразу после успешного `recordTrial`. */
export function beginUndo(
  before: AbaSessionState,
  input: AbaTrialInput,
  recorded: Extract<RecordResult, { ok: true }>,
  now: number,
): UndoContext {
  return {
    trialId: recorded.trial.id,
    snapshot: before,
    input,
    markedAt: now,
    tokens: recorded.trial.tokens > 0 ? 1 : 0,
    exchangedAtMark: recorded.exchanged,
    boardRevAfterMark: recorded.state.boardRev,
    sdStarted: false,
  };
}

/** Один источник правды «можно ли ещё отменить»: экран не проверяет условия сам. */
export function canUndo(state: AbaSessionState, ctx: UndoContext | null, now: number): boolean {
  if (!ctx) return false;
  const last = state.trials[state.trials.length - 1];
  const original = ctx.input.presentationLog[ctx.input.presentationLog.length - 1];
  const head = state.queue[0];
  return (
    now - ctx.markedAt <= UNDO_WINDOW_MS &&
    last?.id === ctx.trialId &&
    last.scoredBy === 'adult' &&
    original !== undefined &&
    !NOT_UNDOABLE.has(original.outcome) &&
    ctx.exchangedAtMark === 0 &&
    head?.kind !== 'access' &&
    head?.kind !== 'break' &&
    state.breakStartedAt === null &&
    state.endReason === null &&
    !ctx.sdStarted &&
    state.boardRev === ctx.boardRevAfterMark
  );
}

export type TrialCorrection = {
  trialId: string;
  replacementId: string;
  sessionId: string;
  msSinceOriginal: number;
  fromResponse: AbaTrial['response'];
  toResponse: AbaTrial['response'];
  tokenKept: 0 | 1;
  tokenAdded: 0 | 1;
};

export type UndoResult =
  | { ok: true; state: AbaSessionState; replacement: AbaTrial; correction: TrialCorrection }
  | { ok: false; errors: string[] };

/**
 * Исправить отметку: проиграть пробу заново с другим исходом последнего предъявления.
 * `post` — текущее состояние (после исходной отметки), `outcome` — исправленный исход.
 */
export function undoLastMark(post: AbaSessionState, ctx: UndoContext, outcome: PresentationOutcome, now: number): UndoResult {
  if (!canUndo(post, ctx, now)) return { ok: false, errors: ['отмена сейчас недоступна'] };
  if (NOT_UNDOABLE.has(outcome)) return { ok: false, errors: ['этот исход отметкой не исправляется'] };
  const original = post.trials[post.trials.length - 1];
  const log = ctx.input.presentationLog;
  const last = log[log.length - 1];
  if (last.outcome === outcome) return { ok: false, errors: ['исход тот же'] };

  const newLast: AbaPresentation = { ...last, outcome };
  const replacementId = `${ctx.trialId}~c1`;
  const corrected: AbaTrialInput = {
    ...ctx.input,
    id: replacementId,
    presentationLog: [...log.slice(0, -1), newLast],
  };

  // слой жетонов запечатан: доска, счётчики и событие участия — из «после», остальное — от снимка
  const paidParticipation = new Set(
    post.events
      .slice(ctx.snapshot.events.length)
      .flatMap((e) => (e.kind === 'participation' ? [e.targetId] : [])),
  );
  const sealed: AbaSessionState = {
    ...ctx.snapshot,
    board: post.board,
    tokensEarned: post.tokensEarned,
    exchangesMade: post.exchangesMade,
    boardRev: post.boardRev,
    // жетон за исходную отметку был — расписание жетонов и «жетон за высоковероятную» не откатываются
    ...(ctx.tokens === 1 ? { schedule: post.schedule, highPTokenPaid: post.highPTokenPaid } : {}),
    events: [
      ...ctx.snapshot.events,
      ...post.events.slice(ctx.snapshot.events.length).filter((e) => e.kind === 'participation'),
    ],
    // участие за блок уже выплачено — второй раз не платить
    queue: ctx.snapshot.queue.map((q) =>
      q.kind === 'block_end' && q.participation && paidParticipation.has(q.targetId) ? { ...q, participation: false } : q,
    ),
  };

  const replay = recordTrial(sealed, corrected, now, { correction: { tokenKept: ctx.tokens } });
  if (!replay.ok) return { ok: false, errors: replay.errors };
  const replacement: AbaTrial = { ...replay.trial, index: original.index };
  // замена — вместо исходной пробы в живом списке
  const trials = replay.state.trials.map((t) => (t.id === replay.trial.id ? replacement : t));
  const tokenAdded: 0 | 1 = ctx.tokens === 0 && replay.trial.tokens > 0 ? 1 : 0;
  return {
    ok: true,
    state: { ...replay.state, trials },
    replacement,
    correction: {
      trialId: ctx.trialId,
      replacementId,
      sessionId: post.sessionId,
      msSinceOriginal: Math.max(0, now - ctx.markedAt),
      fromResponse: original.response,
      toResponse: replacement.response,
      tokenKept: ctx.tokens,
      tokenAdded,
    },
  };
}
