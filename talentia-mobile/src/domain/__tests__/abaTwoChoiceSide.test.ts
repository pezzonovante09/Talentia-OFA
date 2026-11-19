/**
 * Решение методиста 39 (2026-11-18): место верной карточки при выборе из двух — случайно, не больше 3 раз подряд на одной
 * стороне и не больше 4 мест подряд с чередованием (`twoChoicePosition`); поле 3 — прежнее «реже занятое, не третий раз
 * подряд». Флаг `alternation_bias` (`abaBarriers.ts`, `ALTERNATION`): пары соседних проб одной сессии, где место верной
 * не сменилось, — последние 12 таких пар за до 10 сессий; флаг при ≥ 10 сменах выбранной стороны.
 *
 * Харнесс сессии — как в `abaPlacementObservingMiss.test.ts`: настоящие цели ABA, полоса 5–6, «Со взрослым».
 */
import { ABA_TARGETS, readyAbaTargets } from '../../content/aba';
import { DEV_PLACEHOLDER_ART } from '../../services/local/abaStart';
import type { AbaTrial } from '../../types/aba';
import { matchDueAt, matchTrialInput, optionActive, startMatchTrial, stepMatchTrial, type MatchTrialRun } from '../../ui/aba/model/matchTrialRun';
import { ALTERNATION, applyChoiceBias, choiceBiasIn } from '../abaBarriers';
import { initialTargetState } from '../abaPrompting';
import { seeded } from '../abaRandom';
import {
  accessShown,
  chooseReinforcer,
  finishAbaSession,
  finishAccess,
  finishBreak,
  nextStep,
  recordTrial,
  startAbaSession,
  TWO_CHOICE_SIDE,
  twoChoicePosition,
  type StartInput,
} from '../abaSession';
import { targetForBand } from '../abaTargetRules';
import { initialTokenTraining, type TokenTrainingState } from '../abaTokenTraining';
import type { Rng } from '../abaTokens';
import { target, trial } from './abaFixtures';
import { acq, masteredState } from './abaSessionDriver';

// ---------- общие помощники последовательностей ----------

