/**
 * «Похожее, но не такое же» — неидентичное сопоставление (решение владельца №206, условия методиста 2026-11-19):
 * `AbaTarget.samplePairs` — верная карточка поля → стимул, показанный образцом сверху. Правила цели (`targetErrors`),
 * допуск к сессии без вторых рисунков (`abaTargetReady`), сборка поля (`withMatchField`) и проба на модели экрана
 * (`matchTrialRun`). Харнесс — как в `abaMatchDistractors41.test.ts`: настоящие цели, полоса 5–6, «Со взрослым».
 */
import { ABA_OBJECT_ART } from '../../assets/registry';
import { ABA_TARGETS, abaTargetReady, readyAbaTargets } from '../../content/aba';
import { MATCH_SIMILAR_3 } from '../../content/aba/match-level1';
import { DEV_PLACEHOLDER_ART } from '../../services/local/abaStart';
import type { AbaTarget, AbaTargetState, AbaTrial } from '../../types/aba';
import { matchDueAt, matchTrialInput, matchVisual, optionActive, startMatchTrial, stepMatchTrial, type MatchTrialRun } from '../../ui/aba/model/matchTrialRun';
import { accessShown, chooseReinforcer, finishAccess, finishBreak, nextStep, recordTrial, startAbaSession, type StartInput } from '../abaSession';
import { targetErrors, targetForBand } from '../abaTargetRules';
import { initialTokenTraining } from '../abaTokenTraining';
import { acq, masteredState } from './abaSessionDriver';

const T0 = Date.UTC(2026, 10, 19, 6);
const TARGETS = readyAbaTargets(ABA_TARGETS, DEV_PLACEHOLDER_ART).map((t) => targetForBand(t, '5-6'));
const TGT = (id: string) => TARGETS.find((t) => t.id === id)!;
const SIMILAR = TGT('match-similar-3');
const PAIRS = SIMILAR.samplePairs!;
const SEEDS = Array.from({ length: 10 }, (_, i) => 211 + i * 41);

describe('правила цели с парами «карточка → образец»', () => {
  const broken = (over: Partial<AbaTarget>) => targetErrors({ ...MATCH_SIMILAR_3, ...over });
  const withCards = (id: string, cards: string[]) => MATCH_SIMILAR_3.exemplars.map((e) => (e.id === id ? { ...e, cards } : e));

  it('цель контента правила проходит; стоит в общем списке целей после лестницы', () => {
    expect(targetErrors(MATCH_SIMILAR_3)).toEqual([]);
    expect(ABA_TARGETS.map((t) => t.id)).toEqual(['match-same-2', 'match-same-3', 'match-shape', 'match-color-3', 'match-similar-3']);
    expect(MATCH_SIMILAR_3.prerequisiteTargetIds).toEqual(['match-same-3']);
    expect(MATCH_SIMILAR_3.mixWith).toBeUndefined();
    expect(MATCH_SIMILAR_3.includesTargetIds).toBeUndefined();
  });

  it('у экземпляра две карточки с парой — ошибка: «два экземпляра» критерия прошли бы на одном предмете', () => {
    expect(broken({ exemplars: withCards('e1', ['aba-obj-car', 'aba-obj-book', 'aba-obj-house']) }).join(' ')).toMatch(/карточек с парой 2/);
  });

  it('у экземпляра нет карточки с парой — ошибка', () => {
    expect(broken({ exemplars: withCards('e1', ['aba-obj-spoon', 'aba-obj-house', 'aba-obj-plane']) }).join(' ')).toMatch(/карточек с парой 0/);
  });

  it('образец стоит в поле цели — ошибка: в поле был бы идентичный вариант', () => {
    expect(broken({ exemplars: withCards('e1', ['aba-obj-car', 'aba-obj-car-b', 'aba-obj-house']) }).join(' ')).toMatch(/стоит в поле/);
  });

  it('образец — не другой рисунок того же предмета — ошибка', () => {
    expect(broken({ samplePairs: { ...MATCH_SIMILAR_3.samplePairs, 'aba-obj-car': 'aba-obj-cup-b' } }).join(' ')).toMatch(/не другой рисунок/);
    expect(broken({ samplePairs: { ...MATCH_SIMILAR_3.samplePairs, 'aba-obj-car': 'aba-obj-car' } }).join(' ')).toMatch(/не другой рисунок/);
  });

  it('перенос на предмете из обучения цели — ошибка', () => {
    expect(broken({ exemplars: withCards('g1', ['aba-obj-cup', 'aba-obj-spoon', 'aba-obj-tree']) }).join(' ')).toMatch(/перенос g1 на предметах обучения/);
  });

  it('пара без экземпляра — ошибка', () => {
    expect(broken({ samplePairs: { ...MATCH_SIMILAR_3.samplePairs, 'aba-obj-apple': 'aba-obj-apple-b' } }).join(' ')).toMatch(/нет экземпляра/);
  });
});

