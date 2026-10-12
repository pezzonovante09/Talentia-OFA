/**
 * Контракт дизайн-системы. Тест существует, чтобы цвет нельзя было поменять,
 * не пересчитав контраст: в прошлой версии приложения состояния различались
 * одной лишь прозрачностью, а тёмная тема включалась только вместе со
 * спокойным режимом — оба дефекта прошли незамеченными до аудита.
 */
import {
  buildTheme,
  countMark,
  countSizes,
  cushionByRole,
  digitGroup,
  groupDigits,
  INK_SURFACES,
  lessonTiming,
  mapBackdrop,
  mapLayout,
  motion,
  numeralOption,
  palettes,
  pressFeedback,
  pressScale,
  spacing,
  symbolGlyph,
  symbolGlyphMaxFontMultiplier,
  touch,
  type ColorTokens,
  type RegionId,
  type Scheme,
} from '../tokens';
import { contrast, luminance } from '../contrast';

/** Все регионы схемы курса (`Region['id']`), включая кыргызский (А17). */
const REGIONS: RegionId[] = ['numbers', 'words', 'nature', 'workshop', 'kyrgyz'];
const SCHEMES: Scheme[] = ['light', 'dark'];
const VARIANTS: (keyof (typeof palettes)['light'])[] = ['normal', 'calm'];

/** Текст обязан читаться: 4.5:1. */
const TEXT = 4.5;

describe('контраст палитр', () => {
  SCHEMES.forEach((scheme) => {
    VARIANTS.forEach((variant) => {
      describe(`${scheme} / ${variant}`, () => {
        const c: ColorTokens = palettes[scheme][variant];

        it('основной и вторичный текст читаются на фоне', () => {
          expect(contrast(c.text, c.background)).toBeGreaterThanOrEqual(TEXT);
          expect(contrast(c.textMuted, c.background)).toBeGreaterThanOrEqual(TEXT);
        });

        it('основной и вторичный текст читаются на всех поверхностях', () => {
          // вторичный раньше проверялся только на фоне — и в тёмной схеме на карточке
          // давал 3.93:1, не проходя там, где его и кладут
          [c.surface, c.surfaceAlt, c.surfaceSunken].forEach((bg) => {
            expect(contrast(c.text, bg)).toBeGreaterThanOrEqual(TEXT);
            expect(contrast(c.textMuted, bg)).toBeGreaterThanOrEqual(TEXT);
          });
        });

        it('чернильные варианты акцентов читаются на каждой поверхности, а не только на фоне', () => {
          // А25: прежние чернила проходили к фону и давали 3.7:1 на surfaceSunken
          INK_SURFACES.forEach((surface) => {
            [c.primaryInk, c.secondaryInk, c.accentInk, c.successInk, c.error].forEach((ink) => {
              expect(contrast(ink, c[surface])).toBeGreaterThanOrEqual(TEXT);
            });
          });
        });

        it('текст на цветных заливках читается', () => {
          const pairs: [string, string][] = [
            [c.onPrimary, c.primary],
            [c.onSecondary, c.secondary],
            [c.onAccent, c.accent],
            [c.onSuccess, c.success],
            [c.onError, c.error],
          ];
          pairs.forEach(([fg, bg]) => {
            expect(contrast(fg, bg)).toBeGreaterThanOrEqual(TEXT);
          });
        });

        it('текст читается на заливке каждого региона', () => {
          // Именно onRegion, а не text: в светлой схеме поверх заливки лежит
          // тёмный текст, в тёмной — светлый, и совпадение с text случайно.
          REGIONS.forEach((region) => {
            expect(contrast(c.onRegion, c.regions[region])).toBeGreaterThanOrEqual(TEXT);
          });
        });

        it('чернила региона читаются на фоне, карточке, surfaceAlt и surfaceSunken', () => {
          INK_SURFACES.forEach((surface) => {
            REGIONS.forEach((region) => {
              expect(contrast(c.regionsInk[region], c[surface])).toBeGreaterThanOrEqual(TEXT);
            });
          });
        });

        it('палитра регионов объявляет ровно регионы схемы курса', () => {
          expect(Object.keys(c.regions).sort()).toEqual([...REGIONS].sort());
          expect(Object.keys(c.regionsInk).sort()).toEqual([...REGIONS].sort());
        });

        it('кыргызский регион не спутать с ошибкой и вниманием по яркости', () => {
          // Тон 340° против 0–9° у error/secondary; плюс яркость не ближе 1.4:1 —
          // это то, что остаётся при дейтеранопии (комментарий к regions.kyrgyz).
          expect(contrast(c.regions.kyrgyz, c.error)).toBeGreaterThanOrEqual(1.4);
          expect(contrast(c.regions.kyrgyz, c.secondary)).toBeGreaterThanOrEqual(1.4);
        });

        it('контур различим на фоне и на поверхностях', () => {
          [c.background, c.surface, c.surfaceAlt].forEach((bg) => {
            expect(contrast(c.outline, bg)).toBeGreaterThanOrEqual(3);
          });
        });

        it('разделитель различим на фоне', () => {
          expect(contrast(c.border, c.background)).toBeGreaterThanOrEqual(1.5);
        });

        it('регионы различимы между собой, а не только по названию', () => {
          const seen = REGIONS.map((r) => c.regions[r]);
          expect(new Set(seen).size).toBe(REGIONS.length);
        });
      });
    });
  });
});

