/**
 * Кадр выбора подкрепителя 2.3 (Ц3.0): строка 72 — выход слева, заголовок по центру, справа место под повтор; ниже карточки
 * выбора. Что выбрано и что дальше — решает экран сессии.
 */
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import type { ChoiceRun } from '../model/reinforcerChoiceRun';
import { NonTrialRow, useAbaColors } from '../parts';
import { ReinforcerChoiceView } from '../reinforcer';

export function ChooseFrame(o: { run: ChoiceRun; options: string[]; cardSize: number; boardCells: number; onTap: (id: string, at: number) => void; onAdultTap: (id: string) => void }) {
  const { t } = useTranslation();
  const c = useAbaColors();
  return (
    <View style={{ flex: 1, paddingHorizontal: 16 }}>
      <NonTrialRow exitLabel={t('abaSession.exit')} exitHint={t('abaSession.exitHint')}>
        <Text style={{ color: c.ink, fontSize: 22, lineHeight: 30, fontWeight: '700', textAlign: 'center' }} numberOfLines={2} maxFontSizeMultiplier={1.2}>
          {t('abaSession.chooseTitle')}
        </Text>
      </NonTrialRow>
      <View style={{ height: 16 }} />
      <ReinforcerChoiceView run={o.run} options={o.options} cardSize={o.cardSize} boardCells={o.boardCells} pulse={false} onTap={o.onTap} onAdultTap={o.onAdultTap} />
    </View>
  );
}
