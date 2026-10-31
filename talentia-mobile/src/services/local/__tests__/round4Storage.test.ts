/**
 * Хранилище, раунд 4: срок хранения сводного состояния ABA (№105), открытая форма места по началу
 * прогона, нормализация `lesson_runs.started_at`, выборы подкрепителя специалисту (В6: порядок по
 * `seq`, поля без времени и вариантов), миграция 12 (журнал поправок прогонов и ключ
 * `abaRoutineSettingOpen` за воротами согласия; отзыв при оставшихся данных база не принимает).
 */
import type { AbaTargetState, AbaTrial } from '../../../types/aba';
import { finishRoutineRun } from '../../../domain/abaRoutineRun';
import type { ConsentEvent } from '../../../domain/consent';
import { racq, rday, ROUTINE_TRAINED, rplay, rstart } from '../../../domain/__tests__/abaRoutineDriver';
import { appendRoutineAmendment, appendTrial } from '../abaLog';
import { ABA_STATE_KEYS, loadChildState, saveChildState } from '../childState';
import { commitRoutineExchange, commitRoutineRun } from '../commit';
import { appendConsentEvent } from '../consentLog';
import { lessonRunsOf } from '../lessonRuns';
import { applyRetention, exportChild, exportForSpecialist, revokeAbaProcessing, runRetention } from '../purge';
import type { SqlDb } from '../sql';
import { asAbaWriter, memoryDb, writeLessonRun } from './nodeSql';

const OLD = '2025-09-01T10:00:00.000Z';
const FRESH = '2026-10-01T10:00:00.000Z';
const NOW = new Date('2026-10-19T10:00:00.500Z');

const consent = (action: 'grant' | 'revoke', childId: string, at: string): ConsentEvent => ({
  id: `aba-${action}-${childId}-${at}`,
  scope: 'aba_processing',
  action,
  childId,
  textVersion: 'ru-draft-1',
  confirmedBy: 'biometric',
  actorId: 'parent',
  at,
});

const trialAt = (childId: string, id: string): AbaTrial => ({
  id,
  sessionId: `s-${childId}`,
  targetId: 'A',
  exemplarId: 'A-1',
  index: 0,
  kind: 'teaching' as const,
  startPromptLevel: 0 as const,
  promptLevelUsed: 0 as const,
  presentations: 1,
  response: 'independent' as const,
  emittedBeforePrompt: true,
  latencyMs: 900,
  latencyFromFirstSdMs: 900,
  latencySource: 'adult_press' as const,
  promptDelayMs: 3000,
  responseWindowMs: 5000,
  presentationLog: [],
  sdEndedAt: FRESH,
  scoredBy: 'adult' as const,
  tokens: 0,
});

const keysOf = async (db: SqlDb, childId: string) =>
  (await db.all<{ key: string }>('SELECT key FROM child_state WHERE child_id = ? ORDER BY key', [childId])).map((r) => r.key);

/** Ребёнок с полным ABA-состоянием, записанным в `at`, и паузой. */
async function abaChild(db: SqlDb, childId: string, at: string) {
  await asAbaWriter(db, childId, async (tx) => {
    await saveChildState(tx, childId, 'abaTargets', { A: { targetId: 'A', phase: 'acquisition' } as AbaTargetState }, at);
    await saveChildState(tx, childId, 'tokenTraining', ROUTINE_TRAINED, at);
    await saveChildState(tx, childId, 'abaBoard', { earned: 1, nonContingent: 0 }, at);
    await saveChildState(tx, childId, 'abaSessionIndex', 4, at);
    await saveChildState(tx, childId, 'abaPaused', true, at);
  });
}

