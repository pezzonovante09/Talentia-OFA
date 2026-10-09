/**
 * Контракт дизайн-системы. Тест существует, чтобы цвет нельзя было поменять,
 * не пересчитав контраст: в прошлой версии приложения состояния различались
 * одной лишь прозрачностью, а тёмная тема включалась только вместе со
 * спокойным режимом — оба дефекта прошли незамеченными до аудита.
 */
import {
  buildTheme,
  cushionByRole,
  INK_SURFACES,
  motion,
  palettes,
  spacing,
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
});
