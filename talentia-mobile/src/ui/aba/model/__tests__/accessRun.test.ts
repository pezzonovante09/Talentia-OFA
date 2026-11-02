/**
 * Модель доступа к подкрепителю (раздел 8, кадр конца Ц3.5, №171): play → settle → fold → hold → done; кольцо
 * уходит в T; «закругляемся» за 5 с до конца только у доступа длиннее 5 с; просроченные стадии проходят разом,
 * каждый эффект — один раз; доигрывание ≤ 2 с; сворачивание `endFrame.foldMs` (calm — смена кадра), карточка
 * стоит `endSettleMs`.
 */
import { abaAccessScene } from '../../../../design/abaTokens';
import { accessDueAt, accessEndsAt, accessLeft, accessRingVisible, startAccess, stepAccess, type AccessEffect } from '../accessRun';

const types = (fx: AccessEffect[]) => fx.map((f) => f.type);
const CUE = abaAccessScene.endCue.beforeEndMs;
const FOLD = abaAccessScene.endFrame.foldMs;
const HOLD = abaAccessScene.endSettleMs;

describe('сигнал «закругляемся»', () => {
  it('доступ 20 с: первый срок — за 5 с до конца', () => {
    expect(accessDueAt(startAccess(1000, 20_000))).toBe(1000 + 20_000 - CUE);
  });

  it('до срока сигнала эффектов нет', () => {
    const r = startAccess(0, 20_000);
    expect(stepAccess(r, 20_000 - CUE - 1).effects).toEqual([]);
  });

  it('в срок — один cue, сцена ещё играет', () => {
    const { run, effects } = stepAccess(startAccess(0, 20_000), 20_000 - CUE);
    expect(types(effects)).toEqual(['cue']);
    expect([run.stage, run.cued]).toEqual(['play', true]);
  });

  it('повторный шаг в тот же момент cue не повторяет', () => {
    const once = stepAccess(startAccess(0, 20_000), 20_000 - CUE).run;
    expect(stepAccess(once, 20_000 - CUE).effects).toEqual([]);
  });

  it.each([CUE, CUE - 1, 1000])('доступ %i мс (не длиннее 5 с) — без cue, первый срок — конец', (ms) => {
    const r = startAccess(0, ms);
    expect(accessDueAt(r)).toBe(ms);
    expect(types(stepAccess(r, ms).effects)).not.toContain('cue');
  });

  it('доступ 5001 мс — cue есть, через 1 мс после начала', () => {
    const r = startAccess(0, CUE + 1);
    expect(accessDueAt(r)).toBe(1);
    expect(types(stepAccess(r, 1).effects)).toEqual(['cue']);
  });
});

describe('кадр конца (Ц3.5)', () => {
  it('токены кадра конца: доигрывание не дольше 2000, сворачивание 360, карточка стоит 1000', () => {
    expect([abaAccessScene.settleMaxMs, FOLD, HOLD]).toEqual([2000, 360, 1000]);
  });

  it('за 1 мс до T сцена ещё играет', () => {
    const cued = stepAccess(startAccess(0, 20_000), 15_000).run;
    const { run, effects } = stepAccess(cued, 19_999);
    expect(effects).toEqual([]);
    expect(run.stage).toBe('play');
  });

  it('без доигрывания: в T сцена кончается с моментом T и сразу начинает сворачиваться', () => {
    const cued = stepAccess(startAccess(0, 20_000), 15_000).run;
    const { run, effects } = stepAccess(cued, 20_000);
    expect(effects).toEqual([{ type: 'scene_ended', at: 20_000 }, { type: 'fold' }]);
    expect(run.stage).toBe('fold');
  });

  it('с доигрыванием: в T — только scene_ended, settle до T + settleMs, затем fold', () => {
    const cued = stepAccess(startAccess(0, 20_000, 1500), 15_000).run;
    const atT = stepAccess(cued, 20_000);
    expect(types(atT.effects)).toEqual(['scene_ended']);
    expect(atT.run.stage).toBe('settle');
    expect(accessDueAt(atT.run)).toBe(21_500);
    expect(stepAccess(atT.run, 21_499).effects).toEqual([]);
    const after = stepAccess(atT.run, 21_500);
    expect(types(after.effects)).toEqual(['fold']);
    expect(after.run.stage).toBe('fold');
  });

  it('сворачивание длится foldMs, затем hold без эффекта', () => {
    const fold = stepAccess(startAccess(0, 20_000), 20_000).run;
    expect(accessDueAt(fold)).toBe(20_000 + FOLD);
    const { run, effects } = stepAccess(fold, 20_000 + FOLD);
    expect(effects).toEqual([]);
    expect(run.stage).toBe('hold');
  });

  it('карточка стоит endSettleMs; done несёт момент по сроку', () => {
    const hold = stepAccess(startAccess(0, 20_000), 20_000 + FOLD).run;
    expect(accessDueAt(hold)).toBe(20_000 + FOLD + HOLD);
    expect(stepAccess(hold, 20_000 + FOLD + HOLD - 1).effects).toEqual([]);
    const { run, effects } = stepAccess(hold, 20_000 + FOLD + HOLD);
    expect(effects).toEqual([{ type: 'done', at: 20_000 + FOLD + HOLD }]);
    expect(run.stage).toBe('done');
  });

  it('calm: сворачивание — смена кадра; в T сразу hold, done через endSettleMs', () => {
    const cued = stepAccess(startAccess(0, 20_000, 0, true), 15_000).run;
    const atT = stepAccess(cued, 20_000);
    expect(types(atT.effects)).toEqual(['scene_ended', 'fold']);
    expect(atT.run.stage).toBe('hold');
    expect(accessDueAt(atT.run)).toBe(20_000 + HOLD);
    expect(stepAccess(atT.run, 20_000 + HOLD).effects).toEqual([{ type: 'done', at: 20_000 + HOLD }]);
  });

  it('done — сроков больше нет, эффектов тоже', () => {
    const done = stepAccess(startAccess(0, 20_000), 1e9).run;
    expect(accessDueAt(done)).toBeNull();
    expect(stepAccess(done, 2e9).effects).toEqual([]);
  });

  it('accessEndsAt — начало плюс длительность: время ребёнка не урезается доигрыванием и calm', () => {
    expect(accessEndsAt(startAccess(500, 40_000))).toBe(40_500);
    expect(accessEndsAt(startAccess(500, 40_000, 2000, true))).toBe(40_500);
  });
});

