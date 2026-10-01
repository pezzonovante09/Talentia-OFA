/**
 * Оценка пробы по журналу предъявлений и панель взрослого — ABA.md, «Протокол взрослого»,
 * блок 1.
 */
import type { AbaPresentation, PresentationOutcome, PromptLevel } from '../../types/aba';
import { adultPanelButtons, scoreTrial, type ScoreContext } from '../abaScoring';

const T0 = Date.UTC(2026, 9, 1, 10);
const iso = (ms: number) => new Date(ms).toISOString();

const ctx = (over: Partial<ScoreContext> = {}): ScoreContext => ({
  startPromptLevel: 0,
  scoredBy: 'adult',
  allowEscalation: true,
  escalateOnIncorrect: false,
  askAdultForL4: true,
  promptDelayMs: 2000,
  responseWindowMs: 5000,
  ...over,
});

/** Предъявления подряд: каждое длится 1 с, следующее — после окна; ответ — через `after` мс после конца. */
function log(
  c: ScoreContext,
  steps: { level: PromptLevel; outcome: PresentationOutcome; after?: number; by?: 'app' | 'adult' }[],
): AbaPresentation[] {
  let t = T0;
  return steps.map((s, i) => {
    const windowMs = i === 0 ? (c.promptDelayMs ?? c.responseWindowMs) : c.responseWindowMs;
    const startedAt = t;
    const endedAt = t + 1000;
    const responded = s.outcome === 'correct' || s.outcome === 'incorrect' || s.outcome === 'approximation';
    t = responded ? endedAt + (s.after ?? 800) : endedAt + windowMs;
    return {
      level: s.level,
      by: s.by ?? 'app',
      startedAt: iso(startedAt),
      endedAt: iso(endedAt),
      windowMs,
      outcome: s.outcome,
      ...(responded ? { respondedAt: iso(endedAt + (s.after ?? 800)) } : {}),
    };
  });
}

const fields = (c: ScoreContext, steps: Parameters<typeof log>[1]) => {
  const r = scoreTrial(log(c, steps), c);
  if (!r.ok) throw new Error(r.errors.join('; '));
  return r.fields;
};

describe('исход → поля пробы', () => {
  it('верно на L0 — самостоятельно, латентность от конца SD', () => {
    expect(fields(ctx(), [{ level: 0, outcome: 'correct', after: 700 }])).toMatchObject({
      response: 'independent',
      promptLevelUsed: 0,
      presentations: 1,
      emittedBeforePrompt: true,
      latencyMs: 700,
      latencyFromFirstSdMs: 700,
      latencySource: 'adult_press',
    });
  });

  it('дождался L1 и ответил — подсказанный, без попытки, полное время от первого SD', () => {
    const f = fields(ctx(), [
      { level: 0, outcome: 'none' },
      { level: 1, outcome: 'correct', after: 900 },
    ]);
    expect(f).toMatchObject({ response: 'prompted', promptLevelUsed: 1, presentations: 2, emittedBeforePrompt: false, latencyMs: 900 });
    // конец P0 → окно 2 с → P1 1 с → ответ 0.9 с
    expect(f.latencyFromFirstSdMs).toBe(3900);
  });

  it('«Почти» и «Неверно» — на уровне предъявления', () => {
    expect(fields(ctx(), [{ level: 0, outcome: 'approximation' }])).toMatchObject({ response: 'approximation', promptLevelUsed: 0 });
    expect(fields(ctx(), [{ level: 0, outcome: 'incorrect' }])).toMatchObject({ response: 'incorrect', emittedBeforePrompt: true });
  });

  it('нет ответа и на полной модели — no_response без латентности', () => {
    expect(
      fields(ctx(), [
        { level: 0, outcome: 'none' },
        { level: 1, outcome: 'none' },
        { level: 3, outcome: 'none' },
      ]),
    ).toMatchObject({ response: 'no_response', promptLevelUsed: 3, presentations: 3, latencyMs: null, latencySource: null });
  });

  it('L4 — исход полной модели, а не четвёртое предъявление (D4)', () => {
    const path = [
      { level: 0 as const, outcome: 'none' as const },
      { level: 1 as const, outcome: 'none' as const },
    ];
    expect(fields(ctx(), [...path, { level: 3, outcome: 'l4_done' }])).toMatchObject({ response: 'prompted', promptLevelUsed: 4, presentations: 3, latencyMs: null });
    expect(fields(ctx(), [...path, { level: 3, outcome: 'l4_skipped' }])).toMatchObject({ response: 'no_response', promptLevelUsed: 3 });
    expect(fields(ctx(), [...path, { level: 3, outcome: 'l4_resisted' }])).toMatchObject({
      response: 'interrupted',
      promptLevelUsed: 3,
      interruptedBy: 'l4_resisted',
    });
  });

  it('старт с помощи взрослого — одна полная модель с исходом L4', () => {
    const c = ctx({ startPromptLevel: 4, promptDelayMs: null });
    expect(fields(c, [{ level: 3, outcome: 'l4_done' }])).toMatchObject({ response: 'prompted', promptLevelUsed: 4 });
    expect(scoreTrial(log(c, [{ level: 3, outcome: 'correct' }]), c).ok).toBe(false);
  });

  it('при старте L1+ попытки до подсказки не бывает (D3)', () => {
    const c = ctx({ startPromptLevel: 1, promptDelayMs: null });
    expect(fields(c, [{ level: 1, outcome: 'incorrect' }]).emittedBeforePrompt).toBe(false);
  });

  it('неплановая подсказка взрослого: самостоятельного нет, уровень не ниже 1, отметка', () => {
    expect(
      fields(ctx(), [
        { level: 0, outcome: 'none' },
        { level: 0, outcome: 'correct', by: 'adult' },
      ]),
    ).toMatchObject({ response: 'prompted', promptLevelUsed: 1, adultUnplannedPrompt: true, presentations: 1 });
  });

  it('у устройства — свой источник латентности', () => {
    expect(fields(ctx({ scoredBy: 'device_tap' }), [{ level: 0, outcome: 'correct' }]).latencySource).toBe('device_tap');
  });

  it('звено цепочки: ошибка поднимает уровень, проба доводится до верного', () => {
    const c = ctx({ escalateOnIncorrect: true });
    expect(
      fields(c, [
        { level: 0, outcome: 'incorrect' },
        { level: 2, outcome: 'correct' },
      ]),
    ).toMatchObject({ response: 'prompted', promptLevelUsed: 2, emittedBeforePrompt: true });
  });
});

