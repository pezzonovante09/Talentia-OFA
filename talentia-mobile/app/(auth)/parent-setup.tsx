import React, { useState } from 'react';
import { Pressable, Switch, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { MaterialIcons } from '@expo/vector-icons';

import { Screen } from '../../src/components/Screen';
import { AppText } from '../../src/components/Text';
import { Spacer } from '../../src/components/Spacer';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { useAppTheme } from '../../src/theme';
import { useAuth } from '../../src/context/AuthContext';
import { supabase, isSupabaseConfigured, type ChildProfileRow } from '../../src/services/supabase';
import { useSettingsStore, type AgeBand, type AvatarId, type LanguageCode } from '../../src/store/settingsStore';

const PROFILE_TABLE = 'profiles';

export default function ParentSetupScreen() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const refreshProfile = useAuth((s) => s.refreshProfile);
  const setDemoProfile = useAuth((s) => s.setDemoProfile);
  const setLanguage = useSettingsStore((state) => state.setLanguage);
  const updateProfile = useSettingsStore((state) => state.updateProfile);
  const breakReminderEnabled = useSettingsStore((s) => s.breakReminderEnabled);
  const setBreakReminderEnabled = useSettingsStore((s) => s.setBreakReminderEnabled);
  const breakDurationMinutes = useSettingsStore((s) => s.breakDurationMinutes);

  const [childName, setChildName] = useState('');
  const [ageBand, setAgeBand] = useState<AgeBand>('5-6');
  const [language, setLanguageLocal] = useState<LanguageCode>('ru');
  const [avatarId, setAvatarId] = useState<AvatarId>('sun');
  const [childMode, setChildMode] = useState<'standard' | 'special'>('standard');
  const [methodology, setMethodology] = useState<string | null>(null);
  const [breakDuration, setBreakDuration] = useState(breakDurationMinutes);
  const [guardianOk, setGuardianOk] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleComplete = async () => {
    setError('');
    if (!childName.trim()) return;
    if (!user?.id) return;
    if (!guardianOk) {
      setError(t('auth.errorConsentRequired'));
      return;
    }

    const resolvedMethodology = childMode === 'special' ? 'aba' : null;
    const consentAt = new Date().toISOString();

    setLoading(true);
    const row: ChildProfileRow = {
      user_id: user.id,
      child_name: childName.trim().slice(0, 80),
      age_band: ageBand,
      language,
      avatar_id: avatarId,
      child_mode: childMode,
      methodology: resolvedMethodology,
      parental_consent_at: consentAt,
      guardian_attested: true,
      updated_at: consentAt,
    };

    if (!isSupabaseConfigured) {
      await setDemoProfile(row);
      setLanguage(language);
      updateProfile({ childName: childName.trim(), ageBand, avatarId });
      if (childMode === 'special') {
        useSettingsStore.getState().setMethodology('aba');
      }
      useSettingsStore.getState().setBreakReminderEnabled(breakReminderEnabled);
      useSettingsStore.getState().setBreakDurationMinutes(breakDuration);
      setLoading(false);
      router.replace('/(tabs)/map');
      return;
    }

    const { error: err } = await supabase.from(PROFILE_TABLE).upsert(row, {
      onConflict: 'user_id',
    });

    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }

    setLanguage(language);
    updateProfile({ childName: childName.trim(), ageBand, avatarId });
    if (childMode === 'special') {
      useSettingsStore.getState().setMethodology('aba');
    }
    useSettingsStore.getState().setBreakReminderEnabled(breakReminderEnabled);
    useSettingsStore.getState().setBreakDurationMinutes(breakDuration);
    await refreshProfile();
    router.replace('/(tabs)/map');
  };

  return (
    <Screen scroll>
      <AppText variant="subtitle">{t('auth.parentSetupTitle')}</AppText>
      <Spacer size="xs" />
      <AppText variant="small" style={{ color: theme.colors.textMuted }}>
        {t('auth.parentSetupSubtitle')}
      </AppText>
      <Spacer size="lg" />

      <Card>
        <AppText variant="small" style={{ color: theme.colors.textMuted }}>
          {t('profile.nameLabel')}
        </AppText>
        <TextInput
          value={childName}
          onChangeText={setChildName}
          placeholder={t('profile.namePlaceholder')}
          placeholderTextColor={theme.colors.textMuted}
          style={{
            borderWidth: 2,
            borderColor: theme.colors.border,
            borderRadius: theme.radii.md,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
            fontSize: theme.typography.body,
            color: theme.colors.text,
            backgroundColor: theme.colors.surfaceAlt,
            marginTop: theme.spacing.xs,
          }}
        />
        <Spacer size="md" />
        <AppText variant="small" style={{ color: theme.colors.textMuted }}>
          {t('profile.ageBandLabel')}
        </AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, marginTop: theme.spacing.xs }}>
          {([['5-6', 'profile.ageBandFiveSix'], ['7', 'profile.ageBandSeven'], ['8', 'profile.ageBandEight'], ['9-10', 'profile.ageBandNineTen']] as const).map(([band, key]) => (
            <Pressable key={band} onPress={() => setAgeBand(band)}>
              <Card highlighted={ageBand === band} style={{ paddingVertical: theme.spacing.sm, paddingHorizontal: theme.spacing.md }}>
                <AppText>{t(key)}</AppText>
              </Card>
            </Pressable>
          ))}
        </View>
        <Spacer size="md" />
        <AppText variant="small" style={{ color: theme.colors.textMuted }}>
          {t('settings.languageLabel')}
        </AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, marginTop: theme.spacing.xs }}>
          {(['en', 'ru', 'ky'] as const).map((code) => (
            <Pressable key={code} onPress={() => setLanguageLocal(code)}>
              <Card highlighted={language === code} style={{ paddingVertical: theme.spacing.sm, paddingHorizontal: theme.spacing.md }}>
                <AppText>{t(code === 'en' ? 'settings.languageEnglish' : code === 'ru' ? 'settings.languageRussian' : 'settings.languageKyrgyz')}</AppText>
              </Card>
            </Pressable>
          ))}
        </View>
        <Spacer size="md" />
        <AppText variant="small" style={{ color: theme.colors.textMuted }}>
          {t('profile.avatarLabel')}
        </AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, marginTop: theme.spacing.xs }}>
          {(['sun', 'rocket', 'panda', 'unicorn'] as const).map((id) => (
            <Pressable key={id} onPress={() => setAvatarId(id)}>
              <Card highlighted={avatarId === id} style={{ padding: theme.spacing.sm }}>
                <MaterialIcons name={id === 'sun' ? 'wb-sunny' : id === 'rocket' ? 'rocket' : id === 'panda' ? 'pets' : 'auto-awesome'} size={24} color={avatarId === id ? theme.colors.primary : theme.colors.textMuted} />
              </Card>
            </Pressable>
          ))}
        </View>
        <Spacer size="lg" />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.md }}>
          <View style={{ flex: 1 }}>
            <AppText style={{ fontWeight: '600' }}>{t('parentSetup.breakReminderLabel')}</AppText>
            <AppText variant="small" style={{ color: theme.colors.textMuted, marginTop: 2 }}>{t('parentSetup.breakReminderHint')}</AppText>
          </View>
          <Switch
            value={breakReminderEnabled}
            onValueChange={setBreakReminderEnabled}
            thumbColor={breakReminderEnabled ? theme.colors.primary : theme.colors.surface}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
          />
        </View>
        {breakReminderEnabled && (
          <>
            <AppText variant="small" style={{ color: theme.colors.textMuted, marginBottom: theme.spacing.xs }}>{t('parentSetup.breakDurationLabel')}</AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, marginBottom: theme.spacing.md }}>
              {([5, 10] as const).map((mins) => (
                <Pressable key={mins} onPress={() => setBreakDuration(mins)}>
                  <Card highlighted={breakDuration === mins} style={{ paddingVertical: theme.spacing.sm, paddingHorizontal: theme.spacing.md }}>
                    <AppText>{t(`parentSetup.breakDuration${mins}`)}</AppText>
                  </Card>
                </Pressable>
              ))}
            </View>
          </>
        )}
        <Spacer size="lg" />
        <AppText variant="small" style={{ color: theme.colors.textMuted }}>
          {t('auth.childModeLabel')}
        </AppText>
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.xs }}>
          <Pressable onPress={() => { setChildMode('standard'); setMethodology(null); }}>
            <Card highlighted={childMode === 'standard'} style={{ paddingVertical: theme.spacing.sm, paddingHorizontal: theme.spacing.md }}>
              <AppText>{t('auth.childModeStandard')}</AppText>
            </Card>
          </Pressable>
          <Pressable onPress={() => { setChildMode('special'); setMethodology('aba'); }}>
            <Card highlighted={childMode === 'special'} style={{ paddingVertical: theme.spacing.sm, paddingHorizontal: theme.spacing.md, flex: 1 }}>
              <AppText numberOfLines={2}>{t('auth.childModeSpecial')}</AppText>
              {childMode === 'special' && (
                <AppText variant="small" style={{ color: theme.colors.textMuted, marginTop: 2 }} numberOfLines={3}>
                  {t('auth.methodologyABAShort')}
                </AppText>
              )}
            </Card>
          </Pressable>
        </View>
        {error ? (
          <>
            <Spacer size="sm" />
            <AppText style={{ color: theme.colors.error }}>{error}</AppText>
          </>
        ) : null}
        <Spacer size="lg" />
        <Pressable
          onPress={() => setGuardianOk((v) => !v)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: guardianOk }}
          style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.sm }}
        >
          <MaterialIcons
            name={guardianOk ? 'check-box' : 'check-box-outline-blank'}
            size={24}
            color={guardianOk ? theme.colors.primary : theme.colors.textMuted}
          />
          <AppText variant="small" style={{ flex: 1 }}>
            {t('auth.consentGuardianProfile')}
          </AppText>
        </Pressable>
        <Spacer size="lg" />
        <Button onPress={handleComplete} loading={loading} disabled={!childName.trim() || !guardianOk}>
          {t('auth.continue')}
        </Button>
      </Card>
    </Screen>
  );
}