describe('срок хранения по доверенному времени (раунд 5, backend В3)', () => {
  it('доверенного времени нет — не удалено ничего, даже очень старое', async () => {
    const db = await memoryDb();
    await abaChild(db, 'old', OLD);
    await asAbaWriter(db, 'old', (tx) => appendTrial(tx, 'old', trialAt('old', 'tr-old'), OLD));
    expect(await applyRetention(db, null)).toBe(0);
    expect(await keysOf(db, 'old')).toEqual(['abaBoard', 'abaPaused', 'abaSessionIndex', 'abaTargets', 'tokenTraining']);
  });

  it('часы устройства на пять лет вперёд: удержано до взрослого, журналы целы (№147)', async () => {
    const db = await memoryDb();
    await abaChild(db, 'old', OLD);
    await asAbaWriter(db, 'old', (tx) => appendTrial(tx, 'old', trialAt('old', 'tr-fresh'), FRESH));
    const out = await runRetention(db, { deviceNow: new Date('2031-10-19T10:00:00Z'), builtAt: null });
    expect(out).toMatchObject({ kind: 'held', reason: 'clock_jump', lastSeen: FRESH });
    expect(await keysOf(db, 'old')).toEqual(['abaBoard', 'abaPaused', 'abaSessionIndex', 'abaTargets', 'tokenTraining']);
  });

  it('обычный ход времени удаляет как раньше', async () => {
    const db = await memoryDb();
    await asAbaWriter(db, 'old', (tx) => appendTrial(tx, 'old', trialAt('old', 'tr-old'), OLD));
    await asAbaWriter(db, 'old', (tx) => appendTrial(tx, 'old', trialAt('old', 'tr-fresh'), FRESH));
    const out = await runRetention(db, { deviceNow: NOW, builtAt: null });
    expect(out).toMatchObject({ kind: 'applied', now: NOW.toISOString() });
    expect(out.kind === 'applied' && out.removed).toBeGreaterThan(0);
  });
});

describe('№105: срок хранения сводного состояния ABA', () => {
  it('ребёнок без активности ABA 12 месяцев: ключи ABA удалены, пауза осталась', async () => {
    const db = await memoryDb();
    await abaChild(db, 'old', OLD);
    await asAbaWriter(db, 'old', (tx) => appendTrial(tx, 'old', trialAt('old', 'tr-old'), OLD));
    await applyRetention(db, NOW);
    const left = await keysOf(db, 'old');
    expect(left).toEqual(['abaPaused']);
    for (const k of ABA_STATE_KEYS) expect(left).not.toContain(k);
  });

  it('свежая проба — активность: старое состояние остаётся', async () => {
    const db = await memoryDb();
    await abaChild(db, 'active', OLD);
    await asAbaWriter(db, 'active', (tx) => appendTrial(tx, 'active', trialAt('active', 'tr-new'), FRESH));
    await applyRetention(db, NOW);
    expect(await keysOf(db, 'active')).toEqual(['abaBoard', 'abaPaused', 'abaSessionIndex', 'abaTargets', 'tokenTraining']);
  });

  it('ребёнок без сессий со свежим состоянием (сопряжение) не теряет его', async () => {
    const db = await memoryDb();
    await abaChild(db, 'fresh', FRESH);
    await applyRetention(db, NOW);
    expect(await loadChildState(db, 'fresh', 'tokenTraining')).toEqual(ROUTINE_TRAINED);
  });

  it('удаление одного ребёнка не задевает другого', async () => {
    const db = await memoryDb();
    await abaChild(db, 'old', OLD);
    await abaChild(db, 'fresh', FRESH);
    await applyRetention(db, NOW);
    expect(await keysOf(db, 'old')).toEqual(['abaPaused']);
    expect((await keysOf(db, 'fresh')).length).toBe(5);
  });

  it('открытая форма места удаляется по началу прогона ($.run.startedAt), а не по updated_at', async () => {
    const db = await memoryDb();
    await abaChild(db, 'kid', FRESH);
    await abaChild(db, 'sib', FRESH);
    const form = (startedAt: string) => ({ run: { runId: 'r', day: '2025-09-01', startedAt: Date.parse(startedAt) }, t1State: {}, sessionIndex: 1, history: { runs: [] } });
    await asAbaWriter(db, 'kid', (tx) => saveChildState(tx, 'kid', 'abaRoutineSettingOpen', form(OLD) as never, FRESH));
    await asAbaWriter(db, 'sib', (tx) => saveChildState(tx, 'sib', 'abaRoutineSettingOpen', form(FRESH) as never, FRESH));
    await applyRetention(db, NOW);
    expect(await loadChildState(db, 'kid', 'abaRoutineSettingOpen')).toBeUndefined();
    expect(await loadChildState(db, 'kid', 'abaTargets')).toBeDefined();
    expect(await loadChildState(db, 'sib', 'abaRoutineSettingOpen')).toBeDefined();
  });

  it('поправки прогонов старше срока удаляются, свежие остаются', async () => {
    const db = await memoryDb();
    await asAbaWriter(db, 'kid', async (tx) => {
      await appendRoutineAmendment(tx, 'kid', { runId: 'r-old', reason: 'setting', setting: 'other_place', phase: null }, OLD);
      await appendRoutineAmendment(tx, 'kid', { runId: 'r-new', reason: 'setting', setting: 'other_place', phase: null }, FRESH);
    });
    await applyRetention(db, NOW);
    expect((await db.all<{ run_id: string }>('SELECT run_id FROM aba_routine_run_amendments')).map((r) => r.run_id)).toEqual(['r-new']);
  });
});

