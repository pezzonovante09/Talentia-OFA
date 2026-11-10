/**
 * Рабочая сессия ABA (этап 11; спецификация `docs/design/aba-screens-spec-2026-10-25.md`, направление
 * `docs/design/aba-screens-2026-10-25.md`). Домен (`abaSession.ts`) решает, что дальше, — экран рисует шаг `nextStep` и пишет:
 *
 * - старт: `loadAbaStart` → `startAbaSession`; со взрослым — обучение карточке «перерыв» до первой пробы;
 * - выбор подкрепителя тапом → `chooseReinforcer`; проба `match` с панелью взрослого, запись **до** последствия
 *   (`recordAbaTrial`); карточка «перерыв» в последствии — сразу в домен (№160);
 * - перерыв (№169): кольцо → два приглашения → конец по бездействию; обмен — один экран без кнопки, доступ — время самой
 *   сцены в журнал (№171); конец: итог сразу, затем хвост (`useSessionTail`), один раз «Закончили»; выход удержанием.
 *
 * Сворачивание и сжатие окна (фаза 8, №182; правила — ABA.md «Возврат после сворачивания»): снимок пересохраняется,
 * экран пустеет, отложенные смены кадра и шаги замирают (`away`); возврат — `loadAbaResume`. Ошибки записи разбираются
 * (`classifyAbaWriteError`): конфликт доски — повтор шага (`useSessionWrites`), пауза и отзыв согласия — спокойный конец
 * без записи, прочее — итог `app_error`. Ни ошибки, ни имена ABA-экранов наружу не уходят (только `__DEV__`).
 */
