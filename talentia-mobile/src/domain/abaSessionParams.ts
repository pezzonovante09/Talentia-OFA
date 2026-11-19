/**
 * Параметры сессии, которые задаёт специалист (решение №61; ABA.md, «Спецификация первой версии»,
 * «Длина сессии»). Полоса профиля задаёт параметры по умолчанию; специалист может заменить её
 * полосой параметров `paramsBand` — одной из четырёх в любую сторону, и она меняет все параметры
 * сразу: потолок задержки, окна ответа, доску, размер набора, длину цепочки, перерыв. По одному
 * параметры не переопределяются — получились бы несогласованные сочетания.
 *
 * Отдельно: лимит времени, удлинение окна ответа по формату, одна или две обучаемые цели, длинная пауза после
 * ответа без жетона, освоенное вперемешку в обучающем блоке. Не
 * переопределяются: критерий, размер блока, потолок задержки, число эскалаций, правила жетонов.
 */
import { MAX_DELAY_MS, RESPONSE_WINDOW_MS, type AbaFormat } from '../types/aba';
import type { AgeBand } from '../types/task';

export type AbaSessionParams = {
  paramsBand?: AgeBand;
  /** 3–15 минут при полосе параметров 5-6, 3–20 — на остальных. */
  timeLimitMs?: number;
  /** Окно ответа по формату: от `max(текущее, потолок задержки)` до 10 с. */
  responseWindowMs?: Partial<Record<AbaFormat, number>>;
  maxTeachingTargets?: 1 | 2;
  /**
   * Вернуть паузу 5 с после ответа без жетона (решение владельца 2026-11-19): по умолчанию следующее задание приходит
   * через 2 с. Части детей быстрый темп тяжёл — специалист включает длинную паузу.
   */
  longInterTrial?: true;
  /**
   * Не подмешивать освоенное в обучающий блок (решение владельца 2026-11-19): по умолчанию между пробами цели идут
   * две пробы освоенной на блок из 5, в блоке 10 — четыре (`abaSession.ts`, `teachingBlock`).
   */
  noInterspersal?: true;
};

export const PARAM_LIMITS = {
  minTimeMs: 3 * 60_000,
  maxTimeMs: { young: 15 * 60_000, older: 20 * 60_000 },
  maxWindowMs: 10_000,
} as const;

/** Ошибки параметров при данной полосе профиля. Пусто — годятся. */
export function sessionParamsErrors(p: AbaSessionParams | undefined, profileBand?: AgeBand): string[] {
  if (!p) return [];
  const errors: string[] = [];
  const band = p.paramsBand ?? profileBand;
  if (p.timeLimitMs !== undefined && band) {
    const max = band === '5-6' ? PARAM_LIMITS.maxTimeMs.young : PARAM_LIMITS.maxTimeMs.older;
    if (p.timeLimitMs < PARAM_LIMITS.minTimeMs || p.timeLimitMs > max) {
      errors.push(`лимит времени ${p.timeLimitMs / 60_000} мин вне 3–${max / 60_000}`);
    }
  }
  for (const [format, ms] of Object.entries(p.responseWindowMs ?? {}) as [AbaFormat, number][]) {
    if (!band) continue;
    const min = Math.max(RESPONSE_WINDOW_MS[format][band], MAX_DELAY_MS[band]);
    if (ms < min || ms > PARAM_LIMITS.maxWindowMs) errors.push(`окно ${format} ${ms} мс вне ${min}–${PARAM_LIMITS.maxWindowMs}`);
  }
  return errors;
}

/**
 * Параметры после смены полосы: лимит времени и окна, которые при новой полосе вне пределов, снимаются («по умолчанию»),
 * остальное остаётся. Экран специалиста зовёт это перед записью — смена полосы не упирается в старые числа.
 */
export function pruneSessionParams(p: AbaSessionParams, profileBand: AgeBand): AbaSessionParams {
  const { timeLimitMs, responseWindowMs, ...rest } = p;
  const out: AbaSessionParams = { ...rest };
  if (timeLimitMs !== undefined && !sessionParamsErrors({ ...rest, timeLimitMs }, profileBand).length) out.timeLimitMs = timeLimitMs;
  const windows = Object.fromEntries(
    Object.entries(responseWindowMs ?? {}).filter(([f, ms]) => !sessionParamsErrors({ ...rest, responseWindowMs: { [f]: ms } }, profileBand).length),
  );
  if (Object.keys(windows).length) out.responseWindowMs = windows;
  return out;
}

const BANDS: readonly AgeBand[] = ['5-6', '7', '8', '9-10'];
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isWholeMs = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v > 0;

/**
 * Параметры из хранилища — ко входу старта (раздел «Для специалиста», методист 2026-11-18). `startAbaSession` на негодных
 * параметрах бросает, поэтому старт берёт их только отсюда. Проверка **по полю** (финальная рецензия методиста): поле
 * неверной формы (незнакомая полоса, формат, число слотов, дробные мс) или вне пределов при полосе профиля
 * (`pruneSessionParams`) снимается — «по умолчанию полосы», — остальные годные поля остаются (например,
 * `maxTeachingTargets: 1` при негодном окне). Незнакомые поля не читаются. Ничего годного — `undefined`.
 */
export function sanitizeSessionParams(raw: unknown, profileBand: AgeBand): AbaSessionParams | undefined {
  if (!isObject(raw)) return undefined;
  const out: AbaSessionParams = {};
  if (BANDS.includes(raw.paramsBand as AgeBand)) out.paramsBand = raw.paramsBand as AgeBand;
  if (isWholeMs(raw.timeLimitMs)) out.timeLimitMs = raw.timeLimitMs;
  if (raw.maxTeachingTargets === 1 || raw.maxTeachingTargets === 2) out.maxTeachingTargets = raw.maxTeachingTargets;
  if (raw.longInterTrial === true) out.longInterTrial = true;
  if (raw.noInterspersal === true) out.noInterspersal = true;
  if (isObject(raw.responseWindowMs)) {
    const windows: Partial<Record<AbaFormat, number>> = {};
    for (const [format, ms] of Object.entries(raw.responseWindowMs)) {
      if (Object.prototype.hasOwnProperty.call(RESPONSE_WINDOW_MS, format) && isWholeMs(ms)) windows[format as AbaFormat] = ms;
    }
    if (Object.keys(windows).length) out.responseWindowMs = windows;
  }
  const pruned = pruneSessionParams(out, profileBand);
  return Object.keys(pruned).length ? pruned : undefined;
}
