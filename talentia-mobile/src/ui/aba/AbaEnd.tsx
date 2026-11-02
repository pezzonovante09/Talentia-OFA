/**
 * Конец занятия (раздел 9): обычный — Tali `hello`, «Закончили на сегодня», доска как есть, «Готово»; нейтральный
 * (остановка, бездействие, ошибка согласия или паузы) — без Tali, доска статично (Ц2.10: видно, что жетоны целы).
 * Похвалы, итогов и чисел нет. `doneEnabled: false` — «Готово» ждёт цикла сопряжения: взрослый не кончит первую
 * сессию раньше, чем ребёнок что-то получит.
 */
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { ABA_CONTROL_STROKE, abaTokenBoard } from '../../design/abaTokens';
import { radii, touch } from '../../design/tokens';
import { TaliFigure } from '../TaliFigure';
import { ExitHold, useAbaColors } from './parts';
import { TokenCell } from './reinforcer';

export function AbaEnd({
  variant,
  board,
  doneEnabled = true,
  onExit,
  onDone,
}: {
  variant: 'normal' | 'neutral';
  board?: { cells: number; filled: number };
  doneEnabled?: boolean;
  /** Пока «Готово» ждёт цикла, у взрослого остаётся выход удержанием: системный «назад» в сессии перехвачен. */
  onExit?: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const c = useAbaColors();
  return (
    <View style={{ flex: 1, paddingHorizontal: 16 }} testID={`aba-end-${variant}`}>
      <View style={{ height: 72, flexDirection: 'row', alignItems: 'flex-start', paddingTop: 6 }}>
        {!doneEnabled && onExit && <ExitHold onExit={onExit} label={t('abaSession.exit')} hintLabel={t('abaSession.exitHint')} />}
      </View>
      {variant === 'normal' && (
        <View style={{ marginTop: 48, alignItems: 'center' }}>
          <TaliFigure pose="hello" size={88} crop accessibilityLabel={t('abaSession.tali')} />
        </View>
      )}
      <Text style={{ color: c.ink, fontSize: 26, lineHeight: 36, fontWeight: '700', textAlign: 'center', marginTop: variant === 'normal' ? 16 : 48 }} numberOfLines={2} accessibilityRole="header">
        {t('abaSession.endedToday')}
      </Text>
      {board && board.cells > 0 && (
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: abaTokenBoard.gap, marginTop: 24 }} testID="aba-end-board">
          {Array.from({ length: board.cells }, (_, i) => (
            <TokenCell key={i} size={abaTokenBoard.size} filled={i < board.filled} />
          ))}
        </View>
      )}
      <View style={{ flex: 1 }} />
      <Pressable
        onPress={onDone}
        disabled={!doneEnabled}
        testID="aba-end-done"
        accessibilityRole="button"
        accessibilityState={{ disabled: !doneEnabled }}
        style={{ height: touch.primary, marginBottom: 16, borderRadius: radii.lg, borderWidth: ABA_CONTROL_STROKE, borderColor: c.controlInk, backgroundColor: c.reinforcement, alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={{ color: c.onReinforcement, fontSize: 22, fontWeight: '700' }}>{t('abaSession.done')}</Text>
      </Pressable>
    </View>
  );
}
