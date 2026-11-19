/**
 * Возобновление занятия на пробе «похожего» (№206): снимок с `sampleShownId` в голове очереди переживает запись в базу
 * и `loadAbaResume` — то же поле, та же верная карточка и тот же показанный образец; запись пробы после возврата
 * проходит сверку (`trialMismatch`). Харнесс — как в `abaResume.test.ts`: база в памяти, настоящие сервисы.
 */
import { ABA_TARGETS, readyAbaTargets } from '../../../content/aba';
import { acq, masteredState } from '../../../domain/__tests__/abaSessionDriver';
import { accessShown, chooseReinforcer, finishAccess, finishBreak, nextStep, recordTrial, startAbaSession, type AbaSessionState, type TrialStep } from '../../../domain/abaSession';
import { targetForBand } from '../../../domain/abaTargetRules';
import { initialTokenTraining } from '../../../domain/abaTokenTraining';
import type { AbaTargetState } from '../../../types/aba';
import { matchDueAt, matchTrialInput, optionActive, startMatchTrial, stepMatchTrial, type MatchTrialRun } from '../../../ui/aba/model/matchTrialRun';
import { grantAbaProcessing } from '../abaConsent';
import { abaLocalDay } from '../abaLog';
import { loadAbaResume } from '../abaResume';
import { DEV_PLACEHOLDER_ART } from '../abaStart';
import { saveChildState } from '../childState';
import { saveAbaSessionStep } from '../commit';
import { asAbaWriter, memoryDb } from './nodeSql';

const KID = 'kid';
const NOW = new Date(2026, 10, 19, 12, 0).getTime();
const iso = (ms: number) => new Date(ms).toISOString();
const SIMILAR = 'match-similar-3';
const TARGETS = readyAbaTargets(ABA_TARGETS, DEV_PLACEHOLDER_ART).map((t) => targetForBand(t, '5-6'));
const TGT = (id: string) => TARGETS.find((t) => t.id === id)!;
let n = 0;
const bytes = (len: number) => Uint8Array.from({ length: len }, (_, i) => (i * 13 + (n += 1)) & 0xff);

/** Форма освоена, цвет и «похожее» в обучении — «похожее» занимает слот (как в `abaSimilarMatch.test.ts`). */
const STATES = (): Record<string, AbaTargetState> => ({
  'match-same-2': masteredState(TGT('match-same-2'), 0),
  'match-same-3': masteredState(TGT('match-same-3'), 0),
  'match-shape': masteredState(TGT('match-shape'), 0),
  'match-color-3': acq(TGT('match-color-3'), 0),
  [SIMILAR]: acq(TGT(SIMILAR), 0),
});

function answer(r0: MatchTrialRun, at0: number): { r: MatchTrialRun; at: number } {
  let r = r0;
  let at = at0;
  if (r.sampleTouchedAt === null) r = stepMatchTrial(r, { type: 'tap_sample', at: (at += 1000) });
  const id = r.step.sampleCardId!;
  if (optionActive(r, id)) r = stepMatchTrial(r, { type: 'tap_option', id, at: (at += 500) });
  for (let guard = 0; !r.done && guard < 50; guard += 1) {
    const due = matchDueAt(r);
    if (due === null) break;
    at = Math.max(at, due);
    r = stepMatchTrial(r, { type: 'due', at });
  }
  return { r, at };
}

const runOf = (st: AbaSessionState, step: TrialStep, now: number, id: string) =>
  startMatchTrial({ step, target: st.targets[step.targetId], config: 'with_adult', seed: st.seed, trialId: id, sessionId: st.sessionId, index: st.trials.length, shownAt: now });

/** Занятие с началом в `t0` до первой пробы «похожего»: состояние с этой пробой в голове очереди, её шаг и время. */
function toSimilarTrial(t0: number): { st: AbaSessionState; step: TrialStep; now: number } {
  let now = t0;
  let st = startAbaSession({
    sessionId: '00000000-0000-4000-8000-00000000c001',
    sessionIndex: 0,
    day: abaLocalDay(NOW),
    config: 'with_adult',
    band: '5-6',
    targets: TARGETS,
    states: STATES(),
    reinforcerPool: ['puzzle', 'bubbles', 'drum', 'paint_drop', 'kaleidoscope', 'pinwheel'],
    reinforcerApart: [],
    reinforcerHistory: [],
    tokenTraining: { ...initialTokenTraining(), pairingDone: true, stage: 3 },
    startedAt: t0,
    seed: 211,
    identifySets: [],
    physicalPromptAllowed: false,
    autoPlacement: true,
    observers: [{ id: 'o1', role: 'parent', trained: false }],
    primaryObserverId: 'o1',
  });
  for (let guard = 0; guard < 200; guard += 1) {
    const next = nextStep(st, now);
    st = next.state;
    const step = next.step;
    if (step.kind === 'choose_reinforcer') st = chooseReinforcer(st, step.options[0], now, 'child');
    else if (step.kind === 'break') st = finishBreak(st, (now += 60_000)).state;
    else if (step.kind === 'access') {
      st = accessShown(st);
      st = finishAccess(st, (now += step.durationMs));
    } else if (step.kind !== 'trial') throw new Error(`неожиданный шаг ${step.kind}`);
    else if (step.targetId === SIMILAR) return { st, step, now };
    else {
      const done = answer(runOf(st, step, now, `t${guard}`), now);
      now = done.at + 200;
      const res = recordTrial(st, matchTrialInput(done.r), now);
      if (!res.ok) throw new Error(res.errors.join('; '));
      st = res.state;
      now += 5000;
    }
  }
  throw new Error('проба «похожего» не встретилась');
}

