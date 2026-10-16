/**
 * Детская карточка «перерыв»: обучение как просьбе и данные для специалиста (раунд 3, Г3;
 * `aba-pedagogy-specialist` 2026-10-12, ABA.md «Отмена отметки и карточка «перерыв»»).
 *
 * Карточка — функциональная просьба: касание всегда даёт настоящий перерыв, без жетона, похвалы,
 * Tali и выбора подкрепителя. Обучается вне требования — в сессии сопряжения и перед первой пробой
 * первой рабочей сессии, только со взрослым. Хранится на **ребёнке** (`breakCard` в состоянии ABA),
 * а не на цели. Здесь чистая логика; перерыв и событие пишет сессия (`recordBreakCardTraining`).
 */
import type { AbaSessionEndReason } from '../types/aba';
import type { AgeBand } from '../types/task';

export type BreakCardStep = 'model' | 'prompted' | 'independent';
export type BreakCardFlag = 'break_card_not_acquired' | 'break_card_frequent';

/** Обучающих возможностей за сессию — не больше (без настойчивости). */
export const BREAK_CARD_MAX_OPPORTUNITIES = 3;
/** Ждать касания без жеста на ступени `independent`, затем жест. */
export const BREAK_CARD_WAIT_MS = 10_000;
/** Сессий обучения без принятия — флаг `break_card_not_acquired`. */
export const BREAK_CARD_SESSIONS_BEFORE_FLAG = 3;
/** Долгий перерыв в занятиях (дней): одна возможность без модели. */
export const BREAK_CARD_LONG_GAP_DAYS = 14;
/** «Частое использование»: сессий из последних `RECENT_WINDOW` и порог. */
export const BREAK_CARD_RECENT_WINDOW = 5;
export const BREAK_CARD_FREQUENT_SESSIONS = 3;
export const BREAK_CARD_FREQUENT_REQUESTS = 2;
/** Два повтора подряд с касанием только после жеста сбрасывают «обучена». */
export const BREAK_CARD_RESET_AFTER = 2;

/** Обучающий перерыв, секунд: короче обычного, потому что требования до него не было. */
export const BREAK_CARD_TRAINING_SECONDS: Record<AgeBand, number> = { '5-6': 15, '7': 20, '8': 20, '9-10': 20 };

export type BreakCardState = {
  acquired: boolean;
  /** День принятия (`YYYY-MM-DD`). */
  acquiredAt?: string;
  acquiredVia?: 'training' | 'in_trial';
  /** С какой ступени начинать обучение, пока не принята. */
  step: BreakCardStep;
  /** Сессий с обучением без принятия. */
  sessionsTried: number;
  flags: BreakCardFlag[];
  /** Последние сессии: просьбы ребёнка в пробе (обучающие и предложения Tali не считаются). */
  recent: { sessionIndex: number; day: string; requests: number; byLimit: boolean }[];
  lastSessionDay: string | null;
  /** Основной наблюдатель при последнем обучении (uuid взрослого) — специалисту не уходит. */
  observerId: string | null;
  /** Устройство при последнем обучении, если есть идентификатор; специалисту не уходит. */
  deviceId: string | null;
  /** Повторов подряд, где ребёнок коснулся только после жеста. */
  repeatsPrompted?: number;
};

export function initialBreakCard(): BreakCardState {
  return {
    acquired: false,
    step: 'model',
    sessionsTried: 0,
    flags: [],
    recent: [],
    lastSessionDay: null,
    observerId: null,
    deviceId: null,
  };
}

export type BreakCardTrainingEvent = {
  step: BreakCardStep;
  touched: boolean;
  gestureGiven: boolean;
  latencyMs: number | null;
};

export type BreakCardPlan = {
  /** Сколько обучающих возможностей предложить: 0, 1 (повтор) или 3. */
  opportunities: 0 | 1 | 3;
  startStep: BreakCardStep;
  /** Взрослому показать подсказку «жестом, не словами, не уговаривать» (сменился наблюдатель). */
  adultCoaching: boolean;
  retrain: boolean;
};

const DAY = 86_400_000;
const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / DAY);

/**
 * План обучения на сессию. В «Сам» не обучается. Не принята — три возможности со ступени
 * `step`; принята — повтор (одна возможность на `independent`, без модели) при долгом перерыве
 * (14 дней), смене устройства или смене основного наблюдателя; иначе не нужна.
 */
export function breakCardPlan(
  card: BreakCardState,
  ctx: { config: 'with_adult' | 'alone'; day: string; observerId: string | null; deviceId?: string | null },
): BreakCardPlan {
  if (ctx.config === 'alone') return { opportunities: 0, startStep: card.step, adultCoaching: false, retrain: false };
  if (!card.acquired) {
    return { opportunities: BREAK_CARD_MAX_OPPORTUNITIES, startStep: card.step, adultCoaching: false, retrain: false };
  }
  const longGap = card.lastSessionDay !== null && daysBetween(card.lastSessionDay, ctx.day) >= BREAK_CARD_LONG_GAP_DAYS;
  const newDevice = card.deviceId !== null && !!ctx.deviceId && card.deviceId !== ctx.deviceId;
  const newObserver = card.observerId !== null && ctx.observerId !== null && card.observerId !== ctx.observerId;
  if (longGap || newDevice || newObserver) {
    return { opportunities: 1, startStep: 'independent', adultCoaching: newObserver, retrain: true };
  }
  return { opportunities: 0, startStep: 'independent', adultCoaching: false, retrain: false };
}

