import {
  applyPairingSession,
  applyStageSession,
  confirmPairing,
  finalStage,
  immediateExchange,
  initialTokenTraining,
  workingBoardSize,
  type StageSession,
  type TokenTrainingState,
} from '../abaTokenTraining';

const at = (stage: TokenTrainingState['stage'], atStage: StageSession[] = []): TokenTrainingState => ({
  ...initialTokenTraining(),
  pairingDone: true,
  stage,
  atStage,
});
const ses = (exchanges: number, endReason: StageSession['endReason'] = 'completed', sessionIndex = 1): StageSession => ({
  sessionIndex,
  exchanges,
  endReason,
});

describe('сопряжение', () => {
  it('две подряд сессии, где выбрал ребёнок, — сопряжение закончено, доска из одной ячейки', () => {
    let t = initialTokenTraining();
    t = applyPairingSession(t, { chosenBy: 'child', endReason: 'completed', config: 'with_adult' });
    expect(t.pairingDone).toBe(false);
    t = applyPairingSession(t, { chosenBy: 'child', endReason: 'completed', config: 'with_adult' });
    expect([t.pairingDone, t.stage]).toEqual([true, 1]);
  });

  it('выбор взрослого или брошенная сессия рвут серию', () => {
    let t = applyPairingSession(initialTokenTraining(), { chosenBy: 'child', endReason: 'completed', config: 'with_adult' });
    t = applyPairingSession(t, { chosenBy: 'adult', endReason: 'completed', config: 'with_adult' });
    t = applyPairingSession(t, { chosenBy: 'child', endReason: 'completed', config: 'with_adult' });
    expect(t.pairingDone).toBe(false);
  });

  it('остановка взрослым не засчитывается и серию не рвёт', () => {
    let t = applyPairingSession(initialTokenTraining(), { chosenBy: 'child', endReason: 'completed', config: 'with_adult' });
    t = applyPairingSession(t, { chosenBy: 'child', endReason: 'adult_stopped', config: 'with_adult' });
    t = applyPairingSession(t, { chosenBy: 'child', endReason: 'completed', config: 'with_adult' });
    expect([t.pairingDone, t.pairingSessions]).toEqual([true, 2]);
  });

  it('пять сессий без критерия — флаг специалисту, сопряжение продолжается', () => {
    let t = initialTokenTraining();
    for (let i = 0; i < 5; i += 1) t = applyPairingSession(t, { chosenBy: 'adult', endReason: 'completed', config: 'with_adult' });
    expect([t.pairingDone, t.flags]).toEqual([false, ['pairing_not_established']]);
  });
});

describe('подтверждение сопряжения обученным наблюдателем (confirmPairing)', () => {
  const by = { observerId: 'obs-1', byRole: 'owner' as const, at: '2026-10-31T10:00:00.000Z' };

  it('ставит pairingDone, записывает кем и когда, доска со ступени 1 и atStage заново', () => {
    const t = { ...initialTokenTraining(), stage: 2 as const, atStage: [ses(1)] };
    expect(confirmPairing(t, by)).toMatchObject({ pairingDone: true, pairingConfirmed: by, stage: 1, atStage: [] });
  });

  it('снимает pairing_not_established, но pairing_keeps_breaking оставляет', () => {
    const t = { ...initialTokenTraining(), flags: ['pairing_not_established', 'pairing_keeps_breaking'] as TokenTrainingState['flags'] };
    expect(confirmPairing(t, by).flags).toEqual(['pairing_keeps_breaking']);
  });

  it('счётчики сопряжения не трогает: pairingSessions, pairingStreak, pairingRecent остаются историей измерения', () => {
    const t = { ...initialTokenTraining(), pairingSessions: 5, pairingStreak: 1, pairingRecent: [true, false, true] };
    expect(confirmPairing(t, by)).toMatchObject({ pairingSessions: 5, pairingStreak: 1, pairingRecent: [true, false, true] });
  });

  it('при pairingDone — ничего не меняет: pairingConfirmed не появляется, ступень не сбрасывается', () => {
    const t = { ...initialTokenTraining(), pairingDone: true, stage: 3 as const, atStage: [ses(2)] };
    expect(confirmPairing(t, by)).toBe(t);
    expect(confirmPairing(t, by).pairingConfirmed).toBeUndefined();
  });

  it('после подтверждения applyPairingSession ничего не меняет — сопряжение закрыто', () => {
    const t = confirmPairing(initialTokenTraining(), by);
    expect(applyPairingSession(t, { chosenBy: 'adult', endReason: 'completed', config: 'with_adult' })).toBe(t);
  });

  it('после подтверждения доска обучается с одной ячейки по обычному критерию', () => {
    let t = confirmPairing(initialTokenTraining(), by);
    t = applyStageSession(t, '7', ses(2));
    t = applyStageSession(t, '7', ses(2));
    expect(t.stage).toBe(2);
  });

  it('исходное состояние не мутирует', () => {
    const t = { ...initialTokenTraining(), flags: ['pairing_not_established'] as TokenTrainingState['flags'] };
    confirmPairing(t, by);
    expect(t).toEqual({ ...initialTokenTraining(), flags: ['pairing_not_established'] });
  });
});

