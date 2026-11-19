/**
 * Горка с шариком (Ц2.9; ассеты партии 1, 2026-11-13): тап — шарик трогается от верхнего упора и катится ~3 с по
 * рельсам в ведёрко; тап на ходу — упор качнулся, шарик встаёт в очередь (не больше 2). Конец — текущий шарик
 * докатывается, очередь сбрасывается, новых нет. Calm — один шарик без очереди: тап на ходу — только упор.
 * Рельсы — `REWARD_PARTS.marbleTrack`, шарик — `REWARD_PARTS.marble`; путь — точки рельсов картинки в координатах 512.
 */
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';

import { REWARD_PARTS } from '../../../assets/registry';
import { abaRewardScene } from '../../../design/abaTokens';
import { SceneFrame, sceneColors, type SceneProps, type SceneSize } from './SceneFrame';

const K = abaRewardScene.marbleRun;
const NATIVE = Platform.OS !== 'web';
const Track = REWARD_PARTS.marbleTrack;
const Marble = REWARD_PARTS.marble;

/** Доли пути по длине отрезков — для интерполяции: шарик идёт по рельсам с ровной скоростью. */
const STOPS = (() => {
  const lens = K.path.slice(1).map(([x, y], i) => Math.hypot(x - K.path[i][0], y - K.path[i][1]));
  const total = lens.reduce((a, b) => a + b, 0);
  let acc = 0;
  return [0, ...lens.map((l) => (acc += l) / total)];
})();

export function MarbleRunScene({ ended, still }: SceneProps) {
  const ink = sceneColors(still);
  const [size, setSize] = useState<SceneSize | null>(null);
  const [roll, setRoll] = useState(0); // номер идущего шарика; 0 — шарика нет
  const [queue, setQueue] = useState(0);
  const gate = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (ended) setQueue(0);
  }, [ended]);
  const onTap = () => {
    if (roll === 0) return setRoll(1);
    // на ходу: упор качнулся; в обычном режиме — шарик в очередь
    gate.setValue(0);
    Animated.timing(gate, { toValue: 1, duration: K.gateMs, useNativeDriver: NATIVE }).start();
    if (!still) setQueue((q) => Math.min(q + 1, K.queueMax));
  };
  const onRolled = () => {
    if (!ended && queue > 0) {
      setQueue((q) => q - 1);
      setRoll((r) => r + 1);
    } else setRoll(0);
  };
  const side = size ? Math.min(size.w, size.h) * 0.9 : 0;
  const k = side / 512;
  const m = K.marble * k;
  const deg = still ? K.calmGateDeg : K.gateDeg;
  const tilt = gate.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['0deg', `${-deg}deg`, '0deg'] });
  const g = K.gate;
  // кто ждёт на площадке старта: до первого тапа — один шарик, на ходу — очередь (на рельсах, не в воздухе)
  const waiting = roll === 0 ? (ended ? 0 : 1) : queue;
  return (
    <SceneFrame ended={ended} onTap={onTap} onSize={setSize}>
      {side > 0 && (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <View style={{ width: side, height: side }}>
            <Track width={side} height={side} />
            {/* упор на краю площадки старта: качается, когда тапнули на ходу */}
            <Animated.View style={{ position: 'absolute', left: g.x * k, top: g.y * k, width: g.w * k, height: g.h * k, backgroundColor: ink.lavender, borderColor: ink.ink, borderWidth: 2, borderRadius: (g.w / 2) * k, transform: [{ rotate: tilt }] }} />
            {/* до тапа шарик ждёт у упора — ребёнку видно, что здесь трогать (`aba-pedagogy-specialist`) */}
            {K.queue.slice(0, waiting).map(([qx, qy], i) => (
              <View key={`q${i}`} style={{ position: 'absolute', left: qx * k - m / 2, top: qy * k - m / 2 }} testID={roll === 0 ? 'aba-marble-waiting' : undefined}>
                <Marble width={m} height={m} />
              </View>
            ))}
            {roll > 0 && <RollingMarble key={roll} k={k} m={m} still={still} onDone={onRolled} />}
          </View>
        </View>
      )}
    </SceneFrame>
  );
}

/** Неподвижный кадр сцены для карточки: рельсы и шарик у упора — «картинка = то, что будет в сцене». */
export function MarbleRunPicture({ size }: { size: number }) {
  const k = size / 512;
  const m = K.marble * k;
  const [sx, sy] = K.path[0];
  return (
    <View style={{ width: size, height: size }}>
      <Track width={size} height={size} />
      <View style={{ position: 'absolute', left: sx * k - m / 2, top: sy * k - m / 2 }}>
        <Marble width={m} height={m} />
      </View>
    </View>
  );
}

function RollingMarble({ k, m, still, onDone }: { k: number; m: number; still: boolean; onDone: () => void }) {
  const p = useRef(new Animated.Value(0)).current;
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    // трогается сразу и тормозит у ведёрка: «нажал — покатился» (Ц2.9); calm — медленнее
    Animated.timing(p, { toValue: 1, duration: still ? K.calmRollMs : K.rollMs, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE }).start(({ finished }) => {
      if (finished) done.current();
    });
  }, [p, still]);
  const x = p.interpolate({ inputRange: STOPS, outputRange: K.path.map(([px]) => px * k - m / 2) });
  const y = p.interpolate({ inputRange: STOPS, outputRange: K.path.map(([, py]) => py * k - m / 2) });
  const spin = p.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${still ? K.calmSpinDeg : K.spinDeg}deg`] });
  // у ведёрка шарик «проваливается»
  const opacity = p.interpolate({ inputRange: [0, 0.92, 1], outputRange: [1, 1, 0] });
  return (
    <Animated.View style={{ position: 'absolute', left: 0, top: 0, opacity, transform: [{ translateX: x }, { translateY: y }, { rotate: spin }] }} testID="aba-marble">
      <Marble width={m} height={m} />
    </Animated.View>
  );
}
