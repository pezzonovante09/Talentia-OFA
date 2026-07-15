export type BridgeTaskAudience = 'standard' | 'special_aba';

export type McOption = { id: string; textKey: string; correct: boolean };
export type McTask = {
  id: string;
  type: 'multiple_choice';
  questionKey: string;
  difficulty: number;
  options: McOption[];
  audience?: BridgeTaskAudience;
  visualCount?: number;
  visualEmoji?: string;
  skippable?: boolean;
};
export type AnyTask = McTask | Record<string, unknown>;

export function cloneTasks(source: readonly AnyTask[]): McTask[] {
  return JSON.parse(JSON.stringify(source)) as McTask[];
}

export function setOnlyCorrect(t: McTask, correctId: string) {
  for (const o of t.options) o.correct = o.id === correctId;
}

export function expandToThreeMc(t: McTask, prefix: string, taskIndex1: number) {
  const qk = `data.tasks.${prefix}_q${taskIndex1}`;
  t.type = 'multiple_choice';
  t.options = [
    { id: 'a', textKey: `${qk}_a`, correct: false },
    { id: 'b', textKey: `${qk}_b`, correct: false },
    { id: 'c', textKey: `${qk}_c`, correct: false },
  ];
}

export function shrinkToTwoMc(t: McTask, prefix: string, taskIndex1: number) {
  const qk = `data.tasks.${prefix}_q${taskIndex1}`;
  t.type = 'multiple_choice';
  t.options = [
    { id: 'a', textKey: `${qk}_a`, correct: false },
    { id: 'b', textKey: `${qk}_b`, correct: false },
  ];
}

export function replaceWithMc3(
  t: McTask,
  prefix: string,
  taskIndex1: number,
  difficulty: number,
  correctId: string,
  audience?: BridgeTaskAudience,
) {
  const qk = `data.tasks.${prefix}_q${taskIndex1}`;
  const base: McTask = {
    id: `${prefix}_t${taskIndex1}`,
    type: 'multiple_choice',
    questionKey: qk,
    difficulty,
    options: [
      { id: 'a', textKey: `${qk}_a`, correct: correctId === 'a' },
      { id: 'b', textKey: `${qk}_b`, correct: correctId === 'b' },
      { id: 'c', textKey: `${qk}_c`, correct: correctId === 'c' },
    ],
  };
  if (audience) base.audience = audience;
  Object.assign(t, base);
  delete (t as Record<string, unknown>).answer;
  delete (t as Record<string, unknown>).placeholderKey;
  delete (t as Record<string, unknown>).skippable;
}

/** RW56 → новые id и ключи `data.tasks.<prefix>_qN`. */
export function bridgeMcTasks(source: readonly AnyTask[], prefix: string): AnyTask[] {
  return source.map((t, i) => {
    const qi = i + 1;
    const tid = `${prefix}_t${qi}`;
    const cloned = JSON.parse(JSON.stringify(t)) as McTask;
    cloned.id = tid;
    if (cloned.type === 'multiple_choice' && cloned.options) {
      cloned.questionKey = `data.tasks.${prefix}_q${qi}`;
      for (const o of cloned.options) {
        o.textKey = `data.tasks.${prefix}_q${qi}_${o.id}`;
      }
    } else if ((cloned as Record<string, unknown>).type === 'input') {
      (cloned as Record<string, unknown>).questionKey = `data.tasks.${prefix}_q${qi}`;
    }
    return cloned;
  }) as AnyTask[];
}
