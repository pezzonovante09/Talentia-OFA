/**
 * Merges draft task files from Downloads into worlds.ts slice (meadow–island).
 * Run: node talentia-mobile/scripts/build-pre56-worlds.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DOWNLOADS = path.join(process.env.USERPROFILE || '', 'Downloads');
const DRAFT_56 = path.join(DOWNLOADS, 'new_tasks_5_6.ts');
const DRAFT_ISLAND = path.join(DOWNLOADS, 'new_tasks_island.ts');
const WORLDS = path.join(ROOT, 'src', 'data', 'worlds.ts');

function normalize(raw) {
  return raw
    .split('\n')
    .map((line) => {
      const t = line.trim();
      if (!t || t.startsWith('//')) return null;
      const ci = line.indexOf('//');
      if (ci === -1) return line;
      return line.slice(0, ci).replace(/\s+$/, '');
    })
    .filter(Boolean)
    .join('\n')
    .replace(/pre_opt_os\u0451l/g, 'pre_opt_osel')
    .replace(/pre_opt_syl_MA/g, 'pre_opt_syl_ma')
    .replace(/pre_opt_syl_MO/g, 'pre_opt_syl_mo')
    .replace(/pre_opt_syl_MU/g, 'pre_opt_syl_mu')
    .replace(/pre_opt_syl_SA/g, 'pre_opt_syl_sa')
    .replace(/pre_opt_syl_SO/g, 'pre_opt_syl_so')
    .replace(/pre_opt_syl_SU/g, 'pre_opt_syl_su')
    .replace(/pre_opt_syl_NA/g, 'pre_opt_syl_na')
    .replace(/pre_opt_syl_SL/g, 'pre_opt_syl_sl')
    .replace(/pre_opt_syl_RA/g, 'pre_opt_syl_ra')
    .replace(/pre_opt_syl_KE/g, 'pre_opt_syl_ke')
    .replace(/pre_read_MA/g, 'pre_read_ma')
    .replace(/pre_read_MO/g, 'pre_read_mo')
    .replace(/pre_read_SA/g, 'pre_read_sa')
    .replace(/pre_read_NA/g, 'pre_read_na')
    .replace(/pre_MU_first_letter/g, 'pre_mu_first_letter')
    .replace(/pre_SO_first_letter/g, 'pre_so_first_letter');
}

function extractLesson(draft, lessonId) {
  const needle = `id: '${lessonId}'`;
  const idx = draft.indexOf(needle);
  if (idx === -1) throw new Error(`Lesson not found: ${lessonId}`);
  let start = draft.lastIndexOf('{', idx);
  if (start === -1) throw new Error(`No { for ${lessonId}`);
  let depth = 0;
  for (let k = start; k < draft.length; k++) {
    const c = draft[k];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return draft.slice(start, k + 1).trim();
    }
  }
  throw new Error(`Unclosed object ${lessonId}`);
}

function joinLessons(draft, ids) {
  return ids.map((id) => extractLesson(draft, id)).join(',\n          ');
}

function readGardenSeasons(worldsText) {
  const start = worldsText.indexOf("id: 'garden-seasons'");
  if (start === -1) throw new Error('garden-seasons not found');
  let brace = worldsText.indexOf('{', start);
  let depth = 0;
  for (let k = brace; k < worldsText.length; k++) {
    if (worldsText[k] === '{') depth++;
    else if (worldsText[k] === '}') {
      depth--;
      if (depth === 0) {
        let end = k + 1;
        while (end < worldsText.length && /\s/.test(worldsText[end])) end++;
        if (worldsText[end] === ',') end++;
        const lineStart = worldsText.lastIndexOf('\n', brace) + 1;
        return worldsText.slice(lineStart, end).trimEnd();
      }
    }
  }
  throw new Error('parse garden-seasons');
}

function main() {
  const d56 = normalize(fs.readFileSync(DRAFT_56, 'utf8'));
  const islandDraft = normalize(fs.readFileSync(DRAFT_ISLAND, 'utf8'));
  const worlds = fs.readFileSync(WORLDS, 'utf8');
  const gardenSeasonsBlock = readGardenSeasons(worlds);

  const meadowCount5 = joinLessons(d56, ['meadow-c5-l1', 'meadow-c5-l2', 'meadow-c5-l3']);
  const meadowCount10 = joinLessons(d56, ['meadow-c10-l1', 'meadow-c10-l2', 'meadow-c10-l3']);
  const meadowShapes = joinLessons(d56, ['meadow-sh-l1', 'meadow-sh-l2', 'meadow-sh-l3']);
  const forestV = joinLessons(d56, ['forest-v-l1', 'forest-v-l2', 'forest-v-l3']);
  const forestC = joinLessons(d56, ['forest-con-l1', 'forest-con-l2', 'forest-con-l3']);
  const forestS = joinLessons(d56, ['forest-syl-l1', 'forest-syl-l2', 'forest-syl-l3']);
  const gardenCol = joinLessons(d56, ['garden-col-l1', 'garden-col-l2', 'garden-col-l3']);
  const gardenAnim = joinLessons(d56, ['garden-anim-l1', 'garden-anim-l2', 'garden-anim-l3']);
  const islandAbc = joinLessons(islandDraft, ['island-abc-l1', 'island-abc-l2', 'island-abc-l3']);
  const islandCol = joinLessons(islandDraft, ['island-col-l1', 'island-col-l2', 'island-col-l3']);
  const islandAnim = joinLessons(islandDraft, ['island-anim-l1', 'island-anim-l2', 'island-anim-l3']);

  const out = `  {
    id: 'meadow',
    ageBand: '5-6',
    titleKey: 'data.worlds.meadow',
    descriptionKey: 'data.worldDesc.meadow',
    accentColor: '#FF7043',
    biome: '',
    npcName: 'Зайка Зоя',
    npcEmoji: '',
    topics: [
      {
        id: 'meadow-count5',
        worldId: 'meadow',
        titleKey: 'data.topics.meadowCount5',
        subject: 'math',
        lessons: [
          ${meadowCount5},
        ],
      },
      {
        id: 'meadow-count10',
        worldId: 'meadow',
        titleKey: 'data.topics.meadowCount10',
        subject: 'math',
        lessons: [
          ${meadowCount10},
        ],
      },
      {
        id: 'meadow-shapes',
        worldId: 'meadow',
        titleKey: 'data.topics.meadowShapes',
        subject: 'math',
        lessons: [
          ${meadowShapes},
        ],
      },
    ],
  },

  // ---
  {
    id: 'forest',
    ageBand: '5-6',
    titleKey: 'data.worlds.forest',
    descriptionKey: 'data.worldDesc.forest',
    accentColor: '#66BB6A',
    biome: '',
    npcName: 'Ёжик Федя',
    npcEmoji: '',
    topics: [
      {
        id: 'forest-vowels',
        worldId: 'forest',
        titleKey: 'data.topics.forestVowels',
        subject: 'reading_ru',
        lessons: [
          ${forestV},
        ],
      },
      {
        id: 'forest-consonants',
        worldId: 'forest',
        titleKey: 'data.topics.forestConsonants',
        subject: 'reading_ru',
        lessons: [
          ${forestC},
        ],
      },
      {
        id: 'forest-syllables',
        worldId: 'forest',
        titleKey: 'data.topics.forestSyllables',
        subject: 'reading_ru',
        lessons: [
          ${forestS},
        ],
      },
    ],
  },

  // ---
  {
    id: 'garden',
    ageBand: '5-6',
    titleKey: 'data.worlds.garden',
    descriptionKey: 'data.worldDesc.garden',
    accentColor: '#9CCC65',
    biome: '',
    npcName: 'Черепашка Тара',
    npcEmoji: '',
    topics: [
      {
        id: 'garden-colors',
        worldId: 'garden',
        titleKey: 'data.topics.gardenColors',
        subject: 'logic',
        lessons: [
          ${gardenCol},
        ],
      },
      {
        id: 'garden-animals',
        worldId: 'garden',
        titleKey: 'data.topics.gardenAnimals',
        subject: 'logic',
        lessons: [
          ${gardenAnim},
        ],
      },
      // ---
      ${gardenSeasonsBlock}
    ],
  },

  // ---
  {
    id: 'island',
    ageBand: '5-6',
    titleKey: 'data.worlds.island',
    descriptionKey: 'data.worldDesc.island',
    accentColor: '#29B6F6',
    biome: '',
    npcName: 'Попугай Пит',
    npcEmoji: '',
    topics: [
      {
        id: 'island-abc',
        worldId: 'island',
        titleKey: 'data.topics.islandAbc',
        subject: 'reading',
        lessons: [
          ${islandAbc},
        ],
      },
      {
        id: 'island-colors',
        worldId: 'island',
        titleKey: 'data.topics.islandColors',
        subject: 'reading',
        lessons: [
          ${islandCol},
        ],
      },
      {
        id: 'island-animals',
        worldId: 'island',
        titleKey: 'data.topics.islandAnimals',
        subject: 'reading',
        lessons: [
          ${islandAnim},
        ],
      },
    ],
  },`;

  const startMark = worlds.indexOf("  {\n    id: 'meadow',");
  const endMark = worlds.indexOf("  {\n    id: 'g1math', titleKey:");
  if (startMark === -1 || endMark === -1) throw new Error('worlds.ts markers not found');
  const before = worlds.slice(0, startMark);
  const after = worlds.slice(endMark);
  const next = `${before}${out}\n${after}`;
  fs.writeFileSync(WORLDS, next, 'utf8');
  console.log('Updated worlds.ts (meadow → island)');
}

main();
