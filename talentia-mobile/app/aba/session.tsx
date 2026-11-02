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
 * - перерыв (фаза 7, №169): кольцо → приглашение → через `RETURN_INVITE_AFTER_MS` второе → ещё столько же без возврата —
 *   `withdrawAssent(…, 'device_inactivity')`; обучающий перерыв по карточке сессию не кончает — возврат делает взрослый;
 * - обмен (сразу, на перерыве, в конце) — один экран без кнопки: доска полная → жетоны уходят в карточку → доступ
 *   (`model/accessRun.ts`: «закругляемся», доигрывание, кольцо исчезает, через 1 с дальше);
 * - конец: итог пишется сразу, затем хвост (`model/endTail.ts`) — обмен и доступ или цикл сопряжения, потом
 *   «Закончили» с доской; выход удержанием — `stopSession`.
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
  abaChoiceZone,
  abaLayoutByTier,
  abaPairingLayout,
  abaReinforcerCardSize,
  abaReinforcementOverlay,
  abaTierFor,
  abaTokenBoard,
  ABA_CONTROL_STROKE,
  type AbaTier,
} from '../../src/design/abaTokens';
import { motion, radii } from '../../src/design/tokens';
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
import { PlaceholderScene } from '../../src/ui/aba/access/PlaceholderScene';
import { useAbaClock, useDue } from '../../src/ui/aba/clock';
import { accessDueAt, accessLeft, startAccess, stepAccess, type AccessRun } from '../../src/ui/aba/model/accessRun';
import { advanceConsequence, consequenceDueAt, startConsequence, type ConsequenceRun } from '../../src/ui/aba/model/consequenceRun';
import { matchDueAt, matchTrialInput, matchVisual, optionActive, startMatchTrial, stepMatchTrial, type MatchEvent, type MatchTrialRun } from '../../src/ui/aba/model/matchTrialRun';
import { endTail, type TailStep } from '../../src/ui/aba/model/endTail';
import { pairingTokenTiming } from '../../src/ui/aba/model/pairingRun';
import { choiceDueAt, startChoice, stepChoice, type ChoiceRun } from '../../src/ui/aba/model/reinforcerChoiceRun';
import { ChildPressable, ExitHold, PlaceholderGlyph, useAbaColors } from '../../src/ui/aba/parts';
import { AccessRing, ReinforcerArt, ReinforcerChoiceView, TokenCell } from '../../src/ui/aba/reinforcer';
import { AdultPanel, MatchField, ReinforcementOverlay, TokenStrip, TopBar } from '../../src/ui/aba/session/parts';
import { TaliFigure } from '../../src/ui/TaliFigure';

const ZONE: Record<AbaTier, (typeof abaChoiceZone)[keyof typeof abaChoiceZone]> = {
  roomy: abaChoiceZone.regular,
  compact: abaChoiceZone.compact,
  tight: abaChoiceZone.tight,
};
const CARD_STEPS: BreakCardStep[] = ['model', 'prompted', 'independent'];
/** Жетон за участие: после приземления в полосе — секунда до следующего шага (как добавленный отменой, Ц2.6.3). */
const PARTICIPATION_HOLD_MS = 1000;
/**
 * Второе приглашение вернуться отличимо от первого без звука (методист, фаза 7: повтор без смены стимула — не
 * предъявление): контур 6 снимается на этот срок и возвращается. Вид — на проверку `design-lead`.
 */
const REINVITE_BLINK_MS = motion.base;

