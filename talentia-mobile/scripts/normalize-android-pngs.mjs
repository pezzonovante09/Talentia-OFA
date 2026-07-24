/**
 * Re-encodes image assets that use a .png extension into real 8-bit RGBA PNGs
 * so Android AAPT2 can compile them. Some exports were JPEG bytes behind a
 * .png name, which fails release resource merging (`file failed to compile`).
 *
 * Run: node scripts/normalize-android-pngs.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const dirs = [
  path.join(root, "assets", "images", "backgrounds"),
  path.join(root, "assets", "images", "npcs"),
  path.join(root, "assets", "images", "ui"),
];

function walkPng(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    if (name.toLowerCase().endsWith(".png")) out.push(path.join(dir, name));
  }
  return out;
}

async function normalize(file) {
  const meta = await sharp(file).metadata();
  const buf = await sharp(file)
    .ensureAlpha()
    .png({ compressionLevel: 9, effort: 10, force: true })
    .toBuffer();
  const tmp = `${file}.tmp-${process.pid}.png`;
  fs.writeFileSync(tmp, buf);
  fs.renameSync(tmp, file);
  const after = await sharp(file).metadata();
  console.log(
    "OK",
    path.relative(root, file),
    `(was ${meta.format} → ${after.format}, ${after.width}x${after.height})`,
  );
}

const files = dirs.flatMap(walkPng);
if (files.length === 0) {
  console.error("No PNGs found under backgrounds/npcs/ui");
  process.exit(1);
}

for (const f of files) {
  await normalize(f);
}
console.log("Done:", files.length, "files");
