import { getLevelFromXP, getXPToNextLevel } from '../xpUtils';

describe('getLevelFromXP', () => {
  it('returns level 1 for 0 XP', () => {
    expect(getLevelFromXP(0)).toBe(1);
  });

  it('returns level 1 for XP below 50', () => {
    expect(getLevelFromXP(49)).toBe(1);
  });

  it('returns level 2 at 50 XP', () => {
    expect(getLevelFromXP(50)).toBe(2);
  });

  it('returns level 3 at 120 XP', () => {
    expect(getLevelFromXP(120)).toBe(3);
  });

  it('returns level 11 at 1500 XP (max level)', () => {
    expect(getLevelFromXP(1500)).toBe(11);
  });

  it('returns level 11 for XP above 1500', () => {
    expect(getLevelFromXP(2000)).toBe(11);
  });

  it('returns correct level for boundary values', () => {
    expect(getLevelFromXP(50)).toBe(2);
    expect(getLevelFromXP(119)).toBe(2);
    expect(getLevelFromXP(120)).toBe(3);
    expect(getLevelFromXP(209)).toBe(3);
    expect(getLevelFromXP(210)).toBe(4);
  });
});

describe('getXPToNextLevel', () => {
  it('returns correct values for level 1', () => {
    const result = getXPToNextLevel(0);
    expect(result.level).toBe(1);
    expect(result.current).toBe(0);
    expect(result.needed).toBe(50);
  });

  it('returns correct values for level 2', () => {
    const result = getXPToNextLevel(50);
    expect(result.level).toBe(2);
    expect(result.current).toBe(0);
    expect(result.needed).toBe(70);
  });

  it('returns correct values mid-level', () => {
    const result = getXPToNextLevel(75);
    expect(result.level).toBe(2);
    expect(result.current).toBe(25);
    expect(result.needed).toBe(70);
  });

  it('returns correct values for max level', () => {
    const result = getXPToNextLevel(1500);
    expect(result.level).toBe(11);
    expect(result.current).toBe(0);
    expect(result.needed).toBeGreaterThanOrEqual(1);
  });
});
