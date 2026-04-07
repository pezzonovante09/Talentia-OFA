import React, { PropsWithChildren } from 'react';
import { ImageBackground, ImageSourcePropType, ScrollView, View, ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { useAppTheme } from '../theme';

const BG_TINT = {
  default: 'rgba(235,249,255,0.58)',
  /** Меньше «молока» поверх картинки — для ABA-градиента и насыщенных фонов. */
  light: 'rgba(252,253,252,0.28)',
} as const;

type ScreenProps = PropsWithChildren<
  {
    scroll?: boolean;
    backgroundImage?: ImageSourcePropType;
    /** Наложение поверх фоновой картинки (читаемость текста). */
    backgroundImageTint?: keyof typeof BG_TINT;
    /** When set, overrides SafeAreaView background (e.g. calm lesson surface). */
    rootBackgroundColor?: string;
  } & ViewProps
>;

export function Screen({
  children,
  scroll = false,
  backgroundImage,
  backgroundImageTint = 'default',
  rootBackgroundColor,
  style,
  ...rest
}: ScreenProps) {
  const theme = useAppTheme();
  const rootBg = rootBackgroundColor ?? theme.colors.background;

  const content = (
    <View
      style={[
        {
          flex: 1,
          paddingHorizontal: theme.spacing.lg,
          paddingTop: theme.spacing.md,
          paddingBottom: theme.spacing.lg,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );

  const inner = scroll ? (
    <ScrollView
      contentContainerStyle={{
        paddingBottom: theme.spacing.xl * 2.5,
        flexGrow: 1,
      }}
    >
      {content}
    </ScrollView>
  ) : (
    content
  );

  if (backgroundImage) {
    if (theme.calmMode) {
      return (
        <SafeAreaView style={{ flex: 1, backgroundColor: rootBg }}>
          <LinearGradient
            colors={['#C8EDD8', '#DAF0E6', '#EEF8F2', '#F5FCF8']}
            locations={[0, 0.35, 0.7, 1]}
            style={{ flex: 1 }}
          >
            {inner}
          </LinearGradient>
        </SafeAreaView>
      );
    }

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: rootBg }}>
        <ImageBackground
          source={backgroundImage}
          resizeMode="cover"
          style={{ flex: 1 }}
        >
          {/* semi-transparent overlay so text remains readable */}
          <View style={{ flex: 1, backgroundColor: BG_TINT[backgroundImageTint] }}>
            {inner}
          </View>
        </ImageBackground>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: rootBg }}>
      {inner}
    </SafeAreaView>
  );
}