/** Сколько идёт занятие до пробы «похожего»: лимит времени сессии считается от рабочего времени, начало — от ухода. */
const BEFORE_MS = toSimilarTrial(0).now;
/** Проба «похожего» показана за секунду до ухода в фон `awayMs` назад. */
const leftAgo = (awayMs: number) => toSimilarTrial(NOW - awayMs - BEFORE_MS - 1000);

async function setup() {
  const db = await memoryDb();
  const at = iso(NOW - 60 * 60_000);
  await grantAbaProcessing(db, { childId: KID, accountId: 'acc', lang: 'ru', at, randomBytes: bytes });
  await asAbaWriter(db, KID, (tx) => saveChildState(tx, KID, 'tokenTraining', { ...initialTokenTraining(), pairingDone: true, stage: 3 }, at));
  return db;
}

describe('возобновление на пробе «похожего»', () => {
  it('предусловие: у пробы в голове очереди есть показанный образец, и он не карточка поля', () => {
    const { step } = leftAgo(90_000);
    expect(step.sampleShownId).toBe(`${step.sampleCardId}-b`);
    expect(step.field).toContain(step.sampleCardId);
    expect(step.field).not.toContain(step.sampleShownId);
  });

  it('свёрнуто на 90 с: та же проба — поле, верная карточка и показанный образец те же', async () => {
    const db = await setup();
    const { st, step, now } = leftAgo(90_000);
    expect(now).toBe(NOW - 90_000 - 1000);
    await saveAbaSessionStep(db, KID, st, iso(NOW - 90_000));
    const r = await loadAbaResume(db, KID, { soundOn: true, now: NOW, art: DEV_PLACEHOLDER_ART });
    if (r.kind !== 'resume') throw new Error(`ждали продолжение, получили ${r.kind}`);
    expect(r.outcome).toBe('same_trial');
    const again = nextStep(r.state, NOW).step;
    if (again.kind !== 'trial') throw new Error(`ждали пробу, получили ${again.kind}`);
    expect([again.targetId, again.exemplarId, again.field, again.sampleCardId, again.sampleShownId]).toEqual([
      step.targetId,
      step.exemplarId,
      step.field,
      step.sampleCardId,
      step.sampleShownId,
    ]);
  });

  it('проба после возврата записывается с показанным образцом и засчитывается самостоятельной', async () => {
    const db = await setup();
    const { st, step } = leftAgo(90_000);
    await saveAbaSessionStep(db, KID, st, iso(NOW - 90_000));
    const r = await loadAbaResume(db, KID, { soundOn: true, now: NOW, art: DEV_PLACEHOLDER_ART });
    if (r.kind !== 'resume') throw new Error(`ждали продолжение, получили ${r.kind}`);
    const next = nextStep(r.state, NOW);
    if (next.step.kind !== 'trial') throw new Error('ждали пробу');
    const done = answer(runOf(next.state, next.step, NOW, 'after-resume'), NOW);
    const res = recordTrial(next.state, matchTrialInput(done.r), done.at + 200);
    if (!res.ok) throw new Error(res.errors.join('; '));
    expect(res.trial).toMatchObject({ targetId: SIMILAR, field: step.field, sampleCardId: step.sampleCardId, sampleShownId: step.sampleShownId, chosenCardId: step.sampleCardId, response: 'independent' });
  });

  it('свёрнуто на 5 мин (новый выбор подкрепителя): проба «похожего» в очереди осталась с тем же полем и образцом', async () => {
    const db = await setup();
    const { st, step } = leftAgo(5 * 60_000);
    await saveAbaSessionStep(db, KID, st, iso(NOW - 5 * 60_000));
    const r = await loadAbaResume(db, KID, { soundOn: true, now: NOW, art: DEV_PLACEHOLDER_ART });
    if (r.kind !== 'resume') throw new Error(`ждали продолжение, получили ${r.kind}`);
    expect(r.outcome).toBe('rechoose');
    const kept = r.state.queue.find((q) => q.kind === 'trial' && q.trial.targetId === SIMILAR);
    expect(kept).toMatchObject({ kind: 'trial', trial: { field: step.field, sampleCardId: step.sampleCardId, sampleShownId: step.sampleShownId } });
  });
});
