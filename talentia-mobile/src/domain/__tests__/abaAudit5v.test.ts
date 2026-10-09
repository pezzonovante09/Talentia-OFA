/**
 * Правки ABA по аудиту 2026-10-06 (AUDIT.md, А9, А21, А26; решение №67) — по спецификации
 * `aba-pedagogy-specialist` 2026-10-09.
 */
import type { AbaTarget, AbaTargetState, AbaTrial } from '../../types/aba';
import { choiceBiasIn } from '../abaBarriers';
import { chainRuns, markMastered } from '../abaCriterion';
import { computeIoa } from '../abaIoa';
import {
  aloneFormatKey,
  applyPlacementProbe,
  formatUnlockedAlone,
  ladderBelow,
  placementPassed,
} from '../abaPlacement';
import { initialTargetState } from '../abaPrompting';
import { isConcerning, probesOf, verificationVerdict } from '../abaSession';
import { programErrors } from '../abaTargetRules';
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
