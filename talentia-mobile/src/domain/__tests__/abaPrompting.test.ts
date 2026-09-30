import type { AbaTarget, AbaTargetState, AbaTrial, PromptLevel } from '../../types/aba';
import {
  applyBlockToDelay,
  applyPromptDependence,
  applyTrialToFading,
  effectiveDelayMs,
  initialTargetState,
  isBreakdown,
  isPromptDependent,
  nextEscalation,
  trialInvariantErrors,
  type SessionTrials,
} from '../abaPrompting';
import { target, trial } from './abaFixtures';

const fade = (s: AbaTargetState, trials: AbaTrial[]) => trials.reduce((acc: AbaTargetState, t: AbaTrial) => applyTrialToFading(acc, t, target.format), s);
const at = (level: PromptLevel): AbaTargetState => ({ ...initialTargetState(target), startPromptLevel: level });

/** Прогнать пробу, где ребёнок не отвечает ни разу: какие уровни прозвучат. */
function levelsUntilClose(start: PromptLevel): PromptLevel[] {
  const levels: PromptLevel[] = [start];
  for (;;) {
    const step = nextEscalation({ kind: 'teaching' }, levels[levels.length - 1], levels.length);
    if (step.kind === 'close') return levels;
    levels.push(step.level);
  }
}

describe('подъём внутри пробы', () => {
  it('с L0: L0 → L1 → полная модель, три предъявления', () => {
    expect(levelsUntilClose(0)).toEqual([0, 1, 3]);
  });

  it('с L1: L1 → L2 → полная модель', () => {
    expect(levelsUntilClose(1)).toEqual([1, 2, 3]);
  });

  it('с L2 полная модель звучит один раз', () => {
    expect(levelsUntilClose(2)).toEqual([2, 3]);
  });

  it('с полной модели подниматься некуда: L4 приложение не выдаёт', () => {
    expect(levelsUntilClose(3)).toEqual([3]);
  });

  it('больше трёх предъявлений не бывает ни с какого старта', () => {
    expect(([0, 1, 2, 3] as const).every((l) => levelsUntilClose(l).length <= 3)).toBe(true);
  });

  it('проба переноса измеряет, а не учит: подсказки нет', () => {
    expect(nextEscalation({ kind: 'generalization' }, 0, 1)).toEqual({ kind: 'close' });
  });

  it('поддержание, перенос после коррекции и коррекция подсказку дают', () => {
    expect(
      (['maintenance', 'transfer', 'correction'] as const).map((kind) => nextEscalation({ kind }, 0, 1)),
    ).toEqual([
      { kind: 'present', level: 1 },
      { kind: 'present', level: 1 },
      { kind: 'present', level: 1 },
    ]);
  });
});

