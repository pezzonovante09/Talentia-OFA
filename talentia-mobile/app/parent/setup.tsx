/**
 * Первая настройка (дизайн-док §2): порог намерения → PIN → повтор → согласие `account_local`.
 * Аккаунт и база создаются на шаге 3 (PIN принят), согласие пишется на шаге 4; закрытие до него —
 * `abandonSetup`, на устройстве ничего не остаётся. После согласия — профиль ребёнка.
 */
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { parentSpacing } from '../../src/design/parentTokens';
import { checkIntent, intentChallenge, pinProblem } from '../../src/domain/parentGate';
import type { InterfaceLang } from '../../src/domain/regionVisibility';
import { accountLocalTextVersion } from '../../src/services/local/account';
import { sha256 } from '../../src/services/digest';
import { useAccount } from '../../src/state/account';
import { useGate } from '../../src/state/gate';
import { PinPad } from '../../src/ui/parent/PinPad';
import { Card, Field, Keypad, ParentButton, ParentScreen, ParentText } from '../../src/ui/parent/primitives';

type Step = 'intent' | 'pin' | 'repeat' | 'consent';
const ORDER: Step[] = ['intent', 'pin', 'repeat', 'consent'];
const PLAIN = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

export default function SetupScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const account = useAccount();
  const openGate = useGate((s) => s.open);
  const [step, setStep] = useState<Step>('intent');
  const [challenge, setChallenge] = useState(() => intentChallenge(Math.random));
  const [answer, setAnswer] = useState('');
  const [intentError, setIntentError] = useState<string | null>(null);
  const [firstPin, setFirstPin] = useState<string | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const stepNo = ORDER.indexOf(step) + 1;
  const lang = i18n.language as InterfaceLang;
  const version = useMemo(() => accountLocalTextVersion(lang), [lang]);

  const close = async () => {
    if (account.accountId) await account.abandonSetup();
    router.dismissAll();
  };
  const back = () => {
    if (step === 'pin') setStep('intent');
    if (step === 'repeat') {
      setFirstPin(null);
      setStep('pin');
    }
  };

  const header = {
    left: step === 'intent' ? <ParentButton variant="quiet" label={t('parent.close')} onPress={close} testID="setup-close" block={false} /> : step !== 'consent' ? <ParentButton variant="quiet" label={t('parent.back')} onPress={back} testID="setup-back" block={false} /> : <ParentButton variant="quiet" label={t('parent.close')} onPress={close} testID="setup-close" block={false} />,
  };

  return (
    <ParentScreen left={header.left} scroll={step === 'consent'} testID={`setup-${step}`}>
      <View style={{ gap: parentSpacing.lg, paddingTop: parentSpacing.xl }}>
        {step === 'intent' && (
          <View style={{ alignItems: 'center', gap: parentSpacing.lg }}>
            <ParentText role="heading" align="center" accessibilityRole="header">
              {t('parent.setup.intentTitle')}
            </ParentText>
            <ParentText role="caption" color="textMuted" align="center">
              {t('parent.setup.intentHint')} · {t('parent.setup.step', { n: stepNo, total: 4 })}
            </ParentText>
            <ParentText role="number" testID="intent-challenge">{`${challenge.a} × ${challenge.b} = ?`}</ParentText>
            <Field value={answer} onChange={(v) => setAnswer(v.replace(/\D/g, '').slice(0, 4))} width={160} keyboard="number-pad" showSoftInput={false} align="center" error={intentError} placeholder={t('parent.setup.answerPlaceholder')} testID="intent-answer" />
            <Keypad layout={PLAIN} onDigit={(d) => setAnswer((a) => (a.length < 4 ? a + d : a))} onBackspace={() => setAnswer((a) => a.slice(0, -1))} backspaceLabel={t('parent.pin.backspace')} testID="intent-keypad" />
            <ParentButton
              label={t('parent.next')}
              disabled={answer.length === 0}
              onPress={() => {
                if (checkIntent(challenge, answer)) {
                  setIntentError(null);
                  setStep('pin');
                } else {
                  setIntentError(t('parent.setup.intentWrong'));
                  setAnswer('');
                  setChallenge(intentChallenge(Math.random));
                }
              }}
              testID="intent-next"
            />
          </View>
        )}

        {step === 'pin' && (
          <PinPad
            title={t('parent.setup.pinTitle')}
            hint={`${t('parent.setup.pinHint')} · ${t('parent.setup.step', { n: stepNo, total: 4 })}`}
            testID="setup-pin"
            initialError={pinError}
            onComplete={async (pin) => {
              setPinError(null);
              if (pinProblem(pin)) return { result: 'wrong', message: t('parent.setup.pinWeak') };
              setFirstPin(pin);
              setStep('repeat');
              return { result: 'ok' };
            }}
          />
        )}

        {step === 'repeat' && (
          <PinPad
            title={t('parent.setup.repeatTitle')}
            hint={t('parent.setup.step', { n: stepNo, total: 4 })}
            testID="setup-repeat"
            onComplete={async (pin) => {
              if (pin !== firstPin) {
                // PinPad повтора размонтируется вместе с шагом — сообщение несёт новый PinPad шага «Придумайте PIN».
                setFirstPin(null);
                setPinError(t('parent.setup.repeatMismatch'));
                setStep('pin');
                return { result: 'wrong' };
              }
              setBusy(true);
              try {
                await account.createWithPin(pin, sha256);
                openGate();
                setStep('consent');
              } catch (e) {
                if (__DEV__) console.warn('setup', e);
                setFirstPin(null);
                setPinError(t('parent.failed'));
                setStep('pin');
              } finally {
                setBusy(false);
              }
              return { result: 'ok' };
            }}
          />
        )}

        {step === 'consent' && (
          <View style={{ gap: parentSpacing.lg, flex: 1 }}>
            <ParentText role="heading" accessibilityRole="header">
              {t('parent.consent.title')}
            </ParentText>
            <ParentText role="caption" color="textMuted">
              {t('parent.setup.step', { n: stepNo, total: 4 })}
            </ParentText>
            <Card>
              <ParentText role="body" testID="consent-body">
                {t('parent.consent.body')}
              </ParentText>
            </Card>
            <ParentButton variant="quiet" label={t('parent.consent.policy')} underline onPress={() => router.push('/parent/policy')} testID="consent-policy" block={false} />
            <View style={{ flex: 1 }} />
            <ParentButton
              label={t('parent.consent.accept')}
              disabled={busy}
              onPress={async () => {
                setBusy(true);
                try {
                  await account.grantConsent(lang);
                  router.replace('/parent/profile/new');
                } catch (e) {
                  if (__DEV__) console.warn('consent', e);
                  setFailure(t('parent.failed'));
                } finally {
                  setBusy(false);
                }
              }}
              testID="consent-accept"
            />
            {failure && (
              <ParentText role="caption" color="error" align="center" testID="consent-error">
                {failure}
              </ParentText>
            )}
            <ParentText role="caption" color="textMuted" align="center">
              {t('parent.consent.version', { version, date: new Date().toLocaleDateString(lang === 'en' ? 'en-GB' : 'ru-RU') })}
            </ParentText>
          </View>
        )}
      </View>
    </ParentScreen>
  );
}
