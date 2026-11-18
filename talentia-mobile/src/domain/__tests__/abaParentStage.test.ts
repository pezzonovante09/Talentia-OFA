/**
 * «Где мы сейчас» (№202): этап следующего занятия по настоящему плану `startAbaSession` на настоящих целях ABA, полоса
 * 5–6, «Со взрослым», проверка сверху вниз. Два пути из первого теста на телефоне (2026-11-15): «всё верно» и
 * «неответ на третьей пробе первого занятия». Сессии проходят через модель экрана пробы (`matchTrialRun`).
 */
import { ABA_TARGETS, readyAbaTargets } from '../../content/aba';
import { DEV_PLACEHOLDER_ART } from '../../services/local/abaStart';
import type { AbaTargetState } from '../../types/aba';
import { matchDueAt, matchTrialInput, optionActive, startMatchTrial, stepMatchTrial, type MatchTrialRun } from '../../ui/aba/model/matchTrialRun';
import { hasPlannedBreak, pairingStage, stageOfPlan, tokensOf, type ParentStage } from '../abaParentStage';
import { accessShown, chooseReinforcer, finishAbaSession, finishAccess, finishBreak, nextStep, recordTrial, startAbaSession, type AbaSessionState, type StartInput } from '../abaSession';
import { targetForBand } from '../abaTargetRules';
import { initialTokenTraining, type TokenTrainingState } from '../abaTokenTraining';

type Act = 'correct' | 'wrong' | 'none';

const POOL = ['puzzle', 'bubbles', 'drum', 'paint_drop', 'kaleidoscope', 'pinwheel'];
const T0 = Date.UTC(2026, 10, 15, 6);
const TARGETS = readyAbaTargets(ABA_TARGETS, DEV_PLACEHOLDER_ART).map((t) => targetForBand(t, '5-6'));
const IDS = TARGETS.map((t) => t.id);

/**
 * Проба по модели экрана: «верно» — образец и такая же карточка; «неверно» — образец и другая карточка; «нет ответа» —
 * окно истекает без касаний.
 */
function runTrial(r0: MatchTrialRun, act: Act, at0: number): { r: MatchTrialRun; at: number } {
  let r = r0;
  let at = at0;
  if (act !== 'none' && r.sampleTouchedAt === null) r = stepMatchTrial(r, { type: 'tap_sample', at: (at += 1000) });
  if (act === 'correct' && optionActive(r, r.step.sampleCardId!)) r = stepMatchTrial(r, { type: 'tap_option', id: r.step.sampleCardId!, at: (at += 500) });
  if (act === 'wrong') {
    const other = r.step.field!.find((id) => id !== r.step.sampleCardId && optionActive(r, id));
    if (other) r = stepMatchTrial(r, { type: 'tap_option', id: other, at: (at += 500) });
  }
  for (let guard = 0; !r.done && guard < 50; guard += 1) {
    if (r.awaitingL4) {
      r = stepMatchTrial(r, { type: 'adult', button: 'l4_skipped', at });
      break;
    }
    const due = matchDueAt(r);
    if (due === null) break;
    at = Math.max(at, due);
    r = stepMatchTrial(r, { type: 'due', at });
  }
  return { r, at };
}

type Child = {
  states: Record<string, AbaTargetState>;
  tokenTraining: TokenTrainingState;
  board?: StartInput['board'];
  identifySets: StartInput['identifySets'];
  index: number;
  now: number;
};

const freshChild = (): Child => ({ states: {}, tokenTraining: { ...initialTokenTraining(), pairingDone: true, stage: 1 }, identifySets: [], index: 0, now: T0 });

const inputOf = (c: Child, seed: number): StartInput => ({
  sessionId: `s${c.index}`,
  sessionIndex: c.index,
  day: '2026-11-15',
  config: 'with_adult',
  band: '5-6',
  targets: TARGETS,
  states: c.states,
  reinforcerPool: POOL,
  reinforcerApart: [],
  reinforcerHistory: [],
  tokenTraining: c.tokenTraining,
  startedAt: c.now,
  seed,
  ...(c.board ? { board: c.board } : {}),
  identifySets: c.identifySets,
  physicalPromptAllowed: false,
  autoPlacement: true,
  observers: [{ id: 'o1', role: 'parent', trained: false }],
  primaryObserverId: 'o1',
});

/** Превью, как у экрана родителя: план вхолостую и этап из него. */
function preview(c: Child): { stage: ParentStage; tokens: boolean | null; plan: AbaSessionState } {
  const input = inputOf(c, 1);
  const plan = startAbaSession(input);
  const stage = stageOfPlan(plan, input.states, IDS);
  return { stage, tokens: tokensOf(stage), plan };
}

