import type { AbaTargetState, AbaTrial } from '../../types/aba';
import {
  applyPromptDependence,
  applyTrialToFading,
  initialTargetState,
  isBreakdown,
  isPromptDependent,
  nextEscalation,
} from '../abaPrompting';
import { target, trial } from './abaFixtures';

const fade = (s: AbaTargetState, trials: AbaTrial[]) => trials.reduce(applyTrialToFading, s);

describe('подъём внутри пробы', () => {
  it('с L0 поднимается на L1, потом на L2, потом полная модель и конец пробы', () => {
    expect([1, 2, 3].map((p) => nextEscalation('teaching', 0, p))).toEqual([
      { kind: 'present', level: 1 },
      { kind: 'present', level: 2 },
      { kind: 'model_and_close' },
    ]);
  });

  it('больше двух эскалаций не бывает, даже если есть куда расти', () => {
    expect(nextEscalation('teaching', 0, 4)).toEqual({ kind: 'model_and_close' });
  });

  it('с полной модели подниматься некуда: L4 приложение не выдаёт', () => {
    expect(nextEscalation('teaching', 3, 1)).toEqual({ kind: 'model_and_close' });
  });

  it('проба переноса измеряет, а не учит: подсказки нет', () => {
    expect(nextEscalation('generalization', 0, 1)).toEqual({ kind: 'close' });
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
    const start = { ...initialTargetState(target), startPromptLevel: 1 as const };
    const s = fade(start, [
      trial({ startPromptLevel: 1, promptLevelUsed: 2, response: 'prompted' }),
      trial({ startPromptLevel: 1, promptLevelUsed: 3, response: 'no_response' }),
    ]);
    expect(s.startPromptLevel).toBe(2);
  });

  it('успех между двумя неудачами рвёт серию', () => {
    const start = { ...initialTargetState(target), startPromptLevel: 1 as const };
    const s = fade(start, [
      trial({ startPromptLevel: 1, promptLevelUsed: 2, response: 'prompted' }),
      trial({ startPromptLevel: 1, promptLevelUsed: 1, response: 'prompted' }),
      trial({ startPromptLevel: 1, promptLevelUsed: 2, response: 'prompted' }),
    ]);
    expect(s.startPromptLevel).toBe(1);
  });

  it('ниже L0 не опускается', () => {
    const start = { ...initialTargetState(target), startPromptLevel: 0 as const };
    const s = fade(start, [trial(), trial(), trial()]);
    expect(s.startPromptLevel).toBe(0);
  });

  it('приближение и прерванная проба уровень не двигают', () => {
    const start = { ...initialTargetState(target), consecutiveIndependentAtStart: 1 };
    const s = fade(start, [
      trial({ startPromptLevel: 3, promptLevelUsed: 3, response: 'approximation' }),
      trial({ startPromptLevel: 3, promptLevelUsed: 3, response: 'interrupted' }),
    ]);
    expect({ уровень: s.startPromptLevel, серия: s.consecutiveIndependentAtStart }).toEqual({
      уровень: 3,
      серия: 1,
    });
  });

  it('пробы переноса и поддержания затухание не двигают', () => {
    const s = fade(initialTargetState(target), [
      trial({ kind: 'generalization', startPromptLevel: 3, promptLevelUsed: 3, response: 'prompted' }),
      trial({ kind: 'maintenance', startPromptLevel: 3, promptLevelUsed: 3, response: 'prompted' }),
    ]);
    expect(s.startPromptLevel).toBe(3);
  });

  it('запоминает уровень последнего успеха — к нему возвращает провал поддержания', () => {
    const s = fade(initialTargetState(target), [
      trial({ startPromptLevel: 3, promptLevelUsed: 2, response: 'prompted' }),
      trial({ startPromptLevel: 3, promptLevelUsed: 3, response: 'incorrect' }),
    ]);
    expect(s.lastSuccessfulPromptLevel).toBe(2);
  });
});

describe('критерий остановки', () => {
  const failAtMax = () => trial({ startPromptLevel: 3, promptLevelUsed: 3, response: 'no_response' });

  it('три подряд провала на полной модели останавливают сессию', () => {
    expect(isBreakdown([trial(), failAtMax(), failAtMax(), failAtMax()])).toBe(true);
  });

  it('провал ниже полной модели не считается', () => {
    const lower = trial({ startPromptLevel: 0, promptLevelUsed: 2, response: 'no_response' });
    expect(isBreakdown([failAtMax(), failAtMax(), lower])).toBe(false);
  });

  it('прерванная проба серию не рвёт', () => {
    const cut = trial({ response: 'interrupted' });
    expect(isBreakdown([failAtMax(), cut, failAtMax(), failAtMax()])).toBe(true);
  });
});

describe('зависимость от подсказки', () => {
  const waitsForPrompt = () =>
    trial({ startPromptLevel: 0, promptLevelUsed: 1, response: 'prompted', latencyMs: 3400 });
  const session = (make: () => AbaTrial) => Array.from({ length: 5 }, make);

  it('молчит до подсказки три сессии подряд — флаг', () => {
    const sessions = [session(waitsForPrompt), session(waitsForPrompt), session(waitsForPrompt)];
    expect(isPromptDependent(sessions, 3000)).toBe(true);
  });

  it('ошибается быстро — это не зависимость, а неумение', () => {
    const fastWrong = () =>
      trial({ startPromptLevel: 0, promptLevelUsed: 1, response: 'prompted', latencyMs: 800 });
    const sessions = [session(fastWrong), session(fastWrong), session(fastWrong)];
    expect(isPromptDependent(sessions, 3000)).toBe(false);
  });

  it('без проб на L0 судить не по чему', () => {
    const atL2 = () => trial({ startPromptLevel: 2, promptLevelUsed: 2, response: 'prompted' });
    expect(isPromptDependent([session(atL2), session(atL2), session(atL2)], 3000)).toBe(false);
  });

  it('двух сессий мало', () => {
    expect(isPromptDependent([session(waitsForPrompt), session(waitsForPrompt)], 3000)).toBe(false);
  });

  it('реакция: задержка +1 с, старт с L0, флаг не дублируется', () => {
    let s: AbaTargetState = { ...initialTargetState(target), startPromptLevel: 2 };
    s = applyPromptDependence(applyPromptDependence(s));
    expect({ delay: s.currentDelayMs, уровень: s.startPromptLevel, флаги: s.flags }).toEqual({
      delay: 5000,
      уровень: 0,
      флаги: ['prompt_dependent'],
    });
  });
});
