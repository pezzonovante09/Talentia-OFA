/**
 * Нижний лист «Подтвердите, чтобы изменить» (уровень 2 гейта): свежий PIN с перемешанной
 * клавиатурой поверх любого экрана раздела. Для `gate_now` (удаление аккаунта) — всегда.
 */
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { parentScrim, parentSpacing } from '../../design/parentTokens';
import { checkPin } from '../../services/local/account';
import { sha256 } from '../../services/digest';
import { useAccount } from '../../state/account';
import { device } from '../../state/device';
import { useGate } from '../../state/gate';
import { PinPad } from './PinPad';
import { ParentButton } from './primitives';
import { useParentTheme } from './theme';

export function ConfirmPinSheet({ visible, title, onConfirmed, onCancel }: { visible: boolean; title?: string; onConfirmed: () => void; onCancel: () => void }) {
  const t = useParentTheme();
  const { t: tr } = useTranslation();
  const insets = useSafeAreaInsets();
  const accountId = useAccount((s) => s.accountId);
  const confirm = useGate((s) => s.confirm);
  const touch = useGate((s) => s.touch);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={{ flex: 1, backgroundColor: parentScrim }} onPress={onCancel} accessibilityLabel={tr('parent.cancel')} />
      <View style={{ backgroundColor: t.colors.card, borderTopLeftRadius: t.shape.radius, borderTopRightRadius: t.shape.radius, padding: parentSpacing.lg, paddingBottom: Math.max(insets.bottom, parentSpacing.lg), gap: parentSpacing.lg }} onTouchStart={() => touch()} testID="confirm-pin-sheet">
        <PinPad
          title={title ?? tr('parent.profile.confirmChange')}
          testID="confirm-pin"
          onComplete={async (pin) => {
            if (!accountId) return { result: 'wrong' };
            const r = await checkPin(device(), accountId, pin, { digest: sha256, now: Date.now() });
            if (r.result === 'ok') {
              confirm();
              onConfirmed();
              return { result: 'ok' };
            }
            if (r.result === 'locked') return { result: 'locked', lockedUntil: r.lockedUntil };
            return { result: 'wrong', attemptsLeft: Math.max(0, 5 - r.lockout.failures) };
          }}
        />
        <ParentButton variant="quiet" label={tr('parent.cancel')} onPress={onCancel} testID="confirm-pin-cancel" />
      </View>
    </Modal>
  );
}