describe('lesson_runs.started_at — единый формат UTC с миллисекундами', () => {
  const run = (id: string, startedAt: string) => ({ id, childId: 'kid', lessonId: 'l-1', startedAt, taskSeconds: [10], reviewTasks: 0 });

  it('время с поясом и без миллисекунд нормализуется в колонке, тело — как пришло', async () => {
    const db = await memoryDb();
    await writeLessonRun(db, run('a', '2026-10-01T14:30:00+05:00'));
    const [row] = await db.all<{ started_at: string }>('SELECT started_at FROM lesson_runs');
    expect(row.started_at).toBe('2026-10-01T09:30:00.000Z');
    expect((await lessonRunsOf(db, 'kid'))[0].startedAt).toBe('2026-10-01T14:30:00+05:00');
  });

  it('срок хранения сравнивает моменты, а не строки: пояс и отсутствие миллисекунд не сдвигают удаление', async () => {
    const db = await memoryDb();
    // граница — 2025-10-19T10:00:00.500Z
    await writeLessonRun(db, run('tz-old', '2025-10-19T14:30:00+05:00')); // 09:30Z — старше
    await writeLessonRun(db, run('noms-old', '2025-10-19T10:00:00Z')); // на 500 мс раньше границы
    await writeLessonRun(db, run('tz-new', '2025-10-19T15:30:00+05:00')); // 10:30Z — моложе
    await applyRetention(db, NOW);
    expect((await lessonRunsOf(db, 'kid')).map((r) => r.id)).toEqual(['tz-new']);
  });
});

describe('выборы подкрепителя: экспорт (В6)', () => {
  async function twoRoutineExchanges() {
    const db = await memoryDb();
    await appendConsentEvent(db, consent('grant', 'kid', '2026-10-01T07:00:00Z'), 'owner');
    await asAbaWriter(db, 'kid', async (tx) => {
      await saveChildState(tx, 'kid', 'tokenTraining', ROUTINE_TRAINED, FRESH);
      // доска из трёх (ступень 5 у записи — старая, работает как 3): два жетона, жетон прогона наполняет
      await saveChildState(tx, 'kid', 'abaBoard', { earned: 2, nonContingent: 0 }, FRESH);
    });
    let state: AbaTargetState = racq();
    const picks: string[] = [];
    // второй выбор — по часам раньше первого: часы устройства ушли назад
    for (const [d, chosenAt] of [
      [1, '2026-10-12T10:00:00.000Z'],
      [2, '2026-10-12T09:00:00.000Z'],
    ] as const) {
      const run = rplay(rstart(state, rday(d)), ['ok', 'ok', 'ok']);
      const r = finishRoutineRun(run, 7, { runs: [] });
      const out = await commitRoutineRun(db, 'kid', r, new Date(run.endedAt!).toISOString());
      picks.push(out.offer!.options[0]);
      await commitRoutineExchange(db, 'kid', run.runId, out.offer!.options[0], d === 1 ? 'child' : 'adult', chosenAt);
      state = r.state;
      await asAbaWriter(db, 'kid', (tx) => saveChildState(tx, 'kid', 'abaBoard', { earned: 2, nonContingent: 0, rev: 10 + d }, FRESH));
    }
    return { db, picks };
  }

  it('специалисту — по порядку записи, а не по часам; день, источник, кто выбрал, жетоны, размер доски', async () => {
    const { db, picks } = await twoRoutineExchanges();
    const spec = await exportForSpecialist(db, 'kid', '2026-10-19T00:00:00Z');
    const choices = spec.abaReinforcerChoices as Record<string, unknown>[];
    // sourceId выбора — тот же id, что у прогона в экспорте (id со временем запись не пропускает — `abaIdGuard`,
    // а замену меткой для старых данных проверяет specialistExport.test.ts)
    const runIds = (spec.abaRoutineRuns as { id: string }[]).map((r) => r.id);
    expect(runIds.join()).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(choices).toEqual([
      { order: 1, day: rday(1), source: 'routine', sourceId: runIds[0], reinforcerId: picks[0], chosenBy: 'child', tokens: 3, boardSize: 3 },
      { order: 2, day: rday(2), source: 'routine', sourceId: runIds[1], reinforcerId: picks[1], chosenBy: 'adult', tokens: 3, boardSize: 3 },
    ]);
    for (const c of choices) {
      expect(c).not.toHaveProperty('chosenAt');
      expect(c).not.toHaveProperty('options');
    }
    expect(JSON.stringify(choices)).not.toMatch(/T\d\d:\d\d/);
  });

  it('родителю — как записано, с жетонами обмена, по порядку записи', async () => {
    const { db } = await twoRoutineExchanges();
    const exp = (await exportChild(db, 'kid', '2026-10-19T00:00:00Z', {})).abaReinforcerChoices as { chosenAt: string; tokens: number; sourceId: string }[];
    expect(exp.map((c) => [c.sourceId, c.chosenAt, c.tokens])).toEqual([
      ['run-2026x10x01', '2026-10-12T10:00:00.000Z', 3],
      ['run-2026x10x02', '2026-10-12T09:00:00.000Z', 3],
    ]);
  });
});

