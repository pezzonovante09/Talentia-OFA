/**
 * Оценка пробы ABA по журналу предъявлений и панель взрослого. Спецификация — ABA.md,
 * «Протокол взрослого», блок 1 (решение методиста 2026-10-01, блок 10 аудита).
 *
 * Экран не присылает готовые числа пробы — ответ, уровень, латентность, попытку до
 * подсказки. Он присылает **журнал предъявлений**: что показали, кто, когда и что
 * произошло. Числа выводит одна функция, `scoreTrial`, — так их нельзя записать
 * противоречиво, и каждое правило спецификации живёт в одном месте.
 */
import {
  APP_MAX_PROMPT,
  MAX_ESCALATIONS_PER_TRIAL,
  type AbaConfig,
  type AbaPresentation,
  type AbaTrial,
  type LatencySource,
  type PresentationOutcome,
  type PromptLevel,
  type ScoringSource,
} from '../types/aba';

/** Поля пробы, которые выводятся из журнала предъявлений, а не присылаются экраном. */
export type ScoredFields = Pick<
  AbaTrial,
  | 'response'
  | 'promptLevelUsed'
  | 'presentations'
  | 'emittedBeforePrompt'
  | 'latencyMs'
  | 'latencyFromFirstSdMs'
  | 'latencySource'
  | 'adultUnplannedPrompt'
  | 'interruptedBy'
>;

/** Что сессия разрешила в этой пробе — из шага пробы (`TrialStep`). */
export type ScoreContext = {
  startPromptLevel: PromptLevel;
  scoredBy: ScoringSource;
  allowEscalation: boolean;
  /** Неверный ответ не закрывает пробу, а поднимает уровень: коррекция и звенья цепочки. */
  escalateOnIncorrect: boolean;
  askAdultForL4: boolean;
  /** Окно первого предъявления при старте L0 в обучении и переносе — это задержка до подсказки. */
  promptDelayMs: number | null;
  responseWindowMs: number;
};

const RESPONSES: ReadonlySet<PresentationOutcome> = new Set(['correct', 'approximation', 'incorrect']);
const L4: ReadonlySet<PresentationOutcome> = new Set(['l4_done', 'l4_resisted', 'l4_skipped']);

/** Нажатие взрослого отстаёт от реакции, касание и звук — нет; специалист видит, откуда число. */
export const LATENCY_SOURCE: Record<ScoringSource, LatencySource> = {
  adult: 'adult_press',
  device_tap: 'device_tap',
  device_loudness: 'device_loudness',
  device_onset: 'device_onset',
  device_asr: 'device_onset',
};

const ms = (iso: string) => Date.parse(iso);