describe('затухание между пробами', () => {
  it('новая цель стартует с полной модели — безошибочное обучение', () => {
    expect(initialTargetState(target).startPromptLevel).toBe(3);
  });

  it('две успешные пробы на L3 опускают стартовый уровень на L2', () => {
    const s = fade(initialTargetState(target), [
      trial({ startPromptLevel: 3, promptLevelUsed: 3, response: 'prompted' }),
      trial({ startPromptLevel: 3, promptLevelUsed: 3, response: 'prompted' }),
    ]);
    expect(s.startPromptLevel).toBe(2);
  });

  it('две подряд пробы выше стартового поднимают уровень', () => {
    const s = fade(at(1), [
      trial({ startPromptLevel: 1, promptLevelUsed: 2, response: 'prompted' }),
      trial({ startPromptLevel: 1, promptLevelUsed: 3, response: 'no_response' }),
    ]);
    expect(s.startPromptLevel).toBe(2);
  });

  it('успех между двумя неудачами рвёт серию', () => {
    const s = fade(at(1), [
      trial({ startPromptLevel: 1, promptLevelUsed: 2, response: 'prompted' }),
      trial({ startPromptLevel: 1, promptLevelUsed: 1, response: 'prompted' }),
      trial({ startPromptLevel: 1, promptLevelUsed: 2, response: 'prompted' }),
    ]);
    expect(s.startPromptLevel).toBe(1);
  });

  it('ниже L0 не опускается', () => {
    expect(fade(at(0), [trial(), trial(), trial()]).startPromptLevel).toBe(0);
  });

  it('приближение уровень не двигает, но рвёт серию «подряд»', () => {
    const s = fade(at(1), [
      trial({ startPromptLevel: 1, promptLevelUsed: 1, response: 'prompted' }),
      trial({ startPromptLevel: 1, promptLevelUsed: 1, response: 'approximation' }),
      trial({ startPromptLevel: 1, promptLevelUsed: 1, response: 'prompted' }),
    ]);
    expect({ уровень: s.startPromptLevel, серия: s.consecutiveIndependentAtStart }).toEqual({
      уровень: 1,
      серия: 1,
    });
  });

  it('прерванная проба не случилась', () => {
    const start = { ...at(3), consecutiveIndependentAtStart: 1 };
    const s = fade(start, [trial({ startPromptLevel: 3, promptLevelUsed: 3, response: 'interrupted' })]);
    expect(s).toEqual(start);
  });

  it('коррекция, проба генерализации и поддержание уровень не опускают', () => {
    const s = fade(at(3), [
      trial({ kind: 'correction', startPromptLevel: 3, promptLevelUsed: 3, response: 'prompted' }),
      trial({ kind: 'generalization', startPromptLevel: 3, promptLevelUsed: 3, response: 'prompted' }),
      trial({ kind: 'maintenance', startPromptLevel: 3, promptLevelUsed: 3, response: 'prompted' }),
      trial({ kind: 'correction', startPromptLevel: 3, promptLevelUsed: 3, response: 'prompted' }),
    ]);
    expect(s.startPromptLevel).toBe(3);
  });

  it('успешный перенос после коррекции уровень не опускает', () => {
    const s = fade(at(1), [
      trial({ kind: 'transfer', startPromptLevel: 1, promptLevelUsed: 1, response: 'prompted' }),
      trial({ kind: 'transfer', startPromptLevel: 1, promptLevelUsed: 1, response: 'prompted' }),
    ]);
    expect(s.startPromptLevel).toBe(1);
  });

  it('проваленный перенос уровень поднимает', () => {
    const s = fade(at(1), [
      trial({ kind: 'transfer', startPromptLevel: 1, promptLevelUsed: 3, response: 'no_response' }),
      trial({ startPromptLevel: 1, promptLevelUsed: 2, response: 'prompted' }),
    ]);
    expect(s.startPromptLevel).toBe(2);
  });

  it('запоминает уровень последнего успеха', () => {
    const s = fade(initialTargetState(target), [
      trial({ startPromptLevel: 3, promptLevelUsed: 2, response: 'prompted' }),
      trial({ startPromptLevel: 3, promptLevelUsed: 3, response: 'incorrect' }),
    ]);
    expect(s.lastSuccessfulPromptLevel).toBe(2);
  });

  it('подсказка взрослого (L4) не становится уровнем приложения', () => {
    const s = fade(at(3), [trial({ startPromptLevel: 3, promptLevelUsed: 4, response: 'prompted' })]);
    expect(s.lastSuccessfulPromptLevel).toBe(3);
  });
});