describe('размеры зон нажатия', () => {
  it('минимум не опускается ниже детского порога', () => {
    expect(touch.min).toBeGreaterThanOrEqual(60);
    expect(touch.comfortable).toBeGreaterThanOrEqual(touch.min);
    expect(touch.primary).toBeGreaterThanOrEqual(touch.comfortable);
  });

  it('зазор между целями не меньше 16 pt', () => {
    expect(touch.gap).toBeGreaterThanOrEqual(16);
  });
});

describe('шкала отступов', () => {
  it('лежит на сетке 4 pt', () => {
    Object.values(spacing).forEach((value) => {
      expect(value % 4).toBe(0);
    });
  });

  it('возрастает', () => {
    const values = [
      spacing.xs,
      spacing.sm,
      spacing.md,
      spacing.lg,
      spacing.xl,
      spacing.xxl,
      spacing.xxxl,
    ];
    values.forEach((v, i) => {
      if (i > 0) expect(v).toBeGreaterThan(values[i - 1]);
    });
  });
});

describe('сборка темы', () => {
  it('тёмная схема не зависит от спокойного режима', () => {
    // Старая тема включала тёмные цвета только при calmMode && dark,
    // из-за чего ребёнок с системной тёмной темой получал светлый фон.
    const dark = buildTheme({ scheme: 'dark', calmMode: false, focusMode: false });
    const light = buildTheme({ scheme: 'light', calmMode: false, focusMode: false });
    expect(dark.colors.background).not.toBe(light.colors.background);
    expect(luminance(dark.colors.background)).toBeLessThan(luminance(light.colors.background));
  });

  it('фокус-режим не масштабирует кегли', () => {
    // Множитель 1.2 в старой теме переполнял блоки на длинной кыргызской строке.
    const plain = buildTheme({ scheme: 'light', calmMode: false, focusMode: false });
    const focused = buildTheme({ scheme: 'light', calmMode: false, focusMode: true });
    expect(focused.typography.title.size).toBe(plain.typography.title.size);
    expect(focused.typography.body.size).toBe(plain.typography.body.size);
  });

  it('фокус-режим разрежает интерфейс, а не уплотняет', () => {
    const plain = buildTheme({ scheme: 'light', calmMode: false, focusMode: false });
    const focused = buildTheme({ scheme: 'light', calmMode: false, focusMode: true });
    expect(focused.density).toBe('roomy');
    expect(focused.spacing.lg).toBeGreaterThan(plain.spacing.lg);
  });

  it('спокойный режим смягчает подушку и контур', () => {
    const plain = buildTheme({ scheme: 'light', calmMode: false, focusMode: false });
    const calm = buildTheme({ scheme: 'light', calmMode: true, focusMode: false });
    expect(calm.elevation.raised.offsetY).toBeLessThan(plain.elevation.raised.offsetY);
    expect(calm.stroke.base).toBeLessThan(plain.stroke.base);
  });

  it('обе схемы объявляют один и тот же набор токенов', () => {
    const keys = (c: ColorTokens) => Object.keys(c).sort().join(',');
    expect(keys(palettes.dark.normal)).toBe(keys(palettes.light.normal));
    expect(keys(palettes.dark.calm)).toBe(keys(palettes.light.calm));
  });

  it('спокойный режим гасит и чернила регионов, а не только заливки', () => {
    // А25: тёмная calm-схема наследовала насыщенные чернила обычной
    SCHEMES.forEach((scheme) => {
      REGIONS.forEach((r) => {
        expect(palettes[scheme].calm.regionsInk[r]).not.toBe(palettes[scheme].normal.regionsInk[r]);
      });
    });
  });
});

