/**
 * Главный экран родителя (дизайн-док §4): шапка с сегментами детей, «За неделю», «Освоено»,
 * «Даётся тяжело», «В работе», «Настройки ребёнка», «Данные». Всё — из локальных данных
 * (`domain/parentReport.ts`); ни процентов, ни звёзд, ни жёлтого.
 */
import { Redirect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { parentSpacing } from '../../src/design/parentTokens';
import { SKILL_BY_ID } from '../../src/domain/skills';
import { useAccount } from '../../src/state/account';
import { useParentReport, useParentView, useSelectedProfile } from '../../src/state/parentView';
import { Card, ParentButton, ParentScreen, ParentText, Row, Segmented, WeekStrip } from '../../src/ui/parent/primitives';
import { useParentTheme } from '../../src/ui/parent/theme';

function whenLabel(t: (k: string, o?: Record<string, unknown>) => string, lastRunAt: string | null): string {
  if (!lastRunAt) return t('parent.home.never');
  const days = Math.floor((Date.now() - Date.parse(lastRunAt)) / 86_400_000);
  const when = days <= 0 ? t('parent.home.today') : days === 1 ? t('parent.home.yesterday') : t('parent.home.daysAgo', { n: days });
  return t('parent.home.lastRun', { when });
}

export default function ParentHome() {
  const { t } = useTranslation();
  const router = useRouter();
  const theme = useParentTheme();
  const profiles = useAccount((s) => s.profiles);
  const consent = useAccount((s) => s.consent);
  const profile = useSelectedProfile();
  const select = useParentView((s) => s.select);
  const report = useParentReport(profile?.childId ?? null);

  if (consent === 'outdated') return <Redirect href="/parent/reconsent" />;
  if (profiles.length === 0) return <Redirect href="/parent/profile/new" />;
  if (!profile) return null;

  const name = (p: typeof profile, i: number) => p.name || t('parent.profile.unnamed', { n: i + 1 });
  const idx = profiles.findIndex((p) => p.childId === profile.childId);
  const week = report?.week;
  const weekdays = [1, 2, 3, 4, 5, 6, 7].map((d) => t(`weekdays.d${d}`));
  const labels = week ? week.days.map((d) => weekdays[(new Date(d.day).getDay() + 6) % 7]) : [];

  return (
    <ParentScreen right={<ParentButton variant="quiet" label={t('parent.done')} onPress={() => router.dismissAll()} block={false} testID="parent-done" />} testID="parent-home">
      {profiles.length > 1 && (
        <View style={{ marginBottom: parentSpacing.md }}>
          <Segmented options={profiles.map((p, i) => ({ value: p.childId, label: name(p, i) }))} value={profile.childId} onChange={select} testID="child-segments" />
        </View>
      )}
      <ParentText role="heading" accessibilityRole="header" testID="home-name">
        {name(profile, idx)}
      </ParentText>
      <ParentText role="caption" color="textMuted" style={{ marginBottom: parentSpacing.lg }} testID="home-last">
        {whenLabel(t, report?.lastRunAt ?? null)}
      </ParentText>

      <Card title={t('parent.home.week')} testID="card-week">
        <View style={{ flexDirection: 'row', marginBottom: parentSpacing.lg }}>
          {[
            [week?.activeDays ?? 0, t('parent.home.daysOf7')],
            [week?.minutes ?? 0, t('parent.home.minutes')],
            [week?.lessons ?? 0, t('parent.home.lessons')],
            [week?.reviewTasks ?? 0, t('parent.home.reviews')],
          ].map(([n, label], i) => (
            <View key={i} style={{ flex: 1, alignItems: 'center' }}>
              <ParentText role="number" testID={`week-n-${i}`}>
                {String(n)}
              </ParentText>
              <ParentText role="caption" color="textMuted" align="center" lines={2}>
                {String(label)}
              </ParentText>
            </View>
          ))}
        </View>
        {week && <WeekStrip days={week.days.map((d) => d.active)} labels={labels} todayIndex={6} />}
      </Card>

      <Card title={t('parent.home.mastered')} testID="card-mastered">
        {report && report.skills.mastered.length === 0 ? (
          <ParentText role="body">{t('parent.home.nothingYet')}</ParentText>
        ) : (
          report?.skills.mastered.slice(0, 5).map((s, i) => {
            const entry = SKILL_BY_ID.get(s.skill);
            return <Row key={s.skill} first={i === 0} label={entry ? t(entry.titleKey) : s.skill} value={entry ? t(`region.${entry.region}`) : undefined} hex={entry ? theme.colors.regionsInk[entry.region] : undefined} testID={`mastered-${s.skill}`} />;
          })
        )}
        {report && report.skills.mastered.length > 5 && <Row kind="link" label={t('parent.home.showAll', { n: report.skills.mastered.length })} onPress={() => router.push('/parent/mastered')} testID="mastered-all" />}
      </Card>

      <Card title={t('parent.home.hard')} testID="card-hard">
        {report && report.skills.hard.length === 0 ? (
          <ParentText role="body" testID="hard-empty">
            {t('parent.home.nothingStuck')}
          </ParentText>
        ) : (
          report?.skills.hard.map((s) => {
            const entry = SKILL_BY_ID.get(s.skill);
            return (
              <View key={s.skill} style={{ marginBottom: parentSpacing.md }} testID={`hard-${s.skill}`}>
                <ParentText role="body">{entry ? t(entry.titleKey) : s.skill}</ParentText>
                <ParentText role="caption" color="textMuted">
                  {t('parent.home.hardStats', { attempts: s.attempts, correct: s.correct })}
                </ParentText>
                <ParentText role="body">{t('parent.home.hardAdvice')}</ParentText>
              </View>
            );
          })
        )}
      </Card>

      <Card title={t('parent.home.inProgress')} testID="card-progress">
        <Row first label={t('parent.home.inProgressHint')} value={String(report?.skills.inProgress ?? 0)} />
      </Card>

      <Card title={t('parent.home.settings')} testID="card-settings">
        <Row first kind="value" label={t('parent.home.bandRow')} value={profile.band.replace('-', '–')} onPress={() => router.push({ pathname: '/parent/profile/[childId]', params: { childId: profile.childId } })} testID="row-settings" />
      </Card>

      <Card title={t('parent.home.data')} testID="card-data">
        <Row first kind="link" label={t('parent.home.consents')} onPress={() => router.push('/parent/consents')} testID="row-consents" />
        <Row kind="link" label={t('parent.home.deletion')} onPress={() => router.push('/parent/data')} testID="row-data" />
      </Card>
      <ParentButton variant="secondary" label={t('parent.profile.newTitle')} onPress={() => router.push('/parent/profile/new')} testID="home-add-child" />
    </ParentScreen>
  );
}
