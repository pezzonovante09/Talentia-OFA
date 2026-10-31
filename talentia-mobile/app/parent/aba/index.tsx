/**
 * «Занятия ABA» в разделе родителя (направление `docs/design/aba-screens-2026-10-25.md` §1; вход — строка на главной,
 * решение владельца 2026-10-27, флага режима в профиле нет). Иерархия: «Занятие» с единственной залитой кнопкой →
 * согласие → пауза со строкой №150 → файл для специалиста → отзыв. Всё про выбранного ребёнка.
 */
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { parentSpacing } from '../../../src/design/parentTokens';
import type { SensitiveAction } from '../../../src/domain/parentGate';
import { abaBlockOf, abaOverview, finishInProgressSession, type AbaOverview } from '../../../src/services/local/abaStart';
import { confirmAbaPairing, setAbaPaused } from '../../../src/services/local/commit';
import { useAccount } from '../../../src/state/account';
import { useGate } from '../../../src/state/gate';
import { useSelectedProfile } from '../../../src/state/parentView';
import { ConfirmPinSheet } from '../../../src/ui/parent/ConfirmPinSheet';
import { Card, ParentButton, ParentScreen, ParentText, Row } from '../../../src/ui/parent/primitives';

export default function AbaParentScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const db = useAccount((s) => s.db);
  const profile = useSelectedProfile();
  const can = useGate((s) => s.can);
  const [ov, setOv] = useState<AbaOverview | null>(null);
  const [pending, setPending] = useState<{ action: SensitiveAction; run: () => void } | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [exportNote, setExportNote] = useState(false);

  const childId = profile?.childId ?? null;
  const reload = useCallback(async () => {
    if (!db || !childId) return;
    setOv(await abaOverview(db, childId));
  }, [db, childId]);
  // согласие и отзыв уходят назад через `router.back()` — этот экран остаётся смонтированным, читать на фокус
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  /** Действие за свежим PIN: окно свежести ещё открыто — сразу, иначе лист. */
  const guarded = (action: SensitiveAction, run: () => void) => (can(action) ? run() : setPending({ action, run }));

  const safely = (fn: () => Promise<void>) => () => {
    setFailure(null);
    void fn().catch((e: unknown) => {
      if (__DEV__) console.warn('aba-parent', e);
      setFailure(t('parent.failed'));
    });
  };

  if (!profile || !db) return null;
  const block = ov ? abaBlockOf(ov) : null;
  // текст согласия обновился — данные практики на устройстве остаются, пауза и отзыв доступны (ABA.md: другого пути отзыва нет)
  const hasData = ov?.consent === 'granted' || ov?.consent === 'outdated';
  const status = !ov ? '' : t(`parent.aba.status.${block ?? 'ready'}`);

  const setPaused = (paused: boolean) =>
    safely(async () => {
      const r = await setAbaPaused(db, profile.childId, paused, new Date().toISOString());
      if (r === 'consent_required') router.push('/parent/aba/consent');
      await reload();
    })();

  const finish = safely(async () => {
    await finishInProgressSession(db, profile.childId, Date.now());
    await reload();
  });

  const start = () => {
    router.dismissAll();
    router.push(block === 'pairing_needed' ? '/aba?mode=pairing' : '/aba');
  };

  // «Сопряжение подтверждено» (вопрос 62): только обученному наблюдателю, за PIN; роль держателя PIN — владелец аккаунта
  const confirmPairing = safely(async () => {
    if (!ov?.trainedObserverId) return;
    await confirmAbaPairing(db, profile.childId, { observerId: ov.trainedObserverId, byRole: 'owner', at: new Date().toISOString() });
    await reload();
  });

  return (
    <ParentScreen
      title={t('parent.aba.title')}
      scroll
      left={<ParentButton variant="quiet" label={t('parent.back')} onPress={() => router.back()} block={false} testID="aba-back" />}
      testID="parent-aba"
    >
      <View style={{ gap: parentSpacing.lg }}>
        <Card title={t('parent.aba.session')} testID="aba-session">
          <ParentText role="body" testID="aba-status">
            {status}
          </ParentText>
          {block === 'no_consent' || block === 'outdated' ? (
            <ParentButton label={t('parent.aba.readConsent')} onPress={() => router.push('/parent/aba/consent')} testID="aba-read-consent" />
          ) : block === 'paused' ? (
            <ParentButton variant="secondary" label={t('parent.aba.start')} disabled reason={t('parent.aba.unpauseToStart')} onPress={() => undefined} testID="aba-start" />
          ) : block === 'in_progress' ? (
            <>
              <ParentButton label={t('parent.aba.continue')} onPress={() => guarded('aba_resume', start)} testID="aba-continue" />
              <ParentButton variant="quiet" label={t('parent.aba.finishWithout')} onPress={finish} testID="aba-finish" />
            </>
          ) : block === 'no_ready_targets' || block === 'pool_small' ? null : (
            <ParentButton label={t(block === 'pairing_needed' ? 'parent.aba.startPairing' : 'parent.aba.start')} onPress={start} testID="aba-start" />
          )}
          {block === 'pairing_needed' && ov?.trainedObserverId && (
            <>
              <ParentButton variant="quiet" label={t('parent.aba.pairingConfirmed')} onPress={() => guarded('aba_pairing_confirm', confirmPairing)} testID="aba-pairing-confirm" />
              <ParentText role="caption" color="textMuted" testID="aba-pairing-confirm-caption">
                {t('parent.aba.pairingConfirmedCaption')}
              </ParentText>
            </>
          )}
        </Card>

        <Card title={t('parent.aba.consentCard')} testID="aba-consent">
          <Row first kind="value" label={t('parent.aba.consentRow')} value={ov ? t(`parent.aba.consentStatus.${ov.consent}`) : ''} onPress={() => router.push('/parent/aba/consent')} testID="aba-consent-row" />
        </Card>

        {hasData && (
          <Card title={t('parent.aba.pause')} testID="aba-pause">
            <Row
              first
              kind="toggle"
              label={t('parent.aba.pauseRow')}
              caption={t('parent.aba.pauseRetention')}
              toggle={ov!.paused}
              onToggle={(v) => (v ? setPaused(true) : guarded('aba_consent', () => setPaused(false)))}
              testID="aba-pause-toggle"
            />
          </Card>
        )}

        {hasData && (
          <Card title={t('parent.aba.specialist')} testID="aba-specialist">
            <Row first kind="link" label={t('parent.aba.exportRow')} onPress={() => guarded('aba_export', () => setExportNote(true))} testID="aba-export" />
            <ParentText role="caption" color="textMuted" testID="aba-export-note">
              {exportNote ? t('parent.aba.exportLater') : t('parent.aba.exportCaption')}
            </ParentText>
          </Card>
        )}

        {hasData && (
          <Card testID="aba-revoke-card">
            <Row first kind="destructive" label={t('parent.aba.revoke')} onPress={() => router.push({ pathname: '/parent/confirm/[action]', params: { action: 'aba_revoke' } })} testID="aba-revoke" />
          </Card>
        )}

        {failure && (
          <ParentText role="caption" color="error" align="center" testID="aba-error">
            {failure}
          </ParentText>
        )}
      </View>
      <ConfirmPinSheet
        visible={pending !== null}
        onCancel={() => setPending(null)}
        onConfirmed={() => {
          const p = pending;
          setPending(null);
          p?.run();
        }}
      />
    </ParentScreen>
  );
}
