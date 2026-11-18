/**
 * Шаг «коснись картинки» (решение 1, часть В; спецификация методиста `docs/aba-center/specialist-and-touch-spec-2026-11-18.md`,
 * раздел А). Каждый ребёнок один раз, до первой пробы `match`, только «Со взрослым»: на экране только образец и инструкция
 * «коснись». Отдельной проверки нет — первые 5 самостоятельных касаний подряд в одной сессии и есть прохождение.
 *
 * Хранится на **ребёнке** (`sampleTouch` в состоянии ABA), как карточка «перерыв». Нет записи — шаг не пройден (без
 * миграции): умолчание ставит чтение входа сессии (`abaStart.ts`). Здесь чистая логика; пробы шага пишет сессия
 * (`recordSampleTouch` в `abaSession.ts`) событиями `sample_touch`, итог сессии — `closeSampleTouchSession`.
 *
 * В состоянии нет ни наблюдателей, ни устройства: ключ уходит специалисту как есть.
 */
import { MATCH_OBSERVING_MS, MAX_DELAY_MS, type AbaConfig, type AbaSessionEndReason, type AbaSessionEvent, type PromptLevel, type SampleTouchOutcome } from '../types/aba';
import type { AgeBand } from '../types/task';
import { FADE_AFTER, FAILURES_TO_RAISE } from './abaPrompting';

/** Самостоятельных касаний подряд в сессии — шаг пройден. */
export const SAMPLE_TOUCH_STREAK = 5;
/** Проб шага за сессию — не больше (закрывающие сверх — только если больше в сессии ничего нет). */
export const SAMPLE_TOUCH_MAX_TRIALS = 10;
/** Закрывающих проб шага на модели, когда после шага в сессии ничего нет: конец — на успешной пробе. */
export const SAMPLE_TOUCH_CLOSING_MAX = 2;
/** Сессий шага без прохождения — флаг `sample_touch_not_acquired` (шаг продолжается). */
export const SAMPLE_TOUCH_SESSIONS_BEFORE_FLAG = 3;
/** Лестница шага: L0 → L1 (метка над образцом) → L3 (модель — экранная рука касается образца); L2 нет. */
export const SAMPLE_TOUCH_LADDER: readonly SampleTouchLevel[] = [0, 1, 3];
/** Предъявлений приложения в пробе — не больше трёх (дальше — L4 взрослого или конец пробы). */
export const SAMPLE_TOUCH_MAX_PRESENTATIONS = 3;
/** L0 — задержка по полосе (потолок прогрессивной задержки полосы). */
export const SAMPLE_TOUCH_DELAY_MS: Record<AgeBand, number> = MAX_DELAY_MS;
/** Окно касания после метки и после модели — как окно наблюдения `match`. */
export const SAMPLE_TOUCH_WINDOW_MS = MATCH_OBSERVING_MS;

export type SampleTouchLevel = 0 | 1 | 3;
export type SampleTouchFlag = 'sample_touch_not_acquired';

export type SampleTouchState = {
  passed: boolean;
  /** День прохождения (`YYYY-MM-DD`). */
  passedAt?: string;
  /** Стартовый уровень пробы — затухание по общему правилу (`FADE_AFTER`, `FAILURES_TO_RAISE`). */
  startLevel: SampleTouchLevel;
  /** Подряд успешных проб на стартовом уровне / проб, где понадобилось больше, / провалов. */
  atStartRun: number;
  aboveRun: number;
  failures: number;
  /** Сессий с пробами шага без прохождения (остановка взрослым и ошибка приложения не в счёт). */
  sessionsTried: number;
  flags: SampleTouchFlag[];
  /** Возвращён к шагу вторым промахом наблюдения в измерении (срез А) — до нового прохождения; строка взрослому. */
  returned?: true;
  /** Номер сессии, итогом которой «внимание к образцу не установлено» (`observing_not_established`) — строка взрослому. */
  observingNotEstablishedSession?: number;
};

