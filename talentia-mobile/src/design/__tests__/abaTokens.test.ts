/**
 * Контракт визуального языка ABA-режима (ABA.md, «Визуальный язык»). Главное
 * правило — цвет не бывает дискриминативным стимулом — проверяется здесь, а не
 * на ревью: иначе однажды «чуть подсветить верный вариант зелёным» пройдёт.
 */
import {
  ABA_STIMULUS_STROKE,
  abaColors,
  abaLayout,
  abaTokenBoard,
  PLATE_STROKE_INSET,
  promptVisual,
  tokenCell,
  type AbaColors,
} from '../abaTokens';
import { contrast, SHAPE_CONTRAST, TEXT_CONTRAST } from '../contrast';
import { buildTheme, cushionByRole, palettes, touch, type Scheme } from '../tokens';

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

  it('любые два уровня различаются хотя бы одним бесцветным признаком', () => {
    levels.forEach((a) =>
      levels.forEach((b) => {
        if (a >= b) return;
        const pa = promptVisual[a];
        const pb = promptVisual[b];
        const differs = pa.mark !== pb.mark || pa.plateStroke !== pb.plateStroke ||
          pa.distractors !== pb.distractors || pa.guide !== pb.guide;
        expect(differs).toBe(true);
      }),
    );
  });

  it('уровень выше — вмешательство не меньше: толщина контура не убывает', () => {
    levels.forEach((l) => {
      if (l > 0) expect(promptVisual[l].plateStroke).toBeGreaterThanOrEqual(promptVisual[(l - 1) as 0 | 1 | 2].plateStroke);
    });
  });

  it('контур утолщается внутрь — габарит стимула не меняется', () => {
    expect(PLATE_STROKE_INSET).toBe(true);
  });

  it('полоса подсказки резервируется всегда', () => {
    expect(abaLayout.hintBand).toBeGreaterThan(0);
    expect(abaLayout.hintBand).toBeGreaterThanOrEqual(promptVisual[3].markSize);
  });

  it('экран пробы помещается на iPhone SE (667 pt) с запасом на безопасные зоны', () => {
    const total = abaLayout.topBar + abaLayout.tokenBoard + abaLayout.gapAfterBoard + abaLayout.instruction +
      abaLayout.hintBand + abaLayout.stimulus + abaLayout.adultPanel;
    expect(total).toBeLessThanOrEqual(667 - 20 - 34 - 24);
  });
});
