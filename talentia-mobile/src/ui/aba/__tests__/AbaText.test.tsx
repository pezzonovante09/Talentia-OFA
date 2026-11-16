/**
 * `AbaText` («Тихий кабинет», №203; до него — Nunito, этап F / №176): весь текст ABA — Golos Text. Детская роль
 * (`typography.*`, Nunito) переводится на Golos с прежним кеглем и интерлиньяжем (вес 800 → 700, 700 → 600), роль
 * Golos (`parentTypography`, `abaTypography`) идёт как есть; файл шрифта по весу — `fontFamilyFor`. Цвет — явный;
 * потолок системного масштаба (`max`) и число строк (`lines`) — по месту.
 */
import { StyleSheet } from 'react-native';

import { abaTypeFor, abaTypography } from '../../../design/abaTokens';
import { parentTypography } from '../../../design/parentTokens';
import { typography, type TypeStyle } from '../../../design/tokens';
import { render, screen } from '../../../test/render';
import { fontFamilyFor } from '../../fonts';
import { AbaText } from '../AbaText';

const flat = (testID: string) => StyleSheet.flatten(screen.getByTestId(testID).props.style) as Record<string, unknown>;

describe('AbaText', () => {
  it.each([
    ['parentTypography.body 400', 'GolosText_400Regular', parentTypography.body, '400'],
    ['parentTypography.caption 600', 'GolosText_600SemiBold', parentTypography.caption, '600'],
    ['abaTypography.sheetCaption 500', 'GolosText_500Medium', abaTypography.sheetCaption, '500'],
    ['typography.subtitle (Nunito 700) → Golos 600', 'GolosText_600SemiBold', typography.subtitle, '600'],
    ['typography.title (Nunito 800) → Golos 700', 'GolosText_700Bold', typography.title, '700'],
  ] as const)('%s — загруженный файл %s, кегль и интерлиньяж роли', async (_name, file, type, weight) => {
    await render(
      <AbaText testID="t" type={type} color="#123456" max={1.2}>
        Текст
      </AbaText>,
    );
    expect(fontFamilyFor(abaTypeFor(type))).toBe(file);
    expect(flat('t')).toMatchObject({ fontFamily: file, fontWeight: weight, fontSize: type.size, lineHeight: type.lineHeight });
  });

  it('детские роли в ABA совпадают с abaTypography: тот же кегль, интерлиньяж и вес', () => {
    expect(abaTypeFor(typography.subtitle)).toEqual(abaTypography.subtitle);
    expect(abaTypeFor(typography.title)).toEqual(abaTypography.title);
  });

  it('незагруженный вес Nunito (600) — тоже Golos, а не системный шрифт', async () => {
    const semi: TypeStyle = { ...typography.subtitle, weight: '600' };
    await render(
      <AbaText testID="t" type={semi} color="#123456" max={1}>
        Текст
      </AbaText>,
    );
    expect(flat('t').fontFamily).toBe('GolosText_600SemiBold');
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
    expect(flat('t')).toMatchObject({ textAlign: 'center', color: '#654321', fontFamily: 'GolosText_600SemiBold' });
  });
});
