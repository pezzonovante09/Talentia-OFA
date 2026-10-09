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

describe('реестр векторных ассетов', () => {
  it.each([
    ['assets/images/tali', 'tali'],
    ['assets/images/regions', 'regions'],
    ['assets/icons', 'icons'],
  ])('%s: реестр и папка совпадают', (dir, key) => {
    expect({ [key]: imported(dir.split('/').pop() as string) }).toEqual({ [key]: onDisk(dir) });
  });

  it('семь поз Tali перечислены в карте поз', () => {
    const poses = [...src.matchAll(/^\s{2}(\w+): Tali\w+,$/gm)].map((m) => m[1]);
    expect(poses.sort()).toEqual(['cheer', 'found', 'hello', 'idle', 'point', 'puzzled', 'write']);
  });

  it('ключи панорам совпадают с идентификаторами регионов из схемы курса', () => {
    const inRegistry = [...src.matchAll(/^\s{2}(\w+): Region\w+,$/gm)].map((m) => m[1]).sort();
    const schema = fs.readFileSync(path.join(root, 'src/types/task.ts'), 'utf8');
    const ids = (schema.match(/id: '(numbers|words|nature|workshop)'(?: \| '\w+')*/) ?? [])[0] ?? '';
    // Панорама кыргызского региона (решение №38) — шаг 6, `design-lead` и ассеты. Убрать
    // исключение, когда она появится.
    const PANORAMA_PENDING = ['kyrgyz'];
    const inSchema = [...ids.matchAll(/'(\w+)'/g)].map((m) => m[1]).filter((id) => !PANORAMA_PENDING.includes(id)).sort();
    expect(inRegistry).toEqual(inSchema);
    // Ожидающая панорама объявлена в реестре заготовкой `null`, а не пропущена молча.
    PANORAMA_PENDING.forEach((id) => expect(src).toMatch(new RegExp(`^\\s{2}${id}: null,$`, 'm')));
  });
});
