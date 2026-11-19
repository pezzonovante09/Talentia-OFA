/**
 * Шаг «коснись картинки» и пятая цель «похожее» (№206): образцы шага — обучающие карточки целей `match` по кругу в
 * порядке от id сессии (`withTouchSample`, `abaSession.ts`). Пока цель закрыта (настоящий реестр), круг — карточки
 * лестницы; с открытой целью вторые рисунки (`aba-obj-*-b`) в круг не попадают: они не карточки поля, а её обучающие
 * карточки уже есть у «одинаковых» — круг и порядок те же.
 */
import { ABA_OBJECT_ART } from '../../assets/registry';
import { ABA_TARGETS, readyAbaTargets } from '../../content/aba';
import { MATCH_LEVEL1 } from '../../content/aba/match-level1';
import { DEV_PLACEHOLDER_ART } from '../../services/local/abaStart';
import type { AbaTarget } from '../../types/aba';
import { sampleTouchDueAt, sampleTouchInput, startSampleTouch, stepSampleTouch } from '../../ui/aba/model/sampleTouchRun';
import { initialSampleTouch, SAMPLE_TOUCH_MAX_TRIALS } from '../abaSampleTouch';
import { accessShown, chooseReinforcer, finishAccess, finishBreak, nextStep, recordSampleTouch, startAbaSession } from '../abaSession';
import { targetForBand } from '../abaTargetRules';
import { initialTokenTraining } from '../abaTokenTraining';

const T0 = Date.UTC(2026, 10, 19, 6);
const band = (ts: readonly AbaTarget[]) => ts.map((t) => targetForBand(t, '5-6'));
const LADDER = band(MATCH_LEVEL1);
const CLOSED = band(readyAbaTargets(ABA_TARGETS, ABA_OBJECT_ART));
const OPEN = band(readyAbaTargets(ABA_TARGETS, DEV_PLACEHOLDER_ART));
const SESSIONS = ['s-a', 's-b', 's-c', 's-d', 's-e', 's-f'];
const teachingCards = (ts: readonly AbaTarget[]) => new Set(ts.flatMap((t) => t.exemplars.filter((e) => e.role === 'teaching').flatMap((e) => e.cards ?? [])));

/** Образцы всех проб шага за занятие: ребёнок каждый раз ждёт метку (не самостоятельно) — шаг идёт все 10 проб. */
function touchSamples(targets: AbaTarget[], sessionId: string): string[] {
  let now = T0;
  let st = startAbaSession({
    sessionId,
    sessionIndex: 0,
    day: '2026-11-19',
    config: 'with_adult',
    band: '5-6',
    targets,
    states: {},
    reinforcerPool: ['puzzle', 'bubbles', 'drum', 'paint_drop', 'kaleidoscope', 'pinwheel'],
    reinforcerApart: [],
    reinforcerHistory: [],
    tokenTraining: { ...initialTokenTraining(), pairingDone: true, stage: 1 },
    startedAt: T0,
    seed: 77,
    identifySets: [],
    physicalPromptAllowed: false,
    autoPlacement: true,
    observers: [{ id: 'o1', role: 'parent', trained: false }],
    primaryObserverId: 'o1',
    sampleTouch: initialSampleTouch(),
  });
  const out: string[] = [];
  for (let guard = 0; guard < 100; guard += 1) {
    const next = nextStep(st, now);
    st = next.state;
    const step = next.step;
    if (step.kind === 'choose_reinforcer') st = chooseReinforcer(st, step.options[0], now, 'child');
    else if (step.kind === 'break') st = finishBreak(st, (now += 60_000)).state;
    else if (step.kind === 'access') {
      st = accessShown(st);
      st = finishAccess(st, (now += step.durationMs));
    } else if (step.kind === 'sample_touch') {
      if (!step.closes) out.push(step.sampleId);
      let r = startSampleTouch(step, now);
      for (let i = 0; !r.done && i < 10; i += 1) {
        if (r.log[r.log.length - 1].level >= 1) {
          now += 300;
          r = stepSampleTouch(r, { type: 'tap_sample', at: now });
          break;
        }
        const due = sampleTouchDueAt(r);
        if (due === null) break;
        now = due;
        r = stepSampleTouch(r, { type: 'due', at: now });
      }
      st = recordSampleTouch(st, sampleTouchInput(r), (now += 200)).state;
      now += 2000;
    } else break;
  }
  return out;
}

