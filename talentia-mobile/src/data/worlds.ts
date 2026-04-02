export type TaskType = 'multiple_choice' | 'input';

export type MultipleChoiceOption = {
  id: string;
  textKey: string;
  correct: boolean;
};

export type TaskAudience = 'standard' | 'special_aba';

export type BaseTask = {
  id: string;
  type: TaskType;
  questionKey: string;
  difficulty: number;
  audience?: TaskAudience;
  visualCount?: number;
  visualEmoji?: string;
  /** If true and type is 'input', show a Skip button instead of a text field (for pre-literate children) */
  skippable?: boolean;
};

export type MultipleChoiceTask = BaseTask & {
  type: 'multiple_choice';
  options: MultipleChoiceOption[];
};

export type InputTask = BaseTask & {
  type: 'input';
  answer: string;
  placeholderKey?: string;
};

export type LessonTask = MultipleChoiceTask | InputTask;

export type CollectibleId =
  | 'banana_badge'
  | 'jungle_leaf'
  | 'canyon_gem'
  | 'spike_crystal'
  | 'star_fragment'
  | 'dino_egg_green'
  | 'dino_egg_red'
  | 'dino_egg_blue'
  | 'artifact_map'
  | 'tali_egg';

export type DialogLine = {
  speaker: 'tali' | 'npc';
  textKey: string;
};

export type IntroSlide = {
  titleKey: string;
  bodyKey: string;
  emoji?: string;
};

export type QuestReward = {
  xp: number;
  item?: CollectibleId;
};

export type Lesson = {
  id: string;
  topicId: string;
  titleKey: string;
  descriptionKey?: string;
  tasks: LessonTask[];
  dialog?: DialogLine[];
  intro?: IntroSlide[];
  reward?: QuestReward;
};

export type AgeBand = '5-6' | '7' | '8' | '9-10';

export type Topic = {
  id: string;
  worldId: string;
  titleKey: string;
  descriptionKey?: string;
  subject: 'math' | 'reading' | 'reading_ru' | 'logic' | 'social';
  lessons: Lesson[];
};

export type World = {
  id: string;
  titleKey: string;
  descriptionKey: string;
  accentColor: string;
  biome: string;
  npcName?: string;
  npcEmoji: string;
  isPremium?: boolean;
  ageBand?: AgeBand;
  topics: Topic[];
};

export const worlds: World[] = [
  // ---
  {
    id: 'jungle',
    ageBand: '7',
    titleKey: 'data.worlds.jungle',
    descriptionKey: 'data.worldDesc.jungle',
    accentColor: '#4CAF50',
    biome: '🌿',
    npcName: 'Rex',
    npcEmoji: '🦖',
    topics: [
      {
        id: 'jungle-addition',
        worldId: 'jungle',
        titleKey: 'data.topics.jungleAddition',
        subject: 'math',
        lessons: [
          {
            id: 'jungle-add-1',
            topicId: 'jungle-addition',
            titleKey: 'data.lessons.jungleAdd1',
            reward: { xp: 30, item: 'banana_badge' },
            dialog: [
              { speaker: 'tali', textKey: 'data.dialog.jungle_add_1_0' },
              { speaker: 'npc', textKey: 'data.dialog.jungle_add_1_1' },
            ],
            intro: [
              { titleKey: 'data.intro.jungleAdd_0_title', bodyKey: 'data.intro.jungleAdd_0_body', emoji: '🍌' },
              { titleKey: 'data.intro.jungleAdd_1_title', bodyKey: 'data.intro.jungleAdd_1_body', emoji: '🍌' },
            ],
            tasks: [
              // Standard tasks
              {
                id: 'jungle-add-1-t1',
                type: 'multiple_choice',
                questionKey: 'data.tasks.jungle_q_count_bananas',
                difficulty: 1,
                visualCount: 3,
                visualEmoji: '🍌',
                options: [
                  { id: 'opt-2', textKey: 'data.tasks.opt_two', correct: false },
                  { id: 'opt-3', textKey: 'data.tasks.opt_three', correct: true },
                  { id: 'opt-4', textKey: 'data.tasks.opt_four', correct: false },
                ],
              },
              {
                id: 'jungle-add-1-t2',
                type: 'multiple_choice',
                questionKey: 'data.tasks.q_add_two_three',
                difficulty: 1,
                options: [
                  { id: 'opt-4', textKey: 'data.tasks.opt_four', correct: false },
                  { id: 'opt-5', textKey: 'data.tasks.opt_five', correct: true },
                  { id: 'opt-3', textKey: 'data.tasks.opt_three', correct: false },
                ],
              },
              {
                id: 'jungle-add-1-t3',
                type: 'multiple_choice',
                questionKey: 'data.tasks.q_count_apples',
                difficulty: 1,
                visualCount: 5,
                visualEmoji: '🍎',
                options: [
                  { id: 'opt-4', textKey: 'data.tasks.opt_four', correct: false },
                  { id: 'opt-5', textKey: 'data.tasks.opt_five', correct: true },
                  { id: 'opt-6', textKey: 'data.tasks.opt_six', correct: false },
                ],
              },
              // ABA: short structured drills
              {
                id: 'jungle-add-1-a1',
                type: 'multiple_choice',
                audience: 'special_aba',
                questionKey: 'data.tasks.aba_jungleAdd_q1',
                difficulty: 1,
                visualCount: 3,
                visualEmoji: '🍌',
                options: [
                  { id: 'opt-2', textKey: 'data.tasks.opt_two', correct: false },
                  { id: 'opt-3', textKey: 'data.tasks.opt_three', correct: true },
                  { id: 'opt-4', textKey: 'data.tasks.opt_four', correct: false },
                ],
              },
              {
                id: 'jungle-add-1-a2',
                type: 'multiple_choice',
                audience: 'special_aba',
                questionKey: 'data.tasks.aba_jungleAdd_q2',
                difficulty: 1,
                options: [
                  { id: 'opt-4', textKey: 'data.tasks.opt_four', correct: false },
                  { id: 'opt-5', textKey: 'data.tasks.opt_five', correct: true },
                  { id: 'opt-3', textKey: 'data.tasks.opt_three', correct: false },
                ],
              },
            ],
          },
          {
            id: 'jungle-add-2',
            topicId: 'jungle-addition',
            titleKey: 'data.lessons.jungleAdd2',
            reward: { xp: 35 },
            dialog: [
              { speaker: 'tali', textKey: 'data.dialog.jungle_add_2_0' },
              { speaker: 'npc', textKey: 'data.dialog.jungle_add_2_1' },
            ],
            tasks: [
              {
                id: 'jungle-add-2-t1',
                type: 'multiple_choice',
                questionKey: 'data.tasks.jungle_q_add_4_3',
                difficulty: 2,
                options: [
                  { id: 'opt-6', textKey: 'data.tasks.opt_six', correct: false },
                  { id: 'opt-7', textKey: 'data.tasks.opt_seven', correct: true },
                  { id: 'opt-8', textKey: 'data.tasks.opt_eight', correct: false },
                ],
              },
              {
                id: 'jungle-add-2-t2',
                type: 'multiple_choice',
                questionKey: 'data.tasks.jungle_q_add_6_2',
                difficulty: 2,
                options: [
                  { id: 'opt-7', textKey: 'data.tasks.opt_seven', correct: false },
                  { id: 'opt-8', textKey: 'data.tasks.opt_eight', correct: true },
                  { id: 'opt-9', textKey: 'data.tasks.opt_nine', correct: false },
                ],
              },
              {
                id: 'jungle-add-2-t3',
                type: 'input',
                questionKey: 'data.tasks.q_add_two_three',
                difficulty: 2,
                answer: '5',
                placeholderKey: 'lesson.answerPlaceholder',
              },
            ],
          },
        ],
      },
      {
        id: 'jungle-subtraction',
        worldId: 'jungle',
        titleKey: 'data.topics.jungleSubtraction',
        subject: 'math',
        lessons: [
          {
            id: 'jungle-sub-1',
            topicId: 'jungle-subtraction',
            titleKey: 'data.lessons.jungleSub1',
            reward: { xp: 40, item: 'jungle_leaf' },
            dialog: [
              { speaker: 'tali', textKey: 'data.dialog.jungle_sub_1_0' },
              { speaker: 'npc', textKey: 'data.dialog.jungle_sub_1_1' },
            ],
            intro: [
              { titleKey: 'data.intro.jungleSub_0_title', bodyKey: 'data.intro.jungleSub_0_body', emoji: '➖' },
              { titleKey: 'data.intro.jungleSub_1_title', bodyKey: 'data.intro.jungleSub_1_body', emoji: '➗' },
            ],
            tasks: [
              // Standard tasks
              {
                id: 'jungle-sub-1-t1',
                type: 'multiple_choice',
                questionKey: 'data.tasks.jungle_q_sub_5_2',
                difficulty: 2,
                options: [
                  { id: 'opt-2', textKey: 'data.tasks.opt_two', correct: false },
                  { id: 'opt-3', textKey: 'data.tasks.opt_three', correct: true },
                  { id: 'opt-4', textKey: 'data.tasks.opt_four', correct: false },
                ],
              },
              {
                id: 'jungle-sub-1-t2',
                type: 'multiple_choice',
                questionKey: 'data.tasks.jungle_q_sub_8_3',
                difficulty: 2,
                options: [
                  { id: 'opt-4', textKey: 'data.tasks.opt_four', correct: false },
                  { id: 'opt-5', textKey: 'data.tasks.opt_five', correct: true },
                  { id: 'opt-6', textKey: 'data.tasks.opt_six', correct: false },
                ],
              },
              {
                id: 'jungle-sub-1-t3',
                type: 'input',
                questionKey: 'data.tasks.jungle_q_sub_10_4',
                difficulty: 3,
                answer: '6',
                placeholderKey: 'lesson.answerPlaceholder',
              },
              // Montessori
              // ABA
              { id: 'jungle-sub-1-a1', type: 'multiple_choice', audience: 'special_aba', questionKey: 'data.tasks.aba_jungleSub_q1', difficulty: 2, options: [{ id: 'opt-2', textKey: 'data.tasks.opt_two', correct: false }, { id: 'opt-3', textKey: 'data.tasks.opt_three', correct: true }, { id: 'opt-4', textKey: 'data.tasks.opt_four', correct: false }] },
              { id: 'jungle-sub-1-a2', type: 'multiple_choice', audience: 'special_aba', questionKey: 'data.tasks.aba_jungleSub_q2', difficulty: 2, options: [{ id: 'opt-4', textKey: 'data.tasks.opt_four', correct: false }, { id: 'opt-5', textKey: 'data.tasks.opt_five', correct: true }, { id: 'opt-6', textKey: 'data.tasks.opt_six', correct: false }] },
              // TEACCH
            ],
          },
          {
            id: 'jungle-sub-2',
            topicId: 'jungle-subtraction',
            titleKey: 'data.lessons.jungleSub2',
            reward: { xp: 40 },
            dialog: [
              { speaker: 'tali', textKey: 'data.dialog.jungle_sub_2_0' },
              { speaker: 'npc', textKey: 'data.dialog.jungle_sub_2_1' },
            ],
            tasks: [
              {
                id: 'jungle-sub-2-t1',
                type: 'multiple_choice',
                questionKey: 'data.tasks.jungle_q_sub_9_4',
                difficulty: 3,
                options: [
                  { id: 'opt-4', textKey: 'data.tasks.opt_four', correct: false },
                  { id: 'opt-5', textKey: 'data.tasks.opt_five', correct: true },
                  { id: 'opt-6', textKey: 'data.tasks.opt_six', correct: false },
                ],
              },
              {
                id: 'jungle-sub-2-t2',
                type: 'input',
                questionKey: 'data.tasks.q_missing_number',
                difficulty: 3,
                answer: '6',
                placeholderKey: 'lesson.answerPlaceholder',
              },
            ],
          },
        ],
      },
      {
        id: 'jungle-comparison',
        worldId: 'jungle',
        titleKey: 'data.topics.jungleComparison',
        subject: 'math',
        lessons: [
          {
            id: 'jungle-compare-1',
            topicId: 'jungle-comparison',
            titleKey: 'data.lessons.jungleCompare1',
            reward: { xp: 35, item: 'dino_egg_green' },
            dialog: [
              { speaker: 'tali', textKey: 'data.dialog.jungle_compare_1_0' },
              { speaker: 'npc', textKey: 'data.dialog.jungle_compare_1_1' },
            ],
            intro: [
              { titleKey: 'data.intro.jungleCmp_0_title', bodyKey: 'data.intro.jungleCmp_0_body', emoji: '📌' },
              { titleKey: 'data.intro.jungleCmp_1_title', bodyKey: 'data.intro.jungleCmp_1_body', emoji: '🎯' },
            ],
            tasks: [
              // Standard tasks
              { id: 'jungle-cmp-1-t1', type: 'multiple_choice', questionKey: 'data.tasks.jungle_q_bigger_7_4', difficulty: 2, options: [{ id: 'opt-7', textKey: 'data.tasks.opt_seven', correct: true }, { id: 'opt-4', textKey: 'data.tasks.opt_four', correct: false }] },
              { id: 'jungle-cmp-1-t2', type: 'multiple_choice', questionKey: 'data.tasks.jungle_q_smaller_3_9', difficulty: 2, options: [{ id: 'opt-9', textKey: 'data.tasks.opt_nine', correct: false }, { id: 'opt-3', textKey: 'data.tasks.opt_three', correct: true }] },
              { id: 'jungle-cmp-1-t3', type: 'multiple_choice', questionKey: 'data.tasks.jungle_q_6_gt_5', difficulty: 2, options: [{ id: 'opt-yes', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'opt-no', textKey: 'data.tasks.opt_no', correct: false }] },
              // Montessori
              // ABA
              { id: 'jungle-cmp-1-a1', type: 'multiple_choice', audience: 'special_aba', questionKey: 'data.tasks.aba_jungleCmp_q1', difficulty: 2, options: [{ id: 'opt-7', textKey: 'data.tasks.opt_seven', correct: true }, { id: 'opt-4', textKey: 'data.tasks.opt_four', correct: false }] },
              { id: 'jungle-cmp-1-a2', type: 'multiple_choice', audience: 'special_aba', questionKey: 'data.tasks.aba_jungleCmp_q2', difficulty: 2, options: [{ id: 'opt-9', textKey: 'data.tasks.opt_nine', correct: false }, { id: 'opt-3', textKey: 'data.tasks.opt_three', correct: true }] },
              // TEACCH
            ],
          },
        ],
      },
    ],
  },

  // ---
  {
    id: 'canyon',
    ageBand: '7',
    titleKey: 'data.worlds.canyon',
    descriptionKey: 'data.worldDesc.canyon',
    accentColor: '#FF9800',
    biome: '🏜️',
    npcName: 'Dippy',
    npcEmoji: '🦎',
    topics: [
      {
        id: 'canyon-words',
        worldId: 'canyon',
        titleKey: 'data.topics.canyonWords',
        subject: 'reading',
        lessons: [
          {
            id: 'canyon-words-1',
            topicId: 'canyon-words',
            titleKey: 'data.lessons.canyonWords1',
            reward: { xp: 30, item: 'canyon_gem' },
            dialog: [
              { speaker: 'tali', textKey: 'data.dialog.canyon_words_1_0' },
              { speaker: 'npc', textKey: 'data.dialog.canyon_words_1_1' },
            ],
            intro: [
              { titleKey: 'data.intro.canyonWords_0_title', bodyKey: 'data.intro.canyonWords_0_body', emoji: '📖' },
              { titleKey: 'data.intro.canyonWords_1_title', bodyKey: 'data.intro.canyonWords_1_body', emoji: '📄' },
            ],
            tasks: [
              // Standard tasks
              { id: 'canyon-w1-t1', type: 'multiple_choice', questionKey: 'data.tasks.canyon_q_word_dog', difficulty: 1, options: [{ id: 'opt-dog', textKey: 'data.tasks.opt_dog', correct: true }, { id: 'opt-cat', textKey: 'data.tasks.opt_cat', correct: false }, { id: 'opt-bird', textKey: 'data.tasks.opt_bird', correct: false }] },
              { id: 'canyon-w1-t2', type: 'multiple_choice', questionKey: 'data.tasks.q_read_sun', difficulty: 1, options: [{ id: 'opt-sun', textKey: 'data.tasks.opt_sun', correct: true }, { id: 'opt-moon', textKey: 'data.tasks.opt_moon', correct: false }, { id: 'opt-star', textKey: 'data.tasks.opt_star', correct: false }] },
              { id: 'canyon-w1-t3', type: 'multiple_choice', questionKey: 'data.tasks.canyon_q_word_red', difficulty: 1, options: [{ id: 'opt-blue', textKey: 'data.tasks.opt_blue', correct: false }, { id: 'opt-red', textKey: 'data.tasks.opt_red', correct: true }, { id: 'opt-green', textKey: 'data.tasks.opt_green', correct: false }] },
              // Montessori
              // ABA
              { id: 'canyon-w1-a1', type: 'multiple_choice', audience: 'special_aba', questionKey: 'data.tasks.aba_canyonWords_q1', difficulty: 1, options: [{ id: 'opt-dog', textKey: 'data.tasks.opt_dog', correct: true }, { id: 'opt-cat', textKey: 'data.tasks.opt_cat', correct: false }, { id: 'opt-bird', textKey: 'data.tasks.opt_bird', correct: false }] },
              { id: 'canyon-w1-a2', type: 'multiple_choice', audience: 'special_aba', questionKey: 'data.tasks.aba_canyonWords_q2', difficulty: 1, options: [{ id: 'opt-sun', textKey: 'data.tasks.opt_sun', correct: true }, { id: 'opt-moon', textKey: 'data.tasks.opt_moon', correct: false }, { id: 'opt-star', textKey: 'data.tasks.opt_star', correct: false }] },
              // TEACCH
            ],
          },
          {
            id: 'canyon-words-2',
            topicId: 'canyon-words',
            titleKey: 'data.lessons.canyonWords2',
            reward: { xp: 35 },
            dialog: [
              { speaker: 'tali', textKey: 'data.dialog.canyon_words_2_0' },
              { speaker: 'npc', textKey: 'data.dialog.canyon_words_2_1' },
            ],
            tasks: [
              {
                id: 'canyon-w2-t1',
                type: 'multiple_choice',
                questionKey: 'data.tasks.q_read_cat',
                difficulty: 2,
                options: [
                  { id: 'opt-cat', textKey: 'data.tasks.opt_cat', correct: true },
                  { id: 'opt-dog', textKey: 'data.tasks.opt_dog', correct: false },
                  { id: 'opt-sun', textKey: 'data.tasks.opt_sun', correct: false },
                ],
              },
              {
                id: 'canyon-w2-t2',
                type: 'multiple_choice',
                questionKey: 'data.tasks.canyon_q_color_grass',
                difficulty: 2,
                options: [
                  { id: 'opt-blue', textKey: 'data.tasks.opt_blue', correct: false },
                  { id: 'opt-red', textKey: 'data.tasks.opt_red', correct: false },
                  { id: 'opt-green', textKey: 'data.tasks.opt_green', correct: true },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'canyon-sentences',
        worldId: 'canyon',
        titleKey: 'data.topics.canyonSentences',
        subject: 'reading',
        lessons: [
          {
            id: 'canyon-sent-1',
            topicId: 'canyon-sentences',
            titleKey: 'data.lessons.canyonSent1',
            reward: { xp: 40, item: 'artifact_map' },
            dialog: [
              { speaker: 'tali', textKey: 'data.dialog.canyon_sent_1_0' },
              { speaker: 'npc', textKey: 'data.dialog.canyon_sent_1_1' },
            ],
            intro: [
              { titleKey: 'data.intro.canyonSent_0_title', bodyKey: 'data.intro.canyonSent_0_body', emoji: '📖' },
              { titleKey: 'data.intro.canyonSent_1_title', bodyKey: 'data.intro.canyonSent_1_body', emoji: '📎' },
            ],
            tasks: [
              {
                id: 'canyon-s1-t1',
                type: 'multiple_choice',
                questionKey: 'data.tasks.q_story_character',
                difficulty: 2,
                options: [
                  { id: 'opt-mira', textKey: 'data.tasks.opt_mira', correct: true },
                  { id: 'opt-kite', textKey: 'data.tasks.opt_kite', correct: false },
                  { id: 'opt-dog', textKey: 'data.tasks.opt_dog', correct: false },
                ],
              },
              { id: 'canyon-s1-t2', type: 'multiple_choice', questionKey: 'data.tasks.q_match_picture', difficulty: 2, options: [{ id: 'opt-dog', textKey: 'data.tasks.opt_dog', correct: true }, { id: 'opt-cat', textKey: 'data.tasks.opt_cat', correct: false }, { id: 'opt-sun', textKey: 'data.tasks.opt_sun', correct: false }] },
              { id: 'canyon-s1-t3', type: 'multiple_choice', questionKey: 'data.tasks.canyon_q_sentence_big_dog', difficulty: 2, options: [{ id: 'opt-yes', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'opt-no', textKey: 'data.tasks.opt_no', correct: false }] },
              // Montessori
              // ABA
              { id: 'canyon-s1-a1', type: 'multiple_choice', audience: 'special_aba', questionKey: 'data.tasks.aba_canyonSent_q1', difficulty: 2, options: [{ id: 'opt-mira', textKey: 'data.tasks.opt_mira', correct: true }, { id: 'opt-kite', textKey: 'data.tasks.opt_kite', correct: false }, { id: 'opt-dog', textKey: 'data.tasks.opt_dog', correct: false }] },
              { id: 'canyon-s1-a2', type: 'multiple_choice', audience: 'special_aba', questionKey: 'data.tasks.aba_canyonSent_q2', difficulty: 2, options: [{ id: 'opt-dog', textKey: 'data.tasks.opt_dog', correct: true }, { id: 'opt-cat', textKey: 'data.tasks.opt_cat', correct: false }, { id: 'opt-sun', textKey: 'data.tasks.opt_sun', correct: false }] },
              // TEACCH
            ],
          },
        ],
      },
    ],
  },

  // ---
  {
    id: 'lab',
    ageBand: '7',
    isPremium: true,
    titleKey: 'data.worlds.lab',
    descriptionKey: 'data.worldDesc.lab',
    accentColor: '#9C27B0',
    biome: '🧪',
    npcName: 'Spike',
    npcEmoji: '🦎',
    topics: [
      {
        id: 'lab-animals',
        worldId: 'lab',
        titleKey: 'data.topics.labAnimals',
        subject: 'logic',
        lessons: [
          {
            id: 'lab-animals-1',
            topicId: 'lab-animals',
            titleKey: 'data.lessons.labAnimals1',
            reward: { xp: 35, item: 'spike_crystal' },
            dialog: [
              { speaker: 'tali', textKey: 'data.dialog.lab_animals_1_0' },
              { speaker: 'npc', textKey: 'data.dialog.lab_animals_1_1' },
            ],
            intro: [
              { titleKey: 'data.intro.labAnimals_0_title', bodyKey: 'data.intro.labAnimals_0_body', emoji: '🦎' },
              { titleKey: 'data.intro.labAnimals_1_title', bodyKey: 'data.intro.labAnimals_1_body', emoji: '📬' },
            ],
            tasks: [
              {
                id: 'lab-an-1-t1',
                type: 'multiple_choice',
                questionKey: 'data.tasks.lab_q_water_animal',
                difficulty: 2,
                options: [
                  { id: 'opt-fish', textKey: 'data.tasks.opt_fish', correct: true },
                  { id: 'opt-cat', textKey: 'data.tasks.opt_cat', correct: false },
                  { id: 'opt-bird', textKey: 'data.tasks.opt_bird', correct: false },
                ],
              },
              {
                id: 'lab-an-1-t2',
                type: 'multiple_choice',
                questionKey: 'data.tasks.lab_q_fly_animal',
                difficulty: 2,
                options: [
                  { id: 'opt-dog', textKey: 'data.tasks.opt_dog', correct: false },
                  { id: 'opt-fish', textKey: 'data.tasks.opt_fish', correct: false },
                  { id: 'opt-bird', textKey: 'data.tasks.opt_bird', correct: true },
                ],
              },
              {
                id: 'lab-an-1-t3',
                type: 'multiple_choice',
                questionKey: 'data.tasks.lab_q_cat_legs',
                difficulty: 2,
                options: [
                  { id: 'opt-2', textKey: 'data.tasks.opt_two', correct: false },
                  { id: 'opt-4', textKey: 'data.tasks.opt_four', correct: true },
                  { id: 'opt-6', textKey: 'data.tasks.opt_six', correct: false },
                ],
              },
              // Montessori
              // ABA
              { id: 'lab-an-1-a1', type: 'multiple_choice', audience: 'special_aba', questionKey: 'data.tasks.aba_labAnimals_q1', difficulty: 2, options: [{ id: 'opt-fish', textKey: 'data.tasks.opt_fish', correct: true }, { id: 'opt-cat', textKey: 'data.tasks.opt_cat', correct: false }, { id: 'opt-bird', textKey: 'data.tasks.opt_bird', correct: false }] },
              { id: 'lab-an-1-a2', type: 'multiple_choice', audience: 'special_aba', questionKey: 'data.tasks.aba_labAnimals_q2', difficulty: 2, options: [{ id: 'opt-dog', textKey: 'data.tasks.opt_dog', correct: false }, { id: 'opt-fish', textKey: 'data.tasks.opt_fish', correct: false }, { id: 'opt-bird', textKey: 'data.tasks.opt_bird', correct: true }] },
              // TEACCH
            ],
          },
          {
            id: 'lab-animals-2',
            topicId: 'lab-animals',
            titleKey: 'data.lessons.labAnimals2',
            reward: { xp: 35, item: 'dino_egg_red' },
            dialog: [
              { speaker: 'tali', textKey: 'data.dialog.lab_animals_2_0' },
              { speaker: 'npc', textKey: 'data.dialog.lab_animals_2_1' },
            ],
            tasks: [
              {
                id: 'lab-an-2-t1',
                type: 'multiple_choice',
                questionKey: 'data.tasks.lab_q_biggest_animal',
                difficulty: 3,
                options: [
                  { id: 'opt-cat', textKey: 'data.tasks.opt_cat', correct: false },
                  { id: 'opt-elephant', textKey: 'data.tasks.opt_elephant', correct: true },
                  { id: 'opt-bird', textKey: 'data.tasks.opt_bird', correct: false },
                ],
              },
              {
                id: 'lab-an-2-t2',
                type: 'multiple_choice',
                questionKey: 'data.tasks.lab_q_logic_pattern',
                difficulty: 2,
                options: [
                  { id: 'opt-circle', textKey: 'data.tasks.opt_circle', correct: true },
                  { id: 'opt-square', textKey: 'data.tasks.opt_square', correct: false },
                  { id: 'opt-triangle', textKey: 'data.tasks.opt_triangle', correct: false },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'lab-physics',
        worldId: 'lab',
        titleKey: 'data.topics.labPhysics',
        subject: 'logic',
        lessons: [
          {
            id: 'lab-physics-1',
            topicId: 'lab-physics',
            titleKey: 'data.lessons.labPhysics1',
            reward: { xp: 45, item: 'dino_egg_blue' },
            dialog: [
              { speaker: 'tali', textKey: 'data.dialog.lab_physics_1_0' },
              { speaker: 'npc', textKey: 'data.dialog.lab_physics_1_1' },
            ],
            intro: [
              { titleKey: 'data.intro.labPhysics_0_title', bodyKey: 'data.intro.labPhysics_0_body', emoji: '🧪' },
              { titleKey: 'data.intro.labPhysics_1_title', bodyKey: 'data.intro.labPhysics_1_body', emoji: '🧪' },
            ],
            tasks: [
              {
                id: 'lab-ph-1-t1',
                type: 'multiple_choice',
                questionKey: 'data.tasks.q_balance_scale',
                difficulty: 3,
                options: [
                  { id: 'opt-add-weight', textKey: 'data.tasks.opt_add_weight', correct: true },
                  { id: 'opt-remove-weight', textKey: 'data.tasks.opt_remove_weight', correct: false },
                ],
              },
              {
                id: 'lab-ph-1-t2',
                type: 'multiple_choice',
                questionKey: 'data.tasks.lab_q_triangle_sides',
                difficulty: 2,
                options: [
                  { id: 'opt-2', textKey: 'data.tasks.opt_two', correct: false },
                  { id: 'opt-3', textKey: 'data.tasks.opt_three', correct: true },
                  { id: 'opt-4', textKey: 'data.tasks.opt_four', correct: false },
                ],
              },
              { id: 'lab-ph-1-t3', type: 'multiple_choice', questionKey: 'data.tasks.q_logic_pattern_shapes', difficulty: 3, options: [{ id: 'opt-circle', textKey: 'data.tasks.opt_circle', correct: true }, { id: 'opt-square', textKey: 'data.tasks.opt_square', correct: false }, { id: 'opt-triangle', textKey: 'data.tasks.opt_triangle', correct: false }] },
              // Montessori
              // ABA
              { id: 'lab-ph-1-a1', type: 'multiple_choice', audience: 'special_aba', questionKey: 'data.tasks.aba_labPhysics_q1', difficulty: 2, options: [{ id: 'opt-2', textKey: 'data.tasks.opt_two', correct: false }, { id: 'opt-3', textKey: 'data.tasks.opt_three', correct: true }, { id: 'opt-4', textKey: 'data.tasks.opt_four', correct: false }] },
              { id: 'lab-ph-1-a2', type: 'multiple_choice', audience: 'special_aba', questionKey: 'data.tasks.aba_labPhysics_q2', difficulty: 2, options: [{ id: 'opt-circle', textKey: 'data.tasks.opt_circle', correct: true }, { id: 'opt-square', textKey: 'data.tasks.opt_square', correct: false }, { id: 'opt-triangle', textKey: 'data.tasks.opt_triangle', correct: false }] },
              // TEACCH
            ],
          },
        ],
      },
    ],
  },

  // ---
  {
    id: 'space',
    ageBand: '7',
    isPremium: true,
    titleKey: 'data.worlds.space',
    descriptionKey: 'data.worldDesc.space',
    accentColor: '#3F51B5',
    biome: '🌌',
    npcName: 'Stela',
    npcEmoji: '🦕',
    topics: [
      {
        id: 'space-planets',
        worldId: 'space',
        titleKey: 'data.topics.spacePlanets',
        subject: 'logic',
        lessons: [
          {
            id: 'space-planets-1',
            topicId: 'space-planets',
            titleKey: 'data.lessons.spacePlanets1',
            reward: { xp: 45, item: 'star_fragment' },
            dialog: [
              { speaker: 'tali', textKey: 'data.dialog.space_planets_1_0' },
              { speaker: 'npc', textKey: 'data.dialog.space_planets_1_1' },
            ],
            intro: [
              { titleKey: 'data.intro.spacePlanets_0_title', bodyKey: 'data.intro.spacePlanets_0_body', emoji: '🌍' },
              { titleKey: 'data.intro.spacePlanets_1_title', bodyKey: 'data.intro.spacePlanets_1_body', emoji: '🌌' },
            ],
            tasks: [
              {
                id: 'space-pl-1-t1',
                type: 'multiple_choice',
                questionKey: 'data.tasks.space_q_our_planet',
                difficulty: 2,
                options: [
                  { id: 'opt-mars', textKey: 'data.tasks.opt_mars', correct: false },
                  { id: 'opt-earth', textKey: 'data.tasks.opt_earth', correct: true },
                  { id: 'opt-jupiter', textKey: 'data.tasks.opt_jupiter', correct: false },
                ],
              },
              {
                id: 'space-pl-1-t2',
                type: 'multiple_choice',
                questionKey: 'data.tasks.space_q_solar_center',
                difficulty: 2,
                options: [
                  { id: 'opt-moon', textKey: 'data.tasks.opt_moon', correct: false },
                  { id: 'opt-sun', textKey: 'data.tasks.opt_sun', correct: true },
                  { id: 'opt-earth', textKey: 'data.tasks.opt_earth', correct: false },
                ],
              },
              { id: 'space-pl-1-t3', type: 'multiple_choice', questionKey: 'data.tasks.space_q_planet_count', difficulty: 3, options: [{ id: 'opt-7', textKey: 'data.tasks.opt_seven', correct: false }, { id: 'opt-8', textKey: 'data.tasks.opt_eight', correct: true }, { id: 'opt-9', textKey: 'data.tasks.opt_nine', correct: false }] },
              // Montessori
              // ABA
              { id: 'space-pl-1-a1', type: 'multiple_choice', audience: 'special_aba', questionKey: 'data.tasks.aba_spacePlanets_q1', difficulty: 2, options: [{ id: 'opt-mars', textKey: 'data.tasks.opt_mars', correct: false }, { id: 'opt-earth', textKey: 'data.tasks.opt_earth', correct: true }, { id: 'opt-jupiter', textKey: 'data.tasks.opt_jupiter', correct: false }] },
              { id: 'space-pl-1-a2', type: 'multiple_choice', audience: 'special_aba', questionKey: 'data.tasks.aba_spacePlanets_q2', difficulty: 2, options: [{ id: 'opt-moon', textKey: 'data.tasks.opt_moon', correct: false }, { id: 'opt-sun', textKey: 'data.tasks.opt_sun', correct: true }, { id: 'opt-earth', textKey: 'data.tasks.opt_earth', correct: false }] },
              // TEACCH
            ],
          },
          {
            id: 'space-planets-2',
            topicId: 'space-planets',
            titleKey: 'data.lessons.spacePlanets2',
            reward: { xp: 50 },
            dialog: [
              { speaker: 'tali', textKey: 'data.dialog.space_planets_2_0' },
              { speaker: 'npc', textKey: 'data.dialog.space_planets_2_1' },
            ],
            tasks: [
              {
                id: 'space-pl-2-t1',
                type: 'multiple_choice',
                questionKey: 'data.tasks.space_q_closest_sun',
                difficulty: 3,
                options: [
                  { id: 'opt-earth', textKey: 'data.tasks.opt_earth', correct: false },
                  { id: 'opt-mercury', textKey: 'data.tasks.opt_mercury', correct: true },
                  { id: 'opt-mars', textKey: 'data.tasks.opt_mars', correct: false },
                ],
              },
              {
                id: 'space-pl-2-t2',
                type: 'multiple_choice',
                questionKey: 'data.tasks.space_q_largest_planet',
                difficulty: 3,
                options: [
                  { id: 'opt-earth', textKey: 'data.tasks.opt_earth', correct: false },
                  { id: 'opt-saturn', textKey: 'data.tasks.opt_saturn', correct: false },
                  { id: 'opt-jupiter', textKey: 'data.tasks.opt_jupiter', correct: true },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'space-solar',
        worldId: 'space',
        titleKey: 'data.topics.spaceSolar',
        subject: 'logic',
        lessons: [
          {
            id: 'space-solar-1',
            topicId: 'space-solar',
            titleKey: 'data.lessons.spaceSolar1',
            reward: { xp: 55, item: 'artifact_map' },
            dialog: [
              { speaker: 'tali', textKey: 'data.dialog.space_solar_1_0' },
              { speaker: 'npc', textKey: 'data.dialog.space_solar_1_1' },
            ],
            intro: [
              { titleKey: 'data.intro.spaceSolar_0_title', bodyKey: 'data.intro.spaceSolar_0_body', emoji: '✏️' },
              { titleKey: 'data.intro.spaceSolar_1_title', bodyKey: 'data.intro.spaceSolar_1_body', emoji: '🪐' },
            ],
            tasks: [
              {
                id: 'space-sol-1-t1',
                type: 'multiple_choice',
                questionKey: 'data.tasks.space_q_moon_orbits',
                difficulty: 3,
                options: [
                  { id: 'opt-sun', textKey: 'data.tasks.opt_sun', correct: false },
                  { id: 'opt-earth', textKey: 'data.tasks.opt_earth', correct: true },
                  { id: 'opt-mars', textKey: 'data.tasks.opt_mars', correct: false },
                ],
              },
              {
                id: 'space-sol-1-t2',
                type: 'multiple_choice',
                questionKey: 'data.tasks.space_q_day_cause',
                difficulty: 3,
                options: [
                  { id: 'opt-moon', textKey: 'data.tasks.opt_moon', correct: false },
                  { id: 'opt-rotation', textKey: 'data.tasks.opt_rotation', correct: true },
                  { id: 'opt-stars', textKey: 'data.tasks.opt_stars', correct: false },
                ],
              },
              { id: 'space-sol-1-t3', type: 'input', questionKey: 'data.tasks.space_q_orbit_word', difficulty: 4, answer: 'orbit', placeholderKey: 'lesson.answerPlaceholder' },
              // Montessori
              // ABA
              { id: 'space-sol-1-a1', type: 'multiple_choice', audience: 'special_aba', questionKey: 'data.tasks.aba_spaceSolar_q1', difficulty: 2, options: [{ id: 'opt-7', textKey: 'data.tasks.opt_seven', correct: false }, { id: 'opt-8', textKey: 'data.tasks.opt_eight', correct: true }, { id: 'opt-9', textKey: 'data.tasks.opt_nine', correct: false }] },
              { id: 'space-sol-1-a2', type: 'multiple_choice', audience: 'special_aba', questionKey: 'data.tasks.aba_spaceSolar_q2', difficulty: 2, options: [{ id: 'opt-earth', textKey: 'data.tasks.opt_earth', correct: false }, { id: 'opt-mercury', textKey: 'data.tasks.opt_mercury', correct: true }, { id: 'opt-mars', textKey: 'data.tasks.opt_mars', correct: false }] },
              // TEACCH
            ],
          },
        ],
      },
    ],
  },

  // РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’
  // ---
  // РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’РІвЂўС’

  // ---
  {
    id: 'meadow',
    ageBand: '5-6',
    titleKey: 'data.worlds.meadow',
    descriptionKey: 'data.worldDesc.meadow',
    accentColor: '#FF7043',
    biome: '🌾',
    npcName: 'Зайка Зоя',
    npcEmoji: '🐰',
    topics: [
      // ---
      {
        id: 'meadow-count5',
        worldId: 'meadow',
        titleKey: 'data.topics.meadowCount5',
        subject: 'math',
        lessons: [
          {
            id: 'meadow-c5-l1',
            topicId: 'meadow-count5',
            titleKey: 'data.lessons.meadowC5L1',
            reward: { xp: 20 },
            dialog: [
              { speaker: 'npc', textKey: 'data.dialog.meadow_c5l1_0' },
              { speaker: 'tali', textKey: 'data.dialog.meadow_c5l1_1' },
            ],
            intro: [
              { titleKey: 'data.intro.meadow_c5l1_0_t', bodyKey: 'data.intro.meadow_c5l1_0_b', emoji: '🌜' },
              { titleKey: 'data.intro.meadow_c5l1_1_t', bodyKey: 'data.intro.meadow_c5l1_1_b', emoji: '✏️' },
            ],
            tasks: [
              { id: 'mc5l1-t1', type: 'multiple_choice', questionKey: 'data.tasks.pre_count_1apple', difficulty: 1, visualCount: 1, visualEmoji: '🍎', options: [{ id: 'a', textKey: 'data.tasks.opt_one', correct: true }, { id: 'b', textKey: 'data.tasks.opt_two', correct: false }, { id: 'c', textKey: 'data.tasks.opt_three', correct: false }] },
              { id: 'mc5l1-t2', type: 'multiple_choice', questionKey: 'data.tasks.pre_count_2stars', difficulty: 1, visualCount: 2, visualEmoji: '⭐', options: [{ id: 'a', textKey: 'data.tasks.opt_one', correct: false }, { id: 'b', textKey: 'data.tasks.opt_two', correct: true }, { id: 'c', textKey: 'data.tasks.opt_three', correct: false }] },
              { id: 'mc5l1-t3', type: 'multiple_choice', questionKey: 'data.tasks.pre_count_3flowers', difficulty: 1, visualCount: 3, visualEmoji: '🌸', options: [{ id: 'a', textKey: 'data.tasks.opt_two', correct: false }, { id: 'b', textKey: 'data.tasks.opt_three', correct: true }, { id: 'c', textKey: 'data.tasks.opt_four', correct: false }] },
              { id: 'mc5l1-t4', type: 'multiple_choice', questionKey: 'data.tasks.pre_after2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_one', correct: false }, { id: 'b', textKey: 'data.tasks.opt_three', correct: true }, { id: 'c', textKey: 'data.tasks.opt_four', correct: false }] },
            ],
          },
          {
            id: 'meadow-c5-l2',
            topicId: 'meadow-count5',
            titleKey: 'data.lessons.meadowC5L2',
            reward: { xp: 20 },
            dialog: [
              { speaker: 'npc', textKey: 'data.dialog.meadow_c5l2_0' },
              { speaker: 'tali', textKey: 'data.dialog.meadow_c5l2_1' },
            ],
            intro: [
              { titleKey: 'data.intro.meadow_c5l2_0_t', bodyKey: 'data.intro.meadow_c5l2_0_b', emoji: '🥕' },
              { titleKey: 'data.intro.meadow_c5l2_1_t', bodyKey: 'data.intro.meadow_c5l2_1_b', emoji: '🐣' },
            ],
            tasks: [
              { id: 'mc5l2-t1', type: 'multiple_choice', questionKey: 'data.tasks.pre_count_4carrots', difficulty: 1, visualCount: 4, visualEmoji: '🥕', options: [{ id: 'a', textKey: 'data.tasks.opt_three', correct: false }, { id: 'b', textKey: 'data.tasks.opt_four', correct: true }, { id: 'c', textKey: 'data.tasks.opt_five', correct: false }] },
              { id: 'mc5l2-t2', type: 'multiple_choice', questionKey: 'data.tasks.pre_count_5butterflies', difficulty: 1, visualCount: 5, visualEmoji: '🦋', options: [{ id: 'a', textKey: 'data.tasks.opt_four', correct: false }, { id: 'b', textKey: 'data.tasks.opt_five', correct: true }, { id: 'c', textKey: 'data.tasks.opt_six', correct: false }] },
              { id: 'mc5l2-t3', type: 'multiple_choice', questionKey: 'data.tasks.pre_after4', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_three', correct: false }, { id: 'b', textKey: 'data.tasks.opt_five', correct: true }, { id: 'c', textKey: 'data.tasks.opt_six', correct: false }] },
              { id: 'mc5l2-t4', type: 'multiple_choice', questionKey: 'data.tasks.pre_fingers_one_hand', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_four', correct: false }, { id: 'b', textKey: 'data.tasks.opt_five', correct: true }, { id: 'c', textKey: 'data.tasks.opt_six', correct: false }] },
            ],
          },
          {
            id: 'meadow-c5-l3',
            topicId: 'meadow-count5',
            titleKey: 'data.lessons.meadowC5L3',
            reward: { xp: 25, item: 'banana_badge' },
            dialog: [
              { speaker: 'tali', textKey: 'data.dialog.meadow_c5l3_0' },
              { speaker: 'npc', textKey: 'data.dialog.meadow_c5l3_1' },
            ],
            intro: [
              { titleKey: 'data.intro.meadow_c5l3_0_t', bodyKey: 'data.intro.meadow_c5l3_0_b', emoji: '🧪' },
              { titleKey: 'data.intro.meadow_c5l3_1_t', bodyKey: 'data.intro.meadow_c5l3_1_b', emoji: '⭐' },
            ],
            tasks: [
              { id: 'mc5l3-t1', type: 'multiple_choice', questionKey: 'data.tasks.pre_more_2or4', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_two', correct: false }, { id: 'b', textKey: 'data.tasks.opt_four', correct: true }] },
              { id: 'mc5l3-t2', type: 'multiple_choice', questionKey: 'data.tasks.pre_less_5or3', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_five', correct: false }, { id: 'b', textKey: 'data.tasks.opt_three', correct: true }] },
              { id: 'mc5l3-t3', type: 'multiple_choice', questionKey: 'data.tasks.pre_more_3or1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_zoya', correct: true }, { id: 'b', textKey: 'data.tasks.pre_opt_squirrel', correct: false }] },
              { id: 'mc5l3-t4', type: 'input', questionKey: 'data.tasks.pre_order_first', difficulty: 2, answer: '1', skippable: true },
            ],
          },
        ],
      },
      // ---
      {
        id: 'meadow-count10',
        worldId: 'meadow',
        titleKey: 'data.topics.meadowCount10',
        subject: 'math',
        lessons: [
          {
            id: 'meadow-c10-l1',
            topicId: 'meadow-count10',
            titleKey: 'data.lessons.meadowC10L1',
            reward: { xp: 25 },
            dialog: [
              { speaker: 'npc', textKey: 'data.dialog.meadow_c10l1_0' },
              { speaker: 'tali', textKey: 'data.dialog.meadow_c10l1_1' },
            ],
            intro: [
              { titleKey: 'data.intro.meadow_c10l1_0_t', bodyKey: 'data.intro.meadow_c10l1_0_b', emoji: '6️⃣' },
              { titleKey: 'data.intro.meadow_c10l1_1_t', bodyKey: 'data.intro.meadow_c10l1_1_b', emoji: '7️⃣' },
            ],
            tasks: [
              { id: 'mc10l1-t1', type: 'multiple_choice', questionKey: 'data.tasks.pre_count_6berries', difficulty: 1, visualCount: 6, visualEmoji: '🍒', options: [{ id: 'a', textKey: 'data.tasks.opt_five', correct: false }, { id: 'b', textKey: 'data.tasks.opt_six', correct: true }, { id: 'c', textKey: 'data.tasks.opt_seven', correct: false }] },
              { id: 'mc10l1-t2', type: 'multiple_choice', questionKey: 'data.tasks.pre_count_7chicks', difficulty: 1, visualCount: 7, visualEmoji: '🐥', options: [{ id: 'a', textKey: 'data.tasks.opt_six', correct: false }, { id: 'b', textKey: 'data.tasks.opt_seven', correct: true }, { id: 'c', textKey: 'data.tasks.opt_eight', correct: false }] },
              { id: 'mc10l1-t3', type: 'multiple_choice', questionKey: 'data.tasks.pre_after6', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_five', correct: false }, { id: 'b', textKey: 'data.tasks.opt_seven', correct: true }, { id: 'c', textKey: 'data.tasks.opt_eight', correct: false }] },
              { id: 'mc10l1-t4', type: 'multiple_choice', questionKey: 'data.tasks.pre_5plus1', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_five', correct: false }, { id: 'b', textKey: 'data.tasks.opt_six', correct: true }, { id: 'c', textKey: 'data.tasks.opt_seven', correct: false }] },
            ],
          },
          {
            id: 'meadow-c10-l2',
            topicId: 'meadow-count10',
            titleKey: 'data.lessons.meadowC10L2',
            reward: { xp: 25 },
            dialog: [
              { speaker: 'npc', textKey: 'data.dialog.meadow_c10l2_0' },
              { speaker: 'tali', textKey: 'data.dialog.meadow_c10l2_1' },
            ],
            intro: [
              { titleKey: 'data.intro.meadow_c10l2_0_t', bodyKey: 'data.intro.meadow_c10l2_0_b', emoji: '8️⃣' },
              { titleKey: 'data.intro.meadow_c10l2_1_t', bodyKey: 'data.intro.meadow_c10l2_1_b', emoji: '8️⃣' },
            ],
            tasks: [
              { id: 'mc10l2-t1', type: 'multiple_choice', questionKey: 'data.tasks.pre_count_8fish', difficulty: 1, visualCount: 8, visualEmoji: '🐘 ', options: [{ id: 'a', textKey: 'data.tasks.opt_seven', correct: false }, { id: 'b', textKey: 'data.tasks.opt_eight', correct: true }, { id: 'c', textKey: 'data.tasks.opt_nine', correct: false }] },
              { id: 'mc10l2-t2', type: 'multiple_choice', questionKey: 'data.tasks.pre_count_9stars', difficulty: 1, visualCount: 9, visualEmoji: '⭐', options: [{ id: 'a', textKey: 'data.tasks.opt_eight', correct: false }, { id: 'b', textKey: 'data.tasks.opt_nine', correct: true }, { id: 'c', textKey: 'data.tasks.opt_ten', correct: false }] },
              { id: 'mc10l2-t3', type: 'multiple_choice', questionKey: 'data.tasks.pre_biggest_to10', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_eight', correct: false }, { id: 'b', textKey: 'data.tasks.opt_nine', correct: false }, { id: 'c', textKey: 'data.tasks.opt_ten', correct: true }] },
              { id: 'mc10l2-t4', type: 'multiple_choice', questionKey: 'data.tasks.pre_9plus1', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_nine', correct: false }, { id: 'b', textKey: 'data.tasks.opt_ten', correct: true }, { id: 'c', textKey: 'data.tasks.opt_eleven', correct: false }] },
            ],
          },
          {
            id: 'meadow-c10-l3',
            topicId: 'meadow-count10',
            titleKey: 'data.lessons.meadowC10L3',
            reward: { xp: 30 },
            dialog: [
              { speaker: 'tali', textKey: 'data.dialog.meadow_c10l3_0' },
              { speaker: 'npc', textKey: 'data.dialog.meadow_c10l3_1' },
            ],
            intro: [
              { titleKey: 'data.intro.meadow_c10l3_0_t', bodyKey: 'data.intro.meadow_c10l3_0_b', emoji: '🔟' },
              { titleKey: 'data.intro.meadow_c10l3_1_t', bodyKey: 'data.intro.meadow_c10l3_1_b', emoji: '⭐' },
            ],
            tasks: [
              { id: 'mc10l3-t1', type: 'multiple_choice', questionKey: 'data.tasks.pre_more_7or3', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_seven', correct: true }, { id: 'b', textKey: 'data.tasks.opt_three', correct: false }] },
              { id: 'mc10l3-t2', type: 'multiple_choice', questionKey: 'data.tasks.pre_less_6or9', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_six', correct: true }, { id: 'b', textKey: 'data.tasks.opt_nine', correct: false }] },
              { id: 'mc10l3-t3', type: 'multiple_choice', questionKey: 'data.tasks.pre_between_7_9', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_six', correct: false }, { id: 'b', textKey: 'data.tasks.opt_eight', correct: true }, { id: 'c', textKey: 'data.tasks.opt_ten', correct: false }] },
              { id: 'mc10l3-t4', type: 'multiple_choice', questionKey: 'data.tasks.pre_pattern_10864', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_four', correct: true }, { id: 'b', textKey: 'data.tasks.opt_five', correct: false }, { id: 'c', textKey: 'data.tasks.opt_seven', correct: false }] },
            ],
          },
        ],
      },
      // ---
      {
        id: 'meadow-shapes',
        worldId: 'meadow',
        titleKey: 'data.topics.meadowShapes',
        subject: 'math',
        lessons: [
          {
            id: 'meadow-sh-l1',
            topicId: 'meadow-shapes',
            titleKey: 'data.lessons.meadowShL1',
            reward: { xp: 25 },
            dialog: [
              { speaker: 'npc', textKey: 'data.dialog.meadow_shl1_0' },
              { speaker: 'tali', textKey: 'data.dialog.meadow_shl1_1' },
            ],
            intro: [
              { titleKey: 'data.intro.meadow_shl1_0_t', bodyKey: 'data.intro.meadow_shl1_0_b', emoji: '🔵' },
              { titleKey: 'data.intro.meadow_shl1_1_t', bodyKey: 'data.intro.meadow_shl1_1_b', emoji: '⬜' },
            ],
            tasks: [
              { id: 'mshl1-t1', type: 'multiple_choice', questionKey: 'data.tasks.pre_shape_circle_q', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_circle', correct: true }, { id: 'b', textKey: 'data.tasks.opt_square', correct: false }, { id: 'c', textKey: 'data.tasks.opt_triangle', correct: false }] },
              { id: 'mshl1-t2', type: 'multiple_choice', questionKey: 'data.tasks.pre_square_corners', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_zero', correct: false }, { id: 'b', textKey: 'data.tasks.opt_four', correct: true }, { id: 'c', textKey: 'data.tasks.opt_three', correct: false }] },
              { id: 'mshl1-t3', type: 'multiple_choice', questionKey: 'data.tasks.pre_circle_like', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_book', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_ball', correct: true }, { id: 'c', textKey: 'data.tasks.pre_opt_brick', correct: false }] },
              { id: 'mshl1-t4', type: 'multiple_choice', questionKey: 'data.tasks.pre_circle_no_corners', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: false }, { id: 'b', textKey: 'data.tasks.opt_no', correct: true }] },
            ],
          },
          {
            id: 'meadow-sh-l2',
            topicId: 'meadow-shapes',
            titleKey: 'data.lessons.meadowShL2',
            reward: { xp: 25 },
            dialog: [
              { speaker: 'tali', textKey: 'data.dialog.meadow_shl2_0' },
              { speaker: 'npc', textKey: 'data.dialog.meadow_shl2_1' },
            ],
            intro: [
              { titleKey: 'data.intro.meadow_shl2_0_t', bodyKey: 'data.intro.meadow_shl2_0_b', emoji: '🔺' },
              { titleKey: 'data.intro.meadow_shl2_1_t', bodyKey: 'data.intro.meadow_shl2_1_b', emoji: '✏️' },
            ],
            tasks: [
              { id: 'mshl2-t1', type: 'multiple_choice', questionKey: 'data.tasks.pre_shape_3corners', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_circle', correct: false }, { id: 'b', textKey: 'data.tasks.opt_triangle', correct: true }, { id: 'c', textKey: 'data.tasks.opt_square', correct: false }] },
              { id: 'mshl2-t2', type: 'multiple_choice', questionKey: 'data.tasks.pre_triangle_sides', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_two', correct: false }, { id: 'b', textKey: 'data.tasks.opt_three', correct: true }, { id: 'c', textKey: 'data.tasks.opt_four', correct: false }] },
              { id: 'mshl2-t3', type: 'multiple_choice', questionKey: 'data.tasks.pre_rect_like', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_ball', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_book', correct: true }, { id: 'c', textKey: 'data.tasks.pre_opt_coin', correct: false }] },
              { id: 'mshl2-t4', type: 'multiple_choice', questionKey: 'data.tasks.pre_rect_corners', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_two', correct: false }, { id: 'b', textKey: 'data.tasks.opt_three', correct: false }, { id: 'c', textKey: 'data.tasks.opt_four', correct: true }] },
            ],
          },
          {
            id: 'meadow-sh-l3',
            topicId: 'meadow-shapes',
            titleKey: 'data.lessons.meadowShL3',
            reward: { xp: 30 },
            dialog: [
              { speaker: 'npc', textKey: 'data.dialog.meadow_shl3_0' },
              { speaker: 'tali', textKey: 'data.dialog.meadow_shl3_1' },
            ],
            intro: [
              { titleKey: 'data.intro.meadow_shl3_0_t', bodyKey: 'data.intro.meadow_shl3_0_b', emoji: '🔷' },
              { titleKey: 'data.intro.meadow_shl3_1_t', bodyKey: 'data.intro.meadow_shl3_1_b', emoji: '🌾' },
            ],
            tasks: [
              { id: 'mshl3-t1', type: 'multiple_choice', questionKey: 'data.tasks.pre_no_corners_shape', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_square', correct: false }, { id: 'b', textKey: 'data.tasks.opt_triangle', correct: false }, { id: 'c', textKey: 'data.tasks.opt_circle', correct: true }] },
              { id: 'mshl3-t2', type: 'multiple_choice', questionKey: 'data.tasks.pre_sq_tri_sides_total', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_five', correct: false }, { id: 'b', textKey: 'data.tasks.opt_six', correct: false }, { id: 'c', textKey: 'data.tasks.opt_seven', correct: true }] },
              { id: 'mshl3-t3', type: 'multiple_choice', questionKey: 'data.tasks.pre_sun_like', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_square', correct: false }, { id: 'b', textKey: 'data.tasks.opt_circle', correct: true }, { id: 'c', textKey: 'data.tasks.opt_triangle', correct: false }] },
              { id: 'mshl3-t4', type: 'multiple_choice', questionKey: 'data.tasks.pre_roof_like', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_circle', correct: false }, { id: 'b', textKey: 'data.tasks.opt_square', correct: false }, { id: 'c', textKey: 'data.tasks.opt_triangle', correct: true }] },
            ],
          },
        ],
      },
    ],
  },

  // ---
  {
    id: 'forest',
    ageBand: '5-6',
    titleKey: 'data.worlds.forest',
    descriptionKey: 'data.worldDesc.forest',
    accentColor: '#66BB6A',
    biome: '🌲',
    npcName: 'Ёжик Федя',
    npcEmoji: '🦌',
    topics: [
      // ---
      {
        id: 'forest-vowels',
        worldId: 'forest',
        titleKey: 'data.topics.forestVowels',
        subject: 'reading_ru',
        lessons: [
          {
            id: 'forest-v-l1',
            topicId: 'forest-vowels',
            titleKey: 'data.lessons.forestVL1',
            reward: { xp: 20 },
            dialog: [
              { speaker: 'npc', textKey: 'data.dialog.forest_vl1_0' },
              { speaker: 'tali', textKey: 'data.dialog.forest_vl1_1' },
            ],
            intro: [
              { titleKey: 'data.intro.forest_vl1_0_t', bodyKey: 'data.intro.forest_vl1_0_b', emoji: '🅰️' },
              { titleKey: 'data.intro.forest_vl1_1_t', bodyKey: 'data.intro.forest_vl1_1_b', emoji: '🍎' },
            ],
            tasks: [
              { id: 'fvl1-t1', type: 'multiple_choice', questionKey: 'data.tasks.pre_letter_a_starts', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_cloud', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_watermelon', correct: true }, { id: 'c', textKey: 'data.tasks.pre_opt_cat', correct: false }] },
              { id: 'fvl1-t2', type: 'multiple_choice', questionKey: 'data.tasks.pre_a_in_mama', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_letter_m', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_letter_a', correct: true }, { id: 'c', textKey: 'data.tasks.pre_opt_no_such', correct: false }] },
              { id: 'fvl1-t3', type: 'multiple_choice', questionKey: 'data.tasks.pre_a_is_vowel', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_vowel', correct: true }, { id: 'b', textKey: 'data.tasks.pre_opt_consonant', correct: false }] },
              { id: 'fvl1-t4', type: 'multiple_choice', questionKey: 'data.tasks.pre_stork_starts', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_letter_u', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_letter_a', correct: true }, { id: 'c', textKey: 'data.tasks.pre_opt_letter_o', correct: false }] },
            ],
          },
          {
            id: 'forest-v-l2',
            topicId: 'forest-vowels',
            titleKey: 'data.lessons.forestVL2',
            reward: { xp: 20 },
            dialog: [
              { speaker: 'npc', textKey: 'data.dialog.forest_vl2_0' },
              { speaker: 'tali', textKey: 'data.dialog.forest_vl2_1' },
            ],
            intro: [
              { titleKey: 'data.intro.forest_vl2_0_t', bodyKey: 'data.intro.forest_vl2_0_b', emoji: '🅾️' },
              { titleKey: 'data.intro.forest_vl2_1_t', bodyKey: 'data.intro.forest_vl2_1_b', emoji: '🍊' },
            ],
            tasks: [
              { id: 'fvl2-t1', type: 'multiple_choice', questionKey: 'data.tasks.pre_letter_o_starts', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_duck', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_watermelon', correct: false }, { id: 'c', textKey: 'data.tasks.pre_opt_veggies', correct: true }] },
              { id: 'fvl2-t2', type: 'multiple_choice', questionKey: 'data.tasks.pre_letter_u_starts', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_duck', correct: true }, { id: 'b', textKey: 'data.tasks.pre_opt_cloud', correct: false }, { id: 'c', textKey: 'data.tasks.pre_opt_watermelon', correct: false }] },
              { id: 'fvl2-t3', type: 'multiple_choice', questionKey: 'data.tasks.pre_vowel_in_mak', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_letter_m', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_letter_a', correct: true }, { id: 'c', textKey: 'data.tasks.pre_opt_letter_k', correct: false }] },
              { id: 'fvl2-t4', type: 'multiple_choice', questionKey: 'data.tasks.pre_o_is_vowel', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_vowel', correct: true }, { id: 'b', textKey: 'data.tasks.pre_opt_consonant', correct: false }] },
            ],
          },
          {
            id: 'forest-v-l3',
            topicId: 'forest-vowels',
            titleKey: 'data.lessons.forestVL3',
            reward: { xp: 25 },
            dialog: [
              { speaker: 'tali', textKey: 'data.dialog.forest_vl3_0' },
              { speaker: 'npc', textKey: 'data.dialog.forest_vl3_1' },
            ],
            intro: [
              { titleKey: 'data.intro.forest_vl3_0_t', bodyKey: 'data.intro.forest_vl3_0_b', emoji: 'ℹ️' },
              { titleKey: 'data.intro.forest_vl3_1_t', bodyKey: 'data.intro.forest_vl3_1_b', emoji: '✏️' },
            ],
            tasks: [
              { id: 'fvl3-t1', type: 'multiple_choice', questionKey: 'data.tasks.pre_letter_i_starts', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_echo', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_toy', correct: true }, { id: 'c', textKey: 'data.tasks.pre_opt_watermelon', correct: false }] },
              { id: 'fvl3-t2', type: 'multiple_choice', questionKey: 'data.tasks.pre_letter_e_starts', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_needle', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_echo', correct: true }, { id: 'c', textKey: 'data.tasks.pre_opt_duck', correct: false }] },
              { id: 'fvl3-t3', type: 'multiple_choice', questionKey: 'data.tasks.pre_vowels_in_aist', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_one', correct: false }, { id: 'b', textKey: 'data.tasks.opt_two', correct: true }, { id: 'c', textKey: 'data.tasks.opt_three', correct: false }] },
              { id: 'fvl3-t4', type: 'multiple_choice', questionKey: 'data.tasks.pre_how_many_vowels_ru', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_five', correct: false }, { id: 'b', textKey: 'data.tasks.opt_six', correct: false }, { id: 'c', textKey: 'data.tasks.pre_opt_ten', correct: true }] },
            ],
          },
        ],
      },
      // ---
      {
        id: 'forest-consonants',
        worldId: 'forest',
        titleKey: 'data.topics.forestConsonants',
        subject: 'reading_ru',
        lessons: [
          {
            id: 'forest-con-l1',
            topicId: 'forest-consonants',
            titleKey: 'data.lessons.forestConL1',
            reward: { xp: 25 },
            dialog: [
              { speaker: 'npc', textKey: 'data.dialog.forest_conl1_0' },
              { speaker: 'tali', textKey: 'data.dialog.forest_conl1_1' },
            ],
            intro: [
              { titleKey: 'data.intro.forest_conl1_0_t', bodyKey: 'data.intro.forest_conl1_0_b', emoji: '🔤' },
              { titleKey: 'data.intro.forest_conl1_1_t', bodyKey: 'data.intro.forest_conl1_1_b', emoji: '🌿' },
            ],
            tasks: [
              { id: 'fconl1-t1', type: 'multiple_choice', questionKey: 'data.tasks.pre_m_starts', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_mama', correct: true }, { id: 'b', textKey: 'data.tasks.pre_opt_watermelon', correct: false }, { id: 'c', textKey: 'data.tasks.pre_opt_cloud', correct: false }] },
              { id: 'fconl1-t2', type: 'multiple_choice', questionKey: 'data.tasks.pre_m_is_consonant', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_vowel', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_consonant', correct: true }] },
              { id: 'fconl1-t3', type: 'multiple_choice', questionKey: 'data.tasks.pre_s_starts', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_elephant', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_cat', correct: false }, { id: 'c', textKey: 'data.tasks.pre_opt_dog_ru', correct: false }, { id: 'd', textKey: 'data.tasks.pre_opt_sun_ru', correct: true }] },
              { id: 'fconl1-t4', type: 'multiple_choice', questionKey: 'data.tasks.pre_m_or_a_consonant', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_letter_m', correct: true }, { id: 'b', textKey: 'data.tasks.pre_opt_letter_a', correct: false }] },
            ],
          },
          {
            id: 'forest-con-l2',
            topicId: 'forest-consonants',
            titleKey: 'data.lessons.forestConL2',
            reward: { xp: 25 },
            dialog: [
              { speaker: 'npc', textKey: 'data.dialog.forest_conl2_0' },
              { speaker: 'tali', textKey: 'data.dialog.forest_conl2_1' },
            ],
            intro: [
              { titleKey: 'data.intro.forest_conl2_0_t', bodyKey: 'data.intro.forest_conl2_0_b', emoji: '🌿' },
              { titleKey: 'data.intro.forest_conl2_1_t', bodyKey: 'data.intro.forest_conl2_1_b', emoji: '🦔' },
            ],
            tasks: [
              { id: 'fconl2-t1', type: 'multiple_choice', questionKey: 'data.tasks.pre_t_starts', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_tiger', correct: true }, { id: 'b', textKey: 'data.tasks.pre_opt_duck', correct: false }, { id: 'c', textKey: 'data.tasks.pre_opt_mama', correct: false }] },
              { id: 'fconl2-t2', type: 'multiple_choice', questionKey: 'data.tasks.pre_k_starts', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_watermelon', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_cat', correct: true }, { id: 'c', textKey: 'data.tasks.pre_opt_duck', correct: false }] },
              { id: 'fconl2-t3', type: 'multiple_choice', questionKey: 'data.tasks.pre_t_or_o_consonant', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_letter_t', correct: true }, { id: 'b', textKey: 'data.tasks.pre_opt_letter_o', correct: false }] },
              { id: 'fconl2-t4', type: 'multiple_choice', questionKey: 'data.tasks.pre_k_in_cat', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },
            ],
          },
          {
            id: 'forest-con-l3',
            topicId: 'forest-consonants',
            titleKey: 'data.lessons.forestConL3',
            reward: { xp: 30 },
            dialog: [
              { speaker: 'tali', textKey: 'data.dialog.forest_conl3_0' },
              { speaker: 'npc', textKey: 'data.dialog.forest_conl3_1' },
            ],
            intro: [
              { titleKey: 'data.intro.forest_conl3_0_t', bodyKey: 'data.intro.forest_conl3_0_b', emoji: '🌐' },
              { titleKey: 'data.intro.forest_conl3_1_t', bodyKey: 'data.intro.forest_conl3_1_b', emoji: '📕' },
            ],
            tasks: [
              { id: 'fconl3-t1', type: 'multiple_choice', questionKey: 'data.tasks.pre_n_starts', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_scissors_ru', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_sky_ru', correct: true }, { id: 'c', textKey: 'data.tasks.pre_opt_mama', correct: false }] },
              { id: 'fconl3-t2', type: 'multiple_choice', questionKey: 'data.tasks.pre_n_is_consonant', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_vowel', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_consonant', correct: true }] },
              { id: 'fconl3-t3', type: 'multiple_choice', questionKey: 'data.tasks.pre_syllable_ma', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_syl_ma', correct: true }, { id: 'b', textKey: 'data.tasks.pre_opt_syl_sa', correct: false }, { id: 'c', textKey: 'data.tasks.pre_opt_syl_na', correct: false }] },
              { id: 'fconl3-t4', type: 'multiple_choice', questionKey: 'data.tasks.pre_letter_n_word', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_cat', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_nose_ru', correct: true }, { id: 'c', textKey: 'data.tasks.pre_opt_mama', correct: false }] },
            ],
          },
        ],
      },
      // ---
      {
        id: 'forest-syllables',
        worldId: 'forest',
        titleKey: 'data.topics.forestSyllables',
        subject: 'reading_ru',
        lessons: [
          {
            id: 'forest-syl-l1',
            topicId: 'forest-syllables',
            titleKey: 'data.lessons.forestSylL1',
            reward: { xp: 30 },
            dialog: [
              { speaker: 'npc', textKey: 'data.dialog.forest_syll1_0' },
              { speaker: 'tali', textKey: 'data.dialog.forest_syll1_1' },
            ],
            intro: [
              { titleKey: 'data.intro.forest_syll1_0_t', bodyKey: 'data.intro.forest_syll1_0_b', emoji: '🔢' },
              { titleKey: 'data.intro.forest_syll1_1_t', bodyKey: 'data.intro.forest_syll1_1_b', emoji: '📄' },
            ],
            tasks: [
              { id: 'fsyll1-t1', type: 'multiple_choice', questionKey: 'data.tasks.pre_read_ma', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_syl_ma', correct: true }, { id: 'b', textKey: 'data.tasks.pre_opt_syl_mo', correct: false }, { id: 'c', textKey: 'data.tasks.pre_opt_syl_mu', correct: false }] },
              { id: 'fsyll1-t2', type: 'multiple_choice', questionKey: 'data.tasks.pre_read_mo', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_syl_ma', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_syl_mo', correct: true }, { id: 'c', textKey: 'data.tasks.pre_opt_syl_mu', correct: false }] },
              { id: 'fsyll1-t3', type: 'multiple_choice', questionKey: 'data.tasks.pre_mu_letter', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_letter_s', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_letter_m', correct: true }, { id: 'c', textKey: 'data.tasks.pre_opt_letter_n', correct: false }] },
              { id: 'fsyll1-t4', type: 'multiple_choice', questionKey: 'data.tasks.pre_mama_syllables', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_one', correct: false }, { id: 'b', textKey: 'data.tasks.opt_two', correct: true }, { id: 'c', textKey: 'data.tasks.opt_three', correct: false }] },
            ],
          },
          {
            id: 'forest-syl-l2',
            topicId: 'forest-syllables',
            titleKey: 'data.lessons.forestSylL2',
            reward: { xp: 30 },
            dialog: [
              { speaker: 'tali', textKey: 'data.dialog.forest_syll2_0' },
              { speaker: 'npc', textKey: 'data.dialog.forest_syll2_1' },
            ],
            intro: [
              { titleKey: 'data.intro.forest_syll2_0_t', bodyKey: 'data.intro.forest_syll2_0_b', emoji: '📝' },
              { titleKey: 'data.intro.forest_syll2_1_t', bodyKey: 'data.intro.forest_syll2_1_b', emoji: '🌍' },
            ],
            tasks: [
              { id: 'fsyll2-t1', type: 'multiple_choice', questionKey: 'data.tasks.pre_read_sa', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_syl_sa', correct: true }, { id: 'b', textKey: 'data.tasks.pre_opt_syl_so', correct: false }, { id: 'c', textKey: 'data.tasks.pre_opt_syl_su', correct: false }] },
              { id: 'fsyll2-t2', type: 'multiple_choice', questionKey: 'data.tasks.pre_so_letter', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_letter_m', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_letter_s', correct: true }, { id: 'c', textKey: 'data.tasks.pre_opt_letter_n', correct: false }] },
              { id: 'fsyll2-t3', type: 'multiple_choice', questionKey: 'data.tasks.pre_sova_syllables', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_one', correct: false }, { id: 'b', textKey: 'data.tasks.opt_two', correct: true }, { id: 'c', textKey: 'data.tasks.opt_three', correct: false }] },
              { id: 'fsyll2-t4', type: 'multiple_choice', questionKey: 'data.tasks.pre_su_starts', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_syl_sa', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_syl_so', correct: false }, { id: 'c', textKey: 'data.tasks.pre_opt_syl_su', correct: true }] },
            ],
          },
          {
            id: 'forest-syl-l3',
            topicId: 'forest-syllables',
            titleKey: 'data.lessons.forestSylL3',
            reward: { xp: 35, item: 'jungle_leaf' },
            dialog: [
              { speaker: 'npc', textKey: 'data.dialog.forest_syll3_0' },
              { speaker: 'tali', textKey: 'data.dialog.forest_syll3_1' },
            ],
            intro: [
              { titleKey: 'data.intro.forest_syll3_0_t', bodyKey: 'data.intro.forest_syll3_0_b', emoji: '📖' },
              { titleKey: 'data.intro.forest_syll3_1_t', bodyKey: 'data.intro.forest_syll3_1_b', emoji: '🎓' },
            ],
            tasks: [
              { id: 'fsyll3-t1', type: 'multiple_choice', questionKey: 'data.tasks.pre_read_na', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_syl_ma', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_syl_na', correct: true }, { id: 'c', textKey: 'data.tasks.pre_opt_syl_sa', correct: false }] },
              { id: 'fsyll3-t2', type: 'multiple_choice', questionKey: 'data.tasks.pre_nora_syllables', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_one', correct: false }, { id: 'b', textKey: 'data.tasks.opt_two', correct: true }, { id: 'c', textKey: 'data.tasks.opt_three', correct: false }] },
              { id: 'fsyll3-t3', type: 'multiple_choice', questionKey: 'data.tasks.pre_first_syl_mama', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_syl_ma', correct: true }, { id: 'b', textKey: 'data.tasks.pre_opt_syl_na', correct: false }, { id: 'c', textKey: 'data.tasks.pre_opt_syl_sa', correct: false }] },
              { id: 'fsyll3-t4', type: 'input', questionKey: 'data.tasks.pre_type_syl_mo', difficulty: 2, answer: 'МО', skippable: true },
            ],
          },
        ],
      },
    ],
  },

  // ---
  {
    id: 'garden',
    ageBand: '5-6',
    titleKey: 'data.worlds.garden',
    descriptionKey: 'data.worldDesc.garden',
    accentColor: '#9CCC65',
    biome: '🌷',
    npcName: 'Черепашка Тара',
    npcEmoji: '🐢',
    topics: [
      // ---
      {
        id: 'garden-colors',
        worldId: 'garden',
        titleKey: 'data.topics.gardenColors',
        subject: 'logic',
        lessons: [
          {
            id: 'garden-col-l1',
            topicId: 'garden-colors',
            titleKey: 'data.lessons.gardenColL1',
            reward: { xp: 20 },
            dialog: [
              { speaker: 'npc', textKey: 'data.dialog.garden_coll1_0' },
              { speaker: 'tali', textKey: 'data.dialog.garden_coll1_1' },
            ],
            intro: [
              { titleKey: 'data.intro.garden_coll1_0_t', bodyKey: 'data.intro.garden_coll1_0_b', emoji: '🎨' },
              { titleKey: 'data.intro.garden_coll1_1_t', bodyKey: 'data.intro.garden_coll1_1_b', emoji: '🌾' },
            ],
            tasks: [
              { id: 'gcoll1-t1', type: 'multiple_choice', questionKey: 'data.tasks.pre_color_apple', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_red', correct: true }, { id: 'b', textKey: 'data.tasks.opt_blue', correct: false }, { id: 'c', textKey: 'data.tasks.opt_green', correct: false }] },
              { id: 'gcoll1-t2', type: 'multiple_choice', questionKey: 'data.tasks.pre_color_sky', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_red', correct: false }, { id: 'b', textKey: 'data.tasks.opt_blue', correct: true }, { id: 'c', textKey: 'data.tasks.pre_opt_yellow', correct: false }] },
              { id: 'gcoll1-t3', type: 'multiple_choice', questionKey: 'data.tasks.pre_color_grass', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_red', correct: false }, { id: 'b', textKey: 'data.tasks.opt_green', correct: true }, { id: 'c', textKey: 'data.tasks.opt_blue', correct: false }] },
              { id: 'gcoll1-t4', type: 'multiple_choice', questionKey: 'data.tasks.pre_color_sun', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_yellow', correct: true }, { id: 'b', textKey: 'data.tasks.opt_red', correct: false }, { id: 'c', textKey: 'data.tasks.opt_blue', correct: false }] },
            ],
          },
          {
            id: 'garden-col-l2',
            topicId: 'garden-colors',
            titleKey: 'data.lessons.gardenColL2',
            reward: { xp: 20 },
            dialog: [
              { speaker: 'tali', textKey: 'data.dialog.garden_coll2_0' },
              { speaker: 'npc', textKey: 'data.dialog.garden_coll2_1' },
            ],
            intro: [
              { titleKey: 'data.intro.garden_coll2_0_t', bodyKey: 'data.intro.garden_coll2_0_b', emoji: '🟡' },
              { titleKey: 'data.intro.garden_coll2_1_t', bodyKey: 'data.intro.garden_coll2_1_b', emoji: '🟠' },
            ],
            tasks: [
              { id: 'gcoll2-t1', type: 'multiple_choice', questionKey: 'data.tasks.pre_color_orange_fruit', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_red', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_orange', correct: true }, { id: 'c', textKey: 'data.tasks.opt_blue', correct: false }] },
              { id: 'gcoll2-t2', type: 'multiple_choice', questionKey: 'data.tasks.pre_color_banana', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_green', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_yellow', correct: true }, { id: 'c', textKey: 'data.tasks.opt_red', correct: false }] },
              { id: 'gcoll2-t3', type: 'multiple_choice', questionKey: 'data.tasks.pre_big_or_small_elephant', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_big', correct: true }, { id: 'b', textKey: 'data.tasks.pre_opt_small', correct: false }] },
              { id: 'gcoll2-t4', type: 'multiple_choice', questionKey: 'data.tasks.pre_big_or_small_ant', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_big', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_small', correct: true }] },
            ],
          },
          {
            id: 'garden-col-l3',
            topicId: 'garden-colors',
            titleKey: 'data.lessons.gardenColL3',
            reward: { xp: 25 },
            dialog: [
              { speaker: 'npc', textKey: 'data.dialog.garden_coll3_0' },
              { speaker: 'tali', textKey: 'data.dialog.garden_coll3_1' },
            ],
            intro: [
              { titleKey: 'data.intro.garden_coll3_0_t', bodyKey: 'data.intro.garden_coll3_0_b', emoji: '🟣' },
              { titleKey: 'data.intro.garden_coll3_1_t', bodyKey: 'data.intro.garden_coll3_1_b', emoji: '🎓' },
            ],
            tasks: [
              { id: 'gcoll3-t1', type: 'multiple_choice', questionKey: 'data.tasks.pre_color_snow', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_white', correct: true }, { id: 'b', textKey: 'data.tasks.opt_blue', correct: false }, { id: 'c', textKey: 'data.tasks.opt_red', correct: false }] },
              { id: 'gcoll3-t2', type: 'multiple_choice', questionKey: 'data.tasks.pre_color_night', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_red', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_black', correct: true }, { id: 'c', textKey: 'data.tasks.opt_green', correct: false }] },
              { id: 'gcoll3-t3', type: 'multiple_choice', questionKey: 'data.tasks.pre_bigger_cat_mouse', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_cat', correct: true }, { id: 'b', textKey: 'data.tasks.pre_opt_mouse', correct: false }] },
              { id: 'gcoll3-t4', type: 'multiple_choice', questionKey: 'data.tasks.pre_mix_red_blue', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_green', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_purple', correct: true }, { id: 'c', textKey: 'data.tasks.pre_opt_orange', correct: false }] },
            ],
          },
        ],
      },
      // ---
      {
        id: 'garden-animals',
        worldId: 'garden',
        titleKey: 'data.topics.gardenAnimals',
        subject: 'logic',
        lessons: [
          {
            id: 'garden-anim-l1',
            topicId: 'garden-animals',
            titleKey: 'data.lessons.gardenAnimL1',
            reward: { xp: 20 },
            dialog: [
              { speaker: 'npc', textKey: 'data.dialog.garden_animl1_0' },
              { speaker: 'tali', textKey: 'data.dialog.garden_animl1_1' },
            ],
            intro: [
              { titleKey: 'data.intro.garden_animl1_0_t', bodyKey: 'data.intro.garden_animl1_0_b', emoji: '🐄' },
              { titleKey: 'data.intro.garden_animl1_1_t', bodyKey: 'data.intro.garden_animl1_1_b', emoji: '🐕' },
            ],
            tasks: [
              { id: 'ganiml1-t1', type: 'multiple_choice', questionKey: 'data.tasks.pre_domestic_animal', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_wolf', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_cow', correct: true }, { id: 'c', textKey: 'data.tasks.pre_opt_bear', correct: false }] },
              { id: 'ganiml1-t2', type: 'multiple_choice', questionKey: 'data.tasks.pre_dog_domestic', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },
              { id: 'ganiml1-t3', type: 'multiple_choice', questionKey: 'data.tasks.pre_gives_milk', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_cat', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_cow', correct: true }, { id: 'c', textKey: 'data.tasks.pre_opt_dog_ru', correct: false }] },
              { id: 'ganiml1-t4', type: 'multiple_choice', questionKey: 'data.tasks.pre_count_domestic', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_two', correct: false }, { id: 'b', textKey: 'data.tasks.opt_three', correct: true }, { id: 'c', textKey: 'data.tasks.opt_four', correct: false }] },
            ],
          },
          {
            id: 'garden-anim-l2',
            topicId: 'garden-animals',
            titleKey: 'data.lessons.gardenAnimL2',
            reward: { xp: 25 },
            dialog: [
              { speaker: 'tali', textKey: 'data.dialog.garden_animl2_0' },
              { speaker: 'npc', textKey: 'data.dialog.garden_animl2_1' },
            ],
            intro: [
              { titleKey: 'data.intro.garden_animl2_0_t', bodyKey: 'data.intro.garden_animl2_0_b', emoji: '🦎' },
              { titleKey: 'data.intro.garden_animl2_1_t', bodyKey: 'data.intro.garden_animl2_1_b', emoji: '🌿' },
            ],
            tasks: [
              { id: 'ganiml2-t1', type: 'multiple_choice', questionKey: 'data.tasks.pre_wild_animal', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_cow', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_wolf', correct: true }, { id: 'c', textKey: 'data.tasks.pre_opt_horse', correct: false }] },
              { id: 'ganiml2-t2', type: 'multiple_choice', questionKey: 'data.tasks.pre_fox_wild', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },
              { id: 'ganiml2-t3', type: 'multiple_choice', questionKey: 'data.tasks.pre_lives_forest', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_cow', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_bear', correct: true }, { id: 'c', textKey: 'data.tasks.pre_opt_horse', correct: false }] },
              { id: 'ganiml2-t4', type: 'multiple_choice', questionKey: 'data.tasks.pre_lion_or_cat_wild', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_lion', correct: true }, { id: 'b', textKey: 'data.tasks.pre_opt_cat', correct: false }] },
            ],
          },
          {
            id: 'garden-anim-l3',
            topicId: 'garden-animals',
            titleKey: 'data.lessons.gardenAnimL3',
            reward: { xp: 25 },
            dialog: [
              { speaker: 'npc', textKey: 'data.dialog.garden_animl3_0' },
              { speaker: 'tali', textKey: 'data.dialog.garden_animl3_1' },
            ],
            intro: [
              { titleKey: 'data.intro.garden_animl3_0_t', bodyKey: 'data.intro.garden_animl3_0_b', emoji: '🐄' },
              { titleKey: 'data.intro.garden_animl3_1_t', bodyKey: 'data.intro.garden_animl3_1_b', emoji: '🦕' },
            ],
            tasks: [
              { id: 'ganiml3-t1', type: 'multiple_choice', questionKey: 'data.tasks.pre_fish_lives', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_land', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_water', correct: true }, { id: 'c', textKey: 'data.tasks.pre_opt_sky', correct: false }] },
              { id: 'ganiml3-t2', type: 'multiple_choice', questionKey: 'data.tasks.pre_bird_lives', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_land', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_water', correct: false }, { id: 'c', textKey: 'data.tasks.pre_opt_sky', correct: true }] },
              { id: 'ganiml3-t3', type: 'multiple_choice', questionKey: 'data.tasks.pre_can_fly', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_dog_ru', correct: false }, { id: 'b', textKey: 'data.tasks.opt_bird', correct: true }, { id: 'c', textKey: 'data.tasks.pre_opt_horse', correct: false }] },
              { id: 'ganiml3-t4', type: 'multiple_choice', questionKey: 'data.tasks.pre_cat_legs', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_two', correct: false }, { id: 'b', textKey: 'data.tasks.opt_four', correct: true }, { id: 'c', textKey: 'data.tasks.opt_six', correct: false }] },
            ],
          },
        ],
      },
      // ---
      {
        id: 'garden-seasons',
        worldId: 'garden',
        titleKey: 'data.topics.gardenSeasons',
        subject: 'logic',
        lessons: [
          {
            id: 'garden-seas-l1',
            topicId: 'garden-seasons',
            titleKey: 'data.lessons.gardenSeasL1',
            reward: { xp: 20 },
            dialog: [
              { speaker: 'npc', textKey: 'data.dialog.garden_seasl1_0' },
              { speaker: 'tali', textKey: 'data.dialog.garden_seasl1_1' },
            ],
            intro: [
              { titleKey: 'data.intro.garden_seasl1_0_t', bodyKey: 'data.intro.garden_seasl1_0_b', emoji: '🍂' },
              { titleKey: 'data.intro.garden_seasl1_1_t', bodyKey: 'data.intro.garden_seasl1_1_b', emoji: '✔️' },
            ],
            tasks: [
              { id: 'gseasl1-t1', type: 'multiple_choice', questionKey: 'data.tasks.pre_autumn_sign', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_flowers_bloom', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_leaves_fall', correct: true }, { id: 'c', textKey: 'data.tasks.pre_opt_snow_melts', correct: false }] },
              { id: 'gseasl1-t2', type: 'multiple_choice', questionKey: 'data.tasks.pre_winter_sign', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_hot', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_snow_falls', correct: true }, { id: 'c', textKey: 'data.tasks.pre_opt_leaves_fall', correct: false }] },
              { id: 'gseasl1-t3', type: 'multiple_choice', questionKey: 'data.tasks.pre_snowman_season', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_summer', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_winter', correct: true }, { id: 'c', textKey: 'data.tasks.pre_opt_spring', correct: false }] },
              { id: 'gseasl1-t4', type: 'multiple_choice', questionKey: 'data.tasks.pre_seasons_count', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_two', correct: false }, { id: 'b', textKey: 'data.tasks.opt_three', correct: false }, { id: 'c', textKey: 'data.tasks.opt_four', correct: true }] },
            ],
          },
          {
            id: 'garden-seas-l2',
            topicId: 'garden-seasons',
            titleKey: 'data.lessons.gardenSeasL2',
            reward: { xp: 25 },
            dialog: [
              { speaker: 'tali', textKey: 'data.dialog.garden_seasl2_0' },
              { speaker: 'npc', textKey: 'data.dialog.garden_seasl2_1' },
            ],
            intro: [
              { titleKey: 'data.intro.garden_seasl2_0_t', bodyKey: 'data.intro.garden_seasl2_0_b', emoji: '🌸' },
              { titleKey: 'data.intro.garden_seasl2_1_t', bodyKey: 'data.intro.garden_seasl2_1_b', emoji: '☀️' },
            ],
            tasks: [
              { id: 'gseasl2-t1', type: 'multiple_choice', questionKey: 'data.tasks.pre_spring_sign', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_snow_falls', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_snow_melts', correct: true }, { id: 'c', textKey: 'data.tasks.pre_opt_leaves_fall', correct: false }] },
              { id: 'gseasl2-t2', type: 'multiple_choice', questionKey: 'data.tasks.pre_after_winter', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_autumn', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_spring', correct: true }, { id: 'c', textKey: 'data.tasks.pre_opt_summer', correct: false }] },
              { id: 'gseasl2-t3', type: 'multiple_choice', questionKey: 'data.tasks.pre_birds_return_season', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_winter', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_spring', correct: true }, { id: 'c', textKey: 'data.tasks.pre_opt_autumn', correct: false }] },
              { id: 'gseasl2-t4', type: 'multiple_choice', questionKey: 'data.tasks.pre_after_spring', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_autumn', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_winter', correct: false }, { id: 'c', textKey: 'data.tasks.pre_opt_summer', correct: true }] },
            ],
          },
          {
            id: 'garden-seas-l3',
            topicId: 'garden-seasons',
            titleKey: 'data.lessons.gardenSeasL3',
            reward: { xp: 30, item: 'canyon_gem' },
            dialog: [
              { speaker: 'npc', textKey: 'data.dialog.garden_seasl3_0' },
              { speaker: 'tali', textKey: 'data.dialog.garden_seasl3_1' },
            ],
            intro: [
              { titleKey: 'data.intro.garden_seasl3_0_t', bodyKey: 'data.intro.garden_seasl3_0_b', emoji: '✏️' },
              { titleKey: 'data.intro.garden_seasl3_1_t', bodyKey: 'data.intro.garden_seasl3_1_b', emoji: '🏖️' },
            ],
            tasks: [
              { id: 'gseasl3-t1', type: 'multiple_choice', questionKey: 'data.tasks.pre_summer_sign', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_snow_falls', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_hot', correct: true }, { id: 'c', textKey: 'data.tasks.pre_opt_leaves_fall', correct: false }] },
              { id: 'gseasl3-t2', type: 'multiple_choice', questionKey: 'data.tasks.pre_swim_season', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_winter', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_summer', correct: true }, { id: 'c', textKey: 'data.tasks.pre_opt_autumn', correct: false }] },
              { id: 'gseasl3-t3', type: 'multiple_choice', questionKey: 'data.tasks.pre_season_order', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_summer', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_spring', correct: false }, { id: 'c', textKey: 'data.tasks.pre_opt_autumn', correct: true }] },
              { id: 'gseasl3-t4', type: 'multiple_choice', questionKey: 'data.tasks.pre_harvest_season', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_spring', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_autumn', correct: true }, { id: 'c', textKey: 'data.tasks.pre_opt_winter', correct: false }] },
            ],
          },
        ],
      },
    ],
  },

  // ---
  {
    id: 'island',
    ageBand: '5-6',
    titleKey: 'data.worlds.island',
    descriptionKey: 'data.worldDesc.island',
    accentColor: '#29B6F6',
    biome: '🏝️',
    npcName: 'Попугай Пит',
    npcEmoji: '🦜',
    topics: [
      // ---
      {
        id: 'island-abc',
        worldId: 'island',
        titleKey: 'data.topics.islandAbc',
        subject: 'reading',
        lessons: [
          {
            id: 'island-abc-l1',
            topicId: 'island-abc',
            titleKey: 'data.lessons.islandAbcL1',
            reward: { xp: 20 },
            dialog: [
              { speaker: 'npc', textKey: 'data.dialog.island_abcl1_0' },
              { speaker: 'tali', textKey: 'data.dialog.island_abcl1_1' },
            ],
            intro: [
              { titleKey: 'data.intro.island_abcl1_0_t', bodyKey: 'data.intro.island_abcl1_0_b', emoji: '🅰️' },
              { titleKey: 'data.intro.island_abcl1_1_t', bodyKey: 'data.intro.island_abcl1_1_b', emoji: '📚' },
            ],
            tasks: [
              { id: 'iabcl1-t1', type: 'multiple_choice', questionKey: 'data.tasks.pre_en_letter_a', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_en_a', correct: true }, { id: 'b', textKey: 'data.tasks.pre_opt_en_b', correct: false }, { id: 'c', textKey: 'data.tasks.pre_opt_en_c', correct: false }] },
              { id: 'iabcl1-t2', type: 'multiple_choice', questionKey: 'data.tasks.pre_en_apple_starts', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_en_b', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_en_a', correct: true }, { id: 'c', textKey: 'data.tasks.pre_opt_en_c', correct: false }] },
              { id: 'iabcl1-t3', type: 'multiple_choice', questionKey: 'data.tasks.pre_en_letter_b', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_en_a', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_en_b', correct: true }, { id: 'c', textKey: 'data.tasks.pre_opt_en_c', correct: false }] },
              { id: 'iabcl1-t4', type: 'multiple_choice', questionKey: 'data.tasks.pre_en_ball_starts', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_en_a', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_en_b', correct: true }, { id: 'c', textKey: 'data.tasks.pre_opt_en_c', correct: false }] },
            ],
          },
          {
            id: 'island-abc-l2',
            topicId: 'island-abc',
            titleKey: 'data.lessons.islandAbcL2',
            reward: { xp: 20 },
            dialog: [
              { speaker: 'tali', textKey: 'data.dialog.island_abcl2_0' },
              { speaker: 'npc', textKey: 'data.dialog.island_abcl2_1' },
            ],
            intro: [
              { titleKey: 'data.intro.island_abcl2_0_t', bodyKey: 'data.intro.island_abcl2_0_b', emoji: '🐱' },
              { titleKey: 'data.intro.island_abcl2_1_t', bodyKey: 'data.intro.island_abcl2_1_b', emoji: '🐬' },
            ],
            tasks: [
              { id: 'iabcl2-t1', type: 'multiple_choice', questionKey: 'data.tasks.pre_en_letter_c', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_en_b', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_en_c', correct: true }, { id: 'c', textKey: 'data.tasks.pre_opt_en_d', correct: false }] },
              { id: 'iabcl2-t2', type: 'multiple_choice', questionKey: 'data.tasks.pre_en_cat_starts', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_en_a', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_en_c', correct: true }, { id: 'c', textKey: 'data.tasks.pre_opt_en_d', correct: false }] },
              { id: 'iabcl2-t3', type: 'multiple_choice', questionKey: 'data.tasks.pre_en_letter_d', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_en_c', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_en_d', correct: true }, { id: 'c', textKey: 'data.tasks.pre_opt_en_e', correct: false }] },
              { id: 'iabcl2-t4', type: 'multiple_choice', questionKey: 'data.tasks.pre_en_dog_starts', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_en_c', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_en_d', correct: true }, { id: 'c', textKey: 'data.tasks.pre_opt_en_e', correct: false }] },
            ],
          },
          {
            id: 'island-abc-l3',
            topicId: 'island-abc',
            titleKey: 'data.lessons.islandAbcL3',
            reward: { xp: 25 },
            dialog: [
              { speaker: 'npc', textKey: 'data.dialog.island_abcl3_0' },
              { speaker: 'tali', textKey: 'data.dialog.island_abcl3_1' },
            ],
            intro: [
              { titleKey: 'data.intro.island_abcl3_0_t', bodyKey: 'data.intro.island_abcl3_0_b', emoji: '🥚' },
              { titleKey: 'data.intro.island_abcl3_1_t', bodyKey: 'data.intro.island_abcl3_1_b', emoji: '🎓' },
            ],
            tasks: [
              { id: 'iabcl3-t1', type: 'multiple_choice', questionKey: 'data.tasks.pre_en_letter_e', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_en_d', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_en_e', correct: true }, { id: 'c', textKey: 'data.tasks.pre_opt_en_f', correct: false }] },
              { id: 'iabcl3-t2', type: 'multiple_choice', questionKey: 'data.tasks.pre_en_egg_starts', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_en_d', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_en_e', correct: true }, { id: 'c', textKey: 'data.tasks.pre_opt_en_f', correct: false }] },
              { id: 'iabcl3-t3', type: 'multiple_choice', questionKey: 'data.tasks.pre_en_letter_f', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_en_e', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_en_f', correct: true }, { id: 'c', textKey: 'data.tasks.pre_opt_en_a', correct: false }] },
              { id: 'iabcl3-t4', type: 'multiple_choice', questionKey: 'data.tasks.pre_en_frog_starts', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_en_e', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_en_a', correct: false }, { id: 'c', textKey: 'data.tasks.pre_opt_en_f', correct: true }] },
            ],
          },
        ],
      },
      // ---
      {
        id: 'island-colors',
        worldId: 'island',
        titleKey: 'data.topics.islandColors',
        subject: 'reading',
        lessons: [
          {
            id: 'island-col-l1',
            topicId: 'island-colors',
            titleKey: 'data.lessons.islandColL1',
            reward: { xp: 20 },
            dialog: [
              { speaker: 'npc', textKey: 'data.dialog.island_coll1_0' },
              { speaker: 'tali', textKey: 'data.dialog.island_coll1_1' },
            ],
            intro: [
              { titleKey: 'data.intro.island_coll1_0_t', bodyKey: 'data.intro.island_coll1_0_b', emoji: '🔴' },
              { titleKey: 'data.intro.island_coll1_1_t', bodyKey: 'data.intro.island_coll1_1_b', emoji: '🔵' },
            ],
            tasks: [
              { id: 'icoll1-t1', type: 'multiple_choice', questionKey: 'data.tasks.pre_en_apple_color', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_red', correct: true }, { id: 'b', textKey: 'data.tasks.opt_blue', correct: false }, { id: 'c', textKey: 'data.tasks.opt_green', correct: false }] },
              { id: 'icoll1-t2', type: 'multiple_choice', questionKey: 'data.tasks.pre_en_sky_color', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_red', correct: false }, { id: 'b', textKey: 'data.tasks.opt_blue', correct: true }, { id: 'c', textKey: 'data.tasks.pre_opt_yellow', correct: false }] },
              { id: 'icoll1-t3', type: 'multiple_choice', questionKey: 'data.tasks.pre_en_grass_color', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_red', correct: false }, { id: 'b', textKey: 'data.tasks.opt_blue', correct: false }, { id: 'c', textKey: 'data.tasks.opt_green', correct: true }] },
              { id: 'icoll1-t4', type: 'multiple_choice', questionKey: 'data.tasks.pre_en_red_object', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_en_cloud', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_en_apple', correct: true }, { id: 'c', textKey: 'data.tasks.pre_opt_en_leaf', correct: false }] },
            ],
          },
          {
            id: 'island-col-l2',
            topicId: 'island-colors',
            titleKey: 'data.lessons.islandColL2',
            reward: { xp: 25 },
            dialog: [
              { speaker: 'tali', textKey: 'data.dialog.island_coll2_0' },
              { speaker: 'npc', textKey: 'data.dialog.island_coll2_1' },
            ],
            intro: [
              { titleKey: 'data.intro.island_coll2_0_t', bodyKey: 'data.intro.island_coll2_0_b', emoji: '🟡' },
              { titleKey: 'data.intro.island_coll2_1_t', bodyKey: 'data.intro.island_coll2_1_b', emoji: '🟠' },
            ],
            tasks: [
              { id: 'icoll2-t1', type: 'multiple_choice', questionKey: 'data.tasks.pre_en_sun_color', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_yellow', correct: true }, { id: 'b', textKey: 'data.tasks.opt_blue', correct: false }, { id: 'c', textKey: 'data.tasks.opt_red', correct: false }] },
              { id: 'icoll2-t2', type: 'multiple_choice', questionKey: 'data.tasks.pre_en_banana_color', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_red', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_yellow', correct: true }, { id: 'c', textKey: 'data.tasks.opt_green', correct: false }] },
              { id: 'icoll2-t3', type: 'multiple_choice', questionKey: 'data.tasks.pre_en_orange_object', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_en_apple', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_en_orange', correct: true }, { id: 'c', textKey: 'data.tasks.pre_opt_en_cloud', correct: false }] },
              { id: 'icoll2-t4', type: 'multiple_choice', questionKey: 'data.tasks.pre_en_yellow_object', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_en_banana', correct: true }, { id: 'b', textKey: 'data.tasks.pre_opt_en_apple', correct: false }, { id: 'c', textKey: 'data.tasks.pre_opt_en_leaf', correct: false }] },
            ],
          },
          {
            id: 'island-col-l3',
            topicId: 'island-colors',
            titleKey: 'data.lessons.islandColL3',
            reward: { xp: 30 },
            dialog: [
              { speaker: 'npc', textKey: 'data.dialog.island_coll3_0' },
              { speaker: 'tali', textKey: 'data.dialog.island_coll3_1' },
            ],
            intro: [
              { titleKey: 'data.intro.island_coll3_0_t', bodyKey: 'data.intro.island_coll3_0_b', emoji: '🌾' },
              { titleKey: 'data.intro.island_coll3_1_t', bodyKey: 'data.intro.island_coll3_1_b', emoji: '🎨' },
            ],
            tasks: [
              { id: 'icoll3-t1', type: 'multiple_choice', questionKey: 'data.tasks.pre_en_frog_color', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_red', correct: false }, { id: 'b', textKey: 'data.tasks.opt_green', correct: true }, { id: 'c', textKey: 'data.tasks.opt_blue', correct: false }] },
              { id: 'icoll3-t2', type: 'multiple_choice', questionKey: 'data.tasks.pre_en_snow_color', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_white', correct: true }, { id: 'b', textKey: 'data.tasks.opt_blue', correct: false }, { id: 'c', textKey: 'data.tasks.opt_red', correct: false }] },
              { id: 'icoll3-t3', type: 'multiple_choice', questionKey: 'data.tasks.pre_en_night_color', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_red', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_black', correct: true }, { id: 'c', textKey: 'data.tasks.opt_green', correct: false }] },
              { id: 'icoll3-t4', type: 'multiple_choice', questionKey: 'data.tasks.pre_en_what_color_tomato', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_red', correct: true }, { id: 'b', textKey: 'data.tasks.opt_blue', correct: false }, { id: 'c', textKey: 'data.tasks.pre_opt_yellow', correct: false }] },
            ],
          },
        ],
      },
      // ---
      {
        id: 'island-animals',
        worldId: 'island',
        titleKey: 'data.topics.islandAnimals',
        subject: 'reading',
        lessons: [
          {
            id: 'island-anim-l1',
            topicId: 'island-animals',
            titleKey: 'data.lessons.islandAnimL1',
            reward: { xp: 20 },
            dialog: [
              { speaker: 'npc', textKey: 'data.dialog.island_animl1_0' },
              { speaker: 'tali', textKey: 'data.dialog.island_animl1_1' },
            ],
            intro: [
              { titleKey: 'data.intro.island_animl1_0_t', bodyKey: 'data.intro.island_animl1_0_b', emoji: '🐱' },
              { titleKey: 'data.intro.island_animl1_1_t', bodyKey: 'data.intro.island_animl1_1_b', emoji: '📖' },
            ],
            tasks: [
              { id: 'ianiml1-t1', type: 'multiple_choice', questionKey: 'data.tasks.pre_en_cat_word', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_en_cat', correct: true }, { id: 'b', textKey: 'data.tasks.pre_opt_en_dog', correct: false }, { id: 'c', textKey: 'data.tasks.pre_opt_en_bird', correct: false }] },
              { id: 'ianiml1-t2', type: 'multiple_choice', questionKey: 'data.tasks.pre_en_dog_word', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_en_cat', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_en_dog', correct: true }, { id: 'c', textKey: 'data.tasks.pre_opt_en_bird', correct: false }] },
              { id: 'ianiml1-t3', type: 'multiple_choice', questionKey: 'data.tasks.pre_en_cat_sound', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_en_woof', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_en_meow', correct: true }, { id: 'c', textKey: 'data.tasks.pre_opt_en_moo', correct: false }] },
              { id: 'ianiml1-t4', type: 'multiple_choice', questionKey: 'data.tasks.pre_en_dog_starts', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_en_c', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_en_d', correct: true }, { id: 'c', textKey: 'data.tasks.pre_opt_en_a', correct: false }] },
            ],
          },
          {
            id: 'island-anim-l2',
            topicId: 'island-animals',
            titleKey: 'data.lessons.islandAnimL2',
            reward: { xp: 20 },
            dialog: [
              { speaker: 'tali', textKey: 'data.dialog.island_animl2_0' },
              { speaker: 'npc', textKey: 'data.dialog.island_animl2_1' },
            ],
            intro: [
              { titleKey: 'data.intro.island_animl2_0_t', bodyKey: 'data.intro.island_animl2_0_b', emoji: '🐦' },
              { titleKey: 'data.intro.island_animl2_1_t', bodyKey: 'data.intro.island_animl2_1_b', emoji: '🐟' },
            ],
            tasks: [
              { id: 'ianiml2-t1', type: 'multiple_choice', questionKey: 'data.tasks.pre_en_bird_word', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_en_cat', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_en_bird', correct: true }, { id: 'c', textKey: 'data.tasks.pre_opt_en_fish', correct: false }] },
              { id: 'ianiml2-t2', type: 'multiple_choice', questionKey: 'data.tasks.pre_en_fish_word', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_en_bird', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_en_fish', correct: true }, { id: 'c', textKey: 'data.tasks.pre_opt_en_dog', correct: false }] },
              { id: 'ianiml2-t3', type: 'multiple_choice', questionKey: 'data.tasks.pre_en_bird_can', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_en_swim', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_en_fly', correct: true }, { id: 'c', textKey: 'data.tasks.pre_opt_en_run', correct: false }] },
              { id: 'ianiml2-t4', type: 'multiple_choice', questionKey: 'data.tasks.pre_en_fish_lives', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_en_land', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_en_water', correct: true }, { id: 'c', textKey: 'data.tasks.pre_opt_en_sky', correct: false }] },
            ],
          },
          {
            id: 'island-anim-l3',
            topicId: 'island-animals',
            titleKey: 'data.lessons.islandAnimL3',
            reward: { xp: 30, item: 'star_fragment' },
            dialog: [
              { speaker: 'npc', textKey: 'data.dialog.island_animl3_0' },
              { speaker: 'tali', textKey: 'data.dialog.island_animl3_1' },
            ],
            intro: [
              { titleKey: 'data.intro.island_animl3_0_t', bodyKey: 'data.intro.island_animl3_0_b', emoji: '🦎' },
              { titleKey: 'data.intro.island_animl3_1_t', bodyKey: 'data.intro.island_animl3_1_b', emoji: '🎓' },
            ],
            tasks: [
              { id: 'ianiml3-t1', type: 'multiple_choice', questionKey: 'data.tasks.pre_en_cow_word', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_en_cat', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_en_cow', correct: true }, { id: 'c', textKey: 'data.tasks.pre_opt_en_dog', correct: false }] },
              { id: 'ianiml3-t2', type: 'multiple_choice', questionKey: 'data.tasks.pre_en_cow_sound', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_en_woof', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_en_meow', correct: false }, { id: 'c', textKey: 'data.tasks.pre_opt_en_moo', correct: true }] },
              { id: 'ianiml3-t3', type: 'multiple_choice', questionKey: 'data.tasks.pre_en_how_many_animal_words', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_two', correct: false }, { id: 'b', textKey: 'data.tasks.opt_three', correct: false }, { id: 'c', textKey: 'data.tasks.opt_four', correct: true }] },
              { id: 'ianiml3-t4', type: 'multiple_choice', questionKey: 'data.tasks.pre_en_which_swims', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_en_cat', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_en_bird', correct: false }, { id: 'c', textKey: 'data.tasks.pre_opt_en_fish', correct: true }] },
            ],
          },
        ],
      },
    ],
  },
  // ---
  {
    id: 'g1math', titleKey: 'data.worlds.g1math', descriptionKey: 'data.worldDesc.g1math',
    biome: 'town', accentColor: '#FF7043', npcEmoji: '🦁', ageBand: '7',
    topics: [
      { id: 'g1m-cnt20', worldId: 'g1math', titleKey: 'data.topics.g1mCnt20', subject: 'math', lessons: [
        { id: 'g1m-c20-l1', topicId: 'g1m-cnt20', titleKey: 'data.lessons.g1mC20L1',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1m_c20l1_0' }, { speaker: 'tali', textKey: 'data.dialog.g1m_c20l1_1' }],
          intro: [{ titleKey: 'data.intro.g1m_c20l1_0_t', bodyKey: 'data.intro.g1m_c20l1_0_b', emoji: '✏️' }, { titleKey: 'data.intro.g1m_c20l1_1_t', bodyKey: 'data.intro.g1m_c20l1_1_b', emoji: '✏️' }],
          tasks: [
            { id: 'g1c20l1t1', type: 'multiple_choice', questionKey: 'data.tasks.g1m_what_is_12', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_11', correct: false }, { id: 'b', textKey: 'data.tasks.opt_12', correct: true }, { id: 'c', textKey: 'data.tasks.opt_13', correct: false }] },
            { id: 'g1c20l1t2', type: 'multiple_choice', questionKey: 'data.tasks.g1m_after_13', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_13', correct: false }, { id: 'b', textKey: 'data.tasks.opt_14', correct: true }, { id: 'c', textKey: 'data.tasks.opt_15', correct: false }] },
            { id: 'g1c20l1t3', type: 'multiple_choice', questionKey: 'data.tasks.g1m_biggest_11_13_15', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_11', correct: false }, { id: 'b', textKey: 'data.tasks.opt_13', correct: false }, { id: 'c', textKey: 'data.tasks.opt_15', correct: true }] },
            { id: 'g1c20l1t4', type: 'input', questionKey: 'data.tasks.g1m_count_dots_14', difficulty: 2, answer: '14' },
          ] },
        { id: 'g1m-c20-l2', topicId: 'g1m-cnt20', titleKey: 'data.lessons.g1mC20L2',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1m_c20l2_0' }, { speaker: 'tali', textKey: 'data.dialog.g1m_c20l2_1' }],
          intro: [{ titleKey: 'data.intro.g1m_c20l2_0_t', bodyKey: 'data.intro.g1m_c20l2_0_b', emoji: '✏️' }, { titleKey: 'data.intro.g1m_c20l2_1_t', bodyKey: 'data.intro.g1m_c20l2_1_b', emoji: '🌍' }],
          tasks: [
            { id: 'g1c20l2t1', type: 'multiple_choice', questionKey: 'data.tasks.g1m_after_17', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_17', correct: false }, { id: 'b', textKey: 'data.tasks.opt_18', correct: true }, { id: 'c', textKey: 'data.tasks.opt_19', correct: false }] },
            { id: 'g1c20l2t2', type: 'multiple_choice', questionKey: 'data.tasks.g1m_before_20', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_18', correct: false }, { id: 'b', textKey: 'data.tasks.opt_19', correct: true }, { id: 'c', textKey: 'data.tasks.opt_20', correct: false }] },
            { id: 'g1c20l2t3', type: 'multiple_choice', questionKey: 'data.tasks.g1m_biggest_16_18_20', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_16', correct: false }, { id: 'b', textKey: 'data.tasks.opt_18', correct: false }, { id: 'c', textKey: 'data.tasks.opt_20', correct: true }] },
            { id: 'g1c20l2t4', type: 'input', questionKey: 'data.tasks.g1m_between_16_18', difficulty: 2, answer: '17' },
          ] },
        { id: 'g1m-c20-l3', topicId: 'g1m-cnt20', titleKey: 'data.lessons.g1mC20L3',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1m_c20l3_0' }, { speaker: 'tali', textKey: 'data.dialog.g1m_c20l3_1' }],
          intro: [{ titleKey: 'data.intro.g1m_c20l3_0_t', bodyKey: 'data.intro.g1m_c20l3_0_b', emoji: '🧪' }, { titleKey: 'data.intro.g1m_c20l3_1_t', bodyKey: 'data.intro.g1m_c20l3_1_b', emoji: '✏️' }],
          tasks: [
            { id: 'g1c20l3t1', type: 'multiple_choice', questionKey: 'data.tasks.g1m_compare_14_17', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_greater', correct: false }, { id: 'b', textKey: 'data.tasks.opt_less', correct: true }, { id: 'c', textKey: 'data.tasks.opt_equal', correct: false }] },
            { id: 'g1c20l3t2', type: 'multiple_choice', questionKey: 'data.tasks.g1m_compare_20_20', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_greater', correct: false }, { id: 'b', textKey: 'data.tasks.opt_less', correct: false }, { id: 'c', textKey: 'data.tasks.opt_equal', correct: true }] },
            { id: 'g1c20l3t3', type: 'multiple_choice', questionKey: 'data.tasks.g1m_smallest_19_11_15', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_19', correct: false }, { id: 'b', textKey: 'data.tasks.opt_11', correct: true }, { id: 'c', textKey: 'data.tasks.opt_15', correct: false }] },
            { id: 'g1c20l3t4', type: 'multiple_choice', questionKey: 'data.tasks.g1m_order_asc', difficulty: 3, options: [{ id: 'a', textKey: 'data.tasks.opt_order_12_15_18', correct: true }, { id: 'b', textKey: 'data.tasks.opt_order_18_15_12', correct: false }, { id: 'c', textKey: 'data.tasks.opt_order_15_12_18', correct: false }] },
          ] },
      ] },
      { id: 'g1m-add', worldId: 'g1math', titleKey: 'data.topics.g1mAdd', subject: 'math', lessons: [
        { id: 'g1m-add-l1', topicId: 'g1m-add', titleKey: 'data.lessons.g1mAddL1',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1m_addl1_0' }, { speaker: 'tali', textKey: 'data.dialog.g1m_addl1_1' }],
          intro: [{ titleKey: 'data.intro.g1m_addl1_0_t', bodyKey: 'data.intro.g1m_addl1_0_b', emoji: '➕' }, { titleKey: 'data.intro.g1m_addl1_1_t', bodyKey: 'data.intro.g1m_addl1_1_b', emoji: '🍎' }],
          tasks: [
            { id: 'g1addl1t1', type: 'multiple_choice', questionKey: 'data.tasks.g1m_3plus4', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_six', correct: false }, { id: 'b', textKey: 'data.tasks.opt_seven', correct: true }, { id: 'c', textKey: 'data.tasks.opt_eight', correct: false }] },
            { id: 'g1addl1t2', type: 'multiple_choice', questionKey: 'data.tasks.g1m_2plus6', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_seven', correct: false }, { id: 'b', textKey: 'data.tasks.opt_eight', correct: true }, { id: 'c', textKey: 'data.tasks.opt_nine', correct: false }] },
            { id: 'g1addl1t3', type: 'multiple_choice', questionKey: 'data.tasks.g1m_4plus5', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_eight', correct: false }, { id: 'b', textKey: 'data.tasks.opt_nine', correct: true }, { id: 'c', textKey: 'data.tasks.opt_ten', correct: false }] },
            { id: 'g1addl1t4', type: 'input', questionKey: 'data.tasks.g1m_2plus3', difficulty: 1, answer: '5' },
          ] },
        { id: 'g1m-add-l2', topicId: 'g1m-add', titleKey: 'data.lessons.g1mAddL2',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1m_addl2_0' }, { speaker: 'tali', textKey: 'data.dialog.g1m_addl2_1' }],
          intro: [{ titleKey: 'data.intro.g1m_addl2_0_t', bodyKey: 'data.intro.g1m_addl2_0_b', emoji: '✏️' }, { titleKey: 'data.intro.g1m_addl2_1_t', bodyKey: 'data.intro.g1m_addl2_1_b', emoji: '➕' }],
          tasks: [
            { id: 'g1addl2t1', type: 'multiple_choice', questionKey: 'data.tasks.g1m_missing_7_plus_10', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_two', correct: false }, { id: 'b', textKey: 'data.tasks.opt_three', correct: true }, { id: 'c', textKey: 'data.tasks.opt_four', correct: false }] },
            { id: 'g1addl2t2', type: 'multiple_choice', questionKey: 'data.tasks.g1m_missing_4_plus_10', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_four', correct: false }, { id: 'b', textKey: 'data.tasks.opt_six', correct: true }, { id: 'c', textKey: 'data.tasks.opt_eight', correct: false }] },
            { id: 'g1addl2t3', type: 'input', questionKey: 'data.tasks.g1m_8plus2', difficulty: 1, answer: '10' },
            { id: 'g1addl2t4', type: 'input', questionKey: 'data.tasks.g1m_9plus1', difficulty: 1, answer: '10' },
          ] },
        { id: 'g1m-add-l3', topicId: 'g1m-add', titleKey: 'data.lessons.g1mAddL3',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1m_addl3_0' }, { speaker: 'tali', textKey: 'data.dialog.g1m_addl3_1' }],
          intro: [{ titleKey: 'data.intro.g1m_addl3_0_t', bodyKey: 'data.intro.g1m_addl3_0_b', emoji: '➕' }, { titleKey: 'data.intro.g1m_addl3_1_t', bodyKey: 'data.intro.g1m_addl3_1_b', emoji: '✏️' }],
          tasks: [
            { id: 'g1addl3t1', type: 'multiple_choice', questionKey: 'data.tasks.g1m_10plus5', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_13', correct: false }, { id: 'b', textKey: 'data.tasks.opt_15', correct: true }, { id: 'c', textKey: 'data.tasks.opt_17', correct: false }] },
            { id: 'g1addl3t2', type: 'multiple_choice', questionKey: 'data.tasks.g1m_10plus8', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_16', correct: false }, { id: 'b', textKey: 'data.tasks.opt_18', correct: true }, { id: 'c', textKey: 'data.tasks.opt_20', correct: false }] },
            { id: 'g1addl3t3', type: 'input', questionKey: 'data.tasks.g1m_9plus7', difficulty: 2, answer: '16' },
            { id: 'g1addl3t4', type: 'input', questionKey: 'data.tasks.g1m_8plus6', difficulty: 2, answer: '14' },
          ] },
      ] },
      { id: 'g1m-sub', worldId: 'g1math', titleKey: 'data.topics.g1mSub', subject: 'math', lessons: [
        { id: 'g1m-sub-l1', topicId: 'g1m-sub', titleKey: 'data.lessons.g1mSubL1',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1m_subl1_0' }, { speaker: 'tali', textKey: 'data.dialog.g1m_subl1_1' }],
          intro: [{ titleKey: 'data.intro.g1m_subl1_0_t', bodyKey: 'data.intro.g1m_subl1_0_b', emoji: '➖' }, { titleKey: 'data.intro.g1m_subl1_1_t', bodyKey: 'data.intro.g1m_subl1_1_b', emoji: '❓' }],
          tasks: [
            { id: 'g1subl1t1', type: 'multiple_choice', questionKey: 'data.tasks.g1m_7minus3', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_three', correct: false }, { id: 'b', textKey: 'data.tasks.opt_four', correct: true }, { id: 'c', textKey: 'data.tasks.opt_five', correct: false }] },
            { id: 'g1subl1t2', type: 'multiple_choice', questionKey: 'data.tasks.g1m_8minus5', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_two', correct: false }, { id: 'b', textKey: 'data.tasks.opt_three', correct: true }, { id: 'c', textKey: 'data.tasks.opt_four', correct: false }] },
            { id: 'g1subl1t3', type: 'multiple_choice', questionKey: 'data.tasks.g1m_9minus4', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_four', correct: false }, { id: 'b', textKey: 'data.tasks.opt_five', correct: true }, { id: 'c', textKey: 'data.tasks.opt_six', correct: false }] },
            { id: 'g1subl1t4', type: 'input', questionKey: 'data.tasks.g1m_6minus2', difficulty: 1, answer: '4' },
          ] },
        { id: 'g1m-sub-l2', topicId: 'g1m-sub', titleKey: 'data.lessons.g1mSubL2',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1m_subl2_0' }, { speaker: 'tali', textKey: 'data.dialog.g1m_subl2_1' }],
          intro: [{ titleKey: 'data.intro.g1m_subl2_0_t', bodyKey: 'data.intro.g1m_subl2_0_b', emoji: '✏️' }, { titleKey: 'data.intro.g1m_subl2_1_t', bodyKey: 'data.intro.g1m_subl2_1_b', emoji: '➖' }],
          tasks: [
            { id: 'g1subl2t1', type: 'multiple_choice', questionKey: 'data.tasks.g1m_10minus3', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_six', correct: false }, { id: 'b', textKey: 'data.tasks.opt_seven', correct: true }, { id: 'c', textKey: 'data.tasks.opt_eight', correct: false }] },
            { id: 'g1subl2t2', type: 'multiple_choice', questionKey: 'data.tasks.g1m_10minus7', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_two', correct: false }, { id: 'b', textKey: 'data.tasks.opt_three', correct: true }, { id: 'c', textKey: 'data.tasks.opt_four', correct: false }] },
            { id: 'g1subl2t3', type: 'input', questionKey: 'data.tasks.g1m_10minus5', difficulty: 1, answer: '5' },
            { id: 'g1subl2t4', type: 'input', questionKey: 'data.tasks.g1m_10minus1', difficulty: 1, answer: '9' },
          ] },
        { id: 'g1m-sub-l3', topicId: 'g1m-sub', titleKey: 'data.lessons.g1mSubL3',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1m_subl3_0' }, { speaker: 'tali', textKey: 'data.dialog.g1m_subl3_1' }],
          intro: [{ titleKey: 'data.intro.g1m_subl3_0_t', bodyKey: 'data.intro.g1m_subl3_0_b', emoji: '✏️' }, { titleKey: 'data.intro.g1m_subl3_1_t', bodyKey: 'data.intro.g1m_subl3_1_b', emoji: '🌐' }],
          tasks: [
            { id: 'g1subl3t1', type: 'input', questionKey: 'data.tasks.g1m_10minus4', difficulty: 1, answer: '6' },
            { id: 'g1subl3t2', type: 'input', questionKey: 'data.tasks.g1m_mixed_5plus4minus3', difficulty: 2, answer: '6' },
            { id: 'g1subl3t3', type: 'multiple_choice', questionKey: 'data.tasks.g1m_missing_sub_7minus_eq5', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_one', correct: false }, { id: 'b', textKey: 'data.tasks.opt_two', correct: true }, { id: 'c', textKey: 'data.tasks.opt_three', correct: false }] },
            { id: 'g1subl3t4', type: 'multiple_choice', questionKey: 'data.tasks.g1m_8minus3_check', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },
          ] },
      ] },
    ],
  },
  {
    id: 'g1rus', titleKey: 'data.worlds.g1rus', descriptionKey: 'data.worldDesc.g1rus',
    biome: 'village', accentColor: '#FFC107', npcEmoji: '📚', ageBand: '7',
    topics: [
      { id: 'g1r-vowels', worldId: 'g1rus', titleKey: 'data.topics.g1rVowels', subject: 'reading_ru', lessons: [
        { id: 'g1r-vow-l1', topicId: 'g1r-vowels', titleKey: 'data.lessons.g1rVowL1',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1r_vowl1_0' }, { speaker: 'tali', textKey: 'data.dialog.g1r_vowl1_1' }],
          intro: [{ titleKey: 'data.intro.g1r_vowl1_0_t', bodyKey: 'data.intro.g1r_vowl1_0_b', emoji: '✏️' }, { titleKey: 'data.intro.g1r_vowl1_1_t', bodyKey: 'data.intro.g1r_vowl1_1_b', emoji: '🏗️' }],
          tasks: [
            { id: 'g1rvowl1t1', type: 'multiple_choice', questionKey: 'data.tasks.g1r_which_vowel_abc', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1r_opt_A', correct: true }, { id: 'b', textKey: 'data.tasks.g1r_opt_B', correct: false }, { id: 'c', textKey: 'data.tasks.g1r_opt_V', correct: false }] },
            { id: 'g1rvowl1t2', type: 'multiple_choice', questionKey: 'data.tasks.g1r_utka_first_letter', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1r_opt_A', correct: false }, { id: 'b', textKey: 'data.tasks.g1r_opt_U', correct: true }, { id: 'c', textKey: 'data.tasks.g1r_opt_O', correct: false }] },
            { id: 'g1rvowl1t3', type: 'multiple_choice', questionKey: 'data.tasks.g1r_okno_missing', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g1r_opt_A', correct: false }, { id: 'b', textKey: 'data.tasks.g1r_opt_O', correct: true }, { id: 'c', textKey: 'data.tasks.g1r_opt_U', correct: false }] },
            { id: 'g1rvowl1t4', type: 'multiple_choice', questionKey: 'data.tasks.g1r_mak_vowels', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_one', correct: true }, { id: 'b', textKey: 'data.tasks.opt_two', correct: false }, { id: 'c', textKey: 'data.tasks.opt_three', correct: false }] },
          ] },
        { id: 'g1r-vow-l2', topicId: 'g1r-vowels', titleKey: 'data.lessons.g1rVowL2',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1r_vowl2_0' }, { speaker: 'tali', textKey: 'data.dialog.g1r_vowl2_1' }],
          intro: [{ titleKey: 'data.intro.g1r_vowl2_0_t', bodyKey: 'data.intro.g1r_vowl2_0_b', emoji: '✏️' }, { titleKey: 'data.intro.g1r_vowl2_1_t', bodyKey: 'data.intro.g1r_vowl2_1_b', emoji: '✏️' }],
          tasks: [
            { id: 'g1rvowl2t1', type: 'multiple_choice', questionKey: 'data.tasks.g1r_which_vowel_soft', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1r_opt_Ya', correct: true }, { id: 'b', textKey: 'data.tasks.g1r_opt_D', correct: false }, { id: 'c', textKey: 'data.tasks.g1r_opt_T', correct: false }] },
            { id: 'g1rvowl2t2', type: 'multiple_choice', questionKey: 'data.tasks.g1r_yula_first', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1r_opt_Yu', correct: true }, { id: 'b', textKey: 'data.tasks.g1r_opt_Ya', correct: false }, { id: 'c', textKey: 'data.tasks.g1r_opt_Ye', correct: false }] },
            { id: 'g1rvowl2t3', type: 'multiple_choice', questionKey: 'data.tasks.g1r_moya_vowels', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_one', correct: false }, { id: 'b', textKey: 'data.tasks.opt_two', correct: true }, { id: 'c', textKey: 'data.tasks.opt_three', correct: false }] },
            { id: 'g1rvowl2t4', type: 'multiple_choice', questionKey: 'data.tasks.g1r_pair_a_ya', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g1r_opt_Ye', correct: false }, { id: 'b', textKey: 'data.tasks.g1r_opt_Yo', correct: true }, { id: 'c', textKey: 'data.tasks.g1r_opt_Yu', correct: false }] },
          ] },
        { id: 'g1r-vow-l3', topicId: 'g1r-vowels', titleKey: 'data.lessons.g1rVowL3',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1r_vowl3_0' }, { speaker: 'tali', textKey: 'data.dialog.g1r_vowl3_1' }],
          intro: [{ titleKey: 'data.intro.g1r_vowl3_0_t', bodyKey: 'data.intro.g1r_vowl3_0_b', emoji: '📖' }, { titleKey: 'data.intro.g1r_vowl3_1_t', bodyKey: 'data.intro.g1r_vowl3_1_b', emoji: '✏️' }],
          tasks: [
            { id: 'g1rvowl3t1', type: 'multiple_choice', questionKey: 'data.tasks.g1r_kon_soft', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },
            { id: 'g1rvowl3t2', type: 'multiple_choice', questionKey: 'data.tasks.g1r_nos_soft', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_soft', correct: false }, { id: 'b', textKey: 'data.tasks.opt_hard', correct: true }] },
            { id: 'g1rvowl3t3', type: 'multiple_choice', questionKey: 'data.tasks.g1r_how_many_vowels_10', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_six', correct: false }, { id: 'b', textKey: 'data.tasks.opt_eight', correct: false }, { id: 'c', textKey: 'data.tasks.opt_ten', correct: true }] },
            { id: 'g1rvowl3t4', type: 'multiple_choice', questionKey: 'data.tasks.g1r_myach_has_soft', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },
          ] },
      ] },
      { id: 'g1r-words', worldId: 'g1rus', titleKey: 'data.topics.g1rWords', subject: 'reading_ru', lessons: [
        { id: 'g1r-wrd-l1', topicId: 'g1r-words', titleKey: 'data.lessons.g1rWrdL1',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1r_wrdl1_0' }, { speaker: 'tali', textKey: 'data.dialog.g1r_wrdl1_1' }],
          intro: [{ titleKey: 'data.intro.g1r_wrdl1_0_t', bodyKey: 'data.intro.g1r_wrdl1_0_b', emoji: '🅱️' }, { titleKey: 'data.intro.g1r_wrdl1_1_t', bodyKey: 'data.intro.g1r_wrdl1_1_b', emoji: '🍖' }],
          tasks: [
            { id: 'g1rwrdl1t1', type: 'multiple_choice', questionKey: 'data.tasks.g1r_read_kot', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1r_opt_kit', correct: false }, { id: 'b', textKey: 'data.tasks.g1r_opt_kot', correct: true }, { id: 'c', textKey: 'data.tasks.g1r_opt_kat', correct: false }] },
            { id: 'g1rwrdl1t2', type: 'multiple_choice', questionKey: 'data.tasks.g1r_som_missing', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1r_opt_M', correct: true }, { id: 'b', textKey: 'data.tasks.g1r_opt_N', correct: false }, { id: 'c', textKey: 'data.tasks.g1r_opt_R', correct: false }] },
            { id: 'g1rwrdl1t3', type: 'multiple_choice', questionKey: 'data.tasks.g1r_dom_letters', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_two', correct: false }, { id: 'b', textKey: 'data.tasks.opt_three', correct: true }, { id: 'c', textKey: 'data.tasks.opt_four', correct: false }] },
            { id: 'g1rwrdl1t4', type: 'multiple_choice', questionKey: 'data.tasks.g1r_som_syllables', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_one', correct: true }, { id: 'b', textKey: 'data.tasks.opt_two', correct: false }, { id: 'c', textKey: 'data.tasks.opt_three', correct: false }] },
          ] },
        { id: 'g1r-wrd-l2', topicId: 'g1r-words', titleKey: 'data.lessons.g1rWrdL2',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1r_wrdl2_0' }, { speaker: 'tali', textKey: 'data.dialog.g1r_wrdl2_1' }],
          intro: [{ titleKey: 'data.intro.g1r_wrdl2_0_t', bodyKey: 'data.intro.g1r_wrdl2_0_b', emoji: '🐘' }, { titleKey: 'data.intro.g1r_wrdl2_1_t', bodyKey: 'data.intro.g1r_wrdl2_1_b', emoji: '🍖' }],
          tasks: [
            { id: 'g1rwrdl2t1', type: 'multiple_choice', questionKey: 'data.tasks.g1r_read_stol', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1r_opt_stol', correct: true }, { id: 'b', textKey: 'data.tasks.g1r_opt_stul', correct: false }, { id: 'c', textKey: 'data.tasks.g1r_opt_ston', correct: false }] },
            { id: 'g1rwrdl2t2', type: 'multiple_choice', questionKey: 'data.tasks.g1r_slon_missing', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1r_opt_S', correct: true }, { id: 'b', textKey: 'data.tasks.g1r_opt_Z', correct: false }, { id: 'c', textKey: 'data.tasks.g1r_opt_Sh', correct: false }] },
            { id: 'g1rwrdl2t3', type: 'multiple_choice', questionKey: 'data.tasks.g1r_trava_syllables', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_one', correct: false }, { id: 'b', textKey: 'data.tasks.opt_two', correct: true }, { id: 'c', textKey: 'data.tasks.opt_three', correct: false }] },
            { id: 'g1rwrdl2t4', type: 'multiple_choice', questionKey: 'data.tasks.g1r_kniga_means', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g1r_opt_book_word', correct: true }, { id: 'b', textKey: 'data.tasks.g1r_opt_bag_word', correct: false }, { id: 'c', textKey: 'data.tasks.g1r_opt_pen_word', correct: false }] },
          ] },
        { id: 'g1r-wrd-l3', topicId: 'g1r-words', titleKey: 'data.lessons.g1rWrdL3',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1r_wrdl3_0' }, { speaker: 'tali', textKey: 'data.dialog.g1r_wrdl3_1' }],
          intro: [{ titleKey: 'data.intro.g1r_wrdl3_0_t', bodyKey: 'data.intro.g1r_wrdl3_0_b', emoji: '✏️' }, { titleKey: 'data.intro.g1r_wrdl3_1_t', bodyKey: 'data.intro.g1r_wrdl3_1_b', emoji: '🌙' }],
          tasks: [
            { id: 'g1rwrdl3t1', type: 'multiple_choice', questionKey: 'data.tasks.g1r_mama_myla_words', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_two', correct: false }, { id: 'b', textKey: 'data.tasks.opt_three', correct: true }, { id: 'c', textKey: 'data.tasks.opt_four', correct: false }] },
            { id: 'g1rwrdl3t2', type: 'multiple_choice', questionKey: 'data.tasks.g1r_sentence_starts_capital', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },
            { id: 'g1rwrdl3t3', type: 'multiple_choice', questionKey: 'data.tasks.g1r_sentence_ends_dot', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g1r_opt_dot', correct: true }, { id: 'b', textKey: 'data.tasks.g1r_opt_comma', correct: false }, { id: 'c', textKey: 'data.tasks.g1r_opt_question', correct: false }] },
            { id: 'g1rwrdl3t4', type: 'multiple_choice', questionKey: 'data.tasks.g1r_sonce_syllables', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_two', correct: true }, { id: 'b', textKey: 'data.tasks.opt_three', correct: false }, { id: 'c', textKey: 'data.tasks.opt_four', correct: false }] },
          ] },
      ] },
      { id: 'g1r-gram', worldId: 'g1rus', titleKey: 'data.topics.g1rGram', subject: 'reading_ru', lessons: [
        { id: 'g1r-grm-l1', topicId: 'g1r-gram', titleKey: 'data.lessons.g1rGrmL1',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1r_grml1_0' }, { speaker: 'tali', textKey: 'data.dialog.g1r_grml1_1' }],
          intro: [{ titleKey: 'data.intro.g1r_grml1_0_t', bodyKey: 'data.intro.g1r_grml1_0_b', emoji: '✏️' }, { titleKey: 'data.intro.g1r_grml1_1_t', bodyKey: 'data.intro.g1r_grml1_1_b', emoji: '1️⃣' }],
          tasks: [
            { id: 'g1rgrml1t1', type: 'multiple_choice', questionKey: 'data.tasks.g1r_name_uppercase', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1r_opt_MASHA', correct: true }, { id: 'b', textKey: 'data.tasks.g1r_opt_masha', correct: false }] },
            { id: 'g1rgrml1t2', type: 'multiple_choice', questionKey: 'data.tasks.g1r_city_capital', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },
            { id: 'g1rgrml1t3', type: 'multiple_choice', questionKey: 'data.tasks.g1r_correct_cat_sentence', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g1r_opt_moy_kot', correct: false }, { id: 'b', textKey: 'data.tasks.g1r_opt_Moy_kot', correct: true }, { id: 'c', textKey: 'data.tasks.g1r_opt_Moy_Kot', correct: false }] },
            { id: 'g1rgrml1t4', type: 'multiple_choice', questionKey: 'data.tasks.g1r_what_gets_capital', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g1r_opt_names_cities', correct: true }, { id: 'b', textKey: 'data.tasks.g1r_opt_all_nouns', correct: false }, { id: 'c', textKey: 'data.tasks.g1r_opt_all_verbs', correct: false }] },
          ] },
        { id: 'g1r-grm-l2', topicId: 'g1r-gram', titleKey: 'data.lessons.g1rGrmL2',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1r_grml2_0' }, { speaker: 'tali', textKey: 'data.dialog.g1r_grml2_1' }],
          intro: [{ titleKey: 'data.intro.g1r_grml2_0_t', bodyKey: 'data.intro.g1r_grml2_0_b', emoji: '.' }, { titleKey: 'data.intro.g1r_grml2_1_t', bodyKey: 'data.intro.g1r_grml2_1_b', emoji: '?' }],
          tasks: [
            { id: 'g1rgrml2t1', type: 'multiple_choice', questionKey: 'data.tasks.g1r_period_where', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1r_opt_sent_start', correct: false }, { id: 'b', textKey: 'data.tasks.g1r_opt_sent_middle', correct: false }, { id: 'c', textKey: 'data.tasks.g1r_opt_sent_end', correct: true }] },
            { id: 'g1rgrml2t2', type: 'multiple_choice', questionKey: 'data.tasks.g1r_question_sign', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1r_opt_dot', correct: false }, { id: 'b', textKey: 'data.tasks.g1r_opt_question', correct: true }, { id: 'c', textKey: 'data.tasks.g1r_opt_exclaim', correct: false }] },
            { id: 'g1rgrml2t3', type: 'multiple_choice', questionKey: 'data.tasks.g1r_exclaim_means', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g1r_opt_question_mean', correct: false }, { id: 'b', textKey: 'data.tasks.g1r_opt_exclaim_mean', correct: true }, { id: 'c', textKey: 'data.tasks.g1r_opt_neutral_mean', correct: false }] },
            { id: 'g1rgrml2t4', type: 'multiple_choice', questionKey: 'data.tasks.g1r_privet_sasha_sign', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g1r_opt_privet_dot', correct: false }, { id: 'b', textKey: 'data.tasks.g1r_opt_privet_exclaim', correct: true }, { id: 'c', textKey: 'data.tasks.g1r_opt_privet_question', correct: false }] },
          ] },
        { id: 'g1r-grm-l3', topicId: 'g1r-gram', titleKey: 'data.lessons.g1rGrmL3',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1r_grml3_0' }, { speaker: 'tali', textKey: 'data.dialog.g1r_grml3_1' }],
          intro: [{ titleKey: 'data.intro.g1r_grml3_0_t', bodyKey: 'data.intro.g1r_grml3_0_b', emoji: '✏️' }, { titleKey: 'data.intro.g1r_grml3_1_t', bodyKey: 'data.intro.g1r_grml3_1_b', emoji: '🐀' }],
          tasks: [
            { id: 'g1rgrml3t1', type: 'multiple_choice', questionKey: 'data.tasks.g1r_kto_answers', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1r_opt_animate', correct: true }, { id: 'b', textKey: 'data.tasks.g1r_opt_inanimate', correct: false }] },
            { id: 'g1rgrml3t2', type: 'multiple_choice', questionKey: 'data.tasks.g1r_chto_answers', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1r_opt_animate', correct: false }, { id: 'b', textKey: 'data.tasks.g1r_opt_inanimate', correct: true }] },
            { id: 'g1rgrml3t3', type: 'multiple_choice', questionKey: 'data.tasks.g1r_kto_kot_stol', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g1r_opt_kot', correct: true }, { id: 'b', textKey: 'data.tasks.g1r_opt_stol_word', correct: false }] },
            { id: 'g1rgrml3t4', type: 'multiple_choice', questionKey: 'data.tasks.g1r_kto_question', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g1r_opt_dog_word', correct: true }, { id: 'b', textKey: 'data.tasks.g1r_opt_sky_word', correct: false }, { id: 'c', textKey: 'data.tasks.g1r_opt_book_word', correct: false }] },
          ] },
      ] },
    ],
  },
  {
    id: 'g1world', titleKey: 'data.worlds.g1world', descriptionKey: 'data.worldDesc.g1world',
    biome: 'park', accentColor: '#8BC34A', npcEmoji: '🦊', ageBand: '7',
    topics: [
      { id: 'g1w-school', worldId: 'g1world', titleKey: 'data.topics.g1wSchool', subject: 'logic', lessons: [
        { id: 'g1w-sch-l1', topicId: 'g1w-school', titleKey: 'data.lessons.g1wSchL1',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1w_schl1_0' }, { speaker: 'tali', textKey: 'data.dialog.g1w_schl1_1' }],
          intro: [{ titleKey: 'data.intro.g1w_schl1_0_t', bodyKey: 'data.intro.g1w_schl1_0_b', emoji: '✏️' }, { titleKey: 'data.intro.g1w_schl1_1_t', bodyKey: 'data.intro.g1w_schl1_1_b', emoji: '🏫' }],
          tasks: [
            { id: 'g1wschl1t1', type: 'multiple_choice', questionKey: 'data.tasks.g1w_school_supply', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1w_opt_pencil', correct: true }, { id: 'b', textKey: 'data.tasks.g1w_opt_sandwich', correct: false }, { id: 'c', textKey: 'data.tasks.g1w_opt_toy', correct: false }] },
            { id: 'g1wschl1t2', type: 'multiple_choice', questionKey: 'data.tasks.g1w_write_with', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1w_opt_pen', correct: true }, { id: 'b', textKey: 'data.tasks.g1w_opt_spoon', correct: false }, { id: 'c', textKey: 'data.tasks.g1w_opt_scissors', correct: false }] },
            { id: 'g1wschl1t3', type: 'multiple_choice', questionKey: 'data.tasks.g1w_books_in', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1w_opt_backpack', correct: true }, { id: 'b', textKey: 'data.tasks.g1w_opt_bucket', correct: false }, { id: 'c', textKey: 'data.tasks.g1w_opt_box', correct: false }] },
            { id: 'g1wschl1t4', type: 'multiple_choice', questionKey: 'data.tasks.g1w_ruler_corners', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_two', correct: false }, { id: 'b', textKey: 'data.tasks.opt_three', correct: false }, { id: 'c', textKey: 'data.tasks.opt_four', correct: true }] },
          ] },
        { id: 'g1w-sch-l2', topicId: 'g1w-school', titleKey: 'data.lessons.g1wSchL2',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1w_schl2_0' }, { speaker: 'tali', textKey: 'data.dialog.g1w_schl2_1' }],
          intro: [{ titleKey: 'data.intro.g1w_schl2_0_t', bodyKey: 'data.intro.g1w_schl2_0_b', emoji: '🏫' }, { titleKey: 'data.intro.g1w_schl2_1_t', bodyKey: 'data.intro.g1w_schl2_1_b', emoji: '✏️' }],
          tasks: [
            { id: 'g1wschl2t1', type: 'multiple_choice', questionKey: 'data.tasks.g1w_teacher_writes_on', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1w_opt_board', correct: true }, { id: 'b', textKey: 'data.tasks.g1w_opt_window', correct: false }, { id: 'c', textKey: 'data.tasks.g1w_opt_door', correct: false }] },
            { id: 'g1wschl2t2', type: 'multiple_choice', questionKey: 'data.tasks.g1w_sit_on', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1w_opt_table', correct: false }, { id: 'b', textKey: 'data.tasks.g1w_opt_chair', correct: true }, { id: 'c', textKey: 'data.tasks.g1w_opt_board', correct: false }] },
            { id: 'g1wschl2t3', type: 'multiple_choice', questionKey: 'data.tasks.g1w_how_many_seasons', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_two', correct: false }, { id: 'b', textKey: 'data.tasks.opt_three', correct: false }, { id: 'c', textKey: 'data.tasks.opt_four', correct: true }] },
            { id: 'g1wschl2t4', type: 'multiple_choice', questionKey: 'data.tasks.g1w_school_subjects', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g1w_opt_math_subject', correct: true }, { id: 'b', textKey: 'data.tasks.g1w_opt_cooking_subject', correct: false }, { id: 'c', textKey: 'data.tasks.g1w_opt_farming_subject', correct: false }] },
          ] },
        { id: 'g1w-sch-l3', topicId: 'g1w-school', titleKey: 'data.lessons.g1wSchL3',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1w_schl3_0' }, { speaker: 'tali', textKey: 'data.dialog.g1w_schl3_1' }],
          intro: [{ titleKey: 'data.intro.g1w_schl3_0_t', bodyKey: 'data.intro.g1w_schl3_0_b', emoji: '🤍' }, { titleKey: 'data.intro.g1w_schl3_1_t', bodyKey: 'data.intro.g1w_schl3_1_b', emoji: '🏄' }],
          tasks: [
            { id: 'g1wschl3t1', type: 'multiple_choice', questionKey: 'data.tasks.g1w_pe_class_do', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1w_opt_read', correct: false }, { id: 'b', textKey: 'data.tasks.g1w_opt_run', correct: true }, { id: 'c', textKey: 'data.tasks.g1w_opt_draw', correct: false }] },
            { id: 'g1wschl3t2', type: 'multiple_choice', questionKey: 'data.tasks.g1w_art_class_do', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1w_opt_count', correct: false }, { id: 'b', textKey: 'data.tasks.g1w_opt_draw', correct: true }, { id: 'c', textKey: 'data.tasks.g1w_opt_sing', correct: false }] },
            { id: 'g1wschl3t3', type: 'multiple_choice', questionKey: 'data.tasks.g1w_math_teaches', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1w_opt_numbers', correct: true }, { id: 'b', textKey: 'data.tasks.g1w_opt_drawing_sk', correct: false }, { id: 'c', textKey: 'data.tasks.g1w_opt_singing_sk', correct: false }] },
            { id: 'g1wschl3t4', type: 'multiple_choice', questionKey: 'data.tasks.g1w_raise_hand', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },
          ] },
      ] },
      { id: 'g1w-nature', worldId: 'g1world', titleKey: 'data.topics.g1wNature', subject: 'logic', lessons: [
        { id: 'g1w-nat-l1', topicId: 'g1w-nature', titleKey: 'data.lessons.g1wNatL1',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1w_natl1_0' }, { speaker: 'tali', textKey: 'data.dialog.g1w_natl1_1' }],
          intro: [{ titleKey: 'data.intro.g1w_natl1_0_t', bodyKey: 'data.intro.g1w_natl1_0_b', emoji: '🌲' }, { titleKey: 'data.intro.g1w_natl1_1_t', bodyKey: 'data.intro.g1w_natl1_1_b', emoji: '🌳' }],
          tasks: [
            { id: 'g1wnatl1t1', type: 'multiple_choice', questionKey: 'data.tasks.g1w_which_is_tree', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1w_opt_oak', correct: true }, { id: 'b', textKey: 'data.tasks.g1w_opt_rose', correct: false }, { id: 'c', textKey: 'data.tasks.g1w_opt_mushroom', correct: false }] },
            { id: 'g1wnatl1t2', type: 'multiple_choice', questionKey: 'data.tasks.g1w_tree_drinks', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1w_opt_leaves', correct: false }, { id: 'b', textKey: 'data.tasks.g1w_opt_roots', correct: true }, { id: 'c', textKey: 'data.tasks.g1w_opt_trunk', correct: false }] },
            { id: 'g1wnatl1t3', type: 'multiple_choice', questionKey: 'data.tasks.g1w_leaves_change', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1w_opt_spring', correct: false }, { id: 'b', textKey: 'data.tasks.g1w_opt_summer', correct: false }, { id: 'c', textKey: 'data.tasks.g1w_opt_autumn', correct: true }] },
            { id: 'g1wnatl1t4', type: 'multiple_choice', questionKey: 'data.tasks.g1w_apples_on', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g1w_opt_apple_tree', correct: true }, { id: 'b', textKey: 'data.tasks.g1w_opt_oak', correct: false }, { id: 'c', textKey: 'data.tasks.g1w_opt_pine', correct: false }] },
          ] },
        { id: 'g1w-nat-l2', topicId: 'g1w-nature', titleKey: 'data.lessons.g1wNatL2',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1w_natl2_0' }, { speaker: 'tali', textKey: 'data.dialog.g1w_natl2_1' }],
          intro: [{ titleKey: 'data.intro.g1w_natl2_0_t', bodyKey: 'data.intro.g1w_natl2_0_b', emoji: '🐘' }, { titleKey: 'data.intro.g1w_natl2_1_t', bodyKey: 'data.intro.g1w_natl2_1_b', emoji: '🐄' }],
          tasks: [
            { id: 'g1wnatl2t1', type: 'multiple_choice', questionKey: 'data.tasks.g1w_forest_animal', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1w_opt_cow_an', correct: false }, { id: 'b', textKey: 'data.tasks.g1w_opt_wolf_an', correct: true }, { id: 'c', textKey: 'data.tasks.g1w_opt_hen_an', correct: false }] },
            { id: 'g1wnatl2t2', type: 'multiple_choice', questionKey: 'data.tasks.g1w_domestic_animal', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1w_opt_wolf_an', correct: false }, { id: 'b', textKey: 'data.tasks.g1w_opt_bear_an', correct: false }, { id: 'c', textKey: 'data.tasks.g1w_opt_cat_an', correct: true }] },
            { id: 'g1wnatl2t3', type: 'multiple_choice', questionKey: 'data.tasks.g1w_cow_gives', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1w_opt_eggs', correct: false }, { id: 'b', textKey: 'data.tasks.g1w_opt_milk', correct: true }, { id: 'c', textKey: 'data.tasks.g1w_opt_honey', correct: false }] },
            { id: 'g1wnatl2t4', type: 'multiple_choice', questionKey: 'data.tasks.g1w_who_gives_honey', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g1w_opt_bee', correct: true }, { id: 'b', textKey: 'data.tasks.g1w_opt_ant', correct: false }, { id: 'c', textKey: 'data.tasks.g1w_opt_butterfly', correct: false }] },
          ] },
        { id: 'g1w-nat-l3', topicId: 'g1w-nature', titleKey: 'data.lessons.g1wNatL3',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1w_natl3_0' }, { speaker: 'tali', textKey: 'data.dialog.g1w_natl3_1' }],
          intro: [{ titleKey: 'data.intro.g1w_natl3_0_t', bodyKey: 'data.intro.g1w_natl3_0_b', emoji: '➡️' }, { titleKey: 'data.intro.g1w_natl3_1_t', bodyKey: 'data.intro.g1w_natl3_1_b', emoji: '🌐' }],
          tasks: [
            { id: 'g1wnatl3t1', type: 'multiple_choice', questionKey: 'data.tasks.g1w_winter_falls', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1w_opt_rain', correct: false }, { id: 'b', textKey: 'data.tasks.g1w_opt_snow', correct: true }, { id: 'c', textKey: 'data.tasks.g1w_opt_hail', correct: false }] },
            { id: 'g1wnatl3t2', type: 'multiple_choice', questionKey: 'data.tasks.g1w_warmest_season', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1w_opt_spring', correct: false }, { id: 'b', textKey: 'data.tasks.g1w_opt_summer', correct: true }, { id: 'c', textKey: 'data.tasks.g1w_opt_autumn', correct: false }] },
            { id: 'g1wnatl3t3', type: 'multiple_choice', questionKey: 'data.tasks.g1w_thunder_storm', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g1w_opt_fog_w', correct: false }, { id: 'b', textKey: 'data.tasks.g1w_opt_storm_w', correct: true }, { id: 'c', textKey: 'data.tasks.g1w_opt_snow_w', correct: false }] },
            { id: 'g1wnatl3t4', type: 'multiple_choice', questionKey: 'data.tasks.g1w_rainbow_after', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g1w_opt_snow', correct: false }, { id: 'b', textKey: 'data.tasks.g1w_opt_rain', correct: true }, { id: 'c', textKey: 'data.tasks.g1w_opt_wind_w', correct: false }] },
          ] },
      ] },
      { id: 'g1w-body', worldId: 'g1world', titleKey: 'data.topics.g1wBody', subject: 'logic', lessons: [
        { id: 'g1w-bdy-l1', topicId: 'g1w-body', titleKey: 'data.lessons.g1wBdyL1',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1w_bdyl1_0' }, { speaker: 'tali', textKey: 'data.dialog.g1w_bdyl1_1' }],
          intro: [{ titleKey: 'data.intro.g1w_bdyl1_0_t', bodyKey: 'data.intro.g1w_bdyl1_0_b', emoji: '✏️' }, { titleKey: 'data.intro.g1w_bdyl1_1_t', bodyKey: 'data.intro.g1w_bdyl1_1_b', emoji: '🍌' }],
          tasks: [
            { id: 'g1wbdyl1t1', type: 'multiple_choice', questionKey: 'data.tasks.g1w_how_many_eyes', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_one', correct: false }, { id: 'b', textKey: 'data.tasks.opt_two', correct: true }, { id: 'c', textKey: 'data.tasks.opt_three', correct: false }] },
            { id: 'g1wbdyl1t2', type: 'multiple_choice', questionKey: 'data.tasks.g1w_hear_with', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1w_opt_eyes', correct: false }, { id: 'b', textKey: 'data.tasks.g1w_opt_ears', correct: true }, { id: 'c', textKey: 'data.tasks.g1w_opt_nose', correct: false }] },
            { id: 'g1wbdyl1t3', type: 'multiple_choice', questionKey: 'data.tasks.g1w_taste_with', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1w_opt_tongue', correct: true }, { id: 'b', textKey: 'data.tasks.g1w_opt_hand', correct: false }, { id: 'c', textKey: 'data.tasks.g1w_opt_ear', correct: false }] },
            { id: 'g1wbdyl1t4', type: 'multiple_choice', questionKey: 'data.tasks.g1w_all_fingers', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_eight', correct: false }, { id: 'b', textKey: 'data.tasks.opt_ten', correct: true }, { id: 'c', textKey: 'data.tasks.opt_12', correct: false }] },
          ] },
        { id: 'g1w-bdy-l2', topicId: 'g1w-body', titleKey: 'data.lessons.g1wBdyL2',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1w_bdyl2_0' }, { speaker: 'tali', textKey: 'data.dialog.g1w_bdyl2_1' }],
          intro: [{ titleKey: 'data.intro.g1w_bdyl2_0_t', bodyKey: 'data.intro.g1w_bdyl2_0_b', emoji: '🦇' }, { titleKey: 'data.intro.g1w_bdyl2_1_t', bodyKey: 'data.intro.g1w_bdyl2_1_b', emoji: '✏️' }],
          tasks: [
            { id: 'g1wbdyl2t1', type: 'multiple_choice', questionKey: 'data.tasks.g1w_wash_hands', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1w_opt_before_eat', correct: true }, { id: 'b', textKey: 'data.tasks.g1w_opt_never', correct: false }, { id: 'c', textKey: 'data.tasks.g1w_opt_once_week', correct: false }] },
            { id: 'g1wbdyl2t2', type: 'multiple_choice', questionKey: 'data.tasks.g1w_sleep_hours', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1w_opt_5_6h', correct: false }, { id: 'b', textKey: 'data.tasks.g1w_opt_9_10h', correct: true }, { id: 'c', textKey: 'data.tasks.g1w_opt_3_4h', correct: false }] },
            { id: 'g1wbdyl2t3', type: 'multiple_choice', questionKey: 'data.tasks.g1w_veggies_healthy', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },
            { id: 'g1wbdyl2t4', type: 'multiple_choice', questionKey: 'data.tasks.g1w_teeth_with', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g1w_opt_toothbrush', correct: true }, { id: 'b', textKey: 'data.tasks.g1w_opt_fork', correct: false }, { id: 'c', textKey: 'data.tasks.g1w_opt_pen', correct: false }] },
          ] },
        { id: 'g1w-bdy-l3', topicId: 'g1w-body', titleKey: 'data.lessons.g1wBdyL3',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1w_bdyl3_0' }, { speaker: 'tali', textKey: 'data.dialog.g1w_bdyl3_1' }],
          intro: [{ titleKey: 'data.intro.g1w_bdyl3_0_t', bodyKey: 'data.intro.g1w_bdyl3_0_b', emoji: '🧦' }, { titleKey: 'data.intro.g1w_bdyl3_1_t', bodyKey: 'data.intro.g1w_bdyl3_1_b', emoji: '🧑‍' }],
          tasks: [
            { id: 'g1wbdyl3t1', type: 'multiple_choice', questionKey: 'data.tasks.g1w_cross_road_at', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1w_opt_red_light', correct: false }, { id: 'b', textKey: 'data.tasks.g1w_opt_green_light', correct: true }, { id: 'c', textKey: 'data.tasks.g1w_opt_yellow_light', correct: false }] },
            { id: 'g1wbdyl3t2', type: 'multiple_choice', questionKey: 'data.tasks.g1w_if_lost_call', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1w_opt_run_alone', correct: false }, { id: 'b', textKey: 'data.tasks.g1w_opt_call_parents', correct: true }, { id: 'c', textKey: 'data.tasks.g1w_opt_hide', correct: false }] },
            { id: 'g1wbdyl3t3', type: 'multiple_choice', questionKey: 'data.tasks.g1w_hot_stove_touch', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: false }, { id: 'b', textKey: 'data.tasks.opt_no', correct: true }] },
            { id: 'g1wbdyl3t4', type: 'multiple_choice', questionKey: 'data.tasks.g1w_seatbelt', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },
          ] },
      ] },
    ],
  },
  {
    id: 'g1eng', titleKey: 'data.worlds.g1eng', descriptionKey: 'data.worldDesc.g1eng',
    biome: 'harbor', accentColor: '#29B6F6', npcEmoji: '🐙', ageBand: '7',
    topics: [
      { id: 'g1e-abc', worldId: 'g1eng', titleKey: 'data.topics.g1eAbc', subject: 'reading', lessons: [
        { id: 'g1e-abc-l1', topicId: 'g1e-abc', titleKey: 'data.lessons.g1eAbcL1',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1e_abcl1_0' }, { speaker: 'tali', textKey: 'data.dialog.g1e_abcl1_1' }],
          intro: [{ titleKey: 'data.intro.g1e_abcl1_0_t', bodyKey: 'data.intro.g1e_abcl1_0_b', emoji: '🐐' }, { titleKey: 'data.intro.g1e_abcl1_1_t', bodyKey: 'data.intro.g1e_abcl1_1_b', emoji: '✏️' }],
          tasks: [
            { id: 'g1eabcl1t1', type: 'multiple_choice', questionKey: 'data.tasks.g1e_G_for', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_bear', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_goat', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_apple', correct: false }] },
            { id: 'g1eabcl1t2', type: 'multiple_choice', questionKey: 'data.tasks.g1e_happy_starts', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_G', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_H', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_I', correct: false }] },
            { id: 'g1eabcl1t3', type: 'multiple_choice', questionKey: 'data.tasks.g1e_ice_starts', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_H', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_I', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_J', correct: false }] },
            { id: 'g1eabcl1t4', type: 'multiple_choice', questionKey: 'data.tasks.g1e_J_for', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_jelly', correct: true }, { id: 'b', textKey: 'data.tasks.g1e_opt_kite', correct: false }, { id: 'c', textKey: 'data.tasks.g1e_opt_lamp', correct: false }] },
          ] },
        { id: 'g1e-abc-l2', topicId: 'g1e-abc', titleKey: 'data.lessons.g1eAbcL2',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1e_abcl2_0' }, { speaker: 'tali', textKey: 'data.dialog.g1e_abcl2_1' }],
          intro: [{ titleKey: 'data.intro.g1e_abcl2_0_t', bodyKey: 'data.intro.g1e_abcl2_0_b', emoji: '🏄' }, { titleKey: 'data.intro.g1e_abcl2_1_t', bodyKey: 'data.intro.g1e_abcl2_1_b', emoji: '🌛' }],
          tasks: [
            { id: 'g1eabcl2t1', type: 'multiple_choice', questionKey: 'data.tasks.g1e_K_for', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_kite', correct: true }, { id: 'b', textKey: 'data.tasks.g1e_opt_lamp', correct: false }, { id: 'c', textKey: 'data.tasks.g1e_opt_moon', correct: false }] },
            { id: 'g1eabcl2t2', type: 'multiple_choice', questionKey: 'data.tasks.g1e_starts_with_L', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_kite', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_lamp', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_nose', correct: false }] },
            { id: 'g1eabcl2t3', type: 'multiple_choice', questionKey: 'data.tasks.g1e_M_for', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_kite', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_moon', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_nose', correct: false }] },
            { id: 'g1eabcl2t4', type: 'multiple_choice', questionKey: 'data.tasks.g1e_N_for', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_moon', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_nose', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_orange', correct: false }] },
          ] },
        { id: 'g1e-abc-l3', topicId: 'g1e-abc', titleKey: 'data.lessons.g1eAbcL3',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1e_abcl3_0' }, { speaker: 'tali', textKey: 'data.dialog.g1e_abcl3_1' }],
          intro: [{ titleKey: 'data.intro.g1e_abcl3_0_t', bodyKey: 'data.intro.g1e_abcl3_0_b', emoji: '✏️' }, { titleKey: 'data.intro.g1e_abcl3_1_t', bodyKey: 'data.intro.g1e_abcl3_1_b', emoji: '🌙' }],
          tasks: [
            { id: 'g1eabcl3t1', type: 'multiple_choice', questionKey: 'data.tasks.g1e_O_for', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_orange', correct: true }, { id: 'b', textKey: 'data.tasks.g1e_opt_pen', correct: false }, { id: 'c', textKey: 'data.tasks.g1e_opt_queen', correct: false }] },
            { id: 'g1eabcl3t2', type: 'multiple_choice', questionKey: 'data.tasks.g1e_P_for', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_orange', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_pen', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_queen', correct: false }] },
            { id: 'g1eabcl3t3', type: 'multiple_choice', questionKey: 'data.tasks.g1e_starts_with_Q', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_rain', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_queen', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_sun', correct: false }] },
            { id: 'g1eabcl3t4', type: 'multiple_choice', questionKey: 'data.tasks.g1e_R_for', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_rain', correct: true }, { id: 'b', textKey: 'data.tasks.g1e_opt_sun', correct: false }, { id: 'c', textKey: 'data.tasks.g1e_opt_tree', correct: false }] },
          ] },
      ] },
      { id: 'g1e-nums', worldId: 'g1eng', titleKey: 'data.topics.g1eNums', subject: 'reading', lessons: [
        { id: 'g1e-num-l1', topicId: 'g1e-nums', titleKey: 'data.lessons.g1eNumL1',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1e_numl1_0' }, { speaker: 'tali', textKey: 'data.dialog.g1e_numl1_1' }],
          intro: [{ titleKey: 'data.intro.g1e_numl1_0_t', bodyKey: 'data.intro.g1e_numl1_0_b', emoji: '1️⃣' }, { titleKey: 'data.intro.g1e_numl1_1_t', bodyKey: 'data.intro.g1e_numl1_1_b', emoji: '5️⃣' }],
          tasks: [
            { id: 'g1enuml1t1', type: 'multiple_choice', questionKey: 'data.tasks.g1e_three_cats', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_two', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_three', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_four', correct: false }] },
            { id: 'g1enuml1t2', type: 'multiple_choice', questionKey: 'data.tasks.g1e_two_in_num', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_one', correct: false }, { id: 'b', textKey: 'data.tasks.opt_two', correct: true }, { id: 'c', textKey: 'data.tasks.opt_three', correct: false }] },
            { id: 'g1enuml1t3', type: 'multiple_choice', questionKey: 'data.tasks.g1e_four_plus_one', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_four', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_five', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_six', correct: false }] },
            { id: 'g1enuml1t4', type: 'multiple_choice', questionKey: 'data.tasks.g1e_pyat_en', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_three', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_four', correct: false }, { id: 'c', textKey: 'data.tasks.g1e_opt_five', correct: true }] },
          ] },
        { id: 'g1e-num-l2', topicId: 'g1e-nums', titleKey: 'data.lessons.g1eNumL2',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1e_numl2_0' }, { speaker: 'tali', textKey: 'data.dialog.g1e_numl2_1' }],
          intro: [{ titleKey: 'data.intro.g1e_numl2_0_t', bodyKey: 'data.intro.g1e_numl2_0_b', emoji: '6️⃣' }, { titleKey: 'data.intro.g1e_numl2_1_t', bodyKey: 'data.intro.g1e_numl2_1_b', emoji: '✏️' }],
          tasks: [
            { id: 'g1enuml2t1', type: 'multiple_choice', questionKey: 'data.tasks.g1e_7_in_en', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_six', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_seven', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_eight', correct: false }] },
            { id: 'g1enuml2t2', type: 'multiple_choice', questionKey: 'data.tasks.g1e_nine_in_num', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_seven', correct: false }, { id: 'b', textKey: 'data.tasks.opt_eight', correct: false }, { id: 'c', textKey: 'data.tasks.opt_nine', correct: true }] },
            { id: 'g1enuml2t3', type: 'multiple_choice', questionKey: 'data.tasks.g1e_10_in_en', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_nine', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_ten', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_eleven', correct: false }] },
            { id: 'g1enuml2t4', type: 'multiple_choice', questionKey: 'data.tasks.g1e_vosem_en', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_six', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_eight', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_ten', correct: false }] },
          ] },
        { id: 'g1e-num-l3', topicId: 'g1e-nums', titleKey: 'data.lessons.g1eNumL3',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1e_numl3_0' }, { speaker: 'tali', textKey: 'data.dialog.g1e_numl3_1' }],
          intro: [{ titleKey: 'data.intro.g1e_numl3_0_t', bodyKey: 'data.intro.g1e_numl3_0_b', emoji: '✏️' }, { titleKey: 'data.intro.g1e_numl3_1_t', bodyKey: 'data.intro.g1e_numl3_1_b', emoji: '🌍' }],
          tasks: [
            { id: 'g1enuml3t1', type: 'multiple_choice', questionKey: 'data.tasks.g1e_six_minus_three', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_two', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_three', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_four', correct: false }] },
            { id: 'g1enuml3t2', type: 'multiple_choice', questionKey: 'data.tasks.g1e_three_plus_four', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_six', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_seven', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_eight', correct: false }] },
            { id: 'g1enuml3t3', type: 'multiple_choice', questionKey: 'data.tasks.g1e_after_nine', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_nine', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_ten', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_eleven', correct: false }] },
            { id: 'g1enuml3t4', type: 'multiple_choice', questionKey: 'data.tasks.g1e_how_many_8stars', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_seven', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_eight', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_nine', correct: false }] },
          ] },
      ] },
      { id: 'g1e-greet', worldId: 'g1eng', titleKey: 'data.topics.g1eGreet', subject: 'reading', lessons: [
        { id: 'g1e-grt-l1', topicId: 'g1e-greet', titleKey: 'data.lessons.g1eGrtL1',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1e_grtl1_0' }, { speaker: 'tali', textKey: 'data.dialog.g1e_grtl1_1' }],
          intro: [{ titleKey: 'data.intro.g1e_grtl1_0_t', bodyKey: 'data.intro.g1e_grtl1_0_b', emoji: '👋' }, { titleKey: 'data.intro.g1e_grtl1_1_t', bodyKey: 'data.intro.g1e_grtl1_1_b', emoji: '🌽' }],
          tasks: [
            { id: 'g1egrtl1t1', type: 'multiple_choice', questionKey: 'data.tasks.g1e_morning_greeting', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_good_morning', correct: true }, { id: 'b', textKey: 'data.tasks.g1e_opt_good_night', correct: false }, { id: 'c', textKey: 'data.tasks.g1e_opt_goodbye', correct: false }] },
            { id: 'g1egrtl1t2', type: 'multiple_choice', questionKey: 'data.tasks.g1e_when_leaving', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_hello', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_goodbye', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_sorry', correct: false }] },
            { id: 'g1egrtl1t3', type: 'multiple_choice', questionKey: 'data.tasks.g1e_good_night_for', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_morning_time', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_noon_time', correct: false }, { id: 'c', textKey: 'data.tasks.g1e_opt_night_time', correct: true }] },
            { id: 'g1egrtl1t4', type: 'multiple_choice', questionKey: 'data.tasks.g1e_hi_means', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_poka', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_privet', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_spasibo', correct: false }] },
          ] },
        { id: 'g1e-grt-l2', topicId: 'g1e-greet', titleKey: 'data.lessons.g1eGrtL2',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1e_grtl2_0' }, { speaker: 'tali', textKey: 'data.dialog.g1e_grtl2_1' }],
          intro: [{ titleKey: 'data.intro.g1e_grtl2_0_t', bodyKey: 'data.intro.g1e_grtl2_0_b', emoji: '👤' }, { titleKey: 'data.intro.g1e_grtl2_1_t', bodyKey: 'data.intro.g1e_grtl2_1_b', emoji: '✏️' }],
          tasks: [
            { id: 'g1egrtl2t1', type: 'multiple_choice', questionKey: 'data.tasks.g1e_my_name_blank', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_am', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_is', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_are', correct: false }] },
            { id: 'g1egrtl2t2', type: 'multiple_choice', questionKey: 'data.tasks.g1e_menya_zovut', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_i_am', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_my_name_is', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_hello_i', correct: false }] },
            { id: 'g1egrtl2t3', type: 'multiple_choice', questionKey: 'data.tasks.g1e_what_is_your_name', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_kak_dela', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_kak_zovut', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_skolko_let', correct: false }] },
            { id: 'g1egrtl2t4', type: 'multiple_choice', questionKey: 'data.tasks.g1e_i_blank_seven', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_am', correct: true }, { id: 'b', textKey: 'data.tasks.g1e_opt_is', correct: false }, { id: 'c', textKey: 'data.tasks.g1e_opt_are', correct: false }] },
          ] },
        { id: 'g1e-grt-l3', topicId: 'g1e-greet', titleKey: 'data.lessons.g1eGrtL3',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1e_grtl3_0' }, { speaker: 'tali', textKey: 'data.dialog.g1e_grtl3_1' }],
          intro: [{ titleKey: 'data.intro.g1e_grtl3_0_t', bodyKey: 'data.intro.g1e_grtl3_0_b', emoji: '✏️' }, { titleKey: 'data.intro.g1e_grtl3_1_t', bodyKey: 'data.intro.g1e_grtl3_1_b', emoji: '✏️' }],
          tasks: [
            { id: 'g1egrtl3t1', type: 'multiple_choice', questionKey: 'data.tasks.g1e_how_are_you_means', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_kak_dela', correct: true }, { id: 'b', textKey: 'data.tasks.g1e_opt_poka', correct: false }, { id: 'c', textKey: 'data.tasks.g1e_opt_privet', correct: false }] },
            { id: 'g1egrtl3t2', type: 'multiple_choice', questionKey: 'data.tasks.g1e_best_reply_how', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_fine_thanks', correct: true }, { id: 'b', textKey: 'data.tasks.g1e_opt_goodbye', correct: false }, { id: 'c', textKey: 'data.tasks.g1e_opt_my_name_is', correct: false }] },
            { id: 'g1egrtl3t3', type: 'multiple_choice', questionKey: 'data.tasks.g1e_thank_you_means', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_pozhaluista', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_spasibo', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_privet', correct: false }] },
            { id: 'g1egrtl3t4', type: 'multiple_choice', questionKey: 'data.tasks.g1e_please_means', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_spasibo', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_pozhaluista', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_poka', correct: false }] },
          ] },
      ] },
    ],
  },


  // ---
  {
    id: 'g2math', titleKey: 'data.worlds.g2math', descriptionKey: 'data.worldDesc.g2math',
    biome: 'mountain', accentColor: '#2196F3', npcEmoji: '🦅', ageBand: '8',
    topics: [
      { id: 'g2m-100', worldId: 'g2math', titleKey: 'data.topics.g2m100', subject: 'math', lessons: [
        { id: 'g2m-100-l1', topicId: 'g2m-100', titleKey: 'data.lessons.g2m100L1',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g2m_100l1_0' }, { speaker: 'tali', textKey: 'data.dialog.g2m_100l1_1' }],
          intro: [{ titleKey: 'data.intro.g2m_100l1_0_t', bodyKey: 'data.intro.g2m_100l1_0_b', emoji: '✏️' }, { titleKey: 'data.intro.g2m_100l1_1_t', bodyKey: 'data.intro.g2m_100l1_1_b', emoji: '✏️' }],
          tasks: [
            { id: 'g2m100l1t1', type: 'multiple_choice', questionKey: 'data.tasks.g2m_10x3', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_20', correct: false }, { id: 'b', textKey: 'data.tasks.opt_30', correct: true }, { id: 'c', textKey: 'data.tasks.opt_40', correct: false }] },
            { id: 'g2m100l1t2', type: 'multiple_choice', questionKey: 'data.tasks.g2m_10x7', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_60', correct: false }, { id: 'b', textKey: 'data.tasks.opt_70', correct: true }, { id: 'c', textKey: 'data.tasks.opt_80', correct: false }] },
            { id: 'g2m100l1t3', type: 'input', questionKey: 'data.tasks.g2m_10x5', difficulty: 1, answer: '50' },
            { id: 'g2m100l1t4', type: 'multiple_choice', questionKey: 'data.tasks.g2m_how_many_tens_in_100', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_five', correct: false }, { id: 'b', textKey: 'data.tasks.opt_ten', correct: true }, { id: 'c', textKey: 'data.tasks.opt_20', correct: false }] },
          ] },
        { id: 'g2m-100-l2', topicId: 'g2m-100', titleKey: 'data.lessons.g2m100L2',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g2m_100l2_0' }, { speaker: 'tali', textKey: 'data.dialog.g2m_100l2_1' }],
          intro: [{ titleKey: 'data.intro.g2m_100l2_0_t', bodyKey: 'data.intro.g2m_100l2_0_b', emoji: '✏️' }, { titleKey: 'data.intro.g2m_100l2_1_t', bodyKey: 'data.intro.g2m_100l2_1_b', emoji: '🍌' }],
          tasks: [
            { id: 'g2m100l2t1', type: 'input', questionKey: 'data.tasks.g2m_25_after', difficulty: 1, answer: '26' },
            { id: 'g2m100l2t2', type: 'multiple_choice', questionKey: 'data.tasks.g2m_biggest_37_42_29', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_37', correct: false }, { id: 'b', textKey: 'data.tasks.opt_42', correct: true }, { id: 'c', textKey: 'data.tasks.opt_29', correct: false }] },
            { id: 'g2m100l2t3', type: 'input', questionKey: 'data.tasks.g2m_tens_in_48', difficulty: 2, answer: '4' },
            { id: 'g2m100l2t4', type: 'input', questionKey: 'data.tasks.g2m_units_in_37', difficulty: 2, answer: '7' },
          ] },
        { id: 'g2m-100-l3', topicId: 'g2m-100', titleKey: 'data.lessons.g2m100L3',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g2m_100l3_0' }, { speaker: 'tali', textKey: 'data.dialog.g2m_100l3_1' }],
          intro: [{ titleKey: 'data.intro.g2m_100l3_0_t', bodyKey: 'data.intro.g2m_100l3_0_b', emoji: '✏️' }, { titleKey: 'data.intro.g2m_100l3_1_t', bodyKey: 'data.intro.g2m_100l3_1_b', emoji: '🏆' }],
          tasks: [
            { id: 'g2m100l3t1', type: 'input', questionKey: 'data.tasks.g2m_before_100', difficulty: 1, answer: '99' },
            { id: 'g2m100l3t2', type: 'multiple_choice', questionKey: 'data.tasks.g2m_smallest_78_82_91', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_78', correct: true }, { id: 'b', textKey: 'data.tasks.opt_82', correct: false }, { id: 'c', textKey: 'data.tasks.opt_91', correct: false }] },
            { id: 'g2m100l3t3', type: 'input', questionKey: 'data.tasks.g2m_tens_in_90', difficulty: 1, answer: '9' },
            { id: 'g2m100l3t4', type: 'input', questionKey: 'data.tasks.g2m_num_5tens_6units', difficulty: 2, answer: '56' },
          ] },
      ] },
      { id: 'g2m-add2', worldId: 'g2math', titleKey: 'data.topics.g2mAdd2', subject: 'math', lessons: [
        { id: 'g2m-add2-l1', topicId: 'g2m-add2', titleKey: 'data.lessons.g2mAdd2L1',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g2m_add2l1_0' }, { speaker: 'tali', textKey: 'data.dialog.g2m_add2l1_1' }],
          intro: [{ titleKey: 'data.intro.g2m_add2l1_0_t', bodyKey: 'data.intro.g2m_add2l1_0_b', emoji: '➕' }, { titleKey: 'data.intro.g2m_add2l1_1_t', bodyKey: 'data.intro.g2m_add2l1_1_b', emoji: '✏️' }],
          tasks: [
            { id: 'g2madd2l1t1', type: 'input', questionKey: 'data.tasks.g2m_20plus30', difficulty: 1, answer: '50' },
            { id: 'g2madd2l1t2', type: 'input', questionKey: 'data.tasks.g2m_40plus50', difficulty: 1, answer: '90' },
            { id: 'g2madd2l1t3', type: 'multiple_choice', questionKey: 'data.tasks.g2m_30plus_eq100', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_60', correct: false }, { id: 'b', textKey: 'data.tasks.opt_70', correct: true }, { id: 'c', textKey: 'data.tasks.opt_80', correct: false }] },
            { id: 'g2madd2l1t4', type: 'input', questionKey: 'data.tasks.g2m_60plus40', difficulty: 1, answer: '100' },
          ] },
        { id: 'g2m-add2-l2', topicId: 'g2m-add2', titleKey: 'data.lessons.g2mAdd2L2',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g2m_add2l2_0' }, { speaker: 'tali', textKey: 'data.dialog.g2m_add2l2_1' }],
          intro: [{ titleKey: 'data.intro.g2m_add2l2_0_t', bodyKey: 'data.intro.g2m_add2l2_0_b', emoji: '🔟' }, { titleKey: 'data.intro.g2m_add2l2_1_t', bodyKey: 'data.intro.g2m_add2l2_1_b', emoji: '➕' }],
          tasks: [
            { id: 'g2madd2l2t1', type: 'input', questionKey: 'data.tasks.g2m_23plus14', difficulty: 1, answer: '37' },
            { id: 'g2madd2l2t2', type: 'input', questionKey: 'data.tasks.g2m_35plus42', difficulty: 1, answer: '77' },
            { id: 'g2madd2l2t3', type: 'input', questionKey: 'data.tasks.g2m_47plus26', difficulty: 2, answer: '73' },
            { id: 'g2madd2l2t4', type: 'input', questionKey: 'data.tasks.g2m_58plus35', difficulty: 3, answer: '93' },
          ] },
        { id: 'g2m-add2-l3', topicId: 'g2m-add2', titleKey: 'data.lessons.g2mAdd2L3',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g2m_add2l3_0' }, { speaker: 'tali', textKey: 'data.dialog.g2m_add2l3_1' }],
          intro: [{ titleKey: 'data.intro.g2m_add2l3_0_t', bodyKey: 'data.intro.g2m_add2l3_0_b', emoji: '✏️' }, { titleKey: 'data.intro.g2m_add2l3_1_t', bodyKey: 'data.intro.g2m_add2l3_1_b', emoji: '🍎' }],
          tasks: [
            { id: 'g2madd2l3t1', type: 'input', questionKey: 'data.tasks.g2m_sub_65minus23', difficulty: 1, answer: '42' },
            { id: 'g2madd2l3t2', type: 'input', questionKey: 'data.tasks.g2m_sub_80minus47', difficulty: 2, answer: '33' },
            { id: 'g2madd2l3t3', type: 'multiple_choice', questionKey: 'data.tasks.g2m_word_apples_30_give_13', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_17', correct: true }, { id: 'b', textKey: 'data.tasks.opt_18', correct: false }, { id: 'c', textKey: 'data.tasks.opt_19', correct: false }] },
            { id: 'g2madd2l3t4', type: 'input', questionKey: 'data.tasks.g2m_word_45plus27', difficulty: 2, answer: '72' },
          ] },
      ] },
      { id: 'g2m-times', worldId: 'g2math', titleKey: 'data.topics.g2mTimes', subject: 'math', lessons: [
        { id: 'g2m-times-l1', topicId: 'g2m-times', titleKey: 'data.lessons.g2mTimesL1',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g2m_timesl1_0' }, { speaker: 'tali', textKey: 'data.dialog.g2m_timesl1_1' }],
          intro: [{ titleKey: 'data.intro.g2m_timesl1_0_t', bodyKey: 'data.intro.g2m_timesl1_0_b', emoji: '✖️' }, { titleKey: 'data.intro.g2m_timesl1_1_t', bodyKey: 'data.intro.g2m_timesl1_1_b', emoji: '2️⃣' }],
          tasks: [
            { id: 'g2mtimesl1t1', type: 'input', questionKey: 'data.tasks.g2m_2x4', difficulty: 1, answer: '8' },
            { id: 'g2mtimesl1t2', type: 'input', questionKey: 'data.tasks.g2m_2x7', difficulty: 1, answer: '14' },
            { id: 'g2mtimesl1t3', type: 'input', questionKey: 'data.tasks.g2m_2x9', difficulty: 2, answer: '18' },
            { id: 'g2mtimesl1t4', type: 'multiple_choice', questionKey: 'data.tasks.g2m_2x6_check', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_10', correct: false }, { id: 'b', textKey: 'data.tasks.opt_12', correct: true }, { id: 'c', textKey: 'data.tasks.opt_14', correct: false }] },
          ] },
        { id: 'g2m-times-l2', topicId: 'g2m-times', titleKey: 'data.lessons.g2mTimesL2',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g2m_timesl2_0' }, { speaker: 'tali', textKey: 'data.dialog.g2m_timesl2_1' }],
          intro: [{ titleKey: 'data.intro.g2m_timesl2_0_t', bodyKey: 'data.intro.g2m_timesl2_0_b', emoji: '5️⃣' }, { titleKey: 'data.intro.g2m_timesl2_1_t', bodyKey: 'data.intro.g2m_timesl2_1_b', emoji: '✖️' }],
          tasks: [
            { id: 'g2mtimesl2t1', type: 'input', questionKey: 'data.tasks.g2m_5x3', difficulty: 1, answer: '15' },
            { id: 'g2mtimesl2t2', type: 'input', questionKey: 'data.tasks.g2m_5x6', difficulty: 1, answer: '30' },
            { id: 'g2mtimesl2t3', type: 'input', questionKey: 'data.tasks.g2m_5x8', difficulty: 2, answer: '40' },
            { id: 'g2mtimesl2t4', type: 'multiple_choice', questionKey: 'data.tasks.g2m_5x9_check', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_40', correct: false }, { id: 'b', textKey: 'data.tasks.opt_45', correct: true }, { id: 'c', textKey: 'data.tasks.opt_50', correct: false }] },
          ] },
        { id: 'g2m-times-l3', topicId: 'g2m-times', titleKey: 'data.lessons.g2mTimesL3',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g2m_timesl3_0' }, { speaker: 'tali', textKey: 'data.dialog.g2m_timesl3_1' }],
          intro: [{ titleKey: 'data.intro.g2m_timesl3_0_t', bodyKey: 'data.intro.g2m_timesl3_0_b', emoji: '3️⃣' }, { titleKey: 'data.intro.g2m_timesl3_1_t', bodyKey: 'data.intro.g2m_timesl3_1_b', emoji: '✖️' }],
          tasks: [
            { id: 'g2mtimesl3t1', type: 'input', questionKey: 'data.tasks.g2m_3x4', difficulty: 1, answer: '12' },
            { id: 'g2mtimesl3t2', type: 'input', questionKey: 'data.tasks.g2m_3x7', difficulty: 1, answer: '21' },
            { id: 'g2mtimesl3t3', type: 'input', questionKey: 'data.tasks.g2m_3x9', difficulty: 2, answer: '27' },
            { id: 'g2mtimesl3t4', type: 'multiple_choice', questionKey: 'data.tasks.g2m_3x8_check', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_22', correct: false }, { id: 'b', textKey: 'data.tasks.opt_24', correct: true }, { id: 'c', textKey: 'data.tasks.opt_26', correct: false }] },
          ] },
      ] },
    ],
  },
  {
    id: 'g2rus', titleKey: 'data.worlds.g2rus', descriptionKey: 'data.worldDesc.g2rus',
    biome: 'library', accentColor: '#9C27B0', npcEmoji: '🦉', ageBand: '8',
    topics: [
      { id: 'g2r-softhard', worldId: 'g2rus', titleKey: 'data.topics.g2rSoftHard', subject: 'reading_ru', lessons: [
        { id: 'g2r-sh-l1', topicId: 'g2r-softhard', titleKey: 'data.lessons.g2rShL1',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g2r_shl1_0' }, { speaker: 'tali', textKey: 'data.dialog.g2r_shl1_1' }],
          intro: [{ titleKey: 'data.intro.g2r_shl1_0_t', bodyKey: 'data.intro.g2r_shl1_0_b', emoji: '✏️' }, { titleKey: 'data.intro.g2r_shl1_1_t', bodyKey: 'data.intro.g2r_shl1_1_b', emoji: '✏️' }],
          tasks: [
            { id: 'g2rshl1t1', type: 'multiple_choice', questionKey: 'data.tasks.g2r_nos_consonant', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_soft', correct: false }, { id: 'b', textKey: 'data.tasks.opt_hard', correct: true }] },
            { id: 'g2rshl1t2', type: 'multiple_choice', questionKey: 'data.tasks.g2r_zha_hard', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },
            { id: 'g2rshl1t3', type: 'multiple_choice', questionKey: 'data.tasks.g2r_which_always_hard', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2r_opt_Zh', correct: true }, { id: 'b', textKey: 'data.tasks.g2r_opt_L', correct: false }, { id: 'c', textKey: 'data.tasks.g2r_opt_N', correct: false }] },
            { id: 'g2rshl1t4', type: 'multiple_choice', questionKey: 'data.tasks.g2r_hard_consonants_count', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_two', correct: false }, { id: 'b', textKey: 'data.tasks.opt_three', correct: true }, { id: 'c', textKey: 'data.tasks.opt_four', correct: false }] },
          ] },
        { id: 'g2r-sh-l2', topicId: 'g2r-softhard', titleKey: 'data.lessons.g2rShL2',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g2r_shl2_0' }, { speaker: 'tali', textKey: 'data.dialog.g2r_shl2_1' }],
          intro: [{ titleKey: 'data.intro.g2r_shl2_0_t', bodyKey: 'data.intro.g2r_shl2_0_b', emoji: '📖' }, { titleKey: 'data.intro.g2r_shl2_1_t', bodyKey: 'data.intro.g2r_shl2_1_b', emoji: '🐴' }],
          tasks: [
            { id: 'g2rshl2t1', type: 'multiple_choice', questionKey: 'data.tasks.g2r_kon_konj', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2r_opt_kon', correct: false }, { id: 'b', textKey: 'data.tasks.g2r_opt_konj', correct: true }] },
            { id: 'g2rshl2t2', type: 'multiple_choice', questionKey: 'data.tasks.g2r_soft_sign_role', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2r_opt_softens', correct: true }, { id: 'b', textKey: 'data.tasks.g2r_opt_hardens', correct: false }, { id: 'c', textKey: 'data.tasks.g2r_opt_no_role', correct: false }] },
            { id: 'g2rshl2t3', type: 'multiple_choice', questionKey: 'data.tasks.g2r_ryb_needs_soft', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },
            { id: 'g2rshl2t4', type: 'multiple_choice', questionKey: 'data.tasks.g2r_soft_sign_between', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },
          ] },
        { id: 'g2r-sh-l3', topicId: 'g2r-softhard', titleKey: 'data.lessons.g2rShL3',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g2r_shl3_0' }, { speaker: 'tali', textKey: 'data.dialog.g2r_shl3_1' }],
          intro: [{ titleKey: 'data.intro.g2r_shl3_0_t', bodyKey: 'data.intro.g2r_shl3_0_b', emoji: '✏️' }, { titleKey: 'data.intro.g2r_shl3_1_t', bodyKey: 'data.intro.g2r_shl3_1_b', emoji: '🏆' }],
          tasks: [
            { id: 'g2rshl3t1', type: 'multiple_choice', questionKey: 'data.tasks.g2r_li_is_soft', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },
            { id: 'g2rshl3t2', type: 'multiple_choice', questionKey: 'data.tasks.g2r_lu_is_hard', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },
            { id: 'g2rshl3t3', type: 'multiple_choice', questionKey: 'data.tasks.g2r_le_is_what', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_soft', correct: true }, { id: 'b', textKey: 'data.tasks.opt_hard', correct: false }] },
            { id: 'g2rshl3t4', type: 'multiple_choice', questionKey: 'data.tasks.g2r_la_is_what', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_soft', correct: false }, { id: 'b', textKey: 'data.tasks.opt_hard', correct: true }] },
          ] },
      ] },
      { id: 'g2r-speech', worldId: 'g2rus', titleKey: 'data.topics.g2rSpeech', subject: 'reading_ru', lessons: [
        { id: 'g2r-sp-l1', topicId: 'g2r-speech', titleKey: 'data.lessons.g2rSpL1',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g2r_spl1_0' }, { speaker: 'tali', textKey: 'data.dialog.g2r_spl1_1' }],
          intro: [{ titleKey: 'data.intro.g2r_spl1_0_t', bodyKey: 'data.intro.g2r_spl1_0_b', emoji: '🍦' }, { titleKey: 'data.intro.g2r_spl1_1_t', bodyKey: 'data.intro.g2r_spl1_1_b', emoji: '✏️' }],
          tasks: [
            { id: 'g2rspl1t1', type: 'multiple_choice', questionKey: 'data.tasks.g2r_noun_question', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2r_opt_kto_chto', correct: true }, { id: 'b', textKey: 'data.tasks.g2r_opt_chto_delaet', correct: false }, { id: 'c', textKey: 'data.tasks.g2r_opt_kakoy', correct: false }] },
            { id: 'g2rspl1t2', type: 'multiple_choice', questionKey: 'data.tasks.g2r_kot_noun', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },
            { id: 'g2rspl1t3', type: 'multiple_choice', questionKey: 'data.tasks.g2r_beg_noun', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: false }, { id: 'b', textKey: 'data.tasks.opt_no', correct: true }] },
            { id: 'g2rspl1t4', type: 'multiple_choice', questionKey: 'data.tasks.g2r_which_is_noun', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2r_opt_beg_word', correct: false }, { id: 'b', textKey: 'data.tasks.g2r_opt_krasivyi', correct: false }, { id: 'c', textKey: 'data.tasks.g2r_opt_kniga', correct: true }] },
          ] },
        { id: 'g2r-sp-l2', topicId: 'g2r-speech', titleKey: 'data.lessons.g2rSpL2',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g2r_spl2_0' }, { speaker: 'tali', textKey: 'data.dialog.g2r_spl2_1' }],
          intro: [{ titleKey: 'data.intro.g2r_spl2_0_t', bodyKey: 'data.intro.g2r_spl2_0_b', emoji: '🏄' }, { titleKey: 'data.intro.g2r_spl2_1_t', bodyKey: 'data.intro.g2r_spl2_1_b', emoji: '✏️' }],
          tasks: [
            { id: 'g2rspl2t1', type: 'multiple_choice', questionKey: 'data.tasks.g2r_verb_question', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2r_opt_kto_chto', correct: false }, { id: 'b', textKey: 'data.tasks.g2r_opt_chto_delaet', correct: true }, { id: 'c', textKey: 'data.tasks.g2r_opt_kakoy', correct: false }] },
            { id: 'g2rspl2t2', type: 'multiple_choice', questionKey: 'data.tasks.g2r_idet_verb', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },
            { id: 'g2rspl2t3', type: 'multiple_choice', questionKey: 'data.tasks.g2r_which_is_verb', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2r_opt_koshka', correct: false }, { id: 'b', textKey: 'data.tasks.g2r_opt_sidit', correct: true }, { id: 'c', textKey: 'data.tasks.g2r_opt_krasivyi', correct: false }] },
            { id: 'g2rspl2t4', type: 'multiple_choice', questionKey: 'data.tasks.g2r_verb_changes_time', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },
          ] },
        { id: 'g2r-sp-l3', topicId: 'g2r-speech', titleKey: 'data.lessons.g2rSpL3',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g2r_spl3_0' }, { speaker: 'tali', textKey: 'data.dialog.g2r_spl3_1' }],
          intro: [{ titleKey: 'data.intro.g2r_spl3_0_t', bodyKey: 'data.intro.g2r_spl3_0_b', emoji: '🌐' }, { titleKey: 'data.intro.g2r_spl3_1_t', bodyKey: 'data.intro.g2r_spl3_1_b', emoji: '✏️' }],
          tasks: [
            { id: 'g2rspl3t1', type: 'multiple_choice', questionKey: 'data.tasks.g2r_adj_question', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2r_opt_kto_chto', correct: false }, { id: 'b', textKey: 'data.tasks.g2r_opt_chto_delaet', correct: false }, { id: 'c', textKey: 'data.tasks.g2r_opt_kakoy', correct: true }] },
            { id: 'g2rspl3t2', type: 'multiple_choice', questionKey: 'data.tasks.g2r_krasivyi_adj', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },
            { id: 'g2rspl3t3', type: 'multiple_choice', questionKey: 'data.tasks.g2r_which_is_adj', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2r_opt_sidit', correct: false }, { id: 'b', textKey: 'data.tasks.g2r_opt_koshka', correct: false }, { id: 'c', textKey: 'data.tasks.g2r_opt_belyi', correct: true }] },
            { id: 'g2rspl3t4', type: 'multiple_choice', questionKey: 'data.tasks.g2r_adj_describes', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2r_opt_noun_w', correct: true }, { id: 'b', textKey: 'data.tasks.g2r_opt_verb_w', correct: false }, { id: 'c', textKey: 'data.tasks.g2r_opt_sentence', correct: false }] },
          ] },
      ] },
      { id: 'g2r-sentence', worldId: 'g2rus', titleKey: 'data.topics.g2rSentence', subject: 'reading_ru', lessons: [
        { id: 'g2r-sent-l1', topicId: 'g2r-sentence', titleKey: 'data.lessons.g2rSentL1',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g2r_sentl1_0' }, { speaker: 'tali', textKey: 'data.dialog.g2r_sentl1_1' }],
          intro: [{ titleKey: 'data.intro.g2r_sentl1_0_t', bodyKey: 'data.intro.g2r_sentl1_0_b', emoji: '.' }, { titleKey: 'data.intro.g2r_sentl1_1_t', bodyKey: 'data.intro.g2r_sentl1_1_b', emoji: '?' }],
          tasks: [
            { id: 'g2rsentl1t1', type: 'multiple_choice', questionKey: 'data.tasks.g2r_statement_type', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2r_opt_statement', correct: true }, { id: 'b', textKey: 'data.tasks.g2r_opt_question_s', correct: false }, { id: 'c', textKey: 'data.tasks.g2r_opt_exclaim_s', correct: false }] },
            { id: 'g2rsentl1t2', type: 'multiple_choice', questionKey: 'data.tasks.g2r_question_type', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2r_opt_statement', correct: false }, { id: 'b', textKey: 'data.tasks.g2r_opt_question_s', correct: true }, { id: 'c', textKey: 'data.tasks.g2r_opt_exclaim_s', correct: false }] },
            { id: 'g2rsentl1t3', type: 'multiple_choice', questionKey: 'data.tasks.g2r_exclaim_type', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2r_opt_statement', correct: false }, { id: 'b', textKey: 'data.tasks.g2r_opt_question_s', correct: false }, { id: 'c', textKey: 'data.tasks.g2r_opt_exclaim_s', correct: true }] },
            { id: 'g2rsentl1t4', type: 'multiple_choice', questionKey: 'data.tasks.g2r_sentence_types_count', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_two', correct: false }, { id: 'b', textKey: 'data.tasks.opt_three', correct: true }, { id: 'c', textKey: 'data.tasks.opt_four', correct: false }] },
          ] },
        { id: 'g2r-sent-l2', topicId: 'g2r-sentence', titleKey: 'data.lessons.g2rSentL2',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g2r_sentl2_0' }, { speaker: 'tali', textKey: 'data.dialog.g2r_sentl2_1' }],
          intro: [{ titleKey: 'data.intro.g2r_sentl2_0_t', bodyKey: 'data.intro.g2r_sentl2_0_b', emoji: '✏️' }, { titleKey: 'data.intro.g2r_sentl2_1_t', bodyKey: 'data.intro.g2r_sentl2_1_b', emoji: '✏️' }],
          tasks: [
            { id: 'g2rsentl2t1', type: 'multiple_choice', questionKey: 'data.tasks.g2r_subject_is', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2r_opt_about_who', correct: true }, { id: 'b', textKey: 'data.tasks.g2r_opt_action', correct: false }, { id: 'c', textKey: 'data.tasks.g2r_opt_sign', correct: false }] },
            { id: 'g2rsentl2t2', type: 'multiple_choice', questionKey: 'data.tasks.g2r_predicate_is', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2r_opt_about_who', correct: false }, { id: 'b', textKey: 'data.tasks.g2r_opt_action', correct: true }, { id: 'c', textKey: 'data.tasks.g2r_opt_sign', correct: false }] },
            { id: 'g2rsentl2t3', type: 'multiple_choice', questionKey: 'data.tasks.g2r_kot_sidit_subject', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2r_opt_kot', correct: true }, { id: 'b', textKey: 'data.tasks.g2r_opt_sidit', correct: false }] },
            { id: 'g2rsentl2t4', type: 'multiple_choice', questionKey: 'data.tasks.g2r_kot_sidit_predicate', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2r_opt_kot', correct: false }, { id: 'b', textKey: 'data.tasks.g2r_opt_sidit', correct: true }] },
          ] },
        { id: 'g2r-sent-l3', topicId: 'g2r-sentence', titleKey: 'data.lessons.g2rSentL3',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g2r_sentl3_0' }, { speaker: 'tali', textKey: 'data.dialog.g2r_sentl3_1' }],
          intro: [{ titleKey: 'data.intro.g2r_sentl3_0_t', bodyKey: 'data.intro.g2r_sentl3_0_b', emoji: '✏️' }, { titleKey: 'data.intro.g2r_sentl3_1_t', bodyKey: 'data.intro.g2r_sentl3_1_b', emoji: '✏️' }],
          tasks: [
            { id: 'g2rsentl3t1', type: 'multiple_choice', questionKey: 'data.tasks.g2r_sentence_first_word', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },
            { id: 'g2rsentl3t2', type: 'multiple_choice', questionKey: 'data.tasks.g2r_sentence_end_dot', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },
            { id: 'g2rsentl3t3', type: 'multiple_choice', questionKey: 'data.tasks.g2r_names_capital', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },
            { id: 'g2rsentl3t4', type: 'multiple_choice', questionKey: 'data.tasks.g2r_which_correct_sent', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2r_opt_wrong_sent', correct: false }, { id: 'b', textKey: 'data.tasks.g2r_opt_correct_sent', correct: true }] },
          ] },
      ] },
    ],
  },
  {
    id: 'g2sci', titleKey: 'data.worlds.g2sci', descriptionKey: 'data.worldDesc.g2sci',
    biome: 'savanna', accentColor: '#4CAF50', npcEmoji: '🦎', ageBand: '8',
    topics: [
      { id: 'g2s-plants', worldId: 'g2sci', titleKey: 'data.topics.g2sPlants', subject: 'logic', lessons: [
        { id: 'g2s-plt-l1', topicId: 'g2s-plants', titleKey: 'data.lessons.g2sPltL1',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g2s_pltl1_0' }, { speaker: 'tali', textKey: 'data.dialog.g2s_pltl1_1' }],
          intro: [{ titleKey: 'data.intro.g2s_pltl1_0_t', bodyKey: 'data.intro.g2s_pltl1_0_b', emoji: '🌱' }, { titleKey: 'data.intro.g2s_pltl1_1_t', bodyKey: 'data.intro.g2s_pltl1_1_b', emoji: '🌍' }],
          tasks: [
            { id: 'g2spltl1t1', type: 'multiple_choice', questionKey: 'data.tasks.g2s_root_function', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2s_opt_water_food', correct: true }, { id: 'b', textKey: 'data.tasks.g2s_opt_photosyn', correct: false }, { id: 'c', textKey: 'data.tasks.g2s_opt_flowers', correct: false }] },
            { id: 'g2spltl1t2', type: 'multiple_choice', questionKey: 'data.tasks.g2s_leaf_function', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2s_opt_water_food', correct: false }, { id: 'b', textKey: 'data.tasks.g2s_opt_photosyn', correct: true }, { id: 'c', textKey: 'data.tasks.g2s_opt_flowers', correct: false }] },
            { id: 'g2spltl1t3', type: 'multiple_choice', questionKey: 'data.tasks.g2s_stem_carries', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },
            { id: 'g2spltl1t4', type: 'multiple_choice', questionKey: 'data.tasks.g2s_plant_parts_count', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_three', correct: false }, { id: 'b', textKey: 'data.tasks.opt_four', correct: false }, { id: 'c', textKey: 'data.tasks.opt_five', correct: true }] },
          ] },
        { id: 'g2s-plt-l2', topicId: 'g2s-plants', titleKey: 'data.lessons.g2sPltL2',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g2s_pltl2_0' }, { speaker: 'tali', textKey: 'data.dialog.g2s_pltl2_1' }],
          intro: [{ titleKey: 'data.intro.g2s_pltl2_0_t', bodyKey: 'data.intro.g2s_pltl2_0_b', emoji: '✏️' }, { titleKey: 'data.intro.g2s_pltl2_1_t', bodyKey: 'data.intro.g2s_pltl2_1_b', emoji: '✏️' }],
          tasks: [
            { id: 'g2spltl2t1', type: 'multiple_choice', questionKey: 'data.tasks.g2s_plants_need_sun', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },
            { id: 'g2spltl2t2', type: 'multiple_choice', questionKey: 'data.tasks.g2s_photosyn_needs', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2s_opt_sun_water_co2', correct: true }, { id: 'b', textKey: 'data.tasks.g2s_opt_only_water', correct: false }, { id: 'c', textKey: 'data.tasks.g2s_opt_only_sun', correct: false }] },
            { id: 'g2spltl2t3', type: 'multiple_choice', questionKey: 'data.tasks.g2s_plants_make_oxygen', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },
            { id: 'g2spltl2t4', type: 'multiple_choice', questionKey: 'data.tasks.g2s_seed_grows_into', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2s_opt_plant_f', correct: true }, { id: 'b', textKey: 'data.tasks.g2s_opt_animal_f', correct: false }, { id: 'c', textKey: 'data.tasks.g2s_opt_stone_f', correct: false }] },
          ] },
        { id: 'g2s-plt-l3', topicId: 'g2s-plants', titleKey: 'data.lessons.g2sPltL3',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g2s_pltl3_0' }, { speaker: 'tali', textKey: 'data.dialog.g2s_pltl3_1' }],
          intro: [{ titleKey: 'data.intro.g2s_pltl3_0_t', bodyKey: 'data.intro.g2s_pltl3_0_b', emoji: '🥕' }, { titleKey: 'data.intro.g2s_pltl3_1_t', bodyKey: 'data.intro.g2s_pltl3_1_b', emoji: '🌽' }],
          tasks: [
            { id: 'g2spltl3t1', type: 'multiple_choice', questionKey: 'data.tasks.g2s_carrot_part', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2s_opt_root_p', correct: true }, { id: 'b', textKey: 'data.tasks.g2s_opt_fruit_p', correct: false }, { id: 'c', textKey: 'data.tasks.g2s_opt_leaf_p', correct: false }] },
            { id: 'g2spltl3t2', type: 'multiple_choice', questionKey: 'data.tasks.g2s_tomato_part', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2s_opt_root_p', correct: false }, { id: 'b', textKey: 'data.tasks.g2s_opt_fruit_p', correct: true }, { id: 'c', textKey: 'data.tasks.g2s_opt_leaf_p', correct: false }] },
            { id: 'g2spltl3t3', type: 'multiple_choice', questionKey: 'data.tasks.g2s_spinach_part', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2s_opt_root_p', correct: false }, { id: 'b', textKey: 'data.tasks.g2s_opt_fruit_p', correct: false }, { id: 'c', textKey: 'data.tasks.g2s_opt_leaf_p', correct: true }] },
            { id: 'g2spltl3t4', type: 'multiple_choice', questionKey: 'data.tasks.g2s_potato_part', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2s_opt_root_p', correct: true }, { id: 'b', textKey: 'data.tasks.g2s_opt_fruit_p', correct: false }, { id: 'c', textKey: 'data.tasks.g2s_opt_stem_p', correct: false }] },
          ] },
      ] },
      { id: 'g2s-animals', worldId: 'g2sci', titleKey: 'data.topics.g2sAnimals', subject: 'logic', lessons: [
        { id: 'g2s-ani-l1', topicId: 'g2s-animals', titleKey: 'data.lessons.g2sAniL1',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g2s_anil1_0' }, { speaker: 'tali', textKey: 'data.dialog.g2s_anil1_1' }],
          intro: [{ titleKey: 'data.intro.g2s_anil1_0_t', bodyKey: 'data.intro.g2s_anil1_0_b', emoji: '🐘' }, { titleKey: 'data.intro.g2s_anil1_1_t', bodyKey: 'data.intro.g2s_anil1_1_b', emoji: '🦎' }],
          tasks: [
            { id: 'g2sanil1t1', type: 'multiple_choice', questionKey: 'data.tasks.g2s_mammal_is', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2s_opt_dog_cl', correct: true }, { id: 'b', textKey: 'data.tasks.g2s_opt_eagle_cl', correct: false }, { id: 'c', textKey: 'data.tasks.g2s_opt_frog_cl', correct: false }] },
            { id: 'g2sanil1t2', type: 'multiple_choice', questionKey: 'data.tasks.g2s_mammal_feature', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2s_opt_warm_blood', correct: true }, { id: 'b', textKey: 'data.tasks.g2s_opt_lays_eggs', correct: false }, { id: 'c', textKey: 'data.tasks.g2s_opt_cold_blood', correct: false }] },
            { id: 'g2sanil1t3', type: 'multiple_choice', questionKey: 'data.tasks.g2s_whale_mammal', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },
            { id: 'g2sanil1t4', type: 'multiple_choice', questionKey: 'data.tasks.g2s_bat_mammal', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },
          ] },
        { id: 'g2s-ani-l2', topicId: 'g2s-animals', titleKey: 'data.lessons.g2sAniL2',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g2s_anil2_0' }, { speaker: 'tali', textKey: 'data.dialog.g2s_anil2_1' }],
          intro: [{ titleKey: 'data.intro.g2s_anil2_0_t', bodyKey: 'data.intro.g2s_anil2_0_b', emoji: '🦅' }, { titleKey: 'data.intro.g2s_anil2_1_t', bodyKey: 'data.intro.g2s_anil2_1_b', emoji: '🐦' }],
          tasks: [
            { id: 'g2sanil2t1', type: 'multiple_choice', questionKey: 'data.tasks.g2s_bird_is', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2s_opt_sparrow_cl', correct: true }, { id: 'b', textKey: 'data.tasks.g2s_opt_bat_cl', correct: false }, { id: 'c', textKey: 'data.tasks.g2s_opt_fish_cl', correct: false }] },
            { id: 'g2sanil2t2', type: 'multiple_choice', questionKey: 'data.tasks.g2s_bird_feature', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2s_opt_has_feathers', correct: true }, { id: 'b', textKey: 'data.tasks.g2s_opt_has_fur', correct: false }, { id: 'c', textKey: 'data.tasks.g2s_opt_has_scales', correct: false }] },
            { id: 'g2sanil2t3', type: 'multiple_choice', questionKey: 'data.tasks.g2s_penguin_bird', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },
            { id: 'g2sanil2t4', type: 'multiple_choice', questionKey: 'data.tasks.g2s_all_birds_fly', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: false }, { id: 'b', textKey: 'data.tasks.opt_no', correct: true }] },
          ] },
        { id: 'g2s-ani-l3', topicId: 'g2s-animals', titleKey: 'data.lessons.g2sAniL3',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g2s_anil3_0' }, { speaker: 'tali', textKey: 'data.dialog.g2s_anil3_1' }],
          intro: [{ titleKey: 'data.intro.g2s_anil3_0_t', bodyKey: 'data.intro.g2s_anil3_0_b', emoji: '🐟' }, { titleKey: 'data.intro.g2s_anil3_1_t', bodyKey: 'data.intro.g2s_anil3_1_b', emoji: '🐌' }],
          tasks: [
            { id: 'g2sanil3t1', type: 'multiple_choice', questionKey: 'data.tasks.g2s_fish_breathes', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2s_opt_gills', correct: true }, { id: 'b', textKey: 'data.tasks.g2s_opt_lungs', correct: false }, { id: 'c', textKey: 'data.tasks.g2s_opt_skin', correct: false }] },
            { id: 'g2sanil3t2', type: 'multiple_choice', questionKey: 'data.tasks.g2s_insect_legs', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_four', correct: false }, { id: 'b', textKey: 'data.tasks.opt_six', correct: true }, { id: 'c', textKey: 'data.tasks.opt_eight', correct: false }] },
            { id: 'g2sanil3t3', type: 'multiple_choice', questionKey: 'data.tasks.g2s_spider_insect', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: false }, { id: 'b', textKey: 'data.tasks.opt_no', correct: true }] },
            { id: 'g2sanil3t4', type: 'multiple_choice', questionKey: 'data.tasks.g2s_butterfly_insect', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },
          ] },
      ] },
      { id: 'g2s-body', worldId: 'g2sci', titleKey: 'data.topics.g2sBody', subject: 'logic', lessons: [
        { id: 'g2s-bdy-l1', topicId: 'g2s-body', titleKey: 'data.lessons.g2sBdyL1',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g2s_bdyl1_0' }, { speaker: 'tali', textKey: 'data.dialog.g2s_bdyl1_1' }],
          intro: [{ titleKey: 'data.intro.g2s_bdyl1_0_t', bodyKey: 'data.intro.g2s_bdyl1_0_b', emoji: '🦴' }, { titleKey: 'data.intro.g2s_bdyl1_1_t', bodyKey: 'data.intro.g2s_bdyl1_1_b', emoji: '✏️' }],
          tasks: [
            { id: 'g2sbdyl1t1', type: 'multiple_choice', questionKey: 'data.tasks.g2s_skeleton_function', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2s_opt_support', correct: true }, { id: 'b', textKey: 'data.tasks.g2s_opt_digestion', correct: false }, { id: 'c', textKey: 'data.tasks.g2s_opt_breathing', correct: false }] },
            { id: 'g2sbdyl1t2', type: 'multiple_choice', questionKey: 'data.tasks.g2s_muscles_do', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2s_opt_move_body', correct: true }, { id: 'b', textKey: 'data.tasks.g2s_opt_digest', correct: false }, { id: 'c', textKey: 'data.tasks.g2s_opt_breathe', correct: false }] },
            { id: 'g2sbdyl1t3', type: 'multiple_choice', questionKey: 'data.tasks.g2s_bones_protect', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },
            { id: 'g2sbdyl1t4', type: 'multiple_choice', questionKey: 'data.tasks.g2s_biggest_bone', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2s_opt_femur', correct: true }, { id: 'b', textKey: 'data.tasks.g2s_opt_finger_bone', correct: false }, { id: 'c', textKey: 'data.tasks.g2s_opt_rib', correct: false }] },
          ] },
        { id: 'g2s-bdy-l2', topicId: 'g2s-body', titleKey: 'data.lessons.g2sBdyL2',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g2s_bdyl2_0' }, { speaker: 'tali', textKey: 'data.dialog.g2s_bdyl2_1' }],
          intro: [{ titleKey: 'data.intro.g2s_bdyl2_0_t', bodyKey: 'data.intro.g2s_bdyl2_0_b', emoji: '✔️' }, { titleKey: 'data.intro.g2s_bdyl2_1_t', bodyKey: 'data.intro.g2s_bdyl2_1_b', emoji: '💵' }],
          tasks: [
            { id: 'g2sbdyl2t1', type: 'multiple_choice', questionKey: 'data.tasks.g2s_heart_does', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2s_opt_pumps_blood', correct: true }, { id: 'b', textKey: 'data.tasks.g2s_opt_digests', correct: false }, { id: 'c', textKey: 'data.tasks.g2s_opt_breathes', correct: false }] },
            { id: 'g2sbdyl2t2', type: 'multiple_choice', questionKey: 'data.tasks.g2s_lungs_do', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2s_opt_pumps_blood', correct: false }, { id: 'b', textKey: 'data.tasks.g2s_opt_breathe_f', correct: true }, { id: 'c', textKey: 'data.tasks.g2s_opt_digest_f', correct: false }] },
            { id: 'g2sbdyl2t3', type: 'multiple_choice', questionKey: 'data.tasks.g2s_stomach_does', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2s_opt_pumps_blood', correct: false }, { id: 'b', textKey: 'data.tasks.g2s_opt_breathe_f', correct: false }, { id: 'c', textKey: 'data.tasks.g2s_opt_digest_f', correct: true }] },
            { id: 'g2sbdyl2t4', type: 'multiple_choice', questionKey: 'data.tasks.g2s_brain_controls', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },
          ] },
        { id: 'g2s-bdy-l3', topicId: 'g2s-body', titleKey: 'data.lessons.g2sBdyL3',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g2s_bdyl3_0' }, { speaker: 'tali', textKey: 'data.dialog.g2s_bdyl3_1' }],
          intro: [{ titleKey: 'data.intro.g2s_bdyl3_0_t', bodyKey: 'data.intro.g2s_bdyl3_0_b', emoji: '🥦' }, { titleKey: 'data.intro.g2s_bdyl3_1_t', bodyKey: 'data.intro.g2s_bdyl3_1_b', emoji: '✏️' }],
          tasks: [
            { id: 'g2sbdyl3t1', type: 'multiple_choice', questionKey: 'data.tasks.g2s_vitamins_in', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2s_opt_fruits_veg', correct: true }, { id: 'b', textKey: 'data.tasks.g2s_opt_candy', correct: false }, { id: 'c', textKey: 'data.tasks.g2s_opt_chips', correct: false }] },
            { id: 'g2sbdyl3t2', type: 'multiple_choice', questionKey: 'data.tasks.g2s_protein_in', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2s_opt_meat_eggs', correct: true }, { id: 'b', textKey: 'data.tasks.g2s_opt_sugar_food', correct: false }, { id: 'c', textKey: 'data.tasks.g2s_opt_water_only', correct: false }] },
            { id: 'g2sbdyl3t3', type: 'multiple_choice', questionKey: 'data.tasks.g2s_water_daily', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },
            { id: 'g2sbdyl3t4', type: 'multiple_choice', questionKey: 'data.tasks.g2s_sport_good', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },
          ] },
      ] },
    ],
  },
  {
    id: 'g2eng', titleKey: 'data.worlds.g2eng', descriptionKey: 'data.worldDesc.g2eng',
    biome: 'bridge', accentColor: '#00BCD4', npcEmoji: '🐸', ageBand: '8',
    topics: [
      { id: 'g2e-days', worldId: 'g2eng', titleKey: 'data.topics.g2eDays', subject: 'reading', lessons: [
        { id: 'g2e-days-l1', topicId: 'g2e-days', titleKey: 'data.lessons.g2eDaysL1',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g2e_daysl1_0' }, { speaker: 'tali', textKey: 'data.dialog.g2e_daysl1_1' }],
          intro: [{ titleKey: 'data.intro.g2e_daysl1_0_t', bodyKey: 'data.intro.g2e_daysl1_0_b', emoji: '📅' }, { titleKey: 'data.intro.g2e_daysl1_1_t', bodyKey: 'data.intro.g2e_daysl1_1_b', emoji: '✏️' }],
          tasks: [
            { id: 'g2edaysl1t1', type: 'multiple_choice', questionKey: 'data.tasks.g2e_monday_ru', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_monday', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_opt_tuesday', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_opt_wednesday', correct: false }] },
            { id: 'g2edaysl1t2', type: 'multiple_choice', questionKey: 'data.tasks.g2e_tuesday_ru', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_monday', correct: false }, { id: 'b', textKey: 'data.tasks.g2e_opt_tuesday', correct: true }, { id: 'c', textKey: 'data.tasks.g2e_opt_wednesday', correct: false }] },
            { id: 'g2edaysl1t3', type: 'multiple_choice', questionKey: 'data.tasks.g2e_wednesday_ru', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_monday', correct: false }, { id: 'b', textKey: 'data.tasks.g2e_opt_tuesday', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_opt_wednesday', correct: true }] },
            { id: 'g2edaysl1t4', type: 'multiple_choice', questionKey: 'data.tasks.g2e_after_monday', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_monday', correct: false }, { id: 'b', textKey: 'data.tasks.g2e_opt_tuesday', correct: true }, { id: 'c', textKey: 'data.tasks.g2e_opt_sunday', correct: false }] },
          ] },
        { id: 'g2e-days-l2', topicId: 'g2e-days', titleKey: 'data.lessons.g2eDaysL2',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g2e_daysl2_0' }, { speaker: 'tali', textKey: 'data.dialog.g2e_daysl2_1' }],
          intro: [{ titleKey: 'data.intro.g2e_daysl2_0_t', bodyKey: 'data.intro.g2e_daysl2_0_b', emoji: '📅' }, { titleKey: 'data.intro.g2e_daysl2_1_t', bodyKey: 'data.intro.g2e_daysl2_1_b', emoji: '📅' }],
          tasks: [
            { id: 'g2edaysl2t1', type: 'multiple_choice', questionKey: 'data.tasks.g2e_thursday_ru', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_thursday', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_opt_friday', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_opt_saturday', correct: false }] },
            { id: 'g2edaysl2t2', type: 'multiple_choice', questionKey: 'data.tasks.g2e_friday_ru', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_thursday', correct: false }, { id: 'b', textKey: 'data.tasks.g2e_opt_friday', correct: true }, { id: 'c', textKey: 'data.tasks.g2e_opt_sunday', correct: false }] },
            { id: 'g2edaysl2t3', type: 'multiple_choice', questionKey: 'data.tasks.g2e_weekend_days', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_sat_sun', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_opt_mon_fri', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_opt_thu_fri', correct: false }] },
            { id: 'g2edaysl2t4', type: 'multiple_choice', questionKey: 'data.tasks.g2e_days_in_week', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_five', correct: false }, { id: 'b', textKey: 'data.tasks.opt_six', correct: false }, { id: 'c', textKey: 'data.tasks.opt_seven', correct: true }] },
          ] },
        { id: 'g2e-days-l3', topicId: 'g2e-days', titleKey: 'data.lessons.g2eDaysL3',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g2e_daysl3_0' }, { speaker: 'tali', textKey: 'data.dialog.g2e_daysl3_1' }],
          intro: [{ titleKey: 'data.intro.g2e_daysl3_0_t', bodyKey: 'data.intro.g2e_daysl3_0_b', emoji: '📆' }, { titleKey: 'data.intro.g2e_daysl3_1_t', bodyKey: 'data.intro.g2e_daysl3_1_b', emoji: '🌎' }],
          tasks: [
            { id: 'g2edaysl3t1', type: 'multiple_choice', questionKey: 'data.tasks.g2e_january_ru', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_january', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_opt_february', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_opt_march', correct: false }] },
            { id: 'g2edaysl3t2', type: 'multiple_choice', questionKey: 'data.tasks.g2e_march_ru', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_january', correct: false }, { id: 'b', textKey: 'data.tasks.g2e_opt_february', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_opt_march', correct: true }] },
            { id: 'g2edaysl3t3', type: 'multiple_choice', questionKey: 'data.tasks.g2e_months_in_year', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_ten', correct: false }, { id: 'b', textKey: 'data.tasks.opt_11', correct: false }, { id: 'c', textKey: 'data.tasks.opt_12', correct: true }] },
            { id: 'g2edaysl3t4', type: 'multiple_choice', questionKey: 'data.tasks.g2e_summer_months', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_jun_aug', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_opt_dec_feb', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_opt_mar_may', correct: false }] },
          ] },
      ] },
      { id: 'g2e-phrases', worldId: 'g2eng', titleKey: 'data.topics.g2ePhrases', subject: 'reading', lessons: [
        { id: 'g2e-phr-l1', topicId: 'g2e-phrases', titleKey: 'data.lessons.g2ePhrL1',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g2e_phrl1_0' }, { speaker: 'tali', textKey: 'data.dialog.g2e_phrl1_1' }],
          intro: [{ titleKey: 'data.intro.g2e_phrl1_0_t', bodyKey: 'data.intro.g2e_phrl1_0_b', emoji: '👤' }, { titleKey: 'data.intro.g2e_phrl1_1_t', bodyKey: 'data.intro.g2e_phrl1_1_b', emoji: '✏️' }],
          tasks: [
            { id: 'g2ephrl1t1', type: 'multiple_choice', questionKey: 'data.tasks.g2e_i_am_blank_student', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_am', correct: true }, { id: 'b', textKey: 'data.tasks.g1e_opt_is', correct: false }, { id: 'c', textKey: 'data.tasks.g1e_opt_are', correct: false }] },
            { id: 'g2ephrl1t2', type: 'multiple_choice', questionKey: 'data.tasks.g2e_you_are_blank', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_am', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_is', correct: false }, { id: 'c', textKey: 'data.tasks.g1e_opt_are', correct: true }] },
            { id: 'g2ephrl1t3', type: 'multiple_choice', questionKey: 'data.tasks.g2e_i_am_means', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_ya_yavlyayus', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_opt_on_yavlyaetsya', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_opt_my_yavlyaemsya', correct: false }] },
            { id: 'g2ephrl1t4', type: 'multiple_choice', questionKey: 'data.tasks.g2e_we_blank_friends', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_am', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_is', correct: false }, { id: 'c', textKey: 'data.tasks.g1e_opt_are', correct: true }] },
          ] },
        { id: 'g2e-phr-l2', topicId: 'g2e-phrases', titleKey: 'data.lessons.g2ePhrL2',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g2e_phrl2_0' }, { speaker: 'tali', textKey: 'data.dialog.g2e_phrl2_1' }],
          intro: [{ titleKey: 'data.intro.g2e_phrl2_0_t', bodyKey: 'data.intro.g2e_phrl2_0_b', emoji: '🏫' }, { titleKey: 'data.intro.g2e_phrl2_1_t', bodyKey: 'data.intro.g2e_phrl2_1_b', emoji: '✏️' }],
          tasks: [
            { id: 'g2ephrl2t1', type: 'multiple_choice', questionKey: 'data.tasks.g2e_i_have_blank_cat', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_have', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_opt_has', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_opt_had', correct: false }] },
            { id: 'g2ephrl2t2', type: 'multiple_choice', questionKey: 'data.tasks.g2e_he_blank_dog', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_have', correct: false }, { id: 'b', textKey: 'data.tasks.g2e_opt_has', correct: true }, { id: 'c', textKey: 'data.tasks.g2e_opt_had', correct: false }] },
            { id: 'g2ephrl2t3', type: 'multiple_choice', questionKey: 'data.tasks.g2e_she_blank_book', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_have', correct: false }, { id: 'b', textKey: 'data.tasks.g2e_opt_has', correct: true }, { id: 'c', textKey: 'data.tasks.g2e_opt_had', correct: false }] },
            { id: 'g2ephrl2t4', type: 'multiple_choice', questionKey: 'data.tasks.g2e_they_blank_pens', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_have', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_opt_has', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_opt_had', correct: false }] },
          ] },
        { id: 'g2e-phr-l3', topicId: 'g2e-phrases', titleKey: 'data.lessons.g2ePhrL3',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g2e_phrl3_0' }, { speaker: 'tali', textKey: 'data.dialog.g2e_phrl3_1' }],
          intro: [{ titleKey: 'data.intro.g2e_phrl3_0_t', bodyKey: 'data.intro.g2e_phrl3_0_b', emoji: '✏️' }, { titleKey: 'data.intro.g2e_phrl3_1_t', bodyKey: 'data.intro.g2e_phrl3_1_b', emoji: '✏️' }],
          tasks: [
            { id: 'g2ephrl3t1', type: 'multiple_choice', questionKey: 'data.tasks.g2e_where_is_cat', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_where', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_opt_what', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_opt_who', correct: false }] },
            { id: 'g2ephrl3t2', type: 'multiple_choice', questionKey: 'data.tasks.g2e_what_is_this', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_where', correct: false }, { id: 'b', textKey: 'data.tasks.g2e_opt_what', correct: true }, { id: 'c', textKey: 'data.tasks.g2e_opt_who', correct: false }] },
            { id: 'g2ephrl3t3', type: 'multiple_choice', questionKey: 'data.tasks.g2e_who_is_this_person', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_where', correct: false }, { id: 'b', textKey: 'data.tasks.g2e_opt_what', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_opt_who', correct: true }] },
            { id: 'g2ephrl3t4', type: 'multiple_choice', questionKey: 'data.tasks.g2e_is_he_student', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_yes_he_is', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_opt_yes_he_are', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_opt_yes_he_am', correct: false }] },
          ] },
      ] },
      { id: 'g2e-school', worldId: 'g2eng', titleKey: 'data.topics.g2eSchool', subject: 'reading', lessons: [
        { id: 'g2e-sch-l1', topicId: 'g2e-school', titleKey: 'data.lessons.g2eSchL1',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g2e_schl1_0' }, { speaker: 'tali', textKey: 'data.dialog.g2e_schl1_1' }],
          intro: [{ titleKey: 'data.intro.g2e_schl1_0_t', bodyKey: 'data.intro.g2e_schl1_0_b', emoji: '✏️' }, { titleKey: 'data.intro.g2e_schl1_1_t', bodyKey: 'data.intro.g2e_schl1_1_b', emoji: '✏️' }],
          tasks: [
            { id: 'g2eschl1t1', type: 'multiple_choice', questionKey: 'data.tasks.g2e_book_en', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_book', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_opt_pen', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_opt_desk', correct: false }] },
            { id: 'g2eschl1t2', type: 'multiple_choice', questionKey: 'data.tasks.g2e_pen_en', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_book', correct: false }, { id: 'b', textKey: 'data.tasks.g2e_opt_pen', correct: true }, { id: 'c', textKey: 'data.tasks.g2e_opt_board', correct: false }] },
            { id: 'g2eschl1t3', type: 'multiple_choice', questionKey: 'data.tasks.g2e_chair_en', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_desk', correct: false }, { id: 'b', textKey: 'data.tasks.g2e_opt_chair', correct: true }, { id: 'c', textKey: 'data.tasks.g2e_opt_board', correct: false }] },
            { id: 'g2eschl1t4', type: 'multiple_choice', questionKey: 'data.tasks.g2e_board_en', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_desk', correct: false }, { id: 'b', textKey: 'data.tasks.g2e_opt_chair', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_opt_board', correct: true }] },
          ] },
        { id: 'g2e-sch-l2', topicId: 'g2e-school', titleKey: 'data.lessons.g2eSchL2',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g2e_schl2_0' }, { speaker: 'tali', textKey: 'data.dialog.g2e_schl2_1' }],
          intro: [{ titleKey: 'data.intro.g2e_schl2_0_t', bodyKey: 'data.intro.g2e_schl2_0_b', emoji: '🔟' }, { titleKey: 'data.intro.g2e_schl2_1_t', bodyKey: 'data.intro.g2e_schl2_1_b', emoji: '🏠' }],
          tasks: [
            { id: 'g2eschl2t1', type: 'multiple_choice', questionKey: 'data.tasks.g2e_math_in_en', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_maths', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_opt_music', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_opt_art', correct: false }] },
            { id: 'g2eschl2t2', type: 'multiple_choice', questionKey: 'data.tasks.g2e_art_in_en', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_maths', correct: false }, { id: 'b', textKey: 'data.tasks.g2e_opt_music', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_opt_art', correct: true }] },
            { id: 'g2eschl2t3', type: 'multiple_choice', questionKey: 'data.tasks.g2e_pe_in_en', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_pe', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_opt_science', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_opt_history', correct: false }] },
            { id: 'g2eschl2t4', type: 'multiple_choice', questionKey: 'data.tasks.g2e_english_subject', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_english', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_opt_maths', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_opt_art', correct: false }] },
          ] },
        { id: 'g2e-sch-l3', topicId: 'g2e-school', titleKey: 'data.lessons.g2eSchL3',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g2e_schl3_0' }, { speaker: 'tali', textKey: 'data.dialog.g2e_schl3_1' }],
          intro: [{ titleKey: 'data.intro.g2e_schl3_0_t', bodyKey: 'data.intro.g2e_schl3_0_b', emoji: '✏️' }, { titleKey: 'data.intro.g2e_schl3_1_t', bodyKey: 'data.intro.g2e_schl3_1_b', emoji: '✏️' }],
          tasks: [
            { id: 'g2eschl3t1', type: 'multiple_choice', questionKey: 'data.tasks.g2e_wake_up_means', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_wake_up', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_opt_go_to_bed', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_opt_eat_lunch', correct: false }] },
            { id: 'g2eschl3t2', type: 'multiple_choice', questionKey: 'data.tasks.g2e_go_to_school', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_wake_up', correct: false }, { id: 'b', textKey: 'data.tasks.g2e_opt_go_school', correct: true }, { id: 'c', textKey: 'data.tasks.g2e_opt_go_to_bed', correct: false }] },
            { id: 'g2eschl3t3', type: 'multiple_choice', questionKey: 'data.tasks.g2e_go_home_after', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_go_home', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_opt_go_school', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_opt_wake_up', correct: false }] },
            { id: 'g2eschl3t4', type: 'multiple_choice', questionKey: 'data.tasks.g2e_do_homework_means', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_do_hw', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_opt_play_games', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_opt_go_to_bed', correct: false }] },
          ] },
      ] },
    ],
  },


  // ---
  {
    id: 'g3math', titleKey: 'data.worlds.g3math', descriptionKey: 'data.worldDesc.g3math',
    biome: 'future', accentColor: '#607D8B', npcEmoji: '🤖', ageBand: '9-10',
    topics: [
      { id: 'g3m-1000', worldId: 'g3math', titleKey: 'data.topics.g3m1000', subject: 'math', lessons: [
        { id: 'g3m-1000-l1', topicId: 'g3m-1000', titleKey: 'data.lessons.g3m1000L1',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g3m_1000l1_0' }, { speaker: 'tali', textKey: 'data.dialog.g3m_1000l1_1' }],
          intro: [{ titleKey: 'data.intro.g3m_1000l1_0_t', bodyKey: 'data.intro.g3m_1000l1_0_b', emoji: '✏️' }, { titleKey: 'data.intro.g3m_1000l1_1_t', bodyKey: 'data.intro.g3m_1000l1_1_b', emoji: '✏️' }],
          tasks: [
            { id: 'g3m1000l1t1', type: 'multiple_choice', questionKey: 'data.tasks.g3m_3hundreds', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_200', correct: false }, { id: 'b', textKey: 'data.tasks.opt_300', correct: true }, { id: 'c', textKey: 'data.tasks.opt_400', correct: false }] },
            { id: 'g3m1000l1t2', type: 'multiple_choice', questionKey: 'data.tasks.g3m_5hundreds', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_400', correct: false }, { id: 'b', textKey: 'data.tasks.opt_500', correct: true }, { id: 'c', textKey: 'data.tasks.opt_600', correct: false }] },
            { id: 'g3m1000l1t3', type: 'input', questionKey: 'data.tasks.g3m_100x7', difficulty: 1, answer: '700' },
            { id: 'g3m1000l1t4', type: 'multiple_choice', questionKey: 'data.tasks.g3m_how_hundreds_in_1000', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_five', correct: false }, { id: 'b', textKey: 'data.tasks.opt_eight', correct: false }, { id: 'c', textKey: 'data.tasks.opt_ten', correct: true }] },
          ] },
        { id: 'g3m-1000-l2', topicId: 'g3m-1000', titleKey: 'data.lessons.g3m1000L2',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g3m_1000l2_0' }, { speaker: 'tali', textKey: 'data.dialog.g3m_1000l2_1' }],
          intro: [{ titleKey: 'data.intro.g3m_1000l2_0_t', bodyKey: 'data.intro.g3m_1000l2_0_b', emoji: '✏️' }, { titleKey: 'data.intro.g3m_1000l2_1_t', bodyKey: 'data.intro.g3m_1000l2_1_b', emoji: '🍌' }],
          tasks: [
            { id: 'g3m1000l2t1', type: 'input', questionKey: 'data.tasks.g3m_hundreds_in_347', difficulty: 1, answer: '3' },
            { id: 'g3m1000l2t2', type: 'input', questionKey: 'data.tasks.g3m_tens_in_456', difficulty: 1, answer: '5' },
            { id: 'g3m1000l2t3', type: 'input', questionKey: 'data.tasks.g3m_num_2h_3t_5u', difficulty: 2, answer: '235' },
            { id: 'g3m1000l2t4', type: 'multiple_choice', questionKey: 'data.tasks.g3m_biggest_398_403_389', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_398', correct: false }, { id: 'b', textKey: 'data.tasks.opt_403', correct: true }, { id: 'c', textKey: 'data.tasks.opt_389', correct: false }] },
          ] },
        { id: 'g3m-1000-l3', topicId: 'g3m-1000', titleKey: 'data.lessons.g3m1000L3',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g3m_1000l3_0' }, { speaker: 'tali', textKey: 'data.dialog.g3m_1000l3_1' }],
          intro: [{ titleKey: 'data.intro.g3m_1000l3_0_t', bodyKey: 'data.intro.g3m_1000l3_0_b', emoji: '➕' }, { titleKey: 'data.intro.g3m_1000l3_1_t', bodyKey: 'data.intro.g3m_1000l3_1_b', emoji: '➖' }],
          tasks: [
            { id: 'g3m1000l3t1', type: 'input', questionKey: 'data.tasks.g3m_200plus350', difficulty: 1, answer: '550' },
            { id: 'g3m1000l3t2', type: 'input', questionKey: 'data.tasks.g3m_600minus240', difficulty: 1, answer: '360' },
            { id: 'g3m1000l3t3', type: 'input', questionKey: 'data.tasks.g3m_450plus275', difficulty: 2, answer: '725' },
            { id: 'g3m1000l3t4', type: 'input', questionKey: 'data.tasks.g3m_800minus356', difficulty: 3, answer: '444' },
          ] },
      ] },
      { id: 'g3m-tables', worldId: 'g3math', titleKey: 'data.topics.g3mTables', subject: 'math', lessons: [
        { id: 'g3m-tab-l1', topicId: 'g3m-tables', titleKey: 'data.lessons.g3mTabL1',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g3m_tabl1_0' }, { speaker: 'tali', textKey: 'data.dialog.g3m_tabl1_1' }],
          intro: [{ titleKey: 'data.intro.g3m_tabl1_0_t', bodyKey: 'data.intro.g3m_tabl1_0_b', emoji: '4️⃣' }, { titleKey: 'data.intro.g3m_tabl1_1_t', bodyKey: 'data.intro.g3m_tabl1_1_b', emoji: '6️⃣' }],
          tasks: [
            { id: 'g3mtabl1t1', type: 'input', questionKey: 'data.tasks.g3m_4x6', difficulty: 1, answer: '24' },
            { id: 'g3mtabl1t2', type: 'input', questionKey: 'data.tasks.g3m_4x8', difficulty: 1, answer: '32' },
            { id: 'g3mtabl1t3', type: 'input', questionKey: 'data.tasks.g3m_6x7', difficulty: 2, answer: '42' },
            { id: 'g3mtabl1t4', type: 'input', questionKey: 'data.tasks.g3m_6x9', difficulty: 2, answer: '54' },
          ] },
        { id: 'g3m-tab-l2', topicId: 'g3m-tables', titleKey: 'data.lessons.g3mTabL2',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g3m_tabl2_0' }, { speaker: 'tali', textKey: 'data.dialog.g3m_tabl2_1' }],
          intro: [{ titleKey: 'data.intro.g3m_tabl2_0_t', bodyKey: 'data.intro.g3m_tabl2_0_b', emoji: '7️⃣' }, { titleKey: 'data.intro.g3m_tabl2_1_t', bodyKey: 'data.intro.g3m_tabl2_1_b', emoji: '8️⃣' }],
          tasks: [
            { id: 'g3mtabl2t1', type: 'input', questionKey: 'data.tasks.g3m_7x5', difficulty: 1, answer: '35' },
            { id: 'g3mtabl2t2', type: 'input', questionKey: 'data.tasks.g3m_7x8', difficulty: 2, answer: '56' },
            { id: 'g3mtabl2t3', type: 'input', questionKey: 'data.tasks.g3m_8x6', difficulty: 2, answer: '48' },
            { id: 'g3mtabl2t4', type: 'input', questionKey: 'data.tasks.g3m_8x9', difficulty: 3, answer: '72' },
          ] },
        { id: 'g3m-tab-l3', topicId: 'g3m-tables', titleKey: 'data.lessons.g3mTabL3',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g3m_tabl3_0' }, { speaker: 'tali', textKey: 'data.dialog.g3m_tabl3_1' }],
          intro: [{ titleKey: 'data.intro.g3m_tabl3_0_t', bodyKey: 'data.intro.g3m_tabl3_0_b', emoji: '9️⃣' }, { titleKey: 'data.intro.g3m_tabl3_1_t', bodyKey: 'data.intro.g3m_tabl3_1_b', emoji: '✖️' }],
          tasks: [
            { id: 'g3mtabl3t1', type: 'input', questionKey: 'data.tasks.g3m_9x4', difficulty: 1, answer: '36' },
            { id: 'g3mtabl3t2', type: 'input', questionKey: 'data.tasks.g3m_9x7', difficulty: 2, answer: '63' },
            { id: 'g3mtabl3t3', type: 'input', questionKey: 'data.tasks.g3m_9x9', difficulty: 2, answer: '81' },
            { id: 'g3mtabl3t4', type: 'multiple_choice', questionKey: 'data.tasks.g3m_9x6_check', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_52', correct: false }, { id: 'b', textKey: 'data.tasks.opt_54', correct: true }, { id: 'c', textKey: 'data.tasks.opt_56', correct: false }] },
          ] },
      ] },
      { id: 'g3m-divide', worldId: 'g3math', titleKey: 'data.topics.g3mDivide', subject: 'math', lessons: [
        { id: 'g3m-div-l1', topicId: 'g3m-divide', titleKey: 'data.lessons.g3mDivL1',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g3m_divl1_0' }, { speaker: 'tali', textKey: 'data.dialog.g3m_divl1_1' }],
          intro: [{ titleKey: 'data.intro.g3m_divl1_0_t', bodyKey: 'data.intro.g3m_divl1_0_b', emoji: '➗' }, { titleKey: 'data.intro.g3m_divl1_1_t', bodyKey: 'data.intro.g3m_divl1_1_b', emoji: '➗' }],
          tasks: [
            { id: 'g3mdivl1t1', type: 'multiple_choice', questionKey: 'data.tasks.g3m_div_concept', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3m_opt_div_split', correct: true }, { id: 'b', textKey: 'data.tasks.g3m_opt_div_add', correct: false }, { id: 'c', textKey: 'data.tasks.g3m_opt_div_mul', correct: false }] },
            { id: 'g3mdivl1t2', type: 'input', questionKey: 'data.tasks.g3m_6div2', difficulty: 1, answer: '3' },
            { id: 'g3mdivl1t3', type: 'input', questionKey: 'data.tasks.g3m_10div2', difficulty: 1, answer: '5' },
            { id: 'g3mdivl1t4', type: 'multiple_choice', questionKey: 'data.tasks.g3m_8div2_check', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_three', correct: false }, { id: 'b', textKey: 'data.tasks.opt_four', correct: true }, { id: 'c', textKey: 'data.tasks.opt_five', correct: false }] },
          ] },
        { id: 'g3m-div-l2', topicId: 'g3m-divide', titleKey: 'data.lessons.g3mDivL2',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g3m_divl2_0' }, { speaker: 'tali', textKey: 'data.dialog.g3m_divl2_1' }],
          intro: [{ titleKey: 'data.intro.g3m_divl2_0_t', bodyKey: 'data.intro.g3m_divl2_0_b', emoji: '2️⃣' }, { titleKey: 'data.intro.g3m_divl2_1_t', bodyKey: 'data.intro.g3m_divl2_1_b', emoji: '➗' }],
          tasks: [
            { id: 'g3mdivl2t1', type: 'input', questionKey: 'data.tasks.g3m_18div2', difficulty: 1, answer: '9' },
            { id: 'g3mdivl2t2', type: 'input', questionKey: 'data.tasks.g3m_14div2', difficulty: 1, answer: '7' },
            { id: 'g3mdivl2t3', type: 'input', questionKey: 'data.tasks.g3m_16div2', difficulty: 2, answer: '8' },
            { id: 'g3mdivl2t4', type: 'input', questionKey: 'data.tasks.g3m_20div2', difficulty: 1, answer: '10' },
          ] },
        { id: 'g3m-div-l3', topicId: 'g3m-divide', titleKey: 'data.lessons.g3mDivL3',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g3m_divl3_0' }, { speaker: 'tali', textKey: 'data.dialog.g3m_divl3_1' }],
          intro: [{ titleKey: 'data.intro.g3m_divl3_0_t', bodyKey: 'data.intro.g3m_divl3_0_b', emoji: '5️⃣' }, { titleKey: 'data.intro.g3m_divl3_1_t', bodyKey: 'data.intro.g3m_divl3_1_b', emoji: '➗' }],
          tasks: [
            { id: 'g3mdivl3t1', type: 'input', questionKey: 'data.tasks.g3m_25div5', difficulty: 1, answer: '5' },
            { id: 'g3mdivl3t2', type: 'input', questionKey: 'data.tasks.g3m_45div5', difficulty: 1, answer: '9' },
            { id: 'g3mdivl3t3', type: 'input', questionKey: 'data.tasks.g3m_30div10', difficulty: 1, answer: '3' },
            { id: 'g3mdivl3t4', type: 'input', questionKey: 'data.tasks.g3m_50div10', difficulty: 1, answer: '5' },
          ] },
      ] },
    ],
  },
  {
    id: 'g3rus', titleKey: 'data.worlds.g3rus', descriptionKey: 'data.worldDesc.g3rus',
    biome: 'castle', accentColor: '#795548', npcEmoji: '🦝', ageBand: '9-10',
    topics: [
      { id: 'g3r-gender', worldId: 'g3rus', titleKey: 'data.topics.g3rGender', subject: 'reading_ru', lessons: [
        { id: 'g3r-gen-l1', topicId: 'g3r-gender', titleKey: 'data.lessons.g3rGenL1',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g3r_genl1_0' }, { speaker: 'tali', textKey: 'data.dialog.g3r_genl1_1' }],
          intro: [{ titleKey: 'data.intro.g3r_genl1_0_t', bodyKey: 'data.intro.g3r_genl1_0_b', emoji: '♂️' }, { titleKey: 'data.intro.g3r_genl1_1_t', bodyKey: 'data.intro.g3r_genl1_1_b', emoji: '✏️' }],
          tasks: [
            { id: 'g3rgenl1t1', type: 'multiple_choice', questionKey: 'data.tasks.g3r_masc_question', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_opt_on', correct: true }, { id: 'b', textKey: 'data.tasks.g3r_opt_ona', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_opt_ono', correct: false }] },
            { id: 'g3rgenl1t2', type: 'multiple_choice', questionKey: 'data.tasks.g3r_dom_gender', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_opt_muzhskoy', correct: true }, { id: 'b', textKey: 'data.tasks.g3r_opt_zhenskiy', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_opt_sredniy', correct: false }] },
            { id: 'g3rgenl1t3', type: 'multiple_choice', questionKey: 'data.tasks.g3r_stol_gender', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_opt_muzhskoy', correct: true }, { id: 'b', textKey: 'data.tasks.g3r_opt_zhenskiy', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_opt_sredniy', correct: false }] },
            { id: 'g3rgenl1t4', type: 'multiple_choice', questionKey: 'data.tasks.g3r_drug_gender', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3r_opt_muzhskoy', correct: true }, { id: 'b', textKey: 'data.tasks.g3r_opt_zhenskiy', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_opt_sredniy', correct: false }] },
          ] },
        { id: 'g3r-gen-l2', topicId: 'g3r-gender', titleKey: 'data.lessons.g3rGenL2',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g3r_genl2_0' }, { speaker: 'tali', textKey: 'data.dialog.g3r_genl2_1' }],
          intro: [{ titleKey: 'data.intro.g3r_genl2_0_t', bodyKey: 'data.intro.g3r_genl2_0_b', emoji: '♀️' }, { titleKey: 'data.intro.g3r_genl2_1_t', bodyKey: 'data.intro.g3r_genl2_1_b', emoji: '✏️' }],
          tasks: [
            { id: 'g3rgenl2t1', type: 'multiple_choice', questionKey: 'data.tasks.g3r_fem_question', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_opt_on', correct: false }, { id: 'b', textKey: 'data.tasks.g3r_opt_ona', correct: true }, { id: 'c', textKey: 'data.tasks.g3r_opt_ono', correct: false }] },
            { id: 'g3rgenl2t2', type: 'multiple_choice', questionKey: 'data.tasks.g3r_koshka_gender', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_opt_muzhskoy', correct: false }, { id: 'b', textKey: 'data.tasks.g3r_opt_zhenskiy', correct: true }, { id: 'c', textKey: 'data.tasks.g3r_opt_sredniy', correct: false }] },
            { id: 'g3rgenl2t3', type: 'multiple_choice', questionKey: 'data.tasks.g3r_kniga_gender', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_opt_muzhskoy', correct: false }, { id: 'b', textKey: 'data.tasks.g3r_opt_zhenskiy', correct: true }, { id: 'c', textKey: 'data.tasks.g3r_opt_sredniy', correct: false }] },
            { id: 'g3rgenl2t4', type: 'multiple_choice', questionKey: 'data.tasks.g3r_devochka_gender', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3r_opt_muzhskoy', correct: false }, { id: 'b', textKey: 'data.tasks.g3r_opt_zhenskiy', correct: true }, { id: 'c', textKey: 'data.tasks.g3r_opt_sredniy', correct: false }] },
          ] },
        { id: 'g3r-gen-l3', topicId: 'g3r-gender', titleKey: 'data.lessons.g3rGenL3',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g3r_genl3_0' }, { speaker: 'tali', textKey: 'data.dialog.g3r_genl3_1' }],
          intro: [{ titleKey: 'data.intro.g3r_genl3_0_t', bodyKey: 'data.intro.g3r_genl3_0_b', emoji: '❤️' }, { titleKey: 'data.intro.g3r_genl3_1_t', bodyKey: 'data.intro.g3r_genl3_1_b', emoji: '✏️' }],
          tasks: [
            { id: 'g3rgenl3t1', type: 'multiple_choice', questionKey: 'data.tasks.g3r_neut_question', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_opt_on', correct: false }, { id: 'b', textKey: 'data.tasks.g3r_opt_ona', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_opt_ono', correct: true }] },
            { id: 'g3rgenl3t2', type: 'multiple_choice', questionKey: 'data.tasks.g3r_okno_gender', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_opt_muzhskoy', correct: false }, { id: 'b', textKey: 'data.tasks.g3r_opt_zhenskiy', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_opt_sredniy', correct: true }] },
            { id: 'g3rgenl3t3', type: 'multiple_choice', questionKey: 'data.tasks.g3r_solnce_gender', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3r_opt_muzhskoy', correct: false }, { id: 'b', textKey: 'data.tasks.g3r_opt_zhenskiy', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_opt_sredniy', correct: true }] },
            { id: 'g3rgenl3t4', type: 'multiple_choice', questionKey: 'data.tasks.g3r_moloko_gender', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3r_opt_muzhskoy', correct: false }, { id: 'b', textKey: 'data.tasks.g3r_opt_zhenskiy', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_opt_sredniy', correct: true }] },
          ] },
      ] },
      { id: 'g3r-verb', worldId: 'g3rus', titleKey: 'data.topics.g3rVerb', subject: 'reading_ru', lessons: [
        { id: 'g3r-verb-l1', topicId: 'g3r-verb', titleKey: 'data.lessons.g3rVerbL1',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g3r_verbl1_0' }, { speaker: 'tali', textKey: 'data.dialog.g3r_verbl1_1' }],
          intro: [{ titleKey: 'data.intro.g3r_verbl1_0_t', bodyKey: 'data.intro.g3r_verbl1_0_b', emoji: '🏄' }, { titleKey: 'data.intro.g3r_verbl1_1_t', bodyKey: 'data.intro.g3r_verbl1_1_b', emoji: '✏️' }],
          tasks: [
            { id: 'g3rverbl1t1', type: 'multiple_choice', questionKey: 'data.tasks.g3r_idet_present', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },
            { id: 'g3rverbl1t2', type: 'multiple_choice', questionKey: 'data.tasks.g3r_present_question', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_opt_chto_delal', correct: false }, { id: 'b', textKey: 'data.tasks.g3r_opt_chto_delaet', correct: true }, { id: 'c', textKey: 'data.tasks.g3r_opt_chto_budet', correct: false }] },
            { id: 'g3rverbl1t3', type: 'multiple_choice', questionKey: 'data.tasks.g3r_chital_is_present', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: false }, { id: 'b', textKey: 'data.tasks.opt_no', correct: true }] },
            { id: 'g3rverbl1t4', type: 'multiple_choice', questionKey: 'data.tasks.g3r_which_present', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3r_opt_chital', correct: false }, { id: 'b', textKey: 'data.tasks.g3r_opt_chitaet', correct: true }, { id: 'c', textKey: 'data.tasks.g3r_opt_budet_chitat', correct: false }] },
          ] },
        { id: 'g3r-verb-l2', topicId: 'g3r-verb', titleKey: 'data.lessons.g3rVerbL2',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g3r_verbl2_0' }, { speaker: 'tali', textKey: 'data.dialog.g3r_verbl2_1' }],
          intro: [{ titleKey: 'data.intro.g3r_verbl2_0_t', bodyKey: 'data.intro.g3r_verbl2_0_b', emoji: '✏️' }, { titleKey: 'data.intro.g3r_verbl2_1_t', bodyKey: 'data.intro.g3r_verbl2_1_b', emoji: '✏️' }],
          tasks: [
            { id: 'g3rverbl2t1', type: 'multiple_choice', questionKey: 'data.tasks.g3r_past_question', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_opt_chto_delal', correct: true }, { id: 'b', textKey: 'data.tasks.g3r_opt_chto_delaet', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_opt_chto_budet', correct: false }] },
            { id: 'g3rverbl2t2', type: 'multiple_choice', questionKey: 'data.tasks.g3r_chital_past', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },
            { id: 'g3rverbl2t3', type: 'multiple_choice', questionKey: 'data.tasks.g3r_which_past', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3r_opt_chitaet', correct: false }, { id: 'b', textKey: 'data.tasks.g3r_opt_chital', correct: true }, { id: 'c', textKey: 'data.tasks.g3r_opt_budet_chitat', correct: false }] },
            { id: 'g3rverbl2t4', type: 'multiple_choice', questionKey: 'data.tasks.g3r_past_changes_gender', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },
          ] },
        { id: 'g3r-verb-l3', topicId: 'g3r-verb', titleKey: 'data.lessons.g3rVerbL3',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g3r_verbl3_0' }, { speaker: 'tali', textKey: 'data.dialog.g3r_verbl3_1' }],
          intro: [{ titleKey: 'data.intro.g3r_verbl3_0_t', bodyKey: 'data.intro.g3r_verbl3_0_b', emoji: '✏️' }, { titleKey: 'data.intro.g3r_verbl3_1_t', bodyKey: 'data.intro.g3r_verbl3_1_b', emoji: '✏️' }],
          tasks: [
            { id: 'g3rverbl3t1', type: 'multiple_choice', questionKey: 'data.tasks.g3r_future_question', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_opt_chto_delal', correct: false }, { id: 'b', textKey: 'data.tasks.g3r_opt_chto_delaet', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_opt_chto_budet', correct: true }] },
            { id: 'g3rverbl3t2', type: 'multiple_choice', questionKey: 'data.tasks.g3r_which_future', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_opt_chital', correct: false }, { id: 'b', textKey: 'data.tasks.g3r_opt_chitaet', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_opt_budet_chitat', correct: true }] },
            { id: 'g3rverbl3t3', type: 'multiple_choice', questionKey: 'data.tasks.g3r_budet_idet_future', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: false }, { id: 'b', textKey: 'data.tasks.opt_no', correct: true }] },
            { id: 'g3rverbl3t4', type: 'multiple_choice', questionKey: 'data.tasks.g3r_budet_idti_future', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },
          ] },
      ] },
      { id: 'g3r-adj', worldId: 'g3rus', titleKey: 'data.topics.g3rAdj', subject: 'reading_ru', lessons: [
        { id: 'g3r-adj-l1', topicId: 'g3r-adj', titleKey: 'data.lessons.g3rAdjL1',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g3r_adjl1_0' }, { speaker: 'tali', textKey: 'data.dialog.g3r_adjl1_1' }],
          intro: [{ titleKey: 'data.intro.g3r_adjl1_0_t', bodyKey: 'data.intro.g3r_adjl1_0_b', emoji: '🌐' }, { titleKey: 'data.intro.g3r_adjl1_1_t', bodyKey: 'data.intro.g3r_adjl1_1_b', emoji: '🏠' }],
          tasks: [
            { id: 'g3radjl1t1', type: 'multiple_choice', questionKey: 'data.tasks.g3r_krasny_adj', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },
            { id: 'g3radjl1t2', type: 'multiple_choice', questionKey: 'data.tasks.g3r_adj_color_examples', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_opt_sinil_belyj', correct: true }, { id: 'b', textKey: 'data.tasks.g3r_opt_idet_sidit', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_opt_stol_kniga', correct: false }] },
            { id: 'g3radjl1t3', type: 'multiple_choice', questionKey: 'data.tasks.g3r_zeleny_dom_adj', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3r_opt_zeleny', correct: true }, { id: 'b', textKey: 'data.tasks.g3r_opt_dom', correct: false }] },
            { id: 'g3radjl1t4', type: 'multiple_choice', questionKey: 'data.tasks.g3r_adj_for_masc', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3r_opt_krasny', correct: true }, { id: 'b', textKey: 'data.tasks.g3r_opt_krasnaya', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_opt_krasnoe', correct: false }] },
          ] },
        { id: 'g3r-adj-l2', topicId: 'g3r-adj', titleKey: 'data.lessons.g3rAdjL2',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g3r_adjl2_0' }, { speaker: 'tali', textKey: 'data.dialog.g3r_adjl2_1' }],
          intro: [{ titleKey: 'data.intro.g3r_adjl2_0_t', bodyKey: 'data.intro.g3r_adjl2_0_b', emoji: '✏️' }, { titleKey: 'data.intro.g3r_adjl2_1_t', bodyKey: 'data.intro.g3r_adjl2_1_b', emoji: '🧪' }],
          tasks: [
            { id: 'g3radjl2t1', type: 'multiple_choice', questionKey: 'data.tasks.g3r_bolshoy_adj', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },
            { id: 'g3radjl2t2', type: 'multiple_choice', questionKey: 'data.tasks.g3r_size_adj_examples', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_opt_bolshoy_maliy', correct: true }, { id: 'b', textKey: 'data.tasks.g3r_opt_idet_bezhit', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_opt_dom_shkola', correct: false }] },
            { id: 'g3radjl2t3', type: 'multiple_choice', questionKey: 'data.tasks.g3r_malenkaya_sobaka_adj', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3r_opt_malenkaya', correct: true }, { id: 'b', textKey: 'data.tasks.g3r_opt_sobaka', correct: false }] },
            { id: 'g3radjl2t4', type: 'multiple_choice', questionKey: 'data.tasks.g3r_adj_for_fem', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3r_opt_krasny', correct: false }, { id: 'b', textKey: 'data.tasks.g3r_opt_krasnaya', correct: true }, { id: 'c', textKey: 'data.tasks.g3r_opt_krasnoe', correct: false }] },
          ] },
        { id: 'g3r-adj-l3', topicId: 'g3r-adj', titleKey: 'data.lessons.g3rAdjL3',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g3r_adjl3_0' }, { speaker: 'tali', textKey: 'data.dialog.g3r_adjl3_1' }],
          intro: [{ titleKey: 'data.intro.g3r_adjl3_0_t', bodyKey: 'data.intro.g3r_adjl3_0_b', emoji: '🤍' }, { titleKey: 'data.intro.g3r_adjl3_1_t', bodyKey: 'data.intro.g3r_adjl3_1_b', emoji: '✏️' }],
          tasks: [
            { id: 'g3radjl3t1', type: 'multiple_choice', questionKey: 'data.tasks.g3r_krasny_for_stol', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_opt_krasny', correct: true }, { id: 'b', textKey: 'data.tasks.g3r_opt_krasnaya', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_opt_krasnoe', correct: false }] },
            { id: 'g3radjl3t2', type: 'multiple_choice', questionKey: 'data.tasks.g3r_krasnoe_for_okno', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_opt_krasny', correct: false }, { id: 'b', textKey: 'data.tasks.g3r_opt_krasnaya', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_opt_krasnoe', correct: true }] },
            { id: 'g3radjl3t3', type: 'multiple_choice', questionKey: 'data.tasks.g3r_krasnaya_for_kniga', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3r_opt_krasny', correct: false }, { id: 'b', textKey: 'data.tasks.g3r_opt_krasnaya', correct: true }, { id: 'c', textKey: 'data.tasks.g3r_opt_krasnoe', correct: false }] },
            { id: 'g3radjl3t4', type: 'multiple_choice', questionKey: 'data.tasks.g3r_adj_agrees_noun', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },
          ] },
      ] },
    ],
  },
  {
    id: 'g3world', titleKey: 'data.worlds.g3world', descriptionKey: 'data.worldDesc.g3world',
    biome: 'globe', accentColor: '#009688', npcEmoji: '🌏', ageBand: '9-10',
    topics: [
      { id: 'g3w-geo', worldId: 'g3world', titleKey: 'data.topics.g3wGeo', subject: 'logic', lessons: [
        { id: 'g3w-geo-l1', topicId: 'g3w-geo', titleKey: 'data.lessons.g3wGeoL1',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g3w_geol1_0' }, { speaker: 'tali', textKey: 'data.dialog.g3w_geol1_1' }],
          intro: [{ titleKey: 'data.intro.g3w_geol1_0_t', bodyKey: 'data.intro.g3w_geol1_0_b', emoji: '🌌' }, { titleKey: 'data.intro.g3w_geol1_1_t', bodyKey: 'data.intro.g3w_geol1_1_b', emoji: '🗺️' }],
          tasks: [
            { id: 'g3wgeol1t1', type: 'multiple_choice', questionKey: 'data.tasks.g3w_continents_count', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_five', correct: false }, { id: 'b', textKey: 'data.tasks.opt_six', correct: false }, { id: 'c', textKey: 'data.tasks.opt_seven', correct: true }] },
            { id: 'g3wgeol1t2', type: 'multiple_choice', questionKey: 'data.tasks.g3w_largest_continent', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3w_opt_africa', correct: false }, { id: 'b', textKey: 'data.tasks.g3w_opt_eurasia', correct: true }, { id: 'c', textKey: 'data.tasks.g3w_opt_america', correct: false }] },
            { id: 'g3wgeol1t3', type: 'multiple_choice', questionKey: 'data.tasks.g3w_smallest_continent', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3w_opt_australia', correct: true }, { id: 'b', textKey: 'data.tasks.g3w_opt_antarctica', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_opt_europe', correct: false }] },
            { id: 'g3wgeol1t4', type: 'multiple_choice', questionKey: 'data.tasks.g3w_russia_on_continent', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3w_opt_africa', correct: false }, { id: 'b', textKey: 'data.tasks.g3w_opt_eurasia', correct: true }, { id: 'c', textKey: 'data.tasks.g3w_opt_america', correct: false }] },
          ] },
        { id: 'g3w-geo-l2', topicId: 'g3w-geo', titleKey: 'data.lessons.g3wGeoL2',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g3w_geol2_0' }, { speaker: 'tali', textKey: 'data.dialog.g3w_geol2_1' }],
          intro: [{ titleKey: 'data.intro.g3w_geol2_0_t', bodyKey: 'data.intro.g3w_geol2_0_b', emoji: '🌈' }, { titleKey: 'data.intro.g3w_geol2_1_t', bodyKey: 'data.intro.g3w_geol2_1_b', emoji: '🗺️' }],
          tasks: [
            { id: 'g3wgeol2t1', type: 'multiple_choice', questionKey: 'data.tasks.g3w_oceans_count', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_three', correct: false }, { id: 'b', textKey: 'data.tasks.opt_four', correct: false }, { id: 'c', textKey: 'data.tasks.opt_five', correct: true }] },
            { id: 'g3wgeol2t2', type: 'multiple_choice', questionKey: 'data.tasks.g3w_largest_ocean', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3w_opt_pacific', correct: true }, { id: 'b', textKey: 'data.tasks.g3w_opt_atlantic', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_opt_indian', correct: false }] },
            { id: 'g3wgeol2t3', type: 'multiple_choice', questionKey: 'data.tasks.g3w_arctic_ocean', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3w_opt_north_pole', correct: true }, { id: 'b', textKey: 'data.tasks.g3w_opt_south_pole', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_opt_equator', correct: false }] },
            { id: 'g3wgeol2t4', type: 'multiple_choice', questionKey: 'data.tasks.g3w_water_more', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },
          ] },
        { id: 'g3w-geo-l3', topicId: 'g3w-geo', titleKey: 'data.lessons.g3wGeoL3',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g3w_geol3_0' }, { speaker: 'tali', textKey: 'data.dialog.g3w_geol3_1' }],
          intro: [{ titleKey: 'data.intro.g3w_geol3_0_t', bodyKey: 'data.intro.g3w_geol3_0_b', emoji: '🏔️' }, { titleKey: 'data.intro.g3w_geol3_1_t', bodyKey: 'data.intro.g3w_geol3_1_b', emoji: '🌍' }],
          tasks: [
            { id: 'g3wgeol3t1', type: 'multiple_choice', questionKey: 'data.tasks.g3w_russia_capital', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3w_opt_moscow', correct: true }, { id: 'b', textKey: 'data.tasks.g3w_opt_spb', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_opt_novosibirsk', correct: false }] },
            { id: 'g3wgeol3t2', type: 'multiple_choice', questionKey: 'data.tasks.g3w_france_capital', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3w_opt_london', correct: false }, { id: 'b', textKey: 'data.tasks.g3w_opt_paris', correct: true }, { id: 'c', textKey: 'data.tasks.g3w_opt_berlin', correct: false }] },
            { id: 'g3wgeol3t3', type: 'multiple_choice', questionKey: 'data.tasks.g3w_uk_capital', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3w_opt_london', correct: true }, { id: 'b', textKey: 'data.tasks.g3w_opt_paris', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_opt_berlin', correct: false }] },
            { id: 'g3wgeol3t4', type: 'multiple_choice', questionKey: 'data.tasks.g3w_kyrgyzstan_capital', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3w_opt_bishkek', correct: true }, { id: 'b', textKey: 'data.tasks.g3w_opt_almaty', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_opt_tashkent', correct: false }] },
          ] },
      ] },
      { id: 'g3w-nature', worldId: 'g3world', titleKey: 'data.topics.g3wNature', subject: 'logic', lessons: [
        { id: 'g3w-nat-l1', topicId: 'g3w-nature', titleKey: 'data.lessons.g3wNatL1',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g3w_natl1_0' }, { speaker: 'tali', textKey: 'data.dialog.g3w_natl1_1' }],
          intro: [{ titleKey: 'data.intro.g3w_natl1_0_t', bodyKey: 'data.intro.g3w_natl1_0_b', emoji: '✏️' }, { titleKey: 'data.intro.g3w_natl1_1_t', bodyKey: 'data.intro.g3w_natl1_1_b', emoji: '✏️' }],
          tasks: [
            { id: 'g3wnatl1t1', type: 'multiple_choice', questionKey: 'data.tasks.g3w_water_cycle_steps', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3w_opt_evaporation', correct: true }, { id: 'b', textKey: 'data.tasks.g3w_opt_explosion', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_opt_erosion', correct: false }] },
            { id: 'g3wnatl1t2', type: 'multiple_choice', questionKey: 'data.tasks.g3w_clouds_form_from', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3w_opt_water_vapor', correct: true }, { id: 'b', textKey: 'data.tasks.g3w_opt_dust', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_opt_smoke', correct: false }] },
            { id: 'g3wnatl1t3', type: 'multiple_choice', questionKey: 'data.tasks.g3w_rain_comes_from', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3w_opt_clouds', correct: true }, { id: 'b', textKey: 'data.tasks.g3w_opt_rivers', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_opt_sea', correct: false }] },
            { id: 'g3wnatl1t4', type: 'multiple_choice', questionKey: 'data.tasks.g3w_water_evaporates', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },
          ] },
        { id: 'g3w-nat-l2', topicId: 'g3w-nature', titleKey: 'data.lessons.g3wNatL2',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g3w_natl2_0' }, { speaker: 'tali', textKey: 'data.dialog.g3w_natl2_1' }],
          intro: [{ titleKey: 'data.intro.g3w_natl2_0_t', bodyKey: 'data.intro.g3w_natl2_0_b', emoji: '🌑' }, { titleKey: 'data.intro.g3w_natl2_1_t', bodyKey: 'data.intro.g3w_natl2_1_b', emoji: '🌒' }],
          tasks: [
            { id: 'g3wnatl2t1', type: 'multiple_choice', questionKey: 'data.tasks.g3w_hottest_zone', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3w_opt_equatorial', correct: true }, { id: 'b', textKey: 'data.tasks.g3w_opt_temperate', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_opt_polar', correct: false }] },
            { id: 'g3wnatl2t2', type: 'multiple_choice', questionKey: 'data.tasks.g3w_coldest_zone', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3w_opt_equatorial', correct: false }, { id: 'b', textKey: 'data.tasks.g3w_opt_temperate', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_opt_polar', correct: true }] },
            { id: 'g3wnatl2t3', type: 'multiple_choice', questionKey: 'data.tasks.g3w_russia_zone', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3w_opt_temperate', correct: true }, { id: 'b', textKey: 'data.tasks.g3w_opt_equatorial', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_opt_polar', correct: false }] },
            { id: 'g3wnatl2t4', type: 'multiple_choice', questionKey: 'data.tasks.g3w_desert_zone', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3w_opt_equatorial', correct: false }, { id: 'b', textKey: 'data.tasks.g3w_opt_desert_z', correct: true }, { id: 'c', textKey: 'data.tasks.g3w_opt_polar', correct: false }] },
          ] },
        { id: 'g3w-nat-l3', topicId: 'g3w-nature', titleKey: 'data.lessons.g3wNatL3',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g3w_natl3_0' }, { speaker: 'tali', textKey: 'data.dialog.g3w_natl3_1' }],
          intro: [{ titleKey: 'data.intro.g3w_natl3_0_t', bodyKey: 'data.intro.g3w_natl3_0_b', emoji: '🌙' }, { titleKey: 'data.intro.g3w_natl3_1_t', bodyKey: 'data.intro.g3w_natl3_1_b', emoji: '🌕' }],
          tasks: [
            { id: 'g3wnatl3t1', type: 'multiple_choice', questionKey: 'data.tasks.g3w_protect_nature_how', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3w_opt_recycle', correct: true }, { id: 'b', textKey: 'data.tasks.g3w_opt_burn_trash', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_opt_cut_trees', correct: false }] },
            { id: 'g3wnatl3t2', type: 'multiple_choice', questionKey: 'data.tasks.g3w_plant_trees_help', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },
            { id: 'g3wnatl3t3', type: 'multiple_choice', questionKey: 'data.tasks.g3w_red_book_is', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3w_opt_endangered', correct: true }, { id: 'b', textKey: 'data.tasks.g3w_opt_extinct', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_opt_recipe_book', correct: false }] },
            { id: 'g3wnatl3t4', type: 'multiple_choice', questionKey: 'data.tasks.g3w_recycling_good', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },
          ] },
      ] },
      { id: 'g3w-eco', worldId: 'g3world', titleKey: 'data.topics.g3wEco', subject: 'logic', lessons: [
        { id: 'g3w-eco-l1', topicId: 'g3w-eco', titleKey: 'data.lessons.g3wEcoL1',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g3w_ecol1_0' }, { speaker: 'tali', textKey: 'data.dialog.g3w_ecol1_1' }],
          intro: [{ titleKey: 'data.intro.g3w_ecol1_0_t', bodyKey: 'data.intro.g3w_ecol1_0_b', emoji: '🌱' }, { titleKey: 'data.intro.g3w_ecol1_1_t', bodyKey: 'data.intro.g3w_ecol1_1_b', emoji: '🤍' }],
          tasks: [
            { id: 'g3wecol1t1', type: 'multiple_choice', questionKey: 'data.tasks.g3w_ecology_studies', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3w_opt_nature_relations', correct: true }, { id: 'b', textKey: 'data.tasks.g3w_opt_math_calc', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_opt_history', correct: false }] },
            { id: 'g3wecol1t2', type: 'multiple_choice', questionKey: 'data.tasks.g3w_pollution_is_bad', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },
            { id: 'g3wecol1t3', type: 'multiple_choice', questionKey: 'data.tasks.g3w_save_water_how', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3w_opt_turn_off_tap', correct: true }, { id: 'b', textKey: 'data.tasks.g3w_opt_leave_tap_on', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_opt_bath_daily', correct: false }] },
            { id: 'g3wecol1t4', type: 'multiple_choice', questionKey: 'data.tasks.g3w_nature_belongs_to', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3w_opt_everyone', correct: true }, { id: 'b', textKey: 'data.tasks.g3w_opt_no_one', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_opt_adults_only', correct: false }] },
          ] },
        { id: 'g3w-eco-l2', topicId: 'g3w-eco', titleKey: 'data.lessons.g3wEcoL2',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g3w_ecol2_0' }, { speaker: 'tali', textKey: 'data.dialog.g3w_ecol2_1' }],
          intro: [{ titleKey: 'data.intro.g3w_ecol2_0_t', bodyKey: 'data.intro.g3w_ecol2_0_b', emoji: '🏞️' }, { titleKey: 'data.intro.g3w_ecol2_1_t', bodyKey: 'data.intro.g3w_ecol2_1_b', emoji: '✏️' }],
          tasks: [
            { id: 'g3wecol2t1', type: 'multiple_choice', questionKey: 'data.tasks.g3w_air_pollution_cause', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3w_opt_factories', correct: true }, { id: 'b', textKey: 'data.tasks.g3w_opt_trees', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_opt_rain', correct: false }] },
            { id: 'g3wecol2t2', type: 'multiple_choice', questionKey: 'data.tasks.g3w_forest_importance', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3w_opt_makes_oxygen', correct: true }, { id: 'b', textKey: 'data.tasks.g3w_opt_pollutes_air', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_opt_dries_rivers', correct: false }] },
            { id: 'g3wecol2t3', type: 'multiple_choice', questionKey: 'data.tasks.g3w_plastic_problem', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },
            { id: 'g3wecol2t4', type: 'multiple_choice', questionKey: 'data.tasks.g3w_garbage_sort', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },
          ] },
        { id: 'g3w-eco-l3', topicId: 'g3w-eco', titleKey: 'data.lessons.g3wEcoL3',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g3w_ecol3_0' }, { speaker: 'tali', textKey: 'data.dialog.g3w_ecol3_1' }],
          intro: [{ titleKey: 'data.intro.g3w_ecol3_0_t', bodyKey: 'data.intro.g3w_ecol3_0_b', emoji: '🐘ј' }, { titleKey: 'data.intro.g3w_ecol3_1_t', bodyKey: 'data.intro.g3w_ecol3_1_b', emoji: '✔️' }],
          tasks: [
            { id: 'g3wecol3t1', type: 'multiple_choice', questionKey: 'data.tasks.g3w_amur_tiger_endangered', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },
            { id: 'g3wecol3t2', type: 'multiple_choice', questionKey: 'data.tasks.g3w_poaching_is', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3w_opt_illegal_hunting', correct: true }, { id: 'b', textKey: 'data.tasks.g3w_opt_legal_hunting', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_opt_bird_watching', correct: false }] },
            { id: 'g3wecol3t3', type: 'multiple_choice', questionKey: 'data.tasks.g3w_zoo_protects', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },
            { id: 'g3wecol3t4', type: 'multiple_choice', questionKey: 'data.tasks.g3w_child_help_nature', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },
          ] },
      ] },
    ],
  },
  {
    id: 'g3eng', titleKey: 'data.worlds.g3eng', descriptionKey: 'data.worldDesc.g3eng',
    biome: 'academy', accentColor: '#FF5722', npcEmoji: '🎓', ageBand: '9-10',
    topics: [
      { id: 'g3e-tobe', worldId: 'g3eng', titleKey: 'data.topics.g3eTobe', subject: 'reading', lessons: [
        { id: 'g3e-tobe-l1', topicId: 'g3e-tobe', titleKey: 'data.lessons.g3eTobeL1',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g3e_tobel1_0' }, { speaker: 'tali', textKey: 'data.dialog.g3e_tobel1_1' }],
          intro: [{ titleKey: 'data.intro.g3e_tobel1_0_t', bodyKey: 'data.intro.g3e_tobel1_0_b', emoji: '👤' }, { titleKey: 'data.intro.g3e_tobel1_1_t', bodyKey: 'data.intro.g3e_tobel1_1_b', emoji: '✏️' }],
          tasks: [
            { id: 'g3etobel1t1', type: 'multiple_choice', questionKey: 'data.tasks.g3e_i_blank_happy', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_am', correct: true }, { id: 'b', textKey: 'data.tasks.g1e_opt_is', correct: false }, { id: 'c', textKey: 'data.tasks.g1e_opt_are', correct: false }] },
            { id: 'g3etobel1t2', type: 'multiple_choice', questionKey: 'data.tasks.g3e_you_blank_smart', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_am', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_is', correct: false }, { id: 'c', textKey: 'data.tasks.g1e_opt_are', correct: true }] },
            { id: 'g3etobel1t3', type: 'multiple_choice', questionKey: 'data.tasks.g3e_am_used_with', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3e_opt_I_pron', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_opt_you_pron', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_opt_he_pron', correct: false }] },
            { id: 'g3etobel1t4', type: 'multiple_choice', questionKey: 'data.tasks.g3e_am_negative', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3e_opt_i_am_not', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_opt_i_is_not', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_opt_i_are_not', correct: false }] },
          ] },
        { id: 'g3e-tobe-l2', topicId: 'g3e-tobe', titleKey: 'data.lessons.g3eTobeL2',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g3e_tobel2_0' }, { speaker: 'tali', textKey: 'data.dialog.g3e_tobel2_1' }],
          intro: [{ titleKey: 'data.intro.g3e_tobel2_0_t', bodyKey: 'data.intro.g3e_tobel2_0_b', emoji: '1️⃣' }, { titleKey: 'data.intro.g3e_tobel2_1_t', bodyKey: 'data.intro.g3e_tobel2_1_b', emoji: '💧' }],
          tasks: [
            { id: 'g3etobel2t1', type: 'multiple_choice', questionKey: 'data.tasks.g3e_he_blank_tall', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_am', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_is', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_are', correct: false }] },
            { id: 'g3etobel2t2', type: 'multiple_choice', questionKey: 'data.tasks.g3e_she_blank_kind', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_am', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_is', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_are', correct: false }] },
            { id: 'g3etobel2t3', type: 'multiple_choice', questionKey: 'data.tasks.g3e_it_blank_big', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_am', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_is', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_are', correct: false }] },
            { id: 'g3etobel2t4', type: 'multiple_choice', questionKey: 'data.tasks.g3e_is_question_tag', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3e_opt_is_he', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_opt_am_he', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_opt_are_he', correct: false }] },
          ] },
        { id: 'g3e-tobe-l3', topicId: 'g3e-tobe', titleKey: 'data.lessons.g3eTobeL3',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g3e_tobel3_0' }, { speaker: 'tali', textKey: 'data.dialog.g3e_tobel3_1' }],
          intro: [{ titleKey: 'data.intro.g3e_tobel3_0_t', bodyKey: 'data.intro.g3e_tobel3_0_b', emoji: '✏️' }, { titleKey: 'data.intro.g3e_tobel3_1_t', bodyKey: 'data.intro.g3e_tobel3_1_b', emoji: '✏️' }],
          tasks: [
            { id: 'g3etobel3t1', type: 'multiple_choice', questionKey: 'data.tasks.g3e_we_blank_ready', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_am', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_is', correct: false }, { id: 'c', textKey: 'data.tasks.g1e_opt_are', correct: true }] },
            { id: 'g3etobel3t2', type: 'multiple_choice', questionKey: 'data.tasks.g3e_they_blank_students', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_am', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_is', correct: false }, { id: 'c', textKey: 'data.tasks.g1e_opt_are', correct: true }] },
            { id: 'g3etobel3t3', type: 'multiple_choice', questionKey: 'data.tasks.g3e_are_they_question', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3e_opt_are_they', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_opt_is_they', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_opt_am_they', correct: false }] },
            { id: 'g3etobel3t4', type: 'multiple_choice', questionKey: 'data.tasks.g3e_are_we_question', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3e_opt_are_we', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_opt_is_we', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_opt_am_we', correct: false }] },
          ] },
      ] },
      { id: 'g3e-food', worldId: 'g3eng', titleKey: 'data.topics.g3eFood', subject: 'reading', lessons: [
        { id: 'g3e-food-l1', topicId: 'g3e-food', titleKey: 'data.lessons.g3eFoodL1',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g3e_foodl1_0' }, { speaker: 'tali', textKey: 'data.dialog.g3e_foodl1_1' }],
          intro: [{ titleKey: 'data.intro.g3e_foodl1_0_t', bodyKey: 'data.intro.g3e_foodl1_0_b', emoji: '🍎' }, { titleKey: 'data.intro.g3e_foodl1_1_t', bodyKey: 'data.intro.g3e_foodl1_1_b', emoji: '❓' }],
          tasks: [
            { id: 'g3efoodl1t1', type: 'multiple_choice', questionKey: 'data.tasks.g3e_apple_en', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3e_opt_apple', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_opt_orange', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_opt_banana', correct: false }] },
            { id: 'g3efoodl1t2', type: 'multiple_choice', questionKey: 'data.tasks.g3e_orange_en', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3e_opt_apple', correct: false }, { id: 'b', textKey: 'data.tasks.g3e_opt_orange', correct: true }, { id: 'c', textKey: 'data.tasks.g3e_opt_grape', correct: false }] },
            { id: 'g3efoodl1t3', type: 'multiple_choice', questionKey: 'data.tasks.g3e_banana_is_fruit', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },
            { id: 'g3efoodl1t4', type: 'multiple_choice', questionKey: 'data.tasks.g3e_what_fruit_grape', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3e_opt_apple', correct: false }, { id: 'b', textKey: 'data.tasks.g3e_opt_grape', correct: true }, { id: 'c', textKey: 'data.tasks.g3e_opt_banana', correct: false }] },
          ] },
        { id: 'g3e-food-l2', topicId: 'g3e-food', titleKey: 'data.lessons.g3eFoodL2',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g3e_foodl2_0' }, { speaker: 'tali', textKey: 'data.dialog.g3e_foodl2_1' }],
          intro: [{ titleKey: 'data.intro.g3e_foodl2_0_t', bodyKey: 'data.intro.g3e_foodl2_0_b', emoji: '🥕' }, { titleKey: 'data.intro.g3e_foodl2_1_t', bodyKey: 'data.intro.g3e_foodl2_1_b', emoji: '🥦' }],
          tasks: [
            { id: 'g3efoodl2t1', type: 'multiple_choice', questionKey: 'data.tasks.g3e_carrot_en', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3e_opt_carrot', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_opt_potato', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_opt_tomato', correct: false }] },
            { id: 'g3efoodl2t2', type: 'multiple_choice', questionKey: 'data.tasks.g3e_tomato_en', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3e_opt_carrot', correct: false }, { id: 'b', textKey: 'data.tasks.g3e_opt_potato', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_opt_tomato', correct: true }] },
            { id: 'g3efoodl2t3', type: 'multiple_choice', questionKey: 'data.tasks.g3e_onion_is_veg', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },
            { id: 'g3efoodl2t4', type: 'multiple_choice', questionKey: 'data.tasks.g3e_potato_en', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3e_opt_carrot', correct: false }, { id: 'b', textKey: 'data.tasks.g3e_opt_potato', correct: true }, { id: 'c', textKey: 'data.tasks.g3e_opt_tomato', correct: false }] },
          ] },
        { id: 'g3e-food-l3', topicId: 'g3e-food', titleKey: 'data.lessons.g3eFoodL3',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g3e_foodl3_0' }, { speaker: 'tali', textKey: 'data.dialog.g3e_foodl3_1' }],
          intro: [{ titleKey: 'data.intro.g3e_foodl3_0_t', bodyKey: 'data.intro.g3e_foodl3_0_b', emoji: '✏️' }, { titleKey: 'data.intro.g3e_foodl3_1_t', bodyKey: 'data.intro.g3e_foodl3_1_b', emoji: '🤤' }],
          tasks: [
            { id: 'g3efoodl3t1', type: 'multiple_choice', questionKey: 'data.tasks.g3e_i_like_apples', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3e_opt_i_like', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_opt_i_dont_like', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_opt_i_eat', correct: false }] },
            { id: 'g3efoodl3t2', type: 'multiple_choice', questionKey: 'data.tasks.g3e_i_dont_like_means', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3e_opt_i_like_ru', correct: false }, { id: 'b', textKey: 'data.tasks.g3e_opt_i_dont_like_ru', correct: true }, { id: 'c', textKey: 'data.tasks.g3e_opt_i_eat_ru', correct: false }] },
            { id: 'g3efoodl3t3', type: 'multiple_choice', questionKey: 'data.tasks.g3e_do_you_like_pizza', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3e_opt_yes_i_like', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_opt_yes_he_like', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_opt_yes_i_likes', correct: false }] },
            { id: 'g3efoodl3t4', type: 'multiple_choice', questionKey: 'data.tasks.g3e_she_likes_pasta', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3e_opt_she_like', correct: false }, { id: 'b', textKey: 'data.tasks.g3e_opt_she_likes', correct: true }, { id: 'c', textKey: 'data.tasks.g3e_opt_she_liked', correct: false }] },
          ] },
      ] },
      { id: 'g3e-daily', worldId: 'g3eng', titleKey: 'data.topics.g3eDaily', subject: 'reading', lessons: [
        { id: 'g3e-daily-l1', topicId: 'g3e-daily', titleKey: 'data.lessons.g3eDailyL1',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g3e_dailyl1_0' }, { speaker: 'tali', textKey: 'data.dialog.g3e_dailyl1_1' }],
          intro: [{ titleKey: 'data.intro.g3e_dailyl1_0_t', bodyKey: 'data.intro.g3e_dailyl1_0_b', emoji: '✏️' }, { titleKey: 'data.intro.g3e_dailyl1_1_t', bodyKey: 'data.intro.g3e_dailyl1_1_b', emoji: '🌽' }],
          tasks: [
            { id: 'g3edailyl1t1', type: 'multiple_choice', questionKey: 'data.tasks.g3e_wake_up_en', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3e_opt_wake_up_f', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_opt_go_sleep', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_opt_have_lunch', correct: false }] },
            { id: 'g3edailyl1t2', type: 'multiple_choice', questionKey: 'data.tasks.g3e_brush_teeth_en', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3e_opt_brush_teeth', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_opt_eat_breakfast', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_opt_take_shower', correct: false }] },
            { id: 'g3edailyl1t3', type: 'multiple_choice', questionKey: 'data.tasks.g3e_i_wake_up_at_7', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3e_opt_at_correct', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_opt_in_correct', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_opt_on_correct', correct: false }] },
            { id: 'g3edailyl1t4', type: 'multiple_choice', questionKey: 'data.tasks.g3e_eat_breakfast_means', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3e_opt_breakfast_ru', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_opt_dinner_ru', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_opt_supper_ru', correct: false }] },
          ] },
        { id: 'g3e-daily-l2', topicId: 'g3e-daily', titleKey: 'data.lessons.g3eDailyL2',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g3e_dailyl2_0' }, { speaker: 'tali', textKey: 'data.dialog.g3e_dailyl2_1' }],
          intro: [{ titleKey: 'data.intro.g3e_dailyl2_0_t', bodyKey: 'data.intro.g3e_dailyl2_0_b', emoji: '✏️' }, { titleKey: 'data.intro.g3e_dailyl2_1_t', bodyKey: 'data.intro.g3e_dailyl2_1_b', emoji: '✏️' }],
          tasks: [
            { id: 'g3edailyl2t1', type: 'multiple_choice', questionKey: 'data.tasks.g3e_study_en', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3e_opt_study', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_opt_play', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_opt_sleep', correct: false }] },
            { id: 'g3edailyl2t2', type: 'multiple_choice', questionKey: 'data.tasks.g3e_write_en', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3e_opt_read_w', correct: false }, { id: 'b', textKey: 'data.tasks.g3e_opt_write_w', correct: true }, { id: 'c', textKey: 'data.tasks.g3e_opt_count_w', correct: false }] },
            { id: 'g3edailyl2t3', type: 'multiple_choice', questionKey: 'data.tasks.g3e_i_study_math', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3e_opt_study', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_opt_studies', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_opt_studied', correct: false }] },
            { id: 'g3edailyl2t4', type: 'multiple_choice', questionKey: 'data.tasks.g3e_he_studies', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3e_opt_study', correct: false }, { id: 'b', textKey: 'data.tasks.g3e_opt_studies', correct: true }, { id: 'c', textKey: 'data.tasks.g3e_opt_studying', correct: false }] },
          ] },
        { id: 'g3e-daily-l3', topicId: 'g3e-daily', titleKey: 'data.lessons.g3eDailyL3',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g3e_dailyl3_0' }, { speaker: 'tali', textKey: 'data.dialog.g3e_dailyl3_1' }],
          intro: [{ titleKey: 'data.intro.g3e_dailyl3_0_t', bodyKey: 'data.intro.g3e_dailyl3_0_b', emoji: '✏️' }, { titleKey: 'data.intro.g3e_dailyl3_1_t', bodyKey: 'data.intro.g3e_dailyl3_1_b', emoji: '✏️' }],
          tasks: [
            { id: 'g3edailyl3t1', type: 'multiple_choice', questionKey: 'data.tasks.g3e_play_football_en', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3e_opt_play_football', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_opt_watch_tv', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_opt_read_book', correct: false }] },
            { id: 'g3edailyl3t2', type: 'multiple_choice', questionKey: 'data.tasks.g3e_watch_tv_means', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3e_opt_tv_ru', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_opt_football_ru', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_opt_book_ru', correct: false }] },
            { id: 'g3edailyl3t3', type: 'multiple_choice', questionKey: 'data.tasks.g3e_what_do_you_like', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3e_opt_i_like_reading', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_opt_he_like_reading', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_opt_i_likes_reading', correct: false }] },
            { id: 'g3edailyl3t4', type: 'multiple_choice', questionKey: 'data.tasks.g3e_hobbies_question', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3e_opt_what_hobby', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_opt_where_hobby', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_opt_when_hobby', correct: false }] },
          ] },
      ] },
    ],
  },

  // в”Ђв”Ђ Grade 4 в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
  {
    id: 'g4math', titleKey: 'data.worlds.g4math', descriptionKey: 'data.worldDesc.g4math',
    biome: 'numbers', accentColor: '#FF5722', npcEmoji: '🧮', ageBand: '9-10', npcName: 'Digit',
    topics: [
      { id: 'g4m-multidigit', worldId: 'g4math', titleKey: 'data.topics.g4mMultidigit', subject: 'math', lessons: [
        { id: 'g4m-md-l1', topicId: 'g4m-multidigit', titleKey: 'data.lessons.g4mMdL1', reward: { xp: 30 }, tasks: [
          { id: 'g4m-md-l1-t1', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4m_md_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4m_md_q1_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4m_md_q1_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4m_md_q1_c', correct: false }] },
          { id: 'g4m-md-l1-t2', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4m_md_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4m_md_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4m_md_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4m_md_q2_c', correct: false }] },
          { id: 'g4m-md-l1-t3', type: 'multiple_choice', audience: 'special_aba', questionKey: 'data.tasks.g4m_md_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4m_md_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4m_md_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4m_md_q3_c', correct: true }] },
          { id: 'g4m-md-l1-t4', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4m_md_q4', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4m_md_q4_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4m_md_q4_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4m_md_q4_c', correct: false }] },
        ] },
        { id: 'g4m-md-l2', topicId: 'g4m-multidigit', titleKey: 'data.lessons.g4mMdL2', reward: { xp: 30 }, tasks: [
          { id: 'g4m-md-l2-t1', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4m_md2_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4m_md2_q1_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4m_md2_q1_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4m_md2_q1_c', correct: false }] },
          { id: 'g4m-md-l2-t2', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4m_md2_q2', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4m_md2_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4m_md2_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4m_md2_q2_c', correct: false }] },
          { id: 'g4m-md-l2-t3', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4m_md2_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4m_md2_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4m_md2_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4m_md2_q3_c', correct: true }] },
          { id: 'g4m-md-l2-t4', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4m_md2_q4', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4m_md2_q4_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4m_md2_q4_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4m_md2_q4_c', correct: false }] },
        ] },
        { id: 'g4m-md-l3', topicId: 'g4m-multidigit', titleKey: 'data.lessons.g4mMdL3', reward: { xp: 30 }, tasks: [
          { id: 'g4m-md-l3-t1', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4m_md3_q1', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4m_md3_q1_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4m_md3_q1_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4m_md3_q1_c', correct: false }] },
          { id: 'g4m-md-l3-t2', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4m_md3_q2', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4m_md3_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4m_md3_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4m_md3_q2_c', correct: false }] },
          { id: 'g4m-md-l3-t3', type: 'multiple_choice', audience: 'special_aba', questionKey: 'data.tasks.g4m_md3_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4m_md3_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4m_md3_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4m_md3_q3_c', correct: true }] },
          { id: 'g4m-md-l3-t4', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4m_md3_q4', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4m_md3_q4_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4m_md3_q4_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4m_md3_q4_c', correct: false }] },
        ] },
      ] },
      { id: 'g4m-colmult', worldId: 'g4math', titleKey: 'data.topics.g4mColMult', subject: 'math', lessons: [
        { id: 'g4m-cm-l1', topicId: 'g4m-colmult', titleKey: 'data.lessons.g4mCmL1', reward: { xp: 30 }, tasks: [
          { id: 'g4m-cm-l1-t1', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4m_cm_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4m_cm_q1_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4m_cm_q1_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4m_cm_q1_c', correct: false }] },
          { id: 'g4m-cm-l1-t2', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4m_cm_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4m_cm_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4m_cm_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4m_cm_q2_c', correct: false }] },
          { id: 'g4m-cm-l1-t3', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4m_cm_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4m_cm_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4m_cm_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4m_cm_q3_c', correct: true }] },
          { id: 'g4m-cm-l1-t4', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4m_cm_q4', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4m_cm_q4_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4m_cm_q4_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4m_cm_q4_c', correct: false }] },
        ] },
        { id: 'g4m-cm-l2', topicId: 'g4m-colmult', titleKey: 'data.lessons.g4mCmL2', reward: { xp: 30 }, tasks: [
          { id: 'g4m-cm-l2-t1', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4m_cm2_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4m_cm2_q1_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4m_cm2_q1_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4m_cm2_q1_c', correct: false }] },
          { id: 'g4m-cm-l2-t2', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4m_cm2_q2', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4m_cm2_q2_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4m_cm2_q2_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4m_cm2_q2_c', correct: false }] },
          { id: 'g4m-cm-l2-t3', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4m_cm2_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4m_cm2_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4m_cm2_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4m_cm2_q3_c', correct: true }] },
          { id: 'g4m-cm-l2-t4', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4m_cm2_q4', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4m_cm2_q4_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4m_cm2_q4_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4m_cm2_q4_c', correct: false }] },
        ] },
        { id: 'g4m-cm-l3', topicId: 'g4m-colmult', titleKey: 'data.lessons.g4mCmL3', reward: { xp: 30 }, tasks: [
          { id: 'g4m-cm-l3-t1', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4m_cm3_q1', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4m_cm3_q1_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4m_cm3_q1_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4m_cm3_q1_c', correct: false }] },
          { id: 'g4m-cm-l3-t2', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4m_cm3_q2', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4m_cm3_q2_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4m_cm3_q2_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4m_cm3_q2_c', correct: false }] },
          { id: 'g4m-cm-l3-t3', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4m_cm3_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4m_cm3_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4m_cm3_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4m_cm3_q3_c', correct: true }] },
          { id: 'g4m-cm-l3-t4', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4m_cm3_q4', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4m_cm3_q4_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4m_cm3_q4_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4m_cm3_q4_c', correct: false }] },
        ] },
      ] },
      { id: 'g4m-fractions', worldId: 'g4math', titleKey: 'data.topics.g4mFractions', subject: 'math', lessons: [
        { id: 'g4m-fr-l1', topicId: 'g4m-fractions', titleKey: 'data.lessons.g4mFrL1', reward: { xp: 30 }, tasks: [
          { id: 'g4m-fr-l1-t1', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4m_fr_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4m_fr_q1_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4m_fr_q1_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4m_fr_q1_c', correct: false }] },
          { id: 'g4m-fr-l1-t2', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4m_fr_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4m_fr_q2_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4m_fr_q2_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4m_fr_q2_c', correct: false }] },
          { id: 'g4m-fr-l1-t3', type: 'multiple_choice', audience: 'special_aba', questionKey: 'data.tasks.g4m_fr_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4m_fr_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4m_fr_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4m_fr_q3_c', correct: true }] },
          { id: 'g4m-fr-l1-t4', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4m_fr_q4', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4m_fr_q4_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4m_fr_q4_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4m_fr_q4_c', correct: false }] },
        ] },
        { id: 'g4m-fr-l2', topicId: 'g4m-fractions', titleKey: 'data.lessons.g4mFrL2', reward: { xp: 30 }, tasks: [
          { id: 'g4m-fr-l2-t1', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4m_fr2_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4m_fr2_q1_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4m_fr2_q1_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4m_fr2_q1_c', correct: false }] },
          { id: 'g4m-fr-l2-t2', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4m_fr2_q2', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4m_fr2_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4m_fr2_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4m_fr2_q2_c', correct: false }] },
          { id: 'g4m-fr-l2-t3', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4m_fr2_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4m_fr2_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4m_fr2_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4m_fr2_q3_c', correct: true }] },
          { id: 'g4m-fr-l2-t4', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4m_fr2_q4', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4m_fr2_q4_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4m_fr2_q4_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4m_fr2_q4_c', correct: false }] },
        ] },
        { id: 'g4m-fr-l3', topicId: 'g4m-fractions', titleKey: 'data.lessons.g4mFrL3', reward: { xp: 30 }, tasks: [
          { id: 'g4m-fr-l3-t1', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4m_fr3_q1', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4m_fr3_q1_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4m_fr3_q1_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4m_fr3_q1_c', correct: false }] },
          { id: 'g4m-fr-l3-t2', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4m_fr3_q2', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4m_fr3_q2_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4m_fr3_q2_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4m_fr3_q2_c', correct: false }] },
          { id: 'g4m-fr-l3-t3', type: 'multiple_choice', audience: 'special_aba', questionKey: 'data.tasks.g4m_fr3_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4m_fr3_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4m_fr3_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4m_fr3_q3_c', correct: true }] },
          { id: 'g4m-fr-l3-t4', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4m_fr3_q4', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4m_fr3_q4_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4m_fr3_q4_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4m_fr3_q4_c', correct: false }] },
        ] },
      ] },
    ],
  },
  {
    id: 'g4rus', titleKey: 'data.worlds.g4rus', descriptionKey: 'data.worldDesc.g4rus',
    biome: 'library', accentColor: '#7C4DFF', npcEmoji: '📝', ageBand: '9-10', npcName: 'Слово',
    topics: [
      { id: 'g4r-conjugation', worldId: 'g4rus', titleKey: 'data.topics.g4rConjugation', subject: 'reading_ru', lessons: [
        { id: 'g4r-conj-l1', topicId: 'g4r-conjugation', titleKey: 'data.lessons.g4rConjL1', reward: { xp: 30 }, tasks: [
          { id: 'g4r-conj-l1-t1', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4r_conj_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4r_conj_q1_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4r_conj_q1_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4r_conj_q1_c', correct: false }] },
          { id: 'g4r-conj-l1-t2', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4r_conj_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4r_conj_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4r_conj_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4r_conj_q2_c', correct: false }] },
          { id: 'g4r-conj-l1-t3', type: 'multiple_choice', audience: 'special_aba', questionKey: 'data.tasks.g4r_conj_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4r_conj_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4r_conj_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4r_conj_q3_c', correct: true }] },
          { id: 'g4r-conj-l1-t4', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4r_conj_q4', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4r_conj_q4_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4r_conj_q4_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4r_conj_q4_c', correct: false }] },
        ] },
        { id: 'g4r-conj-l2', topicId: 'g4r-conjugation', titleKey: 'data.lessons.g4rConjL2', reward: { xp: 30 }, tasks: [
          { id: 'g4r-conj-l2-t1', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4r_conj2_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4r_conj2_q1_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4r_conj2_q1_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4r_conj2_q1_c', correct: false }] },
          { id: 'g4r-conj-l2-t2', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4r_conj2_q2', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4r_conj2_q2_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4r_conj2_q2_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4r_conj2_q2_c', correct: false }] },
          { id: 'g4r-conj-l2-t3', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4r_conj2_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4r_conj2_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4r_conj2_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4r_conj2_q3_c', correct: true }] },
          { id: 'g4r-conj-l2-t4', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4r_conj2_q4', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4r_conj2_q4_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4r_conj2_q4_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4r_conj2_q4_c', correct: false }] },
        ] },
        { id: 'g4r-conj-l3', topicId: 'g4r-conjugation', titleKey: 'data.lessons.g4rConjL3', reward: { xp: 30 }, tasks: [
          { id: 'g4r-conj-l3-t1', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4r_conj3_q1', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4r_conj3_q1_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4r_conj3_q1_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4r_conj3_q1_c', correct: false }] },
          { id: 'g4r-conj-l3-t2', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4r_conj3_q2', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4r_conj3_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4r_conj3_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4r_conj3_q2_c', correct: false }] },
          { id: 'g4r-conj-l3-t3', type: 'multiple_choice', audience: 'special_aba', questionKey: 'data.tasks.g4r_conj3_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4r_conj3_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4r_conj3_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4r_conj3_q3_c', correct: true }] },
          { id: 'g4r-conj-l3-t4', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4r_conj3_q4', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4r_conj3_q4_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4r_conj3_q4_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4r_conj3_q4_c', correct: false }] },
        ] },
      ] },
      { id: 'g4r-cases', worldId: 'g4rus', titleKey: 'data.topics.g4rCases', subject: 'reading_ru', lessons: [
        { id: 'g4r-cases-l1', topicId: 'g4r-cases', titleKey: 'data.lessons.g4rCasesL1', reward: { xp: 30 }, tasks: [
          { id: 'g4r-cases-l1-t1', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4r_cases_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4r_cases_q1_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4r_cases_q1_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4r_cases_q1_c', correct: false }] },
          { id: 'g4r-cases-l1-t2', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4r_cases_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4r_cases_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4r_cases_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4r_cases_q2_c', correct: false }] },
          { id: 'g4r-cases-l1-t3', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4r_cases_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4r_cases_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4r_cases_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4r_cases_q3_c', correct: true }] },
          { id: 'g4r-cases-l1-t4', type: 'multiple_choice', audience: 'special_aba', questionKey: 'data.tasks.g4r_cases_q4', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4r_cases_q4_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4r_cases_q4_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4r_cases_q4_c', correct: false }] },
        ] },
        { id: 'g4r-cases-l2', topicId: 'g4r-cases', titleKey: 'data.lessons.g4rCasesL2', reward: { xp: 30 }, tasks: [
          { id: 'g4r-cases-l2-t1', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4r_cases2_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4r_cases2_q1_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4r_cases2_q1_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4r_cases2_q1_c', correct: false }] },
          { id: 'g4r-cases-l2-t2', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4r_cases2_q2', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4r_cases2_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4r_cases2_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4r_cases2_q2_c', correct: false }] },
          { id: 'g4r-cases-l2-t3', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4r_cases2_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4r_cases2_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4r_cases2_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4r_cases2_q3_c', correct: true }] },
          { id: 'g4r-cases-l2-t4', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4r_cases2_q4', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4r_cases2_q4_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4r_cases2_q4_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4r_cases2_q4_c', correct: false }] },
        ] },
        { id: 'g4r-cases-l3', topicId: 'g4r-cases', titleKey: 'data.lessons.g4rCasesL3', reward: { xp: 30 }, tasks: [
          { id: 'g4r-cases-l3-t1', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4r_cases3_q1', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4r_cases3_q1_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4r_cases3_q1_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4r_cases3_q1_c', correct: false }] },
          { id: 'g4r-cases-l3-t2', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4r_cases3_q2', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4r_cases3_q2_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4r_cases3_q2_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4r_cases3_q2_c', correct: false }] },
          { id: 'g4r-cases-l3-t3', type: 'multiple_choice', audience: 'special_aba', questionKey: 'data.tasks.g4r_cases3_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4r_cases3_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4r_cases3_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4r_cases3_q3_c', correct: true }] },
          { id: 'g4r-cases-l3-t4', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4r_cases3_q4', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4r_cases3_q4_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4r_cases3_q4_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4r_cases3_q4_c', correct: false }] },
        ] },
      ] },
      { id: 'g4r-text', worldId: 'g4rus', titleKey: 'data.topics.g4rText', subject: 'reading_ru', lessons: [
        { id: 'g4r-text-l1', topicId: 'g4r-text', titleKey: 'data.lessons.g4rTextL1', reward: { xp: 30 }, tasks: [
          { id: 'g4r-text-l1-t1', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4r_text_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4r_text_q1_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4r_text_q1_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4r_text_q1_c', correct: false }] },
          { id: 'g4r-text-l1-t2', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4r_text_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4r_text_q2_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4r_text_q2_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4r_text_q2_c', correct: false }] },
          { id: 'g4r-text-l1-t3', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4r_text_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4r_text_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4r_text_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4r_text_q3_c', correct: true }] },
          { id: 'g4r-text-l1-t4', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4r_text_q4', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4r_text_q4_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4r_text_q4_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4r_text_q4_c', correct: false }] },
        ] },
        { id: 'g4r-text-l2', topicId: 'g4r-text', titleKey: 'data.lessons.g4rTextL2', reward: { xp: 30 }, tasks: [
          { id: 'g4r-text-l2-t1', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4r_text2_q1', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4r_text2_q1_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4r_text2_q1_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4r_text2_q1_c', correct: false }] },
          { id: 'g4r-text-l2-t2', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4r_text2_q2', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4r_text2_q2_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4r_text2_q2_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4r_text2_q2_c', correct: false }] },
          { id: 'g4r-text-l2-t3', type: 'multiple_choice', audience: 'special_aba', questionKey: 'data.tasks.g4r_text2_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4r_text2_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4r_text2_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4r_text2_q3_c', correct: true }] },
          { id: 'g4r-text-l2-t4', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4r_text2_q4', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4r_text2_q4_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4r_text2_q4_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4r_text2_q4_c', correct: false }] },
        ] },
        { id: 'g4r-text-l3', topicId: 'g4r-text', titleKey: 'data.lessons.g4rTextL3', reward: { xp: 30 }, tasks: [
          { id: 'g4r-text-l3-t1', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4r_text3_q1', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4r_text3_q1_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4r_text3_q1_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4r_text3_q1_c', correct: false }] },
          { id: 'g4r-text-l3-t2', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4r_text3_q2', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4r_text3_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4r_text3_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4r_text3_q2_c', correct: false }] },
          { id: 'g4r-text-l3-t3', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4r_text3_q3', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4r_text3_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4r_text3_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4r_text3_q3_c', correct: true }] },
          { id: 'g4r-text-l3-t4', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4r_text3_q4', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4r_text3_q4_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4r_text3_q4_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4r_text3_q4_c', correct: false }] },
        ] },
      ] },
    ],
  },
  {
    id: 'g4eng', titleKey: 'data.worlds.g4eng', descriptionKey: 'data.worldDesc.g4eng',
    biome: 'campus', accentColor: '#00ACC1', npcEmoji: '🌍', ageBand: '9-10', npcName: 'Spark',
    topics: [
      { id: 'g4e-present', worldId: 'g4eng', titleKey: 'data.topics.g4ePresent', subject: 'reading', lessons: [
        { id: 'g4e-pres-l1', topicId: 'g4e-present', titleKey: 'data.lessons.g4ePresL1', reward: { xp: 30 }, tasks: [
          { id: 'g4e-pres-l1-t1', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4e_pres_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4e_pres_q1_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4e_pres_q1_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4e_pres_q1_c', correct: false }] },
          { id: 'g4e-pres-l1-t2', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4e_pres_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4e_pres_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4e_pres_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4e_pres_q2_c', correct: false }] },
          { id: 'g4e-pres-l1-t3', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4e_pres_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4e_pres_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4e_pres_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4e_pres_q3_c', correct: true }] },
          { id: 'g4e-pres-l1-t4', type: 'multiple_choice', audience: 'special_aba', questionKey: 'data.tasks.g4e_pres_q4', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4e_pres_q4_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4e_pres_q4_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4e_pres_q4_c', correct: false }] },
        ] },
        { id: 'g4e-pres-l2', topicId: 'g4e-present', titleKey: 'data.lessons.g4ePresL2', reward: { xp: 30 }, tasks: [
          { id: 'g4e-pres-l2-t1', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4e_pres2_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4e_pres2_q1_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4e_pres2_q1_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4e_pres2_q1_c', correct: false }] },
          { id: 'g4e-pres-l2-t2', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4e_pres2_q2', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4e_pres2_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4e_pres2_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4e_pres2_q2_c', correct: false }] },
          { id: 'g4e-pres-l2-t3', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4e_pres2_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4e_pres2_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4e_pres2_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4e_pres2_q3_c', correct: true }] },
          { id: 'g4e-pres-l2-t4', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4e_pres2_q4', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4e_pres2_q4_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4e_pres2_q4_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4e_pres2_q4_c', correct: false }] },
        ] },
        { id: 'g4e-pres-l3', topicId: 'g4e-present', titleKey: 'data.lessons.g4ePresL3', reward: { xp: 30 }, tasks: [
          { id: 'g4e-pres-l3-t1', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4e_pres3_q1', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4e_pres3_q1_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4e_pres3_q1_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4e_pres3_q1_c', correct: false }] },
          { id: 'g4e-pres-l3-t2', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4e_pres3_q2', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4e_pres3_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4e_pres3_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4e_pres3_q2_c', correct: false }] },
          { id: 'g4e-pres-l3-t3', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4e_pres3_q3', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4e_pres3_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4e_pres3_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4e_pres3_q3_c', correct: true }] },
          { id: 'g4e-pres-l3-t4', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4e_pres3_q4', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4e_pres3_q4_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4e_pres3_q4_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4e_pres3_q4_c', correct: false }] },
        ] },
      ] },
      { id: 'g4e-past', worldId: 'g4eng', titleKey: 'data.topics.g4ePast', subject: 'reading', lessons: [
        { id: 'g4e-past-l1', topicId: 'g4e-past', titleKey: 'data.lessons.g4ePastL1', reward: { xp: 30 }, tasks: [
          { id: 'g4e-past-l1-t1', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4e_past_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4e_past_q1_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4e_past_q1_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4e_past_q1_c', correct: false }] },
          { id: 'g4e-past-l1-t2', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4e_past_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4e_past_q2_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4e_past_q2_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4e_past_q2_c', correct: false }] },
          { id: 'g4e-past-l1-t3', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4e_past_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4e_past_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4e_past_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4e_past_q3_c', correct: true }] },
          { id: 'g4e-past-l1-t4', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4e_past_q4', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4e_past_q4_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4e_past_q4_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4e_past_q4_c', correct: false }] },
        ] },
        { id: 'g4e-past-l2', topicId: 'g4e-past', titleKey: 'data.lessons.g4ePastL2', reward: { xp: 30 }, tasks: [
          { id: 'g4e-past-l2-t1', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4e_past2_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4e_past2_q1_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4e_past2_q1_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4e_past2_q1_c', correct: false }] },
          { id: 'g4e-past-l2-t2', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4e_past2_q2', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4e_past2_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4e_past2_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4e_past2_q2_c', correct: false }] },
          { id: 'g4e-past-l2-t3', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4e_past2_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4e_past2_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4e_past2_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4e_past2_q3_c', correct: true }] },
          { id: 'g4e-past-l2-t4', type: 'multiple_choice', audience: 'special_aba', questionKey: 'data.tasks.g4e_past2_q4', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4e_past2_q4_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4e_past2_q4_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4e_past2_q4_c', correct: false }] },
        ] },
        { id: 'g4e-past-l3', topicId: 'g4e-past', titleKey: 'data.lessons.g4ePastL3', reward: { xp: 30 }, tasks: [
          { id: 'g4e-past-l3-t1', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4e_past3_q1', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4e_past3_q1_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4e_past3_q1_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4e_past3_q1_c', correct: false }] },
          { id: 'g4e-past-l3-t2', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4e_past3_q2', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4e_past3_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4e_past3_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4e_past3_q2_c', correct: false }] },
          { id: 'g4e-past-l3-t3', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4e_past3_q3', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4e_past3_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4e_past3_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4e_past3_q3_c', correct: true }] },
          { id: 'g4e-past-l3-t4', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4e_past3_q4', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4e_past3_q4_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4e_past3_q4_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4e_past3_q4_c', correct: false }] },
        ] },
      ] },
      { id: 'g4e-questions', worldId: 'g4eng', titleKey: 'data.topics.g4eQuestions', subject: 'reading', lessons: [
        { id: 'g4e-quest-l1', topicId: 'g4e-questions', titleKey: 'data.lessons.g4eQuestL1', reward: { xp: 30 }, tasks: [
          { id: 'g4e-quest-l1-t1', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4e_quest_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4e_quest_q1_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4e_quest_q1_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4e_quest_q1_c', correct: false }] },
          { id: 'g4e-quest-l1-t2', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4e_quest_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4e_quest_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4e_quest_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4e_quest_q2_c', correct: false }] },
          { id: 'g4e-quest-l1-t3', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4e_quest_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4e_quest_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4e_quest_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4e_quest_q3_c', correct: true }] },
          { id: 'g4e-quest-l1-t4', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4e_quest_q4', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4e_quest_q4_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4e_quest_q4_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4e_quest_q4_c', correct: false }] },
        ] },
        { id: 'g4e-quest-l2', topicId: 'g4e-questions', titleKey: 'data.lessons.g4eQuestL2', reward: { xp: 30 }, tasks: [
          { id: 'g4e-quest-l2-t1', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4e_quest2_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4e_quest2_q1_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4e_quest2_q1_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4e_quest2_q1_c', correct: false }] },
          { id: 'g4e-quest-l2-t2', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4e_quest2_q2', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4e_quest2_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4e_quest2_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4e_quest2_q2_c', correct: false }] },
          { id: 'g4e-quest-l2-t3', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4e_quest2_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4e_quest2_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4e_quest2_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4e_quest2_q3_c', correct: true }] },
          { id: 'g4e-quest-l2-t4', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4e_quest2_q4', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4e_quest2_q4_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4e_quest2_q4_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4e_quest2_q4_c', correct: false }] },
        ] },
        { id: 'g4e-quest-l3', topicId: 'g4e-questions', titleKey: 'data.lessons.g4eQuestL3', reward: { xp: 30 }, tasks: [
          { id: 'g4e-quest-l3-t1', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4e_quest3_q1', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4e_quest3_q1_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4e_quest3_q1_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4e_quest3_q1_c', correct: false }] },
          { id: 'g4e-quest-l3-t2', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4e_quest3_q2', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4e_quest3_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4e_quest3_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4e_quest3_q2_c', correct: false }] },
          { id: 'g4e-quest-l3-t3', type: 'multiple_choice', audience: 'special_aba', questionKey: 'data.tasks.g4e_quest3_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4e_quest3_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4e_quest3_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4e_quest3_q3_c', correct: true }] },
          { id: 'g4e-quest-l3-t4', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4e_quest3_q4', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4e_quest3_q4_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4e_quest3_q4_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4e_quest3_q4_c', correct: false }] },
        ] },
      ] },
    ],
  },
  {
    id: 'g4social', titleKey: 'data.worlds.g4social', descriptionKey: 'data.worldDesc.g4social',
    biome: 'town', accentColor: '#66BB6A', npcEmoji: '🤝', ageBand: '9-10', npcName: 'Friendly',
    topics: [
      { id: 'g4s-ask-help', worldId: 'g4social', titleKey: 'data.topics.g4sAskHelp', subject: 'social', lessons: [
        { id: 'g4s-help-l1', topicId: 'g4s-ask-help', titleKey: 'data.lessons.g4sHelpL1', reward: { xp: 30 }, tasks: [
          { id: 'g4s-help-l1-t1', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4s_help_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4s_help_q1_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4s_help_q1_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4s_help_q1_c', correct: false }] },
          { id: 'g4s-help-l1-t2', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4s_help_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4s_help_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4s_help_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4s_help_q2_c', correct: false }] },
          { id: 'g4s-help-l1-t3', type: 'multiple_choice', audience: 'special_aba', questionKey: 'data.tasks.g4s_help_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4s_help_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4s_help_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4s_help_q3_c', correct: true }] },
          { id: 'g4s-help-l1-t4', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4s_help_q4', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4s_help_q4_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4s_help_q4_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4s_help_q4_c', correct: false }] },
        ] },
        { id: 'g4s-help-l2', topicId: 'g4s-ask-help', titleKey: 'data.lessons.g4sHelpL2', reward: { xp: 30 }, tasks: [
          { id: 'g4s-help-l2-t1', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4s_help2_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4s_help2_q1_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4s_help2_q1_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4s_help2_q1_c', correct: false }] },
          { id: 'g4s-help-l2-t2', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4s_help2_q2', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4s_help2_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4s_help2_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4s_help2_q2_c', correct: false }] },
          { id: 'g4s-help-l2-t3', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4s_help2_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4s_help2_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4s_help2_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4s_help2_q3_c', correct: true }] },
          { id: 'g4s-help-l2-t4', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4s_help2_q4', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4s_help2_q4_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4s_help2_q4_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4s_help2_q4_c', correct: false }] },
        ] },
        { id: 'g4s-help-l3', topicId: 'g4s-ask-help', titleKey: 'data.lessons.g4sHelpL3', reward: { xp: 30 }, tasks: [
          { id: 'g4s-help-l3-t1', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4s_help3_q1', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4s_help3_q1_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4s_help3_q1_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4s_help3_q1_c', correct: false }] },
          { id: 'g4s-help-l3-t2', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4s_help3_q2', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4s_help3_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4s_help3_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4s_help3_q2_c', correct: false }] },
          { id: 'g4s-help-l3-t3', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4s_help3_q3', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4s_help3_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4s_help3_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4s_help3_q3_c', correct: true }] },
          { id: 'g4s-help-l3-t4', type: 'multiple_choice', audience: 'special_aba', questionKey: 'data.tasks.g4s_help3_q4', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4s_help3_q4_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4s_help3_q4_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4s_help3_q4_c', correct: false }] },
        ] },
      ] },
      { id: 'g4s-emotions', worldId: 'g4social', titleKey: 'data.topics.g4sEmotions', subject: 'social', lessons: [
        { id: 'g4s-emo-l1', topicId: 'g4s-emotions', titleKey: 'data.lessons.g4sEmoL1', reward: { xp: 30 }, tasks: [
          { id: 'g4s-emo-l1-t1', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4s_emo_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4s_emo_q1_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4s_emo_q1_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4s_emo_q1_c', correct: false }] },
          { id: 'g4s-emo-l1-t2', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4s_emo_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4s_emo_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4s_emo_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4s_emo_q2_c', correct: false }] },
          { id: 'g4s-emo-l1-t3', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4s_emo_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4s_emo_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4s_emo_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4s_emo_q3_c', correct: true }] },
          { id: 'g4s-emo-l1-t4', type: 'multiple_choice', audience: 'special_aba', questionKey: 'data.tasks.g4s_emo_q4', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4s_emo_q4_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4s_emo_q4_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4s_emo_q4_c', correct: false }] },
        ] },
        { id: 'g4s-emo-l2', topicId: 'g4s-emotions', titleKey: 'data.lessons.g4sEmoL2', reward: { xp: 30 }, tasks: [
          { id: 'g4s-emo-l2-t1', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4s_emo2_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4s_emo2_q1_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4s_emo2_q1_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4s_emo2_q1_c', correct: false }] },
          { id: 'g4s-emo-l2-t2', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4s_emo2_q2', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4s_emo2_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4s_emo2_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4s_emo2_q2_c', correct: false }] },
          { id: 'g4s-emo-l2-t3', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4s_emo2_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4s_emo2_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4s_emo2_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4s_emo2_q3_c', correct: true }] },
          { id: 'g4s-emo-l2-t4', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4s_emo2_q4', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4s_emo2_q4_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4s_emo2_q4_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4s_emo2_q4_c', correct: false }] },
        ] },
        { id: 'g4s-emo-l3', topicId: 'g4s-emotions', titleKey: 'data.lessons.g4sEmoL3', reward: { xp: 30 }, tasks: [
          { id: 'g4s-emo-l3-t1', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4s_emo3_q1', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4s_emo3_q1_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4s_emo3_q1_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4s_emo3_q1_c', correct: false }] },
          { id: 'g4s-emo-l3-t2', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4s_emo3_q2', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4s_emo3_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4s_emo3_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4s_emo3_q2_c', correct: false }] },
          { id: 'g4s-emo-l3-t3', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4s_emo3_q3', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4s_emo3_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4s_emo3_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4s_emo3_q3_c', correct: true }] },
          { id: 'g4s-emo-l3-t4', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4s_emo3_q4', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4s_emo3_q4_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4s_emo3_q4_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4s_emo3_q4_c', correct: false }] },
        ] },
      ] },
      { id: 'g4s-turn-taking', worldId: 'g4social', titleKey: 'data.topics.g4sTurnTaking', subject: 'social', lessons: [
        { id: 'g4s-turn-l1', topicId: 'g4s-turn-taking', titleKey: 'data.lessons.g4sTurnL1', reward: { xp: 30 }, tasks: [
          { id: 'g4s-turn-l1-t1', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4s_turn_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4s_turn_q1_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4s_turn_q1_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4s_turn_q1_c', correct: false }] },
          { id: 'g4s-turn-l1-t2', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4s_turn_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4s_turn_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4s_turn_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4s_turn_q2_c', correct: false }] },
          { id: 'g4s-turn-l1-t3', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4s_turn_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4s_turn_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4s_turn_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4s_turn_q3_c', correct: true }] },
          { id: 'g4s-turn-l1-t4', type: 'multiple_choice', audience: 'special_aba', questionKey: 'data.tasks.g4s_turn_q4', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4s_turn_q4_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4s_turn_q4_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4s_turn_q4_c', correct: false }] },
        ] },
        { id: 'g4s-turn-l2', topicId: 'g4s-turn-taking', titleKey: 'data.lessons.g4sTurnL2', reward: { xp: 30 }, tasks: [
          { id: 'g4s-turn-l2-t1', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4s_turn2_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4s_turn2_q1_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4s_turn2_q1_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4s_turn2_q1_c', correct: false }] },
          { id: 'g4s-turn-l2-t2', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4s_turn2_q2', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4s_turn2_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4s_turn2_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4s_turn2_q2_c', correct: false }] },
          { id: 'g4s-turn-l2-t3', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4s_turn2_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4s_turn2_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4s_turn2_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4s_turn2_q3_c', correct: true }] },
          { id: 'g4s-turn-l2-t4', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4s_turn2_q4', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4s_turn2_q4_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4s_turn2_q4_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4s_turn2_q4_c', correct: false }] },
        ] },
        { id: 'g4s-turn-l3', topicId: 'g4s-turn-taking', titleKey: 'data.lessons.g4sTurnL3', reward: { xp: 30 }, tasks: [
          { id: 'g4s-turn-l3-t1', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4s_turn3_q1', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4s_turn3_q1_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4s_turn3_q1_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4s_turn3_q1_c', correct: false }] },
          { id: 'g4s-turn-l3-t2', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4s_turn3_q2', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4s_turn3_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4s_turn3_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4s_turn3_q2_c', correct: false }] },
          { id: 'g4s-turn-l3-t3', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4s_turn3_q3', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4s_turn3_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4s_turn3_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4s_turn3_q3_c', correct: true }] },
          { id: 'g4s-turn-l3-t4', type: 'multiple_choice', audience: 'standard', questionKey: 'data.tasks.g4s_turn3_q4', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4s_turn3_q4_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4s_turn3_q4_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4s_turn3_q4_c', correct: false }] },
        ] },
      ] },
    ],
  },
];

// РІвЂќР‚РІвЂќР‚РІвЂќР‚ Helper functions РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚

export function getWorld(worldId: string): World | undefined {
  return worlds.find((w) => w.id === worldId);
}

export function getTopic(topicId: string): Topic | undefined {
  for (const world of worlds) {
    const topic = world.topics.find((t) => t.id === topicId);
    if (topic) return topic;
  }
  return undefined;
}

export function getLesson(lessonId: string): Lesson | undefined {
  for (const world of worlds) {
    for (const topic of world.topics) {
      const lesson = topic.lessons.find((l) => l.id === lessonId);
      if (lesson) return lesson;
    }
  }
  return undefined;
}

export function getTopicForLesson(lessonId: string): Topic | undefined {
  for (const world of worlds) {
    for (const topic of world.topics) {
      const lesson = topic.lessons.find((l) => l.id === lessonId);
      if (lesson) return topic;
    }
  }
  return undefined;
}

export function getWorldForLesson(lessonId: string): World | undefined {
  for (const world of worlds) {
    for (const topic of world.topics) {
      const lesson = topic.lessons.find((l) => l.id === lessonId);
      if (lesson) return world;
    }
  }
  return undefined;
}

export type SubjectId = 'math' | 'english' | 'russian' | 'science' | 'social';

export type LessonNode = {
  lessonId: string;
  topicId: string;
  worldId: string;
  subjectId: SubjectId;
  titleKey: string;
  emoji: string;
  worldAccentColor: string;
  worldBiome: string;
  worldNpcEmoji: string;
};

const SUBJECT_EMOJI: Record<string, string> = {
  math: '🔢',
  reading: '💖',
  reading_ru: '📚',
  logic: '📐',
  social: '🤝',
};

function toSubjectId(subject: string): SubjectId {
  if (subject === 'math') return 'math';
  if (subject === 'reading') return 'english';
  if (subject === 'reading_ru') return 'russian';
  if (subject === 'social') return 'social';
  return 'science';
}

export function getOrderedLessonNodes(ageBand?: AgeBand): LessonNode[] {
  const nodes: LessonNode[] = [];
  const filtered = ageBand ? worlds.filter((w) => !w.ageBand || w.ageBand === ageBand) : worlds;
  for (const world of filtered) {
    for (const topic of world.topics) {
      const emoji = SUBJECT_EMOJI[topic.subject] ?? '✏️';
      const subjectId = toSubjectId(topic.subject);
      for (const lesson of topic.lessons) {
        nodes.push({
          lessonId: lesson.id,
          topicId: lesson.topicId,
          worldId: world.id,
          subjectId,
          titleKey: lesson.titleKey,
          emoji,
          worldAccentColor: world.accentColor,
          worldBiome: world.biome,
          worldNpcEmoji: world.npcEmoji,
        });
      }
    }
  }
  return nodes;
}

export function getOrderedLessonNodesForSubject(subjectId: SubjectId, ageBand?: AgeBand): LessonNode[] {
  return getOrderedLessonNodes(ageBand).filter((n) => n.subjectId === subjectId);
}

export type ChildProfileForFilter = {
  child_mode: 'standard' | 'special';
  methodology: string | null;
};

export function filterTasksForProfile(
  tasks: LessonTask[],
  profile: ChildProfileForFilter | null,
): LessonTask[] {
  if (!profile || profile.child_mode === 'standard') {
    return tasks.filter((t) => !t.audience || t.audience === 'standard');
  }
  return tasks.filter(
    (t) => !t.audience || t.audience === 'standard' || t.audience === 'special_aba',
  );
}





