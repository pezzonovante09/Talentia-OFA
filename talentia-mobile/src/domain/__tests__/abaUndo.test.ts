/**
 * Отмена последней отметки взрослого (`abaUndo.ts`, ABA.md «Отмена отметки и карточка «перерыв»»,
 * решение №99): окно 5 с, закрывающие условия, слой жетонов запечатан, детерминированный replay.
 * Хранилище (замена пробы, строка исправления, `EFFECTIVE`) — `services/local/__tests__/trialCorrections.test.ts`.
 */
import type { AbaPresentation, PresentationOutcome } from '../../types/aba';
import { finishAccess, finishBreak, nextStep, recordTrial, type AbaSessionState, type AbaTrialInput } from '../abaSession';
import { beginUndo, canUndo, undoLastMark, UNDO_WINDOW_MS, type UndoContext } from '../abaUndo';
import { BASE_MS, beginSession, correctInput } from './abaSessionDriver';

/** Отметка взрослого с заданным исходом последнего предъявления. */
function mark(before: AbaSessionState, outcome: PresentationOutcome, now: number) {
  const next = nextStep(before, now);
  if (next.step.kind !== 'trial') throw new Error(`ждали пробу, а шаг ${next.step.kind}`);
  const base = correctInput(next.state, next.step);
  const log = base.presentationLog;
  const { respondedAt: _r, ...last } = log[log.length - 1] as AbaPresentation;
  const withOutcome: AbaPresentation = outcome === 'correct' || outcome === 'approximation' || outcome === 'incorrect' ? { ...last, respondedAt: _r, outcome } : { ...last, outcome };
  const input: AbaTrialInput = { ...base, presentationLog: [...log.slice(0, -1), withOutcome] };
  const rec = recordTrial(next.state, input, now);
  if (!rec.ok) throw new Error(rec.errors.join('; '));
  return { pre: next.state, input, rec, ctx: beginUndo(next.state, input, rec, now), now };
}

/** Первая проба сессии (высоковероятная M1, жетон по расписанию выпадает на ней). */
const first = (outcome: PresentationOutcome = 'correct') => mark(beginSession(), outcome, BASE_MS + 1000);

describe('canUndo: окно и закрывающие условия', () => {
  const m = first();
  const post = m.rec.state;

  it('сразу после отметки отмена доступна', () => {
    expect(canUndo(post, m.ctx, m.now)).toBe(true);
  });

  it('нет снимка отмены — нельзя', () => {
    expect(canUndo(post, null, m.now)).toBe(false);
  });

  it('ровно в 5 с можно, через 5 с и 1 мс — нельзя', () => {
    expect(canUndo(post, m.ctx, m.now + UNDO_WINDOW_MS)).toBe(true);
    expect(canUndo(post, m.ctx, m.now + UNDO_WINDOW_MS + 1)).toBe(false);
  });

  it('экран показал следующий SD (sdStarted) — нельзя', () => {
    expect(canUndo(post, { ...m.ctx, sdStarted: true }, m.now + 100)).toBe(false);
  });

  it('на отметке случился обмен — нельзя', () => {
    expect(canUndo(post, { ...m.ctx, exchangedAtMark: 5 }, m.now + 100)).toBe(false);
  });

  it('доступ к подкрепителю или перерыв уже в очереди первым — нельзя', () => {
    expect(canUndo({ ...post, queue: [{ kind: 'access', durationMs: 30_000 }, ...post.queue] }, m.ctx, m.now + 100)).toBe(false);
    expect(canUndo({ ...post, queue: [{ kind: 'break' }, ...post.queue] }, m.ctx, m.now + 100)).toBe(false);
  });

  it('перерыв уже начался (breakStartedAt) — нельзя', () => {
    expect(canUndo({ ...post, breakStartedAt: m.now + 50 }, m.ctx, m.now + 100)).toBe(false);
  });

  it('сессия закрыта (endReason) — нельзя', () => {
    expect(canUndo({ ...post, endReason: 'completed' }, m.ctx, m.now + 100)).toBe(false);
  });

  it('доску за это время изменила другая процедура (версия другая) — нельзя', () => {
    expect(canUndo({ ...post, boardRev: post.boardRev + 1 }, m.ctx, m.now + 100)).toBe(false);
  });

  it('после отметки записана ещё одна проба — прежнюю отметку не отменить', () => {
    const second = mark(post, 'correct', m.now + 2000);
    expect(canUndo(second.rec.state, m.ctx, m.now + 2100)).toBe(false);
  });

  it('оценка не взрослого (scoredBy ≠ adult) — нельзя', () => {
    const last = post.trials[post.trials.length - 1];
    expect(canUndo({ ...post, trials: [...post.trials.slice(0, -1), { ...last, scoredBy: 'device_tap' }] }, m.ctx, m.now + 100)).toBe(false);
  });

  it.each(['refusal', 'child_break'] as const)('исход %s не отменяется: ребёнок видит последствие сразу', (outcome) => {
    const x = mark(beginSession(), outcome, BASE_MS + 1000);
    expect(canUndo(x.rec.state, x.ctx, x.now + 100)).toBe(false);
  });

  it('пустой журнал предъявлений в снимке — нельзя, а не падение', () => {
    expect(canUndo(post, { ...m.ctx, input: { ...m.ctx.input, presentationLog: [] } }, m.now + 100)).toBe(false);
  });
});

