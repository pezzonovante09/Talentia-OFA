/**
 * Решение методиста 41 (2026-11-18): соседи образца `match` меняются на каждой пробе — из обучающих карточек цели (не
 * переноса), без пар «не вместе», одно поле (набор карточек) не дважды подряд у цели; размер поля прежний. Поле
 * переноса — как написано. Место верной — прежнее (решение 39 при поле 2). Харнесс сессии — как в
 * `abaTwoChoiceSide.test.ts`: настоящие цели ABA, полоса 5–6, «Со взрослым».
 */
import { ABA_TARGETS, readyAbaTargets } from '../../content/aba';
import { ABA_CARDS_NOT_TOGETHER, ABA_COLOR_NOT_TOGETHER, ABA_SHAPE_NOT_TOGETHER } from '../../content/aba/stimuli';
import { DEV_PLACEHOLDER_ART } from '../../services/local/abaStart';
import type { AbaTarget, AbaTargetState, AbaTrial } from '../../types/aba';
import { matchDueAt, matchTrialInput, optionActive, startMatchTrial, stepMatchTrial, type MatchTrialRun } from '../../ui/aba/model/matchTrialRun';
import { accessShown, chooseReinforcer, finishAbaSession, finishAccess, finishBreak, nextStep, recordTrial, startAbaSession, TWO_CHOICE_SIDE, type StartInput } from '../abaSession';
import { targetForBand } from '../abaTargetRules';
import { initialTokenTraining } from '../abaTokenTraining';
import { acq, masteredState } from './abaSessionDriver';

const T0 = Date.UTC(2026, 10, 18, 6);
const TARGETS = readyAbaTargets(ABA_TARGETS, DEV_PLACEHOLDER_ART).map((t) => targetForBand(t, '5-6'));
const TGT = (id: string) => TARGETS.find((t) => t.id === id)!;
const SEEDS = Array.from({ length: 12 }, (_, i) => 101 + i * 37);

const teachingCards = (t: AbaTarget) => new Set(t.exemplars.filter((e) => e.role === 'teaching').flatMap((e) => e.cards!));
const generalizationCards = (t: AbaTarget) => new Set(t.exemplars.filter((e) => e.role === 'generalization').flatMap((e) => e.cards!));
const setKey = (field: readonly string[]) => [...field].sort().join('|');

