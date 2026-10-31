/** Вход сессии ABA (этап 11): что мешает начать, согласие, вход startAbaSession и сопряжения, данные итога. */
import { isUuidV4 } from '../../../domain/ids';
import { nextStep, startAbaSession } from '../../../domain/abaSession';
import { initialTokenTraining } from '../../../domain/abaTokenTraining';
import { MIN_REINFORCER_POOL } from '../../../domain/abaTokens';
import { abaConsentTextVersion, grantAbaProcessing } from '../abaConsent';
import { AbaConsentRequiredError, AbaPausedError } from '../abaLog';
import { abaBlockOf, abaOverview, DEV_PLACEHOLDER_ART, loadAbaStart, loadFinishInputs, loadPairingStart } from '../abaStart';
import { loadChildState, saveChildState } from '../childState';
import { AbaObserverNotTrainedError, confirmAbaPairing, saveAbaSessionStep, setAbaPaused } from '../commit';
import type { SqlDb } from '../sql';
import { asAbaWriter, memoryDb } from './nodeSql';

const KID = 'kid';
const NOW = Date.UTC(2026, 9, 27, 9);
let n = 0;
const bytes = (len: number) => Uint8Array.from({ length: len }, (_, i) => (i * 13 + (n += 1)) & 0xff);
const OBS = [{ id: 'obs-1', role: 'parent' as const, trained: false }];
const opts = (over = {}) => ({ config: 'with_adult' as const, band: '5-6' as const, soundOn: true, observers: OBS, primaryObserverId: 'obs-1', now: NOW, randomBytes: bytes, art: DEV_PLACEHOLDER_ART, ...over });

async function granted() {
  const db = await memoryDb();
  await grantAbaProcessing(db, { childId: KID, accountId: 'acc', lang: 'ru', at: new Date(NOW - 60_000).toISOString(), randomBytes: bytes });
  return db;
}

async function paired() {
  const db = await granted();
  await asAbaWriter(db, KID, (tx) => saveChildState(tx, KID, 'tokenTraining', { ...initialTokenTraining(), pairingDone: true }, new Date(NOW).toISOString()));
  return db;
}

describe('что мешает начать', () => {
  it('без согласия — no_consent; после согласия — сопряжение; без картинок — no_ready_targets', async () => {
    const db = await memoryDb();
    expect(abaBlockOf(await abaOverview(db, KID, DEV_PLACEHOLDER_ART))).toBe('no_consent');
    await grantAbaProcessing(db, { childId: KID, accountId: 'acc', lang: 'ru', at: new Date(NOW).toISOString(), randomBytes: bytes });
    expect(abaBlockOf(await abaOverview(db, KID, DEV_PLACEHOLDER_ART))).toBe('pairing_needed');
    expect(abaBlockOf(await abaOverview(db, KID, {}))).toBe('no_ready_targets');
  });

  it('пауза — paused; занятие в работе — in_progress', async () => {
    const db = await paired();
    expect(await setAbaPaused(db, KID, true, new Date(NOW).toISOString())).toBe('saved');
    expect(await loadAbaStart(db, KID, opts())).toEqual({ kind: 'blocked', reason: 'paused' });
  });

  it('версия текста согласия — на языке экрана', () => {
    expect(abaConsentTextVersion('en')).toMatch(/^en-/);
    expect(abaConsentTextVersion('ru')).toMatch(/^ru-/);
  });
});