describe('допуск к сессии: без вторых рисунков цель закрыта', () => {
  it('в реестре вторых рисунков ещё нет — цель не допущена, лестница из четырёх допущена', () => {
    expect(Object.values(PAIRS).every((id) => ABA_OBJECT_ART[id] === null)).toBe(true);
    expect(abaTargetReady(MATCH_SIMILAR_3)).toBe(false);
    expect(readyAbaTargets().map((t) => t.id)).toEqual(['match-same-2', 'match-same-3', 'match-shape', 'match-color-3']);
  });

  it('нет хотя бы одного второго рисунка — закрыта; есть все — открыта', () => {
    const { 'aba-obj-hat-b': _hat, ...withoutHat } = DEV_PLACEHOLDER_ART as Record<string, unknown>;
    expect(abaTargetReady(MATCH_SIMILAR_3, withoutHat)).toBe(false);
    expect(abaTargetReady(MATCH_SIMILAR_3, DEV_PLACEHOLDER_ART)).toBe(true);
  });
});

// --- сессия

function runTrial(r0: MatchTrialRun, at0: number): { r: MatchTrialRun; at: number } {
  let r = r0;
  let at = at0;
  if (r.sampleTouchedAt === null) r = stepMatchTrial(r, { type: 'tap_sample', at: (at += 1000) });
  const id = r.step.sampleCardId!;
  if (optionActive(r, id)) r = stepMatchTrial(r, { type: 'tap_option', id, at: (at += 500) });
  for (let guard = 0; !r.done && guard < 50; guard += 1) {
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
  day: '2026-11-19',
  config: 'with_adult',
  band: '5-6',
  targets: TARGETS,
  states,
  reinforcerPool: ['puzzle', 'bubbles', 'drum', 'paint_drop', 'kaleidoscope', 'pinwheel'],
  reinforcerApart: [],
  reinforcerHistory: [],
  tokenTraining: { ...initialTokenTraining(), pairingDone: true, stage: 3 },
  startedAt: T0,
  seed,
  identifySets: [],
  physicalPromptAllowed: false,
  autoPlacement: true,
  observers: [{ id: 'o1', role: 'parent', trained: false }],
  primaryObserverId: 'o1',
});

/**
 * Форма освоена, цвет ещё в обучении — «похожее» занимает второй слот (условие методиста: слот — когда освоена первая
 * из формы и цвета). Обе освоены — их смешанный блок в свой день берёт оба слота, и «похожее» это занятие пропускает.
 */
const STATES = (): Record<string, AbaTargetState> => ({
  'match-same-2': masteredState(TGT('match-same-2'), 0),
  'match-same-3': masteredState(TGT('match-same-3'), 0),
  'match-shape': masteredState(TGT('match-shape'), 0),
  'match-color-3': acq(TGT('match-color-3'), 0),
  'match-similar-3': acq(SIMILAR, 0),
});

type Seen = { trial: AbaTrial; run: MatchTrialRun };

