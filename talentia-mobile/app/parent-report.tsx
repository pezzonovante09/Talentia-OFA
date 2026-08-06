import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Share, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { NanoBananaIcon } from '../src/components/NanoBananaIcon';
import { NANO_UI } from '../src/constants/nanoBananaAssets';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ConsentGate } from '../src/components/ConsentGate';
import { Screen } from '../src/components/Screen';
import { AppText } from '../src/components/Text';
import { Spacer } from '../src/components/Spacer';
import { Card } from '../src/components/Card';
import { Button } from '../src/components/Button';
import { PinModal } from '../src/components/PinModal';
import { useAppTheme } from '../src/theme';
import { useAuth } from '../src/context/AuthContext';
import {
  useProgressStore,
  getCompletedWorlds,
  getWeeklyStats,
  formatLocalDateYMD,
  type WeeklyDayStat,
} from '../src/store/progressStore';
import { useSettingsStore } from '../src/store/settingsStore';
import { useAbaLiveSessionStore } from '../src/store/abaLiveSessionStore';
import { isSupabaseConfigured, supabase } from '@/src/services/supabase';
import {
  generateReport,
  getWeeklyReport,
  generateWorldReport,
  getWorldStats,
  type ParentReport,
  type WeeklyReport,
  type WorldReport,
} from '../src/services/reportService';
import { useCloudProgress } from '../src/hooks/useCloudProgress';

type TabId = 'overall' | 'weekly' | 'byIsland';

// If the live session claims to be active but its last update is older than
// this, the realtime channel or the child's connection is likely stuck
// (app backgrounded, network drop, etc.) rather than the child just being
// slow to answer — show a "stale" warning instead of a falsely-fresh timestamp.
const LIVE_SESSION_STALE_MS = 90_000;

type RealtimeAbaSession = {
  active: boolean;
  lessonTitleKey: string;
  taskIndex: number;
  totalTasks: number;
  lastResult: string | null;
  lastUpdated: string | null;
  tasksCompleted: number;
  tasksSkipped: number;
  mistakes: number;
  tokensEarned: number | null;
  status: string;
};

function mapAbaLiveSessionRow(row: Record<string, unknown>): RealtimeAbaSession {
  const status = String(row.status ?? '');
  return {
    active: status === 'active',
    lessonTitleKey: String(row.lesson_title_key ?? ''),
    taskIndex: Number(row.task_index ?? 0),
    totalTasks: Number(row.total_tasks ?? 0),
    lastResult: row.last_result != null ? String(row.last_result) : null,
    lastUpdated: row.last_updated != null ? String(row.last_updated) : null,
    tasksCompleted: Number(row.tasks_completed ?? 0),
    tasksSkipped: Number(row.tasks_skipped ?? 0),
    mistakes: Number(row.mistakes ?? 0),
    tokensEarned: row.tokens_earned != null ? Number(row.tokens_earned) : null,
    status,
  };
}

