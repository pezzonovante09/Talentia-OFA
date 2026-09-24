/**
 * Контракт родительской тональности (PARENT.md, «Визуальный язык»).
 */
import { contrast, SHAPE_CONTRAST, TEXT_CONTRAST } from '../contrast';
import {
  buildParentTheme,
  parentColors,
  parentShape,
  parentTypography,
  REGION_INK_SURFACE,
  touchAdult,
} from '../parentTokens';
import { palettes, touch, type RegionId, type Scheme } from '../tokens';

const SCHEMES: Scheme[] = ['light', 'dark'];
const REGIONS: RegionId[] = ['numbers', 'words', 'nature', 'logic'];

describe('контраст родительского раздела', () => {
  SCHEMES.forEach((scheme) => {
    const c = parentColors[scheme];

    it(`${scheme}: основной и вторичный текст читаются на фоне и на карточке`, () => {
      [c.background, c.card].forEach((bg) => {
        expect(contrast(c.text, bg)).toBeGreaterThanOrEqual(TEXT_CONTRAST);
        expect(contrast(c.textMuted, bg)).toBeGreaterThanOrEqual(TEXT_CONTRAST);
      });
    });

    it(`${scheme}: кнопка различима на фоне и на карточке, текст на ней читается`, () => {
      [c.background, c.card].forEach((bg) => expect(contrast(c.primary, bg)).toBeGreaterThanOrEqual(SHAPE_CONTRAST));
      expect(contrast(c.onPrimary, c.primary)).toBeGreaterThanOrEqual(TEXT_CONTRAST);
      expect(contrast(c.onError, c.error)).toBeGreaterThanOrEqual(TEXT_CONTRAST);
      expect(contrast(c.error, c.card)).toBeGreaterThanOrEqual(TEXT_CONTRAST);
    });

    it(`${scheme}: предметные чернила читаются на карточке`, () => {
      REGIONS.forEach((r) => expect(contrast(c.regionsInk[r], c.card)).toBeGreaterThanOrEqual(TEXT_CONTRAST));
    });
  });

  it('чернила — только на карточке: на фоне «Числа» не проходят на сотых', () => {
    expect(REGION_INK_SURFACE).toBe('card');
    const light = parentColors.light;
    expect(contrast(light.regionsInk.numbers, light.background)).toBeLessThan(TEXT_CONTRAST);
  });

  it('та же бумага без теплоты: фон раздела почти не отличается от детского', () => {
    const ratio = contrast(parentColors.light.background, palettes.light.normal.background);
    expect(ratio).toBeLessThan(1.1);
    expect(parentColors.light.background).not.toBe(palettes.light.normal.background);
  });
});

describe('чем раздел непривлекателен для ребёнка', () => {
  it('ни одного жёлтого пикселя и ни одной заливки региона', () => {
    const kidLoud = new Set<string>();
    (['light', 'dark'] as const).forEach((s) =>
      (['normal', 'calm'] as const).forEach((v) => {
        const p = palettes[s][v];
        [p.accent, p.accentInk, ...Object.values(p.regions)].forEach((x) => kidLoud.add(x.toUpperCase()));
      }),
    );
    SCHEMES.forEach((scheme) => {
      const c = parentColors[scheme];
      [c.background, c.card, c.hairline, c.text, c.textMuted, c.primary, c.error].forEach((x) =>
        expect(kidLoud.has(x.toUpperCase())).toBe(false),
      );
    });
  });

  it('ни контура, ни подушки, один радиус', () => {
    expect([parentShape.outline, parentShape.cushion, parentShape.radius]).toEqual([0, 0, 12]);
  });

  it('только Nunito, числа табличными цифрами', () => {
    Object.values(parentTypography).forEach((t) => expect(t.family).toBe('Nunito'));
    expect(parentTypography.number.tabularNums).toBe(true);
  });
});

describe('зона нажатия взрослого', () => {
  it('отдельный токен: детский минимум не понижается', () => {
    expect(touchAdult).toBe(48);
    expect(touch.min).toBe(60);
    expect(touchAdult).toBeGreaterThanOrEqual(44);
  });
});

describe('сборка темы раздела', () => {
  it('спокойный и фокус-режим сюда не проходят — у сборки нет таких параметров', () => {
    expect(buildParentTheme.length).toBe(1);
    expect(buildParentTheme('light').colors).toBe(parentColors.light);
  });

  it('обе схемы объявляют один и тот же набор токенов', () => {
    expect(Object.keys(parentColors.dark).sort()).toEqual(Object.keys(parentColors.light).sort());
  });
});
