/**
 * Параметры сессии, которые задаёт специалист (решение №61; ABA.md, «Спецификация первой версии»,
 * «Длина сессии»). Полоса профиля задаёт параметры по умолчанию; специалист может заменить её
 * полосой параметров `paramsBand` — одной из четырёх в любую сторону, и она меняет все параметры
 * сразу: потолок задержки, окна ответа, доску, размер набора, длину цепочки, перерыв. По одному
 * параметры не переопределяются — получились бы несогласованные сочетания.
 *
 * Отдельно: лимит времени, удлинение окна ответа по формату, одна или две обучаемые цели. Не
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

const BANDS: readonly AgeBand[] = ['5-6', '7', '8', '9-10'];
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isWholeMs = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v > 0;

/**
 * Параметры из хранилища — ко входу старта (раздел «Для специалиста», методист 2026-11-18). `startAbaSession` на негодных
 * параметрах бросает, поэтому старт берёт их только отсюда: неверная форма (незнакомая полоса, формат, число слотов,
 * дробные мс, лишнее поле) или ошибка `sessionParamsErrors` при полосе профиля — `undefined`, сессия идёт по умолчанию
 * полосы. Пустые параметры — тоже `undefined`.
 */
export function sanitizeSessionParams(raw: unknown, profileBand: AgeBand): AbaSessionParams | undefined {
  if (!isObject(raw)) return undefined;
  const known = new Set(['paramsBand', 'timeLimitMs', 'responseWindowMs', 'maxTeachingTargets']);
  if (Object.keys(raw).some((k) => !known.has(k))) return undefined;
  const out: AbaSessionParams = {};
  if (raw.paramsBand !== undefined) {
    if (!BANDS.includes(raw.paramsBand as AgeBand)) return undefined;
    out.paramsBand = raw.paramsBand as AgeBand;
  }
  if (raw.timeLimitMs !== undefined) {
    if (!isWholeMs(raw.timeLimitMs)) return undefined;
    out.timeLimitMs = raw.timeLimitMs;
  }
  if (raw.maxTeachingTargets !== undefined) {
    if (raw.maxTeachingTargets !== 1 && raw.maxTeachingTargets !== 2) return undefined;
    out.maxTeachingTargets = raw.maxTeachingTargets;
  }
  if (raw.responseWindowMs !== undefined) {
    if (!isObject(raw.responseWindowMs)) return undefined;
    const windows: Partial<Record<AbaFormat, number>> = {};
    for (const [format, ms] of Object.entries(raw.responseWindowMs)) {
      if (!Object.prototype.hasOwnProperty.call(RESPONSE_WINDOW_MS, format) || !isWholeMs(ms)) return undefined;
      windows[format as AbaFormat] = ms;
    }
    if (Object.keys(windows).length) out.responseWindowMs = windows;
  }
  if (!Object.keys(out).length) return undefined;
  return sessionParamsErrors(out, profileBand).length ? undefined : out;
}
