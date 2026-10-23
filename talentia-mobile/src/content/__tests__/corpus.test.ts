/**
 * Тест-гард корпуса заданий новой схемы (`src/types/task.ts`).
 *
 * Прежний гард (`src/data/__tests__/corpus.test.ts`) проверяет старую схему и
 * `worlds = []`, то есть проходит вхолостую. Этот проверяет `src/content`.
 *
 * Как гарантируется, что новый файл не ускользнёт: реестра нет, гард сам
 * обходит `src/content` (кроме `__tests__`) и загружает каждый модуль. Реестр
 * — второй список, который забывают обновить: ровно так ассет «молча не
 * попадает в сборку» (см. `src/assets/__tests__/registry.test.ts`), и так же
 * урок молча выпал бы из-под гарда. От каждого модуля требуется экспорт хотя
 * бы одной темы; файл без темы, урок вне темы и посторонний файл в папке —
 * красный тест, а не тихий пропуск.
 *
 * Сами правила — чистые функции в `corpusRules.ts`, их способность краснеть
 * проверяется на плохих фикстурах в `corpusRules.test.ts`. Здесь каждое
 * правило обязано вернуть пустой список на реальном корпусе.
 */
import * as fs from 'fs';
import * as path from 'path';
import ru from '../../i18n/locales/ru.json';
import en from '../../i18n/locales/en.json';
import ky from '../../i18n/locales/ky.json';
import { RULES, STYLE_RULES, collectCorpus } from './corpusRules';
import type { ContentModule, RuleId } from './corpusRules';

const CONTENT_DIR = path.join(__dirname, '..');

/**
 * Все файлы `src/content` вне `__tests__`, с подпапками. Модули — `.ts`/`.tsx`;
 * `.md` допускается как пояснение. Любой другой файл (`.js`, `.json`) — это
 * контент, который гард не умеет читать, и он должен покраснеть, а не
 * пропуститься.
 */
function scan(dir: string, rel = ''): { modules: string[]; strays: string[] } {
  const out = { modules: [] as string[], strays: [] as string[] };
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const relPath = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') continue;
      const sub = scan(path.join(dir, entry.name), relPath);
      out.modules.push(...sub.modules);
      out.strays.push(...sub.strays);
    } else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      out.modules.push(relPath);
    } else if (!entry.name.endsWith('.md')) {
      out.strays.push(relPath);
    }
  }
  return out;
}

const { modules: files, strays } = scan(CONTENT_DIR);
const modules: ContentModule[] = files.map((file) => ({
  file,
  exports: jest.requireActual<Record<string, unknown>>(path.join(CONTENT_DIR, file)),
}));
const { corpus, problems } = collectCorpus(modules);
const locales = { ru, en, ky };

describe('корпус src/content: обнаружение', () => {
  it('гард не пустой: найден хотя бы один модуль, тема и задание', () => {
    // Прежний гард годами был зелёным на пустом корпусе. Если контент из
    // src/content уберут целиком, пусть это будет осознанная правка гарда,
    // а не тихая зелень.
    const tasks = corpus.flatMap((e) => e.topic.lessons.flatMap((l) => l.tasks));
    expect({ модулей: files.length > 0, тем: corpus.length > 0, заданий: tasks.length > 0 }).toEqual({
      модулей: true,
      тем: true,
      заданий: true,
    });
  });

  it('каждый модуль src/content экспортирует тему, и каждый экспортированный урок входит в тему', () => {
    expect(problems).toEqual([]);
  });

  it('в src/content нет файлов, которые гард не читает', () => {
    expect(strays).toEqual([]);
  });
});

const ids = Object.keys(RULES) as RuleId[];

describe('корпус src/content: инварианты', () => {
  it.each(ids.filter((id) => !STYLE_RULES.has(id)).map((id) => [id, RULES[id].title] as const))('%s: %s', (id) => {
    const rule = RULES[id];
    expect({ [rule.title]: rule.check(corpus, locales) }).toEqual({ [rule.title]: [] });
  });
});

// Решение №122: стилистические правила не валят тест — печатают отчёт для `curriculum-content-reviewer`.
describe('корпус src/content: предупреждения стиля', () => {
  it('отчёт стилистических правил (не падает)', () => {
    const report = ids
      .filter((id) => STYLE_RULES.has(id))
      .flatMap((id) => RULES[id].check(corpus, locales).map((line) => `[${id}] ${line}`));
    if (report.length > 0) console.warn(`Предупреждения стиля корпуса (${report.length}):\n${report.join('\n')}`);
    expect(Array.isArray(report)).toBe(true);
  });
});
