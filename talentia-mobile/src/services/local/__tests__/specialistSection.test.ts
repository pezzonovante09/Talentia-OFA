/**
 * Раздел «Для специалиста» (методист 2026-11-18), хранилище: ключ `abaSessionParams` и журнал `aba_specialist_events`
 * (миграция 20) — ворота согласия, только дописывание, очистка / отзыв / удаление, параметры доходят до старта и негодные
 * пропускаются, каждое действие меняет состояние и пишет событие одной транзакцией, экспорт специалисту.
 */
import { ABA_TARGETS } from '../../../content/aba';
import { markMastered } from '../../../domain/abaCriterion';
import { mixGroups } from '../../../domain/abaMixedBlock';
import { initialTargetState } from '../../../domain/abaPrompting';
import { startAbaSession } from '../../../domain/abaSession';
import { initialTokenTraining } from '../../../domain/abaTokenTraining';
import type { AbaTargetState } from '../../../types/aba';
import { grantAbaProcessing } from '../abaConsent';
import { AbaPausedError } from '../abaLog';
import { initialSampleTouch } from '../../../domain/abaSampleTouch';
import { loadSpecialistView, saveProfileAsParent, setAdultRewardAsSpecialist } from '../abaSpecialist';
import { DEV_PLACEHOLDER_ART, loadAbaStart } from '../abaStart';
import { loadChildState, saveChildState } from '../childState';
import {
  AbaObserverNotTrainedError,
  AbaSessionParamsInvalidError,
  abaSpecialistEventsOf,
  assignAbaMixedCheck,
  confirmAbaPairing,
  confirmAbaPairingAsSpecialist,
  reviewAbaAssentConcern,
  reviewAbaFlag,
  reviewAbaSampleTouchAssentConcern,
  setAbaObservers,
  setAbaObserverTrained,
  setAbaPaused,
  setAbaSessionParams,
} from '../commit';
import { newProfile } from '../profiles';
import { abaDataSummary, applyRetention, clearChildProgress, exportChild, exportForSpecialist, purgeChild, revokeAbaProcessing } from '../purge';
import type { SqlDb } from '../sql';
import { asAbaWriter, memoryDb } from './nodeSql';

const KID = 'kid';
const OTHER = 'kid-2';
const NOW = Date.UTC(2026, 10, 18, 9);
const AT = new Date(NOW).toISOString();
let n = 0;
const bytes = (len: number) => Uint8Array.from({ length: len }, (_, i) => (i * 13 + (n += 1)) & 0xff);
const OBS = [{ id: 'obs-1', role: 'parent' as const, trained: false }];
const opts = (over = {}) => ({ config: 'with_adult' as const, band: '7' as const, soundOn: true, observers: OBS, primaryObserverId: 'obs-1', now: NOW, randomBytes: bytes, art: DEV_PLACEHOLDER_ART, ...over });

async function granted(...kids: string[]): Promise<SqlDb> {
  const db = await memoryDb();
  for (const kid of kids.length ? kids : [KID]) {
    await grantAbaProcessing(db, { childId: kid, accountId: 'acc', lang: 'ru', at: new Date(NOW - 60_000).toISOString(), randomBytes: bytes });
  }
  return db;
}

async function paired(...kids: string[]): Promise<SqlDb> {
  const db = await granted(...kids);
  for (const kid of kids.length ? kids : [KID]) {
    await asAbaWriter(db, kid, (tx) => saveChildState(tx, kid, 'tokenTraining', { ...initialTokenTraining(), pairingDone: true }, AT));
  }
  return db;
}

