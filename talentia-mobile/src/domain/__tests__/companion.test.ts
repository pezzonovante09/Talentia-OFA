import { pickVariant, lineKey, SITUATIONS, VARIANTS_PER_SITUATION } from '../companionSituations';

describe('реплики компаньона', () => {
  it('не повторяет вариант, пока не прозвучали остальные', () => {
    const total = 4;
    const used: number[] = [];
    for (let i = 0; i < total; i += 1) {
      const v = pickVariant(used, total, () => 0);
      expect(used).not.toContain(v);
      used.push(v);
    }
    expect(new Set(used).size).toBe(total);
  });

  it('после того как все прозвучали, начинает круг заново', () => {
    const v = pickVariant([0, 1, 2, 3], 4, () => 0);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(4);
  });

  it('ключ реплики собирается из ситуации и номера', () => {
    expect(lineKey('correct-streak-3plus', 2)).toBe('companion.correct-streak-3plus.2');
  });

  it('ситуации не дублируются', () => {
    expect(new Set(SITUATIONS).size).toBe(SITUATIONS.length);
  });

  it('банк выходит в несколько десятков реплик', () => {
    const total = SITUATIONS.length * VARIANTS_PER_SITUATION;
    expect(total).toBeGreaterThanOrEqual(60);
  });
});
