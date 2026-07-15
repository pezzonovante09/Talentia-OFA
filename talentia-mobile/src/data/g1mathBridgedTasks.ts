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

function patchG1mC20L1(raw: AnyTask[]): AnyTask[] {
  const t = cloneTasks(raw);
  const p = 'g1m_c20l1';
  setOnlyCorrect(t[0], 'b');
  expandToThreeMc(t[1], p, 2);
  setOnlyCorrect(t[1], 'b');
  setOnlyCorrect(t[2], 'b');
  setOnlyCorrect(t[3], 'a');
  setOnlyCorrect(t[4], 'b');
  return t;
}

/** Числа 16–20 — v2 vs forest-v-l2. */
function patchG1mC20L2(raw: AnyTask[]): AnyTask[] {
  const t = cloneTasks(raw);
  setOnlyCorrect(t[2], 'b');
  setOnlyCorrect(t[3], 'b');
  setOnlyCorrect(t[4], 'b');
  return t;
}

/** Сравнение чисел — v2 vs forest-v-l3 (в 3-м задании только 2 варианта). */
function patchG1mC20L3(raw: AnyTask[]): AnyTask[] {
  const t = cloneTasks(raw);
  const p = 'g1m_c20l3';
  setOnlyCorrect(t[0], 'b');
  setOnlyCorrect(t[1], 'a');
  shrinkToTwoMc(t[2], p, 3);
  setOnlyCorrect(t[2], 'b');
  return t;
}

/** Сложение до 10 — v2 vs forest-con-l1. */
function patchG1mAddL1(raw: AnyTask[]): AnyTask[] {
  const t = cloneTasks(raw);
  const p = 'g1m_addl1';
  setOnlyCorrect(t[0], 'b');
  expandToThreeMc(t[1], p, 2);
  setOnlyCorrect(t[1], 'b');
  setOnlyCorrect(t[3], 'b');
  setOnlyCorrect(t[4], 'b');
  return t;
}

/** До десятка — v2: все MC; в RW56 у 4-го задания input. */
function patchG1mAddL2(raw: AnyTask[]): AnyTask[] {
  const t = cloneTasks(raw);
  const p = 'g1m_addl2';
  setOnlyCorrect(t[0], 'b');
  expandToThreeMc(t[1], p, 2);
  setOnlyCorrect(t[1], 'b');
  replaceWithMc3(t[3], p, 4, 2, 'b');
  setOnlyCorrect(t[4], 'a');
  return t;
}

/** Сложение с 10 — v2 vs forest-con-l3. */
function patchG1mAddL3(raw: AnyTask[]): AnyTask[] {
  const t = cloneTasks(raw);
  const p = 'g1m_addl3';
  setOnlyCorrect(t[0], 'b');
  expandToThreeMc(t[1], p, 2);
  setOnlyCorrect(t[1], 'b');
  setOnlyCorrect(t[2], 'b');
  setOnlyCorrect(t[3], 'b');
  setOnlyCorrect(t[4], 'b');
  return t;
}

/** Вычитание до 10 — v2 vs forest-syl-l1. */
function patchG1mSubL1(raw: AnyTask[]): AnyTask[] {
  const t = cloneTasks(raw);
  setOnlyCorrect(t[0], 'b');
  setOnlyCorrect(t[3], 'b');
  setOnlyCorrect(t[4], 'b');
  return t;
}

/** Вычитание из 10 — v2 vs forest-syl-l2. */
function patchG1mSubL2(raw: AnyTask[]): AnyTask[] {
  const t = cloneTasks(raw);
  setOnlyCorrect(t[3], 'b');
  setOnlyCorrect(t[4], 'b');
  return t;
}

/** Смешанные примеры — v2: в 3-м задании только 2 варианта (да/нет). */
function patchG1mSubL3(raw: AnyTask[]): AnyTask[] {
  const t = cloneTasks(raw);
  const p = 'g1m_subl3';
  shrinkToTwoMc(t[2], p, 3);
  setOnlyCorrect(t[2], 'b');
  setOnlyCorrect(t[3], 'b');
  setOnlyCorrect(t[4], 'b');
  return t;
}

export const G1M_C20_L1_TASKS = patchG1mC20L1(bridgeMcTasks(RW56_LESSON_TASKS['forest-v-l1'] as AnyTask[], 'g1m_c20l1'));
export const G1M_C20_L2_TASKS = patchG1mC20L2(bridgeMcTasks(RW56_LESSON_TASKS['forest-v-l2'] as AnyTask[], 'g1m_c20l2'));
export const G1M_C20_L3_TASKS = patchG1mC20L3(bridgeMcTasks(RW56_LESSON_TASKS['forest-v-l3'] as AnyTask[], 'g1m_c20l3'));
export const G1M_ADD_L1_TASKS = patchG1mAddL1(bridgeMcTasks(RW56_LESSON_TASKS['forest-con-l1'] as AnyTask[], 'g1m_addl1'));
export const G1M_ADD_L2_TASKS = patchG1mAddL2(bridgeMcTasks(RW56_LESSON_TASKS['forest-con-l2'] as AnyTask[], 'g1m_addl2'));
export const G1M_ADD_L3_TASKS = patchG1mAddL3(bridgeMcTasks(RW56_LESSON_TASKS['forest-con-l3'] as AnyTask[], 'g1m_addl3'));
export const G1M_SUB_L1_TASKS = patchG1mSubL1(bridgeMcTasks(RW56_LESSON_TASKS['forest-syl-l1'] as AnyTask[], 'g1m_subl1'));
export const G1M_SUB_L2_TASKS = patchG1mSubL2(bridgeMcTasks(RW56_LESSON_TASKS['forest-syl-l2'] as AnyTask[], 'g1m_subl2'));
export const G1M_SUB_L3_TASKS = patchG1mSubL3(bridgeMcTasks(RW56_LESSON_TASKS['forest-syl-l3'] as AnyTask[], 'g1m_subl3'));
