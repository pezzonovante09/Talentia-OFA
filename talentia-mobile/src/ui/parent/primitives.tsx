/**
 * Примитивы родительского раздела (`docs/design/parent-screens-2026-10-25.md` §0): текст по ролям,
 * экран с шапкой 48, кнопка без масштаба (заливка под пальцем за 140 мс), карточка с hairline,
 * строка, сегменты, поле, точки и клавиатура PIN, полоса недели. Детские примитивы здесь не
 * используются: у них отклик игры.
 */
import { useState, type PropsWithChildren, type ReactNode } from 'react';
import { Pressable, ScrollView, Switch, Text, TextInput, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ICONS, type IconName } from '../../assets/registry';
import { parentButton, parentCard, parentHeader, parentPin, parentRow, parentSegmented, parentSpacing, parentSwitch, weekStrip, type ParentColors } from '../../design/parentTokens';
import { fontFamilyFor } from '../fonts';
import { useParentTheme } from './theme';

export type ParentColorName = Exclude<keyof ParentColors, 'regionsInk'>;
export type ParentTextRole = 'heading' | 'body' | 'caption' | 'number' | 'label';

export function ParentText({ role, color = 'text', align, lines, style, children, testID, accessibilityRole, hex }: PropsWithChildren<{ role: ParentTextRole; color?: ParentColorName; hex?: string; align?: TextStyle['textAlign']; lines?: number; style?: TextStyle; testID?: string; accessibilityRole?: 'header' | 'text' }>) {
  const t = useParentTheme();
  const ty = t.typography[role];
  return (
    <Text
      numberOfLines={lines}
      maxFontSizeMultiplier={role === 'number' ? 1 : 1.3}
      accessibilityRole={accessibilityRole}
      testID={testID}
      style={[
        { fontFamily: fontFamilyFor(ty), fontWeight: ty.weight, fontSize: ty.size, lineHeight: ty.lineHeight, color: hex ?? t.colors[color], textAlign: align, fontVariant: ty.tabularNums ? ['tabular-nums'] : undefined },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function ParentIcon({ name, color = 'text', size = 24 }: { name: IconName; color?: ParentColorName; size?: number }) {
  const t = useParentTheme();
  const Svg = ICONS[name];
  return <Svg width={size} height={size} color={t.colors[color]} stroke={t.colors[color]} />;
}

export type ParentButtonVariant = 'primary' | 'secondary' | 'destructive' | 'quiet';

export function ParentButton({ variant = 'primary', label, onPress, disabled = false, reason, testID, underline = false, block = true }: { variant?: ParentButtonVariant; label: string; onPress: () => void; disabled?: boolean; /** Причина недоступности — подпись под кнопкой. */ reason?: string; testID?: string; underline?: boolean; block?: boolean }) {
  const t = useParentTheme();
  const [pressed, setPressed] = useState(false);
  const last = { at: 0 };
  const look = (() => {
    if (disabled) return { bg: t.colors.card, ink: t.colors.textMuted, border: t.colors.hairline };
    switch (variant) {
      case 'primary':
        return { bg: pressed ? t.pressed.primary : t.colors.primary, ink: t.colors.onPrimary, border: 'transparent' };
      case 'destructive':
        return { bg: pressed ? t.pressed.error : t.colors.error, ink: t.colors.onError, border: 'transparent' };
      case 'secondary':
        return { bg: pressed ? t.pressed.card : t.colors.card, ink: t.colors.text, border: t.colors.hairline };
      case 'quiet':
        return { bg: pressed ? t.pressed.card : 'transparent', ink: t.colors.primary, border: 'transparent' };
    }
  })();
  return (
    <View style={{ alignSelf: block ? 'stretch' : 'flex-start' }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        onPress={() => {
          const now = Date.now();
          if (now - last.at < parentButton.guardMs) return;
          last.at = now;
          onPress();
        }}
        testID={testID}
        style={{ height: parentButton.height, borderRadius: t.shape.radius, backgroundColor: look.bg, borderWidth: t.shape.hairline, borderColor: look.border, alignItems: 'center', justifyContent: 'center', paddingHorizontal: parentSpacing.lg }}
      >
        <ParentText role="label" hex={look.ink} style={{ textDecorationLine: underline ? 'underline' : 'none' }}>
          {label}
        </ParentText>
      </Pressable>
      {disabled && reason ? (
        <ParentText role="caption" color="textMuted" align="center" style={{ marginTop: parentSpacing.sm }}>
          {reason}
        </ParentText>
      ) : null}
    </View>
  );
}

export function ParentScreen({ title, left, right, scroll = true, children, testID }: PropsWithChildren<{ title?: string; left?: ReactNode; right?: ReactNode; scroll?: boolean; testID?: string }>) {
  const t = useParentTheme();
  const insets = useSafeAreaInsets();
  const body = (
    <View style={{ paddingHorizontal: parentSpacing.lg, paddingBottom: Math.max(insets.bottom, parentSpacing.lg), flexGrow: 1 }}>{children}</View>
  );
  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background }} testID={testID}>
      <View style={{ height: insets.top }} />
      <View style={{ height: parentHeader, flexDirection: 'row', alignItems: 'center', paddingHorizontal: parentSpacing.lg, gap: parentSpacing.sm }} testID="parent-header">
        <View style={{ minWidth: 48, alignItems: 'flex-start' }}>{left}</View>
        <View style={{ flex: 1 }}>
          {title ? (
            <ParentText role="heading" lines={1} accessibilityRole="header">
              {title}
            </ParentText>
          ) : null}
        </View>
        <View style={{ minWidth: 48, alignItems: 'flex-end' }}>{right}</View>
      </View>
      {scroll ? <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">{body}</ScrollView> : <View style={{ flex: 1 }}>{body}</View>}
    </View>
  );
}

export function Card({ title, children, testID, style }: PropsWithChildren<{ title?: string; testID?: string; style?: StyleProp<ViewStyle> }>) {
  const t = useParentTheme();
  return (
    <View style={[{ backgroundColor: t.colors.card, borderWidth: t.shape.hairline, borderColor: t.colors.hairline, borderRadius: t.shape.radius, paddingHorizontal: parentCard.padX, paddingVertical: parentCard.padY, marginBottom: parentCard.gap }, style]} testID={testID}>
      {title ? (
        <ParentText role="caption" color="textMuted" style={{ marginBottom: parentSpacing.sm }}>
          {title}
        </ParentText>
      ) : null}
      {children}
    </View>
  );
}

export function Row({ label, caption, value, kind = 'value', onPress, toggle, onToggle, first = false, testID, hex }: { label: string; caption?: string; value?: string; kind?: 'link' | 'value' | 'toggle' | 'destructive'; onPress?: () => void; toggle?: boolean; onToggle?: (v: boolean) => void; first?: boolean; testID?: string; /** Чернила предмета — только на карточке. */ hex?: string }) {
  const t = useParentTheme();
  const [pressed, setPressed] = useState(false);
  const interactive = kind === 'link' || kind === 'destructive' || (kind === 'value' && !!onPress);
  const content = (
    <View style={{ minHeight: parentRow.minHeight, flexDirection: 'row', alignItems: 'center', gap: parentSpacing.md, borderTopWidth: first ? 0 : t.shape.hairline, borderTopColor: t.colors.hairline, marginHorizontal: -parentCard.padX, paddingHorizontal: parentRow.padX, backgroundColor: pressed && interactive ? t.pressed.card : 'transparent' }}>
      <View style={{ flex: 1, paddingVertical: parentSpacing.sm }}>
        <ParentText role="body" hex={hex ?? (kind === 'destructive' ? t.colors.error : t.colors.text)}>
          {label}
        </ParentText>
        {caption ? (
          <ParentText role="caption" color="textMuted">
            {caption}
          </ParentText>
        ) : null}
      </View>
      {value ? (
        <ParentText role="body" color="textMuted">
          {value}
        </ParentText>
      ) : null}
      {kind === 'toggle' ? (
        <Switch value={!!toggle} onValueChange={onToggle} trackColor={{ true: t.colors[parentSwitch.trackOn], false: t.colors[parentSwitch.trackOff] }} thumbColor={t.colors[parentSwitch.thumb]} accessibilityLabel={label} testID={testID ? `${testID}-switch` : undefined} />
      ) : null}
      {kind === 'link' || (kind === 'value' && onPress) ? <ParentIcon name="arrow" color="textMuted" /> : null}
    </View>
  );
  if (!interactive) return <View testID={testID}>{content}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} onPressIn={() => setPressed(true)} onPressOut={() => setPressed(false)} testID={testID}>
      {content}
    </Pressable>
  );
}

export function Segmented<T extends string>({ options, value, onChange, testID }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; testID?: string }) {
  const t = useParentTheme();
  return (
    <View style={{ flexDirection: 'row', height: parentSegmented.height, borderWidth: t.shape.hairline, borderColor: t.colors.hairline, borderRadius: t.shape.radius, overflow: 'hidden' }} accessibilityRole="radiogroup" testID={testID}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable key={o.value} accessibilityRole="radio" accessibilityState={{ selected }} accessibilityLabel={o.label} onPress={() => onChange(o.value)} testID={testID ? `${testID}-${o.value}` : undefined} style={{ flex: 1, minWidth: parentSegmented.minSegment, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? t.colors[parentSegmented.selectedFill] : 'transparent' }}>
            <ParentText role="caption" hex={selected ? t.colors[parentSegmented.selectedLabel] : t.colors.text}>
              {o.label}
            </ParentText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Field({ value, onChange, placeholder, caption, error, width, keyboard = 'default', showSoftInput = true, align, testID }: { value: string; onChange: (v: string) => void; placeholder?: string; caption?: string; error?: string | null; width?: number; keyboard?: 'default' | 'number-pad'; showSoftInput?: boolean; align?: TextStyle['textAlign']; testID?: string }) {
  const t = useParentTheme();
  const [focused, setFocused] = useState(false);
  const ty = t.typography.body;
  return (
    <View style={{ width }}>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={t.colors.textMuted}
        keyboardType={keyboard}
        showSoftInputOnFocus={showSoftInput}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        maxLength={40}
        autoCorrect={false}
        autoComplete="off"
        spellCheck={false}
        textContentType="none"
        importantForAutofill="no"
        testID={testID}
        style={{ height: parentButton.height, borderRadius: t.shape.radius, backgroundColor: t.colors.card, borderWidth: error ? 2 : focused ? 2 : t.shape.hairline, borderColor: error ? t.colors.error : focused ? t.colors.primary : t.colors.hairline, paddingHorizontal: parentSpacing.md, color: t.colors.text, fontFamily: fontFamilyFor(ty), fontSize: ty.size, textAlign: align }}
      />
      {error ? (
        <ParentText role="caption" color="error" style={{ marginTop: parentSpacing.xs }} testID={testID ? `${testID}-error` : undefined}>
          {error}
        </ParentText>
      ) : caption ? (
        <ParentText role="caption" color="textMuted" style={{ marginTop: parentSpacing.xs }}>
          {caption}
        </ParentText>
      ) : null}
    </View>
  );
}

export function PinDots({ filled, error = false, testID = 'pin-dots' }: { filled: number; error?: boolean; testID?: string }) {
  const t = useParentTheme();
  return (
    <View style={{ flexDirection: 'row', gap: parentPin.dotGap, justifyContent: 'center' }} testID={testID} accessibilityLabel={`${filled}/${parentPin.length}`}>
      {Array.from({ length: parentPin.length }, (_, i) => {
        const on = i < filled;
        return <View key={i} testID={`${testID}-${on ? 'on' : 'off'}`} style={{ width: parentPin.dot, height: parentPin.dot, borderRadius: parentPin.dot / 2, backgroundColor: on ? (error ? t.colors.error : t.colors.text) : 'transparent', borderWidth: on ? 0 : parentPin.ring, borderColor: t.colors.hairline }} />;
      })}
    </View>
  );
}

export function Keypad({ layout, onDigit, onBackspace, backspaceLabel, testID = 'keypad' }: { layout: readonly string[]; onDigit: (d: string) => void; onBackspace: () => void; backspaceLabel: string; testID?: string }) {
  const t = useParentTheme();
  const rows = [layout.slice(0, 3), layout.slice(3, 6), layout.slice(6, 9), ['', layout[9], 'back']];
  return (
    <View style={{ gap: parentPin.keyGap, alignSelf: 'center' }} testID={testID}>
      {rows.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row', gap: parentPin.keyGap }}>
          {row.map((k, c) => {
            if (k === '') return <View key={c} style={{ width: parentPin.keyW, height: parentPin.keyH }} />;
            const back = k === 'back';
            return (
              <Pressable key={c} accessibilityRole="button" accessibilityLabel={back ? backspaceLabel : k} onPress={() => (back ? onBackspace() : onDigit(k))} testID={back ? `${testID}-back` : `${testID}-${k}`} style={({ pressed }) => ({ width: parentPin.keyW, height: parentPin.keyH, borderRadius: t.shape.radius, backgroundColor: pressed ? t.pressed.card : t.colors.card, borderWidth: t.shape.hairline, borderColor: t.colors.hairline, alignItems: 'center', justifyContent: 'center' })}>
                {back ? <ParentIcon name="x" /> : <ParentText role="heading">{k}</ParentText>}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

export function WeekStrip({ days, labels, todayIndex, testID = 'week-strip' }: { days: readonly boolean[]; labels: readonly string[]; todayIndex: number; testID?: string }) {
  const t = useParentTheme();
  return (
    <View style={{ flexDirection: 'row', gap: weekStrip.gap, alignSelf: 'center' }} testID={testID}>
      {days.map((active, i) => (
        <View key={i} style={{ alignItems: 'center', gap: parentSpacing.xs }}>
          <View testID={`${testID}-${active ? 'on' : 'off'}`} style={{ width: weekStrip.cell, height: weekStrip.cell, borderRadius: t.shape.radius, backgroundColor: active ? t.colors[weekStrip.filled] : 'transparent', borderWidth: active ? 0 : 1, borderStyle: active ? 'solid' : 'dashed', borderColor: t.colors[weekStrip.emptyDash] }} />
          <ParentText role="caption" color="textMuted" style={{ textDecorationLine: i === todayIndex ? 'underline' : 'none' }}>
            {labels[i]}
          </ParentText>
        </View>
      ))}
    </View>
  );
}
