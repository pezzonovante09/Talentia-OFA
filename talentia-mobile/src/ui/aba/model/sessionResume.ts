/**
 * Возврат на экран сессии после сворачивания (фаза 8) — чистые правила, без I/O и без React. Что делать с данными
 * (снимок, живая доска, пороги `awayOutcome`) решает `services/local/abaResume.ts`; здесь — как продолжить **кадр**:
 *
 * - обмен, который домен засчитал, а ребёнок не досмотрел, показывается заново, и доступ идёт с начала: на уходе снимок
 *   откатывает начало доступа (`exchangeUnseen`), на возврате это видит `exchangePendingOnResume` (методист а6);
 * - перерыв продолжается с того же начала: кольцо — по остатку от `breakStartedAt`, а правило касания и срок
 *   бездействия — от момента возврата; остаток меньше `RESUME_RING_MIN_MS` — сразу первое приглашение
 *   (`child-ux-specialist`, поправка А);
 * - доступ до T продолжается с остатка (просроченные стадии проходят разом, `stepAccess`), после T — только кадр конца
 *   `endSettleMs` «игрушку убрали в карточку» (поправка Б, решение владельца 2026-11-06); в журнал — реально выданные
 *   отрезки сцены (методист а7);
 * - хвост конца (`AbaSessionTail`, №172 п. 2): уход на шаге хвоста записывается сразу (ребёнок может не вернуться); на
 *   возврате до 2 мин купленный доступ доигрывается (`tailOnReturn`, а8, решение владельца 2026-11-06) и новая строка
 *   заменяет строку ухода, иначе — «Закончили».
 *
 * Тесты — на ручных часах (`src/ui/aba/model/__tests__/sessionResume.test.ts`).
 */
import { abaChoiceZone, abaLayout, abaTierFor, type AbaTier } from '../../../design/abaTokens';
import { AWAY_RECHOOSE_MS, type AbaSessionState } from '../../../domain/abaSession';
import type { AbaSessionTail } from '../../../types/aba';
import { startAccess, stepAccess, type AccessRun } from './accessRun';
import type { TailStep } from './endTail';
import type { AccessScene } from './sessionPhase';

const TIER_RANK: Record<AbaTier, number> = { tight: 1, compact: 2, roomy: 3 };
const ZONE_OF: Record<AbaTier, { choice: number }> = { roomy: abaChoiceZone.regular, compact: abaChoiceZone.compact, tight: abaChoiceZone.tight };

/** Ширина ряда из трёх плит тира с зазорами: ряд может заходить на боковые поля экрана, но не за край окна. */
export function tierRowWidth(tier: AbaTier): number {
  return 3 * ZONE_OF[tier].choice + 2 * abaLayout.plateGap;
}

/** Самый крупный тир, что вмещает окно и по высоте, и по ширине; `null` — ни один (тогда пауза). */
export function tierForWindow(o: { height: number; width: number; insetBottom: number }): AbaTier | null {
  const byHeight = abaTierFor(o.height, o.insetBottom);
  if (byHeight === null) return null;
  const order: AbaTier[] = ['roomy', 'compact', 'tight'];
  return order.slice(order.indexOf(byHeight)).find((t) => tierRowWidth(t) <= o.width) ?? null;
}

/**
 * Вмещает ли окно раскладку тира, выбранного на старте (№182). По высоте — тот же расчёт, что выбор тира: тир или
 * крупнее ещё помещается. По ширине — окно стало уже, чем на старте, и уже ряда из трёх плит: устройство, которое было
 * таким с самого начала, паузой не встречается.
 */
export function windowFitsTier(o: { tier: AbaTier; height: number; width: number; insetBottom: number; startWidth: number }): boolean {
  const now = abaTierFor(o.height, o.insetBottom);
  if (now === null || TIER_RANK[now] < TIER_RANK[o.tier]) return false;
  return !(o.width < o.startWidth && o.width < tierRowWidth(o.tier));
}

/** Остаток перерыва короче — кольца нет, сразу приглашение: кадр короче 5 с — мигание, не состояние. */
export const RESUME_RING_MIN_MS = 5000;

/** Обмен прошёл в домене (обучение доске, перерыв, повторный выбор), а экран обмена ребёнок не видел: доступ ещё не начинался. */
export function exchangePendingOnResume(state: AbaSessionState): boolean {
  return state.queue[0]?.kind === 'access' && state.accessStartedAt === null;
}

/**
 * Уход в фон, пока обмен не досмотрен (кадр обмена или он ещё впереди): домен уже отметил начало шага доступа — отмена
 * этой отметки, чтобы возврат показал обмен и дал доступ целиком. Время шага до ухода — не рабочее, как и сам шаг.
 */
export function exchangeUnseen(state: AbaSessionState, at: number): AbaSessionState {
  if (state.accessStartedAt === null) return state;
  return { ...state, accessStartedAt: null, pausedMs: state.pausedMs + Math.max(0, at - state.accessStartedAt) };
}

export type BreakOnReturn = {
  /** Начало перерыва — доля кольца считается от него. */
  startedAt: number;
  /** Показ кадра — правило касания и срок бездействия считаются от него. */
  shownAt: number;
  until: number;
  tick: number;
  invite: 0 | 1;
  inviteAt: number | null;
};