/** Одно занятие до конца, все ответы верные; возвращает пробы «похожего» с прогоном модели экрана. */
function runSession(seed: number): Seen[] {
  let now = T0;
  let st = startAbaSession(inputOf(STATES(), seed));
  const seen: Seen[] = [];
  let seq = 0;
  for (let guard = 0; guard < 300; guard += 1) {
    const { state, step } = nextStep(st, now);
    st = state;
    if (step.kind === 'choose_reinforcer') st = chooseReinforcer(st, step.options[0], now, 'child');
    else if (step.kind === 'break') st = finishBreak(st, (now += 60_000)).state;
    else if (step.kind === 'access') {
      st = accessShown(st);
      st = finishAccess(st, (now += step.durationMs));
    } else if (step.kind === 'end') break;
    else if (step.kind !== 'trial') throw new Error(`неожиданный шаг ${step.kind}`);
    else {
      const run = startMatchTrial({ step, target: st.targets[step.targetId], config: 'with_adult', seed: st.seed, trialId: `t${(seq += 1)}`, sessionId: st.sessionId, index: st.trials.length, shownAt: now });
      const done = runTrial(run, now);
      now = done.at + 200;
      const res = recordTrial(st, matchTrialInput(done.r), now);
      if (!res.ok) throw new Error(res.errors.join('; '));
      st = res.state;
      if (step.targetId === SIMILAR.id) seen.push({ trial: res.trial, run: done.r });
      now += 5000;
    }
  }
  return seen;
}

