/**
 * Проверка самого гарда: каждое правило из `corpusRules.ts` краснеет на
 * заведомо плохой фикстуре и молчит на хорошей.
 *
 * Хорошая фикстура — два урока, покрывающие все шесть форматов, обе подачи и
 * общий ключ `content.common.*` в двух уроках. Каждая плохая получается из неё
 * одной правкой, так что красный сигнал можно приписать ровно этой правке.
 * Фикстуры живут здесь, а не в `src/content`, — иначе гард принял бы их за
 * контент.
 */
import { CHOOSE_SHARE_MIN_TASKS, RULES, collectCorpus, keysIn } from './corpusRules';
import type { Corpus, Locales, RuleId } from './corpusRules';
import type { ChooseTask, Lesson, Task, TaskFormat, Topic } from '../../types/task';
import { SKILL_BY_ID } from '../../domain/skills';
import type { SkillEntry } from '../../domain/skills';

/**
 * Реестр навыков фикстур вместо настоящего: у фикстур свои навыки. Все — с полосы 5-6 и
 * без пререквизитов, чтобы `skillRegistry` молчал на хорошем корпусе; тесты правила
 * дописывают в карту то, что им нужно.
 */
jest.mock('../../domain/skills', () => {
  const actual = jest.requireActual('../../domain/skills');
  const SKILLS = ['count-to-3', 'sort-by-kind', 'read-words', 'spell', 's'].map((id) => ({
    id,
    region: 'numbers',
    band: '5-6',
    prerequisites: [],
    source: 'norm',
  }));
  return { ...actual, SKILLS, SKILL_BY_ID: new Map(SKILLS.map((x) => [x.id, x])) };
});

/* ------------------------------------------------------------------------ */
/* Фикстуры                                                                  */
/* ------------------------------------------------------------------------ */

const k = (s: string) => `content.fx.${s}`;

/**
 * Урок 5-6: choose, point, match, choose. `group` и `order` — во втором уроке
 * (`lessonPictureTwo`): автор урока 5–6 пишет ровно четыре задания. Все задания на
 * один навык — он новый в полосе, поэтому у урока разобранный пример в формате первого
 * задания.
 */
function lessonPicture(): Lesson {
  return {
    id: 'fx-a-l1',
    titleKey: k('a.l1.title'),
    band: '5-6',
    hook: { taliPose: 'puzzled', lineKey: k('a.l1.hook') },
    atlasEntryKey: k('a.l1.atlas'),
    model: {
      skill: 'count-to-3',
      example: {
        format: 'choose',
        presentation: 'picture',
        promptKey: k('a.l1.m.prompt'),
        stimulus: { labelKey: k('a.l1.m.stimulus'), shape: 'leaf', count: 3 },
        options: [
          { id: 'a', labelKey: 'content.common.one', shape: 'dot', count: 1, correct: false },
          { id: 'b', labelKey: 'content.common.two', shape: 'dot', count: 2, correct: false },
          { id: 'c', labelKey: 'content.common.three', shape: 'dot', count: 3, correct: true },
        ],
      },
      steps: [{ lineKey: k('a.l1.m.s1') }, { lineKey: k('a.l1.m.s2'), reveal: 'c' }],
    },
    tasks: [
      {
        id: 'fx-a-l1-t1',
        skill: 'count-to-3',
        format: 'choose',
        presentation: 'picture',
        promptKey: k('a.l1.t1.prompt'),
        hintKey: k('a.l1.t1.hint'),
        explainKey: [k('a.l1.t1.explain')],
        stimulus: { labelKey: k('a.l1.t1.stimulus'), shape: 'stone', count: 2 },
        options: [
          { id: 'a', labelKey: 'content.common.one', shape: 'dot', count: 1, correct: false },
          { id: 'b', labelKey: 'content.common.two', shape: 'dot', count: 2, correct: true },
          { id: 'c', labelKey: 'content.common.three', shape: 'dot', count: 3, correct: false },
        ],
      },
      {
        id: 'fx-a-l1-t2',
        skill: 'count-to-3',
        format: 'point',
        promptKey: k('a.l1.t2.prompt'),
        hintKey: k('a.l1.t2.hint'),
        explainKey: [k('a.l1.t2.explain')],
        scene: 'region-numbers',
        targets: [
          { id: 'x', x: 0.2, y: 0.3, r: 0.1, correct: true, labelKey: k('a.l1.t2.x') },
          { id: 'y', x: 0.8, y: 0.3, r: 0.2, correct: false, labelKey: k('a.l1.t2.y') },
          { id: 'v', x: 0.5, y: 0.8, r: 0.1, correct: false, labelKey: k('a.l1.t2.v') },
        ],
      },
      {
        id: 'fx-a-l1-t3',
        skill: 'count-to-3',
        format: 'match',
        presentation: 'picture',
        promptKey: k('a.l1.t3.prompt'),
        hintKey: k('a.l1.t3.hint'),
        explainKey: [k('a.l1.t3.explain')],
        pairs: [
          { id: 'p1', left: { labelKey: k('a.l1.t3.l1'), shape: 'berry', count: 1 }, right: { labelKey: 'content.common.one', image: 'card-one' } },
          { id: 'p2', left: { labelKey: k('a.l1.t3.l2'), shape: 'berry', count: 2 }, right: { labelKey: 'content.common.two', image: 'card-two' } },
          { id: 'p3', left: { labelKey: k('a.l1.t3.l3'), shape: 'berry', count: 3 }, right: { labelKey: 'content.common.three', image: 'card-three' } },
        ],
      },
      {
        id: 'fx-a-l1-t4',
        skill: 'count-to-3',
        format: 'choose',
        presentation: 'picture',
        promptKey: k('a.l1.t4.prompt'),
        hintKey: k('a.l1.t4.hint'),
        explainKey: [k('a.l1.t4.explain')],
        stimulus: { labelKey: k('a.l1.t4.stimulus'), shape: 'berry', count: 1 },
        options: [
          { id: 'a', labelKey: 'content.common.one', shape: 'dot', count: 1, correct: true },
          { id: 'b', labelKey: 'content.common.two', shape: 'dot', count: 2, correct: false },
          { id: 'c', labelKey: 'content.common.three', shape: 'dot', count: 3, correct: false },
        ],
      },
    ],
  };
}

/**
 * Второй урок 5-6: `group` (новый навык и формат примера), два задания первого урока под
 * своими ключами и `order`. Составные форматы разнесены по урокам: в уроке 5-6 с примером
 * не больше одного нового (`newCompositeFormat`).
 */
function lessonPictureTwo(): Lesson {
  const renamed = JSON.parse(
    JSON.stringify(lessonPicture().tasks.slice(0, 2)).replace(/fx-a-l1-t(\d)/g, (_, n) => `fx-a-l2-t${Number(n) + 1}`).replace(/a\.l1\.t(\d)\./g, (_, n) => `a.l2.t${Number(n) + 1}.`),
  ) as Task[];
  const order: Task = {
    id: 'fx-a-l2-t4',
    skill: 'count-to-3',
    format: 'order',
    presentation: 'picture',
    promptKey: k('a.l2.t4.prompt'),
    hintKey: k('a.l2.t4.hint'),
    explainKey: [k('a.l2.t4.explain')],
    items: [
      { id: 'i1', labelKey: k('a.l2.t4.i1'), shape: 'leaf', count: 3, position: 2 },
      { id: 'i2', labelKey: k('a.l2.t4.i2'), shape: 'leaf', count: 1, position: 0 },
      { id: 'i3', labelKey: k('a.l2.t4.i3'), shape: 'leaf', count: 2, position: 1 },
    ],
  };
  return {
    id: 'fx-a-l2',
    titleKey: k('a.l2.title'),
    band: '5-6',
    hook: { taliPose: 'found', lineKey: k('a.l2.hook') },
    atlasEntryKey: k('a.l2.atlas'),
    model: {
      skill: 'sort-by-kind',
      example: {
        format: 'group',
        presentation: 'picture',
        promptKey: k('a.l2.m.prompt'),
        groups: [
          { id: 'g1', labelKey: k('a.l2.m.g1'), shape: 'berry' },
          { id: 'g2', labelKey: k('a.l2.m.g2') },
        ],
        items: [
          { id: 'i1', labelKey: k('a.l2.m.i1'), shape: 'berry', count: 2, groupId: 'g1' },
          { id: 'i2', labelKey: k('a.l2.m.i2'), image: 'leaf-small', groupId: 'g2' },
          { id: 'i3', labelKey: k('a.l2.m.i3'), image: 'leaf-big', groupId: 'g2' },
        ],
      },
      steps: [{ lineKey: k('a.l2.m.s1'), reveal: 'i1' }, { lineKey: k('a.l2.m.s2'), reveal: 'i2' }],
    },
    tasks: [
      {
        id: 'fx-a-l2-t1',
        skill: 'sort-by-kind',
        format: 'group',
        presentation: 'picture',
        promptKey: k('a.l2.t1.prompt'),
        hintKey: k('a.l2.t1.hint'),
        explainKey: [k('a.l2.t1.explain')],
        groups: [
          { id: 'g1', labelKey: k('a.l2.t1.g1'), shape: 'stone' },
          { id: 'g2', labelKey: k('a.l2.t1.g2') },
        ],
        items: [
          { id: 'i1', labelKey: k('a.l2.t1.i1'), shape: 'stone', count: 1, groupId: 'g1' },
          { id: 'i2', labelKey: k('a.l2.t1.i2'), image: 'leaf-big', groupId: 'g2' },
          { id: 'i3', labelKey: k('a.l2.t1.i3'), shape: 'stone', count: 2, groupId: 'g1' },
        ],
      },
      ...renamed,
      order,
    ],
  };
}

