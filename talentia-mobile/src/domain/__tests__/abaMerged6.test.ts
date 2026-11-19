/**
 * Регрессия взаимодействия шести решений методиста, слитых вместе 2026-11-18 (ABA.md, последний раздел): 40 (цвет из
 * трёх), 41 (соседи образца на каждой пробе), 16 (обмен перед перерывом), 43 (смешанный блок), 34 (расписание ребёнку),
 * 14 («Награда от взрослого»). Каждое проверено отдельно; здесь — их стыки на настоящих целях.
 *
 * Харнесс — как в `abaProbeParticipation.test.ts` / `abaPlacementObservingMiss.test.ts`: настоящие цели ABA, полоса 5–6,
 * «Со взрослым», пробы через модель экрана (`matchTrialRun`).
 */
import { ABA_TARGETS, readyAbaTargets } from '../../content/aba';
import { MATCH_LEVEL1 } from '../../content/aba/match-level1';
import { poolFor, resumePoolFor, DEV_PLACEHOLDER_ART } from '../../services/local/abaStart';
import type { AbaTargetState, AbaTrial } from '../../types/aba';
import { matchDueAt, matchTrialInput, optionActive, startMatchTrial, stepMatchTrial, type MatchTrialRun } from '../../ui/aba/model/matchTrialRun';
import { childSchedule, type BlockSchedule } from '../abaBlockSchedule';
import { mixGroups } from '../abaMixedBlock';
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
  type AbaSessionResult,
  type AbaSessionState,
  type AbaStep,
  type StartInput,
  type TrialStep,
} from '../abaSession';
import { targetForBand } from '../abaTargetRules';
import { reinforcerChoices } from '../abaTokens';
import { EXCHANGE_ACCESS_MS, initialTokenTraining, type TokenTrainingState } from '../abaTokenTraining';
import { apartPairs } from '../abaReinforcerCatalog';
import { REINFORCERS } from '../../content/aba/reinforcers';
import { masteredState } from './abaSessionDriver';

type Act = 'correct' | 'none' | 'incorrect';

const POOL = ['puzzle', 'bubbles', 'drum', 'paint_drop', 'kaleidoscope', 'pinwheel'];
const T0 = Date.UTC(2026, 10, 15, 6);
// лестница из четырёх целей: «похожее, но не такое же» (№206) — отдельно, `abaSimilarMatch.test.ts`
const TARGETS = readyAbaTargets(MATCH_LEVEL1, DEV_PLACEHOLDER_ART).map((t) => targetForBand(t, '5-6'));
const SHAPE = 'match-shape';
const COLOR = 'match-color-3';
const MIXED_END = `mixed:${SHAPE}+${COLOR}`;

