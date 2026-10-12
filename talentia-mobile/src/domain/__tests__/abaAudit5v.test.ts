/**
 * Правки ABA по аудиту 2026-10-06 (AUDIT.md, А9, А21, А26; решение №67) — по спецификации
 * `aba-pedagogy-specialist` 2026-10-09.
 */
import type { AbaTarget, AbaTargetState, AbaTrial, RoutineSetting } from '../../types/aba';
import { choiceBiasIn } from '../abaBarriers';
import {
  applyMaintenanceProbe,
  applyRoutineBaseline,
  applyRoutineRun,
  chainRuns,
  isRoutineMaintenanceDue,
  markMastered,
  routineRunRecord,
  summarizeSession,
} from '../abaCriterion';
import { computeIoa } from '../abaIoa';
import {
  aloneFormatKey,
  applyPlacementProbe,
  formatUnlockedAlone,
  ladderBelow,
  placementCandidates,
  placementPassed,
} from '../abaPlacement';
import { initialTargetState } from '../abaPrompting';
import { isConcerning, probesOf, verificationVerdict } from '../abaSession';
import { programErrors, targetErrors } from '../abaTargetRules';
import { GRID_FOR, target, trial } from './abaFixtures';

const t = (id: string, over: Partial<AbaTarget> = {}): AbaTarget => ({ ...target, id, band: '7', ...GRID_FOR.imitate_sound, ...over });
const fresh = (ts: AbaTarget[]) => Object.fromEntries(ts.map((x) => [x.id, initialTargetState(x)])) as Record<string, AbaTargetState>;
const ok = (id: string, n: number, over: Partial<AbaTrial> = {}) =>
  Array.from({ length: n }, () => trial({ targetId: id, kind: 'baseline', response: 'independent', ...over }));
const interrupted = (over: Partial<AbaTrial>) =>
  trial({ response: 'interrupted', latencyMs: null, latencyFromFirstSdMs: null, latencySource: null, ...over });

const steps = [
  { id: 's1', order: 1, sdKey: 'a', criterionKey: 'b', modelKey: 'c' },
  { id: 's2', order: 2, sdKey: 'a', criterionKey: 'b', modelKey: 'c' },
  { id: 's3', order: 3, sdKey: 'a', criterionKey: 'b', modelKey: 'c' },
];
const chain = t('CH', { ...GRID_FOR.do_action, format: 'do_action', steps });

describe('А9: выводится только «включает»', () => {
  const A = t('A');
  const B = t('B', { prerequisiteTargetIds: ['A'] });

  it('связь только порядком открытия — пройденная вершина нижнюю не выводит', () => {
    const out = applyPlacementProbe(fresh([A, B]), [A, B], B, ok('B', 3), 4, 'with_adult');
    expect(out.B.masteredBy).toBe('baseline');
    expect(out.A.phase).toBe('baseline');
    expect(ladderBelow(B, [A, B])).toEqual([]);
  });

  it('«включает» транзитивно: A включает B, B включает C — C тоже выведена', () => {
    const C1 = t('C1');
    const B1 = t('B1', { prerequisiteTargetIds: ['C1'], includesTargetIds: ['C1'] });
    const A1 = t('A1', { prerequisiteTargetIds: ['B1'], includesTargetIds: ['B1'] });
    const out = applyPlacementProbe(fresh([C1, B1, A1]), [C1, B1, A1], A1, ok('A1', 3), 4, 'with_adult');
    expect([out.B1.masteredBy, out.C1.masteredBy]).toEqual(['inferred', 'inferred']);
  });

  describe('правила программы для «включает»', () => {
    const M = (id: string, over: Partial<AbaTarget> = {}) =>
      t(id, { ...GRID_FOR.match, format: 'match', scoredBy: 'device_tap', ...over });

    it('нижняя не среди предпосылок — ошибка', () => {
      const X = t('X');
      const Y = t('Y', { includesTargetIds: ['X'] });
      expect(programErrors([X, Y]).join()).toMatch(/нет среди предпосылок/);
    });

    it('между образцом и сортировкой — ошибка; сортировка ничего не включает', () => {
      const S = M('S');
      const R = M('R', { matchMode: 'sort', prerequisiteTargetIds: ['S'], includesTargetIds: ['S'] });
      const errors = programErrors([S, R]).join();
      expect(errors).toMatch(/вида сопоставления/);
      expect(errors).toMatch(/сортировка ничего не включает/);
    });

    it('у match нижняя с полем больше — ошибка; поле меньше — можно', () => {
      const Big = M('Big', { fieldSize: 4 });
      const Small = M('Small', { fieldSize: 3, prerequisiteTargetIds: ['Big'], includesTargetIds: ['Big'] });
      expect(programErrors([Big, Small]).join()).toMatch(/поле/);
      const Two = M('Two', { fieldSize: 2 });
      const Three = M('Three', { fieldSize: 3, prerequisiteTargetIds: ['Two'], includesTargetIds: ['Two'] });
      expect(programErrors([Two, Three])).toEqual([]);
    });
  });
});

