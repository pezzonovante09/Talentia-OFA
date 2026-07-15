/**
 * Собирает require() для всех .mp3 в assets/audio/<pack>/
 * → src/generated/lessonVoiceAssets.ts
 *
 * Запуск: npm run lesson-voice:generate-map
 * Папка по умолчанию: lesson-voice-5-6
 * Другая папка: node scripts/generate-lesson-voice-map.mjs --dir=lesson-voice-v2
 *   или LESSON_VOICE_PACK_SUBDIR=lesson-voice-v2
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const subdir =
  process.argv.find((a) => a.startsWith('--dir='))?.slice(6)?.trim() ||
  process.env.LESSON_VOICE_PACK_SUBDIR?.trim() ||
  'lesson-voice-5-6';
const mp3Dir = path.join(root, 'assets', 'audio', subdir);
const outFile = path.join(root, 'src', 'generated', 'lessonVoiceAssets.ts');

function main() {
  if (!fs.existsSync(mp3Dir)) {
    fs.mkdirSync(mp3Dir, { recursive: true });
  }
  const files = fs
    .readdirSync(mp3Dir)
    .filter((f) => f.toLowerCase().endsWith('.mp3'))
    .sort();

  const lines = [
    '/**',
    ' * AUTO-GENERATED — npm run lesson-voice:generate-map',
    ` * Исходные файлы: assets/audio/${subdir}/*.mp3`,
    ' */',
    '/* eslint-disable @typescript-eslint/no-require-imports */',
    'export const LESSON_VOICE_ASSETS: Record<string, number> = {',
  ];
  for (const f of files) {
    const key = f.replace(/\.mp3$/i, '');
    lines.push(`  '${key}': require('../../assets/audio/${subdir}/${f}'),`);
  }
  lines.push('};', '');
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, lines.join('\n'), 'utf8');
  console.log(`Wrote ${files.length} entries → ${outFile}`);
}

main();
