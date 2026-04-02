import React, { useEffect, useState } from 'react';
import { Pressable, Share, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Screen } from '../src/components/Screen';
import { AppText } from '../src/components/Text';
import { Spacer } from '../src/components/Spacer';
import { Card } from '../src/components/Card';
import { Button } from '../src/components/Button';
import { PinModal } from '../src/components/PinModal';
import { useAppTheme } from '../src/theme';
import { useAuth } from '../src/context/AuthContext';
import { useProgressStore, getCompletedWorlds } from '../src/store/progressStore';
import { useSettingsStore } from '../src/store/settingsStore';
import {
  generateReport,
  getWeeklyReport,
  generateWorldReport,
  getWorldStats,
  type ParentReport,
  type WeeklyReport,
  type WorldReport,
} from '../src/services/reportService';

type TabId = 'overall' | 'weekly' | 'byIsland';

// ── 7-day XP bar chart ────────────────────────────────────────────────────────
function XPWeekChart({
  xpHistory,
  theme,
}: {
  xpHistory: Record<string, number>;
  theme: ReturnType<typeof useAppTheme>;
}) {
  const { t, i18n } = useTranslation();

  const localeMap: Record<string, string> = { en: 'en-US', ru: 'ru-RU', ky: 'ru-RU' };
  const dateLocale = localeMap[i18n.language] ?? 'ru-RU';

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().slice(0, 10);
    const dayLabel = d.toLocaleDateString(dateLocale, { weekday: 'short' });
    return { key, dayLabel, xp: xpHistory[key] ?? 0 };
  });

  const maxXP = Math.max(...days.map((d) => d.xp), 1);

  return (
    <Card style={{ marginBottom: 0 }}>
      <AppText variant="subtitle" style={{ marginBottom: theme.spacing.md }}>
        📈 {t('parentReport.xpChart')}
      </AppText>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 80 }}>
        {days.map((day) => {
          const barHeight = Math.max(4, (day.xp / maxXP) * 68);
          const isToday = day.key === new Date().toISOString().slice(0, 10);
          return (
            <View key={day.key} style={{ flex: 1, alignItems: 'center' }}>
              {day.xp > 0 && (
                <AppText
                  style={{ fontSize: 9, color: theme.colors.primary, fontWeight: '700', marginBottom: 2 }}
                >
                  {day.xp}
                </AppText>
              )}
              <View
                style={{
                  width: '100%',
                  height: barHeight,
                  backgroundColor: isToday ? theme.colors.primary : theme.colors.primary + '60',
                  borderRadius: theme.radii.sm,
                }}
              />
              <AppText
                style={{
                  fontSize: 9,
                  color: isToday ? theme.colors.primary : theme.colors.textMuted,
                  fontWeight: isToday ? '700' : '400',
                  marginTop: 3,
                  textTransform: 'capitalize',
                }}
              >
                {day.dayLabel}
              </AppText>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

export default function ParentReportScreen() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const router = useRouter();
  const profile = useAuth().profile;

  const globalCorrectCount = useProgressStore((s) => s.globalCorrectCount);
  const streakCount = useProgressStore((s) => s.streakCount);
  const topics = useProgressStore((s) => s.topics);
  const xpHistory = useProgressStore((s) => s.xpHistory);

  const parentPin = useSettingsStore((s) => s.parentPin);
  const language = useSettingsStore((s) => s.language);

  const [activeTab, setActiveTab] = useState<TabId>('overall');
  const [report, setReport] = useState<ParentReport | null>(null);
  const [weekly, setWeekly] = useState<WeeklyReport | null>(null);
  const [worldReports, setWorldReports] = useState<Record<string, WorldReport>>({});
  const [loadingWorlds, setLoadingWorlds] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pinVerified, setPinVerified] = useState(!parentPin);
  const [showPinModal, setShowPinModal] = useState(!!parentPin);

  const totalAttempts = Object.values(topics).reduce(
    (sum, tp) => sum + (tp?.totalAttempts ?? 0),
    0,
  );

  const baseStats = {
    accuracyBySubject: {} as Record<string, number>,
    totalCorrect: globalCorrectCount,
    totalAttempts,
    streakCount,
    childMode: profile?.child_mode ?? 'standard',
    methodology: profile?.methodology ?? null,
    language,
  };

  const completedWorlds = getCompletedWorlds(topics);

  /** Сброс кэша при смене языка — иначе остаётся старый текст отчёта */
  useEffect(() => {
    setReport(null);
    setWeekly(null);
    setWorldReports({});
    setLoadingWorlds({});
  }, [language]);

  const fetchWorldReport = async (worldId: string, worldName: string) => {
    setLoadingWorlds((prev) => ({ ...prev, [worldId]: true }));
    const worldStats = getWorldStats(worldId, topics);
    const stats: typeof baseStats = {
      ...baseStats,
      ...(worldStats ?? {}),
    };
    try {
      const r = await generateWorldReport({
        worldId,
        worldName,
        stats,
        language,
      });
      setWorldReports((prev) => ({ ...prev, [worldId]: r }));
    } catch {
      setError(t('profile.parentReportError'));
    } finally {
      setLoadingWorlds((prev) => ({ ...prev, [worldId]: false }));
    }
  };

  useEffect(() => {
    if (!pinVerified) return;
    if (activeTab === 'overall' && !report) {
      setError('');
      setLoading(true);
      generateReport(baseStats, language)
        .then(setReport)
        .catch(() => setError(t('profile.parentReportError')))
        .finally(() => setLoading(false));
    }
    if (activeTab === 'weekly' && !weekly) {
      setError('');
      setLoading(true);
      getWeeklyReport({
        ...baseStats,
        lessonsThisWeek: Math.min(totalAttempts, 20),
        correctThisWeek: Math.min(globalCorrectCount, 20),
        weekStartDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      })
        .then(setWeekly)
        .catch(() => setError(t('profile.parentReportError')))
        .finally(() => setLoading(false));
    }
  }, [activeTab, pinVerified, language]);

  useEffect(() => {
    if (!pinVerified || activeTab !== 'byIsland') return;
    for (const world of completedWorlds) {
      if (!worldReports[world.id] && !loadingWorlds[world.id]) {
        fetchWorldReport(world.id, t(world.titleKey));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchWorldReport is stable enough
  }, [activeTab, pinVerified, completedWorlds.length]);

  const handleDiscussWithAI = () => {
    const summary =
      report != null
        ? [
            t('parentReport.strongSides') + ': ' + report.strongSides.join(', '),
            t('parentReport.weakSides') + ': ' + report.weakSides.join(', '),
            report.commonMistakes?.length
              ? t('parentReport.commonMistakes') + ': ' + report.commonMistakes.join(', ')
              : '',
            t('parentReport.advice') + ': ' + report.advice,
            'Child mode: ' + (profile?.child_mode ?? 'standard'),
          ]
            .filter(Boolean)
            .join('\n')
        : '';
    router.push({ pathname: '/tali', params: { context: 'parent', reportSummary: summary } });
  };

  const handleShare = async () => {
    if (!report) return;
    const text = [
      `📊 ${t('parentReport.title')}`,
      '',
      `✅ ${t('parentReport.strongSides')}:`,
      ...report.strongSides.map((s) => `• ${s}`),
      '',
      `⚠️ ${t('parentReport.weakSides')}:`,
      ...report.weakSides.map((s) => `• ${s}`),
      '',
      `💡 ${t('parentReport.advice')}:`,
      report.advice,
      '',
      `🔥 ${t('profile.streakDaysLabel')}: ${streakCount}`,
      `✅ ${t('profile.correctLabel')}: ${globalCorrectCount}`,
    ].join('\n');

    await Share.share({ message: text });
  };

  const tabs: { id: TabId; labelKey: string }[] = [
    { id: 'overall', labelKey: 'parentReport.tabOverall' },
    { id: 'weekly', labelKey: 'parentReport.tabWeekly' },
    { id: 'byIsland', labelKey: 'parentReport.tabByIsland' },
  ];

  // PIN gate
  if (!pinVerified) {
    return (
      <>
        <Screen>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <AppText style={{ fontSize: 48 }}>🔐</AppText>
            <Spacer size="md" />
            <AppText variant="subtitle" style={{ textAlign: 'center', fontWeight: '800' }}>
              {t('parentReport.pinGateTitle')}
            </AppText>
            <Spacer size="xs" />
            <AppText style={{ color: theme.colors.textMuted, textAlign: 'center' }}>
              {t('parentReport.pinGateHint')}
            </AppText>
          </View>
        </Screen>
        <PinModal
          visible={showPinModal}
          mode="verify"
          existingPin={parentPin}
          onSuccess={() => { setPinVerified(true); setShowPinModal(false); }}
          onCancel={() => { setShowPinModal(false); router.back(); }}
        />
      </>
    );
  }

  return (
    <Screen scroll>
      <AppText variant="title" accessibilityRole="header">
        {t('parentReport.title')}
      </AppText>
      <Spacer size="xs" />
      <AppText style={{ color: theme.colors.textMuted }}>{t('parentReport.subtitle')}</AppText>
      <Spacer size="md" />

      {/* XP 7-day chart */}
      <XPWeekChart xpHistory={xpHistory} theme={theme} />
      <Spacer size="lg" />

      {/* Tabs */}
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.lg }}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={{ flex: 1 }}
              accessibilityRole="button"
            >
              <View
                style={{
                  paddingVertical: theme.spacing.sm,
                  borderRadius: theme.radii.pill,
                  backgroundColor: isActive ? theme.colors.primary : theme.colors.surfaceAlt,
                  borderWidth: 2,
                  borderColor: isActive ? theme.colors.primary : theme.colors.border,
                  alignItems: 'center',
                }}
              >
                <AppText
                  variant="small"
                  style={{ color: isActive ? '#fff' : theme.colors.text, fontWeight: '600' }}
                >
                  {t(tab.labelKey)}
                </AppText>
              </View>
            </Pressable>
          );
        })}
      </View>

      {loading && (
        <Card>
          <AppText>{t('profile.parentReportLoading')}</AppText>
        </Card>
      )}

      {!loading && error && (
        <Card>
          <AppText style={{ color: theme.colors.error }}>{error}</AppText>
        </Card>
      )}

      {/* Overall tab */}
      {!loading && !error && activeTab === 'overall' && report && (
        <>
          <Card>
            <AppText variant="subtitle" style={{ color: theme.colors.success, fontWeight: '800' }}>
              ✅ {t('parentReport.strongSides')}
            </AppText>
            <Spacer size="xs" />
            {report.strongSides.map((s, i) => (
              <View key={i} style={{ marginBottom: theme.spacing.xs }}>
                <AppText>• {s}</AppText>
              </View>
            ))}
          </Card>
          {(report.commonMistakes?.length ?? 0) > 0 && (
            <>
              <Spacer size="md" />
              <Card>
                <AppText variant="subtitle" style={{ color: theme.colors.secondary, fontWeight: '800' }}>
                  ⚠️ {t('parentReport.commonMistakes')}
                </AppText>
                <Spacer size="xs" />
                {report.commonMistakes!.map((s, i) => (
                  <View key={i} style={{ marginBottom: theme.spacing.xs }}>
                    <AppText>• {s}</AppText>
                  </View>
                ))}
              </Card>
            </>
          )}
          <Spacer size="md" />
          <Card>
            <AppText variant="subtitle" style={{ color: theme.colors.primary, fontWeight: '800' }}>
              💡 {t('parentReport.advice')}
            </AppText>
            <Spacer size="xs" />
            <AppText style={{ lineHeight: 24 }}>{report.advice}</AppText>
          </Card>
          <Spacer size="xl" />
          <Button onPress={handleDiscussWithAI}>{t('parentReport.discussWithAI')}</Button>
          <Spacer size="sm" />
          <Button variant="secondary" onPress={handleShare}>
            📤 {t('parentReport.share')}
          </Button>
        </>
      )}

      {/* By Island tab */}
      {!loading && activeTab === 'byIsland' && (
        <>
          {completedWorlds.length === 0 ? (
            <Card>
              <AppText style={{ color: theme.colors.textMuted, textAlign: 'center' }}>
                {t('parentReport.noCompletedIslands')}
              </AppText>
            </Card>
          ) : (
            completedWorlds.map((world) => {
              const wr = worldReports[world.id];
              const isLoading = loadingWorlds[world.id];
              return (
                <React.Fragment key={world.id}>
                  <Spacer size="md" />
                  <Card
                    style={{
                      borderLeftWidth: 4,
                      borderLeftColor: world.accentColor,
                    }}
                  >
                    <AppText variant="subtitle" style={{ marginBottom: theme.spacing.sm }}>
                      {world.biome} {t('parentReport.islandReportTitle', { name: t(world.titleKey) })}
                    </AppText>
                    {isLoading && (
                      <AppText style={{ color: theme.colors.textMuted }}>
                        {t('parentReport.loadingIslandReport')}
                      </AppText>
                    )}
                    {!isLoading && wr && (
                      <>
                        <AppText variant="small" style={{ fontWeight: '700', color: theme.colors.success, marginBottom: theme.spacing.xs }}>
                          ✅ {t('parentReport.strongSides')}
                        </AppText>
                        {wr.strongSides.map((s, i) => (
                          <AppText key={i} style={{ marginBottom: theme.spacing.xs }}>• {s}</AppText>
                        ))}
                        {(wr.commonMistakes?.length ?? 0) > 0 && (
                          <>
                            <Spacer size="sm" />
                            <AppText variant="small" style={{ fontWeight: '700', color: theme.colors.secondary, marginBottom: theme.spacing.xs }}>
                              ⚠️ {t('parentReport.commonMistakes')}
                            </AppText>
                            {wr.commonMistakes!.map((s, i) => (
                              <AppText key={i} style={{ marginBottom: theme.spacing.xs }}>• {s}</AppText>
                            ))}
                          </>
                        )}
                        <Spacer size="sm" />
                        <AppText variant="small" style={{ fontWeight: '700', color: theme.colors.primary, marginBottom: theme.spacing.xs }}>
                          💡 {t('parentReport.advice')}
                        </AppText>
                        <AppText>{wr.advice}</AppText>
                      </>
                    )}
                  </Card>
                </React.Fragment>
              );
            })
          )}
        </>
      )}

      {/* Weekly tab */}
      {!loading && !error && activeTab === 'weekly' && weekly && (
        <>
          <Card>
            <AppText variant="subtitle">{t('parentReport.weeklyTitle')}</AppText>
            <Spacer size="sm" />
            <View style={{ gap: theme.spacing.xs }}>
              <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
                <View style={{ flex: 1, alignItems: 'center', backgroundColor: theme.colors.primary + '11', borderRadius: theme.radii.md, padding: theme.spacing.sm }}>
                  <AppText style={{ fontSize: 28 }}>📚</AppText>
                  <AppText variant="small" style={{ fontWeight: '700', color: theme.colors.primary }}>
                    {weekly.lessonsThisWeek}
                  </AppText>
                  <AppText variant="small" style={{ color: theme.colors.textMuted, textAlign: 'center' }}>
                    {t('parentReport.lessonsLabel')}
                  </AppText>
                </View>
                <View style={{ flex: 1, alignItems: 'center', backgroundColor: theme.colors.success + '11', borderRadius: theme.radii.md, padding: theme.spacing.sm }}>
                  <AppText style={{ fontSize: 28 }}>✅</AppText>
                  <AppText variant="small" style={{ fontWeight: '700', color: theme.colors.success }}>
                    {weekly.correctThisWeek}
                  </AppText>
                  <AppText variant="small" style={{ color: theme.colors.textMuted, textAlign: 'center' }}>
                    {t('parentReport.correctLabel')}
                  </AppText>
                </View>
                <View style={{ flex: 1, alignItems: 'center', backgroundColor: theme.colors.secondary + '11', borderRadius: theme.radii.md, padding: theme.spacing.sm }}>
                  <AppText style={{ fontSize: 28 }}>🔥</AppText>
                  <AppText variant="small" style={{ fontWeight: '700', color: theme.colors.secondary }}>
                    {weekly.streakCount}
                  </AppText>
                  <AppText variant="small" style={{ color: theme.colors.textMuted, textAlign: 'center' }}>
                    {t('profile.streakDaysLabel')}
                  </AppText>
                </View>
              </View>
            </View>
          </Card>

          <Spacer size="md" />
          <Card>
            <AppText variant="subtitle" style={{ color: theme.colors.primary, fontWeight: '800' }}>
              💡 {t('parentReport.advice')}
            </AppText>
            <Spacer size="xs" />
            <AppText style={{ lineHeight: 24 }}>{weekly.advice}</AppText>
          </Card>
        </>
      )}

      <Spacer size="xl" />
    </Screen>
  );
}
