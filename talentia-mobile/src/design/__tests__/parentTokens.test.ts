/**
 * Контракт тональности взрослого (PARENT.md, «Визуальный язык»; с №203 — «Тихий кабинет»,
 * `docs/design/aba-direction-b-spec-2026-11-16.md`).
 */
import { contrast, SHAPE_CONTRAST, TEXT_CONTRAST } from '../contrast';
import {
  buildParentTheme,
  parentButton,
  parentColors,
  parentFontScaleMax,
  parentHeader,
  parentPressed,
  parentShape,
  parentTypography,
  REGION_INK_SURFACE,
  touchAdult,
} from '../parentTokens';
import { fontFamilyFor, FONT_FILES } from '../../ui/fonts';
import { palettes, touch, type RegionId, type Scheme } from '../tokens';

const SCHEMES: Scheme[] = ['light', 'dark'];
const REGIONS: RegionId[] = ['numbers', 'words', 'nature', 'workshop', 'kyrgyz'];

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

    it(`${scheme}: чернила объявлены для всех регионов схемы курса, включая кыргызский`, () => {
      expect(Object.keys(c.regionsInk).sort()).toEqual([...REGIONS].sort());
    });

    it(`${scheme}: кыргызские чернила — не детская заливка региона`, () => {
      const kidFills = new Set<string>();
      (['normal', 'calm'] as const).forEach((v) =>
        (['light', 'dark'] as const).forEach((s) => kidFills.add(palettes[s][v].regions.kyrgyz.toUpperCase())),
      );
      expect(kidFills.has(c.regionsInk.kyrgyz.toUpperCase())).toBe(false);
    });
  });

  it('чернила — только на карточке: правило композиции, а не обход контраста', () => {
    // Раньше правило держалось на контрасте: «Числа» #8C6A03 давали на фоне 4.46. После
    // А25 детские чернила затемнены и проходят и на фоне — правило остаётся композиционным.
    expect(REGION_INK_SURFACE).toBe('card');
    SCHEMES.forEach((scheme) => {
      const c = parentColors[scheme];
      REGIONS.forEach((r) => expect(contrast(c.regionsInk[r], c.background)).toBeGreaterThanOrEqual(TEXT_CONTRAST));
    });
  });

  // Прежнее правило «та же бумага без теплоты» (фон раздела ≈ детскому) снято решением №203: «Тихий кабинет» —
  // холодная нейтраль, а не детская бумага. Взамен — контракт кабинета ниже.
});

describe('«Тихий кабинет» (№203)', () => {
  const c = parentColors.light;

  it('значения светлой схемы — по спецификации', () => {
    expect(c).toMatchObject({
      background: '#F4F6F5',
      card: '#FFFFFF',
      text: '#1E2A2F',
      textMuted: '#55656B',
      primary: '#1D6B66',
      onPrimary: '#FFFFFF',
      hairline: '#C9D2CF',
      edge: '#6F7E84',
      blockWhere: '#DDEDE6',
      blockExplain: '#DCE8F2',
      blockRule: '#FBE7D3',
      zone: '#E2E8E6',
      error: '#BB1E1E',
    });
    expect(parentPressed.light).toMatchObject({ card: '#E6EBE9', primary: '#15524E' });
  });

  SCHEMES.forEach((scheme) => {
    const s = parentColors[scheme];

    it(`${scheme}: кромка edge ≥ 3:1 к фону, к карточке и к листу zone — граница кнопки видна без заливки`, () => {
      [s.background, s.card, s.zone].forEach((bg) => expect(contrast(s.edge, bg)).toBeGreaterThanOrEqual(SHAPE_CONTRAST));
    });

    it(`${scheme}: текст, приглушённый текст и ссылка-действие читаются на каждом блоке и на листе`, () => {
      [s.blockWhere, s.blockExplain, s.blockRule, s.zone].forEach((bg) => {
        expect(contrast(s.text, bg)).toBeGreaterThanOrEqual(TEXT_CONTRAST);
        expect(contrast(s.textMuted, bg)).toBeGreaterThanOrEqual(TEXT_CONTRAST);
      });
      [s.blockWhere, s.blockExplain, s.blockRule].forEach((bg) => expect(contrast(s.primary, bg)).toBeGreaterThanOrEqual(TEXT_CONTRAST));
    });

    it(`${scheme}: подпись на листе взрослого (text на zone) ≥ 7:1 — условие UX`, () => {
      expect(contrast(s.text, s.zone)).toBeGreaterThanOrEqual(7);
    });

    it(`${scheme}: нажатое состояние читается — текст на нажатой карточке, подпись на нажатой кнопке`, () => {
      const p = parentPressed[scheme];
      expect(contrast(s.text, p.card)).toBeGreaterThanOrEqual(TEXT_CONTRAST);
      expect(contrast(s.onPrimary, p.primary)).toBeGreaterThanOrEqual(TEXT_CONTRAST);
      expect(contrast(s.onError, p.error)).toBeGreaterThanOrEqual(TEXT_CONTRAST);
    });
  });

  it('hairline — группировка, а не граница: слабее кромки', () => {
    expect(contrast(c.hairline, c.card)).toBeLessThan(contrast(c.edge, c.card));
  });

  it('блоки различимы между собой и с фоном — тон несёт роль блока, а не украшает', () => {
    const fills = [c.background, c.card, c.blockWhere, c.blockExplain, c.blockRule, c.zone].map((x) => x.toUpperCase());
    expect(new Set(fills).size).toBe(fills.length);
  });
});

