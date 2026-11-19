/**
 * Карточка профиля на первом запуске (`profileCard`; docs/design/atlas-firstrun-2026-10-31.md D3).
 *
 * `add` — «+ Добавить», взрослая карточка 120: пунктир `textMuted` на `surfaceSunken`, без подушки, плюс 32 и
 * подпись «Для взрослых» `textMuted`, замок 24 в правом верхнем углу (inset 8) — тот же глиф, что у строки
 * «Для взрослых» внизу: одна форма = один смысл «тут взрослый». Сжатие 0.98 (UX п. 8). Смена `nudgeKey` —
 * покачивание и рост замка 24 → 32 на `lockNudge.holdMs` (первый тап ребёнка: «Позови взрослого»); при `still`
 * (calm или системное «уменьшить движение») — без движения, рост мгновенный.
 * `profile` — карточка ребёнка 160: `surface`, контур, подушка, круг аватара 88 и имя `label` под ним
 * (место 24 есть и у безымянных — «Профиль N»). Аватаров в ассетах нет: в круге — первая буква имени или номер.
 */
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Platform, View } from 'react-native';

import { useDesign } from '../design';
import { emptyOutlineColor, firstRun, icon, pressScale, profileCard } from '../design/tokens';
import { AppText } from './AppText';
import { CushionPressable } from './CushionPressable';
import { Icon } from './Icon';

/** На web нативного драйвера анимаций нет — RN предупреждает на каждом касании. */
const NATIVE_DRIVER = Platform.OS !== 'web';

export type ProfileCardProps =
  | { kind: 'add'; onPress: () => void; /** Смена значения качает замок. */ nudgeKey?: number; accessibilityLabel: string; testID?: string }
  | { kind: 'profile'; name: string; /** В круге аватара: первая буква имени, у безымянного — номер. */ mark?: string; onPress: () => void; accessibilityLabel: string; testID?: string };

export function ProfileCard(props: ProfileCardProps) {
  const theme = useDesign();
  const { t } = useTranslation();
  const shake = useRef(new Animated.Value(0)).current;
  const nudgeKey = props.kind === 'add' ? (props.nudgeKey ?? 0) : 0;
  const seenNudge = useRef(nudgeKey);

  /** Замок растёт до `lockNudge.to` и держится `lockNudge.holdMs`: покачивание ±4 pt за 140 мс почти не видно (Ж8). */
  const lockScale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (seenNudge.current === nudgeKey) return undefined;
    seenNudge.current = nudgeKey;
    const peak = firstRun.lockNudge.to / profileCard.addBadge;
    if (theme.still) {
      // без движения: вырос — подержали — вернулся, без анимации
      lockScale.setValue(peak);
      const id = setTimeout(() => lockScale.setValue(1), firstRun.lockNudge.holdMs);
      return () => clearTimeout(id);
    }
    const step = theme.motion.quick / 4;
    const to = (v: number) => Animated.timing(shake, { toValue: v, duration: step, useNativeDriver: NATIVE_DRIVER });
    Animated.parallel([
      Animated.sequence([to(-1), to(1), to(-1), to(0)]),
      Animated.sequence([
        Animated.timing(lockScale, { toValue: peak, duration: theme.motion.quick, useNativeDriver: NATIVE_DRIVER }),
        Animated.delay(firstRun.lockNudge.holdMs),
        Animated.timing(lockScale, { toValue: 1, duration: theme.motion.quick, useNativeDriver: NATIVE_DRIVER }),
      ]),
    ]).start();
    return undefined;
  }, [nudgeKey, shake, lockScale, theme.still, theme.motion.quick]);

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
  const bar = { backgroundColor: theme.colors.textMuted, borderRadius: theme.stroke.base / 2 } as const;
  const translateX = shake.interpolate({ inputRange: [-1, 1], outputRange: [-theme.spacing.xs, theme.spacing.xs] });
  return (
    <CushionPressable
      role="control"
      dashed
      width={profileCard.addSize}
      height={profileCard.addSize}
      radius={theme.radii.lg}
      fill="surfaceSunken"
      outlineColor={emptyOutlineColor}
      scale={pressScale.wide}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      <Animated.View style={{ position: 'absolute', top: profileCard.addBadgeInset, right: profileCard.addBadgeInset, transform: [{ translateX }, { scale: lockScale }], transformOrigin: 'top right' }} testID={`${testID}-lock`}>
        <Icon name="lock" size={profileCard.addBadge} color="textMuted" />
      </Animated.View>
      <View style={{ alignItems: 'center', gap: theme.spacing.sm }}>
        <View style={{ width: icon.size, height: icon.size, alignItems: 'center', justifyContent: 'center' }} testID={`${testID}-plus`}>
          <View style={[{ position: 'absolute', width: icon.size, height: theme.stroke.base * 2 }, bar]} />
          <View style={[{ position: 'absolute', height: icon.size, width: theme.stroke.base * 2 }, bar]} />
        </View>
        <AppText role="caption" color="textMuted" align="center" lines={1}>
          {t(firstRun.adultCardLabelKey)}
        </AppText>
      </View>
    </CushionPressable>
  );
}
