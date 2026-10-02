import type { AbaTarget, AbaTargetState } from '../../types/aba';
import { applyBaseline, applyMaintenanceProbe, markMastered } from '../abaCriterion';
import {
  applyPlacementProbe,
  formatUnlockedAlone,
  isPlacementProbe,
  ladderBelow,
  placementCandidates,
  transitionOffer,
} from '../abaPlacement';
import { initialTargetState } from '../abaPrompting';
import { sessionParamsErrors } from '../abaSessionParams';
import { GRID_FOR, target, trial } from './abaFixtures';

/** Автоподбор, допуск формата в «сам», переход и параметры (ABA.md, «Спецификация первой версии»). */

const t = (id: string, over: Partial<AbaTarget> = {}): AbaTarget => ({ ...target, id, band: '7', ...GRID_FOR.imitate_sound, ...over });
// лестница эхоики: гласные → слоги → слова; LRFFC — другая область
const A = t('A');
const B = t('B', { prerequisiteTargetIds: ['A'] });
const C = t('C', { prerequisiteTargetIds: ['B'] });
const ladder = [A, B, C];
const fresh = (ts: AbaTarget[]) => Object.fromEntries(ts.map((x) => [x.id, initialTargetState(x)])) as Record<string, AbaTargetState>;
const ok = (id: string, n: number) => Array.from({ length: n }, () => trial({ targetId: id, kind: 'baseline', response: 'independent' }));

describe('проверка сверху вниз', () => {
  it('на свежей лестнице первой пробуется верхняя цель', () => {
    expect(placementCandidates(ladder, fresh(ladder)).map((x) => x.id)).toEqual(['C']);
    expect(isPlacementProbe(C, fresh(ladder))).toBe(true);
    expect(ladderBelow(C, ladder).map((x) => x.id).sort()).toEqual(['A', 'B']);
  });

  it('прошла — освоена по базовой линии, предпосылки по лестнице выведены', () => {
    const out = applyPlacementProbe(fresh(ladder), ladder, C, ok('C', 3), 4, 'with_adult');
    expect([out.C.phase, out.C.masteredBy, out.C.masteredConfig]).toEqual(['mastered', 'baseline', 'with_adult']);
    expect([out.A.masteredBy, out.B.masteredBy]).toEqual(['inferred', 'inferred']);
  });

  it('не прошла — отметка и следующая на пробу — прямая предпосылка; низ лестницы — обычная базовая линия', () => {
    const failed = applyPlacementProbe(fresh(ladder), ladder, C, [...ok('C', 2), trial({ targetId: 'C', kind: 'baseline', response: 'incorrect' })], 4, 'with_adult');
    expect([failed.C.phase, failed.C.placementTriedAt]).toEqual(['baseline', 4]);
    expect(placementCandidates(ladder, failed).map((x) => x.id)).toEqual(['B']);
    const both = { ...failed, B: { ...failed.B, placementTriedAt: 5 } };
    expect(placementCandidates(ladder, both)).toEqual([]);
  });

  it('предпосылки из другой области не выводятся', () => {
    const L = t('L', { format: 'identify', ...GRID_FOR.identify, identifyPoolKey: 'p' });
    const D = t('D', { prerequisiteTargetIds: ['C', 'L'] });
    const all = [...ladder, L, D];
    const out = applyPlacementProbe(fresh(all), all, D, ok('D', 3), 4, 'with_adult');
    expect(out.L.phase).toBe('baseline');
    expect(out.C.masteredBy).toBe('inferred');
  });

  it('у выведенной провал поддержания — назад на базовую линию, а не в обучение', () => {
    const s = markMastered(initialTargetState(A), 4, 'inferred');
    const back = applyMaintenanceProbe(s, trial({ targetId: 'A', kind: 'maintenance', response: 'incorrect' }), 5);
    expect([back.phase, back.masteredBy]).toEqual(['baseline', undefined]);
  });
});

