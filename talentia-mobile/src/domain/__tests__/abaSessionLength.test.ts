/**
 * Мерило длины занятия (решение владельца 2026-11-19, «освоенное вперемешку»): стартовая очередь `startAbaSession`
 * на настоящем контенте `MATCH_LEVEL1` — сколько проб каждого вида выдаёт сборка по ступеням лестницы, с пробами
 * вперемешку и без (`params.noInterspersal`). Числа — то, что выдаёт сборка, а не план: коррекции, обмены и пробы
 * участия появляются по ходу сессии и сюда не входят.
 *
 * Вход — как у настоящего старта (`readAbaStartInput`): цели через `targetForBand`, `autoPlacement: true`. Сессия 10,
 * «со взрослым». Освоенная цель «поддержание не подошло» — `lastMaintenanceSessionIndex` = номеру сессии; «подошло» — 0.
 */
import type { AbaTargetState, PromptLevel } from '../../types/aba';
import type { AgeBand } from '../../types/task';
import { MATCH_LEVEL1 } from '../../content/aba/match-level1';
import { initialTargetState } from '../abaPrompting';
import { INTERSPERSAL, type AbaSessionState } from '../abaSession';
import type { AbaSessionParams } from '../abaSessionParams';
import { targetForBand } from '../abaTargetRules';
import type { PlannedTrial } from '../abaTrialStep';
import type { BoardStage } from '../abaTokenTraining';
import { startedSession, trained } from './abaSessionDriver';

const SESSION_INDEX = 10;
const SEEDS = [1, 7, 42, 99, 2026];
const [SAME2, SAME3, SHAPE, COLOR] = ['match-same-2', 'match-same-3', 'match-shape', 'match-color-3'];

const targetsFor = (band: AgeBand) => MATCH_LEVEL1.map((t) => targetForBand(t, band));
const targetOf = (id: string) => MATCH_LEVEL1.find((t) => t.id === id)!;

const acq = (id: string, start: PromptLevel): AbaTargetState => ({
  ...initialTargetState(targetOf(id)),
  phase: 'acquisition',
  startPromptLevel: start,
  lastSuccessfulPromptLevel: start,
});

/** Освоена по критерию со взрослым; `due` — подошла проба поддержания. */
const mastered = (id: string, due = false): AbaTargetState => ({
  ...initialTargetState(targetOf(id)),
  phase: 'mastered',
  startPromptLevel: 0,
  lastSuccessfulPromptLevel: 0,
  masteredBy: 'criterion',
  masteredConfig: 'with_adult',
  lastMaintenanceSessionIndex: due ? 0 : SESSION_INDEX,
});

type Profile = { states: Record<string, AbaTargetState>; board: BoardStage };

const PROFILES = {
  /** Ступень 1: «одинаковые из 2» в обучении, освоенного нет. */
  step1L3: { states: { [SAME2]: acq(SAME2, 3) }, board: 1 },
  step1L0: { states: { [SAME2]: acq(SAME2, 0) }, board: 1 },
  step1L0FullBoard: { states: { [SAME2]: acq(SAME2, 0) }, board: 3 },
  /** Ступень 2: «из 2» освоена, «из 3» в обучении со стартом L0. */
  step2: { states: { [SAME2]: mastered(SAME2), [SAME3]: acq(SAME3, 0) }, board: 3 },
  step2Board2: { states: { [SAME2]: mastered(SAME2), [SAME3]: acq(SAME3, 0) }, board: 2 },
  step2MaintenanceDue: { states: { [SAME2]: mastered(SAME2, true), [SAME3]: acq(SAME3, 0) }, board: 3 },
  /** Ступени 3–4: обе «одинаковые» освоены, форма и цвет в обучении со стартом L0. */
  step34: { states: { [SAME2]: mastered(SAME2), [SAME3]: mastered(SAME3), [SHAPE]: acq(SHAPE, 0), [COLOR]: acq(COLOR, 0) }, board: 3 },
  step34MaintenanceDue: {
    states: { [SAME2]: mastered(SAME2, true), [SAME3]: mastered(SAME3, true), [SHAPE]: acq(SHAPE, 0), [COLOR]: acq(COLOR, 0) },
    board: 3,
  },
} satisfies Record<string, Profile>;

