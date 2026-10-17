/**
 * Оценка пробы по журналу предъявлений и панель взрослого — ABA.md, «Протокол взрослого»,
 * блок 1.
 */
import type { AbaPresentation, PresentationOutcome, PromptLevel } from '../../types/aba';
import { adultPanelButtons, scoreTrial, type PanelStep, type ScoreContext } from '../abaScoring';

const T0 = Date.UTC(2026, 9, 1, 10);
const iso = (ms: number) => new Date(ms).toISOString();

const ctx = (over: Partial<ScoreContext> = {}): ScoreContext => ({
  startPromptLevel: 0,
  scoredBy: 'adult',
  allowEscalation: true,
  escalateOnIncorrect: false,
  askAdultForL4: true,
  chainStep: false,
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
  const step = (over: Partial<PanelStep> = {}): PanelStep => ({ scoredBy: 'adult', startPromptLevel: 0, askAdultForL4: true, ...over });

  it('в «Сам» панели нет', () => {
    expect(adultPanelButtons('alone', step(), false)).toEqual([]);
  });

  it('окно ответа: «Почти» — только когда оценивает взрослый', () => {
    expect(adultPanelButtons('with_adult', step(), false)).toEqual(['correct', 'approximation', 'incorrect', 'adult_prompted', 'refusal']);
    expect(adultPanelButtons('with_adult', step({ scoredBy: 'device_tap' }), false)).toEqual([
      'correct',
      'incorrect',
      'adult_prompted',
      'refusal',
    ]);
  });

  it('после провала на полной модели — карточка L4, если L4 разрешена', () => {
    expect(adultPanelButtons('with_adult', step(), true)).toEqual(['l4_done', 'l4_resisted', 'l4_skipped', 'refusal']);
    // без L4 и не звено — карточки нет: окно ответа как обычно, провал закроется сам
    expect(adultPanelButtons('with_adult', step({ askAdultForL4: false }), true)).toEqual([
      'correct',
      'approximation',
      'incorrect',
      'adult_prompted',
      'refusal',
    ]);
  });

  it('при старте с помощи взрослого — сразу карточка L4, без «Была подсказка»', () => {
    expect(adultPanelButtons('with_adult', step({ startPromptLevel: 4 }), false)).toEqual(['l4_done', 'l4_resisted', 'l4_skipped', 'refusal']);
  });

  it('у звена цепочки — ещё «Звено — самостоятельно», и без L4 тоже', () => {
    expect(adultPanelButtons('with_adult', step({ stepId: 's1' }), true)).toContain('adult_completed');
    expect(adultPanelButtons('with_adult', step({ stepId: 's1', askAdultForL4: false }), true)).toEqual(['adult_completed', 'refusal']);
  });
});

describe('правки по проверке методиста', () => {
  const errors = (c: ScoreContext, l: AbaPresentation[]) => {
    const r = scoreTrial(l, c);
    return r.ok ? [] : r.errors;
  };

  it('старт 4: «Пропустить» и «Сопротивляется» пишутся уровнем 3, «Отказ» — тоже', () => {
    const c = ctx({ startPromptLevel: 4, promptDelayMs: null });
    expect(fields(c, [{ level: 3, outcome: 'l4_skipped' }])).toMatchObject({ response: 'no_response', promptLevelUsed: 3 });
    expect(fields(c, [{ level: 3, outcome: 'l4_resisted' }])).toMatchObject({ response: 'interrupted', interruptedBy: 'l4_resisted' });
    expect(fields(c, [{ level: 3, outcome: 'refusal' }])).toMatchObject({ response: 'interrupted', interruptedBy: 'assent' });
  });

  it('подсказка взрослого — внутри окна текущего предъявления, на его уровне', () => {
    const c = ctx();
    const p0 = log(c, [{ level: 0, outcome: 'none' }])[0];
    const adult = (startOffset: number, level: PromptLevel): AbaPresentation => ({
      level,
      by: 'adult',
      startedAt: iso(Date.parse(p0.endedAt) + startOffset),
      endedAt: iso(Date.parse(p0.endedAt) + startOffset),
      windowMs: c.responseWindowMs,
      outcome: 'correct',
      respondedAt: iso(Date.parse(p0.endedAt) + startOffset + 700),
    });
    // через 1 с после конца SD, внутри задержки 2 с — пишется
    const ok = scoreTrial([p0, adult(1000, 0)], c);
    expect(ok.ok && ok.fields).toMatchObject({ response: 'prompted', promptLevelUsed: 1, adultUnplannedPrompt: true, latencyMs: 700 });
    expect(errors(c, [p0, adult(1000, 2)])).toContain('предъявление 2: подсказка взрослого не на уровне текущего предъявления');
    expect(errors(c, [p0, adult(9000, 0)])).toContain('предъявление 2: подсказка взрослого вне окна текущего предъявления');
  });

  it('в пробе с помощью взрослого «Была подсказка» нет', () => {
    const c = ctx({ startPromptLevel: 4, promptDelayMs: null });
    const [m] = log(c, [{ level: 3, outcome: 'none' }]);
    const adult: AbaPresentation = { ...m, by: 'adult', outcome: 'l4_done', startedAt: m.endedAt, windowMs: c.responseWindowMs };
    expect(errors(c, [m, adult])).toContain('в пробе с помощью взрослого «Была подсказка» нет');
  });

  it('«Почти» в журнале — только когда оценивает взрослый', () => {
    const c = ctx({ scoredBy: 'device_tap' });
    expect(errors(c, log(c, [{ level: 0, outcome: 'approximation' }]))).toContain('«Почти» — только когда оценивает взрослый');
  });

  it('«Звено — самостоятельно» — только у звена цепочки', () => {
    const chain = ctx({ chainStep: true, escalateOnIncorrect: true });
    const path = [
      { level: 0 as const, outcome: 'none' as const },
      { level: 1 as const, outcome: 'none' as const },
      { level: 3 as const, outcome: 'adult_completed' as const },
    ];
    expect(fields(chain, path)).toMatchObject({ response: 'no_response', promptLevelUsed: 3, adultCompleted: true });
    expect(errors(ctx(), log(ctx(), path))).toContain('выполнить за ребёнка можно только звено цепочки');
  });

  it('«Отказ» — в любой момент, проба прервана', () => {
    expect(fields(ctx(), [{ level: 0, outcome: 'refusal' }])).toMatchObject({ response: 'interrupted', interruptedBy: 'assent', latencyMs: null });
  });
});

describe('звено за ребёнка — только после полной модели в обучении', () => {
  it('на L0 в обучающем звене не пишется, в измерении — пишется', () => {
    const teach = ctx({ chainStep: true, escalateOnIncorrect: true });
    const r = scoreTrial(log(teach, [{ level: 0, outcome: 'adult_completed' }]), teach);
    expect(r.ok === false && r.errors).toContain('звено за ребёнка — только после полной модели');
    const measure = ctx({ chainStep: true, allowEscalation: false, promptDelayMs: null });
    expect(scoreTrial(log(measure, [{ level: 0, outcome: 'adult_completed' }]), measure).ok).toBe(true);
  });
});
