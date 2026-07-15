import React from 'react';
import { Modal, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '../Text';
import { Button } from '../Button';
import { useAppTheme } from '../../theme';

export function BreakReminderModal({
  visible,
  breakDurationMinutes,
  onDismiss,
}: {
  visible: boolean;
  breakDurationMinutes: number;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: theme.spacing.xl,
        }}
        onPress={onDismiss}
      >
        <Pressable
          style={{
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radii.lg,
            padding: theme.spacing.xl,
            maxWidth: 320,
          }}
          onPress={(e) => e.stopPropagation()}
        >
          <AppText variant="title" style={{ marginBottom: theme.spacing.sm }}>
            {t('breakReminder.title')}
          </AppText>
          <AppText variant="body" style={{ color: theme.colors.textMuted, marginBottom: theme.spacing.lg }}>
            {t('breakReminder.body', { minutes: breakDurationMinutes })}
          </AppText>
          <Button onPress={onDismiss}>{t('breakReminder.dismiss')}</Button>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
