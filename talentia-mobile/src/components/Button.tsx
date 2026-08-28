import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  View,
} from 'react-native';

import { useAppTheme } from '../theme';
import { AppText } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

/**
 * Text/icon color for filled (non-ghost) button variants. White text on the
 * app's primary/secondary/error fills measures as low as 2.3:1 (WCAG AA
 * requires 4.5:1 for this text size) across every theme variant — this dark
 * color clears 4.5:1 against all of them instead.
 */
const FILLED_BUTTON_TEXT_COLOR = '#0B1B22';

export type ButtonProps = PressableProps & {
  variant?: Variant;
  loading?: boolean;
  children: React.ReactNode;
  textStyle?: object;
};

export function Button({
  variant = 'primary',
  loading,
  children,
  style,
  textStyle,
  disabled,
  ...rest
}: ButtonProps) {
  const theme = useAppTheme();

  const baseBackground =
    variant === 'primary'
      ? theme.colors.primary
      : variant === 'secondary'
      ? theme.colors.secondary
      : variant === 'danger'
      ? theme.colors.error
      : 'transparent';

  const baseBorderColor =
    variant === 'ghost'
      ? theme.colors.border
      : variant === 'secondary'
      ? theme.colors.secondary
      : variant === 'danger'
      ? theme.colors.error
      : baseBackground;

  const baseTextColor =
    variant === 'ghost' ? theme.colors.text : FILLED_BUTTON_TEXT_COLOR;

  const shadowColor =
    variant === 'primary'
      ? theme.colors.primary
      : variant === 'secondary'
      ? theme.colors.secondary
      : variant === 'danger'
      ? theme.colors.error
      : '#000';

  const isDisabled = !!(disabled || loading);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      disabled={isDisabled}
      style={({ pressed }) => [
        {
          backgroundColor: baseBackground,
          borderRadius: theme.radii.pill,
          borderWidth: variant === 'ghost' ? 1.5 : 0,
          borderColor: baseBorderColor,
          paddingVertical: theme.spacing.md + 2,
          paddingHorizontal: theme.spacing.xl,
          opacity: pressed && !isDisabled ? 0.9 : isDisabled ? 0.55 : 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: variant === 'ghost' ? 'transparent' : shadowColor,
          shadowOffset: { width: 0, height: pressed ? 2 : 4 },
          shadowOpacity: variant === 'ghost' ? 0 : theme.calmMode ? 0.12 : 0.25,
          shadowRadius: pressed ? 4 : 12,
          elevation: variant === 'ghost' ? 0 : pressed ? 3 : 6,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        style as object,
      ]}
      {...rest}
    >
      {loading && (
        <View style={{ marginRight: theme.spacing.sm }}>
          <ActivityIndicator color={baseTextColor} />
        </View>
      )}
      <AppText
        style={[
          {
            color: baseTextColor,
            fontWeight: '700',
            fontSize: theme.typography.body,
            letterSpacing: 0.3,
          },
          textStyle,
        ]}
      >
        {children}
      </AppText>
    </Pressable>
  );
}
