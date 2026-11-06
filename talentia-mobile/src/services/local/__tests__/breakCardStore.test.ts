/**
 * Карточка «перерыв» в хранилище (`breakCard` в ABA-состоянии ребёнка): `commitAbaSession` пишет её
 * из событий сессии, `loadBreakCardPlan` читает, экспорт специалисту без uuid наблюдателя и устройства,
 * согласие, отзыв и стирание. Домен — `domain/__tests__/abaBreakCard.test.ts`.
 */
import { CURRENT_CONSENT_TEXTS } from '../../../domain/consentTexts';
import { initialBreakCard } from '../../../domain/abaBreakCard';
import {
  finishAbaSession,
  finishBreak,
  nextStep,
  recordBreakCardTraining,
  recordTrial,
  stopSession,
  type AbaSessionState,
} from '../../../domain/abaSession';
import { initialTokenTraining } from '../../../domain/abaTokenTraining';
import type { ConsentEvent } from '../../../domain/consent';
import { BASE_MS, beginSession, correctInput } from '../../../domain/__tests__/abaSessionDriver';
import { AbaBoardConflictError, AbaConsentRequiredError } from '../abaLog';
import { loadChildState, saveChildState } from '../childState';
import { commitAbaSession, loadBreakCardPlan } from '../commit';
import { appendConsentEvent } from '../consentLog';
import { clearChildProgress, exportChild, exportForSpecialist, purgeChild, revokeAbaProcessing, wipeDevice } from '../purge';
import type { SqlDb } from '../sql';
import { asAbaWriter, memoryDb } from './nodeSql';

const NOW = '2026-10-12T10:00:00Z';
const PSEUDO = '5f0c2a8e-3b1d-4c6e-9a7f-2d8b1e4c7a90';
const iso = (ms: number) => new Date(ms).toISOString();

const consent = (action: 'grant' | 'revoke', childId = 'kid', at = '2026-10-12T07:00:00Z'): ConsentEvent => ({
  id: `aba-${action}-${childId}-${at}`,
  scope: 'aba_processing',
  action,
  childId,
  textVersion: CURRENT_CONSENT_TEXTS.aba_processing[0],
  confirmedBy: 'biometric',
  actorId: 'parent',
  at,
});

async function setup(kids = ['kid']): Promise<SqlDb> {
  const db = await memoryDb();
  for (const [i, kid] of kids.entries()) {
    await appendConsentEvent(db, consent('grant', kid, `2026-10-12T07:0${i}:00Z`), 'owner');
    await asAbaWriter(db, kid, async (tx) => {
      await saveChildState(tx, kid, 'tokenTraining', { ...initialTokenTraining(), pairingDone: true, stage: 5 }, NOW);
    });
  }
  return db;
}

const independentTouch = { step: 'independent' as const, touched: true, gestureGiven: false, latencyMs: 900 };
const noTouch = { step: 'model' as const, touched: false, gestureGiven: false, latencyMs: null };

/** Сессия, закончившаяся успехом сразу: с обучающими возможностями, если они переданы. */
function sessionWith(training: Parameters<typeof recordBreakCardTraining>[1][], over: Partial<AbaSessionState> = {}) {
  let st: AbaSessionState = { ...beginSession(), ...over };
  let now = BASE_MS + 2000;
  for (const t of training) {
    st = recordBreakCardTraining(st, t, now);
    if (t.touched) {
      const b = nextStep(st, now + 100);
      st = finishBreak(b.state, now + 15_000).state;
    }
    now += 20_000;
  }
  return finishAbaSession({ ...stopSession(st, 'adult_stopped'), endReason: 'completed' }, now + 1000, {}, undefined, undefined, { routineExchangeInWindow: false });
}

/** Сессия, где ребёнок попросил перерыв карточкой в пробе (событие assent child_card). */
function sessionWithChildRequest() {
  const st0 = beginSession();
  const now = BASE_MS + 1000;
  const next = nextStep(st0, now);
  if (next.step.kind !== 'trial') throw new Error('ждали пробу');
  const base = correctInput(next.state, next.step);
  const log = base.presentationLog;
  const { respondedAt: _r, ...last } = log[log.length - 1];
  const input = { ...base, presentationLog: [...log.slice(0, -1), { ...last, outcome: 'child_break' as const }] };
  const rec = recordTrial(next.state, input, now);
  if (!rec.ok) throw new Error(rec.errors.join('; '));
  return finishAbaSession({ ...stopSession(rec.state, 'adult_stopped'), endReason: 'completed' }, now + 60_000, {}, undefined, undefined, { routineExchangeInWindow: false });
}

const breakCardOf = (db: SqlDb) => loadChildState(db, 'kid', 'breakCard');