describe('А21: проверка сверху вниз', () => {
  it('засчитанное детектором начала звука — не «освоено»', () => {
    const X = t('X', { scoredBy: 'device_onset' });
    expect(placementPassed(X, ok('X', 3, { scoredBy: 'device_onset' }))).toBeNull();
  });

  it('у цепочки решают полные прогоны: куски неполных прогонов — не прогон', () => {
    const b = (stepId: string, runIndex: number) =>
      trial({ targetId: 'CH', kind: 'baseline', response: 'independent', stepId, runIndex });
    // по две пробы на звено, но ни один прогон не полон
    const pieces = [b('s1', 0), b('s2', 0), b('s1', 1), b('s3', 1), b('s2', 2), b('s3', 2)];
    expect(placementPassed(chain, pieces)).toBeNull();
    const whole = [0, 1].flatMap((r) => steps.map((st) => b(st.id, r)));
    expect(placementPassed(chain, whole)).toBe(true);
  });
});

describe('А21: прогоны цепочки только по runIndex', () => {
  const teach = (stepId: string, runIndex: number | undefined, over: Partial<AbaTrial> = {}) =>
    trial({ targetId: 'CH', kind: 'teaching', response: 'independent', stepId, ...(runIndex === undefined ? {} : { runIndex }), ...over });

  it('прерванное звено в первом прогоне, второй полный — засчитан один прогон', () => {
    const run1 = [teach('s1', 0), interrupted({ targetId: 'CH', kind: 'teaching', stepId: 's2', runIndex: 0, interruptedBy: 'app' }), teach('s3', 0)];
    const run2 = steps.map((st) => teach(st.id, 1));
    expect(chainRuns(chain, [...run1, ...run2])).toHaveLength(1);
  });

  it('проба звена без runIndex в прогоны не идёт', () => {
    expect(chainRuns(chain, steps.map((st) => teach(st.id, undefined)))).toEqual([]);
  });
});

describe('№67: сортировка — отдельный формат для допуска в «сам»', () => {
  const sample = t('MS', { ...GRID_FOR.match, format: 'match', scoredBy: 'device_tap', matchMode: 'sample' });
  const sort = t('MO', { ...GRID_FOR.match, format: 'match', scoredBy: 'device_tap', matchMode: 'sort' });
  const masteredWithAdult = (x: AbaTarget): AbaTargetState => markMastered(initialTargetState(x), 3, 'criterion', 'with_adult');

  it('ключи формата', () => {
    expect([aloneFormatKey(sample), aloneFormatKey(sort), aloneFormatKey(target)]).toEqual(['match', 'sort', 'imitate_sound']);
  });

  it('освоенный match по образцу открывает match, но не сортировку', () => {
    const states = { MS: masteredWithAdult(sample) };
    expect(formatUnlockedAlone('match', [sample, sort], states)).toBe(true);
    expect(formatUnlockedAlone('sort', [sample, sort], states)).toBe(false);
  });

  it('освоенная сортировка открывает сортировку, но не match', () => {
    const states = { MO: masteredWithAdult(sort) };
    expect(formatUnlockedAlone('sort', [sample, sort], states)).toBe(true);
    expect(formatUnlockedAlone('match', [sample, sort], states)).toBe(false);
  });
});