describe('просроченные стадии', () => {
  it('один шаг далеко за концом — эффекты по порядку, каждый один раз; «закругляемся» после конца не звучит', () => {
    const { run, effects } = stepAccess(startAccess(0, 20_000, 1000), 10 * 60_000);
    expect(types(effects)).toEqual(['scene_ended', 'fold', 'done']);
    expect(run.stage).toBe('done');
  });

  it('scene_ended и done просроченного доступа несут сроки по расписанию, а не момент шага', () => {
    const { effects } = stepAccess(startAccess(0, 20_000, 1000), 10 * 60_000);
    expect(effects[0]).toEqual({ type: 'scene_ended', at: 20_000 });
    expect(effects.at(-1)).toEqual({ type: 'done', at: 20_000 + 1000 + FOLD + HOLD });
  });

  it('просрочка после cue — без второго cue', () => {
    const cued = stepAccess(startAccess(0, 20_000), 15_000).run;
    expect(types(stepAccess(cued, 10 * 60_000).effects)).toEqual(['scene_ended', 'fold', 'done']);
  });
});

describe('доигрывание обрезается', () => {
  it.each([
    [10_000, abaAccessScene.settleMaxMs],
    [abaAccessScene.settleMaxMs, abaAccessScene.settleMaxMs],
    [1200, 1200],
    [-500, 0],
  ])('settleMs %i → %i', (asked, got) => {
    expect(startAccess(0, 20_000, asked).settleMs).toBe(got);
  });

  it('обрезанное доигрывание двигает срок settle на 2000, а не на запрошенное', () => {
    const settle = stepAccess(startAccess(0, 20_000, 10_000), 20_000).run;
    expect(accessDueAt(settle)).toBe(22_000);
  });
});

describe('кольцо', () => {
  it('в play — доля оставшегося времени', () => {
    expect(accessLeft(startAccess(0, 20_000), 5000)).toBeCloseTo(0.75);
  });

  it('до начала — не больше 1, после T в play — не меньше 0', () => {
    const r = startAccess(1000, 20_000);
    expect([accessLeft(r, 0), accessLeft(r, 99_000)]).toEqual([1, 0]);
  });

  it('в settle кольцо пусто', () => {
    const settle = stepAccess(startAccess(0, 20_000, 2000), 20_000).run;
    expect(accessLeft(settle, 20_500)).toBe(0);
  });

  it('кольцо видно, пока сцена играет, и после «закругляемся»', () => {
    const r = startAccess(0, 20_000);
    expect(accessRingVisible(r)).toBe(true);
    expect(accessRingVisible(stepAccess(r, 15_000).run)).toBe(true);
  });

  it('кольцо уходит в T — и при доигрывании, и без него', () => {
    expect(accessRingVisible(stepAccess(startAccess(0, 20_000, 2000), 20_000).run)).toBe(false);
    expect(accessRingVisible(stepAccess(startAccess(0, 20_000), 20_000).run)).toBe(false);
  });

  it('на кадре конца и после него кольца нет', () => {
    const r = startAccess(0, 20_000);
    expect(accessRingVisible(stepAccess(r, 20_000 + FOLD).run)).toBe(false);
    expect(accessRingVisible(stepAccess(r, 1e9).run)).toBe(false);
  });
});