function start(p: Profile, band: AgeBand, seed = 42, params?: AbaSessionParams): AbaSessionState {
  return startedSession({
    band,
    targets: targetsFor(band),
    states: p.states,
    tokenTraining: trained(p.board),
    sessionIndex: SESSION_INDEX,
    autoPlacement: true,
    seed,
    ...(params ? { params } : {}),
  });
}

const trialsOf = (st: AbaSessionState): PlannedTrial[] => st.queue.flatMap((q) => (q.kind === 'trial' ? [q.trial] : []));

/** Число проб стартовой очереди по видам; `mixed` — сколько из `high_p` подмешано в обучающий блок. */
function counts(st: AbaSessionState) {
  const all = trialsOf(st);
  const of = (kind: PlannedTrial['kind']) => all.filter((t) => t.kind === kind).length;
  return {
    teaching: of('teaching'),
    high_p: of('high_p'),
    baseline: of('baseline'),
    generalization: of('generalization'),
    maintenance: of('maintenance'),
    mixed: all.filter((t) => t.inBlockOf).length,
    total: all.length,
  };
}

const row = (teaching: number, high_p: number, mixed: number, maintenance = 0) => ({
  teaching,
  high_p,
  baseline: 0,
  generalization: 0,
  maintenance,
  mixed,
  total: teaching + high_p + maintenance,
});

describe('длина занятия на настоящем контенте: число проб стартовой очереди по видам', () => {
  // [профиль, полоса 5–6, полоса 7]: у «одинаковых из 2» с полосы 7 блок выбора из двух — 10 проб (`twoChoiceBlock`)
  const TABLE: [keyof typeof PROFILES, ReturnType<typeof row>, ReturnType<typeof row>][] = [
    ['step1L3', row(5, 0, 0), row(10, 0, 0)],
    ['step1L0', row(5, 0, 0), row(10, 0, 0)],
    ['step1L0FullBoard', row(5, 0, 0), row(10, 0, 0)],
    // разогрев 2 + вперемешку 2
    ['step2', row(5, 4, 2), row(5, 4, 2)],
    // доска на ступени 2 — только разогрев
    ['step2Board2', row(5, 2, 0), row(5, 2, 0)],
    // единственная освоенная ушла на пробу поддержания: ни разогрева, ни вперемешку
    ['step2MaintenanceDue', row(5, 0, 0, 1), row(5, 0, 0, 1)],
    // два блока по 5: разогрев 2 + вперемешку 2 + 2
    ['step34', row(10, 6, 4), row(10, 6, 4)],
    ['step34MaintenanceDue', row(10, 0, 0, 2), row(10, 0, 0, 2)],
  ];

  describe.each(TABLE)('%s', (name, young, older) => {
    it.each([
      ['5-6', young],
      ['7', older],
    ] as const)('полоса %s — на любом seed', (band, expected) => {
      for (const seed of SEEDS) expect(counts(start(PROFILES[name], band, seed))).toEqual(expected);
    });
  });

  it.each(Object.keys(PROFILES) as (keyof typeof PROFILES)[])('%s: `noInterspersal` убирает ровно подмешанные пробы, остальное то же', (name) => {
    for (const band of ['5-6', '7'] as const) {
      for (const seed of SEEDS) {
        const on = counts(start(PROFILES[name], band, seed));
        const off = counts(start(PROFILES[name], band, seed, { noInterspersal: true }));
        expect(off).toEqual({ ...on, high_p: on.high_p - on.mixed, mixed: 0, total: on.total - on.mixed });
      }
    }
  });

  it('вперемешку удлиняет занятие только на ступенях 2–4 с полной доской: +2 пробы на блок', () => {
    const added = (name: keyof typeof PROFILES) => counts(start(PROFILES[name], '5-6')).mixed;
    expect(Object.fromEntries((Object.keys(PROFILES) as (keyof typeof PROFILES)[]).map((n) => [n, added(n)]))).toEqual({
      step1L3: 0,
      step1L0: 0,
      step1L0FullBoard: 0,
      step2: 2,
      step2Board2: 0,
      step2MaintenanceDue: 0,
      step34: 4,
      step34MaintenanceDue: 0,
    });
  });
});

