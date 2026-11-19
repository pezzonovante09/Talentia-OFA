/**
 * Рамка сцены награды (правка 2, 2026-11-12; Ц2.9): плита как у заглушки, вся сцена — зона касания, отклик на касание
 * вниз (палец у 5–6 лет лежит дольше 300 мс); касание отдаёт точку в координатах сцены, содержимое касаний не ловит.
 * После конца (`ended`) касания не доходят до сцены.
 */
import { useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native';

import { ABA_CONTROL_STROKE, abaRewardScene } from '../../../design/abaTokens';
import { radii } from '../../../design/tokens';
import { useAbaColors } from '../parts';

/** `still` — calm или системное «уменьшить движение»: смены кадра вместо движения. */
export type SceneProps = { ended: boolean; still: boolean };
export type SceneSize = { w: number; h: number };

/** Цвета сцен: «фиолетовая семья» наград, в calm — calm-палитра. */
export const sceneColors = (still: boolean) => (still ? abaRewardScene.calmColors : abaRewardScene.colors);

export function SceneFrame({ ended, onTap, onSize, children }: { ended: boolean; onTap: (x: number, y: number) => void; onSize?: (s: SceneSize) => void; children: ReactNode }) {
  const { t } = useTranslation();
  const c = useAbaColors();
  const downSeen = useRef(false);
  const fire = (e: GestureResponderEvent) => {
    if (ended) return;
    const { locationX: x = 0, locationY: y = 0 } = e.nativeEvent ?? {};
    onTap(x, y);
  };
  return (
    <Pressable
      onPressIn={(e) => {
        downSeen.current = true;
        fire(e);
      }}
      onPress={(e) => {
        // `onPress` — только если касания вниз не было (экранный чтец)
        if (!downSeen.current) fire(e);
        downSeen.current = false;
      }}
      onLayout={(e) => onSize?.({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      testID="aba-access-scene"
      accessibilityRole="button"
      accessibilityLabel={t('abaSession.accessScene')}
      style={{ flex: 1, borderRadius: radii.lg, borderWidth: ABA_CONTROL_STROKE, borderColor: c.plateOutline, backgroundColor: c.plate, overflow: 'hidden' }}
    >
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {children}
      </View>
    </Pressable>
  );
}
