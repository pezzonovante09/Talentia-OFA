/**
 * «Похожее, но не такое же» (№206) в выпуске закрыто: пока вторых рисунков (`aba-obj-*-b`) нет в настоящем реестре
 * `ABA_OBJECT_ART`, цель `match-similar-3` не доходит ни до входа занятия, ни до плана, ни до «Где мы сейчас», ни до
 * раздела специалиста. Путь — настоящие сервисы старта (`abaStart.ts`) на базе в памяти.
 *
 * В Jest `__DEV__` включён, и без явного `art` старт берёт заглушки разработчика (`artFor`) — с ними цель открыта.
 * Поэтому выпуск здесь — либо настоящий реестр параметром, либо `__DEV__ = false` на время вызова.
 */
import { ABA_OBJECT_ART } from '../../../assets/registry';
import { ABA_TARGETS } from '../../../content/aba';
import { markMastered } from '../../../domain/abaCriterion';
import { initialTargetState } from '../../../domain/abaPrompting';
import { initialSampleTouch } from '../../../domain/abaSampleTouch';
import { startAbaSession } from '../../../domain/abaSession';
import { initialTokenTraining } from '../../../domain/abaTokenTraining';
import type { AbaTargetState } from '../../../types/aba';
import { grantAbaProcessing } from '../abaConsent';
import { loadSpecialistView } from '../abaSpecialist';
import { abaOverview, DEV_PLACEHOLDER_ART, loadPairingStart, previewParentStage, readAbaStartInput, resumePoolFor } from '../abaStart';
import { saveChildState } from '../childState';
import { specialistSummaries } from '../purge';
import type { SqlDb } from '../sql';
import { asAbaWriter, memoryDb } from './nodeSql';

const KID = 'kid';
const NOW = Date.UTC(2026, 10, 19, 9);
const SIMILAR = 'match-similar-3';
const LADDER = ['match-same-2', 'match-same-3', 'match-shape', 'match-color-3'];
let n = 0;
const bytes = (len: number) => Uint8Array.from({ length: len }, (_, i) => (i * 13 + (n += 1)) & 0xff);
const OBS = [{ id: 'obs-1', role: 'parent' as const, trained: false }];
const opts = (art?: Readonly<Record<string, unknown>>) => ({
  config: 'with_adult' as const,
  band: '5-6' as const,
  soundOn: true,
  observers: OBS,
  primaryObserverId: 'obs-1',
  now: NOW,
  randomBytes: bytes,
  ...(art ? { art } : {}),
});

const target = (id: string) => ABA_TARGETS.find((t) => t.id === id)!;
const mastered = (id: string): AbaTargetState => markMastered(initialTargetState(target(id)), 1, 'criterion', 'with_adult');
const learning = (id: string): AbaTargetState => ({ ...initialTargetState(target(id)), phase: 'acquisition', startPromptLevel: 0, lastSuccessfulPromptLevel: 0, lastSessionIndex: 1 });

/** Состояния лестницы, при которых открытая пятая цель попала бы в занятие. */
const SCENARIOS: Record<string, () => Record<string, AbaTargetState>> = {
  'занятий не было': () => ({}),
  'форма освоена, цвет в обучении (слот «похожего»)': () => ({
    'match-same-2': mastered('match-same-2'),
    'match-same-3': mastered('match-same-3'),
    'match-shape': mastered('match-shape'),
    'match-color-3': learning('match-color-3'),
  }),
  'лестница освоена целиком, проверка вперемешку пройдена': () => ({
    'match-same-2': mastered('match-same-2'),
    'match-same-3': mastered('match-same-3'),
    'match-shape': { ...mastered('match-shape'), mixedCheck: { days: ['2026-11-17', '2026-11-18'], done: true } },
    'match-color-3': { ...mastered('match-color-3'), mixedCheck: { days: ['2026-11-17', '2026-11-18'], done: true } },
  }),
};

async function child(states: Record<string, AbaTargetState>): Promise<SqlDb> {
  const db = await memoryDb();
  const at = new Date(NOW - 60_000).toISOString();
  await grantAbaProcessing(db, { childId: KID, accountId: 'acc', lang: 'ru', at, randomBytes: bytes });
  await asAbaWriter(db, KID, async (tx) => {
    await saveChildState(tx, KID, 'tokenTraining', { ...initialTokenTraining(), pairingDone: true, stage: 3 }, at);
    await saveChildState(tx, KID, 'sampleTouch', { ...initialSampleTouch(), passed: true }, at);
    await saveChildState(tx, KID, 'abaSessionIndex', 5, at);
    if (Object.keys(states).length) await saveChildState(tx, KID, 'abaTargets', states, at);
  });
  return db;
}

/** Сборка для детей: `__DEV__` выключен на время вызова — `artFor` отдаёт настоящий реестр. */
async function inRelease<T>(fn: () => Promise<T>): Promise<T> {
  const g = globalThis as unknown as { __DEV__: boolean };
  const was = g.__DEV__;
  g.__DEV__ = false;
  try {
    return await fn();
  } finally {
    g.__DEV__ = was;
  }
}

