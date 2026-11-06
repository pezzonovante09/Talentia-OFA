/**
 * Фазы экрана сессии ABA (`app/aba/session.tsx`) — вынесены из экрана (фаза 8: экран не длиннее, чем был), вместе с
 * чистыми переводами «шаг хвоста → фаза» и «фаза → сцена доступа для `stopSession`».
 */
import { abaBreak, abaExchange, abaParticipation } from '../../../design/abaTokens';
import { BREAK_CARD_WAIT_MS, type BreakCardStep } from '../../../domain/abaBreakCard';
import type { AbaSessionState, AbaStep, TrialStep } from '../../../domain/abaSession';
import type { PanelButton } from '../../../domain/abaScoring';
import { RETURN_INVITE_AFTER_MS } from '../../../types/aba';
import { accessDueAt, startAccess, type AccessRun } from './accessRun';
import { consequenceDueAt, type ConsequenceRun } from './consequenceRun';
import { exchangeDueAt, startExchange, type ExchangeRun } from './exchangeRun';
import { matchDueAt, type MatchTrialRun } from './matchTrialRun';
import { choiceDueAt, type ChoiceRun } from './reinforcerChoiceRun';
import type { TailStep } from './endTail';

export type EndBoard = { cells: number; filled: number } | null;

export const boardOf = (s: AbaSessionState | null): EndBoard => (s ? { cells: s.board.size, filled: s.board.earned } : null);

/** Отрезок сцены доступа для журнала (№171, фаза 8: доступ, разрезанный сворачиванием, — несколько отрезков). */
export type AccessScene = { startedAt: number; endedAt: number };

/**
 * Смена кадра с полной доски на обмен (Ц4, итог проверок, огр. 1): палец на карточке «перерыв» или «Отказ» её
 * откладывает — `frameAt` (после отпускания — ещё `acceptedShowMs` отклика), но не дальше `ceilingAt`. Держит только
 * касание, начатое не раньше показа кадра `since` (плашка — отметка, участие — посадка; как `abaTouchCommits`).
 */
export type FullBoardGate = { since: number; ceilingAt: number; frameAt: number | null };

export type Phase =
  | { kind: 'loading' }
  /** `gestureAt` — с этого момента подпись «жест»; на `independent` без касания и после жеста — пропуск по сроку. */
  | { kind: 'card'; step: BreakCardStep; shownAt: number; gesture: boolean; gestureAt: number | null }
  | { kind: 'choose'; options: string[]; choice: ChoiceRun }
  | { kind: 'pause'; step: TrialStep; until: number }
  | { kind: 'trial'; run: MatchTrialRun; pressed: PanelButton | null }
  /**
   * `stripEarned` — сколько жетонов показывать в полосе (без жетона за участие — он отдельным событием; при обмене сразу —
   * полная доска до экрана обмена). `participation` — жетон за участие ждёт своего события после последствия.
   */
  | {
      kind: 'consequence';
      run: ConsequenceRun;
      overlay: boolean;
      earnedBefore: number;
      landed: boolean;
      empty: boolean;
      field: TrialStep;
      stripEarned: number;
      participation: boolean;
      chosenId: string | null;
      /** Карточку «перерыв» коснулись: статичный контур 6 до начала перерыва — касание принято. */
      breakAsked: boolean;
      /** Жетон пробы заполнил доску (№172): после посадки — смена кадра на обмен, без межпробной паузы. */
      gate: FullBoardGate | null;
    }
  /**
   * Жетон за участие (ABA.md: отдельным событием): короткое падение в ячейку полосы со звуком, затем шаг домена.
   * `gate` — он заполнил доску: через `afterLandingMs` смена кадра на обмен (Ц4.1).
   */
  | {
      kind: 'participation';
      landAt: number;
      /** Посадка прошла (звук `token` дан): не пропускается, если кадр запоздал. */
      landed: boolean;
      until: number;
      earned: number;
      field: TrialStep | null;
      then: AbaStep | null;
      breakAsked: boolean;
      gate: FullBoardGate | null;
    }
  /**
   * `invite` — сколько приглашений вернуться показано (0 — идёт кольцо); `training` — обучающий перерыв по карточке:
   * после второго приглашения сессия не кончается (№169). `startedAt` — начало перерыва для доли кольца; `shownAt` —
   * показ кадра (правило касания и срок бездействия): после возврата из фона они расходятся (фаза 8).
   */
  | {
      kind: 'break';
      step: Extract<AbaStep, { kind: 'break' }>;
      startedAt: number;
      shownAt: number;
      until: number;
      tick?: number;
      invite: 0 | 1 | 2;
      inviteAt: number | null;
      training: boolean;
    }
  /**
   * Обмен без кнопки (`exchangeRun`): `pairing` — жетон цикла сопряжения в конце (Tali и одна ячейка); дальше — доступ
   * шага домена или хвост конца. `tick` — время последнего кадра.
   */
  | { kind: 'exchange'; run: ExchangeRun; tick: number; pairing: boolean; next: Extract<AbaStep, { kind: 'access' }> | 'tail'; trace: boolean }
  /**
   * `sceneEndedAt` — T: время сцены для журнала (№171) — от начала текущего отрезка до T. `trace` (и у обмена) — просьбу о
   * перерыве приняли на плашке или жетоне за участие: карточка-след в строке 72 до экрана перерыва (`abaBreakTrace`).
   * Фаза 8: `scenes` — отрезки сцены, уже выданные до сворачивания; `sceneFrom` — начало текущего отрезка (`null` —
   * сцены больше нет, только кадр конца после возврата позже T).
   */
  | { kind: 'access'; run: AccessRun; tick: number; tail: boolean; sceneEndedAt: number | null; trace: boolean; scenes: AccessScene[]; sceneFrom: number | null }
  /** Ожидание цикла сопряжения в конце (Ц3.2): раскладка сопряжения без карточки. */
  | { kind: 'end_wait'; until: number }
  /** Запись идёт: прежний кадр стоит, касания не принимаются. */
  | { kind: 'busy' }
  /** Приложение свёрнуто (фаза 8): пустой фон, на возврате кадр строится заново из снимка — прежний кадр не мигает. */
  | { kind: 'away' }
  /** «Закончили» — один раз, в самом конце. */
  | { kind: 'ended'; variant: 'normal' | 'neutral'; board: EndBoard };

