import { defaultBreakReminderMinutesForAgeBand } from '../useBreakReminder';

describe('defaultBreakReminderMinutesForAgeBand', () => {
  it('uses a short threshold for the youngest band (5-6)', () => {
    expect(defaultBreakReminderMinutesForAgeBand('5-6')).toBe(8);
  });

  it('increases the threshold for older bands', () => {
    expect(defaultBreakReminderMinutesForAgeBand('7')).toBe(12);
    expect(defaultBreakReminderMinutesForAgeBand('8')).toBe(16);
    expect(defaultBreakReminderMinutesForAgeBand('9-10')).toBe(20);
  });

  it('is monotonically non-decreasing across age bands', () => {
    const bands = ['5-6', '7', '8', '9-10'] as const;
    const values = bands.map(defaultBreakReminderMinutesForAgeBand);
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]!);
    }
  });

  it('falls back to the oldest-band default for unknown/missing age bands', () => {
    expect(defaultBreakReminderMinutesForAgeBand(undefined)).toBe(20);
    expect(defaultBreakReminderMinutesForAgeBand(null)).toBe(20);
    expect(defaultBreakReminderMinutesForAgeBand('unknown')).toBe(20);
  });
});
