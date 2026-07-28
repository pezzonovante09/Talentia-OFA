import type { LessonTask } from './worlds';

/** New topic-matched task banks for g1world (Phase 4). */

export const G1W_SCH_L3_TASKS: LessonTask[] = [
  { id: 'g1wschl3t1', type: 'multiple_choice', questionKey: 'data.tasks.g1w_schl3_q1', difficulty: 1, options: [
    { id: 'a', textKey: 'data.tasks.g1w_schl3_opt_run', correct: true },
    { id: 'b', textKey: 'data.tasks.g1w_schl3_opt_read', correct: false },
    { id: 'c', textKey: 'data.tasks.g1w_schl3_opt_sleep', correct: false },
  ] },
  { id: 'g1wschl3t2', type: 'multiple_choice', questionKey: 'data.tasks.g1w_schl3_q2', difficulty: 1, options: [
    { id: 'a', textKey: 'data.tasks.g1w_schl3_opt_paint', correct: true },
    { id: 'b', textKey: 'data.tasks.g1w_schl3_opt_jump', correct: false },
    { id: 'c', textKey: 'data.tasks.g1w_schl3_opt_count', correct: false },
  ] },
  { id: 'g1wschl3t3', type: 'multiple_choice', questionKey: 'data.tasks.g1w_schl3_q3', difficulty: 2, options: [
    { id: 'a', textKey: 'data.tasks.g1w_schl3_opt_ball', correct: true },
    { id: 'b', textKey: 'data.tasks.g1w_schl3_opt_brush', correct: false },
    { id: 'c', textKey: 'data.tasks.g1w_schl3_opt_book', correct: false },
  ] },

  { id: 'g1wschl3t4', type: 'input', questionKey: 'data.tasks.g1w_schl3_q4', difficulty: 2, answer: "Нет" },
];

export const G1W_NAT_L1_TASKS: LessonTask[] = [
  { id: 'g1wnatl1t1', type: 'multiple_choice', questionKey: 'data.tasks.g1w_natl1_q1', difficulty: 1, options: [
    { id: 'a', textKey: 'data.tasks.g1w_natl1_opt_oak', correct: true },
    { id: 'b', textKey: 'data.tasks.g1w_natl1_opt_rose', correct: false },
    { id: 'c', textKey: 'data.tasks.g1w_natl1_opt_mushroom', correct: false },
  ] },
  { id: 'g1wnatl1t2', type: 'multiple_choice', questionKey: 'data.tasks.g1w_natl1_q2', difficulty: 1, options: [
    { id: 'a', textKey: 'data.tasks.g1w_natl1_opt_trunk', correct: true },
    { id: 'b', textKey: 'data.tasks.g1w_natl1_opt_root', correct: false },
    { id: 'c', textKey: 'data.tasks.g1w_natl1_opt_flower', correct: false },
  ] },
  { id: 'g1wnatl1t3', type: 'multiple_choice', questionKey: 'data.tasks.g1w_natl1_q3', difficulty: 2, options: [
    { id: 'a', textKey: 'data.tasks.g1w_natl1_opt_fir', correct: true },
    { id: 'b', textKey: 'data.tasks.g1w_natl1_opt_birch', correct: false },
    { id: 'c', textKey: 'data.tasks.g1w_natl1_opt_maple', correct: false },
  ] },

  { id: 'g1wnatl1t4', type: 'input', questionKey: 'data.tasks.g1w_natl1_q4', difficulty: 2, answer: "Листья" },
];

export const G1W_NAT_L3_TASKS: LessonTask[] = [
  { id: 'g1wnatl3t1', type: 'multiple_choice', questionKey: 'data.tasks.g1w_natl3_q1', difficulty: 1, options: [
    { id: 'a', textKey: 'data.tasks.g1w_natl3_opt_sun', correct: true },
    { id: 'b', textKey: 'data.tasks.g1w_natl3_opt_snow', correct: false },
    { id: 'c', textKey: 'data.tasks.g1w_natl3_opt_rain', correct: false },
  ] },
  { id: 'g1wnatl3t2', type: 'multiple_choice', questionKey: 'data.tasks.g1w_natl3_q2', difficulty: 1, options: [
    { id: 'a', textKey: 'data.tasks.g1w_natl3_opt_coat', correct: true },
    { id: 'b', textKey: 'data.tasks.g1w_natl3_opt_swimsuit', correct: false },
    { id: 'c', textKey: 'data.tasks.g1w_natl3_opt_sandals', correct: false },
  ] },
  { id: 'g1wnatl3t3', type: 'multiple_choice', questionKey: 'data.tasks.g1w_natl3_q3', difficulty: 2, options: [
    { id: 'a', textKey: 'data.tasks.g1w_natl3_opt_umbrella', correct: true },
    { id: 'b', textKey: 'data.tasks.g1w_natl3_opt_sled', correct: false },
    { id: 'c', textKey: 'data.tasks.g1w_natl3_opt_fan', correct: false },
  ] },

  { id: 'g1wnatl3t4', type: 'input', questionKey: 'data.tasks.g1w_natl3_q4', difficulty: 2, answer: "Да" },
];

