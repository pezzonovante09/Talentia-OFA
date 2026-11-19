/**
 * Реестр ассетов держится вручную, потому что трансформер не умеет
 * вычисляемые пути. Значит его легко рассинхронизировать с диском: добавил
 * файл, забыл строку — и ассет молча не попадает в сборку. Тест сверяет
 * папки с реестром в обе стороны.
 *
 * Сам реестр здесь не импортируется: он тянет .svg, а Jest их не
 * трансформирует. Сверяются имена, разобранные из исходника.
 */
import * as fs from 'fs';
import * as path from 'path';

const root = path.join(__dirname, '..', '..', '..');
const src = fs.readFileSync(path.join(__dirname, '..', 'registry.ts'), 'utf8');

/** Файлы .svg, на которые реестр ссылается импортом, по папке. */
function imported(dir: string): string[] {
  const re = new RegExp(`from '[^']*${dir}/([\\w-]+)\\.svg'`, 'g');
  return [...src.matchAll(re)].map((m) => m[1]).sort();
}

/** Файлы .svg, реально лежащие в папке. */
function onDisk(dir: string): string[] {
  return fs
    .readdirSync(path.join(root, dir))
    .filter((f) => f.endsWith('.svg'))
    .map((f) => path.basename(f, '.svg'))
    .sort();
}

