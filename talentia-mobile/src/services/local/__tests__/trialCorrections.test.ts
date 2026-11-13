/**
 * Исправление отметки в хранилище (`commitTrialCorrection`, `aba_trial_corrections`, `EFFECTIVE`):
 * атомарность, доска, замена пробы, журнал только дописывается, ворота согласия, удаление при отзыве,
 * по сроку и при стирании, экспорт, и гард «читатели `aba_trials` — только через `EFFECTIVE`».
 * Домен отмены — `domain/__tests__/abaUndo.test.ts`.
 */
import { CURRENT_CONSENT_TEXTS } from '../../../domain/consentTexts';
import fs from 'node:fs';
import path from 'node:path';
import type { AbaSession } from '../../../types/aba';
import { nextStep, recordTrial, type AbaSessionState, type AbaTrialInput } from '../../../domain/abaSession';
import { beginUndo, undoLastMark, type UndoContext } from '../../../domain/abaUndo';
import { boardRevOf } from '../../../domain/abaTokens';
import { initialTokenTraining } from '../../../domain/abaTokenTraining';
import type { ConsentEvent } from '../../../domain/consent';
import { BASE_MS, beginSession, correctInput } from '../../../domain/__tests__/abaSessionDriver';
import {
  AbaBoardConflictError,
  AbaConsentRequiredError,
  AbaPausedError,
  appendSession,
  appendTrialCorrection,
  pastSessionsOfTarget,
  trialsOfSession,
  trialsOfTarget,
} from '../abaLog';
import { loadChildState, saveChildState } from '../childState';
import { commitTrialCorrection, recordAbaTrial, saveAbaSessionStep } from '../commit';
import { appendConsentEvent } from '../consentLog';
import { applyRetention, clearChildProgress, exportChild, exportForSpecialist, purgeChild, revokeAbaProcessing, wipeDevice } from '../purge';
import type { SqlDb } from '../sql';
import { asAbaWriter, memoryDb } from './nodeSql';

const NOW = '2026-10-12T10:00:00Z';
const PSEUDO = '5f0c2a8e-3b1d-4c6e-9a7f-2d8b1e4c7a90';
const iso = (ms: number) => new Date(ms).toISOString();

const consent = (action: 'grant' | 'revoke', childId = 'kid', at = '2026-10-12T07:00:00Z'): ConsentEvent => ({
  id: `aba-${action}-${childId}-${at}`,
  scope: 'aba_processing',
  action,
  childId,
  textVersion: CURRENT_CONSENT_TEXTS.aba_processing[0],
  confirmedBy: 'biometric',
  actorId: 'parent',
  at,
});

async function setup(kids = ['kid']): Promise<SqlDb> {
  const db = await memoryDb();
  for (const [i, kid] of kids.entries()) {
    await appendConsentEvent(db, consent('grant', kid, `2026-10-12T07:0${i}:00Z`), 'owner');
    await asAbaWriter(db, kid, async (tx) => {
      await saveChildState(tx, kid, 'tokenTraining', { ...initialTokenTraining(), pairingDone: true, stage: 5 }, NOW);
    });
  }
  return db;
}

type Marked = { db: SqlDb; pre: AbaSessionState; post: AbaSessionState; ctx: UndoContext; now: number };

/** Сессия записана в хранилище, первая отметка тоже; из неё можно исправить. */
async function marked(db: SqlDb, outcome: 'correct' | 'incorrect' = 'correct'): Promise<Marked> {
  const live = await loadChildState(db, 'kid', 'abaBoard');
  const st = beginSession({ board: live ?? { earned: 0, nonContingent: 0 }, boardRev: boardRevOf(live) });
  const started = await saveAbaSessionStep(db, 'kid', st, iso(BASE_MS), {
    source: 'session',
    sourceId: st.sessionId,
    reinforcerId: st.reinforcerId!,
    chosenBy: 'child',
  });
  const now = BASE_MS + 1000;
  const next = nextStep(started, now);
  if (next.step.kind !== 'trial') throw new Error('ждали пробу');
  const base = correctInput(next.state, next.step);
  const log = base.presentationLog;
  const input: AbaTrialInput = { ...base, presentationLog: [...log.slice(0, -1), { ...log[log.length - 1], outcome }] };
  const rec = recordTrial(next.state, input, now);
  if (!rec.ok) throw new Error(rec.errors.join('; '));
  const post = await recordAbaTrial(db, 'kid', rec.trial, rec.state, iso(now));
  return { db, pre: next.state, post, ctx: beginUndo(next.state, input, { ...rec, state: post }, now), now };
}

