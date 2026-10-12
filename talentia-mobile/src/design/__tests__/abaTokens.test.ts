/**
 * Контракт визуального языка ABA-режима (ABA.md, «Визуальный язык»). Главное
 * правило — цвет не бывает дискриминативным стимулом — проверяется здесь, а не
 * на ревью: иначе однажды «чуть подсветить верный вариант зелёным» пройдёт.
 */
import * as fs from 'fs';
import * as path from 'path';
import { adultPanelButtons, type PanelButton, type PanelStep } from '../../domain/abaScoring';
import { promptVisualFor } from '../../domain/abaPrompting';
import type { AbaTarget } from '../../types/aba';
import {
  ABA_CONTROL_STROKE,
  ABA_DEAD_ZONE_MIN,
  ABA_DEAD_ZONE_ROOMY,
  ABA_MIN_AVAILABLE_HEIGHT,
  ABA_ORIENTATION,
  ABA_SAFE_RESERVE,
  ABA_STIMULUS_STROKE,
  abaAdultPanel,
  abaAdultPanelColors,
  abaAdultPanelSlot,
  abaAdultPanelStages,
  abaAdultPanelTier,
  abaAdultPanelUndoStage,
  abaAvailableHeight,
  abaChoiceZone,
  abaColors,
  abaControls,
  abaDeadZone,
  abaDeadZoneMin,
  abaInstruction,
  abaLayout,
  abaLayoutByTier,
  abaLayoutCompact,
  abaLayoutFor,
  abaLayoutHeight,
  abaLayoutTight,
  abaMinAvailableHeight,
  abaReserve,
  abaTierFor,
  abaTokenBoard,
  abaWindowPolicy,
  type AbaTier,
  inactiveChoice,
  PLATE_STROKE_INSET,
  PROMPT_PULSE,
  promptVisual,
  tokenCell,
  type AbaColors,
  type PromptVisual,
} from '../abaTokens';
import { contrast, SHAPE_CONTRAST, TEXT_CONTRAST } from '../contrast';
import { touchAdult } from '../parentTokens';
import { buildTheme, cushionByRole, elevation, motion, palettes, touch, type Scheme } from '../tokens';

const SCHEMES: Scheme[] = ['light', 'dark'];

/** Цвета, которые ребёнок видит на экране пробы рядом со стимулом. */
const trialColors = (c: AbaColors) => [c.background, c.plate, c.plateOutline, c.ink];

describe('цвет в ABA не бывает стимулом', () => {
  it('на экране пробы в светлой схеме ровно три цвета: песок, плита, почти-чёрный', () => {
    expect(new Set(trialColors(abaColors.light)).size).toBe(3);
  });

  SCHEMES.forEach((scheme) => {
    it(`${scheme}: ни цветов регионов, ни «верно/неверно», ни secondary на экране пробы`, () => {
      const forbidden = new Set<string>();
      (['light', 'dark'] as const).forEach((s) =>
        (['normal', 'calm'] as const).forEach((v) => {
          const p = palettes[s][v];
          [...Object.values(p.regions), ...Object.values(p.regionsInk), p.secondary, p.secondaryInk, p.error,
            p.success, p.successInk].forEach((x) => forbidden.add(x.toUpperCase()));
        }),
      );
      trialColors(abaColors[scheme]).forEach((x) => expect(forbidden.has(x.toUpperCase())).toBe(false));
    });

    it(`${scheme}: жёлтый — только у жетона, фиолетовый — только на экране подкрепления`, () => {
      const c = abaColors[scheme];
      expect(trialColors(c)).not.toContain(c.tokenEarned);
      expect(trialColors(c)).not.toContain(c.reinforcement);
    });
  });
});