/**
 * Урок 9-10: текстовая подача, build с фрагментами и без, общий ключ, отрывок, объяснение
 * из двух реплик. Один навык — новый, пример в формате первого задания (`build`).
 */
function lessonText(): Lesson {
  const t = (n: number) => ({ promptKey: k(`b.l1.t${n}.prompt`), hintKey: k(`b.l1.t${n}.hint`), explainKey: [k(`b.l1.t${n}.explain`)] });
  return {
    id: 'fx-b-l1',
    titleKey: k('b.l1.title'),
    band: '9-10',
    hook: { taliPose: 'write', lineKey: k('b.l1.hook') },
    atlasEntryKey: k('b.l1.atlas'),
    model: {
      skill: 'read-words',
      example: { format: 'build', promptKey: k('b.l1.m.prompt'), answer: 'дом', fragments: [{ id: 'f1', labelKey: k('b.l1.m.f1') }, { id: 'f2', labelKey: k('b.l1.m.f2') }] },
      steps: [{ lineKey: k('b.l1.m.s1'), reveal: 'f1' }, { lineKey: k('b.l1.m.s2'), reveal: 'f2' }, { lineKey: k('b.l1.m.s3') }],
    },
    tasks: [
      { id: 'fx-b-l1-t1', skill: 'read-words', format: 'build', ...t(1), answer: 'кот', fragments: [{ id: 'f1', labelKey: k('b.l1.t1.f1') }, { id: 'f2', labelKey: k('b.l1.t1.f2') }] },
      {
        id: 'fx-b-l1-t2',
        skill: 'read-words',
        format: 'choose',
        presentation: 'text',
        ...t(2),
        explainKey: [k('b.l1.t2.explain'), k('b.l1.t2.explain2')],
        passage: { textKey: k('b.l1.t2.passage') },
        options: [
          { id: 'a', labelKey: 'content.common.one', correct: true },
          { id: 'b', labelKey: k('b.l1.t2.b'), correct: false },
          { id: 'c', labelKey: k('b.l1.t2.c'), correct: false },
          { id: 'd', labelKey: k('b.l1.t2.d'), correct: false },
        ],
      },
      { id: 'fx-b-l1-t3', skill: 'read-words', format: 'build', ...t(3), answer: '256' },
      { id: 'fx-b-l1-t4', skill: 'read-words', format: 'point', ...t(4), scene: 'region-words', targets: [{ id: 'z', x: 0.5, y: 0.5, r: 0.15, correct: true, labelKey: k('b.l1.t4.z') }, { id: 'w', x: 0.15, y: 0.25, r: 0.15, correct: false, labelKey: k('b.l1.t4.w') }, { id: 'u', x: 0.85, y: 0.25, r: 0.15, correct: false, labelKey: k('b.l1.t4.u') }] },
      { id: 'fx-b-l1-t5', skill: 'read-words', format: 'match', presentation: 'text', ...t(5), pairs: [{ id: 'p1', left: { labelKey: k('b.l1.t5.l1') }, right: { labelKey: k('b.l1.t5.r1') } }, { id: 'p2', left: { labelKey: k('b.l1.t5.l2') }, right: { labelKey: k('b.l1.t5.r2') } }, { id: 'p3', left: { labelKey: k('b.l1.t5.l3') }, right: { labelKey: k('b.l1.t5.r3') } }] },
      { id: 'fx-b-l1-t6', skill: 'read-words', format: 'order', presentation: 'text', ...t(6), items: [{ id: 'a', labelKey: k('b.l1.t6.a'), position: 1 }, { id: 'b', labelKey: k('b.l1.t6.b'), position: 0 }, { id: 'c', labelKey: k('b.l1.t6.c'), position: 2 }] },
      { id: 'fx-b-l1-t7', skill: 'read-words', format: 'group', presentation: 'text', ...t(7), groups: [{ id: 'g1', labelKey: k('b.l1.t7.g1') }, { id: 'g2', labelKey: k('b.l1.t7.g2') }], items: [{ id: 'a', labelKey: k('b.l1.t7.a'), groupId: 'g1' }, { id: 'b', labelKey: k('b.l1.t7.b'), groupId: 'g2' }, { id: 'c', labelKey: k('b.l1.t7.c'), groupId: 'g1' }] },
      { id: 'fx-b-l1-t8', skill: 'read-words', format: 'choose', presentation: 'text', ...t(8), options: [{ id: 'a', labelKey: k('b.l1.t8.a'), correct: false }, { id: 'b', labelKey: k('b.l1.t8.b'), correct: true }, { id: 'c', labelKey: k('b.l1.t8.c'), correct: false }] },
    ],
  };
}

function goodCorpus(): Corpus {
  return [
    { file: 'numbers-5-6.ts', topic: { id: 'fx-a', titleKey: k('a.title'), lessons: [lessonPicture(), lessonPictureTwo()] } },
    { file: 'words-9-10.ts', topic: { id: 'fx-b', titleKey: k('b.title'), grade: 3, lessons: [lessonText()] } },
  ];
}

/**
 * Строки, которые важны правилам по содержанию, а не только по наличию: фишки
 * `build` должны складываться в ответ.
 */
const FIXTURE_TEXT: Record<string, string> = {
  [k('b.l1.t1.f1')]: 'ко',
  [k('b.l1.t1.f2')]: 'т',
  [k('b.l1.m.f1')]: 'до',
  [k('b.l1.m.f2')]: 'м',
};

/** Локаль, в которой каждый ключ корпуса — непустая строка. */
function localeFor(corpus: Corpus): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  // Объяснение отличается от подсказки по тексту — иначе правило explain его не пропустит.
  for (const key of keysIn(corpus)) setKey(root, key, FIXTURE_TEXT[key] ?? (/\.explain\d*$/.test(key) ? 'Вот так: это ответ.' : 'текст'));
  return root;
}

function setKey(root: Record<string, unknown>, key: string, value: unknown): void {
  const parts = key.split('.');
  let node = root;
  for (const p of parts.slice(0, -1)) {
    if (typeof node[p] !== 'object' || node[p] === null) node[p] = {};
    node = node[p] as Record<string, unknown>;
  }
  node[parts[parts.length - 1]] = value;
}

/** Первое задание формата в теме `lesson` (0 — 5-6, 1 — 9-10). */
function taskOf<F extends TaskFormat>(c: Corpus, lesson: 0 | 1, format: F): Extract<Task, { format: F }> {
  const found = c[lesson].topic.lessons.flatMap((l) => l.tasks).find((t) => t.format === format);
  if (!found) throw new Error(`в фикстуре нет ${format}`);
  return found as Extract<Task, { format: F }>;
}

const lessonAt = (c: Corpus, i: 0 | 1): Lesson => c[i].topic.lessons[0];

function run(id: RuleId, c: Corpus, locales?: Locales): string[] {
  return RULES[id].check(c, locales ?? { ru: localeFor(c) });
}

/** Правило краснеет, и среди нарушений есть упоминание `fragment`. */
function expectRed(id: RuleId, c: Corpus, fragment: string, locales?: Locales): void {
  const out = run(id, c, locales);
  expect(out.length).toBeGreaterThan(0);
  expect(out.join('\n')).toContain(fragment);
}

function simpleChoose(id: string): ChooseTask {
  return {
    id,
    skill: 's',
    format: 'choose',
    presentation: 'text',
    promptKey: 'content.fx.p',
    hintKey: 'content.fx.h',
    options: [
      { id: 'a', labelKey: 'content.common.one', correct: true },
      { id: 'b', labelKey: 'content.common.two', correct: false },
    ],
  };
}

