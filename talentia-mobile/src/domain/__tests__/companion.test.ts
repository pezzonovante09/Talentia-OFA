import {
  DEFAULT_ADDRESS_FORM,
  lineKeyFor,
  pickVariant,
  lineKey,
  SITUATIONS,
  VARIANTS_PER_SITUATION,
} from '../companionSituations';

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

  describe('форма обращения (№71)', () => {
    const bank = new Set(['companion.correct-after-hint.0', 'companion.correct-after-hint.0.f', 'companion.correct-after-hint.0.m']);
    const exists = (k: string) => bank.has(k);

    it('по умолчанию — «не указывать», и тогда звучит безродовая реплика', () => {
      expect(DEFAULT_ADDRESS_FORM).toBe('neutral');
      expect(lineKeyFor('correct-after-hint', 0, DEFAULT_ADDRESS_FORM, exists)).toBe('companion.correct-after-hint.0');
    });

    it('родовая реплика — если она есть в банке', () => {
      expect(lineKeyFor('correct-after-hint', 0, 'feminine', exists)).toBe('companion.correct-after-hint.0.f');
      expect(lineKeyFor('correct-after-hint', 0, 'masculine', exists)).toBe('companion.correct-after-hint.0.m');
    });

    it('нет родовой — звучит безродовая', () => {
      expect(lineKeyFor('correct-first', 1, 'feminine', exists)).toBe('companion.correct-first.1');
    });
  });

  it('ситуации не дублируются', () => {
    expect(new Set(SITUATIONS).size).toBe(SITUATIONS.length);
  });

  it('банк выходит в несколько десятков реплик', () => {
    const total = SITUATIONS.length * VARIANTS_PER_SITUATION;
    expect(total).toBeGreaterThanOrEqual(60);
  });
});
