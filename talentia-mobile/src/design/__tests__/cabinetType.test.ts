/**
 * Golos Text в «Тихом кабинете» (№203, `docs/design/aba-direction-b-spec-2026-11-16.md` п. «б», «ж»): высота строки
 * каждой роли не режет Й и Ё на Android, в начертаниях есть русский алфавит, у роли `number` есть табличные цифры.
 * Метрики — прямо из TTF пакета `@expo-google-fonts/golos-text` (`src/test/fontMetrics.ts`), не из константы:
 * обновится шрифт — проверка пересчитается сама.
 */
import { readFileSync } from 'fs';

import { abaTypography, type AbaTypeStyle } from '../abaTokens';
import { parentTypography } from '../parentTokens';
import { androidLineNeed, fontFile, hasGlyph, inkBox, lineMetrics } from '../../test/fontMetrics';
import { fontFamilyFor, FONT_FILES, type LoadedFont } from '../../ui/fonts';

const ROLES: [string, AbaTypeStyle][] = [
  ...Object.entries(parentTypography).map(([k, v]): [string, AbaTypeStyle] => [`parentTypography.${k}`, v]),
  ...Object.entries(abaTypography).map(([k, v]): [string, AbaTypeStyle] => [`abaTypography.${k}`, v]),
];
const TEXT_ROLES = ROLES.filter(([name]) => name !== 'parentTypography.number');
const GOLOS = (Object.keys(FONT_FILES) as LoadedFont[]).filter((f) => f.startsWith('GolosText_'));
const RU = 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдеёжзийклмнопрстуфхцчшщъыьэюя';

describe('Golos Text: высота строки не режет верх знаков на Android', () => {
  it('все роли кабинета — на загруженном Golos Text', () => {
    ROLES.forEach(([, t]) => expect(GOLOS).toContain(fontFamilyFor(t)));
  });

  it.each(TEXT_ROLES)('%s: lineHeight ≥ ceil(size × (верх чернил Й/Ё + descender hhea))', (_name, t) => {
    expect(t.lineHeight).toBeGreaterThanOrEqual(androidLineNeed(fontFamilyFor(t), t.size, 'ЙЁ'));
  });

  it('parentTypography.number: строка вмещает цифры (букв в роли нет — только числа недели)', () => {
    const t = parentTypography.number;
    expect(t.lineHeight).toBeGreaterThanOrEqual(androidLineNeed(fontFamilyFor(t), t.size, '0123456789'));
  });

  it.each(GOLOS)('%s: выносные вниз (у, р, ф, Щ, Д, Ц) не глубже descender — низ строки не режется', (font) => {
    const { descender } = lineMetrics(font);
    [...'урфЩДЦ'].forEach((ch) => expect(-inkBox(font, ch).yMin).toBeLessThanOrEqual(descender + 1e-9));
  });
});

describe('Golos Text: знаки и цифры', () => {
  it.each(GOLOS)('%s содержит русский алфавит с Ё и Й', (font) => {
    expect([...RU].filter((ch) => !hasGlyph(font, ch))).toEqual([]);
  });

  it('табличные цифры: в начертании роли number есть фича tnum', () => {
    const t = parentTypography.number;
    expect(t.tabularNums).toBe(true);
    expect(readFileSync(fontFile(fontFamilyFor(t))).includes('tnum', 0, 'latin1')).toBe(true);
  });
});
