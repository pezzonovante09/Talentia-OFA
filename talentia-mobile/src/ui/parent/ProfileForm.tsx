/**
 * Форма профиля ребёнка (дизайн-док §3, §5): имя в игре (необязательно), полоса сегментами, язык,
 * регион «Кыргызский»; на экране настроек — ещё длительность сессии, вибрация, спокойный режим,
 * фокус и звук. Смена полосы в настройках — через лист подтверждения, если свежести нет.
 */
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import type { InterfaceLang } from '../../domain/regionVisibility';
import type { ChildProfile } from '../../services/local/profiles';
import type { AgeBand } from '../../types/task';
import { Card, Field, Row, Segmented } from './primitives';

export type ProfileDraft = Omit<ChildProfile, 'childId' | 'createdAt'>;

const BANDS: { value: AgeBand; label: string }[] = [
  { value: '5-6', label: '5–6' },
  { value: '7', label: '7' },
  { value: '8', label: '8' },
  { value: '9-10', label: '9–10' },
];
const LANGS: { value: InterfaceLang; label: string }[] = [
  { value: 'ru', label: 'Русский' },
  { value: 'en', label: 'English' },
  { value: 'ky', label: 'Кыргызча' },
];
const MINUTES = [10, 15, 20];

export function ProfileForm({ draft, onChange, extended = false, onBandChange }: { draft: ProfileDraft; onChange: (d: ProfileDraft) => void; extended?: boolean; /** Смена полосы — через подтверждение (настройки). */ onBandChange?: (band: AgeBand) => void }) {
  const { t } = useTranslation();
  const patch = (p: Partial<ProfileDraft>) => onChange({ ...draft, ...p });
  return (
    <View>
      <Card>
        <Field value={draft.name} onChange={(name) => patch({ name })} placeholder={t('parent.profile.nameLabel')} caption={t('parent.profile.nameHint')} testID="profile-name" />
      </Card>
      <Card title={t('parent.profile.band')}>
        <Segmented options={BANDS} value={draft.band} onChange={(band) => (onBandChange ? onBandChange(band) : patch({ band }))} testID="profile-band" />
      </Card>
      <Card title={t('parent.profile.lang')}>
        <Segmented options={LANGS} value={draft.interfaceLang} onChange={(interfaceLang) => patch({ interfaceLang })} testID="profile-lang" />
      </Card>
      <Card>
        <Row kind="toggle" first label={t('parent.profile.kyrgyzRegion')} caption={t('parent.profile.kyrgyzRegionHint')} toggle={draft.kyrgyzRegion} onToggle={(kyrgyzRegion) => patch({ kyrgyzRegion })} testID="profile-kyrgyz" />
      </Card>
      {extended && (
        <>
          <Card title={t('parent.profile.sessionMinutes')}>
            <Segmented options={MINUTES.map((m) => ({ value: String(m), label: t('parent.profile.minutes', { n: m }) }))} value={String(draft.sessionMinutes)} onChange={(v) => patch({ sessionMinutes: Number(v) })} testID="profile-minutes" />
          </Card>
          <Card>
            <Row kind="toggle" first label={t('parent.profile.haptics')} caption={t('parent.profile.hapticsHint')} toggle={draft.hapticsEnabled} onToggle={(hapticsEnabled) => patch({ hapticsEnabled })} testID="profile-haptics" />
            <Row kind="toggle" label={t('parent.profile.calm')} toggle={draft.calmMode} onToggle={(calmMode) => patch({ calmMode })} testID="profile-calm" />
            <Row kind="toggle" label={t('parent.profile.focus')} toggle={draft.focusMode} onToggle={(focusMode) => patch({ focusMode })} testID="profile-focus" />
            <Row kind="toggle" label={t('parent.profile.sound')} caption={t('parent.profile.soundHint')} toggle={draft.soundEffects} onToggle={(soundEffects) => patch({ soundEffects })} testID="profile-sound" />
          </Card>
        </>
      )}
    </View>
  );
}
