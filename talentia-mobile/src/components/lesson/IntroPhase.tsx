import React, { useEffect } from 'react';
import { Animated, View } from 'react-native';
import type { ImageSourcePropType } from 'react-native';

import { NanoBananaIcon } from '../NanoBananaIcon';
import { Screen } from '../Screen';
import { TaliVideo } from '../TaliVideo';
import { AppText } from '../Text';
import { Card } from '../Card';
import { Button } from '../Button';
import { LessonRepeatSpeechFab } from '../LessonRepeatSpeechFab';
import { useAppTheme } from '../../theme';
import type { IntroSlide } from '../../data/worlds';
import { useSettingsStore } from '../../store/settingsStore';
import { useSpeech } from '../../hooks/useSpeech';
import { useTypingText } from '../../hooks/useTypingText';
import {
  getBundledVoiceModuleId,
  lessonBundledVoiceKey,
  tryPlayBundledLessonVoice,
} from '../../services/lessonBundledVoice';
import { stopTaliSpeech } from '../../services/ttsService';
import { VISUAL_COUNT_IMAGE_BY_EMOJI } from '../../constants/visualCountEmojiImages';

export function IntroPhase({
  lessonId,
  backgroundImage,
  backgroundImageTint,
  slide,
  slideIndex,
  totalSlides,
  isLastSlide,
  accentColor,
  fadeAnim,
  theme,
  t,
  onNext,
}: {
  lessonId: string;
  backgroundImage: ImageSourcePropType;
  backgroundImageTint: 'default' | 'light';
  slide: IntroSlide;
  slideIndex: number;
  totalSlides: number;
  isLastSlide: boolean;
  accentColor: string;
  fadeAnim: Animated.Value;
  theme: ReturnType<typeof useAppTheme>;
  t: (key: string) => string;
  onNext: () => void;
}) {
  const { speak } = useSpeech();
  const ttsEnabled = useSettingsStore((s) => s.ttsEnabled);
  const language = useSettingsStore((s) => s.language);
  const fullBodyText = t(slide.bodyKey);
  const { displayed } = useTypingText(fullBodyText, 18);

  useEffect(() => {
    if (!ttsEnabled) return;
    const title = t(slide.titleKey);
    const body = t(slide.bodyKey);
    const fallback = `${title}. ${body}`;
    const key = lessonBundledVoiceKey(lessonId, 'intro', slideIndex, language);
    const mod = getBundledVoiceModuleId(key);
    const delay = setTimeout(() => {
      void (async () => {
        if (mod !== undefined) {
          const ok = await tryPlayBundledLessonVoice(mod);
          if (!ok) speak(fallback);
        } else {
          speak(fallback);
        }
      })();
    }, 400);
    return () => {
      clearTimeout(delay);
      void stopTaliSpeech();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slideIndex, lessonId, language, ttsEnabled]);

  return (
    <Screen
      backgroundImage={backgroundImage}
      backgroundImageTint={backgroundImageTint}
      style={{ position: 'relative' }}
    >
      <Animated.View style={{ opacity: fadeAnim, flex: 1 }}>
        <View style={{ flex: 1, justifyContent: 'center', paddingVertical: theme.spacing.xl }}>
          {/* Progress dots */}
          {totalSlides > 1 && (
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: theme.spacing.lg }}>
              {Array.from({ length: totalSlides }, (_, i) => (
                <View
                  key={i}
                  style={{
                    width: i === slideIndex ? 24 : 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: i <= slideIndex ? accentColor : theme.colors.border,
                  }}
                />
              ))}
            </View>
          )}

          {/* Tali thinking + slide emoji */}
          <View style={{ alignItems: 'center', marginBottom: theme.spacing.lg, flexDirection: 'row', justifyContent: 'center', gap: theme.spacing.md }}>
            <TaliVideo emotion="idle" size={110} bgColor={theme.colors.surface} />
            {slide.emoji &&
              (VISUAL_COUNT_IMAGE_BY_EMOJI[slide.emoji] ? (
                <NanoBananaIcon
                  source={VISUAL_COUNT_IMAGE_BY_EMOJI[slide.emoji]!}
                  size={72}
                  accessibilityLabel={slide.emoji}
                />
              ) : (
                <AppText style={{ fontSize: 56 }}>{slide.emoji}</AppText>
              ))}
          </View>

          {/* Title + body: solid white for readability on scene background */}
          <Card
            style={{
              borderLeftWidth: 4,
              borderLeftColor: accentColor,
              backgroundColor: '#FFFFFF',
              marginBottom: theme.spacing.xl,
            }}
          >
            <AppText
              variant="subtitle"
              style={{
                fontWeight: '800',
                color: accentColor,
                textAlign: 'left',
                marginBottom: theme.spacing.md,
              }}
            >
              {t(slide.titleKey)}
            </AppText>
            <View style={{ position: 'relative' }}>
              <AppText style={{ lineHeight: 30, fontSize: 17, opacity: 0 }} aria-hidden>
                {fullBodyText}
              </AppText>
              <AppText style={{ lineHeight: 30, fontSize: 17, position: 'absolute', top: 0, left: 0, right: 0 }}>
                {displayed}
              </AppText>
            </View>
          </Card>

          <Button
            onPress={onNext}
            style={{
              backgroundColor: accentColor,
              borderColor: accentColor,
            }}
          >
            {isLastSlide ? t('lesson.introStart') : t('lesson.introNext')}
          </Button>
        </View>
      </Animated.View>
      <LessonRepeatSpeechFab />
    </Screen>
  );
}