const countOf = async (db: SqlDb, table: string, childId = KID) =>
  (await db.all<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table} WHERE child_id = ?`, [childId]))[0].n;

describe('миграция 20: ключ параметров и журнал специалиста', () => {
  it('параметры мимо ворот согласия не пишутся; журнал — только дописывание и только через ворота', async () => {
    const db = await granted();
    await expect(saveChildState(db, KID, 'abaSessionParams', { maxTeachingTargets: 1 }, AT)).rejects.toThrow(/состояние ABA только через commit/);
    await expect(db.run("INSERT INTO aba_specialist_events (child_id, body, recorded_at) VALUES (?, '{}', ?)", [KID, AT])).rejects.toThrow(/только через commit/);
    await setAbaSessionParams(db, KID, { maxTeachingTargets: 1 }, '7', AT);
    expect(await countOf(db, 'aba_specialist_events')).toBe(1);
    await expect(db.run("UPDATE aba_specialist_events SET body = '{}'")).rejects.toThrow(/только дописывание/);
    await expect(db.run('DELETE FROM aba_specialist_events')).rejects.toThrow(/только дописывание/);
  });

  it('отзыв согласия при оставшемся журнале или параметрах база не принимает', async () => {
    const REVOKE = `INSERT INTO consent_events (id, scope, action, child_id, text_version, confirmed_by, actor_id, at)
      SELECT 'raw-revoke', 'aba_processing', 'revoke', ?, text_version, 'pin', 'parent', ? FROM consent_events WHERE child_id = ? LIMIT 1`;
    const db = await granted();
    await setAbaSessionParams(db, KID, { maxTeachingTargets: 1 }, '7', AT);
    // параметры остаются, журнал удалён по ребёнку — отзыв всё равно отклонён ключом
    await db.transaction(async (tx) => {
      await tx.run('INSERT INTO purge_gate (child_id) VALUES (?)', [KID]);
      await tx.run('DELETE FROM aba_specialist_events WHERE child_id = ?', [KID]);
      await tx.run('DELETE FROM purge_gate WHERE child_id = ?', [KID]);
    });
    await expect(db.run(REVOKE, [KID, AT, KID])).rejects.toThrow(/только вместе с удалением/);
  });

  it('срок хранения: событие старше 12 месяцев удаляется', async () => {
    const db = await granted();
    await setAbaSessionParams(db, KID, { maxTeachingTargets: 1 }, '7', '2025-10-01T10:00:00.000Z');
    await setAbaSessionParams(db, KID, {}, '7', AT);
    await applyRetention(db, new Date(NOW));
    expect((await abaSpecialistEventsOf(db, KID)).map((e) => e.at)).toEqual([AT]);
  });
});

describe('параметры сессии', () => {
  it('запись и чтение; то же значение — без события; «по умолчанию» — событие с null', async () => {
    const db = await granted();
    const p = { paramsBand: '8' as const, timeLimitMs: 12 * 60_000, responseWindowMs: { match: 8000 }, maxTeachingTargets: 1 as const };
    const events = await setAbaSessionParams(db, KID, p, '7', AT);
    expect(await loadChildState(db, KID, 'abaSessionParams')).toEqual(p);
    expect(events.map((e) => [e.field, e.from, e.to])).toEqual([
      ['paramsBand', null, '8'],
      ['timeLimitMs', null, 720_000],
      ['maxTeachingTargets', null, 1],
      ['responseWindowMs.match', null, 8000],
    ]);
    expect(events.every((e) => e.role === 'specialist' && e.claimed === true)).toBe(true);
    expect(await setAbaSessionParams(db, KID, p, '7', AT)).toEqual([]);
    expect(await countOf(db, 'aba_specialist_events')).toBe(4);
    const { maxTeachingTargets: _m, ...rest } = p;
    expect((await setAbaSessionParams(db, KID, rest, '7', AT)).map((e) => [e.field, e.from, e.to])).toEqual([['maxTeachingTargets', 1, null]]);
    expect(await loadChildState(db, KID, 'abaSessionParams')).toEqual(rest);
  });

  it('негодные параметры не пишутся: окно ниже потолка задержки, лимит вне 3–15 мин при 5–6', async () => {
    const db = await granted();
    await expect(setAbaSessionParams(db, KID, { responseWindowMs: { match: 3000 } }, '7', AT)).rejects.toBeInstanceOf(AbaSessionParamsInvalidError);
    await expect(setAbaSessionParams(db, KID, { timeLimitMs: 18 * 60_000 }, '5-6', AT)).rejects.toBeInstanceOf(AbaSessionParamsInvalidError);
    expect([await loadChildState(db, KID, 'abaSessionParams'), await countOf(db, 'aba_specialist_events')]).toEqual([undefined, 0]);
  });

  it('негодные сохранённые параметры снимаются выбором «по умолчанию» — без события: условия занятий не менялись', async () => {
    const db = await granted();
    await asAbaWriter(db, KID, (tx) => saveChildState(tx, KID, 'abaSessionParams', { responseWindowMs: { match: 2000 } }, AT));
    expect((await loadSpecialistView(db, KID, '7')).paramsIgnored).toBe(true);
    expect(await setAbaSessionParams(db, KID, {}, '7', AT)).toEqual([]);
    expect([await loadChildState(db, KID, 'abaSessionParams'), await countOf(db, 'aba_specialist_events')]).toEqual([{}, 0]);
    expect((await loadSpecialistView(db, KID, '7')).paramsIgnored).toBe(false);
  });

  it('на паузе изменения не пишутся (withAbaWrite)', async () => {
    const db = await granted();
    await setAbaPaused(db, KID, true, AT);
    await expect(setAbaSessionParams(db, KID, { maxTeachingTargets: 1 }, '7', AT)).rejects.toBeInstanceOf(AbaPausedError);
  });

  it('доходят до startAbaSession: лимит, окно, полоса параметров', async () => {
    const db = await paired();
    await setAbaSessionParams(db, KID, { paramsBand: '9-10', timeLimitMs: 6 * 60_000, responseWindowMs: { match: 9000 } }, '7', AT);
    const r = await loadAbaStart(db, KID, opts());
    if (r.kind !== 'ready') throw new Error(r.reason);
    expect(r.input.params).toEqual({ paramsBand: '9-10', timeLimitMs: 360_000, responseWindowMs: { match: 9000 } });
    // цели — уже под полосой параметров: доступ обмена и доска считаются по той же полосе, что и сессия
    expect(r.input.targets.every((t) => t.band === '9-10')).toBe(true);
    const st = startAbaSession(r.input);
    expect([st.band, st.timeLimitMs, st.windowOverrideMs]).toEqual(['9-10', 360_000, { match: 9000 }]);
  });

  it('одна обучаемая цель: maxTeachingTargets доходит до плана', async () => {
    const db = await paired();
    const two = ABA_TARGETS.filter((t) => !t.prerequisiteTargetIds?.length && t.format !== 'identify').slice(0, 2);
    const acq = (id: string): AbaTargetState => ({ ...initialTargetState(ABA_TARGETS.find((t) => t.id === id)!), phase: 'acquisition' });
    await asAbaWriter(db, KID, (tx) => saveChildState(tx, KID, 'abaTargets', Object.fromEntries(two.map((t) => [t.id, acq(t.id)])), AT));
    const plain = await loadAbaStart(db, KID, opts());
    if (plain.kind !== 'ready') throw new Error(plain.reason);
    const before = startAbaSession(plain.input).teachingTargetIds.length;
    await setAbaSessionParams(db, KID, { maxTeachingTargets: 1 }, '7', AT);
    const one = await loadAbaStart(db, KID, opts());
    if (one.kind !== 'ready') throw new Error(one.reason);
    expect([before, startAbaSession(one.input).teachingTargetIds.length]).toEqual([two.length, 1]);
  });

  it('негодные параметры в хранилище старт пропускает — сессия по умолчанию, а не падение', async () => {
    const db = await paired();
    for (const bad of [
      { responseWindowMs: { match: 2000 } },
      { timeLimitMs: 99 * 60_000 },
      { paramsBand: '11' },
      { maxTeachingTargets: 3 },
      { responseWindowMs: { teleport: 6000 } },
      { timeLimitMs: 'много' },
      'не объект',
    ]) {
      await asAbaWriter(db, KID, (tx) => saveChildState(tx, KID, 'abaSessionParams', bad as never, AT));
      const r = await loadAbaStart(db, KID, opts());
      if (r.kind !== 'ready') throw new Error(r.reason);
      expect(r.input.params).toBeUndefined();
      expect(() => startAbaSession(r.input)).not.toThrow();
    }
  });

  it('негодное поле снимается по одному: годная «одна цель в обучении» доходит до старта, экран предупреждает', async () => {
    const db = await paired();
    await asAbaWriter(db, KID, (tx) => saveChildState(tx, KID, 'abaSessionParams', { maxTeachingTargets: 1, responseWindowMs: { match: 2000 } }, AT));
    const r = await loadAbaStart(db, KID, opts());
    if (r.kind !== 'ready') throw new Error(r.reason);
    expect(r.input.params).toEqual({ maxTeachingTargets: 1 });
    expect(() => startAbaSession(r.input)).not.toThrow();
    const view = await loadSpecialistView(db, KID, '7');
    expect([view.params, view.paramsIgnored]).toEqual([{ maxTeachingTargets: 1 }, true]);
    // запись по-прежнему только годных: setAbaSessionParams негодное не пишет
    await expect(setAbaSessionParams(db, KID, { maxTeachingTargets: 1, responseWindowMs: { match: 2000 } }, '7', AT)).rejects.toBeInstanceOf(AbaSessionParamsInvalidError);
  });

  it('очистка прогресса параметры и журнал оставляет (№189), отзыв и удаление ребёнка — стирают; другого ребёнка не трогают', async () => {
    const db = await granted(KID, OTHER);
    for (const kid of [KID, OTHER]) await setAbaSessionParams(db, kid, { maxTeachingTargets: 1 }, '7', AT);
    await clearChildProgress(db, KID);
    expect([await loadChildState(db, KID, 'abaSessionParams'), await countOf(db, 'aba_specialist_events')]).toEqual([{ maxTeachingTargets: 1 }, 1]);
    expect((await abaDataSummary(db, KID)).specialistEvents).toBe(1);
    const [grant] = await db.all<{ text_version: string }>("SELECT text_version FROM consent_events WHERE child_id = ? AND scope = 'aba_processing'", [KID]);
    await revokeAbaProcessing(
      db,
      { id: 'revoke-kid', scope: 'aba_processing', action: 'revoke', childId: KID, textVersion: grant.text_version, confirmedBy: 'pin', actorId: 'acc', at: AT },
      'owner',
    );
    expect([await loadChildState(db, KID, 'abaSessionParams'), await countOf(db, 'aba_specialist_events')]).toEqual([undefined, 0]);
    expect([await loadChildState(db, OTHER, 'abaSessionParams'), await countOf(db, 'aba_specialist_events', OTHER)]).toEqual([{ maxTeachingTargets: 1 }, 1]);
    await purgeChild(db, OTHER, '9f1c2b3a-4d5e-4f60-8a7b-1c2d3e4f5a6b');
    expect([await loadChildState(db, OTHER, 'abaSessionParams'), await countOf(db, 'aba_specialist_events', OTHER)]).toEqual([undefined, 0]);
  });
});

describe('действия специалиста: состояние и событие — вместе', () => {
  const states = async (db: SqlDb) => (await loadChildState(db, KID, 'abaTargets')) ?? {};
  const putTargets = (db: SqlDb, s: Record<string, AbaTargetState>) => asAbaWriter(db, KID, (tx) => saveChildState(tx, KID, 'abaTargets', s, AT));
  const lastEvent = async (db: SqlDb) => (await abaSpecialistEventsOf(db, KID)).at(-1);

  it('«Беспокойство по согласию просмотрено»: флаг снят, роль specialist; повтор — ничего', async () => {
    const db = await granted();
    const tg = ABA_TARGETS[0];
    await putTargets(db, { [tg.id]: { ...initialTargetState(tg), flags: ['assent_concern'], assentSessionsInRow: 2 } });
    expect(await reviewAbaAssentConcern(db, KID, tg.id, AT)).toBe(true);
    expect((await states(db))[tg.id]).toMatchObject({ flags: [], assentSessionsInRow: 0, assentConcernReviewed: { role: 'specialist', at: AT } });
    expect(await lastEvent(db)).toEqual({ role: 'specialist', claimed: true, field: 'flag.assent_concern', from: true, to: false, at: AT, targetIds: [tg.id] });
    expect(await reviewAbaAssentConcern(db, KID, tg.id, AT)).toBe(false);
    expect(await countOf(db, 'aba_specialist_events')).toBe(1);
  });

  it('«Назначить проверку вперемешку»: флаг снят у всей группы, счётчики сброшены, событие с участниками', async () => {
    const db = await granted();
    const group = mixGroups(ABA_TARGETS)[0];
    const held = (id: string): AbaTargetState => ({
      ...markMastered(initialTargetState(group.find((t) => t.id === id)!), 3),
      flags: ['mixed_not_established'],
      mixedCheck: { days: ['2026-11-10'], noVerdict: 1, neutralNoVerdict: 1 },
    });
    await putTargets(db, Object.fromEntries(group.map((t) => [t.id, held(t.id)])));
    expect(await assignAbaMixedCheck(db, KID, ABA_TARGETS, group[1].id, AT)).toBe(true);
    for (const t of group) {
      expect((await states(db))[t.id].flags).not.toContain('mixed_not_established');
      expect((await states(db))[t.id].mixedCheck).toEqual({ days: ['2026-11-10'] });
    }
    expect(await lastEvent(db)).toMatchObject({ field: 'flag.mixed_not_established', from: true, to: false, targetIds: group.map((t) => t.id) });
    expect(await assignAbaMixedCheck(db, KID, ABA_TARGETS, group[0].id, AT)).toBe(false);
  });

  it('«Просмотрено»: token_training_stalled и pairing_keeps_breaking — у доски, ioa_low — у цели; флаг может вернуться', async () => {
    const db = await granted();
    const tg = ABA_TARGETS[0];
    await asAbaWriter(db, KID, (tx) => saveChildState(tx, KID, 'tokenTraining', { ...initialTokenTraining(), pairingDone: true, flags: ['token_training_stalled', 'pairing_keeps_breaking'] }, AT));
    await putTargets(db, { [tg.id]: { ...initialTargetState(tg), flags: ['ioa_low', 'position_bias'] } });
    expect(await reviewAbaFlag(db, KID, 'token_training_stalled', AT)).toBe(true);
    expect((await loadChildState(db, KID, 'tokenTraining'))?.flags).toEqual(['pairing_keeps_breaking']);
    expect(await reviewAbaFlag(db, KID, 'pairing_keeps_breaking', AT)).toBe(true);
    expect((await loadChildState(db, KID, 'tokenTraining'))?.flags).toEqual([]);
    expect(await reviewAbaFlag(db, KID, 'ioa_low', AT, tg.id)).toBe(true);
    // сигнал только для чтения не снимается
    expect((await states(db))[tg.id].flags).toEqual(['position_bias']);
    expect((await abaSpecialistEventsOf(db, KID)).map((e) => e.field)).toEqual(['flag.token_training_stalled', 'flag.pairing_keeps_breaking', 'flag.ioa_low']);
    expect(await reviewAbaFlag(db, KID, 'ioa_low', AT, tg.id)).toBe(false);
  });

  it('«Подтвердить сопряжение»: только обученному; pairingDone и событие одной транзакцией', async () => {
    const db = await granted();
    await asAbaWriter(db, KID, (tx) => saveChildState(tx, KID, 'abaObservers', [{ id: 'obs-spec', role: 'specialist', trained: false }], AT));
    await expect(confirmAbaPairingAsSpecialist(db, KID, 'obs-spec', AT)).rejects.toBeInstanceOf(AbaObserverNotTrainedError);
    expect(await countOf(db, 'aba_specialist_events')).toBe(0);
    expect(await setAbaObserverTrained(db, KID, 'obs-spec', true, AT)).toBe(true);
    await confirmAbaPairingAsSpecialist(db, KID, 'obs-spec', AT);
    expect(await loadChildState(db, KID, 'tokenTraining')).toMatchObject({ pairingDone: true, pairingConfirmed: { observerId: 'obs-spec', byRole: 'specialist', at: AT } });
    const events = await abaSpecialistEventsOf(db, KID);
    expect(events.map((e) => [e.field, e.from, e.to, e.observerRole])).toEqual([
      ['observerTrained', false, true, 'specialist'],
      ['pairingDone', false, true, undefined],
    ]);
    // в событиях нет uuid наблюдателя
    expect(JSON.stringify(events)).not.toContain('obs-spec');
  });

  it('«Награда от взрослого»: событие и профиль; профиль не записался — обратное событие, ошибка наружу', async () => {
    const db = await granted();
    const profile = newProfile({ childId: KID, band: '7', interfaceLang: 'ru', createdAt: AT });
    const saved: unknown[] = [];
    expect(await setAdultRewardAsSpecialist(db, profile, true, async (p) => void saved.push(p), AT)).toBe(true);
    expect(saved).toEqual([{ ...profile, adultReward: true }]);
    expect(await setAdultRewardAsSpecialist(db, { ...profile, adultReward: true }, true, async () => undefined, AT)).toBe(false);
    await expect(
      setAdultRewardAsSpecialist(db, { ...profile, adultReward: true }, false, async () => {
        throw new Error('диск');
      }, AT),
    ).rejects.toThrow('диск');
    expect((await abaSpecialistEventsOf(db, KID)).map((e) => [e.field, e.from, e.to])).toEqual([
      ['adultReward', false, true],
      ['adultReward', true, false],
      ['adultReward', false, true],
    ]);
  });
});

describe('изменения условий вне раздела — роль parent (финальная рецензия методиста 2026-11-18)', () => {
  const events = async (db: SqlDb) => (await abaSpecialistEventsOf(db, KID)).map(({ at: _a, claimed: _c, ...e }) => e);
  const profile = newProfile({ childId: KID, band: '7', interfaceLang: 'ru', createdAt: AT });
  const saver = () => {
    const saved: unknown[] = [];
    return { saved, save: async (p: unknown) => void saved.push(p) };
  };

  it('«Кто ведёт»: смена «обучен» — событие parent без uuid; новый наблюдатель — как был «не обучен»; без роли — без события', async () => {
    const db = await granted();
    await setAbaObservers(db, KID, [{ id: 'obs-1', role: 'parent', trained: false }], AT, 'parent');
    expect(await events(db)).toEqual([]);
    await setAbaObservers(db, KID, [{ id: 'obs-1', role: 'parent', trained: true }], AT, 'parent');
    await setAbaObservers(db, KID, [{ id: 'obs-2', role: 'specialist', trained: true }, { id: 'obs-1', role: 'parent', trained: true }], AT, 'parent');
    await setAbaObservers(db, KID, [{ id: 'obs-1', role: 'parent', trained: false }], AT);
    expect(await events(db)).toEqual([
      { role: 'parent', field: 'observerTrained', from: false, to: true, observerRole: 'parent' },
      { role: 'parent', field: 'observerTrained', from: false, to: true, observerRole: 'specialist' },
    ]);
    expect(JSON.stringify(await abaSpecialistEventsOf(db, KID))).not.toMatch(/obs-/);
  });

  it('«Сопряжение подтверждено» в карточке ABA — событие parent одной транзакцией; повтор — ничего', async () => {
    const db = await granted();
    await setAbaObservers(db, KID, [{ id: 'obs-1', role: 'parent', trained: true }], AT);
    await confirmAbaPairing(db, KID, { observerId: 'obs-1', byRole: 'owner', at: AT });
    await confirmAbaPairing(db, KID, { observerId: 'obs-1', byRole: 'owner', at: AT });
    expect(await events(db)).toEqual([{ role: 'parent', field: 'pairingDone', from: false, to: true }]);
    expect((await loadChildState(db, KID, 'tokenTraining'))?.pairingDone).toBe(true);
  });

  it('смена полосы профиля: параметры вне пределов новой полосы сняты, событие band со снятыми полями и по полю', async () => {
    const db = await granted();
    await setAbaSessionParams(db, KID, { timeLimitMs: 18 * 60_000, maxTeachingTargets: 1 }, '7', AT);
    const before = await countOf(db, 'aba_specialist_events');
    const { saved, save } = saver();
    expect(await saveProfileAsParent(db, profile, { ...profile, band: '5-6' }, save, AT)).toBe(true);
    expect(saved).toEqual([{ ...profile, band: '5-6' }]);
    // 5–6: лимит до 15 мин — 18 мин сняты, «одна цель» осталась
    expect(await loadChildState(db, KID, 'abaSessionParams')).toEqual({ maxTeachingTargets: 1 });
    expect((await events(db)).slice(before)).toEqual([
      { role: 'parent', field: 'band', from: '7', to: '5-6', removed: ['timeLimitMs'] },
      { role: 'parent', field: 'timeLimitMs', from: 18 * 60_000, to: null },
    ]);
  });

  it('смена полосы без параметров специалиста — событие band без removed, параметров не появляется', async () => {
    const db = await granted();
    const { save } = saver();
    await saveProfileAsParent(db, profile, { ...profile, band: '8' }, save, AT);
    expect(await events(db)).toEqual([{ role: 'parent', field: 'band', from: '7', to: '8' }]);
    expect(await loadChildState(db, KID, 'abaSessionParams')).toBeUndefined();
  });

  it('«Награда от взрослого» в профиле — событие parent; то же значение — ничего', async () => {
    const db = await granted();
    const { save } = saver();
    expect(await saveProfileAsParent(db, profile, { ...profile, adultReward: true }, save, AT)).toBe(true);
    expect(await saveProfileAsParent(db, { ...profile, adultReward: true }, { ...profile, adultReward: true, sessionMinutes: 20 }, save, AT)).toBe(false);
    expect(await events(db)).toEqual([{ role: 'parent', field: 'adultReward', from: false, to: true }]);
  });

  it('без согласия на ABA и на паузе — профиль пишется, события нет, ошибки нет', async () => {
    const plain = await memoryDb();
    const a = saver();
    expect(await saveProfileAsParent(plain, profile, { ...profile, band: '5-6', adultReward: true }, a.save, AT)).toBe(false);
    expect(a.saved).toHaveLength(1);
    const db = await granted();
    await setAbaPaused(db, KID, true, AT);
    const b = saver();
    expect(await saveProfileAsParent(db, profile, { ...profile, band: '5-6', adultReward: true }, b.save, AT)).toBe(false);
    expect([b.saved.length, await countOf(db, 'aba_specialist_events')]).toEqual([1, 0]);
  });

  it('профиль не записался — события нет, ошибка наружу', async () => {
    const db = await granted();
    await expect(
      saveProfileAsParent(db, profile, { ...profile, band: '5-6' }, async () => {
        throw new Error('диск');
      }, AT),
    ).rejects.toThrow('диск');
    expect(await countOf(db, 'aba_specialist_events')).toBe(0);
  });
});

describe('шаг «коснись картинки» в разделе специалиста', () => {
  it('флаги шага видны; assent_concern снимается отметкой с событием step; повтор — ничего', async () => {
    const db = await granted();
    const st = { ...initialSampleTouch(), flags: ['sample_touch_not_acquired' as const, 'assent_concern' as const], assentSessionsInRow: 2 };
    await asAbaWriter(db, KID, (tx) => saveChildState(tx, KID, 'sampleTouch', st, AT));
    expect((await loadSpecialistView(db, KID, '7')).sampleTouchFlags).toEqual(['sample_touch_not_acquired', 'assent_concern']);
    expect(await reviewAbaSampleTouchAssentConcern(db, KID, AT)).toBe(true);
    expect(await loadChildState(db, KID, 'sampleTouch')).toMatchObject({ flags: ['sample_touch_not_acquired'], assentSessionsInRow: 0, assentConcernReviewed: { role: 'specialist', at: AT } });
    expect((await abaSpecialistEventsOf(db, KID)).at(-1)).toEqual({ role: 'specialist', claimed: true, field: 'flag.assent_concern', from: true, to: false, at: AT, step: 'sample_touch' });
    expect(await reviewAbaSampleTouchAssentConcern(db, KID, AT)).toBe(false);
    const out = await exportForSpecialist(db, KID, AT);
    expect(out.abaSpecialistEvents.at(-1)).toMatchObject({ field: 'flag.assent_concern', step: 'sample_touch' });
  });
});

describe('экспорт', () => {
  it('специалисту: параметры в состоянии, журнал — день без времени, роль заявленная, без uuid; родителю — всё', async () => {
    const db = await granted();
    await asAbaWriter(db, KID, (tx) => saveChildState(tx, KID, 'abaObservers', [{ id: 'obs-spec', role: 'specialist', trained: false }], AT));
    await setAbaObserverTrained(db, KID, 'obs-spec', true, AT);
    await setAbaSessionParams(db, KID, { maxTeachingTargets: 1 }, '7', AT);
    const out = await exportForSpecialist(db, KID, AT);
    expect(out.state.abaSessionParams).toEqual({ maxTeachingTargets: 1 });
    expect(out.abaSpecialistEvents).toEqual([
      { order: 1, day: '2026-11-18', role: 'specialist', claimed: true, field: 'observerTrained', from: false, to: true, observerRole: 'specialist' },
      { order: 2, day: '2026-11-18', role: 'specialist', claimed: true, field: 'maxTeachingTargets', from: null, to: 1 },
    ]);
    expect(JSON.stringify(out.abaSpecialistEvents)).not.toMatch(/T\d{2}:\d{2}|obs-spec/);
    const all = await exportChild(db, KID, AT, {});
    expect(all.abaSpecialistEvents).toHaveLength(2);
    expect(all.state.abaSessionParams).toEqual({ maxTeachingTargets: 1 });
  });
});