describe('«сопряжение подтверждено» обученным наблюдателем (confirmAbaPairing, вопрос 62)', () => {
  const AT = new Date(NOW).toISOString();
  const SPEC = { id: 'obs-spec', role: 'specialist' as const, trained: true };
  const BY = { observerId: SPEC.id, byRole: 'owner' as const, at: AT };
  const setObservers = (db: SqlDb, list: { id: string; role: 'parent' | 'specialist'; trained: boolean }[]) =>
    asAbaWriter(db, KID, (tx) => saveChildState(tx, KID, 'abaObservers', list, AT));

  it('trainedObserverId в обзоре: нет наблюдателей — null; необученный — null; первый обученный — его id', async () => {
    const db = await granted();
    expect((await abaOverview(db, KID, DEV_PLACEHOLDER_ART)).trainedObserverId).toBeNull();
    await setObservers(db, OBS);
    expect((await abaOverview(db, KID, DEV_PLACEHOLDER_ART)).trainedObserverId).toBeNull();
    await setObservers(db, [...OBS, SPEC, { id: 'obs-spec-2', role: 'specialist', trained: true }]);
    expect((await abaOverview(db, KID, DEV_PLACEHOLDER_ART)).trainedObserverId).toBe('obs-spec');
  });

  it('после подтверждения блок уже не pairing_needed, в базе pairingDone и кем подтверждено', async () => {
    const db = await granted();
    await setObservers(db, [SPEC]);
    expect(abaBlockOf(await abaOverview(db, KID, DEV_PLACEHOLDER_ART))).toBe('pairing_needed');
    await confirmAbaPairing(db, KID, BY);
    expect(abaBlockOf(await abaOverview(db, KID, DEV_PLACEHOLDER_ART))).toBeNull();
    expect(await loadChildState(db, KID, 'tokenTraining')).toMatchObject({ pairingDone: true, pairingConfirmed: BY, stage: 1, atStage: [] });
  });

  it('после подтверждения рабочая сессия стартует с доски из одной ячейки', async () => {
    const db = await granted();
    await setObservers(db, [SPEC]);
    await confirmAbaPairing(db, KID, BY);
    const r = await loadAbaStart(db, KID, opts());
    if (r.kind !== 'ready') throw new Error(r.reason);
    expect(startAbaSession(r.input).board.size).toBe(1);
  });

  it('наблюдатель не обучен — AbaObserverNotTrainedError, состояние не изменилось', async () => {
    const db = await granted();
    await setObservers(db, OBS);
    await expect(confirmAbaPairing(db, KID, { ...BY, observerId: 'obs-1' })).rejects.toBeInstanceOf(AbaObserverNotTrainedError);
    expect(await loadChildState(db, KID, 'tokenTraining')).toBeUndefined();
    expect(abaBlockOf(await abaOverview(db, KID, DEV_PLACEHOLDER_ART))).toBe('pairing_needed');
  });

  it('наблюдателя с таким id у ребёнка нет (обученный есть, но другой) — ошибка, ничего не записано', async () => {
    const db = await granted();
    await setObservers(db, [SPEC]);
    await expect(confirmAbaPairing(db, KID, { ...BY, observerId: 'obs-unknown' })).rejects.toBeInstanceOf(AbaObserverNotTrainedError);
    expect(await loadChildState(db, KID, 'tokenTraining')).toBeUndefined();
  });

  it('наблюдателей не записано вовсе — ошибка', async () => {
    const db = await granted();
    await expect(confirmAbaPairing(db, KID, BY)).rejects.toBeInstanceOf(AbaObserverNotTrainedError);
    expect(await loadChildState(db, KID, 'tokenTraining')).toBeUndefined();
  });

  it('обученный наблюдатель записан у другого ребёнка — для этого ребёнка не считается', async () => {
    const db = await granted();
    await asAbaWriter(db, 'other', (tx) => saveChildState(tx, 'other', 'abaObservers', [SPEC], AT));
    await expect(confirmAbaPairing(db, KID, BY)).rejects.toBeInstanceOf(AbaObserverNotTrainedError);
  });

  it('без согласия — AbaConsentRequiredError, записи нет', async () => {
    const db = await memoryDb();
    await expect(confirmAbaPairing(db, KID, BY)).rejects.toBeInstanceOf(AbaConsentRequiredError);
    expect(await loadChildState(db, KID, 'tokenTraining')).toBeUndefined();
  });

  it('на паузе — AbaPausedError, сопряжение не подтверждено', async () => {
    const db = await granted();
    await setObservers(db, [SPEC]);
    await setAbaPaused(db, KID, true, AT);
    await expect(confirmAbaPairing(db, KID, BY)).rejects.toBeInstanceOf(AbaPausedError);
    expect((await loadChildState(db, KID, 'tokenTraining'))?.pairingDone ?? false).toBe(false);
  });

  it('повторное подтверждение при pairingDone ничего не меняет (первое остаётся)', async () => {
    const db = await granted();
    await setObservers(db, [SPEC]);
    await confirmAbaPairing(db, KID, BY);
    await confirmAbaPairing(db, KID, { ...BY, at: new Date(NOW + 60_000).toISOString() });
    expect((await loadChildState(db, KID, 'tokenTraining'))?.pairingConfirmed).toEqual(BY);
  });

  it('сопряжение по критерию уже пройдено — подтверждение не затирает: pairingConfirmed не появляется', async () => {
    const db = await paired();
    await setObservers(db, [SPEC]);
    await confirmAbaPairing(db, KID, BY);
    expect((await loadChildState(db, KID, 'tokenTraining'))?.pairingConfirmed).toBeUndefined();
  });
});

