/**
 * Жетоны и подкрепители ABA-режима. Спецификация — «Подкрепление» в `ABA.md`.
 *
 * Главное отличие от прежней версии — дифференциальное подкрепление: жетон
 * оплачивает только самостоятельный ответ. Формулировка «с подсказкой тоже
 * считается» гасила мотивацию отвечать самому.
 */
import type { AbaPhase, AbaResponse, AbaTokenReason } from '../types/aba';

/** Случайный источник в [0, 1). Передаётся явно, чтобы тесты были детерминированы. */
export type Rng = () => number;

/**
 * Прерывистая схема для освоенных целей: жетон в среднем за каждый третий
 * самостоятельный ответ, точное число случайно от 2 до 4. Постоянное
 * подкрепление освоенного навыка делает его хрупким: навык исчезает вместе с
 * жетонами.
 */
export type TokenSchedule = { sinceLast: number; nextAt: number };

export const VARIABLE_RATIO = { min: 2, max: 4 } as const;

export function drawNextAt(rng: Rng): number {
  const span = VARIABLE_RATIO.max - VARIABLE_RATIO.min + 1;
  return VARIABLE_RATIO.min + Math.floor(rng() * span);
}

export function newSchedule(rng: Rng): TokenSchedule {
  return { sinceLast: 0, nextAt: drawNextAt(rng) };
}

export type TokenAward = { tokens: 0 | 1; reason?: AbaTokenReason; schedule: TokenSchedule };

/**
 * Жетон за пробу.
 *
 * Самостоятельный верный — жетон (на освоенной цели — по прерывистой схеме).
 * Верный с подсказкой — похвала **без** жетона, тёплая и без «но». Ошибка —
 * нейтральная реакция и ноль. Обе схемы работают в одной сессии: фаза цели
 * решает, а не настройки.
 */
export function awardForTrial(
  response: AbaResponse,
  phase: AbaPhase,
  schedule: TokenSchedule,
  rng: Rng,
): TokenAward {
  if (response !== 'independent') return { tokens: 0, schedule };

  if (phase !== 'mastered' && phase !== 'maintenance') {
    return { tokens: 1, reason: 'independent', schedule };
  }
  const sinceLast = schedule.sinceLast + 1;
  if (sinceLast < schedule.nextAt) return { tokens: 0, schedule: { ...schedule, sinceLast } };
  return { tokens: 1, reason: 'independent', schedule: newSchedule(rng) };
}

/**
 * Жетон за завершение блока — независимо от точности. Ребёнок, у которого
 * сегодня не выходит, иначе не заработает ничего, и сеанс станет аверсивным
 * целиком. Помечен отдельной причиной и в результативность не входит.
 */
export const PARTICIPATION_AWARD = { tokens: 1, reason: 'participation' } as const;

/**
 * Доска жетонов. Жетоны **никогда не отнимаются и не срезаются**: прежняя версия
 * делала `Math.min(3, amount)`, и ребёнок, заработавший пять, получал три и не
 * понимал почему. Непредсказуемое подкрепление хуже редкого. Доска может
 * переполниться — это видно, и при обмене уходят все.
 */
export type TokenBoard = { size: 3 | 5; earned: number };

export function addTokens(board: TokenBoard, n: number): TokenBoard {
  if (n < 0) throw new Error('Жетоны не отнимаются');
  return { ...board, earned: board.earned + n };
}

export function isBoardFull(board: TokenBoard): boolean {
  return board.earned >= board.size;
}

/** Обмен — по расписанию сессии, а не по заполненности: доска обнуляется целиком. */
export function exchange(board: TokenBoard): { board: TokenBoard; exchanged: number } {
  return { board: { ...board, earned: 0 }, exchanged: board.earned };
}

/** Сколько подкрепителей предлагается на выбор в начале сессии. */
export const REINFORCER_CHOICES = 3;

/** Меньше — ротации не из чего строиться, насыщение неизбежно. */
export const MIN_REINFORCER_POOL = 6;

/**
 * Три подкрепителя на выбор.
 *
 * Выбранное дважды подряд в третий раз не предлагается: против насыщения.
 * `history` — выборы прошлых сессий, свежие в конце.
 */
export function reinforcerChoices(pool: string[], history: string[], rng: Rng): string[] {
  if (pool.length < MIN_REINFORCER_POOL) {
    throw new Error(`Пул подкрепителей меньше ${MIN_REINFORCER_POOL}`);
  }
  const [prev, last] = history.slice(-2);
  const blocked = history.length >= 2 && prev === last ? last : undefined;
  const candidates = pool.filter((id) => id !== blocked);

  // Фишер — Йейтс по копии: пул не мутируется
  const shuffled = [...candidates];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, REINFORCER_CHOICES);
}
