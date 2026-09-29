import {
  PARTICIPATION_AWARD,
  addTokens,
  awardForTrial,
  isBoardFull,
  tryExchange,
  newSchedule,
  reinforcerChoices,
  type Rng,
  type TokenBoard,
} from '../abaTokens';

/** Детерминированный генератор: перебирает значения по кругу. */
const cycle = (...xs: number[]): Rng => {
  let i = 0;
  return () => xs[i++ % xs.length];
};

const pool = ['puzzle', 'bubbles', 'drum', 'stickers', 'train', 'balloon'];

describe('жетоны за пробу', () => {
  const rng = cycle(0);

  const award = (r: Parameters<typeof awardForTrial>[0], kind: Parameters<typeof awardForTrial>[1] = 'teaching') => {
    const a = awardForTrial(r, kind, 'acquisition', newSchedule(rng), rng);
    return { tokens: a.tokens, feedback: a.feedback };
  };

  it('на усвоении жетон и похвала за каждый самостоятельный', () => {
    const a = awardForTrial('independent', 'teaching', 'acquisition', newSchedule(rng), rng);
    expect({ tokens: a.tokens, reason: a.reason, feedback: a.feedback }).toEqual({
      tokens: 1,
      reason: 'independent',
      feedback: 'token_praise',
    });
  });

  it('с подсказкой — похвала без жетона', () => {
    expect(award('prompted')).toEqual({ tokens: 0, feedback: 'praise' });
  });

  it('приближение подкрепляется похвалой: на шейпинге усилие не наказывается', () => {
    expect(award('approximation')).toEqual({ tokens: 0, feedback: 'praise' });
  });

  it('ошибка — нейтральная реакция без жетона', () => {
    expect([award('incorrect'), award('no_response')]).toEqual([
      { tokens: 0, feedback: 'neutral' },
      { tokens: 0, feedback: 'neutral' },
    ]);
  });

  it('базовая линия не подкрепляется: иначе она сама становится обучением', () => {
    expect(award('independent', 'baseline')).toEqual({ tokens: 0, feedback: 'neutral' });
  });

  it('разогрев на освоенной цели — жетон за первый верный, дальше похвала', () => {
    const s = newSchedule(cycle(0.99));
    const first = awardForTrial('independent', 'high_p', 'mastered', s, rng, false);
    const second = awardForTrial('independent', 'high_p', 'mastered', s, rng, true);
    expect([first.feedback, second.feedback]).toEqual(['token_praise', 'praise']);
  });

  it('разогрев и участие не заполняют доску на 5–6 без ответа по цели', () => {
    const s = newSchedule(rng);
    let paid = false;
    let board: TokenBoard = { size: 3, earned: 0 };
    for (let i = 0; i < 2; i += 1) {
      const a = awardForTrial('independent', 'high_p', 'mastered', s, rng, paid);
      paid = paid || a.tokens === 1;
      board = addTokens(board, a.tokens);
    }
    board = addTokens(board, PARTICIPATION_AWARD.tokens);
    expect(isBoardFull(board)).toBe(false);
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
        const a = awardForTrial('independent', 'maintenance', 'mastered', schedule, r);
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
    expect(tryExchange({ size: 3, earned: 5 })).toEqual({ board: { size: 3, earned: 0 }, exchanged: 5 });
  });

  it('неполная доска не обменивается и переходит дальше как есть', () => {
    expect(tryExchange({ size: 5, earned: 4 })).toEqual({ board: { size: 5, earned: 4 }, exchanged: 0 });
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