function corrected(m: Marked, to: 'correct' | 'incorrect', after = 1500) {
  const u = undoLastMark(m.post, m.ctx, to, m.now + after);
  if (!u.ok) throw new Error(u.errors.join('; '));
  return { ...u, at: iso(m.now + after) };
}

const rows = (db: SqlDb, sql: string) => db.all<Record<string, unknown>>(sql);

describe('commitTrialCorrection: одна транзакция', () => {
  it('верно → неверно: замена записана, исходная проба в журнале осталась, строка исправления есть, снимок сессии обновлён', async () => {
    const m = await marked(await setup());
    const u = corrected(m, 'incorrect');
    const saved = await commitTrialCorrection(m.db, 'kid', u.correction, u.replacement, u.state, u.at);

    expect(await rows(m.db, 'SELECT id FROM aba_trials ORDER BY seq')).toEqual([{ id: m.ctx.trialId }, { id: `${m.ctx.trialId}~c1` }]);
    expect(await rows(m.db, 'SELECT trial_id, replacement_id, from_response, to_response, token_kept, token_added, reason FROM aba_trial_corrections')).toEqual([
      {
        trial_id: m.ctx.trialId,
        replacement_id: `${m.ctx.trialId}~c1`,
        from_response: 'independent',
        to_response: 'incorrect',
        token_kept: 1,
        token_added: 0,
        reason: 'adult_misentry',
      },
    ]);
    expect(await loadChildState(m.db, 'kid', 'abaSessionInProgress')).toEqual(saved);
  });

  it('жетон за исходную отметку остаётся: доска и её версия не меняются исправлением', async () => {
    const m = await marked(await setup());
    const boardBefore = await loadChildState(m.db, 'kid', 'abaBoard');
    const u = corrected(m, 'incorrect');
    await commitTrialCorrection(m.db, 'kid', u.correction, u.replacement, u.state, u.at);
    expect(await loadChildState(m.db, 'kid', 'abaBoard')).toEqual(boardBefore);
  });

  it('неверно → верно с недостающим жетоном: доска +1, версия +1, снимок сессии помнит новую версию', async () => {
    const m = await marked(await setup(), 'incorrect');
    const boardBefore = (await loadChildState(m.db, 'kid', 'abaBoard')) ?? { earned: 0, nonContingent: 0 };
    const u = corrected(m, 'correct');
    expect(u.correction.tokenAdded).toBe(1);
    const saved = await commitTrialCorrection(m.db, 'kid', u.correction, u.replacement, u.state, u.at);
    const live = await loadChildState(m.db, 'kid', 'abaBoard');
    expect(live).toMatchObject({ earned: boardBefore.earned + 1 });
    expect(saved.boardRev).toBe(boardRevOf(live));
    expect(boardRevOf(live)).toBe(boardRevOf(boardBefore) + 1);
  });

  it('доску за это время изменила рутина: AbaBoardConflictError, не записано ничего — ни замены, ни исправления, ни снимка', async () => {
    const m = await marked(await setup());
    const u = corrected(m, 'incorrect');
    await asAbaWriter(m.db, 'kid', (tx) => saveChildState(tx, 'kid', 'abaBoard', { earned: 4, nonContingent: 0, rev: 9 }, NOW));
    const snapshot = await loadChildState(m.db, 'kid', 'abaSessionInProgress');
    await expect(commitTrialCorrection(m.db, 'kid', u.correction, u.replacement, u.state, u.at)).rejects.toBeInstanceOf(AbaBoardConflictError);
    expect(await rows(m.db, 'SELECT id FROM aba_trials')).toEqual([{ id: m.ctx.trialId }]);
    expect(await rows(m.db, 'SELECT * FROM aba_trial_corrections')).toEqual([]);
    expect(await loadChildState(m.db, 'kid', 'abaSessionInProgress')).toEqual(snapshot);
    expect(await loadChildState(m.db, 'kid', 'abaBoard')).toEqual({ earned: 4, nonContingent: 0, rev: 9 });
  });

  it('второе исправление той же пробы: ограничение базы, откат целиком (доска и снимок прежние)', async () => {
    const m = await marked(await setup(), 'incorrect');
    const u = corrected(m, 'correct');
    await commitTrialCorrection(m.db, 'kid', u.correction, u.replacement, u.state, u.at);
    const board = await loadChildState(m.db, 'kid', 'abaBoard');
    const snapshot = await loadChildState(m.db, 'kid', 'abaSessionInProgress');
    // повторная попытка с теми же идентификаторами: доска не менялась после первого — версия совпадает
    await expect(commitTrialCorrection(m.db, 'kid', u.correction, u.replacement, { ...u.state, boardRev: boardRevOf(board) }, u.at)).rejects.toThrow();
    expect(await rows(m.db, 'SELECT id FROM aba_trials')).toHaveLength(2);
    expect(await rows(m.db, 'SELECT * FROM aba_trial_corrections')).toHaveLength(1);
    expect(await loadChildState(m.db, 'kid', 'abaBoard')).toEqual(board);
    expect(await loadChildState(m.db, 'kid', 'abaSessionInProgress')).toEqual(snapshot);
  });

  it('противоречивая замена (инвариант пробы) не пишется, исправления нет', async () => {
    const m = await marked(await setup());
    const u = corrected(m, 'incorrect');
    await expect(
      commitTrialCorrection(m.db, 'kid', u.correction, { ...u.replacement, response: 'independent', promptLevelUsed: 2 }, u.state, u.at),
    ).rejects.toThrow(/не записана/);
    expect(await rows(m.db, 'SELECT * FROM aba_trial_corrections')).toEqual([]);
    expect(await rows(m.db, 'SELECT id FROM aba_trials')).toHaveLength(1);
  });
});

