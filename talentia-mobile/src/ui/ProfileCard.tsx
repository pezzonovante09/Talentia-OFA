/**
 * Карточка профиля на первом запуске (`profileCard` 160).
 *
 * `add` — «+ Добавить»: пунктир `textMuted` на `surfaceSunken`, без подушки, плюс 32 цветом `text`, сжатие
 * 0.98 (UX п. 8). Это путь взрослого: тап ведёт в родительский раздел, поэтому карточка не похожа на кнопку
 * ребёнка. `profile` — карточка ребёнка: `surface`, контур, подушка, круг аватара 88 и имя `label` под ним
 * (место 24 есть и у безымянных — «Профиль N»). Аватаров в ассетах нет: в круге — первая буква имени или номер.
 */
import { View } from 'react-native';

import { useDesign } from '../design';
import { emptyOutlineColor, icon, pressScale, profileCard } from '../design/tokens';
import { AppText } from './AppText';
import { CushionPressable } from './CushionPressable';

export type ProfileCardProps =
  | { kind: 'add'; onPress: () => void; accessibilityLabel: string; testID?: string }
  | { kind: 'profile'; name: string; /** В круге аватара: первая буква имени, у безымянного — номер. */ mark?: string; onPress: () => void; accessibilityLabel: string; testID?: string };

export function ProfileCard(props: ProfileCardProps) {
  const theme = useDesign();
  if (props.kind === 'profile') {
    const { name, onPress, accessibilityLabel, testID = 'profile-card' } = props;
    const mark = props.mark ?? name.trim().slice(0, 1).toUpperCase();
    return (
      <CushionPressable
        role="control"
        width={profileCard.size}
        height={profileCard.size}
        radius={theme.radii.lg}
        fill="surface"
        guardMs={theme.motion.slow}
        onPress={onPress}
        accessibilityLabel={accessibilityLabel}
        testID={testID}
      >
        <View style={{ alignItems: 'center', gap: theme.spacing.sm }}>
          <View
            style={{
              width: profileCard.avatar,
              height: profileCard.avatar,
              borderRadius: profileCard.avatar / 2,
              backgroundColor: theme.colors.surfaceSunken,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AppText role="title" color="text">
              {mark}
            </AppText>
          </View>
          <View style={{ height: profileCard.nameSlot, justifyContent: 'center' }}>
            <AppText role="label" color="text" lines={1}>
              {name}
            </AppText>
          </View>
        </View>
      </CushionPressable>
    );
  }
  const { onPress, accessibilityLabel, testID = 'profile-add' } = props;
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
