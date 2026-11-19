/**
 * Проба шага «коснись картинки» — чистая модель (`sampleTouchRun.ts`), правки 2026-11-19 (методист, `child-ux-specialist`):
 * задержка модели L3 в одном кадре с новой картинкой и касание «рука в руке» на карточке L4 (только контур, без записи).
 * Лестница, отказ и запись в домен — `src/domain/__tests__/abaSampleTouch.test.ts`.
 */
import { abaSampleTouch } from '../../../../design/abaTokens';
import { sampleTouchDueAt, sampleTouchInput, startSampleTouch, stepSampleTouch, touchLevel, touchModelDelayMs, type SampleTouchRun, type SampleTouchStep } from '../sampleTouchRun';

const SHOWN = 10_000;
const step: SampleTouchStep = { kind: 'sample_touch', sampleId: 'x', startLevel: 0, delayMs: 4000, windowMs: 5000, l4Available: true, index: 0, closes: false, pauseBeforeMs: 0 };
const fromL3: SampleTouchStep = { ...step, startLevel: 3 };
const D = abaSampleTouch.modelDelayMs;

/** Сроки модели до карточки L4 или конца пробы. */
function runOut(r: SampleTouchRun): SampleTouchRun {
  let x = r;
  for (let i = 0; i < 10 && sampleTouchDueAt(x) !== null; i += 1) x = stepSampleTouch(x, { type: 'due', at: sampleTouchDueAt(x)! });
  return x;
}

describe('задержка модели L3 в одном кадре с новой картинкой', () => {
  it('старт с L3: задержка 600, срок — задержка + окно от показа кадра', () => {
    const r = startSampleTouch(fromL3, SHOWN);
    expect(D).toBe(600);
    expect(touchModelDelayMs(r)).toBe(D);
    expect(sampleTouchDueAt(r)).toBe(SHOWN + D + fromL3.windowMs);
  });

  it('старт с L3: срок по одному окну (без задержки) пробу не двигает; в задержка + окно — карточка L4', () => {
    let r = startSampleTouch(fromL3, SHOWN);
    r = stepSampleTouch(r, { type: 'due', at: SHOWN + fromL3.windowMs });
    expect([r.done, r.awaitingL4, r.log.length]).toEqual([false, false, 1]);
    r = stepSampleTouch(r, { type: 'due', at: SHOWN + D + fromL3.windowMs - 1 });
    expect(r.awaitingL4).toBe(false);
    r = stepSampleTouch(r, { type: 'due', at: SHOWN + D + fromL3.windowMs });
    expect([r.done, r.awaitingL4]).toEqual([false, true]);
    // на карточке L4 задержка прежняя: предъявление то же, модель заново не идёт
    expect(touchModelDelayMs(r)).toBe(D);
    expect(sampleTouchDueAt(r)).toBeNull();
  });

  it('эскалация L0 → L1 → L3: задержки нет ни на одном уровне, сроки — задержка по полосе и окна подряд', () => {
    let r = startSampleTouch(step, SHOWN);
    expect([touchLevel(r), touchModelDelayMs(r), sampleTouchDueAt(r)]).toEqual([0, 0, SHOWN + 4000]);
    r = stepSampleTouch(r, { type: 'due', at: SHOWN + 4000 });
    expect([touchLevel(r), touchModelDelayMs(r), sampleTouchDueAt(r)]).toEqual([1, 0, SHOWN + 9000]);
    r = stepSampleTouch(r, { type: 'due', at: SHOWN + 9000 });
    expect([touchLevel(r), touchModelDelayMs(r), sampleTouchDueAt(r)]).toEqual([3, 0, SHOWN + 14_000]);
  });

  it('старт с L1: задержки нет, и у модели после него — тоже', () => {
    let r = startSampleTouch({ ...step, startLevel: 1 }, SHOWN);
    expect([touchModelDelayMs(r), sampleTouchDueAt(r)]).toEqual([0, SHOWN + 5000]);
    r = stepSampleTouch(r, { type: 'due', at: SHOWN + 5000 });
    expect([touchLevel(r), touchModelDelayMs(r), sampleTouchDueAt(r)]).toEqual([3, 0, SHOWN + 10_000]);
  });

  it('касание до начала модели закрывает пробу как `touched` на уровне 3; латентность — от показа кадра', () => {
    const r = stepSampleTouch(startSampleTouch(fromL3, SHOWN), { type: 'tap_sample', at: SHOWN + 250 });
    expect(r.done).toBe(true);
    expect(sampleTouchInput(r)).toEqual({ startLevel: 3, levelUsed: 3, outcome: 'touched', adultPrompted: false, latencyMs: 250 });
  });

  it('касание после начала модели: латентность по-прежнему от показа кадра, а не от начала модели', () => {
    const r = stepSampleTouch(startSampleTouch(fromL3, SHOWN), { type: 'tap_sample', at: SHOWN + D + 900 });
    expect(sampleTouchInput(r)).toMatchObject({ levelUsed: 3, outcome: 'touched', latencyMs: D + 900 });
  });

  it('касание в последнюю миллисекунду продлённого окна ещё засчитывается', () => {
    const at = SHOWN + D + fromL3.windowMs - 1;
    let r = stepSampleTouch(startSampleTouch(fromL3, SHOWN), { type: 'due', at });
    r = stepSampleTouch(r, { type: 'tap_sample', at });
    expect(sampleTouchInput(r)).toMatchObject({ outcome: 'touched', levelUsed: 3, latencyMs: D + fromL3.windowMs - 1 });
  });

  it('старт с L3 без L4: без касания проба кончается в задержка + окно, не раньше', () => {
    let r = startSampleTouch({ ...fromL3, l4Available: false }, SHOWN);
    r = stepSampleTouch(r, { type: 'due', at: SHOWN + fromL3.windowMs });
    expect(r.done).toBe(false);
    r = runOut(r);
    expect(sampleTouchInput(r)).toMatchObject({ outcome: 'no_response', levelUsed: 3, latencyMs: null });
  });
});