describe('исправление — только при согласии и не на паузе', () => {
  it('без согласия: AbaConsentRequiredError, ничего не записано', async () => {
    const m = await marked(await setup());
    const u = corrected(m, 'incorrect');
    await revokeAbaProcessing(m.db, consent('revoke', 'kid', '2026-10-12T11:00:00Z'), 'owner');
    await expect(commitTrialCorrection(m.db, 'kid', u.correction, u.replacement, u.state, u.at)).rejects.toBeInstanceOf(AbaConsentRequiredError);
    expect(await rows(m.db, 'SELECT * FROM aba_trial_corrections')).toEqual([]);
  });

  it('на паузе: AbaPausedError, ничего не записано', async () => {
    const m = await marked(await setup());
    const u = corrected(m, 'incorrect');
    await asAbaWriter(m.db, 'kid', (tx) => saveChildState(tx, 'kid', 'abaPaused', true, NOW));
    await expect(commitTrialCorrection(m.db, 'kid', u.correction, u.replacement, u.state, u.at)).rejects.toBeInstanceOf(AbaPausedError);
    expect(await rows(m.db, 'SELECT * FROM aba_trial_corrections')).toEqual([]);
  });

  it('строку исправления в обход ворот (appendTrialCorrection без commit.ts) база отклоняет', async () => {
    const db = await setup();
    await expect(
      appendTrialCorrection(db, 'kid', { trialId: 'a', replacementId: 'a~c1', sessionId: 's', msSinceOriginal: 1, fromResponse: 'independent', toResponse: 'incorrect', tokenKept: 1, tokenAdded: 0 }, NOW),
    ).rejects.toThrow(/только через commit\.ts/);
  });

  it('журнал только дописывается: UPDATE и DELETE отклоняются', async () => {
    const m = await marked(await setup());
    const u = corrected(m, 'incorrect');
    await commitTrialCorrection(m.db, 'kid', u.correction, u.replacement, u.state, u.at);
    await expect(m.db.run("UPDATE aba_trial_corrections SET to_response = 'independent'")).rejects.toThrow(/только дописывание/);
    await expect(m.db.run('DELETE FROM aba_trial_corrections')).rejects.toThrow(/только дописывание/);
  });
});

