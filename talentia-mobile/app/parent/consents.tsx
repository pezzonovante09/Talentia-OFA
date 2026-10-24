/** Согласия (дизайн-док §6): одна область в локальной версии — хранение на устройстве; статус словом. */
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { ConsentEvent } from '../../src/domain/consent';
import { readConsentLog } from '../../src/services/local/consentLog';
import { useAccount } from '../../src/state/account';
import { Card, ParentButton, ParentScreen, ParentText, Row } from '../../src/ui/parent/primitives';

export default function ConsentsScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const db = useAccount((s) => s.db);
  const consent = useAccount((s) => s.consent);
  const [last, setLast] = useState<ConsentEvent | null>(null);

  useEffect(() => {
    if (!db) return;
    void readConsentLog(db).then((log) => setLast([...log].reverse().find((e) => e.scope === 'account_local' && e.action === 'grant') ?? null));
  }, [db, consent]);

  const date = last ? new Date(last.at).toLocaleDateString(i18n.language === 'en' ? 'en-GB' : 'ru-RU') : '';
  return (
    <ParentScreen title={t('parent.home.consents')} left={<ParentButton variant="quiet" label={t('parent.back')} onPress={() => router.back()} block={false} testID="consents-back" />} testID="parent-consents">
      <Card testID="consent-local">
        <ParentText role="body">{t('parent.consent.localScope')}</ParentText>
        {last && (
          <ParentText role="caption" color="textMuted">
            {t('parent.consent.accepted', { date, version: last.textVersion })}
          </ParentText>
        )}
        <ParentText role="caption" color={consent === 'outdated' ? 'error' : consent === 'granted' ? 'text' : 'textMuted'} testID="consent-status">
          {t(`parent.consent.status.${consent}`)}
        </ParentText>
        {consent === 'outdated' && <ParentButton label={t('parent.consent.readAndConfirm')} onPress={() => router.push('/parent/reconsent')} testID="consent-reconfirm" />}
        <Row kind="destructive" label={t('parent.consent.revokeLocal')} onPress={() => router.push({ pathname: '/parent/confirm/[action]', params: { action: 'delete_account' } })} testID="consent-revoke" />
      </Card>
    </ParentScreen>
  );
}