describe('вход и план занятия с настоящим реестром картинок', () => {
  it.each(Object.keys(SCENARIOS))('%s: во входе четыре цели лестницы, в плане «похожего» нет нигде', async (name) => {
    const db = await child(SCENARIOS[name]());
    const r = await readAbaStartInput(db, KID, opts(ABA_OBJECT_ART));
    if (r.kind !== 'ready') throw new Error(r.reason);
    expect(r.input.targets.map((t) => t.id)).toEqual(LADDER);
    const plan = startAbaSession(r.input);
    // очередь, списки целей плана, состояния и каталог сессии — ни одного упоминания
    expect(JSON.stringify(plan)).not.toContain(SIMILAR);
    // вторых рисунков нет в очереди (в общей таблице пар «не вместе» у целей они записаны — это не показ)
    expect(JSON.stringify(plan.queue)).not.toMatch(/aba-obj-[a-z]+-b"/);
  });

  it('контроль: с заглушками разработчика та же лестница берёт «похожее» в занятие — сценарий различает открытую и закрытую цель', async () => {
    const db = await child(SCENARIOS['форма освоена, цвет в обучении (слот «похожего»)']());
    const r = await readAbaStartInput(db, KID, opts(DEV_PLACEHOLDER_ART));
    if (r.kind !== 'ready') throw new Error(r.reason);
    expect(r.input.targets.map((t) => t.id)).toEqual([...LADDER, SIMILAR]);
    const plan = startAbaSession(r.input);
    expect(plan.queue.some((q) => q.kind === 'trial' && q.trial.targetId === SIMILAR)).toBe(true);
  });

  it('сборка для детей (`__DEV__` выключен, `art` не передан — как зовёт экран): цель закрыта', async () => {
    const db = await child(SCENARIOS['форма освоена, цвет в обучении (слот «похожего»)']());
    const r = await inRelease(() => readAbaStartInput(db, KID, opts()));
    if (r.kind !== 'ready') throw new Error(r.reason);
    expect(r.input.targets.map((t) => t.id)).toEqual(LADDER);
    expect(JSON.stringify(startAbaSession(r.input))).not.toContain(SIMILAR);
    expect((await inRelease(() => abaOverview(db, KID))).readyTargets).toBe(4);
  });

  it('с настоящим реестром пулы подкрепителей (старт, сопряжение, возобновление) не меньше порога — занятие не блокируется `pool_small`', async () => {
    const db = await child({});
    const r = await readAbaStartInput(db, KID, opts(ABA_OBJECT_ART));
    if (r.kind !== 'ready') throw new Error(r.reason);
    const pairing = await loadPairingStart(db, KID, opts(ABA_OBJECT_ART));
    if ('blocked' in pairing) throw new Error(pairing.blocked);
    const plan = startAbaSession(r.input);
    expect(r.input.reinforcerPool.length).toBeGreaterThanOrEqual(6);
    expect(pairing.pool.length).toBeGreaterThanOrEqual(6);
    expect(resumePoolFor(plan, true, ABA_OBJECT_ART).length).toBeGreaterThanOrEqual(6);
  });
});

describe('«Где мы сейчас» с настоящим реестром', () => {
  it.each(Object.keys(SCENARIOS))('%s: этап следующего занятия не называет «похожее»', async (name) => {
    const db = await child(SCENARIOS[name]());
    const view = await previewParentStage(db, KID, opts(ABA_OBJECT_ART));
    expect(view.stage.kind).not.toBe('unknown');
    expect(JSON.stringify(view)).not.toContain(SIMILAR);
  });

  it('лестница освоена целиком — «всё освоено», а не ожидание закрытой цели', async () => {
    const db = await child(SCENARIOS['лестница освоена целиком, проверка вперемешку пройдена']());
    expect((await previewParentStage(db, KID, opts(ABA_OBJECT_ART))).stage).toEqual({ kind: 'all_mastered' });
  });

  it('контроль: с заглушками разработчика этап — первые пробы «похожего»', async () => {
    const db = await child(SCENARIOS['форма освоена, цвет в обучении (слот «похожего»)']());
    expect(JSON.stringify(await previewParentStage(db, KID, opts(DEV_PLACEHOLDER_ART)))).toContain(SIMILAR);
  });
});

describe('раздел и отчёт специалиста', () => {
  it('состояния закрытой цели план не заводит — в разделе специалиста и сводках отчёта её нет', async () => {
    const states = SCENARIOS['форма освоена, цвет в обучении (слот «похожего»)']();
    const db = await child(states);
    const r = await readAbaStartInput(db, KID, opts(ABA_OBJECT_ART));
    if (r.kind !== 'ready') throw new Error(r.reason);
    const plan = startAbaSession(r.input);
    expect(Object.keys(plan.states)).not.toContain(SIMILAR);
    const view = await loadSpecialistView(db, KID, '5-6');
    expect(view.targets.map((t) => t.id)).toEqual(LADDER);
    expect(view.mixedHeld.flat()).not.toContain(SIMILAR);
    const summaries = specialistSummaries({ sessions: [], trials: [], correctedTrialIds: new Set(), targetStates: { ...states, ...plan.states } });
    expect(summaries.byTarget.map((t) => t.targetId)).not.toContain(SIMILAR);
  });
});
