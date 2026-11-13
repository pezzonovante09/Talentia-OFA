import { emptySkill, type SkillState } from '../mastery';
import {
  buildParentReport,
  HARD_LIMIT,
  isHard,
  lastSevenDays,
  REVIEW_LESSON_ID,
  runSeconds,
  skillsSummary,
  weekSummary,
  type LessonRun,
} from '../parentReport';

const utcDay = (iso: string) => iso.slice(0, 10);

let seq = 0;
function run(over: Partial<LessonRun> = {}): LessonRun {
  seq += 1;
  return {
    id: `r-${seq}`,
    childId: 'kid-1',
    lessonId: 'l-1',
    startedAt: '2026-09-24T09:00:00Z',
    taskSeconds: [30, 30, 30, 30],
    reviewTasks: 0,
    ...over,
  };
}

const skill = (id: string, over: Partial<SkillState> = {}): SkillState => ({ ...emptySkill(id), ...over });

describe('время занятий', () => {
  it('брошенное задание не превращается в часы: потолок 120 с на задание', () => {
    expect(runSeconds(run({ taskSeconds: [30, 4 * 3600, 45] }))).toBe(30 + 120 + 45);
  });

  it('отрицательная длительность от сбитых часов не уменьшает время', () => {
    expect(runSeconds(run({ taskSeconds: [60, -500] }))).toBe(60);
  });
});

describe('неделя', () => {
  it('семь дней, заканчивая сегодня, через границу месяца', () => {
    expect(lastSevenDays('2026-10-02')).toEqual([
      '2026-09-26',
      '2026-09-27',
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
    ]);
  });

  it('дни, минуты, уроки, повторения', () => {
    const w = weekSummary(
      [
        run({ startedAt: '2026-09-24T09:00:00Z', reviewTasks: 2 }),
        run({ startedAt: '2026-09-24T18:00:00Z' }),
        run({ startedAt: '2026-09-20T09:00:00Z', reviewTasks: 1 }),
        run({ startedAt: '2026-09-10T09:00:00Z' }), // за пределами недели
      ],
      '2026-09-24',
      utcDay,
    );
    expect({ дни: w.activeDays, минут: w.minutes, уроков: w.lessons, повторений: w.reviewTasks }).toEqual({
      дни: 2,
      минут: 6,
      уроков: 3,
      повторений: 3,
    });
    expect(w.days.map((d) => d.active)).toEqual([false, false, true, false, false, false, true]);
  });
});

describe('навыки', () => {
  it('освоено — коробка 4', () => {
    const s = skillsSummary([skill('b', { box: 4 }), skill('a', { box: 4 }), skill('c', { box: 3 })]);
    expect(s.mastered.map((x) => x.skill)).toEqual(['a', 'b']);
  });

  it('тяжело — коробка 1 при ≥ 3 попытках и ≤ половины верных, коробка 2 при ≥ 5 и меньше половины; худшие первыми', () => {
    const s = skillsSummary([
      skill('new', { box: 1, attempts: 1 }),
      skill('ok', { box: 2, attempts: 5, correct: 2 }),
      skill('bad', { box: 1, attempts: 7, correct: 2 }),
    ]);
    expect(s.hard.map((x) => x.skill)).toEqual(['bad', 'ok']);
  });

  it('не трудность: безошибочный первый урок (коробка 2, 4 из 4), два из трёх верно в коробке 1, коробка 2 с половиной верных (вопрос 57)', () => {
    expect(isHard(skill('clean', { box: 2, attempts: 4, correct: 4 }))).toBe(false);
    expect(isHard(skill('two-of-three', { box: 1, attempts: 3, correct: 2 }))).toBe(false);
    expect(isHard(skill('half', { box: 2, attempts: 6, correct: 3 }))).toBe(false);
    expect(isHard(skill('shown', { box: 1, attempts: 3, correct: 1 }))).toBe(true);
    expect(isHard(skill('box3', { box: 3, attempts: 9, correct: 1 }))).toBe(false);
  });

  it('прохождение-повторение не входит в число уроков недели, его задания — в повторения', () => {
    const base = { childId: 'c', taskSeconds: [10, 10] };
    const runs = [
      { ...base, id: 'r1', lessonId: 'nv-count-l1', startedAt: '2026-10-05T10:00:00.000Z', reviewTasks: 1 },
      { ...base, id: 'r2', lessonId: REVIEW_LESSON_ID, startedAt: '2026-10-05T11:00:00.000Z', reviewTasks: 2 },
    ];
    const w = weekSummary(runs, '2026-10-05', (iso) => iso.slice(0, 10));
    expect({ lessons: w.lessons, reviewTasks: w.reviewTasks, activeDays: w.activeDays }).toEqual({ lessons: 1, reviewTasks: 3, activeDays: 1 });
  });

  it('не больше пяти строк', () => {
    const many = Array.from({ length: 9 }, (_, i) => skill(`s${i}`, { box: 1, attempts: 4 }));
    expect(skillsSummary(many).hard).toHaveLength(HARD_LIMIT);
  });

  it('в работе — коробки 2–3, кроме уже показанных в «тяжело»', () => {
    const s = skillsSummary([
      skill('hard', { box: 2, attempts: 5, correct: 1 }),
      skill('mid', { box: 2, attempts: 2 }),
      skill('late', { box: 3, attempts: 6 }),
    ]);
    expect(s.inProgress).toBe(2);
  });
});

describe('отчёт', () => {
  it('прохождения другого ребёнка в отчёт не попадают', () => {
    const r = buildParentReport(
      'kid-1',
      [run(), run({ childId: 'kid-2' }), run({ childId: 'kid-2' })],
      [],
      '2026-09-24',
      utcDay,
    );
    expect(r.week.lessons).toBe(1);
  });

  it('последний раз — по самому свежему прохождению', () => {
    const r = buildParentReport(
      'kid-1',
      [run({ startedAt: '2026-09-22T09:00:00Z' }), run({ startedAt: '2026-09-23T09:00:00Z' })],
      [],
      '2026-09-24',
      utcDay,
    );
    expect(r.lastRunAt).toBe('2026-09-23T09:00:00Z');
  });

  it('ещё не занимался — не ноль, а отсутствие', () => {
    expect(buildParentReport('kid-1', [], [], '2026-09-24', utcDay).lastRunAt).toBeNull();
  });
});