import { useKeepAwake } from 'expo-keep-awake';
import { Redirect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode, type SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  abaBreakTrace,
  abaChoiceZone,
  abaExchange,
  abaLayoutByTier,
  abaNonTrialRow,
  abaParticipation,
  abaReinforcerCardSize,
  abaReinforcementOverlay,
  abaTokenLandingMs,
  type AbaTier,
} from '../../src/design/abaTokens';
import type { BreakCardStep } from '../../src/domain/abaBreakCard';
import type { PanelButton } from '../../src/domain/abaScoring';
import {
  chooseReinforcer,
  finishAccess,
  finishBreak,
  accessShown,
  nextStep,
  noChoiceAtEnd,
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
import { classifyAbaWriteError, closeSession, loadAbaResume, markAbaSessionLeft } from '../../src/services/local/abaResume';
import { abandonInProgressSession, loadAbaStart } from '../../src/services/local/abaStart';
import { loadChildState } from '../../src/services/local/childState';
import { loadBreakCardPlan, recordAbaTrial } from '../../src/services/local/commit';
import { voice } from '../../src/services/voice';
import { useAbaRun } from '../../src/state/abaRun';
import { useAccount } from '../../src/state/account';
import { useChildSession } from '../../src/state/childSession';
import { CHILD_BREAK_MS, type AbaTarget } from '../../src/types/aba';
import { AbaEnd } from '../../src/ui/aba/AbaEnd';
import { useAbaClock, useDue } from '../../src/ui/aba/clock';
import { startAccess, stepAccess, type AccessRun } from '../../src/ui/aba/model/accessRun';
import { advanceConsequence, startConsequence } from '../../src/ui/aba/model/consequenceRun';
import { matchTrialInput, startMatchTrial, stepMatchTrial, type MatchEvent, type MatchTrialRun } from '../../src/ui/aba/model/matchTrialRun';
import { endTail, type TailStep } from '../../src/ui/aba/model/endTail';
import {
  accessSceneOnStop,
  accessScenesAtEnd,
  boardOf,
  gateOnHold,
  gateOnRelease,
  gateWait,
  participationPhase,
  phaseDueAt,
  type AccessScene,
  type FullBoardGate,
  type Phase,
} from '../../src/ui/aba/model/sessionPhase';
import { accessOnReturn, breakOnReturn, exchangePendingOnResume, exchangeUnseen, tierForWindow } from '../../src/ui/aba/model/sessionResume';
import { useAbaBackground } from '../../src/ui/aba/useAbaBackground';
import { useWindowSqueeze } from '../../src/ui/aba/useWindowSqueeze';
import { useSessionTail } from '../../src/ui/aba/useSessionTail';
import { useSessionWrites } from '../../src/ui/aba/useSessionWrites';
import { leaveAba } from '../../src/ui/aba/leaveAba';
import { exchangeEndsAt, exchangeView, startExchange } from '../../src/ui/aba/model/exchangeRun';
import { startChoice, stepChoice } from '../../src/ui/aba/model/reinforcerChoiceRun';
import { ExitHold, useAbaColors, useReduceMotion } from '../../src/ui/aba/parts';
import { AccessView } from '../../src/ui/aba/session/AccessView';
import { AwayFrame } from '../../src/ui/aba/session/AwayFrame';
import { BreakView } from '../../src/ui/aba/session/BreakView';
import { ChooseFrame } from '../../src/ui/aba/session/ChooseFrame';
import { ExchangeView, PairingWaitView } from '../../src/ui/aba/session/ExchangeView';
import { AdultPanel, BreakTrace, TokenStrip, TopBar } from '../../src/ui/aba/session/parts';
import { TrialFrame } from '../../src/ui/aba/session/TrialFrame';

const ZONE: Record<AbaTier, (typeof abaChoiceZone)[keyof typeof abaChoiceZone]> = {
  roomy: abaChoiceZone.regular,
  compact: abaChoiceZone.compact,
  tight: abaChoiceZone.tight,
};
const CARD_STEPS: BreakCardStep[] = ['model', 'prompted', 'independent'];

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

  const [phase, showPhase] = useState<Phase>({ kind: 'loading' });
  /** Свёрнуто: отложенные смены кадра и шаги не идут, кадр на возврате строится из снимка; `leaves` — номер ухода. */
  const away = useRef(false);
  const leaves = useRef(0);
  const setPhase = useCallback((p: SetStateAction<Phase>) => {
    if (!away.current) showPhase(p);
  }, []);
  const [height, setHeight] = useState<number | null>(null);
  /** Одно измерение окна (высота, ширина, нижний отступ того же момента) — для проверки сжатия (№182). */
  const [measured, setMeasured] = useState<{ height: number; width: number; insetBottom: number } | null>(null);
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
  /** Просьба «перерыв» уже в домене: заранее взятый шаг участия (`then`) устарел — следующий берётся заново. */
  const breakQueued = useRef(false);
  /** Обмен идёт сменой кадра с полной доски (Ц4): доска переехала — удержание `fromFullBoard.holdMs` (№173). */
  const fromFullBoard = useRef(false);
  /** Просьбу о перерыве приняли на плашке или жетоне за участие: на обмене и доступе — карточка-след (огр. 3). */
  const breakTrace = useRef(false);
  /** Палец, который сейчас лежит на карточке «перерыв» или «Отказ», и момент последнего отпускания (огр. 1). */
  const held = useRef<{ what: 'break_card' | 'adult_refusal'; at: number } | null>(null);
  const releasedAt = useRef(-Infinity);
  /** Тир — один раз на сессию (`abaWindowPolicy.tierChosen`): первый `onLayout`; `null` на нём — к гейту `/aba`. */
  const tierRef = useRef<AbaTier | null>(null);
  /** Момент ухода в фон; на холодном старте — `updated_at` снимка. `accessLeft` — выданные отрезки и сцена, с которой ушли. */
  const leftAt = useRef<number | null>(null);
  const accessLeft = useRef<{ scenes: AccessScene[]; run: AccessRun } | null>(null);
  /** Последнее начатое действие экрана (запись пробы, шага): уход в фон и возврат ждут его конца. */
  const inFlight = useRef<Promise<unknown>>(Promise.resolve());
  /** Итог пишется (`closeSession`): выход в это окно не уводит с экрана — конец сам уйдёт на карту. */
  const closing = useRef(false);
  // старт один раз: настройки и наблюдатели берутся на момент старта
  const startOpts = useRef({ settings, observers, primaryObserverId });
  const calm = startOpts.current.settings.calmMode;
  // calm и системное «уменьшить движение» — смены кадра вместо движения, и сроки обмена и конца доступа те же, что в calm
  const reduceMotion = useReduceMotion();
  const still = calm || reduceMotion;

  const iso = useCallback(() => new Date(clock.now()).toISOString(), [clock]);
  const tail = useSessionTail({ db, childId, still, setPhase });
  const { writing, boardRetry, saveStep, writeAside } = useSessionWrites({ db, childId, st, now: () => clock.now() });
  /** Спокойный конец без записи (пауза, отзыв согласия, конфликт доски не разрешился): снимок остаётся, стор сброшен. */
  const endWithoutWrite = useCallback(() => {
    finished.current = true;
    away.current = false;
    useAbaRun.getState().reset();
    // доска и при ошибке видна как есть (Ц2.10): жетоны не пропадают
    const end = { variant: 'neutral', board: boardOf(st.current) } as const;
    tail.setEnd(end);
    setPhase({ kind: 'ended', ...end });
  }, [setPhase, tail]);
  /** Конец без кадра: на пустом кадре (свёрнуто, холодный возврат) — момент ухода и выданные отрезки, иначе сейчас и сцена кадра. */
  const stopPoint = () => {
    const shown = lastPhase.current;
    const gone = away.current || shown.kind === 'away' || shown.kind === 'loading' ? leftAt.current : null;
    return gone === null ? { at: clock.now(), scenes: accessSceneOnStop(shown) } : { at: gone, scenes: accessLeft.current?.scenes, endedAt: gone };
  };
  /**
   * Ошибка действия экрана (фаза 8): конфликт доски, оставшийся после повторов, пауза и отзыв согласия — спокойный конец
   * без записи; остальное — итог сессии причиной `app_error` (ступень доски не решает, обмена нет). На возврате кадр пуст:
   * конец — момент ухода, в журнале только выданные отрезки. Текст ошибки — только в `__DEV__`.
   */
  const fail = (e: unknown): Promise<void> => {
    if (__DEV__) console.warn('aba-session', e);
    if (finished.current) return Promise.resolve();
    if (classifyAbaWriteError(e) !== 'other' || !st.current) {
      endWithoutWrite();
      return Promise.resolve();
    }
    const stop = stopPoint();
    return finishRef.current(stopSession(st.current, 'app_error', stop.at, stop.scenes), 'neutral', stop.endedAt).catch(() => endWithoutWrite());
  };

  /**
   * Конец: итог сессии одной транзакцией (повтор не пишет второй раз), затем хвост `endTail` — обмен и доступ или цикл
   * сопряжения. Итог — до доступа: свёрнутое во время доступа приложение не теряет итог по целям.
   */
  const finish = useCallback(
    async (state: AbaSessionState, variant: 'normal' | 'neutral', endedAt?: number) => {
      if (finished.current) return;
      finished.current = true;
      closing.current = true;
      setPhase({ kind: 'busy' });
      // просьба вне хода шага ещё пишется — снимок «в работе» не должен лечь после итога; её ошибка конца не отменяет
      await writing.current?.catch(() => undefined);
      // выход нажат, пока итог не записан: остановка перекрывает плановый конец — как до записи
      const s = exiting.current ? stopSession(state, state.config === 'alone' ? 'abandoned' : 'adult_stopped', clock.now()) : state;
      let steps: TailStep[] = [{ kind: 'end' }];
      let board = boardOf(s);
      if (db && childId) {
        const now = clock.now();
        // итог с повтором по живой доске при конфликте (`closeSession`); пауза, отзыв или иная ошибка — спокойный конец
        // без итога, снимок остаётся: родитель закроет занятие
        const out = await closeSession(db, childId, s, { endedAt: endedAt ?? now, now }).catch((error: unknown) => ({ kind: 'failed' as const, error }));
        if (out.kind === 'ok') {
          const { result } = out;
          // подкрепителя нет — обмену и доступу нечего показать (пустой экран): сразу «Закончили» (фаза 8, защитная ветка)
          if (s.reinforcerId !== null) steps = endTail({ exchanged: result.exchanged, boardSize: result.session.boardSize, events: result.session.events });
          board = { cells: result.board.size, filled: result.board.earned };
          tail.closed(result.session.id);
        } else {
          if (__DEV__) console.warn('aba-session-commit', out.kind === 'failed' ? out.error : out.kind);
          variant = 'neutral';
          // итог не лёг: на конце живая доска, а не доска из памяти (методист, д)
          const live = await loadChildState(db, childId, 'abaBoard').catch(() => null);
          if (live) board = { cells: s.board.size, filled: live.earned };
        }
      }
      closing.current = false;
      useAbaRun.getState().reset();
      tail.arm(steps, { variant, board });
      if (exiting.current) {
        tail.leave(steps[0].kind, null, clock.now(), true);
        leaveAba(router);
        return;
      }
      // свернули, пока писался итог: хвост стоит на первом шаге, дальше решит возврат (а8)
      if (away.current) tail.leave(steps[0].kind, null, leftAt.current ?? clock.now());
      else tail.next(clock.now());
    },
    [db, childId, clock, router, tail, setPhase, writing],
  );
  // `fail` объявлен выше и зовёт конец через ссылку: `finish` пересоздаётся позже него
  const finishRef = useRef(finish);
  finishRef.current = finish;

  /** Следующий шаг домена — в фазу экрана. Свёрнуто — шаг возьмёт возврат: перерыв и доступ не начинаются в фоне. */
  async function advance() {
    if (away.current) return;
    // просьба вне хода шага ещё пишется: шаг берётся после записи, иначе следующая запись разойдётся с версией доски;
    // кадр на это время замирает — «Отказ» в этом окне дал бы второй шаг и обмен без экрана обмена
    if (writing.current) {
      setPhase({ kind: 'busy' });
      await writing.current;
    }
    const cur = st.current;
    if (!cur || finished.current || away.current) return;
    const now = clock.now();
    const next = nextStep(cur, now);
    st.current = next.state;
    breakQueued.current = false;
    // жетон за участие заполнил доску и обмен прошёл сразу: до экрана обмена доска видна полной, а не пустой
    if (next.state.exchangesMade > cur.exchangesMade) exchangePending.current = true;
    // жетон за участие от закрытия блока (`nextStep`) — своим событием до шага
    if (next.participation) {
      setPhase(participationPhase({ now, field: null, then: next.step, board: next.state.board, fills: exchangePending.current }));
      return;
    }
    await show(next.step, now);
  }

  // старт зовёт шаг через ссылку: функция пересоздаётся на каждом рендере
  const advanceRef = useRef(advance);
  advanceRef.current = advance;

  /** После записи шага: конец уже идёт — шаг не нужен; просьба о перерыве легла во время записи — шаг устарел, берётся заново (№160). */
  async function stepStale() {
    if (finished.current) return true;
    if (!breakQueued.current) return false;
    await advance();
    return true;
  }

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
        await saveStep((c) => c);
        if (await stepStale()) return;
        if (step.pauseBeforeMs > 0) setPhase({ kind: 'pause', step, until: now + step.pauseBeforeMs });
        else beginTrial(step, now);
        return;
      }
      case 'break': {
        // снимок на входе: `breakStartedAt` доживает до холодного старта, в том числе если iOS заморозит JS сразу после `background`
        await saveStep((c) => c);
        if (await stepStale()) return;
        const head = cur.queue[0];
        const training = head?.kind === 'break' && head.training === true;
        const maxMs = step.maxMs ?? CHILD_BREAK_MS[cur.band];
        // перерыв начат до сворачивания (фаза 8): домен хранит `breakStartedAt` — кольцо по остатку, срок бездействия от возврата
        const startedAt = cur.breakStartedAt ?? now;
        if (startedAt < now) {
          if (step.offerCardMs !== undefined) {
            // тихая пауза после «Отказ» истекла в фоне — закрывается своим сроком, не моментом возврата
            if (now >= startedAt + maxMs) {
              await endBreak(now, startedAt + maxMs);
              return;
            }
            setPhase({ kind: 'break', step, startedAt, shownAt: now, until: startedAt + maxMs, tick: now, invite: 0, inviteAt: null, training });
            return;
          }
          setPhase({ kind: 'break', step, ...breakOnReturn({ startedAt, maxMs, now }), training });
          return;
        }
        // пауза после «Отказ»: карточка подсвечена `offerCardMs`, а сама тихая пауза — `maxMs` (`REFUSAL_QUIET_MS`, 30 с
        // от снятия требования, ABA.md блок 4 п. 1)
        setPhase({ kind: 'break', step, startedAt: now, shownAt: now, until: now + maxMs, invite: 0, inviteAt: null, training });
        return;
      }
      case 'access':
        // подкрепителя нет — показать нечего, а пустой экран хуже конца: программная ошибка, не решение ребёнка
        if (cur.reinforcerId === null) {
          await finish(stopSession(cur, 'app_error', now, null), 'neutral');
          return;
        }
        if (exchangePending.current) {
          exchangePending.current = false;
          const holdMs = fullBoard ? abaExchange.fromFullBoard.holdMs : undefined;
          setPhase({ kind: 'exchange', run: startExchange({ at: now, cells: cur.board.size, calm: still, holdMs }), tick: now, pairing: false, next: step, trace });
        } else if (cur.accessStartedAt !== null && cur.accessStartedAt < now) {
          // доступ начат до сворачивания (фаза 8): до T — сцена с остатка, после T — только кадр конца; в журнал — выданные отрезки
          // тёплый возврат знает настоящую сцену: T — от её начала, а не от кадра обмена
          const was = accessLeft.current;
          accessLeft.current = null;
          st.current = accessShown(cur);
          const r = accessOnReturn({ accessStartedAt: was?.run.startedAt ?? cur.accessStartedAt, durationMs: was?.run.durationMs ?? step.durationMs, leftAt: leftAt.current ?? cur.accessStartedAt, now, still, delivered: was?.scenes });
          setPhase({ kind: 'access', run: r.run, tick: now, tail: false, sceneEndedAt: null, trace, scenes: r.scenes, sceneFrom: r.sceneFrom });
        } else {
          await saveStep(accessShown);
          if (finished.current) return;
          setPhase({ kind: 'access', run: startAccess(now, step.durationMs, 0, still), tick: now, tail: false, sceneEndedAt: null, trace, scenes: [], sceneFrom: now });
        }
        return;
      case 'end':
        await finish(cur, step.endedOnSuccess && !step.byInactivity ? 'normal' : 'neutral');
        return;
      case 'adult_finish_chain':
        // цепочек в этапе 11 нет: неизвестный шаг — спокойный конец
        await finish(stopSession(cur, 'adult_stopped', now), 'neutral');
        return;
    }
  }

  /** Действие экрана: ошибка — в `fail`. Уход в фон ждёт его конца. */
  const run = (p: Promise<void>) => {
    inFlight.current = Promise.allSettled([inFlight.current, p.catch((e: unknown) => fail(e))]);
  };

  function beginTrial(step: TrialStep, now: number) {
    const s = st.current!;
    const target = s.targets[step.targetId] as AbaTarget;
    setPhase({
      kind: 'trial',
      pressed: null,
      run: startMatchTrial({ step, target, config: s.config, seed: s.seed, trialId: newAbaId(), sessionId: s.sessionId, index: s.trials.length, shownAt: now }),
    });
  }

  /** Незаконченное занятие просрочено (фаза 8, Ц2.11): закрыть `app_backgrounded` моментом ухода, без экрана конца — на карту. */
  async function abandonAndLeave(at: number) {
    if (db && childId) await abandonInProgressSession(db, childId, { reason: 'app_backgrounded', at, now: clock.now(), soundOn: startOpts.current.settings.soundEffects });
    finished.current = true;
    useAbaRun.getState().reset();
    leaveAba(router);
  }
  /** Продолжить занятие из снимка (фаза 8): состояние уже по живой доске; обмен, которого ребёнок не видел, — заново. */
  async function resumeFrom(state: AbaSessionState, from: number, o: { cold: boolean }) {
    st.current = state;
    leftAt.current = from;
    // обучение карточке «перерыв» на холодном старте не повторяется: записанные возможности уже в событиях снимка
    // (методист а9); при тёплом возврате refs целы — обучение продолжается
    if (o.cold) cardLeft.current = 0;
    exchangePending.current = exchangePendingOnResume(state);
    // обмен заново — с удержанием полной доски 1000 и на одной ячейке (`design-lead`, огр. 4 `child-ux-specialist`)
    if (exchangePending.current) fromFullBoard.current = true;
    await advanceRef.current();
  }
  const latest = useRef({ fail, abandonAndLeave, resumeFrom, endWithoutWrite });
  latest.current = { fail, abandonAndLeave, resumeFrom, endWithoutWrite };
  // старт один на жизнь экрана: его отменяет только уход с экрана, а не смена окна или настройки движения
  const unmounted = useRef(false);
  useEffect(() => {
    unmounted.current = false;
    return () => {
      unmounted.current = true;
    };
  }, []);

  // старт — после первого `onLayout`: тир фиксируется один раз на сессию, `null` («слишком мал») — к гейту `/aba`, пока
  // ничего не начато и не записано (фаза 8, `abaWindowPolicy.tierChosen`)
  const started = useRef(false);
  useEffect(() => {
    if (!db || !childId || !config || started.current || height === null) return;
    // тир по высоте и ширине — одна функция с гейтом окна и проверкой сжатия (№182)
    const tier = tierForWindow({ height, width, insetBottom: insets.bottom });
    if (tier === null) {
      router.replace('/aba');
      return;
    }
    tierRef.current = tier;
    started.current = true;
    const o = startOpts.current;
    const now = clock.now();
    void (async () => {
      // незаконченное занятие — продолжить, закрыть как просроченное или закончить без записи (пауза, отзыв)
      const r = await loadAbaResume(db, childId, { soundOn: o.settings.soundEffects, now });
      if (unmounted.current) return;
      if (r.kind === 'blocked') {
        latest.current.endWithoutWrite();
        return;
      }
      if (r.kind === 'abandon') {
        await latest.current.abandonAndLeave(r.leftAt);
        return;
      }
      if (r.kind === 'resume') {
        await latest.current.resumeFrom(r.state, r.leftAt, { cold: true });
        return;
      }
      const start = await loadAbaStart(db, childId, { config, band: o.settings.band, soundOn: o.settings.soundEffects, observers: o.observers, primaryObserverId: o.primaryObserverId, now });
      if (unmounted.current) return;
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
      if (!unmounted.current) await advanceRef.current();
    })().catch((e: unknown) => (unmounted.current ? undefined : latest.current.fail(e)));
  }, [db, childId, config, clock, height, width, insets.bottom, router, setPhase]);

  useEffect(() => {
    // системный «назад» (жест от края, ладонь у кромки) не выходит мимо удержания выхода
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  // сворачивание и возврат (фаза 8): уход — снимок с моментом ухода (или строка хвоста) и пустой экран; возврат —
  // `loadAbaResume`: та же проба / новый выбор / просрочка; ветки возврата не начинают новую сессию
  const bgOn = phase.kind !== 'loading' && phase.kind !== 'ended';
  const onLeave = (now: number) => {
    // лежащего пальца и следов касаний после возврата не существует (`child-ux-specialist`, огр. 7)
    held.current = null;
    releasedAt.current = -Infinity;
    breakTrace.current = false;
    fromFullBoard.current = false;
    const p = phase;
    leaves.current += 1;
    showPhase({ kind: 'away' });
    away.current = true;
    // возврат не успел показать кадр: это тот же уход, момент — первый, иначе фон первого ухода стал бы рабочим временем
    if (p.kind === 'away') return;
    leftAt.current = now;
    if (finished.current) {
      tail.leaveOn(p, now);
      return;
    }
    if (p.kind === 'access') accessLeft.current = { scenes: accessScenesAtEnd(p, now), run: p.run };
    const unseen = exchangePending.current || (p.kind === 'exchange' && p.next !== 'tail');
    if (!db || !childId || !st.current) return;
    // снимок с моментом ухода — после идущей записи; ждёт его только возврат, иначе шаг в работе ждал бы сам себя; ошибки —
    // только `__DEV__`: пауза или отзыв в этот миг — штатный ход, на возврате их увидит `loadAbaResume`
    inFlight.current = Promise.allSettled([writing.current, inFlight.current])
      .then(() =>
        boardRetry(async () => {
          if (!st.current || finished.current) return;
          st.current = await markAbaSessionLeft(db, childId, unseen ? exchangeUnseen(st.current, now) : st.current, new Date(now).toISOString());
        }),
      )
      .catch((e: unknown) => {
        if (__DEV__) console.warn('aba-session-leave', e);
      });
  };
  const onReturn = (now: number) => {
    if (squeezed.current) return; // окно ещё сжато (№182): продолжит возврат размера окна
    const mine = leaves.current;
    run(
      (async () => {
        await Promise.allSettled([writing.current, inFlight.current]);
        // снова свернули, пока шла запись: решит следующий возврат
        if (mine !== leaves.current) return;
        if (finished.current) {
          away.current = false;
          tail.back(now);
          return;
        }
        if (!db || !childId) {
          endWithoutWrite();
          return;
        }
        const r = await loadAbaResume(db, childId, { soundOn: startOpts.current.settings.soundEffects, now });
        if (mine !== leaves.current) return;
        if (r.kind === 'none' || r.kind === 'blocked') {
          // снимка нет (отзыв) или писать нельзя (пауза): конец без записи, новую сессию возврат не начинает
          endWithoutWrite();
          return;
        }
        if (r.kind === 'abandon') {
          await latest.current.abandonAndLeave(r.leftAt);
          return;
        }
        // тёплый возврат: обучение карточке продолжается (refs целы) — `cardLeft` не трогаем
        away.current = false;
        await latest.current.resumeFrom(r.state, r.leftAt, { cold: false });
      })().catch((e: unknown) => {
        // возврат не удался — кадр не должен остаться пустым: дальше обычный разбор ошибки
        if (mine === leaves.current) away.current = false;
        throw e;
      }),
    );
  };
  useAbaBackground({ enabled: bgOn, onLeave, onReturn });
  // окно перестало вмещать раскладку тира (№182) — тем же путём, что уход в фон; вместило снова — тот же возврат
  const [, retiered] = useState(0);
  const squeezed = useWindowSqueeze({
    ...{ tier: tierRef.current, measured, enabled: bgOn, onSqueeze: onLeave, onRelease: onReturn },
    onRetier: (next) => {
      tierRef.current = next;
      retiered((n) => n + 1);
    },
  });

  // --- сроки фаз
  const dueAt = phaseDueAt(phase);

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
          const wait = gateWait(p.gate, at, held.current, releasedAt.current);
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
              setPhase(participationPhase({ now: at, field: p.field, then: null, board: st.current!.board, fills: exchangePending.current, breakAsked: p.breakAsked }));
              return;
            }
            run(advance());
            return;
          } else if (fx.kind === 'exchange') {
            // жетон пробы заполнил доску (№172): через 700 мс после посадки — смена кадра на обмен
            const wait = p.gate ? gateWait(p.gate, at, held.current, releasedAt.current) : null;
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
        if (p.pairing && !exchangeView(p.run, p.tick).tokenInCell && exchangeView(p.run, at).tokenInCell) {
          voice.say('abaSession.sound.token');
          tail.pairingTokenLanded(at);
        }
        if (exchangeView(p.run, at).stage !== 'done') {
          setPhase({ ...p, tick: at });
          return;
        }
        // доступ открывается в конце раскрытия — его время считается отсюда
        const opened = exchangeEndsAt(p.run);
        if (p.next === 'tail') {
          tail.next(opened);
          return;
        }
        setPhase({ kind: 'access', run: startAccess(opened, p.next.durationMs, 0, still), tick: opened, tail: false, sceneEndedAt: null, trace: p.trace, scenes: [], sceneFrom: opened });
        // обмен досмотрен, сцена началась: обмен выдан (№181), снимок с `accessStartedAt` — холодный старт не покажет обмен второй раз
        st.current = accessShown(st.current!);
        run(writeAside());
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
            const scenes = accessScenesAtEnd({ ...p, sceneEndedAt }, fx.at);
            if (p.tail) {
              tail.accessGiven(scenes);
              tail.next(fx.at);
            } else run(endAccess(fx.at, scenes));
            return;
          }
        }
        setPhase({ ...p, run: next, tick: at, sceneEndedAt });
        return;
      }
      case 'end_wait':
        tail.next(at);
        return;
    }
  });

  // --- обучение карточке «перерыв»
  const cardOpportunity = (touched: boolean) =>
    run(
      (async () => {
        const p = phase;
        if (p.kind !== 'card' || !st.current) return;
        setPhase({ kind: 'busy' });
        const now = clock.now();
        const gestureGiven = p.step !== 'model' && p.gesture;
        // самостоятельное касание — карточка принята на сегодня: остальные возможности не нужны
        cardLeft.current = touched && !gestureGiven && p.step === 'independent' ? 0 : cardLeft.current - 1;
        cardIdx.current += 1;
        await saveStep((c) => recordBreakCardTraining(c, { step: p.step, touched, gestureGiven, latencyMs: touched ? now - p.shownAt : null }, now));
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
            let exchanged = false;
            await saveStep(
              (c) => {
                const s = chooseReinforcer(c, fx.reinforcerId, fx.at, fx.by);
                exchanged = s.exchangesMade > c.exchangesMade;
                return s;
              },
              { source: 'session', sourceId: st.current!.sessionId, reinforcerId: fx.reinforcerId, chosenBy: fx.by },
            );
            // повторный выбор при полной доске сам меняет жетоны (`settleBoard`): доступ — тоже через экран обмена (Ц3.4)
            if (exchanged) exchangePending.current = true;
            await advance();
          })(),
        );
      } else if (fx.type === 'no_choice') {
        // «Сам», 60 с без выбора — сессия не начиналась: спокойный конец; конец уже наступил — итог с его причиной, это не уход
        const cur = st.current!;
        run(finish(cur.endReason ? noChoiceAtEnd(cur, fx.at) : stopSession(cur, 'abandoned', fx.at), 'neutral'));
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
    // после конфликта доски проба считается заново от живой доски: один жетон, одна строка журнала
    const { s, res } = await boardRetry(async () => {
      const before = st.current!;
      const out = recordTrial(before, matchTrialInput(r), clock.now());
      if (!out.ok) throw new Error(out.errors.join('; '));
      st.current = db && childId ? await recordAbaTrial(db, childId, out.trial, out.state, iso()) : out.state;
      return { s: before, res: out };
    });
    const earnedBefore = s.board.earned;
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
    const stripEarned = res.exchanged > 0 ? Math.min(s.board.size, earnedBefore + tokens) : Math.max(0, st.current!.board.earned - (res.participation ? 1 : 0));
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
        await saveStep((s) => {
          const last = s.trials[s.trials.length - 1];
          return withdrawAssent(s, clock.now(), 'adult_observed', last ? { targetId: last.targetId, trialId: last.id } : {});
        });
        await advance();
      })(),
    );

  /** Карточка «перерыв» в паузе перед SD (№160): просьба не теряется — перерыв вместо SD. */
  const breakInPause = () =>
    run(
      (async () => {
        setPhase({ kind: 'busy' });
        await saveStep((s) => requestBreakBetweenTrials(s, clock.now()));
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
    setPhase((p) => gateOnHold(p, now));
  };
  const release = () => {
    held.current = null;
    const now = clock.now();
    releasedAt.current = now;
    setPhase((p) => gateOnRelease(p, now));
  };
  /**
   * Палец лежит и в потолке — касание засчитывается в момент смены кадра (`atCeiling: 'commit_if_inside'`): карточка —
   * просьба о перерыве (обмен идёт, след остаётся); «Отказ» сам ведёт дальше — тогда `true`. Раньше потолка и касание,
   * начатое до показа кадра, не засчитываются. Инвариант (Ж19): пока лежит засчитываемый палец, `frameAt` всегда равен
   * потолку — его ставят `gateWait` и `gateOnHold` (`sessionPhase.test.ts`), а `at` здесь — это `frameAt`; проверка
   * `at < gate.ceilingAt` — вторая линия той же защиты, отдельно недостижимая.
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
    return writeAside();
  }

  // --- перерыв и доступ
  /** `endedAt` — конец перерыва для процедуры, если он истёк в фоне раньше `at` (фаза 8): событие до срока, фон — не работа. */
  async function endBreak(at: number, endedAt: number = at) {
    setPhase({ kind: 'busy' });
    let exchanged = false;
    await saveStep((s) => {
      const done = finishBreak(s, at, endedAt);
      exchanged = done.exchanged > 0;
      return done.state;
    });
    // обмен на перерыве по расписанию (№169): доступ следующим шагом домена — сначала экран обмена
    if (exchanged) exchangePending.current = true;
    await advance();
  }
  /** Нет возврата после двух приглашений: конец по бездействию устройства — без обмена и сопряжения (№169). */
  async function noReturn(at: number) {
    setPhase({ kind: 'busy' });
    await saveStep((s) => {
      const last = s.trials[s.trials.length - 1];
      return withdrawAssent(s, at, 'device_inactivity', last ? { targetId: last.targetId, trialId: last.id } : {});
    });
    await advance();
  }
  /**
   * Конец доступа: в журнал — отрезки сцены (№171; после сворачивания их может быть два или ноль — фаза 8), рабочее время
   * теряет весь шаг с обменом и кадром конца.
   */
  async function endAccess(at: number, scenes: AccessScene[]) {
    setPhase({ kind: 'busy' });
    await saveStep((s) => finishAccess(s, at, scenes));
    await advance();
  }
  const takeCard = () =>
    run(
      (async () => {
        const p = phase;
        if (p.kind !== 'break') return;
        setPhase({ kind: 'busy' });
        const now = clock.now();
        await saveStep((s) => takeBreakCard(s, now));
        const step = nextStep(st.current!, now).step;
        if (step.kind === 'break')
          setPhase({ kind: 'break', step, startedAt: now, shownAt: now, until: now + (step.maxMs ?? CHILD_BREAK_MS[st.current!.band]), invite: 0, inviteAt: null, training: false });
      })(),
    );

  // --- выход удержанием: остановка взрослым (в «Сам» — уход ребёнка)
  const exit = () => {
    // итог пишется: конец сам запишет строку хвоста и уйдёт с экрана
    if (closing.current) {
      exiting.current = true;
      return;
    }
    if (!st.current || finished.current) {
      // выход на шаге хвоста — тот же уход: строка с выданным и шагом выхода
      if (finished.current) tail.leaveOn(phase, clock.now(), true);
      leaveAba(router);
      return;
    }
    exiting.current = true;
    // запись в работе (проба) — итог после неё, иначе журнал и итог разойдутся; доступ в журнале — время сцены (№171)
    run(
      inFlight.current.then(async () => {
        const s = st.current;
        if (!s || finished.current) return;
        const stop = stopPoint();
        await finish(stopSession(s, s.config === 'alone' ? 'abandoned' : 'adult_stopped', stop.at, stop.scenes), 'neutral', stop.endedAt);
      }),
    );
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
  // тир — один раз на сессию (`abaWindowPolicy.tierChosen`): зафиксирован на старте; до первого `onLayout` кадра ещё нет
  const tier = tierRef.current;
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
    case 'away':
      body = <AwayFrame squeezed={squeezed.current} />;
      break;
    case 'ended':
      body = <AbaEnd variant={phase.variant} board={phase.board ?? undefined} onDone={() => leaveAba(router)} />;
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
      body = (
        <ChooseFrame
          run={phase.choice}
          options={phase.options}
          cardSize={height ? abaReinforcerCardSize(width - 32, height) : 160}
          boardCells={s?.board.size ?? 1}
          onTap={(id, at) => onChoice({ type: 'tap', reinforcerId: id, now: at })}
          onAdultTap={(id) => onChoice({ type: 'adult_tap', reinforcerId: id, now: clock.now() })}
        />
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
      body = (
        <TrialFrame
          phase={phase}
          step={step}
          session={s!}
          layout={layout}
          zone={zone}
          calm={calm}
          still={still}
          strip={strip}
          sdKey={sdKeyOf(step)}
          instruction={instruction}
          panel={panel}
          onTrial={onTrial}
          onBreakCard={() => (phase.kind === 'pause' ? breakInPause() : phase.kind === 'participation' ? breakInParticipation() : breakInConsequence())}
          onHoldCard={holdCard}
          onRefuse={refuseOutsideTrial}
        />
      );
      break;
    }
    case 'break': {
      const offer = phase.step.offerCardMs !== undefined;
      if (offer) {
        // пауза после «Отказ»: экран пробы без плит, карточка с контуром 6 всю паузу (Ц3.7, №171) — смена посреди
        // паузы была бы повторной подсказкой; жест и подпись взрослому — только `offerCardMs`
        const hint = (phase.tick ?? phase.shownAt) < phase.startedAt + phase.step.offerCardMs!;
        body = (
          <>
            <TopBar breakCard={{ frameShownAt: phase.shownAt, onTap: takeCard, highlight: true, onHold: holdCard }} />
            {strip}
            <View style={{ flex: 1 }} testID="aba-refusal-pause" />
            {panel(['refusal'], null, refuseOutsideTrial, hint ? t('abaSession.offerCardHint') : undefined)}
          </>
        );
      } else {
        body = <BreakView phase={phase} onReturn={(at) => run(endBreak(at))} />;
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
        setMeasured({ height: e.nativeEvent.layout.height - insets.top - insets.bottom, width: e.nativeEvent.layout.width, insetBottom: insets.bottom });
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
