import React, { useState } from 'react';
import { Linking, Pressable, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { MaterialIcons } from '@expo/vector-icons';

import { Screen } from '../../src/components/Screen';
import { AppText } from '../../src/components/Text';
import { Spacer } from '../../src/components/Spacer';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { useAppTheme } from '../../src/theme';
import { supabase, isSupabaseConfigured } from '../../src/services/supabase';
import { useAuth } from '../../src/context/AuthContext';
import { getPrivacyPolicyUrl, getTermsOfUseUrl } from '../../src/constants/legalUrls';

export default function SignupScreen() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const router = useRouter();
  const setDemoUser = useAuth((s) => s.setDemoUser);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [guardianOk, setGuardianOk] = useState(false);
  const [privacyOk, setPrivacyOk] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    setError('');
    if (!email.trim()) {
      setError(t('auth.errorInvalidEmail'));
      return;
    }
    if (password.length < 6) {
      setError(t('auth.errorShortPassword'));
      return;
    }
    if (!guardianOk || !privacyOk) {
      setError(t('auth.errorConsentRequired'));
      return;
    }
    setLoading(true);
    if (!isSupabaseConfigured) {
      await setDemoUser(email.trim());
      setLoading(false);
      router.replace('/');
      return;
    }
    const { error: err } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          guardian_attested: true,
          privacy_accepted_at: new Date().toISOString(),
        },
      },
    });
    setLoading(false);
    if (err) {
      setError(t('auth.errorAuthFailed'));
      return;
    }
    router.replace('/');
  };

  const ConsentRow = ({
    checked,
    onToggle,
    children,
  }: {
    checked: boolean;
    onToggle: () => void;
    children: React.ReactNode;
  }) => (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.sm }}
    >
      <MaterialIcons
        name={checked ? 'check-box' : 'check-box-outline-blank'}
        size={24}
        color={checked ? theme.colors.primary : theme.colors.textMuted}
      />
      <View style={{ flex: 1 }}>{children}</View>
    </Pressable>
  );

  return (
    <Screen scroll>
      <AppText variant="subtitle">{t('auth.signupTitle')}</AppText>
      <Spacer size="lg" />
      <Card>
        <AppText variant="small" style={{ color: theme.colors.textMuted }}>
          {t('auth.email')}
        </AppText>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder={t('auth.emailPlaceholder')}
          placeholderTextColor={theme.colors.textMuted}
          autoCapitalize="none"
          keyboardType="email-address"
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
          {t('auth.password')}
        </AppText>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder={t('auth.passwordPlaceholder')}
          placeholderTextColor={theme.colors.textMuted}
          secureTextEntry
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
        <Spacer size="lg" />
        <ConsentRow checked={guardianOk} onToggle={() => setGuardianOk((v) => !v)}>
          <AppText variant="small">{t('auth.consentGuardian')}</AppText>
        </ConsentRow>
        <Spacer size="md" />
        <ConsentRow checked={privacyOk} onToggle={() => setPrivacyOk((v) => !v)}>
          <AppText variant="small">
            {t('auth.consentPrivacyPrefix')}{' '}
            <AppText
              variant="small"
              style={{ color: theme.colors.primary, textDecorationLine: 'underline' }}
              onPress={() => void Linking.openURL(getPrivacyPolicyUrl())}
            >
              {t('settings.privacy')}
            </AppText>
            {' · '}
            <AppText
              variant="small"
              style={{ color: theme.colors.primary, textDecorationLine: 'underline' }}
              onPress={() => void Linking.openURL(getTermsOfUseUrl())}
            >
              {t('settings.terms')}
            </AppText>
          </AppText>
        </ConsentRow>
        {error ? (
          <>
            <Spacer size="sm" />
            <AppText style={{ color: theme.colors.error }}>{error}</AppText>
          </>
        ) : null}
        <Spacer size="lg" />
        <Button onPress={handleSignup} loading={loading} disabled={!guardianOk || !privacyOk}>
          {t('auth.signUp')}
        </Button>
      </Card>
    </Screen>
  );
}
