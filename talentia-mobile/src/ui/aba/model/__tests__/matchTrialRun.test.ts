/**
 * Проба `match` на экране — сценарии журнала (`aba-screens-spec-2026-10-25.md`, «Журнал пробы `match`») через
 * настоящий домен: `startAbaSession` → `nextStep` → модель → `recordTrial`. Запись, которую домен не принял, — провал.
 */
import { MATCH_SAME_2, MATCH_SAME_3 } from '../../../../content/aba/match-level1';
import { initialTargetState } from '../../../../domain/abaPrompting';
import { chooseReinforcer, nextStep, recordTrial, startAbaSession, type AbaSessionState, type TrialStep } from '../../../../domain/abaSession';
import { targetForBand } from '../../../../domain/abaTargetRules';
import { initialTokenTraining } from '../../../../domain/abaTokenTraining';
import type { AbaTarget, AbaTargetState, PromptLevel } from '../../../../types/aba';
import { matchDueAt, matchTrialInput, matchVisual, optionActive, startMatchTrial, stepMatchTrial, type MatchEvent, type MatchTrialRun } from '../matchTrialRun';

const T0 = Date.UTC(2026, 9, 30, 8);
const POOL = ['puzzle', 'bubbles', 'drum', 'paint_drop', 'kaleidoscope', 'pinwheel'];

function session(base: AbaTarget, start: PromptLevel = 0, config: 'with_adult' | 'alone' = 'with_adult', over: Partial<AbaTargetState> = {}) {
  const t = targetForBand(base, '7');
  const state: AbaTargetState = { ...initialTargetState(t), phase: 'acquisition', startPromptLevel: start, lastSuccessfulPromptLevel: start, ...over };
  // предпосылки цели (у «из трёх» — «из двух») — освоены: их пробы разогрева проходятся верно до нужной пробы
  const pre = (base.prerequisiteTargetIds ?? []).map((id) => targetForBand([MATCH_SAME_2, MATCH_SAME_3].find((x) => x.id === id)!, '7'));
  const preStates = Object.fromEntries(pre.map((p) => [p.id, { ...initialTargetState(p), phase: 'mastered' as const, startPromptLevel: 0 as const, lastSuccessfulPromptLevel: 0 as const, lastMaintenanceSessionIndex: 3 }]));
  let st = startAbaSession({
    sessionId: 's-1',
    sessionIndex: 3,
    day: '2026-10-30',
    config,
    band: '7',
    targets: [...pre, t],
    states: { ...preStates, [t.id]: state },
    reinforcerPool: POOL,
    reinforcerApart: [],
    reinforcerHistory: [],
    tokenTraining: { ...initialTokenTraining(), pairingDone: true, stage: 5 },
    startedAt: T0,
    seed: 11,
    observers: config === 'with_adult' ? [{ id: 'o1', role: 'parent', trained: false }] : [],
    primaryObserverId: config === 'with_adult' ? 'o1' : null,
  });
  const first = nextStep(st, T0);
  st = chooseReinforcer(first.state, (first.step as { options: string[] }).options[0], T0);
  for (let i = 0; i < 10; i += 1) {
    const next = nextStep(st, T0);
    if (next.step.kind !== 'trial') throw new Error(`ждали пробу, а шаг ${next.step.kind}`);
    const step = next.step;
    if (step.targetId === t.id) return { state: next.state, step, target: t };
    // проба разогрева освоенной цели — верно
    const warm = { state: next.state, step, target: pre.find((p) => p.id === step.targetId)! };
    const r = go(run(warm, config), { type: 'tap_sample', at: at(1) }, { type: 'tap_option', id: step.sampleCardId!, at: at(1.5) });
    const res = recordTrial(next.state, matchTrialInput(r), at(2));
    if (!res.ok) throw new Error(res.errors.join('; '));
    st = res.state;
  }
  throw new Error('до пробы цели не дошли');
}