describe('EFFECTIVE: читатели не видят исходной пробы, заменённой исправлением', () => {
  async function withCorrection() {
    const m = await marked(await setup());
    const u = corrected(m, 'incorrect');
    await commitTrialCorrection(m.db, 'kid', u.correction, u.replacement, u.state, u.at);
    return { ...m, u };
  }

  it('trialsOfSession: только замена', async () => {
    const m = await withCorrection();
    expect((await trialsOfSession(m.db, 'kid', 's')).map((t) => t.id)).toEqual([`${m.ctx.trialId}~c1`]);
  });

  it('trialsOfTarget: только замена, ответ — исправленный', async () => {
    const m = await withCorrection();
    const trials = await trialsOfTarget(m.db, 'kid', m.u.replacement.targetId);
    expect(trials.map((t) => [t.id, t.response])).toEqual([[`${m.ctx.trialId}~c1`, 'incorrect']]);
  });

  it('pastSessionsOfTarget: в прошлой сессии цели только замена', async () => {
    const m = await withCorrection();
    await asAbaWriter(m.db, 'kid', (tx) => appendSession(tx, 'kid', { id: 's', index: 10 } as unknown as AbaSession, NOW));
    const past = await pastSessionsOfTarget(m.db, 'kid', m.u.replacement.targetId);
    expect(past.map((s) => [s.index, s.trials.map((t) => t.id)])).toEqual([[10, [`${m.ctx.trialId}~c1`]]]);
  });

  it('до исправления читатели видят исходную пробу (контроль)', async () => {
    const m = await marked(await setup());
    expect((await trialsOfSession(m.db, 'kid', 's')).map((t) => t.id)).toEqual([m.ctx.trialId]);
  });

  it('исправление другого ребёнка читателей этого не затрагивает', async () => {
    const db = await setup(['kid', 'sib']);
    const m = await marked(db);
    await asAbaWriter(db, 'sib', (tx) => tx.run(
      "INSERT INTO aba_trial_corrections (child_id, trial_id, replacement_id, session_id, recorded_at, ms_since_original, from_response, to_response, token_kept, token_added, reason) VALUES ('sib', ?, 'x~c1', 's', ?, 1, 'independent', 'incorrect', 1, 0, 'adult_misentry')",
      [m.ctx.trialId, iso(BASE_MS)],
    ).then(() => undefined));
    expect((await trialsOfSession(db, 'kid', 's')).map((t) => t.id)).toEqual([m.ctx.trialId]);
  });
});

