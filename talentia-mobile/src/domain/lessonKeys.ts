/**
 * Все ключи локали, которые нужны уроку целиком (решение №78: «нет перевода — нет урока»).
 * Чистая функция: проверку наличия ключа передаёт экран (`i18n.exists`), поэтому гард корпуса и
 * тесты могут подставить любой словарь.
 */
import type { Lesson, Media, ModelExample, Task } from '../types/task';

const mediaKeys = (m: Media): string[] => [m.labelKey];

/** Ключи элементов задания по формату (без общих полей `BaseTask`). */
function bodyKeys(t: ModelExample | Task): string[] {
  switch (t.format) {
    case 'choose':
      return t.options.flatMap(mediaKeys);
    case 'point':
      return t.targets.map((z) => z.labelKey);
    case 'match':
      return t.pairs.flatMap((p) => [...mediaKeys(p.left), ...mediaKeys(p.right)]);
    case 'order':
      return t.items.flatMap(mediaKeys);
    case 'group':
      return [...t.groups.map((g) => g.labelKey), ...t.items.flatMap(mediaKeys)];
    case 'build':
      return t.fragments?.map((f) => f.labelKey) ?? [];
  }
}

function exampleKeys(e: ModelExample): string[] {
  const keys = [e.promptKey];
  if (e.stimulus) keys.push(...mediaKeys(e.stimulus));
  if (e.inserts) keys.push(...Object.values(e.inserts).map((i) => i.textKey));
  keys.push(...bodyKeys(e));
  return keys;
}

function taskKeys(t: Task): string[] {
  const keys = [t.promptKey, t.hintKey];
  if (t.explainKey) keys.push(...t.explainKey);
  if (t.passage) keys.push(t.passage.textKey);
  if (t.stimulus) keys.push(...mediaKeys(t.stimulus));
  if (t.inserts) keys.push(...Object.values(t.inserts).map((i) => i.textKey));
  keys.push(...bodyKeys(t));
  return keys;
}

/** Уникальные ключи урока в порядке появления: название, завязка, пример, задания, страница атласа. */
export function lessonKeys(lesson: Lesson): string[] {
  const keys = [lesson.titleKey, lesson.hook.lineKey];
  if (lesson.model) {
    keys.push(...exampleKeys(lesson.model.example));
    keys.push(...lesson.model.steps.map((s) => s.lineKey));
  }
  for (const t of lesson.tasks) keys.push(...taskKeys(t));
  keys.push(lesson.atlasEntryKey);
  return [...new Set(keys)];
}

/** Ключи, которых нет в словаре. Пусто — урок можно открывать. */
export function missingLessonKeys(lesson: Lesson, exists: (key: string) => boolean): string[] {
  return lessonKeys(lesson).filter((k) => !exists(k));
}

export function lessonAvailable(lesson: Lesson, exists: (key: string) => boolean): boolean {
  return missingLessonKeys(lesson, exists).length === 0;
}