// ── 7-day XP bar chart (local calendar dates, same source as getWeeklyStats) ─
function XPWeekChart({
  weeklyStats,
  theme,
}: {
  weeklyStats: WeeklyDayStat[];
  theme: ReturnType<typeof useAppTheme>;
}) {
  const { t, i18n } = useTranslation();

  const localeMap: Record<string, string> = { en: 'en-US', ru: 'ru-RU', ky: 'ky-KG' };
  const dateLocale = localeMap[i18n.language] ?? 'ru-RU';
  const todayKey = formatLocalDateYMD(new Date());

  const maxXP = Math.max(...weeklyStats.map((d) => d.xpEarned), 1);

  return (
    <Card style={{ marginBottom: 0 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: theme.spacing.md }}>
        <MaterialIcons name="show-chart" size={22} color={theme.colors.primary} />
        <AppText variant="subtitle">{t('parentReport.xpChart')}</AppText>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 80 }}>
        {weeklyStats.map((day) => {
          const xp = day.xpEarned;
          const barHeight = Math.max(4, (xp / maxXP) * 68);
          const isToday = day.date === todayKey;
          const dayLabel = new Date(`${day.date}T12:00:00`).toLocaleDateString(dateLocale, { weekday: 'short' });
          return (
            <View key={day.date} style={{ flex: 1, alignItems: 'center' }}>
              {xp > 0 && (
                <AppText
                  style={{ fontSize: 9, color: theme.colors.primary, fontWeight: '700', marginBottom: 2 }}
                >
                  {xp}
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
                {dayLabel}
              </AppText>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

function ParentReportScreenContent() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const router = useRouter();
  const profile = useAuth((s) => s.profile);
  const user = useAuth((s) => s.user);
  const { data: cloudProgress, loading: cloudLoading } = useCloudProgress(user?.id);

  const globalCorrectCount = useProgressStore((s) => s.globalCorrectCount);
  const streakCount = useProgressStore((s) => s.streakCount);
  const topics = useProgressStore((s) => s.topics);
  const xpHistory = useProgressStore((s) => s.xpHistory);
  const lessonsCompletedByDate = useProgressStore((s) => s.lessonsCompletedByDate);
  const correctAnswersByDate = useProgressStore((s) => s.correctAnswersByDate);

  const weeklyStats = useMemo(
    () => getWeeklyStats(),
    [xpHistory, lessonsCompletedByDate, correctAnswersByDate],
  );
  const lessonsSum = useMemo(
    () => weeklyStats.reduce((acc, d) => acc + d.lessonsCompleted, 0),
    [weeklyStats],
  );
  const correctSum = useMemo(
    () => weeklyStats.reduce((acc, d) => acc + d.correctAnswers, 0),
    [weeklyStats],
  );
  const xpSum = useMemo(() => weeklyStats.reduce((acc, d) => acc + d.xpEarned, 0), [weeklyStats]);

  const parentPin = useSettingsStore((s) => s.parentPin);
  const parentPinHydrated = useSettingsStore((s) => s.parentPinHydrated);
  const language = useSettingsStore((s) => s.language);

  const abaLiveActive = useAbaLiveSessionStore((s) => s.active);
  const abaLiveLessonTitleKey = useAbaLiveSessionStore((s) => s.lessonTitleKey);
  const abaLiveTaskIndex = useAbaLiveSessionStore((s) => s.taskIndex);
  const abaLiveTotalTasks = useAbaLiveSessionStore((s) => s.totalTasks);
  const abaLiveLastResult = useAbaLiveSessionStore((s) => s.lastResult);
  const abaLiveLastUpdated = useAbaLiveSessionStore((s) => s.lastUpdated);
  const abaLiveSummary = useAbaLiveSessionStore((s) => s.lastSummary);

  const [realtimeSession, setRealtimeSession] = useState<RealtimeAbaSession | null>(null);

  const [activeTab, setActiveTab] = useState<TabId>('overall');
  const [report, setReport] = useState<ParentReport | null>(null);
  const [weekly, setWeekly] = useState<WeeklyReport | null>(null);
  const [worldReports, setWorldReports] = useState<Record<string, WorldReport>>({});
  const [loadingWorlds, setLoadingWorlds] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pinVerified, setPinVerified] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);

  useLayoutEffect(() => {
    if (!parentPinHydrated) return;
    // SecureStore / PIN is unavailable on web — never auto-unlock the parent report.
    if (Platform.OS === 'web') {
      setPinVerified(false);
      setShowPinModal(false);
      return;
    }
    setPinVerified(!parentPin);
    setShowPinModal(!!parentPin);
  }, [parentPinHydrated, parentPin]);

  const totalAttempts = Object.values(topics).reduce(
    (sum, tp) => sum + (tp?.totalAttempts ?? 0),
    0,
  );

  const baseStats = {
    accuracyBySubject: {} as Record<string, number>,
    totalCorrect: cloudProgress?.totalLessonsCompleted
      ? cloudProgress.totalLessonsCompleted
      : globalCorrectCount,
    totalAttempts,
    streakCount: cloudProgress?.streakCount ?? streakCount,
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
      const w = getWeeklyStats();
      const lessonsThisWeek = w.reduce((acc, d) => acc + d.lessonsCompleted, 0);
      const correctThisWeek = w.reduce((acc, d) => acc + d.correctAnswers, 0);
      const weekStartDate = w[0]?.date ?? '';
      getWeeklyReport({
        ...baseStats,
        lessonsThisWeek,
        correctThisWeek,
        weekStartDate,
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

  useEffect(() => {
    if (!pinVerified || !isSupabaseConfigured) return;

    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const fetchActive = async (userId: string) => {
      const { data: activeRow } = await supabase
        .from('aba_live_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();
      if (cancelled) return;
      if (activeRow && typeof activeRow === 'object') {
        setRealtimeSession(mapAbaLiveSessionRow(activeRow as Record<string, unknown>));
      } else {
        setRealtimeSession(null);
      }
    };

    const subscribeForUser = (userId: string) => {
      if (cancelled) return;
      if (channel) {
        void supabase.removeChannel(channel);
        channel = null;
      }

      const ch = supabase
        .channel(`aba_live_sessions:${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'aba_live_sessions',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            if (payload.eventType === 'DELETE') {
              const oldRow = payload.old as Record<string, unknown> | undefined;
              if (oldRow && String(oldRow.user_id ?? '') === userId) {
                setRealtimeSession(null);
              }
              return;
            }
            const row = payload.new as Record<string, unknown> | undefined;
            if (!row || typeof row !== 'object') return;
            setRealtimeSession(mapAbaLiveSessionRow(row));
          },
        )
        .subscribe((status) => {
          if (cancelled) return;
          if (status === 'SUBSCRIBED') {
            void fetchActive(userId);
            return;
          }
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            if (reconnectTimer) clearTimeout(reconnectTimer);
            reconnectTimer = setTimeout(() => {
              if (!cancelled) subscribeForUser(userId);
            }, 2500);
          }
        });

      channel = ch;
    };

    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId || cancelled) return;
      await fetchActive(userId);
      if (cancelled) return;
      subscribeForUser(userId);
    })().catch(console.error);

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [pinVerified]);

  const liveActive =
    realtimeSession != null ? realtimeSession.status === 'active' : abaLiveActive;
  const liveLessonTitleKey = realtimeSession?.lessonTitleKey ?? abaLiveLessonTitleKey;
  const liveTaskIndex = realtimeSession?.taskIndex ?? abaLiveTaskIndex;
  const liveTotalTasks = realtimeSession?.totalTasks ?? abaLiveTotalTasks;
  const liveLastResult = realtimeSession?.lastResult ?? abaLiveLastResult;
  const liveLastUpdated =
    realtimeSession?.lastUpdated ??
    (abaLiveLastUpdated != null ? new Date(abaLiveLastUpdated).toISOString() : null);

  // Ticks every few seconds while a live session is shown so the staleness
  // check below re-evaluates over time, even if no new realtime event ever
  // arrives (which is exactly the case we want to detect and warn about).
  const [liveNowTick, setLiveNowTick] = useState(() => Date.now());
  useEffect(() => {
    if (!liveActive) return;
    const id = setInterval(() => setLiveNowTick(Date.now()), 5000);
    return () => clearInterval(id);
  }, [liveActive]);

  const isLiveSessionStale =
    liveActive && liveLastUpdated != null && liveNowTick - new Date(liveLastUpdated).getTime() > LIVE_SESSION_STALE_MS;

  const displaySummary =
    realtimeSession != null && realtimeSession.status === 'finished'
      ? {
          lessonTitleKey: realtimeSession.lessonTitleKey,
          tasksCompleted: realtimeSession.tasksCompleted,
          tasksSkipped: realtimeSession.tasksSkipped,
          mistakes: realtimeSession.mistakes,
          tokensEarned: realtimeSession.tokensEarned ?? 0,
        }
      : abaLiveSummary
        ? {
            lessonTitleKey: abaLiveSummary.lessonTitleKey,
            tasksCompleted: abaLiveSummary.tasksCompleted,
            tasksSkipped: abaLiveSummary.tasksSkipped,
            mistakes: abaLiveSummary.mistakes,
            tokensEarned: abaLiveSummary.tokensEarned,
          }
        : null;

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
            t('parentReport.childModeLabel') + ': ' + (profile?.child_mode ?? 'standard'),
          ]
            .filter(Boolean)
            .join('\n')
        : '';
    router.push({ pathname: '/tali', params: { context: 'parent', reportSummary: summary } });
  };

  const handleShare = async () => {
    if (!report) return;
    const text = [
      t('parentReport.title'),
      '',
      `${t('parentReport.strongSides')}:`,
      ...report.strongSides.map((s) => `• ${s}`),
      '',
      `${t('parentReport.weakSides')}:`,
      ...report.weakSides.map((s) => `• ${s}`),
      '',
      `${t('parentReport.advice')}:`,
      report.advice,
      '',
      `${t('profile.streakDaysLabel', { count: streakCount })}: ${streakCount}`,
      `${t('profile.correctLabel')}: ${globalCorrectCount}`,
    ].join('\n');

    await Share.share({ message: text });
  };

  const tabs: { id: TabId; labelKey: string }[] = [
    { id: 'overall', labelKey: 'parentReport.tabOverall' },
    { id: 'weekly', labelKey: 'parentReport.tabWeekly' },
    { id: 'byIsland', labelKey: 'parentReport.tabByIsland' },
  ];

  if (!parentPinHydrated) {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </Screen>
    );
  }

  // PIN gate (native) / hard block (web — PIN cannot protect this screen)
  if (Platform.OS === 'web') {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}>
          <NanoBananaIcon source={NANO_UI.lock} size={48} />
          <Spacer size="md" />
          <AppText variant="subtitle" style={{ textAlign: 'center', fontWeight: '800' }}>
            {t('parentReport.pinGateTitle')}
          </AppText>
          <Spacer size="xs" />
          <AppText style={{ color: theme.colors.error, textAlign: 'center' }}>
            {t('pin.webUnprotectedWarning')}
          </AppText>
          <Spacer size="md" />
          <Button onPress={() => router.back()}>{t('common.back')}</Button>
        </View>
      </Screen>
    );
  }

  if (!pinVerified) {
    return (
      <>
        <Screen>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <NanoBananaIcon source={NANO_UI.lock} size={48} />
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

      {((activeTab === 'overall' && report?.isStub) || (activeTab === 'weekly' && weekly?.isStub)) && (
        <>
          <View
            style={{
              backgroundColor: '#FFF8E6',
              borderRadius: theme.radii.md,
              borderWidth: 1,
              borderColor: '#F0C040',
              paddingVertical: theme.spacing.sm,
              paddingHorizontal: theme.spacing.md,
            }}
          >
            <AppText variant="small" style={{ color: '#7A5800', lineHeight: 20 }}>
              {t('parentReport.stubNotice')}
            </AppText>
          </View>
          <Spacer size="md" />
        </>
      )}

      {(profile?.child_mode === 'special' || liveActive || displaySummary != null) && (
        <Card style={{ marginBottom: theme.spacing.lg, borderLeftWidth: 4, borderLeftColor: theme.colors.primary }}>
          <AppText variant="subtitle" style={{ fontWeight: '800', marginBottom: theme.spacing.sm }}>
            {t('parentReport.liveSessionTitle')}
          </AppText>
          {!liveActive && !displaySummary ? (
            <AppText style={{ color: theme.colors.textMuted }}>{t('parentReport.liveSessionIdle')}</AppText>
          ) : null}
          {liveActive && liveLessonTitleKey ? (
            <View style={{ gap: 6 }}>
              {isLiveSessionStale ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    backgroundColor: '#FFF3CD',
                    borderRadius: 8,
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    marginBottom: 2,
                  }}
                >
                  <MaterialIcons name="wifi-off" size={16} color="#7A5800" />
                  <AppText variant="small" style={{ color: '#7A5800', flex: 1 }}>
                    {t('parentReport.liveSessionStale')}
                  </AppText>
                </View>
              ) : null}
              <AppText>
                {t('parentReport.liveSessionLesson')}: {t(liveLessonTitleKey)}
              </AppText>
              <AppText style={{ color: theme.colors.textMuted }}>
                {t('parentReport.liveSessionTask', {
                  current: liveTaskIndex + 1,
                  total: Math.max(liveTotalTasks, 1),
                })}
              </AppText>
              {liveLastResult ? (
                <AppText>
                  {t('parentReport.liveSessionLast')}:{' '}
                  {liveLastResult === 'correct'
                    ? t('parentReport.liveSessionResultCorrect')
                    : liveLastResult === 'incorrect'
                      ? t('parentReport.liveSessionResultIncorrect')
                      : t('parentReport.liveSessionResultSkipped')}
                </AppText>
              ) : null}
              {liveLastUpdated ? (
                <AppText
                  variant="small"
                  style={{ color: isLiveSessionStale ? '#B45309' : theme.colors.textMuted }}
                >
                  {new Date(liveLastUpdated).toLocaleString(
                    language === 'en' ? 'en-US' : language === 'ky' ? 'ky-KG' : 'ru-RU',
                  )}
                </AppText>
              ) : null}
            </View>
          ) : null}
          {displaySummary ? (
            <View style={{ marginTop: liveActive ? theme.spacing.md : 0, gap: 4 }}>
              <AppText variant="small" style={{ fontWeight: '700' }}>
                {t('parentReport.liveSessionSummaryTitle')}
              </AppText>
              <AppText variant="small">{t(displaySummary.lessonTitleKey)}</AppText>
              <AppText variant="small">
                {t('parentReport.liveSessionSummaryTasks', { completed: displaySummary.tasksCompleted })}
              </AppText>
              <AppText variant="small">
                {t('parentReport.liveSessionSummarySkipped', { skipped: displaySummary.tasksSkipped })}
              </AppText>
              <AppText variant="small">
                {t('parentReport.liveSessionSummaryMistakes', { mistakes: displaySummary.mistakes })}
              </AppText>
              <AppText variant="small">
                {t('parentReport.liveSessionSummaryTokens', { tokens: displaySummary.tokensEarned })}
              </AppText>
            </View>
          ) : null}
        </Card>
      )}

      {/* XP 7-day chart */}
      <XPWeekChart weeklyStats={weeklyStats} theme={theme} />

      {cloudLoading && (
        <ActivityIndicator
          size="small"
          color={theme.colors.primary}
          style={{ marginTop: theme.spacing.md }}
        />
      )}

      {cloudProgress && (
        <Card style={{ marginTop: theme.spacing.md }}>
          <AppText variant="subtitle">{t('parentReport.cloudSummary')}</AppText>
          <Spacer size="sm" />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View style={{ alignItems: 'center' }}>
              <AppText variant="title">{cloudProgress.totalLessonsCompleted}</AppText>
              <AppText variant="small" style={{ color: theme.colors.textMuted }}>
                {t('parentReport.lessonsTotal')}
              </AppText>
            </View>
            <View style={{ alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <AppText variant="title">{cloudProgress.totalStars}</AppText>
                <NanoBananaIcon source={NANO_UI.stars} size={28} accessibilityLabel="stars" />
              </View>
              <AppText variant="small" style={{ color: theme.colors.textMuted }}>
                {t('parentReport.starsTotal')}
              </AppText>
            </View>
            <View style={{ alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <AppText variant="title">{cloudProgress.streakCount}</AppText>
                <NanoBananaIcon source={NANO_UI.streak} size={28} accessibilityLabel="streak" />
              </View>
              <AppText variant="small" style={{ color: theme.colors.textMuted }}>
                {t('parentReport.streak')}
              </AppText>
            </View>
            <View style={{ alignItems: 'center' }}>
              <AppText variant="title">Lv.{cloudProgress.level}</AppText>
              <AppText variant="small" style={{ color: theme.colors.textMuted }}>
                {t('parentReport.level')}
              </AppText>
            </View>
          </View>
        </Card>
      )}

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
              {t('parentReport.strongSides')}
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
                  {t('parentReport.commonMistakes')}
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
              {t('parentReport.advice')}
            </AppText>
            <Spacer size="xs" />
            <AppText style={{ lineHeight: 24 }}>{report.advice}</AppText>
          </Card>
          <Spacer size="xl" />
          <Button onPress={handleDiscussWithAI}>{t('parentReport.discussWithAI')}</Button>
          <Spacer size="sm" />
          <Button variant="secondary" onPress={handleShare}>
            {t('parentReport.share')}
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
                          {t('parentReport.strongSides')}
                        </AppText>
                        {wr.strongSides.map((s, i) => (
                          <AppText key={i} style={{ marginBottom: theme.spacing.xs }}>• {s}</AppText>
                        ))}
                        {(wr.commonMistakes?.length ?? 0) > 0 && (
                          <>
                            <Spacer size="sm" />
                            <AppText variant="small" style={{ fontWeight: '700', color: theme.colors.secondary, marginBottom: theme.spacing.xs }}>
                              {t('parentReport.commonMistakes')}
                            </AppText>
                            {wr.commonMistakes!.map((s, i) => (
                              <AppText key={i} style={{ marginBottom: theme.spacing.xs }}>• {s}</AppText>
                            ))}
                          </>
                        )}
                        <Spacer size="sm" />
                        <AppText variant="small" style={{ fontWeight: '700', color: theme.colors.primary, marginBottom: theme.spacing.xs }}>
                          {t('parentReport.advice')}
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
            <View style={{ gap: theme.spacing.sm }}>
              <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                <View
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    backgroundColor: theme.colors.primary + '11',
                    borderRadius: theme.radii.md,
                    padding: theme.spacing.sm,
                  }}
                >
                  <MaterialIcons name="menu-book" size={28} color={theme.colors.primary} />
                  <AppText variant="small" style={{ fontWeight: '700', color: theme.colors.primary }}>
                    {lessonsSum}
                  </AppText>
                  <AppText variant="small" style={{ color: theme.colors.textMuted, textAlign: 'center' }}>
                    {t('parentReport.lessonsLabel', { count: lessonsSum })}
                  </AppText>
                </View>
                <View
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    backgroundColor: theme.colors.success + '11',
                    borderRadius: theme.radii.md,
                    padding: theme.spacing.sm,
                  }}
                >
                  <NanoBananaIcon source={NANO_UI.check} size={28} />
                  <AppText variant="small" style={{ fontWeight: '700', color: theme.colors.success }}>
                    {correctSum}
                  </AppText>
                  <AppText variant="small" style={{ color: theme.colors.textMuted, textAlign: 'center' }}>
                    {t('parentReport.correctLabel')}
                  </AppText>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                <View
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    backgroundColor: '#F0A00018',
                    borderRadius: theme.radii.md,
                    padding: theme.spacing.sm,
                  }}
                >
                  <MaterialIcons name="bolt" size={28} color="#C49000" />
                  <AppText variant="small" style={{ fontWeight: '700', color: '#A67C00' }}>
                    {xpSum}
                  </AppText>
                  <AppText variant="small" style={{ color: theme.colors.textMuted, textAlign: 'center' }}>
                    {t('parentReport.weeklyXpLabel')}
                  </AppText>
                </View>
                <View
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    backgroundColor: theme.colors.secondary + '11',
                    borderRadius: theme.radii.md,
                    padding: theme.spacing.sm,
                  }}
                >
                  <NanoBananaIcon source={NANO_UI.streak} size={28} />
                  <AppText variant="small" style={{ fontWeight: '700', color: theme.colors.secondary }}>
                    {streakCount}
                  </AppText>
                  <AppText variant="small" style={{ color: theme.colors.textMuted, textAlign: 'center' }}>
                    {t('profile.streakDaysLabel', { count: streakCount })}
                  </AppText>
                </View>
              </View>
            </View>
          </Card>

          <Spacer size="md" />
          <Card>
            <AppText variant="subtitle" style={{ color: theme.colors.primary, fontWeight: '800' }}>
              {t('parentReport.advice')}
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

export default function ParentReportScreen() {
  return (
    <ConsentGate>
      <ParentReportScreenContent />
    </ConsentGate>
  );
}