/** Корпус из `total` заданий, из них `choose` — выбор, остальные point. */
function corpusWithShare(total: number, choose: number): Corpus {
  const tasks: Task[] = Array.from({ length: total }, (_, i) =>
    i < choose
      ? simpleChoose(`c${i}`)
      : { id: `p${i}`, skill: 's', format: 'point', promptKey: 'content.fx.p', hintKey: 'content.fx.h', scene: 's', targets: [{ id: 'z', x: 0.5, y: 0.5, r: 0.2, correct: true, labelKey: 'content.fx.z' }, { id: 'w', x: 0.1, y: 0.1, r: 0.1, correct: false, labelKey: 'content.fx.w' }] },
  );
  const topic: Topic = {
    id: 't',
    titleKey: 'content.fx.t',
    lessons: [{ id: 'l', titleKey: 'content.fx.l', band: '9-10', hook: { taliPose: 'hello', lineKey: 'content.fx.hk' }, atlasEntryKey: 'content.fx.at', tasks }],
  };
  return [{ file: 'numbers-9-10.ts', topic }];
}

/* ------------------------------------------------------------------------ */
/* Хорошая фикстура — зелёная по всем правилам                               */
/* ------------------------------------------------------------------------ */

describe('гард корпуса: хорошая фикстура проходит', () => {
  it.each(Object.keys(RULES) as RuleId[])('%s молчит на корректном корпусе', (id) => {
    expect(run(id, goodCorpus())).toEqual([]);
  });
});

/* ------------------------------------------------------------------------ */
/* Плохие фикстуры — каждое правило краснеет                                 */
/* ------------------------------------------------------------------------ */

describe('гард корпуса: уникальность id', () => {
  it('ловит одинаковый id заданий в разных уроках', () => {
    const c = goodCorpus();
    lessonAt(c, 1).tasks[0].id = 'fx-a-l1-t1';
    expectRed('corpusIds', c, 'id задания: fx-a-l1-t1');
  });

  it('ловит одинаковый id уроков в разных темах', () => {
    const c = goodCorpus();
    lessonAt(c, 1).id = 'fx-a-l1';
    expectRed('corpusIds', c, 'id урока: fx-a-l1');
  });

  it('ловит одинаковый id тем', () => {
    const c = goodCorpus();
    c[1].topic.id = 'fx-a';
    expectRed('corpusIds', c, 'id темы: fx-a');
  });

  it('ловит пустой id задания', () => {
    const c = goodCorpus();
    lessonAt(c, 0).tasks[0].id = '';
    expectRed('corpusIds', c, 'пустой id задания');
  });

  it.each([
    ['options', 0, 'choose', (t: Task) => { if (t.format === 'choose') t.options[1].id = 'a'; }],
    ['targets', 0, 'point', (t: Task) => { if (t.format === 'point') t.targets[1].id = 'x'; }],
    ['pairs', 0, 'match', (t: Task) => { if (t.format === 'match') t.pairs[1].id = 'p1'; }],
    ['items', 0, 'order', (t: Task) => { if (t.format === 'order') t.items[1].id = 'i1'; }],
    ['groups', 0, 'group', (t: Task) => { if (t.format === 'group') t.groups[1].id = 'g1'; }],
    ['fragments', 1, 'build', (t: Task) => { if (t.format === 'build' && t.fragments) t.fragments[1].id = 'f1'; }],
  ] as const)('ловит повтор id в %s внутри задания', (field, lesson, format, mutate) => {
    const c = goodCorpus();
    mutate(taskOf(c, lesson, format));
    expectRed('innerIds', c, `в ${field} повторяется id`);
  });
});

describe('гард корпуса: choose', () => {
  it('ловит задание без верного варианта', () => {
    const c = goodCorpus();
    taskOf(c, 0, 'choose').options[1].correct = false;
    expectRed('choose', c, 'верных вариантов 0');
  });

  it('ловит два верных варианта', () => {
    const c = goodCorpus();
    taskOf(c, 0, 'choose').options[0].correct = true;
    expectRed('choose', c, 'верных вариантов 2');
  });

  it('ловит один вариант', () => {
    const c = goodCorpus();
    const t = taskOf(c, 0, 'choose');
    t.options = t.options.filter((o) => o.correct);
    expectRed('choose', c, 'вариантов 1');
  });

  it('ловит пять вариантов', () => {
    const c = goodCorpus();
    const t = taskOf(c, 1, 'choose');
    t.options.push({ id: 'e', labelKey: 'content.common.two', correct: false });
    expectRed('choose', c, 'вариантов 5');
  });
});

describe('гард корпуса: point', () => {
  it('ловит r меньше 0.1', () => {
    const c = goodCorpus();
    taskOf(c, 0, 'point').targets[0].r = 0.09;
    expectRed('point', c, 'r=0.09');
  });

  it('ловит цель без названия', () => {
    const c = goodCorpus();
    taskOf(c, 0, 'point').targets[1].labelKey = '  ';
    expectRed('point', c, 'без названия');
  });

  it('ловит одинаковые названия целей', () => {
    const c = goodCorpus();
    const t = taskOf(c, 0, 'point');
    t.targets[1].labelKey = t.targets[0].labelKey;
    expectRed('point', c, 'повторяются названия');
  });

  it('ловит одну цель и пять целей', () => {
    const one = goodCorpus();
    const t1 = taskOf(one, 0, 'point');
    t1.targets = [t1.targets.find((z) => z.correct)!];
    expectRed('point', one, 'целей 1');
    const five = goodCorpus();
    const t5 = taskOf(five, 0, 'point');
    const extra = (i: number) => ({ id: `e${i}`, x: 0.5, y: 0.5, r: 0.1, correct: false, labelKey: k(`a.l1.t2.e${i}`) });
    t5.targets = [...t5.targets, extra(1), extra(2)];
    expectRed('point', five, 'целей 5');
  });

  it('ловит NaN в радиусе', () => {
    const c = goodCorpus();
    taskOf(c, 0, 'point').targets[0].r = NaN;
    expectRed('point', c, 'r=NaN');
  });

  it.each([
    ['x', 1.01],
    ['x', -0.01],
    ['y', 1.5],
    ['y', -1],
  ] as const)('ловит %s=%s вне кадра', (axis, value) => {
    const c = goodCorpus();
    taskOf(c, 0, 'point').targets[1][axis] = value;
    expectRed('point', c, `${axis}=${value} вне [0, 1]`);
  });

  it('ловит две верные цели', () => {
    const c = goodCorpus();
    taskOf(c, 0, 'point').targets[1].correct = true;
    expectRed('point', c, 'верных целей 2');
  });

  it('ловит отсутствие верной цели', () => {
    const c = goodCorpus();
    taskOf(c, 0, 'point').targets[0].correct = false;
    expectRed('point', c, 'верных целей 0');
  });
});

describe('гард корпуса: match, order, group, build', () => {
  it('ловит match из двух пар — тот же выбор из двух', () => {
    const c = goodCorpus();
    taskOf(c, 0, 'match').pairs.pop();
    expectRed('match', c, 'пар 2, нужно 3');
  });

  it('пропускает две пары в знакомстве с форматом', () => {
    const c = goodCorpus();
    const t = taskOf(c, 0, 'match');
    t.pairs.pop();
    t.intro = true;
    expect(run('match', c)).toEqual([]);
  });

  it('ловит order из одного элемента', () => {
    const c = goodCorpus();
    const t = taskOf(c, 1, 'order');
    t.items = [{ ...t.items[1], position: 0 }];
    expectRed('order', c, 'элементов 1');
  });

  it('ловит повтор позиции в order', () => {
    const c = goodCorpus();
    taskOf(c, 0, 'order').items[0].position = 1;
    expectRed('order', c, 'position [0, 1, 1]');
  });

  it('ловит позиции не с нуля в order', () => {
    const c = goodCorpus();
    taskOf(c, 0, 'order').items.forEach((i) => (i.position += 1));
    expectRed('order', c, 'position [1, 2, 3]');
  });

  it('ловит group из одной группы', () => {
    const c = goodCorpus();
    const t = taskOf(c, 1, 'group');
    t.groups.pop();
    t.items.pop();
    expectRed('group', c, 'групп 1');
  });

  it('ловит элемент с несуществующим groupId', () => {
    const c = goodCorpus();
    taskOf(c, 0, 'group').items[2].groupId = 'g9';
    expectRed('group', c, 'несуществующую группу g9');
  });

  it('ловит пустую группу', () => {
    const c = goodCorpus();
    taskOf(c, 0, 'group').items[1].groupId = 'g1';
    expectRed('group', c, 'в группе g2 нет ни одного элемента');
  });

  it('ловит build с пустым answer', () => {
    const c = goodCorpus();
    taskOf(c, 1, 'build').answer = '  ';
    expectRed('build', c, 'пустой answer');
  });

  it('ловит build из одного фрагмента', () => {
    const c = goodCorpus();
    const t = taskOf(c, 1, 'build');
    t.fragments = t.fragments?.slice(0, 1);
    expectRed('build', c, 'фишек в лотке 1');
  });
});