describe('проверка сверху вниз (autoPlacement, вопрос 63)', () => {
  it('«со взрослым» на свежей лестнице с полным набором картинок — верхняя цель лестницы (форма) идёт проверкой', async () => {
    const db = await paired();
    const r = await loadAbaStart(db, KID, opts());
    if (r.kind !== 'ready') throw new Error(r.reason);
    expect(r.input.autoPlacement).toBe(true);
    expect(startAbaSession(r.input).placementTargetIds).toContain('match-shape');
  });

  it('«Сам» — проверки сверху вниз нет', async () => {
    const db = await paired();
    const r = await loadAbaStart(db, KID, opts({ config: 'alone', observers: [], primaryObserverId: null }));
    if (r.kind !== 'ready') throw new Error(r.reason);
    expect(startAbaSession(r.input).placementTargetIds).toEqual([]);
  });
});

describe('вход сессии', () => {
  it('после сопряжения — вход готов: UUIDv4, локальный день, пул ≥ 6, домен стартует и спрашивает подкрепитель', async () => {
    const db = await paired();
    const r = await loadAbaStart(db, KID, opts());
    if (r.kind !== 'ready') throw new Error(r.reason);
    expect(isUuidV4(r.input.sessionId)).toBe(true);
    expect(r.input.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(r.input.reinforcerPool.length).toBeGreaterThanOrEqual(MIN_REINFORCER_POOL);
    const state = startAbaSession(r.input);
    expect(nextStep(state, NOW).step.kind).toBe('choose_reinforcer');
  });

  it('старт пишется снимком; второе занятие — in_progress', async () => {
    const db = await paired();
    const r = await loadAbaStart(db, KID, opts());
    if (r.kind !== 'ready') throw new Error(r.reason);
    await saveAbaSessionStep(db, KID, nextStep(startAbaSession(r.input), NOW).state, new Date(NOW).toISOString());
    expect(await loadAbaStart(db, KID, opts())).toEqual({ kind: 'blocked', reason: 'in_progress' });
  });

  it('«Сам» без звука — пул всё равно ≥ 6, без звуковых позиций', async () => {
    const db = await paired();
    const r = await loadAbaStart(db, KID, opts({ config: 'alone', soundOn: false, observers: [], primaryObserverId: null }));
    if (r.kind !== 'ready') throw new Error(r.reason);
    expect(r.input.reinforcerPool).not.toEqual(expect.arrayContaining(['drum']));
    expect(r.input.reinforcerPool.length).toBeGreaterThanOrEqual(MIN_REINFORCER_POOL);
  });

  it('сопряжение: вход есть до сопряжения, пул под доступ 20 с — без пазла', async () => {
    const db = await granted();
    const p = await loadPairingStart(db, KID, { config: 'with_adult', soundOn: true, art: DEV_PLACEHOLDER_ART });
    if ('blocked' in p) throw new Error(p.blocked);
    expect(p.pool).not.toContain('puzzle4');
    expect(p.pool.length).toBeGreaterThanOrEqual(MIN_REINFORCER_POOL);
  });

  it('данные итога: без истории — пустые прошлые сессии и сигналы, признак обмена рутины', async () => {
    const db = await paired();
    const r = await loadAbaStart(db, KID, opts());
    if (r.kind !== 'ready') throw new Error(r.reason);
    const f = await loadFinishInputs(db, KID, startAbaSession(r.input));
    expect(f).toEqual({ pastSessions: {}, signalHistory: { sessions: [], previous: [] }, extra: { routineExchangeInWindow: false } });
  });
});
