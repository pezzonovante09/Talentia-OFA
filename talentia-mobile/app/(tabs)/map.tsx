import React, { useMemo } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../src/context/AuthContext';
import { useTranslation } from 'react-i18next';

import { Screen } from '../../src/components/Screen';
import { AppText } from '../../src/components/Text';
import { Spacer } from '../../src/components/Spacer';
import { MapPathNode, PathBridge, PathSpineColumn } from '../../src/components/map/MapPathParts';
import {
  METHODOLOGY_STYLES,
  METHODOLOGY_DECOR,
  WORLD_DECOR,
  PATH_NODE_SIZE,
} from '../../src/components/map/mapConstants';
import { useAppTheme } from '../../src/theme';
import {
  getOrderedLessonNodesForSubject,
  worlds,
  type LessonNode,
  type SubjectId,
} from '../../src/data/worlds';
import { getBiomeDisplayEmoji } from '../../src/utils/biomeDisplay';
import { useProgressStore, getXPToNextLevel } from '../../src/store/progressStore';
import { useSettingsStore } from '../../src/store/settingsStore';
import type { Methodology } from '../../src/store/settingsStore';

const TALI_SKIN_EMOJI: Record<string, string> = {
  default: '🦖',
  cool: '🦖💫',
  explorer: '🦖🎒',
  scientist: '🦖🔬',
};

const SUBJECTS: SubjectId[] = ['math', 'russian', 'english', 'science'];
const SUBJECT_LABEL_KEYS: Record<SubjectId, string> = {
  math: 'map.subjectMath',
  russian: 'map.subjectRussian',
  english: 'map.subjectEnglish',
  science: 'map.subjectScience',
};
const SUBJECT_EMOJI: Record<SubjectId, string> = {
  math: '🔢',
  russian: '📝',
  english: '📖',
  science: '🔬',
};

