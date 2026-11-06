/** Данные (дизайн-док §7): экспорт (в локальной версии — позже) и три разрушительные строки. */
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Card, ParentButton, ParentScreen, ParentText, Row } from '../../src/ui/parent/primitives';

export default function DataScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const go = (action: 'clear_progress' | 'delete_child' | 'delete_account') => router.push({ pathname: '/parent/confirm/[action]', params: { action } });
  return (
    <ParentScreen title={t('parent.data.title')} left={<ParentButton variant="quiet" label={t('parent.back')} onPress={() => router.back()} block={false} testID="data-back" />} testID="parent-data">
      <Card title={t('parent.home.export')}>
        <ParentText role="body">{t('parent.data.exportHint')}</ParentText>
        <ParentText role="caption" color="textMuted" testID="export-soon">
          {t('parent.data.exportSoon')}
        </ParentText>
      </Card>
      <Card title={t('parent.data.deletion')}>
        <Row first kind="destructive" label={t('parent.data.clearProgress')} onPress={() => go('clear_progress')} testID="row-clear" />
        <Row kind="destructive" label={t('parent.data.deleteChild')} onPress={() => go('delete_child')} testID="row-delete-child" />
        <Row kind="destructive" label={t('parent.data.deleteAccount')} onPress={() => go('delete_account')} testID="row-delete-account" />
      </Card>
    </ParentScreen>
  );
}