describe('подушка и отклик (решения №10, №68, №69)', () => {
  it('подушка у вариантов, управления и «разложен»; Tali, пузырь, стимул и жетоны плоские', () => {
    expect(cushionByRole.answerOption).toBe('raised');
    expect(cushionByRole.control).toBe('raised');
    expect(cushionByRole.groupPlaced).toBe('raised');
    expect([cushionByRole.tali, cushionByRole.bubble, cushionByRole.stimulus, cushionByRole.abaToken]).toEqual([
      'flat',
      'flat',
      'flat',
      'flat',
    ]);
  });

  it('отклик плоского нажимаемого не дольше 100 мс', () => {
    expect(motion.press).toBeGreaterThan(0);
    expect(motion.press).toBeLessThanOrEqual(100);
  });

  it('calm и обычный режим сжимают одинаково; calm добавляет только гаптику (№69, Р12)', () => {
    const plain = pressFeedback({ calmMode: false });
    const calm = pressFeedback({ calmMode: true });
    expect(calm.scale).toEqual(plain.scale);
    expect(calm.durationMs).toBe(plain.durationMs);
    expect(plain.haptic).toBe('none');
    expect(calm.haptic).toBe('light');
    expect(pressScale.tali).toBeLessThanOrEqual(0.96);
    expect(pressScale.mapNode).toBeLessThanOrEqual(0.96);
    expect(pressScale.wide).toBeLessThanOrEqual(0.98);
    expect(pressScale).not.toHaveProperty('calm');
  });
});

describe('правило перевода в тёмную схему (Р8)', () => {
  (['normal', 'calm'] as const).forEach((variant) => {
    it(`dark / ${variant}: текст и глифы на цветных заливках — цвет фона, не белый`, () => {
      const c = palettes.dark[variant];
      [c.onPrimary, c.onSecondary, c.onAccent, c.onSuccess, c.onError].forEach((on) => expect(on).toBe(c.background));
      // белое на этих заливках не проходит — именно поэтому правило перевода «#FFFFFF → #1B1410»
      [c.primary, c.secondary, c.accent, c.success, c.error].forEach((fill) => {
        expect(contrast(c.onPrimary, fill)).toBeGreaterThanOrEqual(4.5);
      });
    });
  });

  it('dark: белый глиф на success и error не проходит порог — прежние 2.13 и 2.77', () => {
    const c = palettes.dark.normal;
    expect(contrast('#FFFFFF', c.success)).toBeLessThan(3);
    expect(contrast('#FFFFFF', c.error)).toBeLessThan(3);
  });

  it('подложка под картинкой: контур предмета #2A1A12 различим в обеих схемах, calm её не меняет', () => {
    SCHEMES.forEach((scheme) => {
      expect(contrast('#2A1A12', palettes[scheme].normal.picturePlate)).toBeGreaterThanOrEqual(3);
      expect(palettes[scheme].calm.picturePlate).toBe(palettes[scheme].normal.picturePlate);
    });
    // на тёмной карточке тот же контур исчезает — поэтому подложка светлая
    expect(contrast('#2A1A12', palettes.dark.normal.surface)).toBeLessThan(3);
  });
});

