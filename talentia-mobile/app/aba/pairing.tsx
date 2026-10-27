/**
 * Сессия сопряжения (раздел 3 направления, Ц2.4; домен `abaPairing.ts`, модель `src/ui/aba/model/pairingRun.ts`):
 * выбор из трёх тапом → 10 с ожидания → жетон в ячейку из одной → сразу обмен → доступ 20 с; четыре цикла, затем
 * `commitPairingSession` и конец. Панели взрослого нет; выход — удержанием в строке 72. Середина сопряжения не
 * сохраняется: убитое приложение теряет его выборы (риск плана, подтвердить у `aba-pedagogy-specialist`).
 */
import { useKeepAwake } from 'expo-keep-awake';
import { Redirect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { abaPairingLayout, abaReinforcerCardSize, abaReinforcerChoice } from '../../src/design/abaTokens';
import { pairingResultOf, startPairing } from '../../src/domain/abaPairing';
import { PAIRING } from '../../src/domain/abaTokenTraining';
import { seeded } from '../../src/domain/abaRandom';
import { newAbaId } from '../../src/services/abaIds';
import { loadPairingStart } from '../../src/services/local/abaStart';
import { commitPairingSession } from '../../src/services/local/commit';
import { useAbaRun } from '../../src/state/abaRun';
import { useAccount } from '../../src/state/account';
import { useChildSession } from '../../src/state/childSession';
import { AbaEnd } from '../../src/ui/aba/AbaEnd';
import { PlaceholderScene } from '../../src/ui/aba/access/PlaceholderScene';
import { useAbaClock, useDue } from '../../src/ui/aba/clock';
import { pairingRunDueAt, startPairingRun, stepPairingRun, type PairingRun, type PairingRunEvent } from '../../src/ui/aba/model/pairingRun';
import { ExitHold, useAbaColors } from '../../src/ui/aba/parts';
import { AccessRing, ReinforcerArt, ReinforcerChoiceView, TokenCell } from '../../src/ui/aba/reinforcer';
import { TaliFigure } from '../../src/ui/TaliFigure';

type Ended = { variant: 'normal' | 'neutral'; toMap: boolean };

export default function AbaPairingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useAbaColors();
  const insets = useSafeAreaInsets();
  const clock = useAbaClock();
  const db = useAccount((s) => s.db);
  const childId = useChildSession((s) => s.childId);
  const soundOn = useChildSession((s) => s.settings.soundEffects);
  const calm = useChildSession((s) => s.settings.calmMode);
  const config = useAbaRun((s) => s.config);
  const [run, setRun] = useState<PairingRun | null>(null);
  const [ended, setEnded] = useState<Ended | null>(null);
  const [pulse, setPulse] = useState(false);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [tick, setTick] = useState(() => clock.now());
  const runRef = useRef<PairingRun | null>(null);
  const exiting = useRef(false);
  const finished = useRef(false);
  // экран не гаснет посреди сопряжения: погасший экран глушит таймеры, и доступ «проходил» бы без ребёнка (Б1)
  useKeepAwake();
  // старт один раз на экран: звук и calm берутся на момент старта и посреди сопряжения не перечитываются
  const startOpts = useRef({ soundOn, calm });

  useEffect(() => {
    if (!db || !childId || !config) return;
    let live = true;
    void loadPairingStart(db, childId, { config, soundOn: startOpts.current.soundOn }).then(
      (start) => {
        if (!live) return;
        if ('blocked' in start) {
          setEnded({ variant: 'neutral', toMap: false });
          return;
        }
        const now = clock.now();
        const state = startPairing({ sessionId: newAbaId(), pool: start.pool, history: start.history, rng: seeded(now >>> 0).rng, now });
        runRef.current = startPairingRun(state, config, startOpts.current.calm);
        setRun(runRef.current);
      },
      (e: unknown) => {
        if (__DEV__) console.warn('aba-pairing', e);
        if (live) setEnded({ variant: 'neutral', toMap: false });
      },
    );
    return () => {
      live = false;
    };
  }, [db, childId, config, clock]);

  const finish = useCallback(
    async (r: PairingRun) => {
      // итог пишется один раз: защита от повтора в `commitPairingSession` держится на строках выборов, а у
      // брошенной в первом цикле их нет
      if (finished.current) return;
      finished.current = true;
      const toMap = exiting.current;
      try {
        if (db && childId) await commitPairingSession(db, childId, pairingResultOf(r.state), new Date(clock.now()).toISOString());
      } catch (e) {
        // согласие отозвано или пауза — итог не пишется, конец нейтральный
        if (__DEV__) console.warn('aba-pairing-commit', e);
      }
      if (toMap) router.replace('/map');
      else setEnded({ variant: r.state.endReason === 'completed' ? 'normal' : 'neutral', toMap: false });
    },
    [db, childId, clock, router],
  );

  const dispatch = useCallback(
    (e: PairingRunEvent) => {
      const cur = runRef.current;
      if (!cur) return;
      const { run: next, effects } = stepPairingRun(cur, e);
      runRef.current = next;
      setRun(next);
      for (const fx of effects) {
        if (fx.type === 'nudge') {
          // повтор инструкции голосом — когда будет голос; пульс — кроме calm
          if (!calm) {
            setPulse(true);
            clock.at(clock.now() + abaReinforcerChoice.aloneRepeat.pulse.durationMs, () => setPulse(false));
          }
        } else if (fx.type === 'done') {
          void finish(next);
        }
        // `token_landed` — звук `token`, когда появится звук; `show_strip` рисуется из состояния
      }
    },
    [calm, clock, finish],
  );

  useDue(run ? pairingRunDueAt(run) : null, (at) => dispatch({ type: 'due', at }));
  // кольцо доступа — шагами по 1 с
  const inAccess = run?.state.phase === 'access';
  useDue(inAccess ? tick + 1000 : null, (at) => setTick(at));
  useEffect(() => {
    if (inAccess) setTick(clock.now());
  }, [inAccess, clock]);

  // свернули или заблокировали экран посреди сопряжения — сессия кончается незасчитанной (не считается и серию не
  // рвёт), конец нейтральный: просроченные стадии иначе прошли бы разом с плановыми метками (Б1)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      const cur = runRef.current;
      if (st === 'background' && cur && cur.state.phase !== 'done') dispatch({ type: 'stop', reason: 'adult_stopped', now: clock.now() });
    });
    return () => sub.remove();
  }, [dispatch, clock]);

  if (!config) return <Redirect href="/aba?mode=pairing" />;

  const exit = () => {
    if (!runRef.current || runRef.current.state.phase === 'done') {
      router.replace('/map');
      return;
    }
    exiting.current = true;
    // в «Сам» удержать выход может только ребёнок — это его уход, а не остановка взрослым (Б2)
    dispatch({ type: 'stop', reason: config === 'alone' ? 'abandoned' : 'adult_stopped', now: clock.now() });
  };

  const header = (center?: ReactNode) => (
    <View style={{ height: 72, flexDirection: 'row', alignItems: 'flex-start', paddingTop: 6 }}>
      <ExitHold onExit={exit} label={t('abaSession.exit')} hintLabel={t('abaSession.exitHint')} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', height: 60 }}>{center}</View>
      <View style={{ width: 60 }} />
    </View>
  );

  let body: ReactNode = null;
  if (ended) {
    body = <AbaEnd variant={ended.variant} onDone={() => router.replace('/map')} />;
  } else if (run) {
    const s = run.state;
    if (s.phase === 'choose' && run.choice) {
      const cardSize = size ? abaReinforcerCardSize(size.w - 32, size.h) : abaPairingLayout.cardSize;
      body = (
        <View style={{ flex: 1, paddingHorizontal: 16 }}>
          {header(
            <Text style={{ color: c.ink, fontSize: 22, lineHeight: 30, fontWeight: '700', textAlign: 'center' }} numberOfLines={2} maxFontSizeMultiplier={1.2}>
              {t(s.cycles === 0 ? 'abaSession.chooseTitle' : 'abaReinforcer.again')}
            </Text>,
          )}
          <View style={{ height: 16 }} />
          <ReinforcerChoiceView
            run={run.choice}
            options={s.options}
            cardSize={cardSize}
            boardCells={1}
            pulse={pulse}
            onTap={(id, at) => dispatch({ type: 'tap', reinforcerId: id, now: at })}
            onAdultTap={(id) => dispatch({ type: 'adult_tap', reinforcerId: id, now: clock.now() })}
          />
        </View>
      );
    } else if (s.phase === 'wait_token' && s.reinforcerId) {
      // полёта в карточку ещё нет — жетон лежит в ячейке до кадра доступа, как в calm («исчезает и раскрывается в
      // одном кадре»): пустая ячейка перед доступом читалась бы как «звезда исчезла»
      const filled = run.token !== null;
      body = (
        <View style={{ flex: 1, paddingHorizontal: 16 }}>
          {header()}
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }} testID="aba-pairing-wait">
            <View style={{ width: abaPairingLayout.cardSize, height: abaPairingLayout.cardSize, borderRadius: 28, borderWidth: 3, borderColor: c.controlInk, backgroundColor: c.plate, alignItems: 'center', justifyContent: 'center' }}>
              <ReinforcerArt id={s.reinforcerId} size={abaPairingLayout.cardSize - 32} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: abaPairingLayout.gapCardRow, gap: abaPairingLayout.gapTaliCell }}>
              <TaliFigure pose={run.token ? 'point' : 'idle'} size={abaPairingLayout.tali} crop accessibilityLabel={t('abaSession.tali')} testID="aba-pairing-tali" />
              <TokenCell size={abaPairingLayout.cell} filled={filled} testID={filled ? 'aba-pairing-token-filled' : 'aba-pairing-token-empty'} />
            </View>
          </View>
        </View>
      );
    } else if (s.phase === 'access' && s.reinforcerId) {
      const left = (s.phaseSince + PAIRING.accessMs - tick) / PAIRING.accessMs;
      body = (
        <View style={{ flex: 1, paddingHorizontal: 16 }}>
          {header(<AccessRing left={left} />)}
          <View style={{ height: 16 }} />
          <View style={{ flex: 1, marginBottom: 16 }}>
            <PlaceholderScene reinforcerId={s.reinforcerId} ended={false} />
          </View>
        </View>
      );
    }
  }

  return (
    <View
      style={{ flex: 1, backgroundColor: c.background, paddingTop: insets.top, paddingBottom: insets.bottom }}
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height - insets.top - insets.bottom })}
      testID="aba-pairing"
    >
      {body}
    </View>
  );
}

