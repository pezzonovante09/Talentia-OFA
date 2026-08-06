import React, { useState } from 'react';
import { Alert, Linking, Platform, Pressable, Switch, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { NanoBananaIcon } from '../../src/components/NanoBananaIcon';
import { NANO_UI } from '../../src/constants/nanoBananaAssets';
import { PinModal } from '../../src/components/PinModal';
import {
  requestNotificationPermissions,
  scheduleDailyReminder,
  cancelAllReminders,
} from '../../src/services/notificationService';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Screen } from '../../src/components/Screen';
import { AppText } from '../../src/components/Text';
import { Spacer } from '../../src/components/Spacer';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { useAppTheme } from '../../src/theme';
import { useAuth } from '../../src/context/AuthContext';
import {
  LanguageCode,
  Methodology,
  PARENT_PIN_SECURE_KEY,
  useSettingsStore,
} from '../../src/store/settingsStore';
import { useProgressStore } from '../../src/store/progressStore';
import { useCollectiblesStore } from '../../src/store/collectiblesStore';
import { useAnalyticsQueueStore } from '../../src/store/analyticsQueueStore';
import { isSupabaseConfigured } from '../../src/services/supabase';
import { backendFetch, getBackendBaseUrl } from '../../src/services/backendApi';
import { getPrivacyPolicyUrl, getTermsOfUseUrl } from '../../src/constants/legalUrls';
import { clearLessonResume } from '../../src/services/lessonResumeStore';

// Local wipe keys — Reset clears device data only (not the cloud account).
const ALL_STORAGE_KEYS = [
  'talentia-demo-auth',
  'talentia-settings',
  'talentia-progress',
  'talentia-collectibles',
  'talentia-analytics-queue',
  'talentia-offline-session',
  'talentia:lessonResume:v1',
  'talentia:lessonResume:v2',
];