describe('гард корпуса: skill и hintKey', () => {
  it.each(['Count_to_5', 'count to 5', 'счёт-до-5', '', '-count', 'count--5'])('ловит skill «%s»', (skill) => {
    const c = goodCorpus();
    lessonAt(c, 0).tasks[0].skill = skill;
    expectRed('skillAndHint', c, 'не kebab-case');
  });

  it('ловит пустой hintKey', () => {
    const c = goodCorpus();
    lessonAt(c, 0).tasks[0].hintKey = '';
    expectRed('skillAndHint', c, 'нет hintKey');
  });
});

describe('гард корпуса: формат и полоса', () => {
  it('ловит build на полосе 5-6', () => {
    const c = goodCorpus();
    lessonAt(c, 0).tasks[3] = { id: 'fx-a-l1-t5', skill: 'spell', format: 'build', promptKey: k('a.l1.t5.prompt'), hintKey: k('a.l1.t5.hint'), answer: 'два' };
    expectRed('formatBand', c, 'формат build доступен с полосы 7');
  });

  it('ловит неизвестный формат', () => {
    const c = goodCorpus();
    (lessonAt(c, 1).tasks[0] as unknown as { format: string }).format = 'multiple_choice';
    expectRed('formatBand', c, 'неизвестный формат multiple_choice');
  });

  it('ловит урок полосы 7 в файле numbers-5-6.ts', () => {
    const c = goodCorpus();
    lessonAt(c, 0).band = '7';
    expectRed('fileBand', c, 'полоса 7, а файл — 5-6');
  });

  it('ловит файл с именем не по схеме', () => {
    const c = goodCorpus();
    c[0].file = 'pilot.ts';
    expectRed('fileBand', c, 'pilot.ts: имя не по схеме');
  });

  it('ловит неизвестный регион в имени файла', () => {
    const c = goodCorpus();
    c[0].file = 'logic-5-6.ts';
    expectRed('fileBand', c, 'logic-5-6.ts: имя не по схеме');
  });
});

describe('гард корпуса: полоса 5-6 — только картинки с озвучкой', () => {
  it('ловит presentation text', () => {
    const c = goodCorpus();
    taskOf(c, 0, 'choose').presentation = 'text';
    expectRed('picture56', c, 'presentation text на полосе 5-6');
  });

  it('ловит вариант choose без картинки', () => {
    const c = goodCorpus();
    const o = taskOf(c, 0, 'choose').options[0];
    delete o.shape;
    delete o.count;
    expectRed('picture56', c, 'options[a] без картинки');
  });

  it('ловит сторону пары без картинки', () => {
    const c = goodCorpus();
    delete taskOf(c, 0, 'match').pairs[1].right.image;
    expectRed('picture56', c, 'pairs[p2].right без картинки');
  });

  it('ловит элемент без labelKey', () => {
    const c = goodCorpus();
    taskOf(c, 0, 'order').items[0].labelKey = '';
    expectRed('picture56', c, 'items[i1] без labelKey');
  });

  it('не требует картинок на полосе 9-10', () => {
    // Защищает от перегиба правила: текстовая подача с 9 лет разрешена.
    expect(run('picture56', [goodCorpus()[1]])).toEqual([]);
  });
});

describe('гард корпуса: shape и count', () => {
  it('ловит shape без count', () => {
    const c = goodCorpus();
    delete taskOf(c, 0, 'choose').options[0].count;
    expectRed('shapeCount', c, 'options[a] — shape и count задаются только вместе');
  });

  it('ловит count без shape в stimulus', () => {
    const c = goodCorpus();
    delete taskOf(c, 0, 'choose').stimulus?.shape;
    expectRed('shapeCount', c, 'stimulus — shape и count задаются только вместе');
  });

  it('ловит layout без shape', () => {
    const c = goodCorpus();
    taskOf(c, 0, 'match').pairs[0].right.layout = 'dice';
    expectRed('shapeCount', c, 'pairs[p1].right — layout без shape');
  });

  it.each([0, -1, 1.5])('ловит count=%s', (count) => {
    const c = goodCorpus();
    taskOf(c, 0, 'order').items[0].count = count;
    expectRed('shapeCount', c, `count=${count}`);
  });
});

describe('гард корпуса: ключи локали', () => {
  it.each([
    ['hintKey', (c: Corpus) => (lessonAt(c, 0).tasks[0].hintKey = k('missing.hint'))],
    ['titleKey темы', (c: Corpus) => (c[0].topic.titleKey = k('missing.topic'))],
    ['hook.lineKey', (c: Corpus) => (lessonAt(c, 0).hook.lineKey = k('missing.hook'))],
    ['atlasEntryKey', (c: Corpus) => (lessonAt(c, 0).atlasEntryKey = k('missing.atlas'))],
    ['stimulus.labelKey', (c: Corpus) => { const s = taskOf(c, 0, 'choose').stimulus; if (s) s.labelKey = k('missing.stimulus'); }],
    ['labelKey цели point', (c: Corpus) => (taskOf(c, 0, 'point').targets[0].labelKey = k('missing.target'))],
    ['labelKey группы', (c: Corpus) => (taskOf(c, 0, 'group').groups[0].labelKey = k('missing.group'))],
    ['labelKey фрагмента', (c: Corpus) => { const f = taskOf(c, 1, 'build').fragments; if (f) f[0].labelKey = k('missing.fragment'); }],
    ['labelKey стороны пары', (c: Corpus) => (taskOf(c, 0, 'match').pairs[0].left.labelKey = k('missing.left'))],
  ] as const)('ловит отсутствующий %s', (_, mutate) => {
    const c = goodCorpus();
    const ru = localeFor(c);
    mutate(c);
    expectRed('keysExist', c, 'content.fx.missing.', { ru });
  });

  it('ловит ключ с пустой строкой', () => {
    const c = goodCorpus();
    const ru = localeFor(c);
    setKey(ru, k('a.l1.t1.prompt'), '   ');
    expectRed('keysExist', c, k('a.l1.t1.prompt'), { ru });
  });

  it('ловит ключ, указывающий на ветку, а не на строку', () => {
    const c = goodCorpus();
    const ru = localeFor(c);
    lessonAt(c, 0).tasks[0].promptKey = k('a.l1.t1');
    expectRed('keysExist', c, `${k('a.l1.t1')} отсутствует`, { ru });
  });

  it('ловит ключ старого корпуса вне content.*', () => {
    const c = goodCorpus();
    taskOf(c, 0, 'choose').options[0].labelKey = 'data.tasks.opt_yes';
    expectRed('keysNamespace', c, 'data.tasks.opt_yes вне content.*');
  });

  it('ловит не-общий ключ в двух уроках', () => {
    const c = goodCorpus();
    lessonAt(c, 1).tasks[1].hintKey = k('a.l1.t1.hint');
    expectRed('keyReuse', c, `ключ ${k('a.l1.t1.hint')} используется в`);
  });

  it('ловит ключ урока, взятый заголовком темы', () => {
    const c = goodCorpus();
    c[1].topic.titleKey = k('a.l1.title');
    expectRed('keyReuse', c, `ключ ${k('a.l1.title')} используется в`);
  });
});

describe('гард корпуса: утечка ответа', () => {
  it.each(['Сколько камней? _(ответ: 2)_', 'Сколько? (Ответ：2)', 'How many? (answer: 2)', 'Канча? ( жооп : 2)'])(
    'ловит «%s» в ru',
    (text) => {
      const c = goodCorpus();
      const ru = localeFor(c);
      setKey(ru, k('a.l1.t1.prompt'), text);
      expectRed('answerLeak', c, `ru ${k('a.l1.t1.prompt')}`, { ru });
    },
  );

  it('ловит утечку в en, если ключ там есть', () => {
    const c = goodCorpus();
    const en: Record<string, unknown> = {};
    setKey(en, k('b.l1.t4.hint'), 'Look up (answer: north)');
    expectRed('answerLeak', c, `en ${k('b.l1.t4.hint')}`, { ru: localeFor(c), en });
  });

  it('не считает утечкой слово «ответ» без двоеточия в скобках', () => {
    const c = goodCorpus();
    const ru = localeFor(c);
    setKey(ru, k('a.l1.t1.hint'), 'Найди ответ сам, не торопись.');
    expect(run('answerLeak', c, { ru })).toEqual([]);
  });
});