describe('удаление исправлений', () => {
  async function two(kids = ['kid', 'sib']) {
    const db = await setup(kids);
    const m = await marked(db);
    const u = corrected(m, 'incorrect');
    await commitTrialCorrection(db, 'kid', u.correction, u.replacement, u.state, u.at);
    // у второго ребёнка своя строка исправления
    await asAbaWriter(db, 'sib', async (tx) => {
      await tx.run(
        "INSERT INTO aba_trial_corrections (child_id, trial_id, replacement_id, session_id, recorded_at, ms_since_original, from_response, to_response, token_kept, token_added, reason) VALUES ('sib', 'sib-t', 'sib-t~c1', 's2', ?, 1, 'independent', 'incorrect', 1, 0, 'adult_misentry')",
        [iso(BASE_MS)],
      );
    });
    return db;
  }
  const count = async (db: SqlDb, kid: string) =>
    (await db.all<{ n: number }>('SELECT count(*) AS n FROM aba_trial_corrections WHERE child_id = ?', [kid]))[0].n;

  it('отзыв согласия удаляет исправления ребёнка, чужие остаются', async () => {
    const db = await two();
    await revokeAbaProcessing(db, consent('revoke', 'kid', '2026-10-12T12:00:00Z'), 'owner');
    expect([await count(db, 'kid'), await count(db, 'sib')]).toEqual([0, 1]);
  });

  it('база отклоняет отзыв без удаления исправлений', async () => {
    const db = await two(['kid']);
    await expect(db.run("INSERT INTO consent_events (id, scope, action, child_id, text_version, confirmed_by, actor_id, at) VALUES ('r', 'aba_processing', 'revoke', 'kid', 'ru-draft-1', 'biometric', 'parent', '2026-10-12T12:00:00Z')")).rejects.toThrow(/вместе с удалением/);
  });

  it('purgeChild удаляет исправления ребёнка, чужие остаются', async () => {
    const db = await two();
    await purgeChild(db, 'kid', PSEUDO);
    expect([await count(db, 'kid'), await count(db, 'sib')]).toEqual([0, 1]);
  });

  it('clearChildProgress исправления проб не трогает (№189)', async () => {
    const db = await two();
    await clearChildProgress(db, 'kid');
    expect([await count(db, 'kid'), await count(db, 'sib')]).toEqual([1, 1]);
  });

  it('wipeDevice удаляет исправления всех детей', async () => {
    const db = await two();
    await wipeDevice(db);
    expect(await db.all('SELECT 1 FROM aba_trial_corrections')).toEqual([]);
  });

  it('срок хранения удаляет старые исправления по recorded_at, свежие остаются', async () => {
    const db = await setup();
    await asAbaWriter(db, 'kid', async (tx) => {
      const ins = (id: string, at: string) =>
        tx.run(
          "INSERT INTO aba_trial_corrections (child_id, trial_id, replacement_id, session_id, recorded_at, ms_since_original, from_response, to_response, token_kept, token_added, reason) VALUES ('kid', ?, ?, 's', ?, 1, 'independent', 'incorrect', 1, 0, 'adult_misentry')",
          [id, `${id}~c1`, at],
        );
      await ins('old', '2025-09-01T10:00:00.000Z');
      await ins('new', '2026-10-01T10:00:00.000Z');
    });
    expect(await applyRetention(db, new Date(NOW))).toBe(1);
    expect(await db.all('SELECT trial_id FROM aba_trial_corrections')).toEqual([{ trial_id: 'new' }]);
  });
});

describe('экспорт исправлений', () => {
  async function exported() {
    const m = await marked(await setup());
    const u = corrected(m, 'incorrect', 2000);
    await commitTrialCorrection(m.db, 'kid', u.correction, u.replacement, u.state, u.at);
    return m;
  }

  it('родителю — исходная и заменяющая пробы и строка исправления, как записано', async () => {
    const m = await exported();
    const exp = await exportChild(m.db, 'kid', NOW, {});
    expect((exp.abaTrials as { id: string }[]).map((t) => t.id)).toEqual([m.ctx.trialId, `${m.ctx.trialId}~c1`]);
    expect(exp.abaTrialCorrections).toEqual([
      {
        trialId: m.ctx.trialId,
        replacementId: `${m.ctx.trialId}~c1`,
        sessionId: 's',
        msSinceOriginal: 2000,
        fromResponse: 'independent',
        toResponse: 'incorrect',
        tokenKept: 1,
        tokenAdded: 0,
        reason: 'adult_misentry',
      },
    ]);
  });

  it('специалисту — сырые пробы (исходная и замена) и исправления; времени суток в исправлениях нет', async () => {
    const m = await exported();
    const exp = await exportForSpecialist(m.db, 'kid', NOW);
    expect((exp.abaTrials as { id: string }[]).map((t) => t.id)).toEqual([m.ctx.trialId, `${m.ctx.trialId}~c1`]);
    expect(exp.abaTrialCorrections).toHaveLength(1);
    const json = JSON.stringify(exp.abaTrialCorrections);
    expect(json).not.toMatch(/\d{2}:\d{2}/);
    expect(json).not.toMatch(/recordedAt|recorded_at/);
    expect(exp.abaTrialCorrections[0]).toMatchObject({ msSinceOriginal: 2000 });
  });

  it('чужое исправление в экспорт ребёнка не попадает', async () => {
    const db = await setup(['kid', 'sib']);
    const m = await marked(db);
    const u = corrected(m, 'incorrect');
    await commitTrialCorrection(db, 'kid', u.correction, u.replacement, u.state, u.at);
    expect((await exportForSpecialist(db, 'sib', NOW)).abaTrialCorrections).toEqual([]);
    expect((await exportChild(db, 'sib', NOW, {})).abaTrialCorrections).toEqual([]);
  });
});

