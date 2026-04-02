import React, { useRef } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { AppText } from '../Text';
import { useAppTheme } from '../../theme';
import type { LessonNode } from '../../data/worlds';
import type { LessonStatus } from '../../store/progressStore';
import type { Methodology } from '../../store/settingsStore';
import {
  METHODOLOGY_DECOR,
  WORLD_DECOR,
  type MethodologyStyle,
  PATH_NODE_SIZE,
  PATH_SPINE_WIDTH,
} from './mapConstants';

function MiniStars({ stars }: { stars: 1 | 2 | 3 }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 1, marginTop: 2 }}>
      {[1, 2, 3].map((i) => (
        <AppText key={i} style={{ fontSize: 9, opacity: i <= stars ? 1 : 0.2 }}>
          ⭐
        </AppText>
      ))}
    </View>
  );
}

function useNodePulse() {
  const anim = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);
  return anim;
}

const START_BTN_COLOR = '#FF8C1A';
const START_BTN_SHADOW = '#C45800';

function StartButton3D({ label, onPress }: { label: string; onPress: () => void }) {
  const pressAnim = useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
    Animated.spring(pressAnim, { toValue: 1, useNativeDriver: false, speed: 50 }).start();
  };
  const handlePressOut = () => {
    Animated.spring(pressAnim, { toValue: 0, useNativeDriver: false, speed: 50 }).start();
  };

  const translateY = pressAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 3] });
  const bottomBorder = pressAnim.interpolate({ inputRange: [0, 1], outputRange: [5, 2] });

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
    >
      <Animated.View
        style={{
          transform: [{ translateY }],
          borderBottomWidth: bottomBorder,
          borderBottomColor: START_BTN_SHADOW,
          borderRadius: 999,
          backgroundColor: START_BTN_COLOR,
          paddingVertical: 14,
          paddingHorizontal: 24,
          shadowColor: START_BTN_SHADOW,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.45,
          shadowRadius: 10,
          elevation: 8,
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <AppText
          numberOfLines={1}
          style={{
            color: '#FFFFFF',
            fontSize: 17,
            fontWeight: '800',
            letterSpacing: 0,
            fontFamily: 'Nunito_800ExtraBold',
          }}
        >
          {label}
        </AppText>
      </Animated.View>
    </Pressable>
  );
}

type MapPathNodeProps = {
  node: LessonNode;
  levelNumber: number;
  totalInSubject: number;
  status: LessonStatus;
  stars?: 1 | 2 | 3;
  theme: ReturnType<typeof useAppTheme>;
  t: (key: string) => string;
  onPress: () => void;
  methodologyStyle: MethodologyStyle;
  isStartNode: boolean;
};

