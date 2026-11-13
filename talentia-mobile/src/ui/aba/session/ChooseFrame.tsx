/**
 * Кадр выбора подкрепителя 2.3 (Ц3.0): строка 72 — выход слева, заголовок по центру, справа место под повтор; ниже карточки
 * выбора. Что выбрано и что дальше — решает экран сессии.
 */
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useChildT } from '../../../i18n';
import { abaInstruction } from '../../../design/abaTokens';
import { typography } from '../../../design/tokens';
import { AbaText } from '../AbaText';
import type { ChoiceRun } from '../model/reinforcerChoiceRun';
import { NonTrialRow, useAbaColors } from '../parts';
import { ReinforcerChoiceView } from '../reinforcer';

export function ChooseFrame(o: { run: ChoiceRun; options: string[]; cardSize: number; boardCells: number; onTap: (id: string, at: number) => void; onAdultTap: (id: string) => void }) {
  const { t } = useTranslation();
  const childT = useChildT();
  const c = useAbaColors();
  return (
    <View style={{ flex: 1, paddingHorizontal: 16 }}>
      <NonTrialRow exitLabel={t('abaSession.exit')} exitHint={t('abaSession.exitHint')}>
        {/* строка `NonTrialRow` 60: 2 × 30 = 60 без роста шрифта, длинное ужимается (`design-lead`, этап F) */}
        <AbaText type={typography.subtitle} color={c.ink} max={1} lines={abaInstruction.lines} adjustsFontSizeToFit style={{ textAlign: 'center' }}>
          {childT('abaSession.chooseTitle')}
        </AbaText>
      </NonTrialRow>
      <View style={{ height: 16 }} />
      <ReinforcerChoiceView run={o.run} options={o.options} cardSize={o.cardSize} boardCells={o.boardCells} pulse={false} onTap={o.onTap} onAdultTap={o.onAdultTap} />
    </View>
  );
}