describe('плита стимула', () => {
  SCHEMES.forEach((scheme) => {
    const c = abaColors[scheme];

    it(`${scheme}: контур различим на плите`, () => {
      expect(contrast(c.plateOutline, c.plate)).toBeGreaterThanOrEqual(SHAPE_CONTRAST);
    });

    it(`${scheme}: плита отделена от фона — контуром или сама`, () => {
      const byOutline = contrast(c.plateOutline, c.background) >= SHAPE_CONTRAST;
      const byFill = contrast(c.plate, c.background) >= SHAPE_CONTRAST;
      expect(byOutline || byFill).toBe(true);
    });

    it(`${scheme}: инструкция читается на фоне`, () => {
      expect(contrast(c.ink, c.background)).toBeGreaterThanOrEqual(TEXT_CONTRAST);
    });
  });

  it('контур плиты тёмный в обеих схемах — светлый исчез бы на светлой плите', () => {
    expect(abaColors.dark.plateOutline).toBe(abaColors.light.plateOutline);
    // системное правило дало бы светлый контур — на плите это 1.12:1, линии нет
    expect(contrast(palettes.dark.normal.outline, abaColors.dark.plate)).toBeLessThan(SHAPE_CONTRAST);
  });

  it('плита не темнеет в тёмной теме — это тот же стимул', () => {
    expect(contrast(abaColors.dark.plate, abaColors.light.plate)).toBeLessThan(1.5);
  });

  it('спокойный режим не понижает контур плиты', () => {
    const calm = buildTheme({ scheme: 'light', calmMode: true, focusMode: false });
    expect(calm.stroke.base).toBeLessThan(ABA_STIMULUS_STROKE);
    expect(ABA_STIMULUS_STROKE).toBe(3);
  });
});

describe('жетоны', () => {
  SCHEMES.forEach((scheme) => {
    const c = abaColors[scheme];
    it(`${scheme}: контур жетона различим на жёлтом, контур слота — на фоне`, () => {
      expect(contrast(c.tokenOutline, c.tokenEarned)).toBeGreaterThanOrEqual(SHAPE_CONTRAST);
      expect(contrast(c.tokenSlotOutline, c.background)).toBeGreaterThanOrEqual(SHAPE_CONTRAST);
    });
  });

  it('пустой и заработанный различаются заливкой, контуром и звездой — не прозрачностью', () => {
    (['earnedIndependent', 'earnedPrompted'] as const).forEach((earned) => {
      const a = tokenCell.empty;
      const b = tokenCell[earned];
      const diffs = (Object.keys(a) as (keyof typeof a)[]).filter((k) => a[k] !== b[k]);
      expect(diffs.sort()).toEqual(['fill', 'outline', 'star']);
    });
  });

  it('жетоны плоские: ни подушки, ни рельефа (решения №10, №69)', () => {
    expect(abaTokenBoard).not.toHaveProperty('cushion');
    Object.values(tokenCell).forEach((cell) => expect(cell).not.toHaveProperty('relief'));
    expect(cushionByRole.abaToken).toBe('flat');
  });

  it('жетон за самостоятельный и за подсказанный различимы — звездой', () => {
    expect(tokenCell.earnedIndependent.star).not.toBe(tokenCell.earnedPrompted.star);
  });

  it('жетоны не интерактивны — поэтому меньше детского минимума зоны нажатия', () => {
    expect(abaTokenBoard.interactive).toBe(false);
    expect(abaTokenBoard.size).toBeLessThan(touch.min);
  });

  it('пять рекомендуемых помещаются на 390 pt, восемь минимальных — предел', () => {
    expect(abaTokenBoard.size * 5 + 8 * 4).toBeLessThanOrEqual(390);
    expect(abaTokenBoard.minSize * abaTokenBoard.maxPerRow).toBeLessThanOrEqual(390);
  });
});

