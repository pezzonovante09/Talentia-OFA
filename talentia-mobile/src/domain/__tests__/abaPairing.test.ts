/** Сессия сопряжения (этап 11, Д1): фазы, таймеры, критерий, запись итога. */
import type { ConsentEvent } from '../consent';
import { applyPairingEvent, pairingDueAt, pairingResultOf, PairingError, startPairing, type PairingState } from '../abaPairing';
import { initialTokenTraining, PAIRING } from '../abaTokenTraining';
import { seeded } from '../abaRandom';
import { appendConsentEvent } from '../../services/local/consentLog';
import { commitPairingSession } from '../../services/local/commit';
import { loadChildState } from '../../services/local/childState';
import { reinforcerHistoryOf } from '../../services/local/abaLog';
import { memoryDb } from '../../services/local/__tests__/nodeSql';

const POOL = ['puzzle', 'bubbles', 'drum', 'xylophone', 'kaleido', 'dance'];
const T0 = Date.parse('2026-10-25T10:00:00Z');

const start = (sessionId = '7b0e9a52-4d1c-4f3a-9a1e-2c6d8f0b1a3e') =>
  startPairing({ sessionId, pool: POOL, history: [], rng: seeded(7).rng, now: T0 });

/** Полная сессия: каждый выбор — `by`, таймеры точно в срок. */
function fullSession(by: 'child' | 'adult' = 'child'): PairingState {
  let s = start();
  let t = T0;
  for (let i = 0; i < PAIRING.cycles; i += 1) {
    if (by === 'adult') t += PAIRING.choiceTimeoutMs;
    s = applyPairingEvent(s, { type: 'choose', reinforcerId: s.options[i % 3], by, now: t });
    t += PAIRING.tokenAfterMs;
    s = applyPairingEvent(s, { type: 'token', now: t });
    t += PAIRING.accessMs;
    s = applyPairingEvent(s, { type: 'access_done', now: t });
  }
  return s;
}

describe('сопряжение: ход', () => {
  it('три варианта на всю сессию; четыре цикла и конец сразу после четвёртого доступа', () => {
    const s0 = start();
    expect(s0.options).toHaveLength(3);
    const s = fullSession();
    expect(s).toMatchObject({ phase: 'done', cycles: 4, endReason: 'completed', options: s0.options });
    expect(s.choices).toHaveLength(4);
  });

  it('таймеры: жетон не раньше 10 с, доступ не короче 20 с, взрослый — после 30 с', () => {
    let s = start();
    expect(() => applyPairingEvent(s, { type: 'choose', reinforcerId: s.options[0], by: 'adult', now: T0 + 29_999 })).toThrow(PairingError);
    s = applyPairingEvent(s, { type: 'choose', reinforcerId: s.options[0], by: 'child', now: T0 + 1000 });
    expect(pairingDueAt(s)).toEqual({ event: 'token', at: T0 + 1000 + PAIRING.tokenAfterMs });
    expect(() => applyPairingEvent(s, { type: 'token', now: T0 + 1000 + 9_999 })).toThrow(PairingError);
    s = applyPairingEvent(s, { type: 'token', now: T0 + 11_000 });
    expect(() => applyPairingEvent(s, { type: 'access_done', now: T0 + 11_000 + 19_999 })).toThrow(PairingError);
    s = applyPairingEvent(s, { type: 'access_done', now: T0 + 31_000 });
    expect(s).toMatchObject({ phase: 'choose', cycles: 1, reinforcerId: null });
  });

  it('событие не по фазе и чужой подкрепитель — ошибка программы', () => {
    const s = start();
    expect(() => applyPairingEvent(s, { type: 'token', now: T0 + 60_000 })).toThrow(PairingError);
    expect(() => applyPairingEvent(s, { type: 'choose', reinforcerId: 'candy', by: 'child', now: T0 })).toThrow(PairingError);
  });

  it('остановка — конец с причиной; после конца событий нет', () => {
    const s = applyPairingEvent(start(), { type: 'stop', reason: 'adult_stopped', now: T0 + 5000 });
    expect(s).toMatchObject({ phase: 'done', endReason: 'adult_stopped' });
    expect(() => applyPairingEvent(s, { type: 'stop', reason: 'abandoned', now: T0 + 6000 })).toThrow(PairingError);
  });
});

describe('сопряжение: критерий', () => {
  it('все выборы ребёнка — child; хотя бы один взрослого — adult; без выборов — adult', () => {
    expect(pairingResultOf(fullSession('child')).chosenBy).toBe('child');
    expect(pairingResultOf(fullSession('adult')).chosenBy).toBe('adult');
    expect(pairingResultOf(applyPairingEvent(start(), { type: 'stop', reason: 'abandoned', now: T0 })).chosenBy).toBe('adult');
  });

  it('итог незавершённой сессии — ошибка', () => {
    expect(() => pairingResultOf(start())).toThrow(PairingError);
  });
});

describe('сопряжение: запись', () => {
  const consent: ConsentEvent = {
    id: 'aba-grant-kid',
    scope: 'aba_processing',
    action: 'grant',
    childId: 'kid',
    textVersion: 'ru-draft-1',
    confirmedBy: 'biometric',
    actorId: 'parent',
    at: '2026-10-25T09:00:00Z',
  };

  it('две сессии ребёнка подряд — pairingDone; выборы в истории; повтор не пишет дважды', async () => {
    const db = await memoryDb();
    await appendConsentEvent(db, consent, 'owner');
    const r1 = pairingResultOf(fullSession());
    await commitPairingSession(db, 'kid', r1, '2026-10-25T10:03:00Z');
    await commitPairingSession(db, 'kid', r1, '2026-10-25T10:03:00Z');
    expect(await loadChildState(db, 'kid', 'tokenTraining')).toMatchObject({ pairingDone: false, pairingSessions: 1, pairingStreak: 1 });
    expect(await reinforcerHistoryOf(db, 'kid')).toHaveLength(4);
    const r2 = { ...pairingResultOf(fullSession()), sessionId: '0c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f' };
    await commitPairingSession(db, 'kid', r2, '2026-10-26T10:03:00Z');
    expect(await loadChildState(db, 'kid', 'tokenTraining')).toMatchObject({ ...initialTokenTraining(), pairingDone: true, pairingSessions: 2, pairingStreak: 2 });
  });

  it('без согласия на ABA — не пишется', async () => {
    const db = await memoryDb();
    await expect(commitPairingSession(db, 'kid', pairingResultOf(fullSession()), '2026-10-25T10:03:00Z')).rejects.toThrow();
    expect(await loadChildState(db, 'kid', 'tokenTraining')).toBeUndefined();
  });
});
