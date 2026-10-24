/**
 * Повторное согласие при `outdated` (PARENT.md, условие на будущее): пока текст не подтверждён,
 * только «Подтвердить» и «Удалить аккаунт». Открывается до любого урока, когда версия текста сменилась.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { parentSpacing } from '../../src/design/parentTokens';
import type { InterfaceLang } from '../../src/domain/regionVisibility';
import { useAccount } from '../../src/state/account';
import { Card, ParentButton, ParentScreen, ParentText } from '../../src/ui/parent/primitives';

export default function ReconsentScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const grantConsent = useAccount((s) => s.grantConsent);
  const [busy, setBusy] = useState(false);
  return (
    <ParentScreen scroll testID="parent-reconsent">
      <View style={{ gap: parentSpacing.lg, flex: 1, paddingTop: parentSpacing.xl }}>
        <ParentText role="heading" accessibilityRole="header">
          {t('parent.consent.updatedTitle')}
        </ParentText>
        <Card title={t('parent.consent.whatChanged')}>
          <ParentText role="body">{t('parent.consent.body')}</ParentText>
        </Card>
        <ParentButton variant="quiet" label={t('parent.consent.policy')} underline onPress={() => router.push('/parent/policy')} block={false} />
        <View style={{ flex: 1 }} />
        <ParentButton
          label={t('parent.consent.confirm')}
          disabled={busy}
          onPress={async () => {
            setBusy(true);
            try {
              await grantConsent(i18n.language as InterfaceLang);
              router.replace('/parent');
            } finally {
              setBusy(false);
            }
          }}
          testID="reconsent-confirm"
        />
        <ParentButton variant="quiet" label={t('parent.data.deleteAccount')} onPress={() => router.push({ pathname: '/parent/confirm/[action]', params: { action: 'delete_account' } })} testID="reconsent-delete" />
      </View>
    </ParentScreen>
  );
}
