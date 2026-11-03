/** Последствие от markedAt (Ц2.6.1): плашка только у token_praise, похвала голосом, следующий SD в +5000. */
import { UNDO_WINDOW_MS } from '../../../domain/abaUndo';
import { advanceConsequence, consequenceDueAt, startConsequence } from '../model/consequenceRun';

const M = 1_000_000;
const kinds = (run: ReturnType<typeof startConsequence>) => run.plan.map((p) => [p.at - M, p.effect.kind === 'say' ? `say:${p.effect.key}` : p.effect.kind]);

describe('последствие', () => {
  it('жетон: плашка в 0, приземление 340, похвала 700, уход 4000, пустые плиты 4000, SD в 5000', () => {
    expect(kinds(startConsequence({ markedAt: M, feedback: 'token_praise', calm: false }))).toEqual([
      [0, 'overlay_show'],
      [340, 'token_land'],
      [700, 'say:praise'],
      [4000, 'overlay_hide'],
      [4000, 'plates_empty'],
      [UNDO_WINDOW_MS, 'next_sd'],
    ]);
  });

  it('calm: жетон появляется в 120, похвала в 500', () => {
    const k = kinds(startConsequence({ markedAt: M, feedback: 'token_praise', calm: true }));
    expect(k).toContainEqual([120, 'token_land']);
    expect(k).toContainEqual([500, 'say:praise']);
  });

  it('без жетона — без плашки: похвала только голосом; нейтрально — ничего', () => {
    expect(kinds(startConsequence({ markedAt: M, feedback: 'praise', calm: false }))).toEqual([
      [300, 'say:praise'],
      [4000, 'plates_empty'],
      [5000, 'next_sd'],
    ]);
    expect(kinds(startConsequence({ markedAt: M, feedback: 'neutral', calm: false }))).toEqual([
      [4000, 'plates_empty'],
      [5000, 'next_sd'],
    ]);
  });

  it('жетон, добавленный отменой, отодвигает SD на 1000 после приземления', () => {
    const run = startConsequence({ markedAt: M, feedback: 'neutral', calm: false, tokenAddedLandedAt: M + 4500 });
    expect(run.plan.at(-1)).toEqual({ at: M + 5500, effect: { kind: 'next_sd' } });
  });

  describe('жетон пробы заполнил доску — обмен через 700 после посадки (№172, Ц4.5 п. 1)', () => {
    const fills = (calm: boolean) => startConsequence({ markedAt: M, feedback: 'token_praise', calm, exchange: true });

    it('плашка в 0, посадка 340, похвала 700, смена кадра на обмен в 1040 — и больше ничего', () => {
      expect(kinds(fills(false))).toEqual([
        [0, 'overlay_show'],
        [340, 'token_land'],
        [700, 'say:praise'],
        [1040, 'exchange'],
      ]);
    });

    it('calm и «уменьшить движение»: появление в 120, похвала 500, обмен в 820', () => {
      expect(kinds(fills(true))).toEqual([
        [0, 'overlay_show'],
        [120, 'token_land'],
        [500, 'say:praise'],
        [820, 'exchange'],
      ]);
    });

    it('похвала начинается до смены кадра — в обоих режимах', () => {
      for (const calm of [false, true]) {
        const k = kinds(fills(calm));
        const at = (kind: string) => k.find(([, x]) => x === kind)![0] as number;
        expect(at('say:praise')).toBeLessThan(at('exchange'));
      }
    });

    it('на этом пути нет ухода плашки, пустых плит и следующего SD', () => {
      for (const calm of [false, true]) {
        const effects = kinds(fills(calm)).map(([, x]) => x);
        expect(effects).not.toContain('overlay_hide');
        expect(effects).not.toContain('plates_empty');
        expect(effects).not.toContain('next_sd');
      }
    });

    it('обмен — последний срок: после него расписание кончилось', () => {
      let run = fills(false);
      const a = advanceConsequence(run, M + 1039);
      expect(a.effects.map((e) => e.kind)).toEqual(['overlay_show', 'token_land', 'say']);
      run = a.run;
      expect(consequenceDueAt(run)).toBe(M + 1040);
      const b = advanceConsequence(run, M + 1040);
      expect(b.effects).toEqual([{ kind: 'exchange' }]);
      expect(consequenceDueAt(b.run)).toBeNull();
    });

    it.each(['praise', 'neutral', 'listened'] as const)('без token_praise (%s) флаг обмена не действует — обычное расписание', (feedback) => {
      const withFlag = startConsequence({ markedAt: M, feedback, calm: false, exchange: true });
      const without = startConsequence({ markedAt: M, feedback, calm: false });
      expect(withFlag.plan).toEqual(without.plan);
      expect(kinds(withFlag).map(([, x]) => x)).not.toContain('exchange');
    });

    it('без флага token_praise идёт по Ц2.6: обмена нет, плашка уходит в 4000', () => {
      const k = kinds(startConsequence({ markedAt: M, feedback: 'token_praise', calm: false, exchange: false }));
      expect(k.map(([, x]) => x)).not.toContain('exchange');
      expect(k).toContainEqual([4000, 'overlay_hide']);
    });
  });

  it('advance выдаёт наступившие события по порядку, dueAt — следующий срок', () => {
    let run = startConsequence({ markedAt: M, feedback: 'token_praise', calm: false });
    expect(consequenceDueAt(run)).toBe(M);
    const a = advanceConsequence(run, M + 700);
    expect(a.effects.map((e) => e.kind)).toEqual(['overlay_show', 'token_land', 'say']);
    run = a.run;
    expect(consequenceDueAt(run)).toBe(M + 4000);
    run = advanceConsequence(run, M + 10_000).run;
    expect(consequenceDueAt(run)).toBeNull();
  });
});
