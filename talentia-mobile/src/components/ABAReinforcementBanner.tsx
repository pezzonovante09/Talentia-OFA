import React, { useEffect, useRef } from 'react';
import { Animated, Modal, View } from 'react-native';

import { AppText } from './Text';

const FADE_MS = 200;
const HOLD_MS = 1100;
const TOTAL_MS = FADE_MS + HOLD_MS + FADE_MS;

type Props = {
  visible: boolean;
  emoji: string;
  phrase: string;
  reduceMotion: boolean;
  onFinished: () => void;
};

/**
 * Short positive reinforcement overlay after a correct answer (ABA / special mode).
 * ~1500ms: fade in → hold → fade out, or static hold if reduceMotion.
 */
export function ABAReinforcementBanner({
  visible,
  emoji,
  phrase,
  reduceMotion,
  onFinished,
}: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;

  useEffect(() => {
    if (!visible) {
      opacity.setValue(0);
      return;
    }

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      onFinishedRef.current();
    };

    if (reduceMotion) {
      opacity.setValue(1);
      const t = setTimeout(finish, TOTAL_MS);
      return () => clearTimeout(t);
    }

    const anim = Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: FADE_MS, useNativeDriver: true }),
      Animated.delay(HOLD_MS),
      Animated.timing(opacity, { toValue: 0, duration: FADE_MS, useNativeDriver: true }),
    ]);

    anim.start(({ finished }) => {
      if (finished) finish();
    });

    return () => {
      anim.stop();
    };
  }, [visible, reduceMotion, emoji, phrase, opacity]);

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={() => undefined}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(250,250,250,0.92)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 24,
        }}
        pointerEvents="auto"
      >
        <Animated.View style={{ alignItems: 'center', opacity }}>
          <AppText style={{ fontSize: 72, lineHeight: 80 }} accessibilityLabel={emoji}>
            {emoji}
          </AppText>
          <AppText
            variant="title"
            style={{ marginTop: 12, textAlign: 'center', fontWeight: '800' }}
            accessibilityRole="text"
          >
            {phrase}
          </AppText>
        </Animated.View>
      </View>
    </Modal>
  );
}
