/**
 * №165 — точечная разморозка домена ABA по вопросам 44–48 (владелец 2026-10-29): провал наблюдения `match` поднимает
 * старт только до L1; «дважды подряд» по классу пары; исход сопряжения `no_choice`; флаг подряд незасчитанных
 * сопряжений; латентность выбора и предложенная тройка в записи сопряжения и у специалиста.
 */
import { MATCH_SAME_3 } from '../../content/aba/match-level1';
import type { ConsentEvent } from '../consent';
import { applyPairingEvent, pairingResultOf, PairingError, startPairing } from '../abaPairing';
import { applyTrialToFading, initialTargetState } from '../abaPrompting';
import { seeded } from '../abaRandom';
import { applyPairingSession, initialTokenTraining, PAIRING } from '../abaTokenTraining';
import { reinforcerChoices, type Rng } from '../abaTokens';
import { appendConsentEvent } from '../../services/local/consentLog';
import { commitPairingSession } from '../../services/local/commit';
import { exportForSpecialist } from '../../services/local/purge';
import { memoryDb } from '../../services/local/__tests__/nodeSql';
import { trial } from './abaFixtures';

describe('44: провал наблюдения match', () => {
  const warm = () => ({ ...initialTargetState(MATCH_SAME_3), startPromptLevel: 0 as const, lastSuccessfulPromptLevel: 0 as const });
  /** Подсказали к образцу, образца не коснулись — молчание. */
  const miss = () =>
    trial({ targetId: MATCH_SAME_3.id, response: 'no_response', promptLevelUsed: 1, startPromptLevel: 0, observingPrompted: true, observingLatencyMs: null, scoredBy: 'device_tap' });
  /** Образца коснулись, а выбрать не выбрали. */
  const choiceFail = () =>
    trial({ targetId: MATCH_SAME_3.id, response: 'no_response', promptLevelUsed: 2, startPromptLevel: 0, observingLatencyMs: 1500, scoredBy: 'device_tap' });

  it('два провала наблюдения подряд — старт L1, не L3', () => {
    let s = applyTrialToFading(warm(), miss(), MATCH_SAME_3);
    expect(s.consecutiveObservingFailures).toBe(1);
    s = applyTrialToFading(s, miss(), MATCH_SAME_3);
    expect([s.startPromptLevel, s.consecutiveFailures, s.consecutiveObservingFailures ?? 0]).toEqual([1, 0, 0]);
  });

  it('в серии есть провал выбора — прежний подъём до уровня, несущего ответ', () => {
    let s = applyTrialToFading(warm(), miss(), MATCH_SAME_3);
    s = applyTrialToFading(s, choiceFail(), MATCH_SAME_3);
    expect(s.startPromptLevel).toBe(3);
    s = applyTrialToFading(warm(), choiceFail(), MATCH_SAME_3);
    s = applyTrialToFading(s, miss(), MATCH_SAME_3);
    expect(s.startPromptLevel).toBe(3);
  });

  it('со старта L1 (метка сразу) — провалы наблюдения оставляют L1; на старте L3 — L3', () => {
    const at = (start: 1 | 3) => ({ ...warm(), startPromptLevel: start });
    const missAt = (start: 1 | 3) =>
      trial({ targetId: MATCH_SAME_3.id, response: 'no_response', promptLevelUsed: 3, startPromptLevel: start, observingLatencyMs: null, scoredBy: 'device_tap' });
    for (const start of [1, 3] as const) {
      let s = applyTrialToFading(at(start), missAt(start), MATCH_SAME_3);
      s = applyTrialToFading(s, missAt(start), MATCH_SAME_3);
      expect(s.startPromptLevel).toBe(start);
    }
  });

  it('у форматов без образца поля нет — правило не задевает', () => {
    const plain = initialTargetState(MATCH_SAME_3);
    let s = applyTrialToFading({ ...plain, startPromptLevel: 0 }, trial({ targetId: MATCH_SAME_3.id, response: 'no_response', promptLevelUsed: 2, startPromptLevel: 0 }), MATCH_SAME_3);
    s = applyTrialToFading(s, trial({ targetId: MATCH_SAME_3.id, response: 'no_response', promptLevelUsed: 2, startPromptLevel: 0 }), MATCH_SAME_3);
    expect(s.startPromptLevel).toBe(3);
  });

  it('успех между провалами рвёт и серию наблюдения', () => {
    let s = applyTrialToFading(warm(), miss(), MATCH_SAME_3);
    s = applyTrialToFading(s, trial({ targetId: MATCH_SAME_3.id, response: 'independent', promptLevelUsed: 0, startPromptLevel: 0, observingLatencyMs: 900 }), MATCH_SAME_3);
    expect(s.consecutiveObservingFailures ?? 0).toBe(0);
  });
});

