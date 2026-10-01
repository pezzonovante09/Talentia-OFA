/**
 * IOA — ABA.md, «Протокол взрослого», блок 5, и решение методиста по листу и прерываниям.
 */
import type { AbaIoaItem, AbaObserver, AbaSession, AbaTarget, AbaTargetState, AbaTrial } from '../../types/aba';
import {
  applyLateIoa,
  computeIoa,
  ioaCoverage,
  ioaDueNext,
  ioaPasses,
  ioaSheet,
  isVerified,
  masteryVerdict,
} from '../abaIoa';
import { initialTargetState } from '../abaPrompting';
import { target, trial } from './abaFixtures';

const ok = (over: Partial<AbaTrial> = {}) => trial(over);
const item = (t: AbaTrial, over: Partial<AbaIoaItem> = {}): AbaIoaItem => ({
  trialId: t.id,
  response: t.response,
  emittedBeforePrompt: t.emittedBeforePrompt,
  ...over,
});
const spec: AbaObserver = { id: 'o-spec', role: 'specialist', trained: true };
const parent: AbaObserver = { id: 'o-par', role: 'parent', trained: false };

describe('лист второго наблюдателя', () => {
  it('без кодов основного; повтор — новая строка «повтор строки N»; «ПР» — от устройства', () => {
    const a = ok({ id: 'a', response: 'interrupted', interruptedBy: 'child_break', latencyMs: null, latencyFromFirstSdMs: null, latencySource: null });
    const hp = ok({ id: 'hp', kind: 'high_p' });
    const b = ok({ id: 'b', requeuedFromTrialId: 'a' });
    const sheet = ioaSheet(12, [a, hp, b]);
    expect(sheet.code).toBe('#12');
    expect(sheet.rows).toEqual([
      expect.objectContaining({ n: 1, trialId: 'a', deviceMark: 'ПР' }),
      expect.objectContaining({ n: 2, trialId: 'b', repeatOfRow: 1 }),
    ]);
    for (const r of sheet.rows) {
      expect(r).not.toHaveProperty('response');
      expect(r).not.toHaveProperty('promptLevelUsed');
    }
  });
});

describe('согласие наблюдателей', () => {
  it('по исходам: trial-by-trial, реакция и попытка до подсказки', () => {
    const ts = [ok({ id: '1' }), ok({ id: '2' }), ok({ id: '3' }), ok({ id: '4' }), ok({ id: '5' })];
    const items = ts.map((t, i) => item(t, i === 4 ? { emittedBeforePrompt: false } : {}));
    const r = computeIoa(ts, items);
    if (!r.ok) throw new Error(r.errors.join('; '));
    expect(r.byTarget[target.id]).toMatchObject({ units: 5, agreements: 4, percent: 80 });
    expect(ioaPasses(r.byTarget[target.id])).toBe(true);
  });

  it('по самостоятельным: завышение «всё самостоятельно» не проходит', () => {
    const ts = Array.from({ length: 10 }, (_, i) =>
      i < 2 ? ok({ id: `t${i}` }) : ok({ id: `t${i}`, response: 'incorrect', promptLevelUsed: 0, emittedBeforePrompt: true }),
    );
    // второй отметил самостоятельными две другие пробы
    const items = ts.map((t, i) =>
      i < 2 ? item(t, { response: 'incorrect' }) : i < 4 ? item(t, { response: 'independent' }) : item(t),
    );
    const r = computeIoa(ts, items);
    if (!r.ok) throw new Error(r.errors.join('; '));
    expect(r.byTarget[target.id].independentOccurrence).toMatchObject({ units: 4, agreements: 0, percent: 0 });
    expect(ioaPasses(r.byTarget[target.id])).toBe(false);
  });

  it('прерывания — отдельно: «ОТ» у одного и исход у другого — расхождение, строка не в исходах', () => {
    const cut = ok({ id: 'x', response: 'interrupted', interruptedBy: 'assent', latencyMs: null, latencyFromFirstSdMs: null, latencySource: null });
    const ts = [cut, ok({ id: '1' }), ok({ id: '2' })];
    const items = [item(cut, { response: 'independent', interruption: undefined }), item(ts[1]), item(ts[2])];
    const r = computeIoa(ts, items);
    if (!r.ok) throw new Error(r.errors.join('; '));
    const res = r.byTarget[target.id];
    expect(res.units).toBe(2);
    // прерываний меньше 5 — без процента, «совпало k из n»
    expect(res.interruptions).toEqual({ units: 3, agreements: 2, marked: 1, percent: null });
  });

  it('перерыв по карточке («ПР») не кодируется и не сравнивается', () => {
    const brk = ok({ id: 'p', response: 'interrupted', interruptedBy: 'child_break', latencyMs: null, latencyFromFirstSdMs: null, latencySource: null });
    const ts = [brk, ok({ id: '1' })];
    const r = computeIoa(ts, [item(ts[1])]);
    expect(r.ok).toBe(true);
  });

  it('пропущенная или лишняя строка — ошибка ввода', () => {
    const ts = [ok({ id: '1' }), ok({ id: '2' })];
    expect(computeIoa(ts, [item(ts[0])]).ok).toBe(false);
    expect(computeIoa(ts, [item(ts[0]), item(ts[1]), { ...item(ts[1]), trialId: 'zz' }]).ok).toBe(false);
  });
});

