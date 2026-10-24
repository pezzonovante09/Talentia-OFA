/**
 * Подтверждение выхода (SCREENS.md 1.6; §5 дизайн-дока): полноэкранный слой, Tali `idle` 88 на
 * отступе 48, заголовок, «Выйти» (`surface`, иконка «карта») и внизу «Остаться» (`primary`, стрелка).
 * Левый верхний угол пуст. Системная «назад» = «Остаться». Подпись «Прогресс сохранится» показывается
 * только при записи на устройство (`exitLayer.progressNote`).
 */
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, Modal, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDesign } from '../../design';
import { exitLayer, taliSize } from '../../design/tokens';
import { AppText } from '../AppText';
import { CushionPressable } from '../CushionPressable';
import { Icon } from '../Icon';
import { TaliFigure } from '../TaliFigure';
import type { ColorName } from '../colors';

export function ExitLayer({ visible, regionColor, persists, onLeave, onStay }: { visible: boolean; regionColor: string; persists: boolean; onLeave: () => void; onStay: () => void }) {
  const theme = useDesign();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onStay();
      return true;
    });
    return () => sub.remove();
  }, [visible, onStay]);

  const safeColor = theme.focusMode ? theme.colors.background : regionColor;
  const button = (label: string, icon: 'map' | 'arrow', fill: ColorName, ink: ColorName, onPress: () => void, testID: string) => (
    <CushionPressable role="control" width="100%" height={theme.touch.primary} radius={theme.radii.lg} fill={fill} onPress={onPress} accessibilityLabel={label} testID={testID}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <Icon name={icon} color={ink} />
        <AppText role="label" color={ink} cap="action" lines={1}>
          {label}
        </AppText>
      </View>
    </CushionPressable>
  );

  return (
    <Modal visible={visible} animationType={theme.calmMode ? 'none' : 'fade'} onRequestClose={onStay} transparent={false}>
      <View style={{ flex: 1, backgroundColor: theme.colors.background }} testID="exit-layer">
        <View style={{ height: insets.top, backgroundColor: safeColor }} />
        <View style={{ flex: 1, paddingHorizontal: theme.spacing.lg, paddingBottom: Math.max(insets.bottom, theme.spacing.lg) }}>
          <View style={{ height: exitLayer.topInset }} />
          <View style={{ alignItems: 'center' }}>
            <TaliFigure pose="idle" size={taliSize.crop} crop onPress={() => undefined} accessibilityLabel={t('a11y.tali')} testID="exit-tali" />
          </View>
          <View style={{ height: exitLayer.taliGap }} />
          <View style={{ height: theme.typography.title.lineHeight * 2, justifyContent: 'center' }}>
            <AppText role="title" fit="title" align="center" accessibilityRole="header">
              {t('lesson.exitConfirm')}
            </AppText>
          </View>
          {persists && (
            <AppText role="caption" color="textMuted" align="center" testID="exit-persists">
              {t('lesson.exitPersists')}
            </AppText>
          )}
          <View style={{ flex: 1 }} />
          {button(t('lesson.leave'), 'map', 'surface', 'text', onLeave, 'exit-leave')}
          <View style={{ height: exitLayer.buttonGap }} />
          {button(t('lesson.stay'), 'arrow', 'primary', 'onPrimary', onStay, 'exit-stay')}
        </View>
      </View>
    </Modal>
  );
}