describe('гард корпуса: структура урока', () => {
  it('ловит три задания одного формата подряд', () => {
    const c = goodCorpus();
    const l = lessonAt(c, 1);
    l.tasks = [l.tasks[1], simpleChoose('x1'), simpleChoose('x2'), ...l.tasks.slice(2)];
    expectRed('formatSequence', c, 'три задания choose подряд, начиная с fx-b-l1-t2');
  });

  it('пропускает два задания одного формата подряд', () => {
    const c = goodCorpus();
    const l = lessonAt(c, 1);
    l.tasks = [l.tasks[1], simpleChoose('x1'), ...l.tasks.slice(2)];
    expect(run('formatSequence', c)).toEqual([]);
  });

  it('ловит урок из одного формата', () => {
    const c = goodCorpus();
    lessonAt(c, 0).tasks = [simpleChoose('x1'), simpleChoose('x2')];
    expectRed('formatSequence', c, 'форматов 1');
  });

  it.each([
    ['5-6', 0, 3, 'заданий 3, для 5-6 нужно 4'],
    ['5-6', 0, 5, 'заданий 5, для 5-6 нужно 4'],
    ['9-10', 1, 7, 'заданий 7, для 9-10 нужно 8'],
    ['9-10', 1, 9, 'заданий 9, для 9-10 нужно 8'],
  ] as const)('ловит урок полосы %s из %s заданий', (_, i, n, message) => {
    const c = goodCorpus();
    const l = lessonAt(c, i);
    l.tasks = Array.from({ length: n }, (_, j) => ({ ...l.tasks[j % l.tasks.length], id: `n${j}` }));
    expectRed('taskCount', c, message);
  });

  it.each([
    ['5-6', 0, 4],
    ['9-10', 1, 8],
  ] as const)('пропускает границу нормы полосы %s: %s заданий', (_, i, n) => {
    const c = goodCorpus();
    const l = lessonAt(c, i);
    l.tasks = Array.from({ length: n }, (_, j) => ({ ...l.tasks[j % l.tasks.length], id: `n${j}` }));
    expect(run('taskCount', c)).toEqual([]);
  });

  it.each([
    ['8', 3, 'заданий 3, для 8 нужно 4–6'],
    ['7', 7, 'заданий 7, для 7 нужно 4–6'],
  ] as const)('на полосе %s ловит урок из %s заданий', (band, n, message) => {
    const c = goodCorpus();
    const l = lessonAt(c, 1);
    l.band = band;
    l.tasks = l.tasks.slice(0, n);
    expectRed('taskCount', c, message);
  });

  it.each([4, 6])('на полосе 7 пропускает урок из %s заданий', (n) => {
    const c = goodCorpus();
    const l = lessonAt(c, 1);
    l.band = '7';
    l.tasks = l.tasks.slice(0, n);
    expect(run('taskCount', c)).toEqual([]);
  });
});

describe('гард корпуса: доля choose', () => {
  it(`ловит 26 choose из ${CHOOSE_SHARE_MIN_TASKS}`, () => {
    expectRed('chooseShare', corpusWithShare(CHOOSE_SHARE_MIN_TASKS, 26), `choose 26 из ${CHOOSE_SHARE_MIN_TASKS}`);
  });

  it(`пропускает ровно половину choose из ${CHOOSE_SHARE_MIN_TASKS}`, () => {
    expect(run('chooseShare', corpusWithShare(CHOOSE_SHARE_MIN_TASKS, 25))).toEqual([]);
  });

  it(`не включается до ${CHOOSE_SHARE_MIN_TASKS} заданий`, () => {
    expect(run('chooseShare', corpusWithShare(CHOOSE_SHARE_MIN_TASKS - 1, CHOOSE_SHARE_MIN_TASKS - 1))).toEqual([]);
  });
});

/* ------------------------------------------------------------------------ */
/* Лимиты по полосе, знакомство, длина текстов (domain/lessonLimits.ts)      */
/* ------------------------------------------------------------------------ */

describe('гард корпуса: лимиты по полосе', () => {
  it('ловит два варианта choose вне знакомства', () => {
    const c = goodCorpus();
    taskOf(c, 0, 'choose').options.pop();
    expectRed('choose', c, 'вариантов 2, нужно 3');
  });

  it('пропускает два варианта choose в знакомстве', () => {
    const c = goodCorpus();
    const t = taskOf(c, 0, 'choose');
    t.options = t.options.filter((o) => o.correct || o.id === 'a');
    t.intro = true;
    expect(run('choose', c)).toEqual([]);
  });

  it('ловит четыре варианта choose на полосе 5–6', () => {
    const c = goodCorpus();
    taskOf(c, 0, 'choose').options.push({ id: 'd', labelKey: 'content.common.two', shape: 'dot', count: 4, correct: false });
    expectRed('choose', c, 'вариантов 4, нужно 3');
  });

  it('ловит четыре текстовых пары match с 7 лет — на SE не помещаются', () => {
    const c = goodCorpus();
    taskOf(c, 1, 'match').pairs.push({ id: 'p4', left: { labelKey: k('b.l1.t5.l4') }, right: { labelKey: k('b.l1.t5.r4') } });
    expectRed('match', c, 'пар 4, нужно 3');
  });

  it('ловит три группы на полосе 5–6 и три группы текстом', () => {
    const young = goodCorpus();
    taskOf(young, 0, 'group').groups.push({ id: 'g3', labelKey: k('a.l1.t5.g3') });
    expectRed('group', young, 'групп 3, нужно 2');
    const text = goodCorpus();
    const g = taskOf(text, 1, 'group');
    g.groups.push({ id: 'g3', labelKey: k('b.l1.t7.g3') });
    g.items.push({ id: 'd', labelKey: k('b.l1.t7.d'), groupId: 'g3' });
    expectRed('group', text, 'групп 3, нужно 2');
  });

  it('ловит пять предметов group на полосе 5–6', () => {
    const c = goodCorpus();
    const g = taskOf(c, 0, 'group');
    g.items.push(
      { id: 'i4', labelKey: k('a.l1.t5.i4'), shape: 'stone', count: 3, groupId: 'g1' },
      { id: 'i5', labelKey: k('a.l1.t5.i5'), image: 'leaf-small', groupId: 'g2' },
    );
    expectRed('group', c, 'предметов 5, нужно 3–4');
  });
});

describe('гард корпуса: point в кадре и с зазором', () => {
  it('ловит зону, вылезающую за край кадра', () => {
    const c = goodCorpus();
    taskOf(c, 0, 'point').targets[0].x = 0.05;
    expectRed('point', c, 'выходит за кадр');
  });

  it('ловит зону за верхним краем с учётом формата 4:3', () => {
    const c = goodCorpus();
    // r = 0.1 по ширине — это 0.133 по высоте; y = 0.12 уже за краем
    taskOf(c, 0, 'point').targets[0].y = 0.12;
    expectRed('point', c, 'выходит за кадр');
  });

  it('ловит две зоны ближе r₁ + r₂ + 0.05', () => {
    const c = goodCorpus();
    const t = taskOf(c, 0, 'point');
    t.targets[2].x = t.targets[0].x + 0.2;
    t.targets[2].y = t.targets[0].y;
    expectRed('point', c, 'ближе');
  });
});