describe('читатели aba_trials — только через EFFECTIVE', () => {
  const SRC = path.resolve(__dirname, '../../..');
  /** `src/test` — обвязка тестов (её `testMatch` не берёт, поэтому она не под `__tests__`): сырое чтение там — как в тестах. */
  const TEST_SUPPORT = path.join(SRC, 'test');
  const files = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) return e.name === '__tests__' || e.name === 'node_modules' || p === TEST_SUPPORT ? [] : files(p);
      return /\.(ts|tsx)$/.test(e.name) ? [p] : [];
    });
  const rel = (p: string) => path.relative(SRC, p).split(path.sep).join('/');
  const sources = files(SRC).map((p) => ({ file: rel(p), text: fs.readFileSync(p, 'utf8') }));

  it('обвязка src/test в код приложения не импортируется: исключение выше не прячет читателя', () => {
    const app = files(path.join(SRC, '..', 'app')).map((p) => ({ file: rel(p), text: fs.readFileSync(p, 'utf8') }));
    const importers = [...sources, ...app].filter((s) => /from\s+['"][^'"]*\/test\/[^'"]*['"]/.test(s.text)).map((s) => s.file);
    expect(importers).toEqual([]);
  });

  it('сырое чтение FROM/JOIN aba_trials — только в abaLog.ts, purge.ts и триггерах schema.ts', () => {
    const allowed = new Set(['services/local/abaLog.ts', 'services/local/purge.ts', 'services/local/schema.ts']);
    const readers = sources.filter((s) => /\b(FROM|JOIN)\s+aba_trials\b/i.test(s.text)).map((s) => s.file);
    expect(readers.filter((f) => !allowed.has(f))).toEqual([]);
    expect(readers).toContain('services/local/abaLog.ts');
  });

  it('любое упоминание таблицы aba_trials вне журнала, чистки и схемы — только в комментариях', () => {
    const allowed = new Set(['services/local/abaLog.ts', 'services/local/purge.ts', 'services/local/schema.ts']);
    const code = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const offenders = sources.filter((s) => !allowed.has(s.file) && /aba_trials/.test(code(s.text))).map((s) => s.file);
    expect(offenders).toEqual([]);
  });

  it('в abaLog.ts каждое чтение aba_trials несёт условие EFFECTIVE (кроме вставки)', () => {
    const log = sources.find((s) => s.file === 'services/local/abaLog.ts')!.text;
    const reads = [...log.matchAll(/(FROM|JOIN)\s+aba_trials\b[\s\S]{0,260}/gi)].map((m) => m[0]);
    expect(reads.length).toBeGreaterThanOrEqual(3);
    for (const r of reads) expect(r).toMatch(/\$\{EFFECTIVE\}/);
  });

  it('в purge.ts сырое чтение aba_trials — только выгрузки, счёт, срок и удаление (явный список)', () => {
    const purge = sources.find((s) => s.file === 'services/local/purge.ts')!.text;
    const uses = [...purge.matchAll(/.*aba_trials.*/g)].map((m) => m[0].trim());
    // ни одного SELECT тел проб с выводом статистики/прогресса: чтение через bodies('aba_trials') для выгрузок
    expect(uses.filter((u) => /SELECT\s+body/i.test(u))).toEqual([]);
  });
});