describe('ступени доски', () => {
  it('рабочий размер — не больше 3 на любой полосе; сохранённая ступень 5 работает как 3', () => {
    expect(workingBoardSize(at(5), '5-6')).toBe(3);
    expect(workingBoardSize(at(5), '7')).toBe(3);
    expect(workingBoardSize(at(5), '9-10')).toBe(3);
    expect(workingBoardSize(at(2), '9-10')).toBe(2);
  });

  it('финальная ступень — 3 на всех полосах', () => {
    expect(finalStage('5-6')).toBe(3);
    expect(finalStage('7')).toBe(3);
    expect(finalStage('8')).toBe(3);
    expect(finalStage('9-10')).toBe(3);
  });

  it('обмен сразу — пока ступень ниже 3; на ступени 3 (и сохранённой 5) обмен только на перерыве, на любой полосе', () => {
    expect(immediateExchange(at(2), '7')).toBe(true);
    expect(immediateExchange(at(3), '5-6')).toBe(false);
    expect(immediateExchange(at(3), '7')).toBe(false);
    expect(immediateExchange(at(3), '9-10')).toBe(false);
    expect(immediateExchange(at(5), '7')).toBe(false);
  });

  it('две сессии подряд с двумя обменами — ступень вверх', () => {
    expect(applyStageSession(at(2, [ses(2)]), '7', ses(3)).stage).toBe(3);
    expect(applyStageSession(at(2, [ses(1)]), '7', ses(3)).stage).toBe(2);
  });

  it('выше 3 не растёт ни на одной полосе: ступень 3 остаётся и на 5–6, и на 7, и на 9–10', () => {
    expect(applyStageSession(at(3, [ses(4)]), '5-6', ses(4)).stage).toBe(3);
    expect(applyStageSession(at(3, [ses(2)]), '7', ses(2)).stage).toBe(3);
    expect(applyStageSession(at(3, [ses(4)]), '9-10', ses(4)).stage).toBe(3);
  });

  it('сохранённая ступень 5: вверх не растёт, две сессии без обменов опускают на 3', () => {
    expect(applyStageSession(at(5, [ses(4)]), '7', ses(4)).stage).toBe(5);
    expect(applyStageSession(at(5, [ses(0)]), '7', ses(0, 'abandoned'))).toMatchObject({ stage: 3, atStage: [] });
  });

  it('две сессии с нулём обменов или брошенные — ступень вниз', () => {
    expect(applyStageSession(at(3, [ses(0)]), '7', ses(0, 'abandoned')).stage).toBe(2);
  });

  it('на ступени 1 отката нет — флаг специалисту', () => {
    const t = applyStageSession(at(1, [ses(0)]), '7', ses(0));
    expect([t.stage, t.flags]).toEqual([1, ['token_training_stalled']]);
  });

  it('остановка взрослым в решениях не участвует', () => {
    expect(applyStageSession(at(2, [ses(2)]), '7', ses(0, 'adult_stopped'))).toEqual(at(2, [ses(2)]));
  });
});
