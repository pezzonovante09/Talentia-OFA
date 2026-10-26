/**
 * Стимулы проб `match` (Ц2.12 `docs/design/aba-screens-2026-10-25.md`, проверка `aba-pedagogy-specialist` 2026-10-26;
 * правило цвета — ABA.md «Визуальный язык», №162). Предметы — SVG из партии `docs/assets/aba-match-stimuli.md` (скилл `asset-pipeline`; пока файла нет — у
 * `ABA_OBJECT_ART` `null`, экран рисует заглушку-силуэт). Формы и цвета — не файлы, их рисует код.
 *
 * `class` — класс стимула для пула подкрепителей (`reinforcerPoolFor`): позиция каталога с тем же классом в
 * программу не идёт. Ведёрко убрано (класс сцены `marble_run`), вместо него ложка.
 */
export type AbaShape = 'circle' | 'square' | 'triangle' | 'ring' | 'rhombus';

export type AbaStimulus =
  | { id: string; kind: 'object'; class: string }
  /** Форма одной заливки на всё поле: обучение — `ABA_SHAPE_FILL.teaching`, перенос — `.generalization`. */
  | { id: string; kind: 'shape'; class: 'shape'; shape: AbaShape; fill: string }
  /** Цвет на форме-носителе одного размера: обучение — круг, перенос — квадрат; hex одинаков в обеих темах. */
  | { id: string; kind: 'color'; class: 'color'; hex: string; carrier: 'circle' | 'square' };

const obj = (name: string, cls: string): AbaStimulus => ({ id: `aba-obj-${name}`, kind: 'object', class: cls });

/**
 * Заливка форм — **не из цветов-целей** (`aba-pedagogy-specialist` 2026-10-26, п. 5): иначе синий круг формы был бы
 * тем же стимулом, что синий цвета, и навык держался бы за «этот синий круг». У переноса — другая заливка.
 */
export const ABA_SHAPE_FILL = { teaching: '#0E8FBF', generalization: '#2FA24E' } as const;

/**
 * Пропорции форм для рендера (п. 4): ромб — углы 60° / 120°, не повёрнутый квадрат; кольцо — внутренний диаметр
 * 0.5 внешнего. Все формы вписаны в один квадрат.
 */
export const ABA_SHAPE_SPEC = { rhombusAcuteDeg: 60, ringInnerRatio: 0.5 } as const;

const shape = (name: AbaShape, alt = false): AbaStimulus => ({
  id: `aba-shape-${name}${alt ? '-alt' : ''}`,
  kind: 'shape',
  class: 'shape',
  shape: name,
  fill: alt ? ABA_SHAPE_FILL.generalization : ABA_SHAPE_FILL.teaching,
});
const color = (name: string, hex: string, carrier: 'circle' | 'square' = 'circle'): AbaStimulus => ({
  id: `aba-color-${name}${carrier === 'square' ? '-sq' : ''}`,
  kind: 'color',
  class: 'color',
  hex,
  carrier,
});
const SHAPES: AbaShape[] = ['circle', 'square', 'triangle', 'ring', 'rhombus'];
const COLORS: [string, string][] = [
  ['blue', '#0072B2'],
  ['vermilion', '#D55E00'],
  ['green', '#009E73'],
  ['purple', '#CC79A7'],
];

export const ABA_STIMULI: readonly AbaStimulus[] = [
  obj('apple', 'fruit'),
  obj('pear', 'fruit'),
  obj('carrot', 'vegetable'),
  obj('mushroom', 'mushroom'),
  obj('leaf', 'leaf'),
  obj('car', 'vehicle'),
  obj('plane', 'vehicle'),
  obj('boat', 'vehicle'),
  obj('house', 'house'),
  obj('umbrella', 'umbrella'),
  obj('key', 'key'),
  obj('spoon', 'kitchen'),
  obj('teapot', 'kitchen'),
  obj('book', 'book'),
  obj('hat', 'clothes'),
  obj('mitten', 'clothes'),
  obj('pyramid', 'toy'),
  obj('sock', 'clothes'),
  // только для переноса «одинаковые из 3»: ни в одном обучении лестницы их нет (п. 3)
  obj('chair', 'furniture'),
  obj('flower', 'flower'),
  obj('cup', 'kitchen'),
  obj('tree', 'tree'),
  obj('bus', 'vehicle'),
  obj('bell', 'bell'),
  ...SHAPES.map((n) => shape(n)),
  ...SHAPES.map((n) => shape(n, true)),
  // Окабе–Ито без оранжевого #E69F00 и жёлтого #F0E442 (близки к жетону); зелёный и пурпурный — не в одно поле
  ...COLORS.map(([n, hex]) => color(n, hex)),
  ...COLORS.map(([n, hex]) => color(n, hex, 'square')),
];

/** Пары цветов, которые не ставятся в одно поле: близкая яркость, хуже при нарушениях цветового зрения. */
export const ABA_COLOR_NOT_TOGETHER: readonly [string, string][] = [
  ['aba-color-green', 'aba-color-purple'],
  ['aba-color-green-sq', 'aba-color-purple-sq'],
];

/** Близкие формы — не в одно поле первой цели по форме (п. 4): различение ориентации и внутреннего признака — позже. */
export const ABA_SHAPE_NOT_TOGETHER: readonly [AbaShape, AbaShape][] = [
  ['square', 'rhombus'],
  ['circle', 'ring'],
];
