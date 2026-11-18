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
import { INTERRUPTIONS_FOR_CONCERN, MATCH_OBSERVING_MS, MAX_DELAY_MS, type AbaConfig, type AbaSessionEndReason, type AbaSessionEvent, type PromptLevel, type SampleTouchOutcome } from '../types/aba';
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
/**
 * `sample_touch_not_acquired` — 3 сессии без прохождения; `assent_concern` — две тревожные сессии шага подряд
 * (`touchStepConcerning`), снимает только отметка «просмотрено» (`reviewSampleTouchAssentConcern`).
 */
export type SampleTouchFlag = 'sample_touch_not_acquired' | 'assent_concern';

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
  /** Тревожных сессий шага подряд (`touchStepConcerning`) — для `assent_concern`, как `assentSessionsInRow` у цели. */
  assentSessionsInRow?: number;
  /** Кто отметил «беспокойство по согласию просмотрено» — роль без имени. */
  assentConcernReviewed?: { role: 'owner' | 'guardian' | 'specialist'; at: string };
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

/**
 * Конец сессии, который сессию шага не засчитывает (финальная рецензия методиста 2026-11-18): остановка взрослым,
 * ошибка приложения, сворачивание (со взрослым — как остановка, `types/aba.ts`), отказ — в том числе бездействие
 * телефона, оно приходит отказом (`withdrawAssent(…, 'device_inactivity')`).
 */
const NOT_COUNTED: ReadonlySet<AbaSessionEndReason> = new Set(['adult_stopped', 'app_error', 'app_backgrounded', 'assent_withdrawn']);

/**
 * Шаг дошёл до своего конца: «Сопротивляется» или десять проб (прохождение — отдельная ветка). Шаг, оборванный «Отказом»
 * или концом сессии, — нет: такая сессия для `sample_touch_not_acquired` не в счёт.
 */
export function touchStepReachedEnd(events: readonly AbaSessionEvent[]): boolean {
  const own = touchEventsOf(events).filter((e) => !e.closes);
  return own.some((e) => e.outcome === 'l4_resisted') || own.length >= SAMPLE_TOUCH_MAX_TRIALS;
}

type AssentEvent = Extract<AbaSessionEvent, { kind: 'assent' }>;
/** События согласия на шаге «коснись картинки» (`step: 'sample_touch'`): «Отказ», «Сопротивляется», карточка «перерыв». */
export const touchAssentEventsOf = (events: readonly AbaSessionEvent[]): AssentEvent[] =>
  events.filter((e): e is AssentEvent => e.kind === 'assent' && e.step === 'sample_touch');

/**
 * Тревожна ли сессия шага — аналог `isConcerning` у проб: «Сопротивляется» на шаге, «Отказ» на шаге (он кончает шаг,
 * второго прерывания на шаге уже не бывает — иначе отказ каждой сессии не дал бы сигнала нигде), конец сессии отказом
 * на шаге или хотя бы два прерывания на шаге (карточка «перерыв»).
 */
export function touchStepConcerning(events: readonly AbaSessionEvent[]): boolean {
  const own = touchAssentEventsOf(events);
  // конец сессии отказом на шаге (второй «Отказ», третья карточка) — тоже тревожно; бездействие телефона — нет
  const refusedOrEnded = (e: AssentEvent) => e.by !== 'device_inactivity' && (e.action === 'end' || (e.by === 'adult_observed' && e.action === 'break'));
  return (
    own.some((e) => e.action === 'l4_stopped' || refusedOrEnded(e)) ||
    own.filter((e) => e.action === 'break' || e.action === 'l4_stopped').length >= INTERRUPTIONS_FOR_CONCERN
  );
}

/** Две тревожные сессии шага подряд — `assent_concern`; спокойная сессия шага обнуляет счётчик, флаг снимает только отметка. */
function withTouchAssentConcern(s: SampleTouchState, concern: boolean): SampleTouchState {
  const inRow = concern ? (s.assentSessionsInRow ?? 0) + 1 : 0;
  return { ...s, assentSessionsInRow: inRow, flags: inRow >= 2 ? withFlag(s.flags, 'assent_concern') : s.flags };
}

/** «Беспокойство по согласию просмотрено» для шага: флаг снят, счётчик обнулён, роль снявшего. Флага нет — `null`. */
export function reviewSampleTouchAssentConcern(s: SampleTouchState, role: 'owner' | 'guardian' | 'specialist', at: string): SampleTouchState | null {
  if (!s.flags.includes('assent_concern')) return null;
  return { ...s, flags: s.flags.filter((f) => f !== 'assent_concern'), assentSessionsInRow: 0, assentConcernReviewed: { role, at } };
}

/**
 * Итог сессии для шага. `inSession` — состояние шага в сессии (прохождение, затухание); `events` — события хода.
 *
 * - Пройден в сессии — флаг снят, «возвращён» снят, счётчик сессий обнулён.
 * - Пробы были, не пройден — сессия в счёт, только если шаг дошёл до своего конца (`touchStepReachedEnd`) и сессия
 *   кончилась не остановкой, ошибкой, сворачиванием или отказом (`NOT_COUNTED`); после трёх — флаг
 *   `sample_touch_not_acquired`, шаг продолжается.
 * - Пробы были — тревожность шага (`touchStepConcerning`): две подряд — `assent_concern`; прохождение его не снимает.
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
  } else if (!inSession.passed && touches.length > 0 && touchStepReachedEnd(events) && !NOT_COUNTED.has(ctx.endReason)) {
    const sessionsTried = s.sessionsTried + 1;
    s = { ...s, sessionsTried, flags: sessionsTried >= SAMPLE_TOUCH_SESSIONS_BEFORE_FLAG ? withFlag(s.flags, 'sample_touch_not_acquired') : s.flags };
  }
  // шаг был в сессии (пробы или прерывания на нём) — тревожность шага; без шага счётчик не трогается
  if (touches.length > 0 || touchAssentEventsOf(events).length > 0) s = withTouchAssentConcern(s, touchStepConcerning(events));
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
