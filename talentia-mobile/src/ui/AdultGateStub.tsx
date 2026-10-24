/**
 * Заглушка гейта родителя (PARENT.md 3.1 — этап 10). В срезе важно одно (UX п. 4): ребёнок, попавший
 * сюда с «+ Добавить» или «ползунков», выходит одним тапом — цель закрытия ≥ 60 у левого края полосы
 * 64 и системная «назад». Содержимого для ребёнка здесь нет: заголовок для взрослого и пояснение.
 */
import { useEffect } from 'react';
import { BackHandler, Modal, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useDesign } from '../design';
import { lessonLayout } from '../design/tokens';
import { AppText } from './AppText';
import { CushionPressable } from './CushionPressable';
import { Icon } from './Icon';

export type AdultGateStubProps = { visible: boolean; onClose: () => void };

export function AdultGateStub({ visible, onClose }: AdultGateStubProps) {
  const theme = useDesign();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, onClose]);

  return (
    <Modal visible={visible} animationType={theme.calmMode ? 'none' : 'fade'} onRequestClose={onClose} transparent={false}>
      <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top }} testID="adult-gate">
        <View style={{ height: lessonLayout.topBar, flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.spacing.lg }}>
          <CushionPressable
            role="control"
            width={theme.touch.min}
            height={theme.touch.min}
            radius="pill"
            fill="surface"
            onPress={onClose}
            accessibilityLabel={t('a11y.close')}
            testID="adult-gate-close"
          >
            <Icon name="x" color="text" />
          </CushionPressable>
        </View>
        <View style={{ flex: 1, paddingHorizontal: theme.spacing.lg, gap: theme.spacing.lg, paddingTop: theme.spacing.xl }}>
          <AppText role="title" fit="title">
            {t('parentGate.stub.title')}
          </AppText>
          <AppText role="body" color="textMuted">
            {t('parentGate.stub.body')}
          </AppText>
        </View>
      </View>
    </Modal>
  );
}