type EndBoard = { cells: number; filled: number } | null;

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
    }
  /** Жетон за участие (ABA.md: отдельным событием): короткое падение в ячейку полосы, затем шаг домена. */
  | { kind: 'participation'; landAt: number; until: number; earned: number; field: TrialStep | null; then: AbaStep | null }
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
      blinkUntil: number | null;
      training: boolean;
    }
  /** Обмен без кнопки: доска полная до `flyAt`, затем жетоны уходят в карточку; дальше — доступ шага или хвост конца. */
  | { kind: 'exchange'; cells: number; flyAt: number; until: number; flown: boolean; next: Extract<AbaStep, { kind: 'access' }> | 'tail' }
  | { kind: 'access'; run: AccessRun; tick: number; tail: boolean }
  /** Цикл сопряжения в конце: одна ячейка и Tali `point`, жетон, обмен (как в сессии сопряжения). */
  | { kind: 'pairing_token'; landAt: number; flyAt: number; until: number; flown: boolean }
  | { kind: 'busy' }
  /** `until` — «Готово» неактивна до цикла сопряжения; `null` — конец. */
  | { kind: 'ended'; variant: 'normal' | 'neutral'; board: EndBoard; until: number | null };

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
  const finished = useRef(false);
  const exiting = useRef(false);
  /** Обмен прошёл (сразу, на перерыве): следующий доступ начинается с экрана обмена, а до него доска видна полной. */
  const exchangePending = useRef(false);
  const tail = useRef<TailStep[]>([]);
  const endView = useRef<{ variant: 'normal' | 'neutral'; board: EndBoard }>({ variant: 'neutral', board: null });
  // старт один раз: настройки и наблюдатели берутся на момент старта
  const startOpts = useRef({ settings, observers, primaryObserverId });
  const calm = startOpts.current.settings.calmMode;

  const iso = useCallback(() => new Date(clock.now()).toISOString(), [clock]);
  const boardOf = (s: AbaSessionState | null): EndBoard => (s ? { cells: s.board.size, filled: s.board.earned } : null);
  const fail = useCallback((e: unknown) => {
    if (__DEV__) console.warn('aba-session', e);
    // доска и при ошибке видна как есть (Ц2.10): жетоны не пропадают
    setPhase({ kind: 'ended', variant: 'neutral', board: boardOf(st.current), until: null });
  }, []);

  /** Следующий шаг хвоста конца: обмен, доступ, ожидание цикла, жетон сопряжения, «Закончили». */
  const nextTail = useCallback(
    (now: number) => {
      const step = tail.current.shift() ?? { kind: 'end' as const };
      const { variant, board } = endView.current;
      const tm = pairingTokenTiming(calm);
      switch (step.kind) {
        case 'exchange':
          setPhase({ kind: 'exchange', cells: step.boardSize, flyAt: now + tm.holdMs, until: now + tm.holdMs + tm.exchangeMs, flown: false, next: 'tail' });
          return;
        case 'access':
          setPhase({ kind: 'access', run: startAccess(now, step.durationMs), tick: now, tail: true });
          return;
        case 'wait':
          setPhase({ kind: 'ended', variant, board, until: now + step.ms });
          return;
        case 'pairing_token':
          setPhase({ kind: 'pairing_token', landAt: now + tm.landMs, flyAt: now + tm.landMs + tm.holdMs, until: now + tm.landMs + tm.holdMs + tm.exchangeMs, flown: false });
          return;
        case 'end':
          setPhase({ kind: 'ended', variant, board, until: null });
      }
    },
    [calm],
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
        router.replace('/map');
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
    const cur = st.current;
    if (!cur || finished.current) return;
    const now = clock.now();
    const next = nextStep(cur, now);
    st.current = next.state;
    // жетон за участие заполнил доску и обмен прошёл сразу: до экрана обмена доска видна полной, а не пустой
    if (next.state.exchangesMade > cur.exchangesMade) exchangePending.current = true;
    // жетон за участие от закрытия блока (`nextStep`) — своим событием до шага
    if (next.participation) {
      const earned = exchangePending.current ? next.state.board.size : next.state.board.earned;
      setPhase({ kind: 'participation', landAt: now + motion.quick, until: now + motion.quick + PARTICIPATION_HOLD_MS, earned, field: null, then: next.step });
      return;
    }
    await show(next.step, now);
  }
  // старт зовёт шаг через ссылку: функция пересоздаётся на каждом рендере
  const advanceRef = useRef(advance);
  advanceRef.current = advance;

  async function show(step: AbaStep, now: number) {
    const cur = st.current!;
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
        setPhase({ kind: 'break', step, shownAt: now, until: now + (step.maxMs ?? CHILD_BREAK_MS[cur.band]), invite: 0, inviteAt: null, blinkUntil: null, training });
        return;
      }
      case 'access':
        if (exchangePending.current) {
          exchangePending.current = false;
          const tm = pairingTokenTiming(calm);
          setPhase({ kind: 'exchange', cells: cur.board.size, flyAt: now + tm.holdMs, until: now + tm.holdMs + tm.exchangeMs, flown: false, next: step });
        } else setPhase({ kind: 'access', run: startAccess(now, step.durationMs), tick: now, tail: false });
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
        setPhase({ kind: 'ended', variant: 'neutral', board: null, until: null });
        return;
      }
      st.current = startAbaSession(start.input);
      // в плане нет ни одной пробы («Сам» без разблокированного формата): сессию не начинаем и не пишем —
      // «нормальный» конец ни за что и пустая сессия в данных (`aba-pedagogy-specialist` 2026-10-31)
      if (!st.current.queue.some((q) => q.kind === 'trial')) {
        setPhase({ kind: 'ended', variant: 'neutral', board: null, until: null });
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
        return consequenceDueAt(phase.run);
      case 'participation':
        return clock.now() < phase.landAt ? phase.landAt : phase.until;
      case 'break':
        // кольцо — шагами по 1 с (`abaBreak.timerCalmStepMs`), у паузы после «Отказ» — один срок
        if (phase.step.offerCardMs) {
          const cardEnd = phase.shownAt + phase.step.offerCardMs;
          return (phase.tick ?? phase.shownAt) < cardEnd ? cardEnd : phase.until;
        }
        if (phase.invite === 0) return Math.min((phase.tick ?? phase.shownAt) + abaBreak.timerCalmStepMs, phase.until);
        if (phase.blinkUntil !== null) return phase.blinkUntil;
        // после второго приглашения обучающий перерыв ждёт взрослого: конца по бездействию нет
        if (phase.invite === 2 && phase.training) return null;
        return phase.inviteAt! + RETURN_INVITE_AFTER_MS;
      case 'exchange':
      case 'pairing_token':
        return phase.flown ? phase.until : phase.flyAt;
      case 'access': {
        const due = accessDueAt(phase.run);
        return phase.run.stage === 'play' && due !== null ? Math.min(phase.tick + abaBreak.timerCalmStepMs, due) : due;
      }
      case 'ended':
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
      case 'participation':
        if (at < p.until) setPhase({ ...p });
        else run(p.then ? show(p.then, at) : advance());
        return;
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
              const earned = exchangePending.current ? st.current!.board.size : st.current!.board.earned;
              setPhase({ kind: 'participation', landAt: at + motion.quick, until: at + motion.quick + PARTICIPATION_HOLD_MS, earned, field: p.field, then: null });
              return;
            }
            run(advance());
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
        } else if (p.blinkUntil !== null) setPhase({ ...p, blinkUntil: null });
        else if (p.invite === 1) {
          voice.say('abaSession.sound.invite');
          setPhase({ ...p, invite: 2, inviteAt: at, blinkUntil: at + REINVITE_BLINK_MS });
        } else run(noReturn(at));
        return;
      }
      case 'exchange':
        if (!p.flown) setPhase({ ...p, flown: true });
        else if (p.next === 'tail') nextTail(at);
        else setPhase({ kind: 'access', run: startAccess(at, p.next.durationMs), tick: at, tail: false });
        return;
      case 'pairing_token':
        if (!p.flown) setPhase({ ...p, flown: true });
        else nextTail(at);
        return;
      case 'access': {
        const { run: next, effects } = stepAccess(p.run, at);
        for (const fx of effects) {
          // «закругляемся» (`abaAccessScene.endCue`): файл подключит озвучка, без звука конец несёт кольцо
          if (fx.type === 'cue') voice.say('abaSession.sound.wrapUp');
          else if (fx.type === 'done') {
            if (p.tail) nextTail(fx.at);
            else run(endAccess(fx.at));
            return;
          }
        }
        setPhase({ ...p, run: next, tick: at });
        return;
      }
      case 'ended':
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
    setPhase({
      kind: 'consequence',
      run: startConsequence({ markedAt, feedback: res.award.feedback, calm }),
      overlay,
      earnedBefore,
      landed: false,
      empty: false,
      field: step,
      stripEarned,
      participation: res.participation,
      chosenId: r.chosenCardId,
      breakAsked: false,
    });
  }

  /** «Отказ» вне пробы (последствие, пауза, пауза после «Отказ»): отказ вне пробы — `withdrawAssent` (спецификация п. 1). */
  const refuseOutsideTrial = () =>
    run(
      (async () => {
        const s = st.current!;
        const last = s.trials[s.trials.length - 1];
        setPhase({ kind: 'busy' });
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
  const breakInParticipation = () =>
    run(
      (async () => {
        st.current = await save(requestBreakBetweenTrials(st.current!, clock.now()));
        setPhase((p) => (p.kind === 'participation' ? { ...p, then: null } : p));
      })(),
    );

  /** Карточка «перерыв» в фазе последствия (№160): просьба — в домен сразу, плашка доигрывает. */
  const breakInConsequence = () =>
    run(
      (async () => {
        setPhase((p) => (p.kind === 'consequence' ? { ...p, breakAsked: true } : p));
        st.current = await save(requestBreakBetweenTrials(st.current!, clock.now()));
      })(),
    );

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
  async function endAccess(at: number) {
    setPhase({ kind: 'busy' });
    st.current = await save(finishAccess(st.current!, at));
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
          setPhase({ kind: 'break', step, shownAt: now, until: now + (step.maxMs ?? CHILD_BREAK_MS[st.current.band]), invite: 0, inviteAt: null, blinkUntil: null, training: false });
      })(),
    );

  // --- выход удержанием: остановка взрослым (в «Сам» — уход ребёнка)
  const exit = () => {
    const s = st.current;
    if (!s || finished.current) {
      router.replace('/map');
      return;
    }
    exiting.current = true;
    run(finish(stopSession(s, s.config === 'alone' ? 'abandoned' : 'adult_stopped', clock.now()), 'neutral'));
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
  const tier = height === null ? null : abaTierFor(height, insets.bottom);
  const layout = abaLayoutByTier[tier ?? 'compact'];
  const zone = ZONE[tier ?? 'compact'];
  const withAdult = s?.config === 'with_adult';

  const shownEarned =
    phase.kind === 'consequence' ? phase.stripEarned : phase.kind === 'participation' ? Math.max(0, phase.earned - (clock.now() < phase.landAt ? 1 : 0)) : (s?.board.earned ?? 0);
  const strip = s ? <TokenStrip reinforcerId={s.reinforcerId} size={s.board.size} earned={shownEarned} /> : null;
  const panel = (buttons: readonly PanelButton[], pressed: PanelButton | null, onPress: (b: PanelButton, at: number) => void, caption?: string) =>
    withAdult ? <AdultPanel buttons={buttons} height={layout.adultPanel} insetBottom={insets.bottom} caption={caption} pressed={pressed} onPress={onPress} /> : <View style={{ height: layout.adultPanel }} />;
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
      body = <AbaEnd variant={phase.variant} board={phase.board ?? undefined} doneEnabled={phase.until === null} onExit={exit} onDone={() => router.replace('/map')} />;
      break;
    case 'card': {
      // сменился ведущий наблюдатель — подсказка взрослому «жестом, не словами» (`BreakCardPlan.adultCoaching`)
      const caption =
        coaching.current && phase.gesture ? t('abaSession.offerCardHint') : t(`abaSession.breakTraining.${phase.step === 'independent' && phase.gesture ? 'gesture' : phase.step}`);
      body = (
        <>
          <TopBar onExit={exit} breakCard={{ frameShownAt: phase.shownAt, onTap: () => cardOpportunity(true) }} />
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
          {/* строка инструкции 72: выход слева, заголовок по центру, справа место под повтор (раздел 4) */}
          <View style={{ height: 72, flexDirection: 'row', alignItems: 'flex-start', paddingTop: 6 }}>
            <ExitHold onExit={exit} label={t('abaSession.exit')} hintLabel={t('abaSession.exitHint')} />
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', height: 60 }}>
              <Text style={{ color: c.ink, fontSize: 22, lineHeight: 30, fontWeight: '700', textAlign: 'center' }} numberOfLines={2} maxFontSizeMultiplier={1.2}>
                {t('abaSession.chooseTitle')}
              </Text>
            </View>
            <View style={{ width: 60 }} />
          </View>
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
            <TopBar onExit={exit} breakCard={{ frameShownAt: 0, onTap: breakInParticipation }} />
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
            onExit={exit}
            breakCard={{
              frameShownAt: phase.kind === 'consequence' ? phase.run.markedAt : frame,
              highlight: phase.kind === 'consequence' && phase.breakAsked,
              onTap: (at) =>
                phase.kind === 'trial' ? onTrial({ type: 'break_card', at }) : phase.kind === 'pause' ? breakInPause() : phase.kind === 'participation' ? breakInParticipation() : breakInConsequence(),
            }}
          />
          {phase.kind === 'consequence' && phase.overlay ? (
            <ReinforcementOverlay size={s!.board.size} earnedBefore={phase.earnedBefore} landed={phase.landed} calm={calm} height={Math.min(overlayH, abaReinforcementOverlay.tali + 288)} />
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
        // пауза после «Отказ»: экран пробы без плит, карточка подсвечена статичным контуром 6 на `offerCardMs`
        const highlight = (phase.tick ?? phase.shownAt) < phase.shownAt + phase.step.offerCardMs!;
        body = (
          <>
            <TopBar onExit={exit} breakCard={{ frameShownAt: phase.shownAt, onTap: takeCard, highlight }} />
            {strip}
            <View style={{ flex: 1 }} testID="aba-refusal-pause" />
            {/* подсказка взрослому «жестом» — только пока карточка подсвечена (`offerCardMs`) */}
            {panel(['refusal'], null, refuseOutsideTrial, highlight ? t('abaSession.offerCardHint') : undefined)}
          </>
        );
      } else {
        const left = (phase.until - (phase.tick ?? phase.shownAt)) / (phase.until - phase.shownAt);
        body = (
          <View style={{ flex: 1 }} testID="aba-break">
            <TopBar onExit={exit} breakCard={null} />
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24 }}>
              <View style={{ width: abaBreak.timerRing, height: abaBreak.timerRing, alignItems: 'center', justifyContent: 'center' }}>
                {phase.invite === 0 && (
                  <View style={{ position: 'absolute' }}>
                    <AccessRing left={left} size={abaBreak.timerRing} />
                  </View>
                )}
                {/* «две планки» 120 — внутри кольца и после него: место не пустеет (`abaBreak.atTimerEnd`) */}
                <PlaceholderGlyph name="pause_bars" size={abaBreak.icon} color={c.ink} />
              </View>
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
                borderWidth: phase.invite > 0 && phase.blinkUntil === null ? 6 : ABA_CONTROL_STROKE,
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
    case 'access': {
      const ring = phase.run.stage === 'play' || phase.run.stage === 'settle';
      body = (
        <View style={{ flex: 1, paddingHorizontal: 16 }} testID={`aba-access-${phase.run.stage}`}>
          <View style={{ height: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <TopBar onExit={exit} breakCard={null} />
          </View>
          {/* место кольца остаётся и после него: сцена не прыгает */}
          <View style={{ alignItems: 'center', height: 56 }}>{ring && <AccessRing left={accessLeft(phase.run, phase.tick)} />}</View>
          <View style={{ flex: 1, marginVertical: 16 }}>{s?.reinforcerId && <PlaceholderScene reinforcerId={s.reinforcerId} ended={phase.run.stage !== 'play'} />}</View>
        </View>
      );
      break;
    }
    case 'exchange':
    case 'pairing_token': {
      // обмен без кнопки «Получить!» (как в сопряжении): требования к ребёнку нет, жетоны уходят в карточку сами
      const pairing = phase.kind === 'pairing_token';
      // полёта в карточку пока нет: жетоны лежат до кадра доступа, как в сопряжении (`pairing.tsx`) — пустая доска
      // перед доступом читалась бы как «жетоны пропали» (`child-ux-specialist`, фаза 7)
      const filled = !pairing || calm || clock.now() >= phase.landAt;
      body = (
        <View style={{ flex: 1, paddingHorizontal: 16 }} testID={pairing ? 'aba-end-pairing' : 'aba-exchange'}>
          <View style={{ height: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <TopBar onExit={exit} breakCard={null} />
          </View>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            {s?.reinforcerId && (
              // касание карточки отвечает сжатием, без действия и записи: ни одна цель не молчит (как в сопряжении)
              <Pressable
                accessibilityRole="image"
                accessibilityLabel={t('abaSession.tali')}
                testID="aba-exchange-card"
                style={({ pressed }) => ({
                  transform: [{ scale: pressed ? 0.94 : 1 }],
                  width: abaPairingLayout.cardSize,
                  height: abaPairingLayout.cardSize,
                  borderRadius: radii.lg,
                  borderWidth: ABA_CONTROL_STROKE,
                  borderColor: c.controlInk,
                  backgroundColor: c.plate,
                  alignItems: 'center',
                  justifyContent: 'center',
                })}
              >
                <ReinforcerArt id={s.reinforcerId} size={abaPairingLayout.cardSize - 32} />
              </Pressable>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: abaPairingLayout.gapCardRow, gap: pairing ? abaPairingLayout.gapTaliCell : abaTokenBoard.gap }}>
              {pairing ? (
                <>
                  <TaliFigure pose="point" size={abaPairingLayout.tali} crop accessibilityLabel={t('abaSession.tali')} />
                  <TokenCell size={abaPairingLayout.cell} filled={filled} testID={filled ? 'aba-exchange-token-filled' : 'aba-exchange-token-empty'} />
                </>
              ) : (
                Array.from({ length: phase.cells }, (_, i) => (
                  <TokenCell key={i} size={abaTokenBoard.size} filled={filled} testID={filled ? 'aba-exchange-token-filled' : 'aba-exchange-token-empty'} />
                ))
              )}
            </View>
          </View>
        </View>
      );
      break;
    }
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
      <View style={{ flex: 1, paddingHorizontal: phase.kind === 'choose' || phase.kind === 'access' || phase.kind === 'exchange' || phase.kind === 'pairing_token' || phase.kind === 'ended' ? 0 : 16 }}>{body}</View>
    </View>
  );
}