function run(s: { state: AbaSessionState; step: TrialStep; target: AbaTarget }, config: 'with_adult' | 'alone' = 'with_adult'): MatchTrialRun {
  return startMatchTrial({ step: s.step, target: s.target, config, seed: s.state.seed, trialId: `tr-${(trialSeq += 1)}`, sessionId: s.state.sessionId, index: s.state.trials.length, shownAt: T0 + 1000 });
}

let trialSeq = 0;
const go = (r: MatchTrialRun, ...events: MatchEvent[]) => events.reduce(stepMatchTrial, r);
const at = (s: number) => T0 + 1000 + s * 1000;
/** Сроки модели до конца пробы. */
function runOut(r: MatchTrialRun): MatchTrialRun {
  let x = r;
  for (let i = 0; i < 10 && !x.done && matchDueAt(x) !== null; i += 1) x = stepMatchTrial(x, { type: 'due', at: matchDueAt(x)! });
  return x;
}
function record(s: { state: AbaSessionState }, r: MatchTrialRun) {
  const res = recordTrial(s.state, matchTrialInput(r), at(30));
  if (!res.ok) throw new Error(res.errors.join('; '));
  return res.trial;
}
const distractor = (s: { step: TrialStep }) => s.step.field!.find((id) => id !== s.step.sampleCardId)!;

describe('до касания образца', () => {
  it('варианты неактивны; касание по ним считается, но ответом не становится', () => {
    const s = session(MATCH_SAME_3);
    let r = run(s);
    expect(optionActive(r, s.step.sampleCardId!)).toBe(false);
    r = go(r, { type: 'tap_option', id: s.step.sampleCardId!, at: at(0.5) });
    expect([r.done, r.tapCount, r.chosenCardId]).toEqual([false, 1, null]);
    r = go(r, { type: 'tap_sample', at: at(1) });
    expect(optionActive(r, s.step.sampleCardId!)).toBe(true);
  });
});

