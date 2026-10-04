/**
 * Флаги барьеров по данным телефона (ABA.md, «Спецификация первой версии»; `aba-pedagogy-specialist`
 * 2026-10-02). **Только сигнал** специалисту и родителю простым языком — процедура не меняется:
 * профилактика уже встроена (балансировка позиций и образцов, ротация подкрепителей).
 * Автоматическая реакция есть только у `prompt_dependent` (`abaPrompting.ts`).
 *
 * - на цели: смещение по позиции (`position_bias`), предпочтение карточки (`card_preference`);
 * - на сессии: перебор (`over_tapping`), слабая мотивация (`low_motivation`).
 *
 * Флаг ставится и снимается по двум сессиям подряд: ставится, когда условие держится на окнах,
 * оканчивающихся двумя последними сессиями (у сигналов сессии) или на текущем окне (у флагов
 * цели); снимается после двух сессий подряд без условия.
 */
import type { AbaFlag, AbaFormat, AbaTargetState, AbaTrial } from '../types/aba';
import type { SessionTrials } from './abaPrompting';

export const BARRIERS = {
  /** Окно флагов цели — последние сессии цели (у набора — набора). */
  windowSessions: 3,
  /** Проб с ответом при полном поле, без которых доля ничего не значит. */
  minTrials: 20,
  /** Порог доли одной позиции или карточки по размеру поля: ложных срабатываний ≈ 1–5%. */
  shareAt: { 2: 0.8, 3: 0.6, 4: 0.55 } as Readonly<Record<number, number>>,
  /** Перебор: лишних касаний за пробу, доля таких проб, минимум проб касанием в сессии. */
  extraTaps: 2,
  overTapShare: 0.3,
  overTapMinTrials: 5,
  /** Слабая мотивация: доля `no_response` при минимуме проб, или столько молчаний на разогреве. */
  noResponseShare: 0.3,
  noResponseMinTrials: 6,
  highPNoResponse: 2,
  /** …или медиана латентности выше прошлой во столько раз — при истории и ответах не меньше. */
  latencyRatio: 1.5,
  latencyHistorySessions: 5,
  latencyMinAnswers: 5,
  /** Сигнал ставится и снимается по стольким сессиям подряд. */
  sessionsInRow: 2,
} as const;

/** Касаний, нужных на пробу: у `match` и сортировки — образец и выбор. */
const NEEDED_TAPS: Partial<Record<AbaFormat, number>> = { identify: 1, match: 2 };

const ANSWERED: ReadonlySet<AbaTrial['response']> = new Set(['independent', 'incorrect']);

/**
 * Проба, по которой видно предпочтение: ответ дан при полном поле — у `identify` на L0, у `match`
 * не выше L1 (L2 убирает карточки), — верный или неверный, и известно, что выбрано.
 */
function choiceAtFullField(t: AbaTrial, format: AbaFormat): boolean {
  if (!t.field?.length || t.chosenCardId === undefined || !ANSWERED.has(t.response)) return false;
  if (t.fieldSizeAtResponse !== undefined && t.fieldSizeAtResponse !== t.field.length) return false;
  return format === 'match' ? t.promptLevelUsed <= 1 : t.promptLevelUsed === 0;
}

/** Наибольшая доля одного значения. */
function topShare(values: readonly (string | number)[]): number {
  const counts = new Map<string | number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return Math.max(0, ...counts.values()) / values.length;
}

/** Флаги цели на окне сессий (свежие в конце). Группы — по размеру поля. */
export function choiceBiasIn(sessions: readonly SessionTrials[], format: AbaFormat): ('position_bias' | 'card_preference')[] {
  const trials = sessions
    .slice(-BARRIERS.windowSessions)
    .flatMap((x) => x.trials)
    .filter((t) => choiceAtFullField(t, format));
  const bySize = new Map<number, AbaTrial[]>();
  for (const t of trials) bySize.set(t.field!.length, [...(bySize.get(t.field!.length) ?? []), t]);
  const out = new Set<'position_bias' | 'card_preference'>();
  for (const [n, group] of bySize) {
    const threshold = BARRIERS.shareAt[n];
    if (threshold === undefined || group.length < BARRIERS.minTrials) continue;
    if (topShare(group.map((t) => t.field!.indexOf(t.chosenCardId!))) >= threshold) out.add('position_bias');
    if (topShare(group.map((t) => t.chosenCardId!)) >= threshold) out.add('card_preference');
  }
  return [...out];
}

/**
 * Поставить или снять флаги смещения на цели. Ставятся по текущему окну; снимаются, когда условия
 * нет на окнах, оканчивающихся двумя последними сессиями.
 */
