/**
 * Каркас экрана урока (SCREENS.md 1.1–1.5): верхняя панель (выход · прогресс · повтор), вопрос 72,
 * пузырь Tali 80, нижняя панель (Tali 88 · кнопка действия 88). Все высоты — `lessonLayout`.
 */
import { useEffect, useRef } from 'react';
import { Animated, Platform, View } from 'react-native';

import { useDesign } from '../../design';
import { bubblePadY, HINT_MAX_LINES, lessonLayout, PROMPT_MAX_LINES, progressSegment, listeningCue } from '../../design/tokens';
import type { TaliPose } from '../../assets/registry';
import { AppText } from '../AppText';
import { CushionPressable } from '../CushionPressable';
import { Icon } from '../Icon';
import { TaliFigure } from '../TaliFigure';

const NATIVE_DRIVER = Platform.OS !== 'web';

export function TopBar({ segment, total, onExit, onReplay, replaying, labels }: { segment: number; total: number; onExit: () => void; onReplay: () => void; replaying: boolean; labels: { exit: string; replay: string; progress: string } }) {
  const theme = useDesign();
  return (
    <View style={{ height: lessonLayout.topBar, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.lg }} testID="lesson-topbar">
      <CushionPressable role="control" width={theme.touch.min} height={theme.touch.min} radius="pill" fill="surface" onPress={onExit} accessibilityLabel={labels.exit} testID="lesson-exit">
        <Icon name="map" color="text" />
      </CushionPressable>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: total <= 6 ? theme.spacing.sm : theme.spacing.xs }} accessibilityLabel={labels.progress} accessible testID="lesson-progress">
        {Array.from({ length: total }, (_, i) => {
          const kind = i < segment ? 'done' : i === segment ? 'current' : 'upcoming';
          const spec = progressSegment[kind];
          return (
            <View
              key={i}
              testID={`progress-${kind}`}
              style={{
                flex: 1,
                height: spec.height,
                borderRadius: theme.radii.sm,
                backgroundColor: theme.colors[spec.fill],
                borderWidth: theme.stroke[spec.stroke],
                borderColor: theme.colors.outline,
              }}
            />
          );
        })}
      </View>
      <CushionPressable role="control" width={theme.touch.min} height={theme.touch.min} radius="pill" fill="surface" raised={!replaying} sunk={replaying} onPress={onReplay} accessibilityLabel={labels.replay} testID="lesson-replay">
        <Icon name={replaying ? 'soundOn' : 'sound'} color="primaryInk" />
      </CushionPressable>
    </View>
  );
}

export function Prompt({ text }: { text: string }) {
  return (
    <View style={{ height: lessonLayout.prompt, justifyContent: 'center' }} testID="lesson-prompt">
      <AppText role="subtitle" cap="prompt" lines={PROMPT_MAX_LINES}>
        {text}
      </AppText>
    </View>
  );
}

export function TaliBubble({ text, speaking, onPress, label }: { text: string | null; speaking: boolean; onPress: () => void; label: string }) {
  const theme = useDesign();
  const grow = useRef(new Animated.Value(text ? 1 : 0.9)).current;
  useEffect(() => {
    if (!text) return;
    if (theme.calmMode) grow.setValue(1);
    else {
      grow.setValue(0.9);
      Animated.timing(grow, { toValue: 1, duration: theme.motion.base, useNativeDriver: NATIVE_DRIVER }).start();
    }
  }, [text, grow, theme.calmMode, theme.motion.base]);

  return (
    <View style={{ height: lessonLayout.bubble }} testID="lesson-bubble">
      {text ? (
        <Animated.View style={{ transform: [{ scale: grow }] }}>
          <CushionPressable
            role="bubble"
            width="100%"
            height={lessonLayout.bubble}
            radius={theme.radii.md}
            fill="surface"
            onPress={onPress}
            accessibilityLabel={label}
            testID="lesson-bubble-body"
            faceStyle={{ paddingHorizontal: theme.spacing.md, paddingVertical: bubblePadY, alignItems: 'flex-start' }}
          >
            <AppText role="body" cap="bubble" lines={HINT_MAX_LINES}>
              {text}
            </AppText>
            {speaking && (
              <View style={{ position: 'absolute', right: listeningCue.inset, bottom: listeningCue.inset }}>
                <Icon name="waves" size={listeningCue.badge} color="primaryInk" />
              </View>
            )}
          </CushionPressable>
          <View
            style={{
              position: 'absolute',
              left: 36,
              bottom: -12,
              width: 0,
              height: 0,
              borderLeftWidth: 8,
              borderRightWidth: 8,
              borderTopWidth: 12,
              borderLeftColor: 'transparent',
              borderRightColor: 'transparent',
              borderTopColor: theme.colors.outline,
            }}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

export type ActionState = 'checkDisabled' | 'check' | 'busy' | 'next';

export function BottomBar({ pose, onTali, action, onAction, labels, pulse }: { pose: TaliPose; onTali: () => void; action: ActionState; onAction: () => void; labels: { tali: string; check: string; next: string }; pulse: number }) {
  const theme = useDesign();
  const primary = action === 'check' || action === 'next';
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (pulse === 0 || theme.calmMode) return;
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.06, duration: theme.motion.slow / 2, useNativeDriver: NATIVE_DRIVER }),
      Animated.timing(scale, { toValue: 1, duration: theme.motion.slow / 2, useNativeDriver: NATIVE_DRIVER }),
    ]).start();
  }, [pulse, scale, theme.calmMode, theme.motion.slow]);
  const icon = action === 'checkDisabled' || action === 'check' ? 'check' : 'arrow';
  const label = action === 'next' ? labels.next : labels.check;

  return (
    <View style={{ height: lessonLayout.actionBar + theme.elevation.raised.offsetY, flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.lg }} testID="lesson-bottombar">
      <TaliFigure pose={pose} size={lessonLayout.tali} crop onPress={onTali} accessibilityLabel={labels.tali} testID="lesson-tali" />
      <Animated.View style={{ flex: 1, transform: [{ scale }] }}>
        <CushionPressable
          role="control"
          width="100%"
          height={lessonLayout.actionBar}
          radius={theme.radii.lg}
          fill={primary ? 'primary' : 'surface'}
          raised={primary}
          onPress={onAction}
          guardMs={theme.motion.slow}
          accessibilityLabel={label}
          accessibilityHint={action === 'busy' ? labels.check : undefined}
          testID={`lesson-action-${action}`}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
            <Icon name={icon} color={primary ? 'onPrimary' : 'text'} />
            <AppText role="label" color={primary ? 'onPrimary' : 'text'} cap="action" lines={1}>
              {label}
            </AppText>
          </View>
        </CushionPressable>
      </Animated.View>
    </View>
  );
}
