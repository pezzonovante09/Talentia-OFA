/**
 * Проба, которую ждёт процедура, и сверка записи с ней — общее у сессии (`abaSession.ts`) и
 * прогона рутины (`abaRoutineRun.ts`): стартовый уровень, задержка до подсказки, окно, можно ли
 * подсказывать, просить ли взрослого о L4, доделывает ли звено взрослый. Одна функция на обоих,
 * иначе звено цепочки в сессии и в рутине разойдётся (методист, раунд 2, Р3).
 */
import { MATCH_OBSERVING_MS } from '../types/aba';
import {
  APP_MAX_PROMPT,
  VOICE_VOLUME_HOLD_MS,
  type AbaFormat,
  type AbaTarget,
  type AbaTargetState,
  type AbaTrial,
  type AbaTrialKind,
  type PromptLevel,
  type ScoringSource,
} from '../types/aba';
import { clampToApp, promptDelayMs, promptStateOf, responseWindowMs } from './abaPrompting';
import { scoreTrial, type ScoredFields } from './abaScoring';

/** Пробы, которые измеряют: старт L0, подсказка по задержке не идёт. */
export const MEASURING_KINDS: ReadonlySet<AbaTrialKind> = new Set(['baseline', 'generalization', 'maintenance', 'verification']);

export type PlannedTrial = {
  kind: AbaTrialKind;
  targetId: string;
  exemplarId: string;
  stepId?: string;
  runIndex?: number;
  sdVariantKey?: string;
  /** Уровень задан процедурой, а не стартовым уровнем: коррекция, закрытие. */
  fixedStart?: PromptLevel;
  /** Поле `identify` и `match`; заполняется, когда проба становится текущей. */
  field?: string[];
  /** `match`: карточка-образец (она же верная); у сортировки — верная категория. */
  sampleCardId?: string;
  pauseBeforeMs?: number;
  /** Со взрослым: после полной модели попросить взрослого помочь (L4). */
  adultAssist?: true;
  /** Проба коррекции доводится до верного ответа при любом провале, не только при молчании. */
  escalateOnIncorrect?: true;
  /** Повтор пробы, снятой перерывом ребёнка или отказом. */
  requeuedFromTrialId?: string;
  /** Закрывающая проба: блок или сессию. */
  closes?: 'block' | 'session';
  /** Без подсказок: прогон поддержания рутины измеряет, звено с L0 без эскалации (методист, Р3). */
  measureOnly?: true;
};

export type TrialStep = {
  kind: 'trial';
  trialKind: AbaTrialKind;
  targetId: string;
  exemplarId: string;
  stepId?: string;
  runIndex?: number;
  sdVariantKey?: string;
  /**
   * Поле `identify` слева направо, верная — `exemplarId`. На L3 дистракторы убираются
   * (поле из одной карточки), на L2 — пассивны: это решает экран по уровню, в данные
   * пишется полное поле.
   */
  field?: string[];
  /**
   * `match`: образец сверху — эта карточка, она же верная среди `field`; у сортировки — верная
   * категория, а образец — предмет `exemplarId`. Варианты неактивны, пока не коснулись образца.
   */
  sampleCardId?: string;
  startPromptLevel: PromptLevel;
  /**
   * Сколько ждать после конца SD до первой подсказки на старте L0; `null` — подсказки по
   * задержке нет (старт L1+, измерительные пробы, разогрев, закрывающая).
   *
   * Ход пробы на экране: SD → `promptDelayMs ?? responseWindowMs` → если ответа нет и
   * эскалация разрешена — подсказка → `responseWindowMs` → … Ответ до конца
   * `promptDelayMs` — самостоятельный.
   */
  promptDelayMs: number | null;
  /** Окно ответа после каждого предъявления, включая полную модель. */
  responseWindowMs: number;
  /** Только `voice_volume`: после начала звука — сколько ещё ждать удержания громкости. */
  voiceHoldMs?: number;
  /** Пауза перед пробой. */
  pauseBeforeMs: number;
  /** Кто засчитывает. В конфигурации «сам» взрослого нет. */
  scoredBy: ScoringSource;
  /** Перенос и базовая линия измеряют: подсказки нет. */
  allowEscalation: boolean;
  /** После полной модели попросить взрослого выполнить вместе и записать L4. */
  askAdultForL4: boolean;
  /** Эскалировать и после неверного ответа, а не только после молчания: проба коррекции. */
  escalateOnIncorrect: boolean;
  /**
   * Похвалить внимание **до** инструкции: базовая линия подкрепляет внимание, но не
   * ответ, — после ответа реакция нейтральная.
   */
  praiseAttentionBeforeSd: boolean;
  /**
   * Проба без подсказок в цепочке (базовая линия, перенос, поддержание, проверка): проваленное
   * звено выполняет взрослый (`adultCompleted`), и прогон идёт дальше.
   */
  adultCompletesOnFail: boolean;
  closes?: 'block' | 'session';
};

