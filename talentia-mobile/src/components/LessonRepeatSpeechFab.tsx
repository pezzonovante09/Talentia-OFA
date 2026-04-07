import React from 'react';
import { Pressable, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useAppTheme } from '../theme';
import { replayLastLessonTts } from '../services/lessonTtsReplayActions';
import { useLessonTtsReplayStore } from '../store/lessonTtsReplayStore';
import { useSettingsStore } from '../store/settingsStore';

/**
 * Плавающая кнопка «повторить последнюю озвучку» (нейросеть / система / вшитый mp3).
 */
export function LessonRepeatSpeechFab() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const last = useLessonTtsReplayStore((s) => s.last);
  const ttsEnabled = useSettingsStore((s) => s.ttsEnabled);

  if (!ttsEnabled || !last) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        right: theme.spacing.md,
        bottom: theme.spacing.lg + insets.bottom,
        zIndex: 100,
      }}
    >
      <Pressable
        onPress={() => void replayLastLessonTts()}
        accessibilityRole="button"
        accessibilityLabel={t('lesson.repeatSpeech')}
        style={({ pressed }) => ({
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: theme.colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.85 : 1,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
          shadowRadius: 4,
          elevation: 4,
        })}
      >
        <MaterialCommunityIcons name="repeat" size={26} color={theme.colors.surface} />
      </Pressable>
    </View>
  );
}
