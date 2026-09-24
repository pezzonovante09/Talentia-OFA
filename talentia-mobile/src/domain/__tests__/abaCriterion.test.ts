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

const probe = (exemplarId: string, response: AbaTrial['response'] = 'independent', sdVariantKey?: string) =>
  trial({ kind: 'generalization', exemplarId, response, sdVariantKey });

const withProbes = (s: AbaTargetState) =>
  [probe('cat-3'), probe('cat-3', 'independent', 'aba.sd.meow.alt')].reduce(applyGeneralizationProbe, s);

describe('сводка сессии', () => {
  it('4 из 5 — ровно 80%, в зачёт', () => {
    expect(summarizeSession(target, session(5, 4))).toMatchObject({
      trials: 5,
      independentRate: 0.8,
      outcome: 'meets',
    });
  });

  it('3 из 5 рвёт серию', () => {
    expect(summarizeSession(target, session(5, 3)).outcome).toBe('breaks');
  });

  it('короткая сессия с одной неудачей ничего не решает', () => {
    expect(summarizeSession(target, session(3, 2)).outcome).toBe('neutral');
  });

  it('короткая сессия, где 80% уже недостижимы, рвёт серию', () => {
    expect(summarizeSession(target, session(3, 1)).outcome).toBe('breaks');
  });

  it('сессия, оборванная остановкой, рвёт серию', () => {
    expect(summarizeSession(target, session(3, 3), 'breakdown').outcome).toBe('breaks');
  });

  it('детектор начала звука и распознавание в процент не входят', () => {
    const s = summarizeSession(target, [
      ...session(5, 5, { scoredBy: 'device_onset' }),
      ...session(5, 5, { scoredBy: 'device_asr' }),
    ]);
    expect(s.trials).toBe(0);
  });

  it('разогрев, коррекция и перенос в процент не входят, прерванные — тоже', () => {
    const s = summarizeSession(target, [
      ...session(5, 1),
      trial({ kind: 'high_p' }),
      trial({ kind: 'correction', startPromptLevel: 1, promptLevelUsed: 1, response: 'prompted' }),
      trial({ kind: 'transfer' }),
      trial({ response: 'interrupted' }),
    ]);
    expect({ проб: s.trials, доля: s.independentRate }).toEqual({ проб: 5, доля: 0.2 });
  });

  describe('цепочка', () => {
    const chain: AbaTarget = {
      ...target,
      format: 'do_action',
      steps: [
        { id: 'st-1', order: 1, sdKey: 'a', criterionKey: 'a', modelKey: 'a' },
        { id: 'st-2', order: 2, sdKey: 'b', criterionKey: 'b', modelKey: 'b' },
      ],
    };

    it('три прогона без ошибок — в зачёт: минимум в прогонах, а не в пробах', () => {
      const trials = [...session(3, 3, { stepId: 'st-1' }), ...session(3, 3, { stepId: 'st-2' })];
      expect(summarizeSession(chain, trials).outcome).toBe('meets');
    });

    it('в зачёт, только если в зачёт каждый шаг', () => {
      // вместе 8 из 10 = 80%, но второй шаг не держится
      const trials = [...session(5, 5, { stepId: 'st-1' }), ...session(5, 3, { stepId: 'st-2' })];
      expect(summarizeSession(chain, trials).outcome).toBe('breaks');
    });
  });
});