/** Что известно о проведении пробы, кроме самой цели и её состояния. */
export type TrialContext = {
  withAdult: boolean;
  /** Можно ли сейчас просить взрослого о физической подсказке (L4). */
  l4Available: boolean;
  scoredBy: ScoringSource;
  /** Окно ответа по формату, удлинённое специалистом. */
  windowOverrideMs?: Partial<Record<AbaFormat, number>>;
  pendingPauseMs: number;
};

/** Ожидаемая проба: что предъявить и как оценивать. */
export function buildTrialStep(target: AbaTarget, s: AbaTargetState, p: PlannedTrial, ctx: TrialContext): TrialStep {
  const planned: PromptLevel =
    p.fixedStart ?? (MEASURING_KINDS.has(p.kind) ? 0 : clampToApp(promptStateOf(s, p.stepId).startPromptLevel));
  // старт 4 — только с просьбой к взрослому: коррекцию поставили до сопротивления или без
  // помощи взрослого — теперь это полная модель
  const start: PromptLevel = planned === 4 && !(ctx.l4Available && p.adultAssist) ? APP_MAX_PROMPT : planned;
  const own = responseWindowMs(target, p.stepId);
  const override = ctx.windowOverrideMs?.[target.format];
  // у звена — не короче его собственного окна: «закрыть кран» и «намылить» разной длины
  const windowMs = override ? Math.max(own, override) : own;
  const chainStep = Boolean(p.stepId);
  return {
    kind: 'trial',
    trialKind: p.kind,
    targetId: p.targetId,
    exemplarId: p.exemplarId,
    ...(p.stepId ? { stepId: p.stepId } : {}),
    ...(p.runIndex !== undefined ? { runIndex: p.runIndex } : {}),
    ...(p.sdVariantKey ? { sdVariantKey: p.sdVariantKey } : {}),
    ...(p.field ? { field: p.field } : {}),
    ...(p.sampleCardId ? { sampleCardId: p.sampleCardId } : {}),
    startPromptLevel: start,
    promptDelayMs: promptDelayMs(s, target, p.kind, start, windowMs, p.stepId),
    responseWindowMs: windowMs,
    ...(target.format === 'voice_volume' ? { voiceHoldMs: VOICE_VOLUME_HOLD_MS } : {}),
    pauseBeforeMs: Math.max(p.pauseBeforeMs ?? 0, ctx.pendingPauseMs),
    scoredBy: ctx.scoredBy,
    allowEscalation: p.kind !== 'generalization' && p.kind !== 'baseline' && p.kind !== 'verification' && !p.measureOnly,
    askAdultForL4: ctx.l4Available && (p.adultAssist === true || (chainStep && p.kind === 'teaching')),
    // звено цепочки: ошибка сразу поднимает уровень, цепочка завершается верно (блок 1)
    escalateOnIncorrect: p.escalateOnIncorrect === true || (chainStep && (p.kind === 'teaching' || p.kind === 'transfer')),
    praiseAttentionBeforeSd: p.kind === 'baseline',
    adultCompletesOnFail:
      ctx.withAdult &&
      chainStep &&
      (p.kind === 'baseline' || p.kind === 'generalization' || p.kind === 'verification' || p.kind === 'maintenance'),
    ...(p.closes ? { closes: p.closes } : {}),
  };
}

export type AbaTrialInput = Omit<AbaTrial, 'tokens' | 'tokenReason' | keyof ScoredFields>;

