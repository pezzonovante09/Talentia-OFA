/**
 * Лист «Кто ведёт» на родительской стороне (этап G1, вопрос 59; перенесён из детского 2.6, `docs/design/parent-aba-2026-11-01.md`).
 * Только выбирает роль и «обучен» — занятие запускает кнопка карточки, поэтому в шапке «Готово», а не «Начать».
 * Блокировки 500 мс от касания (`abaWhoLeadsAccepts`) здесь нет: она защищала лист от пальцев ребёнка под ним,
 * а за PIN первый тап взрослого пропадать не должен (`child-ux-specialist`). Имени у наблюдателя нет нигде.
 * Раскладка §2.6 сохранена: шапка 48 · 16 · heading · слот caption 20 (резерв всегда — шапка не прыгает) · три строки
 * 56 · строка-переключатель 56 · 24 (`abaWhoLeadsSheet.blocks`).
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { abaWhoLeadsSheet } from '../../design/abaTokens';
import { parentScrim, parentSpacing } from '../../design/parentTokens';
import type { AbaObserver } from '../../types/aba';
import { ParentButton, ParentText, Row } from './primitives';
import { useParentTheme } from './theme';

export const WHO_LEADS_ROLES: readonly AbaObserver['role'][] = ['specialist', 'parent', 'other_adult'];

export type WhoLeadsChoice = { role: AbaObserver['role']; trained: boolean };

export function WhoLeadsSheet({
  visible,
  initial,
  fromLastTime,
  reasonRequired = false,
  onDone,
  onBack,
}: {
  visible: boolean;
  /** Текущий выбор карточки (предвыбор прошлой сессии или уже отмеченный в этот раз). */
  initial: WhoLeadsChoice | null;
  /** Предвыбор взят из прошлой сессии — подпись «Как в прошлый раз». */
  fromLastTime: boolean;
  /** Лист открыт нажатием «Начать» при «Не выбрано» — подпись-причина вместо «Как в прошлый раз». */
  reasonRequired?: boolean;
  onDone: (choice: WhoLeadsChoice) => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const theme = useParentTheme();
  const insets = useSafeAreaInsets();
  const [role, setRole] = useState<AbaObserver['role'] | null>(initial?.role ?? null);
  const [trained, setTrained] = useState(initial?.trained ?? false);
  const caption = reasonRequired ? t('parent.aba.whoLeadsReason') : fromLastTime && initial ? t('abaSession.asLastTime') : '';
  const { blocks } = abaWhoLeadsSheet;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onBack}>
      <Pressable style={{ flex: 1, backgroundColor: parentScrim }} onPress={onBack} accessibilityLabel={t('abaSession.back')} testID="aba-who-scrim" />
      <View
        testID="aba-who-leads"
        style={{
          backgroundColor: theme.colors.card,
          borderTopLeftRadius: theme.shape.radius,
          borderTopRightRadius: theme.shape.radius,
          paddingHorizontal: parentSpacing.lg,
          paddingTop: blocks.pad,
          paddingBottom: blocks.bottom + insets.bottom,
        }}
      >
        <View style={{ height: blocks.header, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: blocks.gapAfterHeader }}>
          <ParentButton variant="quiet" block={false} label={t('abaSession.back')} onPress={onBack} testID="aba-who-back" />
          <ParentButton block={false} minWidth={abaWhoLeadsSheet.startMinWidth} label={t('parent.aba.done')} disabled={role === null} onPress={() => role && onDone({ role, trained })} testID="aba-who-done" />
        </View>
        <ParentText role="heading" accessibilityRole="header">
          {t('abaSession.whoLeads')}
        </ParentText>
        <View style={{ height: blocks.caption, marginTop: blocks.gapCaption, marginBottom: blocks.gapRows, justifyContent: 'center' }}>
          {caption ? (
            <ParentText role="caption" color="textMuted" lines={1} testID="aba-who-caption">
              {caption}
            </ParentText>
          ) : null}
        </View>
        {WHO_LEADS_ROLES.map((r, i) => (
          <Row key={r} first={i === 0} kind="link" selected={role === r} label={t(`abaSession.role.${r}`)} onPress={() => setRole(r)} testID={`aba-role-${r}`} />
        ))}
        <Row kind="toggle" label={t('abaSession.trained')} toggle={trained} onToggle={setTrained} testID="aba-trained" />
      </View>
    </Modal>
  );
}