describe('базовая линия match', () => {
  const M = t('M', { ...GRID_FOR.match, format: 'match', scoredBy: 'device_tap' });
  const five = (k: number) => [...ok('M', k), ...Array.from({ length: 5 - k }, () => trial({ targetId: 'M', kind: 'baseline', response: 'incorrect' }))];
  it('5/5 при поле 3 — освоено; при поле 2 — обучение с L0; 4/5 — L1; меньше — L3', () => {
    expect(applyBaseline(initialTargetState(M), five(5), 3, M, 'with_adult').phase).toBe('mastered');
    const two = applyBaseline(initialTargetState(M), five(5), 3, { ...M, fieldSize: 2 });
    expect([two.phase, two.startPromptLevel]).toEqual(['acquisition', 0]);
    expect(applyBaseline(initialTargetState(M), five(4), 3, M).startPromptLevel).toBe(1);
    expect(applyBaseline(initialTargetState(M), five(3), 3, M).startPromptLevel).toBe(3);
    expect(applyBaseline(initialTargetState(M), five(5).slice(0, 4), 3, M).phase).toBe('baseline');
  });
});

describe('допуск формата в «сам» (№60)', () => {
  const V = t('V', { format: 'voice_volume', ...GRID_FOR.voice_volume });
  const s = (over: Partial<AbaTargetState>) => ({ V: { ...initialTargetState(V), phase: 'mastered' as const, ...over } });
  it('открывает освоенная со взрослым по критерию или «дома»; по базовой линии — после поддержания', () => {
    expect(formatUnlockedAlone('voice_volume', [V], s({ masteredBy: 'criterion', masteredConfig: 'with_adult' }))).toBe(true);
    expect(formatUnlockedAlone('voice_volume', [V], s({ masteredBy: 'home_unverified', masteredConfig: 'with_adult' }))).toBe(true);
    expect(formatUnlockedAlone('voice_volume', [V], s({ masteredBy: 'baseline', masteredConfig: 'with_adult' }))).toBe(false);
    expect(formatUnlockedAlone('voice_volume', [V], s({ masteredBy: 'baseline', masteredConfig: 'with_adult', phase: 'maintenance' }))).toBe(true);
  });

  it('не открывают: освоенная в «сам», выведенная, другой формат', () => {
    expect(formatUnlockedAlone('voice_volume', [V], s({ masteredBy: 'criterion', masteredConfig: 'alone' }))).toBe(false);
    expect(formatUnlockedAlone('voice_volume', [V], s({ masteredBy: 'inferred', masteredConfig: 'with_adult' }))).toBe(false);
    expect(formatUnlockedAlone('match', [V], s({ masteredBy: 'criterion', masteredConfig: 'with_adult' }))).toBe(false);
  });
});

describe('переход в основное приложение (№59)', () => {
  const done = (x: AbaTarget): AbaTargetState => ({ ...initialTargetState(x), phase: 'maintenance', masteredBy: 'criterion' });
  const L1 = t('L1');
  const L3 = t('L3', { level: 3, area: 'early_academic', format: 'identify', sdKind: 'name', identifyPoolKey: 'p' });
  const opts = { promptDependentInLast3: false, sessionIndex: 40 };

  it('без ступени 3 не предлагается — пустой список не «всё освоено»', () => {
    expect(transitionOffer([L1], { L1: done(L1) }, opts)).toEqual({ eligible: false, reasons: ['ступени 3 нет'] });
  });

  it('всё освоено — предлагается; недавний отказ, зависимость или провал поддержания — нет', () => {
    const states = { L1: done(L1), L3: done(L3) };
    expect(transitionOffer([L1, L3], states, opts).eligible).toBe(true);
    expect(transitionOffer([L1, L3], states, { ...opts, declinedAtSession: 35 }).eligible).toBe(false);
    expect(transitionOffer([L1, L3], states, { ...opts, promptDependentInLast3: true }).eligible).toBe(false);
    expect(transitionOffer([L1, L3], { ...states, L1: { ...states.L1, maintenanceFailsInRow: 1 } }, opts).eligible).toBe(false);
  });
});

describe('параметры специалиста (№61)', () => {
  it('лимит времени 3–15 мин на 5-6 и 3–20 дальше; окно — от текущего до 10 с', () => {
    expect(sessionParamsErrors({ timeLimitMs: 16 * 60_000 }, '5-6')[0]).toContain('вне 3–15');
    expect(sessionParamsErrors({ timeLimitMs: 16 * 60_000 }, '7')).toEqual([]);
    expect(sessionParamsErrors({ paramsBand: '5-6', timeLimitMs: 16 * 60_000 }, '9-10')[0]).toContain('вне 3–15');
    expect(sessionParamsErrors({ responseWindowMs: { identify: 11_000 } }, '7')[0]).toContain('вне 5000–10000');
    expect(sessionParamsErrors({ responseWindowMs: { identify: 8000 } }, '7')).toEqual([]);
  });
});
