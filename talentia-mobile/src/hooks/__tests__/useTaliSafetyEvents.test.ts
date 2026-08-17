import { hasRecentSafetyBurst, type TaliSafetyEvent } from '../useTaliSafetyEvents';

function event(overrides: Partial<TaliSafetyEvent> & { minutesAgo: number }): TaliSafetyEvent {
  const { minutesAgo, ...rest } = overrides;
  return {
    id: 'id',
    side: 'input',
    category: 'self_harm',
    mode: 'chat',
    language: 'ru',
    createdAt: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
    ...rest,
  };
}

describe('hasRecentSafetyBurst', () => {
  it('is false with no events', () => {
    expect(hasRecentSafetyBurst([])).toBe(false);
  });

  it('is false below the threshold', () => {
    const events = [event({ minutesAgo: 1 }), event({ minutesAgo: 2 })];
    expect(hasRecentSafetyBurst(events, 3, 10)).toBe(false);
  });

  it('is true at the threshold, same category, within the window', () => {
    const events = [event({ minutesAgo: 1 }), event({ minutesAgo: 2 }), event({ minutesAgo: 3 })];
    expect(hasRecentSafetyBurst(events, 3, 10)).toBe(true);
  });

  it('ignores events outside the window', () => {
    const events = [
      event({ minutesAgo: 1 }),
      event({ minutesAgo: 2 }),
      event({ minutesAgo: 30 }), // outside a 10-minute window
    ];
    expect(hasRecentSafetyBurst(events, 3, 10)).toBe(false);
  });

  it('does not mix categories to reach the threshold', () => {
    const events = [
      event({ minutesAgo: 1, category: 'self_harm' }),
      event({ minutesAgo: 2, category: 'violence' }),
      event({ minutesAgo: 3, category: 'profanity' }),
    ];
    expect(hasRecentSafetyBurst(events, 3, 10)).toBe(false);
  });

  it('respects custom threshold/window arguments', () => {
    const events = [event({ minutesAgo: 1 }), event({ minutesAgo: 2 })];
    expect(hasRecentSafetyBurst(events, 2, 10)).toBe(true);
    expect(hasRecentSafetyBurst(events, 2, 1)).toBe(false);
  });
});