describe('гард корпуса: build по полосе', () => {
  it('ловит ответ, который не собирается из фишек', () => {
    const c = goodCorpus();
    taskOf(c, 1, 'build').answer = 'кит';
    expectRed('build', c, 'не собирается');
  });

  it('ловит ответ из четырёх фишек', () => {
    const c = goodCorpus();
    const t = taskOf(c, 1, 'build');
    t.answer = 'кококот';
    t.fragments = [
      { id: 'f1', labelKey: k('b.l1.t1.f1') },
      { id: 'f2', labelKey: k('b.l1.t1.f2') },
      { id: 'f3', labelKey: k('b.l1.t1.f3') },
      { id: 'f4', labelKey: k('b.l1.t1.f4') },
    ];
    const locale = localeFor(c);
    setKey(locale, k('b.l1.t1.f3'), 'ко');
    setKey(locale, k('b.l1.t1.f4'), 'ко');
    expectRed('build', c, 'не собирается', { ru: locale });
  });

  it('ловит фишку длиннее шести знаков', () => {
    const c = goodCorpus();
    const locale = localeFor(c);
    setKey(locale, k('b.l1.t1.f1'), 'коооооо');
    expectRed('build', c, 'длиннее 6', { ru: locale });
  });

  it('ловит семь фишек в лотке', () => {
    const c = goodCorpus();
    const t = taskOf(c, 1, 'build');
    t.fragments = [...t.fragments!, ...[3, 4, 5, 6, 7].map((n) => ({ id: `f${n}`, labelKey: k(`b.l1.t1.f${n}`) }))];
    expectRed('build', c, 'фишек в лотке 7');
  });

  it('ловит буквы там, где вводят с клавиатуры', () => {
    const c = goodCorpus();
    const t = c[1].topic.lessons[0].tasks.find((x) => x.format === 'build' && x.fragments === undefined);
    if (!t || t.format !== 'build') throw new Error('в фикстуре нет build без фишек');
    t.answer = 'дом';
    expectRed('build', c, 'вводится цифрами');
  });

  it('ловит трёхзначное число на полосе 7', () => {
    const c = goodCorpus();
    lessonAt(c, 1).band = '7';
    expectRed('build', c, '3-значный, для 7 не больше 2');
  });
});

describe('гард корпуса: знакомство и длина текстов', () => {
  it('ловит знакомство не первым заданием', () => {
    const c = goodCorpus();
    lessonAt(c, 0).tasks[2].intro = true;
    expectRed('intro', c, 'знакомство не первым');
  });

  it('ловит два знакомства в уроке', () => {
    const c = goodCorpus();
    const l = lessonAt(c, 0);
    l.tasks[0].intro = true;
    l.tasks[1].intro = true;
    expectRed('intro', c, 'знакомств 2');
  });

  it('пропускает одно знакомство первым', () => {
    const c = goodCorpus();
    lessonAt(c, 0).tasks[0].intro = true;
    expect(run('intro', c)).toEqual([]);
  });

  it('ловит длинный вопрос и длинную подсказку', () => {
    const c = goodCorpus();
    const t = lessonAt(c, 0).tasks[0];
    const locale = localeFor(c);
    setKey(locale, t.promptKey, 'а'.repeat(41));
    setKey(locale, t.hintKey, 'б'.repeat(37));
    const out = run('textLength', c, { ru: locale }).join('\n');
    expect(out).toContain('вопрос 41 знаков');
    expect(out).toContain('подсказка 37 знаков');
  });

  it('пропускает вопрос ровно 40 и подсказку ровно 36', () => {
    const c = goodCorpus();
    const t = lessonAt(c, 0).tasks[0];
    const locale = localeFor(c);
    setKey(locale, t.promptKey, 'а'.repeat(40));
    setKey(locale, t.hintKey, 'б'.repeat(36));
    expect(run('textLength', c, { ru: locale })).toEqual([]);
  });
});

/* ------------------------------------------------------------------------ */
/* Разобранный пример, объяснение, отрывок (FORMATS.md, шаг 5)               */
/* ------------------------------------------------------------------------ */

const modelAt = (c: Corpus, i: 0 | 1) => {
  const m = lessonAt(c, i).model;
  if (!m) throw new Error('в фикстуре урок без примера');
  return m;
};

describe('гард корпуса: новый навык и пример', () => {
  it('ловит два новых навыка в уроке', () => {
    const c = goodCorpus();
    lessonAt(c, 0).tasks[1].skill = 'count-to-5';
    expectRed('newSkillModel', c, 'новых навыков 2 (count-to-3, count-to-5)');
  });

  it('ловит новый навык без примера — или опечатку', () => {
    const c = goodCorpus();
    delete lessonAt(c, 0).model;
    expectRed('newSkillModel', c, 'новый навык count-to-3 без разобранного примера (model) — или опечатка в skill');
  });

  it('ловит пример в уроке без нового навыка', () => {
    const c = goodCorpus();
    c[0].topic.lessons[1].tasks[0].skill = 'count-to-3';
    expectRed('newSkillModel', c, 'разобранный пример без нового навыка');
  });

  it('ловит пример не на новый навык урока', () => {
    const c = goodCorpus();
    modelAt(c, 0).skill = 'count-to-5';
    expectRed('newSkillModel', c, 'пример на count-to-5, а новый навык урока — count-to-3');
  });

  it('считает навык новым в пределах полосы: навык 5-6 на 7 снова новый', () => {
    const c = goodCorpus();
    c.push({ file: 'numbers-7.ts', topic: { id: 'fx-c', titleKey: k('c.title'), lessons: [{ ...lessonPicture(), id: 'fx-c-l1', band: '7' }] } });
    expect(run('newSkillModel', c)).toEqual([]);
    delete c[2].topic.lessons[0].model;
    expectRed('newSkillModel', c, 'fx-c-l1: новый навык count-to-3 без разобранного примера');
  });
});

describe('гард корпуса: разобранный пример', () => {
  it.each([
    [0, 3, 'шагов Tali 3, нужно 2'],
    [1, 5, 'шагов Tali 5, нужно 2–4'],
    [1, 1, 'шагов Tali 1, нужно 2–4'],
  ] as const)('ловит в уроке %s пример из %s шагов', (i, n, message) => {
    const c = goodCorpus();
    modelAt(c, i).steps = Array.from({ length: n }, (_, j) => ({ lineKey: k(`m.s${j}`) }));
    expectRed('model', c, message);
  });

  it('ловит reveal на несуществующий элемент', () => {
    const c = goodCorpus();
    modelAt(c, 0).steps[1].reveal = 'zz';
    expectRed('model', c, 'шаг 2 — в примере нет элемента zz');
  });

  it('подсветка стимула: пропускает у примера со стимулом, ловит без него', () => {
    const c = goodCorpus();
    modelAt(c, 0).steps[0].reveal = 'stimulus';
    expect(run('model', c)).toEqual([]);
    modelAt(c, 1).steps[0].reveal = 'stimulus';
    expectRed('model', c, 'fx-b-l1/model: шаг 1 подсвечивает стимул, а у примера его нет');
  });

  it('на 5-6 ловит два новых составных формата в уроке с примером, формат примера не считает', () => {
    const c = goodCorpus();
    expect(run('newCompositeFormat', c)).toEqual([]);
    const l1 = lessonAt(c, 0);
    const order = c[0].topic.lessons[1].tasks[3];
    l1.tasks[3] = { ...order, id: 'fx-a-l1-t9' };
    expectRed('newCompositeFormat', c, 'fx-a-l1: новых составных форматов 2 (match, order)');
  });

  it('ловит длинную реплику шага по-русски и в ky', () => {
    const c = goodCorpus();
    const ru = localeFor(c);
    const ky: Record<string, unknown> = {};
    setKey(ru, k('a.l1.m.s1'), 'а'.repeat(37));
    setKey(ky, k('a.l1.m.s2'), 'а'.repeat(91));
    const out = run('model', c, { ru, ky }).join('\n');
    expect(out).toContain('шаг 1: ru 37 знаков, нужно ≤ 36');
    expect(out).toContain('шаг 2: ky 91 знаков, нужно ≤ 90');
  });

  it('ловит отрывок в примере', () => {
    const c = goodCorpus();
    Object.assign(modelAt(c, 1).example, { passage: { textKey: k('b.l1.m.passage') } });
    expectRed('model', c, 'в примере отрывок');
  });

  it('ловит пример не в формате первого задания навыка', () => {
    const c = goodCorpus();
    modelAt(c, 1).example = { format: 'choose', presentation: 'text', promptKey: k('b.l1.m.prompt'), options: [{ id: 'a', labelKey: k('b.l1.m.a'), correct: true }, { id: 'b', labelKey: k('b.l1.m.b'), correct: false }, { id: 'c', labelKey: k('b.l1.m.c'), correct: false }] };
    expectRed('model', c, 'пример в формате choose, а первое задание навыка fx-b-l1-t1 — build');
  });

  it('ловит пример с тем же стимулом и ответом, что задание урока, — ключи и порядок вариантов не спасают', () => {
    const c = goodCorpus();
    const ex = modelAt(c, 0).example;
    if (ex.format !== 'choose') throw new Error('пример 5-6 — choose');
    ex.stimulus = { labelKey: k('a.l1.m.other'), shape: 'stone', count: 2 };
    ex.options = [
      { id: 'z', labelKey: 'content.common.three', shape: 'dot', count: 3, correct: false },
      { id: 'y', labelKey: 'content.common.two', shape: 'dot', count: 2, correct: true },
      { id: 'x', labelKey: 'content.common.one', shape: 'dot', count: 1, correct: false },
    ];
    expectRed('model', c, 'тот же стимул и ответ, что у fx-a-l1-t1');
  });

  it('ловит знакомство с форматом в уроке с примером', () => {
    const c = goodCorpus();
    lessonAt(c, 0).tasks[0].intro = true;
    expectRed('model', c, 'fx-a-l1-t1: знакомство с форматом в уроке с примером');
  });

  it('на 5-6 ловит длинную завязку в уроке с примером', () => {
    const c = goodCorpus();
    const ru = localeFor(c);
    setKey(ru, k('a.l1.hook'), 'а'.repeat(37));
    expectRed('model', c, 'завязка в уроке с примером: ru 37 знаков', { ru });
  });

  it('на 5-6 ловит первое задание другого формата после примера', () => {
    const c = goodCorpus();
    const l = lessonAt(c, 0);
    l.tasks = [l.tasks[1], l.tasks[0], ...l.tasks.slice(2)];
    expectRed('model', c, 'fx-a-l1-t2: первое задание после примера — count-to-3/point, нужно count-to-3/choose');
  });

  it('на 5-6 ловит отрывок в первом задании после примера', () => {
    const c = goodCorpus();
    lessonAt(c, 0).tasks[0].passage = { textKey: k('a.l1.t1.passage'), image: 'basket' };
    expectRed('model', c, 'первое задание после примера с отрывком');
  });

  it('проверяет пример правилами формата и полосы', () => {
    const c = goodCorpus();
    const ex = modelAt(c, 0).example;
    if (ex.format !== 'choose') throw new Error('пример 5-6 — choose');
    ex.options = ex.options.slice(1);
    delete ex.options[0].shape;
    delete ex.options[0].count;
    expectRed('choose', c, 'fx-a/fx-a-l1/model: вариантов 2, нужно 3');
    expectRed('picture56', c, 'fx-a/fx-a-l1/model: options[b] без картинки');
  });
});