// ── World section banner ──────────────────────────────────────────────────────
function WorldBanner({
  worldId,
  theme,
  isPremiumUnlocked,
  methodology,
}: {
  worldId: string;
  theme: ReturnType<typeof useAppTheme>;
  isPremiumUnlocked: boolean;
  methodology: Methodology;
}) {
  const { t } = useTranslation();
  const world = worlds.find((w) => w.id === worldId);
  if (!world) return null;

  const isLocked = !!world.isPremium && !isPremiumUnlocked;
  const decor = WORLD_DECOR[worldId] ?? WORLD_DECOR.jungle;
  const methStyle = METHODOLOGY_STYLES[methodology] ?? METHODOLOGY_STYLES.aba;
  const methDecor = METHODOLOGY_DECOR[methodology] ?? { left: [], right: [] };

  const bannerBg = isLocked ? theme.colors.surfaceAlt : world.accentColor + 'E8';
  const bannerBorder = isLocked ? theme.colors.border : world.accentColor;
  const titleColor = isLocked ? theme.colors.textMuted : '#FFFFFF';
  const subColor = isLocked ? theme.colors.textMuted : 'rgba(255,255,255,0.92)';

  return (
    <View
      style={{
        borderRadius: theme.radii.lg,
        overflow: 'hidden',
        marginBottom: theme.spacing.sm,
        backgroundColor: bannerBg,
        borderWidth: 2,
        borderColor: bannerBorder,
        padding: theme.spacing.md,
        shadowColor: isLocked ? '#000' : world.accentColor,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: isLocked ? 0.06 : 0.25,
        shadowRadius: 8,
        elevation: isLocked ? 1 : 4,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <AppText style={{ fontSize: 40, opacity: isLocked ? 0.45 : 1 }}>{getBiomeDisplayEmoji(world.biome)}</AppText>

        <View style={{ flex: 1 }}>
          <AppText variant="subtitle" style={{ color: titleColor, fontWeight: '800' }}>
            {t(world.titleKey)}
          </AppText>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
            <AppText style={{ fontSize: 15 }}>{world.npcEmoji}</AppText>
            <AppText variant="small" style={{ color: subColor, fontWeight: '600' }}>
              {world.npcName ?? ''}
            </AppText>
            {methStyle.bannerTopEmoji && !isLocked && (
              <AppText style={{ fontSize: 14, opacity: 0.95 }}>{methStyle.bannerTopEmoji}</AppText>
            )}
          </View>
        </View>

        {/* Decoration preview */}
        {!isLocked && (
          <View style={{ alignItems: 'flex-end', gap: 2 }}>
            <View style={{ flexDirection: 'row', gap: 2 }}>
              {decor.left.slice(0, 2).map((e, i) => (
                <AppText key={i} style={{ fontSize: 13, opacity: 0.6 }}>{e}</AppText>
              ))}
            </View>
            {methDecor.left.length > 0 && (
              <View style={{ flexDirection: 'row', gap: 2 }}>
                {methDecor.left.slice(0, 2).map((e, i) => (
                  <AppText key={i} style={{ fontSize: 12, opacity: 0.5 }}>{e}</AppText>
                ))}
              </View>
            )}
          </View>
        )}

        {isLocked && (
          <View
            style={{
              backgroundColor: theme.colors.secondary + '25',
              borderRadius: theme.radii.sm,
              paddingHorizontal: theme.spacing.sm,
              paddingVertical: 4,
            }}
          >
            <AppText
              variant="small"
              style={{ color: theme.colors.secondary, fontWeight: '800', fontSize: 11 }}
            >
              ⭐ Premium
            </AppText>
          </View>
        )}
      </View>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function MapScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const theme = useAppTheme();
  const [selectedSubject, setSelectedSubject] = React.useState<SubjectId>('math');

  const getLessonStatus = useProgressStore((state) => state.getLessonStatus);
  const xp = useProgressStore((s) => s.xp);
  const level = useProgressStore((s) => s.level);
  const lessonStars = useProgressStore((s) => s.lessonStars);
  const dailyLessonsCompleted = useProgressStore((s) => s.dailyLessonsCompleted);
  const dailyGoal = useProgressStore((s) => s.dailyGoal);
  const dailyGoalDate = useProgressStore((s) => s.dailyGoalDate);
  const isPremium = useSettingsStore((s) => s.isPremium);
  const childName = useSettingsStore((s) => s.childName);
  const methodology = useSettingsStore((s) => s.methodology);
  const ageBand = useSettingsStore((s) => s.ageBand);
  const taliSkinId = useSettingsStore((s) => s.taliSkinId);
  const avatarEmoji = TALI_SKIN_EMOJI[taliSkinId] ?? '🦖';
  const { profile, isOffline } = useAuth();
  const hasSeenMapTip = useSettingsStore((s) => s.hasSeenMapTip);
  const setHasSeenMapTip = useSettingsStore((s) => s.setHasSeenMapTip);

  const methStyle = METHODOLOGY_STYLES[methodology] ?? METHODOLOGY_STYLES.aba;

  const xpInfo = getXPToNextLevel(xp);

  // Daily goal: reset count if date changed
  const today = new Date().toISOString().slice(0, 10);
  const todayDone = dailyGoalDate === today ? dailyLessonsCompleted : 0;
  const dailyGoalReached = todayDone >= dailyGoal;
  const greeting = childName?.trim()
    ? t('map.greetingWithName', { name: childName.trim() })
    : t('map.greetingNoName');

  const orderedNodes = useMemo(
    () => getOrderedLessonNodesForSubject(selectedSubject, ageBand),
    [selectedSubject, ageBand],
  );
  const orderedIds = useMemo(() => orderedNodes.map((n) => n.lessonId), [orderedNodes]);

  // Group nodes by worldId for banners + biome sections
  const groupedNodes = useMemo(() => {
    const groups: { worldId: string; nodes: { node: LessonNode; globalIndex: number }[] }[] = [];
    orderedNodes.forEach((node, i) => {
      const last = groups[groups.length - 1];
      if (!last || last.worldId !== node.worldId) {
        groups.push({ worldId: node.worldId, nodes: [{ node, globalIndex: i }] });
      } else {
        last.nodes.push({ node, globalIndex: i });
      }
    });
    return groups;
  }, [orderedNodes]);

  /** Subscribe so we re-render when lesson progress changes (`getLessonStatus` ref is stable). */
  useProgressStore((s) => s.topics);
  let firstAvailableLessonId: string | null = null;
  for (const id of orderedIds) {
    if (getLessonStatus(id, orderedIds) === 'available') {
      firstAvailableLessonId = id;
      break;
    }
  }

  // Methodology banner strip (shown when special mode is active)
  const methBannerConfig: Record<Methodology, { label: string; color: string; emoji: string } | null> = {
    montessori: { label: 'Монтессори', color: '#B5835A', emoji: '🌱' },
    aba: { label: 'ABA', color: '#5B8EE8', emoji: '📋' },
    teacch: { label: 'TEACCH', color: '#7B5CF6', emoji: '👁️' },
    mixed: null,
  };
  // Only show methodology banner in special mode
  const isSpecialMode = profile?.child_mode === 'special';
  const methBanner = isSpecialMode ? methBannerConfig[methodology] : null;

  return (
    <Screen scroll backgroundImage={require('../../assets/images/jungle-bg.png')}>
      {/* First-visit tutorial overlay */}
      {!hasSeenMapTip && (
        <Modal transparent animationType="fade" visible={!hasSeenMapTip}>
          <Pressable
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end', paddingBottom: 120 }}
            onPress={setHasSeenMapTip}
          >
            <View
              style={{
                backgroundColor: theme.colors.surface,
                borderRadius: theme.radii.lg,
                marginHorizontal: theme.spacing.lg,
                padding: theme.spacing.xl,
                alignItems: 'center',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.3,
                shadowRadius: 20,
                elevation: 12,
              }}
            >
              <AppText style={{ fontSize: 48 }}>🗺️</AppText>
              <Spacer size="sm" />
              <AppText variant="subtitle" style={{ textAlign: 'center', fontWeight: '800' }}>
                {t('map.tipTitle')}
              </AppText>
              <Spacer size="xs" />
              <AppText style={{ textAlign: 'center', color: theme.colors.textMuted, lineHeight: 22 }}>
                {t('map.tipBody')}
              </AppText>
              <Spacer size="lg" />
              <View
                style={{
                  backgroundColor: theme.colors.primary,
                  borderRadius: theme.radii.pill,
                  paddingHorizontal: theme.spacing.xl,
                  paddingVertical: theme.spacing.sm,
                }}
              >
                <AppText style={{ color: '#fff', fontWeight: '700' }}>
                  {t('map.tipButton')} 🦖
                </AppText>
              </View>
            </View>
          </Pressable>
        </Modal>
      )}

      {/* Methodology badge strip */}
      {methBanner && (
        <View
          style={{
            backgroundColor: methBanner.color + '18',
            borderRadius: theme.radii.md,
            borderWidth: 1.5,
            borderColor: methBanner.color + '44',
            paddingVertical: theme.spacing.xs,
            paddingHorizontal: theme.spacing.md,
            marginBottom: theme.spacing.sm,
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
          }}
        >
          <AppText style={{ fontSize: 16 }}>{methBanner.emoji}</AppText>
          <AppText
            variant="small"
            style={{ color: methBanner.color, fontWeight: '700', flex: 1 }}
          >
            {methBanner.label}
          </AppText>
          <AppText variant="small" style={{ color: theme.colors.textMuted }}>
            {t('map.methodologyActive')}
          </AppText>
        </View>
      )}

      {/* Offline indicator */}
      {isOffline && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: '#FFF3CD',
            borderRadius: theme.radii.md,
            paddingVertical: 6,
            paddingHorizontal: 12,
            marginBottom: theme.spacing.sm,
            borderWidth: 1,
            borderColor: '#F0C040',
          }}
        >
          <AppText style={{ fontSize: 14 }}>📡</AppText>
          <AppText variant="small" style={{ color: '#7A5800', flex: 1 }}>
            {t('common.offlineBanner')}
          </AppText>
        </View>
      )}

      {/* XP / level bar */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radii.lg,
          padding: theme.spacing.md + 2,
          marginBottom: theme.spacing.md,
          gap: theme.spacing.sm,
          borderWidth: 1,
          borderColor: theme.colors.border,
          shadowColor: theme.colors.primary,
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
          elevation: 3,
        }}
      >
        <AppText style={{ fontSize: 28 }}>🦖</AppText>
        <View style={{ flex: 1 }}>
          <AppText variant="small" style={{ fontWeight: '800', color: theme.colors.primary }}>
            {t('profile.progressLevel', { level })}
          </AppText>
          <View
            style={{
              height: 10,
              backgroundColor: theme.colors.border,
              borderRadius: 6,
              marginTop: 6,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                height: '100%',
                width: `${Math.round((xpInfo.current / xpInfo.needed) * 100)}%`,
                backgroundColor: theme.colors.primary,
                borderRadius: 6,
              }}
            />
          </View>
        </View>
        <View style={{ alignItems: 'center' }}>
          <AppText style={{ fontSize: 18 }}>⚡</AppText>
          <AppText variant="small" style={{ color: theme.colors.textMuted, fontWeight: '700' }}>
            {xp}
          </AppText>
        </View>
      </View>

      {/* Greeting */}
      <AppText variant="title" accessibilityRole="header">{greeting}</AppText>
      <Spacer size="xs" />
      <AppText style={{ color: theme.colors.textMuted }}>{t('map.subtitle')}</AppText>
      <Spacer size="sm" />

      {/* Daily goal card */}
      <View
        style={{
          backgroundColor: dailyGoalReached ? theme.colors.success + '18' : theme.colors.surface,
          borderRadius: theme.radii.md,
          padding: theme.spacing.md,
          marginBottom: theme.spacing.md,
          borderWidth: 1.5,
          borderColor: dailyGoalReached ? theme.colors.success + '55' : theme.colors.border,
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.07,
          shadowRadius: 4,
          elevation: 1,
        }}
      >
        <AppText style={{ fontSize: 26 }}>{dailyGoalReached ? '🏆' : '🎯'}</AppText>
        <View style={{ flex: 1 }}>
          <AppText variant="small" style={{ fontWeight: '700', color: dailyGoalReached ? theme.colors.success : theme.colors.text }}>
            {dailyGoalReached ? t('map.dailyGoalDone') : t('map.dailyGoal')}
          </AppText>
          {!dailyGoalReached && (
            <>
              <AppText variant="small" style={{ color: theme.colors.textMuted }}>
                {t('map.dailyGoalProgress', { done: todayDone, goal: dailyGoal })}
              </AppText>
              <View style={{ height: 5, backgroundColor: theme.colors.border, borderRadius: 3, marginTop: 5, overflow: 'hidden' }}>
                <View
                  style={{
                    height: '100%',
                    width: `${Math.min(100, (todayDone / dailyGoal) * 100)}%`,
                    backgroundColor: theme.colors.accent,
                    borderRadius: 3,
                  }}
                />
              </View>
            </>
          )}
        </View>
      </View>

      <Spacer size="xs" />

      {/* Subject tabs */}
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.lg }}>
        {SUBJECTS.map((subjectId) => {
          const isSelected = selectedSubject === subjectId;
          return (
            <Pressable
              key={subjectId}
              onPress={() => setSelectedSubject(subjectId)}
              accessibilityRole="button"
              accessibilityLabel={t(SUBJECT_LABEL_KEYS[subjectId])}
              style={({ pressed }) => ({
                flex: 1,
                transform: [{ scale: pressed ? 1.05 : 1 }],
              })}
            >
              <View
                style={{
                  paddingVertical: theme.spacing.sm + 2,
                  paddingHorizontal: theme.spacing.xs,
                  borderRadius: theme.radii.pill,
                  backgroundColor: isSelected ? theme.colors.primary : theme.colors.surface,
                  borderWidth: 2,
                  borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                  alignItems: 'center',
                  gap: 2,
                  shadowColor: isSelected ? theme.colors.primary : '#000',
                  shadowOffset: { width: 0, height: isSelected ? 4 : 1 },
                  shadowOpacity: isSelected ? 0.3 : 0.06,
                  shadowRadius: isSelected ? 8 : 3,
                  elevation: isSelected ? 4 : 1,
                }}
              >
                <AppText style={{ fontSize: 22 }}>{SUBJECT_EMOJI[subjectId]}</AppText>
                <AppText
                  variant="small"
                  style={{
                    color: isSelected ? '#FFFFFF' : theme.colors.text,
                    fontWeight: '700',
                    fontSize: 10,
                    textAlign: 'center',
                  }}
                >
                  {t(SUBJECT_LABEL_KEYS[subjectId])}
                </AppText>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Lesson nodes grouped by world */}
      <View style={{ paddingHorizontal: theme.spacing.xs }}>
        {groupedNodes.map((group) => {
          const world = worlds.find((w) => w.id === group.worldId);
          const accentColor = world?.accentColor ?? theme.colors.primary;

          return (
            <View key={group.worldId}>
              {/* World banner */}
              <WorldBanner
                worldId={group.worldId}
                theme={theme}
                isPremiumUnlocked={isPremium}
                methodology={methodology}
              />

              <LinearGradient
                colors={[accentColor + '50', accentColor + '22', theme.colors.background + '00']}
                locations={[0, 0.45, 1]}
                style={{
                  borderRadius: theme.radii.lg,
                  paddingVertical: theme.spacing.sm,
                  paddingHorizontal: theme.spacing.xs,
                  marginBottom: theme.spacing.md,
                  borderWidth: methodology === 'aba' ? 1 : 0,
                  borderColor: methodology === 'aba' ? accentColor + '35' : 'transparent',
                }}
              >
                {group.nodes.map(({ node, globalIndex }) => {
                  const status = getLessonStatus(node.lessonId, orderedIds);
                  const isNodeLeft = globalIndex % 2 === 0;
                  const isLastOverall = globalIndex === orderedNodes.length - 1;
                  const biomeDecor = WORLD_DECOR[group.worldId] ?? WORLD_DECOR.jungle;
                  const methDecor = METHODOLOGY_DECOR[methodology] ?? { left: [], right: [] };
                  const sideDecorLeft = methDecor.left.length
                    ? methDecor.left[globalIndex % methDecor.left.length]
                    : biomeDecor.left[globalIndex % biomeDecor.left.length];
                  const sideDecorRight = methDecor.right.length
                    ? methDecor.right[globalIndex % methDecor.right.length]
                    : biomeDecor.right[globalIndex % biomeDecor.right.length];
                  const isStartNode =
                    status === 'available' && node.lessonId === firstAvailableLessonId;

                  return (
                    <View key={node.lessonId}>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          minHeight: PATH_NODE_SIZE + 44,
                          paddingVertical: 6,
                        }}
                      >
                        <View
                          style={{
                            flex: 1,
                            alignItems: isNodeLeft ? 'flex-end' : 'flex-start',
                            paddingHorizontal: theme.spacing.sm,
                          }}
                        >
                          {isNodeLeft ? (
                            <MapPathNode
                              node={node}
                              levelNumber={globalIndex + 1}
                              totalInSubject={orderedNodes.length}
                              status={status}
                              stars={lessonStars[node.lessonId]}
                              theme={theme}
                              t={t}
                              isStartNode={isStartNode}
                              onPress={() =>
                                router.push({
                                  pathname: '/lesson/[lessonId]',
                                  params: { lessonId: node.lessonId, topicId: node.topicId },
                                })
                              }
                              methodologyStyle={methStyle}
                            />
                          ) : (
                            <AppText
                              style={{
                                fontSize: isStartNode ? 40 : 30,
                                opacity: isStartNode ? 1 : 0.62,
                                marginRight: theme.spacing.sm,
                              }}
                            >
                              {isStartNode ? avatarEmoji : sideDecorLeft}
                            </AppText>
                          )}
                        </View>

                        <PathSpineColumn
                          accentColor={accentColor}
                          themePrimary={theme.colors.primary}
                          methodologyStyle={methStyle}
                        />

                        <View
                          style={{
                            flex: 1,
                            alignItems: isNodeLeft ? 'flex-start' : 'flex-end',
                            paddingHorizontal: theme.spacing.sm,
                          }}
                        >
                          {!isNodeLeft ? (
                            <MapPathNode
                              node={node}
                              levelNumber={globalIndex + 1}
                              totalInSubject={orderedNodes.length}
                              status={status}
                              stars={lessonStars[node.lessonId]}
                              theme={theme}
                              t={t}
                              isStartNode={isStartNode}
                              onPress={() =>
                                router.push({
                                  pathname: '/lesson/[lessonId]',
                                  params: { lessonId: node.lessonId, topicId: node.topicId },
                                })
                              }
                              methodologyStyle={methStyle}
                            />
                          ) : (
                            <AppText
                              style={{
                                fontSize: isStartNode ? 40 : 30,
                                opacity: isStartNode ? 1 : 0.62,
                                marginLeft: theme.spacing.sm,
                              }}
                            >
                              {isStartNode ? avatarEmoji : sideDecorRight}
                            </AppText>
                          )}
                        </View>
                      </View>

                      {!isLastOverall && (
                        <PathBridge
                          worldId={group.worldId}
                          accentColor={accentColor}
                          themePrimary={theme.colors.primary}
                          nodeIndex={globalIndex}
                          isNodeLeft={isNodeLeft}
                          methodology={methodology}
                          methodologyStyle={methStyle}
                        />
                      )}
                    </View>
                  );
                })}
              </LinearGradient>
            </View>
          );
        })}
      </View>

      <Spacer size="xl" />
    </Screen>
  );
}