/** Обучающие блоки очереди: пробы от первой обучающей до `block_end` (разогрев перед блоком в него не входит). */
function teachingBlocks(st: Pick<AbaSessionState, 'queue'>): { targetId: string; trials: PlannedTrial[] }[] {
  const out: { targetId: string; trials: PlannedTrial[] }[] = [];
  let run: PlannedTrial[] = [];
  for (const q of st.queue) {
    if (q.kind === 'trial') {
      run.push(q.trial);
      continue;
    }
    if (q.kind === 'block_end') {
      const from = run.findIndex((t) => t.kind === 'teaching');
      if (from >= 0) out.push({ targetId: q.targetId, trials: run.slice(from) });
    }
    run = [];
  }
  return out;
}

/** Нарушения правил «вперемешку» в очереди; пусто — правила соблюдены. */
function interspersalViolations(st: Pick<AbaSessionState, 'queue' | 'highPTargetIds'>): string[] {
  const errors: string[] = [];
  const blocks = teachingBlocks(st);
  for (const { targetId, trials } of blocks) {
    const kinds = trials.map((t) => t.kind);
    if (kinds[0] !== 'teaching' || kinds[1] !== 'teaching') errors.push(`${targetId}: первые две пробы цели не подряд`);
    if (kinds.at(-1) !== 'teaching') errors.push(`${targetId}: блок кончается не пробой цели`);
    if (kinds.some((k, i) => k === 'high_p' && kinds[i + 1] === 'high_p')) errors.push(`${targetId}: две high_p подряд`);
    // окно из пяти обучающих проб подряд: между первой и пятой — не больше двух подмешанных
    const at = kinds.flatMap((k, i) => (k === 'teaching' ? [i] : []));
    for (let i = 0; i + 4 < at.length; i += 1) {
      const between = kinds.slice(at[i], at[i + 4]).filter((k) => k === 'high_p').length;
      if (between > 2) errors.push(`${targetId}: ${between} high_p на пять обучающих`);
    }
    for (const t of trials) {
      if (t.kind === 'teaching') {
        if (t.targetId !== targetId) errors.push(`${targetId}: обучающая проба чужой цели ${t.targetId}`);
        continue;
      }
      if (t.kind !== 'high_p') errors.push(`${targetId}: в блоке проба вида ${t.kind}`);
      if (t.inBlockOf !== targetId) errors.push(`${targetId}: inBlockOf = ${String(t.inBlockOf)}`);
      if (t.targetId === targetId) errors.push(`${targetId}: подмешана сама цель блока`);
      if (!st.highPTargetIds.includes(t.targetId)) errors.push(`${targetId}: подмешана неосвоенная ${t.targetId}`);
    }
  }
  const inBlocks = blocks.flatMap((b) => b.trials).filter((t) => t.inBlockOf).length;
  const marked = st.queue.filter((q) => q.kind === 'trial' && q.trial.inBlockOf).length;
  if (inBlocks !== marked) errors.push(`проб с inBlockOf вне обучающих блоков: ${marked - inBlocks}`);
  return errors;
}