describe('критерий освоения', () => {
  it('три сессии в разные дни, два экземпляра и два разных переноса — освоено', () => {
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

  it('два переноса на одном и том же стимуле засчитываются один раз', () => {
    const s = [probe('cat-3'), probe('cat-3')].reduce(
      applyGeneralizationProbe,
      run(['2026-09-01', '2026-09-02', '2026-09-03']),
    );
    expect(criterionGaps(s)).toEqual(['generalization']);
  });

  it('сессия ниже порога рвёт серию', () => {
    let s = run(['2026-09-01', '2026-09-02']);
    s = applySession(s, summarizeSession(target, session(5, 3)), 2, '2026-09-03');
    expect({ серия: s.sessionsAtCriterion, дни: s.criterionDays }).toEqual({ серия: 0, дни: [] });
  });

  it('короткая сессия с одной неудачей серию не рвёт и не продлевает', () => {
    let s = run(['2026-09-01', '2026-09-02']);
    s = applySession(s, summarizeSession(target, session(3, 2)), 2, '2026-09-03');
    expect(s.sessionsAtCriterion).toBe(2);
  });

  it('пробы переноса начинаются с 60% самостоятельных', () => {
    const at = (independent: number) =>
      needsGeneralizationProbe(run(['2026-09-01'], () => session(5, independent)));
    expect([at(2), at(3)]).toEqual([false, true]);
  });

  it('окно переноса — три последние пробы', () => {
    const s = [probe('a'), probe('b'), probe('c', 'incorrect'), probe('d', 'no_response')].reduce(
      applyGeneralizationProbe,
      initialTargetState(target),
    );
    expect(s.generalizationProbes.map((p) => p.exemplarId)).toEqual(['b', 'c', 'd']);
  });
});

describe('поддержание', () => {
  const mastered = () => markMastered(initialTargetState(target), 10);
  const maint = (over: Partial<AbaTrial> = {}) => trial({ kind: 'maintenance', ...over });

  it('интервалы считаются в сессиях: 1, 2, 5, 12', () => {
    const due = (gap: 0 | 1 | 2 | 3) => {
      const s = { ...mastered(), maintenanceGapIndex: gap };
      for (let i = 11; i < 40; i += 1) if (isMaintenanceDue(s, i)) return i - 10;
      return -1;
    };
    expect([due(0), due(1), due(2), due(3)]).toEqual([1, 2, 5, 12]);
  });

  it('разогрев на освоенной цели расписание не сдвигает', () => {
    let s: AbaTargetState = { ...mastered(), maintenanceGapIndex: 2 };
    for (let i = 11; i <= 15; i += 1) {
      s = applySession(s, summarizeSession(target, [trial({ kind: 'high_p' })]), i, `2026-09-${i}`);
    }
    expect(isMaintenanceDue(s, 15)).toBe(true);
  });

  it('цель в усвоении пробы поддержания не получает', () => {
    expect(isMaintenanceDue(initialTargetState(target), 100)).toBe(false);
  });

  it('успех отодвигает следующую пробу', () => {
    const s = applyMaintenanceProbe(mastered(), maint(), 11);
    expect({ gap: s.maintenanceGapIndex, фаза: s.phase }).toEqual({ gap: 1, фаза: 'maintenance' });
  });

  it('провал — перепроверка на следующей же сессии', () => {
    const s = applyMaintenanceProbe(
      { ...mastered(), maintenanceGapIndex: 2 },
      maint({ response: 'incorrect' }),
      15,
    );
    expect({ gap: s.maintenanceGapIndex, due: isMaintenanceDue(s, 16) }).toEqual({ gap: 0, due: true });
  });

  it('ответ с подсказкой L1 возвращает старт на L1, а не к полной модели', () => {
    const s = applyMaintenanceProbe(
      { ...mastered(), startPromptLevel: 0, lastSuccessfulPromptLevel: 0 },
      maint({ response: 'prompted', promptLevelUsed: 1 }),
      11,
    );
    expect(s.startPromptLevel).toBe(1);
  });

  it('провал без ответа возвращает к уровню последнего успеха', () => {
    const s = applyMaintenanceProbe(
      { ...mastered(), startPromptLevel: 0, lastSuccessfulPromptLevel: 1 },
      maint({ response: 'no_response', promptLevelUsed: 3 }),
      11,
    );
    expect(s.startPromptLevel).toBe(1);
  });

  it('подсказка взрослого (L4) не становится стартовым уровнем', () => {
    const s = applyMaintenanceProbe(mastered(), maint({ response: 'prompted', promptLevelUsed: 4 }), 11);
    expect(s.startPromptLevel).toBe(3);
  });

  it('два провала подряд — цель возвращается в обучение, серия заново', () => {
    let s = withProbes(run(['2026-09-01', '2026-09-02', '2026-09-03']));
    s = markMastered(s, 3);
    s = applyMaintenanceProbe(s, maint({ response: 'incorrect' }), 4);
    expect(s.phase).toBe('maintenance');
    s = applyMaintenanceProbe(s, maint({ response: 'no_response', promptLevelUsed: 3 }), 5);
    expect({
      фаза: s.phase,
      серия: s.sessionsAtCriterion,
      перенос: s.generalizationProbes.length,
    }).toEqual({ фаза: 'acquisition', серия: 0, перенос: 0 });
  });

  it('успех между провалами обнуляет счёт', () => {
    let s = mastered();
    s = applyMaintenanceProbe(s, maint({ response: 'incorrect' }), 11);
    s = applyMaintenanceProbe(s, maint(), 12);
    s = applyMaintenanceProbe(s, maint({ response: 'incorrect' }), 14);
    expect(s.phase).toBe('maintenance');
  });
});
