/**
 * `AbaText` (этап F, №176): роль задаёт файл Nunito по весу (`fontFamilyFor` — загружены только 400/700/800), кегль и
 * интерлиньяж; цвет — явный; потолок системного масштаба (`max`) и число строк (`lines`) — по месту.
 */
import { StyleSheet } from 'react-native';

import { parentTypography } from '../../../design/parentTokens';
import { typography, type TypeStyle } from '../../../design/tokens';
import { render, screen } from '../../../test/render';
import { fontFamilyFor } from '../../fonts';
import { AbaText } from '../AbaText';

const flat = (testID: string) => StyleSheet.flatten(screen.getByTestId(testID).props.style) as Record<string, unknown>;

describe('AbaText', () => {
  it.each([
    ['400', 'Nunito_400Regular', parentTypography.body],
    ['700', 'Nunito_700Bold', typography.subtitle],
    ['800', 'Nunito_800ExtraBold', typography.title],
  ] as const)('вес %s — загруженный файл %s, кегль и интерлиньяж роли', async (_w, file, type) => {
    await render(
      <AbaText testID="t" type={type} color="#123456" max={1.2}>
        Текст
      </AbaText>,
    );
    expect(fontFamilyFor(type)).toBe(file);
    expect(flat('t')).toMatchObject({ fontFamily: file, fontWeight: type.weight, fontSize: type.size, lineHeight: type.lineHeight });
  });

  it('незагруженный вес — ближайший загруженный файл, а не системный шрифт', async () => {
    const semi: TypeStyle = { ...typography.subtitle, weight: '600' };
    await render(
      <AbaText testID="t" type={semi} color="#123456" max={1}>
        Текст
      </AbaText>,
    );
    expect(flat('t').fontFamily).toBe('Nunito_700Bold');
  });

  it('цвет — из пропа, без цвета детской темы', async () => {
    await render(
      <AbaText testID="t" type={typography.subtitle} color="#0A7F5A" max={1.2}>
        Текст
      </AbaText>,
    );
    expect(flat('t').color).toBe('#0A7F5A');
  });

  it('max → maxFontSizeMultiplier, lines → numberOfLines', async () => {
    await render(
      <AbaText testID="t" type={typography.subtitle} color="#123456" max={1.3} lines={2}>
        Текст
      </AbaText>,
    );
    const { props } = screen.getByTestId('t');
    expect([props.maxFontSizeMultiplier, props.numberOfLines]).toEqual([1.3, 2]);
  });

  it('без lines число строк не ограничено', async () => {
    await render(
      <AbaText testID="t" type={typography.subtitle} color="#123456" max={1}>
        Текст
      </AbaText>,
    );
    expect(screen.getByTestId('t').props.numberOfLines).toBeUndefined();
  });

  it('style дополняет роль и идёт после неё', async () => {
    await render(
      <AbaText testID="t" type={typography.subtitle} color="#123456" max={1} style={{ textAlign: 'center', color: '#654321' }}>
        Текст
      </AbaText>,
    );
    expect(flat('t')).toMatchObject({ textAlign: 'center', color: '#654321', fontFamily: 'Nunito_700Bold' });
  });
});
