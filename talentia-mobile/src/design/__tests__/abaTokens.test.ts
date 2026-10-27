/**
 * Контракт визуального языка ABA-режима (ABA.md, «Визуальный язык»). Главное
 * правило — цвет не бывает дискриминативным стимулом — проверяется здесь, а не
 * на ревью: иначе однажды «чуть подсветить верный вариант зелёным» пройдёт.
 */
import * as fs from 'fs';
import * as path from 'path';
import { adultPanelButtons, type PanelButton, type PanelStep } from '../../domain/abaScoring';
import { ladderUp, promptLadder, promptVisualFor } from '../../domain/abaPrompting';
import { UNDO_WINDOW_MS } from '../../domain/abaUndo';
import type { AbaTarget, RoutineRunKind } from '../../types/aba';
import {
  ABA_OVERLAY_CONTENT_HEIGHT,
  abaAccessScene,
  abaChannelVolume,
  abaChildTouch,
  abaConsequence,
  abaInterTrial,
  abaNextSdAt,
  abaReinforcementOverlay,
  abaReinforcementOverlayHeight,
  abaReinforcerChoice,
  abaSound,
  abaTokenLandingMs,
  abaTouchCommits,
  abaWhoLeadsAccepts,
  abaWhoLeadsSheet,
  type AbaSoundChannel,
  abaBoardCell,
  abaBreak,
  abaCalm,
  abaIdentifyGrid,
  abaIdentifyHeight,
  abaIdentifyPlate,
  abaReinforcerCard,
  abaReinforcerCardSize,
  abaRoutine,
  abaRoutineKindLabelKey,
  abaStripCell,
  ABA_STRIP_SILHOUETTE,
  ABA_STRIP_SILHOUETTE_GAP,
  inactiveHatchColor,
  inactiveTapTravel,
  promptVisualSingleLevel,
  ABA_CONTROL_STROKE,
  ABA_PROMPT_MARK_STROKE,
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
import {
  buildTheme,
  cushionByRole,
  elevation,
  motion,
  palettes,
  pressScale,
  radii,
  selectedRepeatPress,
  stroke,
  touch,
  type Scheme,
} from '../tokens';

const SCHEMES: Scheme[] = ['light', 'dark'];

/** Цвета, которые ребёнок видит на экране пробы рядом со стимулом. */
const trialColors = (c: AbaColors) => [c.background, c.plate, c.plateOutline, c.ink];
/** Те же плюс штриховка неактивной плиты (Ц2.5) — единственный четвёртый цвет интерфейса пробы. */
const trialColorsWithInactive = (c: AbaColors) => [...trialColors(c), c.inactiveHatch];

/** Насыщенность по HSL, 0–1: штриховка — нейтраль, а не цвет-сигнал. */
function hslSaturation(hex: string): number {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  return max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
}

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
      trialColorsWithInactive(abaColors[scheme]).forEach((x) => expect(forbidden.has(x.toUpperCase())).toBe(false));
    });

    it(`${scheme}: жёлтый — только у жетона, фиолетовый — только на экране подкрепления`, () => {
      const c = abaColors[scheme];
      expect(trialColorsWithInactive(c)).not.toContain(c.tokenEarned);
      expect(trialColorsWithInactive(c)).not.toContain(c.reinforcement);
    });
  });

  it('штриховка (Ц2.5) — новый hex под старую роль «неактивно»: не совпадает ни с одним другим цветом ABA', () => {
    SCHEMES.forEach((scheme) => {
      const c = abaColors[scheme];
      const others = (Object.keys(c) as (keyof AbaColors)[]).filter((k) => k !== 'inactiveHatch').map((k) => c[k].toUpperCase());
      expect(others).not.toContain(c.inactiveHatch.toUpperCase());
      expect(trialColorsWithInactive(c)).toHaveLength(trialColors(c).length + 1);
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
    const maxMark = Math.max(
      ...formats.flatMap((f) => levels.map((l) => promptVisual[f][l].markSize)),
      ...Object.values(promptVisual.single).map((v) => v.markSize),
    );
    expect(abaLayout.hintBand).toBeGreaterThanOrEqual(maxMark);
    expect(abaLayoutCompact.hintBand).toBe(abaLayout.hintBand);
  });

  it('пунктирной направляющей нет ни на одном уровне ни в одном формате (Г5: при 8 pt нечитаема)', () => {
    [...formats.flatMap((f) => levels.map((l) => promptVisual[f][l])), ...Object.values(promptVisual.single)].forEach((v) =>
      expect(v.guide).toBe('none'),
    );
    // identify: L2 и L3 различает число активных плит
    expect(promptVisual.identify[2].activeChoices).not.toBe(promptVisual.identify[3].activeChoices);
  });

  describe('одна плита — promptVisual.single (Г5)', () => {
    const single = promptVisual.single;

    it('есть L0, L1 (открытый шеврон 32 над плитой) и L3; уровня 2 в таблице нет', () => {
      expect(Object.keys(single).sort()).toEqual(['0', '1', '3']);
      expect(single[0].mark).toBe('none');
      expect(single[1]).toMatchObject({ mark: 'chevron_open', markOn: 'plate', markSize: 32, plateStroke: ABA_STIMULUS_STROKE });
      expect(single[3]).toMatchObject({ mark: 'triangle_solid', markOn: 'plate', markSize: 32, plateStroke: 6 });
    });

    it('три существующих уровня различимы бесцветным неподвижным признаком, контур не убывает', () => {
      const keys = [0, 1, 3] as const;
      keys.forEach((a) =>
        keys.forEach((b) => {
          if (a >= b) return;
          const pa = single[a];
          const pb = single[b];
          expect(pa.mark !== pb.mark || pa.plateStroke !== pb.plateStroke).toBe(true);
        }),
      );
      expect(single[3].plateStroke).toBeGreaterThanOrEqual(single[1].plateStroke);
      Object.values(single).forEach((v) => {
        expect(v.pulse).toBe(false);
        expect(v.activeChoices).toBe('all'); // одна плита: неактивных нет, подсказка не «убирает»
      });
    });

    it('L2 на экране совпадает с L3, L4 тоже; L0 и L1 свои (L2/L3 различают модель и панель)', () => {
      expect(promptVisualSingleLevel(0)).toBe(0);
      expect(promptVisualSingleLevel(1)).toBe(1);
      expect(promptVisualSingleLevel(2)).toBe(3);
      expect(promptVisualSingleLevel(3)).toBe(3);
      expect(promptVisualSingleLevel(4)).toBe(3);
    });

    it('у эхоики и подражания L2 нет: лестница L0 → L1 → L3 целиком укладывается в таблицу', () => {
      const imitative = [
        { format: 'imitate_sound' as const },
        { format: 'repeat_word' as const },
        { format: 'do_action' as const, sdKind: 'imitation' as const },
      ];
      imitative.forEach((t) => {
        const ladder = promptLadder(t);
        expect(ladder).toBe('imitative');
        const path: number[] = [0];
        while (path[path.length - 1] < 3) path.push(ladderUp(path[path.length - 1] as 0 | 1 | 2 | 3, ladder));
        expect(path).toEqual([0, 1, 3]);
        path.forEach((l) => expect(single).toHaveProperty(String(l)));
      });
    });

    it('стандартная лестница (действие, громкость) проходит L0–L3: каждый уровень отображается', () => {
      const std = promptLadder({ format: 'do_action' });
      expect(std).toBe('standard');
      ([0, 1, 2, 3] as const).forEach((l) => expect(single).toHaveProperty(String(promptVisualSingleLevel(l))));
    });
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

  it('пульс — один раз, коротко, только над образцом match (L1–L3 до касания образца, №163)', () => {
    expect(PROMPT_PULSE.count).toBe(1);
    expect(PROMPT_PULSE.durationMs).toBe(motion.slow);
    expect(PROMPT_PULSE.scale).toBeLessThanOrEqual(1.06);
    const pulsing = formats.flatMap((f) => levels.filter((l) => promptVisual[f][l].pulse).map((l) => `${f}${l}`));
    expect(pulsing).toEqual(['match1', 'match2', 'match3']);
  });

  it('неактивная плита приглушена штриховкой, а не прозрачностью, и не реагирует', () => {
    expect(inactiveChoice).not.toHaveProperty('opacity');
    expect(inactiveChoice.pattern).toBe('hatched_45');
    expect(inactiveChoice.cushion).toBe(false);
    expect(inactiveChoice.reactsToTap).toBe(false);
    expect(inactiveChoice.hiddenFromScreenReader).toBe(true);
  });

  it('тап по неактивной плите: сжатие 0.94 за 90 мс, без звука и без записи (I-6, V-9)', () => {
    expect(inactiveChoice.tapPress).toEqual({
      scale: 0.94,
      durationMs: motion.press,
      heldUntil: 'touch_up',
      sound: false,
      records: false,
    });
    // раунд 5: сжатие держится до отпускания — под пальцем 90 мс с возвратом не видно
    expect(inactiveChoice.tapPress.durationMs).toBe(90);
    expect(inactiveChoice.tapPress.durationMs).toBeLessThanOrEqual(100);
    // 0.98 давало 1 pt на 96 и 0.7 pt на 72 — незаметно; 0.94 — ≈ 2.9 и ≈ 2.2
    expect(inactiveChoice.tapPress.scale).toBeLessThan(pressScale.wide);
    expect(inactiveTapTravel(96)).toBeGreaterThanOrEqual(2.8);
    expect(inactiveTapTravel(72)).toBeGreaterThanOrEqual(2);
    expect(inactiveTapTravel(56)).toBeGreaterThanOrEqual(1.5); // плита расписания 5–6 лет на 360 — самая тонкая
    expect((72 * (1 - pressScale.wide)) / 2).toBeLessThan(1); // прежний ход края на 72: 0.72 pt
  });

  describe('штриховка неактивной плиты — inactiveHatch #B5A08C в обеих схемах (Ц2.5, UX «важно» 7)', () => {
    it('цвет штриховки — inactiveHatch, один hex в обеих схемах; не plateOutline (цикл 1) и не ink', () => {
      expect(inactiveChoice.hatchColor).toBe('inactiveHatch');
      SCHEMES.forEach((scheme) => {
        expect(inactiveHatchColor(scheme)).toBe(abaColors[scheme].inactiveHatch);
        expect(inactiveHatchColor(scheme)).toBe('#B5A08C');
        expect(inactiveHatchColor(scheme)).not.toBe(abaColors[scheme].plateOutline);
        expect(inactiveHatchColor(scheme)).not.toBe(abaColors[scheme].ink);
      });
      // регрессия Г6: ink в тёмной схеме давал ≈ 1.2:1 к плите — штриховка не видна вовсе
      expect(contrast(abaColors.dark.ink, abaColors.dark.plate)).toBeLessThan(SHAPE_CONTRAST);
    });

    SCHEMES.forEach((scheme) => {
      const c = abaColors[scheme];
      it(`${scheme}: штриховка к плите от 2 до 3:1 — видна, но не «звенит» (условие UX ≤ 3)`, () => {
        const k = contrast(inactiveHatchColor(scheme), c.plate);
        expect(k).toBeGreaterThanOrEqual(2);
        expect(k).toBeLessThanOrEqual(SHAPE_CONTRAST);
        // прежняя решётка plateOutline — ≥ 13:1, риск pattern glare
        expect(contrast(c.plateOutline, c.plate)).toBeGreaterThan(13);
      });

      it(`${scheme}: контур плиты и предмета #2A1A12 различим на штриховке ≥ 3 (6.67)`, () => {
        expect(contrast(c.plateOutline, inactiveHatchColor(scheme))).toBeGreaterThanOrEqual(SHAPE_CONTRAST);
        expect(contrast(c.plateOutline, inactiveHatchColor(scheme))).toBeCloseTo(6.67, 1);
      });
    });

    it('посчитанные в Ц2.5 числа: 2.51 светлая, 2.04 тёмная', () => {
      expect(contrast(inactiveHatchColor('light'), abaColors.light.plate)).toBeCloseTo(2.51, 2);
      expect(contrast(inactiveHatchColor('dark'), abaColors.dark.plate)).toBeCloseTo(2.04, 2);
    });

    it('штриховка — тёплая нейтраль (насыщенность ≤ 0.3), а не новый цвет-сигнал', () => {
      expect(hslSaturation(inactiveHatchColor('light'))).toBeLessThanOrEqual(0.3);
      expect(hslSaturation(abaColors.light.tokenEarned)).toBeGreaterThan(0.9); // для сравнения: жёлтый жетона
    });

    it('слои: штриховка под картинкой — предмет не перечёркивается (Ц2.5)', () => {
      expect(inactiveChoice.layer).toBe('under_picture');
    });

    it('токен ↔ промпт: строки aba-hatch в DESIGN_PROMPTS.md (цвет и контраст) совпадают с abaColors', () => {
      const doc = fs.readFileSync(path.join(__dirname, '..', '..', '..', '..', 'DESIGN_PROMPTS.md'), 'utf8');
      const rows = [...doc.matchAll(/^aba-hatch (\w+) (#[0-9A-Fa-f]{6}) ([\d.]+)[ \t\r]*$/gm)];
      expect(rows.map((r) => r[1]).sort()).toEqual([...SCHEMES].sort());
      rows.forEach(([, scheme, hex, ratio]) => {
        const s = scheme as Scheme;
        expect(hex.toUpperCase()).toBe(inactiveHatchColor(s).toUpperCase());
        expect(Math.abs(contrast(inactiveHatchColor(s), abaColors[s].plate) - Number(ratio))).toBeLessThan(0.015);
      });
    });
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

  it('identify: четыре плиты — сетка 2×2 (в ряд не помещаются), блок не выше плиты стимула своего тира (I-8, Д6)', () => {
    const g = abaIdentifyGrid;
    expect(g.fourLayout).toBe('grid_2x2');
    expect(g.rowGapForFour).toBe(40);
    expect(g.colGapForFour).toBe(40); // по обеим осям (условие child-ux-specialist)
    expect(g.plateForFour).toEqual({ roomy: 96, compact: 80, tight: 68 });
    const byTier = { roomy: 'regular', compact: 'compact', tight: 'tight' } as const;
    const blockFour: Record<AbaTier, number> = { roomy: 232, compact: 200, tight: 176 };
    TIERS.forEach((t) => {
      const plate = abaChoiceZone[byTier[t]].choice;
      expect(4 * plate + 3 * abaLayout.plateGap).toBeGreaterThan(g.minContentWidth); // ряд из четырёх не влезает ни в один тир
      expect(abaIdentifyHeight(t, 3)).toBe(plate);
      expect(abaIdentifyPlate(t, 3)).toBe(plate);
      const p4 = abaIdentifyPlate(t, 4);
      expect(p4).toBe(g.plateForFour[t]);
      expect(abaIdentifyHeight(t, 4)).toBe(2 * p4 + g.rowGapForFour);
      expect(abaIdentifyHeight(t, 4)).toBe(blockFour[t]);
      expect(abaIdentifyHeight(t, 4)).toBeLessThanOrEqual(abaLayoutByTier[t].stimulus);
      expect(plate).toBeGreaterThanOrEqual(touch.min);
      expect(p4).toBeGreaterThanOrEqual(touch.min);
    });
  });

  it('identify 2×2: метка подсказки ≤ зазор над каждой плитой; две плиты и зазор помещаются по ширине (Д6)', () => {
    const g = abaIdentifyGrid;
    const marks = ([1, 2, 3] as const).map((l) => promptVisual.identify[l].markSize);
    marks.forEach((m) => expect(m).toBe(32));
    const need = g.markGapToOwn + Math.max(...marks) + g.markGapToOther;
    expect(g.markGapToOwn).toBe(2);
    expect(g.markGapToOther).toBe(6);
    expect(need).toBe(40);
    // асимметрия: метка ближе к своей плите, чем к чужой
    expect(g.markGapToOwn).toBeLessThan(g.markGapToOther);
    TIERS.forEach((t) => {
      const l = abaLayoutByTier[t];
      // верхний ряд: метка в полосе подсказки над блоком (6 до инструкции, 32, 2 до плиты)
      expect(need).toBeLessThanOrEqual(l.hintBand);
      // нижний ряд: метка в зазоре между рядами (6 до верхней плиты, 32, 2 до своей)
      expect(need).toBeLessThanOrEqual(g.rowGapForFour);
      // ширина: две плиты + горизонтальный зазор в контенте экрана 360
      expect(2 * g.plateForFour[t] + g.colGapForFour).toBeLessThanOrEqual(g.minContentWidth);
      // метка не шире своей плиты — её зона нажатия целиком над своей плитой
      expect(Math.max(...marks)).toBeLessThanOrEqual(g.plateForFour[t]);
    });
    expect(g.minContentWidth).toBe(360 - 2 * abaControls.edgeInset);
  });

  it('identify 2×2: зазор между зонами нажатия ≥ touch.gap при показанной метке; зона метки обрезана сверху (второй цикл UX)', () => {
    const g = abaIdentifyGrid;
    // рисунок метки прежний: 2 / 32 / 6
    expect(g.markGapToOwn + 32 + g.markGapToOther).toBe(g.rowGapForFour);
    // зона метки — 2 + 22 над своей плитой, дальше мёртвая полоса 16 до чужой
    expect(g.markHitHeight).toBe(22);
    expect(g.markDeadBand).toBe(touch.gap);
    expect(g.markHitHeight).toBeLessThan(32); // обрезана: верх метки не нажимается
    expect(g.markGapToOwn + g.markHitHeight + g.markDeadBand).toBe(g.rowGapForFour);
    // по вертикали: от верха зоны нижней плиты (с меткой) до верхней плиты
    const verticalGap = g.rowGapForFour - (g.markGapToOwn + g.markHitHeight);
    expect(verticalGap).toBeGreaterThanOrEqual(touch.gap);
    // по горизонтали: метка не шире плиты, зоны не выходят в зазор колонок
    expect(g.colGapForFour).toBeGreaterThanOrEqual(touch.gap);
    TIERS.forEach((t) => expect(32).toBeLessThanOrEqual(g.plateForFour[t]));
  });

  it('identify 2×2: верх метки в мёртвой полосе не молчит — сжатие метки 0.94 до отпускания, без звука, записи и влияния на окно (раунд 5, UX 2)', () => {
    const g = abaIdentifyGrid;
    expect(g.markDeadTop).toBe(32 - g.markHitHeight);
    expect(g.markDeadBandTap).toEqual({
      target: 'mark',
      scale: 0.94,
      durationMs: motion.press,
      heldUntil: 'touch_up',
      sound: false,
      records: false,
      affectsResponseWindow: false,
    });
    // тот же видимый отклик, что у неактивной плиты
    expect(g.markDeadBandTap.scale).toBe(inactiveChoice.tapPress.scale);
    const src = fs.readFileSync(path.join(__dirname, '..', 'abaTokens.ts'), 'utf8');
    expect(src).toMatch(/Переспросить у методиста \(вопрос 8\)/);
  });

  it('штрих метки подсказки — 3 во всех режимах, calm его не понижает (раунд 5, М7)', () => {
    expect(ABA_PROMPT_MARK_STROKE).toBe(3);
    expect(ABA_PROMPT_MARK_STROKE).toBe(ABA_STIMULUS_STROKE);
    SCHEMES.forEach((scheme) => {
      const calm = buildTheme({ scheme, calmMode: true, focusMode: false });
      expect(calm.stroke.base).toBeLessThan(ABA_PROMPT_MARK_STROKE);
    });
  });

  it('identify 2×2: касание метки = касание её плиты; принято, ждёт подтверждения методиста (вопрос 8)', () => {
    expect(abaIdentifyGrid.markTap).toBe('own_plate');
    const src = fs.readFileSync(path.join(__dirname, '..', 'abaTokens.ts'), 'utf8');
    expect(src).toMatch(/подтвердить у методиста \(вопрос 8\)/);
  });

  describe('политика окна — запрет с причиной (№100, Г9)', () => {
    it('тир один раз на сессию; на родительском экране мягкая оценка без блока; проверка — на корне первого экрана ABA (V-5)', () => {
      expect(abaWindowPolicy.tierChosen).toBe('once_per_session');
      expect(abaWindowPolicy.parentScreen).toBe('soft_estimate');
      expect(abaWindowPolicy.parentScreenBlocks).toBe(false);
      expect(abaWindowPolicy.finalCheck).toBe('on_first_aba_screen');
      expect(abaWindowPolicy.finalCheckScreen).toBe('config_choice');
      expect(abaWindowPolicy.keepListening).toBe(true);
      expect(abaWindowPolicy.passesOnGrow).toBe('auto');
    });

    it('ниже порога: блок с причиной без чисел и двумя кнопками 56 через зазор ≥ 16; «Обычные уроки» — разовый переход', () => {
      expect(abaWindowPolicy.belowMin).toBe('block_with_reason');
      expect(abaWindowPolicy.belowMinReason).toBe('screen_too_small');
      expect(abaWindowPolicy.belowMinReasonHasNumbers).toBe(false);
      expect([...abaWindowPolicy.belowMinButtons]).toEqual(['regular_lessons', 'back']);
      expect(abaWindowPolicy.belowMinButtonHeight).toBe(56);
      expect(abaWindowPolicy.belowMinButtonHeight).toBeGreaterThanOrEqual(touchAdult);
      expect(abaWindowPolicy.belowMinButtonGap).toBeGreaterThanOrEqual(16);
      expect(abaWindowPolicy.regularLessons).toEqual({ oneShot: true, writesMode: false });
      expect(abaWindowPolicy.childSeesTrial).toBe(false);
      // токены согласованы с политикой: на окне ниже порога тира нет, показывать пробу нечем
      expect(abaTierFor(ABA_MIN_AVAILABLE_HEIGHT - 1, 48)).toBeNull();
    });

    it('известный риск (V-5): 360×640 с тремя кнопками — запас над порогом всего 8 pt; описан в токене', () => {
      expect(568 - ABA_MIN_AVAILABLE_HEIGHT).toBe(8);
      expect(abaTierFor(ABA_MIN_AVAILABLE_HEIGHT + 8, 48)).toBe('tight');
      expect(abaTierFor(ABA_MIN_AVAILABLE_HEIGHT - 1, 48)).toBeNull();
      const src = fs.readFileSync(path.join(__dirname, '..', 'abaTokens.ts'), 'utf8');
      expect(src).toMatch(/ИЗВЕСТНЫЙ РИСК \(V-5\)/);
    });

    it('сжатие окна в сессии — пауза: плита скрыта, проба interruptedBy app в очередь, панель внизу, без перестройки', () => {
      expect(abaWindowPolicy.onWindowChange).toBe('pause');
      expect(abaWindowPolicy.pause).toEqual({
        stimulusHidden: true,
        trialInterruptedBy: 'app',
        requeue: true,
        adultCard: 'restore_window_size',
        panelPinnedBottom: true,
        relayout: false,
      });
    });

    it('формулировки «только предупреждение» и «решает владелец» в токенах не осталось', () => {
      const src = fs.readFileSync(path.join(__dirname, '..', 'abaTokens.ts'), 'utf8');
      expect(src).not.toMatch(/warn_adult_on_enable|warn_adult_no_relayout|решает\s+владелец/);
    });
  });

  it('верхняя полоса при 360 pt: выход, карточка «перерыв» и точки восьми звеньев рутины с полями 16 помещаются; счётчика проб нет (I-3)', () => {
    const d = abaRoutine.run.dots;
    const dotsWidth = (d.max - 1) * d.done + d.current + (d.max - 1) * d.gap;
    const center = 360 - abaControls.edgeInset * 2 - abaControls.exitSize - abaControls.breakSize - 2 * 8;
    expect(dotsWidth).toBe(170);
    expect(dotsWidth).toBeLessThanOrEqual(center);
    expect(abaControls.edgeInset).toBeGreaterThanOrEqual(16);
    expect(abaRoutine.run.trialCounterForChild).toBe(false);
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

  describe('тап ребёнка ставит панель в очередь, нажатия не теряются (Г2)', () => {
    const lock = abaAdultPanel.childTapLock;

    it('окно 400 мс от первого тапа, серией не продлевается, потолка серии больше нет', () => {
      expect(abaAdultPanel.childTapLockMs).toBe(400);
      expect(lock.extendedBySeries).toBe(false);
      expect(lock).not.toHaveProperty('seriesCapMs');
    });

    it('нажатие взрослого в окне: «нажата» ≤ 100 мс, применение по снятии окна ≤ 400 мс, respondedAt = касание, побеждает первая', () => {
      expect(lock.adultTapFeedback).toBe('pressed_queued');
      expect(lock.pressedStateMaxMs).toBeLessThanOrEqual(100);
      expect(lock.applyAfterWindowMaxMs).toBeLessThanOrEqual(400);
      expect(lock.applyAfterWindowMaxMs).toBeGreaterThanOrEqual(abaAdultPanel.childTapLockMs);
      expect(lock.respondedAt).toBe('touch_down');
      expect(lock.twoButtonsInWindow).toBe('first_wins');
      expect(lock.lockAfterMark).toBe(true);
    });

    it('две кнопки в окне: вторая не вдавливается, первая остаётся вдавленной до применения (V-1)', () => {
      expect(lock.twoButtonsInWindow).toBe('first_wins');
      expect(lock.secondButtonPressed).toBe(false);
      expect(lock.firstStaysPressedUntil).toBe('applied');
    });

    it('«Отказ»/«Сопротивляется» отменяют отложенную отметку и показывают её снятой; очередь привязана к пробе (V-2)', () => {
      expect(lock.pendingMark).toEqual({
        cancelledByNeverBlocked: true,
        cancelledShownAs: 'released',
        boundTo: 'trialId_at_touch_down',
        resetOnPhaseChange: true,
      });
    });

    it('«Отказ» доступен всегда, слот не меняется и отмена его не вытесняет (V-3)', () => {
      const r = abaAdultPanel.refusal;
      expect(r.alwaysAvailable).toBe(true);
      expect(r.inAnswerWindow).toBe('trial_refusal');
      expect(r.outsideTrial).toBe('withdraw_assent');
      expect(r.displacedByUndo).toBe(false);
      expect(r.slot).toEqual(abaAdultPanelSlot.refusal);
      // слот отмены — левый слот ряда 2, «Отказ» — правый: пересечения нет
      expect(abaAdultPanelSlot.undo).not.toEqual(r.slot);
      expect(abaAdultPanelSlot.undo.row).toBe(r.slot.row);
    });

    it('«Отказ» и «Сопротивляется» не блокируются никогда — как выход и «перерыв»', () => {
      expect([...lock.neverBlocked].sort()).toEqual(['l4_resisted', 'refusal']);
      expect(lock.triggeredByBreakOrExit).toBe(false);
      // обе — настоящие кнопки панели в своих слотах
      lock.neverBlocked.forEach((id) => expect(abaAdultPanelSlot).toHaveProperty(id));
    });

    it('ошибочную страхует «Исправить отметку» 5 с — то же окно, что у домена (UNDO_WINDOW_MS)', () => {
      expect(abaAdultPanel.undo.windowMs).toBe(5000);
      expect(abaAdultPanel.undo.windowMs).toBe(UNDO_WINDOW_MS);
    });
  });

  it('«исправить отметку»: 5 с, один уровень, левый слот ряда 2, не растянута; «Отказ» не занимает', () => {
    expect(abaAdultPanel.undo).toMatchObject({
      windowMs: 5000, row: 1, col: 0, span: 'slot', levels: 1, endsWith: 'reinforcement_phase',
    });
    expect(abaAdultPanelSlot.undo).toEqual({ row: abaAdultPanel.undo.row, col: abaAdultPanel.undo.col });
    // не пересекается с позицией «Отказ» и с рядом 1 окна ответа; делит слот только с «Была подсказка»,
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
      adult_prompted: 'Была подсказка',
      refusal: 'Отказ',
      l4_done: 'Сделали вместе',
      l4_resisted: 'Сопротивляется',
      l4_skipped: 'Пропустить',
      adult_completed: 'Звено — самостоятельно',
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

  it('оценка касанием (№159): слоты отметок пусты, «Была подсказка» и «Отказ» не сдвигаются', () => {
    const step = (scoredBy: PanelStep['scoredBy']): PanelStep => ({ scoredBy, startPromptLevel: 0, askAdultForL4: false });
    const adult = adultPanelButtons('with_adult', step('adult'), false);
    const device = adultPanelButtons('with_adult', step('device_tap'), false);
    expect(adult).toContain('approximation');
    expect(device).not.toContain('approximation');
    expect(device).toEqual(['adult_prompted', 'refusal']);
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

  it('штриховка неактивной плиты: шаг 16, в calm 24 (Ц2.5; цикл 1 — 8 / 12), толщина штриха 2', () => {
    expect(inactiveChoice.hatchStep).toBe(16);
    expect(inactiveChoice.hatchStepCalm).toBe(24);
    expect(inactiveChoice.hatchStepCalm).toBeGreaterThan(inactiveChoice.hatchStep);
    expect(inactiveChoice.hatchStroke).toBe(2);
    // на самой мелкой плите выбора (72) остаётся несколько штрихов — состояние читается и в calm
    expect(abaChoiceZone.tight.choice / inactiveChoice.hatchStepCalm).toBeGreaterThanOrEqual(3);
    expect(Math.min(...Object.values(abaIdentifyGrid.plateForFour)) / inactiveChoice.hatchStepCalm).toBeGreaterThanOrEqual(2.5);
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

describe('экран перерыва: один для трёх инициаторов (Г3, №99, №106)', () => {
  it('три инициатора на одном экране; Tali и награды — только не у карточки ребёнка', () => {
    expect([...abaBreak.initiators]).toEqual(['child_card', 'schedule', 'device_offer']);
    expect(abaBreak.taliSlot).toEqual({ child_card: false, schedule: true, device_offer: true });
    expect(abaBreak.childCardShows).toEqual({ tali: false, tokens: false, praise: false, choice: false });
    expect(abaBreak.endScreen).toEqual({ tali: false, farewell: false, praise: false });
  });

  it('обучение карточке — настоящий перерыв 15–20 с, реакция ≤ 300 мс', () => {
    expect(abaBreak.trainingSeconds).toEqual({ min: 15, max: 20 });
    expect(abaBreak.reactionMaxMs).toBeLessThanOrEqual(300);
  });

  it('иконка 120 помещается в кольцо 160 без чисел (внутренний диаметр с контурами); calm — шагами 1 с; кнопка 88', () => {
    expect(abaBreak.icon).toBe(120);
    expect(abaBreak.timerRing).toBe(160);
    expect(abaBreak.icon).toBeLessThanOrEqual(abaBreak.timerRing - 2 * 2 * ABA_CONTROL_STROKE);
    expect(abaBreak.timerNumbers).toBe(false);
    expect(abaBreak.timerCalmStepMs).toBe(1000);
    expect(abaBreak.returnButton).toBe(touch.primary);
  });

  it('приглашение вернуться: по окончании таймера и через 30 с, один тихий сигнал, статичный контур 6, без пульса и эскалации', () => {
    const i = abaBreak.invite;
    expect(i.atTimerEnd).toBe(true);
    expect(i.repeatAfterMs).toBe(30_000);
    expect(i.signalsPerInvite).toBe(1);
    expect(i.contour).toBe(6);
    expect(i.pulse).toBe(false);
    expect(i.escalation).toBe(false);
    expect(i.invitesBeforeEnd).toBe(2);
    SCHEMES.forEach((scheme) => {
      const c = abaColors[scheme];
      expect(contrast(c.controlInk, c.background)).toBeGreaterThanOrEqual(SHAPE_CONTRAST); // контур приглашения виден
    });
  });

  it('«Tali предлагает перерыв»: Tali 88, карточка 120, «Дальше» 88, от карточки до «Дальше» ≥ 48; помещается в малый тир', () => {
    const o = abaBreak.offer;
    expect(o.tali).toBe(88);
    expect(o.card).toBe(120);
    expect(o.card).toBeGreaterThanOrEqual(touch.min);
    expect(o.nextButton).toBe(touch.primary);
    expect(o.minGapCardToNext).toBeGreaterThanOrEqual(48);
    const stack = o.tali + o.gapTaliToCard + o.card + o.minGapCardToNext + o.nextButton;
    expect(stack).toBe(368);
    expect(stack + abaLayout.topBar).toBeLessThanOrEqual(ABA_MIN_AVAILABLE_HEIGHT);
  });

  it('к концу таймера кольцо убирается, иконка и кнопка остаются на месте, ничего не движется (V-4а)', () => {
    const e = abaBreak.atTimerEnd;
    expect(e.ringHidden).toBe(true);
    expect(e.iconStays).toBe(abaBreak.icon);
    expect(e.buttonStays).toBe(abaBreak.returnButton);
    expect(e.ringSlotReserved).toBe(true);
    expect(e.animated).toBe(false);
    expect(abaBreak.invite.contour).toBe(6); // статичный контур остаётся
    expect(abaBreak.invite.pulse).toBe(false);
  });

  it('«Вернуться»: значок не стрелка, а контурные «две планки»; не «карта» — она у выхода взрослого (V-4б)', () => {
    expect(abaBreak.returnIcon).toEqual({ glyph: 'pause_bars_outline', size: 32, replacesArrow: true });
    expect(abaBreak.returnIcon.glyph).not.toMatch(/arrow|map/);
  });

  it('у взрослого есть выход с экрана перерыва: слева сверху, 60, удержание 1500 / 300 без отклика, как на пробе (V-4в)', () => {
    const x = abaBreak.adultExit;
    expect(x.position).toBe('top_left');
    expect(x.size).toBe(abaControls.exitSize);
    expect(x.holdMs).toBe(abaControls.exitHoldMs);
    expect(x.idleMs).toBe(abaControls.exitHoldIdleMs);
    expect(x.sameAsTrial).toBe(true);
  });

  it('«Tali предлагает перерыв» без касания 60 с — нейтральный конец сессии, не автоперерыв (У-3)', () => {
    expect(abaBreak.offer.idleEndMs).toBe(60_000);
    expect(abaBreak.offer.idleEnd).toBe('neutral_end');
  });

  it('вне пробы карточка просьбой не принимается (№106)', () => {
    expect(abaBreak.outsideTrialCardAccepted).toBe(false);
  });
});

describe('calm в ABA (V10, I-4)', () => {
  it('жетон на месте без падения; плашка контурная; залитая площадь ≤ 25% экрана', () => {
    expect(abaCalm.tokenArrival).toBe('in_place');
    expect(abaCalm.reinforcementPanel).toBe('outline_only');
    expect(abaCalm.maxFilledShare).toBeLessThanOrEqual(0.25);
    expect(abaCalm.panelStroke).toBe(ABA_CONTROL_STROKE);
  });

  SCHEMES.forEach((scheme) => {
    it(`${scheme}: контур плашки подкрепления виден на фоне экрана ≥ 3, текст ink читается`, () => {
      const c = abaColors[scheme];
      expect(contrast(c.reinforcement, c.background)).toBeGreaterThanOrEqual(SHAPE_CONTRAST);
      expect(contrast(c.ink, c.background)).toBeGreaterThanOrEqual(TEXT_CONTRAST);
    });
  });
});

describe('доска и карточки подкрепителя по ширине экрана (Г8)', () => {
  it('ячейка крупной доски: 64 на 390, 60 на 375, 56 на 360; пять ячеек всегда помещаются в контент', () => {
    expect(abaBoardCell(358)).toBe(64);
    expect(abaBoardCell(343)).toBe(60);
    expect(abaBoardCell(328)).toBe(56);
    for (let inner = 280; inner <= 430; inner++) {
      for (let n = 1; n <= abaTokenBoard.maxPerRow; n++) {
        const cell = abaBoardCell(inner, n);
        expect(cell % 4).toBe(0);
        expect(cell).toBeLessThanOrEqual(abaTokenBoard.largeMax);
        if (inner >= 280 && n <= 5) expect(n * cell + (n - 1) * abaTokenBoard.gap).toBeLessThanOrEqual(inner);
      }
    }
    // прежние 5 × 64 + 4 × 8 = 352 не помещались в 328 (экран 360)
    expect(5 * 64 + 4 * abaTokenBoard.gap).toBeGreaterThan(328);
  });

  it('формула ячейки для пяти равна min(64, 4·floor((inner − 32)/20))', () => {
    for (let inner = 280; inner <= 430; inner++) {
      expect(abaBoardCell(inner)).toBe(Math.min(64, 4 * Math.floor((inner - 32) / 20)));
    }
  });

  it('доска в полосе пробы (У-1): до пяти ячеек всегда 48 и помещается на 360; сужение только при n > 5', () => {
    [390, 375, 361, 360].forEach((w) => {
      [1, 3, 5].forEach((n) => expect(abaStripCell(w, n)).toBe(48));
      const row = 5 * abaStripCell(w) + 4 * abaTokenBoard.gap;
      // поля + силуэт 40 + зазор 8 + ряд; на 360 это 320 + 32 = 352 ≤ 360
      expect(abaControls.edgeInset * 2 + ABA_STRIP_SILHOUETTE + ABA_STRIP_SILHOUETTE_GAP + row).toBeLessThanOrEqual(w);
    });
    expect(ABA_STRIP_SILHOUETTE + ABA_STRIP_SILHOUETTE_GAP + 5 * 48 + 4 * 8).toBe(320); // ≤ 328
    // с полями 2 × 16 — 352 ≤ 360 (прежняя запись «= 328 ≤ контента» складывала одно поле)
    expect(abaControls.edgeInset * 2 + ABA_STRIP_SILHOUETTE + ABA_STRIP_SILHOUETTE_GAP + 5 * 48 + 4 * 8).toBe(352);
    // n > 5: сужаем ровно настолько, чтобы ряд с силуэтом поместился, но не ниже minSize
    expect(abaStripCell(360, 6)).toBe(40);
    expect(abaStripCell(390, 6)).toBe(45);
    expect(abaStripCell(360, 7)).toBe(33);
    [6, 7].forEach((n) => {
      [360, 375, 390].forEach((w) => {
        const c = abaStripCell(w, n);
        expect(c).toBeLessThanOrEqual(48);
        expect(c).toBeGreaterThanOrEqual(abaTokenBoard.minSize);
        expect(32 + ABA_STRIP_SILHOUETTE + ABA_STRIP_SILHOUETTE_GAP + n * c + (n - 1) * abaTokenBoard.gap).toBeLessThanOrEqual(w);
      });
    });
    // известное ограничение: восемь ячеек с силуэтом на 360 не помещаются даже по 32
    expect(32 + ABA_STRIP_SILHOUETTE + ABA_STRIP_SILHOUETTE_GAP + 8 * 32 + 7 * 8).toBeGreaterThan(360);
  });

  it('карточки выбора подкрепителя: 160 на 390 и SE, 136 на 360×640 с тремя кнопками (запас 8, У-7); две в ряд помещаются', () => {
    expect(abaReinforcerCardSize(358, 763)).toBe(160);
    expect(abaReinforcerCardSize(343, 647)).toBe(160);
    expect(abaReinforcerCardSize(328, 568)).toBe(136);
    expect(abaReinforcerCard.reservedHeight).toBe(296);
    expect(abaReinforcerCard.heightReserve).toBeGreaterThanOrEqual(8);
    // без запаса было 2 × 140 + 288 = 568 = H — ноль
    expect(568 - (2 * abaReinforcerCardSize(328, 568) + abaReinforcerCard.reservedHeight)).toBe(0);
    expect(568 - (2 * abaReinforcerCardSize(328, 568) + (abaReinforcerCard.reservedHeight - abaReinforcerCard.heightReserve))).toBe(8);
    // прежние 160×160 в 328: 336 > 328
    expect(2 * 160 + abaReinforcerCard.gap).toBeGreaterThan(328);
    const cases: [number, number][] = [[328, 568], [328, 560], [343, 647], [358, 763], [358, 900]];
    cases.forEach(([w, h]) => {
      const c = abaReinforcerCardSize(w, h);
      expect(c).toBeGreaterThanOrEqual(touch.min);
      expect(2 * c + abaReinforcerCard.gap).toBeLessThanOrEqual(w);
      expect(2 * c + abaReinforcerCard.reservedHeight).toBeLessThanOrEqual(h);
    });
  });
});

describe('рутины самообслуживания (Г8)', () => {
  it('список «ждут прогона»: строка 64 (взрослая цель ≥ 48), картинка 40, метка вида словом для всех четырёх видов', () => {
    expect(abaRoutine.dueList.rowHeight).toBe(64);
    expect(abaRoutine.dueList.rowHeight).toBeGreaterThanOrEqual(touchAdult);
    expect(abaRoutine.dueList.picture).toBe(40);
    expect(abaRoutine.dueList.doneTodayPosition).toBe('bottom');
    expect(abaRoutine.dueList.doneTodayActive).toBe(false);
    const kinds: RoutineRunKind[] = ['baseline', 'teaching', 'maintenance', 'verification'];
    expect(Object.keys(abaRoutineKindLabelKey).sort()).toEqual([...kinds].sort());
    expect(new Set(Object.values(abaRoutineKindLabelKey)).size).toBe(4);
  });

  it('расписание до старта (У-2): 5–6 лет — плиты abaBoardCell(W, 5): 64 / 60 / 56; с 7 — две строки по 4×72; в контент помещается', () => {
    const s = abaRoutine.schedule;
    const g = s.gap;
    expect(s.band56.tile).toBe('abaBoardCell');
    expect(abaBoardCell(358, 5)).toBe(64);
    expect(abaBoardCell(343, 5)).toBe(60);
    expect(abaBoardCell(328, 5)).toBe(56);
    [358, 343, 328].forEach((w) => {
      const t = abaBoardCell(w, s.band56.perRow);
      expect(t).toBeGreaterThanOrEqual(s.band56.tileMin);
      expect(s.band56.perRow * t + (s.band56.perRow - 1) * g).toBeLessThanOrEqual(w);
    });
    expect(s.band56.maxSteps * s.band56.tileMin + (s.band56.maxSteps - 1) * g).toBe(312);
    // V-10: плиты не нажимаются, но отзываются так же, как неактивная плита выбора
    expect(s.tilePress).toBe('inactiveChoice.tapPress');
    expect(s.band7.perRow * s.band7.tile + (s.band7.perRow - 1) * g).toBe(312);
    expect(s.band7.maxSteps).toBe(2 * s.band7.perRow);
    expect(312).toBeLessThanOrEqual(328);
    expect(s.interactive).toBe(false); // плиты расписания не кнопки: 60 pt к ним не применяется
  });

  it('прогон: плита — картинка звена, счётчика проб нет, точки 14–16 различимы формой', () => {
    const r = abaRoutine.run;
    expect(r.plate).toBe('step_picture');
    expect(r.trialCounterForChild).toBe(false);
    expect(r.dots.done).toBeGreaterThanOrEqual(14);
    expect(r.dots.current).toBeLessThanOrEqual(16);
    expect(r.dots.current).toBeGreaterThan(r.dots.done);
    expect(r.dots.currentStroke).toBeGreaterThan(r.dots.upcomingStroke);
    expect(r.dots.centerDot).toBeLessThan(r.dots.current - 2 * r.dots.currentStroke);
    expect(r.dots.max).toBe(abaRoutine.schedule.band7.maxSteps);
    SCHEMES.forEach((scheme) => {
      const c = abaColors[scheme];
      expect(contrast(c.ink, c.background)).toBeGreaterThanOrEqual(SHAPE_CONTRAST);
    });
  });

  it('жетон ребёнку: цель ≤ 1 с, потолок 3 с; отметка звена видна ≤ 300 мс (У-5); запись и PIN после', () => {
    const w = abaRoutine.reward;
    expect(w.childSeesTokenTargetMs).toBeLessThanOrEqual(1000);
    expect(w.childSeesTokenWithinMs).toBeLessThanOrEqual(3000);
    expect(w.childSeesTokenTargetMs).toBeLessThan(w.childSeesTokenWithinMs);
    expect(w.linkMarkResponseMaxMs).toBeLessThanOrEqual(300);
    expect(w.commitAfter).toBe('adult_form');
  });

  it('взрослый режим рутины — один срок 5 минут, скользящий, как окно свежести PIN (V-7); PIN не после каждого прогона, биометрии нет', () => {
    const w = abaRoutine.reward;
    expect(w.pinAfterEveryRun).toBe(false);
    expect(w.biometrics).toBe(false);
    expect(w.adultModeMinutes).toBe(5);
    expect(w.adultModeSliding).toBe(true);
    expect(w.adultModeScope).toBe('routines_only');
    expect(w.formRowHeight).toBeGreaterThanOrEqual(touchAdult);
    const parent = fs.readFileSync(path.join(__dirname, '..', '..', '..', '..', 'PARENT.md'), 'utf8');
    expect(parent).toMatch(/Окно свежести 5 минут/); // тот же срок, что в Уровне 2
  });

  it('«Продолжить» на экране передачи — кнопка с удержанием, как выход; форма недоступна двумя тапами (V-6, V-7)', () => {
    const h = abaRoutine.reward.handoverContinue;
    expect(h.kind).toBe('hold');
    expect(h.height).toBeGreaterThanOrEqual(touchAdult);
    expect(h.idleMs).toBe(abaControls.exitHoldIdleMs);
    expect(h.holdMs).toBe(abaControls.exitHoldMs);
    expect(h.tapHint).toBe(true);
    expect(h.requiredWhenModeOpen).toBe(true);
    expect(abaRoutine.reward.form).toEqual({ reachableOnlyViaHold: true, preselected: false, saveNeedsSelection: true });
  });

  it('новый выбор подкрепителя после обмена рутины — экран выбора без вступления', () => {
    expect(abaRoutine.reinforcerRepick).toEqual({ screen: 'reinforcer_choice', intro: false });
  });
});

/* ───────────────── цикл 2 (Ц2.x и проверка UX цикла 2) ───────────────── */

describe('последствие пробы — время от markedAt (Ц2.6.1, №160)', () => {
  const o = abaReinforcementOverlay;

  it('всё считается от markedAt; до записи ничего не рисуется; цель markedAt − respondedAt ≤ 1 с', () => {
    expect(abaConsequence.timedFrom).toBe('markedAt');
    expect(abaConsequence.drawnBeforeRecord).toBe(false);
    expect(abaConsequence.markedAfterRespondedTargetMs).toBeLessThanOrEqual(1000);
    expect(o).toHaveProperty('holdFromMarkedMs');
    expect(o).not.toHaveProperty('holdFromRespondedMs'); // цикл 1: respondedAt + 4000
  });

  it('плашка уходит в 4000, пауза 1000 — следующий SD в markedAt + 5000 = UNDO_WINDOW_MS', () => {
    expect(o.holdFromMarkedMs).toBe(4000);
    expect(o.holdFromMarkedMs + abaInterTrial.ms).toBe(abaInterTrial.nextSdAtMs);
    expect(abaInterTrial.nextSdAtMs).toBeGreaterThanOrEqual(UNDO_WINDOW_MS);
    expect(abaInterTrial.nextSdAtMs).toBe(UNDO_WINDOW_MS); // окно отмены используется целиком, не дольше
    expect(abaNextSdAt(10_000)).toBe(15_000);
    expect(abaInterTrial.plates).toBe('empty_frames');
  });

  it('жетон падает 120 → 340 (motion.base), звук в момент приземления; похвала 700 (calm 500) кончается до ухода плашки', () => {
    expect(o.tokenDropAtMs).toBe(120);
    expect(o.tokenDropMs).toBe(motion.base);
    expect(abaTokenLandingMs()).toBe(340);
    expect(o.tokenSound).toBe('on_landing');
    expect(o.praiseAtMs).toBe(700);
    expect(o.praiseAtMs).toBeGreaterThan(abaTokenLandingMs()); // похвала не накрывает «тук» жетона
    expect(o.praiseAtMs + o.praiseMaxMs).toBeLessThanOrEqual(o.holdFromMarkedMs);
    // calm: жетон появляется на месте в момент начала падения, похвала раньше, но после жетона
    expect(o.tokenAppearsAtMsCalm).toBe(o.tokenDropAtMs);
    expect(abaCalm.tokenArrival).toBe('in_place');
    expect(o.praiseAtMsCalm).toBe(500);
    expect(o.praiseAtMsCalm).toBeGreaterThan(o.tokenAppearsAtMsCalm);
    expect(o.praiseAtMsCalm).toBeLessThan(o.praiseAtMs);
    // praise без жетона: только голос, раньше, чем похвала плашки
    expect(abaConsequence.praiseOnlyAtMs).toBeLessThan(o.praiseAtMs);
  });

  it('плашка — не кнопка: без подушки, тап — ничего, без «Дальше»; радиус radii.lg, контур 3 = контур calm-плашки', () => {
    expect(o.cushion).toBe(false);
    expect(o.reactsToTap).toBe(false);
    expect(o.tapPress).toBe(false);
    expect(o.nextButton).toBe(false);
    expect(o.appears).toBe('cut');
    expect(o.radius).toBe(radii.lg);
    expect(o.stroke).toBe(ABA_CONTROL_STROKE);
    expect(o.stroke).toBe(abaCalm.panelStroke);
    expect(o.panelStays).toBe(true);
    expect(o.topBarStays).toBe(true);
  });

  it('содержимое 288 помещается в плашку во всех тирах (432 / 376 / 344); доска плашки ≤ 64', () => {
    expect(ABA_OVERLAY_CONTENT_HEIGHT).toBe(288);
    const expected: Record<AbaTier, number> = { roomy: 432, compact: 376, tight: 344 };
    TIERS.forEach((t) => {
      expect(abaReinforcementOverlayHeight(abaLayoutByTier[t])).toBe(expected[t]);
      expect(ABA_OVERLAY_CONTENT_HEIGHT).toBeLessThanOrEqual(abaReinforcementOverlayHeight(abaLayoutByTier[t]));
    });
    // SE: ширина плашки 343, контент 311 — 64 при трёх ячейках, 52 при пяти
    expect(abaBoardCell(311, 3)).toBe(64);
    expect(abaBoardCell(311, 5)).toBe(52);
  });

  it('«Исправить отметку» видна до ухода плашки (4000), в паузе её нет; окно домена шире на 1 с (Ц2.6.3)', () => {
    const u = abaAdultPanel.undo;
    expect(u.visibleUntilMs).toBe(o.holdFromMarkedMs);
    expect(u.visibleUntilMs).toBeLessThan(u.windowMs);
    expect(u.windowMs - u.visibleUntilMs).toBe(abaInterTrial.ms);
    expect(u.hideOnPress).toBe(true);
    expect(u.slotAfterPress).toBe('empty_until_next_sd');
    expect(u.redrawFrame).toBe(false);
    expect(u.shownFor).toBe('adult_scored');
  });

  it('tokenAdded: падение в полосе (motion.quick, calm — появление) со звуком; SD = max(markedAt + 5000, приземление + 1000)', () => {
    const d = abaAdultPanel.undo.tokenAddedDrop;
    expect(d.target).toBe('strip_cell');
    expect(d.overlay).toBe(false); // плашка задним числом не рисуется
    expect(d.durationMs).toBe(motion.quick);
    expect(d.calm).toBe('appear_in_place');
    expect(d.sound).toBe('token_on_landing');
    expect(d.gapToNextSdMs).toBe(1000);
    expect(abaNextSdAt(0, 3000)).toBe(5000);
    expect(abaNextSdAt(0, 4000)).toBe(5000);
    expect(abaNextSdAt(0, 4500)).toBe(5500);
    // кнопка видна до 4000, падение длится motion.quick: худший случай — SD сдвигается не больше чем на 140 мс
    expect(abaNextSdAt(0, abaAdultPanel.undo.visibleUntilMs + d.durationMs) - abaNextSdAt(0)).toBe(motion.quick);
  });

  it('№160: карточка «перерыв» в последствии активна и без штриховки; просьба — перерыв вместо следующего SD', () => {
    expect(abaConsequence.breakCard).toEqual({
      active: true,
      hatched: false,
      onTap: 'defer_break_to_next_sd',
      interruptsOverlay: false,
    });
    // вне пробы и последствия (доступ, обмен, перерыв) — по-прежнему не просьба (№106)
    expect(abaBreak.outsideTrialCardAccepted).toBe(false);
    const src = fs.readFileSync(path.join(__dirname, '..', 'abaTokens.ts'), 'utf8');
    expect(src).not.toMatch(/breakCard:\s*'inactiveChoice'/);
  });

  it('№159: device_tap — «Была подсказка» и «Отказ» на местах ряда 2, ряд 1 пуст, «Сопротивляется» и отмены нет', () => {
    const p = abaAdultPanel.deviceTap;
    const device = adultPanelButtons('with_adult', { scoredBy: 'device_tap', startPromptLevel: 0, askAdultForL4: false }, false);
    expect([...p.answerWindow]).toEqual(device);
    p.answerWindow.forEach((id) => expect(abaAdultPanelSlot[id].row).toBe(1));
    expect(p.firstRow).toBe('empty');
    expect(p.resistedInAnswerWindow).toBe(false);
    expect(p.answerWindow).not.toContain('l4_resisted');
    expect(p.undo).toBe(false);
    expect(abaAdultPanelSlot.l4_resisted.row).toBe(0); // «Сопротивляется» живёт на карточке L4
  });
});

describe('№161: обмена на перерыве по просьбе ребёнка нет', () => {
  it('child_card — без обмена, расписание и предложение приложения — с обменом; ключи — все инициаторы', () => {
    expect(abaBreak.exchangeAfter).toEqual({ child_card: false, schedule: true, device_offer: true });
    expect(Object.keys(abaBreak.exchangeAfter).sort()).toEqual([...abaBreak.initiators].sort());
  });

  it('полная доска ждёт статично: без движения, знака и звука; на экране перерыва ребёнка доски нет', () => {
    expect(abaBreak.fullBoardWaiting).toEqual({ animated: false, cue: false, sound: false });
    expect(abaBreak.childCardShows.tokens).toBe(false);
  });
});

describe('звук (Ц2.1, №158; пункт 2 проверки цикла 2)', () => {
  const channels = Object.keys(abaSound.channels) as AbaSoundChannel[];

  it('файлы из сборки звучат и при беззвучном переключателе; четыре канала с долями 1 / 0.7 / 0.6 / 0.5', () => {
    expect(abaSound.playsInSilentMode).toBe(true);
    expect(abaSound.channels).toEqual({ voice: 1, token: 0.7, scene: 0.6, cue: 0.5 });
    channels.forEach((ch) => {
      expect(abaChannelVolume(ch, false)).toBeGreaterThan(0);
      expect(abaChannelVolume(ch, false)).toBeLessThanOrEqual(1);
    });
    expect(abaSound.channels.token).toBeLessThan(abaSound.channels.voice);
  });

  it('calm — каждый канал × 0.5: 0.5 / 0.35 / 0.3 / 0.25; song в calm 0.25', () => {
    expect(abaSound.calmFactor).toBe(0.5);
    const calm: Record<AbaSoundChannel, number> = { voice: 0.5, token: 0.35, scene: 0.3, cue: 0.25 };
    channels.forEach((ch) => expect(abaChannelVolume(ch, true)).toBeCloseTo(calm[ch], 9));
    expect(abaSound.songCalm).toBeLessThanOrEqual(abaChannelVolume('scene', true));
  });

  it('барабан: потолок 0.5 ниже канала сцены, звук не чаще раза в 250 мс', () => {
    expect(abaSound.drumMax).toBeLessThanOrEqual(abaSound.channels.scene);
    expect(abaSound.drumMinIntervalMs).toBe(250);
  });

  it('сцена приглушается под голосом и под сигналом конца доступа: до 0.3, в calm до 0.15', () => {
    const d = abaSound.sceneDuck;
    expect(d.level).toBe(0.3);
    expect(d.levelCalm).toBe(0.15);
    expect(d.levelCalm).toBeCloseTo(d.level * abaSound.calmFactor, 9);
    expect([...d.under].sort()).toEqual(['access_end_cue', 'voice']);
    // приглушение действительно тише сцены в обоих режимах, и тише calm-музыки song
    expect(d.level).toBeLessThan(abaChannelVolume('scene', false));
    expect(d.level).toBeLessThan(abaSound.drumMax);
    expect(d.levelCalm).toBeLessThan(abaSound.songCalm);
    // длительность приглушения под сигналом — длина самого сигнала
    expect(abaAccessScene.endCue.duckScene).toBe(true);
    expect(abaAccessScene.endCue.ms).toBe(600);
  });

  it('token — только при приземлении жетона; звуки одного канала не накладываются; без звука визуальных дублей нет', () => {
    expect(abaSound.tokenOnlyOnLanding).toBe(true);
    expect(abaSound.sameChannelOverlap).toBe(false);
    expect(abaSound.tokenCalmVariant).toBe('short');
    expect(abaSound.offHidesSoundReinforcers).toBe(true);
    expect(abaSound.offDuplicatesVisually).toBe(false);
  });
});

describe('касание выбора на детских экранах ABA (пункт 4 проверки цикла 2)', () => {
  const ok = { startedAt: 1000, frameShownAt: 1000, pointerIndex: 0, endedInside: true, slopPt: 0 };

  it('правило: при отпускании внутри цели, сдвиг < 10 pt, первый палец, касание до кадра не считается', () => {
    expect(abaChildTouch).toEqual({
      scope: 'choice',
      commitOn: 'touch_up_inside',
      maxSlopPt: 10,
      firstPointerOnly: true,
      ignoreStartedBeforeFrame: true,
      pressShownFrom: 'touch_down',
    });
    // 10 pt меньше зазора между целями: сдвиг, засчитанный как выбор, не дотягивается до соседней плиты
    expect(abaChildTouch.maxSlopPt).toBeLessThan(touch.gap);
    expect(abaChildTouch.maxSlopPt).toBeLessThan(abaLayout.plateGap);
  });

  it('abaTouchCommits: граница сдвига, второй палец, касание до кадра, отпускание снаружи', () => {
    expect(abaTouchCommits(ok)).toBe(true);
    expect(abaTouchCommits({ ...ok, slopPt: 9.9 })).toBe(true);
    expect(abaTouchCommits({ ...ok, slopPt: 10 })).toBe(false);
    expect(abaTouchCommits({ ...ok, pointerIndex: 1 })).toBe(false);
    expect(abaTouchCommits({ ...ok, startedAt: 999 })).toBe(false);
    expect(abaTouchCommits({ ...ok, startedAt: 1001 })).toBe(true);
    expect(abaTouchCommits({ ...ok, endedInside: false })).toBe(false);
  });
});

describe('выбор подкрепителя тапом (Ц2.4)', () => {
  const r = abaReinforcerChoice;

  it('тап = выбор, «Начать» нет, удержание 800 мс беззвучно; одно правило на 2.3, reinforcerStale и сопряжение', () => {
    expect(r.choiceOnTap).toBe(true);
    expect(r.startButton).toBe(false);
    expect(r.holdMs).toBe(800);
    expect(r.holdSound).toBe(false);
    expect([...r.sameRuleOn].sort()).toEqual(['pairing_choose', 'reinforcer_choice', 'reinforcer_stale']);
    expect(r.otherTapDuringHold).toBe('moves_choice_restarts_hold');
    expect(r.silhouetteSwap).toBe('immediate');
  });

  it('выбранная — вдавлена (подушка 0), контур 6 внутрь controlInk, различим на карточке в обеих схемах', () => {
    expect(r.selected).toEqual({ cushion: 0, stroke: stroke.bold, strokeColor: 'controlInk', inset: true });
    expect(r.selected.stroke).toBe(6);
    SCHEMES.forEach((scheme) => {
      const c = abaColors[scheme];
      expect(contrast(c[r.selected.strokeColor], c.controlFill)).toBeGreaterThanOrEqual(SHAPE_CONTRAST);
    });
  });

  it('тап по выбранной — selectedRepeatPress, удержание не перезапускается; смена кадра motion.quick, в calm без перехода', () => {
    expect(r.repeatTap).toEqual({ scale: selectedRepeatPress.scale, restartsHold: false });
    expect(r.transitionMs).toBe(motion.quick);
    expect(r.transitionCalm).toBe('cut');
  });

  it('«Сам», без выбора: 30 с — голос и один общий пульс (в calm без пульса), 60 с — спокойный конец; полосы взрослого нет', () => {
    expect([...r.aloneNoChoiceMs]).toEqual([30_000, 60_000]);
    expect(r.aloneRepeat.voice).toBe(1);
    expect(r.aloneRepeat.pulse).toEqual({ scale: 1.04, durationMs: motion.base, count: 1, together: true });
    expect(r.aloneRepeat.pulse.scale).toBeLessThanOrEqual(PROMPT_PULSE.scale); // не крупнее пульса подсказки
    expect(r.aloneRepeat.pulseCalm).toBe(false);
    expect(r.aloneAdultStrip).toBe(false);
  });

  it('«Со взрослым»: полоса 88 на месте «Начать», первые 500 мс без нажатий, вид не меняется', () => {
    expect(r.adultStripHeight).toBe(touch.primary);
    expect(r.adultStripLockMs).toBe(500);
    expect(r.adultStripLockLooksDisabled).toBe(false);
  });
});

describe('лист «Кто ведёт» (Ц2.3; пункт 1 проверки цикла 2)', () => {
  const s = abaWhoLeadsSheet;

  it('высота 402 складывается из блоков; «Начать» в шапке ≥ 112×48; скрим лист не закрывает', () => {
    expect(Object.values(s.blocks).reduce((a, b) => a + b, 0)).toBe(s.height);
    expect(s.height).toBe(402);
    expect(s.startPlacement).toBe('header');
    expect(s.blocks.header).toBeGreaterThanOrEqual(touchAdult);
    expect(s.startMinWidth).toBeGreaterThanOrEqual(112);
    expect(s.scrimDismiss).toBe(false);
    expect(s.captionSlotReserved).toBe(true);
  });

  it('«Начать» листа далеко от «Начать» 2.6: обе от низа, разрыв ≥ высоты главной кнопки', () => {
    const sheetStartBottom = s.height - s.blocks.pad - s.blocks.header; // низ «Начать» листа от низа экрана
    const screenStartTop = 16 + touch.primary; // верх «Начать» 2.6 от низа экрана
    expect(sheetStartBottom - screenStartTop).toBeGreaterThanOrEqual(touch.primary);
  });

  it('блокировка 500 мс — от последнего отпускания пальца, не от открытия; вид в блокировке обычный', () => {
    expect(s.lockMs).toBe(500);
    expect(s.lockFrom).toBe('last_touch_up');
    expect(s.lockScope).toBe('sheet_and_scrim');
    expect(s.lockNotBefore).toBe('sheet_settled');
    expect(s.lockLooksDisabled).toBe(false);
  });

  it('abaWhoLeadsAccepts: первые 500 мс после того, как лист встал, — нет; отпускание «Начать» 2.6 до этого срок не сокращает', () => {
    const settled = 1000;
    expect(abaWhoLeadsAccepts(1499, settled, null)).toBe(false);
    expect(abaWhoLeadsAccepts(1500, settled, null)).toBe(true);
    expect(abaWhoLeadsAccepts(1499, settled, 800)).toBe(false); // палец отпустил «Начать» 2.6 до открытия
  });

  it('abaWhoLeadsAccepts: серия быстрых тапов (каждые 300 мс) не проходит никогда; после паузы 500 мс — проходит', () => {
    const settled = 1000;
    let prevUp: number | null = null;
    // тапы: вниз в t, отпускание через 80 мс; интервал 300 мс, 10 тапов — серия длиннее прежних 720 мс
    for (let i = 0; i < 10; i += 1) {
      const down = settled + 100 + i * 300;
      expect(abaWhoLeadsAccepts(down, settled, prevUp)).toBe(false);
      prevUp = down + 80;
    }
    expect(abaWhoLeadsAccepts((prevUp as number) + 499, settled, prevUp)).toBe(false);
    expect(abaWhoLeadsAccepts((prevUp as number) + 500, settled, prevUp)).toBe(true);
  });
});

describe('доступ: сцена и конец (Ц2.8; пункты 2 и 5 проверки цикла 2)', () => {
  const a = abaAccessScene;

  it('любой тап по сцене — отклик ≤ 300 мс, первый кадр ≤ 100; объекты ≥ 60; жест только дополняет тап', () => {
    expect(a.tapResponseMs).toBeLessThanOrEqual(300);
    expect(a.firstFrameMs).toBeLessThanOrEqual(100);
    expect(a.firstFrameMs).toBeLessThan(a.tapResponseMs);
    expect(a.minTarget).toBe(touch.min);
    expect(a.gesture).toBe('adds_to_tap');
  });

  it('сигнал конца за 5 с, 600 мс, канал cue, кончается до T и приглушает сцену (abaSound.sceneDuck)', () => {
    expect(a.endCue).toEqual({ beforeEndMs: 5000, ms: 600, channel: 'cue', duckScene: true });
    expect(a.endCue.ms).toBeLessThan(a.endCue.beforeEndMs);
    expect(abaSound.sceneDuck.under).toContain('access_end_cue');
  });

  it('доигрывание ≤ 3 с: song — такт и затухание в последние 500 мс, остальные — затухание 500 мс; деталь puzzle4 уходит на место', () => {
    expect(a.newOnTapAfterEnd).toBe(false);
    expect(a.settleMaxMs).toBe(3000);
    expect(a.settle.song).toEqual({ finishBar: true, fadeLastMs: 500 });
    expect(a.settle.others).toEqual({ fadeMs: 500 });
    expect(a.settle.song.fadeLastMs).toBeLessThanOrEqual(a.settleMaxMs);
    expect(a.settle.others.fadeMs).toBeLessThanOrEqual(a.settleMaxMs);
    expect(a.settle.puzzle4HeldPiece).toBe('goes_home');
  });

  it('после доигрывания кольцо исчезает мгновенно, через 1000 мс — следующий шаг; время ребёнка не урезается', () => {
    expect(a.ringHiddenAfterSettle).toBe(true);
    expect(a.endSettleMs).toBe(1000);
    expect(a.durationTrimmed).toBe(false);
  });
});

describe('кнопка повтора инструкции (Ц2.1)', () => {
  it('60×60 (≥ touch.min), глиф ui-replay 32; рисуется только при файле голоса', () => {
    expect(abaControls.replaySize).toBeGreaterThanOrEqual(touch.min);
    expect(abaControls.replayGlyph).toBe('ui-replay');
    expect(abaControls.replayIconSize).toBe(32);
    expect(abaControls.replayIconSize).toBeLessThan(abaControls.replaySize);
    expect(abaControls.replayOnlyWithVoiceFile).toBe(true);
  });
});
