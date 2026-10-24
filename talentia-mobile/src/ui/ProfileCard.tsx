/**
 * Карточка профиля на первом запуске (`profileCard` 160). В срезе — только «+ Добавить»: пунктир
 * `textMuted` на `surfaceSunken`, без подушки, плюс 32 цветом `text`, сжатие 0.98 (UX п. 8). Это путь
 * взрослого: тап ведёт к гейту родителя, поэтому карточка не похожа на кнопку ребёнка.
 */
import { View } from 'react-native';

import { useDesign } from '../design';
import { emptyOutlineColor, icon, pressScale, profileCard } from '../design/tokens';
import { CushionPressable } from './CushionPressable';

export type ProfileCardProps = { kind: 'add'; onPress: () => void; accessibilityLabel: string; testID?: string };

export function ProfileCard({ onPress, accessibilityLabel, testID = 'profile-add' }: ProfileCardProps) {
  const theme = useDesign();
  const bar = { backgroundColor: theme.colors.text, borderRadius: theme.stroke.base / 2 } as const;
  return (
    <CushionPressable
      role="control"
      dashed
      width={profileCard.size}
      height={profileCard.size}
      radius={theme.radii.lg}
      fill="surfaceSunken"
      outlineColor={emptyOutlineColor}
      scale={pressScale.wide}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      <View style={{ width: icon.size, height: icon.size, alignItems: 'center', justifyContent: 'center' }}>
        <View style={[{ position: 'absolute', width: icon.size, height: theme.stroke.base * 2 }, bar]} />
        <View style={[{ position: 'absolute', height: icon.size, width: theme.stroke.base * 2 }, bar]} />
      </View>
    </CushionPressable>
  );
}