/** Запись — та ли проба, что ждала процедура. Пусто — та. */
export function trialMismatch(input: AbaTrialInput, expected: TrialStep, procedureId: string, format: AbaFormat): string[] {
  const errors: string[] = [];
  const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  if (input.sessionId !== procedureId) errors.push('проба из другой сессии');
  if (input.targetId !== expected.targetId) errors.push('не та цель');
  if (input.exemplarId !== expected.exemplarId) errors.push('не тот экземпляр');
  if (input.kind !== expected.trialKind) errors.push('не то назначение пробы');
  if (!same(input.stepId, expected.stepId)) errors.push('не то звено цепочки');
  if (!same(input.runIndex, expected.runIndex)) errors.push('не тот прогон цепочки');
  if (!same(input.sdVariantKey, expected.sdVariantKey)) errors.push('не та формулировка SD');
  if (!same(input.field, expected.field)) errors.push('не то поле карточек');
  if (!same(input.sampleCardId, expected.sampleCardId)) errors.push('не тот образец');
  // данные касаний — только у проб касанием, и выбранная карточка — из поля
  const touch = expected.field !== undefined;
  if (!touch && (input.chosenCardId !== undefined || input.tapCount !== undefined || input.fieldSizeAtResponse !== undefined)) {
    errors.push('касания пишутся только в пробах с полем карточек');
  }
  if (touch && input.chosenCardId !== undefined && !expected.field!.includes(input.chosenCardId)) errors.push('выбрана карточка не из поля');
  if (input.tapCount !== undefined && !(Number.isInteger(input.tapCount) && input.tapCount >= 0)) errors.push('число касаний — целое ≥ 0');
  if (input.sdRepeats !== undefined && ![input.sdRepeats.child, input.sdRepeats.adult].every((n) => Number.isInteger(n) && n >= 0)) {
    errors.push('повторы инструкции — целые ≥ 0');
  }
  if ((input.observingPrompted || input.observingLatencyMs !== undefined) && format !== 'match') {
    errors.push('реакция наблюдения — только у match');
  }
  if (!same(input.closes, expected.closes)) errors.push('не то, что закрывает проба');
  if (input.startPromptLevel !== expected.startPromptLevel) errors.push('не тот стартовый уровень');
  if (input.promptDelayMs !== expected.promptDelayMs) errors.push('не та задержка до подсказки');
  if (input.responseWindowMs !== expected.responseWindowMs) errors.push('не то окно ответа');
  if (input.scoredBy !== expected.scoredBy) errors.push('не тот источник оценки');
  // минимизация: громкость — только там, где она и есть критерий
  if (input.loudnessDb !== undefined && format !== 'voice_volume') {
    errors.push('громкость пишется только в целях на громкость');
  }
  return errors;
}

/** Сверить запись с ожидаемой пробой и оценить её журнал предъявлений. */
export function scoreAgainst(
  input: AbaTrialInput,
  expected: TrialStep,
  procedureId: string,
  format: AbaFormat,
): { ok: true; full: Omit<AbaTrial, 'tokens' | 'tokenReason'> } | { ok: false; errors: string[] } {
  // сначала — та ли это проба, что ждала процедура: иначе журнал оценивался бы по чужому шагу
  const wrong = trialMismatch(input, expected, procedureId, format);
  if (wrong.length) return { ok: false, errors: wrong };
  const scored = scoreTrial(input.presentationLog, {
    startPromptLevel: expected.startPromptLevel,
    scoredBy: expected.scoredBy,
    allowEscalation: expected.allowEscalation,
    escalateOnIncorrect: expected.escalateOnIncorrect,
    askAdultForL4: expected.askAdultForL4,
    chainStep: Boolean(expected.stepId),
    promptDelayMs: expected.promptDelayMs,
    responseWindowMs: expected.responseWindowMs,
    ...(format === 'match'
      ? {
          observingWindowMs: MATCH_OBSERVING_MS,
          sampleTouchedAt:
            input.observingLatencyMs === null || input.observingLatencyMs === undefined
              ? null
              : new Date(Date.parse(input.sdEndedAt) + input.observingLatencyMs).toISOString(),
        }
      : {}),
    sdEndedAt: input.sdEndedAt,
  });
  if (!scored.ok) return { ok: false, errors: scored.errors };
  // флаг наблюдения согласован с журналом: старт L0, второе предъявление — L1 приложения не раньше конца SD + 5000
  // (флаг выкидывает пробу из детектора зависимости и роста задержки — ложный стоил бы данных, №163)
  if (input.observingPrompted) {
    const l1 = input.presentationLog[1];
    const ok =
      input.startPromptLevel === 0 &&
      l1 !== undefined &&
      l1.by === 'app' &&
      l1.level === 1 &&
      Date.parse(l1.startedAt) >= Date.parse(input.sdEndedAt) + MATCH_OBSERVING_MS;
    if (!ok) return { ok: false, errors: ['подсказка к образцу не согласована с журналом'] };
  }
  // образца не коснулись вовремя — дана L1, самостоятельной проба быть не может
  if (input.observingPrompted && scored.fields.response === 'independent') {
    return { ok: false, errors: ['после подсказки к образцу проба не бывает самостоятельной'] };
  }
  return { ok: true, full: { ...input, ...scored.fields } };
}
