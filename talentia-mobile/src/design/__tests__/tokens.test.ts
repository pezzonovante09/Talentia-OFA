/**
 * Контракт дизайн-системы. Тест существует, чтобы цвет нельзя было поменять,
 * не пересчитав контраст: в прошлой версии приложения состояния различались
 * одной лишь прозрачностью, а тёмная тема включалась только вместе со
 * спокойным режимом — оба дефекта прошли незамеченными до аудита.
 */
import {
  atlasTabTap,
  bubblePadY,
  buildTheme,
  childSoundToggle,
  fitRegionTitle,
  fitStickerTitle,
  isQuantityOrder,
  mapSettingsButton,
  mapTaliTap,
  mapTitle,
  mapTitleWidth,
  orderEmptyPlaceTap,
  orderFirstPlaceCue,
  orderMark,
  orderMarkFor,
  selectedRepeatPress,
  selectedRepeatTravel,
  typography,
  countMark,
  countSizes,
  cushionByRole,
  digitGroup,
  emptyOutlineColor,
  groupDigits,
  helpTaliButton,
  INK_SURFACES,
  lessonFontCaps,
  lessonTextAnswer,
  lessonTiming,
  listeningCue,
  mapBackdrop,
  mapFocus,
  mapLayout,
  modeToggleCue,
  motion,
  numeralOption,
  palettes,
  pointMiss,
  pointZone,
  pressFeedback,
  pressScale,
  progressSegment,
  selectedStroke,
  spacing,
  stroke,
  symbolGlyph,
  symbolGlyphMaxFontMultiplier,
  taliArt,
  taliCrop,
  taliIdleTap,
  taliSatchelRule,
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

  it('calm и обычный режим сжимают одинаково; гаптика только по настройке родителя, calm её не добавляет', () => {
    const plain = pressFeedback({ calmMode: false });
    const calm = pressFeedback({ calmMode: true });
    expect(calm.scale).toEqual(plain.scale);
    expect(calm.durationMs).toBe(plain.durationMs);
    expect(plain.haptic).toBe('none');
    expect(calm.haptic).toBe('none');
    expect(pressFeedback({ calmMode: true, hapticsEnabled: true }).haptic).toBe('light');
    expect(pressFeedback({ hapticsEnabled: true }).haptic).toBe('light');
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

  it('ориентир не читается как кнопка: отклик 0.96 как у узла без подушки, без звука и действия; форма — не круг узла (У-8)', () => {
    expect(mapLayout.landmarkTap.scale).toBe(pressScale.mapNode);
    expect(mapLayout.landmarkTap.durationMs).toBe(motion.press);
    expect(mapLayout.landmarkTap.sound).toBe(false);
    expect(mapLayout.landmarkTap.action).toBe('none');
    expect(mapLayout.landmarkPlate).toBe('arch');
  });

  it('ориентир: 64 во всех видах, в calm стоит на песке; верх панорамы 64 pt без деталей (Г7)', () => {
    expect(mapLayout.titleZone).toBe(64);
    // calm — единственный вид без панорамы-носителя ориентира на карте
    expect(mapBackdrop({ scheme: 'light', calmMode: true })).toBe('sand_strip');
  });

  it('текст шапки #2A1A12 на заливке региона светлой схемы ≥ 4.5 — зона 64 pt без деталей держит этот контраст', () => {
    const c = palettes.light.normal;
    (Object.keys(c.regions) as RegionId[]).forEach((r) => {
      expect(contrast(c.onRegion, c.regions[r])).toBeGreaterThanOrEqual(TEXT);
    });
  });
});

describe('рабочие остатки раунда 3 (V1, V4, V5, V6, V2/V3)', () => {
  SCHEMES.forEach((scheme) =>
    VARIANTS.forEach((variant) => {
      const c = palettes[scheme][variant];

      it(`${scheme}/${variant}: пройденный сегмент прогресса — не primary, контур 3 держит границу (V1)`, () => {
        expect(progressSegment.done.fill).toBe('surfaceAlt');
        expect(progressSegment.done.fill).not.toBe('primary');
        expect(stroke[progressSegment.done.stroke]).toBe(3);
        expect(contrast(c.outline, c[progressSegment.done.fill])).toBeGreaterThanOrEqual(3);
      });

      it(`${scheme}/${variant}: пунктир «пусто» (${emptyOutlineColor}) различим на заливке заглушки ≥ 3 (V6)`, () => {
        expect(contrast(c[emptyOutlineColor], c.surfaceSunken)).toBeGreaterThanOrEqual(3);
        expect(contrast(c[emptyOutlineColor], c.background)).toBeGreaterThanOrEqual(3);
      });

      it(`${scheme}/${variant}: значок «волны» подсветки читается на surfaceAlt ≥ 3 (V5)`, () => {
        expect(listeningCue.fill).toBe('surfaceAlt');
        expect(contrast(c.outline, c.surfaceAlt)).toBeGreaterThanOrEqual(3);
      });
    }),
  );

  it('прежний пунктир border на заливке заглушки не проходил — регрессия V6', () => {
    expect(contrast(palettes.light.normal.border, palettes.light.normal.surfaceSunken)).toBeLessThan(3);
    expect(contrast(palettes.dark.normal.border, palettes.dark.normal.surfaceSunken)).toBeLessThan(3);
  });

  it('подсветка при перечислении: контур не меняется, движения нет; она не «ждёт» и не «выбрано»', () => {
    expect(listeningCue.outlineChanges).toBe(false);
    expect(listeningCue.animated).toBe(false);
    expect(listeningCue.badge).toBe(24);
    expect(listeningCue.badge).toBeLessThan(touch.min); // ненажимаемый значок, а не цель
  });

  it('цвет контура «выбрано»: primary в уроке и на карте; onRegion в атласе; outline в ABA (V4, раунд 4)', () => {
    expect(selectedStroke.lesson).toBe('primary');
    expect(selectedStroke.map).toBe('primary');
    expect(selectedStroke.atlas).toBe('onRegion');
    expect(selectedStroke.aba).toBe('outline');
    SCHEMES.forEach((scheme) => {
      const c = palettes[scheme].normal;
      // фиолетовый контур 6 различим на карточке в обеих схемах (тёмная — самая слабая пара, 5.05)
      expect(contrast(c[selectedStroke.lesson], c.surface)).toBeGreaterThanOrEqual(3);
      expect(contrast(c[selectedStroke.aba], c.surface)).toBeGreaterThanOrEqual(3);
    });
  });

  SCHEMES.forEach((scheme) =>
    VARIANTS.forEach((variant) => {
      it(`${scheme}/${variant}: контур «выбрано» на табе атласа ≥ 3 против заливки каждого региона (раунд 4)`, () => {
        const c = palettes[scheme][variant];
        REGIONS.forEach((r) => {
          expect(contrast(c[selectedStroke.atlas], c.regions[r])).toBeGreaterThanOrEqual(3);
        });
      });
    }),
  );

  it('регрессия: прежний primary на табах атласа падал ниже 3 хотя бы на одной заливке региона', () => {
    const worst = Math.min(
      ...SCHEMES.flatMap((s) => VARIANTS.flatMap((v) => {
        const c = palettes[s][v];
        return REGIONS.map((r) => contrast(c.primary, c.regions[r]));
      })),
    );
    expect(worst).toBeLessThan(3);
  });

  it('метка «сосчитано»: отклик ≤ 100 мс от касания вниз; повтор — кольцо 2→6, держится 300 мс после отпускания; мимо — пунктирное кольцо 64 без звука (V2, V3, I-2, раунд 4)', () => {
    expect(countMark.feedbackMs).toBeLessThanOrEqual(100);
    expect(countMark.feedbackTrigger).toBe('touch_down');
    expect(countMark.repeatRing).toEqual({
      from: 2,
      to: 6,
      durationMs: motion.press,
      shownUntil: 'touch_up',
      tailMs: 300,
      shape: 'mark_ring_solid',
      sound: false,
      haptic: 'parentSetting',
      peakOutline: { width: 2, color: '#2A1A12' },
    });
    expect(countMark.repeatRing.from).toBe(countMark.ring);
    expect(countMark.repeatRing.durationMs).toBe(90);
    expect(countMark.missRing.shownUntil).toBe('touch_up');
    // второй цикл UX: знак промаха держится столько же, сколько отклик повтора
    expect(countMark.missRing.tailMs).toBe(300);
    expect(countMark.missRing.tailMs).toBe(countMark.repeatRing.tailMs);
    expect(countMark.missRing.size).toBeGreaterThanOrEqual(64);
    expect(countMark.missRing.sound).toBe(false);
    expect(countMark.missRing.records).toBe(false);
    // один радиус привязки во всех документах: 32 (в DESIGN_PROMPTS.md и SCREENS.md не должно остаться 24)
    expect(countMark.snapRadius).toBe(32);
  });

  it('повтор по сосчитанной фигуре заметен без вибрации: элемент ≥ 48 вокруг фигуры ИЛИ ≥ 300 мс после отпускания; форма не как у промаха; без звука (раунд 4)', () => {
    const r = countMark.repeatRing;
    const outer = countMark.dot + 2 * r.to; // диаметр метки на пике отклика
    expect(outer >= 48 || r.tailMs >= 300).toBe(true);
    expect(r.tailMs).toBeGreaterThanOrEqual(300);
    expect(r.shownUntil).toBe('touch_up');
    expect(r.shape).not.toBe(countMark.missRing.shape);
    expect(r.sound).toBe(false);
    // отклик растёт заметно: метка 16 → 24 pt (было 16 → 20)
    expect(outer - (countMark.dot + 2 * r.from)).toBeGreaterThanOrEqual(8);
    // метка на пике остаётся внутри фигуры стимула 40 — соседей не задевает
    expect(outer).toBeLessThanOrEqual(countSizes.figureStimulus);
  });

  it('вибрация на повторе — только по настройке родителя (№112): по умолчанию её нет ни в одном режиме', () => {
    expect(countMark.repeatRing.haptic).toBe('parentSetting');
    expect(countMark.repeatRing.haptic).not.toBe('light');
    expect(pressFeedback({}).haptic).toBe('none');
    expect(pressFeedback({ calmMode: true }).haptic).toBe('none');
    expect(pressFeedback({ hapticsEnabled: true }).haptic).toBe('light');
  });

  it('знак промаха — пунктирное кольцо 64, контур 3, штрих 8 / просвет 6, textMuted светлой схемы, зафиксированный (раунд 4, UX)', () => {
    const m = countMark.missRing;
    expect(m).toMatchObject({ size: 64, stroke: 3, shape: 'dashed_ring', dash: 8, gap: 6 });
    // раунд 5, М3: поля «роли цвета» нет — цвет зафиксирован, тема его не подменяет
    expect(m).not.toHaveProperty('colorRole');
    expect(m.color).toBe(palettes.light.normal.textMuted);
    // слой иллюстрации: знак виден на подложке картинки в обеих схемах
    SCHEMES.forEach((scheme) => {
      expect(contrast(m.color, palettes[scheme].normal.picturePlate)).toBeGreaterThanOrEqual(3);
      expect(contrast(m.color, palettes[scheme].calm.picturePlate)).toBeGreaterThanOrEqual(3);
    });
    // почему цвет зафиксирован: тёмный textMuted на светлой подложке не проходит
    expect(contrast(palettes.dark.normal.textMuted, palettes.dark.normal.picturePlate)).toBeLessThan(3);
    // пунктир читается: на окружности 64 помещается не меньше десяти штрихов
    expect(Math.floor((Math.PI * m.size) / (m.dash + m.gap))).toBeGreaterThanOrEqual(10);
  });

  it('знак промаха — с белым ореолом 7 (по 2 pt с каждой стороны штриха): виден на полноцветной сцене point (второй цикл UX)', () => {
    const m = countMark.missRing;
    expect(m.halo).toEqual({ color: '#FFFFFF', pad: 2, solid: true });
    expect(m.stroke + 2 * m.halo.pad).toBe(7);
    // штрих на ореоле читается как фигура ≥ 3 — на любом участке сцены под знаком
    expect(contrast(m.color, m.halo.color)).toBeGreaterThanOrEqual(3);
    // знак с ореолом отличается от пунктира «пусто» (заплатка, тень): у тех ореола нет и цвет — роль темы
    expect(emptyOutlineColor).toBe('textMuted');
  });

  it('point: знак мимо = missRing (пунктирное 64, а не сплошное 24); зоны 5–6 ≥ 60 с зазором ≥ 16', () => {
    expect(pointMiss).toBe(countMark.missRing);
    expect(pointMiss.size).toBe(64);
    expect(pointMiss.stroke).toBe(3);
    expect(pointMiss.shape).toBe('dashed_ring');
    expect(pointZone.hitMin).toBeGreaterThanOrEqual(60);
    expect(pointZone.edgeGapMin).toBeGreaterThanOrEqual(16);
    expect(pointZone.expandHiddenZone).toBe(true);
  });

  it('мелочи UX: перенос ответов 9–10, отступ «Помочь Tali», кнопка листа на карте, сумка Tali', () => {
    expect(lessonTextAnswer.truncate).toBe(false);
    expect(lessonTextAnswer.wrap).toBe(true);
    expect(helpTaliButton.extra).toBeGreaterThanOrEqual(16);
    expect(mapSettingsButton.size).toBeGreaterThanOrEqual(touch.min);
    expect(mapSettingsButton.keptInFocus).toBe(true);
    // focus на карте (раунд 4): полоса 64 — атлас 60, ориентир 32, кнопка листа 60; Tali статичен у узла
    expect(mapFocus.band).toBe(64);
    expect(mapFocus.atlasButton).toBeGreaterThanOrEqual(touch.min);
    expect(mapFocus.settings).toBe(mapSettingsButton.size);
    expect(Math.max(mapFocus.atlasButton, mapFocus.settings)).toBeLessThanOrEqual(mapFocus.band);
    expect(mapFocus.tali).toBe('static_at_node');
    // стороны и зазоры полосы (второй цикл UX): атлас слева, кнопка листа справа, зазор ≥ touch.gap
    expect(mapFocus.atlasSide).toBe('left');
    expect(mapFocus.settingsSide).toBe('right');
    expect(mapFocus.minGap).toBeGreaterThanOrEqual(touch.gap);
    // самый узкий экран 320: между кнопками остаётся место под название, полоса не ломается
    expect(mapTitleWidth(320)).toBe(136);
    expect(mapTitleWidth(360)).toBe(176);
    expect(mapTitleWidth(390)).toBe(206);
    expect(modeToggleCue.voiced).toBe(true);
    expect(taliSatchelRule.distinguishesPose).toBe(false);
    expect(taliSatchelRule.pressable).toBe(false);
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

describe('потолок шрифта на уроке (I-11)', () => {
  it('вопрос: две строки 22/30 × 1.2 = слот 72; запасной вид 18/24 в 3 строки — только при множителе 1', () => {
    expect(2 * 30 * lessonFontCaps.prompt - 1e-9).toBeLessThanOrEqual(72);
    expect(3 * 24 * lessonFontCaps.promptFallback).toBeLessThanOrEqual(72);
    expect(3 * 24 * lessonFontCaps.prompt).toBeGreaterThan(72); // поэтому запасной вид масштаб отключает
  });

  it('реплика: оба вида помещаются в слот 80 за вычетом полей', () => {
    const inner = 80 - 2 * bubblePadY;
    expect(2 * 26 * lessonFontCaps.bubble).toBeLessThanOrEqual(inner);
    expect(3 * 20 * lessonFontCaps.bubble).toBeLessThanOrEqual(inner);
  });

  it('плитки, цифры и знаки не масштабируются — размер знака не подсказывает ответ', () => {
    expect(lessonFontCaps.fixed).toBe(1);
    expect(lessonFontCaps.fixed).toBe(symbolGlyphMaxFontMultiplier);
  });
});

describe('Tali: кроп, отклик на тап, тёмная схема (V12–V14)', () => {
  it('кроп один: квадрат внутри кадра, слот 88, голова 55–60% высоты кропа, поле 6% по бокам', () => {
    expect(taliCrop.w).toBe(taliCrop.h);
    expect(taliCrop.x + taliCrop.w).toBeLessThanOrEqual(1);
    expect(taliCrop.y + taliCrop.h).toBeLessThanOrEqual(1);
    expect(taliCrop.x).toBeCloseTo(0.06, 5);
    expect(1 - taliCrop.x - taliCrop.w).toBeCloseTo(0.06, 5);
    const headShare = taliCrop.headFrameShare / taliCrop.h;
    expect(headShare).toBeGreaterThanOrEqual(0.55);
    expect(headShare).toBeLessThanOrEqual(0.6);
    expect(taliCrop.slot).toBe(88);
  });

  it('нейтральный отклик на тап: два шага по motion.quick, ход ≤ 4 pt (кивка нет)', () => {
    expect(taliIdleTap).toEqual({ travel: 4, beats: 2, beatMs: motion.quick });
  });

  it('палитра персонажа не входит в роли интерфейса: зелёный тела — не success, сумка — не error', () => {
    SCHEMES.forEach((scheme) =>
      VARIANTS.forEach((variant) => {
        const c = palettes[scheme][variant];
        expect(c.success.toLowerCase()).not.toBe(taliArt.body.toLowerCase());
        expect(c.error.toLowerCase()).not.toBe(taliArt.satchel.toLowerCase());
      }),
    );
  });

  it('тёмная схема: на нейтральных поверхностях силуэт держит тело ≥ 3, на заливке региона — контур ≥ 3', () => {
    const c = palettes.dark.normal;
    expect(contrast(taliArt.body, c.background)).toBeGreaterThanOrEqual(3);
    expect(contrast(taliArt.body, c.surface)).toBeGreaterThanOrEqual(3);
    // наружный контур на нейтральной поверхности границы не несёт — это известное и принятое свойство
    expect(contrast(taliArt.outline, c.background)).toBeLessThan(1.2);
    (Object.keys(c.regions) as RegionId[]).forEach((r) => {
      expect(contrast(taliArt.outline, c.regions[r])).toBeGreaterThanOrEqual(3);
    });
  });
});

describe('order: метки мест не кодируют количество (раунд 5, Е2)', () => {
  const BANDS = ['5-6', '7', '8', '9-10'] as const;

  it('у предметов-количеств метка — засечка на всех полосах', () => {
    BANDS.forEach((band) => expect(orderMarkFor(band, true)).toBe('tick'));
  });

  it('на 5–6 метка — засечка всегда; цифра — только с 7 лет и только не у количеств', () => {
    expect(orderMarkFor('5-6', false)).toBe('tick');
    (['7', '8', '9-10'] as const).forEach((band) => expect(orderMarkFor(band, false)).toBe('digit'));
  });

  it('точек на метке нет ни на одной полосе; номер в пустом месте — только у цифры', () => {
    expect(orderMark.dots).toBe(false);
    expect(orderMark.emptyPlaceNumber).toBe('digit_only');
  });

  it('засечка: 12 pt вниз от линии до низа полосы, контур темы — различима на фоне и поверхностях ≥ 3', () => {
    expect(orderMark.tick.length).toBe(orderMark.strip - orderMark.lineY);
    expect(orderMark.tick.direction).toBe('down_to_place');
    expect(stroke[orderMark.tick.stroke]).toBe(3);
    SCHEMES.forEach((scheme) =>
      VARIANTS.forEach((variant) => {
        const c = palettes[scheme][variant];
        [c.background, c.surface, c.surfaceAlt].forEach((bg) => {
          expect(contrast(c[orderMark.tick.color], bg)).toBeGreaterThanOrEqual(3);
        });
      }),
    );
    // засечка — не кружок: гнездо match 24 и кольцо-фишка рамки десятка остаются единственными кольцами
    expect(orderMark.tick).not.toHaveProperty('circle');
  });

  it('предметы-количества выводятся из данных: кучка или карточка-число; числа текстом — флагом задания', () => {
    expect(isQuantityOrder([{ count: 1 }, { count: 3 }, { count: 5 }])).toBe(true);
    expect(isQuantityOrder([{ numeral: 3 }, { numeral: 4 }])).toBe(true);
    expect(isQuantityOrder([{}, {}, {}])).toBe(false);
    expect(isQuantityOrder([{}, {}, {}], true)).toBe(true);
    // пилот: кучки на 5–6 — засечка
    expect(orderMarkFor('5-6', isQuantityOrder([{ count: 3 }, { count: 4 }, { count: 5 }]))).toBe('tick');
    // с 7 лет картинки «семечко → росток → цветок» — цифра
    expect(orderMarkFor('7', isQuantityOrder([{}, {}, {}]))).toBe('digit');
  });

  it('первое место на 5–6 — подсветка listeningCue на «начни отсюда», без движения; проводка по стреле в примере одна', () => {
    expect(orderFirstPlaceCue.band).toBe('5-6');
    expect(orderFirstPlaceCue.place).toBe('leftmost');
    expect(orderFirstPlaceCue.cue).toBe('listeningCue');
    expect(listeningCue.animated).toBe(false);
    expect(orderFirstPlaceCue.onReplay).toBe(true);
    expect(orderFirstPlaceCue.exampleTrace.once).toBe(true);
    expect(orderFirstPlaceCue.exampleTrace.durationMs).toBe(motion.slow);
    expect(stroke[orderFirstPlaceCue.exampleTrace.stroke]).toBe(6);
    // calm / reduce motion: по участкам между засечками, у трёх мест три шага = motion.slow
    expect(orderFirstPlaceCue.exampleTrace.calm).toBe('segment_steps');
    expect(3 * orderFirstPlaceCue.exampleTrace.calmStepMs).toBe(motion.slow);
  });

  it('тап по пустому месту без выбора: место сжимается 0.94 до отпускания во всех режимах, импульса метки нет; голос без числительного + «сначала выбери»', () => {
    const t = orderEmptyPlaceTap;
    expect(t.target).toBe('place');
    expect(t.scale).toBe(0.94);
    expect(t.trigger).toBe('touch_down');
    expect(t.feedbackMs).toBeLessThanOrEqual(100);
    expect(t.heldUntil).toBe('touch_up');
    expect(t.releaseMs).toBe(motion.press);
    expect(t.sameInCalm).toBe(true);
    expect(t.markPulse).toBe(false);
    // ход края места 104 ≥ 3 pt; прежний импульс засечки 12 × 0.15 = 1.8 — не виден
    expect((104 * (1 - t.scale)) / 2).toBeGreaterThanOrEqual(3);
    expect(orderMark.tick.length * 0.15).toBeLessThan(2);
    expect(t.voice.tick).toEqual(['start', 'middle', 'end']);
    expect(t.voice.then).toBe('choose_first_hint');
    expect(t.records).toBe(false);
  });
});

describe('повторный тап по выбранной плитке (раунд 5, В1)', () => {
  const r = selectedRepeatPress;

  it('сжатие 0.94 от касания вниз ≤ 100 мс, держится до отпускания, возврат за motion.press', () => {
    expect(r.scale).toBe(0.94);
    expect(r.scale).toBeLessThan(pressScale.wide);
    expect(r.trigger).toBe('touch_down');
    expect(r.feedbackMs).toBeLessThanOrEqual(100);
    expect(r.heldUntil).toBe('touch_up');
    expect(r.releaseMs).toBe(motion.press);
    expect(r.records).toBe(false);
    expect(r.haptic).toBe('parentSetting');
  });

  it('ход края заметен: ≥ 3 pt на плитке 104 (0.98 давало ≈ 1)', () => {
    expect(selectedRepeatTravel(104)).toBeGreaterThanOrEqual(3);
    expect((104 * (1 - pressScale.wide)) / 2).toBeLessThan(1.1);
  });

  it('у плитки с кучкой сжимается только рамка, поле фигур 80×80 неподвижно; рамка не наезжает на фигуры; без звука', () => {
    expect(r.pileTile).toEqual({ scales: 'frame', figureFieldStatic: true, sound: false });
    // плитка 104×112 (SE): между внутренним краем контура «выбрано» 6 и полем 80 — 6 по ширине, 10 по высоте
    const sideRoom = (104 - countSizes.tileField) / 2 - stroke.bold;
    const topRoom = (112 - countSizes.tileField) / 2 - stroke.bold;
    expect(selectedRepeatTravel(104)).toBeLessThanOrEqual(sideRoom);
    expect(selectedRepeatTravel(112)).toBeLessThanOrEqual(topRoom);
    expect(r.plainTile.sound).toBe('element');
  });
});

describe('повтор метки «сосчитано»: внешний контур на пике (раунд 5, В2)', () => {
  const r = countMark.repeatRing;

  it('метка на пике 28 ≤ фигура стимула 40', () => {
    const peak = countMark.dot + 2 * r.to + 2 * r.peakOutline.width;
    expect(peak).toBe(28);
    expect(peak).toBeLessThanOrEqual(countSizes.figureStimulus);
  });

  it('прежний край — белое кольцо — на белой и жёлтой фигуре не виден (1.0 / 1.59)', () => {
    expect(contrast(countMark.ringColor, '#FFFFFF')).toBeLessThan(1.1);
    expect(contrast(countMark.ringColor, palettes.light.normal.accent)).toBeLessThan(3);
  });

  it('двухцветный край виден на любой фигуре: на любом сером 0–255 хотя бы одна пара ≥ 4', () => {
    for (let v = 0; v <= 255; v += 1) {
      const hex = `#${v.toString(16).padStart(2, '0').repeat(3)}`;
      const best = Math.max(contrast(countMark.ringColor, hex), contrast(r.peakOutline.color, hex));
      expect(best).toBeGreaterThanOrEqual(4);
    }
    expect(contrast(r.peakOutline.color, palettes.light.normal.accent)).toBeGreaterThanOrEqual(3);
    expect(contrast(r.peakOutline.color, '#FFFFFF')).toBeGreaterThanOrEqual(3);
  });
});

describe('знак промаха: обрезка и первый палец (раунд 5, В5)', () => {
  it('знак живёт только внутри подложки стимула / рамки сцены; вне — ничего и не попытка', () => {
    const m = countMark.missRing;
    expect(m.clip).toEqual({ count: 'stimulus_plate', point: 'scene_frame' });
    expect(m.outsideClip).toBe('nothing');
    expect(m.records).toBe(false);
    expect(pointMiss.clip.point).toBe('scene_frame');
  });

  it('метит только первый палец — и в счёте, и в point; счёт и point в одном задании не совмещаются', () => {
    expect(countMark.missRing.pointers).toBe('first_only');
    expect(pointZone.pointers).toBe('first_only');
    expect(pointZone.withCounting).toBe(false);
  });
});

describe('карта: кнопка листа, звук, повтор голосом (раунд 5, В3)', () => {
  it('правая кнопка карты — «ползунки», открывает лист; динамика на карте нет', () => {
    expect(mapSettingsButton.icon).toBe('sliders');
    expect(mapSettingsButton.opens).toBe('child_sheet');
    expect(mapSettingsButton.size).toBeGreaterThanOrEqual(touch.min);
  });

  it('детский «Звук» — нота, глушит музыку и эффекты (и звуки нажатий), но не голос Tali и не вопросы (№22)', () => {
    expect(childSoundToggle.icon).toBe('note');
    expect(childSoundToggle.mutes).toEqual(expect.arrayContaining(['music', 'effects', 'press_sounds']));
    expect(childSoundToggle.neverMutes).toEqual(expect.arrayContaining(['tali_voice', 'prompts', 'option_names']));
    childSoundToggle.neverMutes.forEach((s) => expect(childSoundToggle.mutes as readonly string[]).not.toContain(s));
    expect(childSoundToggle.voiceControlledBy).toBe('parent_settings');
    expect(childSoundToggle.visualFeedbackAlways).toBe(true);
  });

  it('повтор голосом на карте — тап по Tali: регион и следующий шаг, в focus так же; таб атласа называет регион', () => {
    expect(mapTaliTap.voices).toEqual(['region_name', 'next_step']);
    expect(mapTaliTap.sameInFocus).toBe(true);
    expect(mapFocus.taliTap).toBe(mapTaliTap);
    expect(atlasTabTap.voices).toBe('region_name');
  });
});

describe('название региона в полосе карты (раунд 5, В4)', () => {
  /**
   * Названия регионов — из макетов (DESIGN_PROMPTS.md 1.2), первый — из локалей; ключей остальных
   * `content.regions.*` в локалях пока нет (раунд 5, контент В7). en — рабочие.
   */
  const NAMES = {
    ru: ['Мир чисел', 'Побережье слов', 'Живой лес', 'Мастерская', 'Кыргызский язык'],
    en: ['Number World', 'Word Coast', 'Living Forest', 'Workshop', 'Kyrgyz Language'],
  };

  it('плоская надпись: Nunito 800, одна строка 24/32 или две 20/26 в полосе 64', () => {
    expect(typography[mapTitle.style].family).toBe('Nunito');
    expect(typography[mapTitle.style].weight).toBe('800');
    expect(mapTitle.lineHeight).toBeLessThanOrEqual(mapFocus.band);
    expect(mapTitle.maxLines * (mapTitle.twoLineSize + mapTitle.twoLineLeading)).toBeLessThanOrEqual(mapFocus.band);
    expect(mapTitle.maxFontSizeMultiplier).toBe(1);
    expect(mapTitle.minSize).toBe(18);
  });

  it('плоская надпись: сначала ужимается в одну строку, потом идёт в две', () => {
    expect(fitRegionTitle('Мир чисел', 136)).toEqual({ size: 22, lineHeight: 30 });
    expect(fitRegionTitle('Мир чисел', 176)).toEqual({ size: 24, lineHeight: 32 });
    expect(fitRegionTitle('Кыргызский язык', 176)).toEqual({ size: 20, lineHeight: 26 });
    expect(fitRegionTitle('Достопримечательностей', 136)).toBeNull();
  });

  (Object.keys(NAMES) as (keyof typeof NAMES)[]).forEach((lang) => {
    it(`${lang}: все названия помещаются плоско на экране 320 не мельче 18`, () => {
      NAMES[lang].forEach((name) => {
        const fit = fitRegionTitle(name, mapTitleWidth(320));
        expect(fit).not.toBeNull();
        expect(fit?.size ?? 0).toBeGreaterThanOrEqual(mapTitle.minSize);
      });
    });
  });

  it('наклейка: контраст букв к контуру и кегль по ширине экрана', () => {
    expect(contrast(mapTitle.sticker.fill, mapTitle.sticker.outlineColor)).toBeGreaterThanOrEqual(4.5);
    expect(fitStickerTitle('Мир чисел', mapTitleWidth(390))).toEqual({ size: 26, lineHeight: 34, outline: 2 });
    expect(fitStickerTitle('Мир чисел', mapTitleWidth(360))).toEqual({ size: 24, lineHeight: 32, outline: 2 });
    expect(fitStickerTitle('Мир чисел', mapTitleWidth(320))).toEqual({ size: 20, lineHeight: 28, outline: 1.5 });
  });

  it('наклейка: длинное название не входит — остаётся плоская надпись', () => {
    expect(fitStickerTitle('Кыргызский язык', mapTitleWidth(390))).toBeNull();
    expect(fitStickerTitle('Number World', mapTitleWidth(360))).toBeNull();
  });
});
