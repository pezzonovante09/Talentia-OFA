/**
 * Конец занятия (раздел 9, Ц3.8): обычный — Tali `hello`, «Закончили на сегодня», доска как есть, «Готово»; нейтральный
 * (остановка, бездействие, ошибка согласия или паузы) — без Tali, доска статично (Ц2.10: видно, что жетоны целы).
 * Похвалы, итогов и чисел нет. Экран показывается один раз — после цикла сопряжения (Ц3.2), неактивной «Готово» нет.
 * «Готово» — детская кнопка с картой: касание, начатое раньше `abaEndDone.lockMs` от показа кадра, не засчитывается
 * (продолжающиеся тапы по сцене не попадают в «Готово»). Выхода удержанием на этом кадре нет.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { abaEndDone, abaNonTrialRow, abaTokenBoard, ABA_CONTROL_STROKE } from '../../design/abaTokens';
import { radii } from '../../design/tokens';
import { TaliFigure } from '../TaliFigure';
import { useAbaClock } from './clock';
import { ChildPressable, PlaceholderGlyph, useAbaColors } from './parts';
import { TokenCell } from './reinforcer';

export function AbaEnd({ variant, board, onDone }: { variant: 'normal' | 'neutral'; board?: { cells: number; filled: number }; onDone: () => void }) {
  const { t } = useTranslation();
  const c = useAbaColors();
  const clock = useAbaClock();
  // кадр показан сейчас: блокировка «Готово» считается от него
  const [shownAt] = useState(() => clock.now());
  const d = abaEndDone;
  return (
    <View style={{ flex: 1, paddingHorizontal: 16 }} testID={`aba-end-${variant}`}>
      <View style={{ height: abaNonTrialRow.height }} />
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
      <ChildPressable
        frameShownAt={shownAt + d.lockMs}
        onCommit={onDone}
        testID="aba-end-done"
        accessibilityLabel={t('abaSession.done')}
        style={{
          height: d.height,
          marginBottom: 16,
          borderRadius: radii.lg,
          borderWidth: ABA_CONTROL_STROKE,
          borderColor: c.controlInk,
          backgroundColor: c.reinforcement,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: d.gap,
        }}
      >
        <PlaceholderGlyph name="map" size={d.glyphSize} color={c.onReinforcement} cut={c.reinforcement} />
        <Text style={{ color: c.onReinforcement, fontSize: 22, fontWeight: '700' }} numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.2}>
          {t('abaSession.done')}
        </Text>
      </ChildPressable>
    </View>
  );
}
