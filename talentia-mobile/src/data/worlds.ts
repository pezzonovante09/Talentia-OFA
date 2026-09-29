/**
 * Типы форматов заданий и структуры курса.
 *
 * Корпус заданий отсюда удалён целиком: 611 заданий, из которых 579 были
 * одним и тем же «выбери вариант» либо «впиши ответ», а десять остальных
 * форматов существовали по одному разу и все внутри единственного
 * ABA-урока. Чинить такой корпус дороже, чем собрать заново по учебникам.
 *
 * Определения форматов при этом сохранены намеренно: движок их умеет, и
 * следующий этап — вывести их из ABA-гетто в обычные уроки, а не изобретать
 * заново. Новый корпус наполняет `worlds` ниже.
 */
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


/** Пока пусто: корпус пересобирается по учебникам. */
export const worlds: World[] = [];
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