/** Ближайший срок фазы: `useDue` будит экран в этот момент; `null` — фаза ждёт только касания или записи. */
export function phaseDueAt(phase: Phase): number | null {
  switch (phase.kind) {
    case 'card':
      // `independent`: 10 с без жеста, потом жест; после жеста ещё 10 с без касания — возможность пропущена
      if (phase.step !== 'independent') return null;
      return phase.gesture ? phase.gestureAt! + BREAK_CARD_WAIT_MS : phase.shownAt + BREAK_CARD_WAIT_MS;
    case 'choose':
      return choiceDueAt(phase.choice);
    case 'pause':
      return phase.until;
    case 'trial':
      return matchDueAt(phase.run);
    case 'consequence':
      return phase.gate?.frameAt ?? consequenceDueAt(phase.run);
    case 'participation':
      return !phase.landed ? phase.landAt : (phase.gate?.frameAt ?? phase.until);
    case 'break':
      // кольцо — шагами по 1 с (`abaBreak.timerCalmStepMs`), у паузы после «Отказ» — один срок
      if (phase.step.offerCardMs) {
        const cardEnd = phase.startedAt + phase.step.offerCardMs;
        return (phase.tick ?? phase.shownAt) < cardEnd ? cardEnd : phase.until;
      }
      if (phase.invite === 0) return Math.min((phase.tick ?? phase.shownAt) + abaBreak.timerCalmStepMs, phase.until);
      // после второго приглашения обучающий перерыв ждёт взрослого: конца по бездействию нет
      if (phase.invite === 2 && phase.training) return null;
      return phase.inviteAt! + RETURN_INVITE_AFTER_MS;
    case 'exchange':
      return exchangeDueAt(phase.run, phase.tick);
    case 'access': {
      const due = accessDueAt(phase.run);
      return phase.run.stage === 'play' && due !== null ? Math.min(phase.tick + abaBreak.timerCalmStepMs, due) : due;
    }
    case 'end_wait':
      return phase.until;
    default:
      return null;
  }
}

/**
 * Жетон за участие: падает в ячейку полосы за `drop.ms`, полоса стоит `holdMs`. Заполнил доску (`fills`: обмен прошёл
 * сразу) — до экрана обмена доска видна полной, а смена кадра на обмен — через `afterLandingMs` после посадки (Ц4.1).
 */
export function participationPhase(o: { now: number; field: TrialStep | null; then: AbaStep | null; board: { size: number; earned: number }; fills: boolean; breakAsked?: boolean }): Phase {
  const landAt = o.now + abaParticipation.drop.ms;
  const f = abaExchange.fromFullBoard;
  return {
    kind: 'participation',
    landAt,
    landed: false,
    until: landAt + (o.fills ? f.afterLandingMs : abaParticipation.holdMs),
    earned: o.fills ? o.board.size : o.board.earned,
    field: o.field,
    then: o.then,
    breakAsked: o.breakAsked ?? false,
    gate: o.fills ? { since: landAt, ceilingAt: landAt + f.ceilingMs, frameAt: null } : null,
  };
}

