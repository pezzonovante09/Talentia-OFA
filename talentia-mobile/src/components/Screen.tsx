import React, { PropsWithChildren } from 'react';
import { ImageBackground, ImageSourcePropType, ScrollView, View, ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { useAppTheme } from '../theme';

type ScreenProps = PropsWithChildren<
  {
    scroll?: boolean;
    backgroundImage?: ImageSourcePropType;
  } & ViewProps
>;

export function Screen({ children, scroll = false, backgroundImage, style, ...rest }: ScreenProps) {
  const theme = useAppTheme();

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
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
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
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <ImageBackground
          source={backgroundImage}
          resizeMode="cover"
          style={{ flex: 1 }}
        >
          {/* semi-transparent overlay so text remains readable */}
          <View style={{ flex: 1, backgroundColor: 'rgba(235,249,255,0.58)' }}>
            {inner}
          </View>
        </ImageBackground>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: theme.colors.background,
      }}
    >
      {inner}
    </SafeAreaView>
  );
}