/** «Верно» — образец и такая же карточка; «неверно» — образец и другая; «нет ответа» — окна истекают без касаний. */
function runTrial(r0: MatchTrialRun, act: Act, at0: number): { r: MatchTrialRun; at: number } {
  let r = r0;
  let at = at0;
  if (act !== 'none') {
    if (r.sampleTouchedAt === null) r = stepMatchTrial(r, { type: 'tap_sample', at: (at += 1000) });
    const id = act === 'correct' ? r.step.sampleCardId! : r.step.field!.find((x) => x !== r.step.sampleCardId)!;
    if (optionActive(r, id)) r = stepMatchTrial(r, { type: 'tap_option', id, at: (at += 500) });
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
  day: string;
};

/** После знакомства: доска на ступени 1, ни одной цели не трогали. */
const freshChild = (): Child => ({
  states: {},
  tokenTraining: { ...initialTokenTraining(), pairingDone: true, stage: 1 },
  identifySets: [],
  index: 0,
  now: T0,
  day: '2026-11-15',
});

/** Все четыре цели освоены критерием (готовы к смешанному блоку); `lastMaintenance` — номер сессии последнего поддержания. */
const masteredChild = (index: number, lastMaintenance: number, stage: TokenTrainingState['stage'] = 5, board?: StartInput['board']): Child => ({
  states: Object.fromEntries(TARGETS.map((t) => [t.id, { ...masteredState(t, lastMaintenance), masteredBy: 'criterion' as const }])),
  tokenTraining: { ...initialTokenTraining(), pairingDone: true, stage },
  identifySets: [],
  index,
  now: T0,
  day: '2026-11-18',
  ...(board ? { board } : {}),
});

const inputOf = (c: Child, seed: number): StartInput => ({
  sessionId: `s${c.index}`,
  sessionIndex: c.index,
  day: c.day,
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
  observers: [{ id: 'o1', role: 'specialist', trained: true }],
  primaryObserverId: 'o1',
});

type Snap = { step: AbaStep; schedule: BlockSchedule & { reinforcerId: string | null }; trialsLeft: number; participation: boolean; finishBreakExchanged?: number };
type Run = {
  child: Child;
  result: AbaSessionResult;
  trials: AbaTrial[];
  planned: AbaSessionState;
  final: AbaSessionState;
  snaps: Snap[];
};

/** Ответ на пробу: шаг и её номер среди проб того же вида той же цели в занятии (с нуля). */
type Policy = (step: TrialStep, n: number) => Act;

/** Одно занятие до конца: пробы — по `policy`, высоковероятные — верно. Расписание снимается после каждого `nextStep`. */
function runSession(c: Child, policy: Policy, seed = 1000 + c.index, nextDay?: string): Run {
  let now = c.now + 3 * 3600_000;
  let st = startAbaSession(inputOf({ ...c, now }, seed));
  const planned = st;
  let seq = 0;
  const seen = new Map<string, number>();
  const snaps: Snap[] = [];
  let ended = false;
  for (let guard = 0; guard < 400; guard += 1) {
    const next = nextStep(st, now);
    st = next.state;
    const step = next.step;
    const snap: Snap = { step, schedule: childSchedule(st), trialsLeft: st.queue.filter((q) => q.kind === 'trial').length, participation: next.participation };
    snaps.push(snap);
    if (step.kind === 'choose_reinforcer') st = chooseReinforcer(st, step.options[0], now, 'child');
    else if (step.kind === 'break') {
      now += 60_000;
      const fb = finishBreak(st, now);
      snap.finishBreakExchanged = fb.state.exchangesMade - st.exchangesMade;
      st = fb.state;
    } else if (step.kind === 'access') {
      st = accessShown(st);
      now += step.durationMs;
      st = finishAccess(st, now);
    } else if (step.kind === 'end') {
      ended = true;
      break;
    } else if (step.kind === 'adult_finish_chain' || step.kind === 'sample_touch') throw new Error('цепочек и шага «коснись» здесь нет');
    else {
      const key = `${step.targetId}|${step.trialKind}`;
      const n = seen.get(key) ?? 0;
      seen.set(key, n + 1);
      const act = step.trialKind === 'high_p' ? 'correct' : policy(step, n);
      const run = startMatchTrial({ step, target: st.targets[step.targetId], config: 'with_adult', seed: st.seed, trialId: `t${(seq += 1)}`, sessionId: st.sessionId, index: st.trials.length, shownAt: now });
      const done = runTrial(run, act, now);
      now = done.at + 200;
      const res = recordTrial(st, matchTrialInput(done.r), now);
      if (!res.ok) throw new Error(res.errors.join('; '));
      // жетон за участие на снятии конца блока выдаёт запись пробы (`recordTrial` снимает `block_end`)
      snap.participation ||= res.participation;
      st = res.state;
      now += 5000;
    }
  }
  if (!ended) throw new Error('занятие не дошло до конца');
  const result = finishAbaSession(st, now, {}, undefined, undefined, { routineExchangeInWindow: false });
  const child: Child = {
    states: { ...c.states, ...result.states },
    tokenTraining: result.tokenTraining,
    board: { earned: result.board.earned, nonContingent: result.board.nonContingent, ...(result.board.returned ? { returned: result.board.returned } : {}) },
    identifySets: result.identifySets,
    index: c.index + 1,
    now,
    day: nextDay ?? c.day,
  };
  return { child, result, trials: st.trials, planned, final: st, snaps };
}

/** Очередь плана строкой: проба — `вид:цель`, конец блока — `END:цель:participation`. */
const plan = (st: AbaSessionState) =>
  st.queue.map((x) => (x.kind === 'trial' ? `${x.trial.kind}:${x.trial.targetId}` : x.kind === 'block_end' ? `END:${x.targetId}:${x.participation}` : x.kind));

const allCorrect: Policy = () => 'correct';
const kinds = (r: Run) => r.snaps.map((s) => s.step.kind);
const eventsOf = (r: Run, kind: string) => r.result.session.events.filter((e) => e.kind === kind);
const mixedTrials = (r: Run) => r.trials.filter((t) => t.kind === 'verification');
const SEEDS = Array.from({ length: 30 }, (_, i) => 7000 + i);

// ---------------------------------------------------------------------------
// 1. 43 × 41 × 39: поля проб смешанного блока
// ---------------------------------------------------------------------------

describe('43 × 41 × 39: поля проб смешанного блока формы и цвета', () => {
  const runs = SEEDS.map((seed) => runSession(masteredChild(1, 1), allCorrect, seed));
  const apart = (id: string) => TARGETS.find((t) => t.id === id)!.notTogether ?? [];
  const teachingCards = (id: string) => new Set(TARGETS.find((t) => t.id === id)!.exemplars.filter((e) => e.role === 'teaching').flatMap((e) => e.cards ?? []));

  it('предусловие: на каждом зерне в плане смешанный блок формы и цвета, 10 проб verification', () => {
    expect(mixGroups(TARGETS).map((g) => g.map((t) => t.id))).toEqual([[SHAPE, COLOR]]);
    expect(runs.map((r) => [r.planned.mixedTargetIds, mixedTrials(r).length])).toEqual(runs.map(() => [[SHAPE, COLOR], 10]));
  });

  it('поле каждой пробы блока — 3 разные карточки, образец в поле', () => {
    const bad = runs.flatMap((r) => mixedTrials(r).filter((t) => t.field?.length !== 3 || new Set(t.field).size !== 3 || !t.field.includes(t.sampleCardId!)));
    expect(bad).toEqual([]);
  });

  it('соседи — только обучающие карточки своей цели: ни карточек переноса, ни карточек партнёра', () => {
    const bad = runs.flatMap((r) => mixedTrials(r).filter((t) => !t.field!.every((c) => teachingCards(t.targetId).has(c))));
    expect(bad).toEqual([]);
  });

  it('пары «не вместе» в одном поле блока не встречаются', () => {
    const bad = runs.flatMap((r) => mixedTrials(r).filter((t) => apart(t.targetId).some(([a, b]) => t.field!.includes(a) && t.field!.includes(b))));
    expect(bad).toEqual([]);
  });

  it('у цели один и тот же набор поля не дважды подряд (в истории цели за занятие, включая разогрев)', () => {
    const bad = runs.flatMap((r) =>
      [SHAPE, COLOR].flatMap((id) => {
        const own = r.trials.filter((t) => t.targetId === id && t.field);
        return own.slice(1).filter((t, i) => [...t.field!].sort().join() === [...own[i].field!].sort().join()).map((t) => `${r.final.seed}:${t.id}`);
      }),
    );
    expect(bad).toEqual([]);
  });

  it('место верной у цели — не три раза подряд на одном месте (по истории цели)', () => {
    const bad = runs.flatMap((r) =>
      [SHAPE, COLOR].flatMap((id) => {
        const pos = r.trials.filter((t) => t.targetId === id && t.field).map((t) => t.field!.indexOf(t.sampleCardId!));
        return pos.slice(2).filter((p, i) => p === pos[i] && p === pos[i + 1]).length ? [`${id}:${pos.join('')}`] : [];
      }),
    );
    expect(bad).toEqual([]);
  });

  // Закреплено как есть, вопрос методисту: ряд мест верной ведётся по цели (`withMatchField`, abaSession.ts:1034), а на
  // экране блок идёт вперемешку — ребёнок видит общий ряд из 10 проб. Здесь фиксируется, насколько длинной бывает
  // серия «верная на одном месте» на экране; правила 39 для поля 3 нет, поэтому только потолок наблюдения.
  it('на экране (вперемешку) серия верной на одном месте — не длиннее 3 подряд на 30 зёрнах (наблюдённый максимум 2026-11-18)', () => {
    const longest = runs.map((r) => {
      const pos = mixedTrials(r).map((t) => t.field!.indexOf(t.sampleCardId!));
      let best = 0;
      let run = 0;
      pos.forEach((p, i) => {
        run = i > 0 && pos[i - 1] === p ? run + 1 : 1;
        best = Math.max(best, run);
      });
      return best;
    });
    expect(Math.max(...longest)).toBeLessThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// 2. 43 × 2 × 16: жетон за участие в конце смешанного блока и обмен перед перерывом
// ---------------------------------------------------------------------------

describe('43 × 2 × 16: конец смешанного блока, полная доска, перерыв по плану', () => {
  // сессия 3, поддержание 1: «одинаковые» из 2 и 3 — на поддержании, за смешанным блоком — перерыв и пробы поддержания
  const withBreak = (earned: number, seed: number) => runSession(masteredChild(3, 1, 5, { earned, nonContingent: 0 }), allCorrect, seed);

  it('предусловие: смешанный блок, конец блока с участием, за ним перерыв по плану', () => {
    const r = withBreak(0, 11);
    const p = plan(r.planned);
    const end = p.indexOf(`END:${MIXED_END}:true`);
    expect(end).toBeGreaterThan(0);
    expect(p[end + 1]).toBe('break');
    expect(r.planned.board.size).toBe(3);
  });

  const runsAll = [0, 1, 2].flatMap((earned) => SEEDS.slice(0, 10).map((seed) => ({ earned, seed, r: withBreak(earned, seed) })));

  it('на любой доске входа: событий обмена = exchangesMade, доступов = обменов', () => {
    const bad = runsAll.filter(({ r }) => {
      const ex = eventsOf(r, 'exchange').length;
      const access = r.snaps.filter((s) => s.step.kind === 'access').length;
      return ex !== r.result.session.exchangesMade || access !== ex;
    });
    expect(bad.map(({ earned, seed }) => [earned, seed])).toEqual([]);
  });

  it('перерыв сразу за доступом — без второго обмена: canExchange false, finishBreak ничего не меняет', () => {
    const afterAccess = runsAll.flatMap(({ r }) => r.snaps.filter((s, i) => s.step.kind === 'break' && r.snaps[i - 1]?.step.kind === 'access'));
    // не пустая проверка: хотя бы один прогон дошёл до «доступ, затем перерыв по плану»
    expect(afterAccess.length).toBeGreaterThan(0);
    expect(afterAccess.map((s) => [(s.step as Extract<AbaStep, { kind: 'break' }>).canExchange, s.finishBreakExchanged])).toEqual(afterAccess.map(() => [false, 0]));
  });

  it('ни один перерыв по плану не обменивает (finishBreak — запасной путь, в штатном прогоне не срабатывает)', () => {
    const exchangedOnBreak = runsAll.flatMap(({ r }) => r.snaps.filter((s) => (s.finishBreakExchanged ?? 0) > 0));
    expect(exchangedOnBreak).toEqual([]);
  });

  it('участие за смешанный блок — не больше одного события на блок, на id блока (не на цели-участнике)', () => {
    const bad = runsAll.filter(({ r }) => {
      const p = eventsOf(r, 'participation').map((e) => (e as { targetId: string }).targetId);
      return p.filter((id) => id === MIXED_END).length > 1 || p.some((id) => id === SHAPE || id === COLOR);
    });
    expect(bad.map(({ earned, seed }) => [earned, seed])).toEqual([]);
  });

  it('зерно 7000: жетон за участие в конце блока заполняет доску — один обмен и доступ до перерыва, перерыв без обмена', () => {
    const r = withBreak(0, 7000);
    const journal = r.result.session.events.filter((e) => ['participation', 'exchange', 'access', 'break'].includes(e.kind));
    expect(journal.map((e) => (e.kind === 'participation' ? `participation:${(e as { targetId: string }).targetId}` : e.kind))).toEqual([
      `participation:${MIXED_END}`,
      'exchange',
      'access',
      'break',
    ]);
    expect(journal[3]).toMatchObject({ kind: 'break', initiatedBy: 'schedule' });
    expect(r.result.session.exchangesMade).toBe(1);
    // участие выдала последняя проба блока; следующий шаг — доступ, затем перерыв по плану без обмена
    const i = r.snaps.findIndex((x) => x.participation);
    expect(r.snaps.slice(i + 1, i + 3).map((x) => x.step.kind)).toEqual(['access', 'break']);
    expect(r.snaps[i + 2]).toMatchObject({ step: { canExchange: false }, finishBreakExchanged: 0 });
  });

  // Закреплено как есть 2026-11-18, вопрос методисту (решение 2 × 43). Пробы смешанного блока `verification` платят
  // жетоны за верные по расписанию (как проверка `home_unverified`), а конец блока — участие по пределу size − 1:
  // `isMeasuringBlock` (abaSession.ts:1965) знает только `baselineTargetIds`, id конца — `mixed:…`. Итог на доске 1
  // (ступени 1–2, обмен сразу): жетона за участие в конце блока нет, зато обмены и доступ идут посреди блока проверки.
  it('доска 1: участия в конце блока нет, обмены — посреди блока за верные пробы (как есть)', () => {
    const r = runSession(masteredChild(1, 1, 1), allCorrect, 21);
    expect(r.planned.mixedTargetIds).toEqual([SHAPE, COLOR]);
    expect(r.planned.board.size).toBe(1);
    expect(eventsOf(r, 'participation')).toEqual([]);
    const k = kinds(r);
    const firstAccess = k.indexOf('access');
    expect(firstAccess).toBeGreaterThan(-1);
    // доступ между пробами блока: после него ещё пробы verification
    expect(r.snaps.slice(firstAccess).some((s) => s.step.kind === 'trial' && (s.step as TrialStep).trialKind === 'verification')).toBe(true);
  });

  // Закреплено как есть, вопрос методисту: смешанный блок, кончившийся ошибкой, — не «блок измерения» решения 2
  // (`lastBlockTrialFailed`, abaSession.ts:1969, ищет только `baseline`): долга участия нет; вместо него общее правило
  // `bridgeFailedBlock` (abaSession.ts:2263) — закрывающая проба перед концом блока (без освоенных вне блока — полная
  // модель того же экземпляра).
  it('блок, кончившийся ошибкой: закрывающая перед концом блока на той же цели и экземпляре, долга нет (как есть)', () => {
    const child = () => masteredChild(3, 1, 5, { earned: 0, nonContingent: 0 });
    const errorLast = (seed: number) => {
      const probe = mixedTrials(runSession(child(), allCorrect, seed));
      const last = probe[probe.length - 1];
      const n = probe.filter((t) => t.targetId === last.targetId).length - 1;
      return runSession(child(), (s, i) => (s.trialKind === 'verification' && s.targetId === last.targetId && i === n ? 'incorrect' : 'correct'), seed);
    };
    const runs = SEEDS.slice(0, 10).map(errorLast);
    const shape = runs.map((r) => {
      const v = mixedTrials(r);
      const last = v[v.length - 1];
      const next = r.trials[r.trials.indexOf(last) + 1];
      return [last.response, next?.kind, next?.targetId === last.targetId && next?.exemplarId === last.exemplarId, r.final.participationOwed];
    });
    expect(shape).toEqual(runs.map(() => ['incorrect', 'closing', true, null]));
  });
});

// ---------------------------------------------------------------------------
// 3. 34 × 43 × 16: расписание ребёнку через всё занятие
// ---------------------------------------------------------------------------

/** Расписание на шагах, где его видит ребёнок: между блоками (проба) и на перерыве. */
const shown = (r: Run) => r.snaps.filter((s) => s.step.kind === 'trial' || s.step.kind === 'break');

function scheduleProblems(r: Run): string[] {
  const out: string[] = [];
  const left = shown(r).map((s) => s.schedule.blocksLeft);
  left.forEach((n, i) => {
    if (i > 0 && n > left[i - 1]) out.push(`рост ${left[i - 1]}→${n} на шаге ${i}`);
  });
  for (const s of r.snaps) {
    if (s.schedule.isLast !== (s.schedule.blocksLeft === 1)) out.push(`isLast ${s.schedule.isLast} при ${s.schedule.blocksLeft}`);
    if (s.schedule.blocksLeft === 0 && s.trialsLeft > 0) out.push(`0 блоков, а проб ${s.trialsLeft}`);
    if (s.step.kind === 'trial' && s.schedule.blocksLeft === 0) out.push('проба при 0 блоков');
  }
  return out;
}

describe('34 × 43 × 16: расписание ребёнку через всё занятие', () => {
  it('смешанный блок + перерыв + поддержание + обмены: блоков впереди не растёт, isLast ⇔ 1, проба — не при 0', () => {
    const runs = [0, 1, 2].flatMap((earned) => SEEDS.slice(0, 10).map((seed) => runSession(masteredChild(3, 1, 5, { earned, nonContingent: 0 }), allCorrect, seed)));
    // предусловие: прогоны с доступом в середине занятия есть
    expect(runs.some((r) => kinds(r).indexOf('access') >= 0 && kinds(r).lastIndexOf('trial') > kinds(r).indexOf('access'))).toBe(true);
    expect(runs.flatMap(scheduleProblems)).toEqual([]);
  });

  it('план смешанного занятия: на первой пробе блока расписание — 2 блока (смешанный и поддержание за перерывом)', () => {
    const r = runSession(masteredChild(3, 1, 5), allCorrect, 11);
    const firstMixed = r.snaps.find((s) => s.step.kind === 'trial' && (s.step as TrialStep).trialKind === 'verification')!;
    expect(firstMixed.schedule).toMatchObject({ blocksLeft: 2, isLast: false });
  });

  it('проверка сверху вниз с ошибкой и закрывающей пробой: расписание не растёт и не врёт «последнее»', () => {
    const r = runSession(freshChild(), (s, n) => (s.trialKind === 'baseline' && n === 1 ? 'incorrect' : 'correct'), 41);
    expect(r.trials.some((t) => t.kind === 'closing')).toBe(true);
    expect(scheduleProblems(r)).toEqual([]);
  });

  it('путь со свежего ребёнка (4 занятия): расписание без противоречий на каждом', () => {
    let c = freshChild();
    const problems: string[] = [];
    for (let i = 0; i < 4; i += 1) {
      const r = runSession(c, allCorrect, 1000 + i, `2026-11-${16 + i}`);
      problems.push(...scheduleProblems(r).map((p) => `занятие ${i}: ${p}`));
      c = r.child;
    }
    expect(problems).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 4. 40 × проверка сверху вниз × 43: путь свежего ребёнка
// ---------------------------------------------------------------------------

describe('40 × проверка сверху вниз × 43: свежий ребёнок, всё верно', () => {
  const days = ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20'];
  const path: Run[] = [];
  let c = freshChild();
  for (const d of days) {
    const r = runSession({ ...c, day: d }, allCorrect, 1000 + c.index);
    path.push(r);
    c = r.child;
  }
  const [s1, s2, s3, s4, s5] = path;

  it('занятие 1: проверка сверху вниз кончается на форме — вершине лестницы; цвета в проверке нет', () => {
    expect(s1.planned.placementTargetIds).toEqual([SHAPE]);
    expect(s1.trials.some((t) => t.targetId === COLOR)).toBe(false);
  });

  it('после занятия 1: форма освоена, «одинаковые» выведены, цвет не тронут', () => {
    expect(['mastered', 'maintenance']).toContain(s1.child.states[SHAPE].phase);
    expect(s1.child.states['match-same-3'].masteredBy).toBe('inferred');
    expect(s1.child.states['match-same-2'].masteredBy).toBe('inferred');
    expect(s1.child.states[COLOR].phase).toBe('baseline');
  });

  it('после занятия 1: форма освоена проверкой сверху вниз с отметкой baseline (не inferred) — годна в смешанный блок', () => {
    expect(s1.child.states[SHAPE].masteredBy).toBe('baseline');
  });

  it('занятие 2: цвет из трёх — базовой линией, не проверкой и не выводом', () => {
    expect(s2.planned.placementTargetIds).toEqual([]);
    expect(s2.planned.baselineTargetIds).toEqual([COLOR]);
    expect(s2.child.states[COLOR].masteredBy).toBe('baseline');
  });

  it('все четыре цели — «освоено» после занятия 2', () => {
    expect(TARGETS.map((t) => s2.child.states[t.id].phase).every((p) => p === 'mastered' || p === 'maintenance')).toBe(true);
  });

  it('занятие 3: смешанный блок формы и цвета (обе освоены по отдельности — форма проверкой, цвет базовой линией)', () => {
    expect(s3.planned.mixedTargetIds).toEqual([SHAPE, COLOR]);
    expect(mixedTrials(s3)).toHaveLength(10);
    // настоящий ребёнок доходит до смешанного блока ещё на доске 1 — см. «доска 1: участия … нет» выше (вопрос методисту)
    expect(s3.planned.board.size).toBe(1);
    expect(s3.child.states[SHAPE].mixedCheck).toEqual({ days: [days[2]] });
  });

  it('занятие 4 в другой день — второй зачёт, освоено окончательно; занятие 5 — смешанного блока больше нет', () => {
    expect(s4.planned.mixedTargetIds).toEqual([SHAPE, COLOR]);
    expect(s4.child.states[SHAPE].mixedCheck).toEqual({ days: [days[2], days[3]], done: true });
    expect(s4.child.states[COLOR].mixedCheck).toEqual({ days: [days[2], days[3]], done: true });
    expect(s5.planned.mixedTargetIds).toBeUndefined();
    expect(s5.trials.length).toBeGreaterThan(0);
  });

  it('повтор в тот же день после первого зачёта смешанного блока не ставит (зачёт того же дня не считается)', () => {
    const sameDay = runSession({ ...s3.child, day: days[2] }, allCorrect, 4242);
    expect(s3.child.states[SHAPE].mixedCheck?.done).toBeUndefined();
    expect(sameDay.planned.mixedTargetIds).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 5. 14 × пул: «Награда от взрослого»
// ---------------------------------------------------------------------------

describe('14 × пул: «Награда от взрослого» (from_adult)', () => {
  const ADULT = 'from_adult';
  const ms = EXCHANGE_ACCESS_MS[3];
  const apart = apartPairs(REINFORCERS);

  it('пул «Со взрослым»: только при включённой настройке; без настройки и по умолчанию — нет', () => {
    expect(poolFor(TARGETS, { config: 'with_adult', soundOn: true, adultReward: true }, ms)).toContain(ADULT);
    expect(poolFor(TARGETS, { config: 'with_adult', soundOn: true, adultReward: false }, ms)).not.toContain(ADULT);
    expect(poolFor(TARGETS, { config: 'with_adult', soundOn: true }, ms)).not.toContain(ADULT);
  });

  it('«Сам» — никогда, даже с настройкой', () => {
    expect(poolFor(TARGETS, { config: 'alone', soundOn: true, adultReward: true }, ms)).not.toContain(ADULT);
  });

  it('сопряжение — никогда: его пул собирается без настройки (как loadPairingStart)', () => {
    expect(poolFor(readyAbaTargets(ABA_TARGETS, DEV_PLACEHOLDER_ART), { config: 'with_adult', soundOn: true }, EXCHANGE_ACCESS_MS[1])).not.toContain(ADULT);
  });

  it('в тройке выбора — не больше одного раза на 200 зёрнах; бывает', () => {
    const pool = poolFor(TARGETS, { config: 'with_adult', soundOn: true, adultReward: true }, ms);
    const threes = Array.from({ length: 200 }, (_, s) => reinforcerChoices(pool, [], seeded(s).rng, apart));
    expect(threes.filter((t) => t.filter((x) => x === ADULT).length > 1)).toEqual([]);
    expect(threes.some((t) => t.includes(ADULT))).toBe(true);
  });

  it('возобновление передаёт настройку: resumePoolFor с ней — есть, без неё — нет', () => {
    const st = runSession(masteredChild(1, 1), allCorrect, 5).planned;
    expect(resumePoolFor(st, true, undefined, true)).toContain(ADULT);
    expect(resumePoolFor(st, true, undefined, false)).not.toContain(ADULT);
    expect(resumePoolFor(st, true)).not.toContain(ADULT);
  });

  it('занятие с выбором from_adult идёт до конца: обмен, доступ, без ошибок', () => {
    const pool = poolFor(TARGETS, { config: 'with_adult', soundOn: true, adultReward: true }, ms);
    const seed = Array.from({ length: 200 }, (_, s) => s).find((s) => startAbaSession({ ...inputOf(masteredChild(3, 1, 5, { earned: 2, nonContingent: 0 }), s), reinforcerPool: pool }).reinforcerOptions.includes(ADULT))!;
    expect(seed).toBeDefined();
    let now = T0;
    let st = startAbaSession({ ...inputOf(masteredChild(3, 1, 5, { earned: 2, nonContingent: 0 }), seed), reinforcerPool: pool });
    let accessSeen = 0;
    for (let guard = 0; guard < 400; guard += 1) {
      const { state, step } = nextStep(st, now);
      st = state;
      if (step.kind === 'end') break;
      if (step.kind === 'choose_reinforcer') st = chooseReinforcer(st, step.options.includes(ADULT) ? ADULT : step.options[0], now, 'adult');
      else if (step.kind === 'break') st = finishBreak(st, (now += 60_000)).state;
      else if (step.kind === 'access') {
        accessSeen += 1;
        st = finishAccess(accessShown(st), (now += step.durationMs));
      } else if (step.kind === 'trial') {
        const run = startMatchTrial({ step, target: st.targets[step.targetId], config: 'with_adult', seed: st.seed, trialId: `a${guard}`, sessionId: st.sessionId, index: st.trials.length, shownAt: now });
        const done = runTrial(run, 'correct', now);
        now = done.at + 5200;
        const res = recordTrial(st, matchTrialInput(done.r), now);
        if (!res.ok) throw new Error(res.errors.join('; '));
        st = res.state;
      }
    }
    expect(st.reinforcerId).toBe(ADULT);
    expect(accessSeen).toBeGreaterThan(0);
  });
});
