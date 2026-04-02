const LEVEL_THRESHOLDS = [0, 50, 120, 210, 320, 450, 600, 780, 980, 1200, 1500];

export function getLevelFromXP(xp: number): number {
  let level = 1;
  for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) {
      level = i + 1;
    } else {
      break;
    }
  }
  return level;
}

export function getXPToNextLevel(xp: number): { current: number; needed: number; level: number } {
  const level = getLevelFromXP(xp);
  const currentThreshold = LEVEL_THRESHOLDS[level - 1] ?? 0;
  const nextThreshold = LEVEL_THRESHOLDS[level] ?? LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
  const needed = Math.max(1, nextThreshold - currentThreshold);
  return {
    current: xp - currentThreshold,
    needed,
    level,
  };
}
