/**
 * Итоги урока — только при согласии `account_local` (№124; PARENT.md, «Запись уроков под
 * `account_local`», п. 8). Режим без записи — устройство без этого согласия: на диск не пишется
 * ничего.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { AbaTrial } from '../../../types/aba';
import type { ConsentEvent } from '../../../domain/consent';
import { emptySkill } from '../../../domain/mastery';
import type { LessonRun } from '../../../domain/parentReport';
import { AbaConsentRequiredError, appendTrial, trialsOfTarget, withAbaWrite } from '../abaLog';
import { LessonConsentRequiredError } from '../accountConsent';
import { LESSON_STATE_KEYS, loadChildState, saveChildState } from '../childState';
import { commitLesson, setAbaPaused, type LessonCommit } from '../commit';
import { appendConsentEvent, insertConsentEvent } from '../consentLog';
import { appendLessonRun, lessonRunsOf } from '../lessonRuns';
import { purgeChild, wipeDevice } from '../purge';
import { migrate } from '../schema';
import type { SqlDb } from '../sql';
import { asLessonWriter, memoryDb, writeLessonRun } from './nodeSql';

const NOW = '2026-09-30T10:00:00Z';
const PSEUDO = '5f0c2a8e-3b1d-4c6e-9a7f-2d8b1e4c7a90';

const account = (over: Partial<ConsentEvent> = {}): ConsentEvent => ({
  id: `acc-${over.action ?? 'grant'}-${over.textVersion ?? 'ru-draft-1'}`,
  scope: 'account_local',
  action: 'grant',
  childId: null,
  textVersion: 'ru-draft-1',
  confirmedBy: 'pin',
  actorId: 'parent',
  at: NOW,
  ...over,
});

const lesson = (childId = 'kid', id = 'r-1'): LessonCommit => ({
  run: { id, childId, lessonId: 'l', startedAt: NOW, taskSeconds: [5], reviewTasks: 0 } satisfies LessonRun,
  skills: [emptySkill('count')],
  atlas: [],
  nextLessonNumber: 2,
});

/** Ни прохождений, ни ключей итогов урока у ребёнка. */
async function nothingWritten(db: SqlDb, childId = 'kid') {
  expect(await lessonRunsOf(db, childId)).toEqual([]);
  for (const key of LESSON_STATE_KEYS) expect(await loadChildState(db, childId, key)).toBeUndefined();
}

describe('итог урока без согласия account_local не пишется', () => {
  it('не спрашивали — режим без записи: ошибка not_asked, на диске ничего', async () => {
    const db = await memoryDb(undefined, { account: false });
    const err = await commitLesson(db, 'kid', lesson(), NOW).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(LessonConsentRequiredError);
    expect((err as LessonConsentRequiredError).status).toBe('not_asked');
    await nothingWritten(db);
    // ни строки ни в одной таблице базы, а не только в таблицах урока
    const tables = await db.all<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
    );
    expect(tables.length).toBeGreaterThan(10);
    for (const { name } of tables) expect([name, await db.all(`SELECT 1 FROM ${name}`)]).toEqual([name, []]);
  });

  it('согласие на прежний текст — outdated, не записано', async () => {
    const db = await memoryDb(undefined, { account: false });
    await appendConsentEvent(db, account({ textVersion: 'ru-old' }), null);
    await expect(commitLesson(db, 'kid', lesson(), NOW)).rejects.toMatchObject({ status: 'outdated' });
    await nothingWritten(db);
  });

  it('отзыв (штатно — только с удалением аккаунта) — revoked, не записано', async () => {
    const db = await memoryDb(undefined, { account: false });
    await appendConsentEvent(db, account({ at: '2026-09-30T09:00:00Z' }), null);
    await db.transaction((tx) => insertConsentEvent(tx, account({ action: 'revoke' }), null));
    await expect(commitLesson(db, 'kid', lesson(), NOW)).rejects.toMatchObject({ status: 'revoked' });
    await nothingWritten(db);
  });

  it('согласие на ru, en и ky действует: смена языка запись не блокирует', async () => {
    for (const textVersion of ['ru-draft-1', 'en-draft-1', 'ky-draft-1']) {
      const db = await memoryDb(undefined, { account: false });
      await appendConsentEvent(db, account({ textVersion }), null);
      await commitLesson(db, 'kid', lesson(), NOW);
      expect(await lessonRunsOf(db, 'kid')).toHaveLength(1);
    }
  });

  it('при согласии записаны все четыре записи, ворота после записи закрыты', async () => {
    const db = await memoryDb();
    await commitLesson(db, 'kid', lesson(), NOW);
    expect(await lessonRunsOf(db, 'kid')).toHaveLength(1);
    expect(await loadChildState(db, 'kid', 'skills')).toHaveLength(1);
    expect(await loadChildState(db, 'kid', 'atlas')).toEqual([]);
    expect(await loadChildState(db, 'kid', 'lessonCounter')).toBe(2);
    expect(await db.all('SELECT 1 FROM lesson_write_gate')).toEqual([]);
  });
});