describe('А21: предпочтение карточки — по пробам, где она была на поле', () => {
  const pick = (chosen: string, field: string[]) =>
    trial({ response: 'independent', promptLevelUsed: 0, startPromptLevel: 0, field, chosenCardId: chosen });
  const rot = (cards: string[], k: number) => [...cards.slice(k % 3), ...cards.slice(0, k % 3)];

  it('карточка на поле в 20 из 40 проб и выбрана все 20 — флаг', () => {
    const withA = Array.from({ length: 20 }, (_, i) => pick('a', rot(['a', 'b', 'c'], i)));
    const without = Array.from({ length: 20 }, (_, i) => {
      const field = rot(['d', 'e', 'f'], i);
      return pick(field[(i + 1) % 3], field);
    });
    expect(choiceBiasIn([{ index: 1, trials: [...withA, ...without] }], 'identify')).toContain('card_preference');
  });

  it('ребёнок всегда верен, поле 3 — доля каждой около трети, флага нет', () => {
    const trials = Array.from({ length: 30 }, (_, i) => {
      const field = rot(['a', 'b', 'c'], Math.floor(i / 3));
      return pick(field[i % 3], field);
    });
    expect(choiceBiasIn([{ index: 1, trials }], 'identify')).toEqual([]);
  });
});

describe('А26: технические прерывания не тревожат', () => {
  const by = (interruptedBy: AbaTrial['interruptedBy']) => interrupted({ interruptedBy });

  it('все прерывания — взрослым или приложением: сессия не тревожная', () => {
    expect(isConcerning([by('adult'), by('app'), by('adult'), by('app')])).toBe(false);
  });

  it('тревожность не зависит от технических рядом: решает сопротивление или отказ', () => {
    expect(isConcerning([by('adult'), by('app'), by('l4_resisted')])).toBe(true);
    expect(isConcerning([by('adult'), by('app'), by('assent')])).toBe(false);
    expect(isConcerning([by('adult'), by('assent'), by('child_break')])).toBe(true);
  });
});

describe('А26: IOA без технических прерываний', () => {
  it('10 проб, 2 прерваны взрослым и приложением — сравниваются 8: 7/8 = 87,5%', () => {
    const ts = [
      ...Array.from({ length: 8 }, (_, i) => trial({ id: `u${i}` })),
      interrupted({ id: 'app', interruptedBy: 'app' }),
      interrupted({ id: 'adult', interruptedBy: 'adult' }),
    ];
    const items = ts.slice(0, 8).map((x, i) => ({
      trialId: x.id,
      response: i === 7 ? ('incorrect' as const) : x.response,
      emittedBeforePrompt: x.emittedBeforePrompt,
    }));
    const r = computeIoa(ts, items);
    if (!r.ok) throw new Error(r.errors.join('; '));
    expect(r.byTarget[target.id]).toMatchObject({ units: 8, agreements: 7, percent: 87.5 });
  });
});

describe('А26: проверочный прогон цепочки', () => {
  const home: AbaTargetState = { ...markMastered(initialTargetState(chain), 3, 'criterion', 'with_adult'), masteredBy: 'home_unverified' };
  const v = (stepId: string, over: Partial<AbaTrial> = {}) =>
    trial({ targetId: 'CH', kind: 'verification', response: 'independent', stepId, runIndex: 0, ...over });

  it('взрослый доделал звено — звено проваленное, остальные нет', () => {
    const own = [v('s1'), v('s2', { response: 'no_response', adultCompleted: true, latencyMs: null }), v('s3')];
    const r = verificationVerdict(home, chain, own, 10);
    expect(r?.state.chainVerificationRuns?.at(-1)?.failedStepIds).toEqual(['s2']);
  });

  it('звено прервано взрослым — прогон неполный, решения нет', () => {
    const own = [v('s1'), interrupted({ targetId: 'CH', kind: 'verification', stepId: 's2', runIndex: 0, interruptedBy: 'adult' }), v('s3')];
    expect(verificationVerdict(home, chain, own, 10)).toBeNull();
  });

  it('все звенья сами — проваленных нет', () => {
    const r = verificationVerdict(home, chain, steps.map((st) => v(st.id)), 10);
    expect(r?.state.chainVerificationRuns?.at(-1)?.failedStepIds).toEqual([]);
  });
});

