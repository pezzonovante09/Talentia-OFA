import { RW56_LESSON_TASKS } from './rw56LessonTasks';
import {
  G1M_ADD_L1_TASKS,
  G1M_ADD_L2_TASKS,
  G1M_ADD_L3_TASKS,
  G1M_C20_L1_TASKS,
  G1M_C20_L2_TASKS,
  G1M_C20_L3_TASKS,
  G1M_SUB_L1_TASKS,
  G1M_SUB_L2_TASKS,
  G1M_SUB_L3_TASKS,
} from './g1mathBridgedTasks';
import {
  G1R_GRM_L1_TASKS,
  G1R_GRM_L2_TASKS,
  G1R_GRM_L3_TASKS,
  G1R_VOW_L1_TASKS,
  G1R_VOW_L2_TASKS,
  G1R_VOW_L3_TASKS,
  G1R_WRD_L1_TASKS,
  G1R_WRD_L2_TASKS,
  G1R_WRD_L3_TASKS,
  G1W_SCH_L1_TASKS,
  G1W_SCH_L2_TASKS,
} from './g1rusBridgedTasks';
import {
  G1W_BDY_L1_TASKS,
  G1W_BDY_L2_TASKS,
  G1W_BDY_L3_TASKS,
  G1W_NAT_L1_TASKS,
  G1W_NAT_L3_TASKS,
  G1W_SCH_L3_TASKS,
} from './g1worldRewrittenTasks';

export type TaskType =
  | 'multiple_choice'
  | 'input'
  | 'image_point'
  | 'vocal_imitation'
  | 'word_repetition'
  | 'volume_control'
  | 'fill_blank'
  | 'image_word_match'
  | 'world_knowledge'
  | 'sorting'
  | 'routine_chain'
  | 'action_instruction';

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
  /** If true, show Skip (ABA: any task type; standard: input-only in UI) */
  skippable?: boolean;
  /** Optional narrative feedback after check (i18n keys under data.taskFeedback) */
  correctFeedbackKey?: string;
  incorrectFeedbackKey?: string;
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

export type ImagePointHotspot = {
  id: string;
  labelKey?: string;
  correct: boolean;
  x: number;
  y: number;
};

export type FillBlankOption = {
  id: string;
  textKey: string;
  correct: boolean;
};

export type ImageWordMatchOption = {
  id: string;
  textKey?: string;
  imageKey?: string;
  correct: boolean;
};

export type SortingGroup = {
  id: string;
  labelKey: string;
};

export type SortingItem = {
  id: string;
  imageKey: string;
  groupId: string;
};

export type RoutineStep = {
  id: string;
  labelKey: string;
  imageKey: string;
  order: number;
};

export type ImagePointTask = BaseTask & {
  type: 'image_point';
  imageKey: string;
  hotspots: ImagePointHotspot[];
};

export type VocalImitationTask = BaseTask & {
  type: 'vocal_imitation';
  soundTextKey: string;
  audioPromptKey?: string;
};

export type WordRepetitionTask = BaseTask & {
  type: 'word_repetition';
  wordKey: string;
  stressSyllableIndex?: number;
};

export type VolumeControlTask = BaseTask & {
  type: 'volume_control';
  direction: 'louder' | 'quieter';
  promptTextKey: string;
};

export type FillBlankTask = BaseTask & {
  type: 'fill_blank';
  sentenceKey: string;
  options: FillBlankOption[];
};

export type ImageWordMatchTask = BaseTask & {
  type: 'image_word_match';
  direction: 'word_to_image' | 'image_to_word';
  promptTextKey?: string;
  promptImageKey?: string;
  options: ImageWordMatchOption[];
};

export type WorldKnowledgeTask = BaseTask & {
  type: 'world_knowledge';
  category: 'world_knowledge';
  options: Array<{
    id: string;
    textKey?: string;
    imageKey?: string;
    correct: boolean;
  }>;
};

export type SortingTask = BaseTask & {
  type: 'sorting';
  groups: SortingGroup[];
  items: SortingItem[];
};

export type RoutineChainTask = BaseTask & {
  type: 'routine_chain';
  steps: RoutineStep[];
};

export type ActionInstructionTask = BaseTask & {
  type: 'action_instruction';
  actionKey: string;
  illustrationKey: string;
};