describe('согласие account_local в журнале', () => {
  it('отзыв через appendConsentEvent не принимается — только удалением аккаунта', async () => {
    const db = await memoryDb();
    await expect(appendConsentEvent(db, account({ action: 'revoke' }), null)).rejects.toThrow(/удалением аккаунта/);
    await commitLesson(db, 'kid', lesson(), NOW);
    expect(await lessonRunsOf(db, 'kid')).toHaveLength(1);
  });

  it('insertConsentEvent в обход запретов appendConsentEvent вызывает только purge.ts', () => {
    // отзыв account_local и ABA без удаления данных можно записать только им: новый вызов — повод для проверки
    const root = path.join(__dirname, '../../..');
    const files = (dir: string): string[] =>
      fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
        const p = path.join(dir, d.name);
        if (d.isDirectory()) return d.name === '__tests__' ? [] : files(p);
        return /\.tsx?$/.test(d.name) ? [p] : [];
      });
    const callers = files(root)
      .filter((f) => /insertConsentEvent\(/.test(fs.readFileSync(f, 'utf8')))
      .map((f) => path.relative(root, f).replace(/\\/g, '/'));
    expect(callers.sort()).toEqual(['services/local/consentLog.ts', 'services/local/purge.ts']);
  });

  it('account_local, привязанное к ребёнку, не записывается и запись не открывает', async () => {
    const db = await memoryDb(undefined, { account: false });
    await expect(appendConsentEvent(db, account({ childId: 'kid' }), 'owner')).rejects.toThrow(/аккаунт привязано к ребёнку/);
    await expect(commitLesson(db, 'kid', lesson(), NOW)).rejects.toBeInstanceOf(LessonConsentRequiredError);
  });
});

describe('ворота урока в базе', () => {
  it('в обход commit.ts база не пускает ни прохождение, ни навыки, атлас и счётчик', async () => {
    const db = await memoryDb();
    await expect(appendLessonRun(db, lesson().run)).rejects.toThrow(/account_local/);
    await expect(saveChildState(db, 'kid', 'skills', [], NOW)).rejects.toThrow(/account_local/);
    await expect(saveChildState(db, 'kid', 'atlas', [], NOW)).rejects.toThrow(/account_local/);
    await expect(saveChildState(db, 'kid', 'lessonCounter', 1, NOW)).rejects.toThrow(/account_local/);
    await nothingWritten(db);
  });

  it('перезапись ключа в обход ворот тоже отклоняется', async () => {
    const db = await memoryDb();
    await commitLesson(db, 'kid', lesson(), NOW);
    await expect(saveChildState(db, 'kid', 'lessonCounter', 99, NOW)).rejects.toThrow(/account_local/);
    expect(await loadChildState(db, 'kid', 'lessonCounter')).toBe(2);
  });

  it('ворота ребёнка A не пропускают прохождение и навыки ребёнка B', async () => {
    const db = await memoryDb();
    await expect(asLessonWriter(db, 'kid-a', (tx) => appendLessonRun(tx, lesson('kid-b').run))).rejects.toThrow(/account_local/);
    await expect(asLessonWriter(db, 'kid-a', (tx) => saveChildState(tx, 'kid-b', 'skills', [], NOW))).rejects.toThrow(/account_local/);
    await nothingWritten(db, 'kid-b');
  });

  it('забытые ворота закрываются при открытии базы', async () => {
    const db = await memoryDb();
    await db.run("INSERT INTO lesson_write_gate (child_id) VALUES ('kid')");
    await migrate(db);
    expect(await db.all('SELECT 1 FROM lesson_write_gate')).toEqual([]);
    await expect(appendLessonRun(db, lesson().run)).rejects.toThrow(/account_local/);
  });
});

