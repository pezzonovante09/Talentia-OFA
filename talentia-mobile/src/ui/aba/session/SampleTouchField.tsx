/**
 * Поле шага «коснись картинки» (решение 1, часть В): только образец, без вариантов (`MatchField` с пустым полем). L1 —
 * метка над образцом (та же, что L1 наблюдения `match`); L3 — модель: короткое «нажатие» в центр образца
 * (`TouchModel`, токен `abaSampleTouch.model`).
 *
 * Для `design-lead`: точка — временная замена «экранной руке». Будущий ассет руки встаёт на место круга в `TouchModel`
 * с тем же ходом (появилась → вжалась в центр образца → исчезла, дважды) и тем же calm-вариантом (две вспышки кадром).
 */
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, View } from 'react-native';

import { abaLayout, abaSampleTouch } from '../../../design/abaTokens';
import type { PromptVisualPlan } from '../../../domain/abaPrompting';
import { useAbaClock } from '../clock';
import { useAbaColors } from '../parts';
import { MatchField } from './parts';

const NATIVE = Platform.OS !== 'web';

/**
 * Модель L3: метка появляется, вжимается в центр образца и гаснет — `presses` раза (~1,2 с). `still` (calm, reduce
 * motion) — без движения: столько же вспышек кадром. Новое предъявление L3 (`startedAt`) — ход заново.
 */
function TouchModel({ top, still, startedAt }: { top: number; still: boolean; startedAt: number }) {
  const c = useAbaColors();
  const clock = useAbaClock();
  const m = abaSampleTouch.model;
  const d = abaSampleTouch.handDot;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(m.fromScale)).current;
  const [on, setOn] = useState(false);

  useEffect(() => {
    if (still) {
      // вспышки кадром по часам сессии: видна `stillOnMs`, нет `stillOffMs` — без анимации прозрачности и размера
      const t0 = clock.now();
      const period = m.stillOnMs + m.stillOffMs;
      const cancels: (() => void)[] = [];
      for (let i = 0; i < m.presses; i += 1) {
        cancels.push(clock.at(t0 + i * period, () => setOn(true)));
        cancels.push(clock.at(t0 + i * period + m.stillOnMs, () => setOn(false)));
      }
      return () => cancels.forEach((cancel) => cancel());
    }
    const press = () =>
      Animated.sequence([
        Animated.parallel([
          Animated.timing(opacity, { toValue: abaSampleTouch.handDotOpacity, duration: m.appearMs, useNativeDriver: NATIVE }),
          Animated.timing(scale, { toValue: m.fromScale, duration: 0, useNativeDriver: NATIVE }),
        ]),
        Animated.timing(scale, { toValue: m.toScale, duration: m.pressMs, easing: Easing.in(Easing.quad), useNativeDriver: NATIVE }),
        Animated.timing(opacity, { toValue: 0, duration: m.fadeMs, useNativeDriver: NATIVE }),
      ]);
    const run = Animated.sequence(Array.from({ length: m.presses }, press));
    run.start();
    return () => {
      run.stop();
      opacity.setValue(0);
      scale.setValue(m.fromScale);
    };
  }, [still, startedAt, opacity, scale, m, clock]);

  return (
    <Animated.View
      pointerEvents="none"
      testID="aba-touch-model"
      style={{
        position: 'absolute',
        top: top - d / 2,
        alignSelf: 'center',
        width: d,
        height: d,
        borderRadius: d / 2,
        backgroundColor: c.ink,
        opacity: still ? (on ? abaSampleTouch.handDotOpacity : 0) : opacity,
        transform: still ? [] : [{ scale }],
      }}
    />
  );
}

export function SampleTouchField({
  sampleId,
  level,
  touched,
  sampleSize,
  frameShownAt,
  onSample,
  still = false,
  levelStartedAt = frameShownAt,
}: {
  sampleId: string;
  level: 0 | 1 | 3;
  touched: boolean;
  sampleSize: number;
  frameShownAt: number;
  onSample: (at: number) => void;
  /** calm или reduce motion: модель L3 — вспышками кадром, без движения. */
  still?: boolean;
  /** Начало текущего предъявления: новая L3 — ход модели заново. */
  levelStartedAt?: number;
}) {
  const visual: PromptVisualPlan = {
    focus: level >= 1 ? { on: 'sample', id: sampleId, pulse: false } : null,
    activeChoiceIds: [],
    highlightCorrect: false,
    adultPhysical: false,
    plateMark: null,
  };
  return (
    <View>
      <MatchField
        sampleId={sampleId}
        field={[]}
        visual={visual}
        sampleTouched={touched}
        activeIds={[]}
        chosenId={null}
        sampleSize={sampleSize}
        choiceSize={0}
        frameShownAt={frameShownAt}
        empty={false}
        onSample={onSample}
        onOption={() => undefined}
      />
      {level === 3 && !touched && (
        <TouchModel key={levelStartedAt} top={abaLayout.hintBand + sampleSize / 2} still={still} startedAt={levelStartedAt} />
      )}
    </View>
  );
}