export type LessonTask =
  | MultipleChoiceTask
  | InputTask
  | ImagePointTask
  | VocalImitationTask
  | WordRepetitionTask
  | VolumeControlTask
  | FillBlankTask
  | ImageWordMatchTask
  | WorldKnowledgeTask
  | SortingTask
  | RoutineChainTask
  | ActionInstructionTask;

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
  /** ABA: tokens needed per puzzle piece (default 5 in store) */
  abaTokensPerPiece?: number;
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
    biome: '',
    npcName: 'Rex',
    npcEmoji: '',
    topics: [
      // Comparison moved first: basic quantity comparison (>/</=) is a
      // prerequisite for meaningfully teaching addition/subtraction, not a
      // topic to cover after them.
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
              { titleKey: 'data.intro.jungleCmp_0_title', bodyKey: 'data.intro.jungleCmp_0_body', emoji: '' },
              { titleKey: 'data.intro.jungleCmp_1_title', bodyKey: 'data.intro.jungleCmp_1_body', emoji: '' },
            ],
            tasks: [
              // Standard tasks
              { id: 'jungle-cmp-1-t1', type: 'multiple_choice', questionKey: 'data.tasks.jungle_q_bigger_7_4', difficulty: 1, options: [{ id: 'opt-7', textKey: 'data.tasks.opt_seven', correct: true }, { id: 'opt-4', textKey: 'data.tasks.opt_four', correct: false }] },
              { id: 'jungle-cmp-1-t2', type: 'multiple_choice', questionKey: 'data.tasks.jungle_q_smaller_3_9', difficulty: 1, options: [{ id: 'opt-9', textKey: 'data.tasks.opt_nine', correct: false }, { id: 'opt-3', textKey: 'data.tasks.opt_three', correct: true }] },
              { id: 'jungle-cmp-1-t3', type: 'input', questionKey: 'data.tasks.jungle_q_6_gt_5', difficulty: 1, answer: "Да" },
              // Montessori
              // ABA
              { id: 'jungle-cmp-1-a1', type: 'multiple_choice', audience: 'special_aba', questionKey: 'data.tasks.aba_jungleCmp_q1', difficulty: 1, options: [{ id: 'opt-7', textKey: 'data.tasks.opt_seven', correct: true }, { id: 'opt-4', textKey: 'data.tasks.opt_four', correct: false }] },
              { id: 'jungle-cmp-1-a2', type: 'multiple_choice', audience: 'special_aba', questionKey: 'data.tasks.aba_jungleCmp_q2', difficulty: 1, options: [{ id: 'opt-9', textKey: 'data.tasks.opt_nine', correct: false }, { id: 'opt-3', textKey: 'data.tasks.opt_three', correct: true }] },
              // TEACCH
            ],
          },
        ],
      },
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
              { titleKey: 'data.intro.jungleAdd_0_title', bodyKey: 'data.intro.jungleAdd_0_body', emoji: '' },
              { titleKey: 'data.intro.jungleAdd_1_title', bodyKey: 'data.intro.jungleAdd_1_body', emoji: '' },
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
              { id: 'jungle-add-1-t3', type: 'input', questionKey: 'data.tasks.q_count_apples', difficulty: 1, answer: '5' },
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
          {
            // Split from a single 23-task "jungle-aba-showcase" lesson into
            // 5 lessons of ~4-5 tasks each - a single 23-task session with no
            // audience filtering was far beyond a young child's attention
            // span. Task ids/content are unchanged, only regrouped; XP is
            // divided across the 5 parts (5 each) so total reward for
            // completing the whole showcase stays the same (25).
            id: 'jungle-aba-showcase-1',
            topicId: 'jungle-addition',
            titleKey: 'data.lessons.jungleAbaShowcase1',
            reward: { xp: 5 },
            abaTokensPerPiece: 5,
            dialog: [{ speaker: 'npc', textKey: 'data.dialog.jungle_aba_0' }, { speaker: 'tali', textKey: 'data.dialog.jungle_aba_1' }],
            intro: [{ titleKey: 'data.intro.jungle_aba_0_t', bodyKey: 'data.intro.jungle_aba_0_b', emoji: '' }, { titleKey: 'data.intro.jungle_aba_1_t', bodyKey: 'data.intro.jungle_aba_1_b', emoji: '' }],
            tasks: [
              {
                id: 'jungle-aba-t0',
                type: 'multiple_choice',
                audience: 'standard',
                questionKey: 'data.tasks.aba_demo_std_warmup',
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
                id: 'jungle-aba-ip1',
                type: 'image_point',
                audience: 'special_aba',
                questionKey: 'data.tasks.aba_demo_ip_q',
                difficulty: 1,
                skippable: true,
                imageKey: 'aba_scene_fruit',
                hotspots: [
                  { id: 'h-a', labelKey: 'data.tasks.aba_demo_ip_q', correct: true, x: 0.28, y: 0.5 },
                  { id: 'h-b', labelKey: 'data.tasks.aba_demo_ip_q2', correct: false, x: 0.72, y: 0.5 },
                ],
              },
              {
                id: 'jungle-aba-ip2',
                type: 'image_point',
                audience: 'special_aba',
                questionKey: 'data.tasks.aba_demo_ip_q2',
                difficulty: 1,
                skippable: true,
                imageKey: 'aba_scene_fruit',
                hotspots: [
                  { id: 'h-a2', labelKey: 'data.tasks.aba_demo_ip_q', correct: false, x: 0.28, y: 0.5 },
                  { id: 'h-b2', labelKey: 'data.tasks.aba_demo_ip_q2', correct: true, x: 0.72, y: 0.5 },
                ],
              },
              {
                id: 'jungle-aba-vi1',
                type: 'vocal_imitation',
                audience: 'special_aba',
                questionKey: 'data.tasks.aba_demo_vi_sound',
                difficulty: 1,
                skippable: true,
                soundTextKey: 'data.tasks.aba_demo_vi_sound',
              },
              {
                id: 'jungle-aba-vi2',
                type: 'vocal_imitation',
                audience: 'special_aba',
                questionKey: 'data.tasks.aba_demo_vi_sound2',
                difficulty: 1,
                skippable: true,
                soundTextKey: 'data.tasks.aba_demo_vi_sound2',
              },
            ],
          },
          {
            id: 'jungle-aba-showcase-2',
            topicId: 'jungle-addition',
            titleKey: 'data.lessons.jungleAbaShowcase2',
            reward: { xp: 5 },
            abaTokensPerPiece: 5,
            tasks: [
              {
                id: 'jungle-aba-wr1',
                type: 'word_repetition',
                audience: 'special_aba',
                questionKey: 'data.tasks.aba_demo_wr_word',
                difficulty: 1,
                skippable: true,
                wordKey: 'data.tasks.aba_demo_wr_word',
                stressSyllableIndex: 0,
              },
              {
                id: 'jungle-aba-wr2',
                type: 'word_repetition',
                audience: 'special_aba',
                questionKey: 'data.tasks.aba_demo_wr_word2',
                difficulty: 1,
                skippable: true,
                wordKey: 'data.tasks.aba_demo_wr_word2',
                stressSyllableIndex: 1,
              },
              {
                id: 'jungle-aba-vol1',
                type: 'volume_control',
                audience: 'special_aba',
                questionKey: 'data.tasks.aba_demo_vol_prompt',
                difficulty: 1,
                skippable: true,
                direction: 'louder',
                promptTextKey: 'data.tasks.aba_demo_vol_prompt',
              },
              {
                id: 'jungle-aba-vol2',
                type: 'volume_control',
                audience: 'special_aba',
                questionKey: 'data.tasks.aba_demo_vol_prompt2',
                difficulty: 1,
                skippable: true,
                direction: 'quieter',
                promptTextKey: 'data.tasks.aba_demo_vol_prompt2',
              },
              {
                id: 'jungle-aba-fb1',
                type: 'fill_blank',
                audience: 'special_aba',
                questionKey: 'data.tasks.aba_demo_fb_sent',
                difficulty: 1,
                skippable: true,
                sentenceKey: 'data.tasks.aba_demo_fb_sent',
                options: [
                  { id: 'fb-a', textKey: 'data.tasks.aba_demo_fb_a', correct: true },
                  { id: 'fb-b', textKey: 'data.tasks.aba_demo_fb_b', correct: false },
                  { id: 'fb-c', textKey: 'data.tasks.aba_demo_fb_c', correct: false },
                ],
              },
            ],
          },
          {
            id: 'jungle-aba-showcase-3',
            topicId: 'jungle-addition',
            titleKey: 'data.lessons.jungleAbaShowcase3',
            reward: { xp: 5 },
            abaTokensPerPiece: 5,
            tasks: [
              {
                id: 'jungle-aba-fb2',
                type: 'fill_blank',
                audience: 'special_aba',
                questionKey: 'data.tasks.aba_demo_fb_sent2',
                difficulty: 1,
                skippable: true,
                sentenceKey: 'data.tasks.aba_demo_fb_sent2',
                options: [
                  { id: 'fb-d', textKey: 'data.tasks.aba_demo_fb_d', correct: false },
                  { id: 'fb-e', textKey: 'data.tasks.aba_demo_fb_e', correct: true },
                  { id: 'fb-f', textKey: 'data.tasks.aba_demo_fb_f', correct: false },
                ],
              },
              {
                id: 'jungle-aba-iwm1',
                type: 'image_word_match',
                audience: 'special_aba',
                questionKey: 'data.tasks.aba_demo_iwm_word',
                difficulty: 1,
                skippable: true,
                direction: 'word_to_image',
                promptTextKey: 'data.tasks.aba_demo_iwm_word',
                options: [
                  { id: 'iwm-a', imageKey: 'aba_match_sun', correct: true },
                  { id: 'iwm-b', imageKey: 'aba_match_moon', correct: false },
                  { id: 'iwm-c', imageKey: 'aba_match_star', correct: false },
                ],
              },
              {
                id: 'jungle-aba-iwm2',
                type: 'image_word_match',
                audience: 'special_aba',
                questionKey: 'data.tasks.aba_demo_iwm_word2',
                difficulty: 1,
                skippable: true,
                direction: 'word_to_image',
                promptTextKey: 'data.tasks.aba_demo_iwm_word2',
                options: [
                  { id: 'iwm-d', imageKey: 'aba_match_moon', correct: true },
                  { id: 'iwm-e', imageKey: 'aba_match_sun', correct: false },
                  { id: 'iwm-f', imageKey: 'aba_match_star', correct: false },
                ],
              },
              {
                id: 'jungle-aba-wk1',
                type: 'world_knowledge',
                audience: 'special_aba',
                questionKey: 'data.tasks.aba_demo_wk_q',
                difficulty: 1,
                skippable: true,
                category: 'world_knowledge',
                options: [
                  { id: 'wk-a', textKey: 'data.tasks.aba_demo_room_living', correct: true },
                  { id: 'wk-b', textKey: 'data.tasks.aba_demo_room_bed', correct: false },
                  { id: 'wk-c', textKey: 'data.tasks.aba_demo_room_kitchen', correct: false },
                ],
              },
              {
                id: 'jungle-aba-wk2',
                type: 'world_knowledge',
                audience: 'special_aba',
                questionKey: 'data.tasks.aba_demo_wk_q2',
                difficulty: 1,
                skippable: true,
                category: 'world_knowledge',
                options: [
                  { id: 'wk-d', textKey: 'data.tasks.aba_demo_room_kitchen', correct: true },
                  { id: 'wk-e', textKey: 'data.tasks.aba_demo_room_bed', correct: false },
                  { id: 'wk-f', textKey: 'data.tasks.aba_demo_room_living', correct: false },
                ],
              },
            ],
          },
          {
            id: 'jungle-aba-showcase-4',
            topicId: 'jungle-addition',
            titleKey: 'data.lessons.jungleAbaShowcase4',
            reward: { xp: 5 },
            abaTokensPerPiece: 5,
            tasks: [
              {
                id: 'jungle-aba-so1',
                type: 'sorting',
                audience: 'special_aba',
                questionKey: 'data.tasks.aba_demo_sort_g1',
                difficulty: 1,
                skippable: true,
                groups: [
                  { id: 'g-food', labelKey: 'data.tasks.aba_demo_sort_g1' },
                  { id: 'g-toy', labelKey: 'data.tasks.aba_demo_sort_g2' },
                ],
                items: [
                  { id: 'so-1', imageKey: 'aba_sort_food', groupId: 'g-food' },
                  { id: 'so-2', imageKey: 'aba_sort_toy', groupId: 'g-toy' },
                  { id: 'so-3', imageKey: 'aba_apple', groupId: 'g-food' },
                  { id: 'so-4', imageKey: 'aba_cat', groupId: 'g-toy' },
                ],
              },
              {
                id: 'jungle-aba-so2',
                type: 'sorting',
                audience: 'special_aba',
                questionKey: 'data.tasks.aba_demo_sort_g1',
                difficulty: 1,
                skippable: true,
                groups: [
                  { id: 'g2-food', labelKey: 'data.tasks.aba_demo_sort_g1' },
                  { id: 'g2-toy', labelKey: 'data.tasks.aba_demo_sort_g2' },
                ],
                items: [
                  { id: 'so2-1', imageKey: 'aba_banana', groupId: 'g2-food' },
                  { id: 'so2-2', imageKey: 'aba_dog', groupId: 'g2-toy' },
                ],
              },
              {
                id: 'jungle-aba-rc1',
                type: 'routine_chain',
                audience: 'special_aba',
                questionKey: 'data.tasks.aba_demo_routine_wet',
                difficulty: 1,
                skippable: true,
                steps: [
                  { id: 'rc1', labelKey: 'data.tasks.aba_demo_routine_wet', imageKey: 'aba_routine_wet', order: 1 },
                  { id: 'rc2', labelKey: 'data.tasks.aba_demo_routine_paste', imageKey: 'aba_routine_paste', order: 2 },
                  { id: 'rc3', labelKey: 'data.tasks.aba_demo_routine_brush', imageKey: 'aba_routine_brush', order: 3 },
                  { id: 'rc4', labelKey: 'data.tasks.aba_demo_routine_rinse', imageKey: 'aba_routine_rinse', order: 4 },
                ],
              },
              {
                id: 'jungle-aba-rc2',
                type: 'routine_chain',
                audience: 'special_aba',
                questionKey: 'data.tasks.aba_demo_routine_brush',
                difficulty: 1,
                skippable: true,
                steps: [
                  { id: 'rc2a', labelKey: 'data.tasks.aba_demo_routine_wet', imageKey: 'aba_routine_wet', order: 1 },
                  { id: 'rc2b', labelKey: 'data.tasks.aba_demo_routine_paste', imageKey: 'aba_routine_paste', order: 2 },
                  { id: 'rc2c', labelKey: 'data.tasks.aba_demo_routine_brush', imageKey: 'aba_routine_brush', order: 3 },
                ],
              },
            ],
          },
          {
            id: 'jungle-aba-showcase-5',
            topicId: 'jungle-addition',
            titleKey: 'data.lessons.jungleAbaShowcase5',
            reward: { xp: 5 },
            abaTokensPerPiece: 5,
            tasks: [
              {
                id: 'jungle-aba-rc3',
                type: 'routine_chain',
                audience: 'special_aba',
                questionKey: 'data.tasks.aba_routine_wash_title',
                difficulty: 1,
                skippable: true,
                steps: [
                  { id: 'rc3a', labelKey: 'data.tasks.aba_routine_wash_tap', imageKey: 'aba_routine_wash_tap', order: 1 },
                  { id: 'rc3b', labelKey: 'data.tasks.aba_routine_wash_soap', imageKey: 'aba_routine_wash_soap', order: 2 },
                  { id: 'rc3c', labelKey: 'data.tasks.aba_routine_wash_rinse', imageKey: 'aba_routine_wash_rinse', order: 3 },
                  { id: 'rc3d', labelKey: 'data.tasks.aba_routine_wash_dry', imageKey: 'aba_routine_wash_dry', order: 4 },
                ],
              },
              {
                id: 'jungle-aba-rc4',
                type: 'routine_chain',
                audience: 'special_aba',
                questionKey: 'data.tasks.aba_routine_sleep_title',
                difficulty: 1,
                skippable: true,
                steps: [
                  { id: 'rc4a', labelKey: 'data.tasks.aba_routine_sleep_pajamas', imageKey: 'aba_routine_sleep_pajamas', order: 1 },
                  { id: 'rc4b', labelKey: 'data.tasks.aba_routine_sleep_teeth', imageKey: 'aba_routine_sleep_teeth', order: 2 },
                  { id: 'rc4c', labelKey: 'data.tasks.aba_routine_sleep_read', imageKey: 'aba_routine_sleep_read', order: 3 },
                  { id: 'rc4d', labelKey: 'data.tasks.aba_routine_sleep_sleep', imageKey: 'aba_routine_sleep_sleep', order: 4 },
                ],
              },
              {
                id: 'jungle-aba-ac1',
                type: 'action_instruction',
                audience: 'special_aba',
                questionKey: 'data.tasks.aba_demo_action_clap',
                difficulty: 1,
                skippable: true,
                actionKey: 'data.tasks.aba_demo_action_clap',
                illustrationKey: 'aba_action_clap',
              },
              {
                id: 'jungle-aba-ac2',
                type: 'action_instruction',
                audience: 'special_aba',
                questionKey: 'data.tasks.aba_demo_action_jump',
                difficulty: 1,
                skippable: true,
                actionKey: 'data.tasks.aba_demo_action_jump',
                illustrationKey: 'aba_action_jump',
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
              { titleKey: 'data.intro.jungleSub_0_title', bodyKey: 'data.intro.jungleSub_0_body', emoji: '' },
              { titleKey: 'data.intro.jungleSub_1_title', bodyKey: 'data.intro.jungleSub_1_body', emoji: '' },
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
                answer: '5',
                placeholderKey: 'lesson.answerPlaceholder',
              },
              {
                id: 'jungle-sub-2-t3',
                type: 'multiple_choice',
                questionKey: 'data.tasks.jungle_q_sub_10_4',
                difficulty: 3,
                options: [
                  { id: 'opt-5', textKey: 'data.tasks.opt_five', correct: false },
                  { id: 'opt-6', textKey: 'data.tasks.opt_six', correct: true },
                  { id: 'opt-7', textKey: 'data.tasks.opt_seven', correct: false },
                ],
              },
              {
                id: 'jungle-sub-2-t4',
                type: 'fill_blank',
                questionKey: 'data.tasks.jungle_sub2_fb_sent',
                difficulty: 3,
                sentenceKey: 'data.tasks.jungle_sub2_fb_sent',
                options: [
                  { id: 'fb-a', textKey: 'data.tasks.opt_four', correct: false },
                  { id: 'fb-b', textKey: 'data.tasks.opt_five', correct: true },
                  { id: 'fb-c', textKey: 'data.tasks.opt_six', correct: false },
                ],
              },
            ],
          },
        ],
      },
    ],
  },

  // ---
  {
    // Content dependency: canyon-words opens directly on whole-word
    // recognition (canyon-words-1-t1) with no letter/phonics content of its
    // own. Letter-level phonics live in the island world's islandAbc topic
    // (worldId: 'island', ageBand: '5-6'). getOrderedLessonNodes() filters
    // worlds by `!w.ageBand || w.ageBand === ageBand` (this file, ~3841),
    // so a profile whose age_band is '7' never sees ageBand:'5-6' worlds at
    // all - the assumption is that a 7-year-old already did islandAbc at
    // 5-6. That holds for a child who has used the app continuously, but
    // NOT for a new user who starts at age 7 - they get word-level reading
    // with no in-app letter foundation. Not fixed here (would mean
    // duplicating/re-authoring letter content into an ageBand:'7' world);
    // flagging the dependency so it's not silently rediscovered as "missing
    // content" later.
    id: 'canyon',
    ageBand: '7',
    titleKey: 'data.worlds.canyon',
    descriptionKey: 'data.worldDesc.canyon',
    accentColor: '#FF9800',
    biome: '',
    npcName: 'Dippy',
    npcEmoji: '',
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
              { titleKey: 'data.intro.canyonWords_0_title', bodyKey: 'data.intro.canyonWords_0_body', emoji: '' },
              { titleKey: 'data.intro.canyonWords_1_title', bodyKey: 'data.intro.canyonWords_1_body', emoji: '' },
            ],
            tasks: [
              // Standard tasks
              { id: 'canyon-w1-t1', type: 'multiple_choice', questionKey: 'data.tasks.canyon_q_word_dog', difficulty: 1, options: [{ id: 'opt-dog', textKey: 'data.tasks.opt_dog', correct: true }, { id: 'opt-cat', textKey: 'data.tasks.opt_cat', correct: false }, { id: 'opt-bird', textKey: 'data.tasks.opt_bird', correct: false }] },
              { id: 'canyon-w1-t2', type: 'multiple_choice', questionKey: 'data.tasks.q_read_sun', difficulty: 1, options: [{ id: 'opt-sun', textKey: 'data.tasks.opt_sun', correct: true }, { id: 'opt-moon', textKey: 'data.tasks.opt_moon', correct: false }, { id: 'opt-star', textKey: 'data.tasks.opt_star', correct: false }] },
              { id: 'canyon-w1-t3', type: 'input', questionKey: 'data.tasks.canyon_q_word_red', difficulty: 1, answer: "Красный" },
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
              { id: 'canyon-w2-t2', type: 'input', questionKey: 'data.tasks.canyon_q_color_grass', difficulty: 2, answer: 'Зелёная' },
              {
                id: 'canyon-w2-t3',
                type: 'multiple_choice',
                questionKey: 'data.tasks.canyon_q_word_dog',
                difficulty: 2,
                options: [
                  { id: 'opt-dog', textKey: 'data.tasks.opt_dog', correct: true },
                  { id: 'opt-cat', textKey: 'data.tasks.opt_cat', correct: false },
                  { id: 'opt-bird', textKey: 'data.tasks.opt_bird', correct: false },
                ],
              },
              {
                id: 'canyon-w2-t4',
                type: 'fill_blank',
                questionKey: 'data.tasks.canyon_w2_fb_sent',
                difficulty: 2,
                sentenceKey: 'data.tasks.canyon_w2_fb_sent',
                options: [
                  { id: 'fb-a', textKey: 'data.tasks.opt_dog', correct: true },
                  { id: 'fb-b', textKey: 'data.tasks.opt_cat', correct: false },
                  { id: 'fb-c', textKey: 'data.tasks.opt_sun', correct: false },
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
              { titleKey: 'data.intro.canyonSent_0_title', bodyKey: 'data.intro.canyonSent_0_body', emoji: '' },
              { titleKey: 'data.intro.canyonSent_1_title', bodyKey: 'data.intro.canyonSent_1_body', emoji: '' },
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
              { id: 'canyon-s1-t3', type: 'input', questionKey: 'data.tasks.canyon_q_sentence_big_dog', difficulty: 2, answer: "Да" },
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
    biome: '',
    npcName: 'Spike',
    npcEmoji: '',
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
              { titleKey: 'data.intro.labAnimals_0_title', bodyKey: 'data.intro.labAnimals_0_body', emoji: '' },
              { titleKey: 'data.intro.labAnimals_1_title', bodyKey: 'data.intro.labAnimals_1_body', emoji: '' },
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
              { id: 'lab-an-1-t3', type: 'input', questionKey: 'data.tasks.lab_q_cat_legs', difficulty: 2, answer: '4' },
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
              { id: 'lab-an-2-t2', type: 'input', questionKey: 'data.tasks.lab_q_logic_pattern', difficulty: 2, answer: 'Рыба' },
              {
                id: 'lab-an-2-t3',
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
                id: 'lab-an-2-t4',
                type: 'sorting',
                questionKey: 'data.tasks.lab_an2_sort_q',
                difficulty: 2,
                groups: [
                  { id: 'g-water', labelKey: 'data.tasks.lab_an2_sort_water' },
                  { id: 'g-land', labelKey: 'data.tasks.lab_an2_sort_land' },
                ],
                items: [
                  { id: 'so-1', imageKey: 'aba_fish', groupId: 'g-water' },
                  { id: 'so-2', imageKey: 'aba_cat', groupId: 'g-land' },
                  { id: 'so-3', imageKey: 'aba_dog', groupId: 'g-land' },
                  { id: 'so-4', imageKey: 'aba_bird', groupId: 'g-land' },
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
              { titleKey: 'data.intro.labPhysics_0_title', bodyKey: 'data.intro.labPhysics_0_body', emoji: '' },
              { titleKey: 'data.intro.labPhysics_1_title', bodyKey: 'data.intro.labPhysics_1_body', emoji: '' },
            ],
            tasks: [
              {
                id: 'lab-ph-1-t1',
                type: 'multiple_choice',
                questionKey: 'data.tasks.q_balance_scale',
                difficulty: 2,
                options: [
                  { id: 'opt-add-weight', textKey: 'data.tasks.opt_add_weight', correct: true },
                  { id: 'opt-remove-weight', textKey: 'data.tasks.opt_remove_weight', correct: false },
                ],
              },
              {
                id: 'lab-ph-1-t2',
                type: 'multiple_choice',
                questionKey: 'data.tasks.lab_ph_q2',
                difficulty: 2,
                options: [
                  { id: 'a', textKey: 'data.tasks.lab_ph_q2_a', correct: false },
                  { id: 'b', textKey: 'data.tasks.lab_ph_q2_b', correct: true },
                  { id: 'c', textKey: 'data.tasks.lab_ph_q2_c', correct: false },
                ],
              },
              { id: 'lab-ph-1-t3', type: 'input', questionKey: 'data.tasks.lab_ph_q3', difficulty: 2, answer: "Равновесие" },
              { id: 'lab-ph-1-t4', type: 'input', questionKey: 'data.tasks.lab_ph_q4', difficulty: 2, answer: "Вправо" },
              // Montessori
              // ABA
              { id: 'lab-ph-1-a1', type: 'multiple_choice', audience: 'special_aba', questionKey: 'data.tasks.aba_labPhysics_q1', difficulty: 2, options: [{ id: 'opt-2', textKey: 'data.tasks.opt_two', correct: true }, { id: 'opt-3', textKey: 'data.tasks.opt_three', correct: false }, { id: 'opt-4', textKey: 'data.tasks.opt_four', correct: false }] },
              { id: 'lab-ph-1-a2', type: 'multiple_choice', audience: 'special_aba', questionKey: 'data.tasks.aba_labPhysics_q2', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.aba_labPhysics_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.aba_labPhysics_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.aba_labPhysics_q2_c', correct: false }] },
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
    biome: '',
    npcName: 'Stela',
    npcEmoji: '',
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
              { titleKey: 'data.intro.spacePlanets_0_title', bodyKey: 'data.intro.spacePlanets_0_body', emoji: '' },
              { titleKey: 'data.intro.spacePlanets_1_title', bodyKey: 'data.intro.spacePlanets_1_body', emoji: '' },
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
              { id: 'space-pl-1-t3', type: 'input', questionKey: 'data.tasks.space_q_planet_count', difficulty: 3, answer: "8" },
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
              { id: 'space-pl-2-t2', type: 'input', questionKey: 'data.tasks.space_q_largest_planet', difficulty: 3, answer: 'Юпитер' },
              {
                id: 'space-pl-2-t3',
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
                id: 'space-pl-2-t4',
                type: 'input',
                questionKey: 'data.tasks.space_q_planet_count',
                difficulty: 3,
                answer: '8',
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
              { titleKey: 'data.intro.spaceSolar_0_title', bodyKey: 'data.intro.spaceSolar_0_body', emoji: '' },
              { titleKey: 'data.intro.spaceSolar_1_title', bodyKey: 'data.intro.spaceSolar_1_body', emoji: '' },
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
              {
                // Bridges the difficulty-3 MC tasks above and the
                // difficulty-4 free-text spelling task below: recognize the
                // word "orbit" in a multiple-choice question before being
                // asked to spell it unaided (receptive before expressive).
                id: 'space-sol-1-t2b',
                type: 'multiple_choice',
                questionKey: 'data.tasks.space_q_orbit_mc',
                difficulty: 3,
                options: [
                  { id: 'opt-orbit', textKey: 'data.tasks.opt_orbit', correct: true },
                  { id: 'opt-atmosphere', textKey: 'data.tasks.opt_atmosphere', correct: false },
                  { id: 'opt-galaxy', textKey: 'data.tasks.opt_galaxy', correct: false },
                ],
              },
              { id: 'space-sol-1-t3', type: 'input', questionKey: 'data.tasks.space_q_orbit_word', difficulty: 4, answer: 'орбита', placeholderKey: 'lesson.answerPlaceholder' },
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

  // ---
  // ---
  // ---

  // ---
  // Verified (no fix needed): meadow (counting, ageBand 5-6) sits after
  // jungle (arithmetic, ageBand 7) in this array, which looks backwards for
  // prerequisite ordering. It has no actual effect though -
  // getOrderedLessonNodes() filters worlds by `!w.ageBand || w.ageBand ===
  // ageBand` (~3841 in this file) against settingsStore's `ageBand`, which
  // always has a concrete value ('5-6' default, never undefined) - so a
  // 5-6 profile never sees jungle content and a 7 profile never sees
  // meadow content. The two worlds are mutually exclusive per session;
  // their relative array position is inert.
  {
    id: 'meadow',
    ageBand: '5-6',
    titleKey: 'data.worlds.meadow',
    descriptionKey: 'data.worldDesc.meadow',
    accentColor: '#FF7043',
    biome: '',
    npcName: 'Зайка Зоя',
    npcEmoji: '',
    topics: [
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
    { titleKey: 'data.intro.meadow_c5l1_0_t', bodyKey: 'data.intro.meadow_c5l1_0_b', emoji: '🚀' },
    { titleKey: 'data.intro.meadow_c5l1_1_t', bodyKey: 'data.intro.meadow_c5l1_1_b', emoji: '⭐' },
  ],
  tasks: [
    { id: 'mc5l1-t1', type: 'multiple_choice', questionKey: 'data.tasks.pre_count_2kittens', difficulty: 1, visualCount: 2, visualEmoji: '🐱', options: [{ id: 'a', textKey: 'data.tasks.opt_one', correct: false }, { id: 'b', textKey: 'data.tasks.opt_two', correct: true }, { id: 'c', textKey: 'data.tasks.opt_three', correct: false }] },
    { id: 'mc5l1-t2', type: 'multiple_choice', questionKey: 'data.tasks.pre_next_after_2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_one', correct: false }, { id: 'b', textKey: 'data.tasks.opt_three', correct: true }, { id: 'c', textKey: 'data.tasks.opt_four', correct: false }] },
    { id: 'mc5l1-t3', type: 'multiple_choice', questionKey: 'data.tasks.pre_story_tali_1plus2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_two', correct: false }, { id: 'b', textKey: 'data.tasks.opt_three', correct: true }, { id: 'c', textKey: 'data.tasks.opt_four', correct: false }] },
    { id: 'mc5l1-t4', type: 'multiple_choice', questionKey: 'data.tasks.pre_story_3apples_more_1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_tali', correct: true }, { id: 'b', textKey: 'data.tasks.pre_opt_hare', correct: false }, { id: 'c', textKey: 'data.tasks.pre_opt_equal_short', correct: false }] },
    { id: 'mc5l1-a1', type: 'multiple_choice', audience: 'special_aba', questionKey: 'data.tasks.aba_count_3stars', difficulty: 1, visualCount: 3, visualEmoji: '⭐', options: [{ id: 'a', textKey: 'data.tasks.opt_two', correct: false }, { id: 'b', textKey: 'data.tasks.opt_three', correct: true }] },
  ],
},
          {
  id: 'meadow-c5-l2',
  topicId: 'meadow-count5',
  titleKey: 'data.lessons.meadowC5L2',
  reward: { xp: 20 },
  dialog: [
    { speaker: 'tali', textKey: 'data.dialog.meadow_c5l2_0' },
    { speaker: 'npc', textKey: 'data.dialog.meadow_c5l2_1' },
  ],
  intro: [
    { titleKey: 'data.intro.meadow_c5l2_0_t', bodyKey: 'data.intro.meadow_c5l2_0_b', emoji: '✋' },
    { titleKey: 'data.intro.meadow_c5l2_1_t', bodyKey: 'data.intro.meadow_c5l2_1_b', emoji: '🖐️' },
  ],
  tasks: [
    { id: 'mc5l2-t1', type: 'multiple_choice', questionKey: 'data.tasks.pre_count_4pizzas', difficulty: 1, visualCount: 4, visualEmoji: '🍕', options: [{ id: 'a', textKey: 'data.tasks.opt_three', correct: false }, { id: 'b', textKey: 'data.tasks.opt_four', correct: true }, { id: 'c', textKey: 'data.tasks.opt_five', correct: false }] },
    { id: 'mc5l2-t2', type: 'multiple_choice', questionKey: 'data.tasks.pre_missing_1_2_gap_4_5', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_one', correct: false }, { id: 'b', textKey: 'data.tasks.opt_three', correct: true }, { id: 'c', textKey: 'data.tasks.opt_five', correct: false }] },
    { id: 'mc5l2-t3', type: 'multiple_choice', questionKey: 'data.tasks.pre_how_many_more_3to5', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_one', correct: false }, { id: 'b', textKey: 'data.tasks.opt_two', correct: true }, { id: 'c', textKey: 'data.tasks.opt_three', correct: false }] },
    { id: 'mc5l2-t4', type: 'input', questionKey: 'data.tasks.pre_story_2birds_2more_total', difficulty: 1, answer: "4" },
    { id: 'mc5l2-a1', type: 'multiple_choice', audience: 'special_aba', questionKey: 'data.tasks.aba_count_5apples', difficulty: 1, visualCount: 5, visualEmoji: '🍎', options: [{ id: 'a', textKey: 'data.tasks.opt_three', correct: false }, { id: 'b', textKey: 'data.tasks.opt_five', correct: true }] },
  ],
},
          {
  id: 'meadow-c5-l3',
  topicId: 'meadow-count5',
  titleKey: 'data.lessons.meadowC5L3',
  reward: { xp: 25, item: 'banana_badge' },
  dialog: [
    { speaker: 'npc', textKey: 'data.dialog.meadow_c5l3_0' },
    { speaker: 'tali', textKey: 'data.dialog.meadow_c5l3_1' },
  ],
  intro: [
    { titleKey: 'data.intro.meadow_c5l3_0_t', bodyKey: 'data.intro.meadow_c5l3_0_b', emoji: '⚖️' },
    { titleKey: 'data.intro.meadow_c5l3_1_t', bodyKey: 'data.intro.meadow_c5l3_1_b', emoji: '🔢' },
  ],
  tasks: [
    {
      id: 'mc5l3-t1',
      type: 'multiple_choice',
      questionKey: 'data.tasks.mc5l3_q_carrots_baskets',
      difficulty: 1,
      options: [
        { id: 'a', textKey: 'data.tasks.mc5l3_opt_carrots_first2', correct: false },
        { id: 'b', textKey: 'data.tasks.mc5l3_opt_carrots_second5', correct: true },
        { id: 'c', textKey: 'data.tasks.mc5l3_opt_carrots_equal', correct: false },
      ],
    },
    {
      id: 'mc5l3-t2',
      type: 'multiple_choice',
      questionKey: 'data.tasks.mc5l3_q_lanterns_sides',
      difficulty: 1,
      options: [
        { id: 'a', textKey: 'data.tasks.mc5l3_opt_lanterns_left4', correct: false },
        { id: 'b', textKey: 'data.tasks.mc5l3_opt_lanterns_right2', correct: true },
        { id: 'c', textKey: 'data.tasks.mc5l3_opt_lanterns_equal', correct: false },
      ],
    },
    {
      id: 'mc5l3-t3',
      type: 'fill_blank',
      questionKey: 'data.tasks.mc5l3_fb_sent',
      difficulty: 2,
      sentenceKey: 'data.tasks.mc5l3_fb_sent',
      options: [
        { id: 'fb-a', textKey: 'data.tasks.mc5l3_opt_more_kittens', correct: false },
        { id: 'fb-b', textKey: 'data.tasks.mc5l3_opt_more_puppies', correct: false },
        { id: 'fb-c', textKey: 'data.tasks.mc5l3_opt_equal_kittens_puppies', correct: true },
      ],
    },
    { id: 'mc5l3-t4', type: 'input', questionKey: 'data.tasks.mc5l3_q_which_bigger_1_or_4', difficulty: 2, answer: '4' },
    {
      id: 'mc5l3-a1',
      type: 'multiple_choice',
      audience: 'special_aba',
      questionKey: 'data.tasks.aba_bigger_3or1',
      difficulty: 1,
      options: [
        { id: 'a', textKey: 'data.tasks.opt_one', correct: false },
        { id: 'b', textKey: 'data.tasks.opt_three', correct: true },
      ],
    },
  ],
},
        ],
      },
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
    { titleKey: 'data.intro.meadow_c10l1_0_t', bodyKey: 'data.intro.meadow_c10l1_0_b', emoji: '🤖' },
    { titleKey: 'data.intro.meadow_c10l1_1_t', bodyKey: 'data.intro.meadow_c10l1_1_b', emoji: '🍦' },
  ],
  tasks: [
    { id: 'mc10l1-t1', type: 'multiple_choice', questionKey: 'data.tasks.pre_count_6robots', difficulty: 1, visualCount: 6, visualEmoji: '🤖', options: [{ id: 'a', textKey: 'data.tasks.opt_five', correct: false }, { id: 'b', textKey: 'data.tasks.opt_six', correct: true }, { id: 'c', textKey: 'data.tasks.opt_seven', correct: false }] },
    {
      id: 'mc10l1-t2',
      type: 'multiple_choice',
      questionKey: 'data.tasks.pre_birds_tree_vs_bush',
      difficulty: 2,
      options: [
        { id: 'a', textKey: 'data.tasks.pre_opt_tree_six_birds', correct: false },
        { id: 'b', textKey: 'data.tasks.pre_opt_bush_four_birds', correct: true },
        { id: 'c', textKey: 'data.tasks.pre_opt_birds_equal_spots', correct: false },
      ],
    },
    { id: 'mc10l1-t3', type: 'multiple_choice', questionKey: 'data.tasks.pre_how_many_more_5to7', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_one', correct: false }, { id: 'b', textKey: 'data.tasks.opt_two', correct: true }, { id: 'c', textKey: 'data.tasks.opt_three', correct: false }] },
    { id: 'mc10l1-t4', type: 'multiple_choice', questionKey: 'data.tasks.pre_story_6fish_7fish_which_more', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.pre_opt_red_tank', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_blue_tank', correct: true }, { id: 'c', textKey: 'data.tasks.pre_opt_equal_fish', correct: false }] },
    { id: 'mc10l1-a1', type: 'multiple_choice', audience: 'special_aba', questionKey: 'data.tasks.aba_count_7stars', difficulty: 1, visualCount: 7, visualEmoji: '⭐', options: [{ id: 'a', textKey: 'data.tasks.opt_six', correct: false }, { id: 'b', textKey: 'data.tasks.opt_seven', correct: true }] },
  ],
},
          {
  id: 'meadow-c10-l2',
  topicId: 'meadow-count10',
  titleKey: 'data.lessons.meadowC10L2',
  reward: { xp: 25 },
  dialog: [
    { speaker: 'tali', textKey: 'data.dialog.meadow_c10l2_0' },
    { speaker: 'npc', textKey: 'data.dialog.meadow_c10l2_1' },
  ],
  intro: [
    { titleKey: 'data.intro.meadow_c10l2_0_t', bodyKey: 'data.intro.meadow_c10l2_0_b', emoji: '🐙' },
    { titleKey: 'data.intro.meadow_c10l2_1_t', bodyKey: 'data.intro.meadow_c10l2_1_b', emoji: '🌟' },
  ],
  tasks: [
    { id: 'mc10l2-t1', type: 'multiple_choice', questionKey: 'data.tasks.pre_story_parrots_9minus2', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_six', correct: false }, { id: 'b', textKey: 'data.tasks.opt_seven', correct: true }, { id: 'c', textKey: 'data.tasks.opt_eight', correct: false }] },
    { id: 'mc10l2-t2', type: 'multiple_choice', questionKey: 'data.tasks.pre_missing_6_7_gap_9', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_seven', correct: false }, { id: 'b', textKey: 'data.tasks.opt_eight', correct: true }, { id: 'c', textKey: 'data.tasks.opt_ten', correct: false }] },
    { id: 'mc10l2-t3', type: 'multiple_choice', questionKey: 'data.tasks.pre_count_9stars_shine', difficulty: 1, visualCount: 9, visualEmoji: '🌟', options: [{ id: 'a', textKey: 'data.tasks.opt_eight', correct: false }, { id: 'b', textKey: 'data.tasks.opt_nine', correct: true }, { id: 'c', textKey: 'data.tasks.opt_ten', correct: false }] },
    { id: 'mc10l2-t4', type: 'input', questionKey: 'data.tasks.pre_story_spider_8legs', difficulty: 2, answer: "8" },
    { id: 'mc10l2-a1', type: 'multiple_choice', audience: 'special_aba', questionKey: 'data.tasks.aba_after_7', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_eight', correct: true }, { id: 'b', textKey: 'data.tasks.opt_nine', correct: false }] },
  ],
},
          {
  id: 'meadow-c10-l3',
  topicId: 'meadow-count10',
  titleKey: 'data.lessons.meadowC10L3',
  reward: { xp: 30 },
  dialog: [
    { speaker: 'npc', textKey: 'data.dialog.meadow_c10l3_0' },
    { speaker: 'tali', textKey: 'data.dialog.meadow_c10l3_1' },
  ],
  intro: [
    { titleKey: 'data.intro.meadow_c10l3_0_t', bodyKey: 'data.intro.meadow_c10l3_0_b', emoji: '🔢' },
    { titleKey: 'data.intro.meadow_c10l3_1_t', bodyKey: 'data.intro.meadow_c10l3_1_b', emoji: '🧩' },
  ],
  tasks: [
    { id: 'mc10l3-t1', type: 'multiple_choice', questionKey: 'data.tasks.pre_pattern_2_4_6_8', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_nine', correct: false }, { id: 'b', textKey: 'data.tasks.opt_ten', correct: true }, { id: 'c', textKey: 'data.tasks.opt_seven', correct: false }] },
    { id: 'mc10l3-t2', type: 'multiple_choice', questionKey: 'data.tasks.pre_story_cubes_6plus4', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_nine', correct: false }, { id: 'b', textKey: 'data.tasks.opt_ten', correct: true }, { id: 'c', textKey: 'data.tasks.opt_eleven', correct: false }] },
    {
      id: 'mc10l3-t3',
      type: 'multiple_choice',
      questionKey: 'data.tasks.pre_mc10l3_apples_baskets_more',
      difficulty: 2,
      options: [
        { id: 'a', textKey: 'data.tasks.pre_opt_left_basket_6_apples', correct: true },
        { id: 'b', textKey: 'data.tasks.pre_opt_right_basket_4_apples', correct: false },
        { id: 'c', textKey: 'data.tasks.pre_opt_apples_equal_baskets', correct: false },
      ],
    },
    { id: 'mc10l3-t4', type: 'input', questionKey: 'data.tasks.pre_between_8_10', difficulty: 1, answer: "9" },
    { id: 'mc10l3-a1', type: 'multiple_choice', audience: 'special_aba', questionKey: 'data.tasks.aba_bigger_9or10', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_nine', correct: false }, { id: 'b', textKey: 'data.tasks.opt_ten', correct: true }] },
  ],
},
        ],
      },
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
    { titleKey: 'data.intro.meadow_shl1_0_t', bodyKey: 'data.intro.meadow_shl1_0_b', emoji: '⭕' },
    { titleKey: 'data.intro.meadow_shl1_1_t', bodyKey: 'data.intro.meadow_shl1_1_b', emoji: '🔵' },
  ],
  tasks: [
    { id: 'mshl1-t1', type: 'multiple_choice', questionKey: 'data.tasks.pre_which_is_round', difficulty: 1, visualEmoji: '🔴', options: [{ id: 'a', textKey: 'data.tasks.pre_opt_door', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_coin', correct: true }, { id: 'c', textKey: 'data.tasks.pre_opt_brick', correct: false }] },
    { id: 'mshl1-t2', type: 'multiple_choice', questionKey: 'data.tasks.pre_circle_has_corners', difficulty: 1, visualEmoji: '⭕', options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: false }, { id: 'b', textKey: 'data.tasks.opt_no', correct: true }] },
    { id: 'mshl1-t3', type: 'multiple_choice', questionKey: 'data.tasks.pre_square_sides_count', difficulty: 1, visualEmoji: '🟦', options: [{ id: 'a', textKey: 'data.tasks.opt_three', correct: false }, { id: 'b', textKey: 'data.tasks.opt_four', correct: true }, { id: 'c', textKey: 'data.tasks.opt_five', correct: false }] },
    { id: 'mshl1-t4', type: 'multiple_choice', questionKey: 'data.tasks.pre_which_has_4_corners', difficulty: 2, visualEmoji: '🟦', options: [{ id: 'a', textKey: 'data.tasks.opt_circle', correct: false }, { id: 'b', textKey: 'data.tasks.opt_square', correct: true }, { id: 'c', textKey: 'data.tasks.opt_triangle', correct: false }] },
    { id: 'mshl1-a1', type: 'multiple_choice', audience: 'special_aba', questionKey: 'data.tasks.aba_snowball_shape', difficulty: 1, visualEmoji: '⚪', options: [{ id: 'a', textKey: 'data.tasks.opt_circle', correct: true }, { id: 'b', textKey: 'data.tasks.opt_square', correct: false }] },
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
    { titleKey: 'data.intro.meadow_shl2_0_t', bodyKey: 'data.intro.meadow_shl2_0_b', emoji: '🟦' },
    { titleKey: 'data.intro.meadow_shl2_1_t', bodyKey: 'data.intro.meadow_shl2_1_b', emoji: '📺' },
  ],
  tasks: [
    { id: 'mshl2-t1', type: 'multiple_choice', questionKey: 'data.tasks.mshl2_triangle_sides_q', difficulty: 1, visualEmoji: '🔺', options: [{ id: 'a', textKey: 'data.tasks.opt_three', correct: true }, { id: 'b', textKey: 'data.tasks.opt_four', correct: false }, { id: 'c', textKey: 'data.tasks.opt_five', correct: false }] },
    { id: 'mshl2-t2', type: 'multiple_choice', questionKey: 'data.tasks.pre_door_shape', difficulty: 1, visualEmoji: '🚪', options: [{ id: 'a', textKey: 'data.tasks.opt_circle', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_rectangle', correct: true }, { id: 'c', textKey: 'data.tasks.opt_triangle', correct: false }] },
    { id: 'mshl2-t3', type: 'multiple_choice', questionKey: 'data.tasks.mshl2_four_corners_q', difficulty: 2, visualEmoji: '🔲', options: [{ id: 'a', textKey: 'data.tasks.opt_circle', correct: false }, { id: 'b', textKey: 'data.tasks.opt_triangle', correct: false }, { id: 'c', textKey: 'data.tasks.pre_opt_rectangle', correct: true }] },
    { id: 'mshl2-t4', type: 'multiple_choice', questionKey: 'data.tasks.mshl2_rect_in_room_q', difficulty: 2, visualEmoji: '📕', options: [{ id: 'a', textKey: 'data.tasks.pre_opt_ball', correct: false }, { id: 'b', textKey: 'data.tasks.pre_opt_book', correct: true }, { id: 'c', textKey: 'data.tasks.pre_opt_sun_ru', correct: false }] },
    { id: 'mshl2-a1', type: 'multiple_choice', audience: 'special_aba', questionKey: 'data.tasks.aba_door_shape', difficulty: 1, visualEmoji: '🚪', options: [{ id: 'a', textKey: 'data.tasks.pre_opt_rectangle', correct: true }, { id: 'b', textKey: 'data.tasks.opt_circle', correct: false }] },
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
    { titleKey: 'data.intro.meadow_shl3_0_t', bodyKey: 'data.intro.meadow_shl3_0_b', emoji: '🔺' },
    { titleKey: 'data.intro.meadow_shl3_1_t', bodyKey: 'data.intro.meadow_shl3_1_b', emoji: '🧇' },
  ],
  tasks: [
    { id: 'mshl3-t1', type: 'multiple_choice', questionKey: 'data.tasks.pre_riddle_3corners_3sides', difficulty: 1, visualEmoji: '🔺', options: [{ id: 'a', textKey: 'data.tasks.opt_square', correct: false }, { id: 'b', textKey: 'data.tasks.opt_circle', correct: false }, { id: 'c', textKey: 'data.tasks.opt_triangle', correct: true }] },
    { id: 'mshl3-t2', type: 'multiple_choice', questionKey: 'data.tasks.pre_triangle_sides', difficulty: 2, visualEmoji: '🔺', options: [{ id: 'a', textKey: 'data.tasks.opt_two', correct: false }, { id: 'b', textKey: 'data.tasks.opt_three', correct: true }, { id: 'c', textKey: 'data.tasks.opt_four', correct: false }] },
    { id: 'mshl3-t3', type: 'multiple_choice', questionKey: 'data.tasks.pre_odd_one_out_shapes', difficulty: 2, visualEmoji: '🍊', options: [{ id: 'a', textKey: 'data.tasks.opt_circle', correct: false }, { id: 'b', textKey: 'data.tasks.opt_square', correct: false }, { id: 'c', textKey: 'data.tasks.pre_opt_orange_fruit_obj', correct: true }] },
    { id: 'mshl3-t4', type: 'multiple_choice', questionKey: 'data.tasks.pre_which_shape_no_corners', difficulty: 1, visualEmoji: '⭕', options: [{ id: 'a', textKey: 'data.tasks.opt_circle', correct: true }, { id: 'b', textKey: 'data.tasks.opt_square', correct: false }, { id: 'c', textKey: 'data.tasks.opt_triangle', correct: false }] },
    { id: 'mshl3-a1', type: 'multiple_choice', audience: 'special_aba', questionKey: 'data.tasks.aba_triangle_corners', difficulty: 1, visualEmoji: '🔺', options: [{ id: 'a', textKey: 'data.tasks.opt_three', correct: true }, { id: 'b', textKey: 'data.tasks.opt_four', correct: false }] },
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
    biome: '',
    npcName: 'Ёжик Федя',
    npcEmoji: '',
    topics: [
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
    { titleKey: 'data.intro.forest_vl1_1_t', bodyKey: 'data.intro.forest_vl1_1_b', emoji: '🌀' },
  ],
  tasks: RW56_LESSON_TASKS['forest-v-l1'],
},
          {
  id: 'forest-v-l2',
  topicId: 'forest-vowels',
  titleKey: 'data.lessons.forestVL2',
  reward: { xp: 20 },
  dialog: [
    { speaker: 'tali', textKey: 'data.dialog.forest_vl2_0' },
    { speaker: 'npc', textKey: 'data.dialog.forest_vl2_1' },
  ],
  intro: [
    { titleKey: 'data.intro.forest_vl2_0_t', bodyKey: 'data.intro.forest_vl2_0_b', emoji: '🦆' },
    { titleKey: 'data.intro.forest_vl2_1_t', bodyKey: 'data.intro.forest_vl2_1_b', emoji: '🐟' },
  ],
  tasks: RW56_LESSON_TASKS['forest-v-l2'],
},
          {
  id: 'forest-v-l3',
  topicId: 'forest-vowels',
  titleKey: 'data.lessons.forestVL3',
  reward: { xp: 25 },
  dialog: [
    { speaker: 'npc', textKey: 'data.dialog.forest_vl3_0' },
    { speaker: 'tali', textKey: 'data.dialog.forest_vl3_1' },
  ],
  intro: [
    { titleKey: 'data.intro.forest_vl3_0_t', bodyKey: 'data.intro.forest_vl3_0_b', emoji: '🦁' },
    { titleKey: 'data.intro.forest_vl3_1_t', bodyKey: 'data.intro.forest_vl3_1_b', emoji: '🎪' },
  ],
  tasks: RW56_LESSON_TASKS['forest-v-l3'],
},
        ],
      },
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
    { speaker: 'tali', textKey: 'data.dialog.forest_conl1_0' },
    { speaker: 'npc', textKey: 'data.dialog.forest_conl1_1' },
  ],
  intro: [
    { titleKey: 'data.intro.forest_conl1_0_t', bodyKey: 'data.intro.forest_conl1_0_b', emoji: '🐻' },
    { titleKey: 'data.intro.forest_conl1_1_t', bodyKey: 'data.intro.forest_conl1_1_b', emoji: '🍄' },
  ],
  tasks: RW56_LESSON_TASKS['forest-con-l1'],
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
    { titleKey: 'data.intro.forest_conl2_0_t', bodyKey: 'data.intro.forest_conl2_0_b', emoji: '🐊' },
    { titleKey: 'data.intro.forest_conl2_1_t', bodyKey: 'data.intro.forest_conl2_1_b', emoji: '🦖' },
  ],
  tasks: RW56_LESSON_TASKS['forest-con-l2'],
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
    { titleKey: 'data.intro.forest_conl3_0_t', bodyKey: 'data.intro.forest_conl3_0_b', emoji: '🦋' },
    { titleKey: 'data.intro.forest_conl3_1_t', bodyKey: 'data.intro.forest_conl3_1_b', emoji: '🌺' },
  ],
  tasks: RW56_LESSON_TASKS['forest-con-l3'],
},
        ],
      },
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
    { titleKey: 'data.intro.forest_syll1_0_t', bodyKey: 'data.intro.forest_syll1_0_b', emoji: '🎵' },
    { titleKey: 'data.intro.forest_syll1_1_t', bodyKey: 'data.intro.forest_syll1_1_b', emoji: '🐄' },
  ],
  tasks: RW56_LESSON_TASKS['forest-syl-l1'],
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
    { titleKey: 'data.intro.forest_syll2_0_t', bodyKey: 'data.intro.forest_syll2_0_b', emoji: '🦉' },
    { titleKey: 'data.intro.forest_syll2_1_t', bodyKey: 'data.intro.forest_syll2_1_b', emoji: '🐘' },
  ],
  tasks: RW56_LESSON_TASKS['forest-syl-l2'],
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
    { titleKey: 'data.intro.forest_syll3_0_t', bodyKey: 'data.intro.forest_syll3_0_b', emoji: '🌈' },
    { titleKey: 'data.intro.forest_syll3_1_t', bodyKey: 'data.intro.forest_syll3_1_b', emoji: '🎯' },
  ],
  tasks: RW56_LESSON_TASKS['forest-syl-l3'],
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
    biome: '',
    npcName: 'Черепашка Тара',
    npcEmoji: '',
    topics: [
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
    { titleKey: 'data.intro.garden_coll1_1_t', bodyKey: 'data.intro.garden_coll1_1_b', emoji: '🍓' },
  ],
  tasks: RW56_LESSON_TASKS['garden-col-l1'],
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
    { titleKey: 'data.intro.garden_coll2_0_t', bodyKey: 'data.intro.garden_coll2_0_b', emoji: '🍊' },
    { titleKey: 'data.intro.garden_coll2_1_t', bodyKey: 'data.intro.garden_coll2_1_b', emoji: '🐘' },
  ],
  tasks: RW56_LESSON_TASKS['garden-col-l2'],
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
    { titleKey: 'data.intro.garden_coll3_0_t', bodyKey: 'data.intro.garden_coll3_0_b', emoji: '🎭' },
    { titleKey: 'data.intro.garden_coll3_1_t', bodyKey: 'data.intro.garden_coll3_1_b', emoji: '🌑' },
  ],
  tasks: RW56_LESSON_TASKS['garden-col-l3'],
},
        ],
      },
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
    { titleKey: 'data.intro.garden_animl1_1_t', bodyKey: 'data.intro.garden_animl1_1_b', emoji: '🏡' },
  ],
  tasks: RW56_LESSON_TASKS['garden-anim-l1'],
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
    { titleKey: 'data.intro.garden_animl2_0_t', bodyKey: 'data.intro.garden_animl2_0_b', emoji: '🦊' },
    { titleKey: 'data.intro.garden_animl2_1_t', bodyKey: 'data.intro.garden_animl2_1_b', emoji: '🌲' },
  ],
  tasks: RW56_LESSON_TASKS['garden-anim-l2'],
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
    { titleKey: 'data.intro.garden_animl3_0_t', bodyKey: 'data.intro.garden_animl3_0_b', emoji: '🐬' },
    { titleKey: 'data.intro.garden_animl3_1_t', bodyKey: 'data.intro.garden_animl3_1_b', emoji: '🦅' },
  ],
  tasks: RW56_LESSON_TASKS['garden-anim-l3'],
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
              { titleKey: 'data.intro.garden_seasl1_0_t', bodyKey: 'data.intro.garden_seasl1_0_b', emoji: '' },
              { titleKey: 'data.intro.garden_seasl1_1_t', bodyKey: 'data.intro.garden_seasl1_1_b', emoji: '' },
            ],
            tasks: RW56_LESSON_TASKS['garden-seas-l1'],
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
              { titleKey: 'data.intro.garden_seasl2_0_t', bodyKey: 'data.intro.garden_seasl2_0_b', emoji: '' },
              { titleKey: 'data.intro.garden_seasl2_1_t', bodyKey: 'data.intro.garden_seasl2_1_b', emoji: '' },
            ],
            tasks: RW56_LESSON_TASKS['garden-seas-l2'],
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
              { titleKey: 'data.intro.garden_seasl3_0_t', bodyKey: 'data.intro.garden_seasl3_0_b', emoji: '' },
              { titleKey: 'data.intro.garden_seasl3_1_t', bodyKey: 'data.intro.garden_seasl3_1_b', emoji: '' },
            ],
            tasks: RW56_LESSON_TASKS['garden-seas-l3'],
          },
        ],
      },
    ],
  },

  {
    id: 'island',
    ageBand: '5-6',
    titleKey: 'data.worlds.island',
    descriptionKey: 'data.worldDesc.island',
    accentColor: '#29B6F6',
    biome: '',
    npcName: 'Попугай Пит',
    npcEmoji: '',
    topics: [
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
    { titleKey: 'data.intro.island_abcl1_0_t', bodyKey: 'data.intro.island_abcl1_0_b', emoji: '🦊' },
    { titleKey: 'data.intro.island_abcl1_1_t', bodyKey: 'data.intro.island_abcl1_1_b', emoji: '🐝' },
  ],
  tasks: RW56_LESSON_TASKS['island-abc-l1'],
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
    { titleKey: 'data.intro.island_abcl2_0_t', bodyKey: 'data.intro.island_abcl2_0_b', emoji: '🦕' },
    { titleKey: 'data.intro.island_abcl2_1_t', bodyKey: 'data.intro.island_abcl2_1_b', emoji: '🐘' },
  ],
  tasks: RW56_LESSON_TASKS['island-abc-l2'],
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
    { titleKey: 'data.intro.island_abcl3_0_t', bodyKey: 'data.intro.island_abcl3_0_b', emoji: '🌌' },
    { titleKey: 'data.intro.island_abcl3_1_t', bodyKey: 'data.intro.island_abcl3_1_b', emoji: '🦛' },
  ],
  tasks: RW56_LESSON_TASKS['island-abc-l3'],
},
        ],
      },
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
    { titleKey: 'data.intro.island_coll1_0_t', bodyKey: 'data.intro.island_coll1_0_b', emoji: '🎨' },
    { titleKey: 'data.intro.island_coll1_1_t', bodyKey: 'data.intro.island_coll1_1_b', emoji: '🌊' },
  ],
  tasks: RW56_LESSON_TASKS['island-col-l1'],
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
    { titleKey: 'data.intro.island_coll2_0_t', bodyKey: 'data.intro.island_coll2_0_b', emoji: '🍊' },
    { titleKey: 'data.intro.island_coll2_1_t', bodyKey: 'data.intro.island_coll2_1_b', emoji: '🟣' },
  ],
  tasks: RW56_LESSON_TASKS['island-col-l2'],
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
    { titleKey: 'data.intro.island_coll3_0_t', bodyKey: 'data.intro.island_coll3_0_b', emoji: '🐼' },
    { titleKey: 'data.intro.island_coll3_1_t', bodyKey: 'data.intro.island_coll3_1_b', emoji: '🌑' },
  ],
  tasks: RW56_LESSON_TASKS['island-col-l3'],
},
        ],
      },
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
    { titleKey: 'data.intro.island_animl1_1_t', bodyKey: 'data.intro.island_animl1_1_b', emoji: '🐶' },
  ],
  tasks: RW56_LESSON_TASKS['island-anim-l1'],
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
  tasks: RW56_LESSON_TASKS['island-anim-l2'],
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
    { titleKey: 'data.intro.island_animl3_0_t', bodyKey: 'data.intro.island_animl3_0_b', emoji: '🐘' },
    { titleKey: 'data.intro.island_animl3_1_t', bodyKey: 'data.intro.island_animl3_1_b', emoji: '🐧' },
  ],
  tasks: RW56_LESSON_TASKS['island-anim-l3'],
},
        ],
      },
    ],
  },
  {
    id: 'g1math', titleKey: 'data.worlds.g1math', descriptionKey: 'data.worldDesc.g1math',
    biome: 'town', accentColor: '#FF7043', npcEmoji: '', ageBand: '7',
    topics: [
      { id: 'g1m-cnt20', worldId: 'g1math', titleKey: 'data.topics.g1mCnt20', subject: 'math', lessons: [
        { id: 'g1m-c20-l1', topicId: 'g1m-cnt20', titleKey: 'data.lessons.g1mC20L1',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1m_c20l1_0' }, { speaker: 'tali', textKey: 'data.dialog.g1m_c20l1_1' }],
          intro: [{ titleKey: 'data.intro.g1m_c20l1_0_t', bodyKey: 'data.intro.g1m_c20l1_0_b', emoji: '' }, { titleKey: 'data.intro.g1m_c20l1_1_t', bodyKey: 'data.intro.g1m_c20l1_1_b', emoji: '' }],
          tasks: G1M_C20_L1_TASKS as LessonTask[], },
        { id: 'g1m-c20-l2', topicId: 'g1m-cnt20', titleKey: 'data.lessons.g1mC20L2',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1m_c20l2_0' }, { speaker: 'tali', textKey: 'data.dialog.g1m_c20l2_1' }],
          intro: [{ titleKey: 'data.intro.g1m_c20l2_0_t', bodyKey: 'data.intro.g1m_c20l2_0_b', emoji: '' }, { titleKey: 'data.intro.g1m_c20l2_1_t', bodyKey: 'data.intro.g1m_c20l2_1_b', emoji: '' }],
          tasks: G1M_C20_L2_TASKS as LessonTask[], },
        { id: 'g1m-c20-l3', topicId: 'g1m-cnt20', titleKey: 'data.lessons.g1mC20L3',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1m_c20l3_0' }, { speaker: 'tali', textKey: 'data.dialog.g1m_c20l3_1' }],
          intro: [{ titleKey: 'data.intro.g1m_c20l3_0_t', bodyKey: 'data.intro.g1m_c20l3_0_b', emoji: '' }, { titleKey: 'data.intro.g1m_c20l3_1_t', bodyKey: 'data.intro.g1m_c20l3_1_b', emoji: '' }],
          tasks: G1M_C20_L3_TASKS as LessonTask[], },
      ] },
      { id: 'g1m-add', worldId: 'g1math', titleKey: 'data.topics.g1mAdd', subject: 'math', lessons: [
        { id: 'g1m-add-l1', topicId: 'g1m-add', titleKey: 'data.lessons.g1mAddL1',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1m_addl1_0' }, { speaker: 'tali', textKey: 'data.dialog.g1m_addl1_1' }],
          intro: [{ titleKey: 'data.intro.g1m_addl1_0_t', bodyKey: 'data.intro.g1m_addl1_0_b', emoji: '' }, { titleKey: 'data.intro.g1m_addl1_1_t', bodyKey: 'data.intro.g1m_addl1_1_b', emoji: '' }],
          tasks: G1M_ADD_L1_TASKS as LessonTask[], },
        { id: 'g1m-add-l2', topicId: 'g1m-add', titleKey: 'data.lessons.g1mAddL2',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1m_addl2_0' }, { speaker: 'tali', textKey: 'data.dialog.g1m_addl2_1' }],
          intro: [{ titleKey: 'data.intro.g1m_addl2_0_t', bodyKey: 'data.intro.g1m_addl2_0_b', emoji: '' }, { titleKey: 'data.intro.g1m_addl2_1_t', bodyKey: 'data.intro.g1m_addl2_1_b', emoji: '' }],
          tasks: G1M_ADD_L2_TASKS as LessonTask[], },
        { id: 'g1m-add-l3', topicId: 'g1m-add', titleKey: 'data.lessons.g1mAddL3',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1m_addl3_0' }, { speaker: 'tali', textKey: 'data.dialog.g1m_addl3_1' }],
          intro: [{ titleKey: 'data.intro.g1m_addl3_0_t', bodyKey: 'data.intro.g1m_addl3_0_b', emoji: '' }, { titleKey: 'data.intro.g1m_addl3_1_t', bodyKey: 'data.intro.g1m_addl3_1_b', emoji: '' }],
          tasks: G1M_ADD_L3_TASKS as LessonTask[], },
      ] },
      { id: 'g1m-sub', worldId: 'g1math', titleKey: 'data.topics.g1mSub', subject: 'math', lessons: [
        { id: 'g1m-sub-l1', topicId: 'g1m-sub', titleKey: 'data.lessons.g1mSubL1',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1m_subl1_0' }, { speaker: 'tali', textKey: 'data.dialog.g1m_subl1_1' }],
          intro: [{ titleKey: 'data.intro.g1m_subl1_0_t', bodyKey: 'data.intro.g1m_subl1_0_b', emoji: '' }, { titleKey: 'data.intro.g1m_subl1_1_t', bodyKey: 'data.intro.g1m_subl1_1_b', emoji: '' }],
          tasks: G1M_SUB_L1_TASKS as LessonTask[], },
        { id: 'g1m-sub-l2', topicId: 'g1m-sub', titleKey: 'data.lessons.g1mSubL2',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1m_subl2_0' }, { speaker: 'tali', textKey: 'data.dialog.g1m_subl2_1' }],
          intro: [{ titleKey: 'data.intro.g1m_subl2_0_t', bodyKey: 'data.intro.g1m_subl2_0_b', emoji: '' }, { titleKey: 'data.intro.g1m_subl2_1_t', bodyKey: 'data.intro.g1m_subl2_1_b', emoji: '' }],
          tasks: G1M_SUB_L2_TASKS as LessonTask[], },
        { id: 'g1m-sub-l3', topicId: 'g1m-sub', titleKey: 'data.lessons.g1mSubL3',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1m_subl3_0' }, { speaker: 'tali', textKey: 'data.dialog.g1m_subl3_1' }],
          intro: [{ titleKey: 'data.intro.g1m_subl3_0_t', bodyKey: 'data.intro.g1m_subl3_0_b', emoji: '' }, { titleKey: 'data.intro.g1m_subl3_1_t', bodyKey: 'data.intro.g1m_subl3_1_b', emoji: '' }],
          tasks: G1M_SUB_L3_TASKS as LessonTask[], },
      ] },
    ],
  },
  {
    id: 'g1rus', titleKey: 'data.worlds.g1rus', descriptionKey: 'data.worldDesc.g1rus',
    biome: 'village', accentColor: '#FFC107', npcEmoji: '', ageBand: '7',
    topics: [
      { id: 'g1r-vowels', worldId: 'g1rus', titleKey: 'data.topics.g1rVowels', subject: 'reading_ru', lessons: [
        { id: 'g1r-vow-l1', topicId: 'g1r-vowels', titleKey: 'data.lessons.g1rVowL1',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1r_vowl1_0' }, { speaker: 'tali', textKey: 'data.dialog.g1r_vowl1_1' }],
          intro: [{ titleKey: 'data.intro.g1r_vowl1_0_t', bodyKey: 'data.intro.g1r_vowl1_0_b', emoji: '' }, { titleKey: 'data.intro.g1r_vowl1_1_t', bodyKey: 'data.intro.g1r_vowl1_1_b', emoji: '' }],
          tasks: G1R_VOW_L1_TASKS as LessonTask[], },
        { id: 'g1r-vow-l2', topicId: 'g1r-vowels', titleKey: 'data.lessons.g1rVowL2',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1r_vowl2_0' }, { speaker: 'tali', textKey: 'data.dialog.g1r_vowl2_1' }],
          intro: [{ titleKey: 'data.intro.g1r_vowl2_0_t', bodyKey: 'data.intro.g1r_vowl2_0_b', emoji: '' }, { titleKey: 'data.intro.g1r_vowl2_1_t', bodyKey: 'data.intro.g1r_vowl2_1_b', emoji: '' }],
          tasks: G1R_VOW_L2_TASKS as LessonTask[], },
        { id: 'g1r-vow-l3', topicId: 'g1r-vowels', titleKey: 'data.lessons.g1rVowL3',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1r_vowl3_0' }, { speaker: 'tali', textKey: 'data.dialog.g1r_vowl3_1' }],
          intro: [{ titleKey: 'data.intro.g1r_vowl3_0_t', bodyKey: 'data.intro.g1r_vowl3_0_b', emoji: '' }, { titleKey: 'data.intro.g1r_vowl3_1_t', bodyKey: 'data.intro.g1r_vowl3_1_b', emoji: '' }],
          tasks: G1R_VOW_L3_TASKS as LessonTask[], },
      ] },
      { id: 'g1r-words', worldId: 'g1rus', titleKey: 'data.topics.g1rWords', subject: 'reading_ru', lessons: [
        { id: 'g1r-wrd-l1', topicId: 'g1r-words', titleKey: 'data.lessons.g1rWrdL1',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1r_wrdl1_0' }, { speaker: 'tali', textKey: 'data.dialog.g1r_wrdl1_1' }],
          intro: [{ titleKey: 'data.intro.g1r_wrdl1_0_t', bodyKey: 'data.intro.g1r_wrdl1_0_b', emoji: '' }, { titleKey: 'data.intro.g1r_wrdl1_1_t', bodyKey: 'data.intro.g1r_wrdl1_1_b', emoji: '' }],
          tasks: G1R_WRD_L1_TASKS as LessonTask[], },
        { id: 'g1r-wrd-l2', topicId: 'g1r-words', titleKey: 'data.lessons.g1rWrdL2',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1r_wrdl2_0' }, { speaker: 'tali', textKey: 'data.dialog.g1r_wrdl2_1' }],
          intro: [{ titleKey: 'data.intro.g1r_wrdl2_0_t', bodyKey: 'data.intro.g1r_wrdl2_0_b', emoji: '' }, { titleKey: 'data.intro.g1r_wrdl2_1_t', bodyKey: 'data.intro.g1r_wrdl2_1_b', emoji: '' }],
          tasks: G1R_WRD_L2_TASKS as LessonTask[], },
        { id: 'g1r-wrd-l3', topicId: 'g1r-words', titleKey: 'data.lessons.g1rWrdL3',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1r_wrdl3_0' }, { speaker: 'tali', textKey: 'data.dialog.g1r_wrdl3_1' }],
          intro: [{ titleKey: 'data.intro.g1r_wrdl3_0_t', bodyKey: 'data.intro.g1r_wrdl3_0_b', emoji: '' }, { titleKey: 'data.intro.g1r_wrdl3_1_t', bodyKey: 'data.intro.g1r_wrdl3_1_b', emoji: '' }],
          tasks: G1R_WRD_L3_TASKS as LessonTask[], },
      ] },
      { id: 'g1r-gram', worldId: 'g1rus', titleKey: 'data.topics.g1rGram', subject: 'reading_ru', lessons: [
        { id: 'g1r-grm-l1', topicId: 'g1r-gram', titleKey: 'data.lessons.g1rGrmL1',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1r_grml1_0' }, { speaker: 'tali', textKey: 'data.dialog.g1r_grml1_1' }],
          intro: [{ titleKey: 'data.intro.g1r_grml1_0_t', bodyKey: 'data.intro.g1r_grml1_0_b', emoji: '' }, { titleKey: 'data.intro.g1r_grml1_1_t', bodyKey: 'data.intro.g1r_grml1_1_b', emoji: '' }],
          tasks: G1R_GRM_L1_TASKS as LessonTask[], },
        { id: 'g1r-grm-l2', topicId: 'g1r-gram', titleKey: 'data.lessons.g1rGrmL2',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1r_grml2_0' }, { speaker: 'tali', textKey: 'data.dialog.g1r_grml2_1' }],
          intro: [{ titleKey: 'data.intro.g1r_grml2_0_t', bodyKey: 'data.intro.g1r_grml2_0_b', emoji: '' }, { titleKey: 'data.intro.g1r_grml2_1_t', bodyKey: 'data.intro.g1r_grml2_1_b', emoji: '' }],
          tasks: G1R_GRM_L2_TASKS as LessonTask[], },
        { id: 'g1r-grm-l3', topicId: 'g1r-gram', titleKey: 'data.lessons.g1rGrmL3',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1r_grml3_0' }, { speaker: 'tali', textKey: 'data.dialog.g1r_grml3_1' }],
          intro: [{ titleKey: 'data.intro.g1r_grml3_0_t', bodyKey: 'data.intro.g1r_grml3_0_b', emoji: '' }, { titleKey: 'data.intro.g1r_grml3_1_t', bodyKey: 'data.intro.g1r_grml3_1_b', emoji: '' }],
          tasks: G1R_GRM_L3_TASKS as LessonTask[], },
      ] },
    ],
  },
  {
    id: 'g1world', titleKey: 'data.worlds.g1world', descriptionKey: 'data.worldDesc.g1world',
    biome: 'park', accentColor: '#8BC34A', npcEmoji: '', ageBand: '7',
    topics: [
      { id: 'g1w-school', worldId: 'g1world', titleKey: 'data.topics.g1wSchool', subject: 'logic', lessons: [
        { id: 'g1w-sch-l1', topicId: 'g1w-school', titleKey: 'data.lessons.g1wSchL1',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1w_schl1_0' }, { speaker: 'tali', textKey: 'data.dialog.g1w_schl1_1' }],
          intro: [{ titleKey: 'data.intro.g1w_schl1_0_t', bodyKey: 'data.intro.g1w_schl1_0_b', emoji: '' }, { titleKey: 'data.intro.g1w_schl1_1_t', bodyKey: 'data.intro.g1w_schl1_1_b', emoji: '' }],
          tasks: G1W_SCH_L1_TASKS as LessonTask[], },
        { id: 'g1w-sch-l2', topicId: 'g1w-school', titleKey: 'data.lessons.g1wSchL2',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1w_schl2_0' }, { speaker: 'tali', textKey: 'data.dialog.g1w_schl2_1' }],
          intro: [{ titleKey: 'data.intro.g1w_schl2_0_t', bodyKey: 'data.intro.g1w_schl2_0_b', emoji: '' }, { titleKey: 'data.intro.g1w_schl2_1_t', bodyKey: 'data.intro.g1w_schl2_1_b', emoji: '' }],
          tasks: G1W_SCH_L2_TASKS as LessonTask[], },
        { id: 'g1w-sch-l3', topicId: 'g1w-school', titleKey: 'data.lessons.g1wSchL3',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1w_schl3_0' }, { speaker: 'tali', textKey: 'data.dialog.g1w_schl3_1' }],
          intro: [{ titleKey: 'data.intro.g1w_schl3_0_t', bodyKey: 'data.intro.g1w_schl3_0_b', emoji: '' }, { titleKey: 'data.intro.g1w_schl3_1_t', bodyKey: 'data.intro.g1w_schl3_1_b', emoji: '' }],
          tasks: G1W_SCH_L3_TASKS, },
      ] },
      { id: 'g1w-nature', worldId: 'g1world', titleKey: 'data.topics.g1wNature', subject: 'logic', lessons: [
        { id: 'g1w-nat-l1', topicId: 'g1w-nature', titleKey: 'data.lessons.g1wNatL1',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1w_natl1_0' }, { speaker: 'tali', textKey: 'data.dialog.g1w_natl1_1' }],
          intro: [{ titleKey: 'data.intro.g1w_natl1_0_t', bodyKey: 'data.intro.g1w_natl1_0_b', emoji: '' }, { titleKey: 'data.intro.g1w_natl1_1_t', bodyKey: 'data.intro.g1w_natl1_1_b', emoji: '' }],
          tasks: G1W_NAT_L1_TASKS, },
        { id: 'g1w-nat-l2', topicId: 'g1w-nature', titleKey: 'data.lessons.g1wNatL2',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1w_natl2_0' }, { speaker: 'tali', textKey: 'data.dialog.g1w_natl2_1' }],
          intro: [{ titleKey: 'data.intro.g1w_natl2_0_t', bodyKey: 'data.intro.g1w_natl2_0_b', emoji: '' }, { titleKey: 'data.intro.g1w_natl2_1_t', bodyKey: 'data.intro.g1w_natl2_1_b', emoji: '' }],
          tasks: RW56_LESSON_TASKS['garden-anim-l2'], },
        { id: 'g1w-nat-l3', topicId: 'g1w-nature', titleKey: 'data.lessons.g1wNatL3',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1w_natl3_0' }, { speaker: 'tali', textKey: 'data.dialog.g1w_natl3_1' }],
          intro: [{ titleKey: 'data.intro.g1w_natl3_0_t', bodyKey: 'data.intro.g1w_natl3_0_b', emoji: '' }, { titleKey: 'data.intro.g1w_natl3_1_t', bodyKey: 'data.intro.g1w_natl3_1_b', emoji: '' }],
          tasks: G1W_NAT_L3_TASKS, },
      ] },
      { id: 'g1w-body', worldId: 'g1world', titleKey: 'data.topics.g1wBody', subject: 'logic', lessons: [
        { id: 'g1w-bdy-l1', topicId: 'g1w-body', titleKey: 'data.lessons.g1wBdyL1',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1w_bdyl1_0' }, { speaker: 'tali', textKey: 'data.dialog.g1w_bdyl1_1' }],
          intro: [{ titleKey: 'data.intro.g1w_bdyl1_0_t', bodyKey: 'data.intro.g1w_bdyl1_0_b', emoji: '' }, { titleKey: 'data.intro.g1w_bdyl1_1_t', bodyKey: 'data.intro.g1w_bdyl1_1_b', emoji: '' }],
          tasks: G1W_BDY_L1_TASKS, },
        { id: 'g1w-bdy-l2', topicId: 'g1w-body', titleKey: 'data.lessons.g1wBdyL2',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1w_bdyl2_0' }, { speaker: 'tali', textKey: 'data.dialog.g1w_bdyl2_1' }],
          intro: [{ titleKey: 'data.intro.g1w_bdyl2_0_t', bodyKey: 'data.intro.g1w_bdyl2_0_b', emoji: '' }, { titleKey: 'data.intro.g1w_bdyl2_1_t', bodyKey: 'data.intro.g1w_bdyl2_1_b', emoji: '' }],
          tasks: G1W_BDY_L2_TASKS, },
        { id: 'g1w-bdy-l3', topicId: 'g1w-body', titleKey: 'data.lessons.g1wBdyL3',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1w_bdyl3_0' }, { speaker: 'tali', textKey: 'data.dialog.g1w_bdyl3_1' }],
          intro: [{ titleKey: 'data.intro.g1w_bdyl3_0_t', bodyKey: 'data.intro.g1w_bdyl3_0_b', emoji: '' }, { titleKey: 'data.intro.g1w_bdyl3_1_t', bodyKey: 'data.intro.g1w_bdyl3_1_b', emoji: '' }],
          tasks: G1W_BDY_L3_TASKS, },
      ] },
    ],
  },
  {
    id: 'g1eng', titleKey: 'data.worlds.g1eng', descriptionKey: 'data.worldDesc.g1eng',
    biome: 'harbor', accentColor: '#29B6F6', npcEmoji: '', ageBand: '7',
    topics: [
      { id: 'g1e-abc', worldId: 'g1eng', titleKey: 'data.topics.g1eAbc', subject: 'reading', lessons: [
        { id: 'g1e-abc-l1', topicId: 'g1e-abc', titleKey: 'data.lessons.g1eAbcL1',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1e_abcl1_0' }, { speaker: 'tali', textKey: 'data.dialog.g1e_abcl1_1' }],
          intro: [{ titleKey: 'data.intro.g1e_abcl1_0_t', bodyKey: 'data.intro.g1e_abcl1_0_b', emoji: '' }, { titleKey: 'data.intro.g1e_abcl1_1_t', bodyKey: 'data.intro.g1e_abcl1_1_b', emoji: '' }],
          tasks: [
            { id: 'g1eabcl1t1', type: 'multiple_choice', questionKey: 'data.tasks.g1e_G_for', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_G', correct: true }, { id: 'b', textKey: 'data.tasks.g1e_opt_H', correct: false }, { id: 'c', textKey: 'data.tasks.g1e_opt_I', correct: false }] },
            { id: 'g1eabcl1t2', type: 'multiple_choice', questionKey: 'data.tasks.g1e_happy_starts', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_G', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_H', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_I', correct: false }] },
            { id: 'g1eabcl1t3', type: 'fill_blank', questionKey: 'data.tasks.g1e_abcl1_fb_sent', difficulty: 1, sentenceKey: 'data.tasks.g1e_abcl1_fb_sent', options: [{ id: 'fb-a', textKey: 'data.tasks.g1e_opt_H', correct: false }, { id: 'fb-b', textKey: 'data.tasks.g1e_opt_I', correct: true }, { id: 'fb-c', textKey: 'data.tasks.g1e_opt_J', correct: false }] },
            { id: 'g1eabcl1t4', type: 'input', questionKey: 'data.tasks.g1e_J_for', difficulty: 2, answer: "J" },
          ] },
        { id: 'g1e-abc-l2', topicId: 'g1e-abc', titleKey: 'data.lessons.g1eAbcL2',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1e_abcl2_0' }, { speaker: 'tali', textKey: 'data.dialog.g1e_abcl2_1' }],
          intro: [{ titleKey: 'data.intro.g1e_abcl2_0_t', bodyKey: 'data.intro.g1e_abcl2_0_b', emoji: '' }, { titleKey: 'data.intro.g1e_abcl2_1_t', bodyKey: 'data.intro.g1e_abcl2_1_b', emoji: '' }],
          tasks: [
            { id: 'g1eabcl2t1', type: 'multiple_choice', questionKey: 'data.tasks.g1e_K_for', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_K', correct: true }, { id: 'b', textKey: 'data.tasks.g1e_opt_L', correct: false }, { id: 'c', textKey: 'data.tasks.g1e_opt_M', correct: false }] },
            { id: 'g1eabcl2t2', type: 'multiple_choice', questionKey: 'data.tasks.g1e_starts_with_L', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_K', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_L', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_N', correct: false }] },
            { id: 'g1eabcl2t3', type: 'multiple_choice', questionKey: 'data.tasks.g1e_M_for', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_K', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_M', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_N', correct: false }] },
            { id: 'g1eabcl2t4', type: 'input', questionKey: 'data.tasks.g1e_N_for', difficulty: 2, answer: "N" },
          ] },
        { id: 'g1e-abc-l3', topicId: 'g1e-abc', titleKey: 'data.lessons.g1eAbcL3',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1e_abcl3_0' }, { speaker: 'tali', textKey: 'data.dialog.g1e_abcl3_1' }],
          intro: [{ titleKey: 'data.intro.g1e_abcl3_0_t', bodyKey: 'data.intro.g1e_abcl3_0_b', emoji: '' }, { titleKey: 'data.intro.g1e_abcl3_1_t', bodyKey: 'data.intro.g1e_abcl3_1_b', emoji: '' }],
          tasks: [
            { id: 'g1eabcl3t1', type: 'multiple_choice', questionKey: 'data.tasks.g1e_O_for', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_O', correct: true }, { id: 'b', textKey: 'data.tasks.g1e_opt_P', correct: false }, { id: 'c', textKey: 'data.tasks.g1e_opt_Q', correct: false }] },
            { id: 'g1eabcl3t2', type: 'multiple_choice', questionKey: 'data.tasks.g1e_P_for', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_O', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_P', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_Q', correct: false }] },
            { id: 'g1eabcl3t3', type: 'multiple_choice', questionKey: 'data.tasks.g1e_starts_with_Q', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_O', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_Q', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_R', correct: false }] },
            { id: 'g1eabcl3t4', type: 'input', questionKey: 'data.tasks.g1e_R_for', difficulty: 2, answer: "R" },
          ] },
      ] },
      { id: 'g1e-nums', worldId: 'g1eng', titleKey: 'data.topics.g1eNums', subject: 'reading', lessons: [
        { id: 'g1e-num-l1', topicId: 'g1e-nums', titleKey: 'data.lessons.g1eNumL1',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1e_numl1_0' }, { speaker: 'tali', textKey: 'data.dialog.g1e_numl1_1' }],
          intro: [{ titleKey: 'data.intro.g1e_numl1_0_t', bodyKey: 'data.intro.g1e_numl1_0_b', emoji: '' }, { titleKey: 'data.intro.g1e_numl1_1_t', bodyKey: 'data.intro.g1e_numl1_1_b', emoji: '' }],
          tasks: [
            { id: 'g1enuml1t1', type: 'multiple_choice', questionKey: 'data.tasks.g1e_three_cats', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_two', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_three', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_four', correct: false }] },
            { id: 'g1enuml1t2', type: 'multiple_choice', questionKey: 'data.tasks.g1e_two_in_num', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_one', correct: false }, { id: 'b', textKey: 'data.tasks.opt_two', correct: true }, { id: 'c', textKey: 'data.tasks.opt_three', correct: false }] },
            { id: 'g1enuml1t3', type: 'multiple_choice', questionKey: 'data.tasks.g1e_four_plus_one', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_four', correct: true }, { id: 'b', textKey: 'data.tasks.g1e_opt_five', correct: false }, { id: 'c', textKey: 'data.tasks.g1e_opt_six', correct: false }] },
            { id: 'g1enuml1t4', type: 'input', questionKey: 'data.tasks.g1e_pyat_en', difficulty: 2, answer: "five" },
          ] },
        { id: 'g1e-num-l2', topicId: 'g1e-nums', titleKey: 'data.lessons.g1eNumL2',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1e_numl2_0' }, { speaker: 'tali', textKey: 'data.dialog.g1e_numl2_1' }],
          intro: [{ titleKey: 'data.intro.g1e_numl2_0_t', bodyKey: 'data.intro.g1e_numl2_0_b', emoji: '' }, { titleKey: 'data.intro.g1e_numl2_1_t', bodyKey: 'data.intro.g1e_numl2_1_b', emoji: '' }],
          tasks: [
            { id: 'g1enuml2t1', type: 'multiple_choice', questionKey: 'data.tasks.g1e_7_in_en', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_six', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_seven', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_eight', correct: false }] },
            { id: 'g1enuml2t2', type: 'multiple_choice', questionKey: 'data.tasks.g1e_nine_in_num', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_seven', correct: false }, { id: 'b', textKey: 'data.tasks.opt_eight', correct: false }, { id: 'c', textKey: 'data.tasks.opt_nine', correct: true }] },
            { id: 'g1enuml2t3', type: 'multiple_choice', questionKey: 'data.tasks.g1e_10_in_en', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_nine', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_ten', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_eleven', correct: false }] },
            { id: 'g1enuml2t4', type: 'input', questionKey: 'data.tasks.g1e_vosem_en', difficulty: 2, answer: "eight" },
          ] },
        { id: 'g1e-num-l3', topicId: 'g1e-nums', titleKey: 'data.lessons.g1eNumL3',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1e_numl3_0' }, { speaker: 'tali', textKey: 'data.dialog.g1e_numl3_1' }],
          intro: [{ titleKey: 'data.intro.g1e_numl3_0_t', bodyKey: 'data.intro.g1e_numl3_0_b', emoji: '' }, { titleKey: 'data.intro.g1e_numl3_1_t', bodyKey: 'data.intro.g1e_numl3_1_b', emoji: '' }],
          tasks: [
            { id: 'g1enuml3t1', type: 'multiple_choice', questionKey: 'data.tasks.g1e_six_minus_three', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_two', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_three', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_four', correct: false }] },
            { id: 'g1enuml3t2', type: 'multiple_choice', questionKey: 'data.tasks.g1e_three_plus_four', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_six', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_seven', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_eight', correct: false }] },
            { id: 'g1enuml3t3', type: 'multiple_choice', questionKey: 'data.tasks.g1e_after_nine', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_nine', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_ten', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_eleven', correct: false }] },
            { id: 'g1enuml3t4', type: 'input', questionKey: 'data.tasks.g1e_how_many_8stars', difficulty: 1, visualCount: 8, visualEmoji: '⭐', answer: "eight" },
          ] },
      ] },
      { id: 'g1e-greet', worldId: 'g1eng', titleKey: 'data.topics.g1eGreet', subject: 'reading', lessons: [
        { id: 'g1e-grt-l1', topicId: 'g1e-greet', titleKey: 'data.lessons.g1eGrtL1',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1e_grtl1_0' }, { speaker: 'tali', textKey: 'data.dialog.g1e_grtl1_1' }],
          intro: [{ titleKey: 'data.intro.g1e_grtl1_0_t', bodyKey: 'data.intro.g1e_grtl1_0_b', emoji: '' }, { titleKey: 'data.intro.g1e_grtl1_1_t', bodyKey: 'data.intro.g1e_grtl1_1_b', emoji: '' }],
          tasks: [
            { id: 'g1egrtl1t1', type: 'multiple_choice', questionKey: 'data.tasks.g1e_morning_greeting', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_good_morning', correct: true }, { id: 'b', textKey: 'data.tasks.g1e_opt_good_night', correct: false }, { id: 'c', textKey: 'data.tasks.g1e_opt_goodbye', correct: false }] },
            { id: 'g1egrtl1t2', type: 'multiple_choice', questionKey: 'data.tasks.g1e_when_leaving', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_hello', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_goodbye', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_sorry', correct: false }] },
            { id: 'g1egrtl1t3', type: 'multiple_choice', questionKey: 'data.tasks.g1e_good_night_for', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_morning_time', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_noon_time', correct: false }, { id: 'c', textKey: 'data.tasks.g1e_opt_night_time', correct: true }] },
            { id: 'g1egrtl1t4', type: 'input', questionKey: 'data.tasks.g1e_hi_means', difficulty: 1, answer: "Привет" },
          ] },
        { id: 'g1e-grt-l2', topicId: 'g1e-greet', titleKey: 'data.lessons.g1eGrtL2',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1e_grtl2_0' }, { speaker: 'tali', textKey: 'data.dialog.g1e_grtl2_1' }],
          intro: [{ titleKey: 'data.intro.g1e_grtl2_0_t', bodyKey: 'data.intro.g1e_grtl2_0_b', emoji: '' }, { titleKey: 'data.intro.g1e_grtl2_1_t', bodyKey: 'data.intro.g1e_grtl2_1_b', emoji: '' }],
          tasks: [
            { id: 'g1egrtl2t1', type: 'multiple_choice', questionKey: 'data.tasks.g1e_my_name_blank', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_am', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_is', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_are', correct: false }] },
            { id: 'g1egrtl2t2', type: 'multiple_choice', questionKey: 'data.tasks.g1e_menya_zovut', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_i_am', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_my_name_is', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_hello_i', correct: false }] },
            { id: 'g1egrtl2t3', type: 'multiple_choice', questionKey: 'data.tasks.g1e_what_is_your_name', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_how_old_are_you_en', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_what_is_your_name_en', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_goodbye', correct: false }] },
            { id: 'g1egrtl2t4', type: 'input', questionKey: 'data.tasks.g1e_i_blank_seven', difficulty: 2, answer: "am" },
          ] },
        { id: 'g1e-grt-l3', topicId: 'g1e-greet', titleKey: 'data.lessons.g1eGrtL3',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g1e_grtl3_0' }, { speaker: 'tali', textKey: 'data.dialog.g1e_grtl3_1' }],
          intro: [{ titleKey: 'data.intro.g1e_grtl3_0_t', bodyKey: 'data.intro.g1e_grtl3_0_b', emoji: '' }, { titleKey: 'data.intro.g1e_grtl3_1_t', bodyKey: 'data.intro.g1e_grtl3_1_b', emoji: '' }],
          tasks: [
            { id: 'g1egrtl3t1', type: 'multiple_choice', questionKey: 'data.tasks.g1e_how_are_you_means', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_kak_dela', correct: true }, { id: 'b', textKey: 'data.tasks.g1e_opt_poka', correct: false }, { id: 'c', textKey: 'data.tasks.g1e_opt_privet', correct: false }] },
            { id: 'g1egrtl3t2', type: 'multiple_choice', questionKey: 'data.tasks.g1e_best_reply_how', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_fine_thanks', correct: true }, { id: 'b', textKey: 'data.tasks.g1e_opt_goodbye', correct: false }, { id: 'c', textKey: 'data.tasks.g1e_opt_my_name_is', correct: false }] },
            { id: 'g1egrtl3t3', type: 'multiple_choice', questionKey: 'data.tasks.g1e_thank_you_means', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_pozhaluista', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_spasibo', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_privet', correct: false }] },
            { id: 'g1egrtl3t4', type: 'input', questionKey: 'data.tasks.g1e_please_means', difficulty: 2, answer: "Пожалуйста" },
          ] },
      ] },
    ],
  },


  // ---
  {
    id: 'g2math', titleKey: 'data.worlds.g2math', descriptionKey: 'data.worldDesc.g2math',
    biome: 'mountain', accentColor: '#2196F3', npcEmoji: '', ageBand: '8',
    topics: [
      { id: 'g2m-100', worldId: 'g2math', titleKey: 'data.topics.g2m100', subject: 'math', lessons: [
        { id: 'g2m-100-l1', topicId: 'g2m-100', titleKey: 'data.lessons.g2m100L1',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g2m_100l1_0' }, { speaker: 'tali', textKey: 'data.dialog.g2m_100l1_1' }],
          intro: [{ titleKey: 'data.intro.g2m_100l1_0_t', bodyKey: 'data.intro.g2m_100l1_0_b', emoji: '' }, { titleKey: 'data.intro.g2m_100l1_1_t', bodyKey: 'data.intro.g2m_100l1_1_b', emoji: '' }],
          tasks: [
            { id: 'g2m100l1t1', type: 'multiple_choice', questionKey: 'data.tasks.g2m_10x3', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2m_100l1_q1_a', correct: false }, { id: 'b', textKey: 'data.tasks.opt_30', correct: true }, { id: 'c', textKey: 'data.tasks.g2m_100l1_q1_c', correct: false }] },
            { id: 'g2m100l1t2', type: 'multiple_choice', questionKey: 'data.tasks.g2m_10x7', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_60', correct: false }, { id: 'b', textKey: 'data.tasks.opt_70', correct: true }, { id: 'c', textKey: 'data.tasks.opt_80', correct: false }] },
            { id: 'g2m100l1t3', type: 'input', questionKey: 'data.tasks.g2m_10x5', difficulty: 1, answer: '50' },
            { id: 'g2m100l1t4', type: 'multiple_choice', questionKey: 'data.tasks.g2m_how_many_tens_in_100', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_five', correct: false }, { id: 'b', textKey: 'data.tasks.opt_ten', correct: true }, { id: 'c', textKey: 'data.tasks.opt_20', correct: false }] },
          ] },
        { id: 'g2m-100-l2', topicId: 'g2m-100', titleKey: 'data.lessons.g2m100L2',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g2m_100l2_0' }, { speaker: 'tali', textKey: 'data.dialog.g2m_100l2_1' }],
          intro: [{ titleKey: 'data.intro.g2m_100l2_0_t', bodyKey: 'data.intro.g2m_100l2_0_b', emoji: '' }, { titleKey: 'data.intro.g2m_100l2_1_t', bodyKey: 'data.intro.g2m_100l2_1_b', emoji: '' }],
          tasks: [
            { id: 'g2m100l2t1', type: 'input', questionKey: 'data.tasks.g2m_compose_3t_6u', difficulty: 1, answer: '36' },
            { id: 'g2m100l2t2', type: 'multiple_choice', questionKey: 'data.tasks.g2m_biggest_37_42_29', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_37', correct: false }, { id: 'b', textKey: 'data.tasks.opt_42', correct: true }, { id: 'c', textKey: 'data.tasks.opt_29', correct: false }] },
            { id: 'g2m100l2t3', type: 'input', questionKey: 'data.tasks.g2m_tens_in_48', difficulty: 2, answer: '4' },
            { id: 'g2m100l2t4', type: 'input', questionKey: 'data.tasks.g2m_units_in_37', difficulty: 2, answer: '7' },
          ] },
        { id: 'g2m-100-l3', topicId: 'g2m-100', titleKey: 'data.lessons.g2m100L3',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g2m_100l3_0' }, { speaker: 'tali', textKey: 'data.dialog.g2m_100l3_1' }],
          intro: [{ titleKey: 'data.intro.g2m_100l3_0_t', bodyKey: 'data.intro.g2m_100l3_0_b', emoji: '' }, { titleKey: 'data.intro.g2m_100l3_1_t', bodyKey: 'data.intro.g2m_100l3_1_b', emoji: '' }],
          tasks: [
            { id: 'g2m100l3t1', type: 'input', questionKey: 'data.tasks.g2m_before_100', difficulty: 1, answer: '99' },
            { id: 'g2m100l3t2', type: 'multiple_choice', questionKey: 'data.tasks.g2m_smallest_78_82_91', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2m_100l3_q2_a', correct: false }, { id: 'b', textKey: 'data.tasks.g2m_100l3_q2_b', correct: true }, { id: 'c', textKey: 'data.tasks.g2m_100l3_q2_c', correct: false }] },
            { id: 'g2m100l3t3', type: 'input', questionKey: 'data.tasks.g2m_tens_in_90', difficulty: 1, answer: '9' },
            { id: 'g2m100l3t4', type: 'input', questionKey: 'data.tasks.g2m_num_5tens_6units', difficulty: 2, answer: '56' },
          ] },
      ] },
      { id: 'g2m-add2', worldId: 'g2math', titleKey: 'data.topics.g2mAdd2', subject: 'math', lessons: [
        { id: 'g2m-add2-l1', topicId: 'g2m-add2', titleKey: 'data.lessons.g2mAdd2L1',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g2m_add2l1_0' }, { speaker: 'tali', textKey: 'data.dialog.g2m_add2l1_1' }],
          intro: [{ titleKey: 'data.intro.g2m_add2l1_0_t', bodyKey: 'data.intro.g2m_add2l1_0_b', emoji: '' }, { titleKey: 'data.intro.g2m_add2l1_1_t', bodyKey: 'data.intro.g2m_add2l1_1_b', emoji: '' }],
          tasks: [
            { id: 'g2madd2l1t1', type: 'input', questionKey: 'data.tasks.g2m_20plus30', difficulty: 1, answer: '50' },
            { id: 'g2madd2l1t2', type: 'input', questionKey: 'data.tasks.g2m_40plus50', difficulty: 1, answer: '90' },
            { id: 'g2madd2l1t3', type: 'multiple_choice', questionKey: 'data.tasks.g2m_30plus_eq100', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_60', correct: false }, { id: 'b', textKey: 'data.tasks.opt_70', correct: true }, { id: 'c', textKey: 'data.tasks.opt_80', correct: false }] },
            { id: 'g2madd2l1t4', type: 'input', questionKey: 'data.tasks.g2m_60plus40', difficulty: 1, answer: '100' },
          ] },
        { id: 'g2m-add2-l2', topicId: 'g2m-add2', titleKey: 'data.lessons.g2mAdd2L2',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g2m_add2l2_0' }, { speaker: 'tali', textKey: 'data.dialog.g2m_add2l2_1' }],
          intro: [{ titleKey: 'data.intro.g2m_add2l2_0_t', bodyKey: 'data.intro.g2m_add2l2_0_b', emoji: '' }, { titleKey: 'data.intro.g2m_add2l2_1_t', bodyKey: 'data.intro.g2m_add2l2_1_b', emoji: '' }],
          tasks: [
            { id: 'g2madd2l2t1', type: 'multiple_choice', questionKey: 'data.tasks.g2m_28plus5', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2m_opt_33', correct: true }, { id: 'b', textKey: 'data.tasks.g2m_opt_213', correct: false }, { id: 'c', textKey: 'data.tasks.g2m_opt_35', correct: false }] },
            { id: 'g2madd2l2t2', type: 'input', questionKey: 'data.tasks.g2m_36plus7', difficulty: 1, answer: '43' },
            { id: 'g2madd2l2t3', type: 'multiple_choice', questionKey: 'data.tasks.g2m_19plus4_step', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2m_opt_19plus1', correct: true }, { id: 'b', textKey: 'data.tasks.g2m_opt_19plus4_all', correct: false }, { id: 'c', textKey: 'data.tasks.g2m_opt_19plus9', correct: false }] },
            { id: 'g2madd2l2t4', type: 'input', questionKey: 'data.tasks.g2m_47plus8', difficulty: 2, answer: '55' },
          ] },
        { id: 'g2m-add2-l3', topicId: 'g2m-add2', titleKey: 'data.lessons.g2mAdd2L3',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g2m_add2l3_0' }, { speaker: 'tali', textKey: 'data.dialog.g2m_add2l3_1' }],
          intro: [{ titleKey: 'data.intro.g2m_add2l3_0_t', bodyKey: 'data.intro.g2m_add2l3_0_b', emoji: '' }, { titleKey: 'data.intro.g2m_add2l3_1_t', bodyKey: 'data.intro.g2m_add2l3_1_b', emoji: '' }],
          tasks: [
            { id: 'g2madd2l3t1', type: 'input', questionKey: 'data.tasks.g2m_sub_65minus23', difficulty: 1, answer: '42' },
            { id: 'g2madd2l3t2', type: 'input', questionKey: 'data.tasks.g2m_sub_80minus47', difficulty: 2, answer: '33' },
            { id: 'g2madd2l3t3', type: 'multiple_choice', questionKey: 'data.tasks.g2m_word_apples_30_give_13', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_17', correct: true }, { id: 'b', textKey: 'data.tasks.opt_18', correct: false }, { id: 'c', textKey: 'data.tasks.g2m_add2l3_q3_c', correct: false }] },
            { id: 'g2madd2l3t4', type: 'input', questionKey: 'data.tasks.g2m_word_45plus27', difficulty: 2, answer: '53' },
          ] },
      ] },
      { id: 'g2m-times', worldId: 'g2math', titleKey: 'data.topics.g2mTimes', subject: 'math', lessons: [
        { id: 'g2m-times-l1', topicId: 'g2m-times', titleKey: 'data.lessons.g2mTimesL1',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g2m_timesl1_0' }, { speaker: 'tali', textKey: 'data.dialog.g2m_timesl1_1' }],
          intro: [{ titleKey: 'data.intro.g2m_timesl1_0_t', bodyKey: 'data.intro.g2m_timesl1_0_b', emoji: '' }, { titleKey: 'data.intro.g2m_timesl1_1_t', bodyKey: 'data.intro.g2m_timesl1_1_b', emoji: '' }],
          tasks: [
            { id: 'g2mtimesl1t1', type: 'input', questionKey: 'data.tasks.g2m_2x4', difficulty: 1, answer: '8' },
            { id: 'g2mtimesl1t2', type: 'input', questionKey: 'data.tasks.g2m_2x7', difficulty: 1, answer: '14' },
            { id: 'g2mtimesl1t3', type: 'input', questionKey: 'data.tasks.g2m_2x9', difficulty: 2, answer: '18' },
            { id: 'g2mtimesl1t4', type: 'multiple_choice', questionKey: 'data.tasks.g2m_2x6_check', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2m_timesl1_q4_a', correct: false }, { id: 'b', textKey: 'data.tasks.g2m_timesl1_q4_b', correct: true }, { id: 'c', textKey: 'data.tasks.g2m_timesl1_q4_c', correct: false }] },
          ] },
        { id: 'g2m-times-l2', topicId: 'g2m-times', titleKey: 'data.lessons.g2mTimesL2',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g2m_timesl2_0' }, { speaker: 'tali', textKey: 'data.dialog.g2m_timesl2_1' }],
          intro: [{ titleKey: 'data.intro.g2m_timesl2_0_t', bodyKey: 'data.intro.g2m_timesl2_0_b', emoji: '' }, { titleKey: 'data.intro.g2m_timesl2_1_t', bodyKey: 'data.intro.g2m_timesl2_1_b', emoji: '' }],
          tasks: [
            { id: 'g2mtimesl2t1', type: 'input', questionKey: 'data.tasks.g2m_5x3', difficulty: 1, answer: '15' },
            { id: 'g2mtimesl2t2', type: 'input', questionKey: 'data.tasks.g2m_5x6', difficulty: 1, answer: '30' },
            { id: 'g2mtimesl2t3', type: 'input', questionKey: 'data.tasks.g2m_5x8', difficulty: 2, answer: '40' },
            { id: 'g2mtimesl2t4', type: 'multiple_choice', questionKey: 'data.tasks.g2m_5x9_check', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2m_timesl2_q4_a', correct: false }, { id: 'b', textKey: 'data.tasks.g2m_timesl2_q4_b', correct: true }, { id: 'c', textKey: 'data.tasks.g2m_timesl2_q4_c', correct: false }] },
          ] },
        { id: 'g2m-times-l3', topicId: 'g2m-times', titleKey: 'data.lessons.g2mTimesL3',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g2m_timesl3_0' }, { speaker: 'tali', textKey: 'data.dialog.g2m_timesl3_1' }],
          intro: [{ titleKey: 'data.intro.g2m_timesl3_0_t', bodyKey: 'data.intro.g2m_timesl3_0_b', emoji: '' }, { titleKey: 'data.intro.g2m_timesl3_1_t', bodyKey: 'data.intro.g2m_timesl3_1_b', emoji: '' }],
          tasks: [
            { id: 'g2mtimesl3t1', type: 'input', questionKey: 'data.tasks.g2m_3x7', difficulty: 1, answer: '21' },
            { id: 'g2mtimesl3t2', type: 'input', questionKey: 'data.tasks.g2m_3x4', difficulty: 1, answer: '12' },
            { id: 'g2mtimesl3t3', type: 'fill_blank', questionKey: 'data.tasks.g2m_timesl3_fb_sent', difficulty: 2, sentenceKey: 'data.tasks.g2m_timesl3_fb_sent', options: [{ id: 'fb-a', textKey: 'data.tasks.g2m_timesl3_fb_a', correct: false }, { id: 'fb-b', textKey: 'data.tasks.g2m_timesl3_fb_b', correct: true }, { id: 'fb-c', textKey: 'data.tasks.g2m_timesl3_fb_c', correct: false }] },
            { id: 'g2mtimesl3t4', type: 'multiple_choice', questionKey: 'data.tasks.g2m_3x8_check', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2m_timesl3_q4_a', correct: false }, { id: 'b', textKey: 'data.tasks.g2m_timesl3_q4_b', correct: true }, { id: 'c', textKey: 'data.tasks.g2m_timesl3_q4_c', correct: false }] },
          ] },
      ] },
    ],
  },
  {
    id: 'g2rus', titleKey: 'data.worlds.g2rus', descriptionKey: 'data.worldDesc.g2rus',
    biome: 'library', accentColor: '#9C27B0', npcEmoji: '', ageBand: '8',
    topics: [
      { id: 'g2r-softhard', worldId: 'g2rus', titleKey: 'data.topics.g2rSoftHard', subject: 'reading_ru', lessons: [
        { id: 'g2r-sh-l1', topicId: 'g2r-softhard', titleKey: 'data.lessons.g2rShL1',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g2r_shl1_0' }, { speaker: 'tali', textKey: 'data.dialog.g2r_shl1_1' }],
          intro: [{ titleKey: 'data.intro.g2r_shl1_0_t', bodyKey: 'data.intro.g2r_shl1_0_b', emoji: '' }, { titleKey: 'data.intro.g2r_shl1_1_t', bodyKey: 'data.intro.g2r_shl1_1_b', emoji: '' }],
          tasks: [
            { id: 'g2rshl1t1', type: 'multiple_choice', questionKey: 'data.tasks.g2r_nos_consonant', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_soft', correct: false }, { id: 'b', textKey: 'data.tasks.opt_hard', correct: true }] },
            { id: 'g2rshl1t2', type: 'multiple_choice', questionKey: 'data.tasks.g2r_zha_hard', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },
            { id: 'g2rshl1t3', type: 'fill_blank', questionKey: 'data.tasks.g2r_shl1_fb_sent', difficulty: 2, sentenceKey: 'data.tasks.g2r_shl1_fb_sent', options: [{ id: 'fb-a', textKey: 'data.tasks.g2r_opt_Zh', correct: true }, { id: 'fb-b', textKey: 'data.tasks.g2r_opt_L', correct: false }, { id: 'fb-c', textKey: 'data.tasks.g2r_opt_N', correct: false }] },
            { id: 'g2rshl1t4', type: 'input', questionKey: 'data.tasks.g2r_hard_consonants_count', difficulty: 2, answer: "2" },
          ] },
        { id: 'g2r-sh-l2', topicId: 'g2r-softhard', titleKey: 'data.lessons.g2rShL2',
          dialog: [{ speaker: 'tali', textKey: 'data.dialog.g2r_shl2_0' }, { speaker: 'npc', textKey: 'data.dialog.g2r_shl2_1' }],
          intro: [{ titleKey: 'data.intro.g2r_shl2_0_t', bodyKey: 'data.intro.g2r_shl2_0_b', emoji: '' }, { titleKey: 'data.intro.g2r_shl2_1_t', bodyKey: 'data.intro.g2r_shl2_1_b', emoji: '' }],
          tasks: [
            { id: 'g2rshl2t1', type: 'multiple_choice', questionKey: 'data.tasks.g2r_kon_konj', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2r_opt_kon', correct: false }, { id: 'b', textKey: 'data.tasks.g2r_opt_konj', correct: true }] },
            { id: 'g2rshl2t2', type: 'multiple_choice', questionKey: 'data.tasks.g2r_soft_sign_role', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2r_opt_softens', correct: true }, { id: 'b', textKey: 'data.tasks.g2r_opt_hardens', correct: false }, { id: 'c', textKey: 'data.tasks.g2r_opt_no_role', correct: false }] },
            { id: 'g2rshl2t3', type: 'fill_blank', questionKey: 'data.tasks.g2r_shl2_fb_sent', difficulty: 2, sentenceKey: 'data.tasks.g2r_shl2_fb_sent', options: [{ id: 'fb-a', textKey: 'data.tasks.g2r_opt_kon', correct: false }, { id: 'fb-b', textKey: 'data.tasks.g2r_opt_konj', correct: true }] },
            { id: 'g2rshl2t4', type: 'input', questionKey: 'data.tasks.g2r_soft_sign_between', difficulty: 2, answer: "Да" },
          ] },
        { id: 'g2r-sh-l3', topicId: 'g2r-softhard', titleKey: 'data.lessons.g2rShL3',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g2r_shl3_0' }, { speaker: 'tali', textKey: 'data.dialog.g2r_shl3_1' }],
          intro: [{ titleKey: 'data.intro.g2r_shl3_0_t', bodyKey: 'data.intro.g2r_shl3_0_b', emoji: '' }, { titleKey: 'data.intro.g2r_shl3_1_t', bodyKey: 'data.intro.g2r_shl3_1_b', emoji: '' }],
          tasks: [
            { id: 'g2rshl3t1', type: 'multiple_choice', questionKey: 'data.tasks.g2r_li_is_soft', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },
            { id: 'g2rshl3t2', type: 'multiple_choice', questionKey: 'data.tasks.g2r_lu_is_hard', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_soft', correct: false }, { id: 'b', textKey: 'data.tasks.opt_hard', correct: true }] },
            { id: 'g2rshl3t3', type: 'multiple_choice', questionKey: 'data.tasks.g2r_le_is_what', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_soft', correct: true }, { id: 'b', textKey: 'data.tasks.opt_hard', correct: false }] },
            { id: 'g2rshl3t4', type: 'input', questionKey: 'data.tasks.g2r_la_is_what', difficulty: 2, answer: "Твёрдый" },
          ] },
      ] },
      { id: 'g2r-speech', worldId: 'g2rus', titleKey: 'data.topics.g2rSpeech', subject: 'reading_ru', lessons: [
        { id: 'g2r-sp-l1', topicId: 'g2r-speech', titleKey: 'data.lessons.g2rSpL1',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g2r_spl1_0' }, { speaker: 'tali', textKey: 'data.dialog.g2r_spl1_1' }],
          intro: [{ titleKey: 'data.intro.g2r_spl1_0_t', bodyKey: 'data.intro.g2r_spl1_0_b', emoji: '' }, { titleKey: 'data.intro.g2r_spl1_1_t', bodyKey: 'data.intro.g2r_spl1_1_b', emoji: '' }],
          tasks: [
            { id: 'g2rspl1t1', type: 'multiple_choice', questionKey: 'data.tasks.g2r_noun_question', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2r_opt_kto_chto', correct: true }, { id: 'b', textKey: 'data.tasks.g2r_opt_chto_delaet', correct: false }, { id: 'c', textKey: 'data.tasks.g2r_opt_kakoy', correct: false }] },
            { id: 'g2rspl1t2', type: 'multiple_choice', questionKey: 'data.tasks.g2r_kot_noun', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },
            { id: 'g2rspl1t3', type: 'multiple_choice', questionKey: 'data.tasks.g2r_beg_noun', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: false }, { id: 'b', textKey: 'data.tasks.opt_no', correct: true }] },
            { id: 'g2rspl1t4', type: 'input', questionKey: 'data.tasks.g2r_which_is_noun', difficulty: 2, answer: "Книга" },
          ] },
        { id: 'g2r-sp-l2', topicId: 'g2r-speech', titleKey: 'data.lessons.g2rSpL2',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g2r_spl2_0' }, { speaker: 'tali', textKey: 'data.dialog.g2r_spl2_1' }],
          intro: [{ titleKey: 'data.intro.g2r_spl2_0_t', bodyKey: 'data.intro.g2r_spl2_0_b', emoji: '' }, { titleKey: 'data.intro.g2r_spl2_1_t', bodyKey: 'data.intro.g2r_spl2_1_b', emoji: '' }],
          tasks: [
            { id: 'g2rspl2t1', type: 'multiple_choice', questionKey: 'data.tasks.g2r_verb_question', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2r_opt_kto_chto', correct: false }, { id: 'b', textKey: 'data.tasks.g2r_opt_chto_delaet', correct: true }, { id: 'c', textKey: 'data.tasks.g2r_opt_kakoy', correct: false }] },
            { id: 'g2rspl2t2', type: 'multiple_choice', questionKey: 'data.tasks.g2r_idet_verb', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },
            { id: 'g2rspl2t3', type: 'multiple_choice', questionKey: 'data.tasks.g2r_which_is_verb', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2r_opt_koshka', correct: false }, { id: 'b', textKey: 'data.tasks.g2r_opt_sidit', correct: true }, { id: 'c', textKey: 'data.tasks.g2r_opt_krasivyi', correct: false }] },
            { id: 'g2rspl2t4', type: 'multiple_choice', questionKey: 'data.tasks.g2r_verb_changes_time', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },
          ] },
        { id: 'g2r-sp-l3', topicId: 'g2r-speech', titleKey: 'data.lessons.g2rSpL3',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g2r_spl3_0' }, { speaker: 'tali', textKey: 'data.dialog.g2r_spl3_1' }],
          intro: [{ titleKey: 'data.intro.g2r_spl3_0_t', bodyKey: 'data.intro.g2r_spl3_0_b', emoji: '' }, { titleKey: 'data.intro.g2r_spl3_1_t', bodyKey: 'data.intro.g2r_spl3_1_b', emoji: '' }],
          tasks: [
            { id: 'g2rspl3t1', type: 'multiple_choice', questionKey: 'data.tasks.g2r_adj_question', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2r_opt_kto_chto', correct: false }, { id: 'b', textKey: 'data.tasks.g2r_opt_chto_delaet', correct: false }, { id: 'c', textKey: 'data.tasks.g2r_opt_kakoy', correct: true }] },
            { id: 'g2rspl3t2', type: 'multiple_choice', questionKey: 'data.tasks.g2r_krasivyi_adj', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },
            { id: 'g2rspl3t3', type: 'multiple_choice', questionKey: 'data.tasks.g2r_which_is_adj', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2r_opt_sidit', correct: false }, { id: 'b', textKey: 'data.tasks.g2r_opt_koshka', correct: false }, { id: 'c', textKey: 'data.tasks.g2r_opt_belyi', correct: true }] },
            { id: 'g2rspl3t4', type: 'multiple_choice', questionKey: 'data.tasks.g2r_adj_describes', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2r_opt_priznak', correct: true }, { id: 'b', textKey: 'data.tasks.g2r_opt_action', correct: false }, { id: 'c', textKey: 'data.tasks.g2r_opt_place', correct: false }] },
          ] },
      ] },
      { id: 'g2r-sentence', worldId: 'g2rus', titleKey: 'data.topics.g2rSentence', subject: 'reading_ru', lessons: [
        { id: 'g2r-sent-l1', topicId: 'g2r-sentence', titleKey: 'data.lessons.g2rSentL1',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g2r_sentl1_0' }, { speaker: 'tali', textKey: 'data.dialog.g2r_sentl1_1' }],
          intro: [{ titleKey: 'data.intro.g2r_sentl1_0_t', bodyKey: 'data.intro.g2r_sentl1_0_b', emoji: '' }, { titleKey: 'data.intro.g2r_sentl1_1_t', bodyKey: 'data.intro.g2r_sentl1_1_b', emoji: '' }],
          tasks: [
            { id: 'g2rsentl1t1', type: 'multiple_choice', questionKey: 'data.tasks.g2r_statement_type', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2r_sentl1_t1_a', correct: true }, { id: 'b', textKey: 'data.tasks.g2r_sentl1_t1_b', correct: false }, { id: 'c', textKey: 'data.tasks.g2r_sentl1_t1_c', correct: false }] },
            { id: 'g2rsentl1t2', type: 'multiple_choice', questionKey: 'data.tasks.g2r_sentl1_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2r_sentl1_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g2r_sentl1_q2_b', correct: false }] },
            { id: 'g2rsentl1t3', type: 'multiple_choice', questionKey: 'data.tasks.g2r_exclaim_type', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2r_opt_kto_chto', correct: true }, { id: 'b', textKey: 'data.tasks.g2r_opt_chto_delaet', correct: false }, { id: 'c', textKey: 'data.tasks.g2r_opt_kakoy', correct: false }] },
            { id: 'g2rsentl1t4', type: 'multiple_choice', questionKey: 'data.tasks.g2r_sentl1_predicate_q', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2r_opt_sidit', correct: true }, { id: 'b', textKey: 'data.tasks.g2r_opt_koshka', correct: false }, { id: 'c', textKey: 'data.tasks.g2r_opt_krasivyi', correct: false }] },
          ] },
        { id: 'g2r-sent-l2', topicId: 'g2r-sentence', titleKey: 'data.lessons.g2rSentL2',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g2r_sentl2_0' }, { speaker: 'tali', textKey: 'data.dialog.g2r_sentl2_1' }, { speaker: 'npc', textKey: 'data.dialog.g2r_sentl2_2' }],
          intro: [{ titleKey: 'data.intro.g2r_sentl2_0_t', bodyKey: 'data.intro.g2r_sentl2_0_b', emoji: '' }, { titleKey: 'data.intro.g2r_sentl2_1_t', bodyKey: 'data.intro.g2r_sentl2_1_b', emoji: '' }],
          tasks: [
            { id: 'g2rsentl2t1', type: 'multiple_choice', questionKey: 'data.tasks.g2r_sentl2_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2r_opt_opred', correct: true }, { id: 'b', textKey: 'data.tasks.g2r_opt_dopol', correct: false }, { id: 'c', textKey: 'data.tasks.g2r_opt_obst', correct: false }] },
            { id: 'g2rsentl2t2', type: 'multiple_choice', questionKey: 'data.tasks.g2r_sentl2_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2r_opt_opred', correct: false }, { id: 'b', textKey: 'data.tasks.g2r_opt_dopol', correct: true }, { id: 'c', textKey: 'data.tasks.g2r_opt_obst', correct: false }] },
            { id: 'g2rsentl2t3', type: 'fill_blank', questionKey: 'data.tasks.g2r_sentl2_fb_sent', difficulty: 2, sentenceKey: 'data.tasks.g2r_sentl2_fb_sent', options: [{ id: 'fb-a', textKey: 'data.tasks.g2r_opt_opred', correct: false }, { id: 'fb-b', textKey: 'data.tasks.g2r_opt_dopol', correct: false }, { id: 'fb-c', textKey: 'data.tasks.g2r_opt_obst', correct: true }] },
            { id: 'g2rsentl2t4', type: 'multiple_choice', questionKey: 'data.tasks.g2r_sentl2_q4', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2r_opt_obst', correct: true }, { id: 'b', textKey: 'data.tasks.g2r_opt_opred', correct: false }, { id: 'c', textKey: 'data.tasks.g2r_opt_dopol', correct: false }] },
          ] },
        { id: 'g2r-sent-l3', topicId: 'g2r-sentence', titleKey: 'data.lessons.g2rSentL3',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g2r_sentl3_0' }, { speaker: 'tali', textKey: 'data.dialog.g2r_sentl3_1' }],
          intro: [{ titleKey: 'data.intro.g2r_sentl3_0_t', bodyKey: 'data.intro.g2r_sentl3_0_b', emoji: '' }, { titleKey: 'data.intro.g2r_sentl3_1_t', bodyKey: 'data.intro.g2r_sentl3_1_b', emoji: '' }],
          tasks: [
            { id: 'g2rsentl3t1', type: 'multiple_choice', questionKey: 'data.tasks.g2r_sentl3_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2r_sentl3_q1_a', correct: true }, { id: 'b', textKey: 'data.tasks.g2r_sentl3_q1_b', correct: false }, { id: 'c', textKey: 'data.tasks.g2r_sentl3_q1_c', correct: false }] },
            { id: 'g2rsentl3t2', type: 'multiple_choice', questionKey: 'data.tasks.g2r_sentl3_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2r_sentl3_opt_boy_go', correct: true }, { id: 'b', textKey: 'data.tasks.g2r_sentl3_opt_boy_go_bad', correct: false }, { id: 'c', textKey: 'data.tasks.g2r_sentl3_opt_boys_go_bad', correct: false }] },
            { id: 'g2rsentl3t3', type: 'multiple_choice', questionKey: 'data.tasks.g2r_sentl3_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2r_sentl3_opt_red_ball', correct: true }, { id: 'b', textKey: 'data.tasks.g2r_sentl3_opt_red_ball_bad', correct: false }, { id: 'c', textKey: 'data.tasks.g2r_sentl3_opt_boy_go_bad', correct: false }] },
            { id: 'g2rsentl3t4', type: 'input', questionKey: 'data.tasks.g2r_which_correct_sent', difficulty: 2, answer: "Мама готовит обед." },
          ] },
      ] },
    ],
  },
  {
    id: 'g2sci', titleKey: 'data.worlds.g2sci', descriptionKey: 'data.worldDesc.g2sci',
    biome: 'savanna', accentColor: '#4CAF50', npcEmoji: '', ageBand: '8',
    topics: [
      { id: 'g2s-plants', worldId: 'g2sci', titleKey: 'data.topics.g2sPlants', subject: 'logic', lessons: [
        { id: 'g2s-plt-l1', topicId: 'g2s-plants', titleKey: 'data.lessons.g2sPltL1',
          dialog: [{ speaker: 'tali', textKey: 'data.dialog.g2s_pltl1_0' }, { speaker: 'npc', textKey: 'data.dialog.g2s_pltl1_1' }],
          intro: [{ titleKey: 'data.intro.g2s_pltl1_0_t', bodyKey: 'data.intro.g2s_pltl1_0_b', emoji: '' }, { titleKey: 'data.intro.g2s_pltl1_1_t', bodyKey: 'data.intro.g2s_pltl1_1_b', emoji: '' }],
          tasks: [
            { id: 'g2spltl1t1', type: 'multiple_choice', questionKey: 'data.tasks.g2s_root_function', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2s_opt_water_food', correct: true }, { id: 'b', textKey: 'data.tasks.g2s_opt_photosyn', correct: false }, { id: 'c', textKey: 'data.tasks.g2s_opt_flowers', correct: false }] },
            { id: 'g2spltl1t2', type: 'multiple_choice', questionKey: 'data.tasks.g2s_leaf_function', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2s_opt_water_food', correct: false }, { id: 'b', textKey: 'data.tasks.g2s_opt_photosyn', correct: true }, { id: 'c', textKey: 'data.tasks.g2s_opt_flowers', correct: false }] },
            { id: 'g2spltl1t3', type: 'fill_blank', questionKey: 'data.tasks.g2s_pltl1_fb_sent', difficulty: 2, sentenceKey: 'data.tasks.g2s_pltl1_fb_sent', options: [{ id: 'fb-a', textKey: 'data.tasks.g2s_pltl1_fb_a', correct: false }, { id: 'fb-b', textKey: 'data.tasks.g2s_pltl1_fb_b', correct: true }, { id: 'fb-c', textKey: 'data.tasks.g2s_pltl1_fb_c', correct: false }] },
            { id: 'g2spltl1t4', type: 'input', questionKey: 'data.tasks.g2s_plant_parts_count', difficulty: 2, answer: "5" },
          ] },
        { id: 'g2s-plt-l2', topicId: 'g2s-plants', titleKey: 'data.lessons.g2sPltL2',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g2s_pltl2_0' }, { speaker: 'tali', textKey: 'data.dialog.g2s_pltl2_1' }],
          intro: [{ titleKey: 'data.intro.g2s_pltl2_0_t', bodyKey: 'data.intro.g2s_pltl2_0_b', emoji: '' }, { titleKey: 'data.intro.g2s_pltl2_1_t', bodyKey: 'data.intro.g2s_pltl2_1_b', emoji: '' }],
          tasks: [
            { id: 'g2spltl2t1', type: 'multiple_choice', questionKey: 'data.tasks.g2s_pltl2_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2s_pltl2_q1_a', correct: true }, { id: 'b', textKey: 'data.tasks.g2s_pltl2_q1_b', correct: false }, { id: 'c', textKey: 'data.tasks.g2s_pltl2_q1_c', correct: false }] },
            { id: 'g2spltl2t2', type: 'multiple_choice', questionKey: 'data.tasks.g2s_photosyn_needs', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2s_opt_sun_water_co2', correct: true }, { id: 'b', textKey: 'data.tasks.g2s_opt_only_water', correct: false }, { id: 'c', textKey: 'data.tasks.g2s_opt_only_sun', correct: false }] },
            { id: 'g2spltl2t3', type: 'fill_blank', questionKey: 'data.tasks.g2s_pltl2_fb_sent', difficulty: 2, sentenceKey: 'data.tasks.g2s_pltl2_fb_sent', options: [{ id: 'fb-a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'fb-b', textKey: 'data.tasks.opt_no', correct: false }] },
            { id: 'g2spltl2t4', type: 'multiple_choice', questionKey: 'data.tasks.g2s_seed_grows_into', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2s_opt_in_leaves', correct: true }, { id: 'b', textKey: 'data.tasks.g2s_opt_in_roots', correct: false }, { id: 'c', textKey: 'data.tasks.g2s_opt_in_flower', correct: false }] },
          ] },
        { id: 'g2s-plt-l3', topicId: 'g2s-plants', titleKey: 'data.lessons.g2sPltL3',
          dialog: [{ speaker: 'tali', textKey: 'data.dialog.g2s_pltl3_0' }, { speaker: 'npc', textKey: 'data.dialog.g2s_pltl3_1' }],
          intro: [{ titleKey: 'data.intro.g2s_pltl3_0_t', bodyKey: 'data.intro.g2s_pltl3_0_b', emoji: '' }, { titleKey: 'data.intro.g2s_pltl3_1_t', bodyKey: 'data.intro.g2s_pltl3_1_b', emoji: '' }],
          tasks: [
            { id: 'g2spltl3t1', type: 'multiple_choice', questionKey: 'data.tasks.g2s_carrot_part', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2s_opt_veg_cat', correct: true }, { id: 'b', textKey: 'data.tasks.g2s_opt_fruit_cat', correct: false }] },
            { id: 'g2spltl3t2', type: 'multiple_choice', questionKey: 'data.tasks.g2s_tomato_part', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2s_opt_veg_cat', correct: false }, { id: 'b', textKey: 'data.tasks.g2s_opt_fruit_cat', correct: true }] },
            { id: 'g2spltl3t3', type: 'multiple_choice', questionKey: 'data.tasks.g2s_spinach_part', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2s_opt_root_p', correct: false }, { id: 'b', textKey: 'data.tasks.g2s_opt_fruit_p', correct: false }, { id: 'c', textKey: 'data.tasks.g2s_opt_leaf_p', correct: true }] },
            { id: 'g2spltl3t4', type: 'input', questionKey: 'data.tasks.g2s_potato_part', difficulty: 2, answer: "Корень (клубень)" },
          ] },
      ] },
      { id: 'g2s-animals', worldId: 'g2sci', titleKey: 'data.topics.g2sAnimals', subject: 'logic', lessons: [
        { id: 'g2s-ani-l1', topicId: 'g2s-animals', titleKey: 'data.lessons.g2sAniL1',
          dialog: [{ speaker: 'tali', textKey: 'data.dialog.g2s_anil1_0' }, { speaker: 'npc', textKey: 'data.dialog.g2s_anil1_1' }],
          intro: [{ titleKey: 'data.intro.g2s_anil1_0_t', bodyKey: 'data.intro.g2s_anil1_0_b', emoji: '' }, { titleKey: 'data.intro.g2s_anil1_1_t', bodyKey: 'data.intro.g2s_anil1_1_b', emoji: '' }],
          tasks: [
            { id: 'g2sanil1t1', type: 'multiple_choice', questionKey: 'data.tasks.g2s_mammal_is', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2s_opt_dog_cl', correct: true }, { id: 'b', textKey: 'data.tasks.g2s_opt_eagle_cl', correct: false }, { id: 'c', textKey: 'data.tasks.g2s_opt_frog_cl', correct: false }] },
            { id: 'g2sanil1t2', type: 'multiple_choice', questionKey: 'data.tasks.g2s_anil1_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2s_anil1_q2_a', correct: false }, { id: 'b', textKey: 'data.tasks.g2s_anil1_q2_b', correct: true }] },
            { id: 'g2sanil1t3', type: 'sorting', questionKey: 'data.tasks.g2s_anil1_sort_q', difficulty: 2, groups: [{ id: 'g-mammal', labelKey: 'data.tasks.g2s_anil1_sort_mammal' }, { id: 'g-other', labelKey: 'data.tasks.g2s_anil1_sort_other' }], items: [{ id: 'so-1', imageKey: 'aba_cat', groupId: 'g-mammal' }, { id: 'so-2', imageKey: 'aba_dog', groupId: 'g-mammal' }, { id: 'so-3', imageKey: 'aba_bird', groupId: 'g-other' }, { id: 'so-4', imageKey: 'aba_fish', groupId: 'g-other' }] },
            { id: 'g2sanil1t4', type: 'multiple_choice', questionKey: 'data.tasks.g2s_bat_mammal', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },
          ] },
        { id: 'g2s-ani-l2', topicId: 'g2s-animals', titleKey: 'data.lessons.g2sAniL2',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g2s_anil2_0' }, { speaker: 'tali', textKey: 'data.dialog.g2s_anil2_1' }, { speaker: 'npc', textKey: 'data.dialog.g2s_anil2_2' }],
          intro: [{ titleKey: 'data.intro.g2s_anil2_0_t', bodyKey: 'data.intro.g2s_anil2_0_b', emoji: '' }, { titleKey: 'data.intro.g2s_anil2_1_t', bodyKey: 'data.intro.g2s_anil2_1_b', emoji: '' }],
          tasks: [
            { id: 'g2sanil2t1', type: 'multiple_choice', questionKey: 'data.tasks.g2s_bird_is', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2s_opt_sparrow_cl', correct: true }, { id: 'b', textKey: 'data.tasks.g2s_opt_bat_cl', correct: false }, { id: 'c', textKey: 'data.tasks.g2s_opt_fish_cl', correct: false }] },
            { id: 'g2sanil2t2', type: 'multiple_choice', questionKey: 'data.tasks.g2s_bird_feature', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2s_opt_has_feathers', correct: true }, { id: 'b', textKey: 'data.tasks.g2s_opt_has_fur', correct: false }, { id: 'c', textKey: 'data.tasks.g2s_opt_has_scales', correct: false }] },
            { id: 'g2sanil2t3', type: 'multiple_choice', questionKey: 'data.tasks.g2s_penguin_bird', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },
            { id: 'g2sanil2t4', type: 'multiple_choice', questionKey: 'data.tasks.g2s_all_birds_fly', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: false }, { id: 'b', textKey: 'data.tasks.opt_no', correct: true }] },
          ] },
        { id: 'g2s-ani-l3', topicId: 'g2s-animals', titleKey: 'data.lessons.g2sAniL3',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g2s_anil3_0' }, { speaker: 'tali', textKey: 'data.dialog.g2s_anil3_1' }],
          intro: [{ titleKey: 'data.intro.g2s_anil3_0_t', bodyKey: 'data.intro.g2s_anil3_0_b', emoji: '' }, { titleKey: 'data.intro.g2s_anil3_1_t', bodyKey: 'data.intro.g2s_anil3_1_b', emoji: '' }],
          tasks: [
            { id: 'g2sanil3t1', type: 'multiple_choice', questionKey: 'data.tasks.g2s_fish_breathes', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2s_opt_gills', correct: true }, { id: 'b', textKey: 'data.tasks.g2s_opt_lungs', correct: false }, { id: 'c', textKey: 'data.tasks.g2s_opt_skin', correct: false }] },
            { id: 'g2sanil3t2', type: 'multiple_choice', questionKey: 'data.tasks.g2s_anil3_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2s_anil3_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g2s_anil3_q2_b', correct: false }] },
            { id: 'g2sanil3t3', type: 'multiple_choice', questionKey: 'data.tasks.g2s_spider_insect', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: false }, { id: 'b', textKey: 'data.tasks.opt_no', correct: true }] },
            { id: 'g2sanil3t4', type: 'multiple_choice', questionKey: 'data.tasks.g2s_anil3_q4', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2s_opt_gills', correct: true }, { id: 'b', textKey: 'data.tasks.g2s_opt_lungs', correct: false }, { id: 'c', textKey: 'data.tasks.g2s_opt_skin', correct: false }] },
          ] },
      ] },
      { id: 'g2s-body', worldId: 'g2sci', titleKey: 'data.topics.g2sBody', subject: 'logic', lessons: [
        { id: 'g2s-bdy-l1', topicId: 'g2s-body', titleKey: 'data.lessons.g2sBdyL1',
          dialog: [{ speaker: 'tali', textKey: 'data.dialog.g2s_bdyl1_0' }, { speaker: 'npc', textKey: 'data.dialog.g2s_bdyl1_1' }],
          intro: [{ titleKey: 'data.intro.g2s_bdyl1_0_t', bodyKey: 'data.intro.g2s_bdyl1_0_b', emoji: '' }, { titleKey: 'data.intro.g2s_bdyl1_1_t', bodyKey: 'data.intro.g2s_bdyl1_1_b', emoji: '' }],
          tasks: [
            { id: 'g2sbdyl1t1', type: 'world_knowledge', category: 'world_knowledge', questionKey: 'data.tasks.g2s_skeleton_function', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2s_opt_support', correct: true }, { id: 'b', textKey: 'data.tasks.g2s_opt_digestion', correct: false }, { id: 'c', textKey: 'data.tasks.g2s_opt_breathing', correct: false }] },
            { id: 'g2sbdyl1t2', type: 'world_knowledge', category: 'world_knowledge', questionKey: 'data.tasks.g2s_muscles_do', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2s_opt_move_body', correct: true }, { id: 'b', textKey: 'data.tasks.g2s_opt_digest', correct: false }, { id: 'c', textKey: 'data.tasks.g2s_opt_breathe', correct: false }] },
            { id: 'g2sbdyl1t3', type: 'multiple_choice', questionKey: 'data.tasks.g2s_bdyl1_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: false }, { id: 'b', textKey: 'data.tasks.opt_no', correct: true }] },
            { id: 'g2sbdyl1t4', type: 'world_knowledge', category: 'world_knowledge', questionKey: 'data.tasks.g2s_biggest_bone', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2s_opt_femur', correct: true }, { id: 'b', textKey: 'data.tasks.g2s_opt_rib', correct: false }, { id: 'c', textKey: 'data.tasks.g2s_opt_skull', correct: false }] },
          ] },
        { id: 'g2s-bdy-l2', topicId: 'g2s-body', titleKey: 'data.lessons.g2sBdyL2',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g2s_bdyl2_0' }, { speaker: 'tali', textKey: 'data.dialog.g2s_bdyl2_1' }],
          intro: [{ titleKey: 'data.intro.g2s_bdyl2_0_t', bodyKey: 'data.intro.g2s_bdyl2_0_b', emoji: '' }, { titleKey: 'data.intro.g2s_bdyl2_1_t', bodyKey: 'data.intro.g2s_bdyl2_1_b', emoji: '' }],
          tasks: [
            { id: 'g2sbdyl2t1', type: 'world_knowledge', category: 'world_knowledge', questionKey: 'data.tasks.g2s_heart_does', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2s_opt_pumps_blood', correct: true }, { id: 'b', textKey: 'data.tasks.g2s_opt_digests', correct: false }, { id: 'c', textKey: 'data.tasks.g2s_opt_breathes', correct: false }] },
            { id: 'g2sbdyl2t2', type: 'world_knowledge', category: 'world_knowledge', questionKey: 'data.tasks.g2s_lungs_do', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2s_opt_see_f', correct: false }, { id: 'b', textKey: 'data.tasks.g2s_opt_breathe_f', correct: true }, { id: 'c', textKey: 'data.tasks.g2s_opt_digest_f', correct: false }] },
            { id: 'g2sbdyl2t3', type: 'multiple_choice', questionKey: 'data.tasks.g2s_bdyl2_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2s_bdyl2_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g2s_bdyl2_q3_b', correct: true }] },
            { id: 'g2sbdyl2t4', type: 'world_knowledge', category: 'world_knowledge', questionKey: 'data.tasks.g2s_bdyl2_q4', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2s_opt_brain_all', correct: true }, { id: 'b', textKey: 'data.tasks.g2s_opt_brain_heart', correct: false }, { id: 'c', textKey: 'data.tasks.g2s_opt_brain_legs', correct: false }] },
          ] },
        { id: 'g2s-bdy-l3', topicId: 'g2s-body', titleKey: 'data.lessons.g2sBdyL3',
          dialog: [{ speaker: 'tali', textKey: 'data.dialog.g2s_bdyl3_0' }, { speaker: 'npc', textKey: 'data.dialog.g2s_bdyl3_1' }],
          intro: [{ titleKey: 'data.intro.g2s_bdyl3_0_t', bodyKey: 'data.intro.g2s_bdyl3_0_b', emoji: '' }, { titleKey: 'data.intro.g2s_bdyl3_1_t', bodyKey: 'data.intro.g2s_bdyl3_1_b', emoji: '' }],
          tasks: [
            { id: 'g2sbdyl3t1', type: 'world_knowledge', category: 'world_knowledge', questionKey: 'data.tasks.g2s_vitamins_in', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2s_opt_fruits_veg', correct: true }, { id: 'b', textKey: 'data.tasks.g2s_opt_candy', correct: false }, { id: 'c', textKey: 'data.tasks.g2s_opt_chips', correct: false }] },
            { id: 'g2sbdyl3t2', type: 'world_knowledge', category: 'world_knowledge', questionKey: 'data.tasks.g2s_protein_in', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2s_opt_meat_eggs', correct: true }, { id: 'b', textKey: 'data.tasks.g2s_opt_sugar_food', correct: false }, { id: 'c', textKey: 'data.tasks.g2s_opt_water_only', correct: false }] },
            { id: 'g2sbdyl3t3', type: 'multiple_choice', questionKey: 'data.tasks.g2s_water_daily', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },
            { id: 'g2sbdyl3t4', type: 'world_knowledge', category: 'world_knowledge', questionKey: 'data.tasks.g2s_sport_good', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2s_opt_muscles', correct: true }, { id: 'b', textKey: 'data.tasks.g2s_opt_bones_only', correct: false }, { id: 'c', textKey: 'data.tasks.g2s_opt_skin_only', correct: false }] },
          ] },
      ] },
    ],
  },
  {
    id: 'g2eng', titleKey: 'data.worlds.g2eng', descriptionKey: 'data.worldDesc.g2eng',
    biome: 'bridge', accentColor: '#00BCD4', npcEmoji: '', ageBand: '8',
    topics: [
      { id: 'g2e-days', worldId: 'g2eng', titleKey: 'data.topics.g2eDays', subject: 'reading', lessons: [
        { id: 'g2e-days-l1', topicId: 'g2e-days', titleKey: 'data.lessons.g2eDaysL1',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g2e_daysl1_0' }, { speaker: 'tali', textKey: 'data.dialog.g2e_daysl1_1' }],
          intro: [{ titleKey: 'data.intro.g2e_daysl1_0_t', bodyKey: 'data.intro.g2e_daysl1_0_b', emoji: '' }, { titleKey: 'data.intro.g2e_daysl1_1_t', bodyKey: 'data.intro.g2e_daysl1_1_b', emoji: '' }],
          tasks: [
            { id: 'g2edaysl1t1', type: 'multiple_choice', questionKey: 'data.tasks.g2e_monday_ru', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_monday', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_opt_tuesday', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_opt_wednesday', correct: false }] },
            { id: 'g2edaysl1t2', type: 'multiple_choice', questionKey: 'data.tasks.g2e_tuesday_ru', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_monday', correct: false }, { id: 'b', textKey: 'data.tasks.g2e_opt_tuesday', correct: true }, { id: 'c', textKey: 'data.tasks.g2e_opt_wednesday', correct: false }] },
            { id: 'g2edaysl1t3', type: 'fill_blank', questionKey: 'data.tasks.g2e_daysl1_fb_sent', difficulty: 1, sentenceKey: 'data.tasks.g2e_daysl1_fb_sent', options: [{ id: 'fb-a', textKey: 'data.tasks.g2e_opt_monday', correct: false }, { id: 'fb-b', textKey: 'data.tasks.g2e_opt_tuesday', correct: false }, { id: 'fb-c', textKey: 'data.tasks.g2e_opt_wednesday', correct: true }] },
            { id: 'g2edaysl1t4', type: 'input', questionKey: 'data.tasks.g2e_after_monday', difficulty: 2, answer: "Tuesday" },
          ] },
        { id: 'g2e-days-l2', topicId: 'g2e-days', titleKey: 'data.lessons.g2eDaysL2',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g2e_daysl2_0' }, { speaker: 'tali', textKey: 'data.dialog.g2e_daysl2_1' }],
          intro: [{ titleKey: 'data.intro.g2e_daysl2_0_t', bodyKey: 'data.intro.g2e_daysl2_0_b', emoji: '' }, { titleKey: 'data.intro.g2e_daysl2_1_t', bodyKey: 'data.intro.g2e_daysl2_1_b', emoji: '' }],
          tasks: [
            { id: 'g2edaysl2t1', type: 'multiple_choice', questionKey: 'data.tasks.g2e_yd_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_yd_opt_sunday', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_yd_opt_tuesday', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_yd_opt_monday', correct: false }] },
            { id: 'g2edaysl2t2', type: 'multiple_choice', questionKey: 'data.tasks.g2e_yd_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_yd_opt_sunday', correct: false }, { id: 'b', textKey: 'data.tasks.g2e_yd_opt_tuesday', correct: true }, { id: 'c', textKey: 'data.tasks.g2e_yd_opt_monday', correct: false }] },
            { id: 'g2edaysl2t3', type: 'multiple_choice', questionKey: 'data.tasks.g2e_yd_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2e_yd_opt_vchera', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_yd_opt_segodnya', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_yd_opt_zavtra', correct: false }] },
            { id: 'g2edaysl2t4', type: 'input', questionKey: 'data.tasks.g2e_yd_q4', difficulty: 2, answer: "Завтра" },
          ] },
        { id: 'g2e-days-l3', topicId: 'g2e-days', titleKey: 'data.lessons.g2eDaysL3',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g2e_daysl3_0' }, { speaker: 'tali', textKey: 'data.dialog.g2e_daysl3_1' }],
          intro: [{ titleKey: 'data.intro.g2e_daysl3_0_t', bodyKey: 'data.intro.g2e_daysl3_0_b', emoji: '' }, { titleKey: 'data.intro.g2e_daysl3_1_t', bodyKey: 'data.intro.g2e_daysl3_1_b', emoji: '' }],
          tasks: [
            { id: 'g2edaysl3t1', type: 'multiple_choice', questionKey: 'data.tasks.g2e_days3_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_maths', correct: false }, { id: 'b', textKey: 'data.tasks.g2e_opt_music', correct: true }, { id: 'c', textKey: 'data.tasks.g2e_opt_art', correct: false }] },
            { id: 'g2edaysl3t2', type: 'multiple_choice', questionKey: 'data.tasks.g2e_days3_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_day_monday', correct: false }, { id: 'b', textKey: 'data.tasks.g2e_opt_day_friday', correct: true }, { id: 'c', textKey: 'data.tasks.g2e_opt_day_sunday', correct: false }] },
            { id: 'g2edaysl3t3', type: 'fill_blank', questionKey: 'data.tasks.g2e_days3_fb_sent', difficulty: 2, sentenceKey: 'data.tasks.g2e_days3_fb_sent', options: [{ id: 'fb-a', textKey: 'data.tasks.g2e_opt_on', correct: true }, { id: 'fb-b', textKey: 'data.tasks.g2e_opt_in', correct: false }, { id: 'fb-c', textKey: 'data.tasks.g2e_opt_at', correct: false }] },
            { id: 'g2edaysl3t4', type: 'input', questionKey: 'data.tasks.g2e_days3_q4', difficulty: 2, answer: "On Friday we have art" },
          ] },
      ] },
      { id: 'g2e-phrases', worldId: 'g2eng', titleKey: 'data.topics.g2ePhrases', subject: 'reading', lessons: [
        { id: 'g2e-phr-l1', topicId: 'g2e-phrases', titleKey: 'data.lessons.g2ePhrL1',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g2e_phrl1_0' }, { speaker: 'tali', textKey: 'data.dialog.g2e_phrl1_1' }],
          intro: [{ titleKey: 'data.intro.g2e_phrl1_0_t', bodyKey: 'data.intro.g2e_phrl1_0_b', emoji: '' }, { titleKey: 'data.intro.g2e_phrl1_1_t', bodyKey: 'data.intro.g2e_phrl1_1_b', emoji: '' }],
          tasks: [
            { id: 'g2ephrl1t1', type: 'multiple_choice', questionKey: 'data.tasks.g2e_phrl1_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_phrl1_opt_spasibo', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_phrl1_opt_pozh', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_phrl1_opt_privet', correct: false }] },
            { id: 'g2ephrl1t2', type: 'multiple_choice', questionKey: 'data.tasks.g2e_phrl1_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_phrl1_opt_spasibo', correct: false }, { id: 'b', textKey: 'data.tasks.g2e_phrl1_opt_pozh', correct: true }, { id: 'c', textKey: 'data.tasks.g2e_phrl1_opt_posvid', correct: false }] },
            { id: 'g2ephrl1t3', type: 'fill_blank', questionKey: 'data.tasks.g2e_phrl1_fb_sent', difficulty: 1, sentenceKey: 'data.tasks.g2e_phrl1_fb_sent', options: [{ id: 'fb-a', textKey: 'data.tasks.g2e_phrl1_opt_welcome', correct: true }, { id: 'fb-b', textKey: 'data.tasks.g2e_phrl1_opt_please', correct: false }, { id: 'fb-c', textKey: 'data.tasks.g2e_phrl1_opt_goodbye', correct: false }] },
            { id: 'g2ephrl1t4', type: 'multiple_choice', questionKey: 'data.tasks.g2e_phrl1_q4', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_thanks_alot', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_opt_youre_welcome', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_opt_hello_phr', correct: false }] },
          ] },
        { id: 'g2e-phr-l2', topicId: 'g2e-phrases', titleKey: 'data.lessons.g2ePhrL2',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g2e_phrl2_0' }, { speaker: 'tali', textKey: 'data.dialog.g2e_phrl2_1' }],
          intro: [{ titleKey: 'data.intro.g2e_phrl2_0_t', bodyKey: 'data.intro.g2e_phrl2_0_b', emoji: '' }, { titleKey: 'data.intro.g2e_phrl2_1_t', bodyKey: 'data.intro.g2e_phrl2_1_b', emoji: '' }],
          tasks: [
            { id: 'g2ephrl2t1', type: 'multiple_choice', questionKey: 'data.tasks.g2e_phr2_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_phr2_q1_a', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_phr2_q1_b', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_phr2_q1_c', correct: false }] },
            { id: 'g2ephrl2t2', type: 'multiple_choice', questionKey: 'data.tasks.g2e_phr2_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_phr2_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_phr2_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_phr2_q2_c', correct: false }] },
            { id: 'g2ephrl2t3', type: 'multiple_choice', questionKey: 'data.tasks.g2e_phr2_q3', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_phr2_q3_a', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_phr2_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_phr2_q3_c', correct: false }] },
            { id: 'g2ephrl2t4', type: 'input', questionKey: 'data.tasks.g2e_phrl2_q4', difficulty: 2, answer: "Да, оба означают прости" },
          ] },
        { id: 'g2e-phr-l3', topicId: 'g2e-phrases', titleKey: 'data.lessons.g2ePhrL3',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g2e_phrl3_0' }, { speaker: 'tali', textKey: 'data.dialog.g2e_phrl3_1' }, { speaker: 'npc', textKey: 'data.dialog.g2e_phrl3_2' }],
          intro: [{ titleKey: 'data.intro.g2e_phrl3_0_t', bodyKey: 'data.intro.g2e_phrl3_0_b', emoji: '' }, { titleKey: 'data.intro.g2e_phrl3_1_t', bodyKey: 'data.intro.g2e_phrl3_1_b', emoji: '' }],
          tasks: [
            { id: 'g2ephrl3t1', type: 'multiple_choice', questionKey: 'data.tasks.g2e_phr3_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_phr3_q1_a', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_phr3_q1_b', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_phr3_q1_c', correct: false }] },
            { id: 'g2ephrl3t2', type: 'multiple_choice', questionKey: 'data.tasks.g2e_phr3_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_phr3_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_phr3_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_phr3_q2_c', correct: false }] },
            { id: 'g2ephrl3t3', type: 'multiple_choice', questionKey: 'data.tasks.g2e_phr3_q3', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_phr3_q3_a', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_phr3_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_phr3_q3_c', correct: false }] },
            { id: 'g2ephrl3t4', type: 'multiple_choice', questionKey: 'data.tasks.g2e_phr3_q4', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_no_sandwich_ru', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_opt_yes_sandwich_ru', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_opt_hello_sandwich_ru', correct: false }] },
          ] },
      ] },
      { id: 'g2e-school', worldId: 'g2eng', titleKey: 'data.topics.g2eSchool', subject: 'reading', lessons: [
        { id: 'g2e-sch-l1', topicId: 'g2e-school', titleKey: 'data.lessons.g2eSchL1',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g2e_schl1_0' }, { speaker: 'tali', textKey: 'data.dialog.g2e_schl1_1' }],
          intro: [{ titleKey: 'data.intro.g2e_schl1_0_t', bodyKey: 'data.intro.g2e_schl1_0_b', emoji: '' }, { titleKey: 'data.intro.g2e_schl1_1_t', bodyKey: 'data.intro.g2e_schl1_1_b', emoji: '' }],
          tasks: [
            { id: 'g2eschl1t1', type: 'multiple_choice', questionKey: 'data.tasks.g2e_book_en', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_book', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_opt_pen', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_opt_desk', correct: false }] },
            { id: 'g2eschl1t2', type: 'multiple_choice', questionKey: 'data.tasks.g2e_pen_en', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_book', correct: false }, { id: 'b', textKey: 'data.tasks.g2e_opt_pen', correct: true }, { id: 'c', textKey: 'data.tasks.g2e_opt_board', correct: false }] },
            { id: 'g2eschl1t3', type: 'multiple_choice', questionKey: 'data.tasks.g2e_chair_en', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_desk', correct: false }, { id: 'b', textKey: 'data.tasks.g2e_opt_chair', correct: true }, { id: 'c', textKey: 'data.tasks.g2e_opt_board', correct: false }] },
            { id: 'g2eschl1t4', type: 'input', questionKey: 'data.tasks.g2e_board_en', difficulty: 2, answer: "board" },
          ] },
        { id: 'g2e-sch-l2', topicId: 'g2e-school', titleKey: 'data.lessons.g2eSchL2',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g2e_schl2_0' }, { speaker: 'tali', textKey: 'data.dialog.g2e_schl2_1' }],
          intro: [{ titleKey: 'data.intro.g2e_schl2_0_t', bodyKey: 'data.intro.g2e_schl2_0_b', emoji: '' }, { titleKey: 'data.intro.g2e_schl2_1_t', bodyKey: 'data.intro.g2e_schl2_1_b', emoji: '' }],
          tasks: [
            { id: 'g2eschl2t1', type: 'multiple_choice', questionKey: 'data.tasks.g2e_math_in_en', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_maths', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_opt_music', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_opt_art', correct: false }] },
            { id: 'g2eschl2t2', type: 'multiple_choice', questionKey: 'data.tasks.g2e_art_in_en', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_maths', correct: false }, { id: 'b', textKey: 'data.tasks.g2e_opt_music', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_opt_art', correct: true }] },
            { id: 'g2eschl2t3', type: 'multiple_choice', questionKey: 'data.tasks.g2e_pe_in_en', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_pe', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_opt_science', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_opt_history', correct: false }] },
            { id: 'g2eschl2t4', type: 'input', questionKey: 'data.tasks.g2e_english_subject', difficulty: 1, answer: "English" },
          ] },
        { id: 'g2e-sch-l3', topicId: 'g2e-school', titleKey: 'data.lessons.g2eSchL3',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g2e_schl3_0' }, { speaker: 'tali', textKey: 'data.dialog.g2e_schl3_1' }],
          intro: [{ titleKey: 'data.intro.g2e_schl3_0_t', bodyKey: 'data.intro.g2e_schl3_0_b', emoji: '' }, { titleKey: 'data.intro.g2e_schl3_1_t', bodyKey: 'data.intro.g2e_schl3_1_b', emoji: '' }],
          tasks: [
            { id: 'g2eschl3t1', type: 'multiple_choice', questionKey: 'data.tasks.g2e_sch3_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_sch3_opt_idont', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_sch3_opt_help', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_sch3_opt_hello', correct: false }] },
            { id: 'g2eschl3t2', type: 'multiple_choice', questionKey: 'data.tasks.g2e_sch3_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_sch3_opt_idont', correct: false }, { id: 'b', textKey: 'data.tasks.g2e_sch3_opt_help', correct: true }, { id: 'c', textKey: 'data.tasks.g2e_sch3_opt_bye', correct: false }] },
            { id: 'g2eschl3t3', type: 'multiple_choice', questionKey: 'data.tasks.g2e_sch3_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2e_sch3_opt_may', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_sch3_opt_thanks', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_sch3_opt_hello', correct: false }] },
            { id: 'g2eschl3t4', type: 'input', questionKey: 'data.tasks.g2e_sch3_q4', difficulty: 2, answer: "I don't understand" },
          ] },
      ] },
    ],
  },


  // ---
  {
    id: 'g3math', titleKey: 'data.worlds.g3math', descriptionKey: 'data.worldDesc.g3math',
    biome: 'future', accentColor: '#607D8B', npcEmoji: '', ageBand: '9-10',
    topics: [
      { id: 'g3m-1000', worldId: 'g3math', titleKey: 'data.topics.g3m1000', subject: 'math', lessons: [
        { id: 'g3m-1000-l1', topicId: 'g3m-1000', titleKey: 'data.lessons.g3m1000L1',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g3m_1000l1_0' }, { speaker: 'tali', textKey: 'data.dialog.g3m_1000l1_1' }],
          intro: [{ titleKey: 'data.intro.g3m_1000l1_0_t', bodyKey: 'data.intro.g3m_1000l1_0_b', emoji: '' }, { titleKey: 'data.intro.g3m_1000l1_1_t', bodyKey: 'data.intro.g3m_1000l1_1_b', emoji: '' }],
          tasks: [
            { id: 'g3m1000l1t1', type: 'multiple_choice', questionKey: 'data.tasks.g3m_3hundreds', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_200', correct: false }, { id: 'b', textKey: 'data.tasks.opt_300', correct: true }, { id: 'c', textKey: 'data.tasks.opt_400', correct: false }] },
            { id: 'g3m1000l1t2', type: 'multiple_choice', questionKey: 'data.tasks.g3m_5hundreds', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_400', correct: false }, { id: 'b', textKey: 'data.tasks.opt_500', correct: true }, { id: 'c', textKey: 'data.tasks.opt_600', correct: false }] },
            { id: 'g3m1000l1t3', type: 'input', questionKey: 'data.tasks.g3m_100x7', difficulty: 1, answer: '700' },
            { id: 'g3m1000l1t4', type: 'multiple_choice', questionKey: 'data.tasks.g3m_how_hundreds_in_1000', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_five', correct: false }, { id: 'b', textKey: 'data.tasks.opt_eight', correct: false }, { id: 'c', textKey: 'data.tasks.opt_ten', correct: true }] },
          ] },
        { id: 'g3m-1000-l2', topicId: 'g3m-1000', titleKey: 'data.lessons.g3m1000L2',
          dialog: [{ speaker: 'tali', textKey: 'data.dialog.g3m_1000l2_0' }, { speaker: 'npc', textKey: 'data.dialog.g3m_1000l2_1' }],
          intro: [{ titleKey: 'data.intro.g3m_1000l2_0_t', bodyKey: 'data.intro.g3m_1000l2_0_b', emoji: '' }, { titleKey: 'data.intro.g3m_1000l2_1_t', bodyKey: 'data.intro.g3m_1000l2_1_b', emoji: '' }],
          tasks: [
            { id: 'g3m1000l2t1', type: 'input', questionKey: 'data.tasks.g3m_hundreds_in_347', difficulty: 1, answer: '3' },
            { id: 'g3m1000l2t2', type: 'input', questionKey: 'data.tasks.g3m_tens_in_456', difficulty: 1, answer: '5' },
            { id: 'g3m1000l2t3', type: 'input', questionKey: 'data.tasks.g3m_num_2h_3t_5u', difficulty: 2, answer: '235' },
            { id: 'g3m1000l2t4', type: 'fill_blank', questionKey: 'data.tasks.g3m_1000l2_fb_sent', difficulty: 2, sentenceKey: 'data.tasks.g3m_1000l2_fb_sent', options: [{ id: 'fb-a', textKey: 'data.tasks.opt_398', correct: false }, { id: 'fb-b', textKey: 'data.tasks.opt_403', correct: true }, { id: 'fb-c', textKey: 'data.tasks.opt_389', correct: false }] },
          ] },
        { id: 'g3m-1000-l3', topicId: 'g3m-1000', titleKey: 'data.lessons.g3m1000L3',
          dialog: [{ speaker: 'tali', textKey: 'data.dialog.g3m_1000l3_0' }, { speaker: 'npc', textKey: 'data.dialog.g3m_1000l3_1' }],
          intro: [{ titleKey: 'data.intro.g3m_1000l3_0_t', bodyKey: 'data.intro.g3m_1000l3_0_b', emoji: '' }, { titleKey: 'data.intro.g3m_1000l3_1_t', bodyKey: 'data.intro.g3m_1000l3_1_b', emoji: '' }],
          tasks: [
            { id: 'g3m1000l3t1', type: 'multiple_choice', questionKey: 'data.tasks.g3m_cmp_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3m_cmp_opt_356', correct: true }, { id: 'b', textKey: 'data.tasks.g3m_cmp_opt_298', correct: false }] },
            { id: 'g3m1000l3t2', type: 'multiple_choice', questionKey: 'data.tasks.g3m_cmp_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3m_cmp_opt_gt', correct: true }, { id: 'b', textKey: 'data.tasks.g3m_cmp_opt_lt', correct: false }, { id: 'c', textKey: 'data.tasks.g3m_cmp_opt_eq', correct: false }] },
            { id: 'g3m1000l3t3', type: 'multiple_choice', questionKey: 'data.tasks.g3m_cmp_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: false }, { id: 'b', textKey: 'data.tasks.opt_no', correct: true }] },
            { id: 'g3m1000l3t4', type: 'input', questionKey: 'data.tasks.g3m_cmp_q4', difficulty: 2, answer: "703" },
          ] },
      ] },
      { id: 'g3m-tables', worldId: 'g3math', titleKey: 'data.topics.g3mTables', subject: 'math', lessons: [
        { id: 'g3m-tab-l1', topicId: 'g3m-tables', titleKey: 'data.lessons.g3mTabL1',
          dialog: [{ speaker: 'tali', textKey: 'data.dialog.g3m_tabl1_0' }, { speaker: 'npc', textKey: 'data.dialog.g3m_tabl1_1' }],
          intro: [{ titleKey: 'data.intro.g3m_tabl1_0_t', bodyKey: 'data.intro.g3m_tabl1_0_b', emoji: '' }, { titleKey: 'data.intro.g3m_tabl1_1_t', bodyKey: 'data.intro.g3m_tabl1_1_b', emoji: '' }],
          tasks: [
            { id: 'g3mtabl1t1', type: 'input', questionKey: 'data.tasks.g3m_4x6', difficulty: 1, answer: '24' },
            { id: 'g3mtabl1t2', type: 'input', questionKey: 'data.tasks.g3m_4x8', difficulty: 1, answer: '32' },
            { id: 'g3mtabl1t3', type: 'input', questionKey: 'data.tasks.g3m_6x7', difficulty: 2, answer: '42' },
            { id: 'g3mtabl1t4', type: 'input', questionKey: 'data.tasks.g3m_6x9', difficulty: 2, answer: '54' },
          ] },
        { id: 'g3m-tab-l2', topicId: 'g3m-tables', titleKey: 'data.lessons.g3mTabL2',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g3m_tabl2_0' }, { speaker: 'tali', textKey: 'data.dialog.g3m_tabl2_1' }],
          intro: [{ titleKey: 'data.intro.g3m_tabl2_0_t', bodyKey: 'data.intro.g3m_tabl2_0_b', emoji: '' }, { titleKey: 'data.intro.g3m_tabl2_1_t', bodyKey: 'data.intro.g3m_tabl2_1_b', emoji: '' }],
          tasks: [
            { id: 'g3mtabl2t1', type: 'input', questionKey: 'data.tasks.g3m_7x5', difficulty: 1, answer: '35' },
            { id: 'g3mtabl2t2', type: 'input', questionKey: 'data.tasks.g3m_7x8', difficulty: 2, answer: '56' },
            { id: 'g3mtabl2t3', type: 'input', questionKey: 'data.tasks.g3m_8x6', difficulty: 2, answer: '48' },
            { id: 'g3mtabl2t4', type: 'input', questionKey: 'data.tasks.g3m_8x9', difficulty: 3, answer: '72' },
          ] },
        { id: 'g3m-tab-l3', topicId: 'g3m-tables', titleKey: 'data.lessons.g3mTabL3',
          dialog: [{ speaker: 'tali', textKey: 'data.dialog.g3m_tabl3_0' }, { speaker: 'npc', textKey: 'data.dialog.g3m_tabl3_1' }],
          intro: [{ titleKey: 'data.intro.g3m_tabl3_0_t', bodyKey: 'data.intro.g3m_tabl3_0_b', emoji: '' }, { titleKey: 'data.intro.g3m_tabl3_1_t', bodyKey: 'data.intro.g3m_tabl3_1_b', emoji: '' }],
          tasks: [
            { id: 'g3mtabl3t1', type: 'input', questionKey: 'data.tasks.g3m_9x4', difficulty: 1, answer: '36' },
            { id: 'g3mtabl3t2', type: 'input', questionKey: 'data.tasks.g3m_9x7', difficulty: 2, answer: '63' },
            { id: 'g3mtabl3t3', type: 'input', questionKey: 'data.tasks.g3m_9x9', difficulty: 2, answer: '81' },
            { id: 'g3mtabl3t4', type: 'multiple_choice', questionKey: 'data.tasks.g3m_9x6_check', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3m_tabl3_q4_a', correct: false }, { id: 'b', textKey: 'data.tasks.g3m_tabl3_q4_b', correct: true }, { id: 'c', textKey: 'data.tasks.g3m_tabl3_q4_c', correct: false }] },
          ] },
      ] },
      { id: 'g3m-divide', worldId: 'g3math', titleKey: 'data.topics.g3mDivide', subject: 'math', lessons: [
        { id: 'g3m-div-l1', topicId: 'g3m-divide', titleKey: 'data.lessons.g3mDivL1',
          dialog: [{ speaker: 'tali', textKey: 'data.dialog.g3m_divl1_0' }, { speaker: 'npc', textKey: 'data.dialog.g3m_divl1_1' }],
          intro: [{ titleKey: 'data.intro.g3m_divl1_0_t', bodyKey: 'data.intro.g3m_divl1_0_b', emoji: '' }, { titleKey: 'data.intro.g3m_divl1_1_t', bodyKey: 'data.intro.g3m_divl1_1_b', emoji: '' }],
          tasks: [
            { id: 'g3mdivl1t1', type: 'multiple_choice', questionKey: 'data.tasks.g3m_div_l1_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3m_div_l1_q1_a', correct: false }, { id: 'b', textKey: 'data.tasks.g3m_div_l1_q1_b', correct: true }, { id: 'c', textKey: 'data.tasks.g3m_div_l1_q1_c', correct: false }] },
            { id: 'g3mdivl1t2', type: 'input', questionKey: 'data.tasks.g3m_div_l1_q2', difficulty: 1, answer: '5' },
            { id: 'g3mdivl1t3', type: 'input', questionKey: 'data.tasks.g3m_div_l1_q3', difficulty: 1, answer: '4' },
            { id: 'g3mdivl1t4', type: 'multiple_choice', questionKey: 'data.tasks.g3m_div_l1_q4', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3m_div_l1_q4_a', correct: false }, { id: 'b', textKey: 'data.tasks.g3m_div_l1_q4_b', correct: true }, { id: 'c', textKey: 'data.tasks.g3m_div_l1_q4_c', correct: false }] },
          ] },
        { id: 'g3m-div-l2', topicId: 'g3m-divide', titleKey: 'data.lessons.g3mDivL2',
          dialog: [{ speaker: 'tali', textKey: 'data.dialog.g3m_divl2_0' }, { speaker: 'npc', textKey: 'data.dialog.g3m_divl2_1' }],
          intro: [{ titleKey: 'data.intro.g3m_divl2_0_t', bodyKey: 'data.intro.g3m_divl2_0_b', emoji: '' }, { titleKey: 'data.intro.g3m_divl2_1_t', bodyKey: 'data.intro.g3m_divl2_1_b', emoji: '' }],
          tasks: [
            { id: 'g3mdivl2t1', type: 'input', questionKey: 'data.tasks.g3m_div_l2_q1', difficulty: 1, answer: '5' },
            { id: 'g3mdivl2t2', type: 'input', questionKey: 'data.tasks.g3m_div_l2_q2', difficulty: 1, answer: '7' },
            { id: 'g3mdivl2t3', type: 'multiple_choice', questionKey: 'data.tasks.g3m_div_l2_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3m_opt_rem_3_1', correct: true }, { id: 'b', textKey: 'data.tasks.g3m_opt_rem_3_0', correct: false }, { id: 'c', textKey: 'data.tasks.g3m_opt_rem_4_1', correct: false }] },
            { id: 'g3mdivl2t4', type: 'multiple_choice', questionKey: 'data.tasks.g3m_div_l2_q4', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3m_opt_rem_3_2', correct: true }, { id: 'b', textKey: 'data.tasks.g3m_opt_rem_2_3', correct: false }, { id: 'c', textKey: 'data.tasks.g3m_opt_rem_4_2', correct: false }] },
          ] },
        { id: 'g3m-div-l3', topicId: 'g3m-divide', titleKey: 'data.lessons.g3mDivL3',
          dialog: [{ speaker: 'tali', textKey: 'data.dialog.g3m_divl3_0' }, { speaker: 'npc', textKey: 'data.dialog.g3m_divl3_1' }],
          intro: [{ titleKey: 'data.intro.g3m_divl3_0_t', bodyKey: 'data.intro.g3m_divl3_0_b', emoji: '' }, { titleKey: 'data.intro.g3m_divl3_1_t', bodyKey: 'data.intro.g3m_divl3_1_b', emoji: '' }],
          tasks: [
            { id: 'g3mdivl3t1', type: 'input', questionKey: 'data.tasks.g3m_25div5', difficulty: 1, answer: '5' },
            { id: 'g3mdivl3t2', type: 'multiple_choice', questionKey: 'data.tasks.g3m_div_l3_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3m_div_l3_q2_a', correct: false }, { id: 'b', textKey: 'data.tasks.g3m_div_l3_q2_b', correct: true }, { id: 'c', textKey: 'data.tasks.g3m_div_l3_q2_c', correct: false }] },
            { id: 'g3mdivl3t3', type: 'input', questionKey: 'data.tasks.g3m_30div10', difficulty: 1, answer: '3' },
            { id: 'g3mdivl3t4', type: 'input', questionKey: 'data.tasks.g3m_div_l3_q4', difficulty: 1, answer: '7' },
          ] },
      ] },
    ],
  },
  {
    id: 'g3rus', titleKey: 'data.worlds.g3rus', descriptionKey: 'data.worldDesc.g3rus',
    biome: 'castle', accentColor: '#795548', npcEmoji: '', ageBand: '9-10',
    topics: [
      { id: 'g3r-gender', worldId: 'g3rus', titleKey: 'data.topics.g3rGender', subject: 'reading_ru', lessons: [
        { id: 'g3r-gen-l1', topicId: 'g3r-gender', titleKey: 'data.lessons.g3rGenL1',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g3r_genl1_0' }, { speaker: 'tali', textKey: 'data.dialog.g3r_genl1_1' }],
          intro: [{ titleKey: 'data.intro.g3r_genl1_0_t', bodyKey: 'data.intro.g3r_genl1_0_b', emoji: '' }, { titleKey: 'data.intro.g3r_genl1_1_t', bodyKey: 'data.intro.g3r_genl1_1_b', emoji: '' }],
          tasks: [
            { id: 'g3rgenl1t1', type: 'multiple_choice', questionKey: 'data.tasks.g3r_masc_question', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_opt_muzhskoy', correct: true }, { id: 'b', textKey: 'data.tasks.g3r_opt_zhenskiy', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_opt_sredniy', correct: false }] },
            { id: 'g3rgenl1t2', type: 'multiple_choice', questionKey: 'data.tasks.g3r_dom_gender', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_opt_on', correct: true }, { id: 'b', textKey: 'data.tasks.g3r_opt_ona', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_opt_ono', correct: false }] },
            { id: 'g3rgenl1t3', type: 'fill_blank', questionKey: 'data.tasks.g3r_genl1_fb_sent', difficulty: 1, sentenceKey: 'data.tasks.g3r_genl1_fb_sent', options: [{ id: 'fb-a', textKey: 'data.tasks.g3r_opt_muzhskoy', correct: true }, { id: 'fb-b', textKey: 'data.tasks.g3r_opt_zhenskiy', correct: false }, { id: 'fb-c', textKey: 'data.tasks.g3r_opt_sredniy', correct: false }] },
            { id: 'g3rgenl1t4', type: 'input', questionKey: 'data.tasks.g3r_drug_gender', difficulty: 2, answer: "Он" },
          ] },
        { id: 'g3r-gen-l2', topicId: 'g3r-gender', titleKey: 'data.lessons.g3rGenL2',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g3r_genl2_0' }, { speaker: 'tali', textKey: 'data.dialog.g3r_genl2_1' }],
          intro: [{ titleKey: 'data.intro.g3r_genl2_0_t', bodyKey: 'data.intro.g3r_genl2_0_b', emoji: '' }, { titleKey: 'data.intro.g3r_genl2_1_t', bodyKey: 'data.intro.g3r_genl2_1_b', emoji: '' }],
          tasks: [
            { id: 'g3rgenl2t1', type: 'multiple_choice', questionKey: 'data.tasks.g3r_genl2_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_opt_muzhskoy', correct: false }, { id: 'b', textKey: 'data.tasks.g3r_opt_zhenskiy', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_opt_sredniy', correct: true }] },
            { id: 'g3rgenl2t2', type: 'multiple_choice', questionKey: 'data.tasks.g3r_genl2_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_opt_on', correct: false }, { id: 'b', textKey: 'data.tasks.g3r_opt_ona', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_opt_ono', correct: true }] },
            { id: 'g3rgenl2t3', type: 'multiple_choice', questionKey: 'data.tasks.g3r_genl2_q3', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_genl2_q3_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3r_genl2_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_genl2_q3_c', correct: false }] },
            { id: 'g3rgenl2t4', type: 'input', questionKey: 'data.tasks.g3r_genl2_q4', difficulty: 2, answer: "Оно" },
          ] },
        { id: 'g3r-gen-l3', topicId: 'g3r-gender', titleKey: 'data.lessons.g3rGenL3',
          dialog: [{ speaker: 'tali', textKey: 'data.dialog.g3r_genl3_0' }, { speaker: 'npc', textKey: 'data.dialog.g3r_genl3_1' }],
          intro: [{ titleKey: 'data.intro.g3r_genl3_0_t', bodyKey: 'data.intro.g3r_genl3_0_b', emoji: '' }, { titleKey: 'data.intro.g3r_genl3_1_t', bodyKey: 'data.intro.g3r_genl3_1_b', emoji: '' }],
          tasks: [
            { id: 'g3rgenl3t1', type: 'multiple_choice', questionKey: 'data.tasks.g3r_genl3_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_genl3_q1_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3r_genl3_q1_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_genl3_q1_c', correct: false }] },
            { id: 'g3rgenl3t2', type: 'multiple_choice', questionKey: 'data.tasks.g3r_genl3_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_genl3_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3r_genl3_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_genl3_q2_c', correct: false }] },
            { id: 'g3rgenl3t3', type: 'multiple_choice', questionKey: 'data.tasks.g3r_genl3_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3r_genl3_q3_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3r_genl3_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_genl3_q3_c', correct: false }] },
            { id: 'g3rgenl3t4', type: 'input', questionKey: 'data.tasks.g3r_genl3_q4', difficulty: 2, answer: "Интересная" },
          ] },
      ] },
      { id: 'g3r-verb', worldId: 'g3rus', titleKey: 'data.topics.g3rVerb', subject: 'reading_ru', lessons: [
        { id: 'g3r-verb-l1', topicId: 'g3r-verb', titleKey: 'data.lessons.g3rVerbL1',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g3r_verbl1_0' }, { speaker: 'tali', textKey: 'data.dialog.g3r_verbl1_1' }],
          intro: [{ titleKey: 'data.intro.g3r_verbl1_0_t', bodyKey: 'data.intro.g3r_verbl1_0_b', emoji: '' }, { titleKey: 'data.intro.g3r_verbl1_1_t', bodyKey: 'data.intro.g3r_verbl1_1_b', emoji: '' }],
          tasks: [
            { id: 'g3rverbl1t1', type: 'multiple_choice', questionKey: 'data.tasks.g3r_verbl1_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_verbl1_q1_a', correct: false }, { id: 'b', textKey: 'data.tasks.g3r_verbl1_q1_b', correct: true }, { id: 'c', textKey: 'data.tasks.g3r_verbl1_q1_c', correct: false }] },
            { id: 'g3rverbl1t2', type: 'multiple_choice', questionKey: 'data.tasks.g3r_verbl1_present_q', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_opt_chto_delal', correct: false }, { id: 'b', textKey: 'data.tasks.g3r_opt_chto_delaet', correct: true }, { id: 'c', textKey: 'data.tasks.g3r_opt_chto_budet', correct: false }] },
            { id: 'g3rverbl1t3', type: 'multiple_choice', questionKey: 'data.tasks.g3r_verbl1_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3r_verbl1_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g3r_verbl1_q3_b', correct: true }, { id: 'c', textKey: 'data.tasks.g3r_verbl1_q3_c', correct: false }] },
            { id: 'g3rverbl1t4', type: 'input', questionKey: 'data.tasks.g3r_verbl1_present_input', difficulty: 2, answer: "Пишет" },
          ] },
        { id: 'g3r-verb-l2', topicId: 'g3r-verb', titleKey: 'data.lessons.g3rVerbL2',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g3r_verbl2_0' }, { speaker: 'tali', textKey: 'data.dialog.g3r_verbl2_1' }],
          intro: [{ titleKey: 'data.intro.g3r_verbl2_0_t', bodyKey: 'data.intro.g3r_verbl2_0_b', emoji: '' }, { titleKey: 'data.intro.g3r_verbl2_1_t', bodyKey: 'data.intro.g3r_verbl2_1_b', emoji: '' }],
          tasks: [
            { id: 'g3rverbl2t1', type: 'multiple_choice', questionKey: 'data.tasks.g3r_past_question', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_verbl2_q1_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3r_verbl2_q1_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_verbl2_q1_c', correct: false }] },
            { id: 'g3rverbl2t2', type: 'multiple_choice', questionKey: 'data.tasks.g3r_verbl2_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_verbl2_q2_a', correct: false }, { id: 'b', textKey: 'data.tasks.g3r_verbl2_q2_b', correct: true }, { id: 'c', textKey: 'data.tasks.g3r_verbl2_q2_c', correct: false }] },
            { id: 'g3rverbl2t3', type: 'multiple_choice', questionKey: 'data.tasks.g3r_which_past', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3r_verbl2_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g3r_verbl2_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_verbl2_q3_c', correct: true }] },
            { id: 'g3rverbl2t4', type: 'input', questionKey: 'data.tasks.g3r_verbl2_q4', difficulty: 2, answer: "Она читала" },
          ] },
        { id: 'g3r-verb-l3', topicId: 'g3r-verb', titleKey: 'data.lessons.g3rVerbL3',
          dialog: [{ speaker: 'tali', textKey: 'data.dialog.g3r_verbl3_0' }, { speaker: 'npc', textKey: 'data.dialog.g3r_verbl3_1' }],
          intro: [{ titleKey: 'data.intro.g3r_verbl3_0_t', bodyKey: 'data.intro.g3r_verbl3_0_b', emoji: '' }, { titleKey: 'data.intro.g3r_verbl3_1_t', bodyKey: 'data.intro.g3r_verbl3_1_b', emoji: '' }],
          tasks: [
            { id: 'g3rverbl3t1', type: 'multiple_choice', questionKey: 'data.tasks.g3r_person_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_verbl3_q1_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3r_verbl3_q1_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_verbl3_q1_c', correct: false }] },
            { id: 'g3rverbl3t2', type: 'multiple_choice', questionKey: 'data.tasks.g3r_person_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_verbl3_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3r_verbl3_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_verbl3_q2_c', correct: false }] },
            { id: 'g3rverbl3t3', type: 'multiple_choice', questionKey: 'data.tasks.g3r_person_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3r_verbl3_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g3r_verbl3_q3_b', correct: true }, { id: 'c', textKey: 'data.tasks.g3r_verbl3_q3_c', correct: false }] },
            { id: 'g3rverbl3t4', type: 'input', questionKey: 'data.tasks.g3r_person_q4', difficulty: 2, answer: "гуляют" },
          ] },
      ] },
      { id: 'g3r-adj', worldId: 'g3rus', titleKey: 'data.topics.g3rAdj', subject: 'reading_ru', lessons: [
        { id: 'g3r-adj-l1', topicId: 'g3r-adj', titleKey: 'data.lessons.g3rAdjL1',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g3r_adjl1_0' }, { speaker: 'tali', textKey: 'data.dialog.g3r_adjl1_1' }],
          intro: [{ titleKey: 'data.intro.g3r_adjl1_0_t', bodyKey: 'data.intro.g3r_adjl1_0_b', emoji: '' }, { titleKey: 'data.intro.g3r_adjl1_1_t', bodyKey: 'data.intro.g3r_adjl1_1_b', emoji: '' }],
          tasks: [
            { id: 'g3radjl1t1', type: 'multiple_choice', questionKey: 'data.tasks.g3r_krasny_adj', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_opt_to_adj', correct: true }, { id: 'b', textKey: 'data.tasks.g3r_opt_to_noun', correct: false }] },
            { id: 'g3radjl1t2', type: 'multiple_choice', questionKey: 'data.tasks.g3r_adj_color_examples', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_opt_krasny', correct: true }, { id: 'b', textKey: 'data.tasks.g3r_opt_krasnaya', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_opt_krasnoe', correct: false }] },
            { id: 'g3radjl1t3', type: 'multiple_choice', questionKey: 'data.tasks.g3r_zeleny_dom_adj', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3r_adjl1_q3_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3r_adjl1_q3_b', correct: false }] },
            { id: 'g3radjl1t4', type: 'input', questionKey: 'data.tasks.g3r_adj_for_masc', difficulty: 2, answer: "Красивый закат" },
          ] },
        { id: 'g3r-adj-l2', topicId: 'g3r-adj', titleKey: 'data.lessons.g3rAdjL2',
          dialog: [{ speaker: 'tali', textKey: 'data.dialog.g3r_adjl2_0' }, { speaker: 'npc', textKey: 'data.dialog.g3r_adjl2_1' }],
          intro: [{ titleKey: 'data.intro.g3r_adjl2_0_t', bodyKey: 'data.intro.g3r_adjl2_0_b', emoji: '' }, { titleKey: 'data.intro.g3r_adjl2_1_t', bodyKey: 'data.intro.g3r_adjl2_1_b', emoji: '' }],
          tasks: [
            { id: 'g3radjl2t1', type: 'multiple_choice', questionKey: 'data.tasks.g3r_adjl2_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_adjl2_q1_a', correct: false }, { id: 'b', textKey: 'data.tasks.g3r_adjl2_q1_b', correct: true }, { id: 'c', textKey: 'data.tasks.g3r_adjl2_q1_c', correct: false }] },
            { id: 'g3radjl2t2', type: 'fill_blank', questionKey: 'data.tasks.g3r_adjl2_fb_sent', difficulty: 1, sentenceKey: 'data.tasks.g3r_adjl2_fb_sent', options: [{ id: 'fb-a', textKey: 'data.tasks.g3r_adjl2_q2_a', correct: true }, { id: 'fb-b', textKey: 'data.tasks.g3r_adjl2_q2_b', correct: false }, { id: 'fb-c', textKey: 'data.tasks.g3r_adjl2_q2_c', correct: false }] },
            { id: 'g3radjl2t3', type: 'multiple_choice', questionKey: 'data.tasks.g3r_adjl2_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3r_adjl2_q3_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3r_adjl2_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_adjl2_q3_c', correct: false }] },
            { id: 'g3radjl2t4', type: 'input', questionKey: 'data.tasks.g3r_adjl2_q4', difficulty: 2, answer: "Медленнее" },
          ] },
        { id: 'g3r-adj-l3', topicId: 'g3r-adj', titleKey: 'data.lessons.g3rAdjL3',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g3r_adjl3_0' }, { speaker: 'tali', textKey: 'data.dialog.g3r_adjl3_1' }],
          intro: [{ titleKey: 'data.intro.g3r_adjl3_0_t', bodyKey: 'data.intro.g3r_adjl3_0_b', emoji: '' }, { titleKey: 'data.intro.g3r_adjl3_1_t', bodyKey: 'data.intro.g3r_adjl3_1_b', emoji: '' }],
          tasks: [
            { id: 'g3radjl3t1', type: 'multiple_choice', questionKey: 'data.tasks.g3r_antonym_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_adjl3_q1_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3r_adjl3_q1_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_adjl3_q1_c', correct: false }] },
            { id: 'g3radjl3t2', type: 'multiple_choice', questionKey: 'data.tasks.g3r_antonym_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_antonym_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3r_antonym_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_antonym_q2_c', correct: false }] },
            { id: 'g3radjl3t3', type: 'multiple_choice', questionKey: 'data.tasks.g3r_antonym_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3r_adjl3_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g3r_adjl3_q3_b', correct: true }, { id: 'c', textKey: 'data.tasks.g3r_adjl3_q3_c', correct: false }] },
            { id: 'g3radjl3t4', type: 'input', questionKey: 'data.tasks.g3r_antonym_q4', difficulty: 2, answer: "короткие" },
          ] },
      ] },
    ],
  },
  {
    id: 'g3world', titleKey: 'data.worlds.g3world', descriptionKey: 'data.worldDesc.g3world',
    biome: 'globe', accentColor: '#009688', npcEmoji: '', ageBand: '9-10',
    topics: [
      { id: 'g3w-geo', worldId: 'g3world', titleKey: 'data.topics.g3wGeo', subject: 'logic', lessons: [
        { id: 'g3w-geo-l1', topicId: 'g3w-geo', titleKey: 'data.lessons.g3wGeoL1',
          dialog: [{ speaker: 'tali', textKey: 'data.dialog.g3w_geol1_0' }, { speaker: 'npc', textKey: 'data.dialog.g3w_geol1_1' }],
          intro: [{ titleKey: 'data.intro.g3w_geol1_0_t', bodyKey: 'data.intro.g3w_geol1_0_b', emoji: '' }, { titleKey: 'data.intro.g3w_geol1_1_t', bodyKey: 'data.intro.g3w_geol1_1_b', emoji: '' }],
          tasks: [
            { id: 'g3wgeol1t1', type: 'multiple_choice', questionKey: 'data.tasks.g3w_compass_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3w_geol1t1_a', correct: false }, { id: 'b', textKey: 'data.tasks.g3w_geol1t1_b', correct: true }, { id: 'c', textKey: 'data.tasks.g3w_geol1t1_c', correct: false }] },
            { id: 'g3wgeol1t2', type: 'multiple_choice', questionKey: 'data.tasks.g3w_compass_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3w_geol1t2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3w_geol1t2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_geol1t2_c', correct: false }] },
            { id: 'g3wgeol1t3', type: 'multiple_choice', questionKey: 'data.tasks.g3w_compass_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3w_geol1t3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g3w_geol1t3_b', correct: true }, { id: 'c', textKey: 'data.tasks.g3w_geol1t3_c', correct: false }] },
            { id: 'g3wgeol1t4', type: 'multiple_choice', questionKey: 'data.tasks.g3w_compass_q4', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3w_opt_east', correct: true }, { id: 'b', textKey: 'data.tasks.g3w_opt_west', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_opt_south', correct: false }] },
          ] },
        { id: 'g3w-geo-l2', topicId: 'g3w-geo', titleKey: 'data.lessons.g3wGeoL2',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g3w_geol2_0' }, { speaker: 'tali', textKey: 'data.dialog.g3w_geol2_1' }],
          intro: [{ titleKey: 'data.intro.g3w_geol2_0_t', bodyKey: 'data.intro.g3w_geol2_0_b', emoji: '' }, { titleKey: 'data.intro.g3w_geol2_1_t', bodyKey: 'data.intro.g3w_geol2_1_b', emoji: '' }],
          tasks: [
            { id: 'g3wgeol2t1', type: 'multiple_choice', questionKey: 'data.tasks.g3w_map_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3w_geol2t1_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3w_geol2t1_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_geol2t1_c', correct: false }] },
            { id: 'g3wgeol2t2', type: 'multiple_choice', questionKey: 'data.tasks.g3w_map_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3w_geol2t2_a', correct: false }, { id: 'b', textKey: 'data.tasks.g3w_geol2t2_b', correct: true }, { id: 'c', textKey: 'data.tasks.g3w_geol2t2_c', correct: false }] },
            { id: 'g3wgeol2t3', type: 'multiple_choice', questionKey: 'data.tasks.g3w_map_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3w_geol2t3_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3w_geol2t3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_geol2t3_c', correct: false }] },
            { id: 'g3wgeol2t4', type: 'input', questionKey: 'data.tasks.g3w_map_q4', difficulty: 2, answer: "6" },
          ] },
        { id: 'g3w-geo-l3', topicId: 'g3w-geo', titleKey: 'data.lessons.g3wGeoL3',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g3w_geol3_0' }, { speaker: 'tali', textKey: 'data.dialog.g3w_geol3_1' }],
          intro: [{ titleKey: 'data.intro.g3w_geol3_0_t', bodyKey: 'data.intro.g3w_geol3_0_b', emoji: '' }, { titleKey: 'data.intro.g3w_geol3_1_t', bodyKey: 'data.intro.g3w_geol3_1_b', emoji: '' }],
          tasks: [
            { id: 'g3wgeol3t1', type: 'world_knowledge', category: 'world_knowledge', questionKey: 'data.tasks.g3w_russia_capital', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3w_opt_moscow', correct: true }, { id: 'b', textKey: 'data.tasks.g3w_opt_spb', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_opt_novosibirsk', correct: false }] },
            { id: 'g3wgeol3t2', type: 'world_knowledge', category: 'world_knowledge', questionKey: 'data.tasks.g3w_france_capital', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3w_opt_london', correct: false }, { id: 'b', textKey: 'data.tasks.g3w_opt_paris', correct: true }, { id: 'c', textKey: 'data.tasks.g3w_opt_berlin', correct: false }] },
            { id: 'g3wgeol3t3', type: 'world_knowledge', category: 'world_knowledge', questionKey: 'data.tasks.g3w_uk_capital', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3w_opt_london', correct: true }, { id: 'b', textKey: 'data.tasks.g3w_opt_paris', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_opt_berlin', correct: false }] },
            { id: 'g3wgeol3t4', type: 'world_knowledge', category: 'world_knowledge', questionKey: 'data.tasks.g3w_kyrgyzstan_capital', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3w_opt_kyrgyzstan', correct: true }, { id: 'b', textKey: 'data.tasks.g3w_opt_russia_country', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_opt_france_country', correct: false }] },
          ] },
      ] },
      { id: 'g3w-nature', worldId: 'g3world', titleKey: 'data.topics.g3wNature', subject: 'logic', lessons: [
        { id: 'g3w-nat-l1', topicId: 'g3w-nature', titleKey: 'data.lessons.g3wNatL1',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g3w_natl1_0' }, { speaker: 'tali', textKey: 'data.dialog.g3w_natl1_1' }],
          intro: [{ titleKey: 'data.intro.g3w_natl1_0_t', bodyKey: 'data.intro.g3w_natl1_0_b', emoji: '' }, { titleKey: 'data.intro.g3w_natl1_1_t', bodyKey: 'data.intro.g3w_natl1_1_b', emoji: '' }],
          tasks: [
            { id: 'g3wnatl1t1', type: 'multiple_choice', questionKey: 'data.tasks.g3w_water_cycle_steps', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3w_opt_evaporation', correct: true }, { id: 'b', textKey: 'data.tasks.g3w_opt_explosion', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_opt_erosion', correct: false }] },
            { id: 'g3wnatl1t2', type: 'multiple_choice', questionKey: 'data.tasks.g3w_clouds_form_from', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3w_opt_water_vapor', correct: true }, { id: 'b', textKey: 'data.tasks.g3w_opt_dust', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_opt_smoke', correct: false }] },
            { id: 'g3wnatl1t3', type: 'multiple_choice', questionKey: 'data.tasks.g3w_rain_comes_from', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3w_opt_clouds', correct: true }, { id: 'b', textKey: 'data.tasks.g3w_opt_rivers', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_opt_sea', correct: false }] },
            { id: 'g3wnatl1t4', type: 'multiple_choice', questionKey: 'data.tasks.g3w_natl1_q4', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3w_opt_evaporation', correct: true }, { id: 'b', textKey: 'data.tasks.g3w_opt_explosion', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_opt_erosion', correct: false }] },
          ] },
        { id: 'g3w-nat-l2', topicId: 'g3w-nature', titleKey: 'data.lessons.g3wNatL2',
          dialog: [{ speaker: 'tali', textKey: 'data.dialog.g3w_natl2_0' }, { speaker: 'npc', textKey: 'data.dialog.g3w_natl2_1' }],
          intro: [{ titleKey: 'data.intro.g3w_natl2_0_t', bodyKey: 'data.intro.g3w_natl2_0_b', emoji: '' }, { titleKey: 'data.intro.g3w_natl2_1_t', bodyKey: 'data.intro.g3w_natl2_1_b', emoji: '' }],
          tasks: [
            { id: 'g3wnatl2t1', type: 'multiple_choice', questionKey: 'data.tasks.g3w_min_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3w_min_opt_burn', correct: true }, { id: 'b', textKey: 'data.tasks.g3w_min_opt_metalz', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_min_opt_build', correct: false }] },
            { id: 'g3wnatl2t2', type: 'multiple_choice', questionKey: 'data.tasks.g3w_min_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3w_min_opt_fuel_use', correct: true }, { id: 'b', textKey: 'data.tasks.g3w_min_opt_metal_make', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_min_opt_food_make', correct: false }] },
            { id: 'g3wnatl2t3', type: 'multiple_choice', questionKey: 'data.tasks.g3w_min_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3w_min_opt_metal_ore', correct: true }, { id: 'b', textKey: 'data.tasks.g3w_min_opt_burn', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_min_opt_foodz', correct: false }] },
            { id: 'g3wnatl2t4', type: 'multiple_choice', questionKey: 'data.tasks.g3w_min_q4', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3w_min_opt_build', correct: true }, { id: 'b', textKey: 'data.tasks.g3w_min_opt_burn', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_min_opt_metalz', correct: false }] },
          ] },
        { id: 'g3w-nat-l3', topicId: 'g3w-nature', titleKey: 'data.lessons.g3wNatL3',
          dialog: [{ speaker: 'tali', textKey: 'data.dialog.g3w_natl3_0' }, { speaker: 'npc', textKey: 'data.dialog.g3w_natl3_1' }],
          intro: [{ titleKey: 'data.intro.g3w_natl3_0_t', bodyKey: 'data.intro.g3w_natl3_0_b', emoji: '' }, { titleKey: 'data.intro.g3w_natl3_1_t', bodyKey: 'data.intro.g3w_natl3_1_b', emoji: '' }],
          tasks: [
            { id: 'g3wnatl3t1', type: 'multiple_choice', questionKey: 'data.tasks.g3w_natl3_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3w_natl3_q1_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3w_natl3_q1_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_natl3_q1_c', correct: false }] },
            { id: 'g3wnatl3t2', type: 'multiple_choice', questionKey: 'data.tasks.g3w_natl3_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3w_natl3_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3w_natl3_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_natl3_q2_c', correct: false }] },
            { id: 'g3wnatl3t3', type: 'multiple_choice', questionKey: 'data.tasks.g3w_natl3_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3w_natl3_q3_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3w_natl3_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_natl3_q3_c', correct: false }] },
            { id: 'g3wnatl3t4', type: 'input', questionKey: 'data.tasks.g3w_natl3_q4', difficulty: 1, answer: "Выброс мусора в лесу" },
          ] },
      ] },
      { id: 'g3w-eco', worldId: 'g3world', titleKey: 'data.topics.g3wEco', subject: 'logic', lessons: [
        { id: 'g3w-eco-l1', topicId: 'g3w-eco', titleKey: 'data.lessons.g3wEcoL1',
          dialog: [{ speaker: 'tali', textKey: 'data.dialog.g3w_ecol1_0' }, { speaker: 'npc', textKey: 'data.dialog.g3w_ecol1_1' }],
          intro: [{ titleKey: 'data.intro.g3w_ecol1_0_t', bodyKey: 'data.intro.g3w_ecol1_0_b', emoji: '' }, { titleKey: 'data.intro.g3w_ecol1_1_t', bodyKey: 'data.intro.g3w_ecol1_1_b', emoji: '' }],
          tasks: [
            { id: 'g3wecol1t1', type: 'multiple_choice', questionKey: 'data.tasks.g3w_ecol1_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3w_ecol1_q1_a', correct: false }, { id: 'b', textKey: 'data.tasks.g3w_ecol1_q1_b', correct: true }, { id: 'c', textKey: 'data.tasks.g3w_ecol1_q1_c', correct: false }] },
            { id: 'g3wecol1t2', type: 'multiple_choice', questionKey: 'data.tasks.g3w_ecol1_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3w_ecol1_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3w_ecol1_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_ecol1_q2_c', correct: false }] },
            { id: 'g3wecol1t3', type: 'multiple_choice', questionKey: 'data.tasks.g3w_ecol1_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3w_ecol1_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g3w_ecol1_q3_b', correct: true }, { id: 'c', textKey: 'data.tasks.g3w_ecol1_q3_c', correct: false }] },
            { id: 'g3wecol1t4', type: 'input', questionKey: 'data.tasks.g3w_ecol1_q4', difficulty: 2, answer: "Аквариум с рыбками" },
          ] },
        { id: 'g3w-eco-l2', topicId: 'g3w-eco', titleKey: 'data.lessons.g3wEcoL2',
          dialog: [{ speaker: 'tali', textKey: 'data.dialog.g3w_ecol2_0' }, { speaker: 'npc', textKey: 'data.dialog.g3w_ecol2_1' }],
          intro: [{ titleKey: 'data.intro.g3w_ecol2_0_t', bodyKey: 'data.intro.g3w_ecol2_0_b', emoji: '' }, { titleKey: 'data.intro.g3w_ecol2_1_t', bodyKey: 'data.intro.g3w_ecol2_1_b', emoji: '' }],
          tasks: [
            { id: 'g3wecol2t1', type: 'multiple_choice', questionKey: 'data.tasks.g3w_ecol2_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3w_ecol2_q1_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3w_ecol2_q1_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_ecol2_q1_c', correct: false }] },
            { id: 'g3wecol2t2', type: 'multiple_choice', questionKey: 'data.tasks.g3w_ecol2_q2', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3w_ecol2_q2_a', correct: false }, { id: 'b', textKey: 'data.tasks.g3w_ecol2_q2_b', correct: true }, { id: 'c', textKey: 'data.tasks.g3w_ecol2_q2_c', correct: false }] },
            { id: 'g3wecol2t3', type: 'multiple_choice', questionKey: 'data.tasks.g3w_ecol2_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3w_ecol2_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g3w_ecol2_q3_b', correct: true }, { id: 'c', textKey: 'data.tasks.g3w_ecol2_q3_c', correct: false }] },
            { id: 'g3wecol2t4', type: 'multiple_choice', questionKey: 'data.tasks.g3w_ecol2_q4', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3w_opt_oak', correct: true }, { id: 'b', textKey: 'data.tasks.g3w_opt_caterpillar', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_opt_hawk', correct: false }] },
          ] },
        { id: 'g3w-eco-l3', topicId: 'g3w-eco', titleKey: 'data.lessons.g3wEcoL3',
          dialog: [{ speaker: 'tali', textKey: 'data.dialog.g3w_ecol3_0' }, { speaker: 'npc', textKey: 'data.dialog.g3w_ecol3_1' }],
          intro: [{ titleKey: 'data.intro.g3w_ecol3_0_t', bodyKey: 'data.intro.g3w_ecol3_0_b', emoji: '' }, { titleKey: 'data.intro.g3w_ecol3_1_t', bodyKey: 'data.intro.g3w_ecol3_1_b', emoji: '' }],
          tasks: [
            { id: 'g3wecol3t1', type: 'multiple_choice', questionKey: 'data.tasks.g3w_ecol3_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3w_ecol3_q1_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3w_ecol3_q1_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_ecol3_q1_c', correct: false }] },
            { id: 'g3wecol3t2', type: 'multiple_choice', questionKey: 'data.tasks.g3w_poaching_is', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3w_opt_illegal_hunting', correct: true }, { id: 'b', textKey: 'data.tasks.g3w_opt_legal_hunting', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_opt_bird_watching', correct: false }] },
            { id: 'g3wecol3t3', type: 'multiple_choice', questionKey: 'data.tasks.g3w_ecol3_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3w_ecol3_q3_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3w_ecol3_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_ecol3_q3_c', correct: false }] },
            { id: 'g3wecol3t4', type: 'input', questionKey: 'data.tasks.g3w_ecol3_q4', difficulty: 1, answer: "Рыбы и водные животные" },
          ] },
      ] },
    ],
  },
  {
    id: 'g3eng', titleKey: 'data.worlds.g3eng', descriptionKey: 'data.worldDesc.g3eng',
    biome: 'academy', accentColor: '#FF5722', npcEmoji: '', ageBand: '9-10',
    topics: [
      { id: 'g3e-tobe', worldId: 'g3eng', titleKey: 'data.topics.g3eTobe', subject: 'reading', lessons: [
        { id: 'g3e-tobe-l1', topicId: 'g3e-tobe', titleKey: 'data.lessons.g3eTobeL1',
          dialog: [{ speaker: 'tali', textKey: 'data.dialog.g3e_tobel1_0' }, { speaker: 'npc', textKey: 'data.dialog.g3e_tobel1_1' }],
          intro: [{ titleKey: 'data.intro.g3e_tobel1_0_t', bodyKey: 'data.intro.g3e_tobel1_0_b', emoji: '' }, { titleKey: 'data.intro.g3e_tobel1_1_t', bodyKey: 'data.intro.g3e_tobel1_1_b', emoji: '' }],
          tasks: [
            { id: 'g3etobel1t1', type: 'multiple_choice', questionKey: 'data.tasks.g3e_i_blank_happy', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_am', correct: true }, { id: 'b', textKey: 'data.tasks.g1e_opt_is', correct: false }, { id: 'c', textKey: 'data.tasks.g1e_opt_are', correct: false }] },
            { id: 'g3etobel1t2', type: 'multiple_choice', questionKey: 'data.tasks.g3e_you_blank_smart', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_am', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_is', correct: false }, { id: 'c', textKey: 'data.tasks.g1e_opt_are', correct: true }] },
            { id: 'g3etobel1t3', type: 'multiple_choice', questionKey: 'data.tasks.g3e_am_used_with', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3e_opt_I_pron', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_opt_you_pron', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_opt_he_pron', correct: false }] },
            { id: 'g3etobel1t4', type: 'multiple_choice', questionKey: 'data.tasks.g3e_tobel1_q4', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3e_opt_i_am_happy', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_opt_i_is_happy', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_opt_i_are_happy', correct: false }] },
          ] },
        { id: 'g3e-tobe-l2', topicId: 'g3e-tobe', titleKey: 'data.lessons.g3eTobeL2',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g3e_tobel2_0' }, { speaker: 'tali', textKey: 'data.dialog.g3e_tobel2_1' }],
          intro: [{ titleKey: 'data.intro.g3e_tobel2_0_t', bodyKey: 'data.intro.g3e_tobel2_0_b', emoji: '' }, { titleKey: 'data.intro.g3e_tobel2_1_t', bodyKey: 'data.intro.g3e_tobel2_1_b', emoji: '' }],
          tasks: [
            { id: 'g3etobel2t1', type: 'multiple_choice', questionKey: 'data.tasks.g3e_tobel2_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3e_tobel2_opt_is_not', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_tobel2_opt_not_is', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_tobel2_opt_am_not', correct: false }] },
            { id: 'g3etobel2t2', type: 'multiple_choice', questionKey: 'data.tasks.g3e_tobel2_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3e_tobel2_opt_isnt', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_tobel2_opt_arent', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_tobel2_opt_amnt', correct: false }] },
            { id: 'g3etobel2t3', type: 'multiple_choice', questionKey: 'data.tasks.g3e_tobel2_q3', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },
            { id: 'g3etobel2t4', type: 'input', questionKey: 'data.tasks.g3e_tobel2_q4', difficulty: 2, answer: "He is not late" },
          ] },
        { id: 'g3e-tobe-l3', topicId: 'g3e-tobe', titleKey: 'data.lessons.g3eTobeL3',
          dialog: [{ speaker: 'tali', textKey: 'data.dialog.g3e_tobel3_0' }, { speaker: 'npc', textKey: 'data.dialog.g3e_tobel3_1' }],
          intro: [{ titleKey: 'data.intro.g3e_tobel3_0_t', bodyKey: 'data.intro.g3e_tobel3_0_b', emoji: '' }, { titleKey: 'data.intro.g3e_tobel3_1_t', bodyKey: 'data.intro.g3e_tobel3_1_b', emoji: '' }],
          tasks: [
            { id: 'g3etobel3t1', type: 'multiple_choice', questionKey: 'data.tasks.g3e_tobel3_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_am', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_is', correct: false }, { id: 'c', textKey: 'data.tasks.g1e_opt_are', correct: true }] },
            { id: 'g3etobel3t2', type: 'multiple_choice', questionKey: 'data.tasks.g3e_tobel3_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3e_opt_q_am_they', correct: false }, { id: 'b', textKey: 'data.tasks.g3e_opt_q_is_they', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_opt_q_are_they', correct: true }] },
            { id: 'g3etobel3t3', type: 'multiple_choice', questionKey: 'data.tasks.g3e_tobel3_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3e_tobel3_opt_is_she', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_tobel3_opt_are_she', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_tobel3_opt_am_she', correct: false }] },
            { id: 'g3etobel3t4', type: 'input', questionKey: 'data.tasks.g3e_tobel3_q4', difficulty: 2, answer: "Are they home?" },
          ] },
      ] },
      { id: 'g3e-food', worldId: 'g3eng', titleKey: 'data.topics.g3eFood', subject: 'reading', lessons: [
        { id: 'g3e-food-l1', topicId: 'g3e-food', titleKey: 'data.lessons.g3eFoodL1',
          dialog: [{ speaker: 'tali', textKey: 'data.dialog.g3e_foodl1_0' }, { speaker: 'npc', textKey: 'data.dialog.g3e_foodl1_1' }],
          intro: [{ titleKey: 'data.intro.g3e_foodl1_0_t', bodyKey: 'data.intro.g3e_foodl1_0_b', emoji: '' }, { titleKey: 'data.intro.g3e_foodl1_1_t', bodyKey: 'data.intro.g3e_foodl1_1_b', emoji: '' }],
          tasks: [
            { id: 'g3efoodl1t1', type: 'multiple_choice', questionKey: 'data.tasks.g3e_food1_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3e_food1_q1_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_food1_q1_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_food1_q1_c', correct: false }] },
            { id: 'g3efoodl1t2', type: 'multiple_choice', questionKey: 'data.tasks.g3e_food1_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3e_food1_q2_a', correct: false }, { id: 'b', textKey: 'data.tasks.g3e_food1_q2_b', correct: true }, { id: 'c', textKey: 'data.tasks.g3e_food1_q2_c', correct: false }] },
            { id: 'g3efoodl1t3', type: 'fill_blank', questionKey: 'data.tasks.g3e_foodl1_fb_sent', difficulty: 1, sentenceKey: 'data.tasks.g3e_foodl1_fb_sent', options: [{ id: 'fb-a', textKey: 'data.tasks.g3e_foodl1_q3_a', correct: true }, { id: 'fb-b', textKey: 'data.tasks.g3e_foodl1_q3_b', correct: false }, { id: 'fb-c', textKey: 'data.tasks.g3e_foodl1_q3_c', correct: false }] },
            { id: 'g3efoodl1t4', type: 'multiple_choice', questionKey: 'data.tasks.g3e_food1_q4', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3e_opt_water_drink', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_opt_juice_drink', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_opt_milk_drink', correct: false }] },
          ] },
        { id: 'g3e-food-l2', topicId: 'g3e-food', titleKey: 'data.lessons.g3eFoodL2',
          dialog: [{ speaker: 'tali', textKey: 'data.dialog.g3e_foodl2_0' }, { speaker: 'npc', textKey: 'data.dialog.g3e_foodl2_1' }],
          intro: [{ titleKey: 'data.intro.g3e_foodl2_0_t', bodyKey: 'data.intro.g3e_foodl2_0_b', emoji: '' }, { titleKey: 'data.intro.g3e_foodl2_1_t', bodyKey: 'data.intro.g3e_foodl2_1_b', emoji: '' }],
          tasks: [
            { id: 'g3efoodl2t1', type: 'multiple_choice', questionKey: 'data.tasks.g3e_food2_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3e_food2_q1_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_food2_q1_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_food2_q1_c', correct: false }] },
            { id: 'g3efoodl2t2', type: 'multiple_choice', questionKey: 'data.tasks.g3e_food2_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3e_food2_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_food2_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_food2_q2_c', correct: false }] },
            { id: 'g3efoodl2t3', type: 'multiple_choice', questionKey: 'data.tasks.g3e_foodl2_q3', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3e_foodl2_q3_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_foodl2_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_foodl2_q3_c', correct: false }] },
            { id: 'g3efoodl2t4', type: 'input', questionKey: 'data.tasks.g3e_food2_q4', difficulty: 2, answer: "I don't like soup" },
          ] },
        { id: 'g3e-food-l3', topicId: 'g3e-food', titleKey: 'data.lessons.g3eFoodL3',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g3e_foodl3_0' }, { speaker: 'tali', textKey: 'data.dialog.g3e_foodl3_1' }],
          intro: [{ titleKey: 'data.intro.g3e_foodl3_0_t', bodyKey: 'data.intro.g3e_foodl3_0_b', emoji: '' }, { titleKey: 'data.intro.g3e_foodl3_1_t', bodyKey: 'data.intro.g3e_foodl3_1_b', emoji: '' }],
          tasks: [
            { id: 'g3efoodl3t1', type: 'multiple_choice', questionKey: 'data.tasks.g3e_food3_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3e_food3_q1_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_food3_q1_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_food3_q1_c', correct: false }] },
            { id: 'g3efoodl3t2', type: 'multiple_choice', questionKey: 'data.tasks.g3e_food3_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3e_food3_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_food3_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_food3_q2_c', correct: false }] },
            { id: 'g3efoodl3t3', type: 'multiple_choice', questionKey: 'data.tasks.g3e_food3_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3e_food3_q3_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_food3_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_food3_q3_c', correct: false }] },
            { id: 'g3efoodl3t4', type: 'input', questionKey: 'data.tasks.g3e_food3_q4', difficulty: 2, answer: "No, thank you" },
          ] },
      ] },
      { id: 'g3e-daily', worldId: 'g3eng', titleKey: 'data.topics.g3eDaily', subject: 'reading', lessons: [
        { id: 'g3e-daily-l1', topicId: 'g3e-daily', titleKey: 'data.lessons.g3eDailyL1',
          dialog: [{ speaker: 'tali', textKey: 'data.dialog.g3e_dailyl1_0' }, { speaker: 'npc', textKey: 'data.dialog.g3e_dailyl1_1' }],
          intro: [{ titleKey: 'data.intro.g3e_dailyl1_0_t', bodyKey: 'data.intro.g3e_dailyl1_0_b', emoji: '' }, { titleKey: 'data.intro.g3e_dailyl1_1_t', bodyKey: 'data.intro.g3e_dailyl1_1_b', emoji: '' }],
          tasks: [
            { id: 'g3edailyl1t1', type: 'multiple_choice', questionKey: 'data.tasks.g3e_wake_up_en', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3e_opt_wake_up_f', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_opt_go_sleep', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_opt_have_lunch', correct: false }] },
            { id: 'g3edailyl1t2', type: 'multiple_choice', questionKey: 'data.tasks.g3e_brush_teeth_en', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3e_opt_brush_teeth', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_opt_eat_breakfast', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_opt_take_shower', correct: false }] },
            { id: 'g3edailyl1t3', type: 'fill_blank', questionKey: 'data.tasks.g3e_dailyl1_fb_sent', difficulty: 2, sentenceKey: 'data.tasks.g3e_dailyl1_fb_sent', options: [{ id: 'fb-a', textKey: 'data.tasks.g3e_opt_at_correct', correct: true }, { id: 'fb-b', textKey: 'data.tasks.g3e_opt_in_correct', correct: false }, { id: 'fb-c', textKey: 'data.tasks.g3e_opt_on_correct', correct: false }] },
            { id: 'g3edailyl1t4', type: 'multiple_choice', questionKey: 'data.tasks.g3e_eat_breakfast_means', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3e_opt_breakfast_ru', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_opt_dinner_ru', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_opt_supper_ru', correct: false }] },
          ] },
        { id: 'g3e-daily-l2', topicId: 'g3e-daily', titleKey: 'data.lessons.g3eDailyL2',
          dialog: [{ speaker: 'npc', textKey: 'data.dialog.g3e_dailyl2_0' }, { speaker: 'tali', textKey: 'data.dialog.g3e_dailyl2_1' }],
          intro: [{ titleKey: 'data.intro.g3e_dailyl2_0_t', bodyKey: 'data.intro.g3e_dailyl2_0_b', emoji: '' }, { titleKey: 'data.intro.g3e_dailyl2_1_t', bodyKey: 'data.intro.g3e_dailyl2_1_b', emoji: '' }],
          tasks: [
            { id: 'g3edailyl2t1', type: 'multiple_choice', questionKey: 'data.tasks.g3e_daily2_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3e_daily2_q1_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_daily2_q1_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_daily2_q1_c', correct: false }] },
            { id: 'g3edailyl2t2', type: 'multiple_choice', questionKey: 'data.tasks.g3e_daily2_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3e_daily2_q2_a', correct: false }, { id: 'b', textKey: 'data.tasks.g3e_daily2_q2_b', correct: true }, { id: 'c', textKey: 'data.tasks.g3e_daily2_q2_c', correct: false }] },
            { id: 'g3edailyl2t3', type: 'multiple_choice', questionKey: 'data.tasks.g3e_daily2_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3e_daily2_q3_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_daily2_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_daily2_q3_c', correct: false }] },
            { id: 'g3edailyl2t4', type: 'input', questionKey: 'data.tasks.g3e_daily2_q4', difficulty: 2, answer: "What time is it?" },
          ] },
        { id: 'g3e-daily-l3', topicId: 'g3e-daily', titleKey: 'data.lessons.g3eDailyL3',
          dialog: [{ speaker: 'tali', textKey: 'data.dialog.g3e_dailyl3_0' }, { speaker: 'npc', textKey: 'data.dialog.g3e_dailyl3_1' }],
          intro: [{ titleKey: 'data.intro.g3e_dailyl3_0_t', bodyKey: 'data.intro.g3e_dailyl3_0_b', emoji: '' }, { titleKey: 'data.intro.g3e_dailyl3_1_t', bodyKey: 'data.intro.g3e_dailyl3_1_b', emoji: '' }],
          tasks: [
            { id: 'g3edailyl3t1', type: 'multiple_choice', questionKey: 'data.tasks.g3e_daily3_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3e_daily3_q1_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_daily3_q1_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_daily3_q1_c', correct: false }] },
            { id: 'g3edailyl3t2', type: 'multiple_choice', questionKey: 'data.tasks.g3e_daily3_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3e_daily3_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_daily3_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_daily3_q2_c', correct: false }] },
            { id: 'g3edailyl3t3', type: 'multiple_choice', questionKey: 'data.tasks.g3e_daily3_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3e_daily3_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g3e_daily3_q3_b', correct: true }, { id: 'c', textKey: 'data.tasks.g3e_daily3_q3_c', correct: false }] },
            { id: 'g3edailyl3t4', type: 'multiple_choice', questionKey: 'data.tasks.g3e_daily3_q4', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3e_daily3_q4_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_daily3_q4_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_daily3_q4_c', correct: false }] },
          ] },
      ] },
    ],
  },

  // в”Ђв”Ђ Grade 4 в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
  {
    id: 'g4math', titleKey: 'data.worlds.g4math', descriptionKey: 'data.worldDesc.g4math',
    biome: 'numbers', accentColor: '#FF5722', npcEmoji: '', ageBand: '9-10', npcName: 'Digit',
    topics: [
      { id: 'g4m-multidigit', worldId: 'g4math', titleKey: 'data.topics.g4mMultidigit', subject: 'math', lessons: [
        { id: 'g4m-md-l1', topicId: 'g4m-multidigit', titleKey: 'data.lessons.g4mMdL1', reward: { xp: 30 },
          dialog: [
            { speaker: 'tali', textKey: 'data.dialog.g4m_md_l1_0' },
            { speaker: 'npc', textKey: 'data.dialog.g4m_md_l1_1' },
          ],
          intro: [
            { titleKey: 'data.intro.g4m_md_l1_0_t', bodyKey: 'data.intro.g4m_md_l1_0_b', emoji: '' },
            { titleKey: 'data.intro.g4m_md_l1_1_t', bodyKey: 'data.intro.g4m_md_l1_1_b', emoji: '' },
          ],
          tasks: [
          { id: 'g4m-md-l1-t1', type: 'multiple_choice', questionKey: 'data.tasks.g4m_md_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4m_md_q1_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4m_md_q1_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4m_md_q1_c', correct: false }] },
          { id: 'g4m-md-l1-t2', type: 'multiple_choice', questionKey: 'data.tasks.g4m_md_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4m_md_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4m_md_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4m_md_q2_c', correct: false }] },
          { id: 'g4m-md-l1-t3', type: 'multiple_choice', questionKey: 'data.tasks.g4m_md_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4m_md_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4m_md_q3_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4m_md_q3_c', correct: false }] },
          { id: 'g4m-md-l1-t4', type: 'input', questionKey: 'data.tasks.g4m_md_q4', difficulty: 1, answer: "Двадцать пять тысяч шестьсот" },
        ] },
        { id: 'g4m-md-l2', topicId: 'g4m-multidigit', titleKey: 'data.lessons.g4mMdL2', reward: { xp: 30 },
          dialog: [
            { speaker: 'tali', textKey: 'data.dialog.g4m_md_l2_0' },
            { speaker: 'npc', textKey: 'data.dialog.g4m_md_l2_1' },
          ],
          intro: [
            { titleKey: 'data.intro.g4m_md_l2_0_t', bodyKey: 'data.intro.g4m_md_l2_0_b', emoji: '' },
            { titleKey: 'data.intro.g4m_md_l2_1_t', bodyKey: 'data.intro.g4m_md_l2_1_b', emoji: '' },
          ],
          tasks: [
          { id: 'g4m-md-l2-t1', type: 'multiple_choice', questionKey: 'data.tasks.g4m_md2_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4m_md2_q1_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4m_md2_q1_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4m_md2_q1_c', correct: false }] },
          { id: 'g4m-md-l2-t2', type: 'multiple_choice', questionKey: 'data.tasks.g4m_md2_q2', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4m_md2_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4m_md2_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4m_md2_q2_c', correct: false }] },
          { id: 'g4m-md-l2-t3', type: 'multiple_choice', questionKey: 'data.tasks.g4m_md2_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4m_md2_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4m_md2_q3_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4m_md2_q3_c', correct: false }] },
          { id: 'g4m-md-l2-t4', type: 'input', questionKey: 'data.tasks.g4m_md2_q4', difficulty: 1, answer: "5 039" },
        ] },
        { id: 'g4m-md-l3', topicId: 'g4m-multidigit', titleKey: 'data.lessons.g4mMdL3', reward: { xp: 30 },
          dialog: [
            { speaker: 'tali', textKey: 'data.dialog.g4m_md_l3_0' },
            { speaker: 'npc', textKey: 'data.dialog.g4m_md_l3_1' },
          ],
          intro: [
            { titleKey: 'data.intro.g4m_md_l3_0_t', bodyKey: 'data.intro.g4m_md_l3_0_b', emoji: '' },
            { titleKey: 'data.intro.g4m_md_l3_1_t', bodyKey: 'data.intro.g4m_md_l3_1_b', emoji: '' },
          ],
          tasks: [
          { id: 'g4m-md-l3-t1', type: 'multiple_choice', questionKey: 'data.tasks.g4m_md3_q1', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4m_md3_q1_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4m_md3_q1_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4m_md3_q1_c', correct: false }] },
          { id: 'g4m-md-l3-t2', type: 'multiple_choice', questionKey: 'data.tasks.g4m_md3_q2', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4m_md3_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4m_md3_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4m_md3_q2_c', correct: false }] },
          { id: 'g4m-md-l3-t3', type: 'multiple_choice', questionKey: 'data.tasks.g4m_md3_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4m_md3_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4m_md3_q3_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4m_md3_q3_c', correct: false }] },
          { id: 'g4m-md-l3-t4', type: 'input', questionKey: 'data.tasks.g4m_md3_q4', difficulty: 1, answer: "Да" },
        ] },
      ] },
      { id: 'g4m-colmult', worldId: 'g4math', titleKey: 'data.topics.g4mColMult', subject: 'math', lessons: [
        { id: 'g4m-cm-l1', topicId: 'g4m-colmult', titleKey: 'data.lessons.g4mCmL1', reward: { xp: 30 },
          dialog: [
            { speaker: 'tali', textKey: 'data.dialog.g4m_cm_l1_0' },
            { speaker: 'npc', textKey: 'data.dialog.g4m_cm_l1_1' },
          ],
          intro: [
            { titleKey: 'data.intro.g4m_cm_l1_0_t', bodyKey: 'data.intro.g4m_cm_l1_0_b', emoji: '' },
            { titleKey: 'data.intro.g4m_cm_l1_1_t', bodyKey: 'data.intro.g4m_cm_l1_1_b', emoji: '' },
          ],
          tasks: [
          { id: 'g4m-cm-l1-t1', type: 'multiple_choice', questionKey: 'data.tasks.g4m_cm_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4m_cm_q1_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4m_cm_q1_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4m_cm_q1_c', correct: false }] },
          { id: 'g4m-cm-l1-t2', type: 'multiple_choice', questionKey: 'data.tasks.g4m_cm_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4m_cm_q2_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4m_cm_q2_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4m_cm_q2_c', correct: false }] },
          { id: 'g4m-cm-l1-t3', type: 'multiple_choice', questionKey: 'data.tasks.g4m_cm_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4m_cm_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4m_cm_q3_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4m_cm_q3_c', correct: false }] },
          { id: 'g4m-cm-l1-t4', type: 'input', questionKey: 'data.tasks.g4m_cm_q4', difficulty: 1, answer: "Нет, правильно 884" },
        ] },
        { id: 'g4m-cm-l2', topicId: 'g4m-colmult', titleKey: 'data.lessons.g4mCmL2', reward: { xp: 30 },
          dialog: [
            { speaker: 'tali', textKey: 'data.dialog.g4m_cm_l2_0' },
            { speaker: 'npc', textKey: 'data.dialog.g4m_cm_l2_1' },
          ],
          intro: [
            { titleKey: 'data.intro.g4m_cm_l2_0_t', bodyKey: 'data.intro.g4m_cm_l2_0_b', emoji: '' },
            { titleKey: 'data.intro.g4m_cm_l2_1_t', bodyKey: 'data.intro.g4m_cm_l2_1_b', emoji: '' },
          ],
          tasks: [
          { id: 'g4m-cm-l2-t1', type: 'multiple_choice', questionKey: 'data.tasks.g4m_cm2_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4m_cm2_q1_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4m_cm2_q1_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4m_cm2_q1_c', correct: false }] },
          { id: 'g4m-cm-l2-t2', type: 'multiple_choice', questionKey: 'data.tasks.g4m_cm2_q2', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4m_cm2_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4m_cm2_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4m_cm2_q2_c', correct: false }] },
          { id: 'g4m-cm-l2-t3', type: 'multiple_choice', questionKey: 'data.tasks.g4m_cm2_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4m_cm2_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4m_cm2_q3_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4m_cm2_q3_c', correct: false }] },
          { id: 'g4m-cm-l2-t4', type: 'input', questionKey: 'data.tasks.g4m_cm2_q4', difficulty: 1, answer: "<" },
        ] },
        { id: 'g4m-cm-l3', topicId: 'g4m-colmult', titleKey: 'data.lessons.g4mCmL3', reward: { xp: 30 },
          dialog: [
            { speaker: 'tali', textKey: 'data.dialog.g4m_cm_l3_0' },
            { speaker: 'npc', textKey: 'data.dialog.g4m_cm_l3_1' },
          ],
          intro: [
            { titleKey: 'data.intro.g4m_cm_l3_0_t', bodyKey: 'data.intro.g4m_cm_l3_0_b', emoji: '' },
            { titleKey: 'data.intro.g4m_cm_l3_1_t', bodyKey: 'data.intro.g4m_cm_l3_1_b', emoji: '' },
          ],
          tasks: [
          { id: 'g4m-cm-l3-t1', type: 'multiple_choice', questionKey: 'data.tasks.g4m_cm3_q1', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4m_cm3_q1_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4m_cm3_q1_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4m_cm3_q1_c', correct: false }] },
          { id: 'g4m-cm-l3-t2', type: 'multiple_choice', questionKey: 'data.tasks.g4m_cm3_q2', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4m_cm3_q2_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4m_cm3_q2_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4m_cm3_q2_c', correct: false }] },
          { id: 'g4m-cm-l3-t3', type: 'multiple_choice', questionKey: 'data.tasks.g4m_cm3_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4m_cm3_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4m_cm3_q3_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4m_cm3_q3_c', correct: false }] },
          { id: 'g4m-cm-l3-t4', type: 'input', questionKey: 'data.tasks.g4m_cm3_q4', difficulty: 1, answer: "Два" },
        ] },
      ] },
      { id: 'g4m-fractions', worldId: 'g4math', titleKey: 'data.topics.g4mFractions', subject: 'math', lessons: [
        { id: 'g4m-fr-l1', topicId: 'g4m-fractions', titleKey: 'data.lessons.g4mFrL1', reward: { xp: 30 },
          dialog: [
            { speaker: 'tali', textKey: 'data.dialog.g4m_fr_l1_0' },
            { speaker: 'npc', textKey: 'data.dialog.g4m_fr_l1_1' },
          ],
          intro: [
            { titleKey: 'data.intro.g4m_fr_l1_0_t', bodyKey: 'data.intro.g4m_fr_l1_0_b', emoji: '' },
            { titleKey: 'data.intro.g4m_fr_l1_1_t', bodyKey: 'data.intro.g4m_fr_l1_1_b', emoji: '' },
          ],
          tasks: [
          { id: 'g4m-fr-l1-t1', type: 'multiple_choice', questionKey: 'data.tasks.g4m_fr_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4m_fr_q1_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4m_fr_q1_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4m_fr_q1_c', correct: false }] },
          { id: 'g4m-fr-l1-t2', type: 'multiple_choice', questionKey: 'data.tasks.g4m_fr_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4m_fr_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4m_fr_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4m_fr_q2_c', correct: false }] },
          { id: 'g4m-fr-l1-t3', type: 'multiple_choice', questionKey: 'data.tasks.g4m_fr_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4m_fr_q3_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4m_fr_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4m_fr_q3_c', correct: false }] },
          { id: 'g4m-fr-l1-t4', type: 'input', questionKey: 'data.tasks.g4m_fr_q4', difficulty: 1, answer: "Да, верно" },
        ] },
        { id: 'g4m-fr-l2', topicId: 'g4m-fractions', titleKey: 'data.lessons.g4mFrL2', reward: { xp: 30 },
          dialog: [
            { speaker: 'tali', textKey: 'data.dialog.g4m_fr_l2_0' },
            { speaker: 'npc', textKey: 'data.dialog.g4m_fr_l2_1' },
          ],
          intro: [
            { titleKey: 'data.intro.g4m_fr_l2_0_t', bodyKey: 'data.intro.g4m_fr_l2_0_b', emoji: '' },
            { titleKey: 'data.intro.g4m_fr_l2_1_t', bodyKey: 'data.intro.g4m_fr_l2_1_b', emoji: '' },
          ],
          tasks: [
          { id: 'g4m-fr-l2-t1', type: 'multiple_choice', questionKey: 'data.tasks.g4m_fr2_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4m_fr2_q1_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4m_fr2_q1_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4m_fr2_q1_c', correct: false }] },
          { id: 'g4m-fr-l2-t2', type: 'multiple_choice', questionKey: 'data.tasks.g4m_fr2_q2', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4m_fr2_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4m_fr2_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4m_fr2_q2_c', correct: false }] },
          { id: 'g4m-fr-l2-t3', type: 'multiple_choice', questionKey: 'data.tasks.g4m_fr2_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4m_fr2_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4m_fr2_q3_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4m_fr2_q3_c', correct: false }] },
          { id: 'g4m-fr-l2-t4', type: 'input', questionKey: 'data.tasks.g4m_fr2_q4', difficulty: 1, answer: "5" },
        ] },
        { id: 'g4m-fr-l3', topicId: 'g4m-fractions', titleKey: 'data.lessons.g4mFrL3', reward: { xp: 30 },
          dialog: [
            { speaker: 'tali', textKey: 'data.dialog.g4m_fr_l3_0' },
            { speaker: 'npc', textKey: 'data.dialog.g4m_fr_l3_1' },
          ],
          intro: [
            { titleKey: 'data.intro.g4m_fr_l3_0_t', bodyKey: 'data.intro.g4m_fr_l3_0_b', emoji: '' },
            { titleKey: 'data.intro.g4m_fr_l3_1_t', bodyKey: 'data.intro.g4m_fr_l3_1_b', emoji: '' },
          ],
          tasks: [
          { id: 'g4m-fr-l3-t1', type: 'multiple_choice', questionKey: 'data.tasks.g4m_fr3_q1', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4m_fr3_q1_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4m_fr3_q1_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4m_fr3_q1_c', correct: false }] },
          { id: 'g4m-fr-l3-t2', type: 'multiple_choice', questionKey: 'data.tasks.g4m_fr3_q2', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4m_fr3_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4m_fr3_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4m_fr3_q2_c', correct: false }] },
          { id: 'g4m-fr-l3-t3', type: 'multiple_choice', questionKey: 'data.tasks.g4m_fr3_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4m_fr3_q3_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4m_fr3_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4m_fr3_q3_c', correct: false }] },
          { id: 'g4m-fr-l3-t4', type: 'input', questionKey: 'data.tasks.g4m_fr3_q4', difficulty: 1, answer: "Digit" },
        ] },
      ] },
    ],
  },
  {
    id: 'g4rus', titleKey: 'data.worlds.g4rus', descriptionKey: 'data.worldDesc.g4rus',
    biome: 'library', accentColor: '#7C4DFF', npcEmoji: '', ageBand: '9-10', npcName: 'Слово',
    topics: [
      { id: 'g4r-conjugation', worldId: 'g4rus', titleKey: 'data.topics.g4rConjugation', subject: 'reading_ru', lessons: [
        { id: 'g4r-conj-l1', topicId: 'g4r-conjugation', titleKey: 'data.lessons.g4rConjL1', reward: { xp: 30 },
          dialog: [
            { speaker: 'npc', textKey: 'data.dialog.g4r_conj_l1_0' },
            { speaker: 'tali', textKey: 'data.dialog.g4r_conj_l1_1' },
          ],
          intro: [
            { titleKey: 'data.intro.g4r_conj_l1_0_t', bodyKey: 'data.intro.g4r_conj_l1_0_b', emoji: '' },
            { titleKey: 'data.intro.g4r_conj_l1_1_t', bodyKey: 'data.intro.g4r_conj_l1_1_b', emoji: '' },
          ],
          tasks: [
          { id: 'g4r-conj-l1-t1', type: 'multiple_choice', questionKey: 'data.tasks.g4r_conj_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4r_conj_q1_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4r_conj_q1_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4r_conj_q1_c', correct: false }] },
          { id: 'g4r-conj-l1-t2', type: 'multiple_choice', questionKey: 'data.tasks.g4r_conj_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4r_conj_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4r_conj_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4r_conj_q2_c', correct: false }] },
          { id: 'g4r-conj-l1-t3', type: 'fill_blank', questionKey: 'data.tasks.g4r_conj_l1_fb_sent', difficulty: 2, sentenceKey: 'data.tasks.g4r_conj_l1_fb_sent', options: [{ id: 'fb-a', textKey: 'data.tasks.g4r_conj_l1_fb_a', correct: false }, { id: 'fb-b', textKey: 'data.tasks.g4r_conj_l1_fb_b', correct: true }, { id: 'fb-c', textKey: 'data.tasks.g4r_conj_l1_fb_c', correct: false }] },
          { id: 'g4r-conj-l1-t4', type: 'multiple_choice', questionKey: 'data.tasks.g4r_conj_q4', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4r_conj_q4_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4r_conj_q4_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4r_conj_q4_c', correct: false }] },
        ] },
        { id: 'g4r-conj-l2', topicId: 'g4r-conjugation', titleKey: 'data.lessons.g4rConjL2', reward: { xp: 30 },
          dialog: [
            { speaker: 'tali', textKey: 'data.dialog.g4r_conj_l2_0' },
            { speaker: 'npc', textKey: 'data.dialog.g4r_conj_l2_1' },
          ],
          intro: [
            { titleKey: 'data.intro.g4r_conj_l2_0_t', bodyKey: 'data.intro.g4r_conj_l2_0_b', emoji: '' },
            { titleKey: 'data.intro.g4r_conj_l2_1_t', bodyKey: 'data.intro.g4r_conj_l2_1_b', emoji: '' },
          ],
          tasks: [
          { id: 'g4r-conj-l2-t1', type: 'multiple_choice', questionKey: 'data.tasks.g4r_conj2_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4r_conj2_q1_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4r_conj2_q1_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4r_conj2_q1_c', correct: false }] },
          { id: 'g4r-conj-l2-t2', type: 'multiple_choice', questionKey: 'data.tasks.g4r_conj2_q2', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4r_conj2_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4r_conj2_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4r_conj2_q2_c', correct: false }] },
          { id: 'g4r-conj-l2-t3', type: 'multiple_choice', questionKey: 'data.tasks.g4r_conj2_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4r_conj2_q3_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4r_conj2_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4r_conj2_q3_c', correct: false }] },
          { id: 'g4r-conj-l2-t4', type: 'input', questionKey: 'data.tasks.g4r_conj2_q4', difficulty: 1, answer: "идут" },
        ] },
        { id: 'g4r-conj-l3', topicId: 'g4r-conjugation', titleKey: 'data.lessons.g4rConjL3', reward: { xp: 30 },
          dialog: [
            { speaker: 'tali', textKey: 'data.dialog.g4r_conj_l3_0' },
            { speaker: 'npc', textKey: 'data.dialog.g4r_conj_l3_1' },
          ],
          intro: [
            { titleKey: 'data.intro.g4r_conj_l3_0_t', bodyKey: 'data.intro.g4r_conj_l3_0_b', emoji: '' },
            { titleKey: 'data.intro.g4r_conj_l3_1_t', bodyKey: 'data.intro.g4r_conj_l3_1_b', emoji: '' },
          ],
          tasks: [
          { id: 'g4r-conj-l3-t1', type: 'multiple_choice', questionKey: 'data.tasks.g4r_conj3_q1', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4r_conj3_q1_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4r_conj3_q1_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4r_conj3_q1_c', correct: false }] },
          { id: 'g4r-conj-l3-t2', type: 'multiple_choice', questionKey: 'data.tasks.g4r_conj3_q2', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4r_conj3_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4r_conj3_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4r_conj3_q2_c', correct: false }] },
          { id: 'g4r-conj-l3-t3', type: 'multiple_choice', questionKey: 'data.tasks.g4r_conj3_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4r_conj3_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4r_conj3_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4r_conj3_q3_c', correct: true }] },
          { id: 'g4r-conj-l3-t4', type: 'input', questionKey: 'data.tasks.g4r_conj3_q4', difficulty: 1, answer: "По" },
        ] },
      ] },
      { id: 'g4r-cases', worldId: 'g4rus', titleKey: 'data.topics.g4rCases', subject: 'reading_ru', lessons: [
        { id: 'g4r-cases-l1', topicId: 'g4r-cases', titleKey: 'data.lessons.g4rCasesL1', reward: { xp: 30 },
          dialog: [
            { speaker: 'tali', textKey: 'data.dialog.g4r_cases_l1_0' },
            { speaker: 'npc', textKey: 'data.dialog.g4r_cases_l1_1' },
          ],
          intro: [
            { titleKey: 'data.intro.g4r_cases_l1_0_t', bodyKey: 'data.intro.g4r_cases_l1_0_b', emoji: '' },
            { titleKey: 'data.intro.g4r_cases_l1_1_t', bodyKey: 'data.intro.g4r_cases_l1_1_b', emoji: '' },
          ],
          tasks: [
          { id: 'g4r-cases-l1-t1', type: 'multiple_choice', questionKey: 'data.tasks.g4r_cases_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4r_cases_q1_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4r_cases_q1_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4r_cases_q1_c', correct: false }] },
          { id: 'g4r-cases-l1-t2', type: 'multiple_choice', questionKey: 'data.tasks.g4r_cases_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4r_cases_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4r_cases_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4r_cases_q2_c', correct: false }] },
          { id: 'g4r-cases-l1-t3', type: 'fill_blank', questionKey: 'data.tasks.g4r_cases_l1_fb_sent', difficulty: 2, sentenceKey: 'data.tasks.g4r_cases_l1_fb_sent', options: [{ id: 'fb-a', textKey: 'data.tasks.g4r_cases_q3_a', correct: false }, { id: 'fb-b', textKey: 'data.tasks.g4r_cases_q3_b', correct: false }, { id: 'fb-c', textKey: 'data.tasks.g4r_cases_q3_c', correct: true }] },
          { id: 'g4r-cases-l1-t4', type: 'multiple_choice', questionKey: 'data.tasks.g4r_cases_q4', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4r_cases_q4_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4r_cases_q4_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4r_cases_q4_c', correct: false }] },
        ] },
        { id: 'g4r-cases-l2', topicId: 'g4r-cases', titleKey: 'data.lessons.g4rCasesL2', reward: { xp: 30 },
          dialog: [
            { speaker: 'tali', textKey: 'data.dialog.g4r_cases_l2_0' },
            { speaker: 'npc', textKey: 'data.dialog.g4r_cases_l2_1' },
          ],
          intro: [
            { titleKey: 'data.intro.g4r_cases_l2_0_t', bodyKey: 'data.intro.g4r_cases_l2_0_b', emoji: '' },
            { titleKey: 'data.intro.g4r_cases_l2_1_t', bodyKey: 'data.intro.g4r_cases_l2_1_b', emoji: '' },
          ],
          tasks: [
          { id: 'g4r-cases-l2-t1', type: 'multiple_choice', questionKey: 'data.tasks.g4r_cases2_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4r_cases2_q1_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4r_cases2_q1_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4r_cases2_q1_c', correct: false }] },
          { id: 'g4r-cases-l2-t2', type: 'multiple_choice', questionKey: 'data.tasks.g4r_cases2_q2', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4r_cases2_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4r_cases2_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4r_cases2_q2_c', correct: false }] },
          { id: 'g4r-cases-l2-t3', type: 'multiple_choice', questionKey: 'data.tasks.g4r_cases2_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4r_cases2_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4r_cases2_q3_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4r_cases2_q3_c', correct: false }] },
          { id: 'g4r-cases-l2-t4', type: 'input', questionKey: 'data.tasks.g4r_cases2_q4', difficulty: 1, answer: "маме" },
        ] },
        { id: 'g4r-cases-l3', topicId: 'g4r-cases', titleKey: 'data.lessons.g4rCasesL3', reward: { xp: 30 },
          dialog: [
            { speaker: 'tali', textKey: 'data.dialog.g4r_cases_l3_0' },
            { speaker: 'npc', textKey: 'data.dialog.g4r_cases_l3_1' },
          ],
          intro: [
            { titleKey: 'data.intro.g4r_cases_l3_0_t', bodyKey: 'data.intro.g4r_cases_l3_0_b', emoji: '' },
            { titleKey: 'data.intro.g4r_cases_l3_1_t', bodyKey: 'data.intro.g4r_cases_l3_1_b', emoji: '' },
          ],
          tasks: [
          { id: 'g4r-cases-l3-t1', type: 'multiple_choice', questionKey: 'data.tasks.g4r_cases3_q1', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4r_cases3_q1_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4r_cases3_q1_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4r_cases3_q1_c', correct: false }] },
          { id: 'g4r-cases-l3-t2', type: 'multiple_choice', questionKey: 'data.tasks.g4r_cases3_q2', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4r_cases3_q2_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4r_cases3_q2_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4r_cases3_q2_c', correct: false }] },
          { id: 'g4r-cases-l3-t3', type: 'multiple_choice', questionKey: 'data.tasks.g4r_cases3_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4r_cases3_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4r_cases3_q3_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4r_cases3_q3_c', correct: false }] },
          { id: 'g4r-cases-l3-t4', type: 'input', questionKey: 'data.tasks.g4r_cases3_q4', difficulty: 1, answer: "Творительный (5-й)" },
        ] },
      ] },
      { id: 'g4r-text', worldId: 'g4rus', titleKey: 'data.topics.g4rText', subject: 'reading_ru', lessons: [
        { id: 'g4r-text-l1', topicId: 'g4r-text', titleKey: 'data.lessons.g4rTextL1', reward: { xp: 30 },
          dialog: [
            { speaker: 'tali', textKey: 'data.dialog.g4r_text_l1_0' },
            { speaker: 'npc', textKey: 'data.dialog.g4r_text_l1_1' },
          ],
          intro: [
            { titleKey: 'data.intro.g4r_text_l1_0_t', bodyKey: 'data.intro.g4r_text_l1_0_b', emoji: '' },
            { titleKey: 'data.intro.g4r_text_l1_1_t', bodyKey: 'data.intro.g4r_text_l1_1_b', emoji: '' },
          ],
          tasks: [
          { id: 'g4r-text-l1-t1', type: 'multiple_choice', questionKey: 'data.tasks.g4r_text_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4r_text_q1_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4r_text_q1_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4r_text_q1_c', correct: false }] },
          { id: 'g4r-text-l1-t2', type: 'multiple_choice', questionKey: 'data.tasks.g4r_text_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4r_text_q2_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4r_text_q2_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4r_text_q2_c', correct: false }] },
          { id: 'g4r-text-l1-t3', type: 'multiple_choice', questionKey: 'data.tasks.g4r_text_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4r_text_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4r_text_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4r_text_q3_c', correct: true }] },
          { id: 'g4r-text-l1-t4', type: 'input', questionKey: 'data.tasks.g4r_text_q4', difficulty: 1, answer: "завязка (начало)" },
        ] },
        { id: 'g4r-text-l2', topicId: 'g4r-text', titleKey: 'data.lessons.g4rTextL2', reward: { xp: 30 },
          dialog: [
            { speaker: 'tali', textKey: 'data.dialog.g4r_text_l2_0' },
            { speaker: 'npc', textKey: 'data.dialog.g4r_text_l2_1' },
          ],
          intro: [
            { titleKey: 'data.intro.g4r_text_l2_0_t', bodyKey: 'data.intro.g4r_text_l2_0_b', emoji: '' },
            { titleKey: 'data.intro.g4r_text_l2_1_t', bodyKey: 'data.intro.g4r_text_l2_1_b', emoji: '' },
          ],
          tasks: [
          { id: 'g4r-text-l2-t1', type: 'multiple_choice', questionKey: 'data.tasks.g4r_text2_q1', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4r_text2_q1_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4r_text2_q1_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4r_text2_q1_c', correct: false }] },
          { id: 'g4r-text-l2-t2', type: 'multiple_choice', questionKey: 'data.tasks.g4r_text2_q2', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4r_text2_q2_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4r_text2_q2_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4r_text2_q2_c', correct: false }] },
          { id: 'g4r-text-l2-t3', type: 'multiple_choice', questionKey: 'data.tasks.g4r_text2_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4r_text2_q3_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4r_text2_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4r_text2_q3_c', correct: false }] },
          { id: 'g4r-text-l2-t4', type: 'input', questionKey: 'data.tasks.g4r_text2_q4', difficulty: 1, answer: "Нет" },
        ] },
        { id: 'g4r-text-l3', topicId: 'g4r-text', titleKey: 'data.lessons.g4rTextL3', reward: { xp: 30 },
          dialog: [
            { speaker: 'tali', textKey: 'data.dialog.g4r_text_l3_0' },
            { speaker: 'npc', textKey: 'data.dialog.g4r_text_l3_1' },
          ],
          intro: [
            { titleKey: 'data.intro.g4r_text_l3_0_t', bodyKey: 'data.intro.g4r_text_l3_0_b', emoji: '' },
            { titleKey: 'data.intro.g4r_text_l3_1_t', bodyKey: 'data.intro.g4r_text_l3_1_b', emoji: '' },
          ],
          tasks: [
          { id: 'g4r-text-l3-t1', type: 'multiple_choice', questionKey: 'data.tasks.g4r_text3_q1', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4r_text3_q1_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4r_text3_q1_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4r_text3_q1_c', correct: true }] },
          { id: 'g4r-text-l3-t2', type: 'multiple_choice', questionKey: 'data.tasks.g4r_text3_q2', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4r_text3_q2_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4r_text3_q2_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4r_text3_q2_c', correct: false }] },
          { id: 'g4r-text-l3-t3', type: 'multiple_choice', questionKey: 'data.tasks.g4r_text3_q3', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4r_text3_q3_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4r_text3_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4r_text3_q3_c', correct: false }] },
          { id: 'g4r-text-l3-t4', type: 'input', questionKey: 'data.tasks.g4r_text3_q4', difficulty: 1, answer: "Потом…" },
        ] },
      ] },
    ],
  },
  {
    id: 'g4eng', titleKey: 'data.worlds.g4eng', descriptionKey: 'data.worldDesc.g4eng',
    biome: 'campus', accentColor: '#00ACC1', npcEmoji: '', ageBand: '9-10', npcName: 'Spark',
    topics: [
      { id: 'g4e-present', worldId: 'g4eng', titleKey: 'data.topics.g4ePresent', subject: 'reading', lessons: [
        { id: 'g4e-pres-l1', topicId: 'g4e-present', titleKey: 'data.lessons.g4ePresL1', reward: { xp: 30 },
          dialog: [
            { speaker: 'npc', textKey: 'data.dialog.g4e_pres_l1_0' },
            { speaker: 'tali', textKey: 'data.dialog.g4e_pres_l1_1' },
          ],
          intro: [
            { titleKey: 'data.intro.g4e_pres_l1_0_t', bodyKey: 'data.intro.g4e_pres_l1_0_b', emoji: '' },
            { titleKey: 'data.intro.g4e_pres_l1_1_t', bodyKey: 'data.intro.g4e_pres_l1_1_b', emoji: '' },
          ],
          tasks: [
          { id: 'g4e-pres-l1-t1', type: 'multiple_choice', questionKey: 'data.tasks.g4e_pres_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4e_pres_q1_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4e_pres_q1_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4e_pres_q1_c', correct: false }] },
          { id: 'g4e-pres-l1-t2', type: 'multiple_choice', questionKey: 'data.tasks.g4e_pres_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4e_pres_q2_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4e_pres_q2_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4e_pres_q2_c', correct: false }] },
          { id: 'g4e-pres-l1-t3', type: 'fill_blank', questionKey: 'data.tasks.g4e_pres_l1_fb_sent', difficulty: 2, sentenceKey: 'data.tasks.g4e_pres_l1_fb_sent', options: [{ id: 'fb-a', textKey: 'data.tasks.g4e_pres_q3_a', correct: false }, { id: 'fb-b', textKey: 'data.tasks.g4e_pres_q3_b', correct: true }, { id: 'fb-c', textKey: 'data.tasks.g4e_pres_q3_c', correct: false }] },
          { id: 'g4e-pres-l1-t4', type: 'input', questionKey: 'data.tasks.g4e_pres_q4', difficulty: 1, answer: "I" },
        ] },
        { id: 'g4e-pres-l2', topicId: 'g4e-present', titleKey: 'data.lessons.g4ePresL2', reward: { xp: 30 },
          dialog: [
            { speaker: 'tali', textKey: 'data.dialog.g4e_pres_l2_0' },
            { speaker: 'npc', textKey: 'data.dialog.g4e_pres_l2_1' },
          ],
          intro: [
            { titleKey: 'data.intro.g4e_pres_l2_0_t', bodyKey: 'data.intro.g4e_pres_l2_0_b', emoji: '' },
            { titleKey: 'data.intro.g4e_pres_l2_1_t', bodyKey: 'data.intro.g4e_pres_l2_1_b', emoji: '' },
          ],
          tasks: [
          { id: 'g4e-pres-l2-t1', type: 'multiple_choice', questionKey: 'data.tasks.g4e_pres2_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4e_pres2_q1_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4e_pres2_q1_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4e_pres2_q1_c', correct: false }] },
          { id: 'g4e-pres-l2-t2', type: 'multiple_choice', questionKey: 'data.tasks.g4e_pres2_q2', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4e_pres2_q2_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4e_pres2_q2_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4e_pres2_q2_c', correct: false }] },
          { id: 'g4e-pres-l2-t3', type: 'multiple_choice', questionKey: 'data.tasks.g4e_pres2_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4e_pres2_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4e_pres2_q3_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4e_pres2_q3_c', correct: false }] },
          { id: 'g4e-pres-l2-t4', type: 'input', questionKey: 'data.tasks.g4e_pres2_q4', difficulty: 1, answer: "They don't watch TV in the evening" },
        ] },
        { id: 'g4e-pres-l3', topicId: 'g4e-present', titleKey: 'data.lessons.g4ePresL3', reward: { xp: 30 },
          dialog: [
            { speaker: 'tali', textKey: 'data.dialog.g4e_pres_l3_0' },
            { speaker: 'npc', textKey: 'data.dialog.g4e_pres_l3_1' },
          ],
          intro: [
            { titleKey: 'data.intro.g4e_pres_l3_0_t', bodyKey: 'data.intro.g4e_pres_l3_0_b', emoji: '' },
            { titleKey: 'data.intro.g4e_pres_l3_1_t', bodyKey: 'data.intro.g4e_pres_l3_1_b', emoji: '' },
          ],
          tasks: [
          { id: 'g4e-pres-l3-t1', type: 'multiple_choice', questionKey: 'data.tasks.g4e_pres3_q1', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4e_pres3_q1_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4e_pres3_q1_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4e_pres3_q1_c', correct: false }] },
          { id: 'g4e-pres-l3-t2', type: 'multiple_choice', questionKey: 'data.tasks.g4e_pres3_q2', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4e_pres3_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4e_pres3_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4e_pres3_q2_c', correct: false }] },
          { id: 'g4e-pres-l3-t3', type: 'multiple_choice', questionKey: 'data.tasks.g4e_pres3_q3', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4e_pres3_q3_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4e_pres3_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4e_pres3_q3_c', correct: false }] },
          { id: 'g4e-pres-l3-t4', type: 'input', questionKey: 'data.tasks.g4e_pres3_q4', difficulty: 1, answer: "Is" },
        ] },
      ] },
      { id: 'g4e-past', worldId: 'g4eng', titleKey: 'data.topics.g4ePast', subject: 'reading', lessons: [
        { id: 'g4e-past-l1', topicId: 'g4e-past', titleKey: 'data.lessons.g4ePastL1', reward: { xp: 30 },
          dialog: [
            { speaker: 'tali', textKey: 'data.dialog.g4e_past_l1_0' },
            { speaker: 'npc', textKey: 'data.dialog.g4e_past_l1_1' },
          ],
          intro: [
            { titleKey: 'data.intro.g4e_past_l1_0_t', bodyKey: 'data.intro.g4e_past_l1_0_b', emoji: '' },
            { titleKey: 'data.intro.g4e_past_l1_1_t', bodyKey: 'data.intro.g4e_past_l1_1_b', emoji: '' },
          ],
          tasks: [
          { id: 'g4e-past-l1-t1', type: 'multiple_choice', questionKey: 'data.tasks.g4e_past_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4e_past_q1_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4e_past_q1_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4e_past_q1_c', correct: false }] },
          { id: 'g4e-past-l1-t2', type: 'multiple_choice', questionKey: 'data.tasks.g4e_past_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4e_past_q2_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4e_past_q2_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4e_past_q2_c', correct: false }] },
          { id: 'g4e-past-l1-t3', type: 'multiple_choice', questionKey: 'data.tasks.g4e_past_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4e_past_q3_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4e_past_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4e_past_q3_c', correct: false }] },
          { id: 'g4e-past-l1-t4', type: 'input', questionKey: 'data.tasks.g4e_past_q4', difficulty: 2, answer: "played" },
        ] },
        { id: 'g4e-past-l2', topicId: 'g4e-past', titleKey: 'data.lessons.g4ePastL2', reward: { xp: 30 },
          dialog: [
            { speaker: 'tali', textKey: 'data.dialog.g4e_past_l2_0' },
            { speaker: 'npc', textKey: 'data.dialog.g4e_past_l2_1' },
          ],
          intro: [
            { titleKey: 'data.intro.g4e_past_l2_0_t', bodyKey: 'data.intro.g4e_past_l2_0_b', emoji: '' },
            { titleKey: 'data.intro.g4e_past_l2_1_t', bodyKey: 'data.intro.g4e_past_l2_1_b', emoji: '' },
          ],
          tasks: [
          { id: 'g4e-past-l2-t1', type: 'multiple_choice', questionKey: 'data.tasks.g4e_past2_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4e_past2_q1_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4e_past2_q1_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4e_past2_q1_c', correct: false }] },
          { id: 'g4e-past-l2-t2', type: 'multiple_choice', questionKey: 'data.tasks.g4e_past2_q2', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4e_past2_q2_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4e_past2_q2_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4e_past2_q2_c', correct: false }] },
          { id: 'g4e-past-l2-t3', type: 'multiple_choice', questionKey: 'data.tasks.g4e_past2_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4e_past2_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4e_past2_q3_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4e_past2_q3_c', correct: false }] },
          { id: 'g4e-past-l2-t4', type: 'input', questionKey: 'data.tasks.g4e_past2_q4', difficulty: 1, answer: "walk" },
        ] },
        { id: 'g4e-past-l3', topicId: 'g4e-past', titleKey: 'data.lessons.g4ePastL3', reward: { xp: 30 },
          dialog: [
            { speaker: 'tali', textKey: 'data.dialog.g4e_past_l3_0' },
            { speaker: 'npc', textKey: 'data.dialog.g4e_past_l3_1' },
          ],
          intro: [
            { titleKey: 'data.intro.g4e_past_l3_0_t', bodyKey: 'data.intro.g4e_past_l3_0_b', emoji: '' },
            { titleKey: 'data.intro.g4e_past_l3_1_t', bodyKey: 'data.intro.g4e_past_l3_1_b', emoji: '' },
          ],
          tasks: [
          { id: 'g4e-past-l3-t1', type: 'multiple_choice', questionKey: 'data.tasks.g4e_past3_q1', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4e_past3_q1_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4e_past3_q1_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4e_past3_q1_c', correct: false }] },
          { id: 'g4e-past-l3-t2', type: 'multiple_choice', questionKey: 'data.tasks.g4e_past3_q2', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4e_past3_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4e_past3_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4e_past3_q2_c', correct: false }] },
          { id: 'g4e-past-l3-t3', type: 'multiple_choice', questionKey: 'data.tasks.g4e_past3_q3', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4e_past3_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4e_past3_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4e_past3_q3_c', correct: true }] },
          { id: 'g4e-past-l3-t4', type: 'input', questionKey: 'data.tasks.g4e_past3_q4', difficulty: 1, answer: "She didn't write a letter yesterday" },
        ] },
      ] },
      { id: 'g4e-questions', worldId: 'g4eng', titleKey: 'data.topics.g4eQuestions', subject: 'reading', lessons: [
        { id: 'g4e-quest-l1', topicId: 'g4e-questions', titleKey: 'data.lessons.g4eQuestL1', reward: { xp: 30 },
          dialog: [
            { speaker: 'tali', textKey: 'data.dialog.g4e_quest_l1_0' },
            { speaker: 'npc', textKey: 'data.dialog.g4e_quest_l1_1' },
          ],
          intro: [
            { titleKey: 'data.intro.g4e_quest_l1_0_t', bodyKey: 'data.intro.g4e_quest_l1_0_b', emoji: '' },
            { titleKey: 'data.intro.g4e_quest_l1_1_t', bodyKey: 'data.intro.g4e_quest_l1_1_b', emoji: '' },
          ],
          tasks: [
          { id: 'g4e-quest-l1-t1', type: 'multiple_choice', questionKey: 'data.tasks.g4e_quest_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4e_quest_q1_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4e_quest_q1_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4e_quest_q1_c', correct: false }] },
          { id: 'g4e-quest-l1-t2', type: 'multiple_choice', questionKey: 'data.tasks.g4e_quest_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4e_quest_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4e_quest_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4e_quest_q2_c', correct: false }] },
          { id: 'g4e-quest-l1-t3', type: 'multiple_choice', questionKey: 'data.tasks.g4e_quest_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4e_quest_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4e_quest_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4e_quest_q3_c', correct: true }] },
          { id: 'g4e-quest-l1-t4', type: 'input', questionKey: 'data.tasks.g4e_quest_q4', difficulty: 2, answer: "Do" },
        ] },
        { id: 'g4e-quest-l2', topicId: 'g4e-questions', titleKey: 'data.lessons.g4eQuestL2', reward: { xp: 30 },
          dialog: [
            { speaker: 'tali', textKey: 'data.dialog.g4e_quest_l2_0' },
            { speaker: 'npc', textKey: 'data.dialog.g4e_quest_l2_1' },
          ],
          intro: [
            { titleKey: 'data.intro.g4e_quest_l2_0_t', bodyKey: 'data.intro.g4e_quest_l2_0_b', emoji: '' },
            { titleKey: 'data.intro.g4e_quest_l2_1_t', bodyKey: 'data.intro.g4e_quest_l2_1_b', emoji: '' },
          ],
          tasks: [
          { id: 'g4e-quest-l2-t1', type: 'multiple_choice', questionKey: 'data.tasks.g4e_quest2_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4e_quest2_q1_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4e_quest2_q1_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4e_quest2_q1_c', correct: true }] },
          { id: 'g4e-quest-l2-t2', type: 'multiple_choice', questionKey: 'data.tasks.g4e_quest2_q2', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4e_quest2_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4e_quest2_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4e_quest2_q2_c', correct: false }] },
          { id: 'g4e-quest-l2-t3', type: 'multiple_choice', questionKey: 'data.tasks.g4e_quest2_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4e_quest2_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4e_quest2_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4e_quest2_q3_c', correct: true }] },
          { id: 'g4e-quest-l2-t4', type: 'input', questionKey: 'data.tasks.g4e_quest2_q4', difficulty: 1, answer: "Why" },
        ] },
        { id: 'g4e-quest-l3', topicId: 'g4e-questions', titleKey: 'data.lessons.g4eQuestL3', reward: { xp: 30 },
          dialog: [
            { speaker: 'tali', textKey: 'data.dialog.g4e_quest_l3_0' },
            { speaker: 'npc', textKey: 'data.dialog.g4e_quest_l3_1' },
          ],
          intro: [
            { titleKey: 'data.intro.g4e_quest_l3_0_t', bodyKey: 'data.intro.g4e_quest_l3_0_b', emoji: '' },
            { titleKey: 'data.intro.g4e_quest_l3_1_t', bodyKey: 'data.intro.g4e_quest_l3_1_b', emoji: '' },
          ],
          tasks: [
          { id: 'g4e-quest-l3-t1', type: 'multiple_choice', questionKey: 'data.tasks.g4e_quest3_q1', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4e_quest3_q1_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4e_quest3_q1_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4e_quest3_q1_c', correct: false }] },
          { id: 'g4e-quest-l3-t2', type: 'multiple_choice', questionKey: 'data.tasks.g4e_quest3_q2', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4e_quest3_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4e_quest3_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4e_quest3_q2_c', correct: false }] },
          { id: 'g4e-quest-l3-t3', type: 'multiple_choice', questionKey: 'data.tasks.g4e_quest3_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4e_quest3_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4e_quest3_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4e_quest3_q3_c', correct: true }] },
          { id: 'g4e-quest-l3-t4', type: 'input', questionKey: 'data.tasks.g4e_quest3_q4', difficulty: 1, answer: "Yes, they do." },
        ] },
      ] },
    ],
  },
  {
    id: 'g4social', titleKey: 'data.worlds.g4social', descriptionKey: 'data.worldDesc.g4social',
    biome: 'town', accentColor: '#66BB6A', npcEmoji: '', ageBand: '9-10', npcName: 'Friendly',
    topics: [
      { id: 'g4s-ask-help', worldId: 'g4social', titleKey: 'data.topics.g4sAskHelp', subject: 'social', lessons: [
        { id: 'g4s-help-l1', topicId: 'g4s-ask-help', titleKey: 'data.lessons.g4sHelpL1', reward: { xp: 30 },
          dialog: [
            { speaker: 'npc', textKey: 'data.dialog.g4s_help_l1_0' },
            { speaker: 'tali', textKey: 'data.dialog.g4s_help_l1_1' },
          ],
          intro: [
            { titleKey: 'data.intro.g4s_help_l1_0_t', bodyKey: 'data.intro.g4s_help_l1_0_b', emoji: '' },
            { titleKey: 'data.intro.g4s_help_l1_1_t', bodyKey: 'data.intro.g4s_help_l1_1_b', emoji: '' },
          ],
          tasks: [
          { id: 'g4s-help-l1-t1', type: 'multiple_choice', questionKey: 'data.tasks.g4s_help_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4s_help_q1_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4s_help_q1_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4s_help_q1_c', correct: false }] },
          { id: 'g4s-help-l1-t2', type: 'multiple_choice', questionKey: 'data.tasks.g4s_help_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4s_help_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4s_help_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4s_help_q2_c', correct: false }] },
          { id: 'g4s-help-l1-t3', type: 'multiple_choice', questionKey: 'data.tasks.g4s_help_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4s_help_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4s_help_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4s_help_q3_c', correct: true }] },
          { id: 'g4s-help-l1-t4', type: 'input', questionKey: 'data.tasks.g4s_help_q4', difficulty: 1, answer: "Нет" },
        ] },
        { id: 'g4s-help-l2', topicId: 'g4s-ask-help', titleKey: 'data.lessons.g4sHelpL2', reward: { xp: 30 },
          dialog: [
            { speaker: 'tali', textKey: 'data.dialog.g4s_help_l2_0' },
            { speaker: 'npc', textKey: 'data.dialog.g4s_help_l2_1' },
          ],
          intro: [
            { titleKey: 'data.intro.g4s_help_l2_0_t', bodyKey: 'data.intro.g4s_help_l2_0_b', emoji: '' },
            { titleKey: 'data.intro.g4s_help_l2_1_t', bodyKey: 'data.intro.g4s_help_l2_1_b', emoji: '' },
          ],
          tasks: [
          { id: 'g4s-help-l2-t1', type: 'multiple_choice', questionKey: 'data.tasks.g4s_help2_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4s_help2_q1_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4s_help2_q1_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4s_help2_q1_c', correct: false }] },
          { id: 'g4s-help-l2-t2', type: 'multiple_choice', questionKey: 'data.tasks.g4s_help2_q2', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4s_help2_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4s_help2_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4s_help2_q2_c', correct: false }] },
          { id: 'g4s-help-l2-t3', type: 'multiple_choice', questionKey: 'data.tasks.g4s_help2_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4s_help2_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4s_help2_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4s_help2_q3_c', correct: true }] },
          { id: 'g4s-help-l2-t4', type: 'input', questionKey: 'data.tasks.g4s_help2_q4', difficulty: 1, answer: "пожалуйста" },
        ] },
        { id: 'g4s-help-l3', topicId: 'g4s-ask-help', titleKey: 'data.lessons.g4sHelpL3', reward: { xp: 30 },
          dialog: [
            { speaker: 'tali', textKey: 'data.dialog.g4s_help_l3_0' },
            { speaker: 'npc', textKey: 'data.dialog.g4s_help_l3_1' },
          ],
          intro: [
            { titleKey: 'data.intro.g4s_help_l3_0_t', bodyKey: 'data.intro.g4s_help_l3_0_b', emoji: '' },
            { titleKey: 'data.intro.g4s_help_l3_1_t', bodyKey: 'data.intro.g4s_help_l3_1_b', emoji: '' },
          ],
          tasks: [
          { id: 'g4s-help-l3-t1', type: 'multiple_choice', questionKey: 'data.tasks.g4s_help3_q1', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4s_help3_q1_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4s_help3_q1_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4s_help3_q1_c', correct: false }] },
          { id: 'g4s-help-l3-t2', type: 'multiple_choice', questionKey: 'data.tasks.g4s_help3_q2', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4s_help3_q2_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4s_help3_q2_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4s_help3_q2_c', correct: false }] },
          { id: 'g4s-help-l3-t3', type: 'multiple_choice', questionKey: 'data.tasks.g4s_help3_q3', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4s_help3_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4s_help3_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4s_help3_q3_c', correct: true }] },
          { id: 'g4s-help-l3-t4', type: 'input', questionKey: 'data.tasks.g4s_help3_q4', difficulty: 1, answer: "Подойти" },
        ] },
      ] },
      { id: 'g4s-emotions', worldId: 'g4social', titleKey: 'data.topics.g4sEmotions', subject: 'social', lessons: [
        { id: 'g4s-emo-l1', topicId: 'g4s-emotions', titleKey: 'data.lessons.g4sEmoL1', reward: { xp: 30 },
          dialog: [
            { speaker: 'tali', textKey: 'data.dialog.g4s_emo_l1_0' },
            { speaker: 'npc', textKey: 'data.dialog.g4s_emo_l1_1' },
          ],
          intro: [
            { titleKey: 'data.intro.g4s_emo_l1_0_t', bodyKey: 'data.intro.g4s_emo_l1_0_b', emoji: '' },
            { titleKey: 'data.intro.g4s_emo_l1_1_t', bodyKey: 'data.intro.g4s_emo_l1_1_b', emoji: '' },
          ],
          tasks: [
          { id: 'g4s-emo-l1-t1', type: 'multiple_choice', questionKey: 'data.tasks.g4s_emo_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4s_emo_q1_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4s_emo_q1_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4s_emo_q1_c', correct: false }] },
          { id: 'g4s-emo-l1-t2', type: 'multiple_choice', questionKey: 'data.tasks.g4s_emo_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4s_emo_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4s_emo_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4s_emo_q2_c', correct: false }] },
          { id: 'g4s-emo-l1-t3', type: 'multiple_choice', questionKey: 'data.tasks.g4s_emo_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4s_emo_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4s_emo_q3_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4s_emo_q3_c', correct: false }] },
          { id: 'g4s-emo-l1-t4', type: 'input', questionKey: 'data.tasks.g4s_emo_q4', difficulty: 1, answer: "Радость" },
        ] },
        { id: 'g4s-emo-l2', topicId: 'g4s-emotions', titleKey: 'data.lessons.g4sEmoL2', reward: { xp: 30 },
          dialog: [
            { speaker: 'tali', textKey: 'data.dialog.g4s_emo_l2_0' },
            { speaker: 'npc', textKey: 'data.dialog.g4s_emo_l2_1' },
          ],
          intro: [
            { titleKey: 'data.intro.g4s_emo_l2_0_t', bodyKey: 'data.intro.g4s_emo_l2_0_b', emoji: '' },
            { titleKey: 'data.intro.g4s_emo_l2_1_t', bodyKey: 'data.intro.g4s_emo_l2_1_b', emoji: '' },
          ],
          tasks: [
          { id: 'g4s-emo-l2-t1', type: 'multiple_choice', questionKey: 'data.tasks.g4s_emo2_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4s_emo2_q1_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4s_emo2_q1_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4s_emo2_q1_c', correct: false }] },
          { id: 'g4s-emo-l2-t2', type: 'multiple_choice', questionKey: 'data.tasks.g4s_emo2_q2', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4s_emo2_q2_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4s_emo2_q2_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4s_emo2_q2_c', correct: false }] },
          { id: 'g4s-emo-l2-t3', type: 'fill_blank', questionKey: 'data.tasks.g4s_emo2_fb_sent', difficulty: 2, sentenceKey: 'data.tasks.g4s_emo2_fb_sent', options: [{ id: 'fb-a', textKey: 'data.tasks.g4s_emo2_fb_a', correct: true }, { id: 'fb-b', textKey: 'data.tasks.g4s_emo2_fb_b', correct: false }, { id: 'fb-c', textKey: 'data.tasks.g4s_emo2_fb_c', correct: false }] },
          { id: 'g4s-emo-l2-t4', type: 'multiple_choice', questionKey: 'data.tasks.g4s_emo2_q4', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4s_emo2_q4_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4s_emo2_q4_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4s_emo2_q4_c', correct: false }] },
        ] },
        { id: 'g4s-emo-l3', topicId: 'g4s-emotions', titleKey: 'data.lessons.g4sEmoL3', reward: { xp: 30 },
          dialog: [
            { speaker: 'tali', textKey: 'data.dialog.g4s_emo_l3_0' },
            { speaker: 'npc', textKey: 'data.dialog.g4s_emo_l3_1' },
          ],
          intro: [
            { titleKey: 'data.intro.g4s_emo_l3_0_t', bodyKey: 'data.intro.g4s_emo_l3_0_b', emoji: '' },
            { titleKey: 'data.intro.g4s_emo_l3_1_t', bodyKey: 'data.intro.g4s_emo_l3_1_b', emoji: '' },
          ],
          tasks: [
          { id: 'g4s-emo-l3-t1', type: 'multiple_choice', questionKey: 'data.tasks.g4s_emo3_q1', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4s_emo3_q1_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4s_emo3_q1_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4s_emo3_q1_c', correct: false }] },
          { id: 'g4s-emo-l3-t2', type: 'multiple_choice', questionKey: 'data.tasks.g4s_emo3_q2', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4s_emo3_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4s_emo3_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4s_emo3_q2_c', correct: false }] },
          { id: 'g4s-emo-l3-t3', type: 'multiple_choice', questionKey: 'data.tasks.g4s_emo3_q3', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4s_emo3_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4s_emo3_q3_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4s_emo3_q3_c', correct: false }] },
          { id: 'g4s-emo-l3-t4', type: 'input', questionKey: 'data.tasks.g4s_emo3_q4', difficulty: 1, answer: "Приятное: неожиданный комплимент; неприятное: плохая оценка, которую не ждал" },
        ] },
      ] },
      { id: 'g4s-turn-taking', worldId: 'g4social', titleKey: 'data.topics.g4sTurnTaking', subject: 'social', lessons: [
        { id: 'g4s-turn-l1', topicId: 'g4s-turn-taking', titleKey: 'data.lessons.g4sTurnL1', reward: { xp: 30 },
          dialog: [
            { speaker: 'tali', textKey: 'data.dialog.g4s_turn_l1_0' },
            { speaker: 'npc', textKey: 'data.dialog.g4s_turn_l1_1' },
          ],
          intro: [
            { titleKey: 'data.intro.g4s_turn_l1_0_t', bodyKey: 'data.intro.g4s_turn_l1_0_b', emoji: '' },
            { titleKey: 'data.intro.g4s_turn_l1_1_t', bodyKey: 'data.intro.g4s_turn_l1_1_b', emoji: '' },
          ],
          tasks: [
          { id: 'g4s-turn-l1-t1', type: 'multiple_choice', questionKey: 'data.tasks.g4s_turn_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4s_turn_q1_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4s_turn_q1_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4s_turn_q1_c', correct: false }] },
          { id: 'g4s-turn-l1-t2', type: 'multiple_choice', questionKey: 'data.tasks.g4s_turn_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4s_turn_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4s_turn_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4s_turn_q2_c', correct: false }] },
          { id: 'g4s-turn-l1-t3', type: 'multiple_choice', questionKey: 'data.tasks.g4s_turn_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4s_turn_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4s_turn_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4s_turn_q3_c', correct: true }] },
          { id: 'g4s-turn-l1-t4', type: 'input', questionKey: 'data.tasks.g4s_turn_q4', difficulty: 1, answer: "Договориться" },
        ] },
        { id: 'g4s-turn-l2', topicId: 'g4s-turn-taking', titleKey: 'data.lessons.g4sTurnL2', reward: { xp: 30 },
          dialog: [
            { speaker: 'tali', textKey: 'data.dialog.g4s_turn_l2_0' },
            { speaker: 'npc', textKey: 'data.dialog.g4s_turn_l2_1' },
          ],
          intro: [
            { titleKey: 'data.intro.g4s_turn_l2_0_t', bodyKey: 'data.intro.g4s_turn_l2_0_b', emoji: '' },
            { titleKey: 'data.intro.g4s_turn_l2_1_t', bodyKey: 'data.intro.g4s_turn_l2_1_b', emoji: '' },
          ],
          tasks: [
          { id: 'g4s-turn-l2-t1', type: 'multiple_choice', questionKey: 'data.tasks.g4s_turn2_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4s_turn2_q1_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4s_turn2_q1_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4s_turn2_q1_c', correct: false }] },
          { id: 'g4s-turn-l2-t2', type: 'multiple_choice', questionKey: 'data.tasks.g4s_turn2_q2', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4s_turn2_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4s_turn2_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4s_turn2_q2_c', correct: false }] },
          { id: 'g4s-turn-l2-t3', type: 'multiple_choice', questionKey: 'data.tasks.g4s_turn2_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4s_turn2_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4s_turn2_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4s_turn2_q3_c', correct: true }] },
          { id: 'g4s-turn-l2-t4', type: 'input', questionKey: 'data.tasks.g4s_turn2_q4', difficulty: 1, answer: "Принимает" },
        ] },
        { id: 'g4s-turn-l3', topicId: 'g4s-turn-taking', titleKey: 'data.lessons.g4sTurnL3', reward: { xp: 30 },
          dialog: [
            { speaker: 'tali', textKey: 'data.dialog.g4s_turn_l3_0' },
            { speaker: 'npc', textKey: 'data.dialog.g4s_turn_l3_1' },
          ],
          intro: [
            { titleKey: 'data.intro.g4s_turn_l3_0_t', bodyKey: 'data.intro.g4s_turn_l3_0_b', emoji: '' },
            { titleKey: 'data.intro.g4s_turn_l3_1_t', bodyKey: 'data.intro.g4s_turn_l3_1_b', emoji: '' },
          ],
          tasks: [
          { id: 'g4s-turn-l3-t1', type: 'multiple_choice', questionKey: 'data.tasks.g4s_turn3_q1', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4s_turn3_q1_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4s_turn3_q1_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4s_turn3_q1_c', correct: true }] },
          { id: 'g4s-turn-l3-t2', type: 'multiple_choice', questionKey: 'data.tasks.g4s_turn3_q2', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4s_turn3_q2_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4s_turn3_q2_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4s_turn3_q2_c', correct: false }] },
          { id: 'g4s-turn-l3-t3', type: 'multiple_choice', questionKey: 'data.tasks.g4s_turn3_q3', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4s_turn3_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4s_turn3_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4s_turn3_q3_c', correct: true }] },
          { id: 'g4s-turn-l3-t4', type: 'input', questionKey: 'data.tasks.g4s_turn3_q4', difficulty: 1, answer: "Сначала нужно договориться со всеми" },
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
  math: '',
  reading: '',
  reading_ru: '',
  logic: '',
  social: '',
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
      const emoji = SUBJECT_EMOJI[topic.subject] ?? '';
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

/** Tasks shown in a lesson.
 * - standard profile: standard tasks; if a lesson is ABA-only (showcase), show those so it isn't empty
 * - special (ABA) profile: prefer special_aba rows when present, else standard
 */
function taskAudience(t: LessonTask): TaskAudience {
  return t.audience ?? 'standard';
}

export function filterTasksForProfile(
  tasks: LessonTask[],
  profile: ChildProfileForFilter | null,
): LessonTask[] {
  const isAba = profile?.child_mode === 'special';
  const standard = tasks.filter((t) => taskAudience(t) === 'standard');
  const aba = tasks.filter((t) => taskAudience(t) === 'special_aba');
  if (isAba) {
    return aba.length > 0 ? aba : standard;
  }
  return standard.length > 0 ? standard : aba;
}

/**
 * Every 3rd lesson in a topic inserts one MC task from the previous lesson
 * (spaced reinforcement). Review task keeps a stable `review__` id prefix.
 */
export function withSpacedReviewTasks(
  lessonId: string,
  tasks: LessonTask[],
  profile: ChildProfileForFilter | null,
): LessonTask[] {
  const topic = getTopicForLesson(lessonId);
  if (!topic || tasks.length === 0) return tasks;
  const idx = topic.lessons.findIndex((l) => l.id === lessonId);
  if (idx < 1 || (idx + 1) % 3 !== 0) return tasks;

  const prev = topic.lessons[idx - 1];
  if (!prev) return tasks;
  const prevFiltered = filterTasksForProfile(prev.tasks, profile).filter(
    (t) => t.type === 'multiple_choice' || t.type === 'input',
  );
  if (prevFiltered.length === 0) return tasks;

  const pick = prevFiltered[Math.min(1, prevFiltered.length - 1)]!;
  if (tasks.some((t) => t.id === pick.id || t.id === `review__${pick.id}`)) return tasks;

  const reviewTask: LessonTask = {
    ...pick,
    id: `review__${pick.id}`,
  };
  // After the first new task so the lesson still opens on fresh content.
  return [tasks[0]!, reviewTask, ...tasks.slice(1)];
}