describe('ABA тоже требует account_local', () => {
  const trial: AbaTrial = {
    id: 'tr-1',
    sessionId: 's-1',
    targetId: 't',
    exemplarId: 'e',
    index: 0,
    kind: 'teaching',
    startPromptLevel: 0,
    promptLevelUsed: 0,
    presentations: 1,
    response: 'independent',
    emittedBeforePrompt: true,
    latencyMs: 900,
    latencyFromFirstSdMs: 900,
    latencySource: 'adult_press',
    promptDelayMs: 3000,
    responseWindowMs: 5000,
    presentationLog: [],
    sdEndedAt: NOW,
    scoredBy: 'adult',
    tokens: 1,
  };
  const aba: ConsentEvent = { ...account(), id: 'aba-g', scope: 'aba_processing', childId: 'kid', confirmedBy: 'biometric' };

  it('согласие на ребёнка без account_local не выдаётся, отзыв — принимается', async () => {
    const db = await memoryDb(undefined, { account: false });
    await expect(appendConsentEvent(db, aba, 'owner')).rejects.toThrow(/сначала согласие account_local/);
    await expect(appendConsentEvent(db, { ...aba, id: 'cloud-g', scope: 'cloud_sync' }, 'owner')).rejects.toThrow(/account_local/);
    await appendConsentEvent(db, { ...aba, id: 'cloud-rv', scope: 'cloud_sync', action: 'revoke' }, 'owner');
    expect(await db.all("SELECT id FROM consent_events WHERE action = 'grant'")).toEqual([]);
  });

  it('согласие на ABA в журнале без account_local (в обход журнала) — запись ABA и пауза отклоняются', async () => {
    const db = await memoryDb(undefined, { account: false });
    await db.run(
      `INSERT INTO consent_events (id, scope, action, child_id, text_version, confirmed_by, actor_id, at)
       VALUES ('aba-g', 'aba_processing', 'grant', 'kid', 'ru-draft-1', 'biometric', 'parent', ?)`,
      [NOW],
    );
    await expect(withAbaWrite(db, 'kid', (tx) => appendTrial(tx, 'kid', trial, NOW))).rejects.toBeInstanceOf(AbaConsentRequiredError);
    expect(await setAbaPaused(db, 'kid', true, NOW)).toBe('no_consent');
    expect(await trialsOfTarget(db, 'kid', 't')).toEqual([]);
    expect(await db.all('SELECT 1 FROM child_state')).toEqual([]);
  });

  it('с account_local и согласием на ABA — пишется', async () => {
    const db = await memoryDb();
    await appendConsentEvent(db, aba, 'owner');
    await withAbaWrite(db, 'kid', (tx) => appendTrial(tx, 'kid', trial, NOW));
    expect(await trialsOfTarget(db, 'kid', 't')).toHaveLength(1);
  });
});

describe('удаление', () => {
  it('удаление аккаунта: ни прохождений, ни состояния, ни журнала согласий', async () => {
    const db = await memoryDb();
    await commitLesson(db, 'kid', lesson(), NOW);
    await wipeDevice(db);
    for (const t of ['lesson_runs', 'child_state', 'consent_events', 'lesson_write_gate']) {
      expect(await db.all(`SELECT 1 FROM ${t}`)).toEqual([]);
    }
  });

  it('удаление одного ребёнка не трогает итоги урока второго', async () => {
    const db = await memoryDb();
    await commitLesson(db, 'kid-a', lesson('kid-a', 'r-a'), NOW);
    await commitLesson(db, 'kid-b', lesson('kid-b', 'r-b'), NOW);
    await purgeChild(db, 'kid-a', PSEUDO);
    await nothingWritten(db, 'kid-a');
    expect(await lessonRunsOf(db, 'kid-b')).toHaveLength(1);
    expect(await loadChildState(db, 'kid-b', 'lessonCounter')).toBe(2);
  });

  it('после удаления ребёнка ворота урока по-прежнему держат запись в обход', async () => {
    const db = await memoryDb();
    await writeLessonRun(db, lesson('kid-a', 'r-a').run);
    await purgeChild(db, 'kid-a', PSEUDO);
    await expect(appendLessonRun(db, lesson('kid-a', 'r-a2').run)).rejects.toThrow(/account_local/);
  });
});
