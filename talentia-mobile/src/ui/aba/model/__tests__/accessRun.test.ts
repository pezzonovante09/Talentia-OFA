/**
 * Модель доступа к подкрепителю (раздел 8, №169): play → settle → gap → done; «закругляемся» за 5 с до конца только
 * у доступа длиннее 5 с; просроченные стадии проходят разом, каждый эффект — один раз; доигрывание ≤ 3 с.
 */
import { abaAccessScene } from '../../../../design/abaTokens';
import { accessDueAt, accessEndsAt, accessLeft, startAccess, stepAccess, type AccessEffect } from '../accessRun';

const types = (fx: AccessEffect[]) => fx.map((f) => f.type);
const CUE = abaAccessScene.endCue.beforeEndMs;
const GAP = abaAccessScene.endSettleMs;

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

describe('стадии', () => {
  it('в T сцена кончается; без доигрывания кольцо исчезает в тот же момент', () => {
    const cued = stepAccess(startAccess(0, 20_000), 15_000).run;
    const { run, effects } = stepAccess(cued, 20_000);
    expect(types(effects)).toEqual(['scene_ended', 'ring_hidden']);
    expect(run.stage).toBe('gap');
  });

  it('с доигрыванием: settle до T + settleMs, кольцо исчезает потом', () => {
    const cued = stepAccess(startAccess(0, 20_000, 2000), 15_000).run;
    const atT = stepAccess(cued, 20_000);
    expect(types(atT.effects)).toEqual(['scene_ended']);
    expect(atT.run.stage).toBe('settle');
    expect(accessDueAt(atT.run)).toBe(22_000);
    const after = stepAccess(atT.run, 22_000);
    expect(types(after.effects)).toEqual(['ring_hidden']);
    expect(after.run.stage).toBe('gap');
  });

  it('пауза после кольца — endSettleMs; затем done с моментом по сроку', () => {
    const gap = stepAccess(startAccess(0, 20_000, 2000), 22_000).run;
    expect(gap.stage).toBe('gap');
    expect(accessDueAt(gap)).toBe(22_000 + GAP);
    expect(stepAccess(gap, 22_000 + GAP - 1).effects).toEqual([]);
    const { run, effects } = stepAccess(gap, 22_000 + GAP);
    expect(effects).toEqual([{ type: 'done', at: 22_000 + GAP }]);
    expect(run.stage).toBe('done');
  });

  it('done — сроков больше нет, эффектов тоже', () => {
    const done = stepAccess(startAccess(0, 20_000), 1e9).run;
    expect(accessDueAt(done)).toBeNull();
    expect(stepAccess(done, 2e9).effects).toEqual([]);
  });

  it('accessEndsAt — начало плюс длительность: время ребёнка не урезается', () => {
    expect(accessEndsAt(startAccess(500, 40_000))).toBe(40_500);
  });
});

describe('просроченные стадии', () => {
  it('один шаг далеко за концом — эффекты по порядку, каждый один раз; «закругляемся» после конца не звучит', () => {
    const { run, effects } = stepAccess(startAccess(0, 20_000, 1000), 10 * 60_000);
    expect(types(effects)).toEqual(['scene_ended', 'ring_hidden', 'done']);
    expect(run.stage).toBe('done');
  });

  it('done просроченного доступа несёт срок по расписанию, а не момент шага', () => {
    const { effects } = stepAccess(startAccess(0, 20_000, 1000), 10 * 60_000);
    expect(effects.at(-1)).toEqual({ type: 'done', at: 20_000 + 1000 + GAP });
  });

  it('просрочка после cue — без второго cue', () => {
    const cued = stepAccess(startAccess(0, 20_000), 15_000).run;
    expect(types(stepAccess(cued, 10 * 60_000).effects)).toEqual(['scene_ended', 'ring_hidden', 'done']);
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

  it('потолок доигрывания — 3000 мс', () => {
    expect(abaAccessScene.settleMaxMs).toBe(3000);
  });

  it('обрезанное доигрывание двигает срок settle на 3000, а не на запрошенное', () => {
    const settle = stepAccess(startAccess(0, 20_000, 10_000), 20_000).run;
    expect(accessDueAt(settle)).toBe(23_000);
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
});
