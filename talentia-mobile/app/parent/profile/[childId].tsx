/** Настройки ребёнка (дизайн-док §5): сохраняются сразу; смена полосы — через подтверждение PIN. */
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAccount } from '../../../src/state/account';
import { useGate } from '../../../src/state/gate';
import type { AgeBand } from '../../../src/types/task';
import { ConfirmPinSheet } from '../../../src/ui/parent/ConfirmPinSheet';
import { ProfileForm, type ProfileDraft } from '../../../src/ui/parent/ProfileForm';
import { ParentButton, ParentScreen } from '../../../src/ui/parent/primitives';

export default function ChildSettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const profile = useAccount((s) => s.profiles.find((p) => p.childId === childId));
  const updateProfile = useAccount((s) => s.updateProfile);
  const can = useGate((s) => s.can);
  const [pendingBand, setPendingBand] = useState<AgeBand | null>(null);

  if (!profile) return <Redirect href="/parent" />;
  const draft: ProfileDraft = profile;
  const save = (d: ProfileDraft) => void updateProfile({ ...profile, ...d });

  return (
    <ParentScreen title={t('parent.profile.settings')} left={<ParentButton variant="quiet" label={t('parent.back')} onPress={() => router.back()} block={false} testID="settings-back" />} right={<ParentButton variant="quiet" label={t('parent.done')} onPress={() => router.dismissAll()} block={false} testID="settings-done" />} testID="parent-settings">
      <ProfileForm
        draft={draft}
        onChange={save}
        extended
        onBandChange={(band) => {
          if (band === profile.band) return;
          if (can('change_band')) save({ ...draft, band });
          else setPendingBand(band);
        }}
      />
      <ConfirmPinSheet
        visible={pendingBand !== null}
        onCancel={() => setPendingBand(null)}
        onConfirmed={() => {
          if (pendingBand) save({ ...draft, band: pendingBand });
          setPendingBand(null);
        }}
      />
    </ParentScreen>
  );
}