describe('журнал, который не пишется', () => {
  const errors = (c: ScoreContext, l: AbaPresentation[]) => {
    const r = scoreTrial(l, c);
    return r.ok ? [] : r.errors;
  };

  it('после ответа дискретная проба не продолжается', () => {
    expect(
      errors(ctx(), log(ctx(), [{ level: 0, outcome: 'incorrect' }, { level: 2, outcome: 'correct' }])),
    ).toContain('предъявление 1: после ответа проба продолжилась');
  });

  it('измерительная проба без подсказок', () => {
    const c = ctx({ allowEscalation: false, promptDelayMs: null });
    expect(errors(c, log(c, [{ level: 0, outcome: 'none' }, { level: 1, outcome: 'correct' }]))).toContain('подсказка в пробе, которая измеряет');
  });

  it('окно первого предъявления на старте L0 — задержка до подсказки, дальше — окно ответа', () => {
    const l = log(ctx(), [{ level: 0, outcome: 'none' }, { level: 1, outcome: 'correct' }]);
    expect(errors(ctx(), [{ ...l[0], windowMs: 5000 }, l[1]])).toContain('предъявление 1: не то окно');
  });

  it('подсказка раньше конца окна и ответ после окна', () => {
    const l = log(ctx(), [{ level: 0, outcome: 'none' }, { level: 1, outcome: 'correct' }]);
    expect(errors(ctx(), [l[0], { ...l[1], startedAt: l[0].endedAt }])).toContain('предъявление 2: началось раньше конца окна');
    const late = log(ctx(), [{ level: 0, outcome: 'correct', after: 2500 }]);
    expect(errors(ctx(), late)).toContain('предъявление 1: ответ после окна');
  });

  it('L4 — только после полной модели и только по просьбе', () => {
    expect(errors(ctx(), log(ctx(), [{ level: 0, outcome: 'none' }, { level: 1, outcome: 'l4_done' }]))).toContain(
      'L4 — только после полной модели',
    );
    const c = ctx({ askAdultForL4: false });
    expect(
      errors(c, log(c, [{ level: 0, outcome: 'none' }, { level: 1, outcome: 'none' }, { level: 3, outcome: 'l4_done' }])),
    ).toContain('L4 без просьбы к взрослому');
  });

  it('пустой журнал и не тот старт', () => {
    expect(errors(ctx(), [])).toEqual(['пустой журнал предъявлений']);
    expect(errors(ctx({ startPromptLevel: 1, promptDelayMs: null }), log(ctx(), [{ level: 0, outcome: 'correct' }]))).toContain(
      'первое предъявление — не SD на стартовом уровне',
    );
  });
});

describe('панель взрослого', () => {
  it('в «Сам» панели нет', () => {
    expect(adultPanelButtons('alone', 'adult', 'window')).toEqual([]);
  });

  it('окно ответа: «Почти» — только когда оценивает взрослый', () => {
    expect(adultPanelButtons('with_adult', 'adult', 'window')).toEqual([
      'correct',
      'approximation',
      'incorrect',
      'adult_prompted',
      'refusal',
    ]);
    expect(adultPanelButtons('with_adult', 'device_tap', 'window')).toEqual(['correct', 'incorrect', 'adult_prompted', 'refusal']);
  });

  it('после провала на полной модели — карточка L4', () => {
    expect(adultPanelButtons('with_adult', 'adult', 'l4')).toEqual(['l4_done', 'l4_resisted', 'l4_skipped', 'refusal']);
  });
});