describe('commitAbaSession пишет карточку «перерыв»', () => {
  it('обучение: касание без жеста на independent — карточка принята (training), день и наблюдатель записаны', async () => {
    const db = await setup();
    const r = sessionWith([independentTouch]);
    await commitAbaSession(db, 'kid', r, iso(BASE_MS + 60_000));
    expect(await breakCardOf(db)).toMatchObject({ acquired: true, acquiredVia: 'training', step: 'independent', observerId: 'obs-spec', lastSessionDay: '2026-10-12' });
  });

  it('обучающий перерыв не стал просьбой в пробе: в recent просьб ноль', async () => {
    const db = await setup();
    await commitAbaSession(db, 'kid', sessionWith([independentTouch]), iso(BASE_MS + 60_000));
    const card = await breakCardOf(db);
    expect(card!.recent).toEqual([{ sessionIndex: 10, day: '2026-10-12', requests: 0, byLimit: false }]);
  });

  it('обучение без касаний: сессия обучения засчитана, ступень выросла model → prompted', async () => {
    const db = await setup();
    await commitAbaSession(db, 'kid', sessionWith([noTouch, noTouch, noTouch]), iso(BASE_MS + 60_000));
    expect(await breakCardOf(db)).toMatchObject({ acquired: false, sessionsTried: 1, step: 'prompted' });
  });

  it('просьба карточкой в пробе при непринятой карточке — принятие in_trial', async () => {
    const db = await setup();
    await commitAbaSession(db, 'kid', sessionWithChildRequest(), iso(BASE_MS + 60_000));
    const card = await breakCardOf(db);
    expect(card).toMatchObject({ acquired: true, acquiredVia: 'in_trial', step: 'independent' });
    expect(card!.recent[0].requests).toBe(1);
  });

  it('сессия без обучения и без просьб: карточка остаётся начальной, но день и окно сессий ведутся', async () => {
    const db = await setup();
    await commitAbaSession(db, 'kid', sessionWith([]), iso(BASE_MS + 60_000));
    expect(await breakCardOf(db)).toMatchObject({ ...initialBreakCard(), lastSessionDay: '2026-10-12', observerId: 'obs-spec', recent: [{ sessionIndex: 10, requests: 0 }] });
  });

  it('две сессии подряд накапливают sessionsTried и окно', async () => {
    const db = await setup();
    await commitAbaSession(db, 'kid', sessionWith([noTouch]), iso(BASE_MS + 60_000));
    const second = sessionWith([noTouch]);
    await commitAbaSession(db, 'kid', { ...second, session: { ...second.session, index: 11, id: 's-11' }, boardRev: second.boardRev }, iso(BASE_MS + 120_000));
    const card = await breakCardOf(db);
    expect([card!.sessionsTried, card!.recent.map((r) => r.sessionIndex)]).toEqual([2, [10, 11]]);
  });

  it('конфликт доски откатывает итог целиком: карточка не записана', async () => {
    const db = await setup();
    const r = sessionWith([independentTouch]);
    await asAbaWriter(db, 'kid', (tx) => saveChildState(tx, 'kid', 'abaBoard', { earned: 1, nonContingent: 0, rev: 7 }, NOW));
    await expect(commitAbaSession(db, 'kid', r, iso(BASE_MS + 60_000))).rejects.toBeInstanceOf(AbaBoardConflictError);
    expect(await breakCardOf(db)).toBeUndefined();
  });

  it('без согласия карточка не пишется', async () => {
    const db = await memoryDb();
    await expect(commitAbaSession(db, 'kid', sessionWith([independentTouch]), NOW)).rejects.toBeInstanceOf(AbaConsentRequiredError);
    expect(await breakCardOf(db)).toBeUndefined();
  });

  it('запись breakCard мимо ворот отклоняет сама база', async () => {
    const db = await setup();
    await expect(
      db.run("INSERT INTO child_state (child_id, key, body, updated_at) VALUES ('kid', 'breakCard', '{}', ?)", [NOW]),
    ).rejects.toThrow(/только через commit\.ts/);
  });
});

