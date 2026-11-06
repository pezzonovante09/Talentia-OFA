/**
 * Рабочая сессия ABA (этап 11, фаза 6; спецификация `docs/design/aba-screens-spec-2026-10-25.md` п. 1–8, направление
 * разделы 4–7 и цикл 2). Домен (`abaSession.ts`) решает, что дальше, — экран только рисует шаг `nextStep` и пишет:
 *
 * - старт: `loadAbaStart` → `startAbaSession`; со взрослым — обучение карточке «перерыв» до первой пробы
 *   (`loadBreakCardPlan`, `recordBreakCardTraining`: модель → жест → 10 с, потом жест);
 * - 2.3 выбор подкрепителя тапом (`reinforcerChoiceRun`, одно правило с сопряжением) → `chooseReinforcer` и запись выбора;
 * - проба `match` (`model/matchTrialRun.ts`) с панелью взрослого; запись **до** последствия (`recordTrial` →
 *   `recordAbaTrial`), плашка — только при `token_praise` или жетоне за участие (`model/consequenceRun.ts`);
 *   карточка «перерыв» в фазе последствия — сразу в домен (`requestBreakBetweenTrials`, №160);
 * - перерыв (фаза 7, №169; вид — Ц3.1, Ц3.9): кольцо → приглашение (контур 6 у «Вернуться») → через
 *   `RETURN_INVITE_AFTER_MS` второе (планки 120 становятся контурными) → ещё столько же без возврата —
 *   `withdrawAssent(…, 'device_inactivity')`; обучающий перерыв по карточке сессию не кончает — со второго
 *   приглашения подпись взрослому, возврат делает взрослый;
 * - обмен (сразу, на перерыве, в конце, жетон цикла сопряжения) — один экран без кнопки (`model/exchangeRun.ts`,
 *   Ц3.4): доска полная → жетоны летят в карточку → «получено» → карточка раскрывается в сцену; доступ
 *   (`model/accessRun.ts`, Ц3.5): кольцо исчезает в T, сцена сворачивается в карточку, через 1 с дальше; в журнал —
 *   время самой сцены (№171);
 * - конец: итог пишется сразу, затем хвост (`model/endTail.ts`) — обмен и доступ или цикл сопряжения (ожидание в
 *   раскладке сопряжения без карточки, Ц3.2), потом один раз «Закончили» с доской; выход удержанием — `stopSession`.
 *
 * Сворачивание и возобновление — фаза 8: пока свёрнутая проба просто теряется вместе с экраном. Ошибки записи
 * (согласие, пауза, конфликт доски) — спокойный конец; ни ошибки, ни имена ABA-экранов наружу не уходят.
 */
import { useKeepAwake } from 'expo-keep-awake';
import { Redirect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  abaBreak,
  abaBreakTrace,
  abaChoiceZone,
  abaExchange,
  abaLayoutByTier,
  abaNonTrialRow,
  abaParticipation,
  abaReinforcerCardSize,
  abaReinforcementOverlay,
  abaTierFor,
  abaTokenLandingMs,
  inactiveChoice,
  ABA_CONTROL_STROKE,
  type AbaTier,
} from '../../src/design/abaTokens';
import { radii } from '../../src/design/tokens';
import { BREAK_CARD_WAIT_MS, type BreakCardStep } from '../../src/domain/abaBreakCard';
import { adultPanelButtons, type PanelButton } from '../../src/domain/abaScoring';
import {
  chooseReinforcer,
  finishAbaSession,
  finishAccess,
  finishBreak,
  nextStep,
  recordBreakCardTraining,
  recordTrial,
  requestBreakBetweenTrials,
  startAbaSession,
  stopSession,
  takeBreakCard,
  withdrawAssent,
  type AbaSessionState,
  type AbaStep,
  type TrialStep,
} from '../../src/domain/abaSession';
import { newAbaId } from '../../src/services/abaIds';
import { loadAbaStart, loadFinishInputs } from '../../src/services/local/abaStart';
import { commitAbaSession, loadBreakCardPlan, recordAbaTrial, saveAbaSessionStep } from '../../src/services/local/commit';
import { voice } from '../../src/services/voice';
import { useAbaRun } from '../../src/state/abaRun';
import { useAccount } from '../../src/state/account';
import { useChildSession } from '../../src/state/childSession';
import { CHILD_BREAK_MS, RETURN_INVITE_AFTER_MS, type AbaTarget } from '../../src/types/aba';
import { AbaEnd } from '../../src/ui/aba/AbaEnd';
import { useAbaClock, useDue } from '../../src/ui/aba/clock';
import { accessDueAt, startAccess, stepAccess, type AccessRun } from '../../src/ui/aba/model/accessRun';
import { advanceConsequence, consequenceDueAt, startConsequence, type ConsequenceRun } from '../../src/ui/aba/model/consequenceRun';
import { matchDueAt, matchTrialInput, matchVisual, optionActive, startMatchTrial, stepMatchTrial, type MatchEvent, type MatchTrialRun } from '../../src/ui/aba/model/matchTrialRun';
import { endTail, type TailStep } from '../../src/ui/aba/model/endTail';
import { exchangeDueAt, exchangeEndsAt, exchangeView, startExchange, type ExchangeRun } from '../../src/ui/aba/model/exchangeRun';
import { choiceDueAt, startChoice, stepChoice, type ChoiceRun } from '../../src/ui/aba/model/reinforcerChoiceRun';
import { ChildPressable, ExitHold, NonTrialRow, PlaceholderGlyph, useAbaColors, useReduceMotion } from '../../src/ui/aba/parts';
import { AccessRing, ReinforcerChoiceView } from '../../src/ui/aba/reinforcer';
import { AccessView } from '../../src/ui/aba/session/AccessView';
import { ExchangeView, PairingWaitView } from '../../src/ui/aba/session/ExchangeView';
import { AdultPanel, BreakTrace, MatchField, ReinforcementOverlay, TokenStrip, TopBar } from '../../src/ui/aba/session/parts';

const ZONE: Record<AbaTier, (typeof abaChoiceZone)[keyof typeof abaChoiceZone]> = {
  roomy: abaChoiceZone.regular,
  compact: abaChoiceZone.compact,
  tight: abaChoiceZone.tight,
};
const CARD_STEPS: BreakCardStep[] = ['model', 'prompted', 'independent'];

type EndBoard = { cells: number; filled: number } | null;

/**
 * Смена кадра с полной доски на обмен (Ц4, итог проверок, огр. 1): палец на карточке «перерыв» или «Отказ» её
 * откладывает — `frameAt` (после отпускания — ещё `acceptedShowMs` отклика), но не дальше `ceilingAt`. Держит только
 * касание, начатое не раньше показа кадра `since` (плашка — отметка, участие — посадка; как `abaTouchCommits`).
 */
type FullBoardGate = { since: number; ceilingAt: number; frameAt: number | null };

