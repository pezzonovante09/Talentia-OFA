import type { TaskContext } from '../services/companionService';
import type {
  ActionInstructionTask,
  FillBlankTask,
  ImagePointTask,
  ImageWordMatchTask,
  InputTask,
  Lesson,
  LessonTask,
  MultipleChoiceTask,
  Topic,
  VolumeControlTask,
  VocalImitationTask,
  WordRepetitionTask,
  WorldKnowledgeTask,
} from '../data/worlds';

type Translate = (key: string) => string;

/**
 * Builds structured task context for /api/tali (question, options, confidential correct answer).
 * Mirrors lesson screen logic used for ABA hints.
 */
export function lessonTaskToCompanionContext(params: {
  task: LessonTask;
  lesson: Lesson;
  topic: Topic;
  childMode: string;
  methodology: string | null;
  isEnglishLesson: boolean;
  t: Translate;
  tEn: Translate;
  optionText: (textKey: string) => string;
}): TaskContext {
  const { task, lesson, topic, childMode, methodology, isEnglishLesson, t, tEn, optionText } =
    params;

  const answerOptions = ((): string[] | undefined => {
    switch (task.type) {
      case 'multiple_choice':
        return (task as MultipleChoiceTask).options.map((o) => optionText(o.textKey));
      case 'fill_blank':
        return (task as FillBlankTask).options.map((o) => t(o.textKey));
      case 'world_knowledge':
        return (task as WorldKnowledgeTask).options.map((o) =>
          o.textKey ? t(o.textKey) : o.imageKey ?? '',
        );
      case 'image_word_match':
        return (task as ImageWordMatchTask).options.map((o) =>
          o.textKey ? t(o.textKey) : o.imageKey ?? '',
        );
      case 'image_point': {
        const ip = task as ImagePointTask;
        return ip.hotspots
          .map((h) => (h.labelKey ? t(h.labelKey) : h.id))
          .filter(Boolean);
      }
      default:
        return undefined;
    }
  })();

  const correctAnswer = ((): string | undefined => {
    switch (task.type) {
      case 'multiple_choice': {
        const opt = (task as MultipleChoiceTask).options.find((o) => o.correct);
        return opt ? (isEnglishLesson ? tEn(opt.textKey) : t(opt.textKey)) : undefined;
      }
      case 'fill_blank': {
        const opt = (task as FillBlankTask).options.find((o) => o.correct);
        return opt ? t(opt.textKey) : undefined;
      }
      case 'world_knowledge': {
        const opt = (task as WorldKnowledgeTask).options.find((o) => o.correct);
        if (!opt) return undefined;
        return opt.textKey ? t(opt.textKey) : opt.imageKey;
      }
      case 'image_word_match': {
        const opt = (task as ImageWordMatchTask).options.find((o) => o.correct);
        if (!opt) return undefined;
        return opt.textKey ? t(opt.textKey) : opt.imageKey;
      }
      case 'image_point': {
        const h = (task as ImagePointTask).hotspots.find((x) => x.correct);
        return h?.labelKey ? t(h.labelKey) : h?.id;
      }
      case 'input':
        return String((task as InputTask).answer);
      case 'vocal_imitation':
        return t((task as VocalImitationTask).soundTextKey);
      case 'word_repetition':
        return t((task as WordRepetitionTask).wordKey);
      case 'volume_control':
        return (task as VolumeControlTask).direction;
      case 'action_instruction':
        return t((task as ActionInstructionTask).actionKey);
      default:
        return undefined;
    }
  })();

  return {
    questionPrompt: t(task.questionKey),
    answerOptions,
    subjectId: topic.subject,
    topicId: topic.id,
    lessonId: lesson.id,
    childMode,
    methodology,
    correctAnswer,
  };
}