describe('правила «вперемешку» на очередях настоящего контента', () => {
  it.each(Object.keys(PROFILES) as (keyof typeof PROFILES)[])('%s: нарушений нет — обе полосы, пять seed', (name) => {
    for (const band of ['5-6', '7'] as const) {
      for (const seed of SEEDS) expect(interspersalViolations(start(PROFILES[name], band, seed))).toEqual([]);
    }
  });

  it('ступень 2: порядок блока — две пробы цели, освоенная, две пробы цели, освоенная, проба цели', () => {
    const [block] = teachingBlocks(start(PROFILES.step2, '5-6'));
    expect(block.targetId).toBe(SAME3);
    expect(block.trials.map((t) => [t.kind, t.targetId, t.inBlockOf])).toEqual([
      ['teaching', SAME3, undefined],
      ['teaching', SAME3, undefined],
      ['high_p', SAME2, SAME3],
      ['teaching', SAME3, undefined],
      ['teaching', SAME3, undefined],
      ['high_p', SAME2, SAME3],
      ['teaching', SAME3, undefined],
    ]);
  });

  it('ступени 3–4: в оба блока подмешиваются только «одинаковые», форма и цвет друг в друга не идут', () => {
    for (const seed of SEEDS) {
      const blocks = teachingBlocks(start(PROFILES.step34, '5-6', seed));
      expect(blocks.map((b) => b.targetId).sort()).toEqual([COLOR, SHAPE].sort());
      for (const b of blocks) {
        const mixedIn = b.trials.filter((t) => t.inBlockOf).map((t) => t.targetId);
        expect(mixedIn).toHaveLength(2);
        for (const id of mixedIn) expect([SAME2, SAME3]).toContain(id);
      }
    }
  });

  it('блок из 10 (полоса 7, «из 2» снова в обучении при освоенной «из 3»): перед 3, 5, 7 и 9-й пробой цели', () => {
    // состояние вне обычной лестницы — на контенте ступени 1 блок из 10 иначе с освоенным не встречается
    const back: Profile = { states: { [SAME2]: acq(SAME2, 0), [SAME3]: mastered(SAME3) }, board: 3 };
    for (const seed of SEEDS) {
      const st = start(back, '7', seed);
      const block = teachingBlocks(st).find((b) => b.targetId === SAME2)!;
      expect(block.trials.map((t) => (t.kind === 'teaching' ? 't' : 'h')).join('')).toBe('tthtthtthtthtt');
      expect(interspersalViolations(st)).toEqual([]);
    }
  });

  it('условия из `INTERSPERSAL`: каждая вторая проба цели, старт не выше L1, доска со ступени 3', () => {
    expect(INTERSPERSAL).toEqual({ everyTeaching: 2, maxStartLevel: 1, minBoardStage: 3 });
  });

  it('проверка самих правил: сломанные очереди дают нарушения', () => {
    const t = (targetId: string): PlannedTrial => ({ kind: 'teaching', targetId, exemplarId: 'e1' });
    const h = (targetId: string, inBlockOf?: string): PlannedTrial => ({ kind: 'high_p', targetId, exemplarId: 'e1', ...(inBlockOf ? { inBlockOf } : {}) });
    const queueOf = (trials: PlannedTrial[]) => ({
      highPTargetIds: [SAME2],
      queue: [...trials.map((trial) => ({ kind: 'trial' as const, trial })), { kind: 'block_end' as const, targetId: SAME3, participation: true }],
    });
    const A = SAME3;
    const ok = [t(A), t(A), h(SAME2, A), t(A), t(A), h(SAME2, A), t(A)];
    expect(interspersalViolations(queueOf(ok))).toEqual([]);
    const broken: [string, PlannedTrial[]][] = [
      ['две high_p подряд', [t(A), t(A), h(SAME2, A), h(SAME2, A), t(A), t(A), t(A)]],
      ['первые две пробы цели не подряд', [t(A), h(SAME2, A), t(A), t(A), t(A), t(A)]],
      ['3 high_p на пять обучающих', [t(A), t(A), h(SAME2, A), t(A), h(SAME2, A), t(A), h(SAME2, A), t(A)]],
      ['inBlockOf = undefined', [t(A), t(A), h(SAME2), t(A), t(A), t(A)]],
      ['подмешана сама цель блока', [t(A), t(A), h(A, A), t(A), t(A), t(A)]],
      ['подмешана неосвоенная', [t(A), t(A), h(SHAPE, A), t(A), t(A), t(A)]],
      ['блок кончается не пробой цели', [t(A), t(A), t(A), t(A), t(A), h(SAME2, A)]],
    ];
    for (const [message, trials] of broken) {
      expect(interspersalViolations(queueOf(trials)).join('; ')).toContain(message);
    }
  });
});
