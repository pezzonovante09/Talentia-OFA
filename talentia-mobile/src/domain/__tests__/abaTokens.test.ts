import {
  addTokens,
  awardForTrial,
  exchange,
  newSchedule,
  reinforcerChoices,
  type Rng,
} from '../abaTokens';

/** Детерминированный генератор: перебирает значения по кругу. */
const cycle = (...xs: number[]): Rng => {
  let i = 0;
  return () => xs[i++ % xs.length];
};

const pool = ['puzzle', 'bubbles', 'drum', 'stickers', 'train', 'balloon'];

describe('жетоны за пробу', () => {
  const rng = cycle(0);

  it('на усвоении жетон за каждый самостоятельный', () => {
    const a = awardForTrial('independent', 'acquisition', newSchedule(rng), rng);
    expect({ tokens: a.tokens, reason: a.reason }).toEqual({ tokens: 1, reason: 'independent' });
  });

  it('с подсказкой — похвала без жетона', () => {
    expect(awardForTrial('prompted', 'acquisition', newSchedule(rng), rng).tokens).toBe(0);
  });

  it('ошибка и приближение жетона не дают', () => {
    const s = newSchedule(rng);
    expect(
      (['incorrect', 'no_response', 'approximation'] as const).map(
        (r) => awardForTrial(r, 'acquisition', s, rng).tokens,
      ),
    ).toEqual([0, 0, 0]);
  });

  it('на освоенной цели — прерывисто, через 2–4 самостоятельных', () => {
    for (const [value, expected] of [
      [0, 2],
      [0.5, 3],
      [0.99, 4],
    ] as const) {
      const r = cycle(value);
      let schedule = newSchedule(r);
      let trials = 0;
      let tokens = 0;
      while (tokens === 0) {
        const a = awardForTrial('independent', 'mastered', schedule, r);
        schedule = a.schedule;
        tokens = a.tokens;
        trials += 1;
      }
      expect(trials).toBe(expected);
    }
  });
});

describe('доска жетонов', () => {
  it('не срезает начисление по размеру доски', () => {
    expect(addTokens({ size: 3, earned: 2 }, 3).earned).toBe(5);
  });

  it('жетоны не отнимаются', () => {
    expect(() => addTokens({ size: 3, earned: 2 }, -1)).toThrow();
  });

  it('обмен забирает все жетоны, включая сверх доски', () => {
    expect(exchange({ size: 3, earned: 5 })).toEqual({ board: { size: 3, earned: 0 }, exchanged: 5 });
  });
});

describe('выбор подкрепителя', () => {
  it('предлагает три разных', () => {
    const choices = reinforcerChoices(pool, [], cycle(0.3, 0.7, 0.1));
    expect(new Set(choices).size).toBe(3);
  });

  it('выбранное дважды подряд в третий раз не предлагается', () => {
    for (let k = 0; k < 20; k += 1) {
      const choices = reinforcerChoices(pool, ['drum', 'puzzle', 'puzzle'], cycle(k / 20, 0.5));
      expect(choices).not.toContain('puzzle');
    }
  });

  it('разные выборы подряд ничего не блокируют', () => {
    // 0.99 — перестановка без обменов: берутся первые три из пула как есть
    expect(reinforcerChoices(pool, ['puzzle', 'drum'], cycle(0.99))).toEqual(['puzzle', 'bubbles', 'drum']);
  });

  it('пул меньше шести — ошибка автора', () => {
    expect(() => reinforcerChoices(pool.slice(0, 5), [], cycle(0))).toThrow();
  });
});