describe('loadBreakCardPlan', () => {
  const ctx = { config: 'with_adult' as const, day: '2026-10-12', observerId: 'obs-spec' };

  it('карточки нет: три возможности со ступени model', async () => {
    const db = await setup();
    expect(await loadBreakCardPlan(db, 'kid', ctx)).toMatchObject({ opportunities: 3, startStep: 'model' });
  });

  it('после принятия — возможностей нет, пока всё по-прежнему', async () => {
    const db = await setup();
    await commitAbaSession(db, 'kid', sessionWith([independentTouch]), iso(BASE_MS + 60_000));
    expect((await loadBreakCardPlan(db, 'kid', ctx)).opportunities).toBe(0);
  });

  it('через 14 дней — одна возможность без модели; сменился наблюдатель — подсказка взрослому', async () => {
    const db = await setup();
    await commitAbaSession(db, 'kid', sessionWith([independentTouch]), iso(BASE_MS + 60_000));
    expect(await loadBreakCardPlan(db, 'kid', { ...ctx, day: '2026-10-26' })).toMatchObject({ opportunities: 1, startStep: 'independent', retrain: true });
    expect(await loadBreakCardPlan(db, 'kid', { ...ctx, observerId: 'obs-other' })).toMatchObject({ opportunities: 1, adultCoaching: true });
  });

  it('«Сам» — обучения нет', async () => {
    const db = await setup();
    expect((await loadBreakCardPlan(db, 'kid', { ...ctx, config: 'alone' })).opportunities).toBe(0);
  });

  it('карточка другого ребёнка не читается', async () => {
    const db = await setup(['kid', 'sib']);
    await commitAbaSession(db, 'kid', sessionWith([independentTouch]), iso(BASE_MS + 60_000));
    expect((await loadBreakCardPlan(db, 'sib', ctx)).opportunities).toBe(3);
  });
});

describe('экспорт, отзыв и стирание карточки', () => {
  async function withCard() {
    const db = await setup();
    await commitAbaSession(db, 'kid', sessionWith([independentTouch]), iso(BASE_MS + 60_000));
    await asAbaWriter(db, 'kid', async (tx) => {
      const card = (await loadChildState(tx, 'kid', 'breakCard'))!;
      await saveChildState(tx, 'kid', 'breakCard', { ...card, deviceId: 'device-uuid-1' }, NOW);
    });
    return db;
  }

  it('родителю — карточка целиком, включая наблюдателя и устройство', async () => {
    const db = await withCard();
    const card = (await exportChild(db, 'kid', NOW, {})).state.breakCard as Record<string, unknown>;
    expect(card).toMatchObject({ acquired: true, observerId: 'obs-spec', deviceId: 'device-uuid-1' });
  });

  it('специалисту — карточка без observerId и deviceId; остальное на месте', async () => {
    const db = await withCard();
    const card = (await exportForSpecialist(db, 'kid', NOW)).state.breakCard as Record<string, unknown>;
    expect(card).not.toHaveProperty('observerId');
    expect(card).not.toHaveProperty('deviceId');
    expect(card).toMatchObject({ acquired: true, acquiredVia: 'training', step: 'independent', flags: [] });
    expect(JSON.stringify(card)).not.toMatch(/obs-spec|device-uuid-1/);
  });

  it('специалисту: в выгрузке карточки нет времени суток', async () => {
    const db = await withCard();
    const json = JSON.stringify((await exportForSpecialist(db, 'kid', NOW)).state.breakCard);
    expect(json).not.toMatch(/T\d{2}:\d{2}/);
  });

  it('отзыв согласия удаляет карточку, чужая остаётся', async () => {
    const db = await setup(['kid', 'sib']);
    await commitAbaSession(db, 'kid', sessionWith([independentTouch]), iso(BASE_MS + 60_000));
    const other = sessionWith([independentTouch]);
    await commitAbaSession(db, 'sib', { ...other, session: { ...other.session, id: 's-sib' } }, iso(BASE_MS + 60_000));
    await revokeAbaProcessing(db, consent('revoke', 'kid', '2026-10-12T12:00:00Z'), 'owner');
    expect(await loadChildState(db, 'kid', 'breakCard')).toBeUndefined();
    expect(await loadChildState(db, 'sib', 'breakCard')).toMatchObject({ acquired: true });
  });

  it('база отклоняет отзыв, пока осталась одна лишь карточка (триггер знает ключ breakCard)', async () => {
    const db = await setup();
    await asAbaWriter(db, 'kid', (tx) => saveChildState(tx, 'kid', 'breakCard', initialBreakCard(), NOW));
    await expect(
      db.transaction((tx) => tx.run("INSERT INTO consent_events (id, scope, action, child_id, text_version, confirmed_by, actor_id, at) VALUES ('r1', 'aba_processing', 'revoke', 'kid', 'ru-draft-1', 'biometric', 'parent', '2026-10-12T12:00:00Z')")),
    ).rejects.toThrow(/вместе с удалением/);
  });

  it('purgeChild, clearChildProgress и wipeDevice стирают карточку', async () => {
    for (const wipe of [
      (db: SqlDb) => purgeChild(db, 'kid', PSEUDO),
      (db: SqlDb) => clearChildProgress(db, 'kid'),
      (db: SqlDb) => wipeDevice(db),
    ]) {
      const db = await setup();
      await commitAbaSession(db, 'kid', sessionWith([independentTouch]), iso(BASE_MS + 60_000));
      await wipe(db);
      expect(await loadChildState(db, 'kid', 'breakCard')).toBeUndefined();
    }
  });
});
