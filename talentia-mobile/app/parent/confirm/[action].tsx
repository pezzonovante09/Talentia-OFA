/**
 * Подтверждение разрушительного действия (дизайн-док §7): один шаблон на три действия, кнопка с
 * текстом действия, затем свежий PIN на листе (окно 5 минут здесь не действует — решение владельца
 * 2026-10-25). Очистка — `clearChildProgress`; профиль — `deleteChildEverywhere`; аккаунт —
 * `wipeAccountEverywhere` + файл базы; скачок часов (№147) — `confirmClockJump` по дате с листа.
 */
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { parentSpacing } from '../../../src/design/parentTokens';
import { uuidV4 } from '../../../src/domain/ids';
import { deleteChildEverywhere, finishDeviceWipe, wipeAccountEverywhere } from '../../../src/services/local/deleteEverywhere';
import { WIPE_PENDING_KEY } from '../../../src/services/local/device';
import { deleteLocalDb } from '../../../src/services/local/expoSqlite';
import { buildTime } from '../../../src/services/local/buildInfo';
import { clearChildProgress, confirmClockJump, runRetention, StaleClockConfirmationError } from '../../../src/services/local/purge';
import { randomBytes } from '../../../src/services/random';
import { useAccount } from '../../../src/state/account';
import { useChildSession } from '../../../src/state/childSession';
import { device } from '../../../src/state/device';
import { useGate } from '../../../src/state/gate';
import { useParentView, useSelectedProfile } from '../../../src/state/parentView';
import { ConfirmPinSheet } from '../../../src/ui/parent/ConfirmPinSheet';
import { Card, ParentButton, ParentScreen, ParentText } from '../../../src/ui/parent/primitives';

type Action = 'clear_progress' | 'delete_child' | 'delete_account' | 'clock_jump';
const KEYS: Record<Action, { title: string; body: string; button: string }> = {
  clear_progress: { title: 'parent.data.confirmClearTitle', body: 'parent.data.confirmClearBody', button: 'parent.data.clearProgress' },
  delete_child: { title: 'parent.data.confirmChildTitle', body: 'parent.data.confirmChildBody', button: 'parent.data.deleteChild' },
  delete_account: { title: 'parent.data.confirmAccountTitle', body: 'parent.data.confirmAccountBody', button: 'parent.data.deleteAccount' },
  clock_jump: { title: 'parent.clock.title', body: 'parent.clock.body', button: 'parent.clock.confirm' },
};