describe('миграция 12: журнал поправок и форма места за воротами согласия', () => {
  it('поправка без ворот согласия база не принимает', async () => {
    const db = await memoryDb();
    await expect(appendRoutineAmendment(db, 'kid', { runId: 'r', reason: 'setting', setting: 'other_place', phase: null }, FRESH)).rejects.toThrow(
      /aba_routine_run_amendments: запись только через commit\.ts/,
    );
  });

  it('ключ abaRoutineSettingOpen без ворот согласия база не принимает', async () => {
    const db = await memoryDb();
    await expect(saveChildState(db, 'kid', 'abaRoutineSettingOpen', null, FRESH)).rejects.toThrow(/состояние ABA только через commit\.ts/);
  });

  it('журнал поправок только дописывается: изменение и удаление не по сроку запрещены', async () => {
    const db = await memoryDb();
    await asAbaWriter(db, 'kid', (tx) => appendRoutineAmendment(tx, 'kid', { runId: 'r', reason: 'setting', setting: 'other_place', phase: null }, FRESH));
    await expect(db.run("UPDATE aba_routine_run_amendments SET body = '{}'")).rejects.toThrow();
    await expect(db.run('DELETE FROM aba_routine_run_amendments')).rejects.toThrow();
  });

  it.each([
    ['оставшаяся поправка', (tx: SqlDb) => appendRoutineAmendment(tx, 'kid', { runId: 'r', reason: 'setting', setting: 'other_place', phase: null }, FRESH)],
    ['открытая форма места', (tx: SqlDb) => saveChildState(tx, 'kid', 'abaRoutineSettingOpen', null, FRESH)],
  ])('отзыв согласия при данных (%s) база не принимает; revokeAbaProcessing удаляет и принимает', async (_, write) => {
    const db = await memoryDb();
    await appendConsentEvent(db, consent('grant', 'kid', '2026-10-01T07:00:00Z'), 'owner');
    await asAbaWriter(db, 'kid', write);
    await expect(appendConsentEvent(db, consent('revoke', 'kid', '2026-10-02T07:00:00Z'), 'owner')).rejects.toThrow();
    await revokeAbaProcessing(db, consent('revoke', 'kid', '2026-10-02T07:00:00Z'), 'owner');
    expect(await db.all('SELECT 1 FROM aba_routine_run_amendments')).toEqual([]);
    expect(await keysOf(db, 'kid')).toEqual([]);
  });
});