describe('сценарии журнала', () => {
  it('а: образец через 1 с, верно — самостоятельно, латентность наблюдения 1000', () => {
    const s = session(MATCH_SAME_3);
    const r = go(run(s), { type: 'tap_sample', at: at(1) }, { type: 'tap_option', id: s.step.sampleCardId!, at: at(1.5) });
    expect(r.done).toBe(true);
    expect(matchTrialInput(r)).toMatchObject({ observingLatencyMs: 1000, chosenCardId: s.step.sampleCardId, tapCount: 2, fieldSizeAtResponse: 3 });
    expect(record(s, r)).toMatchObject({ response: 'independent', promptLevelUsed: 0, latencyMs: 500 });
  });

  it('б: образца коснулись, выбора нет до конца задержки — L1, верно', () => {
    const s = session(MATCH_SAME_3);
    let r = go(run(s), { type: 'tap_sample', at: at(1) });
    r = go(r, { type: 'due', at: matchDueAt(r)! });
    expect(r.log).toHaveLength(2);
    expect(r.observingPrompted).toBe(false);
    r = go(r, { type: 'tap_option', id: s.step.sampleCardId!, at: matchDueAt(r)! - 1000 });
    expect(record(s, r)).toMatchObject({ response: 'prompted', promptLevelUsed: 1 });
  });

  it('в: образца не коснулись 5 с — L1 наблюдения, метка над образцом; коснулись и выбрали — подсказано', () => {
    const s = session(MATCH_SAME_3);
    let r = run(s);
    expect(matchDueAt(r)).toBe(at(5));
    r = go(r, { type: 'due', at: at(5) });
    expect(r.observingPrompted).toBe(true);
    expect(matchVisual(r).focus).toMatchObject({ on: 'sample', id: s.step.sampleCardId });
    r = go(r, { type: 'tap_sample', at: at(6.5) }, { type: 'tap_option', id: s.step.sampleCardId!, at: at(7.7) });
    expect(matchTrialInput(r)).toMatchObject({ observingPrompted: true, observingLatencyMs: 6500 });
    expect(record(s, r)).toMatchObject({ response: 'prompted', promptLevelUsed: 1 });
  });

  it('г: и после L1 образца нет — нет ответа, наблюдения нет', () => {
    const s = session(MATCH_SAME_3);
    const r = runOut(run(s));
    expect(r.log).toHaveLength(2);
    expect(matchTrialInput(r)).toMatchObject({ observingPrompted: true, observingLatencyMs: null });
    expect(record(s, r)).toMatchObject({ response: 'no_response', promptLevelUsed: 1 });
  });

  it('д: неверный выбор — неверно, проба закрыта', () => {
    const s = session(MATCH_SAME_3);
    const r = go(run(s), { type: 'tap_sample', at: at(1) }, { type: 'tap_option', id: distractor(s), at: at(1.4) });
    expect(r.done).toBe(true);
    expect(record(s, r)).toMatchObject({ response: 'incorrect', chosenCardId: distractor(s) });
  });

  it('е: «Была подсказка» в окне — подсказано, `adultUnplannedPrompt`', () => {
    const s = session(MATCH_SAME_3);
    let r = go(run(s), { type: 'tap_sample', at: at(1) });
    r = go(r, { type: 'adult', button: 'adult_prompted', at: at(2) });
    expect(r.log.map((p) => p.by)).toEqual(['app', 'adult']);
    r = go(r, { type: 'tap_option', id: s.step.sampleCardId!, at: at(2.6) });
    expect(record(s, r)).toMatchObject({ response: 'prompted', adultUnplannedPrompt: true });
  });

  it('ж: «Отказ» — прервана, без времени ответа', () => {
    const s = session(MATCH_SAME_3);
    const r = go(run(s), { type: 'tap_sample', at: at(1) }, { type: 'adult', button: 'refusal', at: at(2) });
    expect(r.done).toBe(true);
    expect(record(s, r)).toMatchObject({ response: 'interrupted', interruptedBy: 'assent' });
  });

  it('з: карточка «перерыв» в пробеле наблюдения — прервана просьбой ребёнка', () => {
    const s = session(MATCH_SAME_3);
    const r = go(run(s), { type: 'break_card', at: at(4) });
    expect(record(s, r)).toMatchObject({ response: 'interrupted', interruptedBy: 'child_break', msSinceSd: 4000 });
  });

  it('и: поле из двух — L0 → L1 → L3, без L2', () => {
    const s = session(MATCH_SAME_2);
    let r = go(run(s), { type: 'tap_sample', at: at(1) });
    r = runOut(r);
    expect(r.log.map((p) => p.level)).toEqual([0, 1, 3]);
    expect(record(s, r)).toMatchObject({ response: 'no_response', promptLevelUsed: 3 });
  });
});

describe('старт L1+ и измерение', () => {
  it('старт L3: активен только верный; без касания образца — дальше по лестнице, отдельной L1 наблюдения нет', () => {
    const s = session(MATCH_SAME_3, 3);
    let r = run(s);
    r = go(r, { type: 'tap_sample', at: at(0.5) });
    expect(s.step.field!.filter((id) => optionActive(r, id))).toEqual([s.step.sampleCardId]);
    const untouched = runOut(run(s));
    expect(untouched.observingPrompted).toBe(false);
    expect(record(s, untouched)).toMatchObject({ response: 'no_response' });
  });

  it('старт L1, образца не коснулись — L2, наблюдения не отмечено', () => {
    const s = session(MATCH_SAME_3, 1);
    let r = run(s);
    r = go(r, { type: 'due', at: matchDueAt(r)! });
    expect([r.log.map((p) => p.level), r.observingPrompted]).toEqual([[1, 2], false]);
  });

  it('базовая линия: подсказок нет, без ответа — закрыта по окну', () => {
    const s = session(MATCH_SAME_3, 0, 'with_adult', { phase: 'baseline' });
    expect(s.step.allowEscalation).toBe(false);
    const r = runOut(go(run(s), { type: 'tap_sample', at: at(1) }));
    expect(r.log).toHaveLength(1);
    expect(record(s, r)).toMatchObject({ response: 'no_response', promptLevelUsed: 0 });
  });
});

