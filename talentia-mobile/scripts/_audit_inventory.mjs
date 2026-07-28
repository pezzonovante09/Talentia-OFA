/**
 * One-off inventory for curriculum content audit.
 * Outputs JSON: lessons, task-type mix, EN stubs, ABA override diffs.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function getNested(obj, dotted) {
  const parts = dotted.split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  return cur;
}

/** Flatten nested locale object to dotted keys under a prefix */
function flatten(obj, prefix = '', out = {}) {
  if (obj == null || typeof obj !== 'object' || Array.isArray(obj)) {
    if (prefix) out[prefix] = obj;
    return out;
  }
  for (const [k, v] of Object.entries(obj)) {
    const next = prefix ? `${prefix}.${k}` : k;
    if (v != null && typeof v === 'object' && !Array.isArray(v)) flatten(v, next, out);
    else out[next] = v;
  }
  return out;
}

function scrapeWorlds(src) {
  const lessons = [];
  // Match lesson blocks loosely: id: '...'
  // We'll parse world/topic/lesson by walking with brace depth around known patterns.
  // Simpler: extract all lesson-like objects with id + topicId nearby.

  // Find worlds array items: id: 'meadow' etc.
  const worldIds = [...src.matchAll(/^\s*id:\s*'([a-z0-9]+)',\s*$/gm)].map((m) => m[1]);
  // Not reliable alone. Use structured scrape:

  const lessonIdRe =
    /\{\s*id:\s*'([^']+)',\s*topicId:\s*'([^']+)',\s*titleKey:\s*'([^']+)'/g;
  let m;
  while ((m = lessonIdRe.exec(src))) {
    const id = m[1];
    const topicId = m[2];
    const titleKey = m[3];
    // Slice from this match to next lesson or reasonable window
    const start = m.index;
    const next = src.slice(start + 1).search(/\{\s*id:\s*'[^']+',\s*topicId:/);
    const end = next === -1 ? Math.min(src.length, start + 25000) : start + 1 + next;
    const block = src.slice(start, end);

    const hasDialog = /dialog:\s*\[/.test(block);
    const hasIntro = /intro:\s*\[/.test(block);
    const dialogKeys = [...block.matchAll(/textKey:\s*'([^']+)'/g)]
      .map((x) => x[1])
      .filter((k) => k.includes('dialog'));
    const introTitleKeys = [...block.matchAll(/titleKey:\s*'([^']+)'/g)]
      .map((x) => x[1])
      .filter((k) => k.includes('intro'));
    const introBodyKeys = [...block.matchAll(/bodyKey:\s*'([^']+)'/g)].map((x) => x[1]);

    // Tasks: type: '...'
    const types = [...block.matchAll(/type:\s*'([a-z_]+)'/g)].map((x) => x[1]);
    const abaTaskCount = (block.match(/audience:\s*'special_aba'/g) || []).length;
    const taskIds = [...block.matchAll(/^\s*id:\s*'([^']+)',\s*$/gm)]
      .map((x) => x[1])
      .filter((x) => x !== id);

    lessons.push({
      id,
      topicId,
      titleKey,
      hasDialog,
      hasIntro,
      dialogKeys,
      introTitleKeys,
      introBodyKeys,
      types,
      uniqueTypes: [...new Set(types)],
      taskCount: types.length,
      abaTaskCount,
      taskIds: taskIds.slice(0, 30),
    });
  }
  return lessons;
}

function inferGrade(worldId, ageBandHint) {
  if (worldId.startsWith('g1')) return 1;
  if (worldId.startsWith('g2')) return 2;
  if (worldId.startsWith('g3')) return 3;
  if (worldId.startsWith('g4')) return 4;
  if (['meadow', 'forest', 'garden', 'island'].includes(worldId)) return 0;
  return 'legacy';
}

function inferWorld(lessonId, topicId) {
  const prefix = topicId.split('-')[0];
  // topicId like meadow-count5, g1m-cnt20, jungle-...
  if (topicId.startsWith('meadow')) return 'meadow';
  if (topicId.startsWith('forest')) return 'forest';
  if (topicId.startsWith('garden')) return 'garden';
  if (topicId.startsWith('island')) return 'island';
  if (topicId.startsWith('jungle')) return 'jungle';
  if (topicId.startsWith('canyon')) return 'canyon';
  if (topicId.startsWith('lab')) return 'lab';
  if (topicId.startsWith('space')) return 'space';
  if (topicId.startsWith('g1m')) return 'g1math';
  if (topicId.startsWith('g1r')) return 'g1rus';
  if (topicId.startsWith('g1w')) return 'g1world';
  if (topicId.startsWith('g1e')) return 'g1eng';
  if (topicId.startsWith('g2m')) return 'g2math';
  if (topicId.startsWith('g2r')) return 'g2rus';
  if (topicId.startsWith('g2s')) return 'g2sci';
  if (topicId.startsWith('g2e')) return 'g2eng';
  if (topicId.startsWith('g3m')) return 'g3math';
  if (topicId.startsWith('g3r')) return 'g3rus';
  if (topicId.startsWith('g3w')) return 'g3world';
  if (topicId.startsWith('g3e')) return 'g3eng';
  if (topicId.startsWith('g4m')) return 'g4math';
  if (topicId.startsWith('g4r')) return 'g4rus';
  if (topicId.startsWith('g4e')) return 'g4eng';
  if (topicId.startsWith('g4s')) return 'g4social';
  return prefix;
}

function subjectFromWorld(worldId) {
  const map = {
    meadow: 'math',
    forest: 'reading_ru',
    garden: 'logic',
    island: 'reading',
    jungle: 'math',
    canyon: 'reading',
    lab: 'logic',
    space: 'logic',
    g1math: 'math',
    g1rus: 'reading_ru',
    g1world: 'logic',
    g1eng: 'reading',
    g2math: 'math',
    g2rus: 'reading_ru',
    g2sci: 'logic',
    g2eng: 'reading',
    g3math: 'math',
    g3rus: 'reading_ru',
    g3world: 'logic',
    g3eng: 'reading',
    g4math: 'math',
    g4rus: 'reading_ru',
    g4eng: 'reading',
    g4social: 'social',
  };
  return map[worldId] || 'unknown';
}

const worldsSrc = fs.readFileSync(path.join(root, 'src/data/worlds.ts'), 'utf8');
// Also scrape bridged task files that may be referenced
const extraFiles = [
  'src/data/rw56LessonTasks.ts',
  'src/data/g1mathBridgedTasks.ts',
  'src/data/g1rusBridgedTasks.ts',
].filter((p) => fs.existsSync(path.join(root, p)));

let lessons = scrapeWorlds(worldsSrc);

// Enrich from spreads that inject tasks - still lesson shells in worlds.ts
const ru = loadJson(path.join(root, 'src/i18n/locales/ru.json'));
const en = loadJson(path.join(root, 'src/i18n/locales/en.json'));
const ky = loadJson(path.join(root, 'src/i18n/locales/ky.json'));
const abaRu = loadJson(path.join(root, 'src/i18n/locales/abaTextOverrides.generated.json'));
const abaEn = loadJson(path.join(root, 'src/i18n/locales/abaTextOverrides.en.generated.json'));
const abaKy = loadJson(path.join(root, 'src/i18n/locales/abaTextOverrides.ky.generated.json'));

const ruFlat = flatten(ru);
const enFlat = flatten(en);
const kyFlat = flatten(ky);

function resolveStandard(flat, key) {
  // keys in worlds are like data.dialog.xxx — locale has nested data
  return flat[key];
}

const stubPatterns = [
  /^Hi! Lesson:/i,
  /^Hi!$/i,
  /^Hello! Lesson:/i,
  /^TODO/i,
  /^\[stub\]/i,
  /^TBD/i,
];

const inventory = lessons.map((l) => {
  const worldId = inferWorld(l.id, l.topicId);
  const grade = inferGrade(worldId);
  const subject = subjectFromWorld(worldId);
  const title = resolveStandard(ruFlat, l.titleKey) || l.titleKey;

  const textKeys = [
    ...l.dialogKeys,
    ...l.introTitleKeys,
    ...l.introBodyKeys,
  ];

  // Also pull task question keys from block - re-scrape questionKey from worlds for this lesson
  // Already limited; scan ru for related - skip heavy

  const enStubKeys = [];
  for (const k of l.dialogKeys) {
    const t = resolveStandard(enFlat, k);
    if (typeof t === 'string' && stubPatterns.some((re) => re.test(t.trim()))) {
      enStubKeys.push(k);
    }
  }

  // ABA diff: for dialog+intro keys, compare aba override to standard RU
  const abaDiffKeys = [];
  for (const k of textKeys) {
    if (abaRu[k] != null && resolveStandard(ruFlat, k) != null) {
      if (String(abaRu[k]).trim() !== String(resolveStandard(ruFlat, k)).trim()) {
        abaDiffKeys.push(k);
      }
    } else if (abaRu[k] != null && resolveStandard(ruFlat, k) == null) {
      abaDiffKeys.push(k);
    }
  }

  // EN/KY coherence flags (lightweight)
  const enkyFlags = [];
  for (const k of l.dialogKeys) {
    const ruT = resolveStandard(ruFlat, k);
    const enT = resolveStandard(enFlat, k);
    const kyT = resolveStandard(kyFlat, k);
    if (enStubKeys.includes(k)) enkyFlags.push(`en_stub:${k}`);
    if (typeof kyT === 'string' && typeof ruT === 'string' && kyT === ruT && /[а-яА-ЯёЁ]/.test(kyT)) {
      enkyFlags.push(`ky_ru_copy:${k}`);
    }
    if (typeof enT === 'string' && /[а-яА-ЯёЁ]/.test(enT)) {
      enkyFlags.push(`en_ru_leak:${k}`);
    }
  }

  return {
    ...l,
    worldId,
    grade,
    subject,
    title,
    enStubKeys,
    abaDiffKeys,
    abaDiff: abaDiffKeys.length > 0,
    enkyFlags,
  };
});

// Task type histogram
const typeHist = {};
const typeLessonCounts = {};
for (const l of inventory) {
  const seen = new Set();
  for (const t of l.types) {
    typeHist[t] = (typeHist[t] || 0) + 1;
    if (!seen.has(t)) {
      typeLessonCounts[t] = (typeLessonCounts[t] || 0) + 1;
      seen.add(t);
    }
  }
}

// Pure-MC lessons
const pureMc = inventory.filter(
  (l) => l.uniqueTypes.length === 1 && l.uniqueTypes[0] === 'multiple_choice',
);

const out = {
  generatedAt: new Date().toISOString(),
  lessonCount: inventory.length,
  typeHist,
  typeLessonCounts,
  pureMcCount: pureMc.length,
  pureMcIds: pureMc.map((l) => l.id),
  abaDiffLessonCount: inventory.filter((l) => l.abaDiff).length,
  enStubLessonCount: inventory.filter((l) => l.enStubKeys.length > 0).length,
  lessons: inventory,
};

const outPath = path.join(__dirname, '_curriculum_audit_inventory.json');
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(
  JSON.stringify(
    {
      lessonCount: out.lessonCount,
      typeHist: out.typeHist,
      typeLessonCounts: out.typeLessonCounts,
      pureMcCount: out.pureMcCount,
      abaDiffLessonCount: out.abaDiffLessonCount,
      enStubLessonCount: out.enStubLessonCount,
      byGrade: inventory.reduce((acc, l) => {
        acc[l.grade] = (acc[l.grade] || 0) + 1;
        return acc;
      }, {}),
      outPath,
    },
    null,
    2,
  ),
);
