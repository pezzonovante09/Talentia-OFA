import type { AbaPhase, AbaResponse, AbaTrialKind, PromptLevel } from '../../types/aba';
import {
  addTokens,
  awardForTrial,
  emptyBoard,
  isBoardFull,
  newSchedule,
  participationAward,
  reinforcerChoices,
  tryExchange,
  type Rng,
  type TokenBoard,
} from '../abaTokens';

/** Детерминированный генератор: перебирает значения по кругу. */
const cycle = (...xs: number[]): Rng => {
  let i = 0;
  return () => xs[i++ % xs.length];
};

const pool = ['puzzle', 'bubbles', 'drum', 'paint_drop', 'kaleidoscope', 'pinwheel'];

type Case = {
  response?: AbaResponse;
  kind?: AbaTrialKind;
  start?: PromptLevel;
  used?: PromptLevel;
  phase?: AbaPhase;
  board?: TokenBoard;
  highPTokenPaid?: boolean;
  counts?: boolean;
};

const rng = cycle(0);

function award(c: Case = {}) {
  const start = c.start ?? 0;
  const a = awardForTrial(
    { response: c.response ?? 'independent', kind: c.kind ?? 'teaching', startPromptLevel: start, promptLevelUsed: c.used ?? start },
    {
      phase: c.phase ?? 'acquisition',
      schedule: newSchedule(rng),
      board: c.board ?? emptyBoard(3),
      rng,
      highPTokenPaid: c.highPTokenPaid,
      counts: c.counts,
    },
  );
  return { tokens: a.tokens, feedback: a.feedback, reason: a.reason };
}

describe('жетон за ответ на стартовом уровне', () => {
  it('самостоятельный на старте L0 — жетон и похвала', () => {
    expect(award()).toEqual({ tokens: 1, feedback: 'token_praise', reason: 'at_start_level' });
  });

  it('безошибочный старт: верный с полной модели на старте L3 — тоже жетон', () => {
    expect(award({ response: 'prompted', start: 3, used: 3 }).tokens).toBe(1);
  });

  it('понадобилась эскалация сверх стартового — похвала без жетона', () => {
    expect(award({ response: 'prompted', start: 1, used: 3 })).toEqual({
      tokens: 0,
      feedback: 'praise',
      reason: undefined,
    });
  });

  it('приближение — похвала без жетона: на шейпинге усилие не наказывается', () => {
    expect(award({ response: 'approximation' }).feedback).toBe('praise');
    expect(award({ response: 'approximation' }).tokens).toBe(0);
  });

  it('ошибка — нейтральная реакция без жетона', () => {
    expect([award({ response: 'incorrect' }).feedback, award({ response: 'no_response' }).feedback]).toEqual([
      'neutral',
      'neutral',
    ]);
  });

  it('коррекция и закрывающая проба — похвала без жетона: иначе жетон оплачивал бы ошибку', () => {
    expect(award({ kind: 'correction', response: 'prompted', start: 2, used: 2 })).toMatchObject({
      tokens: 0,
      feedback: 'praise',
    });
    expect(award({ kind: 'closing', response: 'prompted', start: 3, used: 3 }).tokens).toBe(0);
  });

  it('базовая линия — нейтрально, что бы ребёнок ни ответил: внимание хвалят до инструкции', () => {
    expect(award({ kind: 'baseline' })).toMatchObject({ tokens: 0, feedback: 'neutral' });
    expect(award({ kind: 'baseline', response: 'no_response' }).feedback).toBe('neutral');
  });

  it('проба без права на критерий — «Tali послушал», без жетона', () => {
    expect(award({ counts: false })).toMatchObject({ tokens: 0, feedback: 'listened' });
  });

  it('разогрев — жетон за первый верный со своей причиной, дальше похвала', () => {
    const first = award({ kind: 'high_p', phase: 'mastered' });
    expect(first.reason).toBe('high_p');
    const second = award({ kind: 'high_p', phase: 'mastered', highPTokenPaid: true });
    expect([first.feedback, second.feedback]).toEqual(['token_praise', 'praise']);
  });

  it('на освоенной цели — прерывисто, через 2–4 верных', () => {
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
        const a = awardForTrial(
          { response: 'independent', kind: 'maintenance', startPromptLevel: 0, promptLevelUsed: 0 },
          { phase: 'mastered', schedule, board: emptyBoard(3), rng: r },
        );
        schedule = a.schedule;
        tokens = a.tokens;
        trials += 1;
      }
      expect(trials).toBe(expected);
    }
  });
});

describe('жетоны не за результат', () => {
  it('разогрев и участие не заполняют доску без ответа по цели: не больше size − 1', () => {
    let board = emptyBoard(3);
    const warm = award({ kind: 'high_p', phase: 'mastered', board });
    board = addTokens(board, warm.tokens, true);
    for (let block = 0; block < 2; block += 1) {
      const p = participationAward(board);
      board = addTokens(board, p.tokens, true);
    }
    expect(board).toEqual({ size: 3, earned: 2, nonContingent: 2 });
    expect(isBoardFull(board)).toBe(false);
  });

  it('последний жетон доски — за ответ по цели', () => {
    let board: TokenBoard = { size: 3, earned: 2, nonContingent: 2 };
    expect(award({ kind: 'high_p', phase: 'mastered', board }).tokens).toBe(0);
    board = addTokens(board, award({ board }).tokens);
    expect(isBoardFull(board)).toBe(true);
  });

  it('на полной доске жетон за участие не начисляется, даже когда место для жетона не за результат есть (№173)', () => {
    // nonContingent 0 < size − 1: прежнее правило дало бы 1 — жетон ушёл бы в обмен невидимым
    expect(participationAward({ size: 2, earned: 2, nonContingent: 0 }).tokens).toBe(0);
    expect(participationAward({ size: 1, earned: 1, nonContingent: 0 }).tokens).toBe(0);
    expect(participationAward({ size: 3, earned: 3, nonContingent: 0 }).tokens).toBe(0);
    // переполненная доска — тоже полная
    expect(participationAward({ size: 3, earned: 4, nonContingent: 0 }).tokens).toBe(0);
  });

  it('жетон за участие ложится в последнюю свободную ячейку и заполняет доску', () => {
    const board: TokenBoard = { size: 2, earned: 1, nonContingent: 0 };
    const p = participationAward(board);
    expect(p).toEqual({ tokens: 1, reason: 'participation' });
    expect(isBoardFull(addTokens(board, p.tokens, true))).toBe(true);
  });

  it('обмен начинает новый цикл доски', () => {
    expect(tryExchange({ size: 3, earned: 3, nonContingent: 2 }).board).toEqual(emptyBoard(3));
  });
});

describe('доска жетонов', () => {
  it('не срезает начисление по размеру доски', () => {
    expect(addTokens({ size: 3, earned: 2, nonContingent: 0 }, 3).earned).toBe(5);
  });

  it('жетоны не отнимаются', () => {
    expect(() => addTokens(emptyBoard(3), -1)).toThrow();
  });

  it('обмен забирает все жетоны, включая сверх доски', () => {
    expect(tryExchange({ size: 3, earned: 5, nonContingent: 1 })).toEqual({ board: emptyBoard(3), exchanged: 5 });
  });

  it('неполная доска не обменивается и переходит дальше как есть', () => {
    const board: TokenBoard = { size: 5, earned: 4, nonContingent: 1 };
    expect(tryExchange(board)).toEqual({ board, exchanged: 0 });
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
