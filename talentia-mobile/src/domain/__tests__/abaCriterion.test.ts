import type { AbaTarget, AbaTargetState, AbaTrial } from '../../types/aba';
import {
  applyGeneralizationProbe,
  applyMaintenanceProbe,
  applySession,
  criterionGaps,
  isMaintenanceDue,
  isMasteryMet,
  markMastered,
  needsGeneralizationProbe,
  summarizeSession,
} from '../abaCriterion';
import { initialTargetState } from '../abaPrompting';
import { target, trial } from './abaFixtures';

/** Сессия из `n` проб, из них `independent` самостоятельных; экземпляры чередуются. */
function session(n: number, independent: number, over: Partial<AbaTrial> = {}): AbaTrial[] {
  return Array.from({ length: n }, (_, i) =>
    trial({
      exemplarId: i % 2 ? 'cat-2' : 'cat-1',
      response: i < independent ? 'independent' : 'prompted',
      promptLevelUsed: i < independent ? 0 : 1,
      ...over,
    }),
  );
}

function run(days: string[], perSession = () => session(5, 4)): AbaTargetState {
  return days.reduce(
    (s, day, i) => applySession(s, summarizeSession(target, perSession()), i, day),
    initialTargetState(target),
  );
}

const withProbes = (s: AbaTargetState) =>
  ['independent', 'independent'].reduce(
    (acc, r) => applyGeneralizationProbe(acc, trial({ kind: 'generalization', response: r as 'independent' })),
    s,
  );

describe('сводка сессии', () => {
  it('4 из 5 — ровно 80%, в зачёт', () => {
    expect(summarizeSession(target, session(5, 4))).toMatchObject({
      trials: 5,
      independentRate: 0.8,
      meetsCriterion: true,
    });
  });

  it('меньше пяти проб — сессия не в зачёт, даже при 100%', () => {
    expect(summarizeSession(target, session(4, 4))).toMatchObject({ counts: false, meetsCriterion: false });
  });

  it('детектор начала звука и распознавание в процент не входят', () => {
    const s = summarizeSession(target, [
      ...session(5, 5, { scoredBy: 'device_onset' }),
      ...session(5, 5, { scoredBy: 'device_asr' }),
    ]);
    expect(s.trials).toBe(0);
  });

  it('разогрев и перенос в процент не входят, прерванные — тоже', () => {
    const s = summarizeSession(target, [
      ...session(5, 1),
      trial({ kind: 'high_p' }),
      trial({ kind: 'transfer' }),
      trial({ response: 'interrupted' }),
    ]);
    expect({ проб: s.trials, доля: s.independentRate }).toEqual({ проб: 5, доля: 0.2 });
  });

  it('цепочка в зачёт, только если в зачёт каждый шаг', () => {
    const chain: AbaTarget = {
      ...target,
      format: 'do_action',
      steps: [
        { id: 'st-1', order: 1, sdKey: 'a', criterionKey: 'a', modelKey: 'a' },
        { id: 'st-2', order: 2, sdKey: 'b', criterionKey: 'b', modelKey: 'b' },
      ],
    };
    const good = session(5, 5, { stepId: 'st-1' });
    const weak = session(5, 3, { stepId: 'st-2' });
    // вместе 8 из 10 = 80%, но второй шаг не держится
    expect(summarizeSession(chain, [...good, ...weak]).meetsCriterion).toBe(false);
  });
});

describe('критерий освоения', () => {
  it('три сессии в разные дни, два экземпляра и два переноса — освоено', () => {
    const s = withProbes(run(['2026-09-01', '2026-09-02', '2026-09-03']));
    expect(criterionGaps(s)).toEqual([]);
    expect(isMasteryMet(s)).toBe(true);
  });

  it('три удачные сессии за один вечер не дают освоения', () => {
    const s = withProbes(run(['2026-09-01', '2026-09-01', '2026-09-01']));
    expect(criterionGaps(s)).toEqual(['distinct_days']);
  });

  it('одна картинка — не навык', () => {
    const one = () => session(5, 4, { exemplarId: 'cat-1' });
    const s = withProbes(run(['2026-09-01', '2026-09-02', '2026-09-03'], one));
    expect(criterionGaps(s)).toEqual(['exemplars']);
  });

  it('без проб переноса освоения нет', () => {
    expect(criterionGaps(run(['2026-09-01', '2026-09-02', '2026-09-03']))).toEqual(['generalization']);
  });

  it('сессия ниже порога рвёт серию', () => {
    let s = run(['2026-09-01', '2026-09-02']);
    s = applySession(s, summarizeSession(target, session(5, 3)), 2, '2026-09-03');
    expect({ серия: s.sessionsAtCriterion, дни: s.criterionDays }).toEqual({ серия: 0, дни: [] });
  });

  it('короткая сессия серию не рвёт и не продлевает', () => {
    let s = run(['2026-09-01', '2026-09-02']);
    s = applySession(s, summarizeSession(target, session(3, 0)), 2, '2026-09-03');
    expect(s.sessionsAtCriterion).toBe(2);
  });

  it('пробы переноса начинаются с 60% самостоятельных', () => {
    const at = (independent: number) =>
      needsGeneralizationProbe(run(['2026-09-01'], () => session(5, independent)));
    expect([at(2), at(3)]).toEqual([false, true]);
  });

  it('окно переноса — три последние пробы', () => {
    const s = ['independent', 'independent', 'incorrect', 'no_response'].reduce(
      (acc, r) => applyGeneralizationProbe(acc, trial({ kind: 'generalization', response: r as never })),
      initialTargetState(target),
    );
    expect(s.generalizationProbes).toEqual(['independent', 'incorrect', 'no_response']);
  });
});

describe('поддержание', () => {
  const mastered = () => markMastered({ ...initialTargetState(target), lastSessionIndex: 10 });

  it('интервалы считаются в сессиях: 1, 2, 5, 12', () => {
    const due = (gap: 0 | 1 | 2 | 3) => {
      const s = { ...mastered(), maintenanceGapIndex: gap };
      for (let i = 11; i < 40; i += 1) if (isMaintenanceDue(s, i)) return i - 10;
      return -1;
    };
    expect([due(0), due(1), due(2), due(3)]).toEqual([1, 2, 5, 12]);
  });

  it('цель в усвоении пробы поддержания не получает', () => {
    expect(isMaintenanceDue(initialTargetState(target), 100)).toBe(false);
  });

  it('успех отодвигает следующую пробу', () => {
    const s = applyMaintenanceProbe(mastered(), trial({ kind: 'maintenance' }), 11);
    expect({ gap: s.maintenanceGapIndex, фаза: s.phase }).toEqual({ gap: 1, фаза: 'maintenance' });
  });

  it('провал возвращает к уровню последнего успеха, а не к полной модели', () => {
    const s = applyMaintenanceProbe(
      { ...mastered(), maintenanceGapIndex: 2, startPromptLevel: 0, lastSuccessfulPromptLevel: 1 },
      trial({ kind: 'maintenance', response: 'incorrect', promptLevelUsed: 0 }),
      15,
    );
    expect({ уровень: s.startPromptLevel, gap: s.maintenanceGapIndex }).toEqual({ уровень: 1, gap: 0 });
  });
});
