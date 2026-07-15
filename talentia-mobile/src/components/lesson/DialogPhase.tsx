import React, { useEffect } from 'react';
import { Animated, View } from 'react-native';
import type { ImageSourcePropType } from 'react-native';

import { NanoBananaIcon } from '../NanoBananaIcon';
import { getNanoNpcForWorld } from '../../constants/nanoBananaAssets';
import { Screen } from '../Screen';
import { TaliVideo } from '../TaliVideo';
import { AppText } from '../Text';
import { Card } from '../Card';
import { Button } from '../Button';
import { LessonRepeatSpeechFab } from '../LessonRepeatSpeechFab';
import { useAppTheme } from '../../theme';
import { getBiomeDisplayEmoji } from '../../utils/biomeDisplay';
import { useSettingsStore } from '../../store/settingsStore';
import { useSpeech } from '../../hooks/useSpeech';
import { useTypingText } from '../../hooks/useTypingText';
import {
  getBundledVoiceModuleId,
  lessonBundledVoiceKey,
  tryPlayBundledLessonVoice,
} from '../../services/lessonBundledVoice';
import { stopTaliSpeech } from '../../services/ttsService';

export function DialogPhase({
  lessonId,
  worldId,
  backgroundImage,
  backgroundImageTint,
  fullText,
  speakerName,
  speakerColor,
  isTali,
  npcEmoji,
  worldBiome,
  worldTitleKey,
  worldAccentColor,
  dialogIndex,
  totalLines,
  isLastLine,
  fadeAnim,
  theme,
  t,
  onNext,
}: {
  lessonId: string;
  worldId?: string;
  backgroundImage: ImageSourcePropType;
  backgroundImageTint: 'default' | 'light';
  fullText: string;
  speakerName: string;
  speakerColor: string;
  isTali: boolean;
  npcEmoji: string;
  worldBiome?: string;
  worldTitleKey?: string;
  worldAccentColor: string;
  dialogIndex: number;
  totalLines: number;
  isLastLine: boolean;
  fadeAnim: Animated.Value;
  theme: ReturnType<typeof useAppTheme>;
  t: (key: string) => string;
  onNext: () => void;
}) {
  const { speak } = useSpeech();
  const ttsEnabled = useSettingsStore((s) => s.ttsEnabled);
  const language = useSettingsStore((s) => s.language);
  const { displayed } = useTypingText(fullText, 22);
  const npcAvatar = worldId ? getNanoNpcForWorld(worldId) : undefined;

  useEffect(() => {
    if (!ttsEnabled) return;
    const key = lessonBundledVoiceKey(lessonId, 'dialog', dialogIndex, language);
    const mod = getBundledVoiceModuleId(key);
    const delay = setTimeout(() => {
      void (async () => {
        if (mod !== undefined) {
          const ok = await tryPlayBundledLessonVoice(mod);
          if (!ok) speak(fullText);
        } else {
          speak(fullText);
        }
      })();
    }, 300);
    return () => {
      clearTimeout(delay);
      void stopTaliSpeech();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullText, dialogIndex, lessonId, language, ttsEnabled]);

  return (
    <Screen
      backgroundImage={backgroundImage}
      backgroundImageTint={backgroundImageTint}
      style={{ position: 'relative' }}
    >
      <Animated.View style={{ opacity: fadeAnim, flex: 1 }}>
        <View style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: theme.spacing.xl }}>
          {/* World banner */}
          {worldBiome && worldTitleKey && (
            <View style={{ alignItems: 'center', marginBottom: theme.spacing.xl }}>
              <AppText style={{ fontSize: 64 }}>{getBiomeDisplayEmoji(worldBiome)}</AppText>
              <AppText variant="small" style={{ color: worldAccentColor, fontWeight: '700', marginTop: theme.spacing.xs }}>
                {t(worldTitleKey)}
              </AppText>
            </View>
          )}

          {/* Speaker avatar */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginBottom: theme.spacing.sm, gap: theme.spacing.sm }}>
            {isTali ? (
              <TaliVideo emotion="idle" size={72} bgColor={theme.colors.background} />
            ) : (
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  backgroundColor: speakerColor + '22',
                  borderWidth: 2,
                  borderColor: speakerColor + '88',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                {npcAvatar ? (
                  <NanoBananaIcon source={npcAvatar} size={66} />
                ) : (
                  <AppText style={{ fontSize: 40 }}>{npcEmoji}</AppText>
                )}
              </View>
            )}
            <AppText variant="small" style={{ color: speakerColor, fontWeight: '700', marginBottom: 6 }}>
              {speakerName}
            </AppText>
          </View>

          {/* Dialog bubble */}
          <View style={{ position: 'relative', marginBottom: theme.spacing.lg }}>
            <View
              style={{
                position: 'absolute',
                top: -11,
                left: 32,
                width: 0,
                height: 0,
                borderStyle: 'solid',
                borderLeftWidth: 10,
                borderLeftColor: 'transparent',
                borderRightWidth: 10,
                borderRightColor: 'transparent',
                borderBottomWidth: 12,
                borderBottomColor: '#FFFFFF',
                zIndex: 1,
              }}
            />
            <View
              style={{
                position: 'absolute',
                top: -14,
                left: 30,
                width: 0,
                height: 0,
                borderStyle: 'solid',
                borderLeftWidth: 12,
                borderLeftColor: 'transparent',
                borderRightWidth: 12,
                borderRightColor: 'transparent',
                borderBottomWidth: 14,
                borderBottomColor: speakerColor + '55',
                zIndex: 0,
              }}
            />
            <Card
              style={{
                borderLeftWidth: 4,
                borderLeftColor: speakerColor,
                backgroundColor: '#FFFFFF',
              }}
            >
              <View style={{ position: 'relative' }}>
                <AppText style={{ lineHeight: 30, opacity: 0 }} aria-hidden>
                  {fullText}
                </AppText>
                <AppText style={{ lineHeight: 30, position: 'absolute', top: 0, left: 0, right: 0 }}>
                  {displayed}
                </AppText>
              </View>
            </Card>
          </View>

          {totalLines > 1 && (
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: theme.spacing.lg }}>
              {Array.from({ length: totalLines }, (_, i) => (
                <View
                  key={i}
                  style={{
                    width: i === dialogIndex ? 20 : 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: i <= dialogIndex ? theme.colors.primary : theme.colors.border,
                  }}
                />
              ))}
            </View>
          )}

          <Button
            onPress={onNext}
            style={{
              minHeight: 54,
              paddingVertical: 16,
            }}
          >
            {isLastLine ? t('lesson.dialogStartLesson') : t('lesson.dialogContinue')}
          </Button>
        </View>
      </Animated.View>
      <LessonRepeatSpeechFab />
    </Screen>
  );
}
