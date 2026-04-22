/**
 * Re-encodes PNGs to a minimal 8-bit RGBA form so Android AAPT2 can compile them.
 * Fixes "AAPT: error: file failed to compile" on some exports (ICC / odd PNG chunks).
 *
 * Run: node scripts/normalize-android-pngs.mjs
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const dirs = [
  path.join(root, "assets", "images", "backgrounds"),
  path.join(root, "assets", "images", "npcs"),
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
  const tmp = path.join(
    os.tmpdir(),
    `talentia-png-${path.basename(file)}-${process.pid}-${Date.now()}.png`,
  );
  await sharp(file)
    .ensureAlpha()
    .png({ compressionLevel: 9, effort: 10 })
    .toFile(tmp);
  fs.copyFileSync(tmp, file);
  fs.unlinkSync(tmp);
  console.log("OK", path.relative(root, file));
}

const files = dirs.flatMap(walkPng);
if (files.length === 0) {
  console.error("No PNGs found under backgrounds/npcs");
  process.exit(1);
}

for (const f of files) {
  await normalize(f);
}
console.log("Done:", files.length, "files");