describe('уровни подсказки без цвета', () => {
  const levels = [0, 1, 2, 3] as const;
  const formats = ['identify', 'match'] as const;

  it('любые два уровня одного формата различаются хотя бы одним бесцветным и неподвижным признаком', () => {
    formats.forEach((f) =>
      levels.forEach((a) =>
        levels.forEach((b) => {
          if (a >= b) return;
          const pa = promptVisual[f][a];
          const pb = promptVisual[f][b];
          // пульс — не признак уровня: движение уровень не несёт
          const differs = pa.mark !== pb.mark || pa.markOn !== pb.markOn || pa.plateStroke !== pb.plateStroke ||
            pa.activeChoices !== pb.activeChoices || pa.guide !== pb.guide;
          expect(differs).toBe(true);
        }),
      ),
    );
  });

  it('уровень выше — вмешательство не меньше: толщина контура не убывает', () => {
    formats.forEach((f) =>
      levels.forEach((l) => {
        if (l > 0) expect(promptVisual[f][l].plateStroke).toBeGreaterThanOrEqual(promptVisual[f][(l - 1) as 0 | 1 | 2].plateStroke);
      }),
    );
  });

  it('контур утолщается внутрь — габарит стимула не меняется', () => {
    expect(PLATE_STROKE_INSET).toBe(true);
  });

  it('полоса подсказки резервируется всегда и вмещает метку', () => {
    const maxMark = Math.max(...formats.flatMap((f) => levels.map((l) => promptVisual[f][l].markSize)));
    expect(abaLayout.hintBand).toBeGreaterThanOrEqual(maxMark);
    expect(abaLayoutCompact.hintBand).toBe(abaLayout.hintBand);
  });

  it('match: верная плита не выделена ни на каком уровне, ответа нет до L3', () => {
    levels.forEach((l) => {
      const v = promptVisual.match[l];
      expect(v.markOn).not.toBe('correct_choice');
      expect(v.plateStroke).toBe(ABA_STIMULUS_STROKE);
      expect(v.guide).toBe('none');
    });
    expect(promptVisual.match[1].activeChoices).toBe('all');
    expect(promptVisual.match[2].activeChoices).toBe('correct_and_one');
  });

  it('пульс — один раз, коротко, только на L1 match', () => {
    expect(PROMPT_PULSE.count).toBe(1);
    expect(PROMPT_PULSE.durationMs).toBe(motion.slow);
    expect(PROMPT_PULSE.scale).toBeLessThanOrEqual(1.06);
    const pulsing = formats.flatMap((f) => levels.filter((l) => promptVisual[f][l].pulse).map((l) => `${f}${l}`));
    expect(pulsing).toEqual(['match1']);
  });

  it('неактивная плита приглушена штриховкой, а не прозрачностью, и не реагирует', () => {
    expect(inactiveChoice).not.toHaveProperty('opacity');
    expect(inactiveChoice.pattern).toBe('hatched_45');
    expect(inactiveChoice.cushion).toBe(false);
    expect(inactiveChoice.reactsToTap).toBe(false);
    expect(inactiveChoice.hiddenFromScreenReader).toBe(true);
  });

  describe('токены соответствуют домену (promptVisualFor, Р5)', () => {
    type Kind = Pick<AbaTarget, 'format' | 'sdKind' | 'fieldSize' | 'matchMode'>;
    const identify: Kind = { format: 'identify', sdKind: 'name' };
    const match3: Kind = { format: 'match', fieldSize: 3 };
    const three = { correctId: 'b', choiceIds: ['a', 'b', 'c'], sampleId: 's' } as const;
    const need = (a: PromptVisual['activeChoices'], n: number) => ({ all: n, correct_and_one: 2, correct_only: 1 })[a];

    ([['identify', identify], ['match', match3]] as const).forEach(([format, kind]) =>
      levels.forEach((level) => {
        it(`${format} L${level}: метка, пульс, выделение верной и число активных плит те же`, () => {
          const plan = promptVisualFor(kind, level, three, 1);
          const tok = promptVisual[format][level];
          expect(plan.focus !== null).toBe(tok.mark !== 'none');
          expect(plan.focus?.pulse ?? false).toBe(tok.pulse);
          expect(plan.highlightCorrect).toBe(tok.markOn === 'correct_choice');
          expect(plan.activeChoiceIds).toHaveLength(need(tok.activeChoices, three.choiceIds.length));
          expect(plan.focus?.on === 'sample').toBe(tok.markOn === 'source');
        });
      }),
    );
  });
});

/**
 * Расчётные окна. Доступная высота = высота − верхняя safe area − нижняя safe area. SE (кнопка
 * «Домой») нижней safe area не имеет: прежняя цифра «мёртвая зона 25» вычитала индикатор 34,
 * которого на SE нет, и считала запас дважды.
 */
const DEVICES = {
  'se-375x667': { w: 375, top: 20, bottom: 0, h: 667 },
  'android-360x640-3btn': { w: 360, top: 24, bottom: 48, h: 640 },
  'android-360x640-gesture': { w: 360, top: 24, bottom: 20, h: 640 },
  'iphone-390x844': { w: 390, top: 47, bottom: 34, h: 844 },
} as const;
const available = (d: (typeof DEVICES)[keyof typeof DEVICES]) => d.h - d.top - d.bottom;
const TIERS: AbaTier[] = ['roomy', 'compact', 'tight'];