const withFlag = (flags: BreakCardFlag[], f: BreakCardFlag) => (flags.includes(f) ? flags : [...flags, f]);
const withoutFlag = (flags: BreakCardFlag[], f: BreakCardFlag) => flags.filter((x) => x !== f);

/**
 * Итог обучающих возможностей сессии. Принята при первом касании **без жеста** на ступени
 * `independent`. Не принята: сессия обучения засчитана (`sessionsTried`), ступень растёт — касание
 * после жеста ведёт на `independent`, иначе не ниже `prompted`; после трёх сессий — флаг
 * `break_card_not_acquired` (работа не блокируется). Принятая: касание только после жеста — повтор в
 * следующей сессии, два таких подряд сбрасывают «обучена».
 */
export function applyBreakCardTraining(
  card: BreakCardState,
  events: readonly BreakCardTrainingEvent[],
  ctx: { day: string; observerId: string | null; deviceId?: string | null },
): BreakCardState {
  if (events.length === 0) return card;
  const independentTouch = events.some((e) => e.step === 'independent' && e.touched && !e.gestureGiven);
  const promptedTouch = events.some((e) => e.touched && e.gestureGiven);
  const base: BreakCardState = {
    ...card,
    lastSessionDay: ctx.day,
    observerId: ctx.observerId ?? card.observerId,
    deviceId: ctx.deviceId ?? card.deviceId,
  };

  if (card.acquired) {
    if (independentTouch) return { ...base, repeatsPrompted: 0 };
    if (!promptedTouch) return base;
    const repeats = (card.repeatsPrompted ?? 0) + 1;
    if (repeats >= BREAK_CARD_RESET_AFTER) {
      const { acquiredAt: _a, acquiredVia: _v, ...rest } = base;
      return { ...rest, acquired: false, sessionsTried: 0, step: 'model', repeatsPrompted: 0, flags: withoutFlag(card.flags, 'break_card_not_acquired') };
    }
    return { ...base, repeatsPrompted: repeats };
  }

  if (independentTouch) {
    return {
      ...base,
      acquired: true,
      acquiredAt: ctx.day,
      acquiredVia: 'training',
      step: 'independent',
      repeatsPrompted: 0,
      flags: withoutFlag(card.flags, 'break_card_not_acquired'),
    };
  }
  const sessionsTried = card.sessionsTried + 1;
  const step: BreakCardStep = promptedTouch ? 'independent' : card.step === 'model' ? 'prompted' : card.step;
  return {
    ...base,
    sessionsTried,
    step,
    flags: sessionsTried >= BREAK_CARD_SESSIONS_BEFORE_FLAG ? withFlag(card.flags, 'break_card_not_acquired') : card.flags,
  };
}

/** Просьбы ребёнка в пробе и конец по лимиту — из событий хода сессии (`AbaSessionEvent`). */
export function breakCardRequestsOf(
  events: readonly { kind: string; by?: string; action?: string }[],
): { requests: number; byLimit: boolean } {
  const child = events.filter((e) => e.kind === 'assent' && e.by === 'child_card');
  return { requests: child.length, byLimit: child.some((e) => e.action === 'end') };
}

/**
 * Итог рабочей сессии для карточки. Просьба ребёнка в пробе при ещё не принятой карточке — это и
 * есть принятие (`in_trial`). «Частая» сессия — две просьбы и больше или конец по третьей просьбе;
 * флаг `break_card_frequent` — три таких из последних пяти. Касание подсвеченной карточки после
 * «Отказа» (`takeBreakCard`) и предложение Tali в счёт не идут. Только данные специалисту: поведение
 * процедуры флаг не меняет.
 */
export function applyBreakCardSession(
  card: BreakCardState,
  session: { sessionIndex: number; day: string; requests: number; byLimit: boolean; endReason: AbaSessionEndReason | null },
  ctx: { observerId: string | null; deviceId?: string | null },
): BreakCardState {
  const recent = [
    ...card.recent,
    { sessionIndex: session.sessionIndex, day: session.day, requests: session.requests, byLimit: session.byLimit },
  ].slice(-BREAK_CARD_RECENT_WINDOW);
  const frequent = recent.filter((r) => r.requests >= BREAK_CARD_FREQUENT_REQUESTS || r.byLimit).length;
  const flags =
    recent.length >= BREAK_CARD_FREQUENT_SESSIONS && frequent >= BREAK_CARD_FREQUENT_SESSIONS
      ? withFlag(card.flags, 'break_card_frequent')
      : withoutFlag(card.flags, 'break_card_frequent');
  const acquiredNow = !card.acquired && session.requests > 0;
  return {
    ...card,
    ...(acquiredNow ? { acquired: true, acquiredAt: session.day, acquiredVia: 'in_trial' as const, step: 'independent' as const } : {}),
    flags: acquiredNow ? withoutFlag(flags, 'break_card_not_acquired') : flags,
    recent,
    lastSessionDay: session.day,
    observerId: ctx.observerId ?? card.observerId,
    deviceId: ctx.deviceId ?? card.deviceId,
  };
}