describe('чем раздел непривлекателен для ребёнка', () => {
  it('ни одного жёлтого пикселя и ни одной заливки региона', () => {
    const kidLoud = new Set<string>();
    (['light', 'dark'] as const).forEach((s) =>
      (['normal', 'calm'] as const).forEach((v) => {
        const p = palettes[s][v];
        [p.accent, ...Object.values(p.regions)].forEach((x) => kidLoud.add(x.toUpperCase()));
      }),
    );
    SCHEMES.forEach((scheme) => {
      const c = parentColors[scheme];
      [c.background, c.card, c.hairline, c.edge, c.text, c.textMuted, c.primary, c.error, c.blockWhere, c.blockExplain, c.blockRule, c.zone].forEach((x) =>
        expect(kidLoud.has(x.toUpperCase())).toBe(false),
      );
    });
  });

  it('ни контура, ни подушки; радиус кнопки 16, блока 24, кромка 1.5 (№203)', () => {
    expect([parentShape.outline, parentShape.cushion]).toEqual([0, 0]);
    expect([parentShape.radius, parentShape.blockRadius, parentShape.edge]).toEqual([16, 24, 1.5]);
  });

  it('Golos Text во всех ролях, только загруженные начертания; числа табличными цифрами', () => {
    Object.values(parentTypography).forEach((t) => {
      expect(t.family).toBe('Golos Text');
      // пара «семейство + вес» есть среди загруженных файлов — без подстановки ближайшего веса
      expect(fontFamilyFor(t)).toBe(`GolosText_${{ '400': '400Regular', '500': '500Medium', '600': '600SemiBold', '700': '700Bold', '800': '' }[t.weight]}`);
      expect(Object.keys(FONT_FILES)).toContain(fontFamilyFor(t));
    });
    expect(parentTypography.number.tabularNums).toBe(true);
  });

  it('веса по спецификации: заголовки 700, кнопки и подписи 600, текст 400; кегли прежних ролей не менялись', () => {
    expect(parentTypography.heading).toMatchObject({ size: 24, lineHeight: 30, weight: '700' });
    expect(parentTypography.body).toMatchObject({ size: 16, lineHeight: 22, weight: '400' });
    expect(parentTypography.caption).toMatchObject({ size: 14, lineHeight: 20, weight: '600' });
    expect(parentTypography.label).toMatchObject({ size: 16, lineHeight: 22, weight: '600' });
    expect(parentTypography.number).toMatchObject({ size: 32, lineHeight: 36 });
    expect(parentTypography.title).toMatchObject({ size: 19, lineHeight: 24, weight: '700' });
    expect(parentTypography.stage).toMatchObject({ size: 13, lineHeight: 16, weight: '600' });
    expect(parentTypography.screen).toMatchObject({ size: 21, weight: '700' });
    expect(parentFontScaleMax.stage).toBe(1.1);
    expect(parentFontScaleMax.number).toBe(1);
  });

  it('кнопка 52, главная 56, шапка 56 — не ниже зоны нажатия взрослого', () => {
    expect(parentButton.height).toBe(52);
    expect(parentButton.mainHeight).toBe(56);
    expect(parentHeader).toBe(56);
    [parentButton.height, parentButton.mainHeight].forEach((h) => expect(h).toBeGreaterThanOrEqual(touchAdult));
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