describe('подтверждение и освоение', () => {
  const passing = { units: 5, agreements: 5, percent: 100, independentOccurrence: { units: 5, agreements: 5, percent: 100 }, interruptions: { units: 5, agreements: 5, marked: 0, percent: null } };

  it('подтверждена: основной обучен или IOA прошёл при обученном втором', () => {
    expect(isVerified({ primary: spec })).toBe(true);
    expect(isVerified({ primary: parent })).toBe(false);
    expect(isVerified({ primary: parent, ioa: { secondary: spec, result: passing } })).toBe(true);
    // два необученных взрослых семьи — согласие пишется, но не подтверждает
    expect(isVerified({ primary: parent, ioa: { secondary: { ...parent, id: 'o2' }, result: passing } })).toBe(false);
  });

  const adultTarget: AbaTarget = { ...target, scoredBy: 'adult' };
  const met = (verified: boolean): AbaTargetState => ({
    ...initialTargetState(adultTarget),
    criterionSessions: [
      { sessionIndex: 1, verified: false },
      { sessionIndex: 2, verified },
      { sessionIndex: 3, verified: false },
    ],
  });

  it('освоение: подтверждена хоть одна сессия серии — по критерию; нет — ждёт или «дома»', () => {
    expect(masteryVerdict(adultTarget, met(true), true)).toBe('criterion');
    expect(masteryVerdict(adultTarget, met(false), true)).toBe('needs_verification');
    expect(masteryVerdict(adultTarget, met(false), false)).toBe('home_unverified');
    // касание оценивает устройство — подтверждать нечего
    expect(masteryVerdict({ ...target, format: 'identify', scoredBy: 'device_tap' }, met(false), true)).toBe('criterion');
  });

  it('поздний IOA: сессия серии подтверждается; ниже порога у двух обученных — ioa_low', () => {
    const s = applyLateIoa(met(false), 2, true, false);
    expect(s.criterionSessions?.find((x) => x.sessionIndex === 2)?.verified).toBe(true);
    expect(applyLateIoa(met(false), 2, false, true).flags).toContain('ioa_low');
  });
});

describe('покрытие IOA', () => {
  const session = (index: number, over: Partial<AbaSession> = {}): AbaSession => ({
    id: `s-${index}`, index, startedAt: '', endedAt: '', config: 'with_adult', targetIds: ['A'], reinforcerId: 'r',
    reinforcerChosenBy: 'child', tokensEarned: 0, exchangesMade: 0, endReason: 'completed', brokenTargetId: null,
    boardSize: 5, endedOnSuccess: true, events: [], primaryObserverId: null, ...over,
  });

  it('по фазам; ниже 25% — следующей сессии нужна проверка', () => {
    const sessions = [
      session(1, { events: [{ kind: 'phase', at: '', targetId: 'A', from: 'baseline', to: 'acquisition', reason: 'baseline' }] }),
      session(2),
      session(3),
      session(4),
      session(5),
      session(6, { config: 'alone' }),
    ];
    const cov = ioaCoverage('A', sessions, new Set(['s-1', 's-3']));
    expect(cov.baseline).toMatchObject({ sessions: 1, withIoa: 1, below: false });
    expect(cov.acquisition).toMatchObject({ sessions: 4, withIoa: 1, ratio: 0.25, below: false });
    const low = ioaCoverage('A', sessions, new Set(['s-1']));
    expect(low.acquisition.below).toBe(true);
    expect(ioaDueNext('acquisition', low)).toBe(true);
    expect(ioaDueNext('mastered', low)).toBe(false);
  });
});
