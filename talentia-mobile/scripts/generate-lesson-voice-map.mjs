/**
 * Собирает require() для всех .mp3 в assets/audio/lesson-voice-5-6/
 * → src/generated/lessonVoiceAssets.ts
 *
 * Запуск: npm run lesson-voice:generate-map
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const mp3Dir = path.join(root, 'assets', 'audio', 'lesson-voice-5-6');
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
    ' * Исходные файлы: assets/audio/lesson-voice-5-6/*.mp3',
    ' */',
    '/* eslint-disable @typescript-eslint/no-require-imports */',
    'export const LESSON_VOICE_ASSETS: Record<string, number> = {',
  ];
  for (const f of files) {
    const key = f.replace(/\.mp3$/i, '');
    lines.push(`  '${key}': require('../../assets/audio/lesson-voice-5-6/${f}'),`);
  }
  lines.push('};', '');
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, lines.join('\n'), 'utf8');
  console.log(`Wrote ${files.length} entries → ${outFile}`);
}

main();
