/**
 * Seeds public.worlds, public.lessons, public.tasks from src/data/worlds.ts
 * using the Supabase service role (bypasses RLS for writes).
 *
 * Env (e.g. talentia-mobile/.env.local — do not commit secrets):
 *   SUPABASE_URL (or EXPO_PUBLIC_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Run from talentia-mobile:
 *   npm run seed:content
 */

import { resolve } from 'node:path';

import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

import { worlds } from '../src/data/worlds';

const root = process.cwd();
loadEnv({ path: resolve(root, '.env') });
loadEnv({ path: resolve(root, '.env.local'), override: true });

const url = process.env.SUPABASE_URL?.trim() || process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !serviceKey) {
  console.error(
    'Missing env. Need in .env or .env.local (run from talentia-mobile folder):\n' +
      '  SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL\n' +
      '  SUPABASE_SERVICE_ROLE_KEY (server only — never EXPO_PUBLIC_)\n',
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type WorldRow = {
  id: string;
  subject: string;
  order_index: number;
  metadata: Record<string, unknown>;
};

type LessonRow = {
  id: string;
  world_id: string;
  order_index: number;
  metadata: Record<string, unknown>;
};

type TaskRow = {
  id: string;
  lesson_id: string;
  task_type: string;
  data: unknown;
  aba_only: boolean;
  order_index: number;
};

function buildRows(): { worlds: WorldRow[]; lessons: LessonRow[]; tasks: TaskRow[] } {
  const worldRows: WorldRow[] = [];
  const lessonRows: LessonRow[] = [];
  const taskRows: TaskRow[] = [];

  worlds.forEach((w, wi) => {
    const subject = (w.topics[0]?.subject ?? 'math') as string;
    worldRows.push({
      id: w.id,
      subject,
      order_index: wi,
      metadata: {
        titleKey: w.titleKey,
        descriptionKey: w.descriptionKey,
        accentColor: w.accentColor,
        biome: w.biome,
        npcName: w.npcName,
        npcEmoji: w.npcEmoji,
        isPremium: w.isPremium,
        ageBand: w.ageBand,
        topics: w.topics.map((t) => ({
          id: t.id,
          worldId: t.worldId,
          titleKey: t.titleKey,
          descriptionKey: t.descriptionKey,
          subject: t.subject,
        })),
      },
    });

    let lessonOrder = 0;
    for (const topic of w.topics) {
      for (const lesson of topic.lessons) {
        lessonRows.push({
          id: lesson.id,
          world_id: w.id,
          order_index: lessonOrder++,
          metadata: {
            topicId: lesson.topicId,
            titleKey: lesson.titleKey,
            descriptionKey: lesson.descriptionKey,
            dialog: lesson.dialog,
            intro: lesson.intro,
            reward: lesson.reward,
            abaTokensPerPiece: lesson.abaTokensPerPiece,
          },
        });

        lesson.tasks.forEach((task, ti) => {
          taskRows.push({
            id: `${lesson.id}::${task.id}`,
            lesson_id: lesson.id,
            task_type: task.type,
            data: task as unknown,
            aba_only: task.audience === 'special_aba',
            order_index: ti,
          });
        });
      }
    }
  });

  return { worlds: worldRows, lessons: lessonRows, tasks: taskRows };
}

async function main() {
  const { worlds: wr, lessons: lr, tasks: tr } = buildRows();

  const { error: e1 } = await supabase.from('worlds').upsert(wr, { onConflict: 'id' });
  if (e1) throw e1;
  const { error: e2 } = await supabase.from('lessons').upsert(lr, { onConflict: 'id' });
  if (e2) throw e2;
  const { error: e3 } = await supabase.from('tasks').upsert(tr, { onConflict: 'id' });
  if (e3) throw e3;

  console.log(`Upserted worlds=${wr.length}, lessons=${lr.length}, tasks=${tr.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
