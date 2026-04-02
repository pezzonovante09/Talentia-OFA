import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { useTranslation } from 'react-i18next';

import { useAppTheme } from '../theme';
import { useSettingsStore } from '../store/settingsStore';

const LANG_MAP: Record<string, string> = {
  en: 'en-US',
  ru: 'ru-RU',
  ky: 'ky-KG',
};

type Props = {
  onTranscript: (text: string) => void;
  disabled?: boolean;
};

export function VoiceInputButtonNative({ onTranscript, disabled }: Props) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const language = useSettingsStore((s) => s.language);
  const [recognizing, setRecognizing] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const v = await Promise.resolve(ExpoSpeechRecognitionModule.isRecognitionAvailable());
        setAvailable(Boolean(v));
      } catch {
        setAvailable(false);
      }
    })();
  }, []);

  useSpeechRecognitionEvent('result', (event) => {
    const first = event.results?.[0];
    const transcript = (typeof first === 'string' ? first : (first as { transcript?: string })?.transcript) ?? '';
    if (transcript.trim()) {
      onTranscript(transcript.trim());
    }
  });

  useSpeechRecognitionEvent('end', () => setRecognizing(false));
  useSpeechRecognitionEvent('error', () => setRecognizing(false));

  const handlePress = useCallback(async () => {
    if (available === false || disabled) return;
    const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!result.granted) {
      Alert.alert(t('voiceInput.permissionTitle'), t('voiceInput.permissionBody'));
      return;
    }
    setRecognizing(true);
    const lang = LANG_MAP[language] ?? 'en-US';
    try {
      await ExpoSpeechRecognitionModule.start({
        lang,
        interimResults: false,
        continuous: false,
      });
    } catch {
      setRecognizing(false);
    }
  }, [available, disabled, language, t]);

  const handleStop = useCallback(() => {
    void Promise.resolve(ExpoSpeechRecognitionModule.stop()).catch(() => {});
  }, []);

  if (available === false || Platform.OS === 'web') return null;

  return (
    <Pressable
      onPress={recognizing ? handleStop : handlePress}
      disabled={disabled}
      style={{
        padding: theme.spacing.sm,
        borderRadius: theme.radii.md,
        backgroundColor: recognizing ? theme.colors.error + '22' : theme.colors.primary + '22',
        borderWidth: 1.5,
        borderColor: recognizing ? theme.colors.error : theme.colors.primary,
      }}
      accessibilityRole="button"
      accessibilityLabel={recognizing ? t('common.close') : t('voiceInput.label')}
    >
      <MaterialIcons
        name="mic"
        size={24}
        color={recognizing ? theme.colors.error : theme.colors.primary}
      />
    </Pressable>
  );
}
