/**
 * Сцена доступа до ассетов (Ц2.8, раздел 8): одна заглушка на любую позицию каталога. Вся сцена — зона касания,
 * любой одиночный тап сразу даёт видимый отклик (круг в точке касания, смена кадра — без анимации, ≤ 300 мс);
 * после конца (`ended`) сцена больше не отвечает. Настоящие сцены позиций — фаза 7 и `asset-pipeline`.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View, type GestureResponderEvent } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { ABA_CONTROL_STROKE } from '../../../design/abaTokens';
import { radii } from '../../../design/tokens';
import { useAbaColors } from '../parts';
import { ReinforcerArt } from '../reinforcer';

const MARKS = 6;

export function PlaceholderScene({ reinforcerId, ended }: { reinforcerId: string; ended: boolean }) {
  const { t } = useTranslation();
  const c = useAbaColors();
  const [marks, setMarks] = useState<{ x: number; y: number; n: number }[]>([]);
  const onPress = (e: GestureResponderEvent) => {
    if (ended) return;
    const { locationX: x = 0, locationY: y = 0 } = e.nativeEvent ?? {};
    setMarks((m) => [...m.slice(-(MARKS - 1)), { x, y, n: (m[m.length - 1]?.n ?? 0) + 1 }]);
  };
  return (
    <Pressable
      onPress={onPress}
      testID="aba-access-scene"
      accessibilityRole="button"
      accessibilityLabel={t('abaSession.accessScene')}
      style={{ flex: 1, borderRadius: radii.lg, borderWidth: ABA_CONTROL_STROKE, borderColor: c.controlInk, backgroundColor: c.plate, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}
    >
      <ReinforcerArt id={reinforcerId} size={160} />
      <View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }} pointerEvents="none" testID={`aba-access-marks-${marks.length}`}>
        <Svg width="100%" height="100%">
          {marks.map((m) => (
            <Circle key={m.n} cx={m.x} cy={m.y} r={30} fill={c.tokenEarned} stroke={c.tokenOutline} strokeWidth={3} />
          ))}
        </Svg>
      </View>
    </Pressable>
  );
}
