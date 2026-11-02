/**
 * Сцена доступа до ассетов (Ц2.8, раздел 8, Ц3.5): одна заглушка на любую позицию каталога. Вся сцена — зона касания,
 * любой одиночный тап сразу даёт видимый отклик (точка в месте касания, смена кадра — без анимации, ≤ 300 мс);
 * после конца (`ended`) метки снимаются одной сменой кадра — кадр покоя — и сцена больше не отвечает. Поверхность —
 * `abaPictureSurface`, как у карточки, в которую сцена потом сворачивается. Настоящие сцены позиций —
 * `asset-pipeline`; их доигрывание после T — `settleMs` в `model/accessRun.ts`.
 */
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View, type GestureResponderEvent } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { abaAccessPlaceholderMark, abaExchange, ABA_CONTROL_STROKE } from '../../../design/abaTokens';
import { radii } from '../../../design/tokens';
import { useAbaColors } from '../parts';
import { ReinforcerArt } from '../reinforcer';

export function PlaceholderScene({ reinforcerId, ended }: { reinforcerId: string; ended: boolean }) {
  const { t } = useTranslation();
  const c = useAbaColors();
  const [marks, setMarks] = useState<{ x: number; y: number; n: number }[]>([]);
  const mark = abaAccessPlaceholderMark;
  const downSeen = useRef(false);
  const put = (e: GestureResponderEvent) => {
    if (ended) return;
    const { locationX: x = 0, locationY: y = 0 } = e.nativeEvent ?? {};
    setMarks((m) => [...m.slice(-(mark.max - 1)), { x, y, n: (m[m.length - 1]?.n ?? 0) + 1 }]);
  };
  // отклик — на касание вниз (`tapResponseMs`, `firstFrameMs`): палец у 5–6 лет лежит дольше 300 мс; сцена не цель с
  // засчитыванием, правило отпускания ей не нужно. `onPress` — только если касания вниз не было (экранный чтец)
  const onPressIn = (e: GestureResponderEvent) => {
    downSeen.current = true;
    put(e);
  };
  const onPress = (e: GestureResponderEvent) => {
    if (!downSeen.current) put(e);
    downSeen.current = false;
  };
  const shown = ended ? [] : marks;
  return (
    <Pressable
      onPressIn={onPressIn}
      onPress={onPress}
      testID="aba-access-scene"
      accessibilityRole="button"
      accessibilityLabel={t('abaSession.accessScene')}
      style={{ flex: 1, borderRadius: radii.lg, borderWidth: ABA_CONTROL_STROKE, borderColor: c.plateOutline, backgroundColor: c.plate, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}
    >
      <ReinforcerArt id={reinforcerId} size={abaExchange.cardSize - 32} />
      <View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }} pointerEvents="none" testID={`aba-access-marks-${shown.length}`}>
        <Svg width="100%" height="100%">
          {shown.map((m) => (
            <Circle key={m.n} cx={m.x} cy={m.y} r={mark.r} fill={mark.fill} />
          ))}
        </Svg>
      </View>
    </Pressable>
  );
}
