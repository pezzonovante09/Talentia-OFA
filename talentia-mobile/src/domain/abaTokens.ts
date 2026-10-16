/**
 * Жетоны и подкрепители ABA-режима. Спецификация — «Подкрепление» в `ABA.md`.
 *
 * Главное отличие от прежней версии — дифференциальное подкрепление: жетон оплачивает
 * верный ответ **на стартовом уровне**, без эскалации; понадобилась помощь сверх
 * стартовой — только похвала. «Меньше помощи — больше подкрепления» совпадает с
 * правилом затухания. Формулировка прежней версии «с подсказкой тоже считается»
 * гасила мотивацию отвечать самому.
 */
import type { AbaPhase, AbaTokenReason, AbaTrial } from '../types/aba';
import type { BoardStage } from './abaTokenTraining';

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
 * Что ребёнок получает сразу после пробы. Различие обязано быть заметным: жетон падает
 * на доску со звуком, похвала без жетона — только голос.
 *
 * - `neutral` на базовой линии — что бы ребёнок ни ответил: иначе она сама становится
 *   обучением и перестаёт измерять. Внимание подкрепляется **до** инструкции
 *   (`TrialStep.praiseAttentionBeforeSd`), а не как следствие ответа.
 * - `listened` — «Tali послушал», без «верно»: проба, которую оценило устройство без
 *   права на критерий (детектор начала звука знает «ответил», но не «верно»).
 */
export type Feedback = 'token_praise' | 'praise' | 'neutral' | 'listened';

/**
 * Доска жетонов. Жетоны **никогда не отнимаются, не срезаются и не сгорают**: прежняя
 * версия делала `Math.min(3, amount)`, и ребёнок, заработавший пять, получал три и не
 * понимал почему. Непредсказуемое подкрепление хуже редкого. Доска может
 * переполниться — это видно, и при обмене уходят все.
 *
 * `nonContingent` — сколько жетонов в этом цикле доски (от обмена до обмена) выдано не
 * за результат: за высоковероятные пробы и за участие. Их не больше `size − 1`:
 * последний жетон доски всегда оплачен ответом по цели. Иначе на полосе 5–6 разогрев
 * и участие заполняют доску из трёх, и обмен случается без единого ответа по цели.
 */
export type TokenBoard = { size: BoardStage; earned: number; nonContingent: number };

/**
 * Доска на устройстве между процедурами (`abaBoard`): единственный источник жетонов. `rev` растёт
 * при каждой записи, которая меняет доску; сессия помнит версию, с которой начала, и запись
 * поверх чужой отклоняется (`AbaBoardConflictError`). Без `rev` (старая запись) — 0.
 */
export type BoardRecord = Pick<TokenBoard, 'earned' | 'nonContingent'> & { rev?: number };

export const boardRevOf = (b: BoardRecord | undefined): number => b?.rev ?? 0;

export function emptyBoard(size: BoardStage): TokenBoard {
  return { size, earned: 0, nonContingent: 0 };
}

/** Можно ли ещё выдать жетон не за результат в этом цикле доски. */
export function nonContingentRoom(board: TokenBoard): boolean {
  return board.nonContingent < board.size - 1;
}

export type TokenAward = {
  tokens: 0 | 1;
  reason?: AbaTokenReason;
  /** Жетон не за результат — идёт в счёт `nonContingent`. */
  nonContingent?: true;
  feedback: Feedback;
  schedule: TokenSchedule;
};

export type AwardContext = {
  phase: AbaPhase;
  schedule: TokenSchedule;
  board: TokenBoard;
  rng: Rng;
  /** Жетон за высоковероятную пробу в этой сессии уже выдан. */
  highPTokenPaid?: boolean;
  /** Источник оценки пробы имеет право на критерий. Нет — реакция «Tali послушал». */
  counts?: boolean;
};

const SUCCESS = new Set(['independent', 'prompted']);

/**
 * Жетон и похвала за пробу.
 *
 * - Базовая линия — нейтрально и без жетона, что бы ребёнок ни ответил.
 * - Проба без права на критерий — «Tali послушал», без жетона.
 * - Верный на стартовом уровне — жетон и похвала; на освоенной цели жетон по
 *   прерывистой схеме, похвала всегда.
 * - Верный, когда понадобилась эскалация сверх стартового, и приближение — похвала без
 *   жетона, тёплая и без «но»: приближение на шейпинге обязано подкрепляться.
 * - Ошибка — нейтральная реакция.
 * - Коррекция и закрывающая проба — похвала без жетона: коррекция успешна по
 *   построению, и жетон за неё оплачивал бы саму ошибку.
 * - Высоковероятная проба (разогрев, отвлекающая) — жетон один на сессию и только пока
 *   на доске есть место для жетонов не за результат.
 */