describe('задержка', () => {
  const progressive: AbaTarget = { ...target, delayMode: 'progressive' };
  const clean = () => Array.from({ length: 5 }, () => trial());
  const guess = () => trial({ startPromptLevel: 0, promptLevelUsed: 1, response: 'prompted', emittedBeforePrompt: true });

  it('на полной модели ждать нечего', () => {
    expect([effectiveDelayMs(at(3), 3), effectiveDelayMs(at(0), 0)]).toEqual([0, 3000]);
  });

  it('прогрессивная растёт на шаг за блок без ошибок до подсказки', () => {
    const s = applyBlockToDelay(initialTargetState(progressive), progressive, clean());
    expect(s.currentDelayMs).toBe(2000);
  });

  it('упирается в потолок по возрасту: 4 с на 5–6', () => {
    let s = initialTargetState(progressive);
    for (let i = 0; i < 10; i += 1) s = applyBlockToDelay(s, progressive, clean());
    expect(s.currentDelayMs).toBe(4000);
  });

  it('две подряд ошибки до подсказки — на шаг короче', () => {
    const s = applyBlockToDelay({ ...initialTargetState(progressive), currentDelayMs: 3000 }, progressive, [
      trial(),
      guess(),
      guess(),
    ]);
    expect(s.currentDelayMs).toBe(2000);
  });

  it('одна ошибка до подсказки — задержка стоит', () => {
    const s = applyBlockToDelay({ ...initialTargetState(progressive), currentDelayMs: 3000 }, progressive, [
      trial(),
      guess(),
      trial(),
    ]);
    expect(s.currentDelayMs).toBe(3000);
  });

  it('блоки на подсказанном старте задержку не двигают', () => {
    const prompted = Array.from({ length: 5 }, () =>
      trial({ startPromptLevel: 3, promptLevelUsed: 3, response: 'prompted', emittedBeforePrompt: false }),
    );
    let s = initialTargetState(progressive);
    for (let i = 0; i < 5; i += 1) s = applyBlockToDelay(s, progressive, prompted);
    expect(s.currentDelayMs).toBe(1000);
  });

  it('постоянная задержка не меняется', () => {
    expect(applyBlockToDelay(initialTargetState(target), target, clean()).currentDelayMs).toBe(3000);
  });
});

describe('критерий остановки', () => {
  const failAtMax = () => trial({ startPromptLevel: 3, promptLevelUsed: 3, response: 'no_response' });
  const highP = () => trial({ targetId: 'mastered-one', kind: 'high_p' });

  it('три подряд провала на полной модели останавливают сессию', () => {
    expect(isBreakdown([trial(), failAtMax(), failAtMax(), failAtMax()], target.id)).toBe(true);
  });

  it('отвлекающие пробы коррекции между провалами серию не рвут', () => {
    const log = [failAtMax(), highP(), failAtMax(), highP(), failAtMax()];
    expect(isBreakdown(log, target.id)).toBe(true);
  });

  it('проба коррекции серию не рвёт', () => {
    const correction = trial({ kind: 'correction', startPromptLevel: 3, promptLevelUsed: 3, response: 'prompted' });
    expect(isBreakdown([failAtMax(), correction, failAtMax(), failAtMax()], target.id)).toBe(true);
  });

  it('провал ниже полной модели не считается', () => {
    const lower = trial({ startPromptLevel: 0, promptLevelUsed: 2, response: 'no_response' });
    expect(isBreakdown([failAtMax(), failAtMax(), lower], target.id)).toBe(false);
  });

  it('приближение на полной модели — продвижение, а не провал', () => {
    const approx = trial({ startPromptLevel: 3, promptLevelUsed: 3, response: 'approximation' });
    expect(isBreakdown([failAtMax(), approx, failAtMax()], target.id)).toBe(false);
  });

  it('прерванная проба серию не рвёт', () => {
    const cut = trial({ response: 'interrupted' });
    expect(isBreakdown([failAtMax(), cut, failAtMax(), failAtMax()], target.id)).toBe(true);
  });

  it('в цепочке серия считается по звену: удачные первые звенья её не рвут', () => {
    const ok = (stepId: string) => trial({ stepId });
    const fail = () => ({ ...failAtMax(), stepId: 'st-3' });
    const runs = [0, 1, 2].flatMap(() => [ok('st-1'), ok('st-2'), fail()]);
    expect(isBreakdown(runs, target.id)).toBe(true);
  });
});