describe('45: «дважды подряд» по классу пары', () => {
  const pool = ['song', 'sing_together', 'bubbles', 'drum', 'pinwheel', 'kaleidoscope'];
  const apart: [string, string][] = [['song', 'sing_together']];
  const cycle = (...xs: number[]): Rng => {
    let i = 0;
    return () => xs[i++ % xs.length];
  };

  it('после `[song, sing_together]` в третий раз нет ни того, ни другого', () => {
    for (let k = 0; k < 20; k += 1) {
      const choices = reinforcerChoices(pool, ['song', 'sing_together'], cycle(k / 20, 0.5, 0.2), apart);
      expect(choices).toHaveLength(3);
      expect(choices).not.toContain('song');
      expect(choices).not.toContain('sing_together');
    }
  });

  it('`[song, song]` блокирует и `sing_together`; разные классы подряд — ничего', () => {
    for (let k = 0; k < 20; k += 1) {
      expect(reinforcerChoices(pool, ['song', 'song'], cycle(k / 20, 0.3), apart)).not.toContain('sing_together');
    }
    const free = new Set<string>();
    for (let k = 0; k < 40; k += 1) reinforcerChoices(pool, ['song', 'bubbles'], cycle(k / 40, 0.6, 0.1), apart).forEach((id) => free.add(id));
    expect(free.has('song') || free.has('sing_together')).toBe(true);
  });
});

const POOL = ['puzzle', 'bubbles', 'drum', 'xylophone', 'kaleido', 'dance'];
const T0 = Date.parse('2026-10-25T10:00:00Z');
const start = (config: 'alone' | 'with_adult', sessionId = '7b0e9a52-4d1c-4f3a-9a1e-2c6d8f0b1a3e') =>
  startPairing({ sessionId, config, pool: POOL, history: [], apart: [], rng: seeded(7).rng, now: T0 });

describe('46: исход `no_choice`', () => {
  it('только выбор в «Сам»', () => {
    expect(applyPairingEvent(start('alone'), { type: 'stop', reason: 'no_choice', now: T0 + 60_000 })).toMatchObject({ phase: 'done', endReason: 'no_choice' });
    expect(() => applyPairingEvent(start('with_adult'), { type: 'stop', reason: 'no_choice', now: T0 + 60_000 })).toThrow(PairingError);
    const waiting = applyPairingEvent(start('alone'), { type: 'choose', reinforcerId: start('alone').options[0], by: 'child', now: T0 + 2000 });
    expect(() => applyPairingEvent(waiting, { type: 'stop', reason: 'no_choice', now: T0 + 3000 })).toThrow(PairingError);
  });

  it('засчитывается и рвёт серию, как брошенное', () => {
    let t = applyPairingSession(initialTokenTraining(), { chosenBy: 'child', endReason: 'completed' });
    t = applyPairingSession(t, { chosenBy: 'adult', endReason: 'no_choice' });
    expect([t.pairingSessions, t.pairingStreak, t.pairingDone]).toEqual([2, 0, false]);
  });
});

describe('47: подряд незасчитанные сопряжения', () => {
  it(`${PAIRING.uncountedBeforeFlag} подряд — флаг \`pairing_keeps_breaking\`, в счёт сессий не идут`, () => {
    let t = initialTokenTraining();
    t = applyPairingSession(t, { chosenBy: 'child', endReason: 'adult_stopped' });
    t = applyPairingSession(t, { chosenBy: 'child', endReason: 'app_backgrounded' });
    expect(t.flags).toEqual([]);
    t = applyPairingSession(t, { chosenBy: 'adult', endReason: 'adult_stopped' });
    expect([t.pairingSessions, t.pairingUncounted, t.flags]).toEqual([0, 3, ['pairing_keeps_breaking']]);
  });

  it('засчитанная сессия обнуляет счёт; флаг остаётся', () => {
    let t = initialTokenTraining();
    t = applyPairingSession(t, { chosenBy: 'child', endReason: 'adult_stopped' });
    t = applyPairingSession(t, { chosenBy: 'child', endReason: 'app_backgrounded' });
    t = applyPairingSession(t, { chosenBy: 'child', endReason: 'completed' });
    t = applyPairingSession(t, { chosenBy: 'child', endReason: 'adult_stopped' });
    expect([t.pairingUncounted, t.flags]).toEqual([1, []]);
  });

  it('после `pairingDone` не считается', () => {
    const done = { ...initialTokenTraining(), pairingDone: true };
    expect(applyPairingSession(done, { chosenBy: 'child', endReason: 'adult_stopped' })).toBe(done);
  });
});

