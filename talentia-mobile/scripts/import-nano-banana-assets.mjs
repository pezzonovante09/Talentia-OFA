/**
 * Копирует PNG из папки Cursor (куда Cursor сохраняет вложения) в assets/images/.
 * Путь по умолчанию — типичный для Windows; переопредели: CURSOR_ASSETS_DIR=...
 *
 * Соответствие файлов (как в чате):
 * 1–4 NPC: zoya, pete, fedya, tara
 * 5–7,9 фоны: meadow, garden, forest, island
 * 8 спрайтшит UI → потом: npm run assets:splice-nano-ui
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const DEFAULT_CURSOR_ASSETS = path.join(
  process.env.USERPROFILE || '',
  '.cursor',
  'projects',
  'c-Users-User-Desktop-Talentia-v1-0',
  'assets',
);

const srcDir = process.env.CURSOR_ASSETS_DIR || DEFAULT_CURSOR_ASSETS;

function pick(files, pred) {
  const f = files.find(pred);
  if (!f) throw new Error(`No file matching in ${srcDir}`);
  return path.join(srcDir, f);
}

function main() {
  if (!fs.existsSync(srcDir)) {
    console.error('Нет папки:', srcDir);
    console.error('Задай CURSOR_ASSETS_DIR=путь_к_папке_с_9_png');
    process.exit(1);
  }
  const names = fs.readdirSync(srcDir).filter((n) => n.endsWith('.png'));
  if (names.length === 0) {
    console.error('В папке нет png:', srcDir);
    process.exit(1);
  }

  const outNpc = path.join(root, 'assets', 'images', 'npcs');
  const outBg = path.join(root, 'assets', 'images', 'backgrounds');
  const outUi = path.join(root, 'assets', 'images', 'ui');
  for (const d of [outNpc, outBg, outUi]) fs.mkdirSync(d, { recursive: true });

  const copy = (from, to) => {
    fs.copyFileSync(from, to);
    console.log('→', path.relative(root, to));
  };

  copy(pick(names, (n) => n.includes('bab__2_')), path.join(outNpc, 'npc-zoya.png'));
  copy(pick(names, (n) => n.includes('tro-')), path.join(outNpc, 'npc-pete.png'));
  copy(pick(names, (n) => n.includes('bab__3_')), path.join(outNpc, 'npc-fedya.png'));
  copy(pick(names, (n) => n.includes('bab__4_')), path.join(outNpc, 'npc-tara.png'));

  copy(pick(names, (n) => n.includes('Wide_landscape_ba-5ed55c39')), path.join(outBg, 'bg-meadow.png'));
  copy(pick(names, (n) => n.includes('Wide_landscape_ba__2_')), path.join(outBg, 'bg-garden.png'));
  copy(pick(names, (n) => n.includes('Wide_landscape_ba__1_')), path.join(outBg, 'bg-forest.png'));
  copy(pick(names, (n) => n.includes('Wide_landscape_ba__3_')), path.join(outBg, 'bg-island.png'));

  copy(pick(names, (n) => n.includes('Gemini_Generated')), path.join(outUi, 'ui-spritesheet.png'));

  const aba = names.find((n) => n.includes('Ultra-minimalist') || n.includes('f5d9dd0d'));
  if (aba) {
    copy(path.join(srcDir, aba), path.join(outBg, 'bg-aba.png'));
  } else {
    console.log('(нет файла ABA-фона Ultra-minimalist — положи png в папку или скопируй в assets/images/backgrounds/bg-aba.png)');
  }

  console.log('\nДальше: npm run assets:splice-nano-ui');
}

main();
