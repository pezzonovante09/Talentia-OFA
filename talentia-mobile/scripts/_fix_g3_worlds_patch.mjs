import fs from 'fs';

const worldsFile = new URL('../src/data/worlds.ts', import.meta.url);
let worlds = fs.readFileSync(worldsFile, 'utf8');
worlds = worlds.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

const reps = [
  [
    "answer: '7' },\n            { id: 'g3mdivl2t4', type: 'input', questionKey: 'data.tasks.g3m_div_l2_q4', difficulty: 1, answer: '8' }",
    "answer: '3 остаток 1' },\n            { id: 'g3mdivl2t4', type: 'input', questionKey: 'data.tasks.g3m_div_l2_q4', difficulty: 1, answer: '3 остаток 2' }",
  ],
  ["questionKey: 'data.tasks.g3r_fem_question'", "questionKey: 'data.tasks.g3r_genl2_q1'"],
  ["questionKey: 'data.tasks.g3r_koshka_gender'", "questionKey: 'data.tasks.g3r_genl2_q2'"],
  ["questionKey: 'data.tasks.g3r_kniga_gender'", "questionKey: 'data.tasks.g3r_genl2_q3'"],
  ["questionKey: 'data.tasks.g3r_devochka_gender'", "questionKey: 'data.tasks.g3r_genl2_q4'"],
  ["questionKey: 'data.tasks.g3r_neut_question'", "questionKey: 'data.tasks.g3r_genl3_q1'"],
  ["questionKey: 'data.tasks.g3r_okno_gender'", "questionKey: 'data.tasks.g3r_genl3_q2'"],
  ["questionKey: 'data.tasks.g3r_solnce_gender'", "questionKey: 'data.tasks.g3r_genl3_q3'"],
  ["questionKey: 'data.tasks.g3r_moloko_gender'", "questionKey: 'data.tasks.g3r_genl3_q4'"],
  ["questionKey: 'data.tasks.g3r_present_question'", "questionKey: 'data.tasks.g3r_verbl1_present_q'"],
  [
    'questionKey: \'data.tasks.g3r_which_present\', difficulty: 2, answer: "Читает"',
    'questionKey: \'data.tasks.g3r_verbl1_present_input\', difficulty: 2, answer: "Пишет"',
  ],
  ["questionKey: 'data.tasks.g3r_future_question'", "questionKey: 'data.tasks.g3r_person_q1'"],
  ["questionKey: 'data.tasks.g3r_which_future'", "questionKey: 'data.tasks.g3r_person_q2'"],
  ["questionKey: 'data.tasks.g3r_verbl3_q3'", "questionKey: 'data.tasks.g3r_person_q3'"],
  [
    'questionKey: \'data.tasks.g3r_verbl3_q4\', difficulty: 2, answer: "Гуляют (3-е лицо, мн.ч.)"',
    'questionKey: \'data.tasks.g3r_person_q4\', difficulty: 2, answer: "гуляют"',
  ],
  ["questionKey: 'data.tasks.g3r_krasny_for_stol'", "questionKey: 'data.tasks.g3r_antonym_q1'"],
  [
    "questionKey: 'data.tasks.g3r_krasnoe_for_okno', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_adjl3_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3r_adjl3_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_adjl3_q2_c', correct: false }]",
    "questionKey: 'data.tasks.g3r_antonym_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_antonym_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3r_antonym_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_antonym_q2_c', correct: false }]",
  ],
  ["questionKey: 'data.tasks.g3r_krasnaya_for_kniga'", "questionKey: 'data.tasks.g3r_antonym_q3'"],
  [
    'questionKey: \'data.tasks.g3r_adjl3_q4\', difficulty: 2, answer: "Короткие"',
    'questionKey: \'data.tasks.g3r_antonym_q4\', difficulty: 2, answer: "короткие"',
  ],
  ["questionKey: 'data.tasks.g3w_continents_count'", "questionKey: 'data.tasks.g3w_compass_q1'"],
  ["questionKey: 'data.tasks.g3w_largest_continent'", "questionKey: 'data.tasks.g3w_compass_q2'"],
  ["questionKey: 'data.tasks.g3w_smallest_continent'", "questionKey: 'data.tasks.g3w_compass_q3'"],
  ["questionKey: 'data.tasks.g3w_russia_on_continent'", "questionKey: 'data.tasks.g3w_compass_q4'"],
  ["questionKey: 'data.tasks.g3w_oceans_count'", "questionKey: 'data.tasks.g3w_map_q1'"],
  ["questionKey: 'data.tasks.g3w_largest_ocean'", "questionKey: 'data.tasks.g3w_map_q2'"],
  ["questionKey: 'data.tasks.g3w_arctic_ocean'", "questionKey: 'data.tasks.g3w_map_q3'"],
  ["questionKey: 'data.tasks.g3w_water_more'", "questionKey: 'data.tasks.g3w_map_q4'"],
  [
    `{ id: 'g3wecol1t1', type: 'multiple_choice', questionKey: 'data.tasks.g3w_ecology_studies', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3w_opt_nature_relations', correct: false }, { id: 'b', textKey: 'data.tasks.g3w_opt_math_calc', correct: true }, { id: 'c', textKey: 'data.tasks.g3w_opt_history', correct: false }] },
            { id: 'g3wecol1t2', type: 'multiple_choice', questionKey: 'data.tasks.g3w_ecol1_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3w_ecol1_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3w_ecol1_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_ecol1_q2_c', correct: false }] },
            { id: 'g3wecol1t3', type: 'multiple_choice', questionKey: 'data.tasks.g3w_save_water_how', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3w_opt_turn_off_tap', correct: false }, { id: 'b', textKey: 'data.tasks.g3w_opt_leave_tap_on', correct: true }, { id: 'c', textKey: 'data.tasks.g3w_opt_bath_daily', correct: false }] },
            { id: 'g3wecol1t4', type: 'input', questionKey: 'data.tasks.g3w_nature_belongs_to', difficulty: 2, answer: "Аквариум с рыбками" },`,
    `{ id: 'g3wecol1t1', type: 'multiple_choice', questionKey: 'data.tasks.g3w_ecol1_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3w_ecol1_q1_a', correct: false }, { id: 'b', textKey: 'data.tasks.g3w_ecol1_q1_b', correct: true }, { id: 'c', textKey: 'data.tasks.g3w_ecol1_q1_c', correct: false }] },
            { id: 'g3wecol1t2', type: 'multiple_choice', questionKey: 'data.tasks.g3w_ecol1_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3w_ecol1_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3w_ecol1_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_ecol1_q2_c', correct: false }] },
            { id: 'g3wecol1t3', type: 'multiple_choice', questionKey: 'data.tasks.g3w_ecol1_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3w_ecol1_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g3w_ecol1_q3_b', correct: true }, { id: 'c', textKey: 'data.tasks.g3w_ecol1_q3_c', correct: false }] },
            { id: 'g3wecol1t4', type: 'multiple_choice', questionKey: 'data.tasks.g3w_ecol1_q4', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3w_ecol1_q4_a', correct: false }, { id: 'b', textKey: 'data.tasks.g3w_ecol1_q4_b', correct: true }, { id: 'c', textKey: 'data.tasks.g3w_ecol1_q4_c', correct: false }] },`,
  ],
  [
    `{ id: 'g3wecol2t1', type: 'multiple_choice', questionKey: 'data.tasks.g3w_air_pollution_cause', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3w_opt_factories', correct: true }, { id: 'b', textKey: 'data.tasks.g3w_opt_trees', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_opt_rain', correct: false }] },
            { id: 'g3wecol2t2', type: 'multiple_choice', questionKey: 'data.tasks.g3w_forest_importance', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3w_opt_makes_oxygen', correct: false }, { id: 'b', textKey: 'data.tasks.g3w_opt_pollutes_air', correct: true }, { id: 'c', textKey: 'data.tasks.g3w_opt_dries_rivers', correct: false }] },`,
    `{ id: 'g3wecol2t1', type: 'multiple_choice', questionKey: 'data.tasks.g3w_ecol2_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3w_ecol2_q1_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3w_ecol2_q1_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_ecol2_q1_c', correct: false }] },
            { id: 'g3wecol2t2', type: 'multiple_choice', questionKey: 'data.tasks.g3w_ecol2_q2', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3w_ecol2_q2_a', correct: false }, { id: 'b', textKey: 'data.tasks.g3w_ecol2_q2_b', correct: true }, { id: 'c', textKey: 'data.tasks.g3w_ecol2_q2_c', correct: false }] },`,
  ],
];

let ok = 0;
let fail = 0;
for (const [from, to] of reps) {
  if (!worlds.includes(from)) {
    console.error('MISS:', from.slice(0, 120).replace(/\n/g, '\\n'));
    fail++;
    continue;
  }
  worlds = worlds.replace(from, to);
  ok++;
}

fs.writeFileSync(worldsFile, worlds, 'utf8');
console.log(`done: ${ok} ok, ${fail} miss`);
if (fail) process.exit(1);