describe('поле и проба «похожего» в сессии', () => {
  const sessions = SEEDS.map(runSession);
  const all = sessions.flat();

  it('цель идёт в обучении: в каждой сессии её пробы есть', () => {
    for (const s of sessions) expect(s.filter((x) => x.trial.kind === 'teaching')).toHaveLength(5);
  });

  it('сверху — второй рисунок верной карточки; верная — карточка с парой своего экземпляра; образца в поле нет', () => {
    for (const { trial } of all) {
      const exemplar = SIMILAR.exemplars.find((e) => e.id === trial.exemplarId)!;
      const paired = exemplar.cards!.filter((c) => PAIRS[c]);
      expect(paired).toHaveLength(1);
      expect(trial.sampleCardId).toBe(paired[0]);
      expect(trial.sampleShownId).toBe(PAIRS[trial.sampleCardId!]);
      expect(trial.field).toHaveLength(3);
      expect(trial.field).toContain(trial.sampleCardId);
      expect(trial.field).not.toContain(trial.sampleShownId);
      // в поле нет второй карточки того же предмета и вторых рисунков вообще
      expect(trial.field!.filter((c) => c.endsWith('-b'))).toEqual([]);
    }
  });

  it('соседи в обучении — из обучающих карточек цели; пары «не вместе» держатся и с показанным образцом', () => {
    const teaching = new Set(SIMILAR.exemplars.filter((e) => e.role === 'teaching').flatMap((e) => e.cards!));
    for (const { trial } of all.filter((x) => x.trial.kind === 'teaching')) {
      for (const c of trial.field!) expect(teaching.has(c)).toBe(true);
      const onScreen = [...trial.field!, trial.sampleShownId!];
      for (const [a, b] of SIMILAR.notTogether ?? []) expect(onScreen.includes(a) && onScreen.includes(b)).toBe(false);
    }
  });

  it('в каждом обучающем поле рядом с верной — хотя бы одна чужая карточка с парой: «жать ту, за которую давали жетон» не проходит', () => {
    const teaching = all.filter((x) => x.trial.kind === 'teaching');
    for (const { trial } of teaching) {
      const lures = trial.field!.filter((c) => c !== trial.sampleCardId && PAIRS[c] !== undefined);
      expect(lures.length).toBeGreaterThanOrEqual(1);
    }
    // стратегия без взгляда на образец: случайно из «когда-либо верных» карточек поля — заметно ниже критерия 80 %
    const expected = teaching.reduce((sum, { trial }) => sum + 1 / trial.field!.filter((c) => PAIRS[c] !== undefined).length, 0) / teaching.length;
    expect(expected).toBeLessThanOrEqual(0.5);
  });

  it('в поле переноса соседи — как написано: чужих карточек с парой нет', () => {
    for (const { trial } of all.filter((x) => x.trial.kind === 'generalization')) {
      expect(trial.field!.filter((c) => c !== trial.sampleCardId && PAIRS[c] !== undefined)).toEqual([]);
    }
  });

  it('за блок образцом бывают минимум два разных предмета — критерий «два экземпляра» не проходит на одном', () => {
    for (const s of sessions) expect(new Set(s.filter((x) => x.trial.kind === 'teaching').map((x) => x.trial.sampleCardId)).size).toBeGreaterThanOrEqual(2);
  });

  it('касание верной карточки (не такой же, как образец) засчитано как самостоятельный ответ', () => {
    for (const { trial } of all.filter((x) => x.trial.kind === 'teaching')) {
      expect(trial.chosenCardId).toBe(trial.sampleCardId);
      expect(trial.response).toBe('independent');
    }
  });

  it('метка-подсказка над образцом указывает на показанный рисунок', () => {
    const { run } = all[0];
    const step = { ...run.step, startPromptLevel: 1 as const, promptDelayMs: null };
    const r = startMatchTrial({ step, target: SIMILAR, config: 'with_adult', seed: 1, trialId: 'x', sessionId: 's0', index: 0, shownAt: T0 });
    expect(matchVisual(r).focus).toMatchObject({ on: 'sample', id: step.sampleShownId });
  });

  it('запись без показанного образца или с другим — не та проба', () => {
    let st = startAbaSession(inputOf(STATES(), SEEDS[0]));
    let now = T0;
    for (let guard = 0; guard < 100; guard += 1) {
      const { state, step } = nextStep(st, now);
      st = state;
      if (step.kind === 'choose_reinforcer') st = chooseReinforcer(st, step.options[0], now, 'child');
      else if (step.kind === 'break') st = finishBreak(st, (now += 60_000)).state;
      else if (step.kind === 'access') {
        st = accessShown(st);
        st = finishAccess(st, (now += step.durationMs));
      } else if (step.kind !== 'trial') throw new Error(`неожиданный шаг ${step.kind}`);
      else {
        const run = startMatchTrial({ step, target: st.targets[step.targetId], config: 'with_adult', seed: st.seed, trialId: `m${guard}`, sessionId: st.sessionId, index: st.trials.length, shownAt: now });
        const done = runTrial(run, now);
        now = done.at + 200;
        const input = matchTrialInput(done.r);
        if (step.targetId === SIMILAR.id) {
          const { sampleShownId: _s, ...without } = input;
          expect(recordTrial(st, without, now)).toMatchObject({ ok: false, errors: ['не тот показанный образец'] });
          expect(recordTrial(st, { ...input, sampleShownId: 'aba-obj-apple' }, now)).toMatchObject({ ok: false });
          expect(recordTrial(st, input, now).ok).toBe(true);
          return;
        }
        const res = recordTrial(st, input, now);
        if (!res.ok) throw new Error(res.errors.join('; '));
        st = res.state;
        now += 5000;
      }
    }
    throw new Error('проба «похожего» не встретилась');
  });

  it('у целей без пар показанного образца в записи нет', () => {
    let st = startAbaSession(inputOf(STATES(), SEEDS[1]));
    const { state, step } = nextStep(st, T0);
    st = chooseReinforcer(state, (step as { options: string[] }).options[0], T0, 'child');
    const first = nextStep(st, T0 + 1).step;
    if (first.kind !== 'trial') throw new Error('ждали пробу разогрева');
    expect(first.targetId).not.toBe(SIMILAR.id);
    expect(first.sampleShownId).toBeUndefined();
  });
});