describe('раскладка экрана пробы (три тира)', () => {
  it('высоты тиров: 640 / 568 / 536', () => {
    expect(abaLayoutHeight(abaLayout)).toBe(640);
    expect(abaLayoutHeight(abaLayoutCompact)).toBe(568);
    expect(abaLayoutHeight(abaLayoutTight)).toBe(536);
  });

  it('запас плавный: max(0, 24 − insetBottom × 1.5), без скачка на границе', () => {
    expect(abaReserve(0)).toBe(ABA_SAFE_RESERVE);
    expect(abaReserve(8)).toBe(12);
    expect(abaReserve(15)).toBe(1.5);
    expect(abaReserve(16)).toBe(0);
    expect(abaReserve(48)).toBe(0);
    for (let b = 0; b < 16; b += 0.5) expect(abaReserve(b) - abaReserve(b + 0.5)).toBeCloseTo(0.75, 9);
  });

  it('пороги: tight с 560 при нижней safe area ≥ 16 и с 584 при нулевой', () => {
    expect(ABA_MIN_AVAILABLE_HEIGHT).toBe(560);
    expect(abaMinAvailableHeight(0)).toBe(584);
    expect(abaMinAvailableHeight(15)).toBe(561.5);
    expect(abaMinAvailableHeight(16)).toBe(560);
    expect(abaTierFor(559, 48)).toBeNull();
    expect(abaTierFor(560, 48)).toBe('tight');
    expect(abaTierFor(583, 0)).toBeNull();
    expect(abaTierFor(584, 0)).toBe('tight');
    expect(abaTierFor(568, 48)).toBe('tight'); // 360×640 с тремя кнопками: 568 − 536 = 32 ≥ 24
    expect(abaTierFor(591, 48)).toBe('tight');
    expect(abaTierFor(592, 48)).toBe('compact');
    expect(abaTierFor(671, 48)).toBe('compact');
    expect(abaTierFor(672, 48)).toBe('roomy');
    expect(abaLayoutFor(559, 48)).toBeNull();
  });

  it('доступная высота берётся из onLayout корня внутри safe area, а не «окно минус insets» (оба режима Android)', () => {
    // 360×640, три кнопки: контейнер внутри safe area — 568 в обоих режимах
    const container = 568;
    expect(abaAvailableHeight(container)).toBe(568);
    expect(abaAvailableHeight(567.6)).toBe(567);
    // edge-to-edge (SDK 54): окно включает панели, insets реальные — вычитание даёт то же, что onLayout
    const edgeToEdge = { window: 640, top: 24, bottom: 48 };
    expect(edgeToEdge.window - edgeToEdge.top - edgeToEdge.bottom).toBe(container);
    // прежний режим: окно уже без панелей (568), insets всё ещё сообщают статус-бар 24 — вычитание
    // задваивается: 544 вместо 568 (замечание child-ux-specialist, В-4); тир при этом ухудшается
    const legacy = { window: 568, top: 24, bottom: 0 };
    const naive = legacy.window - legacy.top - legacy.bottom;
    expect(naive).toBe(544);
    expect(abaTierFor(naive, 48)).toBeNull();
    expect(abaTierFor(abaAvailableHeight(container), 48)).toBe('tight');
  });

  it('экран пробы — только портрет: ландшафт (≈ 360 pt высоты) не помещается ни в один тир', () => {
    expect(ABA_ORIENTATION).toBe('portrait');
    expect(abaTierFor(360, 0)).toBeNull();
  });

  it('тир — самый крупный из подходящих, а выбранный всегда оставляет мёртвую зону своей нормы сверх запаса', () => {
    for (const bottom of [0, 15, 16, 34, 48]) {
      for (let h = 400; h <= 950; h++) {
        const tier = abaTierFor(h, bottom);
        const room = h - abaReserve(bottom);
        if (tier === null) {
          expect(room - abaLayoutHeight(abaLayoutTight)).toBeLessThan(ABA_DEAD_ZONE_MIN);
          continue;
        }
        expect(room - abaLayoutHeight(abaLayoutByTier[tier])).toBeGreaterThanOrEqual(abaDeadZoneMin[tier]);
        const larger = TIERS.slice(0, TIERS.indexOf(tier));
        larger.forEach((t) => expect(room - abaLayoutHeight(abaLayoutByTier[t])).toBeLessThan(abaDeadZoneMin[t]));
      }
    }
  });

  it('нормы мёртвой зоны: 32 у крупного, 24 у остальных', () => {
    expect(abaDeadZoneMin).toEqual({ roomy: ABA_DEAD_ZONE_ROOMY, compact: ABA_DEAD_ZONE_MIN, tight: ABA_DEAD_ZONE_MIN });
    expect(ABA_DEAD_ZONE_ROOMY).toBe(32);
  });

  it('бюджет по устройствам: тир, высота и фактическая мёртвая зона (в расчёте нет «запаса сверху»)', () => {
    const expected: Record<keyof typeof DEVICES, [AbaTier, number]> = {
      'se-375x667': ['compact', 79],
      'android-360x640-3btn': ['tight', 32],
      'android-360x640-gesture': ['compact', 28],
      'iphone-390x844': ['roomy', 123],
    };
    (Object.keys(DEVICES) as (keyof typeof DEVICES)[]).forEach((id) => {
      const d = DEVICES[id];
      const tier = abaTierFor(available(d), d.bottom);
      expect(tier).toBe(expected[id][0]);
      expect(abaDeadZone(tier as AbaTier, available(d))).toBe(expected[id][1]);
      // с вычетом запаса зона всё равно не меньше нормы тира
      expect(abaDeadZone(tier as AbaTier, available(d)) - abaReserve(d.bottom)).toBeGreaterThanOrEqual(
        abaDeadZoneMin[tier as AbaTier],
      );
    });
  });

  it('DESIGN_PROMPTS.md 2.1 хранит те же числа бюджета (строки «aba-budget»): расхождение документа и токенов ловится', () => {
    const doc = fs.readFileSync(path.join(__dirname, '..', '..', '..', '..', 'DESIGN_PROMPTS.md'), 'utf8');
    const rows = [...doc.matchAll(/^aba-budget (\S+) (\w+) (\d+) (\d+)[ \t\r]*$/gm)];
    expect(rows.map((r) => r[1]).sort()).toEqual(Object.keys(DEVICES).sort());
    rows.forEach(([, id, tier, height, dead]) => {
      const d = DEVICES[id as keyof typeof DEVICES];
      const t = abaTierFor(available(d), d.bottom) as AbaTier;
      expect(tier).toBe(t);
      expect(Number(height)).toBe(abaLayoutHeight(abaLayoutByTier[t]));
      expect(Number(dead)).toBe(abaDeadZone(t, available(d)));
    });
  });

  it('панель каждого тира собирается из своих слагаемых и совпадает с высотой в раскладке', () => {
    TIERS.forEach((t) => {
      const p = abaAdultPanelTier[t];
      expect(abaAdultPanel.padding * 2 + p.rowGap + p.buttonHeight * 2).toBe(p.height);
      expect(abaLayoutByTier[t].adultPanel).toBe(p.height);
      expect(p.buttonHeight).toBeGreaterThanOrEqual(touchAdult);
    });
    expect(abaAdultPanelTier.roomy.rowGap).toBe(12);
    expect(abaAdultPanelTier.compact.rowGap).toBe(12);
    expect(abaAdultPanelTier.tight.rowGap).toBe(12);
    expect(abaAdultPanelTier.tight.height).toBe(124);
    expect(abaAdultPanelTier.roomy.buttonHeight).toBe(56);
    expect(abaAdultPanelTier.roomy.colGap).toBe(12);
  });

  it('полоса подсказки, инструкция и панель-слоты в тирах те же; меняются плита, зазор после доски и панель', () => {
    TIERS.forEach((t) => {
      const l = abaLayoutByTier[t];
      expect(l.instruction).toBe(abaLayout.instruction);
      expect(l.hintBand).toBe(40);
      expect(l.topBar).toBe(abaLayout.topBar);
      expect(l.breakCard).toBe(64);
    });
    expect(abaLayoutCompact.stimulus).toBeLessThan(abaLayout.stimulus);
    expect(abaLayoutTight.stimulus).toBeLessThan(abaLayoutCompact.stimulus);
    expect(abaLayoutTight.stimulus).toBe(176);
    expect(abaLayoutTight.gapAfterBoard).toBe(8);
  });

  it('зона выбора: образец + зазор + ряд плит равны высоте плиты; плиты — цели не меньше 60, три в ряд помещаются', () => {
    const byTier = { roomy: 'regular', compact: 'compact', tight: 'tight' } as const;
    TIERS.forEach((t) => {
      const z = abaChoiceZone[byTier[t]];
      expect(z.sample + abaLayout.plateGap + z.choice).toBe(abaLayoutByTier[t].stimulus);
      expect(z.choice).toBeGreaterThanOrEqual(touch.min);
      expect(3 * z.choice + 2 * abaLayout.plateGap).toBeLessThanOrEqual(343);
    });
    expect(3 * abaChoiceZone.tight.choice + 2 * abaLayout.plateGap).toBe(264);
  });

  it('политика окна: тир один раз на сессию, смена окна — предупреждение без перестройки', () => {
    expect(abaWindowPolicy.tierChosen).toBe('once_per_session');
    expect(abaWindowPolicy.onWindowChange).toBe('warn_adult_no_relayout');
    expect(abaWindowPolicy.belowMin).toBe('warn_adult_on_enable');
  });

  it('верхняя полоса при 360 pt: выход, счётчик «Проба 10 из 10» и карточка «перерыв» с полями 16 помещаются', () => {
    const counter = 15 * 0.56 * 14; // «Проба 10 из 10»: 15 знаков Caption 14
    expect(abaControls.edgeInset * 2 + abaControls.exitSize + abaControls.breakSize + counter).toBeLessThanOrEqual(360);
    expect(abaControls.edgeInset).toBeGreaterThanOrEqual(16);
  });

  it('инструкция: потолок шрифта ×1.2 держит две строки Subtitle 30 в слоте 72', () => {
    expect(
      abaInstruction.lines * abaInstruction.lineHeight * abaInstruction.maxFontSizeMultiplier - 1e-9,
    ).toBeLessThanOrEqual(abaLayout.instruction);
  });
});

