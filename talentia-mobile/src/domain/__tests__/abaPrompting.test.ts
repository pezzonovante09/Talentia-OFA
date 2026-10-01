import type { AbaTarget, AbaTargetState, AbaTrial, PromptLevel } from '../../types/aba';
import {
  applyBlockToDelay,
  applyPromptDependence,
  applyTrialToFading,
  fadeClass,
  initialTargetState,
  isBreakdown,
  isPromptDependent,
  nextEscalation,
  promptDelayMs,
  responseWindowMs,
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

  it('задержка до подсказки — только на старте L0 в обучении и переносе, окно — всегда', () => {
    const w = responseWindowMs(target);
    expect(w).toBe(5000);
    expect([
      promptDelayMs(at(0), 'teaching', 0, w),
      promptDelayMs(at(0), 'transfer', 0, w),
      promptDelayMs(at(1), 'teaching', 1, w),
      promptDelayMs(at(3), 'teaching', 3, w),
      promptDelayMs(at(0), 'baseline', 0, w),
      promptDelayMs(at(0), 'maintenance', 0, w),
      promptDelayMs(at(0), 'high_p', 0, w),
    ]).toEqual([3000, 3000, null, null, null, null, null]);
  });

  it('задержка не длиннее окна ответа', () => {
    expect(promptDelayMs({ ...at(0), currentDelayMs: 8000 }, 'teaching', 0, 5000)).toBe(5000);
  });

  it('окно по формату и полосе; у звена цепочки — своё или 10 с', () => {
    expect(responseWindowMs({ ...target, format: 'repeat_word', band: '5-6' })).toBe(6000);
    expect(responseWindowMs({ ...target, format: 'repeat_word', band: '7' })).toBe(5000);
    const chain: AbaTarget = {
      ...target,
      format: 'do_action',
      steps: [
        { id: 's1', order: 1, sdKey: 'a', criterionKey: 'b', modelKey: 'c' },
        { id: 's2', order: 2, sdKey: 'a', criterionKey: 'b', modelKey: 'c', responseWindowMs: 15000 },
      ],
    };
    expect([responseWindowMs(chain, 's1'), responseWindowMs(chain, 's2')]).toEqual([10000, 15000]);
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

describe('латентность и окно в записи пробы', () => {
  it('согласованная запись проходит', () => {
    expect(trialInvariantErrors(trial())).toEqual([]);
    expect(trialInvariantErrors(trial({ response: 'no_response', promptLevelUsed: 3, emittedBeforePrompt: false }))).toEqual([]);
  });

  it('противоречия латентности, задержки и окна ловятся', () => {
    const errs = (over: Partial<AbaTrial>) => trialInvariantErrors(trial(over));
    expect(errs({ response: 'no_response', latencyMs: 900, emittedBeforePrompt: false, promptLevelUsed: 3 })).toContain(
      'латентность у отсутствия ответа',
    );
    expect(errs({ latencySource: null })).toContain('латентность без источника или источник без латентности');
    expect(errs({ latencyFromFirstSdMs: 2000 })).toContain(
      'у самостоятельного ответа время от первого SD отличается от латентности',
    );
    expect(
      errs({ response: 'prompted', promptLevelUsed: 1, emittedBeforePrompt: false, latencyMs: 900, latencyFromFirstSdMs: 500 }),
    ).toContain('время от первого SD меньше латентности');
    expect(errs({ startPromptLevel: 1, promptLevelUsed: 1, response: 'prompted', emittedBeforePrompt: false, promptDelayMs: 1000 })).toContain(
      'задержка до подсказки при старте с подсказки',
    );
    expect(errs({ promptDelayMs: 6000, responseWindowMs: 5000 })).toContain('задержка до подсказки длиннее окна ответа');
  });
});

describe('затухание без качелей L0↔L1 (D2)', () => {
  const T: AbaTarget = { ...target, format: 'repeat_word', band: '7', delayMode: 'progressive' };
  const waited = (over: Partial<AbaTrial> = {}) =>
    trial({ startPromptLevel: 0, promptLevelUsed: 1, response: 'prompted', emittedBeforePrompt: false, latencyMs: 900, latencyFromFirstSdMs: 2900, ...over });

  it('классы пробы', () => {
    expect([
      fadeClass(trial()),
      fadeClass(waited()),
      fadeClass(waited({ emittedBeforePrompt: true })),
      fadeClass(waited({ startPromptLevel: 1, promptLevelUsed: 1 })),
      fadeClass(trial({ startPromptLevel: 0, promptLevelUsed: 3, response: 'prompted', emittedBeforePrompt: false })),
      fadeClass(trial({ startPromptLevel: 1, promptLevelUsed: 2, response: 'prompted', emittedBeforePrompt: false })),
      fadeClass(trial({ response: 'incorrect', emittedBeforePrompt: true })),
      fadeClass(trial({ response: 'approximation', emittedBeforePrompt: true })),
    ]).toEqual(['at_start', 'waited', 'above', 'at_start', 'above', 'above', 'above', 'approximation']);
  });

  it('пример методиста: «дождался» на L0 старт не поднимает, задержка держится', () => {
    let s: AbaTargetState = { ...initialTargetState(T), phase: 'acquisition', startPromptLevel: 1, lastSuccessfulPromptLevel: 1, currentDelayMs: 1000 };
    const atL1 = () => trial({ startPromptLevel: 1, promptLevelUsed: 1, response: 'prompted', emittedBeforePrompt: false });
    const steps: [AbaTrial, PromptLevel][] = [
      [atL1(), 1],
      [atL1(), 0],
      [waited(), 0],
      [waited(), 0],
      [trial({ latencyMs: 700, latencyFromFirstSdMs: 700 }), 0],
      [trial({ startPromptLevel: 0, promptLevelUsed: 3, response: 'prompted', emittedBeforePrompt: false }), 0],
      [waited(), 0],
      [trial({ response: 'incorrect', emittedBeforePrompt: true, latencyMs: 500, latencyFromFirstSdMs: 500 }), 0],
      [trial({ kind: 'transfer', latencyMs: 900, latencyFromFirstSdMs: 900 }), 0],
    ];
    const block: AbaTrial[] = [];
    for (const [t, start] of steps) {
      s = applyTrialToFading(s, t, T.format);
      block.push(t);
      expect(s.startPromptLevel).toBe(start);
    }
    expect([s.consecutiveAboveStart, s.consecutiveFailures]).toEqual([0, 0]);
    // возврат на L0 не удлиняет задержку; ошибка до подсказки в блоке — задержка держится
    expect(s.currentDelayMs).toBe(1000);
    expect(applyBlockToDelay(s, T, block).currentDelayMs).toBe(1000);
    // будь проба 8 «дождался», задержка выросла бы на шаг
    const clean = block.map((t, i) => (i === 7 ? waited() : t));
    expect(applyBlockToDelay(s, T, clean).currentDelayMs).toBe(2000);
  });

  it('прежние качели: две «дождался» подряд больше не поднимают старт', () => {
    const s0: AbaTargetState = { ...initialTargetState(T), phase: 'acquisition', startPromptLevel: 0 };
    const s = applyTrialToFading(applyTrialToFading(s0, waited(), T.format), waited(), T.format);
    expect([s.startPromptLevel, s.lastSuccessfulPromptLevel]).toEqual([0, 1]);
  });

  it('две пробы с моделью подряд со старта L0 по-прежнему поднимают старт', () => {
    const s0: AbaTargetState = { ...initialTargetState(T), phase: 'acquisition', startPromptLevel: 0 };
    const modelled = () => trial({ startPromptLevel: 0, promptLevelUsed: 3, response: 'prompted', emittedBeforePrompt: false });
    expect(applyTrialToFading(applyTrialToFading(s0, modelled(), T.format), modelled(), T.format).startPromptLevel).toBe(1);
  });

  it('возврат старта с L1 на L0 укорачивает задержку на шаг, но не ниже шага', () => {
    const s0: AbaTargetState = { ...initialTargetState(T), phase: 'acquisition', startPromptLevel: 1, currentDelayMs: 3000 };
    const atL1 = () => trial({ startPromptLevel: 1, promptLevelUsed: 1, response: 'prompted', emittedBeforePrompt: false });
    expect(applyTrialToFading(applyTrialToFading(s0, atL1(), T.format), atL1(), T.format).currentDelayMs).toBe(2000);
  });

  it('шаг задержки вверх — только при трёх обучающих пробах со старта L0 в блоке', () => {
    const s: AbaTargetState = { ...initialTargetState(T), currentDelayMs: 1000 };
    expect(applyBlockToDelay(s, T, [trial(), trial()]).currentDelayMs).toBe(1000);
    expect(applyBlockToDelay(s, T, [trial(), waited(), trial()]).currentDelayMs).toBe(2000);
  });
});
