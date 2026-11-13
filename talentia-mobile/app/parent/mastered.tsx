/** Полный список освоенных навыков (§4, «Показать все»). */
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { SKILL_BY_ID } from '../../src/domain/skills';
import { useParentReport, useSelectedProfile } from '../../src/state/parentView';
import { Card, ParentButton, ParentScreen, Row } from '../../src/ui/parent/primitives';
import { useParentTheme } from '../../src/ui/parent/theme';

export default function MasteredScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const theme = useParentTheme();
  const profile = useSelectedProfile();
  const report = useParentReport(profile?.childId ?? null);
  return (
    <ParentScreen title={t('parent.mastered.title')} left={<ParentButton variant="quiet" label={t('parent.back')} onPress={() => router.back()} block={false} />} testID="parent-mastered">
      <Card>
        {report?.skills.mastered.map((s, i) => {
          const entry = SKILL_BY_ID.get(s.skill);
          return <Row key={s.skill} first={i === 0} label={entry ? t(entry.titleKey) : s.skill} value={entry ? t(`region.${entry.region}`) : undefined} hex={entry ? theme.colors.regionsInk[entry.region] : undefined} />;
        })}
      </Card>
    </ParentScreen>
  );
}