/**
 * Перерыв, начатый до сворачивания (`breakStartedAt`), на возврате `now`. Срок уже прошёл или остаток короче
 * `RESUME_RING_MIN_MS` — первое приглашение с `inviteAt = now`: конец по бездействию отсчитывается от возврата, а не от
 * срока — в фоне ребёнок ответить не мог.
 */
export function breakOnReturn(o: { startedAt: number; maxMs: number; now: number }): BreakOnReturn {
  const until = o.startedAt + o.maxMs;
  const ring = until - o.now >= RESUME_RING_MIN_MS;
  return { startedAt: o.startedAt, shownAt: o.now, until, tick: o.now, invite: ring ? 0 : 1, inviteAt: ring ? null : o.now };
}

export type AccessOnReturn = {
  run: AccessRun;
  /** Отрезки сцены, выданные до сворачивания. */
  scenes: AccessScene[];
  /** Начало текущего отрезка (возврат), `null` — сцены больше нет, только кадр конца. */
  sceneFrom: number | null;
};

/**
 * Доступ, начатый до сворачивания (`accessStartedAt`), на возврате `now`. До T — сцена продолжается с остатка; после T —
 * кадр конца `endSettleMs` без сцены и кольца, затем следующий шаг. `delivered` — отрезки, известные экрану (тёплый
 * возврат); на холодном старте их нет: сцена шла (снимок с началом доступа ложится только в начале сцены), а конец
 * неизвестен — один отрезок от `accessStartedAt` с отметкой `endUnknown`, в длительность доступа не входит (№181).
 */
export function accessOnReturn(o: { accessStartedAt: number; durationMs: number; leftAt: number; now: number; still: boolean; delivered?: AccessScene[] }): AccessOnReturn {
  const endsAt = o.accessStartedAt + o.durationMs;
  const before: AccessScene[] = o.delivered ?? [{ startedAt: o.accessStartedAt, endedAt: Math.max(o.accessStartedAt, Math.min(o.leftAt, endsAt)), endUnknown: true }];
  if (o.now < endsAt) {
    // просроченные стадии (подсказка «закругляемся») проходят разом и без звука: `stepAccess` сам глушит `cue` после срока
    const { run } = stepAccess(startAccess(o.accessStartedAt, o.durationMs, 0, o.still), o.now);
    return { run, scenes: before, sceneFrom: o.now };
  }
  // кадр конца: карточка 160 стоит `endSettleMs` от возврата (`accessDueAt` для `hold` при нулевой сцене и calm)
  return { run: { ...startAccess(o.now, 0, 0, true), stage: 'hold', cued: true }, scenes: before, sceneFrom: null };
}

export type TailFacts = {
  sessionId: string;
  /** Отрезки сцены доступа в хвосте (после обмена в конце или в цикле сопряжения). */
  accessScenes: AccessScene[];
  /** Момент посадки жетона цикла сопряжения; `null` — не сел. */
  pairingTokenAt: number | null;
};

/**
 * Как продолжить хвост на возврате (а8): до 2 мин на обмене и после севшего жетона цикла — дальше по очереди (доступ с
 * начала, жетон куплен, второго нет), на доступе — правило а7 (`'access'`); иначе — «Закончили». `'next'` без ухода — хвост
 * идёт своим ходом.
 */
export function tailOnReturn(left: { step: TailStep['kind']; at: number } | null, now: number, tokenLanded = false): 'next' | 'access' | 'end' {
  if (!left || left.step === 'end') return 'next';
  if (now - left.at >= AWAY_RECHOOSE_MS) return 'end';
  if (left.step === 'access') return 'access';
  return left.step === 'exchange' || (left.step === 'pairing_token' && tokenLanded) ? 'next' : 'end';
}

const iso = (ms: number) => new Date(ms).toISOString();

/** Уход в фон на шаге хвоста — его конец: записывается, что успели выдать и на каком шаге ушли. */
export function tailOnLeave(step: TailStep['kind'], facts: TailFacts, leftAt: number): AbaSessionTail {
  return {
    sessionId: facts.sessionId,
    accessScene: facts.accessScenes.map((s) => ({ startedAt: iso(s.startedAt), endedAt: iso(s.endedAt) })),
    pairingTokenAt: facts.pairingTokenAt === null ? null : iso(facts.pairingTokenAt),
    leftAtStep: step === 'end' ? null : step,
    leftAt: iso(leftAt),
    completed: false,
    // сцена хвоста — его шаг доступа: ушли на обмене или ожидании — она не начиналась (№181)
    sceneStarted: step === 'access' || facts.accessScenes.length > 0,
  };
}

/**
 * Сцена доступа хвоста началась после ухода на обмене (тёплый возврат до 2 мин, №181): строка «сцена началась» перекрывает
 * строку ухода — если приложение погибнет в сцене, жетоны обмена не вернутся поверх выданного доступа.
 */
export function tailOnSceneStart(facts: TailFacts): AbaSessionTail {
  return { ...tailOnLeave('access', facts, 0), leftAt: null, sceneStarted: true };
}

/** Хвост доигран до «Закончили». */
export function tailOnEnd(facts: TailFacts): AbaSessionTail {
  return {
    sessionId: facts.sessionId,
    accessScene: facts.accessScenes.map((s) => ({ startedAt: iso(s.startedAt), endedAt: iso(s.endedAt) })),
    pairingTokenAt: facts.pairingTokenAt === null ? null : iso(facts.pairingTokenAt),
    leftAtStep: null,
    leftAt: null,
    completed: true,
  };
}
