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