export function initialSampleTouch(): SampleTouchState {
  return { passed: false, startLevel: 0, atStartRun: 0, aboveRun: 0, failures: 0, sessionsTried: 0, flags: [] };
}

/** Шаг идёт в этой сессии: «Со взрослым» и не пройден. Нет состояния — шаг не применяется (старые снимки, тесты домена). */
export function sampleTouchDue(st: SampleTouchState | undefined, config: AbaConfig): boolean {
  return config === 'with_adult' && st !== undefined && !st.passed;
}

/** Цели `match` в плане: «Сам» — только после пройденного шага; нет состояния — без ограничения. */
export function matchAllowedAlone(st: SampleTouchState | undefined): boolean {
  return st === undefined || st.passed;
}

/** Проба шага, как её прислал экран (`sampleTouchRun.ts`). */
export type SampleTouchInput = {
  startLevel: SampleTouchLevel;
  /** Уровень, на котором коснулся; без касания — последний показанный; 4 — помог взрослый. */
  levelUsed: PromptLevel;
  outcome: SampleTouchOutcome;
  adultPrompted: boolean;
  latencyMs: number | null;
};

type TouchEvent = Extract<AbaSessionEvent, { kind: 'sample_touch' }>;
export const touchEventsOf = (events: readonly AbaSessionEvent[]): TouchEvent[] =>
  events.filter((e): e is TouchEvent => e.kind === 'sample_touch');

export const isIndependentTouch = (t: Pick<SampleTouchInput, 'outcome' | 'levelUsed' | 'adultPrompted'>): boolean =>
  t.outcome === 'touched' && t.levelUsed === 0 && !t.adultPrompted;

/** Успешная проба шага: ребёнок сам коснулся образца на L0–L3 (L4 — коснулись вместе). */
export const isTouchSuccess = (t: Pick<SampleTouchInput, 'outcome'>): boolean => t.outcome === 'touched';

/** Самостоятельных подряд в конце событий сессии. */
export function touchStreak(events: readonly AbaSessionEvent[]): number {
  let n = 0;
  for (const e of [...touchEventsOf(events)].reverse()) {
    if (!e.independent) break;
    n += 1;
  }
  return n;
}

/** Жетон, «принято» или ничего: L0 без подсказки — жетон; L1–L3 и «Была подсказка» — «принято»; L4 и без касания — ничего. */
export function touchConsequence(t: SampleTouchInput): 'token' | 'praise' | 'none' {
  if (t.outcome !== 'touched') return 'none';
  return isIndependentTouch(t) ? 'token' : 'praise';
}

const up = (l: SampleTouchLevel): SampleTouchLevel => SAMPLE_TOUCH_LADDER.find((x) => x > l) ?? 3;
const down = (l: SampleTouchLevel): SampleTouchLevel => [...SAMPLE_TOUCH_LADDER].reverse().find((x) => x < l) ?? 0;

/**
 * Затухание по общему правилу (`abaPrompting.fadeStep`) на лестнице без L2: два успеха подряд на стартовом уровне —
 * ступень вниз; два подряд, где понадобилось больше, или два провала подряд — ступень вверх. «Дождался метки» со
 * старта L0 (коснулся на L1 приложения) — нейтрально: рвёт только серию подъёма. «Была подсказка» — проба
 * подсказанная (выше старта). «Отказ» и закрывающая проба затухание не двигают.
 */