describe('панель взрослого (Р6)', () => {
  it('без hitSlop вверх: между плитой и панелью мёртвая зона', () => {
    expect(abaAdultPanel.hitSlopUp).toBe(0);
  });

  it('тап ребёнка блокирует панель на 400 мс от первого тапа, без продления серией (потолок 1000)', () => {
    expect(abaAdultPanel.childTapLockMs).toBe(400);
    const lock = abaAdultPanel.childTapLock;
    expect(lock.extendedBySeries).toBe(false);
    expect(lock.seriesCapMs).toBe(1000);
    expect(lock.seriesCapMs).toBeGreaterThan(abaAdultPanel.childTapLockMs);
    expect(lock.adultTapFeedback).toBe('none');
    expect(lock.lockAfterMark).toBe(true);
    expect(lock.triggeredByBreakOrExit).toBe(false);
  });

  it('«исправить отметку»: 5 с, один уровень, левый слот ряда 2, не растянута; «Отказ» не занимает', () => {
    expect(abaAdultPanel.undo).toEqual({
      windowMs: 5000, row: 1, col: 0, span: 'slot', levels: 1, endsWith: 'reinforcement_phase',
    });
    expect(abaAdultPanelSlot.undo).toEqual({ row: abaAdultPanel.undo.row, col: abaAdultPanel.undo.col });
    // не пересекается с позицией «Отказ» и с рядом 1 окна ответа; делит слот только с «Я подсказал(а)»,
    // с которым во времени не сосуществует (фаза подкрепления ≠ окно ответа)
    const u = abaAdultPanelSlot.undo;
    const same = (id: PanelButton) => abaAdultPanelSlot[id].row === u.row && abaAdultPanelSlot[id].col === u.col;
    expect(same('refusal')).toBe(false);
    abaAdultPanelStages.answerWindow
      .filter((id) => id !== 'adult_prompted')
      .forEach((id) => expect(same(id)).toBe(false));
    expect(same('adult_prompted')).toBe(true);
    expect(abaAdultPanelUndoStage).toEqual(['undo']);
    expect((abaAdultPanelStages.answerWindow as readonly string[]).includes('undo')).toBe(false);
  });

  it('системный шрифт на панели: две строки подписи при потолке ×1.2 помещаются в кнопку', () => {
    const caption = 20; // parentTypography.caption.lineHeight
    expect(abaAdultPanel.maxFontSizeMultiplier).toBeLessThanOrEqual(1.2);
    expect(abaAdultPanel.minimumFontScale).toBeCloseTo(0.86, 2);
    TIERS.forEach((t) => {
      const lines = abaAdultPanel.labelLines * Math.ceil(caption * abaAdultPanel.maxFontSizeMultiplier - 1e-9);
      expect(lines).toBeLessThanOrEqual(abaAdultPanelTier[t].buttonHeight);
    });
  });

  it('подписи (ru) на экране шириной 360: самое длинное слово ≤ ширина слота − 2 × поле, во всех тирах', () => {
    const W = 360;
    // метки слотов — по домену панели; «Сопротивляется» стоит в средней, шире остальных
    const labels: Record<PanelButton | 'undo', string> = {
      undo: 'Исправить отметку',
      correct: 'Верно',
      approximation: 'Почти',
      incorrect: 'Неверно',
      adult_prompted: 'Я подсказал(а)',
      refusal: 'Отказ',
      l4_done: 'Сделали вместе',
      l4_resisted: 'Сопротивляется',
      l4_skipped: 'Пропустить',
      adult_completed: 'Звено сделал(а) сам(а)',
    };
    const CHAR = 0.56; // средний шаг знака Nunito 600, em; с запасом
    // масштаб шрифта: 1 и худший допустимый «потолок ×1.2, ужатый до minimumFontScale» (1.2 × 0.86)
    const scales = [1, abaAdultPanel.maxFontSizeMultiplier * abaAdultPanel.minimumFontScale];
    scales.forEach((scale) =>
      TIERS.forEach((t) => {
        const p = abaAdultPanelTier[t];
        const inner = W - 2 * abaAdultPanel.padding;
        const unit = (inner - 2 * p.colGap) / abaAdultPanel.colWeights.reduce((a, b) => a + b, 0);
        (Object.keys(labels) as (PanelButton | 'undo')[]).forEach((id) => {
          const { row, col } = abaAdultPanelSlot[id];
          const slot = row === 0 ? unit * abaAdultPanel.colWeights[col] : (inner - p.colGap) / 2;
          const longest = Math.max(...labels[id].split(' ').map((w) => w.length));
          expect(longest * CHAR * 14 * scale).toBeLessThanOrEqual(slot - 2 * abaAdultPanel.labelPadX);
        });
      }),
    );
    // средняя колонка шире боковых: 126 против 100 на 360 при зазоре 8
    const unit8 = (360 - 16 - 16) / 3.25;
    expect(Math.round(unit8 * 1.25)).toBe(126);
    expect(Math.round(unit8)).toBe(101);
    expect(abaAdultPanel.labelPadX).toBe(4);
  });

  it('позиции фиксированы: внутри этапа слоты не пересекаются и лежат в сетке 3 + 2', () => {
    const stages: readonly (readonly PanelButton[])[] = Object.values(abaAdultPanelStages);
    stages.forEach((stage) => {
      const keys = stage.map((id) => `${abaAdultPanelSlot[id].row}:${abaAdultPanelSlot[id].col}`);
      expect(new Set(keys).size).toBe(stage.length);
      stage.forEach((id) => expect(abaAdultPanelSlot[id].col).toBeLessThan(abaAdultPanel.slotsPerRow[abaAdultPanelSlot[id].row]));
    });
  });

  it('«Отказ» всегда в одном слоте (ряд 2, справа), L4 — в первом ряду', () => {
    expect(abaAdultPanelSlot.refusal).toEqual({ row: 1, col: 1 });
    (['l4_done', 'l4_resisted', 'l4_skipped'] as const).forEach((id) => expect(abaAdultPanelSlot[id].row).toBe(0));
  });

  it('«Почти» скрыта — слот остаётся пустым: «Верно» и «Неверно» не сдвигаются', () => {
    const step = (scoredBy: PanelStep['scoredBy']): PanelStep => ({ scoredBy, startPromptLevel: 0, askAdultForL4: false });
    const adult = adultPanelButtons('with_adult', step('adult'), false);
    const device = adultPanelButtons('with_adult', step('device_tap'), false);
    expect(adult).toContain('approximation');
    expect(device).not.toContain('approximation');
    ['correct', 'incorrect', 'adult_prompted', 'refusal'].forEach((id) => expect(device).toContain(id));
    // слоты берутся из таблицы по id, а не по индексу в списке — сдвига нет
    expect(abaAdultPanelSlot.incorrect).toEqual({ row: 0, col: 2 });
  });

  it('любой набор кнопок из домена раскладывается без пересечения слотов', () => {
    const sets: PanelStep[] = [
      { scoredBy: 'adult', startPromptLevel: 0, askAdultForL4: false },
      { scoredBy: 'device_tap', startPromptLevel: 0, askAdultForL4: false },
      { scoredBy: 'adult', startPromptLevel: 4, askAdultForL4: true },
      { scoredBy: 'adult', startPromptLevel: 4, askAdultForL4: true, stepId: 's1' },
      { scoredBy: 'adult', startPromptLevel: 4, askAdultForL4: false, stepId: 's1' },
    ];
    sets.forEach((s) => {
      const ids = adultPanelButtons('with_adult', s, false);
      const keys = ids.map((id) => `${abaAdultPanelSlot[id].row}:${abaAdultPanelSlot[id].col}`);
      expect(new Set(keys).size).toBe(ids.length);
    });
  });

  SCHEMES.forEach((scheme) => {
    it(`${scheme}: подпись читается на кнопке, а недоступная — на полосе`, () => {
      const c = abaAdultPanelColors(scheme);
      expect(contrast(c.label, c.button)).toBeGreaterThanOrEqual(TEXT_CONTRAST);
      expect(contrast(c.labelDisabled, c.band)).toBeGreaterThanOrEqual(TEXT_CONTRAST);
    });

    it(`${scheme}: недоступная кнопка — без границы (граница = цвет полосы), доступная — с границей`, () => {
      const c = abaAdultPanelColors(scheme);
      expect(c.borderDisabled).toBe(c.band);
      expect(c.border).not.toBe(c.band);
    });
  });
});

