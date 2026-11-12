/**
 * Карточка-символ: цифра, буква, слог и немая карточка (SCREENS.md 3.8, 3.8.1; буква и слог — `design-lead`, этап D2 по
 * аудиту 2026-11-09). Знак Nunito 800 цветом `text`, без внутреннего контура, без декора и анимации — в calm и focus
 * такой же. Кегль один на все карточки задания: формат считает его `symbolFontSize` по самому широкому знаку и ширине
 * и высоте плитки; без него — ступень `symbolGlyph` по числу знаков (атлас). Высота строки — натуральная высота
 * шрифта (`glyphCard.lineHeightRatio`), чтобы Й, Ё и хвост Ң не обрезались; одна строка, системный шрифт не
 * масштабирует (`fixed`). Рамка — по плитке (`boxW` × `boxH`), а не поле 88: кегль считается от поля на `inset`
 * меньше рамки, этот запас и `ellipsizeMode="clip"` не дают округлению ширины на Android показать «М…». `shift` —
 * общий сдвиг знаков задания вниз (`symbolShift`, №192): середина чернил задания в середине карточки; без него (атлас)
 * знак стоит по середине строки.
 */
import { View } from 'react-native';

import { useDesign } from '../../design';
import { glyphCard, numeralOption, symbolGlyph } from '../../design/tokens';
import { AppText } from '../AppText';

export function glyphSizeFor(maxChars: number): number {
  const n = Math.min(4, Math.max(1, maxChars)) as 1 | 2 | 3 | 4;
  return symbolGlyph[n];
}

export function NumeralCard({
  text,
  size,
  boxW,
  boxH,
  shift,
  testID,
}: {
  text: string;
  size?: number;
  boxW?: number;
  boxH?: number;
  shift?: number;
  testID?: string;
}) {
  const theme = useDesign();
  const fontSize = size ?? glyphSizeFor([...text].length);
  return (
    <View style={{ width: boxW ?? numeralOption.plate, height: boxH ?? numeralOption.plate, alignItems: 'center', justifyContent: 'center' }} testID={testID}>
      <AppText
        role="label"
        cap="fixed"
        lines={1}
        ellipsizeMode="clip"
        style={{
          fontSize,
          lineHeight: Math.ceil(fontSize * glyphCard.lineHeightRatio),
          fontFamily: 'Nunito_800ExtraBold',
          color: theme.colors.text,
          includeFontPadding: false,
          textAlignVertical: 'center',
          ...(shift ? { transform: [{ translateY: shift }] } : null),
        }}
      >
        {text}
      </AppText>
    </View>
  );
}
