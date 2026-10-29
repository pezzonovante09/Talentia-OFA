/**
 * Сопряжение и обучение доске жетонов. Спецификация — `ABA.md`, «Сопряжение и обучение
 * доске» (решение методиста, принято владельцем 2026-09-29).
 *
 * Жетон сам по себе ничего не стоит: ценным его делает обмен. Если первая сессия —
 * базовая линия без единого жетона, доска с первого дня значит «награды не бывает».
 * Поэтому сначала **сопряжение**: подкрепитель без требований, жетон по таймеру и сразу
 * обмен. Потом **обучение доске**: доска из одной ячейки, обмен сразу, как только она
 * полна, и рост 1 → 2 → 3 → 5 по мере того, как ребёнок доходит до обменов.
 *
 * Хранится на **ребёнке**, не на цели: доска одна на все цели.
 */
import type { PairingEndReason } from './abaPairing';
import { TOKEN_BOARD_SIZE, type AbaConfig, type AbaSessionEndReason } from '../types/aba';
import type { AgeBand } from '../types/task';

export type BoardStage = 1 | 2 | 3 | 5;

/** Ступени доски. Финальная — размер доски по полосе: 3 на 5–6, 5 дальше. */
export const BOARD_STAGES: readonly BoardStage[] = [1, 2, 3, 5];

/** Сессия сопряжения: без проб и без требований, около 2.5 минут. */
export const PAIRING = {
  /** Циклов «жетон → обмен → доступ». Конец — сразу после четвёртого, пока интерес есть. */
  cycles: 4,
  /** Жетон кладётся по таймеру после конца прошлого доступа, а не после действия ребёнка. */
  tokenAfterMs: 10_000,
  accessMs: 20_000,
  /** После этого подкрепитель выбирает взрослый. */
  choiceTimeoutMs: 30_000,
  /** Подряд сессий сопряжения, где выбрал ребёнок и сессия не брошена, — критерий выхода. */
  sessionsToPass: 2,
  /** Столько сессий без критерия — флаг специалисту; сопряжение продолжается. */
  sessionsBeforeFlag: 5,
  /**
   * Столько незасчитанных сессий (остановил взрослый, свернули) среди последних `uncountedWindow` — флаг
   * `pairing_keeps_breaking` (№165, по окну — №166): в счёт `sessionsBeforeFlag` они не идут, и без своего порога
   * сопряжение крутилось бы молча; «подряд» не ловило чередование «оборвали, оборвали, прошло».
   */
  uncountedBeforeFlag: 3,
  uncountedWindow: 5,
} as const;

/** Доступ к подкрепителю за обмен по ступени. В рабочее время сессии не идёт. */
export const EXCHANGE_ACCESS_MS: Record<BoardStage, number> = { 1: 20_000, 2: 20_000, 3: 40_000, 5: 60_000 };

/** Сессий подряд на ступени для решения о переходе. */
export const STAGE_WINDOW = 2;

/** Обменов за сессию, чтобы сессия считалась за рост ступени. */
export const EXCHANGES_TO_GROW = 2;

export type TokenTrainingFlag = 'pairing_not_established' | 'pairing_keeps_breaking' | 'token_training_stalled';

/** Итог сессии на ступени — для решения о переходе. */
export type StageSession = {
  sessionIndex: number;
  exchanges: number;
  endReason: AbaSessionEndReason;
  /**
   * В окне сессии (старт → фиксация) был обмен рутины (методист, 2026-10-12). Рутинные обмены в
   * `exchanges` не идут и ступень не растят; но ноль обменов сессии при таком обмене ничего не
   * говорит об обучении доске — её опустошила рутина.
   */
  routineExchangeInWindow?: boolean;
};

export type TokenTrainingState = {
  pairingDone: boolean;
  pairingSessions: number;
  /** Подряд сессий сопряжения, выполнивших критерий. */
  pairingStreak: number;
  /** Последние `PAIRING.uncountedWindow` сессий сопряжения, свежие в конце: `true` — не засчитана (№166). Нет поля — пусто. */
  pairingRecent?: boolean[];
  stage: BoardStage;
  /** Сессии на текущей ступени, свежие в конце; при смене ступени начинаются заново. */
  atStage: StageSession[];
  flags: TokenTrainingFlag[];
};

export function initialTokenTraining(): TokenTrainingState {
  return { pairingDone: false, pairingSessions: 0, pairingStreak: 0, stage: 1, atStage: [], flags: [] };
}

/** Финальная ступень по полосе. */
export function finalStage(band: AgeBand): BoardStage {
  return TOKEN_BOARD_SIZE[band];
}

/** Рабочий размер доски: ступень, но не больше размера по полосе. */
export function workingBoardSize(t: TokenTrainingState, band: AgeBand): BoardStage {
  return Math.min(t.stage, finalStage(band)) as BoardStage;
}

/**
 * Идёт ли ещё обучение доске: пока ступень ниже финальной, обмен — сразу, как доска
 * полна, внутри блока. Это осознанное исключение из правила «обмен только на перерыве»:
 * на короткой доске связь «жетон → подкрепитель» должна быть немедленной.
 */