/** Одно занятие до конца: пробы измерения — по `policy`, остальные — верно. Возвращает ребёнка после итога. */
function runSession(c: Child, policy: (trialNo: number, kind: string) => Act): Child {
  let now = c.now + 3 * 3600_000;
  let st = startAbaSession(inputOf({ ...c, now }, 1000 + c.index));
  let trialNo = 0;
  let seq = 0;
  for (let guard = 0; guard < 400; guard += 1) {
    const next = nextStep(st, now);
    st = next.state;
    const step = next.step;
    if (step.kind === 'choose_reinforcer') st = chooseReinforcer(st, step.options[0], now, 'child');
    else if (step.kind === 'break') {
      now += 60_000;
      st = finishBreak(st, now).state;
    } else if (step.kind === 'access') {
      st = accessShown(st);
      now += step.durationMs;
      st = finishAccess(st, now);
    } else if (step.kind === 'end') break;
    else if (step.kind === 'adult_finish_chain') throw new Error('цепочек в match нет');
    else {
      const act = step.trialKind === 'high_p' || step.trialKind === 'closing' ? 'correct' : policy(trialNo, step.trialKind);
      const run = startMatchTrial({ step, target: st.targets[step.targetId], config: 'with_adult', seed: st.seed, trialId: `t${(seq += 1)}`, sessionId: st.sessionId, index: st.trials.length, shownAt: now });
      const done = runTrial(run, act, now);
      now = done.at + 200;
      const res = recordTrial(st, matchTrialInput(done.r), now);
      if (!res.ok) throw new Error(res.errors.join('; '));
      st = res.state;
      trialNo += 1;
      now += 5000;
    }
  }
  const result = finishAbaSession(st, now, {}, undefined, undefined, { routineExchangeInWindow: false });
  return {
    states: { ...c.states, ...result.states },
    tokenTraining: result.tokenTraining,
    board: { earned: result.board.earned, nonContingent: result.board.nonContingent, ...(result.board.returned ? { returned: result.board.returned } : {}) },
    identifySets: result.identifySets,
    index: c.index + 1,
    now,
  };
}

describe('pairingStage', () => {
  it('знакомство: 1 из 2, 2 из 2, сброс серии', () => {
    expect(pairingStage({ pairingDone: false, pairingStreak: 0, pairingSessions: 0 })).toEqual({ kind: 'pairing', n: 1, of: 2, reset: false });
    expect(pairingStage({ pairingDone: false, pairingStreak: 1, pairingSessions: 1 })).toEqual({ kind: 'pairing', n: 2, of: 2, reset: false });
    expect(pairingStage({ pairingDone: false, pairingStreak: 0, pairingSessions: 2 })).toEqual({ kind: 'pairing', n: 1, of: 2, reset: true });
  });
});

describe('stageOfPlan на настоящих целях', () => {
  it('новый ребёнок: проверка «что уже умеет» с формы, без жетонов; превью не меняет вход', () => {
    const c = freshChild();
    const input = inputOf(c, 1);
    const before = JSON.stringify(input);
    const v = preview(c);
    expect(JSON.stringify(input)).toBe(before);
    expect(v.stage).toEqual({ kind: 'placement', targetId: 'match-shape' });
    expect(v.tokens).toBe(false);
  });

  // цвет из 3 (решение методиста 40): поле 3 осваивается по базовой линии — 5/5 даёт «освоено» без обучения
  // занятие 3 — смешанный блок формы и цвета (решение методиста 43): освоено по отдельности, «всё освоено» — после него
  it('всё верно: занятие 2 — первые пробы цвета из трёх без жетонов, занятие 3 — повторение освоенного вперемешку', () => {
    let c = runSession(freshChild(), () => 'correct');
    const second = preview(c);
    expect(second.stage).toEqual({ kind: 'baseline', targetId: 'match-color-3' });
    expect(second.tokens).toBe(false);
    c = runSession(c, () => 'correct');
    expect(c.states['match-color-3']).toMatchObject({ phase: 'mastered', masteredBy: 'baseline' });
    expect(preview(c).stage).toEqual({ kind: 'maintenance', targetIds: ['match-shape', 'match-color-3'] });
    expect(preview(c).plan.mixedTargetIds).toEqual(['match-shape', 'match-color-3']);
  });

  it('ошибки на первых пробах цвета: занятие 3 — обучение цвету из трёх с жетонами и плановым перерывом', () => {
    let c = runSession(freshChild(), () => 'correct');
    c = runSession(c, (_, kind) => (kind === 'baseline' ? 'wrong' : 'correct'));
    const third = preview(c);
    expect(third.stage).toEqual({ kind: 'teaching', targetId: 'match-color-3', plannedBreak: true });
    expect(third.tokens).toBe(true);
    expect(hasPlannedBreak(third.plan)).toBe(true);
  });

  // образца не коснулись — промах наблюдения, не провал проверки (решение методиста 1, 2026-11-18; телефон 2026-11-15)
  it('неответ на третьей пробе первого занятия: следующее — снова проверка того же задания, без жетонов', () => {
    const c = runSession(freshChild(), (n) => (n < 2 ? 'correct' : 'none'));
    expect(c.states['match-shape']?.placementTriedAt).toBeUndefined();
    const v = preview(c);
    expect(v.stage).toEqual({ kind: 'placement', targetId: 'match-shape' });
    expect(v.tokens).toBe(false);
  });

  it('все цели освоены — «всё освоено»', () => {
    const states = Object.fromEntries(IDS.map((id) => [id, { phase: 'mastered' } as AbaTargetState]));
    const plan = { placementTargetIds: [], baselineTargetIds: [], teachingTargetIds: [], maintenanceTargetIds: ['match-shape'], queue: [] };
    expect(stageOfPlan(plan, states, IDS)).toEqual({ kind: 'all_mastered' });
    expect(stageOfPlan(plan, {}, IDS)).toEqual({ kind: 'maintenance', targetIds: ['match-shape'] });
  });
});