export default function ConfirmScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { action } = useLocalSearchParams<{ action: string }>();
  const account = useAccount();
  const profile = useSelectedProfile();
  const profiles = useAccount((s) => s.profiles);
  const select = useParentView((s) => s.select);
  const lock = useGate((s) => s.lock);
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  if (!action || !(action in KEYS)) return <Redirect href="/parent/data" />;
  // Без аккаунта сюда можно попасть только по ссылке (не во время удаления — тогда `busy`).
  if (account.status === 'none' && !busy) return <Redirect href="/parent/setup" />;
  const kind = action as Action;
  const hold = account.retentionHold;
  if (kind === 'clock_jump' && !hold) return <Redirect href="/parent" />;
  const keys = KEYS[kind];
  const idx = profile ? profiles.findIndex((p) => p.childId === profile.childId) : -1;
  const name = profile ? profile.name || t('parent.profile.unnamed', { n: idx + 1 }) : '';
  const day = (iso: string) => new Date(iso).toLocaleDateString(i18n.language === 'en' ? 'en-GB' : 'ru-RU');
  const vars = hold ? { name, device: day(hold.deviceNow), last: day(hold.lastSeen), n: hold.wouldRemove, aba: hold.abaGoalsChildren } : { name };
  // нечего удалять — подтверждение не разрушительное (child-privacy-compliance 2026-10-25)
  const nothingToRemove = kind === 'clock_jump' && hold !== null && hold.wouldRemove === 0 && hold.abaGoalsChildren === 0;

  const recheck = async () => {
    const { db } = account;
    if (!db) return;
    const again = await runRetention(db, { deviceNow: new Date(), builtAt: buildTime() });
    if (again.kind === 'applied') {
      account.clearRetentionHold();
      router.back();
    } else {
      useAccount.setState({ retentionHold: again });
      setFailure(t('parent.clock.stillAhead'));
    }
  };

  const perform = async () => {
    const { db, accountId } = account;
    if (!db || !accountId) return;
    setBusy(true);
    try {
      if (kind === 'clear_progress' && profile) {
        await clearChildProgress(db, profile.childId);
        if (useChildSession.getState().childId === profile.childId) useChildSession.getState().reset();
        router.back();
      } else if (kind === 'delete_child' && profile) {
        await deleteChildEverywhere({ db, device: device(), childId: profile.childId, pseudonym: uuidV4(randomBytes), deliverRevocation: async () => true, accountId });
        if (useChildSession.getState().childId === profile.childId) useChildSession.getState().reset();
        await account.refreshProfiles();
        select(useAccount.getState().profiles[0]?.childId ?? '');
        router.replace('/parent');
      } else if (kind === 'clock_jump' && hold) {
        try {
          await confirmClockJump(db, { observedNow: hold.deviceNow, deviceNow: new Date(), builtAt: buildTime() });
          account.clearRetentionHold();
          router.back();
        } catch (e) {
          if (!(e instanceof StaleClockConfirmationError)) throw e;
          // часы снова изменились, пока лист был открыт — пересчитать и показать заново
          const again = await runRetention(db, { deviceNow: new Date(), builtAt: buildTime() });
          useAccount.setState({ retentionHold: again.kind === 'held' ? again : null });
          setFailure(t('parent.clock.stale'));
        }
      } else if (kind === 'delete_account') {
        await wipeAccountEverywhere({ db, device: device(), accountId, deleteDbFile: () => deleteLocalDb(accountId), deliverRevocations: async () => true });
        // Сначала переход: гейт при `status: 'none'` держит открытыми только setup/policy/done.
        router.replace('/parent/done');
        useChildSession.getState().reset();
        account.clear();
        lock();
      }
    } catch (e) {
      if (__DEV__) console.warn('confirm', e);
      // удаление аккаунта уже началось (метка стоит): довести, сколько выйдет, и закрыть вход — данные,
      // приговорённые к удалению, не пишутся; остаток доведёт следующий старт (№148, child-privacy-compliance)
      if (kind === 'delete_account' && (await device().getItem(WIPE_PENDING_KEY)) !== null) {
        await finishDeviceWipe(device(), account.accountId).catch(() => undefined);
        router.replace('/parent/done');
        useChildSession.getState().reset();
        account.clear();
        lock();
        return;
      }
      setFailure(t('parent.failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ParentScreen left={<ParentButton variant="quiet" label={t('parent.back')} onPress={() => router.back()} block={false} testID="confirm-back" />} testID={`parent-confirm-${kind}`}>
      <View style={{ gap: parentSpacing.lg, flex: 1, paddingTop: parentSpacing.xl }}>
        <ParentText role="heading" accessibilityRole="header">
          {t(keys.title, vars)}
        </ParentText>
        <Card>
          <ParentText role="body">{t(keys.body, vars)}</ParentText>
          {kind === 'clock_jump' && hold !== null && hold.abaGoalsChildren > 0 && <ParentText role="body">{t('parent.clock.abaGoals', vars)}</ParentText>}
          {kind !== 'clear_progress' && kind !== 'clock_jump' && (
            <ParentText role="caption" color="textMuted">
              {t('parent.data.remains')}
            </ParentText>
          )}
        </Card>
        <View style={{ flex: 1 }} />
        <ParentButton
          variant={nothingToRemove ? 'primary' : 'destructive'}
          label={busy ? t('parent.data.working') : t(nothingToRemove ? 'parent.clock.confirmNothing' : keys.button)}
          disabled={busy}
          onPress={() => setSheet(true)}
          testID="confirm-action"
        />
        {kind === 'clock_jump' && <ParentButton variant="secondary" label={t('parent.clock.recheck')} disabled={busy} onPress={() => void recheck()} testID="clock-recheck" />}
        {failure && (
          <ParentText role="caption" color="error" align="center" testID="confirm-error">
            {failure}
          </ParentText>
        )}
        <ParentButton variant="secondary" label={t('parent.cancel')} onPress={() => router.back()} testID="confirm-cancel" />
      </View>
      <ConfirmPinSheet
        visible={sheet}
        title={t('parent.data.pinRequired')}
        onCancel={() => setSheet(false)}
        onConfirmed={() => {
          setSheet(false);
          void perform();
        }}
      />
    </ParentScreen>
  );
}