describe('прерванная проба поддержания и переноса — не проба (методист, 2026-10-09)', () => {
  const m = (stepId: string | undefined, over: Partial<AbaTrial> = {}) =>
    trial({ targetId: 'CH', kind: 'maintenance', response: 'independent', ...(stepId ? { stepId, runIndex: 0 } : {}), ...over });
  const cut = (stepId: string | undefined, by: AbaTrial['interruptedBy']) =>
    interrupted({ targetId: 'CH', kind: 'maintenance', ...(stepId ? { stepId, runIndex: 0 } : {}), interruptedBy: by });

  it('звено прервано приложением и повторено самостоятельно — прогон пройден', () => {
    const probes = probesOf(chain, [m('s1'), cut('s2', 'app'), m('s2'), m('s3')], 'maintenance');
    expect(probes.map((x) => x.response)).toEqual(['independent']);
  });

  it('звено прервано и не повторено — пробы нет', () => {
    expect(probesOf(chain, [m('s1'), cut('s2', 'adult'), m('s3')], 'maintenance')).toEqual([]);
  });

  it('дискретная проба, прерванная взрослым, — не проба поддержания', () => {
    const single = t('ONE');
    expect(probesOf(single, [{ ...cut(undefined, 'adult'), targetId: 'ONE' }], 'maintenance')).toEqual([]);
  });
});

describe('проверка цепочки: второй прогон решает', () => {
  const home: AbaTargetState = { ...markMastered(initialTargetState(chain), 3, 'criterion', 'with_adult'), masteredBy: 'home_unverified' };
  const run = (idx: number) => [
    trial({ targetId: 'CH', kind: 'verification', response: 'independent', stepId: 's1', runIndex: 0 }),
    trial({ targetId: 'CH', kind: 'verification', response: 'no_response', adultCompleted: true, latencyMs: null, stepId: 's2', runIndex: 0 }),
    trial({ targetId: 'CH', kind: 'verification', response: 'independent', stepId: 's3', runIndex: 0, sessionId: `s-${idx}` }),
  ];

  it('оба раза взрослый доделал s2 — провал, s2 с уровня ответа, s1 и s3 с L0', () => {
    const first = verificationVerdict(home, chain, run(10), 10)!;
    const second = verificationVerdict(first.state, chain, run(11), 11)!;
    expect(second.reason).toBe('verification_failed');
    const sp = second.state.stepPrompts!;
    expect([sp.s1.startPromptLevel, sp.s3.startPromptLevel]).toEqual([0, 0]);
    expect(sp.s2.startPromptLevel).toBeGreaterThan(0);
  });
});