describe('гард корпуса: объяснение', () => {
  it('ловит оценочное задание без объяснения', () => {
    const c = goodCorpus();
    delete lessonAt(c, 0).tasks[1].explainKey;
    expectRed('explain', c, 'fx-a-l1-t2: нет объяснения (explainKey)');
  });

  it('пропускает знакомство без объяснения', () => {
    const c = goodCorpus();
    const t = lessonAt(c, 1).tasks[0];
    t.intro = true;
    delete t.explainKey;
    expect(run('explain', c)).toEqual([]);
  });

  it('ловит две реплики на 5-6 и три на 9-10, пропускает две на 7', () => {
    const c = goodCorpus();
    lessonAt(c, 0).tasks[0].explainKey = [k('a.l1.t1.explain'), k('a.l1.t1.explain2')];
    lessonAt(c, 1).tasks[0].explainKey = [k('b.l1.t1.explain'), k('b.l1.t1.explain2'), k('b.l1.t1.explain3')];
    const out = run('explain', c).join('\n');
    expect(out).toContain('fx-a-l1-t1: реплик объяснения 2, нужно 1');
    expect(out).toContain('fx-b-l1-t1: реплик объяснения 3, нужно 1–2');
    const seven = goodCorpus();
    lessonAt(seven, 1).band = '7';
    expect(run('explain', seven)).toEqual([]);
  });

  it('ловит объяснение, повторяющее подсказку ключом или текстом', () => {
    const c = goodCorpus();
    const ru = localeFor(c);
    const [a, b] = lessonAt(c, 0).tasks;
    a.explainKey = [a.hintKey];
    setKey(ru, b.explainKey![0], 'Посчитай по одному.');
    setKey(ru, b.hintKey, 'Посчитай по одному.');
    const out = run('explain', c, { ru }).join('\n');
    expect(out).toContain('fx-a-l1-t1: объяснение 1 повторяет подсказку');
    expect(out).toContain('fx-a-l1-t2: объяснение 1 повторяет подсказку');
  });

  it('ловит длинное объяснение по-русски и в ky, пропускает границы 36 и 90', () => {
    const c = goodCorpus();
    const key = lessonAt(c, 0).tasks[0].explainKey![0];
    const ru = localeFor(c);
    const ky: Record<string, unknown> = {};
    setKey(ru, key, 'а'.repeat(37));
    setKey(ky, key, 'а'.repeat(91));
    const out = run('explain', c, { ru, ky }).join('\n');
    expect(out).toContain('объяснение 1: ru 37 знаков, нужно ≤ 36');
    expect(out).toContain('объяснение 1: ky 91 знаков, нужно ≤ 90');
    setKey(ru, key, 'а'.repeat(36));
    setKey(ky, key, 'а'.repeat(90));
    expect(run('explain', c, { ru, ky })).toEqual([]);
  });
});

describe('гард корпуса: отрывок и числа', () => {
  it('ловит отрывок в point', () => {
    const c = goodCorpus();
    taskOf(c, 1, 'point').passage = { textKey: k('b.l1.t4.passage') };
    expectRed('passage', c, 'отрывок в point');
  });

  it('ловит отрывок без картинки на 7', () => {
    const c = goodCorpus();
    lessonAt(c, 1).band = '7';
    expectRed('passage', c, 'на 7 у отрывка нужна картинка');
  });

  it('на 9-10 ловит 241 русский и 341 показанный в ky, пропускает 240 и 340', () => {
    const c = goodCorpus();
    const key = k('b.l1.t2.passage');
    const ru = localeFor(c);
    const ky: Record<string, unknown> = {};
    setKey(ru, key, 'а'.repeat(241));
    setKey(ky, key, 'а'.repeat(341));
    const out = run('passage', c, { ru, ky }).join('\n');
    expect(out).toContain('отрывок: ru 241 знаков, нужно ≤ 240');
    expect(out).toContain('отрывок: ky 341 знаков, нужно ≤ 340');
    setKey(ru, key, 'а'.repeat(240));
    setKey(ky, key, 'а'.repeat(340));
    expect(run('passage', c, { ru, ky })).toEqual([]);
  });

  it('на 5-6 ловит три предложения; длину ky не проверяет — текст не показывается', () => {
    const c = goodCorpus();
    const key = k('a.l1.t4.passage');
    taskOf(c, 0, 'order').passage = { textKey: key, image: 'basket' };
    const ru = localeFor(c);
    const ky: Record<string, unknown> = {};
    setKey(ru, key, 'Раз. Два. Три!');
    setKey(ky, key, 'а'.repeat(200));
    expectRed('passage', c, 'в отрывке 3 предложений, на 5-6 не больше 2', { ru, ky });
    setKey(ru, key, 'Раз. Два!');
    expect(run('passage', c, { ru, ky })).toEqual([]);
  });

  it('ловит восьмизначное число в отрывке на 9-10, пропускает «1 000 000»', () => {
    const c = goodCorpus();
    const ru = localeFor(c);
    setKey(ru, k('b.l1.t2.passage'), 'В библиотеке 12 345 678 книг.');
    expectRed('textNumbers', c, 'число 12345678 в отрывке — для 9-10 не больше 7 цифр', { ru });
    setKey(ru, k('b.l1.t2.passage'), 'В городе 1 000 000 жителей.');
    expect(run('textNumbers', c, { ru })).toEqual([]);
  });

  it('ловит трёхзначное число в вопросе на 5-6', () => {
    const c = goodCorpus();
    const ru = localeFor(c);
    setKey(ru, k('a.l1.t1.prompt'), 'Где 100 камней?');
    expectRed('textNumbers', c, 'число 100 в вопросе — для 5-6 не больше 2 цифр', { ru });
  });

  it('на 9-10 пропускает семизначный ответ с клавиатуры и ловит восьмизначный', () => {
    const c = goodCorpus();
    const t = lessonAt(c, 1).tasks.find((x) => x.format === 'build' && x.fragments === undefined);
    if (!t || t.format !== 'build') throw new Error('в фикстуре нет build без фишек');
    t.answer = '1000000';
    expect(run('build', c)).toEqual([]);
    t.answer = '10000000';
    expectRed('build', c, '8-значный, для 9-10 не больше 7');
  });

  it('новые ключи — шаги, объяснение, отрывок — проверяются на существование', () => {
    const c = goodCorpus();
    const ru = localeFor(c);
    modelAt(c, 0).steps[0].lineKey = k('missing.step');
    lessonAt(c, 0).tasks[0].explainKey = [k('missing.explain')];
    lessonAt(c, 1).tasks[1].passage = { textKey: k('missing.passage') };
    const out = run('keysExist', c, { ru }).join('\n');
    for (const key of ['step', 'explain', 'passage']) expect(out).toContain(k(`missing.${key}`));
  });
});