export const G1W_BDY_L1_TASKS: LessonTask[] = [
  { id: 'g1wbdyl1t1', type: 'multiple_choice', questionKey: 'data.tasks.g1w_bdyl1_q1', difficulty: 1, options: [
    { id: 'a', textKey: 'data.tasks.g1w_bdy_opt_eyes', correct: true },
    { id: 'b', textKey: 'data.tasks.g1w_bdy_opt_ears', correct: false },
    { id: 'c', textKey: 'data.tasks.g1w_bdy_opt_nose', correct: false },
  ] },
  { id: 'g1wbdyl1t2', type: 'multiple_choice', questionKey: 'data.tasks.g1w_bdyl1_q2', difficulty: 1, options: [
    { id: 'a', textKey: 'data.tasks.g1w_bdy_opt_ears', correct: true },
    { id: 'b', textKey: 'data.tasks.g1w_bdy_opt_eyes', correct: false },
    { id: 'c', textKey: 'data.tasks.g1w_bdy_opt_tongue', correct: false },
  ] },
  { id: 'g1wbdyl1t3', type: 'multiple_choice', questionKey: 'data.tasks.g1w_bdyl1_q3', difficulty: 1, options: [
    { id: 'a', textKey: 'data.tasks.g1w_bdy_opt_nose', correct: true },
    { id: 'b', textKey: 'data.tasks.g1w_bdy_opt_hands', correct: false },
    { id: 'c', textKey: 'data.tasks.g1w_bdy_opt_eyes', correct: false },
  ] },

  { id: 'g1wbdyl1t4', type: 'input', questionKey: 'data.tasks.g1w_bdyl1_q4', difficulty: 2, answer: "Язык" },
  { id: 'g1wbdyl1a1', type: 'multiple_choice', audience: 'special_aba', questionKey: 'data.tasks.g1w_bdyl1_a1', difficulty: 1, options: [
    { id: 'a', textKey: 'data.tasks.g1w_bdy_opt_eyes', correct: true },
    { id: 'b', textKey: 'data.tasks.g1w_bdy_opt_ears', correct: false },
  ] },
];

export const G1W_BDY_L2_TASKS: LessonTask[] = [
  { id: 'g1wbdyl2t1', type: 'multiple_choice', questionKey: 'data.tasks.g1w_bdyl2_q1', difficulty: 1, options: [
    { id: 'a', textKey: 'data.tasks.g1w_bdyl2_opt_exercise', correct: true },
    { id: 'b', textKey: 'data.tasks.g1w_bdyl2_opt_candy', correct: false },
    { id: 'c', textKey: 'data.tasks.g1w_bdyl2_opt_tv', correct: false },
  ] },
  { id: 'g1wbdyl2t2', type: 'multiple_choice', questionKey: 'data.tasks.g1w_bdyl2_q2', difficulty: 1, options: [
    { id: 'a', textKey: 'data.tasks.g1w_bdyl2_opt_fruit', correct: true },
    { id: 'b', textKey: 'data.tasks.g1w_bdyl2_opt_chips', correct: false },
    { id: 'c', textKey: 'data.tasks.g1w_bdyl2_opt_soda', correct: false },
  ] },
  { id: 'g1wbdyl2t3', type: 'multiple_choice', questionKey: 'data.tasks.g1w_bdyl2_q3', difficulty: 2, options: [
    { id: 'a', textKey: 'data.tasks.g1w_bdyl2_opt_sleep', correct: true },
    { id: 'b', textKey: 'data.tasks.g1w_bdyl2_opt_2h', correct: false },
    { id: 'c', textKey: 'data.tasks.g1w_bdyl2_opt_allnight', correct: false },
  ] },

  { id: 'g1wbdyl2t4', type: 'input', questionKey: 'data.tasks.g1w_bdyl2_q4', difficulty: 2, answer: "Скелет (кости)" },
  { id: 'g1wbdyl2a1', type: 'multiple_choice', audience: 'special_aba', questionKey: 'data.tasks.g1w_bdyl2_a1', difficulty: 1, options: [
    { id: 'a', textKey: 'data.tasks.opt_yes', correct: true },
    { id: 'b', textKey: 'data.tasks.opt_no', correct: false },
  ] },
];

export const G1W_BDY_L3_TASKS: LessonTask[] = [
  { id: 'g1wbdyl3t1', type: 'multiple_choice', questionKey: 'data.tasks.g1w_bdyl3_q1', difficulty: 1, options: [
    { id: 'a', textKey: 'data.tasks.g1w_bdyl3_opt_green', correct: true },
    { id: 'b', textKey: 'data.tasks.g1w_bdyl3_opt_red', correct: false },
    { id: 'c', textKey: 'data.tasks.g1w_bdyl3_opt_yellow', correct: false },
  ] },
  { id: 'g1wbdyl3t2', type: 'multiple_choice', questionKey: 'data.tasks.g1w_bdyl3_q2', difficulty: 1, options: [
    { id: 'a', textKey: 'data.tasks.g1w_bdyl3_opt_parent', correct: true },
    { id: 'b', textKey: 'data.tasks.g1w_bdyl3_opt_open', correct: false },
    { id: 'c', textKey: 'data.tasks.g1w_bdyl3_opt_hide', correct: false },
  ] },
  { id: 'g1wbdyl3t3', type: 'multiple_choice', questionKey: 'data.tasks.g1w_bdyl3_q3', difficulty: 2, options: [
    { id: 'a', textKey: 'data.tasks.g1w_bdyl3_opt_police', correct: true },
    { id: 'b', textKey: 'data.tasks.g1w_bdyl3_opt_stranger', correct: false },
    { id: 'c', textKey: 'data.tasks.g1w_bdyl3_opt_alone', correct: false },
  ] },

  { id: 'g1wbdyl3t4', type: 'input', questionKey: 'data.tasks.g1w_bdyl3_q4', difficulty: 2, answer: "Посмотреть налево и направо" },
  { id: 'g1wbdyl3a1', type: 'multiple_choice', audience: 'special_aba', questionKey: 'data.tasks.g1w_bdyl3_a1', difficulty: 1, options: [
    { id: 'a', textKey: 'data.tasks.g1w_bdyl3_opt_green', correct: true },
    { id: 'b', textKey: 'data.tasks.g1w_bdyl3_opt_red', correct: false },
  ] },
];