/** Длина самого длинного ряда одной стороны. */
const longestSame = (ps: readonly number[]) => {
  let best = 0;
  let run = 0;
  ps.forEach((p, i) => {
    run = i > 0 && p === ps[i - 1] ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return best;
};

/** Длина самого длинного ряда мест с чередованием (Л-П-Л-П = 4). */
const longestAlternating = (ps: readonly number[]) => {
  let best = ps.length ? 1 : 0;
  let run = 1;
  for (let i = 1; i < ps.length; i += 1) {
    run = ps[i] !== ps[i - 1] ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return best;
};

function sequence(length: number, seed: number, next: (ps: number[], rng: Rng) => number = twoChoicePosition): number[] {
  const { rng } = seeded(seed);
  const ps: number[] = [];
  for (let i = 0; i < length; i += 1) ps.push(next(ps, rng));
  return ps;
}

/** «Жми на другую сторону»: ребёнок жмёт сторону, противоположную месту верной в прошлой пробе. Доля попаданий. */
const switchFromLastCorrect = (ps: readonly number[]) => {
  let hits = 0;
  for (let i = 1; i < ps.length; i += 1) if (1 - ps[i - 1] === ps[i]) hits += 1;
  return hits / (ps.length - 1);
};

/** Прежнее правило для поля 2 (до решения 39): реже занятое место, не третий раз подряд, — контроль теста. */
function oldRule(ps: readonly number[], rng: Rng): number {
  const last2 = ps.slice(-2);
  const ban = last2.length === 2 && last2[0] === last2[1] ? [last2[0]] : [];
  const pool = [0, 1].filter((p) => !ban.includes(p));
  const count = (o: number) => ps.filter((u) => u === o).length;
  const min = Math.min(...pool.map(count));
  const least = pool.filter((o) => count(o) === min);
  return least[Math.floor(rng() * least.length)];
}

const SEEDS = Array.from({ length: 40 }, (_, i) => 7919 * (i + 1));

// ---------- 1. twoChoicePosition ----------

describe('twoChoicePosition: место верной при выборе из двух', () => {
  const low: Rng = () => 0;
  const high: Rng = () => 0.999;

  it('константы решения 39: не больше 3 подряд на стороне и 4 мест с чередованием', () => {
    expect(TWO_CHOICE_SIDE).toEqual({ maxSameInRow: 3, maxAlternatingRun: 4 });
  });

  it.each([
    [[0, 0, 0], 1],
    [[1, 1, 1], 0],
    [[1, 0, 0, 0], 1],
    [[0, 1, 1, 1], 0],
  ])('после трёх подряд на одной стороне (%j) — только другая сторона, при любом rng', (ps, want) => {
    expect([twoChoicePosition(ps, low), twoChoicePosition(ps, high)]).toEqual([want, want]);
  });

  it.each([
    [[0, 1, 0, 1], 1],
    [[1, 0, 1, 0], 0],
    [[0, 0, 1, 0, 1], 1],
    [[1, 1, 0, 1, 0], 0],
  ])('после четырёх мест с чередованием (%j) — та же сторона, что в прошлой пробе, при любом rng', (ps, want) => {
    expect([twoChoicePosition(ps, low), twoChoicePosition(ps, high)]).toEqual([want, want]);
  });

  it.each([[[]], [[0]], [[1]], [[0, 0]], [[0, 1, 0]], [[0, 0, 1, 1]], [[1, 0, 1]], [[0, 1, 0, 0]]])(
    'вне ограничений (%j) — обе стороны возможны, решает rng',
    (ps) => {
      expect([twoChoicePosition(ps, low), twoChoicePosition(ps, high)]).toEqual([0, 1]);
    },
  );

  it('1000 мест × 40 зёрен: никогда 4 подряд на одной стороне', () => {
    expect(Math.max(...SEEDS.map((s) => longestSame(sequence(1000, s))))).toBe(TWO_CHOICE_SIDE.maxSameInRow);
  });

  it('1000 мест × 40 зёрен: никогда 5 мест подряд с чередованием', () => {
    expect(Math.max(...SEEDS.map((s) => longestAlternating(sequence(1000, s))))).toBe(TWO_CHOICE_SIDE.maxAlternatingRun);
  });

  it('стратегия «жми на другую сторону» берёт заметно меньше 75 % (в каждом прогоне < 65 %, в среднем 50–60 %)', () => {
    const shares = SEEDS.map((s) => switchFromLastCorrect(sequence(1000, s)));
    expect(Math.max(...shares)).toBeLessThan(0.65);
    const mean = shares.reduce((a, b) => a + b, 0) / shares.length;
    expect(mean).toBeGreaterThan(0.5);
    expect(mean).toBeLessThan(0.6);
  });

  it('доля каждой стороны в прогоне из 1000 — от 40 до 60 %', () => {
    for (const s of SEEDS) {
      const left = sequence(1000, s).filter((p) => p === 0).length / 1000;
      expect(left).toBeGreaterThanOrEqual(0.4);
      expect(left).toBeLessThanOrEqual(0.6);
    }
  });

  it('контроль теста: прежнее правило «реже занятое» тем же счётом даёт ≈ 75 % и ни разу 3 подряд', () => {
    const olds = SEEDS.map((s) => sequence(1000, s, oldRule));
    const mean = olds.map(switchFromLastCorrect).reduce((a, b) => a + b, 0) / olds.length;
    expect(mean).toBeGreaterThan(0.7);
    expect(Math.max(...olds.map(longestSame))).toBe(2);
  });
});

// ---------- 2. уровень сессии ----------

type Act = 'correct' | 'incorrect';
const POOL = ['puzzle', 'bubbles', 'drum', 'paint_drop', 'kaleidoscope', 'pinwheel'];
const T0 = Date.UTC(2026, 10, 18, 6);
const TARGETS = readyAbaTargets(ABA_TARGETS, DEV_PLACEHOLDER_ART).map((t) => targetForBand(t, '5-6'));
const FIELD_OF = new Map(TARGETS.map((t) => [t.id, t.fieldSize]));

function runTrial(r0: MatchTrialRun, act: Act, at0: number): { r: MatchTrialRun; at: number } {
  let r = r0;
  let at = at0;
  if (r.sampleTouchedAt === null) r = stepMatchTrial(r, { type: 'tap_sample', at: (at += 1000) });
  const id = act === 'correct' ? r.step.sampleCardId! : r.step.field!.find((x) => x !== r.step.sampleCardId)!;
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

type Child = { states: StartInput['states']; tokenTraining: TokenTrainingState; board?: StartInput['board']; identifySets: StartInput['identifySets']; index: number; now: number };

const freshChild = (): Child => ({ states: {}, tokenTraining: { ...initialTokenTraining(), pairingDone: true, stage: 1 }, identifySets: [], index: 0, now: T0 });

const inputOf = (c: Child, seed: number): StartInput => ({
  sessionId: `s${c.index}`,
  sessionIndex: c.index,
  day: '2026-11-18',
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

/** Одно занятие до конца; ответ на пробы обучения/измерения — по `act` (номер пробы в сессии). */
function runSession(c: Child, seed: number, act: (n: number) => Act): { child: Child; trials: AbaTrial[] } {
  let now = c.now + 3 * 3600_000;
  let st = startAbaSession(inputOf({ ...c, now }, seed));
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
    else if (step.kind === 'adult_finish_chain' || step.kind === 'sample_touch') throw new Error('цепочек и шага «коснись» здесь нет');
    else {
      const a = step.trialKind === 'high_p' || step.trialKind === 'closing' ? 'correct' : act(seq);
      const run = startMatchTrial({ step, target: st.targets[step.targetId], config: 'with_adult', seed: st.seed, trialId: `t${(seq += 1)}`, sessionId: st.sessionId, index: st.trials.length, shownAt: now });
      const done = runTrial(run, a, now);
      now = done.at + 200;
      const res = recordTrial(st, matchTrialInput(done.r), now);
      if (!res.ok) throw new Error(res.errors.join('; '));
      st = res.state;
      now += 5000;
    }
  }
  const result = finishAbaSession(st, now, {}, undefined, undefined, { routineExchangeInWindow: false });
  const child: Child = {
    states: { ...c.states, ...result.states },
    tokenTraining: result.tokenTraining,
    board: { earned: result.board.earned, nonContingent: result.board.nonContingent, ...(result.board.returned ? { returned: result.board.returned } : {}) },
    identifySets: result.identifySets,
    index: c.index + 1,
    now,
  };
  return { child, trials: st.trials };
}

/** Места верной по целям в одной сессии, все виды проб по порядку — как их видит `withMatchField`. */
function positionsByTarget(trials: readonly AbaTrial[]): Map<string, number[]> {
  const out = new Map<string, number[]>();
  for (const t of trials) if (t.field) out.set(t.targetId, [...(out.get(t.targetId) ?? []), t.field.indexOf(t.sampleCardId!)]);
  return out;
}

const TGT = (id: string) => TARGETS.find((t) => t.id === id)!;
/** Обучение «одинаковых из 3» (поле 3): «из 2» освоена, цвет из 3 ещё закрыт (решение методиста 40), проверки сверху вниз нет. */
const teachingThree = (): Child => ({
  ...freshChild(),
  states: { 'match-same-2': masteredState(TGT('match-same-2'), 0), 'match-same-3': acq(TGT('match-same-3')) },
});

/**
 * Цепочки по 4 занятия, каждое — со своим зерном; ответы — верно, каждая третья проба — ошибка. От свежего ребёнка
 * (проверка сверху вниз не проходит, спуск до «одинаковых из 2», их базовая линия и обучение — поле 2) и от обучения
 * «одинаковых из 3» (поле 3).
 */
const CHAINS = Array.from({ length: 16 }, (_, k) => {
  const sessions: AbaTrial[][] = [];
  let c = k % 2 ? teachingThree() : freshChild();
  for (let i = 0; i < 4; i += 1) {
    const r = runSession(c, 1000 + 97 * k + i, (n) => (n % 3 === 2 ? 'incorrect' : 'correct'));
    sessions.push(r.trials);
    c = r.child;
  }
  return sessions;
});
const SESSION_SEQS = CHAINS.flat().flatMap((trials) => [...positionsByTarget(trials)].map(([id, ps]) => ({ id, size: FIELD_OF.get(id), ps })));
const TWO = SESSION_SEQS.filter((x) => x.size === 2);
const THREE = SESSION_SEQS.filter((x) => x.size === 3);

describe('сессия: место верной у цели match', () => {
  it('предусловие: есть сессии с целями поля 2 и поля 3 и с рядами не короче 6 мест', () => {
    expect(TWO.filter((x) => x.ps.length >= 6).length).toBeGreaterThan(3);
    expect(THREE.filter((x) => x.ps.length >= 6).length).toBeGreaterThan(3);
  });

  it('поле 2: никогда 4 подряд на одной стороне', () => {
    for (const x of TWO) expect([x.id, x.ps, longestSame(x.ps) <= 3]).toEqual([x.id, x.ps, true]);
  });

  it('поле 2: никогда 5 мест подряд с чередованием', () => {
    for (const x of TWO) expect([x.id, x.ps, longestAlternating(x.ps) <= 4]).toEqual([x.id, x.ps, true]);
  });

  it('поле 2 подключено к новому правилу: встречается 3 подряд на одной стороне (прежнее правило это запрещало)', () => {
    expect(TWO.some((x) => longestSame(x.ps) === 3)).toBe(true);
  });

  it('поле 3 — прежнее поведение: никогда 3 подряд на одном месте', () => {
    for (const x of THREE) expect([x.id, x.ps, longestSame(x.ps) <= 2]).toEqual([x.id, x.ps, true]);
  });
});

// ---------- 3. alternation_bias ----------

const FIELD2 = ['a', 'b'];
/** Проба поля 2 у match: верная на месте `correct`, выбрано место `chosen`. */
const two = (correct: number, chosen: number, over: Partial<AbaTrial> = {}): AbaTrial =>
  trial({
    response: correct === chosen ? 'independent' : 'incorrect',
    promptLevelUsed: 0,
    startPromptLevel: 0,
    field: FIELD2,
    sampleCardId: FIELD2[correct],
    chosenCardId: FIELD2[chosen],
    ...over,
  });
const session = (index: number, trials: AbaTrial[]) => ({ index, trials });

/** Ответы на ряд мест верной: стратегия получает место верной сейчас и прошлый выбор. */
const answer = (ps: readonly number[], choose: (correct: number, prevChosen: number | undefined, i: number) => number) => {
  const out: AbaTrial[] = [];
  let prev: number | undefined;
  ps.forEach((p, i) => {
    const c = choose(p, prev, i);
    out.push(two(p, c));
    prev = c;
  });
  return out;
};
const alwaysSwitch = (_: number, prev: number | undefined) => (prev === undefined ? 0 : 1 - prev);
const correct = (p: number) => p;

/** Места верной, где место не меняется: `n` пар «то же место» подряд. */
const stay = (n: number) => Array.from({ length: n + 1 }, () => 0);

describe('alternation_bias: «жми на другую сторону» при выборе из двух', () => {
  it('параметры: 12 пар, флаг при ≥ 10 сменах, до 10 сессий', () => {
    expect(ALTERNATION).toEqual({ pairs: 12, minSwitched: 10, maxSessions: 10 });
  });

  it('пусто — флага нет', () => {
    expect(choiceBiasIn([], 'match')).toEqual([]);
    expect(choiceBiasIn([session(1, [])], 'match')).toEqual([]);
  });

  it('всегда «на другую сторону» на настоящих местах верной (зерно, 40 проб в сессии) — флаг, и только он', () => {
    for (const s of SEEDS.slice(0, 10)) {
      expect(choiceBiasIn([session(1, answer(sequence(40, s), alwaysSwitch))], 'match')).toEqual(['alternation_bias']);
    }
  });

  it('ровно 12 пар «место не сменилось», 10 со сменой стороны — флаг', () => {
    // места верной 0,0,…; выбор: 10 смен, затем 2 без смены
    const chosen = [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 0];
    expect(choiceBiasIn([session(1, chosen.map((c) => two(0, c)))], 'match')).toEqual(['alternation_bias']);
  });

  it('12 пар, 9 со сменой — флага нет', () => {
    const chosen = [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 1];
    expect(choiceBiasIn([session(1, chosen.map((c) => two(0, c)))], 'match')).toEqual([]);
  });

  it('11 пар, все со сменой — мало пар, флага нет', () => {
    expect(choiceBiasIn([session(1, answer(stay(11), alwaysSwitch))], 'match')).toEqual([]);
  });

  it('пары, где место верной сменилось, не считаются: строгое чередование верной + «на другую сторону» — флага нет', () => {
    const ps = Array.from({ length: 40 }, (_, i) => i % 2);
    expect(choiceBiasIn([session(1, answer(ps, alwaysSwitch))], 'match')).toEqual([]);
  });

  it('пары не переходят границу сессии: 6 сессий по 2 пары = 12 пар — флаг; на стыках пар нет', () => {
    const sessions = Array.from({ length: 6 }, (_, i) => session(i + 1, answer(stay(2), alwaysSwitch)));
    expect(choiceBiasIn(sessions, 'match')).toEqual(['alternation_bias']);
    // 10 сессий по одной паре со сменой (выбор 0→1): внутри — 10 пар, мало; через стыки (1→0) было бы ещё 9 со сменой
    const short = Array.from({ length: 10 }, (_, i) => session(i + 1, answer(stay(1), alwaysSwitch)));
    expect(choiceBiasIn(short, 'match')).toEqual([]);
  });

  it('окно — до 10 последних сессий: пары 11-й с конца сессии не считаются', () => {
    const old = session(1, answer(stay(12), alwaysSwitch));
    const empty = Array.from({ length: 10 }, (_, i) => session(i + 2, []));
    expect(choiceBiasIn([old, ...empty.slice(1)], 'match')).toEqual(['alternation_bias']);
    expect(choiceBiasIn([old, ...empty], 'match')).toEqual([]);
  });

  it('берутся 12 самых свежих пар: старое чередование не держит флаг, если свежие 12 без смен', () => {
    const old = session(1, answer(stay(20), alwaysSwitch));
    const fresh = session(2, answer(stay(12), correct));
    expect(choiceBiasIn([old, fresh], 'match')).toEqual([]);
  });

  it('верный ответ (на настоящих местах верной) никогда не ставит флаг', () => {
    for (const s of SEEDS) {
      const sessions = Array.from({ length: 10 }, (_, i) => session(i + 1, answer(sequence(20, s + i), correct)));
      expect(choiceBiasIn(sessions, 'match')).not.toContain('alternation_bias');
    }
  });

  it('случайный ответ: флаг редко (≈ 2 % окон, меньше 6 % на 500 зёрнах)', () => {
    let hits = 0;
    for (let s = 1; s <= 500; s += 1) {
      const { rng } = seeded(s * 31337);
      const sessions = Array.from({ length: 3 }, (_, i) => session(i + 1, answer(sequence(20, s * 7 + i), () => (rng() < 0.5 ? 0 : 1))));
      if (choiceBiasIn(sessions, 'match').includes('alternation_bias')) hits += 1;
    }
    expect(hits / 500).toBeLessThan(0.06);
  });

  it('поле 3 не считается: «на другую сторону» при поле из трёх — флага нет', () => {
    const f3 = ['a', 'b', 'c'];
    const trials = Array.from({ length: 30 }, (_, i) =>
      trial({ response: i % 2 ? 'incorrect' : 'independent', promptLevelUsed: 0, field: f3, sampleCardId: 'a', chosenCardId: f3[i % 2] }),
    );
    expect(choiceBiasIn([session(1, trials)], 'match')).not.toContain('alternation_bias');
  });

  it('у match считается L1, у identify — нет; L2 у match не считается', () => {
    const l1 = answer(stay(12), alwaysSwitch).map((t) => ({ ...t, promptLevelUsed: 1 as const }));
    expect(choiceBiasIn([session(1, l1)], 'match')).toEqual(['alternation_bias']);
    expect(choiceBiasIn([session(1, l1)], 'identify')).toEqual([]);
    const l2 = answer(stay(12), alwaysSwitch).map((t) => ({ ...t, promptLevelUsed: 2 as const }));
    expect(choiceBiasIn([session(1, l2)], 'match')).toEqual([]);
  });

  it('applyChoiceBias: ставится, держится одну сессию без условия, снимается после второй', () => {
    const alt = session(1, answer(stay(12), alwaysSwitch));
    // чистая сессия: место верной не меняется, ребёнок отвечает верно — 12 свежих пар без смены стороны; поровну сторон
    const clean = (i: number) => session(i, [...answer(stay(6), correct), ...answer(Array.from({ length: 7 }, () => 1), correct)]);
    let s = applyChoiceBias(initialTargetState(target), [alt], 'match');
    expect(s.flags).toContain('alternation_bias');
    s = applyChoiceBias(s, [alt, clean(2)], 'match');
    expect(s.flags).toContain('alternation_bias');
    s = applyChoiceBias(s, [alt, clean(2), clean(3)], 'match');
    expect(s.flags).not.toContain('alternation_bias');
  });
});
