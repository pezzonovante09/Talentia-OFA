import React, { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useAppTheme } from '../theme';
import { AppText } from './Text';
import { Spacer } from './Spacer';

type PinModalProps = {
  visible: boolean;
  /** 'verify' = check pin, 'set' = set new pin */
  mode: 'verify' | 'set';
  existingPin?: string | null;
  onSuccess: (pin?: string) => void;
  onCancel: () => void;
};

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '✓'];

export function PinModal({ visible, mode, existingPin, onSuccess, onCancel }: PinModalProps) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const [input, setInput] = useState('');
  const [confirmInput, setConfirmInput] = useState('');
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [error, setError] = useState('');

  const reset = () => {
    setInput('');
    setConfirmInput('');
    setStep('enter');
    setError('');
  };

  const handleDigit = (d: string) => {
    if (d === '⌫') {
      if (step === 'enter') setInput((p) => p.slice(0, -1));
      else setConfirmInput((p) => p.slice(0, -1));
      setError('');
      return;
    }
    if (d === '✓') {
      handleConfirm();
      return;
    }
    if (step === 'enter') {
      if (input.length < 4) setInput((p) => p + d);
    } else {
      if (confirmInput.length < 4) setConfirmInput((p) => p + d);
    }
  };

  const handleConfirm = () => {
    if (mode === 'verify') {
      if (input === existingPin) {
        reset();
        onSuccess();
      } else {
        setError(t('pin.wrongPin'));
        setInput('');
      }
      return;
    }

    // mode === 'set'
    if (step === 'enter') {
      if (input.length < 4) { setError(t('pin.tooShort')); return; }
      setStep('confirm');
      return;
    }

    // confirm step
    if (input === confirmInput) {
      const pin = input;
      reset();
      onSuccess(pin);
    } else {
      setError(t('pin.mismatch'));
      setConfirmInput('');
      setStep('enter');
      setInput('');
    }
  };

  const currentValue = step === 'enter' ? input : confirmInput;

  const title = mode === 'verify'
    ? t('pin.enterTitle')
    : step === 'enter'
      ? t('pin.setTitle')
      : t('pin.confirmTitle');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.55)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radii.lg,
            padding: theme.spacing.xl,
            width: '80%',
            maxWidth: 340,
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.3,
            shadowRadius: 20,
            elevation: 12,
          }}
        >
          <AppText style={{ fontSize: 36 }}>🔐</AppText>
          <Spacer size="sm" />
          <AppText variant="subtitle" style={{ fontWeight: '800', textAlign: 'center' }}>
            {title}
          </AppText>

          {/* PIN dots */}
          <Spacer size="lg" />
          <View style={{ flexDirection: 'row', gap: 14 }}>
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 9,
                  backgroundColor: i < currentValue.length
                    ? theme.colors.primary
                    : theme.colors.border,
                }}
              />
            ))}
          </View>
          <Spacer size="sm" />

          {error ? (
            <AppText variant="small" style={{ color: theme.colors.error, textAlign: 'center' }}>
              {error}
            </AppText>
          ) : (
            <View style={{ height: 18 }} />
          )}

          {/* Numpad */}
          <Spacer size="md" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: 240, gap: 10 }}>
            {DIGITS.map((d) => (
              <Pressable
                key={d}
                onPress={() => handleDigit(d)}
                style={({ pressed }) => ({
                  width: 70,
                  height: 56,
                  borderRadius: theme.radii.md,
                  backgroundColor: d === '✓'
                    ? theme.colors.primary
                    : d === '⌫'
                      ? theme.colors.surfaceAlt
                      : theme.colors.surfaceAlt,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.7 : 1,
                  borderWidth: 1.5,
                  borderColor: d === '✓' ? theme.colors.primary : theme.colors.border,
                })}
              >
                <AppText
                  style={{
                    fontSize: 20,
                    fontWeight: '700',
                    color: d === '✓' ? '#fff' : theme.colors.text,
                  }}
                >
                  {d}
                </AppText>
              </Pressable>
            ))}
          </View>

          <Spacer size="lg" />
          <Pressable onPress={() => { reset(); onCancel(); }}>
            <AppText variant="small" style={{ color: theme.colors.textMuted }}>
              {t('common.cancel')}
            </AppText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
