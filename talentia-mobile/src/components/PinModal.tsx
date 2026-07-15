import React, { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialIcons } from '@expo/vector-icons';

import { NanoBananaIcon } from './NanoBananaIcon';
import { NANO_UI } from '../constants/nanoBananaAssets';
import { useAppTheme } from '../theme';
import { AppText } from './Text';
import { Spacer } from './Spacer';
import { useSettingsStore } from '../store/settingsStore';

type PinModalProps = {
  visible: boolean;
  /** 'verify' = check pin, 'set' = set new pin */
  mode: 'verify' | 'set';
  existingPin?: string | null;
  onSuccess: (pin?: string) => void;
  onCancel: () => void;
};

const PIN_BACK = '__BACK__';
const PIN_OK = '__OK__';
const NUMPAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', PIN_BACK, '0', PIN_OK] as const;

export function PinModal({ visible, mode, existingPin, onSuccess, onCancel }: PinModalProps) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const [input, setInput] = useState('');
  const [confirmInput, setConfirmInput] = useState('');
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [error, setError] = useState('');
  const [remainingLockMs, setRemainingLockMs] = useState(0);

  const pinLockedUntil = useSettingsStore((s) => s.pinLockedUntil);
  const registerPinFailure = useSettingsStore((s) => s.registerPinFailure);
  const registerPinSuccess = useSettingsStore((s) => s.registerPinSuccess);

  // Tick the lockout countdown once a second while the modal is visible and locked.
  useEffect(() => {
    if (!visible) return;
    const update = () => {
      const remaining = pinLockedUntil ? pinLockedUntil - Date.now() : 0;
      setRemainingLockMs(remaining > 0 ? remaining : 0);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [visible, pinLockedUntil]);

  const isLocked = mode === 'verify' && remainingLockMs > 0;
  const isWebUnprotected = Platform.OS === 'web';

  const reset = () => {
    setInput('');
    setConfirmInput('');
    setStep('enter');
    setError('');
  };

  const handleDigit = (d: string) => {
    if (isLocked || isWebUnprotected) return;
    if (d === PIN_BACK) {
      if (step === 'enter') setInput((p) => p.slice(0, -1));
      else setConfirmInput((p) => p.slice(0, -1));
      setError('');
      return;
    }
    if (d === PIN_OK) {
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
    if (isLocked || isWebUnprotected) return;
    if (mode === 'verify') {
      if (input === existingPin) {
        registerPinSuccess();
        reset();
        onSuccess();
      } else {
        registerPinFailure();
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
          <NanoBananaIcon source={NANO_UI.lock} size={40} />
          <Spacer size="sm" />
          <AppText variant="subtitle" style={{ fontWeight: '800', textAlign: 'center' }}>
            {title}
          </AppText>

          {isWebUnprotected ? (
            <>
              <Spacer size="xs" />
              <AppText variant="small" style={{ color: theme.colors.error, textAlign: 'center' }}>
                {t('pin.webUnprotectedWarning')}
              </AppText>
            </>
          ) : null}

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

          {isLocked ? (
            <AppText variant="small" style={{ color: theme.colors.error, textAlign: 'center' }}>
              {t('pin.lockedOut', { seconds: Math.ceil(remainingLockMs / 1000) })}
            </AppText>
          ) : error ? (
            <AppText variant="small" style={{ color: theme.colors.error, textAlign: 'center' }}>
              {error}
            </AppText>
          ) : (
            <View style={{ height: 18 }} />
          )}

          {/* Numpad */}
          <Spacer size="md" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: 240, gap: 10 }}>
            {NUMPAD_KEYS.map((d) => (
              <Pressable
                key={d}
                onPress={() => handleDigit(d)}
                disabled={isLocked}
                style={({ pressed }) => ({
                  width: 70,
                  height: 56,
                  borderRadius: theme.radii.md,
                  backgroundColor: d === PIN_OK
                    ? theme.colors.primary
                    : theme.colors.surfaceAlt,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: isLocked ? 0.4 : pressed ? 0.7 : 1,
                  borderWidth: 1.5,
                  borderColor: d === PIN_OK ? theme.colors.primary : theme.colors.border,
                })}
              >
                {d === PIN_BACK ? (
                  <MaterialIcons name="backspace" size={22} color={theme.colors.text} />
                ) : d === PIN_OK ? (
                  <MaterialIcons name="check" size={24} color="#fff" />
                ) : (
                  <AppText
                    style={{
                      fontSize: 20,
                      fontWeight: '700',
                      color: theme.colors.text,
                    }}
                  >
                    {d}
                  </AppText>
                )}
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
