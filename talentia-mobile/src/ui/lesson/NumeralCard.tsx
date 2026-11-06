/**
 * Содержимое карточки-числа и немой карточки (SCREENS.md 3.8, 3.8.1): поле `numeralOption.plate` 88,
 * знак Nunito 800 `symbolGlyph` по числу символов (один на все карточки задания), цвет `text`, без
 * внутреннего контура. Системный шрифт не масштабируется (`fixed`).
 */
import { View } from 'react-native';

import { useDesign } from '../../design';
import { numeralOption, symbolGlyph } from '../../design/tokens';
import { AppText } from '../AppText';

export function glyphSizeFor(maxChars: number): number {
  const n = Math.min(4, Math.max(1, maxChars)) as 1 | 2 | 3 | 4;
  return symbolGlyph[n];
}

export function NumeralCard({ text, maxChars = text.length, testID }: { text: string; maxChars?: number; testID?: string }) {
  const theme = useDesign();
  const size = glyphSizeFor(maxChars);
  return (
    <View style={{ width: numeralOption.plate, height: numeralOption.plate, alignItems: 'center', justifyContent: 'center' }} testID={testID}>
      <AppText role="label" cap="fixed" style={{ fontSize: size, lineHeight: size * 1.15, fontFamily: 'Nunito_800ExtraBold', color: theme.colors.text }}>
        {text}
      </AppText>
    </View>
  );
}