export default function SettingsScreen() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const router = useRouter();
  const signOut = useAuth((s) => s.signOut);
  const profile = useAuth((s) => s.profile);
  const setDemoProfile = useAuth((s) => s.setDemoProfile);
  const isSpecialMode = profile?.child_mode === 'special';
  const [resetting, setResetting] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [pinModalMode, setPinModalMode] = useState<'set' | 'remove' | null>(null);
  const [pinVerifyForReset, setPinVerifyForReset] = useState(false);
  const [pinVerifyForDelete, setPinVerifyForDelete] = useState(false);
  const [pendingMethodology, setPendingMethodology] = useState<Methodology | null>(null);

  const parentPin = useSettingsStore((s) => s.parentPin);
  const setParentPin = useSettingsStore((s) => s.setParentPin);
  const notificationsEnabled = useSettingsStore((s) => s.notificationsEnabled);
  const setNotificationsEnabled = useSettingsStore((s) => s.setNotificationsEnabled);
  const reminderHour = useSettingsStore((s) => s.reminderHour);
  const breakReminderEnabled = useSettingsStore((s) => s.breakReminderEnabled);
  const setBreakReminderEnabled = useSettingsStore((s) => s.setBreakReminderEnabled);
  const breakDurationMinutes = useSettingsStore((s) => s.breakDurationMinutes);
  const setBreakDurationMinutes = useSettingsStore((s) => s.setBreakDurationMinutes);

  const language = useSettingsStore((state) => state.language);
  const methodology = useSettingsStore((state) => state.methodology);
  const calmMode = useSettingsStore((state) => state.calmMode);
  const focusMode = useSettingsStore((state) => state.focusMode);
  const ttsEnabled = useSettingsStore((state) => state.ttsEnabled);
  const setTtsEnabled = useSettingsStore((state) => state.setTtsEnabled);
  const taliSpeakEnabled = useSettingsStore((state) => state.taliSpeakEnabled);
  const setTaliSpeakEnabled = useSettingsStore((state) => state.setTaliSpeakEnabled);
  const reduceMotion = useSettingsStore((state) => state.reduceMotion);
  const setReduceMotion = useSettingsStore((state) => state.setReduceMotion);
  const setLanguage = useSettingsStore((state) => state.setLanguage);
  const setMethodologyStore = useSettingsStore((state) => state.setMethodology);
  const toggleCalmMode = useSettingsStore((state) => state.toggleCalmMode);
  const toggleFocusMode = useSettingsStore((state) => state.toggleFocusMode);

  const wipeLocalData = async () => {
    useProgressStore.getState().resetAll();
    useCollectiblesStore.getState().resetAll();
    useAnalyticsQueueStore.getState().clearAll();
    await SecureStore.deleteItemAsync(PARENT_PIN_SECURE_KEY).catch(() => {});
    useSettingsStore.setState({ parentPin: null, parentPinHydrated: true });
    await clearLessonResume();
    await Promise.all(ALL_STORAGE_KEYS.map((key) => AsyncStorage.removeItem(key)));
  };

  const doReset = async () => {
    setResetting(true);
    try {
      await wipeLocalData();
      await signOut();
      router.replace('/');
    } finally {
      setResetting(false);
    }
  };

  const doDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      if (isSupabaseConfigured) {
        // A cloud account exists — cloud deletion is mandatory, not best-effort.
        // Never silently fall through to a local-only wipe here: that would leave
        // the child's cloud data intact while the parent believes it was deleted.
        if (!getBackendBaseUrl()) {
          Alert.alert(t('settings.deleteAccountTitle'), t('settings.deleteAccountUnavailable'));
          return;
        }
        const res = await backendFetch('/api/account/delete', { method: 'POST', body: '{}' });
        if (!res.ok) {
          Alert.alert(t('settings.deleteAccountTitle'), t('settings.deleteAccountFailed'));
          return;
        }
      }
      await wipeLocalData();
      await signOut();
      router.replace('/');
    } catch {
      Alert.alert(t('settings.deleteAccountTitle'), t('settings.deleteAccountFailed'));
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleNotificationToggle = async (value: boolean) => {
    if (value) {
      const granted = await requestNotificationPermissions();
      if (!granted) {
        Alert.alert(t('settings.notifPermTitle'), t('settings.notifPermBody'));
        return;
      }
      await scheduleDailyReminder(
        reminderHour,
        t('settings.notifReminderTitle'),
        t('settings.notifReminderBody'),
      );
    } else {
      await cancelAllReminders();
    }
    setNotificationsEnabled(value);
  };

  const handleMethodologyChange = async (value: Methodology) => {
    setMethodologyStore(value);
    if (!isSupabaseConfigured && profile) {
      await setDemoProfile({ ...profile, methodology: value });
    }
  };

  /** Methodology affects the whole ABA pedagogy flow, so gate it behind the parent PIN when one is set. */
  const requestMethodologyChange = (value: Methodology) => {
    if (parentPin) {
      setPendingMethodology(value);
    } else {
      void handleMethodologyChange(value);
    }
  };

  const languageOptions: { code: LanguageCode; labelKey: string }[] = [
    { code: 'en', labelKey: 'settings.languageEnglish' },
    { code: 'ru', labelKey: 'settings.languageRussian' },
    { code: 'ky', labelKey: 'settings.languageKyrgyz' },
  ];

  const methodologyOptions: { value: Methodology; labelKey: string }[] = [
    { value: 'aba', labelKey: 'settings.methodologyABA' },
  ];

  return (
    <Screen scroll>
      <AppText variant="title" accessibilityRole="header">
        {t('settings.title')}
      </AppText>

      <Spacer size="md" />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: theme.spacing.sm }}>
        <Pressable onPress={() => void Linking.openURL(getPrivacyPolicyUrl())} accessibilityRole="link">
          <AppText variant="small" style={{ color: theme.colors.primary, textDecorationLine: 'underline' }}>
            {t('settings.privacy')}
          </AppText>
        </Pressable>
        <AppText variant="small" style={{ color: theme.colors.textMuted }}>
          ·
        </AppText>
        <Pressable onPress={() => void Linking.openURL(getTermsOfUseUrl())} accessibilityRole="link">
          <AppText variant="small" style={{ color: theme.colors.primary, textDecorationLine: 'underline' }}>
            {t('settings.terms')}
          </AppText>
        </Pressable>
      </View>

      <Spacer size="lg" />

      <Card>
        {isSpecialMode ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.sm }}>
              <NanoBananaIcon source={NANO_UI.book} size={22} />
              <AppText variant="subtitle">{t('settings.methodologyLabel')}</AppText>
            </View>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: theme.spacing.sm,
              }}
            >
              {methodologyOptions.map((option) => {
                const selected = methodology === option.value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => requestMethodologyChange(option.value)}
                    accessibilityRole="button"
                  >
                    <Card
                      highlighted={selected}
                      style={{
                        paddingVertical: theme.spacing.sm,
                        paddingHorizontal: theme.spacing.md,
                      }}
                    >
                      <AppText style={{ fontWeight: selected ? '700' : '400' }}>
                        {t(option.labelKey)}
                      </AppText>
                    </Card>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : (
          <View
            style={{
              backgroundColor: theme.colors.surfaceAlt,
              borderRadius: theme.radii.md,
              padding: theme.spacing.md,
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.sm,
            }}
          >
            <NanoBananaIcon source={NANO_UI.book} size={22} />
            <View style={{ flex: 1 }}>
              <AppText variant="small" style={{ fontWeight: '700', color: theme.colors.text }}>
                {t('settings.methodologyStandardMode')}
              </AppText>
              <AppText variant="small" style={{ color: theme.colors.textMuted, marginTop: 2 }}>
                {t('settings.methodologyStandardHint')}
              </AppText>
            </View>
          </View>
        )}

        <Spacer size="lg" />

        <AppText variant="subtitle">{t('settings.languageLabel')}</AppText>
        <Spacer size="sm" />
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: theme.spacing.sm,
          }}
        >
          {languageOptions.map((option) => {
            const selected = language === option.code;
            return (
              <Pressable
                key={option.code}
                onPress={() => setLanguage(option.code)}
                accessibilityRole="button"
              >
                <Card
                  highlighted={selected}
                  style={{
                    paddingVertical: theme.spacing.sm,
                    paddingHorizontal: theme.spacing.md,
                  }}
                >
                  <AppText>{t(option.labelKey)}</AppText>
                </Card>
              </Pressable>
            );
          })}
        </View>

        <Spacer size="lg" />

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: theme.spacing.md,
          }}
        >
          <View style={{ flex: 1 }}>
            <AppText variant="subtitle">
              {t('settings.calmModeLabel')}
            </AppText>
            <Spacer size="xs" />
            <AppText
              variant="small"
              style={{ color: theme.colors.textMuted }}
            >
              {t('settings.calmModeDescription')}
            </AppText>
          </View>
          <Switch
            value={calmMode}
            onValueChange={toggleCalmMode}
            thumbColor={calmMode ? theme.colors.primary : theme.colors.surface}
            trackColor={{
              false: theme.colors.border,
              true: theme.colors.primary,
            }}
          />
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View style={{ flex: 1 }}>
            <AppText variant="subtitle">
              {t('settings.focusModeLabel')}
            </AppText>
            <Spacer size="xs" />
            <AppText
              variant="small"
              style={{ color: theme.colors.textMuted }}
            >
              {t('settings.focusModeDescription')}
            </AppText>
          </View>
          <Switch
            value={focusMode}
            onValueChange={toggleFocusMode}
            thumbColor={focusMode ? theme.colors.primary : theme.colors.surface}
            trackColor={{
              false: theme.colors.border,
              true: theme.colors.primary,
            }}
          />
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: theme.spacing.md,
          }}
        >
          <View style={{ flex: 1 }}>
            <AppText variant="subtitle">
              {t('settings.ttsEnabledLabel')}
            </AppText>
            <Spacer size="xs" />
            <AppText
              variant="small"
              style={{ color: theme.colors.textMuted }}
            >
              {t('settings.ttsEnabledDescription')}
            </AppText>
          </View>
          <Switch
            value={ttsEnabled}
            onValueChange={setTtsEnabled}
            thumbColor={ttsEnabled ? theme.colors.primary : theme.colors.surface}
            trackColor={{
              false: theme.colors.border,
              true: theme.colors.primary,
            }}
          />
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: theme.spacing.md,
          }}
        >
          <View style={{ flex: 1 }}>
            <AppText variant="subtitle">
              {t('settings.taliSpeakLabel')}
            </AppText>
            <Spacer size="xs" />
            <AppText
              variant="small"
              style={{ color: theme.colors.textMuted }}
            >
              {t('settings.taliSpeakDescription')}
            </AppText>
          </View>
          <Switch
            value={taliSpeakEnabled}
            onValueChange={setTaliSpeakEnabled}
            thumbColor={taliSpeakEnabled ? theme.colors.primary : theme.colors.surface}
            trackColor={{
              false: theme.colors.border,
              true: theme.colors.primary,
            }}
          />
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: theme.spacing.md,
          }}
        >
          <View style={{ flex: 1 }}>
            <AppText variant="subtitle">
              {t('settings.reduceMotionLabel')}
            </AppText>
            <Spacer size="xs" />
            <AppText variant="small" style={{ color: theme.colors.textMuted }}>
              {t('settings.reduceMotionDescription')}
            </AppText>
          </View>
          <Switch
            value={reduceMotion}
            onValueChange={setReduceMotion}
            thumbColor={reduceMotion ? theme.colors.primary : theme.colors.surface}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
          />
        </View>
      </Card>

      <Spacer size="xl" />

      {/* Parent controls card */}
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: theme.spacing.md }}>
          <NanoBananaIcon source={NANO_UI.lock} size={22} />
          <AppText variant="subtitle">{t('settings.parentControlsTitle')}</AppText>
        </View>

        {/* PIN */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.md }}>
          <View style={{ flex: 1 }}>
            <AppText style={{ fontWeight: '600' }}>{t('settings.pinLabel')}</AppText>
            <AppText variant="small" style={{ color: theme.colors.textMuted }}>
              {Platform.OS === 'web'
                ? t('pin.webUnprotectedWarning')
                : parentPin
                  ? t('settings.pinSet')
                  : t('settings.pinNotSet')}
            </AppText>
          </View>
          {Platform.OS !== 'web' ? (
            <Pressable
              onPress={() => setPinModalMode(parentPin ? 'remove' : 'set')}
              style={{
                backgroundColor: parentPin ? theme.colors.error + '18' : theme.colors.primary + '18',
                borderRadius: theme.radii.pill,
                paddingHorizontal: theme.spacing.md,
                paddingVertical: theme.spacing.sm,
                borderWidth: 1.5,
                borderColor: parentPin ? theme.colors.error + '55' : theme.colors.primary + '55',
              }}
            >
              <AppText variant="small" style={{ color: parentPin ? theme.colors.error : theme.colors.primary, fontWeight: '700' }}>
                {parentPin ? t('settings.pinRemove') : t('settings.pinAdd')}
              </AppText>
            </Pressable>
          ) : null}
        </View>

        {/* Notifications */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <AppText style={{ fontWeight: '600' }}>{t('settings.notifLabel')}</AppText>
            <AppText variant="small" style={{ color: theme.colors.textMuted }}>
              {t('settings.notifHint', { hour: reminderHour })}
            </AppText>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={handleNotificationToggle}
            thumbColor={notificationsEnabled ? theme.colors.primary : theme.colors.surface}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
          />
        </View>

        {/* Break reminder */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: theme.spacing.md }}>
          <View style={{ flex: 1 }}>
            <AppText style={{ fontWeight: '600' }}>{t('parentSetup.breakReminderLabel')}</AppText>
            <AppText variant="small" style={{ color: theme.colors.textMuted }}>
              {t('parentSetup.breakReminderHint')}
            </AppText>
          </View>
          <Switch
            value={breakReminderEnabled}
            onValueChange={setBreakReminderEnabled}
            thumbColor={breakReminderEnabled ? theme.colors.primary : theme.colors.surface}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
          />
        </View>
        {breakReminderEnabled && (
          <View style={{ marginTop: theme.spacing.sm }}>
            <AppText variant="small" style={{ color: theme.colors.textMuted, marginBottom: theme.spacing.xs }}>
              {t('parentSetup.breakDurationLabel')}
            </AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
              {([5, 10] as const).map((mins) => (
                <Pressable key={mins} onPress={() => setBreakDurationMinutes(mins)} accessibilityRole="button">
                  <Card highlighted={breakDurationMinutes === mins} style={{ paddingVertical: theme.spacing.sm, paddingHorizontal: theme.spacing.md }}>
                    <AppText variant="small">{t(`parentSetup.breakDuration${mins}`)}</AppText>
                  </Card>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </Card>

      <Spacer size="xl" />

      {/* PIN modals */}
      <PinModal
        visible={pinModalMode === 'set'}
        mode="set"
        onSuccess={(pin) => { setParentPin(pin ?? null); setPinModalMode(null); }}
        onCancel={() => setPinModalMode(null)}
      />
      <PinModal
        visible={pinModalMode === 'remove'}
        mode="verify"
        existingPin={parentPin}
        onSuccess={() => { setParentPin(null); setPinModalMode(null); }}
        onCancel={() => setPinModalMode(null)}
      />
      <PinModal
        visible={pinVerifyForReset}
        mode="verify"
        existingPin={parentPin}
        onSuccess={() => { setPinVerifyForReset(false); void doReset(); }}
        onCancel={() => setPinVerifyForReset(false)}
      />
      <PinModal
        visible={pinVerifyForDelete}
        mode="verify"
        existingPin={parentPin}
        onSuccess={() => { setPinVerifyForDelete(false); void doDeleteAccount(); }}
        onCancel={() => setPinVerifyForDelete(false)}
      />
      <PinModal
        visible={pendingMethodology !== null}
        mode="verify"
        existingPin={parentPin}
        onSuccess={() => {
          if (pendingMethodology) void handleMethodologyChange(pendingMethodology);
          setPendingMethodology(null);
        }}
        onCancel={() => setPendingMethodology(null)}
      />

      <Button
        variant="ghost"
        onPress={async () => {
          await signOut();
          router.replace('/');
        }}
      >
        {t('settings.signOut')}
      </Button>

      <Spacer size="sm" />

      <Button
        variant="ghost"
        loading={resetting}
        onPress={() => {
          Alert.alert(
            t('settings.resetTitle'),
            t('settings.resetConfirm'),
            [
              { text: t('common.cancel'), style: 'cancel' },
              {
                text: t('settings.resetConfirmButton'),
                style: 'destructive',
                onPress: () => {
                  if (parentPin) {
                    setPinVerifyForReset(true);
                  } else {
                    void doReset();
                  }
                },
              },
            ],
          );
        }}
        style={{ borderColor: theme.colors.error }}
        textStyle={{ color: theme.colors.error }}
      >
        {t('settings.resetAllData')}
      </Button>

      <Spacer size="sm" />

      <Button
        variant="ghost"
        loading={deletingAccount}
        onPress={() => {
          Alert.alert(
            t('settings.deleteAccountTitle'),
            t('settings.deleteAccountConfirm'),
            [
              { text: t('common.cancel'), style: 'cancel' },
              {
                text: t('settings.deleteAccountButton'),
                style: 'destructive',
                onPress: () => {
                  if (parentPin) {
                    setPinVerifyForDelete(true);
                  } else {
                    void doDeleteAccount();
                  }
                },
              },
            ],
          );
        }}
        style={{ borderColor: theme.colors.error }}
        textStyle={{ color: theme.colors.error }}
      >
        {t('settings.deleteAccount')}
      </Button>

      <Spacer size="xl" />
    </Screen>
  );
}

