/**
 * Проверяет, что все ключи из worlds.ts (задания, диалоги, интро, миры/темы/уроки)
 * присутствуют в ru.json, en.json, ky.json (плоские пути вида data.tasks.foo).
 *
 * Запуск из talentia-mobile:
 *   npx tsx scripts/audit-i18n-worlds.ts
 *   npx tsx scripts/audit-i18n-worlds.ts --json   # отчёт в stdout как JSON
 *
 * Код выхода: 1 если есть пропуски в ru (CI). Пропуски en/ky не фейлят CI (fallback на ru в приложении).
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

import type { Lesson, LessonTask, World } from '../src/data/worlds';
import { worlds } from '../src/data/worlds';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getByKey(doc: Record<string, unknown>, dotted: string): unknown {
  const parts = dotted.split('.');
  let cur: unknown = doc;
  for (const p of parts) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function hasString(doc: Record<string, unknown>, dotted: string): boolean {
  const v = getByKey(doc, dotted);
  return typeof v === 'string' && v.length > 0;
}

function addKey(set: Set<string>, k: string | undefined) {
  if (k && k.startsWith('data.')) set.add(k);
}

function collectFromTask(set: Set<string>, task: LessonTask) {
  addKey(set, task.questionKey);
  if ('placeholderKey' in task && task.placeholderKey) addKey(set, task.placeholderKey as string);
  if (task.type === 'multiple_choice') {
    for (const o of task.options) addKey(set, o.textKey);
  }
  if (task.type === 'fill_blank') {
    addKey(set, task.sentenceKey);
    for (const o of task.options) addKey(set, o.textKey);
  }
  if (task.type === 'image_point') {
    for (const h of task.hotspots) addKey(set, h.labelKey);
  }
  if (task.type === 'vocal_imitation') {
    addKey(set, task.soundTextKey);
    if (task.audioPromptKey) addKey(set, task.audioPromptKey);
  }
  if (task.type === 'word_repetition') addKey(set, task.wordKey);
  if (task.type === 'volume_control') addKey(set, task.promptTextKey);
  if (task.type === 'image_word_match') {
    if (task.promptTextKey) addKey(set, task.promptTextKey);
    for (const o of task.options) addKey(set, o.textKey);
  }
  if (task.type === 'world_knowledge') {
    for (const o of task.options) addKey(set, o.textKey);
  }
  if (task.type === 'sorting') {
    for (const g of task.groups) addKey(set, g.labelKey);
  }
  if (task.type === 'routine_chain') {
    for (const s of task.steps) addKey(set, s.labelKey);
  }
  if (task.type === 'action_instruction') {
    addKey(set, task.actionKey);
  }
}

function collectFromLesson(set: Set<string>, lesson: Lesson) {
  addKey(set, lesson.titleKey);
  if (lesson.descriptionKey) addKey(set, lesson.descriptionKey);
  if (lesson.dialog) {
    for (const d of lesson.dialog) addKey(set, d.textKey);
  }
  if (lesson.intro) {
    for (const s of lesson.intro) {
      addKey(set, s.titleKey);
      addKey(set, s.bodyKey);
    }
  }
  for (const t of lesson.tasks) collectFromTask(set, t);
}

function collectFromWorld(set: Set<string>, world: World) {
  addKey(set, world.titleKey);
  addKey(set, world.descriptionKey);
  for (const topic of world.topics) {
    addKey(set, topic.titleKey);
    if (topic.descriptionKey) addKey(set, topic.descriptionKey);
    for (const lesson of topic.lessons) collectFromLesson(set, lesson);
  }
}

function main() {
  const root = path.join(__dirname, '..');
  const keys = new Set<string>();
  for (const w of worlds) collectFromWorld(keys, w);

  const ru = JSON.parse(fs.readFileSync(path.join(root, 'src', 'i18n', 'locales', 'ru.json'), 'utf8')) as Record<
    string,
    unknown
  >;
  const en = JSON.parse(fs.readFileSync(path.join(root, 'src', 'i18n', 'locales', 'en.json'), 'utf8')) as Record<
    string,
    unknown
  >;
  const ky = JSON.parse(fs.readFileSync(path.join(root, 'src', 'i18n', 'locales', 'ky.json'), 'utf8')) as Record<
    string,
    unknown
  >;

  const missingRu: string[] = [];
  const missingEn: string[] = [];
  const missingKy: string[] = [];
  for (const k of [...keys].sort()) {
    if (!hasString(ru, k)) missingRu.push(k);
    if (!hasString(en, k)) missingEn.push(k);
    if (!hasString(ky, k)) missingKy.push(k);
  }

  const asJson = process.argv.includes('--json');
  if (asJson) {
    console.log(JSON.stringify({ missingRu, missingEn, missingKy, totalKeys: keys.size }, null, 2));
  } else {
    console.log(`Всего уникальных ключей data.* из worlds: ${keys.size}`);
    console.log(`Нет в ru: ${missingRu.length}, en: ${missingEn.length}, ky: ${missingKy.length}`);
    if (missingRu.length) {
      console.log('\n--- missing ru (первые 80) ---');
      missingRu.slice(0, 80).forEach((k) => console.log(k));
      if (missingRu.length > 80) console.log(`... +${missingRu.length - 80} ещё`);
    }
  }

  process.exit(missingRu.length ? 1 : 0);
}

main();
