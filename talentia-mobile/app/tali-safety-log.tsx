import React, { useLayoutEffect, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ConsentGate } from '../src/components/ConsentGate';
import { Screen } from '../src/components/Screen';
import { AppText } from '../src/components/Text';
import { Spacer } from '../src/components/Spacer';
import { Card } from '../src/components/Card';
import { Button } from '../src/components/Button';
import { PinModal } from '../src/components/PinModal';
import { NanoBananaIcon } from '../src/components/NanoBananaIcon';
import { NANO_UI } from '../src/constants/nanoBananaAssets';
import { useAppTheme } from '../src/theme';
import { useAuth } from '../src/context/AuthContext';
import { useSettingsStore } from '../src/store/settingsStore';
import { useTaliSafetyEvents, type TaliSafetyEvent } from '../src/hooks/useTaliSafetyEvents';

// Category labels shown to the parent — human-readable, not the raw stored
// string. Anything not in this map (a category added on the proxy side
// later) falls back to the raw value so nothing silently disappears.
const CATEGORY_LABEL_KEYS: Record<string, string> = {
  violence: 'taliSafetyLog.categoryViolence',
  self_harm: 'taliSafetyLog.categorySelfHarm',
  sexual: 'taliSafetyLog.categorySexual',
  drugs: 'taliSafetyLog.categoryDrugs',
  alcohol: 'taliSafetyLog.categoryAlcohol',
  weapons: 'taliSafetyLog.categoryWeapons',
  hate: 'taliSafetyLog.categoryHate',
  scam: 'taliSafetyLog.categoryScam',
  adult_contact: 'taliSafetyLog.categoryAdultContact',
  politics: 'taliSafetyLog.categoryPolitics',
  horror: 'taliSafetyLog.categoryHorror',
  profanity: 'taliSafetyLog.categoryProfanity',
  pii: 'taliSafetyLog.categoryPii',
  prompt_injection: 'taliSafetyLog.categoryPromptInjection',
  answer_leak: 'taliSafetyLog.categoryAnswerLeak',
  semantic_unsafe: 'taliSafetyLog.categorySemanticUnsafe',
  moderation_unavailable: 'taliSafetyLog.categoryModerationUnavailable',
  empty: 'taliSafetyLog.categoryEmpty',
};

function EventRow({ event, theme }: { event: TaliSafetyEvent; theme: ReturnType<typeof useAppTheme> }) {
  const { t } = useTranslation();
  const labelKey = CATEGORY_LABEL_KEYS[event.category];
  const label = labelKey ? t(labelKey) : event.category;
  const when = new Date(event.createdAt).toLocaleString();

  return (
    <Card style={{ marginBottom: theme.spacing.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <AppText style={{ fontWeight: '700' }}>{label}</AppText>
        <AppText variant="small" style={{ color: theme.colors.textMuted }}>
          {event.side === 'input' ? t('taliSafetyLog.sideInput') : t('taliSafetyLog.sideOutput')}
        </AppText>
      </View>
      <Spacer size="xs" />
      <AppText variant="small" style={{ color: theme.colors.textMuted }}>
        {when}
      </AppText>
    </Card>
  );
}

function TaliSafetyLogScreenContent() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const { data: events, loading, error } = useTaliSafetyEvents(user?.id);

  const parentPin = useSettingsStore((s) => s.parentPin);
  const parentPinHydrated = useSettingsStore((s) => s.parentPinHydrated);

  const [pinVerified, setPinVerified] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);

  useLayoutEffect(() => {
    if (!parentPinHydrated) return;
    // SecureStore / PIN is unavailable on web — never auto-unlock this screen.
    if (Platform.OS === 'web') {
      setPinVerified(false);
      setShowPinModal(false);
      return;
    }
    setPinVerified(!parentPin);
    setShowPinModal(!!parentPin);
  }, [parentPinHydrated, parentPin]);

  if (!parentPinHydrated) {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </Screen>
    );
  }

  if (Platform.OS === 'web') {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}>
          <NanoBananaIcon source={NANO_UI.lock} size={48} />
          <Spacer size="md" />
          <AppText variant="subtitle" style={{ textAlign: 'center', fontWeight: '800' }}>
            {t('taliSafetyLog.pinGateTitle')}
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
              {t('taliSafetyLog.pinGateTitle')}
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
        {t('taliSafetyLog.title')}
      </AppText>
      <Spacer size="xs" />
      <AppText style={{ color: theme.colors.textMuted }}>{t('taliSafetyLog.subtitle')}</AppText>
      <Spacer size="md" />

      {loading && (
        <Card>
          <AppText>{t('taliSafetyLog.loading')}</AppText>
        </Card>
      )}

      {!loading && error && (
        <Card>
          <AppText style={{ color: theme.colors.error }}>{t('taliSafetyLog.loadError')}</AppText>
        </Card>
      )}

      {!loading && !error && events.length === 0 && (
        <Card>
          <AppText style={{ color: theme.colors.textMuted, textAlign: 'center' }}>
            {t('taliSafetyLog.empty')}
          </AppText>
        </Card>
      )}

      {!loading && !error && events.map((event) => (
        <EventRow key={event.id} event={event} theme={theme} />
      ))}

      <Spacer size="xl" />
    </Screen>
  );
}

export default function TaliSafetyLogScreen() {
  return (
    <ConsentGate>
      <TaliSafetyLogScreenContent />
    </ConsentGate>
  );
}