export function fadeSampleTouch(s: SampleTouchState, t: SampleTouchInput): SampleTouchState {
  if (t.outcome === 'refusal') return s;
  const failed = t.outcome !== 'touched';
  if (failed) {
    const failures = s.failures + 1;
    if (failures >= FAILURES_TO_RAISE) return { ...s, startLevel: up(s.startLevel), atStartRun: 0, aboveRun: 0, failures: 0 };
    return { ...s, failures, atStartRun: 0, aboveRun: s.aboveRun + 1 };
  }
  const base = { ...s, failures: 0 };
  const waited = t.startLevel === 0 && t.levelUsed === 1 && !t.adultPrompted;
  if (waited) return { ...base, aboveRun: 0 };
  const above = t.adultPrompted || t.levelUsed > t.startLevel;
  const atStartRun = above ? 0 : s.atStartRun + 1;
  const aboveRun = above ? s.aboveRun + 1 : 0;
  if (atStartRun >= FADE_AFTER && s.startLevel > 0) return { ...base, startLevel: down(s.startLevel), atStartRun: 0, aboveRun: 0 };
  if (aboveRun >= FADE_AFTER && s.startLevel < 3) return { ...base, startLevel: up(s.startLevel), atStartRun: 0, aboveRun: 0 };
  return { ...base, atStartRun, aboveRun };
}

/** Прошёл ли шаг этой пробой (5 самостоятельных подряд в сессии, считая её). */
export function passesWith(events: readonly AbaSessionEvent[], t: SampleTouchInput): boolean {
  return isIndependentTouch(t) && touchStreak(events) + 1 >= SAMPLE_TOUCH_STREAK;
}

/** Шаг на сегодня кончился: «Сопротивляется» на L4 или «Отказ». */
export const endsStepToday = (t: Pick<SampleTouchInput, 'outcome'>): boolean => t.outcome === 'l4_resisted' || t.outcome === 'refusal';

const withFlag = (flags: SampleTouchFlag[], f: SampleTouchFlag) => (flags.includes(f) ? flags : [...flags, f]);

/** Остановка взрослым и ошибка приложения сессию шага не засчитывают. */
const NOT_COUNTED: ReadonlySet<AbaSessionEndReason> = new Set(['adult_stopped', 'app_error']);

/**
 * Итог сессии для шага. `inSession` — состояние шага в сессии (прохождение, затухание); `events` — события хода.
 *
 * - Пройден в сессии — флаг снят, «возвращён» снят, счётчик сессий обнулён.
 * - Пробы были, не пройден — сессия в счёт (кроме остановки взрослым и ошибки приложения); после трёх — флаг
 *   `sample_touch_not_acquired`, шаг продолжается.
 * - `returnToStep` — измерение `match` закрыто вторым промахом наблюдения (срез А): ребёнок снова на шаге; стартовый
 *   уровень шага не откатывается.
 * - `observingNotEstablished` — в сессии «внимание к образцу не установлено»: номер сессии для строки взрослому.
 */
export function closeSampleTouchSession(
  inSession: SampleTouchState,
  events: readonly AbaSessionEvent[],
  ctx: { day: string; sessionIndex: number; endReason: AbaSessionEndReason; returnToStep: boolean; observingNotEstablished: boolean },
): SampleTouchState {
  const touches = touchEventsOf(events);
  let s: SampleTouchState = inSession;
  if (inSession.passed && touches.length > 0) {
    // пройден в этой сессии
    const { returned: _r, ...rest } = s;
    s = { ...rest, sessionsTried: 0, flags: s.flags.filter((f) => f !== 'sample_touch_not_acquired') };
  } else if (!inSession.passed && touches.length > 0 && !NOT_COUNTED.has(ctx.endReason)) {
    const sessionsTried = s.sessionsTried + 1;
    s = { ...s, sessionsTried, flags: sessionsTried >= SAMPLE_TOUCH_SESSIONS_BEFORE_FLAG ? withFlag(s.flags, 'sample_touch_not_acquired') : s.flags };
  }
  if (ctx.returnToStep && s.passed) {
    const { passedAt: _p, ...rest } = s;
    s = { ...rest, passed: false, returned: true, sessionsTried: 0 };
  }
  if (ctx.observingNotEstablished) s = { ...s, observingNotEstablishedSession: ctx.sessionIndex };
  return s;
}

/** Прохождение в сессии: состояние шага после пятого самостоятельного подряд. */
export function markPassed(s: SampleTouchState, day: string): SampleTouchState {
  return { ...s, passed: true, passedAt: day };
}