function runTrial(r0: MatchTrialRun, correct: boolean, at0: number): { r: MatchTrialRun; at: number } {
  let r = r0;
  let at = at0;
  if (r.sampleTouchedAt === null) r = stepMatchTrial(r, { type: 'tap_sample', at: (at += 1000) });
  const id = correct ? r.step.sampleCardId! : r.step.field!.find((x) => x !== r.step.sampleCardId)!;
  if (optionActive(r, id)) r = stepMatchTrial(r, { type: 'tap_option', id, at: (at += 500) });
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

const inputOf = (states: Record<string, AbaTargetState>, seed: number): StartInput => ({
  sessionId: 's0',
  sessionIndex: 0,
  day: '2026-11-18',
  config: 'with_adult',
  band: '5-6',
  targets: TARGETS,
  states,
  reinforcerPool: ['puzzle', 'bubbles', 'drum', 'paint_drop', 'kaleidoscope', 'pinwheel'],
  reinforcerApart: [],
  reinforcerHistory: [],
  tokenTraining: { ...initialTokenTraining(), pairingDone: true, stage: 1 },
  startedAt: T0,
  seed,
  identifySets: [],
  physicalPromptAllowed: false,
  autoPlacement: true,
  observers: [{ id: 'o1', role: 'parent', trained: false }],
  primaryObserverId: 'o1',
});

/** Одно занятие до конца; каждая третья проба обучения — ошибка. Все пробы с полем. */
function runSession(states: Record<string, AbaTargetState>, seed: number): AbaTrial[] {
  let now = T0;
  let st = startAbaSession(inputOf(states, seed));
  let seq = 0;
  for (let guard = 0; guard < 400; guard += 1) {
    const { state, step } = nextStep(st, now);
    st = state;
    if (step.kind === 'choose_reinforcer') st = chooseReinforcer(st, step.options[0], now, 'child');
    else if (step.kind === 'break') st = finishBreak(st, (now += 60_000)).state;
    else if (step.kind === 'access') {
      st = accessShown(st);
      st = finishAccess(st, (now += step.durationMs));
    } else if (step.kind === 'end') break;
    else if (step.kind === 'adult_finish_chain') throw new Error('цепочек в match нет');
    else {
      const correct = step.trialKind === 'high_p' || step.trialKind === 'closing' || seq % 3 !== 2;
      const run = startMatchTrial({ step, target: st.targets[step.targetId], config: 'with_adult', seed: st.seed, trialId: `t${(seq += 1)}`, sessionId: st.sessionId, index: st.trials.length, shownAt: now });
      const done = runTrial(run, correct, now);
      now = done.at + 200;
      const res = recordTrial(st, matchTrialInput(done.r), now);
      if (!res.ok) throw new Error(res.errors.join('; '));
      st = res.state;
      now += 5000;
    }
  }
  finishAbaSession(st, now, {}, undefined, undefined, { routineExchangeInWindow: false });
  return st.trials.filter((t) => t.field);
}

/** С пробой переноса: последняя сессия цели — 100 % самостоятельных. */
const nearCriterion = (t: AbaTarget): AbaTargetState => ({ ...acq(t), recentIndependentRates: [1] });

/** Обучение всех четырёх целей в двух занятиях: «из 3» с цветом, затем форма. */
const PLANS: Record<string, AbaTargetState>[] = [
  { 'match-same-2': masteredState(TGT('match-same-2'), 0), 'match-color': nearCriterion(TGT('match-color')), 'match-same-3': nearCriterion(TGT('match-same-3')) },
  {
    'match-same-2': masteredState(TGT('match-same-2'), 0),
    'match-same-3': masteredState(TGT('match-same-3'), 0),
    'match-color': masteredState(TGT('match-color'), 0),
    'match-shape': nearCriterion(TGT('match-shape')),
  },
  // свежий ребёнок: проверка сверху вниз и обучение «одинаковых из 2»
  {},
];

const SESSIONS = PLANS.flatMap((states) => SEEDS.map((seed) => runSession(states, seed)));
const byTarget = (trials: readonly AbaTrial[]) => {
  const out = new Map<string, AbaTrial[]>();
  for (const t of trials) out.set(t.targetId, [...(out.get(t.targetId) ?? []), t]);
  return out;
};
const ALL = SESSIONS.flat();
const exemplarOf = (t: AbaTrial) => TGT(t.targetId).exemplars.find((e) => e.id === t.exemplarId)!;
const TEACHING_FIELDS = ALL.filter((t) => exemplarOf(t).role === 'teaching');

describe('решение 41: соседи образца match меняются на каждой пробе', () => {
  it('харнесс доходит до всех четырёх целей и до проб переноса', () => {
    expect(new Set(TEACHING_FIELDS.map((t) => t.targetId))).toEqual(new Set(['match-same-2', 'match-same-3', 'match-color', 'match-shape']));
    expect(ALL.filter((t) => t.kind === 'generalization').length).toBeGreaterThan(0);
  });

  it('размер поля — прежний: fieldSize цели, карточки без повторов', () => {
    for (const t of ALL) {
      expect(t.field).toHaveLength(TGT(t.targetId).fieldSize!);
      expect(new Set(t.field).size).toBe(t.field!.length);
    }
  });

  it('образец — карточка своего экземпляра и стоит в поле', () => {
    for (const t of ALL) {
      expect(exemplarOf(t).cards).toContain(t.sampleCardId);
      expect(t.field).toContain(t.sampleCardId);
    }
  });

  it('поле обучающей пробы — только из обучающих карточек цели, ни одной карточки переноса', () => {
    for (const t of TEACHING_FIELDS) {
      const target = TGT(t.targetId);
      const teaching = teachingCards(target);
      const general = generalizationCards(target);
      for (const c of t.field!) {
        expect(teaching.has(c)).toBe(true);
        expect(general.has(c)).toBe(false);
      }
    }
  });

  it('поле пробы переноса — в точности написанные карточки её экземпляра', () => {
    for (const t of ALL.filter((x) => exemplarOf(x).role === 'generalization')) expect(setKey(t.field!)).toBe(setKey(exemplarOf(t).cards!));
  });

  it('пары «не вместе» (формы и цвета) в одном поле не встречаются', () => {
    for (const t of ALL) for (const [a, b] of ABA_CARDS_NOT_TOGETHER) expect(t.field!.includes(a) && t.field!.includes(b)).toBe(false);
  });

  it('у цели одно и то же поле (набор карточек) не дважды подряд', () => {
    for (const session of SESSIONS) {
      for (const [, trials] of byTarget(session)) {
        for (let i = 1; i < trials.length; i += 1) expect(setKey(trials[i].field!)).not.toBe(setKey(trials[i - 1].field!));
      }
    }
  });

  it('соседи меняются: наборов поля у цели заметно больше, чем написанных обучающих экземпляров', () => {
    for (const [id, trials] of byTarget(TEACHING_FIELDS)) {
      const authored = TGT(id).exemplars.filter((e) => e.role === 'teaching').length;
      expect(new Set(trials.map((t) => setKey(t.field!))).size).toBeGreaterThan(authored);
    }
  });

  it('соседи одного образца меняются от пробы к пробе, а не приклеены к экземпляру', () => {
    for (const [, trials] of byTarget(TEACHING_FIELDS)) {
      const bySample = new Map<string, Set<string>>();
      for (const t of trials) bySample.set(t.sampleCardId!, (bySample.get(t.sampleCardId!) ?? new Set()).add(setKey(t.field!)));
      expect(Math.max(...[...bySample.values()].map((s) => s.size))).toBeGreaterThan(1);
    }
  });

  it('место верной при поле 2 — по-прежнему ряды решения 39 (не больше 3 подряд, не больше 4 чередований)', () => {
    for (const session of SESSIONS) {
      for (const [id, trials] of byTarget(session)) {
        if (TGT(id).fieldSize !== 2) continue;
        const ps = trials.map((t) => t.field!.indexOf(t.sampleCardId!));
        let same = 1;
        let alt = 1;
        for (let i = 1; i < ps.length; i += 1) {
          same = ps[i] === ps[i - 1] ? same + 1 : 1;
          alt = ps[i] !== ps[i - 1] ? alt + 1 : 1;
          expect(same).toBeLessThanOrEqual(TWO_CHOICE_SIDE.maxSameInRow);
          expect(alt).toBeLessThanOrEqual(TWO_CHOICE_SIDE.maxAlternatingRun);
        }
      }
    }
  });

  it('то же зерно — те же поля (детерминизм через rng сессии)', () => {
    const fields = (ts: AbaTrial[]) => ts.map((t) => [t.targetId, t.exemplarId, t.sampleCardId, ...t.field!].join(','));
    for (const states of PLANS) expect(fields(runSession(states, 777))).toEqual(fields(runSession(states, 777)));
    expect(fields(runSession(PLANS[0], 777))).not.toEqual(fields(runSession(PLANS[0], 778)));
  });

  it('список «не вместе» на цели собран из правил стимулов, включая формы переноса', () => {
    for (const t of TARGETS) expect(t.notTogether).toBe(ABA_CARDS_NOT_TOGETHER);
    for (const p of ABA_COLOR_NOT_TOGETHER) expect(ABA_CARDS_NOT_TOGETHER).toContainEqual(p);
    for (const [a, b] of ABA_SHAPE_NOT_TOGETHER) {
      expect(ABA_CARDS_NOT_TOGETHER).toContainEqual([`aba-shape-${a}`, `aba-shape-${b}`]);
      expect(ABA_CARDS_NOT_TOGETHER).toContainEqual([`aba-shape-${a}-alt`, `aba-shape-${b}-alt`]);
    }
  });

  it('у каждого образца каждой цели есть хотя бы два допустимых набора — запрет повтора выполним', () => {
    for (const t of TARGETS) {
      const pool = [...teachingCards(t)];
      const apart = t.notTogether ?? [];
      const k = t.fieldSize! - 1;
      for (const sample of pool) {
        const rest = pool.filter((c) => c !== sample);
        const combos: string[][] = k === 1 ? rest.map((c) => [c]) : rest.flatMap((a, i) => rest.slice(i + 1).map((b) => [a, b]));
        const ok = combos.filter((d) => !apart.some(([a, b]) => [sample, ...d].includes(a) && [sample, ...d].includes(b)));
        expect(ok.length).toBeGreaterThanOrEqual(2);
      }
    }
  });
});