function readSvg(rel: string): string {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function viewBoxOf(svg: string): string {
  return (svg.match(/viewBox="([^"]+)"/) ?? [])[1] ?? '';
}

/** Идентификаторы регионов из схемы курса (`types/task.ts`). */
function schemaRegionIds(): string[] {
  const schema = fs.readFileSync(path.join(root, 'src/types/task.ts'), 'utf8');
  const ids = (schema.match(/id: '(numbers|words|nature|workshop)'(?: \| '\w+')*/) ?? [])[0] ?? '';
  return [...ids.matchAll(/'(\w+)'/g)].map((m) => m[1]).sort();
}

/** Строки `  key: Value,` внутри `export const NAME = {...}`. */
function mapEntries(name: string): Record<string, string> {
  const block = (src.match(new RegExp(`export const ${name} = \\{([\\s\\S]*?)\\n\\}`)) ?? [])[1] ?? '';
  return Object.fromEntries([...block.matchAll(/^\s{2}(\w+): (\w+),$/gm)].map((m) => [m[1], m[2]]));
}

const REGIONS_DIR = 'assets/images/regions';
const PANORAMA_VIEWBOX = viewBoxOf(readSvg(`${REGIONS_DIR}/region-numbers.svg`));

describe('реестр векторных ассетов', () => {
  it.each([
    ['assets/images/tali', 'tali'],
    [REGIONS_DIR, 'regions'],
    ['assets/icons', 'icons'],
  ])('%s: реестр и папка совпадают', (dir, key) => {
    expect({ [key]: imported(dir.split('/').pop() as string) }).toEqual({ [key]: onDisk(dir) });
  });

  it('семь поз Tali перечислены в карте поз', () => {
    const poses = [...src.matchAll(/^\s{2}(\w+): Tali\w+,$/gm)].map((m) => m[1]);
    expect(poses.sort()).toEqual(['cheer', 'found', 'hello', 'idle', 'point', 'puzzled', 'write']);
  });

  it('TALI_VIEWBOX совпадает с viewBox файлов поз', () => {
    const declared = mapEntries('TALI_VIEWBOX: Record<TaliPose, number>');
    expect(Object.keys(declared).sort()).toEqual(['cheer', 'found', 'hello', 'idle', 'point', 'puzzled', 'write']);
    Object.entries(declared).forEach(([pose, side]) => {
      const vb = viewBoxOf(readSvg(`assets/images/tali/tali-${pose}.svg`));
      expect({ pose, viewBox: vb }).toEqual({ pose, viewBox: `0 0 ${side} ${side}` });
    });
  });

  it('ключи панорам совпадают с идентификаторами регионов из схемы курса', () => {
    const inRegistry = [...src.matchAll(/^\s{2}(\w+): Region\w+,$/gm)].map((m) => m[1]).sort();
    // Все пять панорам на месте (кыргызская — с 2026-11-06, №177).
    expect(inRegistry).toEqual(schemaRegionIds());
  });

  // Горизонты и ориентиры тёмной карты (ASSETS.md, «Контур горизонта и ориентир»).
  // Горизонт есть только у «Цифр»; ориентиры — у всех пяти (2026-11-06); остальные горизонты — заготовки `null`.
  describe.each([
    ['REGION_HORIZONS', 'horizon', 'Horizon', ['words', 'nature', 'workshop', 'kyrgyz']],
    ['REGION_LANDMARKS', 'landmark', 'Landmark', []],
  ])('%s', (mapName, filePrefix, importPrefix, PENDING) => {
    const entries = mapEntries(mapName);

    it('ключи — все RegionId; файл у «Цифр», у остальных null-заготовка', () => {
      expect(Object.keys(entries).sort()).toEqual(schemaRegionIds());
      expect(entries.numbers).toBe(`${importPrefix}Numbers`);
      PENDING.forEach((id) => expect({ id, value: entries[id] }).toEqual({ id, value: 'null' }));
    });

    it('каждый ключ с файлом подкреплён svg на диске, и наоборот', () => {
      const withFile = Object.entries(entries)
        .filter(([, v]) => v !== 'null')
        .map(([k]) => `${filePrefix}-${k}`)
        .sort();
      const files = onDisk(REGIONS_DIR).filter((f) => f.startsWith(`${filePrefix}-`)).sort();
      expect(files).toEqual(withFile);
    });
  });

  it('horizon-*.svg: один открытый путь без заливки во viewBox панорамы', () => {
    onDisk(REGIONS_DIR)
      .filter((f) => f.startsWith('horizon-'))
      .forEach((f) => {
        const svg = readSvg(`${REGIONS_DIR}/${f}.svg`);
        const paths = svg.match(/<path\b/g) ?? [];
        expect({ f, paths: paths.length }).toEqual({ f, paths: 1 });
        expect({ f, viewBox: viewBoxOf(svg) }).toEqual({ f, viewBox: PANORAMA_VIEWBOX });
        expect(svg).toMatch(/fill="none"/);
        expect(svg).toMatch(/vector-effect="non-scaling-stroke"/);
        const d = (svg.match(/ d="([^"]+)"/) ?? [])[1] ?? '';
        expect(d).toMatch(/^M/);
        expect(d).not.toMatch(/[zZ]\s*$/); // открытый, не замкнутый
        expect(svg).not.toMatch(/<(g|text|linearGradient|radialGradient)\b/);
        expect(Buffer.byteLength(svg)).toBeLessThanOrEqual(8 * 1024);
      });
  });

  it('landmark-*.svg: сетка 64, не больше 12 путей, один цвет глифа', () => {
    onDisk(REGIONS_DIR)
      .filter((f) => f.startsWith('landmark-'))
      .forEach((f) => {
        const svg = readSvg(`${REGIONS_DIR}/${f}.svg`);
        expect({ f, viewBox: viewBoxOf(svg) }).toEqual({ f, viewBox: '0 0 64 64' });
        const shapes = svg.match(/<(path|circle|rect|ellipse|polygon|line)\b/g) ?? [];
        expect(shapes.length).toBeLessThanOrEqual(12);
        expect(svg).toMatch(/fill="currentColor"/);
        expect(svg).not.toMatch(/Gradient/);
      });
  });

  it('каждый импорт иконки стоит в ICONS, формы пар — четыре', () => {
    const names = [...src.matchAll(/import (Ui\w+) from '[^']*icons\//g)].map((m) => m[1]);
    const inIcons = Object.values(mapEntries('ICONS'));
    expect(inIcons.sort()).toEqual(names.sort());
    const pair = (src.match(/export const PAIR_SHAPES = \[([\s\S]*?)\] as const/) ?? [])[1] ?? '';
    expect([...pair.matchAll(/ICONS\.(\w+)/g)].map((m) => m[1])).toEqual([
      'shapeCircle',
      'shapeSquare',
      'shapeTriangle',
      'shapeDiamond',
    ]);
  });

  it('все иконки по правилу: сетка 32, currentColor, контур #2A1A12 или штрих currentColor', () => {
    onDisk('assets/icons').forEach((f) => {
      const svg = readSvg(`assets/icons/${f}.svg`);
      expect({ f, viewBox: viewBoxOf(svg) }).toEqual({ f, viewBox: '0 0 32 32' });
      expect({ f, ok: /currentColor/.test(svg) }).toEqual({ f, ok: true });
      const colours = new Set((svg.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).map((c) => c.toUpperCase()));
      expect({ f, colours: [...colours] }).toEqual({ f, colours: colours.size ? ['#2A1A12'] : [] });
      const shapes = svg.match(/<(path|circle|rect|ellipse|polygon|line)\b/g) ?? [];
      expect(shapes.length).toBeLessThanOrEqual(12);
    });
  });
});
