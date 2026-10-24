/**
 * Первый запуск: выбор профиля (DESIGN_PROMPTS.md 1.1; docs/design/slice-screens-2026-10-24.md §1).
 *
 * Чистая установка: профилей нет, поэтому на экране одна пунктирная карточка «+ Добавить» (путь
 * взрослого → гейт) и единственная `primary` — «Попробовать без сохранения» (путь ребёнка, №130).
 * Полоса в режиме без записи — `5-6`, меняет только взрослый (№142). Бюджет высоты на SE — 656
 * (`firstRunHeight`), экран не прокручивается. В focus Tali убран, состав остальной тот же.
 */
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useDesign } from '../src/design';
import { firstRun, profileCard, taliSize } from '../src/design/tokens';
import { uuidV4 } from '../src/domain/ids';
import type { InterfaceLang } from '../src/domain/regionVisibility';
import { randomBytes } from '../src/services/random';
import { voice } from '../src/services/voice';
import { useChildSession } from '../src/state/childSession';
import { AdultGateStub } from '../src/ui/AdultGateStub';
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
  const [gateOpen, setGateOpen] = useState(false);

  useEffect(() => {
    voice.say('firstRun.title');
  }, []);

  const openGate = (sayKey: string) => {
    voice.say(sayKey);
    setGateOpen(true);
  };

  const tryWithoutSaving = () => {
    startNoRecordSession({ childId: uuidV4(randomBytes), now: new Date(), interfaceLang: i18n.language as InterfaceLang });
    router.replace('/map');
  };

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
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: theme.calmMode || theme.focusMode ? theme.spacing.xl : profileCard.gap }}>
        <ProfileCard kind="add" onPress={() => openGate('firstRun.callAdult')} accessibilityLabel={t('a11y.addProfile')} />
      </View>
      <View style={{ flex: 1, minHeight: theme.spacing.xl }} />
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
      <CushionPressable
        role="tali"
        width="100%"
        height={firstRun.adultEntryHit}
        radius={theme.radii.md}
        fill="background"
        outlineColor="background"
        onPress={() => openGate('firstRun.forAdults')}
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
      <AdultGateStub visible={gateOpen} onClose={() => setGateOpen(false)} />
    </Screen>
  );
}