describe('касание «рука в руке» на карточке L4 — только контур', () => {
  const atL4 = () => {
    const r = runOut(startSampleTouch(step, SHOWN));
    expect(r.awaitingL4).toBe(true);
    return r;
  };

  it('до касания отметки нет', () => {
    expect(startSampleTouch(step, SHOWN).l4Touched).toBeUndefined();
    expect(atL4().l4Touched).toBeUndefined();
  });

  it('касание образца на карточке L4 ставит отметку, пробу не закрывает и момента касания не пишет', () => {
    const r = stepSampleTouch(atL4(), { type: 'tap_sample', at: SHOWN + 20_000 });
    expect(r.l4Touched).toBe(true);
    expect([r.done, r.awaitingL4, r.outcome, r.touchedAt]).toEqual([false, true, null, null]);
    expect(sampleTouchDueAt(r)).toBeNull();
  });

  it('запись после касания на карточке L4 взять нельзя: проба не закончена', () => {
    const r = stepSampleTouch(atL4(), { type: 'tap_sample', at: SHOWN + 20_000 });
    expect(() => sampleTouchInput(r)).toThrow('проба шага не закончена');
  });

  it('повторные касания на карточке L4 ничего не меняют', () => {
    const once = stepSampleTouch(atL4(), { type: 'tap_sample', at: SHOWN + 20_000 });
    const twice = stepSampleTouch(once, { type: 'tap_sample', at: SHOWN + 20_500 });
    expect(twice).toEqual(once);
  });

  it('«Сделали вместе» после касания — уровень 4 без латентности; источник записи — кнопка взрослого', () => {
    let r = stepSampleTouch(atL4(), { type: 'tap_sample', at: SHOWN + 20_000 });
    r = stepSampleTouch(r, { type: 'adult', button: 'l4_done', at: SHOWN + 21_000 });
    expect(r.done).toBe(true);
    expect(sampleTouchInput(r)).toEqual({ startLevel: 0, levelUsed: 4, outcome: 'l4_done', adultPrompted: false, latencyMs: null });
  });

  it('запись «Сделали вместе» одна и та же — с касанием на карточке и без него', () => {
    const done = (r: SampleTouchRun) => sampleTouchInput(stepSampleTouch(r, { type: 'adult', button: 'l4_done', at: SHOWN + 21_000 }));
    expect(done(stepSampleTouch(atL4(), { type: 'tap_sample', at: SHOWN + 20_000 }))).toEqual(done(atL4()));
  });

  it.each(['l4_resisted', 'l4_skipped', 'refusal'] as const)('«%s» после касания на карточке — исход кнопки, касание в запись не попало', (button) => {
    let r = stepSampleTouch(atL4(), { type: 'tap_sample', at: SHOWN + 20_000 });
    r = stepSampleTouch(r, { type: 'adult', button, at: SHOWN + 21_000 });
    expect(sampleTouchInput(r)).toMatchObject({ outcome: button, levelUsed: 3, latencyMs: null });
  });

  it('«Была подсказка» на карточке L4 пробу подсказанной не делает', () => {
    const r = stepSampleTouch(atL4(), { type: 'adult', button: 'adult_prompted', at: SHOWN + 20_000 });
    expect(r.adultPrompted).toBe(false);
  });
});