/** Срок, до которого смена кадра с полной доски ждёт касание; `null` — менять сейчас. */
export function gateWait(gate: FullBoardGate, at: number, held: { at: number } | null, releasedAt: number): number | null {
  if (held && held.at >= gate.since) return gate.ceilingAt;
  const shown = releasedAt + abaExchange.fromFullBoard.heldTouch.acceptedShowMs;
  return shown > at ? Math.min(shown, gate.ceilingAt) : null;
}

/** Новое касание, пока кадр уже ждёт, — ждём до потолка (и засчитываем только там), а не до конца прежнего отклика. */
export function gateOnHold(p: Phase, now: number): Phase {
  return (p.kind === 'consequence' || p.kind === 'participation') && p.gate?.frameAt != null && now >= p.gate.since
    ? ({ ...p, gate: { ...p.gate, frameAt: p.gate.ceilingAt } } as Phase)
    : p;
}

/** Палец сняли (или цель ушла с экрана): ждущая смена кадра — после отклика «принято», не дальше потолка. */
export function gateOnRelease(p: Phase, now: number): Phase {
  const shown = now + abaExchange.fromFullBoard.heldTouch.acceptedShowMs;
  return (p.kind === 'consequence' || p.kind === 'participation') && p.gate?.frameAt != null
    ? ({ ...p, gate: { ...p.gate, frameAt: Math.min(shown, p.gate.ceilingAt) } } as Phase)
    : p;
}

/** Шаг хвоста, на котором свернули: по текущей фазе (обмен и доступ хвоста, ожидание, жетон цикла). */
export function tailStepOf(p: Phase): TailStep['kind'] {
  if (p.kind === 'exchange') return p.pairing ? 'pairing_token' : 'exchange';
  if (p.kind === 'access') return 'access';
  if (p.kind === 'end_wait') return 'wait';
  return 'end';
}

/** Шаг хвоста конца — в фазу экрана (обмен, доступ, ожидание цикла, жетон сопряжения, «Закончили»). */
export function tailPhase(step: TailStep, now: number, still: boolean, end: { variant: 'normal' | 'neutral'; board: EndBoard }): Phase {
  switch (step.kind) {
    case 'exchange':
      return { kind: 'exchange', run: startExchange({ at: now, cells: step.boardSize, calm: still }), tick: now, pairing: false, next: 'tail', trace: false };
    case 'access':
      return { kind: 'access', run: startAccess(now, step.durationMs, 0, still), tick: now, tail: true, sceneEndedAt: null, trace: false, scenes: [], sceneFrom: now };
    case 'wait':
      return { kind: 'end_wait', until: now + step.ms };
    case 'pairing_token':
      // карточка появляется вместе с жетоном (№171); кадр «до жетона» — на миг раньше, чтобы звук `token` шёл при посадке
      return { kind: 'exchange', run: startExchange({ at: now, cells: 1, calm: still, landFirst: true }), tick: now - 1, pairing: true, next: 'tail', trace: false };
    case 'end':
      return { kind: 'ended', variant: end.variant, board: end.board };
  }
}

/**
 * Сцена доступа для `stopSession` при выходе удержанием (№171): на экране обмена сцена ещё не началась — доступа нет
 * (`null`); в доступе — отрезки, выданные до сворачивания, и текущий до остановки (или до T); иначе — весь шаг
 * (`undefined`).
 */
export function accessSceneOnStop(phase: Phase): { startedAt: number; endedAt?: number }[] | null | undefined {
  if (phase.kind === 'exchange' && phase.next !== 'tail') return null;
  if (phase.kind === 'participation' && phase.then?.kind === 'access') return null;
  if (phase.kind === 'access' && !phase.tail) {
    return phase.sceneFrom === null ? phase.scenes : [...phase.scenes, { startedAt: phase.sceneFrom, endedAt: phase.sceneEndedAt ?? undefined }];
  }
  return undefined;
}

/** Все отрезки сцены доступа к концу шага: выданные до сворачивания и текущий (от `sceneFrom` до T). */
export function accessScenesAtEnd(phase: Extract<Phase, { kind: 'access' }>, endedAt: number): AccessScene[] {
  return phase.sceneFrom === null ? phase.scenes : [...phase.scenes, { startedAt: phase.sceneFrom, endedAt: phase.sceneEndedAt ?? endedAt }];
}