/** Противоречия журнала. Непустой список — проба не пишется. */
function logErrors(log: readonly AbaPresentation[], ctx: ScoreContext): string[] {
  const errors: string[] = [];
  if (log.length === 0) return ['пустой журнал предъявлений'];
  const app = log.filter((p) => p.by === 'app');
  // старт L4 (коррекция «сразу помощь взрослого»): одна полная модель, исход — L4
  const firstLevel = Math.min(ctx.startPromptLevel, APP_MAX_PROMPT);
  if (log[0].by !== 'app' || log[0].level !== firstLevel) errors.push('первое предъявление — не SD на стартовом уровне');
  if (ctx.startPromptLevel === 4 && (log.length !== 1 || !L4.has(log[0].outcome))) {
    errors.push('старт с помощи взрослого — одна полная модель с исходом L4');
  }
  if (app.length > MAX_ESCALATIONS_PER_TRIAL + 1) errors.push('больше трёх предъявлений одного SD');
  if (!ctx.allowEscalation && app.length > 1) errors.push('подсказка в пробе, которая измеряет');
  if (app.some((p, i) => i > 0 && p.level <= app[i - 1].level)) errors.push('уровни подсказки не растут');
  if (app.some((p) => p.level > APP_MAX_PROMPT)) errors.push('приложение не выдаёт L4');

  log.forEach((p, i) => {
    const last = i === log.length - 1;
    if ([p.startedAt, p.endedAt].some((t) => Number.isNaN(ms(t)))) errors.push(`предъявление ${i + 1}: время не распознано`);
    if (ms(p.endedAt) < ms(p.startedAt)) errors.push(`предъявление ${i + 1}: кончилось раньше начала`);
    if (i > 0 && ms(p.startedAt) < ms(log[i - 1].endedAt)) errors.push(`предъявление ${i + 1}: началось раньше конца предыдущего`);
    if (p.by === 'app') {
      const expected = i === 0 ? (ctx.promptDelayMs ?? ctx.responseWindowMs) : ctx.responseWindowMs;
      if (p.windowMs !== expected) errors.push(`предъявление ${i + 1}: не то окно`);
    } else if (p.windowMs <= 0) errors.push(`предъявление ${i + 1}: нет окна ответа`);
    // следующее предъявление — не раньше конца окна, если ответа не было
    if (!last && p.outcome === 'none' && ms(log[i + 1].startedAt) < ms(p.endedAt) + p.windowMs) {
      errors.push(`предъявление ${i + 2}: началось раньше конца окна`);
    }

    const responded = RESPONSES.has(p.outcome);
    if (responded !== (p.respondedAt !== undefined)) errors.push(`предъявление ${i + 1}: время ответа без ответа или ответ без времени`);
    if (p.respondedAt !== undefined) {
      const at = ms(p.respondedAt);
      // нажатие во время аудио относится к этому предъявлению: латентность 0
      if (Number.isNaN(at) || at < ms(p.startedAt)) errors.push(`предъявление ${i + 1}: ответ раньше предъявления`);
      if (at > ms(p.endedAt) + p.windowMs) errors.push(`предъявление ${i + 1}: ответ после окна`);
      if (!last && ms(log[i + 1].startedAt) < at) errors.push(`предъявление ${i + 1}: следующее началось раньше ответа`);
    }
    if (!last) {
      const continues =
        p.outcome === 'none' ||
        (ctx.escalateOnIncorrect && p.by === 'app' && (p.outcome === 'incorrect' || p.outcome === 'approximation'));
      if (!continues) errors.push(`предъявление ${i + 1}: после ответа проба продолжилась`);
    }
    if (L4.has(p.outcome)) {
      if (!last) errors.push('исход L4 — только последний');
      if (p.by !== 'app' || p.level !== APP_MAX_PROMPT) errors.push('L4 — только после полной модели');
      if (!ctx.askAdultForL4) errors.push('L4 без просьбы к взрослому');
    }
  });
  return errors;
}

/**
 * Поля пробы по журналу предъявлений (таблица исходов — ABA.md, «Протокол взрослого»,
 * блок 1):
 * - верно на L0 без неплановой подсказки — `independent`; на L1+ — `prompted` на этом уровне;
 * - «Почти» и «Неверно» — `approximation` и `incorrect` на уровне предъявления;
 * - нет ответа на последнем предъявлении — `no_response`, латентности нет;
 * - L4: «Сделали вместе» — `prompted` с уровнем 4; «Пропустить» — `no_response` на 3;
 *   «Сопротивляется» — `interrupted` (`l4_resisted`) на 3;
 * - неплановая подсказка взрослого (`by: 'adult'`) — самостоятельного ответа уже нет, уровень
 *   не ниже 1, `adultUnplannedPrompt`;
 * - попытка до подсказки — только при старте L0 и ответе на первом предъявлении: при старте
 *   L1+ подсказка идёт вместе с SD, окна «до подсказки» нет (D3);
 * - L4 — не отдельное предъявление, а совместное выполнение внутри полной модели (D4);
 * - латентность — от конца предъявления, на котором ответ, не меньше 0; полная — от конца
 *   первого SD.
 */
