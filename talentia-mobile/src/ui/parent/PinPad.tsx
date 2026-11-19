/**
 * Ввод PIN (дизайн-док §1): точки, строка состояния, перемешанная клавиатура; проверка через
 * `checkPin` с блокировкой 1 → 5 → 15 мин — пока она действует, клавиатура не рисуется, идёт таймер.
 * Один компонент на вход, повтор при настройке и лист подтверждения.
 */
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { parentPin, parentSpacing } from '../../design/parentTokens';
import { PIN_MAX_ATTEMPTS, shuffledKeypad } from '../../domain/parentGate';
import { Keypad, ParentText, PinDots } from './primitives';

export type PinPadProps = {
  title: string;
  hint?: string;
  /** Проверка введённого PIN: `ok` / `wrong` (с числом оставшихся попыток) / `locked` до времени. */
  onComplete: (pin: string) => Promise<{ result: 'ok' } | { result: 'wrong'; attemptsLeft?: number; message?: string } | { result: 'locked'; lockedUntil: number }>;
  /** Арифметика первой настройки — единственное место без перемешивания. */
  shuffle?: boolean;
  initialLockedUntil?: number | null;
  /** Ошибка, пришедшая с другого шага (повтор PIN не совпал — показывается уже на шаге «Придумайте PIN»). */
  initialError?: string | null;
  testID?: string;
};

function mmss(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function PinPad({ title, hint, onComplete, shuffle = true, initialLockedUntil = null, initialError = null, testID = 'pin' }: PinPadProps) {
  const { t } = useTranslation();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(initialError);
  const [flash, setFlash] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<number | null>(initialLockedUntil);
  const [now, setNow] = useState(Date.now());
  const makeLayout = useCallback(() => (shuffle ? shuffledKeypad(Math.random) : ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']), [shuffle]);
  const [layout, setLayout] = useState(makeLayout);
  const reshuffle = useCallback(() => setLayout(makeLayout()), [makeLayout]);

  useEffect(() => {
    if (lockedUntil === null) return;
    const id = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= lockedUntil) {
        setLockedUntil(null);
        reshuffle();
      }
    }, 500);
    return () => clearInterval(id);
  }, [lockedUntil, reshuffle]);

  const submit = useCallback(
    async (full: string) => {
      const r = await onComplete(full);
      if (r.result === 'ok') {
        setPin('');
        setError(null);
        return;
      }
      setFlash(true);
      setTimeout(() => {
        setFlash(false);
        setPin('');
        reshuffle();
      }, parentPin.errorFlashMs);
      if (r.result === 'locked') {
        setLockedUntil(r.lockedUntil);
        setError(null);
        return;
      }
      const left = r.attemptsLeft;
      setError(r.message ?? (left !== undefined && left <= PIN_MAX_ATTEMPTS - 3 ? `${t('parent.pin.wrong')}. ${t('parent.pin.attemptsLeft', { n: left })}` : t('parent.pin.wrong')));
    },
    [onComplete, reshuffle, t],
  );

  const onDigit = (d: string) => {
    if (flash || pin.length >= parentPin.length) return;
    const next = pin + d;
    setPin(next);
    setError(null);
    if (next.length === parentPin.length) void submit(next);
  };

  return (
    <View style={{ alignItems: 'center', gap: parentSpacing.lg }} testID={testID}>
      <ParentText role="heading" align="center" accessibilityRole="header">
        {title}
      </ParentText>
      {hint ? (
        <ParentText role="caption" color="textMuted" align="center">
          {hint}
        </ParentText>
      ) : null}
      {lockedUntil !== null ? (
        <View style={{ alignItems: 'center', gap: parentSpacing.sm }} testID={`${testID}-locked`}>
          <ParentText role="body" align="center">
            {t('parent.pin.locked')}
          </ParentText>
          <ParentText role="number" testID={`${testID}-timer`}>
            {mmss(lockedUntil - now)}
          </ParentText>
        </View>
      ) : (
        <>
          <PinDots filled={pin.length} error={flash} testID={`${testID}-dots`} />
          <View style={{ height: 20 }}>
            {error ? (
              <ParentText role="caption" color="error" align="center" testID={`${testID}-error`}>
                {error}
              </ParentText>
            ) : null}
          </View>
          <Keypad layout={layout} onDigit={onDigit} onBackspace={() => setPin((p) => p.slice(0, -1))} backspaceLabel={t('parent.pin.backspace')} testID={`${testID}-keypad`} />
        </>
      )}
    </View>
  );
}
