/** Сессия сопряжения (этап 11, Д1): фазы, таймеры, критерий, запись итога. */
import { CURRENT_CONSENT_TEXTS } from '../consentTexts';
import type { ConsentEvent } from '../consent';
import { applyPairingEvent, pairingDueAt, pairingResultOf, PairingError, startPairing, type PairingState } from '../abaPairing';
import { initialTokenTraining, PAIRING } from '../abaTokenTraining';
import { seeded } from '../abaRandom';
import { appendConsentEvent } from '../../services/local/consentLog';
import { commitPairingSession, setAbaObservers } from '../../services/local/commit';
import { loadChildState } from '../../services/local/childState';
import { reinforcerHistoryOf } from '../../services/local/abaLog';
import { abaDataSummary, exportChild, exportForSpecialist, revokeAbaProcessing } from '../../services/local/purge';
import { memoryDb } from '../../services/local/__tests__/nodeSql';

const POOL = ['puzzle', 'bubbles', 'drum', 'xylophone', 'kaleido', 'dance'];
const T0 = Date.parse('2026-10-25T10:00:00Z');

const start = (sessionId = '7b0e9a52-4d1c-4f3a-9a1e-2c6d8f0b1a3e') =>
  startPairing({ sessionId, config: 'with_adult', pool: POOL, history: [], apart: [], rng: seeded(7).rng, now: T0 });

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

  it('№164: пары каталога не встают в одну тройку (`song` и `sing_together`)', () => {
    const pool = ['song', 'sing_together', 'bubbles', 'drum', 'xylophone', 'pinwheel'];
    for (let seed = 1; seed <= 200; seed += 1) {
      const s = startPairing({ sessionId: 'p', config: 'with_adult', pool, history: [], apart: [['song', 'sing_together']], rng: seeded(seed).rng, now: T0 });
      expect(s.options.includes('song') && s.options.includes('sing_together')).toBe(false);
      expect(s.options).toHaveLength(3);
    }
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
    textVersion: CURRENT_CONSENT_TEXTS.aba_processing[0],
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

  it('№164: запись сессии — конфигурация, исход, циклы, кто выбирал; ведущий наблюдатель только «со взрослым»', async () => {
    const db = await memoryDb();
    await appendConsentEvent(db, consent, 'owner');
    await setAbaObservers(db, 'kid', [{ id: 'obs-1', role: 'parent', trained: false }], '2026-10-25T09:30:00Z');
    await commitPairingSession(db, 'kid', pairingResultOf(fullSession()), '2026-10-25T10:03:00Z', { primaryObserverId: 'obs-1' });
    const [row] = await db.all<{ body: string; day: string }>('SELECT body, day FROM aba_pairing_sessions WHERE child_id = ?', ['kid']);
    expect(JSON.parse(row.body)).toMatchObject({
      id: '7b0e9a52-4d1c-4f3a-9a1e-2c6d8f0b1a3e',
      config: 'with_adult',
      endReason: 'completed',
      cycles: 4,
      chosenBy: 'child',
      choicesByChild: 4,
      choicesByAdult: 0,
      primaryObserverId: 'obs-1',
      startedAt: new Date(T0).toISOString(),
    });
    expect(row.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('№164: «Сам» — без наблюдателя; ушёл в первом цикле (выборов нет) — повтор итога не пишет второй раз', async () => {
    const db = await memoryDb();
    await appendConsentEvent(db, consent, 'owner');
    const alone = startPairing({ sessionId: '5a4b3c2d-1e0f-4a9b-8c7d-6e5f4a3b2c1d', config: 'alone', pool: POOL, history: [], apart: [], rng: seeded(3).rng, now: T0 });
    const r = pairingResultOf(applyPairingEvent(alone, { type: 'stop', reason: 'abandoned', now: T0 + 60_000 }));
    expect(r).toMatchObject({ config: 'alone', cycles: 0, endReason: 'abandoned', endedAt: T0 + 60_000 });
    await commitPairingSession(db, 'kid', r, '2026-10-25T10:01:00Z', { primaryObserverId: 'obs-1' });
    await commitPairingSession(db, 'kid', r, '2026-10-25T10:01:00Z', { primaryObserverId: 'obs-1' });
    expect(await loadChildState(db, 'kid', 'tokenTraining')).toMatchObject({ pairingSessions: 1, pairingStreak: 0 });
    const rows = await db.all<{ body: string }>('SELECT body FROM aba_pairing_sessions WHERE child_id = ?', ['kid']);
    expect(rows).toHaveLength(1);
    expect(JSON.parse(rows[0].body).primaryObserverId).toBeNull();
  });

  it('№164: наблюдатель не из наблюдателей ребёнка (устаревший id) не пишется', async () => {
    const db = await memoryDb();
    await appendConsentEvent(db, consent, 'owner');
    await commitPairingSession(db, 'kid', pairingResultOf(fullSession()), '2026-10-25T10:03:00Z', { primaryObserverId: 'stale-obs' });
    const [row] = await db.all<{ body: string }>('SELECT body FROM aba_pairing_sessions WHERE child_id = ?', ['kid']);
    expect(JSON.parse(row.body).primaryObserverId).toBeNull();
  });

  it('№164: свёрнутое приложение — не засчитывается и серию не рвёт, исход различим', async () => {
    const db = await memoryDb();
    await appendConsentEvent(db, consent, 'owner');
    await commitPairingSession(db, 'kid', pairingResultOf(fullSession()), '2026-10-25T10:03:00Z');
    const bg = applyPairingEvent(start('0c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f'), { type: 'stop', reason: 'app_backgrounded', now: T0 + 5000 });
    await commitPairingSession(db, 'kid', pairingResultOf(bg), '2026-10-26T10:00:00Z');
    expect(await loadChildState(db, 'kid', 'tokenTraining')).toMatchObject({ pairingSessions: 1, pairingStreak: 1 });
    const reasons = (await db.all<{ body: string }>('SELECT body FROM aba_pairing_sessions ORDER BY seq')).map((r) => JSON.parse(r.body).endReason);
    expect(reasons).toEqual(['completed', 'app_backgrounded']);
  });

  it('№164: запись сопряжения — в отзыве, сводке перед отзывом и обоих экспортах; специалисту без времени суток', async () => {
    const db = await memoryDb();
    await appendConsentEvent(db, consent, 'owner');
    await setAbaObservers(db, 'kid', [{ id: 'obs-1', role: 'parent', trained: false }], '2026-10-25T09:30:00Z');
    await commitPairingSession(db, 'kid', pairingResultOf(fullSession()), '2026-10-25T10:03:00Z', { primaryObserverId: 'obs-1' });
    expect((await abaDataSummary(db, 'kid')).pairingSessions).toBe(1);
    expect((await exportChild(db, 'kid', '2026-10-27T00:00:00Z', {})).abaPairingSessions).toHaveLength(1);
    const spec = (await exportForSpecialist(db, 'kid', '2026-10-27T00:00:00Z')).abaPairingSessions as Record<string, unknown>[];
    expect(spec[0]).toMatchObject({ config: 'with_adult', cycles: 4, primaryObserverId: 'O1' });
    expect(spec[0]).not.toHaveProperty('startedAt');
    expect(spec[0]).not.toHaveProperty('endedAt');
    expect(typeof spec[0].durationSec).toBe('number');
    // выборы сопряжения: источник назван, день — день записи сопряжения, доска из одной ячейки
    const choices = (await exportForSpecialist(db, 'kid', '2026-10-27T00:00:00Z')).abaReinforcerChoices as Record<string, unknown>[];
    expect(choices).toHaveLength(4);
    expect(choices.every((c) => c.source === 'pairing' && c.boardSize === 1 && c.day === spec[0].day)).toBe(true);
    await revokeAbaProcessing(
      db,
      { id: 'aba-revoke-kid', scope: 'aba_processing', action: 'revoke', childId: 'kid', textVersion: CURRENT_CONSENT_TEXTS.aba_processing[0], confirmedBy: 'pin', actorId: 'parent', at: '2026-10-27T00:00:00Z' },
      'owner',
    );
    expect(await db.all('SELECT 1 FROM aba_pairing_sessions WHERE child_id = ?', ['kid'])).toHaveLength(0);
  });
});
