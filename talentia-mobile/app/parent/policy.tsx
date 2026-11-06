/** Политика конфиденциальности — экраном внутри приложения, не ссылкой в браузер (PARENT.md «Согласие»). */
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ParentButton, ParentScreen, ParentText } from '../../src/ui/parent/primitives';

export default function PolicyScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <ParentScreen title={t('parent.policy.title')} left={<ParentButton variant="quiet" label={t('parent.back')} onPress={() => router.back()} block={false} testID="policy-back" />} testID="parent-policy">
      <ParentText role="body">{t('parent.policy.body')}</ParentText>
    </ParentScreen>
  );
}
