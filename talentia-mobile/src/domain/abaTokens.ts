/**
 * Жетоны и подкрепители ABA-режима. Спецификация — «Подкрепление» в `ABA.md`.
 *
 * Главное отличие от прежней версии — дифференциальное подкрепление: жетон
 * оплачивает только самостоятельный ответ. Формулировка «с подсказкой тоже
 * считается» гасила мотивацию отвечать самому.
 */
import type { AbaPhase, AbaResponse, AbaTokenReason, AbaTrialKind } from '../types/aba';

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

/**
 * Что ребёнок получает сразу после пробы. Различие обязано быть заметным: жетон
 * падает на доску со звуком, похвала без жетона — только голос.
 */
export type Feedback = 'token_praise' | 'praise' | 'neutral';

export type TokenAward = {
  tokens: 0 | 1;
  reason?: AbaTokenReason;
  feedback: Feedback;
  schedule: TokenSchedule;
};

/**
 * Жетон и похвала за пробу.
 *
 * Самостоятельный верный — жетон и похвала (на освоенной цели жетон по
 * прерывистой схеме, похвала всегда). Верный с подсказкой и приближение —
 * похвала **без** жетона, тёплая и без «но»: приближение на шейпинге обязано
 * подкрепляться, иначе усилие наказывается. Ошибка — нейтральная реакция.
 *
 * Разогрев — жетон за каждый верный: его задача начать сессию с успеха, и
 * прерывистая схема оставила бы успех неоплаченным. Базовая линия не
 * подкрепляется вовсе: иначе она сама становится обучением и перестаёт измерять.
 */
export function awardForTrial(
  response: AbaResponse,
  kind: AbaTrialKind,
  phase: AbaPhase,
  schedule: TokenSchedule,
  rng: Rng,
): TokenAward {
  if (kind === 'baseline' || phase === 'baseline') return { tokens: 0, feedback: 'neutral', schedule };
  if (response === 'prompted' || response === 'approximation') return { tokens: 0, feedback: 'praise', schedule };
  if (response !== 'independent') return { tokens: 0, feedback: 'neutral', schedule };

  const continuous = kind === 'high_p' || (phase !== 'mastered' && phase !== 'maintenance');
  if (continuous) return { tokens: 1, reason: 'independent', feedback: 'token_praise', schedule };

  const sinceLast = schedule.sinceLast + 1;
  if (sinceLast < schedule.nextAt) return { tokens: 0, feedback: 'praise', schedule: { ...schedule, sinceLast } };
  return { tokens: 1, reason: 'independent', feedback: 'token_praise', schedule: newSchedule(rng) };
}

/**
 * Жетон за завершение блока — независимо от точности. Ребёнок, у которого
 * сегодня не выходит, иначе не заработает ничего, и сеанс станет аверсивным
 * целиком. Помечен отдельной причиной и в результативность не входит.
 */
export const PARTICIPATION_AWARD = { tokens: 1, reason: 'participation' } as const;

/**
 * Доска жетонов. Жетоны **никогда не отнимаются, не срезаются и не сгорают**:
 * прежняя версия делала `Math.min(3, amount)`, и ребёнок, заработавший пять,
 * получал три и не понимал почему. Непредсказуемое подкрепление хуже редкого.
 * Доска может переполниться — это видно, и при обмене уходят все.
 */
export type TokenBoard = { size: 3 | 5; earned: number };

export function addTokens(board: TokenBoard, n: number): TokenBoard {
  if (n < 0) throw new Error('Жетоны не отнимаются');
  return { ...board, earned: board.earned + n };
}

export function isBoardFull(board: TokenBoard): boolean {
  return board.earned >= board.size;
}

/**
 * Обмен на выбранный подкрепитель — **только при полной доске**. Если бы
 * подкрепитель выдавался при любом числе жетонов, жетон не стоил бы ничего.
 *
 * По расписанию сессии идёт перерыв, а не обмен: неполная доска переходит на
 * следующий блок как есть. При обмене уходят все жетоны, включая сверх доски.
 */
export function tryExchange(board: TokenBoard): { board: TokenBoard; exchanged: number } {
  if (!isBoardFull(board)) return { board, exchanged: 0 };
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