export function scoreTrial(
  log: readonly AbaPresentation[],
  ctx: ScoreContext,
): { ok: true; fields: ScoredFields } | { ok: false; errors: string[] } {
  const errors = logErrors(log, ctx);
  if (errors.length) return { ok: false, errors };

  const last = log[log.length - 1];
  const unplanned = log.some((p) => p.by === 'adult');
  const level = last.level;
  const atLeastOne = (l: PromptLevel): PromptLevel => (unplanned ? (Math.max(l, 1) as PromptLevel) : l);

  let response: AbaTrial['response'];
  let promptLevelUsed: PromptLevel;
  switch (last.outcome) {
    case 'correct':
      response = level === 0 && !unplanned ? 'independent' : 'prompted';
      promptLevelUsed = atLeastOne(level);
      break;
    case 'approximation':
    case 'incorrect':
      response = last.outcome;
      promptLevelUsed = atLeastOne(level);
      break;
    case 'none':
      response = 'no_response';
      promptLevelUsed = atLeastOne(level);
      break;
    case 'l4_done':
      response = 'prompted';
      promptLevelUsed = 4;
      break;
    case 'l4_skipped':
      response = 'no_response';
      promptLevelUsed = APP_MAX_PROMPT;
      break;
    case 'l4_resisted':
      response = 'interrupted';
      promptLevelUsed = APP_MAX_PROMPT;
      break;
  }

  const responded = last.respondedAt !== undefined;
  const latencyMs = responded ? Math.max(0, ms(last.respondedAt!) - ms(last.endedAt)) : null;
  const fromFirst = responded ? Math.max(latencyMs!, ms(last.respondedAt!) - ms(log[0].endedAt)) : null;

  return {
    ok: true,
    fields: {
      response,
      promptLevelUsed,
      presentations: log.filter((p) => p.by === 'app').length,
      emittedBeforePrompt: ctx.startPromptLevel === 0 && RESPONSES.has(log[0].outcome),
      latencyMs,
      latencyFromFirstSdMs: response === 'independent' ? latencyMs : fromFirst,
      latencySource: latencyMs === null ? null : LATENCY_SOURCE[ctx.scoredBy],
      ...(unplanned ? { adultUnplannedPrompt: true as const } : {}),
      ...(last.outcome === 'l4_resisted' ? { interruptedBy: 'l4_resisted' as const } : {}),
    },
  };
}

/** Кнопка панели взрослого. Кнопки «нет ответа» нет — это истечение окна. */
export type PanelButton =
  | 'correct'
  | 'approximation'
  | 'incorrect'
  /** «Я подсказал(а)» — подсказка вне процедуры. */
  | 'adult_prompted'
  | 'refusal'
  | 'l4_done'
  | 'l4_resisted'
  | 'l4_skipped';

/**
 * Что на панели взрослого сейчас. Только в конфигурации «Со взрослым».
 *
 * - `window` — идёт предъявление или окно ответа: «Верно / Почти / Неверно» и всегда «Я
 *   подсказал(а)», «Отказ». «Почти» нет, если цель оценивает устройство (касание,
 *   громкость): приближение там не наблюдается взрослым.
 * - `l4` — провал на полной модели и взрослого просят выполнить вместе: «Сделали вместе /
 *   Сопротивляется / Пропустить» и «Отказ».
 */
export function adultPanelButtons(
  config: AbaConfig,
  scoredBy: ScoringSource,
  stage: 'window' | 'l4',
): PanelButton[] {
  if (config !== 'with_adult') return [];
  if (stage === 'l4') return ['l4_done', 'l4_resisted', 'l4_skipped', 'refusal'];
  return [
    'correct',
    ...(scoredBy === 'adult' ? (['approximation'] as const) : []),
    'incorrect',
    'adult_prompted',
    'refusal',
  ];
}
