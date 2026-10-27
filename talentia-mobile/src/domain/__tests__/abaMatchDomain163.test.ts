/**
 * №163 — точечная разморозка домена ABA под процедуру `match` (`aba-pedagogy-specialist` 2026-10-27):
 * коррекция по лестнице цели, «Была подсказка» на L0, карточка «перерыв» вне окна, L1 наблюдения не «ждал подсказку».
 */
import { MATCH_SAME_2, MATCH_SAME_3 } from '../../content/aba/match-level1';
import type { AbaPresentation } from '../../types/aba';
import { correctionLevel, fadeClass, initialTargetState, promptVisualFor, trialInvariantErrors } from '../abaPrompting';
import { scoreTrial } from '../abaScoring';
import { trial } from './abaFixtures';

/** Цель уже подтянулась до L0: последний успешный уровень — 0 (иначе коррекция всегда L3 по `lastSuccessfulPromptLevel`). */
const warm = (t: typeof MATCH_SAME_2) => ({ ...initialTargetState(t), lastSuccessfulPromptLevel: 0 as const, startPromptLevel: 0 as const });
const iso = (s: number) => new Date(Date.UTC(2026, 9, 27, 9) + s * 1000).toISOString();

describe('коррекция по лестнице цели', () => {
  it('выбор из двух: молчание на L1 — коррекция с L3 (L2 нет), и подсказка для неё строится', () => {
    const failed = trial({ targetId: MATCH_SAME_2.id, response: 'no_response', promptLevelUsed: 1, startPromptLevel: 0, scoredBy: 'device_tap' });
    const level = correctionLevel(warm(MATCH_SAME_2), failed, MATCH_SAME_2);
    expect(level).toBe(3);
    expect(() => promptVisualFor(MATCH_SAME_2, level!, { correctId: 'a', choiceIds: ['a', 'b'], sampleId: 'a' }, 1)).not.toThrow();
  });

  it('поле 3 — как было: после L1 — L2', () => {
    const failed = trial({ targetId: MATCH_SAME_3.id, response: 'no_response', promptLevelUsed: 1, startPromptLevel: 0, scoredBy: 'device_tap' });
    expect(correctionLevel(warm(MATCH_SAME_3), failed, MATCH_SAME_3)).toBe(2);
  });
});

describe('«Была подсказка» на L0', () => {
  it('подсказанный ответ после подсказки взрослого до конца задержки — не нарушение', () => {
    const t = trial({ response: 'prompted', promptLevelUsed: 1, startPromptLevel: 0, emittedBeforePrompt: false, latencyMs: 300, latencyFromFirstSdMs: 800, promptDelayMs: 2000, adultUnplannedPrompt: true });
    expect(trialInvariantErrors(t).filter((e) => e.includes('задержка'))).toEqual([]);
    const plain = { ...t, adultUnplannedPrompt: undefined };
    expect(trialInvariantErrors(plain)).toContain('подсказанный ответ раньше, чем закончилась задержка');
  });
});

describe('карточка «перерыв» вне окна', () => {
  it('в пробеле наблюдения (после конца окна, образца не коснулись) — запись проходит', () => {
    const log: AbaPresentation[] = [{ level: 0, by: 'app', startedAt: iso(0), endedAt: iso(1.5), windowMs: 2000, outcome: 'child_break', respondedAt: iso(4.5) }];
    const r = scoreTrial(log, { startPromptLevel: 0, scoredBy: 'device_tap', allowEscalation: true, escalateOnIncorrect: false, askAdultForL4: false, chainStep: false, promptDelayMs: 2000, responseWindowMs: 5000 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.fields.interruptedBy).toBe('child_break');
  });

  it('ответ после окна по-прежнему ошибка', () => {
    const log: AbaPresentation[] = [{ level: 0, by: 'app', startedAt: iso(0), endedAt: iso(1.5), windowMs: 2000, outcome: 'correct', respondedAt: iso(4.5) }];
    const r = scoreTrial(log, { startPromptLevel: 0, scoredBy: 'device_tap', allowEscalation: true, escalateOnIncorrect: false, askAdultForL4: false, chainStep: false, promptDelayMs: 2000, responseWindowMs: 5000 });
    expect(r.ok).toBe(false);
  });
});

describe('L1 наблюдения — не «ждал подсказку»', () => {
  it('fadeClass: observingPrompted с подсказанным L1 — не waited', () => {
    const base = { response: 'prompted' as const, promptLevelUsed: 1 as const, startPromptLevel: 0 as const, emittedBeforePrompt: false };
    expect(fadeClass(trial(base))).toBe('waited');
    expect(fadeClass(trial({ ...base, observingPrompted: true }))).not.toBe('waited');
  });
});
