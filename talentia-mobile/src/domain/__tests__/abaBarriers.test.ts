import type { AbaFormat, AbaTrial } from '../../types/aba';
import { applyChoiceBias, BARRIERS, choiceBiasIn, isOverTap, sessionSignals, type SignalSession } from '../abaBarriers';
import { initialTargetState } from '../abaPrompting';
import { target, trial } from './abaFixtures';

const pick = (chosen: string, field = ['a', 'b', 'c'], over: Partial<AbaTrial> = {}): AbaTrial =>
  trial({ response: 'independent', promptLevelUsed: 0, startPromptLevel: 0, field, chosenCardId: chosen, ...over });

const session = (index: number, trials: AbaTrial[]) => ({ index, trials });

describe('смещение по позиции и предпочтение карточки', () => {
  it('меньше 20 проб — флага нет', () => {
    expect(choiceBiasIn([session(1, Array.from({ length: 19 }, () => pick('a')))], 'identify')).toEqual([]);
  });

  it('поле 3: доля одной позиции ≥ 0,6 на 20 пробах — смещение по позиции', () => {
    // верная карточка разная, а выбор — всегда левая позиция
    const trials = Array.from({ length: 20 }, (_, i) => {
      const field = i % 2 ? ['a', 'b', 'c'] : ['b', 'c', 'a'];
      return pick(field[i < 13 ? 0 : 1], field);
    });
    expect(choiceBiasIn([session(1, trials)], 'identify')).toContain('position_bias');
  });

  it('одна карточка при любом поле — предпочтение карточки, а не позиции', () => {
    const fields = [['a', 'b', 'c'], ['b', 'a', 'c'], ['c', 'b', 'a']];
    const trials = Array.from({ length: 21 }, (_, i) => pick('a', fields[i % 3]));
    expect(choiceBiasIn([session(1, trials)], 'identify')).toEqual(['card_preference']);
  });

  it('пробы с подсказкой и при неполном поле не считаются; у match допустима L1', () => {
    const hinted = Array.from({ length: 20 }, () => pick('a', ['a', 'b', 'c'], { promptLevelUsed: 1, response: 'prompted' }));
    expect(choiceBiasIn([session(1, hinted)], 'identify')).toEqual([]);
    const l1 = Array.from({ length: 20 }, () => pick('a', ['a', 'b', 'c'], { promptLevelUsed: 1, response: 'incorrect' }));
    expect(choiceBiasIn([session(1, l1)], 'match')).toContain('position_bias');
    expect(choiceBiasIn([session(1, l1)], 'identify')).toEqual([]);
  });

  it('флаг снимается только после двух сессий подряд без условия', () => {
    const biased = session(1, Array.from({ length: 20 }, () => pick('a')));
    // выбор по кругу a, b, c в одном поле — позиции и карточки поровну
    const clean = (i: number) => session(i, Array.from({ length: 60 }, (_, k) => pick(['a', 'b', 'c'][k % 3])));
    let s = applyChoiceBias(initialTargetState(target), [biased], 'identify');
    expect(s.flags).toContain('position_bias');
    // в текущем окне условия нет, в предыдущем было — флаг держится
    s = applyChoiceBias(s, [biased, clean(2)], 'identify');
    expect(s.flags).toContain('position_bias');
    // второе окно подряд без условия — снят
    s = applyChoiceBias(s, [biased, clean(2), clean(3)], 'identify');
    expect(s.flags).not.toContain('position_bias');
  });
});

const fmt =
  (f: AbaFormat) =>
  (): AbaFormat =>
    f;
const sig = (index: number, trials: AbaTrial[], f: AbaFormat = 'identify'): SignalSession => ({ index, trials, formatOf: fmt(f) });

describe('сигналы сессии', () => {
  it('перебор: у identify лишних касаний ≥ 2, у match нужно два касания', () => {
    expect(isOverTap(trial({ tapCount: 3 }), 'identify')).toBe(true);
    expect(isOverTap(trial({ tapCount: 3 }), 'match')).toBe(false);
    expect(isOverTap(trial({ tapCount: 4 }), 'match')).toBe(true);
    expect(isOverTap(trial({ tapCount: 9 }), 'repeat_word')).toBe(false);
  });

  it('перебор — 30% проб касанием в двух сессиях подряд, минимум 5 проб', () => {
    const many = (i: number, over: number) =>
      sig(i, [...Array.from({ length: over }, () => trial({ tapCount: 4 })), ...Array.from({ length: 10 - over }, () => trial({ tapCount: 1 }))]);
    expect(sessionSignals([many(1, 3), many(2, 3)])).toContain('over_tapping');
    expect(sessionSignals([many(1, 3), many(2, 2)])).not.toContain('over_tapping');
    expect(sessionSignals([sig(1, Array.from({ length: 4 }, () => trial({ tapCount: 4 }))), sig(2, Array.from({ length: 4 }, () => trial({ tapCount: 4 })))])).toEqual([]);
  });

  it('слабая мотивация — 30% молчаний или два молчания на разогреве, две сессии подряд', () => {
    const silent = (i: number) =>
      sig(i, [...Array.from({ length: 2 }, () => trial({ response: 'no_response', latencyMs: null })), ...Array.from({ length: 4 }, () => trial())]);
    expect(sessionSignals([silent(1), silent(2)])).toContain('low_motivation');
    expect(sessionSignals([silent(1), sig(2, Array.from({ length: 6 }, () => trial()))])).not.toContain('low_motivation');
    const highP = (i: number) => sig(i, [trial({ kind: 'high_p', response: 'no_response', latencyMs: null }), trial({ kind: 'high_p', response: 'no_response', latencyMs: null }), ...Array.from({ length: 10 }, () => trial())]);
    expect(sessionSignals([highP(1), highP(2)])).toContain('low_motivation');
  });

  it('слабая мотивация по латентности — медиана в 1,5 раза выше пяти прошлых сессий', () => {
    const at = (i: number, ms: number) => sig(i, Array.from({ length: 6 }, () => trial({ latencyMs: ms })));
    const past = [1, 2, 3, 4, 5].map((i) => at(i, 1000));
    expect(sessionSignals([...past, at(6, 1600), at(7, 1600)])).toContain('low_motivation');
    expect(sessionSignals([...past, at(6, 1400), at(7, 1600)])).not.toContain('low_motivation');
    expect(BARRIERS.latencyRatio).toBe(1.5);
  });
});