describe('карта региона (решение №89, Р9)', () => {
  it('панорама — только светлая обычная; тёмная — сплошной регион; calm — песок и полоса', () => {
    expect(mapBackdrop({ scheme: 'light', calmMode: false })).toBe('panorama');
    expect(mapBackdrop({ scheme: 'dark', calmMode: false })).toBe('flat_region');
    expect(mapBackdrop({ scheme: 'light', calmMode: true })).toBe('sand_strip');
    expect(mapBackdrop({ scheme: 'dark', calmMode: true })).toBe('sand_strip');
  });

  it('тёмная карта: контур горизонта, тропы и узлов и текст шапки читаются на каждой заливке региона', () => {
    const c = palettes.dark.normal;
    (Object.keys(c.regions) as RegionId[]).forEach((r) => {
      expect(contrast(c.outline, c.regions[r])).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c.onRegion, c.regions[r])).toBeGreaterThanOrEqual(4.5);
    });
  });

  it('ориентир региона не меньше 64, узел 72 с расстоянием между центрами ≥ 88', () => {
    expect(mapLayout.landmarkMin).toBeGreaterThanOrEqual(64);
    expect(mapLayout.node).toBe(touch.comfortable);
    expect(mapLayout.nodeGapMin).toBeGreaterThanOrEqual(mapLayout.node + touch.gap);
  });
});

describe('счёт на 5–6 (SCREENS.md 3.8)', () => {
  it('метка «сосчитано»: точка 12 в кольце 2, цвета фиксированы и контрастны друг другу', () => {
    expect(countMark.dot).toBe(12);
    expect(countMark.ring).toBe(2);
    expect(contrast(countMark.dotColor, countMark.ringColor)).toBeGreaterThanOrEqual(7);
    // шаг фигур ≥ 44: радиус 32 перекрывает соседей (32 > 22), поэтому правило одно — ближайшая
    expect(countMark.snapRadius).toBe(32);
    expect(countMark.snapRadius).toBeGreaterThan(countSizes.stepMin / 2);
    expect(countMark.snapRule).toBe('nearest');
  });

  it('знак в карточке-символе не растёт с системным шрифтом', () => {
    expect(symbolGlyphMaxFontMultiplier).toBe(1);
  });

  it('ответ из 5+ цифр показывается с тонким пробелом и помещается в поле на SE', () => {
    expect(groupDigits('1234')).toBe('1234');
    expect(groupDigits('12345')).toBe('12 345');
    expect(groupDigits('1234567')).toBe('1 234 567');
    expect(groupDigits('abc')).toBe('abc');
    // 7 цифр title 28 табличные ≈ 17.4 + два разделителя в поле W − 16 = 327 (SE)
    expect(7 * 17.4 + 2 * digitGroup.gap).toBeLessThanOrEqual(343 - 16);
  });

  it('кучка в плитке: поле = две ячейки шага плюс фигура; фигура ≥ 24, шаг ≥ 28, ≤ 3 в ряд, ≤ 5 фигур', () => {
    expect(countSizes.tileFigure).toBeGreaterThanOrEqual(24);
    expect(countSizes.tileStep).toBeGreaterThanOrEqual(28);
    expect(countSizes.tileStep * (countSizes.tileMaxPerRow - 1) + countSizes.tileFigure).toBe(countSizes.tileField);
    expect(countSizes.tileMaxFigures).toBeLessThanOrEqual(5);
  });

  it('карточка-число: поле 88 и цифра 64 в плитке 103.7×112 с запасом', () => {
    // поля по бокам считаются от внешнего края плитки (контур 3 входит в 7.85 на SE)
    expect(numeralOption.plate).toBeLessThanOrEqual(103.7);
    expect(numeralOption.plate + 2 * 12).toBeLessThanOrEqual(112);
    expect(numeralOption.digit).toBeLessThan(numeralOption.plate);
  });

  it('знак символа: самое длинное слово из 4 знаков помещается в поле 88 (ширина ≈ 0.65 кегля на знак)', () => {
    ([1, 2, 3, 4] as const).forEach((n) => {
      expect(n * symbolGlyph[n] * 0.65).toBeLessThanOrEqual(numeralOption.plate);
    });
    expect(symbolGlyph[1]).toBe(numeralOption.digit);
    expect(symbolGlyph[4]).toBeGreaterThanOrEqual(32);
  });

  it('защита «Дальше» короче разблокировки', () => {
    expect(lessonTiming.nextGuard).toBeGreaterThan(0);
    expect(lessonTiming.nextGuard).toBeLessThan(lessonTiming.nextUnlock);
  });
});
