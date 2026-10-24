/** Создание профиля ребёнка (дизайн-док §3) — только при действующем `account_local`. */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { parentSpacing } from '../../../src/design/parentTokens';
import type { InterfaceLang } from '../../../src/domain/regionVisibility';
import { newProfile } from '../../../src/services/local/profiles';
import { useAccount } from '../../../src/state/account';
import { useParentView } from '../../../src/state/parentView';
import { ProfileForm, type ProfileDraft } from '../../../src/ui/parent/ProfileForm';
import { ParentButton, ParentScreen, ParentText } from '../../../src/ui/parent/primitives';

export default function NewProfileScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const addProfile = useAccount((s) => s.addProfile);
  const profilesCount = useAccount((s) => s.profiles.length);
  const select = useParentView((s) => s.select);
  const [draft, setDraft] = useState<ProfileDraft>(() => {
    const { childId: _c, createdAt: _d, ...rest } = newProfile({ childId: '', band: '5-6', interfaceLang: i18n.language as InterfaceLang, createdAt: '' });
    return rest;
  });
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  return (
    <ParentScreen title={t('parent.profile.newTitle')} left={profilesCount > 0 ? <ParentButton variant="quiet" label={t('parent.back')} onPress={() => router.back()} block={false} testID="profile-back" /> : undefined} testID="parent-profile-new">
      <ProfileForm draft={draft} onChange={setDraft} />
      <View style={{ height: parentSpacing.sm }} />
      <ParentButton
        label={t('parent.profile.create')}
        disabled={busy}
        onPress={async () => {
          setBusy(true);
          try {
            const p = await addProfile(draft);
            select(p.childId);
            router.dismissAll();
          } catch (e) {
            if (__DEV__) console.warn('profile', e);
            setFailure(t('parent.failed'));
          } finally {
            setBusy(false);
          }
        }}
        testID="profile-create"
      />
      {failure && (
        <ParentText role="caption" color="error" align="center" style={{ marginTop: parentSpacing.sm }} testID="profile-error">
          {failure}
        </ParentText>
      )}
    </ParentScreen>
  );
}