describe('детские кнопки управления и карточка «перерыв» (Р7)', () => {
  it('карточка не меньше 60, с подушкой помещается в полосу', () => {
    expect(abaLayout.breakCard).toBeGreaterThanOrEqual(touch.min);
    expect(abaControls.breakSize).toBe(abaLayout.breakCard);
    expect(abaLayout.breakCard + elevation.raised.offsetY).toBeLessThanOrEqual(abaLayout.topBar);
    expect(abaControls.exitSize + elevation.raised.offsetY).toBeLessThanOrEqual(abaLayout.topBar);
  });

  it('от плит ≥ 48, от повтора ≥ 24 — во всех трёх раскладках', () => {
    [abaLayout, abaLayoutCompact, abaLayoutTight].forEach((l) => {
      expect(l.tokenBoard + l.gapAfterBoard + l.instruction + l.hintBand).toBeGreaterThanOrEqual(abaControls.breakMinGapToPlate);
      expect(l.tokenBoard + l.gapAfterBoard).toBeGreaterThanOrEqual(abaControls.breakMinGapToReplay);
    });
  });

  it('удержание выхода 1500 мс, первые 300 без отклика', () => {
    expect(abaControls.exitHoldMs).toBe(1500);
    expect(abaControls.exitHoldIdleMs).toBe(300);
    expect(abaControls.exitHoldIdleMs).toBeLessThan(abaControls.exitHoldMs);
  });

  it('короткий тап по выходу — тихая подсказка без движения; у выхода есть accessibilityAction', () => {
    expect(abaControls.exitTapHint.animated).toBe(false);
    expect(abaControls.exitTapHint.durationMs).toBeLessThan(abaControls.exitHoldMs);
    expect(abaControls.exitAccessibilityAction).toBe(true);
  });

  it('штриховка неактивной плиты в calm реже (12), толщина штриха та же', () => {
    expect(inactiveChoice.hatchStepCalm).toBe(12);
    expect(inactiveChoice.hatchStepCalm).toBeGreaterThan(inactiveChoice.hatchStep);
    expect(inactiveChoice.hatchStroke).toBe(2);
  });

  it('контур детских кнопок в ABA не понижается в calm', () => {
    const calm = buildTheme({ scheme: 'light', calmMode: true, focusMode: false });
    expect(calm.stroke.base).toBeLessThan(ABA_CONTROL_STROKE);
    expect(ABA_CONTROL_STROKE).toBe(3);
  });

  SCHEMES.forEach((scheme) => {
    const c = abaColors[scheme];
    it(`${scheme}: контур и глиф кнопки различимы на заливке и на фоне; плашка подкрепления читается`, () => {
      expect(contrast(c.controlInk, c.controlFill)).toBeGreaterThanOrEqual(SHAPE_CONTRAST);
      expect(contrast(c.controlInk, c.background)).toBeGreaterThanOrEqual(SHAPE_CONTRAST);
      expect(contrast(c.onReinforcement, c.reinforcement)).toBeGreaterThanOrEqual(TEXT_CONTRAST);
    });
  });
});