type Phase =
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
   * после второго приглашения сессия не кончается (№169).
   */
  | {
      kind: 'break';
      step: Extract<AbaStep, { kind: 'break' }>;
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
   * `sceneEndedAt` — T: время сцены для журнала (№171) — от `run.startedAt` до T. `trace` (и у обмена) — просьбу о
   * перерыве приняли на плашке или жетоне за участие: карточка-след в строке 72 до экрана перерыва (`abaBreakTrace`).
   */
  | { kind: 'access'; run: AccessRun; tick: number; tail: boolean; sceneEndedAt: number | null; trace: boolean }
  /** Ожидание цикла сопряжения в конце (Ц3.2): раскладка сопряжения без карточки. */
  | { kind: 'end_wait'; until: number }
  | { kind: 'busy' }
  /** «Закончили» — один раз, в самом конце. */
  | { kind: 'ended'; variant: 'normal' | 'neutral'; board: EndBoard };

export default function AbaSessionScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useAbaColors();
  const insets = useSafeAreaInsets();
  const clock = useAbaClock();
  const db = useAccount((s) => s.db);
  const childId = useChildSession((s) => s.childId);
  const settings = useChildSession((s) => s.settings);
  const config = useAbaRun((s) => s.config);
  const observers = useAbaRun((s) => s.observers);
  const primaryObserverId = useAbaRun((s) => s.primaryObserverId);
  useKeepAwake();

  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [height, setHeight] = useState<number | null>(null);
  const [width, setWidth] = useState(375);
  const st = useRef<AbaSessionState | null>(null);
  const cardLeft = useRef(0);
  const cardIdx = useRef(0);
  const coaching = useRef(false);
  const lastBody = useRef<ReactNode>(null);
  const lastPhaseKind = useRef<Phase['kind']>('loading');
  /** Последний показанный кадр: в `busy` он стоит на экране — след просьбы берётся с него. */
  const lastPhase = useRef<Phase>({ kind: 'loading' });
  const finished = useRef(false);
  const exiting = useRef(false);
  /** Обмен прошёл (сразу, на перерыве): следующий доступ начинается с экрана обмена, а до него доска видна полной. */
  const exchangePending = useRef(false);
  /** Запись просьбы, сделанной вне хода шага (карточка «перерыв» на последствии и участии): следующий шаг её ждёт. */
  const writing = useRef<Promise<void> | null>(null);
  /** Просьба «перерыв» уже в домене: заранее взятый шаг участия (`then`) устарел — следующий берётся заново. */
  const breakQueued = useRef(false);
  /** Обмен идёт сменой кадра с полной доски (Ц4): доска переехала — удержание `fromFullBoard.holdMs` (№173). */
  const fromFullBoard = useRef(false);
  /** Просьбу о перерыве приняли на плашке или жетоне за участие: на обмене и доступе — карточка-след (огр. 3). */
  const breakTrace = useRef(false);
  /** Палец, который сейчас лежит на карточке «перерыв» или «Отказ», и момент последнего отпускания (огр. 1). */
  const held = useRef<{ what: 'break_card' | 'adult_refusal'; at: number } | null>(null);
  const releasedAt = useRef(-Infinity);
  const tail = useRef<TailStep[]>([]);
  const endView = useRef<{ variant: 'normal' | 'neutral'; board: EndBoard }>({ variant: 'neutral', board: null });
  // старт один раз: настройки и наблюдатели берутся на момент старта
  const startOpts = useRef({ settings, observers, primaryObserverId });
  const calm = startOpts.current.settings.calmMode;
  // calm и системное «уменьшить движение» — смены кадра вместо движения, и сроки обмена и конца доступа те же, что в calm
  const reduceMotion = useReduceMotion();
  const still = calm || reduceMotion;

  const iso = useCallback(() => new Date(clock.now()).toISOString(), [clock]);
  const boardOf = (s: AbaSessionState | null): EndBoard => (s ? { cells: s.board.size, filled: s.board.earned } : null);
  const fail = useCallback((e: unknown) => {
    if (__DEV__) console.warn('aba-session', e);
    // доска и при ошибке видна как есть (Ц2.10): жетоны не пропадают
    setPhase({ kind: 'ended', variant: 'neutral', board: boardOf(st.current) });
  }, []);

  /** Следующий шаг хвоста конца: обмен, доступ, ожидание цикла, жетон сопряжения, «Закончили». */
  const nextTail = useCallback(
    (now: number) => {
      const step = tail.current.shift() ?? { kind: 'end' as const };
      const { variant, board } = endView.current;
      switch (step.kind) {
        case 'exchange':
          setPhase({ kind: 'exchange', run: startExchange({ at: now, cells: step.boardSize, calm: still }), tick: now, pairing: false, next: 'tail', trace: false });
          return;
        case 'access':
          setPhase({ kind: 'access', run: startAccess(now, step.durationMs, 0, still), tick: now, tail: true, sceneEndedAt: null, trace: false });
          return;
        case 'wait':
          setPhase({ kind: 'end_wait', until: now + step.ms });
          return;
        case 'pairing_token':
          // карточка появляется вместе с жетоном (№171); кадр «до жетона» — на миг раньше, чтобы звук `token` шёл при посадке
          setPhase({ kind: 'exchange', run: startExchange({ at: now, cells: 1, calm: still, landFirst: true }), tick: now - 1, pairing: true, next: 'tail', trace: false });
          return;
        case 'end':
          setPhase({ kind: 'ended', variant, board });
      }
    },
    [still],
  );

  /**
   * Конец: итог сессии одной транзакцией (повтор не пишет второй раз), затем хвост `endTail` — обмен и доступ или цикл
   * сопряжения. Итог — до доступа: свёрнутое во время доступа приложение не теряет итог по целям.
   */
  const finish = useCallback(
    async (s: AbaSessionState, variant: 'normal' | 'neutral') => {
      if (finished.current) return;
      finished.current = true;
      setPhase({ kind: 'busy' });
      // просьба вне хода шага ещё пишется — снимок «в работе» не должен лечь после итога
      if (writing.current) await writing.current;
      let steps: TailStep[] = [{ kind: 'end' }];
      let board = boardOf(s);
      try {
        if (db && childId) {
          const now = clock.now();
          const inputs = await loadFinishInputs(db, childId, s);
          const result = finishAbaSession(s, now, inputs.pastSessions, undefined, inputs.signalHistory, inputs.extra);
          await commitAbaSession(db, childId, result, new Date(now).toISOString());
          steps = endTail({ exchanged: result.exchanged, boardSize: result.session.boardSize, events: result.session.events });
          board = { cells: result.board.size, filled: result.board.earned };
        }
      } catch (e) {
        if (__DEV__) console.warn('aba-session-commit', e);
        variant = 'neutral';
        steps = [{ kind: 'end' }];
      }
      useAbaRun.getState().reset();
      if (exiting.current) {
        router.dismissTo('/map');
        return;
      }
      tail.current = steps;
      endView.current = { variant, board };
      nextTail(clock.now());
    },
    [db, childId, clock, router, nextTail],
  );

  /** Сохранить снимок сессии в работе (после выкладки поля, выбора, перерыва, доступа). */
  const save = useCallback(
    async (s: AbaSessionState, choice?: Parameters<typeof saveAbaSessionStep>[4]) => {
      if (!db || !childId) return s;
      return saveAbaSessionStep(db, childId, s, iso(), choice);
    },
    [db, childId, iso],
  );

  /** Следующий шаг домена — в фазу экрана. */
  async function advance() {
    // просьба вне хода шага ещё пишется: шаг берётся после записи, иначе следующая запись разойдётся с версией доски;
    // кадр на это время замирает — «Отказ» в этом окне дал бы второй шаг и обмен без экрана обмена
    if (writing.current) {
      setPhase({ kind: 'busy' });
      await writing.current;
    }
    const cur = st.current;
    if (!cur || finished.current) return;
    const now = clock.now();
    const next = nextStep(cur, now);
    st.current = next.state;
    breakQueued.current = false;
    // жетон за участие заполнил доску и обмен прошёл сразу: до экрана обмена доска видна полной, а не пустой
    if (next.state.exchangesMade > cur.exchangesMade) exchangePending.current = true;
    // жетон за участие от закрытия блока (`nextStep`) — своим событием до шага
    if (next.participation) {
      setPhase(participationPhase(now, null, next.step));
      return;
    }
    await show(next.step, now);
  }

  /**
   * Жетон за участие: падает в ячейку полосы за `drop.ms`, полоса стоит `holdMs`. Заполнил доску (обмен прошёл сразу) —
   * до экрана обмена доска видна полной, а смена кадра на обмен — через `afterLandingMs` после посадки (Ц4.1).
   */
  function participationPhase(now: number, field: TrialStep | null, then: AbaStep | null): Phase {
    const fills = exchangePending.current;
    const board = st.current!.board;
    const landAt = now + abaParticipation.drop.ms;
    const f = abaExchange.fromFullBoard;
    return {
      kind: 'participation',
      landAt,
      landed: false,
      until: landAt + (fills ? f.afterLandingMs : abaParticipation.holdMs),
      earned: fills ? board.size : board.earned,
      field,
      then,
      breakAsked: false,
      gate: fills ? { since: landAt, ceilingAt: landAt + f.ceilingMs, frameAt: null } : null,
    };
  }
  // старт зовёт шаг через ссылку: функция пересоздаётся на каждом рендере
  const advanceRef = useRef(advance);
  advanceRef.current = advance;

  async function show(step: AbaStep, now: number) {
    const cur = st.current!;
    // след просьбы и удержание пути Ц4 относятся только к ближайшему шагу
    const trace = breakTrace.current;
    const fullBoard = fromFullBoard.current;
    breakTrace.current = false;
    fromFullBoard.current = false;
    // обучение карточке — до начала работы (до выбора подкрепителя), пока остались возможности
    if (step.kind === 'choose_reinforcer' && cardLeft.current > 0 && cur.workStartedAt === null) {
      const cardStep = CARD_STEPS[Math.min(cardIdx.current, CARD_STEPS.length - 1)];
      setPhase({ kind: 'card', step: cardStep, shownAt: now, gesture: cardStep === 'prompted', gestureAt: cardStep === 'prompted' ? now : null });
      return;
    }
    switch (step.kind) {
      case 'choose_reinforcer':
        setPhase({ kind: 'choose', options: step.options, choice: startChoice(cur.config, now) });
        return;
      case 'trial': {
        st.current = await save(cur);
        if (step.pauseBeforeMs > 0) setPhase({ kind: 'pause', step, until: now + step.pauseBeforeMs });
        else beginTrial(step, now);
        return;
      }
      case 'break': {
        const head = cur.queue[0];
        const training = head?.kind === 'break' && head.training === true;
        // пауза после «Отказ»: карточка подсвечена `offerCardMs`, а сама тихая пауза — `maxMs` (`REFUSAL_QUIET_MS`, 30 с
        // от снятия требования, ABA.md блок 4 п. 1)
        setPhase({ kind: 'break', step, shownAt: now, until: now + (step.maxMs ?? CHILD_BREAK_MS[cur.band]), invite: 0, inviteAt: null, training });
        return;
      }
      case 'access':
        if (exchangePending.current) {
          exchangePending.current = false;
          const holdMs = fullBoard ? abaExchange.fromFullBoard.holdMs : undefined;
          setPhase({ kind: 'exchange', run: startExchange({ at: now, cells: cur.board.size, calm: still, holdMs }), tick: now, pairing: false, next: step, trace });
        } else setPhase({ kind: 'access', run: startAccess(now, step.durationMs, 0, still), tick: now, tail: false, sceneEndedAt: null, trace });
        return;
      case 'end':
        await finish(cur, step.endedOnSuccess ? 'normal' : 'neutral');
        return;
      case 'adult_finish_chain':
        // цепочек в этапе 11 нет: неизвестный шаг — спокойный конец
        await finish(stopSession(cur, 'adult_stopped', now), 'neutral');
        return;
    }
  }

  const run = (p: Promise<void>) => void p.catch(fail);

  function beginTrial(step: TrialStep, now: number) {
    const s = st.current!;
    const target = s.targets[step.targetId] as AbaTarget;
    setPhase({
      kind: 'trial',
      pressed: null,
      run: startMatchTrial({ step, target, config: s.config, seed: s.seed, trialId: newAbaId(), sessionId: s.sessionId, index: s.trials.length, shownAt: now }),
    });
  }

  // старт
  const started = useRef(false);
  useEffect(() => {
    if (!db || !childId || !config || started.current) return;
    started.current = true;
    let live = true;
    const o = startOpts.current;
    const now = clock.now();
    void (async () => {
      const start = await loadAbaStart(db, childId, { config, band: o.settings.band, soundOn: o.settings.soundEffects, observers: o.observers, primaryObserverId: o.primaryObserverId, now });
      if (!live) return;
      if (start.kind === 'blocked') {
        setPhase({ kind: 'ended', variant: 'neutral', board: null });
        return;
      }
      st.current = startAbaSession(start.input);
      // в плане нет ни одной пробы («Сам» без разблокированного формата): сессию не начинаем и не пишем —
      // «нормальный» конец ни за что и пустая сессия в данных (`aba-pedagogy-specialist` 2026-10-31)
      if (!st.current.queue.some((q) => q.kind === 'trial')) {
        setPhase({ kind: 'ended', variant: 'neutral', board: null });
        return;
      }
      if (config === 'with_adult') {
        const plan = await loadBreakCardPlan(db, childId, { config, day: start.input.day, observerId: o.primaryObserverId });
        cardLeft.current = plan.opportunities;
        cardIdx.current = CARD_STEPS.indexOf(plan.startStep);
        coaching.current = plan.adultCoaching;
      }
      if (live) await advanceRef.current();
    })().catch((e: unknown) => live && fail(e));
    return () => {
      live = false;
    };
  }, [db, childId, config, clock, fail]);

  // системный «назад» (жест от края, ладонь у кромки) не выходит мимо удержания выхода
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  // --- сроки фаз
  const dueAt = (() => {
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
          const cardEnd = phase.shownAt + phase.step.offerCardMs;
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
  })();

  useDue(dueAt, (at) => {
    const p = phase;
    switch (p.kind) {
      case 'card':
        if (p.gesture) cardOpportunity(false);
        else setPhase({ ...p, gesture: true, gestureAt: at });
        return;
      case 'participation': {
        const next = () => run(p.then && !breakQueued.current ? show(p.then, at) : advance());
        if (!p.landed) {
          // жетон сел в полосе — со звуком `token`, как каждый жетон (ABA.md «Подкрепление», Ц2.1); похвалы нет
          voice.say('abaSession.sound.token');
          setPhase({ ...p, landed: true });
        } else if (p.gate?.frameAt != null) {
          // смена кадра ждала касание: отклик показан или потолок
          if (!commitHeld(p.gate, at)) toFullBoardExchange(next);
        } else if (p.gate) {
          const wait = gateWait(p.gate, at);
          if (wait !== null) setPhase({ ...p, gate: { ...p.gate, frameAt: wait } });
          else toFullBoardExchange(next);
        } else next();
        return;
      }
      case 'choose':
        onChoice({ type: 'due', at });
        return;
      case 'pause':
        beginTrial(p.step, at);
        return;
      case 'trial':
        onTrial({ type: 'due', at });
        return;
      case 'consequence': {
        if (p.gate?.frameAt != null) {
          // смена кадра ждала касание: отклик показан или потолок
          if (!commitHeld(p.gate, at)) toFullBoardExchange(() => run(advance()));
          return;
        }
        const { run: next, effects } = advanceConsequence(p.run, at);
        let np: Phase = { ...p, run: next };
        for (const fx of effects) {
          if (fx.kind === 'overlay_show') np = { ...np, overlay: true } as Phase;
          else if (fx.kind === 'token_land') {
            // звук жетона при посадке (№158, `token_on_landing`); файл подключит озвучка, ключ — уже здесь
            voice.say('abaSession.sound.token');
            np = { ...np, landed: true } as Phase;
          } else if (fx.kind === 'say') {
            // похвала — только голосом (№158): без плашки подсказанный ответ не получает условного подкрепителя
            voice.say(fx.key === 'praise' ? 'abaSession.sound.praise' : 'abaSession.sound.listened');
          } else if (fx.kind === 'overlay_hide') np = { ...np, overlay: false } as Phase;
          else if (fx.kind === 'plates_empty') np = { ...np, empty: true } as Phase;
          else if (fx.kind === 'next_sd') {
            if (p.participation) {
              // жетон за участие — после последствия пробы, своим событием; затем следующий шаг домена (при обмене
              // сразу доска до экрана обмена видна полной)
              setPhase({ ...participationPhase(at, p.field, null), breakAsked: p.breakAsked } as Phase);
              return;
            }
            run(advance());
            return;
          } else if (fx.kind === 'exchange') {
            // жетон пробы заполнил доску (№172): через 700 мс после посадки — смена кадра на обмен
            const wait = p.gate ? gateWait(p.gate, at) : null;
            if (wait !== null) setPhase({ ...np, gate: { ...p.gate!, frameAt: wait } } as Phase);
            else toFullBoardExchange(() => run(advance()));
            return;
          }
        }
        setPhase(np);
        return;
      }
      case 'break': {
        // пауза после «Отказ» без касания карточки — дальше по домену
        if (p.step.offerCardMs) {
          // подсветка карточки кончилась — тихая пауза до `maxMs`, затем дальше по домену
          if (at < p.until) setPhase({ ...p, tick: at });
          else run(endBreak(at));
        }
        else if (p.invite === 0 && at < p.until) setPhase({ ...p, tick: at });
        else if (p.invite === 0) {
          // кольцо кончилось — первое приглашение: статичный контур 6 у «Вернуться» и один тихий сигнал
          voice.say('abaSession.sound.invite');
          setPhase({ ...p, invite: 1, inviteAt: at });
        } else if (p.invite === 1) {
          // второе приглашение — новое устойчивое состояние (Ц3.1): планки 120 контурные, контур 6 у кнопки стоит
          voice.say('abaSession.sound.invite');
          setPhase({ ...p, invite: 2, inviteAt: at });
        } else run(noReturn(at));
        return;
      }
      case 'exchange': {
        // жетон цикла сопряжения сел в ячейку — звук `token` (Ц3.3: похвалы голосом в цикле нет)
        if (p.pairing && !exchangeView(p.run, p.tick).tokenInCell && exchangeView(p.run, at).tokenInCell) voice.say('abaSession.sound.token');
        if (exchangeView(p.run, at).stage !== 'done') {
          setPhase({ ...p, tick: at });
          return;
        }
        // доступ открывается в конце раскрытия — его время считается отсюда
        const opened = exchangeEndsAt(p.run);
        if (p.next === 'tail') nextTail(opened);
        else setPhase({ kind: 'access', run: startAccess(opened, p.next.durationMs, 0, still), tick: opened, tail: false, sceneEndedAt: null, trace: p.trace });
        return;
      }
      case 'access': {
        const { run: next, effects } = stepAccess(p.run, at);
        let sceneEndedAt = p.sceneEndedAt;
        for (const fx of effects) {
          // «закругляемся» (`abaAccessScene.endCue`): файл подключит озвучка; без звука конец несёт кадр конца (Ц3.5)
          if (fx.type === 'cue') voice.say('abaSession.sound.wrapUp');
          else if (fx.type === 'scene_ended') sceneEndedAt = fx.at;
          else if (fx.type === 'done') {
            if (p.tail) nextTail(fx.at);
            else run(endAccess(fx.at, { startedAt: p.run.startedAt, endedAt: sceneEndedAt ?? fx.at }));
            return;
          }
        }
        setPhase({ ...p, run: next, tick: at, sceneEndedAt });
        return;
      }
      case 'end_wait':
        nextTail(at);
        return;
    }
  });

  // --- обучение карточке «перерыв»
  const cardOpportunity = (touched: boolean) =>
    run(
      (async () => {
        const p = phase;
        if (p.kind !== 'card' || !st.current) return;
        const now = clock.now();
        const gestureGiven = p.step !== 'model' && p.gesture;
        st.current = recordBreakCardTraining(st.current, { step: p.step, touched, gestureGiven, latencyMs: touched ? now - p.shownAt : null }, now);
        // самостоятельное касание — карточка принята на сегодня: остальные возможности не нужны
        cardLeft.current = touched && !gestureGiven && p.step === 'independent' ? 0 : cardLeft.current - 1;
        cardIdx.current += 1;
        st.current = await save(st.current);
        await advance();
      })(),
    );

  // --- выбор подкрепителя
  function onChoice(e: Parameters<typeof stepChoice>[1]) {
    const p = phase;
    if (p.kind !== 'choose') return;
    const { run: next, effects } = stepChoice(p.choice, e);
    setPhase({ ...p, choice: next });
    for (const fx of effects) {
      if (fx.type === 'chosen') {
        run(
          (async () => {
            setPhase({ kind: 'busy' });
            const s = chooseReinforcer(st.current!, fx.reinforcerId, fx.at, fx.by);
            // повторный выбор при полной доске сам меняет жетоны (`settleBoard`): доступ — тоже через экран обмена (Ц3.4)
            if (s.exchangesMade > st.current!.exchangesMade) exchangePending.current = true;
            st.current = await save(s, { source: 'session', sourceId: s.sessionId, reinforcerId: fx.reinforcerId, chosenBy: fx.by });
            await advance();
          })(),
        );
      } else if (fx.type === 'no_choice') {
        // «Сам», 60 с без выбора — сессия не начиналась: спокойный конец
        run(finish(stopSession(st.current!, 'abandoned', fx.at), 'neutral'));
      }
    }
  }

  // --- проба
  function onTrial(e: MatchEvent) {
    const p = phase;
    if (p.kind !== 'trial' || p.run.done) return;
    const next = stepMatchTrial(p.run, e);
    const pressed = e.type === 'adult' && e.button === 'adult_prompted' && next.pending ? 'adult_prompted' : null;
    if (!next.done) {
      setPhase({ ...p, run: next, pressed });
      return;
    }
    // до записи экран стоит как есть: выбранная плита — с контуром 6 (раздел 5, «Ошибки»)
    setPhase({ ...p, run: next, pressed: null });
    run(record(next, p.run.step));
  }

  async function record(r: MatchTrialRun, step: TrialStep) {
    const s = st.current!;
    const earnedBefore = s.board.earned;
    const res = recordTrial(s, matchTrialInput(r), clock.now());
    if (!res.ok) throw new Error(res.errors.join('; '));
    st.current = db && childId ? await recordAbaTrial(db, childId, res.trial, res.state, iso()) : res.state;
    // прерванная проба (карточка, «Отказ») — без последствия: перерыв ≤ 300 мс (`abaBreak.reactionMaxMs`)
    if (res.trial.response === 'interrupted') {
      await advance();
      return;
    }
    const markedAt = clock.now();
    // плашка — только при `token_praise` (подсказанный ответ не получает того же подкрепителя), сменой кадра в
    // `markedAt` (Ц2.6.1); жетон за участие — отдельным событием после последствия (ABA.md)
    const overlay = res.award.feedback === 'token_praise';
    const tokens = res.trial.tokens;
    // обмен сразу (обучение доске) обнулил доску: до экрана обмена ребёнок видит её полной, а не пустой
    if (res.exchanged > 0) exchangePending.current = true;
    const stripEarned = res.exchanged > 0 ? Math.min(s.board.size, earnedBefore + tokens) : Math.max(0, st.current.board.earned - (res.participation ? 1 : 0));
    // путь Ц4 — только если доску заполнил жетон этой пробы; обмен от жетона за участие идёт после последствия (огр. 2)
    const filledByTrial = res.exchanged > 0 && overlay && earnedBefore + tokens >= s.board.size;
    const landedAt = markedAt + (still ? abaReinforcementOverlay.tokenAppearsAtMsCalm : abaTokenLandingMs());
    setPhase({
      kind: 'consequence',
      // сроки — по calm и системному «уменьшить движение» (Ц2.6.1): жетон появляется в 120, похвала в 500
      run: startConsequence({ markedAt, feedback: res.award.feedback, calm: still, exchange: filledByTrial }),
      overlay,
      earnedBefore,
      landed: false,
      empty: false,
      field: step,
      stripEarned,
      participation: res.participation,
      chosenId: r.chosenCardId,
      breakAsked: false,
      gate: filledByTrial ? { since: markedAt, ceilingAt: landedAt + abaExchange.fromFullBoard.ceilingMs, frameAt: null } : null,
    });
  }

  /** «Отказ» вне пробы (последствие, пауза, пауза после «Отказ»): отказ вне пробы — `withdrawAssent` (спецификация п. 1). */
  const refuseOutsideTrial = () =>
    run(
      (async () => {
        // на пути Ц4 доска уже полна и обменена: экран обмена — с удержанием переехавшей доски (№173)
        if ((phase.kind === 'consequence' || phase.kind === 'participation') && phase.gate) fromFullBoard.current = true;
        setPhase({ kind: 'busy' });
        // просьба о перерыве ещё пишется: отказ ложится после неё, а не под ней (методист, п. 4)
        if (writing.current) await writing.current;
        const s = st.current!;
        const last = s.trials[s.trials.length - 1];
        st.current = await save(withdrawAssent(s, clock.now(), 'adult_observed', last ? { targetId: last.targetId, trialId: last.id } : {}));
        await advance();
      })(),
    );

  /** Карточка «перерыв» в паузе перед SD (№160): просьба не теряется — перерыв вместо SD. */
  const breakInPause = () =>
    run(
      (async () => {
        setPhase({ kind: 'busy' });
        st.current = await save(requestBreakBetweenTrials(st.current!, clock.now()));
        await advance();
      })(),
    );

  /**
   * Карточка «перерыв» на жетоне за участие (№160): просьба — в домен, и по сроку — уже не заранее взятый шаг, а
   * новый `nextStep` (иначе вместо перерыва пришёл бы SD, а запись пробы — «сессия не ждёт пробу»).
   */
  const breakInParticipation = () => {
    setPhase((p) => (p.kind === 'participation' ? { ...p, then: null, breakAsked: true } : p));
    breakTrace.current = true;
    run(saveAside(requestBreakBetweenTrials(st.current!, clock.now())));
  };

  /** Карточка «перерыв» в фазе последствия (№160): просьба — в домен сразу, плашка доигрывает. */
  const breakInConsequence = () => {
    setPhase((p) => (p.kind === 'consequence' ? { ...p, breakAsked: true } : p));
    breakTrace.current = true;
    run(saveAside(requestBreakBetweenTrials(st.current!, clock.now())));
  };

  // --- смена кадра с полной доски на обмен (Ц4, итог проверок, огр. 1)
  const hold = (what: 'break_card' | 'adult_refusal') => {
    const now = clock.now();
    held.current = { what, at: now };
    // новое касание, пока кадр уже ждёт, — ждём до потолка (и засчитываем только там), а не до конца прежнего отклика
    setPhase((p) =>
      (p.kind === 'consequence' || p.kind === 'participation') && p.gate?.frameAt != null && now >= p.gate.since
        ? ({ ...p, gate: { ...p.gate, frameAt: p.gate.ceilingAt } } as Phase)
        : p,
    );
  };
  /** Палец сняли (или цель ушла с экрана): ждущая смена кадра — после отклика «принято», не дальше потолка. */
  const release = () => {
    held.current = null;
    const now = clock.now();
    releasedAt.current = now;
    const shown = now + abaExchange.fromFullBoard.heldTouch.acceptedShowMs;
    setPhase((p) =>
      (p.kind === 'consequence' || p.kind === 'participation') && p.gate?.frameAt != null
        ? ({ ...p, gate: { ...p.gate, frameAt: Math.min(shown, p.gate.ceilingAt) } } as Phase)
        : p,
    );
  };
  /** Срок, до которого смена кадра ждёт касание; `null` — менять сейчас. */
  const gateWait = (gate: FullBoardGate, at: number): number | null => {
    if (held.current && held.current.at >= gate.since) return gate.ceilingAt;
    const shown = releasedAt.current + abaExchange.fromFullBoard.heldTouch.acceptedShowMs;
    return shown > at ? Math.min(shown, gate.ceilingAt) : null;
  };
  /**
   * Палец лежит и в потолке — касание засчитывается в момент смены кадра (`atCeiling: 'commit_if_inside'`): карточка —
   * просьба о перерыве (обмен идёт, след остаётся); «Отказ» сам ведёт дальше — тогда `true`. Раньше потолка и касание,
   * начатое до показа кадра, не засчитываются.
   */
  const commitHeld = (gate: FullBoardGate, at: number): boolean => {
    const h = held.current;
    if (!h || h.at < gate.since || at < gate.ceilingAt) return false;
    held.current = null;
    if (h.what === 'adult_refusal') {
      refuseOutsideTrial();
      return true;
    }
    if (h.what === 'break_card') {
      if (phase.kind === 'participation') breakInParticipation();
      else breakInConsequence();
    }
    return false;
  };
  const toFullBoardExchange = (next: () => void) => {
    fromFullBoard.current = true;
    next();
  };

  /**
   * Просьба вне хода шага — в состояние сразу: шаг, наступивший до конца записи (обмен через 0.7 с, №172), её видит.
   * Запись не затирает состояние, которое к её концу уже ушло дальше; `advance` ждёт её.
   */
  function saveAside(next: AbaSessionState): Promise<void> {
    // повторное касание: просьба уже в очереди, домен вернул то же состояние
    if (next === st.current) return writing.current ?? Promise.resolve();
    st.current = next;
    breakQueued.current = true;
    const w = (writing.current ?? Promise.resolve()).then(async () => {
      const target = st.current!;
      const saved = await save(target);
      // пока шла запись, состояние ушло дальше (вторая просьба) — оно наследует новую версию доски
      st.current = st.current === target ? saved : { ...st.current!, boardRev: saved.boardRev };
    });
    writing.current = w;
    return w.finally(() => {
      if (writing.current === w) writing.current = null;
    });
  }

  // --- перерыв и доступ
  async function endBreak(at: number) {
    setPhase({ kind: 'busy' });
    const done = finishBreak(st.current!, at);
    // обмен на перерыве по расписанию (№169): доступ следующим шагом домена — сначала экран обмена
    if (done.exchanged > 0) exchangePending.current = true;
    st.current = await save(done.state);
    await advance();
  }
  /** Нет возврата после двух приглашений: конец по бездействию устройства — без обмена и сопряжения (№169). */
  async function noReturn(at: number) {
    setPhase({ kind: 'busy' });
    const s = st.current!;
    const last = s.trials[s.trials.length - 1];
    st.current = await save(withdrawAssent(s, at, 'device_inactivity', last ? { targetId: last.targetId, trialId: last.id } : {}));
    await advance();
  }
  /** Конец доступа: в журнал — время сцены (№171), рабочее время теряет весь шаг с обменом и кадром конца. */
  async function endAccess(at: number, scene: { startedAt: number; endedAt: number }) {
    setPhase({ kind: 'busy' });
    st.current = await save(finishAccess(st.current!, at, scene));
    await advance();
  }
  const takeCard = () =>
    run(
      (async () => {
        const p = phase;
        if (p.kind !== 'break') return;
        const now = clock.now();
        st.current = await save(takeBreakCard(st.current!, now));
        const step = nextStep(st.current, now).step;
        if (step.kind === 'break')
          setPhase({ kind: 'break', step, shownAt: now, until: now + (step.maxMs ?? CHILD_BREAK_MS[st.current.band]), invite: 0, inviteAt: null, training: false });
      })(),
    );

  // --- выход удержанием: остановка взрослым (в «Сам» — уход ребёнка)
  const exit = () => {
    const s = st.current;
    if (!s || finished.current) {
      router.dismissTo('/map');
      return;
    }
    exiting.current = true;
    const p = phase;
    // доступ в журнале — время сцены (№171): на экране обмена сцена ещё не началась — доступа нет
    const scene =
      p.kind === 'exchange' && p.next !== 'tail' ? null : p.kind === 'access' && !p.tail ? { startedAt: p.run.startedAt, endedAt: p.sceneEndedAt ?? undefined } : undefined;
    run(finish(stopSession(s, s.config === 'alone' ? 'abandoned' : 'adult_stopped', clock.now(), scene), 'neutral'));
  };

  // без конфигурации — к взрослому: режим и «кто ведёт» выбираются на `parent/aba` (этап G1), детского экрана выбора нет
  if (!config && !st.current && phase.kind === 'loading') return <Redirect href="/parent/aba" />;

  const s = st.current;
  // панель взрослого сама добавляет нижний inset: корень его тогда не добавляет (иначе «Отказ» прыгает на 34 pt)
  const shownKind = phase.kind === 'busy' ? lastPhaseKind.current : phase.kind;
  const withPanel =
    shownKind === 'trial' ||
    shownKind === 'card' ||
    shownKind === 'consequence' ||
    shownKind === 'pause' ||
    shownKind === 'participation' ||
    (phase.kind === 'break' && phase.step.offerCardMs !== undefined);
  if (phase.kind !== 'busy') lastPhaseKind.current = phase.kind;
  if (phase.kind !== 'busy') lastPhase.current = phase;
  const shown = phase.kind === 'busy' ? lastPhase.current : phase;
  const tier = height === null ? null : abaTierFor(height, insets.bottom);
  const layout = abaLayoutByTier[tier ?? 'compact'];
  const zone = ZONE[tier ?? 'compact'];
  const withAdult = s?.config === 'with_adult';

  const shownEarned =
    phase.kind === 'consequence' ? phase.stripEarned : phase.kind === 'participation' ? Math.max(0, phase.earned - (phase.landed ? 0 : 1)) : (s?.board.earned ?? 0);
  // жетон за участие падает в ячейку до посадки (Ц4.1), в calm и reduce motion — появляется в `landAt`
  const dropping = phase.kind === 'participation' && !still && !phase.landed ? abaParticipation.drop : undefined;
  const strip = s ? <TokenStrip reinforcerId={s.reinforcerId} size={s.board.size} earned={shownEarned} dropping={dropping} /> : null;
  // «Отказ» и карточка «перерыв»: лежащий палец держит смену кадра на обмен (Ц4, огр. 1). Касание отслеживается во
  // всех фазах — полоса и панель переживают смену фазы, и отпускание на следующем кадре не должно теряться
  const holdRefusal = (b: PanelButton, down: boolean) => {
    if (b !== 'refusal') return;
    if (down) hold('adult_refusal');
    else release();
  };
  const holdCard = (down: boolean) => (down ? hold('break_card') : release());
  const panel = (buttons: readonly PanelButton[], pressed: PanelButton | null, onPress: (b: PanelButton, at: number) => void, caption?: string) =>
    withAdult ? (
      <AdultPanel buttons={buttons} height={layout.adultPanel} insetBottom={insets.bottom} caption={caption} pressed={pressed} onPress={onPress} onHold={holdRefusal} />
    ) : (
      <View style={{ height: layout.adultPanel }} />
    );
  const instruction = (key: string | null) => (
    <View style={{ height: layout.instruction, justifyContent: 'center', paddingHorizontal: 16 }}>
      {key && (
        <Text testID="aba-instruction" style={{ color: c.ink, fontSize: 22, lineHeight: 30, fontWeight: '700', textAlign: 'center' }} numberOfLines={2} maxFontSizeMultiplier={1.2}>
          {t(key)}
        </Text>
      )}
    </View>
  );
  const sdKeyOf = (step: TrialStep) => step.sdVariantKey ?? s?.targets[step.targetId]?.sdKey ?? null;

  let body: ReactNode = null;
  switch (phase.kind) {
    case 'busy':
      // запись идёт: прежний кадр стоит, экран не пустеет (индикатора ребёнку нет), но касания не принимает —
      // второй тап по «Вернуться» или карточке в окне записи повторял бы шаг домена
      body = (
        <View style={{ flex: 1 }} pointerEvents="none">
          {lastBody.current}
        </View>
      );
      break;
    case 'ended':
      body = <AbaEnd variant={phase.variant} board={phase.board ?? undefined} onDone={() => router.dismissTo('/map')} />;
      break;
    case 'card': {
      // сменился ведущий наблюдатель — подсказка взрослому «жестом, не словами» (`BreakCardPlan.adultCoaching`)
      const caption =
        coaching.current && phase.gesture ? t('abaSession.offerCardHint') : t(`abaSession.breakTraining.${phase.step === 'independent' && phase.gesture ? 'gesture' : phase.step}`);
      body = (
        <>
          <TopBar breakCard={{ frameShownAt: phase.shownAt, onTap: () => cardOpportunity(true), onHold: holdCard }} />
          {strip}
          <View style={{ height: layout.gapAfterBoard }} />
          {instruction(null)}
          <View style={{ flex: 1 }} testID="aba-card-training" />
          {panel(['l4_skipped'], null, () => cardOpportunity(false), caption)}
        </>
      );
      break;
    }
    case 'choose': {
      const cardSize = height ? abaReinforcerCardSize(width - 32, height) : 160;
      body = (
        <View style={{ flex: 1, paddingHorizontal: 16 }}>
          {/* строка 72: выход слева, заголовок по центру, справа место под повтор (раздел 4, Ц3.0 п. 3) */}
          <NonTrialRow exitLabel={t('abaSession.exit')} exitHint={t('abaSession.exitHint')}>
            <Text style={{ color: c.ink, fontSize: 22, lineHeight: 30, fontWeight: '700', textAlign: 'center' }} numberOfLines={2} maxFontSizeMultiplier={1.2}>
              {t('abaSession.chooseTitle')}
            </Text>
          </NonTrialRow>
          <View style={{ height: 16 }} />
          <ReinforcerChoiceView
            run={phase.choice}
            options={phase.options}
            cardSize={cardSize}
            boardCells={s?.board.size ?? 1}
            pulse={false}
            onTap={(id, at) => onChoice({ type: 'tap', reinforcerId: id, now: at })}
            onAdultTap={(id) => onChoice({ type: 'adult_tap', reinforcerId: id, now: clock.now() })}
          />
        </View>
      );
      break;
    }
    case 'pause':
    case 'trial':
    case 'consequence':
    case 'participation': {
      const step = phase.kind === 'trial' ? phase.run.step : phase.kind === 'pause' ? phase.step : phase.field;
      if (!step) {
        // жетон за участие от `nextStep` (закрытие блока вне пробы): полоса видна — жетон не «тихий»
        body = (
          <>
            <TopBar breakCard={{ frameShownAt: 0, onTap: breakInParticipation, highlight: phase.kind === 'participation' && phase.breakAsked, onHold: holdCard }} />
            {strip}
            <View style={{ flex: 1 }} testID="aba-participation" />
            {panel(['refusal'], null, refuseOutsideTrial)}
          </>
        );
        break;
      }
      const r = phase.kind === 'trial' ? phase.run : null;
      const empty = phase.kind === 'pause' || phase.kind === 'participation' || (phase.kind === 'consequence' && phase.empty);
      const overlayH = layout.tokenBoard + layout.gapAfterBoard + layout.instruction + layout.hintBand + zone.sample + 24 + zone.choice;
      const buttons = r && withAdult ? adultPanelButtons(s!.config, step, r.awaitingL4) : (['adult_prompted', 'refusal'] as PanelButton[]);
      const frame = r ? r.sdEndedAt : 0;
      body = (
        <>
          <TopBar
            breakCard={{
              frameShownAt: phase.kind === 'consequence' ? phase.run.markedAt : frame,
              highlight: (phase.kind === 'consequence' || phase.kind === 'participation') && phase.breakAsked,
              onHold: holdCard,
              onTap: (at) =>
                phase.kind === 'trial' ? onTrial({ type: 'break_card', at }) : phase.kind === 'pause' ? breakInPause() : phase.kind === 'participation' ? breakInParticipation() : breakInConsequence(),
            }}
          />
          {phase.kind === 'consequence' && phase.overlay ? (
            <ReinforcementOverlay size={s!.board.size} earnedBefore={phase.earnedBefore} landed={phase.landed} calm={calm} moving={!still} height={Math.min(overlayH, abaReinforcementOverlay.tali + 288)} />
          ) : (
            <>
              {strip}
              <View style={{ height: layout.gapAfterBoard }} />
              {instruction(empty ? null : sdKeyOf(step))}
              <MatchField
                sampleId={step.sampleCardId!}
                field={step.field!}
                visual={r ? matchVisual(r) : null}
                sampleTouched={r ? r.sampleTouchedAt !== null : phase.kind === 'consequence'}
                // в последствии и пока проба пишется варианты не «гаснут»: цвет «неактивно» читался бы как «неверно»
                activeIds={r && !r.done ? step.field!.filter((id) => optionActive(r, id)) : step.field!}
                chosenId={r ? r.chosenCardId : phase.kind === 'consequence' ? phase.chosenId : null}
                sampleSize={zone.sample}
                choiceSize={zone.choice}
                frameShownAt={frame}
                empty={empty}
                onSample={(at) => onTrial({ type: 'tap_sample', at })}
                onOption={(id, at) => onTrial({ type: 'tap_option', id, at })}
              />
            </>
          )}
          <View style={{ flex: 1 }} />
          {panel(
            phase.kind === 'trial' ? buttons : ['refusal'],
            phase.kind === 'trial' ? phase.pressed : null,
            (b, at) => (phase.kind === 'trial' ? onTrial({ type: 'adult', button: b, at }) : b === 'refusal' ? refuseOutsideTrial() : undefined),
          )}
        </>
      );
      break;
    }
    case 'break': {
      const offer = phase.step.offerCardMs !== undefined;
      if (offer) {
        // пауза после «Отказ»: экран пробы без плит, карточка с контуром 6 всю паузу (Ц3.7, №171) — смена посреди
        // паузы была бы повторной подсказкой; жест и подпись взрослому — только `offerCardMs`
        const hint = (phase.tick ?? phase.shownAt) < phase.shownAt + phase.step.offerCardMs!;
        body = (
          <>
            <TopBar breakCard={{ frameShownAt: phase.shownAt, onTap: takeCard, highlight: true, onHold: holdCard }} />
            {strip}
            <View style={{ flex: 1 }} testID="aba-refusal-pause" />
            {panel(['refusal'], null, refuseOutsideTrial, hint ? t('abaSession.offerCardHint') : undefined)}
          </>
        );
      } else {
        const left = (phase.until - (phase.tick ?? phase.shownAt)) / (phase.until - phase.shownAt);
        body = (
          <View style={{ flex: 1 }} testID="aba-break">
            {/* обучающий перерыв ждёт взрослого (№169): со второго приглашения — подпись взрослому (Ц3.9) */}
            <TopBar breakCard={null} caption={phase.training && phase.invite === 2 ? t('abaBreak.trainingWaitHint') : undefined} />
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24 }}>
              {/* значок не нажимается, но похож на кнопку: касание — сжатие без звука и записи (Ц3.1) */}
              <Pressable
                accessibilityRole="image"
                accessibilityLabel={t('abaSession.breakCard')}
                testID="aba-break-icon"
                style={({ pressed }) => ({
                  width: abaBreak.timerRing,
                  height: abaBreak.timerRing,
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: [{ scale: pressed ? inactiveChoice.tapPress.scale : 1 }],
                })}
              >
                {phase.invite === 0 && (
                  <View style={{ position: 'absolute' }}>
                    <AccessRing left={left} size={abaBreak.timerRing} />
                  </View>
                )}
                {/* «две планки» 120 — внутри кольца и после него: место не пустеет (`abaBreak.atTimerEnd`); на втором
                    приглашении — контурные, тот же значок, что на «Вернуться» */}
                {phase.invite === 2 ? (
                  <PlaceholderGlyph name="pause_bars_outline" size={abaBreak.icon} stroke={abaBreak.invite.second.iconStroke} color={c.ink} />
                ) : (
                  <PlaceholderGlyph name="pause_bars" size={abaBreak.icon} color={c.ink} />
                )}
              </Pressable>
            </View>
            {/* детская цель (`abaChildTouch`): сжатие 0.94 на касание, засчитывается по правилу кадра */}
            <ChildPressable
              frameShownAt={phase.shownAt}
              onCommit={(at) => run(endBreak(at))}
              testID="aba-break-return"
              accessibilityLabel={t('abaBreak.return')}
              style={{
                height: abaBreak.returnButton,
                marginHorizontal: 24,
                marginBottom: 16,
                borderRadius: radii.lg,
                borderWidth: phase.invite > 0 ? abaBreak.invite.contour : ABA_CONTROL_STROKE,
                borderColor: c.controlInk,
                backgroundColor: c.controlFill,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
              }}
            >
              <PlaceholderGlyph name="pause_bars_outline" size={abaBreak.returnIcon.size} color={c.controlInk} />
              <Text style={{ color: c.controlInk, fontSize: 22, fontWeight: '700' }} numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.2}>
                {t('abaBreak.return')}
              </Text>
            </ChildPressable>
          </View>
        );
      }
      break;
    }
    case 'access':
      body = s?.reinforcerId ? <AccessView run={phase.run} tick={phase.tick} reinforcerId={s.reinforcerId} moving={!still} /> : null;
      break;
    case 'exchange':
      // обмен без кнопки «Получить!» на всех путях (Ц3.4): требования к ребёнку нет, жетоны уходят в карточку сами
      body = s?.reinforcerId ? (
        <ExchangeView
          run={phase.run}
          at={phase.tick}
          reinforcerId={s.reinforcerId}
          pairing={phase.pairing}
          moving={!still}
          testID={phase.pairing ? 'aba-end-pairing' : 'aba-exchange'}
        />
      ) : null;
      break;
    case 'end_wait':
      body = <PairingWaitView />;
      break;
    default:
      body = null;
  }
  if (phase.kind !== 'busy') lastBody.current = body;

  return (
    <View
      style={{ flex: 1, backgroundColor: c.background, paddingTop: insets.top, paddingBottom: withPanel ? 0 : insets.bottom }}
      onLayout={(e) => {
        setHeight(e.nativeEvent.layout.height - insets.top - insets.bottom);
        setWidth(e.nativeEvent.layout.width);
      }}
      testID="aba-session"
    >
      <View style={{ flex: 1, paddingHorizontal: shownKind === 'choose' || shownKind === 'access' || shownKind === 'exchange' || shownKind === 'end_wait' || shownKind === 'ended' ? 0 : 16 }}>{body}</View>
      {(shown.kind === 'exchange' || shown.kind === 'access') && shown.trace && <BreakTrace top={insets.top + abaBreakTrace.top} />}
      {/* выход один на все кадры (Ц4, огр. 9): удержание идёт через смены «проба → плашка → обмен → доступ»; на загрузке —
          тоже: «назад» перехвачен, а старт может зависнуть */}
      {phase.kind !== 'ended' && (
        <View style={{ position: 'absolute', top: insets.top + abaNonTrialRow.exitTopInset, left: 16 }}>
          <ExitHold onExit={exit} label={t('abaSession.exit')} hintLabel={t('abaSession.exitHint')} />
        </View>
      )}
    </View>
  );
}
