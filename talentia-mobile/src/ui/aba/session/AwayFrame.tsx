/**
 * Кадр «свёрнуто» (фаза 8, Ц2.11): пустой фон — на возврате кадр строится заново из снимка, прежний не мигает, индикатора
 * нет. Окно сжато и не вмещает раскладку тира (№182) — одна строка взрослому «Верните размер окна».
 */
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { typography } from '../../../design/tokens';
import { AbaText } from '../AbaText';
import { useAbaColors } from '../parts';

export function AwayFrame({ squeezed }: { squeezed: boolean }) {
  const { t } = useTranslation();
  const c = useAbaColors();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }} testID="aba-away">
      {squeezed && (
        <AbaText type={typography.subtitle} color={c.ink} max={1.2} style={{ textAlign: 'center' }} testID="aba-window-squeezed">
          {t('abaScreen.tooSmall.paused')}
        </AbaText>
      )}
    </View>
  );
}
