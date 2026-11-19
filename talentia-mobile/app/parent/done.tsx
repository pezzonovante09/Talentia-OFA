/** После удаления аккаунта: данные очищены, обратно к первому запуску (`replace('/')`: стек раздела без аккаунта вёл бы в настройку). */
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { parentSpacing } from '../../src/design/parentTokens';
import { ParentButton, ParentScreen, ParentText } from '../../src/ui/parent/primitives';

export default function DoneScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <ParentScreen scroll={false} testID="parent-deleted">
      <View style={{ flex: 1, gap: parentSpacing.lg, paddingTop: parentSpacing.xxl }}>
        <ParentText role="heading" accessibilityRole="header">
          {t('parent.data.deletedTitle')}
        </ParentText>
        <ParentText role="body">{t('parent.data.deletedBody')}</ParentText>
        <View style={{ flex: 1 }} />
        <ParentButton label={t('parent.data.toProfiles')} onPress={() => router.replace('/')} testID="deleted-to-profiles" />
      </View>
    </ParentScreen>
  );
}
