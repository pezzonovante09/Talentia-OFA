/**
 * Экспорт фраз для офлайн TTS (например ElevenLabs): только миры с ageBand '5-6'
 * («подготовка» / досшкольный контент в приложении).
 *
 * Запуск из папки talentia-mobile:
 *   npx tsx scripts/export-voice-manifest-5-6.ts
 *
 * Результат: scripts/output/voice-manifest-5-6.json и voice-manifest-5-6.csv
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

import type { AgeBand } from '../src/data/worlds';
import { worlds } from '../src/data/worlds';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function stripForTTS(text: string): string {
  return text
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
    .replace(/[\u{2600}-\u{27BF}]/gu, '')
    .replace(/[\u{FE00}-\u{FEFF}]/gu, '')
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, '')
    .replace(/[\uFE0E\uFE0F]/g, '')
    .replace(/[•·]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function escapeCsvCell(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function getByKey(doc: Record<string, unknown>, dotted: string): string | undefined {
  const parts = dotted.split('.');
  let cur: unknown = doc;
  for (const p of parts) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return typeof cur === 'string' ? cur : undefined;
}

type Lang = 'ru' | 'en' | 'ky';

const LOCALES: Lang[] = ['ru', 'en', 'ky'];

function main() {
  const root = path.join(__dirname, '..');
  const localeDir = path.join(root, 'src', 'i18n', 'locales');
  const translations: Record<Lang, Record<string, unknown>> = {
    ru: JSON.parse(fs.readFileSync(path.join(localeDir, 'ru.json'), 'utf8')) as Record<string, unknown>,
    en: JSON.parse(fs.readFileSync(path.join(localeDir, 'en.json'), 'utf8')) as Record<string, unknown>,
    ky: JSON.parse(fs.readFileSync(path.join(localeDir, 'ky.json'), 'utf8')) as Record<string, unknown>,
  };

  const targetBand = '5-6' satisfies AgeBand;
  type ManifestKind = 'intro' | 'dialog' | 'task_question' | 'task_option';
  const entries: Array<{
    id: string;
    worldId: string;
    lessonId: string;
    kind: ManifestKind;
    index: number;
    speaker?: 'tali' | 'npc';
    titleKey?: string;
    bodyKey?: string;
    textKey?: string;
    questionKey?: string;
    taskId?: string;
    optionId?: string;
    texts: Record<Lang, { raw: string; forTTS: string }>;
    suggestedFilename: Record<Lang, string>;
  }> = [];

  for (const world of worlds) {
    if (world.ageBand !== targetBand) continue;

    for (const topic of world.topics) {
      const isEnglishReadingLesson = topic.subject === 'reading';
      for (const lesson of topic.lessons) {
        if (lesson.intro) {
          lesson.intro.forEach((slide, index) => {
            const texts = {} as Record<Lang, { raw: string; forTTS: string }>;
            for (const lng of LOCALES) {
              const title = getByKey(translations[lng], slide.titleKey) ?? '';
              const body = getByKey(translations[lng], slide.bodyKey) ?? '';
              const raw = `${title}. ${body}`.trim();
              const a = stripForTTS(title);
              const b = stripForTTS(body);
              const joiner = /[!?…]$/.test(a) ? ' ' : '. ';
              const forTTS = `${a}${b ? `${joiner}${b}` : ''}`.trim();
              texts[lng] = { raw, forTTS };
            }
            const suggestedFilename = {
              ru: `${lesson.id}_intro_${index}_ru.mp3`,
              en: `${lesson.id}_intro_${index}_en.mp3`,
              ky: `${lesson.id}_intro_${index}_ky.mp3`,
            };
            entries.push({
              id: `${lesson.id}_intro_${index}`,
              worldId: world.id,
              lessonId: lesson.id,
              kind: 'intro',
              index,
              titleKey: slide.titleKey,
              bodyKey: slide.bodyKey,
              texts,
              suggestedFilename,
            });
          });
        }

        if (lesson.dialog) {
          lesson.dialog.forEach((line, index) => {
            const texts = {} as Record<Lang, { raw: string; forTTS: string }>;
            for (const lng of LOCALES) {
              const raw = getByKey(translations[lng], line.textKey) ?? '';
              texts[lng] = { raw, forTTS: stripForTTS(raw) };
            }
            const suggestedFilename = {
              ru: `${lesson.id}_dialog_${index}_ru.mp3`,
              en: `${lesson.id}_dialog_${index}_en.mp3`,
              ky: `${lesson.id}_dialog_${index}_ky.mp3`,
            };
            entries.push({
              id: `${lesson.id}_dialog_${index}`,
              worldId: world.id,
              lessonId: lesson.id,
              kind: 'dialog',
              index,
              speaker: line.speaker,
              textKey: line.textKey,
              texts,
              suggestedFilename,
            });
          });
        }

        for (const task of lesson.tasks) {
          {
            const texts = {} as Record<Lang, { raw: string; forTTS: string }>;
            for (const lng of LOCALES) {
              const raw = getByKey(translations[lng], task.questionKey) ?? '';
              texts[lng] = { raw, forTTS: stripForTTS(raw) };
            }
            const suggestedFilename = {
              ru: `${lesson.id}_task_${task.id}_q_ru.mp3`,
              en: `${lesson.id}_task_${task.id}_q_en.mp3`,
              ky: `${lesson.id}_task_${task.id}_q_ky.mp3`,
            };
            entries.push({
              id: `${lesson.id}_task_${task.id}_q`,
              worldId: world.id,
              lessonId: lesson.id,
              kind: 'task_question',
              index: 0,
              taskId: task.id,
              questionKey: task.questionKey,
              texts,
              suggestedFilename,
            });
          }

          if (task.type === 'multiple_choice') {
            for (const opt of task.options) {
              const texts = {} as Record<Lang, { raw: string; forTTS: string }>;
              for (const lng of LOCALES) {
                const raw = isEnglishReadingLesson
                  ? (getByKey(translations.en, opt.textKey) ?? '')
                  : (getByKey(translations[lng], opt.textKey) ?? '');
                texts[lng] = { raw, forTTS: stripForTTS(raw) };
              }
              const suggestedFilename = {
                ru: `${lesson.id}_task_${task.id}_opt_${opt.id}_ru.mp3`,
                en: `${lesson.id}_task_${task.id}_opt_${opt.id}_en.mp3`,
                ky: `${lesson.id}_task_${task.id}_opt_${opt.id}_ky.mp3`,
              };
              entries.push({
                id: `${lesson.id}_task_${task.id}_opt_${opt.id}`,
                worldId: world.id,
                lessonId: lesson.id,
                kind: 'task_option',
                index: 0,
                taskId: task.id,
                optionId: opt.id,
                textKey: opt.textKey,
                texts,
                suggestedFilename,
              });
            }
          }
        }
      }
    }
  }

  const outDir = path.join(__dirname, 'output');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'voice-manifest-5-6.json');
  const payload = {
    description:
      'Интро, диалоги и строки заданий (вопрос + варианты MC) для ageBand 5-6. forTTS — без эмодзи, как в useSpeech. Для уроков subject reading варианты во всех локалях берутся из en (как optionText в приложении).',
    ageBand: targetBand,
    worldIds: [...new Set(entries.map((e) => e.worldId))],
    entryCount: entries.length,
    entries,
  };
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`Wrote ${entries.length} entries to ${outPath}`);

  const csvPath = path.join(outDir, 'voice-manifest-5-6.csv');
  const csvHeader =
    'entry_id,lesson_id,world_id,kind,line_index,speaker,lang,filename,text_for_tts,task_id,option_id\n';
  const csvRows: string[] = [];
  for (const e of entries) {
    for (const lng of LOCALES) {
      const fn = e.suggestedFilename[lng];
      const text = e.texts[lng].forTTS;
      if (!text) continue;
      csvRows.push(
        [
          e.id,
          e.lessonId,
          e.worldId,
          e.kind,
          String(e.index),
          e.speaker ?? '',
          lng,
          fn,
          escapeCsvCell(text),
          e.taskId ?? '',
          e.optionId ?? '',
        ].join(','),
      );
    }
  }
  fs.writeFileSync(csvPath, csvHeader + csvRows.join('\n'), 'utf8');
  console.log(`Wrote ${csvRows.length} rows to ${csvPath}`);
}

main();