/* ------------------------------------------------------------------------ */
/* Обнаружение тем в модулях                                                 */
/* ------------------------------------------------------------------------ */

describe('гард корпуса: обнаружение тем в модулях', () => {
  const [a, b] = goodCorpus().map((e) => e.topic);

  it('ловит модуль без темы', () => {
    const { problems } = collectCorpus([{ file: 'words-5-6.ts', exports: { helper: 42 } }]);
    expect(problems.join('\n')).toContain('words-5-6.ts: не экспортирует ни одной темы');
  });

  it('ловит экспортированный урок, не включённый ни в одну тему', () => {
    const orphan = lessonPicture();
    const { problems } = collectCorpus([{ file: 'numbers-5-6.ts', exports: { a, orphan } }]);
    expect(problems.join('\n')).toContain('урок fx-a-l1 (экспорт orphan) не входит ни в одну тему');
  });

  it('не считает урок сиротой, если он лежит в теме', () => {
    const { problems } = collectCorpus([{ file: 'numbers-5-6.ts', exports: { a, lesson: a.lessons[0] } }]);
    expect(problems).toEqual([]);
  });

  it('учитывает реэкспорт одной темы один раз', () => {
    const { corpus } = collectCorpus([
      { file: 'numbers-5-6.ts', exports: { a } },
      { file: 'numbers-7.ts', exports: { a, b } },
    ]);
    expect(corpus.map((e) => e.topic.id)).toEqual(['fx-a', 'fx-b']);
  });

  it('находит темы в массиве и внутри региона', () => {
    const { corpus, problems } = collectCorpus([
      { file: 'numbers-5-6.ts', exports: { topics: [a] } },
      { file: 'words-9-10.ts', exports: { default: { id: 'words', titleKey: k('r'), topics: [b] } } },
    ]);
    expect({ ids: corpus.map((e) => e.topic.id), problems }).toEqual({ ids: ['fx-a', 'fx-b'], problems: [] });
  });
});

describe('гард корпуса: приватность текста', () => {
  const withText = (key: string, text: string, lang: 'ru' | 'en' | 'ky' = 'ru') => {
    const c = goodCorpus();
    const ru = localeFor(c);
    const locales: Locales = { ru };
    const target: Record<string, unknown> = lang === 'ru' ? ru : {};
    if (lang !== 'ru') locales[lang] = target;
    setKey(target, key, text);
    return { c, locales };
  };

  it.each([
    ['ru', 'У тебя есть брат?'],
    ['ru', 'Что делает твоя мама?'],
    ['ru', 'Как тебя зовут?'],
    ['ru', 'Где ты живёшь?'],
    ['ru', 'Какой праздник в вашей семье?'],
    ['en', "What's your name?"],
    ['en', 'Do you have a dog?'],
    ['ky', 'Сенин үй-бүлөң кандай?'],
    ['ky', 'Атың ким?'],
  ] as const)('ловит вопрос о ребёнке: %s «%s»', (lang, text) => {
    const { c, locales } = withText(lessonAt(goodCorpus(), 0).tasks[0].promptKey, text, lang);
    expectRed('aboutCharacter', c, 'спроси о жителе или Tali', locales);
  });

  it.each([
    'Сколько ты видишь камней?',
    'У Ачи три брата. Сколько всего детей?',
    'Какой дом стоит у реки?',
    'Помоги Tali найти маму утёнка.',
    'This is Tali’s family.',
  ])('пропускает вопрос о персонаже: «%s»', (text) => {
    const { c, locales } = withText(lessonAt(goodCorpus(), 0).tasks[0].promptKey, text);
    expect(run('aboutCharacter', c, locales)).toEqual([]);
  });

  it('ловит заголовок темы и урока от первого лица, но не такой же текст в задании', () => {
    const c = goodCorpus();
    const ru = localeFor(c);
    setKey(ru, c[0].topic.titleKey, 'Моя семья');
    setKey(ru, lessonAt(c, 1).titleKey, 'My room');
    setKey(ru, lessonAt(c, 0).tasks[0].promptKey, 'Мой дом у реки — где он?');
    const out = run('aboutCharacter', c, { ru }).join('\n');
    expect(out).toContain('заголовок «Моя семья» от первого лица');
    expect(out).toContain('заголовок «My room» от первого лица');
    expect(out).not.toContain('Мой дом у реки');
  });

  it.each(['Зайди на www.site.kg', 'Пиши на tali@mail.ru', 'Найди @tali_kg', 'Звони +996 555 12 34 56', 'tel:103', 'Номер 555-12-34'])(
    'ловит контакт: «%s»',
    (text) => {
      const { c, locales } = withText(lessonAt(goodCorpus(), 1).tasks[0].promptKey, text);
      expectRed('contacts', c, 'контакт', locales);
    },
  );

  it('пропускает экстренные номера и большие числа', () => {
    const { c, locales } = withText(lessonAt(goodCorpus(), 1).tasks[0].promptKey, 'Пожар — звони 101. Было 1 000 000.');
    expect(run('contacts', c, locales)).toEqual([]);
  });

  it('пропускает имя в завязке и шаге примера, ловит в задании и заголовке темы', () => {
    const c = goodCorpus();
    const ru = localeFor(c);
    const l = lessonAt(c, 0);
    setKey(ru, l.hook.lineKey, 'Привет, {{name}}!');
    setKey(ru, l.model!.steps[0].lineKey, 'Смотри, {{name}}.');
    expect(run('nameOnlyInTali', c, { ru })).toEqual([]);
    setKey(ru, l.tasks[0].promptKey, '{{name}}, сколько камней?');
    setKey(ru, c[0].topic.titleKey, 'Счёт {{name}}');
    const out = run('nameOnlyInTali', c, { ru }).join('\n');
    expect(out).toContain(`${l.tasks[0].promptKey} — имя ребёнка вне реплик Tali`);
    expect(out).toContain(`${c[0].topic.titleKey} — имя ребёнка вне реплик Tali`);
  });
});

describe('гард корпуса: реестр навыков', () => {
  const registry = SKILL_BY_ID as Map<string, SkillEntry>;
  const add = (e: SkillEntry) => registry.set(e.id, e);
  afterEach(() => {
    registry.delete('later-skill');
    registry.delete('needs-sort');
  });

  it('ловит навык не из реестра — в задании и в примере', () => {
    const c = goodCorpus();
    lessonAt(c, 0).tasks[1].skill = 'count-to-three';
    lessonAt(c, 0).model!.skill = 'count-to-tree';
    const out = run('skillRegistry', c).join('\n');
    expect(out).toContain('навыка count-to-three нет в реестре');
    expect(out).toContain('навыка count-to-tree нет в реестре');
  });

  it('ловит навык раньше его полосы', () => {
    add({ id: 'later-skill', region: 'numbers', band: '7', prerequisites: [], source: 'kr' });
    const c = goodCorpus();
    lessonAt(c, 0).tasks[1].skill = 'later-skill';
    expectRed('skillRegistry', c, 'навык later-skill вводится на 7, а урок — 5-6');
  });

  it('ловит навык раньше пререквизита той же полосы', () => {
    add({ id: 'needs-sort', region: 'numbers', band: '5-6', prerequisites: ['sort-by-kind'], source: 'norm' });
    const c = goodCorpus();
    lessonAt(c, 0).tasks[1].skill = 'needs-sort';
    expectRed('skillRegistry', c, 'навык needs-sort раньше своего пререквизита sort-by-kind');
  });
});

describe('гард корпуса: класс и завязка', () => {
  it('ловит тему 9-10 без класса, класс у темы 5-6 и тему 3 класса после 4-го', () => {
    const c = goodCorpus();
    delete c[1].topic.grade;
    c[0].topic.grade = 3;
    let out = run('grade', c).join('\n');
    expect(out).toContain('fx-b: у темы 9-10 нет класса');
    expect(out).toContain('fx-a: класс у темы полосы 5-6');
    const order = goodCorpus();
    order[1].topic.grade = 4;
    order.push({ file: 'words-9-10.ts', topic: { ...order[1].topic, id: 'fx-c', grade: 3 } });
    out = run('grade', order).join('\n');
    expect(out).toContain('fx-c: тема 3 класса после темы 4-го');
  });

  it('на 5-6 ловит длинную завязку урока без примера', () => {
    const c = goodCorpus();
    const l = lessonAt(c, 0);
    delete l.model;
    const ru = localeFor(c);
    setKey(ru, l.hook.lineKey, 'а'.repeat(37));
    expectRed('hook56', c, 'завязка: ru 37 знаков, нужно ≤ 36', { ru });
  });
});