export function awardForTrial(
  t: Pick<AbaTrial, 'response' | 'kind' | 'startPromptLevel' | 'promptLevelUsed'>,
  ctx: AwardContext,
): TokenAward {
  const { phase, schedule, board, rng } = ctx;
  const none = (feedback: Feedback): TokenAward => ({ tokens: 0, feedback, schedule });

  if (t.kind === 'baseline' || phase === 'baseline') return none('neutral');
  if (ctx.counts === false) return none('listened');
  if (t.response === 'approximation') return none('praise');
  if (!SUCCESS.has(t.response)) return none('neutral');
  if (t.promptLevelUsed > t.startPromptLevel) return none('praise');
  if (t.kind === 'correction' || t.kind === 'closing') return none('praise');

  if (t.kind === 'high_p') {
    if (ctx.highPTokenPaid || !nonContingentRoom(board)) return none('praise');
    return { tokens: 1, reason: 'high_p', nonContingent: true, feedback: 'token_praise', schedule };
  }
  if (phase !== 'mastered' && phase !== 'maintenance') {
    return { tokens: 1, reason: 'at_start_level', feedback: 'token_praise', schedule };
  }

  const sinceLast = schedule.sinceLast + 1;
  if (sinceLast < schedule.nextAt) return { tokens: 0, feedback: 'praise', schedule: { ...schedule, sinceLast } };
  return { tokens: 1, reason: 'at_start_level', feedback: 'token_praise', schedule: newSchedule(rng) };
}

/**
 * Жетон за завершение блока — независимо от точности. Ребёнок, у которого сегодня не
 * выходит, иначе не заработает ничего, и сеанс станет аверсивным целиком. Помечен
 * отдельной причиной и в результативность не входит; как жетон не за результат — только
 * пока на доске есть для него место.
 */
export function participationAward(board: TokenBoard): { tokens: 0 | 1; reason: 'participation' } {
  return { tokens: nonContingentRoom(board) ? 1 : 0, reason: 'participation' };
}

export function addTokens(board: TokenBoard, n: number, nonContingent = false): TokenBoard {
  if (n < 0) throw new Error('Жетоны не отнимаются');
  return {
    ...board,
    earned: board.earned + n,
    nonContingent: board.nonContingent + (nonContingent ? n : 0),
  };
}

export function isBoardFull(board: TokenBoard): boolean {
  return board.earned >= board.size;
}

/**
 * Обмен на выбранный подкрепитель — **только при полной доске**. Если бы подкрепитель
 * выдавался при любом числе жетонов, жетон не стоил бы ничего.
 *
 * По расписанию сессии идёт перерыв, а не обмен: неполная доска переходит на следующий
 * блок как есть. При обмене уходят все жетоны, включая сверх доски, и начинается новый
 * цикл доски.
 */
export function tryExchange(board: TokenBoard): { board: TokenBoard; exchanged: number } {
  if (!isBoardFull(board)) return { board, exchanged: 0 };
  return { board: emptyBoard(board.size), exchanged: board.earned };
}

/** Предложение обмена после прогона рутины (`AbaRoutineRun.exchangeOffer` и прогон, который его сделал). */
export type RoutineOffer = { runId: string; day: string; tokens: number; boardSize: number; options: string[] };

/**
 * Открытое предложение обмена после рутины: последнее по порядку записи, по нему нет выбора,
 * доска всё ещё полна (сессия могла обменять раньше) и локальный день тот же — на следующий день
 * предложение закрыто без записи, жетоны остаются на доске и уходят в ближайшей точке обмена
 * (обучение доске, перерыв и конец сессии, выплаченный жетон следующей рутины).
 */
export function openRoutineOffer(input: {
  lastOffer: RoutineOffer | null;
  chosenRunIds: readonly string[];
  board: Pick<TokenBoard, 'earned'>;
  today: string;
}): RoutineOffer | null {
  const o = input.lastOffer;
  if (!o || input.chosenRunIds.includes(o.runId)) return null;
  if (input.board.earned < o.boardSize) return null;
  if (o.day !== input.today) return null;
  return o;
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