describe('undoLastMark: исходы в обе стороны', () => {
  it('верно → неверно: проба заменена, ответ incorrect, журнал исправления заполнен', () => {
    const m = first('correct');
    const u = undoLastMark(m.rec.state, m.ctx, 'incorrect', m.now + 2000);
    if (!u.ok) throw new Error(u.errors.join());
    expect(u.replacement.response).toBe('incorrect');
    expect(u.replacement.id).toBe(`${m.ctx.trialId}~c1`);
    expect(u.correction).toMatchObject({
      trialId: m.ctx.trialId,
      replacementId: `${m.ctx.trialId}~c1`,
      sessionId: 's',
      msSinceOriginal: 2000,
      fromResponse: 'independent',
      toResponse: 'incorrect',
    });
  });

  it('неверно → верно: ответ independent', () => {
    const m = first('incorrect');
    expect(m.rec.trial.response).toBe('incorrect');
    const u = undoLastMark(m.rec.state, m.ctx, 'correct', m.now + 1500);
    if (!u.ok) throw new Error(u.errors.join());
    expect([u.correction.fromResponse, u.correction.toResponse, u.replacement.response]).toEqual(['incorrect', 'independent', 'independent']);
  });

  it('верно → «почти»: исход approximation принимается', () => {
    const m = first('correct');
    const u = undoLastMark(m.rec.state, m.ctx, 'approximation', m.now + 1000);
    if (!u.ok) throw new Error(u.errors.join());
    expect(u.correction.toResponse).toBe(u.replacement.response);
    expect(u.replacement.response).not.toBe('independent');
  });

  it('замена занимает место исходной пробы в списке сессии: число проб не растёт, индекс прежний', () => {
    const m = first('correct');
    const u = undoLastMark(m.rec.state, m.ctx, 'incorrect', m.now + 1000);
    if (!u.ok) throw new Error(u.errors.join());
    expect(u.state.trials).toHaveLength(m.rec.state.trials.length);
    expect(u.state.trials.map((t) => t.id)).toEqual([`${m.ctx.trialId}~c1`]);
    expect(u.replacement.index).toBe(m.rec.trial.index);
  });

  it.each(['refusal', 'child_break', 'l4_resisted', 'l4_skipped'] as const)('исход %s отметкой не выставляется', (outcome) => {
    const m = first('correct');
    const u = undoLastMark(m.rec.state, m.ctx, outcome, m.now + 1000);
    expect(u.ok).toBe(false);
  });

  it('тот же исход — отказ, ничего не меняется', () => {
    const m = first('correct');
    expect(undoLastMark(m.rec.state, m.ctx, 'correct', m.now + 1000).ok).toBe(false);
  });

  it('вне окна 5 с — отказ', () => {
    const m = first('correct');
    expect(undoLastMark(m.rec.state, m.ctx, 'incorrect', m.now + UNDO_WINDOW_MS + 1).ok).toBe(false);
  });

  it('отмена один раз: после исправления прежний снимок отмены недействителен', () => {
    const m = first('correct');
    const u = undoLastMark(m.rec.state, m.ctx, 'incorrect', m.now + 1000);
    if (!u.ok) throw new Error(u.errors.join());
    expect(canUndo(u.state, m.ctx, m.now + 1200)).toBe(false);
    expect(undoLastMark(u.state, m.ctx, 'correct', m.now + 1200).ok).toBe(false);
  });

  it('детерминизм: два replay с теми же входами дают одно и то же состояние и пробу', () => {
    const m = first('correct');
    const a = undoLastMark(m.rec.state, m.ctx, 'incorrect', m.now + 1000);
    const b = undoLastMark(m.rec.state, m.ctx, 'incorrect', m.now + 1000);
    expect(a).toEqual(b);
  });

  it('исходное состояние и снимок не изменяются', () => {
    const m = first('correct');
    const postCopy = JSON.parse(JSON.stringify(m.rec.state));
    const ctxCopy = JSON.parse(JSON.stringify(m.ctx));
    undoLastMark(m.rec.state, m.ctx, 'incorrect', m.now + 1000);
    expect(JSON.parse(JSON.stringify(m.rec.state))).toEqual(postCopy);
    expect(JSON.parse(JSON.stringify(m.ctx))).toEqual(ctxCopy);
  });
});

