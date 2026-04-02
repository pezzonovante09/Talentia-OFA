import React, { useState } from 'react';
import { TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Screen } from '../../src/components/Screen';
import { AppText } from '../../src/components/Text';
import { Spacer } from '../../src/components/Spacer';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { useAppTheme } from '../../src/theme';
import { supabase, isSupabaseConfigured } from '../../src/services/supabase';
import { useAuth } from '../../src/context/AuthContext';

export default function LoginScreen() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const router = useRouter();
  const setDemoUser = useAuth().setDemoUser;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError('');
    if (!email.trim()) {
      setError(t('auth.errorInvalidEmail'));
      return;
    }
    if (password.length < 6) {
      setError(t('auth.errorShortPassword'));
      return;
    }
    setLoading(true);
    if (!isSupabaseConfigured) {
      await setDemoUser(email.trim());
      setLoading(false);
      router.replace('/');
      return;
    }
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (err) {
      setError(t('auth.errorAuthFailed'));
      return;
    }
    router.replace('/');
  };

  return (
    <Screen scroll>
      <AppText variant="subtitle">{t('auth.loginTitle')}</AppText>
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
        {error ? (
          <>
            <Spacer size="sm" />
            <AppText style={{ color: theme.colors.error }}>{error}</AppText>
          </>
        ) : null}
        <Spacer size="lg" />
        <Button onPress={handleLogin} loading={loading}>
          {t('auth.login')}
        </Button>
      </Card>
    </Screen>
  );
}