describe('А8: рутины самообслуживания (№74, №75)', () => {
  const R = t('R', {
    level: 'cross',
    area: 'self_care',
    format: 'do_action',
    sdKind: 'instruction',
    scoredBy: 'adult',
    chaining: 'total_task',
    steps: steps.map((s) => ({ ...s, image: `wash-${s.id}` })),
    exemplars: [target.exemplars[0]],
  });
  const runOf = (whole: boolean, kind: AbaTrial['kind'] = 'teaching', runIndex = 0) =>
    steps.map((st, i) =>
      trial({
        targetId: 'R',
        kind,
        stepId: st.id,
        runIndex,
        ...(whole || i !== 1 ? { response: 'independent' } : { response: 'no_response', adultCompleted: true, latencyMs: null }),
      }),
    );
  const acqR: AbaTargetState = { ...initialTargetState(R), phase: 'acquisition' };
  /** `settings[i]` — где прошёл i-й прогон; нет отметки — привычный контекст (перенос — Г4). */
  const feed = (days: string[], wholes: boolean[], settings: (RoutineSetting | undefined)[] = []) =>
    days.reduce(
      (s, day, i) =>
        applyRoutineRun(s, routineRunRecord(R, s, runOf(wholes[i]), day, settings[i] ? { setting: settings[i] } : {}), 10 + i, 'criterion', 'with_adult'),
      acqR,
    );

  it('правила: только цепочка total task, засчитывает взрослый; рутина не открывается рутиной', () => {
    expect(targetErrors({ ...R, scoredBy: 'device_tap' }).join()).toMatch(/только взрослый/);
    expect(targetErrors({ ...R, chaining: undefined }).join()).toMatch(/total task/);
    expect(targetErrors(R)).toEqual([]);
  });

  it('Р4: у звеньев рутины картинки, разные; один обучающий экземпляр; без вариантов SD', () => {
    const noImage = { ...R, steps: R.steps!.map((s, i) => (i === 1 ? { ...s, image: undefined } : s)) };
    expect(targetErrors(noImage).join()).toMatch(/у звена рутины нет картинки/);
    const dup = { ...R, steps: R.steps!.map((s) => ({ ...s, image: 'same' })) };
    expect(targetErrors(dup).join()).toMatch(/картинки звеньев рутины повторяются/);
    expect(targetErrors({ ...R, exemplars: target.exemplars }).join()).toMatch(/нужен ровно один/);
    expect(targetErrors({ ...R, sdVariantKeys: ['v'] }).join()).toMatch(/нет вариантов формулировки/);
    // обычная цепочка без картинок и не-рутина с 3–5 экземплярами — прежние правила
    expect(targetErrors(chain).join()).not.toMatch(/картинк/);
    expect(targetErrors({ ...chain, exemplars: [target.exemplars[0]] }).join()).toMatch(/экземпляров 1/);
    const R2 = { ...R, id: 'R2', prerequisiteTargetIds: ['R'] };
    expect(programErrors([R, R2]).join()).toMatch(/другой рутиной/);
  });

  it('4 из 5, три дня, последний сам, перенос есть — освоено', () => {
    const s = feed(['2026-10-01', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-03'], [true, false, true, true, true], [undefined, undefined, undefined, undefined, 'other_place']);
    expect([s.phase, s.masteredBy, s.lastMaintenanceDay]).toEqual(['mastered', 'criterion', '2026-10-03']);
  });

  it('5 из 5, но за два дня — не освоено; последний провален — не освоено; 3 из 5 — не освоено', () => {
    expect(feed(['2026-10-01', '2026-10-01', '2026-10-01', '2026-10-02', '2026-10-02'], [true, true, true, true, true]).phase).toBe('acquisition');
    expect(feed(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05'], [true, true, true, true, false]).phase).toBe('acquisition');
    expect(feed(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05'], [true, false, true, false, true]).phase).toBe('acquisition');
  });

  it('без подтверждения обученным наблюдателем — «получается дома»', () => {
    const days = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05'];
    const s = days.reduce(
      (x, day, i) => applyRoutineRun(x, routineRunRecord(R, x, runOf(true), day, i === 4 ? { setting: 'other_adult' } : {}), i, 'home_unverified', 'with_adult'),
      acqR,
    );
    expect(s.masteredBy).toBe('home_unverified');
  });

  it('рутина не проходит через сессию: итог сессии по ней — ошибка (Р3)', () => {
    expect(() => summarizeSession(R, runOf(true))).toThrow(/не проходит через сессию/);
  });

  it('прогон, прерванный приложением, — не прогон: окно не меняется', () => {
    const cutRun = [...runOf(true).slice(0, 1), interrupted({ targetId: 'R', kind: 'teaching', stepId: 's2', runIndex: 0, interruptedBy: 'app' }), ...runOf(true).slice(2)];
    expect(chainRuns(R, cutRun)).toEqual([]);
  });

  it('базовая линия: два прогона в один день — ещё базовая линия; в два дня — освоено', () => {
    const b0: AbaTargetState = initialTargetState(R);
    const sameDay = applyRoutineBaseline(applyRoutineBaseline(b0, runOf(true, 'baseline'), '2026-10-01', 1, R), runOf(true, 'baseline'), '2026-10-01', 2, R);
    expect(sameDay.phase).toBe('baseline');
    const twoDays = applyRoutineBaseline(
      applyRoutineBaseline(b0, runOf(true, 'baseline'), '2026-10-01', 1, R),
      runOf(true, 'baseline'),
      '2026-10-02',
      2,
      R,
      'with_adult',
      false,
      'other_place',
    );
    expect([twoDays.phase, twoDays.masteredBy, twoDays.routineBaseline]).toEqual(['mastered', 'baseline', undefined]);
  });

  it('базовая линия: звено сам в одном из двух прогонов — старт L1, в обоих — L0', () => {
    const b0: AbaTargetState = initialTargetState(R);
    const s = applyRoutineBaseline(applyRoutineBaseline(b0, runOf(true, 'baseline'), '2026-10-01', 1, R), runOf(false, 'baseline'), '2026-10-02', 2, R);
    expect(s.phase).toBe('acquisition');
    expect([s.stepPrompts?.s1.startPromptLevel, s.stepPrompts?.s2.startPromptLevel, s.stepPrompts?.s3.startPromptLevel]).toEqual([0, 1, 0]);
  });

  it('проверки сверху вниз у рутин нет', () => {
    const R2 = { ...R, id: 'R2', prerequisiteTargetIds: ['R'], includesTargetIds: undefined };
    expect(placementCandidates([R, R2], fresh([R, R2]))).toEqual([]);
  });

  it('после освоения окно обнуляется: в повторном обучении один прогон — ещё не освоено', () => {
    const s = feed(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05'], [true, true, true, true, true], [undefined, undefined, undefined, undefined, 'other_adult']);
    expect([s.phase, s.routineRuns]).toEqual(['mastered', []]);
    const fail = trial({ targetId: 'R', kind: 'maintenance', response: 'incorrect' });
    const back = applyMaintenanceProbe(applyMaintenanceProbe(s, fail, 20), fail, 21);
    expect(back.phase).toBe('acquisition');
    expect(applyRoutineRun(back, routineRunRecord(R, back, runOf(true), '2026-10-10'), 22, 'criterion', 'with_adult').phase).toBe('acquisition');
  });

  it('застряла: 10 прогонов за 5 дней, доля целых не растёт — флаг; растёт — нет', () => {
    const days = ['2026-10-01', '2026-10-01', '2026-10-02', '2026-10-02', '2026-10-03', '2026-10-03', '2026-10-04', '2026-10-04', '2026-10-05', '2026-10-05'];
    const flat = [true, true, false, false, false, true, true, false, false, false];
    expect(feed(days, flat).flags).toContain('no_progress');
    const growing = [true, false, false, false, false, true, true, true, false, false];
    expect(feed(days, growing).flags).not.toContain('no_progress');
  });

  it('перенос рутины — вне экрана: экземпляр переноса и пары не нужны, один обучающий экземпляр', () => {
    const bare = { ...R, exemplars: [target.exemplars[0]], sdVariantKeys: undefined };
    expect(targetErrors(bare)).toEqual([]);
  });

  it('прогон поддержания рутины, прерванный приложением, — не проба', () => {
    const maint = runOf(true, 'maintenance');
    const cut = [maint[0], interrupted({ targetId: 'R', kind: 'maintenance', stepId: 's2', runIndex: 0, interruptedBy: 'app' }), maint[2]];
    expect(probesOf(R, cut, 'maintenance')).toEqual([]);
  });

  it('поддержание — по дням: на следующий день после освоения рано, через два дня пора', () => {
    const s = { ...markMastered(acqR, 5, 'criterion', 'with_adult'), lastMaintenanceDay: '2026-10-03' };
    expect(isRoutineMaintenanceDue(s, '2026-10-04')).toBe(false);
    expect(isRoutineMaintenanceDue(s, '2026-10-05')).toBe(true);
  });
});