describe('слой жетонов запечатан', () => {
  it('жетон за исходную отметку остаётся: «верно» с жетоном → «неверно» — доска и счётчик прежние, а не меньше', () => {
    const m = first('correct');
    expect(m.ctx.tokens).toBe(1);
    const u = undoLastMark(m.rec.state, m.ctx, 'incorrect', m.now + 1000);
    if (!u.ok) throw new Error(u.errors.join());
    expect(u.state.board).toEqual(m.rec.state.board);
    expect(u.state.tokensEarned).toBe(m.rec.state.tokensEarned);
    expect([u.correction.tokenKept, u.correction.tokenAdded]).toEqual([1, 0]);
  });

  it('жетон не удваивается: «верно» с жетоном → «почти» — на доске по-прежнему один', () => {
    const m = first('correct');
    const u = undoLastMark(m.rec.state, m.ctx, 'approximation', m.now + 1000);
    if (!u.ok) throw new Error(u.errors.join());
    expect(u.state.board.earned).toBe(m.rec.state.board.earned);
    expect(u.replacement.tokens).toBe(0);
  });

  it('расписание жетонов не откатывается, когда жетон был: schedule и highPTokenPaid как после исходной отметки', () => {
    const m = first('correct');
    const u = undoLastMark(m.rec.state, m.ctx, 'incorrect', m.now + 1000);
    if (!u.ok) throw new Error(u.errors.join());
    expect(u.state.schedule).toEqual(m.rec.state.schedule);
    expect(u.state.highPTokenPaid).toBe(m.rec.state.highPTokenPaid);
  });

  it('жетона не было, исправлено на успех — недостающий жетон выдаётся (tokenAdded = 1), доска +1', () => {
    const m = first('incorrect');
    expect(m.ctx.tokens).toBe(0);
    const u = undoLastMark(m.rec.state, m.ctx, 'correct', m.now + 1000);
    if (!u.ok) throw new Error(u.errors.join());
    expect(u.correction).toMatchObject({ tokenKept: 0, tokenAdded: 1 });
    expect(u.state.board.earned).toBe(m.rec.state.board.earned + 1);
    expect(u.state.tokensEarned).toBe(m.rec.state.tokensEarned + 1);
    expect(u.replacement.tokens).toBeGreaterThan(0);
  });

  it('жетона не было, а исправленный исход жетона не даёт («почти») — доска не меняется', () => {
    const m = first('incorrect');
    const u = undoLastMark(m.rec.state, m.ctx, 'approximation', m.now + 1000);
    if (!u.ok) throw new Error(u.errors.join());
    expect(u.state.board).toEqual(m.rec.state.board);
    expect(u.correction.tokenAdded).toBe(0);
  });

  it('жетон за участие в конце блока не платится дважды: событий participation и доски — как после исходной отметки', () => {
    // идём до последней пробы обучающего блока цели B (после неё в очереди снова проба, не перерыв)
    let st = beginSession();
    let now = BASE_MS;
    let found: ReturnType<typeof mark> | null = null;
    // первые четыре обучающие пробы блока — приближение (похвала без жетона): к концу блока на доске из трёх есть
    // место, и жетон за участие платится (на полной доске он не платится, №173)
    let teaching = 0;
    for (let i = 0; i < 40 && !found; i += 1) {
      now += 8000;
      const next = nextStep(st, now);
      if (next.step.kind === 'break') {
        st = finishBreak(next.state, now + 1000).state;
        continue;
      }
      if (next.step.kind === 'access') {
        st = finishAccess(next.state, now + 1000);
        continue;
      }
      if (next.step.kind !== 'trial') break;
      const approx = next.step.trialKind === 'teaching' && (teaching += 1) % 5 !== 0;
      const m = mark(st, approx ? 'approximation' : 'correct', now);
      const paid = m.rec.state.events.length - m.pre.events.length;
      if (m.rec.state.events.slice(m.pre.events.length).some((e) => e.kind === 'participation') && canUndo(m.rec.state, m.ctx, now + 100) && paid > 0) found = m;
      st = m.rec.state;
    }
    if (!found) throw new Error('блок с участием и доступной отменой не встретился');
    const count = (s: AbaSessionState) => s.events.filter((e) => e.kind === 'participation').length;
    const u = undoLastMark(found.rec.state, found.ctx, 'incorrect', found.now + 100);
    if (!u.ok) throw new Error(u.errors.join());
    expect(count(u.state)).toBe(count(found.rec.state));
    expect(u.state.board).toEqual(found.rec.state.board);
    expect(u.state.tokensEarned).toBe(found.rec.state.tokensEarned);

    // «верно» на последней пробе блока стало «неверно»: блок закрывает закрывающая проба. Участие,
    // уже выплаченное, второй раз при закрытии блока не платится (событий participation не прибавляется)
    let s = u.state;
    let t = found.now + 200;
    let closing = 0;
    for (let k = 0; k < 4; k += 1) {
      t += 8000;
      const n = nextStep(s, t);
      if (n.step.kind !== 'trial') break;
      const rec = recordTrial(n.state, correctInput(n.state, n.step), t);
      if (!rec.ok) throw new Error(rec.errors.join('; '));
      s = rec.state;
      closing += 1;
    }
    expect(closing).toBeGreaterThan(0);
    expect(count(s)).toBe(count(found.rec.state));
  });
});

describe('счётчики прерываний равны снимку', () => {
  it('childBreaks, refusals, l4Stopped после отмены обычной отметки — как до неё (даже когда уже были ненулевые)', () => {
    // до отметки ребёнок уже просил перерыв; отмена обычной отметки этих счётчиков не трогает
    const pre0 = beginSession();
    const seeded: AbaSessionState = { ...pre0, childBreaks: 1, refusals: 1, l4Stopped: true };
    const m = mark(seeded, 'correct', BASE_MS + 1000);
    const u = undoLastMark(m.rec.state, m.ctx, 'incorrect', m.now + 1000);
    if (!u.ok) throw new Error(u.errors.join());
    expect([u.state.childBreaks, u.state.refusals, u.state.l4Stopped]).toEqual([1, 1, true]);
  });
});

describe('UNDO_WINDOW_MS', () => {
  it('окно — 5 секунд (ABA.md)', () => {
    expect(UNDO_WINDOW_MS).toBe(5000);
  });
});

// чтобы тип контекста был использован в сигнатурах помощников
export type { UndoContext };