describe('панель взрослого', () => {
  it('«Была подсказка» сразу после касания ребёнка — в очереди 400 мс, применяется по снятию окна', () => {
    const s = session(MATCH_SAME_3);
    let r = go(run(s), { type: 'tap_sample', at: at(1) }, { type: 'adult', button: 'adult_prompted', at: at(1.1) });
    expect(r.pending).toEqual({ at: at(1.1) });
    expect(matchDueAt(r)).toBe(at(1.4));
    r = go(r, { type: 'due', at: at(1.4) });
    expect(r.log.map((p) => [p.by, p.startedAt])).toEqual([
      ['app', at(0)],
      ['adult', at(1.1)],
    ]);
  });

  it('«Отказ» снимает отложенную отметку и закрывает пробу сразу', () => {
    const s = session(MATCH_SAME_3);
    const r = go(run(s), { type: 'tap_sample', at: at(1) }, { type: 'adult', button: 'adult_prompted', at: at(1.1) }, { type: 'adult', button: 'refusal', at: at(1.2) });
    expect([r.done, r.pending, r.log]).toEqual([true, null, [expect.objectContaining({ outcome: 'refusal' })]]);
  });

  it('ответ ребёнка в окне очереди — отложенная подсказка не применяется', () => {
    const s = session(MATCH_SAME_3);
    const r = go(
      run(s),
      { type: 'tap_sample', at: at(1) },
      { type: 'adult', button: 'adult_prompted', at: at(1.1) },
      { type: 'tap_option', id: s.step.sampleCardId!, at: at(1.2) },
    );
    expect(r.log).toHaveLength(1);
    expect(record(s, r)).toMatchObject({ response: 'independent' });
  });

  it('№167: «Была подсказка» в пробеле наблюдения принимается — потом коснулись и верно: подсказано, не «самостоятельно»', () => {
    const s = session(MATCH_SAME_3);
    let r = go(run(s), { type: 'adult', button: 'adult_prompted', at: at(4) });
    expect(r.log.map((p) => [p.by, p.startedAt])).toEqual([
      ['app', at(0)],
      ['adult', at(4)],
    ]);
    r = go(r, { type: 'tap_sample', at: at(5) }, { type: 'tap_option', id: s.step.sampleCardId!, at: at(5.5) });
    expect(record(s, r)).toMatchObject({ response: 'prompted', adultUnplannedPrompt: true, promptLevelUsed: 1 });
  });

  it('№167: подсказка взрослого, образца так и не коснулись — после L1 приложения проба закрыта, без «наблюдения»', () => {
    const s = session(MATCH_SAME_3);
    const r = runOut(go(run(s), { type: 'adult', button: 'adult_prompted', at: at(4) }));
    expect(r.log.map((p) => [p.by, p.level])).toEqual([
      ['app', 0],
      ['adult', 0],
      ['app', 1],
    ]);
    expect(r.observingPrompted).toBe(false);
    expect(record(s, r)).toMatchObject({ response: 'no_response', adultUnplannedPrompt: true });
  });

  it('№167: и после окна наблюдения — не принимается', () => {
    const s = session(MATCH_SAME_3);
    const r = go(run(s), { type: 'adult', button: 'adult_prompted', at: at(5.5) });
    expect(r.log).toHaveLength(1);
  });
});

describe('касания', () => {
  it('одна плита чаще 150 мс — одно касание', () => {
    const s = session(MATCH_SAME_3);
    const r = go(run(s), { type: 'tap_sample', at: at(1) }, { type: 'tap_sample', at: at(1.1) }, { type: 'tap_sample', at: at(1.3) });
    expect(r.tapCount).toBe(2);
  });
});