export function MapPathNode({
  node,
  levelNumber,
  totalInSubject,
  status,
  stars,
  theme,
  t,
  onPress,
  methodologyStyle,
  isStartNode,
}: MapPathNodeProps) {
  const pulseAnim = useNodePulse();
  const isLocked = status === 'locked';
  const isCompleted = status === 'completed';
  const isAvailable = status === 'available';

  const bgColor = isLocked
    ? theme.colors.surfaceAlt
    : isCompleted
      ? theme.colors.success
      : node.worldAccentColor;

  const borderColor = isLocked
    ? theme.colors.border
    : isCompleted
      ? theme.colors.success
      : isAvailable
        ? theme.colors.primary
        : node.worldAccentColor;

  const bw = isAvailable ? methodologyStyle.nodeBorderWidth + 2 : methodologyStyle.nodeBorderWidth;
  const pulseScale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const pulseOpacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1] });

  const inner = (
    <View
      style={{
        width: PATH_NODE_SIZE,
        height: PATH_NODE_SIZE,
        borderRadius: PATH_NODE_SIZE / 2,
        backgroundColor: bgColor,
        borderWidth: bw,
        borderColor,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: isAvailable ? theme.colors.primary : '#000',
        shadowOffset: { width: 0, height: isAvailable ? 10 : 3 },
        shadowOpacity: isAvailable ? 0.45 : 0.12,
        shadowRadius: isAvailable ? 14 : 5,
        elevation: isAvailable ? 12 : 3,
      }}
    >
      {isLocked ? (
        <MaterialIcons name="lock" size={26} color={theme.colors.textMuted} />
      ) : isCompleted ? (
        <>
          <AppText style={{ fontSize: 26 }}>✅</AppText>
          {stars ? (
            <MiniStars stars={stars} />
          ) : (
            <AppText style={{ color: '#fff', fontWeight: '700', fontSize: 9 }}>{t('map.completed')}</AppText>
          )}
        </>
      ) : (
        <>
          {methodologyStyle.nodeLabel === 'step' && (
            <AppText
              style={{
                color: '#FFFFFF',
                fontWeight: '800',
                fontSize: 9,
                marginBottom: 1,
                letterSpacing: 0.5,
              }}
            >
              {levelNumber}/{totalInSubject}
            </AppText>
          )}
          {methodologyStyle.nodeLabel === 'level' && (
            <AppText style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 10, marginBottom: 1 }}>
              {t('map.level')} {levelNumber}
            </AppText>
          )}
          <AppText style={{ fontSize: methodologyStyle.nodeLabel === 'none' ? 30 : 24 }}>{node.emoji}</AppText>
        </>
      )}
    </View>
  );

  if (isStartNode && isAvailable) {
    return (
      <View style={{ alignItems: 'center', gap: 10 }}>
        <Animated.View style={{ transform: [{ scale: pulseScale }], opacity: pulseOpacity }}>
          {inner}
        </Animated.View>
        <StartButton3D label={t('map.startBadge')} onPress={onPress} />
      </View>
    );
  }

  const wrap = (
    <View style={{ alignItems: 'center' }}>
      {inner}
    </View>
  );

  if (isLocked) {
    return (
      <View accessibilityLabel={`${t('map.level')} ${levelNumber} ${t('map.locked')}`} accessibilityRole="none">
        {wrap}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${t('map.level')} ${levelNumber}${isCompleted ? ` ${t('map.completed')}` : ''}. ${node.emoji}`}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
    >
      {isAvailable ? (
        methodologyStyle.nodeGlow ? (
          <Animated.View style={{ transform: [{ scale: pulseScale }], opacity: pulseOpacity }}>{wrap}</Animated.View>
        ) : (
          <Animated.View style={{ transform: [{ scale: pulseScale }] }}>{wrap}</Animated.View>
        )
      ) : (
        wrap
      )}
    </Pressable>
  );
}

/** Vertical «дорожка» между узлами + декор по бокам */
export function PathBridge({
  worldId,
  accentColor,
  themePrimary,
  nodeIndex,
  isNodeLeft,
  methodology,
  methodologyStyle,
}: {
  worldId: string;
  accentColor: string;
  themePrimary: string;
  nodeIndex: number;
  isNodeLeft: boolean;
  methodology: Methodology;
  methodologyStyle: MethodologyStyle;
}) {
  const biomeDecor = WORLD_DECOR[worldId] ?? WORLD_DECOR.jungle;
  const methDecor = METHODOLOGY_DECOR[methodology] ?? { left: [], right: [] };

  const leftPool = methDecor.left.length
    ? [biomeDecor.left[nodeIndex % biomeDecor.left.length], methDecor.left[nodeIndex % methDecor.left.length]]
    : [biomeDecor.left[nodeIndex % biomeDecor.left.length]];
  const rightPool = methDecor.right.length
    ? [biomeDecor.right[(nodeIndex + 1) % biomeDecor.right.length], methDecor.right[(nodeIndex + 1) % methDecor.right.length]]
    : [biomeDecor.right[(nodeIndex + 1) % biomeDecor.right.length]];

  const spineBg = accentColor + '35';
  const spineBorder = accentColor + 'AA';
  const [bigSize, smallSize] = methodologyStyle.pathDotSizes;
  const dotBorderRadius =
    methodologyStyle.pathDotShape === 'round' ? bigSize / 2 : methodologyStyle.pathDotShape === 'square' ? 2 : 0;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', height: 52 }}>
      <View style={{ flex: 1, alignItems: 'flex-end', paddingRight: 8, gap: 2 }}>
        {leftPool.map((e, i) => (
          <AppText key={i} style={{ fontSize: i === 0 ? 22 : 16, opacity: isNodeLeft ? 0.4 : 0.75 }}>
            {e}
          </AppText>
        ))}
      </View>

      <View
        style={{
          width: PATH_SPINE_WIDTH,
          height: 48,
          borderRadius: PATH_SPINE_WIDTH / 2,
          backgroundColor: spineBg,
          borderWidth: 2,
          borderColor: spineBorder,
          alignItems: 'center',
          justifyContent: 'space-around',
          paddingVertical: 4,
        }}
      >
        {[0, 1, 2, 3, 4].map((i) => {
          const isBig = i % 2 === 0;
          const size = isBig ? bigSize : smallSize;
          return (
            <View
              key={i}
              style={{
                width: size,
                height: size,
                borderRadius: isBig ? dotBorderRadius : dotBorderRadius * 0.6,
                backgroundColor: isBig ? themePrimary + 'DD' : accentColor + '88',
                transform: methodologyStyle.pathDotShape === 'diamond' ? [{ rotate: '45deg' }] : [],
                shadowColor: isBig ? themePrimary : accentColor,
                shadowOffset: { width: 0, height: isBig ? 3 : 1 },
                shadowOpacity: isBig ? 0.5 : 0.3,
                shadowRadius: isBig ? 3 : 2,
                elevation: isBig ? 4 : 2,
                borderTopWidth: 1,
                borderTopColor: isBig ? '#ffffff55' : '#ffffff33',
              }}
            />
          );
        })}
      </View>

      <View style={{ flex: 1, alignItems: 'flex-start', paddingLeft: 8, gap: 2 }}>
        {rightPool.map((e, i) => (
          <AppText key={i} style={{ fontSize: i === 0 ? 22 : 16, opacity: isNodeLeft ? 0.75 : 0.4 }}>
            {e}
          </AppText>
        ))}
      </View>
    </View>
  );
}

/** Центральная колонка «пути» рядом с узлом */
export function PathSpineColumn({
  accentColor,
  themePrimary,
  methodologyStyle,
}: {
  accentColor: string;
  themePrimary: string;
  methodologyStyle: MethodologyStyle;
}) {
  const [bigSize, smallSize] = methodologyStyle.pathDotSizes;

  return (
    <View
      style={{
        width: PATH_SPINE_WIDTH,
        alignItems: 'center',
        height: PATH_NODE_SIZE + 12,
        justifyContent: 'space-around',
        borderRadius: PATH_SPINE_WIDTH / 2,
        backgroundColor: accentColor + '28',
        borderWidth: 2,
        borderColor: accentColor + '70',
        paddingVertical: 6,
      }}
    >
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const isBig = i % 3 === 0;
        const size = isBig ? bigSize : smallSize;
        const dotRadius =
          methodologyStyle.pathDotShape === 'round' ? size / 2 : methodologyStyle.pathDotShape === 'square' ? 2 : 0;
        return (
          <View
            key={i}
            style={{
              width: size,
              height: size,
              borderRadius: dotRadius,
              backgroundColor: isBig ? themePrimary + 'CC' : accentColor + '66',
              transform: methodologyStyle.pathDotShape === 'diamond' ? [{ rotate: '45deg' }] : [],
              shadowColor: isBig ? themePrimary : accentColor,
              shadowOffset: { width: 0, height: isBig ? 3 : 1 },
              shadowOpacity: isBig ? 0.45 : 0.25,
              shadowRadius: isBig ? 3 : 2,
              elevation: isBig ? 4 : 2,
              borderTopWidth: 1,
              borderTopColor: isBig ? '#ffffff55' : '#ffffff33',
            }}
          />
        );
      })}
    </View>
  );
}
