/**
 * Первый запуск: выбор профиля (DESIGN_PROMPTS.md 1.1; docs/design/slice-screens-2026-10-24.md §1).
 *
 * Чистая установка: профилей нет, поэтому на экране одна пунктирная карточка «+ Добавить» (путь
 * взрослого → родительский раздел за PIN) и единственная `primary` — «Попробовать без сохранения» (путь
 * ребёнка, №130). С аккаунтом на устройстве (этап 10) — карточки детей и «+ Добавить»; кнопки без записи
 * нет вовсе (PARENT.md п. 5): состав меняется, стиль — нет. Тап по карточке читает прогресс ребёнка через
 * порт и открывает сеанс с записью; при устаревшем тексте согласия сначала — повторное согласие.
 * Полоса в режиме без записи — `5-6`, меняет только взрослый (№142). Бюджет высоты на SE — 616
 * (`firstRunHeight`), экран не прокручивается. В focus Tali убран, состав остальной тот же.
 *
 * Порядок (docs/design/atlas-firstrun-2026-10-31.md D3): Tali → заголовок → «Попробовать без сохранения» →
 * подпись → карточки (дети 160, «+» 120 последним, по нижнему краю) → «Для взрослых». «+» открывает PIN только
 * вторым тапом в `firstRun.adultSecondTapMs`: первый — голос «Позови взрослого» и покачивание замка.
 */
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { useDesign } from '../src/design';
import { firstRun, profileCard, taliSize } from '../src/design/tokens';
import { uuidV4 } from '../src/domain/ids';
import type { InterfaceLang } from '../src/domain/regionVisibility';
import type { ChildProfile } from '../src/services/local/profiles';
import { randomBytes } from '../src/services/random';
import { voice } from '../src/services/voice';
import { useAccount } from '../src/state/account';
import { useChildSession } from '../src/state/childSession';
import { progressPort } from '../src/state/port';
import { AppText } from '../src/ui/AppText';
import { CushionPressable } from '../src/ui/CushionPressable';
import { Icon } from '../src/ui/Icon';
import { ProfileCard } from '../src/ui/ProfileCard';
import { Screen } from '../src/ui/Screen';
import { TaliFigure } from '../src/ui/TaliFigure';

export default function FirstRunScreen() {
  const theme = useDesign();
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const startNoRecordSession = useChildSession((s) => s.startNoRecordSession);
  const startAccountSession = useChildSession((s) => s.startAccountSession);
  const accountStatus = useAccount((s) => s.status);
  const profiles = useAccount((s) => s.profiles);
  const consent = useAccount((s) => s.consent);
  const opening = useRef(false);
  const hasAccount = accountStatus === 'ready';

  useEffect(() => {
    voice.say('firstRun.title');
  }, []);

  const openAdult = (sayKey: string, href: '/parent' | '/parent/profile/new') => {
    voice.say(sayKey);
    router.push(href);
  };

  // «+»: первый тап — голос «Позови взрослого» и покачивание замка; PIN — вторым тапом в `adultSecondTapMs` (UX этапа D).
  const adultTapAt = useRef(0);
  const [nudgeKey, setNudgeKey] = useState(0);
  const tapAdd = () => {
    const now = Date.now();
    if (now - adultTapAt.current < firstRun.adultSecondTapMs) {
      adultTapAt.current = 0;
      router.push(hasAccount ? '/parent/profile/new' : '/parent');
      return;
    }
    adultTapAt.current = now;
    voice.say('firstRun.callAdult');
    setNudgeKey((k) => k + 1);
  };

  const tryWithoutSaving = () => {
    startNoRecordSession({ childId: uuidV4(randomBytes), now: new Date(), interfaceLang: i18n.language as InterfaceLang });
    router.replace('/map');
  };

  const openProfile = async (profile: ChildProfile) => {
    if (opening.current) return;
    if (consent === 'outdated') {
      router.push('/parent/reconsent');
      return;
    }
    opening.current = true;
    try {
      const snapshot = await progressPort().load(profile.childId);
      startAccountSession({ profile, snapshot, now: new Date() });
      router.replace('/map');
    } finally {
      opening.current = false;
    }
  };

  const cardGap = theme.calmMode || theme.focusMode ? theme.spacing.xl : profileCard.gap;
  const cards = (
    <>
      {profiles.map((p, i) => {
        const name = p.name || t('profile.unnamed', { n: i + 1 });
        return <ProfileCard key={p.childId} kind="profile" name={name} mark={p.name ? undefined : String(i + 1)} onPress={() => void openProfile(p)} accessibilityLabel={name} testID={`profile-${i + 1}`} />;
      })}
      <ProfileCard kind="add" nudgeKey={nudgeKey} onPress={tapAdd} accessibilityLabel={`${t('a11y.addProfile')}. ${t('firstRun.adultOnly')}`} />
    </>
  );

  return (
    <Screen testID="first-run">
      <View style={{ height: theme.spacing.lg }} />
      {!theme.focusMode && (
        <View style={{ alignItems: 'center' }}>
          <TaliFigure pose="hello" size={taliSize.hero} onPress={() => voice.say('firstRun.title')} accessibilityLabel={t('a11y.tali')} />
        </View>
      )}
      <View style={{ height: theme.spacing.lg }} />
      <View style={{ height: theme.typography.title.lineHeight * 2, justifyContent: 'center' }}>
        <AppText role="title" fit="title" align="center" accessibilityRole="header">
          {t('firstRun.title')}
        </AppText>
      </View>
      <View style={{ height: theme.spacing.xl }} />
      {/* Детская кнопка — сразу под заголовком, выше взрослой карточки «+» (`firstRun.childActionFirst`) */}
      {!hasAccount && (
        <>
          <CushionPressable
            role="control"
            width="100%"
            height={theme.touch.primary}
            radius={theme.radii.lg}
            fill="primary"
            guardMs={theme.motion.slow}
            onPress={tryWithoutSaving}
            accessibilityLabel={t('firstRun.tryWithoutSaving')}
            testID="try-without-saving"
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
              <Icon name="arrow" color="onPrimary" />
              <AppText role="label" color="onPrimary" cap="action" lines={1}>
                {t('firstRun.tryWithoutSaving')}
              </AppText>
            </View>
          </CushionPressable>
          <View style={{ height: theme.spacing.sm }} />
          <AppText role="caption" color="textMuted" align="center" lines={1}>
            {t('firstRun.noSaveNote')}
          </AppText>
          <View style={{ height: theme.spacing.xl }} />
        </>
      )}
      {profiles.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: cardGap, paddingHorizontal: theme.spacing.lg, alignItems: 'flex-end' }} style={{ marginHorizontal: -theme.spacing.lg, flexGrow: 0 }} testID="profile-row">
          {cards}
        </ScrollView>
      ) : (
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', gap: cardGap }} testID="profile-row">
          {cards}
        </View>
      )}
      <View style={{ flex: 1, minHeight: theme.spacing.xl }} />
      <CushionPressable
        role="tali"
        width="100%"
        height={firstRun.adultEntryHit}
        radius={theme.radii.md}
        fill="background"
        outlineColor="background"
        onPress={() => openAdult('firstRun.forAdults', '/parent')}
        accessibilityLabel={t('firstRun.forAdults')}
        testID="for-adults"
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <Icon name="lock" size={firstRun.adultIcon} color="textMuted" />
          <AppText role="caption" color="textMuted">
            {t('firstRun.forAdults')}
          </AppText>
        </View>
      </CushionPressable>
    </Screen>
  );
}