describe('образцы шага «коснись картинки» и пятая цель', () => {
  it('предусловие: с настоящим реестром допущена лестница из четырёх, с заглушками — пять целей; шаг идёт 10 проб', () => {
    expect(CLOSED.map((t) => t.id)).toEqual(LADDER.map((t) => t.id));
    expect(OPEN.map((t) => t.id)).toEqual([...LADDER.map((t) => t.id), 'match-similar-3']);
    expect(touchSamples(CLOSED, 's-a')).toHaveLength(SAMPLE_TOUCH_MAX_TRIALS);
  });

  it.each(SESSIONS)('цель закрыта, занятие %s: порядок образцов — как у лестницы, вторых рисунков нет', (sessionId) => {
    const samples = touchSamples(CLOSED, sessionId);
    expect(samples).toEqual(touchSamples(LADDER, sessionId));
    expect(samples.filter((id) => id.endsWith('-b'))).toEqual([]);
    for (const id of samples) expect(teachingCards(LADDER).has(id)).toBe(true);
  });

  it.each(SESSIONS)('цель открыта, занятие %s: вторых рисунков в образцах шага нет', (sessionId) => {
    const samples = touchSamples(OPEN, sessionId);
    expect(samples).toHaveLength(SAMPLE_TOUCH_MAX_TRIALS);
    expect(samples.filter((id) => id.endsWith('-b'))).toEqual([]);
  });

  it('обучающие карточки «похожего» уже есть у «одинаковых» — круг образцов с открытой целью не вырос', () => {
    expect([...teachingCards(OPEN)].sort()).toEqual([...teachingCards(LADDER)].sort());
  });

  it.each(SESSIONS)('цель открыта, занятие %s: порядок образцов шага тот же, что у лестницы', (sessionId) => {
    expect(touchSamples(OPEN, sessionId)).toEqual(touchSamples(LADDER, sessionId));
  });

  it('соседние пробы шага — разные образцы', () => {
    for (const sessionId of SESSIONS) {
      const samples = touchSamples(OPEN, sessionId);
      expect(samples.slice(1).filter((id, i) => id === samples[i])).toEqual([]);
    }
  });
});

// методист 2026-11-19: рука-модель L3 — белая кисть, варежка образцом шага не бывает (`AbaTarget.notForSampleTouch`)
describe('варежка не бывает картинкой шага', () => {
  const MITTEN = 'aba-obj-mitten';
  // 6 занятий по 10 проб шага — 60 проб на каждом наборе целей
  const all = (targets: AbaTarget[]) => SESSIONS.flatMap((sessionId) => touchSamples(targets, sessionId));
  const without = (targets: readonly AbaTarget[]) => targets.map(({ notForSampleTouch: _drop, ...t }) => t as AbaTarget);

  it('предусловие: варежка — обучающая карточка настоящего контента и запрещена образцом шага у целей match', () => {
    expect(teachingCards(OPEN).has(MITTEN)).toBe(true);
    expect(OPEN.filter((t) => t.format === 'match').every((t) => t.notForSampleTouch?.includes(MITTEN))).toBe(true);
  });

  it.each([
    ['пять целей (заглушки)', OPEN],
    ['лестница из четырёх (настоящий реестр)', CLOSED],
  ])('%s: за 60 проб шага на шести занятиях варежки образцом нет', (_name, targets) => {
    const samples = all(targets);
    expect(samples).toHaveLength(SESSIONS.length * SAMPLE_TOUCH_MAX_TRIALS);
    expect(samples.filter((id) => id === MITTEN)).toEqual([]);
  });

  it('остальные обучающие карточки образцом бывают: круг — все обучающие карточки, кроме варежки', () => {
    const expected = [...teachingCards(OPEN)].filter((id) => id !== MITTEN).sort();
    expect(expected.length).toBeGreaterThan(SAMPLE_TOUCH_MAX_TRIALS);
    // за занятие шаг показывает первые 10 карточек круга: чтобы круг вышел целиком, занятий берём больше шести
    const more = [...SESSIONS, 's-g', 's-h', 's-i', 's-j', 's-k', 's-l'];
    const seen = new Set(more.flatMap((sessionId) => touchSamples(OPEN, sessionId)));
    expect(seen.has(MITTEN)).toBe(false);
    expect([...seen].sort()).toEqual(expected);
  });

  it('контроль: без `notForSampleTouch` на тех же занятиях варежка образцом бывает — запрет держит именно поле', () => {
    expect(all(without(OPEN))).toContain(MITTEN);
  });

  it('запрет одной цели действует на общий круг: варежка из карточек другой цели match тоже не образец', () => {
    // запрет оставлен только у первой цели — карточки остальных целей с варежкой всё равно не выходят образцом
    const onlyFirst = OPEN.map((t, i) => (i === 0 ? t : without([t])[0]));
    expect(all(onlyFirst).filter((id) => id === MITTEN)).toEqual([]);
  });
});
