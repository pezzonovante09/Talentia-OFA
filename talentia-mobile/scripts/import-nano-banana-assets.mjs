/**
 * Импортирует PNG из папки Cursor (куда Cursor сохраняет вложения) в assets/images/.
 * Путь по умолчанию — типичный для Windows; переопредели: CURSOR_ASSETS_DIR=...
 *
 * Картинки сохраняются в WebP: он заметно легче PNG, а iOS 15+/Android его
 * декодируют штатно. NPC дополнительно ужимаются до 256px — на экране они
 * выводятся максимум 66pt (см. NanoBananaIcon size), больше не нужно.
 * Спрайтшит UI — исходник для нарезки, а не ассет приложения, поэтому
 * кладётся в scripts/input/ и в сборку не попадает.
 *
 * Соответствие файлов (как в чате):
 * 1–4 NPC: zoya, pete, fedya, tara
 * 5–7,9 фоны: meadow, garden, forest, island
 * 8 спрайтшит UI → потом: npm run assets:splice-nano-ui
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const NPC_MAX_SIDE = 256;
const BG_QUALITY = 82;
const NPC_QUALITY = 85;

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

async function main() {
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
  const outInput = path.join(root, 'scripts', 'input');
  for (const d of [outNpc, outBg, outInput]) fs.mkdirSync(d, { recursive: true });

  /** PNG → WebP, при необходимости с уменьшением стороны. */
  const convert = async (from, to, { quality, maxSide }) => {
    let pipeline = sharp(from);
    if (maxSide) {
      pipeline = pipeline.resize(maxSide, maxSide, { fit: 'inside', withoutEnlargement: true });
    }
    await pipeline.webp({ quality, effort: 6 }).toFile(to);
    console.log('→', path.relative(root, to));
  };

  const copy = (from, to) => {
    fs.copyFileSync(from, to);
    console.log('→', path.relative(root, to));
  };

  const npc = { quality: NPC_QUALITY, maxSide: NPC_MAX_SIDE };
  await convert(pick(names, (n) => n.includes('bab__2_')), path.join(outNpc, 'npc-zoya.webp'), npc);
  await convert(pick(names, (n) => n.includes('tro-')), path.join(outNpc, 'npc-pete.webp'), npc);
  await convert(pick(names, (n) => n.includes('bab__3_')), path.join(outNpc, 'npc-fedya.webp'), npc);
  await convert(pick(names, (n) => n.includes('bab__4_')), path.join(outNpc, 'npc-tara.webp'), npc);

  const bg = { quality: BG_QUALITY };
  await convert(pick(names, (n) => n.includes('Wide_landscape_ba-5ed55c39')), path.join(outBg, 'bg-meadow.webp'), bg);
  await convert(pick(names, (n) => n.includes('Wide_landscape_ba__2_')), path.join(outBg, 'bg-garden.webp'), bg);
  await convert(pick(names, (n) => n.includes('Wide_landscape_ba__1_')), path.join(outBg, 'bg-forest.webp'), bg);
  await convert(pick(names, (n) => n.includes('Wide_landscape_ba__3_')), path.join(outBg, 'bg-island.webp'), bg);

  // Спрайтшит остаётся PNG: его режет assets:splice-nano-ui, в приложение он не попадает.
  copy(pick(names, (n) => n.includes('Gemini_Generated')), path.join(outInput, 'ui-spritesheet.png'));

  const aba = names.find((n) => n.includes('Ultra-minimalist') || n.includes('f5d9dd0d'));
  if (aba) {
    await convert(path.join(srcDir, aba), path.join(outBg, 'bg-aba.webp'), bg);
  } else {
    console.log('(нет файла ABA-фона Ultra-minimalist — положи png в папку или скопируй в assets/images/backgrounds/bg-aba.webp)');
  }

  console.log('\nДальше: npm run assets:splice-nano-ui');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
