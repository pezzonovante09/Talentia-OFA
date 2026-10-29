import {
  applyPairingSession,
  applyStageSession,
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

describe('ступени доски', () => {
  it('рабочий размер — не больше размера по полосе', () => {
    expect(workingBoardSize(at(5), '5-6')).toBe(3);
    expect(workingBoardSize(at(2), '9-10')).toBe(2);
  });

  it('обмен сразу — пока ступень ниже финальной по полосе', () => {
    expect(immediateExchange(at(3), '5-6')).toBe(false);
    expect(immediateExchange(at(3), '7')).toBe(true);
  });

  it('две сессии подряд с двумя обменами — ступень вверх', () => {
    expect(applyStageSession(at(2, [ses(2)]), '7', ses(3)).stage).toBe(3);
    expect(applyStageSession(at(2, [ses(1)]), '7', ses(3)).stage).toBe(2);
  });

  it('выше финальной по полосе не растёт: на 5–6 ступень 3 остаётся', () => {
    expect(applyStageSession(at(3, [ses(4)]), '5-6', ses(4)).stage).toBe(3);
  });

  it('после перехода 5–6 → 7 ступень 3 растёт до 5 по тому же критерию', () => {
    expect(applyStageSession(at(3, [ses(2)]), '7', ses(2)).stage).toBe(5);
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
