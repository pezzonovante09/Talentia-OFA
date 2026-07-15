import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, View } from 'react-native';

const CONFETTI_COLORS = ['#FF9E66', '#18C1B5', '#FFD96A', '#FF5C7A', '#1AB58A', '#8B5CF6'];

function ConfettiParticle({ delay, color, startX }: { delay: number; color: string; startX: number }) {
  const y = useRef(new Animated.Value(0)).current;
  const x = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const dx = (Math.random() - 0.5) * 280;
    const dy = -(Math.random() * 320 + 120);
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 100, useNativeDriver: true }),
        Animated.spring(y, { toValue: dy, useNativeDriver: true, tension: 40, friction: 6 }),
        Animated.spring(x, { toValue: dx, useNativeDriver: true, tension: 40, friction: 6 }),
        Animated.timing(rotate, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
      Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  const spin = rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: startX,
        top: 0,
        width: 10,
        height: 10,
        borderRadius: 2,
        backgroundColor: color,
        transform: [{ translateY: y }, { translateX: x }, { rotate: spin }],
        opacity,
      }}
    />
  );
}

export function Confetti() {
  const particles = useMemo(
    () =>
      Array.from({ length: 30 }, (_, i) => ({
        key: i,
        delay: i * 30,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        startX: 120 + (i % 5) * 20,
      })),
    [],
  );
  return (
    <View style={{ position: 'absolute', top: 80, left: 0, right: 0, height: 0, overflow: 'visible' }} pointerEvents="none">
      {particles.map((p) => (
        <ConfettiParticle key={p.key} delay={p.delay} color={p.color} startX={p.startX} />
      ))}
    </View>
  );
}