export function immediateExchange(t: TokenTrainingState, band: AgeBand): boolean {
  return t.stage < finalStage(band);
}

const withFlag = (flags: TokenTrainingFlag[], f: TokenTrainingFlag) => (flags.includes(f) ? flags : [...flags, f]);

/**
 * Итог сессии сопряжения. Критерий — выбор сделал ребёнок, а не взрослый по таймауту, и
 * сессия не брошена; две такие подряд — сопряжение закончено, дальше обучение доске с
 * одной ячейки.
 *
 * - Брошенное и «Сам» без выбора (`no_choice`, №165) засчитываются и серию рвут.
 * - Остановка взрослым и свёрнутое приложение (№164) не засчитываются. Серию они не рвут — кроме свёрнутого в «Сам»
 *   (№166): взрослого рядом нет, «свернул» там чаще всего «ушёл кнопкой домой».
 * - `PAIRING.uncountedBeforeFlag` незасчитанных среди последних `PAIRING.uncountedWindow` — флаг
 *   `pairing_keeps_breaking` (№165–166): процедура не доходит до конца; со взрослым — сигнал о ходе процедуры, в «Сам»
 *   часть обрывов — уход ребёнка (причину специалист видит в журнале: `config` и `endReason`).
 */
export function applyPairingSession(
  t: TokenTrainingState,
  session: { chosenBy: 'child' | 'adult'; endReason: PairingEndReason; config: AbaConfig },
): TokenTrainingState {
  if (t.pairingDone) return t;
  const uncounted = session.endReason === 'adult_stopped' || session.endReason === 'app_backgrounded';
  const pairingRecent = [...(t.pairingRecent ?? []), uncounted].slice(-PAIRING.uncountedWindow);
  const breaking = pairingRecent.filter(Boolean).length >= PAIRING.uncountedBeforeFlag;
  const flagged = breaking ? withFlag(t.flags, 'pairing_keeps_breaking') : t.flags;
  if (uncounted) {
    const breaksStreak = session.endReason === 'app_backgrounded' && session.config === 'alone';
    return { ...t, pairingRecent, flags: flagged, ...(breaksStreak ? { pairingStreak: 0 } : {}) };
  }
  const pairingSessions = t.pairingSessions + 1;
  // засчитанных исходов три: `completed`, `abandoned`, `no_choice` — критерий выполняет только первый
  const ok = session.chosenBy === 'child' && session.endReason === 'completed';
  const pairingStreak = ok ? t.pairingStreak + 1 : 0;
  if (pairingStreak >= PAIRING.sessionsToPass) {
    return { ...t, pairingDone: true, pairingSessions, pairingStreak, pairingRecent, flags: flagged, stage: 1, atStage: [] };
  }
  const flags = pairingSessions >= PAIRING.sessionsBeforeFlag ? withFlag(flagged, 'pairing_not_established') : flagged;
  return { ...t, pairingSessions, pairingStreak, pairingRecent, flags };
}

/**
 * Итог рабочей сессии для ступени доски.
 *
 * - Вверх — `STAGE_WINDOW` подряд сессий на ступени, в каждой не меньше
 *   `EXCHANGES_TO_GROW` обменов и сессия не брошена. Выше финальной по полосе не растёт;
 *   при переходе 5–6 → 7 ступень 3 растёт до 5 по тому же критерию, скачка нет.
 * - Вниз на ступень — `STAGE_WINDOW` подряд сессий с нулём обменов или брошенных. На
 *   ступени 1 отката нет: ноль обменов на доске из одной ячейки — это ноль верных ответов
 *   на стартовом уровне, проблема не в доске; ставится флаг специалисту.
 * - Остановка взрослым в решениях не участвует. Жетоны при смене ступени сохраняются.
 * - Сессия с нулём обменов, в окне которой был обмен рутины, не участвует так же: ни вверх, ни
 *   вниз, серия не рвётся.
 */
export function applyStageSession(t: TokenTrainingState, band: AgeBand, session: StageSession): TokenTrainingState {
  if (!t.pairingDone || session.endReason === 'adult_stopped') return t;
  if (session.routineExchangeInWindow && session.exchanges === 0) return t;
  const atStage = [...t.atStage, session].slice(-STAGE_WINDOW);
  if (atStage.length < STAGE_WINDOW) return { ...t, atStage };

  const i = BOARD_STAGES.indexOf(t.stage);
  const grows = atStage.every((x) => x.exchanges >= EXCHANGES_TO_GROW && x.endReason !== 'abandoned');
  const falls = atStage.every((x) => x.exchanges === 0 || x.endReason === 'abandoned');

  if (grows && t.stage < finalStage(band)) return { ...t, stage: BOARD_STAGES[i + 1], atStage: [] };
  if (falls) {
    if (t.stage === 1) return { ...t, atStage, flags: withFlag(t.flags, 'token_training_stalled') };
    return { ...t, stage: BOARD_STAGES[i - 1], atStage: [] };
  }
  return { ...t, atStage };
}
