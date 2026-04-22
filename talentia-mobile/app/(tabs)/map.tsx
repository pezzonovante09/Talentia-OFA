import React, { useLayoutEffect, useMemo } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { NanoBananaIcon } from '../../src/components/NanoBananaIcon';
import { NANO_UI, getNanoNpcForWorld, resolveScreenBackground } from '../../src/constants/nanoBananaAssets';
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
import { useProgressStore, getXPToNextLevel } from '../../src/store/progressStore';
import { useSettingsStore } from '../../src/store/settingsStore';
import type { Methodology } from '../../src/store/settingsStore';

const SUBJECTS: SubjectId[] = ['math', 'russian', 'english', 'science', 'social'];
const SUBJECT_LABEL_KEYS: Record<SubjectId, string> = {
  math: 'map.subjectMath',
  russian: 'map.subjectRussian',
  english: 'map.subjectEnglish',
  science: 'map.subjectScience',
  social: 'map.subjectSocial',
};
const SUBJECT_TAB_ICON: Record<SubjectId, keyof typeof MaterialIcons.glyphMap> = {
  math: 'calculate',
  russian: 'menu-book',
  english: 'translate',
  science: 'science',
  social: 'groups',
};

function pickDecorString(meth: string[], biome: string[], idx: number): string | null {
  const pool = meth.length ? meth : biome;
  if (!pool.length) return null;
  return pool[idx % pool.length];
}

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
  const npcAvatar = !isLocked ? getNanoNpcForWorld(worldId) : undefined;
  const decor = WORLD_DECOR[worldId] ?? WORLD_DECOR.jungle;
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
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: isLocked ? theme.colors.border + '55' : 'rgba(255,255,255,0.35)',
            opacity: isLocked ? 0.45 : 1,
            overflow: 'hidden',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {npcAvatar ? <NanoBananaIcon source={npcAvatar} size={40} /> : null}
        </View>

        <View style={{ flex: 1 }}>
          <AppText variant="subtitle" style={{ color: titleColor, fontWeight: '800' }}>
            {t(world.titleKey)}
          </AppText>
          {world.npcName ? (
            <AppText variant="small" style={{ color: subColor, fontWeight: '600', marginTop: 4 }}>
              {world.npcName}
            </AppText>
          ) : null}
        </View>

        {!isLocked && (decor.left.length > 0 || methDecor.left.length > 0) ? (
          <View style={{ alignItems: 'flex-end', gap: 2 }}>
            <View style={{ flexDirection: 'row', gap: 2 }}>
              {decor.left.slice(0, 2).map((e, i) => (
                <AppText key={i} style={{ fontSize: 13, opacity: 0.6 }}>
                  {e}
                </AppText>
              ))}
            </View>
            {methDecor.left.length > 0 ? (
              <View style={{ flexDirection: 'row', gap: 2 }}>
                {methDecor.left.slice(0, 2).map((e, i) => (
                  <AppText key={i} style={{ fontSize: 12, opacity: 0.5 }}>
                    {e}
                  </AppText>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

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
              Premium
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
  const navigation = useNavigation();
  const { t } = useTranslation();
  const theme = useAppTheme();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      headerRight: () => (
        <Pressable
          onPress={() => router.push('/parent-report')}
          accessibilityLabel={t('parentMode.headerButton')}
          hitSlop={10}
          style={{ marginRight: 4, padding: 4 }}
        >
          <MaterialIcons name="supervisor-account" size={26} color={theme.colors.primary} />
        </Pressable>
      ),
    });
  }, [navigation, router, t, theme.colors.primary]);
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
  const methBannerConfig: Record<Methodology, { label: string; color: string } | null> = {
    aba: { label: 'ABA', color: '#5B8EE8' },
  };
  // Only show methodology banner in special mode
  const isSpecialMode = profile?.child_mode === 'special';
  const methBanner = isSpecialMode ? methBannerConfig[methodology] : null;

  const isAbaMapWallpaper = isSpecialMode && methodology === 'aba';
  const mapFirstWorldId = orderedNodes[0]?.worldId;
  const mapBackgroundImage = useMemo(
    () => resolveScreenBackground({ isAbaMode: isAbaMapWallpaper, worldId: mapFirstWorldId }),
    [isAbaMapWallpaper, mapFirstWorldId],
  );
  const mapBackgroundTint = isAbaMapWallpaper ? ('light' as const) : ('default' as const);

  return (
    <Screen scroll backgroundImage={mapBackgroundImage} backgroundImageTint={mapBackgroundTint}>
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
              <NanoBananaIcon source={NANO_UI.map} size={48} accessibilityLabel={t('map.tipTitle')} />
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
                <AppText style={{ color: '#fff', fontWeight: '700' }}>{t('map.tipButton')}</AppText>
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
          <MaterialIcons name="assignment" size={18} color={methBanner.color} />
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
          <MaterialIcons name="wifi-off" size={18} color="#7A5800" />
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
        <MaterialIcons name="pets" size={32} color={theme.colors.primary} />
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
          <NanoBananaIcon source={NANO_UI.lightning} size={20} />
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
        <MaterialIcons
          name={dailyGoalReached ? 'verified' : 'flag'}
          size={28}
          color={dailyGoalReached ? theme.colors.success : theme.colors.accent}
        />
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
                <MaterialIcons
                  name={SUBJECT_TAB_ICON[subjectId]}
                  size={22}
                  color={isSelected ? '#FFFFFF' : theme.colors.text}
                />
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

          /** Лёгкая подсветка пути; обои только на Screen — слой с узлами прозрачный. */
          const pathSection = (
            <LinearGradient
              colors={[accentColor + '12', accentColor + '05', 'transparent']}
              locations={[0, 0.4, 1]}
              style={{
                borderRadius: theme.radii.lg,
                paddingVertical: theme.spacing.sm,
                paddingHorizontal: theme.spacing.xs,
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
                const sideDecorLeft = pickDecorString(methDecor.left, biomeDecor.left, globalIndex);
                const sideDecorRight = pickDecorString(methDecor.right, biomeDecor.right, globalIndex);
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
                        ) : isStartNode ? (
                          <MaterialIcons
                            name="pets"
                            size={36}
                            color={theme.colors.primary}
                            style={{ marginRight: theme.spacing.sm }}
                          />
                        ) : sideDecorLeft ? (
                          <AppText
                            style={{
                              fontSize: 30,
                              opacity: 0.62,
                              marginRight: theme.spacing.sm,
                            }}
                          >
                            {sideDecorLeft}
                          </AppText>
                        ) : null}
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
                        ) : isStartNode ? (
                          <MaterialIcons
                            name="pets"
                            size={36}
                            color={theme.colors.primary}
                            style={{ marginLeft: theme.spacing.sm }}
                          />
                        ) : sideDecorRight ? (
                          <AppText
                            style={{
                              fontSize: 30,
                              opacity: 0.62,
                              marginLeft: theme.spacing.sm,
                            }}
                          >
                            {sideDecorRight}
                          </AppText>
                        ) : null}
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
          );

          return (
            <View key={group.worldId} style={{ marginBottom: theme.spacing.md }}>
              <WorldBanner
                worldId={group.worldId}
                theme={theme}
                isPremiumUnlocked={isPremium}
                methodology={methodology}
              />

              {pathSection}
            </View>
          );
        })}
      </View>

      <Spacer size="xl" />
    </Screen>
  );
}
