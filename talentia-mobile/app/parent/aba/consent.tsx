/**
 * Согласие на данные практики (`aba_processing`) — шаблон экрана согласия раздела (направление §1): текст, «Хранится на
 * этом устройстве», ссылка на политику, «Даю согласие» и «Не сейчас» одной высоты и ширины, версия текста. Даётся за свежим PIN
 * (`aba_consent`). Текст — черновик (`DRAFT`), итог — после юриста: с ним к детям нельзя.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { parentSpacing } from '../../../src/design/parentTokens';
import type { InterfaceLang } from '../../../src/domain/regionVisibility';
import { consentLang } from '../../../src/i18n';
import { abaConsentTextVersion, grantAbaProcessing } from '../../../src/services/local/abaConsent';
import { randomBytes } from '../../../src/services/random';
import { useAccount } from '../../../src/state/account';
import { useGate } from '../../../src/state/gate';
import { useSelectedProfile } from '../../../src/state/parentView';
import { ConfirmPinSheet } from '../../../src/ui/parent/ConfirmPinSheet';
import { Card, ParentButton, ParentScreen, ParentText } from '../../../src/ui/parent/primitives';

export default function AbaConsentScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const db = useAccount((s) => s.db);
  const accountId = useAccount((s) => s.accountId);
  const profile = useSelectedProfile();
  const can = useGate((s) => s.can);
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  if (!db || !accountId || !profile) return null;
  // язык, на котором текст согласия показан (ky без перевода → ru): им рендерится текст и им берётся версия для
  // журнала — версия того текста, который родитель видел (аудит 2026-11-09, `child-privacy-compliance` по диффу)
  const lang = consentLang(i18n.language as InterfaceLang, 'parent.aba.consentBody');
  const tc = (key: string, vars?: Record<string, unknown>) => t(key, { ...vars, lng: lang });

  const grant = async () => {
    setBusy(true);
    setFailure(null);
    try {
      await grantAbaProcessing(db, { childId: profile.childId, accountId, lang, at: new Date().toISOString(), randomBytes });
      router.back();
    } catch (e) {
      if (__DEV__) console.warn('aba-consent', e);
      setFailure(t('parent.failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ParentScreen scroll left={<ParentButton variant="quiet" label={t('parent.back')} onPress={() => router.back()} block={false} testID="aba-consent-back" />} testID="parent-aba-consent">
      <View style={{ gap: parentSpacing.lg, paddingTop: parentSpacing.xl }}>
        <ParentText role="heading" accessibilityRole="header">
          {tc('parent.aba.consentTitle')}
        </ParentText>
        <Card>
          <ParentText role="body">{tc('parent.aba.consentBody')}</ParentText>
        </Card>
        <ParentText role="caption">{tc('parent.aba.localOnly')}</ParentText>
        <ParentButton variant="quiet" label={tc('parent.consent.policy')} underline onPress={() => router.push('/parent/policy')} testID="aba-consent-policy" block={false} />
        <View style={{ flexDirection: 'row', gap: parentSpacing.md }}>
          <View style={{ flex: 1 }}>
            <ParentButton label={tc('parent.aba.agree')} disabled={busy} onPress={() => (can('aba_consent') ? void grant() : setSheet(true))} testID="aba-agree" />
          </View>
          <View style={{ flex: 1 }}>
            <ParentButton variant="secondary" label={tc('parent.aba.notNow')} onPress={() => router.back()} testID="aba-not-now" />
          </View>
        </View>
        <ParentText role="caption" color="textMuted" testID="aba-consent-version">
          {tc('parent.aba.version', { version: abaConsentTextVersion(lang) })}
        </ParentText>
        {failure && (
          <ParentText role="caption" color="error" align="center" testID="aba-consent-error">
            {failure}
          </ParentText>
        )}
      </View>
      <ConfirmPinSheet
        visible={sheet}
        onCancel={() => setSheet(false)}
        onConfirmed={() => {
          setSheet(false);
          void grant();
        }}
      />
    </ParentScreen>
  );
}
