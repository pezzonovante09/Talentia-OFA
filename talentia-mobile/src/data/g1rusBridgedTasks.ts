import { RW56_LESSON_TASKS } from './rw56LessonTasks';
import {
  type AnyTask,
  bridgeMcTasks,
  cloneTasks,
  expandToThreeMc,
  replaceWithMc3,
  setOnlyCorrect,
  shrinkToTwoMc,
} from './lessonBridgeUtils';

/** Буквы А, О, У — структура под grade-1-curriculum-ru-v2 (не island-abc-l1). */
function patchG1rVowL1(raw: AnyTask[]): AnyTask[] {
  const t = cloneTasks(raw);
  const p = 'g1r_vowl1';
  shrinkToTwoMc(t[0], p, 1);
  setOnlyCorrect(t[0], 'b');
  setOnlyCorrect(t[1], 'b');
  setOnlyCorrect(t[2], 'b');
  shrinkToTwoMc(t[3], p, 4);
  setOnlyCorrect(t[3], 'b');
  setOnlyCorrect(t[4], 'a');
  return t;
}

/** Я, Ю, Е, Ё — 4-е задание MC вместо input в island-abc-l2. */
function patchG1rVowL2(raw: AnyTask[]): AnyTask[] {
  const t = cloneTasks(raw);
  const p = 'g1r_vowl2';
  setOnlyCorrect(t[0], 'b');
  setOnlyCorrect(t[1], 'b');
  setOnlyCorrect(t[2], 'b');
  replaceWithMc3(t[3], p, 4, 2, 'b');
  setOnlyCorrect(t[4], 'a');
  return t;
}

/** Мягкость согласных — v2 vs island-abc-l3. */
function patchG1rVowL3(raw: AnyTask[]): AnyTask[] {
  const t = cloneTasks(raw);
  const p = 'g1r_vowl3';
  shrinkToTwoMc(t[0], p, 1);
  setOnlyCorrect(t[0], 'b');
  expandToThreeMc(t[1], p, 2);
  setOnlyCorrect(t[1], 'b');
  shrinkToTwoMc(t[2], p, 3);
  setOnlyCorrect(t[2], 'b');
  setOnlyCorrect(t[3], 'b');
  setOnlyCorrect(t[4], 'a');
  return t;
}

export const G1R_VOW_L1_TASKS = patchG1rVowL1(
  bridgeMcTasks(RW56_LESSON_TASKS['island-abc-l1'] as AnyTask[], 'g1r_vowl1'),
);
export const G1R_VOW_L2_TASKS = patchG1rVowL2(
  bridgeMcTasks(RW56_LESSON_TASKS['island-abc-l2'] as AnyTask[], 'g1r_vowl2'),
);
export const G1R_VOW_L3_TASKS = patchG1rVowL3(
  bridgeMcTasks(RW56_LESSON_TASKS['island-abc-l3'] as AnyTask[], 'g1r_vowl3'),
);

/** Читаем слова — v2 vs island-col-l1. */
function patchG1rWrdL1(raw: AnyTask[]): AnyTask[] {
  const t = cloneTasks(raw);
  const p = 'g1r_wrdl1';
  shrinkToTwoMc(t[0], p, 1);
  setOnlyCorrect(t[0], 'b');
  setOnlyCorrect(t[1], 'b');
  expandToThreeMc(t[2], p, 3);
  setOnlyCorrect(t[2], 'a');
  shrinkToTwoMc(t[3], p, 4);
  setOnlyCorrect(t[3], 'b');
  setOnlyCorrect(t[4], 'a');
  return t;
}

/** Слоги — v2 vs island-col-l2. */
function patchG1rWrdL2(raw: AnyTask[]): AnyTask[] {
  const t = cloneTasks(raw);
  const p = 'g1r_wrdl2';
  shrinkToTwoMc(t[0], p, 1);
  setOnlyCorrect(t[0], 'b');
  setOnlyCorrect(t[1], 'b');
  setOnlyCorrect(t[2], 'b');
  expandToThreeMc(t[3], p, 4);
  setOnlyCorrect(t[3], 'b');
  setOnlyCorrect(t[4], 'b');
  return t;
}

/** Предложения — v2 vs island-col-l3. */
function patchG1rWrdL3(raw: AnyTask[]): AnyTask[] {
  const t = cloneTasks(raw);
  const p = 'g1r_wrdl3';
  shrinkToTwoMc(t[0], p, 1);
  setOnlyCorrect(t[0], 'b');
  shrinkToTwoMc(t[1], p, 2);
  setOnlyCorrect(t[1], 'b');
  setOnlyCorrect(t[2], 'b');
  shrinkToTwoMc(t[3], p, 4);
  setOnlyCorrect(t[3], 'b');
  return t;
}