export function applyChoiceBias(s: AbaTargetState, sessions: readonly SessionTrials[], format: AbaFormat): AbaTargetState {
  if (!NEEDED_TAPS[format]) return s;
  const now = choiceBiasIn(sessions, format);
  const before = sessions.length > 1 ? choiceBiasIn(sessions.slice(0, -1), format) : [];
  const flags: AbaFlag[] = s.flags.filter((f) => {
    if (f !== 'position_bias' && f !== 'card_preference') return true;
    return now.includes(f) || before.includes(f);
  });
  for (const f of now) if (!flags.includes(f)) flags.push(f);
  return flags.length === s.flags.length && flags.every((f, i) => f === s.flags[i]) ? s : { ...s, flags };
}

/** Проба касанием с лишними касаниями: у `identify` нужно одно, у `match` — два. */
export function isOverTap(t: AbaTrial, format: AbaFormat): boolean {
  const need = NEEDED_TAPS[format];
  return need !== undefined && t.tapCount !== undefined && t.tapCount - need >= BARRIERS.extraTaps;
}

/** Сессия для сигналов: все пробы сессии и формат цели каждой пробы. */
export type SignalSession = { index: number; trials: readonly AbaTrial[]; formatOf: (targetId: string) => AbaFormat };

function overTappingIn(x: SignalSession): boolean {
  const touch = x.trials.filter((t) => t.tapCount !== undefined && NEEDED_TAPS[x.formatOf(t.targetId)] !== undefined);
  if (touch.length < BARRIERS.overTapMinTrials) return false;
  return touch.filter((t) => isOverTap(t, x.formatOf(t.targetId))).length / touch.length >= BARRIERS.overTapShare;
}

const median = (xs: readonly number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * Латентность для сравнения — только самостоятельные ответы со старта L0: пробы с задержкой до
 * подсказки и форматы с длинным окном (`say`) иначе давали бы ложную «слабую мотивацию».
 */
const latencies = (x: SignalSession, format: AbaFormat) =>
  x.trials
    .filter((t) => t.latencyMs !== null && t.response === 'independent' && t.startPromptLevel === 0 && x.formatOf(t.targetId) === format)
    .map((t) => t.latencyMs as number);

/** Условие слабой мотивации на сессии `i` истории. */
function lowMotivationAt(history: readonly SignalSession[], i: number): boolean {
  const x = history[i];
  const counted = x.trials.filter((t) => t.response !== 'interrupted');
  const silent = counted.filter((t) => t.response === 'no_response');
  if (counted.length >= BARRIERS.noResponseMinTrials && silent.length / counted.length >= BARRIERS.noResponseShare) return true;
  if (silent.filter((t) => t.kind === 'high_p').length >= BARRIERS.highPNoResponse) return true;
  const past = history.slice(Math.max(0, i - BARRIERS.latencyHistorySessions), i);
  if (past.length < BARRIERS.latencyHistorySessions) return false;
  // медиана сравнивается внутри формата: у `say` окно длиннее, и сессия с большей долей голосовых
  // целей иначе давала бы ложную «слабую мотивацию» (проверка методиста)
  const formats = new Set(x.trials.map((t) => x.formatOf(t.targetId)));
  return [...formats].some((f) => {
    const now = latencies(x, f);
    const before = past.flatMap((p) => latencies(p, f));
    if (now.length < BARRIERS.latencyMinAnswers || before.length < BARRIERS.latencyMinAnswers) return false;
    return median(now) >= BARRIERS.latencyRatio * median(before);
  });
}

export type SessionSignal = 'over_tapping' | 'low_motivation';

/**
 * Сигналы по истории сессий ребёнка (свежие в конце) с гистерезисом: ставится, когда условие
 * держится в двух последних сессиях подряд; снимается, когда его нет в двух последних подряд;
 * иначе остаётся как было (`previous`) — родитель не видит мигающий сигнал.
 */
export function sessionSignals(history: readonly SignalSession[], previous: readonly SessionSignal[] = []): SessionSignal[] {
  const n = BARRIERS.sessionsInRow;
  const last = history.map((_, i) => i).slice(-n);
  const checks: [SessionSignal, (i: number) => boolean][] = [
    ['over_tapping', (i) => overTappingIn(history[i])],
    ['low_motivation', (i) => lowMotivationAt(history, i)],
  ];
  return checks
    .filter(([signal, at]) => {
      if (last.length < n) return previous.includes(signal);
      if (last.every(at)) return true;
      if (last.every((i) => !at(i))) return false;
      return previous.includes(signal);
    })
    .map(([signal]) => signal);
}