describe('зависимость от подсказки', () => {
  const silent = () =>
    trial({ startPromptLevel: 0, promptLevelUsed: 1, response: 'prompted', emittedBeforePrompt: false, latencyMs: 3400 });
  const tries = () =>
    trial({ startPromptLevel: 0, promptLevelUsed: 1, response: 'prompted', emittedBeforePrompt: true, latencyMs: 900 });
  const sessions = (make: () => AbaTrial, from = 1, n = 3): SessionTrials[] =>
    Array.from({ length: n }, (_, i) => ({ index: from + i, trials: Array.from({ length: 5 }, make) }));

  it('молчит до подсказки три сессии подряд — флаг', () => {
    expect(isPromptDependent(at(0), sessions(silent))).toBe(true);
  });

  it('пробует и промахивается — это не зависимость, а неумение', () => {
    expect(isPromptDependent(at(0), sessions(tries))).toBe(false);
  });

  it('пробы с подсказанного старта доли не размывают и не накручивают', () => {
    // пять проб со старта L0 — самостоятельные, остальные с L2 — подсказанные по построению
    const own = (): SessionTrials[] =>
      [1, 2, 3].map((index) => ({
        index,
        trials: [
          ...Array.from({ length: 2 }, () => trial()),
          ...Array.from({ length: 5 }, () =>
            trial({ startPromptLevel: 2, promptLevelUsed: 2, response: 'prompted', emittedBeforePrompt: false }),
          ),
        ],
      }));
    expect(isPromptDependent(at(0), own())).toBe(false);
  });

  it('без проб со старта L0 судить не по чему', () => {
    const atL2 = () => trial({ startPromptLevel: 2, promptLevelUsed: 2, response: 'prompted', emittedBeforePrompt: false });
    expect(isPromptDependent(at(2), sessions(atL2))).toBe(false);
  });

  it('двух сессий мало', () => {
    expect(isPromptDependent(at(0), sessions(silent, 1, 2))).toBe(false);
  });

  it('на тех же сессиях второй раз не срабатывает — окно начинается заново', () => {
    const history = sessions(silent, 1, 4);
    const flagged = applyPromptDependence(at(2), target, 4);
    expect(isPromptDependent(flagged, history)).toBe(false);
    expect(isPromptDependent(flagged, [...history, ...sessions(silent, 5, 3)])).toBe(true);
  });

  it('реакция: задержка на шаг, старт с L0, флаг не дублируется', () => {
    const s = applyPromptDependence(applyPromptDependence(at(2), target, 3), target, 6);
    expect({ delay: s.currentDelayMs, уровень: s.startPromptLevel, флаги: s.flags }).toEqual({
      delay: 4000,
      уровень: 0,
      флаги: ['prompt_dependent'],
    });
  });

  it('задержка от флагов упирается в потолок', () => {
    let s = at(2);
    for (let i = 0; i < 5; i += 1) s = applyPromptDependence(s, target, i);
    expect(s.currentDelayMs).toBe(4000);
  });
});

describe('инварианты записи пробы', () => {
  it('корректная запись проходит', () => {
    expect(trialInvariantErrors(trial())).toEqual([]);
    expect(
      trialInvariantErrors(trial({ startPromptLevel: 1, promptLevelUsed: 2, presentations: 2, response: 'prompted' })),
    ).toEqual([]);
  });

  it('самостоятельный ответ после подсказки — противоречие', () => {
    expect(trialInvariantErrors(trial({ promptLevelUsed: 1 }))).toContain('самостоятельный ответ после подсказки');
  });

  it('подсказанный без подсказки — противоречие', () => {
    expect(trialInvariantErrors(trial({ response: 'prompted' }))).toContain('подсказанный ответ без подсказки');
  });

  it('четыре предъявления — противоречие', () => {
    expect(trialInvariantErrors(trial({ presentations: 4 }))).toContain('больше трёх предъявлений одного SD');
  });

  it('самостоятельный ответ без попытки до подсказки — противоречие', () => {
    expect(trialInvariantErrors(trial({ emittedBeforePrompt: false }))).toContain(
      'самостоятельный ответ без попытки до подсказки',
    );
  });

  it('проба поддержания, начатая с подсказки, — противоречие: её провал назначен заранее', () => {
    const t = trial({ kind: 'maintenance', startPromptLevel: 1, promptLevelUsed: 1, response: 'prompted' });
    expect(trialInvariantErrors(t)).toContain('измерительная проба начата с подсказки');
  });

  it('попытка до подсказки при старте с полной модели — противоречие', () => {
    const t = trial({ startPromptLevel: 3, promptLevelUsed: 3, response: 'prompted', emittedBeforePrompt: true });
    expect(trialInvariantErrors(t)).toContain('попытка до подсказки при старте с полной модели');
  });
});