/** Заглавная буква — v2 vs island-anim-l1. */
function patchG1rGrmL1(raw: AnyTask[]): AnyTask[] {
  const t = cloneTasks(raw);
  const p = 'g1r_grml1';
  shrinkToTwoMc(t[0], p, 1);
  setOnlyCorrect(t[0], 'b');
  expandToThreeMc(t[1], p, 2);
  setOnlyCorrect(t[1], 'b');
  shrinkToTwoMc(t[2], p, 3);
  setOnlyCorrect(t[2], 'b');
  shrinkToTwoMc(t[3], p, 4);
  setOnlyCorrect(t[3], 'b');
  setOnlyCorrect(t[4], 'a');
  return t;
}

/** Знаки препинания — v2 vs island-anim-l2. */
function patchG1rGrmL2(raw: AnyTask[]): AnyTask[] {
  const t = cloneTasks(raw);
  const p = 'g1r_grml2';
  shrinkToTwoMc(t[0], p, 1);
  setOnlyCorrect(t[0], 'b');
  setOnlyCorrect(t[1], 'b');
  setOnlyCorrect(t[2], 'c');
  expandToThreeMc(t[3], p, 4);
  setOnlyCorrect(t[3], 'b');
  setOnlyCorrect(t[4], 'a');
  return t;
}

/** Кто? что? — v2 vs island-anim-l3. */
function patchG1rGrmL3(raw: AnyTask[]): AnyTask[] {
  const t = cloneTasks(raw);
  const p = 'g1r_grml3';
  shrinkToTwoMc(t[0], p, 1);
  setOnlyCorrect(t[0], 'b');
  shrinkToTwoMc(t[1], p, 2);
  setOnlyCorrect(t[1], 'b');
  setOnlyCorrect(t[2], 'b');
  shrinkToTwoMc(t[3], p, 4);
  setOnlyCorrect(t[3], 'b');
  return t;
}

export const G1R_WRD_L1_TASKS = patchG1rWrdL1(
  bridgeMcTasks(RW56_LESSON_TASKS['island-col-l1'] as AnyTask[], 'g1r_wrdl1'),
);
export const G1R_WRD_L2_TASKS = patchG1rWrdL2(
  bridgeMcTasks(RW56_LESSON_TASKS['island-col-l2'] as AnyTask[], 'g1r_wrdl2'),
);
export const G1R_WRD_L3_TASKS = patchG1rWrdL3(
  bridgeMcTasks(RW56_LESSON_TASKS['island-col-l3'] as AnyTask[], 'g1r_wrdl3'),
);
export const G1R_GRM_L1_TASKS = patchG1rGrmL1(
  bridgeMcTasks(RW56_LESSON_TASKS['island-anim-l1'] as AnyTask[], 'g1r_grml1'),
);
export const G1R_GRM_L2_TASKS = patchG1rGrmL2(
  bridgeMcTasks(RW56_LESSON_TASKS['island-anim-l2'] as AnyTask[], 'g1r_grml2'),
);
export const G1R_GRM_L3_TASKS = patchG1rGrmL3(
  bridgeMcTasks(RW56_LESSON_TASKS['island-anim-l3'] as AnyTask[], 'g1r_grml3'),
);

/** Школа — v2 vs garden-col-l1 / garden-col-l2 (та же схема вариантов, что у g1r-wrd-l1/l2). */
function patchG1wSchL1(raw: AnyTask[]): AnyTask[] {
  const t = cloneTasks(raw);
  const p = 'g1w_schl1';
  shrinkToTwoMc(t[0], p, 1);
  setOnlyCorrect(t[0], 'b');
  setOnlyCorrect(t[1], 'b');
  expandToThreeMc(t[2], p, 3);
  setOnlyCorrect(t[2], 'b');
  setOnlyCorrect(t[3], 'b');
  setOnlyCorrect(t[4], 'a');
  return t;
}

function patchG1wSchL2(raw: AnyTask[]): AnyTask[] {
  const t = cloneTasks(raw);
  const p = 'g1w_schl2';
  shrinkToTwoMc(t[0], p, 1);
  setOnlyCorrect(t[0], 'b');
  setOnlyCorrect(t[1], 'b');
  expandToThreeMc(t[2], p, 3);
  setOnlyCorrect(t[2], 'a');
  setOnlyCorrect(t[3], 'b');
  setOnlyCorrect(t[4], 'a');
  return t;
}

export const G1W_SCH_L1_TASKS = patchG1wSchL1(
  bridgeMcTasks(RW56_LESSON_TASKS['garden-col-l1'] as AnyTask[], 'g1w_schl1'),
);
export const G1W_SCH_L2_TASKS = patchG1wSchL2(
  bridgeMcTasks(RW56_LESSON_TASKS['garden-col-l2'] as AnyTask[], 'g1w_schl2'),
);