describe('48: латентность выбора и тройка', () => {
  it('латентность — от начала фазы выбора до первого касания; касание вне фазы — ошибка', () => {
    const s = start('with_adult');
    const chosen = applyPairingEvent(s, { type: 'choose', reinforcerId: s.options[1], by: 'child', now: T0 + 3800, tappedAt: T0 + 2500 });
    expect(chosen.choices[0].latencyMs).toBe(2500);
    expect(applyPairingEvent(s, { type: 'choose', reinforcerId: s.options[1], by: 'child', now: T0 + 3800 }).choices[0].latencyMs).toBe(3800);
    expect(() => applyPairingEvent(s, { type: 'choose', reinforcerId: s.options[1], by: 'child', now: T0 + 3800, tappedAt: T0 - 1 })).toThrow(PairingError);
    expect(() => applyPairingEvent(s, { type: 'choose', reinforcerId: s.options[1], by: 'child', now: T0 + 3800, tappedAt: T0 + 4000 })).toThrow(PairingError);
  });

  it('в записи сессии и у специалиста — тройка и латентности по порядку выборов', async () => {
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
    const db = await memoryDb();
    await appendConsentEvent(db, consent, 'owner');
    let s = start('with_adult');
    s = applyPairingEvent(s, { type: 'choose', reinforcerId: s.options[0], by: 'child', now: T0 + 4000, tappedAt: T0 + 3200 });
    s = applyPairingEvent(s, { type: 'token', now: T0 + 14_000 });
    s = applyPairingEvent(s, { type: 'access_done', now: T0 + 34_000 });
    s = applyPairingEvent(s, { type: 'choose', reinforcerId: s.options[2], by: 'child', now: T0 + 36_000, tappedAt: T0 + 35_200 });
    s = applyPairingEvent(s, { type: 'stop', reason: 'adult_stopped', now: T0 + 40_000 });
    await commitPairingSession(db, 'kid', pairingResultOf(s), '2026-10-25T10:01:00Z');
    const [row] = await db.all<{ body: string }>('SELECT body FROM aba_pairing_sessions');
    const choices = [
      { reinforcerId: s.options[0], by: 'child', latencyMs: 3200, prompted: false },
      { reinforcerId: s.options[2], by: 'child', latencyMs: 1200, prompted: false },
    ];
    expect(JSON.parse(row.body)).toMatchObject({ options: s.options, choices });
    const out = await exportForSpecialist(db, 'kid', '2026-10-26T08:00:00.000Z');
    expect(out.abaPairingSessions[0]).toMatchObject({ options: s.options, choices });
  });

  it('у взрослого латентности нет; выбор ребёнка после 30 с — «после подсказки»', async () => {
    const db = await memoryDb();
    await appendConsentEvent(db, { id: 'g', scope: 'aba_processing', action: 'grant', childId: 'kid', textVersion: 'ru-draft-1', confirmedBy: 'biometric', actorId: 'parent', at: '2026-10-25T09:00:00Z' }, 'owner');
    let s = start('with_adult');
    s = applyPairingEvent(s, { type: 'choose', reinforcerId: s.options[0], by: 'adult', now: T0 + 31_300, tappedAt: T0 + 30_500 });
    s = applyPairingEvent(s, { type: 'token', now: T0 + 41_300 });
    s = applyPairingEvent(s, { type: 'access_done', now: T0 + 61_300 });
    s = applyPairingEvent(s, { type: 'choose', reinforcerId: s.options[1], by: 'child', now: T0 + 96_000, tappedAt: T0 + 95_200 });
    s = applyPairingEvent(s, { type: 'stop', reason: 'adult_stopped', now: T0 + 97_000 });
    await commitPairingSession(db, 'kid', pairingResultOf(s), '2026-10-25T10:02:00Z');
    const [row] = await db.all<{ body: string }>('SELECT body FROM aba_pairing_sessions');
    expect(JSON.parse(row.body).choices).toEqual([
      { reinforcerId: s.options[0], by: 'adult', latencyMs: null, prompted: true },
      { reinforcerId: s.options[1], by: 'child', latencyMs: 33_900, prompted: true },
    ]);
  });
});
