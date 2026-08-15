import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Pressable, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { MaterialIcons } from '@expo/vector-icons';
import { NanoBananaIcon } from '../../src/components/NanoBananaIcon';
import { NANO_UI, resolveScreenBackground } from '../../src/constants/nanoBananaAssets';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ConsentGate } from '../../src/components/ConsentGate';
import { Screen } from '../../src/components/Screen';
import { ABAReinforcementBanner } from '../../src/components/ABAReinforcementBanner';
import { AppText } from '../../src/components/Text';
import { Spacer } from '../../src/components/Spacer';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { TaliFAB } from '../../src/components/TaliFAB';
import { LessonRepeatSpeechFab } from '../../src/components/LessonRepeatSpeechFab';
import { VoiceInputButton } from '../../src/components/VoiceInputButton';
import { useAppTheme } from '../../src/theme';
import {
  LessonTask,
  MultipleChoiceTask,
  filterTasksForProfile,
  getLesson,
  getTopicForLesson,
  getWorldForLesson,
  withSpacedReviewTasks,
  type FillBlankTask,
  type ImagePointTask,
  type ImageWordMatchTask,
  type RoutineChainTask,
  type SortingTask,
  type WorldKnowledgeTask,
} from '../../src/data/worlds';
import { useProgressStore, getLevelFromXP, isLessonAlreadyCompleted } from '../../src/store/progressStore';
import { useCollectiblesStore, COLLECTIBLES_META } from '../../src/store/collectiblesStore';
import { useAuth } from '../../src/context/AuthContext';
import { useSettingsStore } from '../../src/store/settingsStore';
import { getHint, explainError, type TaskContext } from '../../src/services/companionService';
import { useSpeech } from '../../src/hooks/useSpeech';
import {
  lessonTaskQuestionVoiceKey,
  playLessonTaskVoiceLine,
} from '../../src/services/lessonTaskBundledVoice';
import { mapLanguageCodeToTaliTts, speakViaTali } from '../../src/services/ttsService';
import { getAbaLessonImage } from '../../src/constants/abaLessonImages';
import { VISUAL_COUNT_IMAGE_BY_EMOJI } from '../../src/constants/visualCountEmojiImages';
import { useAbaTokenStore } from '../../src/store/abaTokenStore';
import { useAbaLiveSessionStore } from '../../src/store/abaLiveSessionStore';
import { ABATokenReward } from '../../src/components/ABATokenReward';
import { ABAPuzzleScreen } from '../../src/components/ABAPuzzleScreen';
import { flushAnalyticsQueue } from '../../src/services/analyticsService';
import { syncWithRetry } from '../../src/services/syncStatus';
import { captureException } from '../../src/services/sentry';
import { lessonTaskToCompanionContext } from '../../src/utils/lessonCompanionTaskContext';
import i18nInstance from '../../src/i18n';
import { getAbaTextOverride, resolveLessonTextKey } from '../../src/i18n/resolveLessonText';
import { TASK_FEEDBACK_KEYS_BY_TASK_ID } from '../../src/data/taskFeedbackKeys.generated';
import {
  abaTaskInstructionI18nKey,
  isTherapistLedTask,
  nextAbaPromptLevel,
  reinforcementRateForAgeBand,
  responseWindowMsForAgeBand,
  shuffleArray,
  splitWordSyllables,
} from '../../src/utils/lessonHelpers';
import { IntroPhase } from '../../src/components/lesson/IntroPhase';
import { DialogPhase } from '../../src/components/lesson/DialogPhase';
import { RewardPhase } from '../../src/components/lesson/RewardPhase';
import { BreakReminderModal } from '../../src/components/lesson/BreakReminderModal';
import { defaultBreakReminderMinutesForAgeBand, useBreakReminder } from '../../src/hooks/useBreakReminder';
import {
  clearLessonResume,
  getLessonResume,
  saveLessonResume,
} from '../../src/services/lessonResumeStore';

type Phase = 'dialog' | 'intro' | 'tasks' | 'aba_tokens' | 'aba_puzzle' | 'reward';
type Feedback = 'idle' | 'correct' | 'incorrect';
type PromptLevel = 0 | 1 | 2;
type SuccessType = 'pure' | 'assisted';

const ABA_REINFORCE_KEYS = [
  'lesson.abaReinforce1',
  'lesson.abaReinforce2',
  'lesson.abaReinforce3',
  'lesson.abaReinforce4',
  'lesson.abaReinforce5',
  'lesson.abaReinforce6',
  'lesson.abaReinforce7',
  'lesson.abaReinforce8',
  'lesson.abaReinforce9',
  'lesson.abaReinforce10',
  'lesson.abaReinforce11',
  'lesson.abaReinforce12',
] as const;

// ── Main lesson screen ────────────────────────────────────────────────────────
function LessonScreenContent() {
  const { lessonId } = useLocalSearchParams<{ lessonId?: string; topicId?: string }>();
  const { t } = useTranslation();
  const theme = useAppTheme();
  const router = useRouter();

  const profile = useAuth((s) => s.profile);
  const user = useAuth((s) => s.user);
  const language = useSettingsStore((s) => s.language);
  const ttsEnabled = useSettingsStore((s) => s.ttsEnabled);
  const reduceMotion = useSettingsStore((s) => s.reduceMotion);
  const breakReminderEnabled = useSettingsStore((s) => s.breakReminderEnabled);
  const breakDurationMinutes = useSettingsStore((s) => s.breakDurationMinutes);
  const abaTokenRewardSchedule = useSettingsStore((s) => s.abaTokenRewardSchedule);

  const recordAnswer = useProgressStore((s) => s.recordAnswer);
  const markLessonCompleted = useProgressStore((s) => s.markLessonCompleted);
  const addXP = useProgressStore((s) => s.addXP);
  const xp = useProgressStore((s) => s.xp);
  const addItem = useCollectiblesStore((s) => s.addItem);
  const addLessonTokens = useAbaTokenStore((s) => s.addLessonTokens);
  const resetPuzzleAfterCelebration = useAbaTokenStore((s) => s.resetPuzzleAfterCelebration);
  const puzzlePlacedPieces = useAbaTokenStore((s) => s.placedPieces);
  const startLiveSession = useAbaLiveSessionStore((s) => s.startSession);
  const setLiveTaskProgress = useAbaLiveSessionStore((s) => s.setTaskProgress);
  const recordLiveResult = useAbaLiveSessionStore((s) => s.recordResult);
  const finishLiveSession = useAbaLiveSessionStore((s) => s.finishSession);
  const clearLiveSession = useAbaLiveSessionStore((s) => s.clearSession);

  const { speak } = useSpeech();

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const sessionId = useRef<string>(`s-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`).current;
  const taskStartTime = useRef<number>(Date.now());
  const lastWrongAnswer = useRef<string | null>(null);
  /** Running total for the per-trial ABA token schedule (see abaTokenRewardSchedule). */
  const perTrialTokensAwardedRef = useRef(0);

  // Resolve lesson data before any conditional renders
  const lesson = lessonId ? getLesson(String(lessonId)) : null;
  const topic = lessonId ? getTopicForLesson(String(lessonId)) : null;
  const world = lessonId ? getWorldForLesson(String(lessonId)) : null;

  const isEnglishLesson = topic?.subject === 'reading';
  /** Английские уроки: при отсутствии ключа в en — подставляем ru (см. i18n fallbackLng). */
  const tEn = useCallback((key: string) => {
    const en = i18nInstance.t(key, { lng: 'en' });
    if (en !== key) return en;
    return i18nInstance.t(key, { lng: 'ru' });
  }, []);

  /** ABA: иерархия подсказок, подсветка верного ответа, озвучка правильного варианта — только в режиме «особый» (special). */
  const useAbaPedagogy = profile?.child_mode === 'special';

  const lt = useCallback(
    (key: string) => resolveLessonTextKey(key, t, useAbaPedagogy, language),
    [t, useAbaPedagogy, language],
  );

  const optionText = useCallback(
    (key: string) => {
      if (useAbaPedagogy) {
        const aba = getAbaTextOverride(key, language);
        if (aba) return aba;
        if (language !== 'ru') {
          const std = isEnglishLesson ? tEn(key) : t(key);
          if (std !== key) return std;
          const ruAba = getAbaTextOverride(key, 'ru');
          if (ruAba) return ruAba;
        } else {
          const ruAba = getAbaTextOverride(key, 'ru');
          if (ruAba) return ruAba;
        }
      }
      return isEnglishLesson ? tEn(key) : t(key);
    },
    [isEnglishLesson, tEn, t, useAbaPedagogy, language],
  );

  /** Обои ABA — только при особом профиле и методологии ABA. */
  const isAbaWallpaperMode =
    profile?.child_mode === 'special' && (profile?.methodology ?? 'aba') === 'aba';
  const lessonBackgroundImage = useMemo(
    () =>
      resolveScreenBackground({
        isAbaMode: isAbaWallpaperMode,
        worldId: world?.id,
      }),
    [isAbaWallpaperMode, world?.id],
  );
  const lessonBackgroundTint = isAbaWallpaperMode ? ('light' as const) : ('default' as const);

  // ALL hooks must be declared before any early return
  const tasks = useMemo(() => {
    if (!lesson) return [];
    const profileFilter = profile
      ? { child_mode: profile.child_mode, methodology: profile.methodology }
      : null;
    const baseFiltered = filterTasksForProfile(lesson.tasks, profileFilter);
    return withSpacedReviewTasks(lesson.id, baseFiltered, profileFilter);
  }, [lesson, profile]);

  const hasDialog = (lesson?.dialog?.length ?? 0) > 0;
  const hasIntro = (lesson?.intro?.length ?? 0) > 0;
  const initialPhase: Phase = hasDialog ? 'dialog' : hasIntro ? 'intro' : 'tasks';

  const [phase, setPhase] = useState<Phase>(initialPhase);
  const [dialogIndex, setDialogIndex] = useState(0);
  const [introIndex, setIntroIndex] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);

  /** Shuffle MC options once per task to remove middle-option position bias. */
  const displayOptions = useMemo(() => {
    const tk = tasks[currentIndex];
    if (!tk) return [] as MultipleChoiceTask['options'];
    if (tk.type === 'multiple_choice') return shuffleArray([...(tk as MultipleChoiceTask).options]);
    if (tk.type === 'fill_blank') return shuffleArray([...(tk as FillBlankTask).options]);
    if (tk.type === 'world_knowledge') return shuffleArray([...(tk as WorldKnowledgeTask).options]);
    if (tk.type === 'image_word_match') return shuffleArray([...(tk as ImageWordMatchTask).options]);
    return [] as MultipleChoiceTask['options'];
  }, [tasks, currentIndex]);

  const [inputValue, setInputValue] = useState('');
  const [feedback, setFeedback] = useState<Feedback>('idle');
  const [hasChecked, setHasChecked] = useState(false);
  const [selectHint, setSelectHint] = useState(false);
  const [mistakeCount, setMistakeCount] = useState(0);
  // Per-trial mistake tally, reset for every task — drives ABA prompt-level
  // escalation. Kept separate from `mistakeCount` (lesson-wide, used for
  // resume/reward calculation) so one task's history doesn't skip prompt
  // levels on the next task.
  const [taskMistakeCount, setTaskMistakeCount] = useState(0);
  const [trialCount, setTrialCount] = useState(1);
  const [earnedXP, setEarnedXP] = useState(0);
  const [earnedItem, setEarnedItem] = useState<string | null>(null);
  const [leveledUp, setLeveledUp] = useState(false);
  const [newLevel, setNewLevel] = useState(0);
  const [earnedStars, setEarnedStars] = useState<1 | 2 | 3>(3);
  const [isReplayCompletion, setIsReplayCompletion] = useState(false);
  const [resumedNotice, setResumedNotice] = useState(false);
  /** False until getLessonResume settles for *this* lessonId — blocks checkpoint wipe. */
  const [resumeHydrated, setResumeHydrated] = useState(false);
  /** Sync twin of resumeHydrated keyed by lessonId (survives one stale React commit). */
  const resumeHydratedForLessonRef = useRef<string | null>(null);
  const resumeCheckedRef = useRef<string | null>(null);
  /** Pending checkpoint for this lesson — re-applied when tasks.length grows (late profile). */
  const pendingResumeRef = useRef<Awaited<ReturnType<typeof getLessonResume>>>(null);
  const resumeAppliedRef = useRef(false);
  const lessonRewardClaimedRef = useRef(false);
  const lessonWasAlreadyCompletedRef = useRef(false);
  /** Tracks whether any task in this lesson attempt was skipped, so skipping can't be used to farm a perfect 3-star score. */
  const skippedAnyTaskRef = useRef(false);
  const taskGapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [taskTransitionBusy, setTaskTransitionBusy] = useState(false);
  const [abaReinforcement, setAbaReinforcement] = useState<{ phrase: string; emoji: string } | null>(
    null,
  );
  const abaCorrectProceedRef = useRef<(() => void) | null>(null);
  const lastAbaReinforceIdx = useRef<number | null>(null);
  const liveSessionStartedRef = useRef(false);

  const [sortPickItemId, setSortPickItemId] = useState<string | null>(null);
  const [sortAssignments, setSortAssignments] = useState<Record<string, string>>({});
  const [routinePickedIds, setRoutinePickedIds] = useState<string[]>([]);
  const [pendingAbaTokenCount, setPendingAbaTokenCount] = useState(0);
  const [abaPuzzleCelebrate, setAbaPuzzleCelebrate] = useState(false);

  const finishAbaReinforcement = useCallback(() => {
    setAbaReinforcement(null);
    setTaskTransitionBusy(false);
    const fn = abaCorrectProceedRef.current;
    abaCorrectProceedRef.current = null;
    fn?.();
  }, []);

  /**
   * ABA "least-to-most" prompt hierarchy for this task, escalated by wrong
   * attempts (see the `mistakeCount` branch below):
   *   - Level 0 (independent): no prompt — the child answers on their own.
   *   - Level 1 (visual prompt): the correct option is highlighted with a
   *     green border and a gentle text hint is shown; all options remain
   *     selectable so the child still has to notice and choose correctly.
   *   - Level 2 (restricted-choice prompt): incorrect options are disabled
   *     (in addition to the level-1 highlight), narrowing the response set.
   *     We deliberately do NOT speak the correct answer's text aloud here —
   *     `playAbaLevel2ReinforcementCue` only plays a generic encouragement
   *     phrase, so the answer is never verbally disclosed to the child.
   */
  const [promptLevel, setPromptLevel] = useState<PromptLevel>(0);
  const [hintText, setHintText] = useState<string | null>(null);
  const [successType, setSuccessType] = useState<SuccessType>('pure');

  const totalTasks = tasks.length;
  const isLastTask = totalTasks > 0 && currentIndex === totalTasks - 1;

  const narrativeFeedbackKeys = useMemo(() => {
    const tk = tasks[currentIndex];
    if (!tk) return null;
    const withKeys = tk as LessonTask & {
      correctFeedbackKey?: string;
      incorrectFeedbackKey?: string;
    };
    if (withKeys.correctFeedbackKey || withKeys.incorrectFeedbackKey) {
      return {
        correctKey: withKeys.correctFeedbackKey,
        incorrectKey: withKeys.incorrectFeedbackKey,
      };
    }
    const lookupId = tk.id.startsWith('review__') ? tk.id.slice('review__'.length) : tk.id;
    const fromMap = TASK_FEEDBACK_KEYS_BY_TASK_ID[lookupId];
    if (fromMap) {
      return {
        correctKey: fromMap.correctFeedbackKey,
        incorrectKey: fromMap.incorrectFeedbackKey,
      };
    }
    return null;
  }, [tasks, currentIndex]);

  const routineShuffledSteps = useMemo(() => {
    const tk = tasks[currentIndex];
    if (!tk || tk.type !== 'routine_chain') return [] as RoutineChainTask['steps'];
    return shuffleArray([...tk.steps]);
  }, [tasks, currentIndex]);

  const checkButtonLabel = useMemo(() => {
    if (!hasChecked) return t('lesson.checkAnswer');
    if (feedback === 'incorrect') return t('lesson.tryAgain');
    if (isLastTask) return t('lesson.finishLesson');
    return t('lesson.nextTask');
  }, [hasChecked, feedback, isLastTask, t]);

  const correctFeedbackText = useMemo(() => {
    const ck = narrativeFeedbackKeys?.correctKey;
    if (ck) return t(ck);
    if (!useAbaPedagogy) {
      return t('lesson.standardCorrect');
    }
    if (feedback === 'correct' && successType === 'assisted') {
      return t('lesson.abaAssistedSuccess');
    }
    return t('lesson.abaCorrect');
  }, [narrativeFeedbackKeys, feedback, successType, t, useAbaPedagogy]);

  const incorrectFeedbackText = useMemo(() => {
    const ik = narrativeFeedbackKeys?.incorrectKey;
    if (ik) return t(ik);
    if (!useAbaPedagogy) {
      return t('lesson.standardIncorrect');
    }
    if (promptLevel >= 2) return t('lesson.abaVerbalPromptFeedback');
    if (promptLevel >= 1) return t('lesson.abaVisualPromptFeedback');
    return t('lesson.abaIncorrect');
  }, [narrativeFeedbackKeys, promptLevel, t, useAbaPedagogy]);

  const taskDescriptionForTali = useMemo(() => {
    const tk = tasks[currentIndex];
    if (!tk || !lesson || !topic) return '';
    const questionPrompt = lt(tk.questionKey);
    const lines: string[] = [];
    if (questionPrompt) lines.push(`${t('tali.taskContextLabel')}: "${questionPrompt}"`);
    if (tk.type === 'multiple_choice') {
      const opts = (tk as MultipleChoiceTask).options.map((o) => optionText(o.textKey));
      if (opts.length) lines.push(`${t('tali.optionsContextLabel')}: ${opts.join(', ')}`);
    } else if (tk.type === 'fill_blank') {
      const opts = (tk as FillBlankTask).options.map((o) => lt(o.textKey));
      if (opts.length) lines.push(`${t('tali.optionsShortLabel')}: ${opts.join(', ')}`);
    } else if (tk.type === 'world_knowledge') {
      const wk = tk as WorldKnowledgeTask;
      const opts = wk.options.map((o) => (o.textKey ? lt(o.textKey) : o.imageKey ?? '')).filter(Boolean);
      if (opts.length) lines.push(`${t('tali.optionsShortLabel')}: ${opts.join(', ')}`);
    } else if (tk.type === 'image_word_match') {
      const im = tk as ImageWordMatchTask;
      const opts = im.options.map((o) => (o.textKey ? lt(o.textKey) : o.imageKey ?? '')).filter(Boolean);
      if (opts.length) lines.push(`${t('tali.optionsShortLabel')}: ${opts.join(', ')}`);
    } else if (tk.type === 'vocal_imitation') {
      lines.push(lt(tk.soundTextKey));
    } else if (tk.type === 'word_repetition') {
      lines.push(lt(tk.wordKey));
    } else if (tk.type === 'action_instruction') {
      lines.push(lt(tk.actionKey));
    }
    return lines.join('. ');
  }, [tasks, currentIndex, lesson, topic, lt, optionText, t]);

  const companionTaskContext = useMemo((): TaskContext | undefined => {
    if (phase !== 'tasks' || !lesson || !topic) return undefined;
    const tk = tasks[currentIndex];
    if (!tk) return undefined;
    return lessonTaskToCompanionContext({
      task: tk,
      lesson,
      topic,
      childMode: profile?.child_mode ?? 'standard',
      methodology:
        profile?.child_mode === 'special' ? (profile.methodology ?? 'aba') : null,
      isEnglishLesson,
      t: lt,
      tEn,
      optionText,
    });
  }, [
    phase,
    tasks,
    currentIndex,
    lesson,
    topic,
    profile?.child_mode,
    profile?.methodology,
    isEnglishLesson,
    lt,
    tEn,
    optionText,
  ]);

  // Flush queued analytics on mount
  useEffect(() => {
    if (user?.id) {
      void syncWithRetry('lesson:flushAnalyticsQueue', () => flushAnalyticsQueue(user.id));
    }
  }, [user?.id]);

  useEffect(() => {
    lessonRewardClaimedRef.current = false;
    lessonWasAlreadyCompletedRef.current = false;
    skippedAnyTaskRef.current = false;
    resumeCheckedRef.current = null;
    resumeHydratedForLessonRef.current = null;
    pendingResumeRef.current = null;
    resumeAppliedRef.current = false;
    setResumeHydrated(false);
    setIsReplayCompletion(false);
    setAbaReinforcement(null);
    abaCorrectProceedRef.current = null;
    liveSessionStartedRef.current = false;
    lastAbaReinforceIdx.current = null;
    perTrialTokensAwardedRef.current = 0;
    setMistakeCount(0);
    setDialogIndex(0);
    setIntroIndex(0);
    setCurrentIndex(0);
    setSelectedOptionId(null);
    setInputValue('');
    setFeedback('idle');
    setHasChecked(false);
    setSelectHint(false);
    setPromptLevel(0);
    setHintText(null);
    setSuccessType('pure');
    setSortPickItemId(null);
    setSortAssignments({});
    setRoutinePickedIds([]);
    setPendingAbaTokenCount(0);
    setAbaPuzzleCelebrate(false);
    setResumedNotice(false);
    setPhase(hasDialog ? 'dialog' : hasIntro ? 'intro' : 'tasks');
    // Drop any leftover remote live row from a previous lesson; a new ABA
    // session will startSession when tasks begin.
    clearLiveSession();
    return () => {
      if (taskGapTimerRef.current) {
        clearTimeout(taskGapTimerRef.current);
        taskGapTimerRef.current = null;
      }
      // Only abandon an *still-active* session. If finishSession already ran,
      // local `active` is false — calling clear would race the finish UPDATE
      // and can leave tokens_earned null on the remote row.
      const { active, clearSession } = useAbaLiveSessionStore.getState();
      if (active) clearSession();
    };
  }, [lessonId, clearLiveSession, hasDialog, hasIntro]);

  // Resume mid-lesson progress: a child exiting on the middle of a lesson
  // (back button, phone call, killed app, low battery, etc.) should return
  // to roughly where they left off rather than restarting from scratch.
  useEffect(() => {
    if (!lesson) return;

    const tryApplyResume = (resume: NonNullable<Awaited<ReturnType<typeof getLessonResume>>>) => {
      if (resumeAppliedRef.current) return;
      setMistakeCount(resume.mistakeCount);
      skippedAnyTaskRef.current = resume.hadSkips;
      if (resume.phase === 'tasks' && tasks.length > 0 && resume.index >= 0 && resume.index < tasks.length) {
        setPhase('tasks');
        setCurrentIndex(resume.index);
        setResumedNotice(true);
        resumeAppliedRef.current = true;
      } else if (
        resume.phase === 'dialog' &&
        (lesson.dialog?.length ?? 0) > 0 &&
        resume.index >= 0 &&
        resume.index < (lesson.dialog?.length ?? 0)
      ) {
        setPhase('dialog');
        setDialogIndex(resume.index);
        setResumedNotice(true);
        resumeAppliedRef.current = true;
      } else if (
        resume.phase === 'intro' &&
        (lesson.intro?.length ?? 0) > 0 &&
        resume.index >= 0 &&
        resume.index < (lesson.intro?.length ?? 0)
      ) {
        setPhase('intro');
        setIntroIndex(resume.index);
        setResumedNotice(true);
        resumeAppliedRef.current = true;
      }
      // tasks-phase with index OOB (profile not ready yet): leave applied=false so a
      // later tasks.length change can retry.
    };

    // Already loaded for this lesson — only re-try apply when task list grows.
    if (resumeCheckedRef.current === lesson.id) {
      if (pendingResumeRef.current) tryApplyResume(pendingResumeRef.current);
      return;
    }

    resumeCheckedRef.current = lesson.id;
    resumeHydratedForLessonRef.current = null;
    setResumeHydrated(false);
    let cancelled = false;
    void getLessonResume(lesson.id)
      .then((resume) => {
        if (cancelled) return;
        pendingResumeRef.current = resume;
        if (resume) tryApplyResume(resume);
      })
      .finally(() => {
        if (cancelled) return;
        resumeHydratedForLessonRef.current = lesson.id;
        setResumeHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, [lesson, tasks.length]);

  useEffect(() => {
    if (!resumedNotice) return;
    const timer = setTimeout(() => setResumedNotice(false), 4000);
    return () => clearTimeout(timer);
  }, [resumedNotice]);

  // Checkpoint progress — gated until resume hydrate for *this* lessonId
  // (sync ref avoids one-frame overwrite when lessonId changes in place).
  useEffect(() => {
    if (!lesson) return;
    if (resumeHydratedForLessonRef.current !== lesson.id || !resumeHydrated) return;
    if (phase === 'dialog') {
      void saveLessonResume({
        lessonId: lesson.id,
        phase: 'dialog',
        index: dialogIndex,
        mistakeCount,
        hadSkips: skippedAnyTaskRef.current,
      });
    } else if (phase === 'intro') {
      void saveLessonResume({
        lessonId: lesson.id,
        phase: 'intro',
        index: introIndex,
        mistakeCount,
        hadSkips: skippedAnyTaskRef.current,
      });
    } else if (phase === 'tasks') {
      void saveLessonResume({
        lessonId: lesson.id,
        phase: 'tasks',
        index: currentIndex,
        mistakeCount,
        hadSkips: skippedAnyTaskRef.current,
      });
    }
  }, [lesson, phase, dialogIndex, introIndex, currentIndex, mistakeCount, resumeHydrated]);

  // Once the lesson reaches a celebration/completion phase there is nothing
  // left to resume — drop the checkpoint so a future replay starts fresh.
  useEffect(() => {
    if (!lesson) return;
    if (phase === 'aba_tokens' || phase === 'aba_puzzle' || phase === 'reward') {
      void clearLessonResume(lesson.id);
    }
  }, [lesson, phase]);

  // Auto-speak task question when a new task appears (вшитый mp3 при наличии)
  useEffect(() => {
    if (phase !== 'tasks' || !lesson || !ttsEnabled) return;
    const tk = tasks[currentIndex];
    if (!tk) return;
    const speakLines = async () => {
      const q = lt(tk.questionKey);
      await playLessonTaskVoiceLine(
        lesson.id,
        lessonTaskQuestionVoiceKey(lesson.id, tk.id, language),
        q,
        language,
      );
      if (useAbaPedagogy) {
        const instKey = abaTaskInstructionI18nKey(tk.type);
        const inst = t(instKey);
        if (inst && inst !== instKey) {
          await speakViaTali(inst, mapLanguageCodeToTaliTts(language));
        }
      }
      if (tk.type === 'vocal_imitation') {
        await speakViaTali(lt(tk.soundTextKey), mapLanguageCodeToTaliTts(language));
        if (tk.audioPromptKey) {
          await speakViaTali(lt(tk.audioPromptKey), mapLanguageCodeToTaliTts(language));
        }
      } else if (tk.type === 'word_repetition') {
        await speakViaTali(lt(tk.wordKey), mapLanguageCodeToTaliTts(language));
      } else if (tk.type === 'volume_control') {
        await speakViaTali(lt(tk.promptTextKey), mapLanguageCodeToTaliTts(language));
      } else if (tk.type === 'action_instruction') {
        await speakViaTali(lt(tk.actionKey), mapLanguageCodeToTaliTts(language));
      }
    };
    const delay = setTimeout(() => {
      void speakLines();
    }, 500);
    return () => clearTimeout(delay);
  }, [phase, currentIndex, tasks, lesson, language, lt, t, ttsEnabled, useAbaPedagogy]);

  useEffect(() => {
    if (phase !== 'tasks' || !useAbaPedagogy || !lesson || tasks.length === 0) return;
    if (liveSessionStartedRef.current) return;
    liveSessionStartedRef.current = true;
    startLiveSession(lesson.id, lesson.titleKey, tasks.length);
  }, [phase, useAbaPedagogy, lesson, tasks.length, startLiveSession]);

  useEffect(() => {
    if (phase !== 'tasks' || !useAbaPedagogy) return;
    setLiveTaskProgress(currentIndex, tasks.length);
  }, [phase, useAbaPedagogy, currentIndex, tasks.length, setLiveTaskProgress]);

  useEffect(() => {
    if (!abaReinforcement || !ttsEnabled || !useAbaPedagogy) return;
    const delay = setTimeout(() => {
      void speakViaTali(abaReinforcement.phrase, mapLanguageCodeToTaliTts(language));
    }, 200);
    return () => clearTimeout(delay);
  }, [abaReinforcement, ttsEnabled, useAbaPedagogy, language]);

  // Auto-speak feedback when it changes (ABA: correct — only banner, no duplicate TTS).
  // Кастомный нарратив из v2 не дублируем озвучкой — только текст на баннере.
  useEffect(() => {
    if (feedback === 'correct') {
      if (useAbaPedagogy) return;
      if (narrativeFeedbackKeys?.correctKey) return;
      const delay = setTimeout(() => speak(correctFeedbackText), 200);
      return () => clearTimeout(delay);
    }
    if (feedback === 'incorrect') {
      if (narrativeFeedbackKeys?.incorrectKey) return;
      const delay = setTimeout(() => speak(incorrectFeedbackText), 200);
      return () => clearTimeout(delay);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedback, correctFeedbackText, incorrectFeedbackText, useAbaPedagogy, narrativeFeedbackKeys]);

  const { visible: breakModalVisible, dismiss: dismissBreakReminder } = useBreakReminder({
    enabled: breakReminderEnabled,
    active: phase === 'tasks',
    thresholdMinutes: defaultBreakReminderMinutesForAgeBand(profile?.age_band),
  });

  // DTT response window: if the child hasn't started answering within an
  // age-scaled window, surface the level-1 prompt automatically (SD given,
  // no response within the window -> prompt), instead of waiting forever
  // for a wrong answer to trigger scaffolding. Uses a static hint (not the
  // AI-generated one) since this fires without any user action and would
  // otherwise call the AI proxy for every silently-stuck child.
  useEffect(() => {
    const currentTask = tasks[currentIndex];
    if (phase !== 'tasks' || !currentTask || hasChecked || taskTransitionBusy) return;
    if (isTherapistLedTask(currentTask)) return; // adult judges these live
    if (promptLevel > 0) return; // already prompted via a wrong answer
    const hasStartedAnswering =
      !!selectedOptionId || inputValue.trim().length > 0 || !!sortPickItemId || routinePickedIds.length > 0;
    if (hasStartedAnswering) return;
    const windowMs = responseWindowMsForAgeBand(profile?.age_band);
    const timer = setTimeout(() => {
      setPromptLevel(1);
      setHintText(t('lesson.responseWindowHint'));
    }, windowMs);
    return () => clearTimeout(timer);
  }, [
    tasks,
    currentIndex,
    phase,
    hasChecked,
    taskTransitionBusy,
    promptLevel,
    selectedOptionId,
    inputValue,
    sortPickItemId,
    routinePickedIds,
    profile?.age_band,
    t,
  ]);

  // Early returns after all hooks
  if (!lessonId || !lesson || !topic) {
    return <Screen><AppText>{t('errors.lessonNotFound')}</AppText></Screen>;
  }

  const task: LessonTask | undefined = tasks[currentIndex];
  const dialog = lesson.dialog ?? [];
  const npcName = world?.npcName ?? 'NPC';
  const npcEmoji = world?.npcEmoji ?? '';
  const accentColor = world?.accentColor ?? theme.colors.primary;

  const fadeIn = () => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  };

  const hapticCorrect = () =>
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  const hapticWrong = () =>
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});

  const buildTaskContext = (): TaskContext => {
    if (!task) {
      return {
        questionPrompt: '',
        subjectId: topic.subject,
        topicId: topic.id,
        lessonId: lesson.id,
        childMode: profile?.child_mode ?? 'standard',
        methodology:
          profile?.child_mode === 'special' ? (profile.methodology ?? 'aba') : null,
      };
    }
    return lessonTaskToCompanionContext({
      task,
      lesson,
      topic,
      childMode: profile?.child_mode ?? 'standard',
      methodology:
        profile?.child_mode === 'special' ? (profile.methodology ?? 'aba') : null,
      isEnglishLesson,
      t: lt,
      tEn,
      optionText,
    });
  };

  // ── Dialog phase ─────────────────────────────────────────────────────────
  if (phase === 'dialog') {
    const line = dialog[dialogIndex];
    const isTali = line.speaker === 'tali';
    const speakerName = isTali ? t('tali.name') : `${npcName}${npcEmoji ? ` ${npcEmoji}` : ''}`.trim();
    const speakerColor = isTali ? theme.colors.primary : accentColor;
    const isLastLine = dialogIndex === dialog.length - 1;
    const fullText = lt(line.textKey);

    return (
      <DialogPhase
        lessonId={lesson.id}
        worldId={world?.id}
        backgroundImage={lessonBackgroundImage}
        backgroundImageTint={lessonBackgroundTint}
        fullText={fullText}
        speakerName={speakerName}
        speakerColor={speakerColor}
        isTali={isTali}
        npcEmoji={npcEmoji}
        worldBiome={world?.biome}
        worldTitleKey={world?.titleKey}
        worldAccentColor={accentColor}
        dialogIndex={dialogIndex}
        totalLines={dialog.length}
        isLastLine={isLastLine}
        fadeAnim={fadeAnim}
        theme={theme}
        t={lt}
        onNext={() => {
          fadeIn();
          if (isLastLine) {
            if (hasIntro) setPhase('intro');
            else setPhase('tasks');
          } else {
            setDialogIndex((i) => i + 1);
          }
        }}
      />
    );
  }

  // ── Intro phase ───────────────────────────────────────────────────────────
  if (phase === 'intro') {
    const intro = lesson.intro ?? [];
    const slide = intro[introIndex];
    const isLastSlide = introIndex === intro.length - 1;
    return (
      <IntroPhase
        lessonId={lesson.id}
        backgroundImage={lessonBackgroundImage}
        backgroundImageTint={lessonBackgroundTint}
        slide={slide}
        slideIndex={introIndex}
        totalSlides={intro.length}
        isLastSlide={isLastSlide}
        accentColor={accentColor}
        fadeAnim={fadeAnim}
        theme={theme}
        t={lt}
        onNext={() => {
          fadeIn();
          if (isLastSlide) setPhase('tasks');
          else setIntroIndex((i) => i + 1);
        }}
      />
    );
  }

  // ── ABA token + puzzle (before XP reward) ───────────────────────────────
  if (phase === 'aba_tokens') {
    return (
      <Screen backgroundImage={lessonBackgroundImage} backgroundImageTint={lessonBackgroundTint}>
        <ABATokenReward
          tokensEarned={pendingAbaTokenCount}
          onContinue={() => {
            const per = lesson.abaTokensPerPiece ?? 5;
            const { newPieces, puzzleCompleted } = addLessonTokens(pendingAbaTokenCount, per);
            if (newPieces === 0 && !puzzleCompleted) {
              finishLiveSession(pendingAbaTokenCount);
              setPhase('reward');
              return;
            }
            setAbaPuzzleCelebrate(puzzleCompleted);
            setPhase('aba_puzzle');
          }}
        />
      </Screen>
    );
  }

  if (phase === 'aba_puzzle') {
    return (
      <Screen backgroundImage={lessonBackgroundImage} backgroundImageTint={lessonBackgroundTint}>
        <ABAPuzzleScreen
          placedPieces={puzzlePlacedPieces}
          showCelebration={abaPuzzleCelebrate}
          onCelebrationDismiss={() => {
            resetPuzzleAfterCelebration();
            setAbaPuzzleCelebrate(false);
          }}
          onContinueToReward={() => {
            finishLiveSession(pendingAbaTokenCount);
            setPhase('reward');
          }}
        />
      </Screen>
    );
  }

  // ── Reward phase ─────────────────────────────────────────────────────────
  if (phase === 'reward') {
    return (
      <RewardPhase
        earnedXP={earnedXP}
        earnedItemEmoji={earnedItem}
        leveledUp={leveledUp}
        newLevel={newLevel}
        earnedStars={earnedStars}
        isReplay={isReplayCompletion}
        lessonTitle={t(lesson.titleKey)}
        theme={theme}
        backgroundImage={lessonBackgroundImage}
        backgroundImageTint={lessonBackgroundTint}
        onGoToMap={() => router.replace('/(tabs)/map')}
      />
    );
  }

  // ── Tasks phase ───────────────────────────────────────────────────────────
  if (!task) {
    return <Screen><AppText>{t('errors.lessonNotFound')}</AppText></Screen>;
  }

  const TASK_GAP_MS = 1500;

  const resetForNextTask = () => {
    setSelectedOptionId(null);
    setInputValue('');
    setFeedback('idle');
    setHasChecked(false);
    setSelectHint(false);
    setTrialCount(1);
    setPromptLevel(0);
    setTaskMistakeCount(0);
    setHintText(null);
    setSuccessType('pure');
    setSortPickItemId(null);
    setSortAssignments({});
    setRoutinePickedIds([]);
    taskStartTime.current = Date.now();
    lastWrongAnswer.current = null;
  };

  const applyLessonRewards = (totalMistakes: number): 1 | 2 | 3 | null => {
    if (lessonRewardClaimedRef.current) return null;
    lessonRewardClaimedRef.current = true;

    // A lesson already marked completed before this run must not grant XP/tokens
    // again — otherwise a child can farm rewards by replaying finished lessons.
    const alreadyCompleted = isLessonAlreadyCompleted(topic.id, lesson.id);
    lessonWasAlreadyCompletedRef.current = alreadyCompleted;
    setIsReplayCompletion(alreadyCompleted);

    const reward = lesson.reward;
    const xpGain = alreadyCompleted ? 0 : reward?.xp ?? 20;
    const prevLevel = getLevelFromXP(xp);
    const perfectRun = totalMistakes === 0 && !skippedAnyTaskRef.current;
    const stars: 1 | 2 | 3 = perfectRun ? 3 : totalMistakes <= 2 ? 2 : 1;

    markLessonCompleted({
      topicId: topic.id,
      lessonId: lesson.id,
      mistakeCount: totalMistakes,
      hadSkips: skippedAnyTaskRef.current,
    });
    if (xpGain > 0) {
      addXP(xpGain);
    }

    const newXP = xp + xpGain;
    const nextLevel = getLevelFromXP(newXP);

    if (reward?.item && !alreadyCompleted) {
      addItem(reward.item);
      const meta = COLLECTIBLES_META[reward.item];
      setEarnedItem(t(meta.nameKey));
    }

    setEarnedXP(xpGain);
    setEarnedStars(stars);
    setLeveledUp(nextLevel > prevLevel);
    setNewLevel(nextLevel);
    return stars;
  };

  const completeLessonFlow = (totalMistakes: number) => {
    const stars = applyLessonRewards(totalMistakes);
    if (stars === null) return;
    // Skip the ABA token/puzzle celebration on replays — no new tokens were earned.
    // Still finish (or clear) the remote live session so the parent dashboard
    // does not stay stuck on "active" after a replay or non-ABA completion.
    if (useAbaPedagogy && !lessonWasAlreadyCompletedRef.current && abaTokenRewardSchedule !== 'per_trial') {
      setPendingAbaTokenCount(stars);
      // Finish the remote live row as soon as rewards are settled — before the
      // celebration UI — so back/kill mid-tokens doesn't leave null tokens_earned.
      finishLiveSession(stars);
      setPhase('aba_tokens');
    } else {
      if (useAbaPedagogy) {
        finishLiveSession(abaTokenRewardSchedule === 'per_trial' ? perTrialTokensAwardedRef.current : 0);
      } else {
        clearLiveSession();
      }
      setPhase('reward');
    }
  };

  const handleSkip = () => {
    if (taskTransitionBusy) return;
    // Skipping is a valid ABA accommodation, but it must not be a free path to a
    // perfect score — cap the lesson at 2 stars whenever a task was skipped.
    skippedAnyTaskRef.current = true;
    if (useAbaPedagogy && ttsEnabled) {
      void speakViaTali(t('lesson.abaSkipFeedback'), mapLanguageCodeToTaliTts(language));
    }
    if (useAbaPedagogy) recordLiveResult('skipped');
    if (isLastTask) {
      completeLessonFlow(mistakeCount);
    } else {
      setCurrentIndex((prev) => prev + 1);
      resetForNextTask();
      fadeIn();
    }
  };

  /**
   * ABA prompt-level 2 reinforcement: plays a short, generic encouragement
   * phrase via TTS — it never speaks the correct answer's text. The answer
   * itself is only surfaced visually (green highlight + disabled wrong
   * options), which still requires the child to make the correct response
   * rather than being told it outright.
   */
  const playAbaLevel2ReinforcementCue = () => {
    if (!ttsEnabled) return;
    void speakViaTali(t('lesson.abaLevel2ReinforcementVoice'), mapLanguageCodeToTaliTts(language));
  };

  const handlePrimaryPress = () => {
    if (taskTransitionBusy) return;
    if (isTherapistLedTask(task)) return;

    if (!hasChecked) {
      const needsOption =
        task.type === 'multiple_choice' ||
        task.type === 'fill_blank' ||
        task.type === 'world_knowledge' ||
        task.type === 'image_word_match' ||
        task.type === 'image_point';
      if (needsOption && !selectedOptionId) {
        setSelectHint(true);
        return;
      }
      if (task.type === 'sorting') {
        const st = task as SortingTask;
        const allPlaced = st.items.every((it) => sortAssignments[it.id]);
        if (!allPlaced) {
          setSelectHint(true);
          return;
        }
      }
      if (task.type === 'routine_chain') {
        const rc = task as RoutineChainTask;
        if (routinePickedIds.length !== rc.steps.length) {
          setSelectHint(true);
          return;
        }
      }

      let correct = false;
      if (task.type === 'multiple_choice') {
        const mcTask = task as MultipleChoiceTask;
        const selectedOption = mcTask.options.find((o) => o.id === selectedOptionId);
        correct = !!selectedOption?.correct;
        if (!correct && selectedOption) {
          lastWrongAnswer.current = optionText(selectedOption.textKey);
        }
      } else if (task.type === 'fill_blank') {
        const fb = task as FillBlankTask;
        const selectedOption = fb.options.find((o) => o.id === selectedOptionId);
        correct = !!selectedOption?.correct;
        if (!correct && selectedOption) lastWrongAnswer.current = lt(selectedOption.textKey);
      } else if (task.type === 'world_knowledge') {
        const wk = task as WorldKnowledgeTask;
        const selectedOption = wk.options.find((o) => o.id === selectedOptionId);
        correct = !!selectedOption?.correct;
        if (!correct && selectedOption) {
          lastWrongAnswer.current = selectedOption.textKey
            ? lt(selectedOption.textKey)
            : selectedOption.imageKey ?? '';
        }
      } else if (task.type === 'image_word_match') {
        const im = task as ImageWordMatchTask;
        const selectedOption = im.options.find((o) => o.id === selectedOptionId);
        correct = !!selectedOption?.correct;
        if (!correct && selectedOption) {
          lastWrongAnswer.current = selectedOption.textKey
            ? lt(selectedOption.textKey)
            : selectedOption.imageKey ?? '';
        }
      } else if (task.type === 'image_point') {
        const ip = task as ImagePointTask;
        const h = ip.hotspots.find((x) => x.id === selectedOptionId);
        correct = !!h?.correct;
        if (!correct && h?.labelKey) lastWrongAnswer.current = lt(h.labelKey);
      } else if (task.type === 'sorting') {
        const st = task as SortingTask;
        correct = st.items.every((it) => sortAssignments[it.id] === it.groupId);
        if (!correct) lastWrongAnswer.current = 'sort';
      } else if (task.type === 'routine_chain') {
        const rc = task as RoutineChainTask;
        const ordered = [...rc.steps].sort((a, b) => a.order - b.order);
        correct =
          routinePickedIds.length === ordered.length &&
          routinePickedIds.every((id, i) => ordered[i]?.id === id);
        if (!correct) lastWrongAnswer.current = 'order';
      } else if (task.type === 'input') {
        const expected = String(task.answer).trim().toLowerCase();
        const input = inputValue.trim().toLowerCase();
        const expNum = parseFloat(expected);
        const inpNum = parseFloat(input);
        const bothNumeric = !Number.isNaN(expNum) && !Number.isNaN(inpNum);
        correct = bothNumeric ? expNum === inpNum : expected === input;
        if (!correct) lastWrongAnswer.current = inputValue.trim();
      }

      const latencyMs = Date.now() - taskStartTime.current;

      if (correct) {
        hapticCorrect();
        if (useAbaPedagogy) recordLiveResult('correct');
        if (useAbaPedagogy && abaTokenRewardSchedule === 'per_trial' && !isLessonAlreadyCompleted(topic.id, lesson.id)) {
          // Per-trial token economy: 1 token credited on each correct answer
          // instead of a single lump sum at lesson end (see completeLessonFlow,
          // which skips the lesson-end award in this mode).
          addLessonTokens(1, lesson.abaTokensPerPiece ?? 5);
          perTrialTokensAwardedRef.current += 1;
        }
        const sType: SuccessType = promptLevel > 0 ? 'assisted' : 'pure';
        setSuccessType(sType);

        recordAnswer({
          topicId: topic.id,
          lessonId: lesson.id,
          correct: true,
          taskId: task.id,
          taskIndex: currentIndex,
          promptLevel,
          latencyMs,
          successType: sType,
          sessionId,
          attemptNo: trialCount,
        });

        if (useAbaPedagogy && promptLevel >= 2 && lastWrongAnswer.current) {
          const taskCtx = buildTaskContext();
          explainError(taskCtx, lastWrongAnswer.current, language)
            .then((msg) => { if (msg) setHintText(msg); })
            .catch((err) => {
              captureException(err, { where: 'lesson.explainError' });
            });
        }
      } else {
        hapticWrong();
        if (useAbaPedagogy) recordLiveResult('incorrect');
        const newMistakeCount = mistakeCount + 1;
        setMistakeCount(newMistakeCount);
        const newTaskMistakeCount = taskMistakeCount + 1;
        setTaskMistakeCount(newTaskMistakeCount);
        setTrialCount((c) => c + 1);

        recordAnswer({
          topicId: topic.id,
          lessonId: lesson.id,
          correct: false,
          taskId: task.id,
          taskIndex: currentIndex,
          promptLevel,
          latencyMs,
          sessionId,
          attemptNo: trialCount,
        });

        // Least-to-most prompt escalation now runs in both modes (was
        // ABA-only): level 1 shows a text hint, level 2 adds the
        // restricted-choice/visual-target UI (see isVisualTarget/
        // isDisabledByPrompt above). Only the AI-generated hint content
        // (getHint, an AI-proxy network call) and the ABA voice
        // reinforcement cue stay ABA-only, to avoid silently multiplying AI
        // proxy calls across the much larger standard-mode user base.
        const level = nextAbaPromptLevel(taskMistakeCount);
        setPromptLevel(level);
        if (level === 1) {
          if (useAbaPedagogy) {
            const taskCtx = buildTaskContext();
            getHint(taskCtx, language)
              .then((hint) => { if (hint) setHintText(hint); })
              .catch((err) => {
                captureException(err, { where: 'lesson.getHint' });
              });
          } else {
            setHintText(t('lesson.standardHintLevel1'));
          }
        } else if (useAbaPedagogy) {
          playAbaLevel2ReinforcementCue();
        }
      }

      setFeedback(correct ? 'correct' : 'incorrect');
      setHasChecked(true);
      return;
    }

    const scheduleAfterGap = (fn: () => void) => {
      if (taskGapTimerRef.current) clearTimeout(taskGapTimerRef.current);
      setTaskTransitionBusy(true);
      taskGapTimerRef.current = setTimeout(() => {
        taskGapTimerRef.current = null;
        fn();
        setTaskTransitionBusy(false);
      }, TASK_GAP_MS);
    };

    if (feedback === 'incorrect') {
      scheduleAfterGap(() => {
        setSelectedOptionId(null);
        setInputValue('');
        setSortPickItemId(null);
        setSortAssignments({});
        setRoutinePickedIds([]);
        setFeedback('idle');
        setHasChecked(false);
        setSelectHint(false);
      });
      return;
    }

    // feedback === 'correct'
    if (useAbaPedagogy) {
      const proceed = () => {
        if (isLastTask) {
          completeLessonFlow(mistakeCount);
        } else {
          setCurrentIndex((prev) => prev + 1);
          resetForNextTask();
          fadeIn();
        }
      };
      // Age-scaled reinforcement frequency: skip the full verbal banner on a
      // fraction of correct answers for older children (intermittent
      // schedule) and proceed straight away. Haptic feedback already fired
      // above regardless of this roll.
      if (Math.random() >= reinforcementRateForAgeBand(profile?.age_band)) {
        proceed();
        return;
      }
      setTaskTransitionBusy(true);
      abaCorrectProceedRef.current = proceed;
      const pool = ABA_REINFORCE_KEYS.length;
      let idx = Math.floor(Math.random() * pool);
      if (lastAbaReinforceIdx.current !== null && pool > 1) {
        while (idx === lastAbaReinforceIdx.current) {
          idx = Math.floor(Math.random() * pool);
        }
      }
      lastAbaReinforceIdx.current = idx;
      const phraseKey = ABA_REINFORCE_KEYS[idx]!;
      setAbaReinforcement({
        phrase: t(phraseKey),
        emoji: '',
      });
      return;
    }

    if (isLastTask) {
      scheduleAfterGap(() => {
        completeLessonFlow(mistakeCount);
      });
      return;
    }

    scheduleAfterGap(() => {
      setCurrentIndex((prev) => prev + 1);
      resetForNextTask();
      fadeIn();
    });
  };

  const replayTherapistTaskTts = () => {
    if (!ttsEnabled || !lesson) return;
    void (async () => {
      const q = lt(task.questionKey);
      await playLessonTaskVoiceLine(
        lesson.id,
        lessonTaskQuestionVoiceKey(lesson.id, task.id, language),
        q,
        language,
      );
      if (useAbaPedagogy) {
        const instKey = abaTaskInstructionI18nKey(task.type);
        const inst = t(instKey);
        if (inst && inst !== instKey) {
          await speakViaTali(inst, mapLanguageCodeToTaliTts(language));
        }
      }
      if (task.type === 'vocal_imitation') {
        await speakViaTali(lt(task.soundTextKey), mapLanguageCodeToTaliTts(language));
        if (task.audioPromptKey) {
          await speakViaTali(lt(task.audioPromptKey), mapLanguageCodeToTaliTts(language));
        }
      } else if (task.type === 'word_repetition') {
        await speakViaTali(lt(task.wordKey), mapLanguageCodeToTaliTts(language));
      } else if (task.type === 'volume_control') {
        await speakViaTali(lt(task.promptTextKey), mapLanguageCodeToTaliTts(language));
      } else if (task.type === 'action_instruction') {
        await speakViaTali(lt(task.actionKey), mapLanguageCodeToTaliTts(language));
      }
    })();
  };

  const handleTherapistDone = () => {
    if (taskTransitionBusy || hasChecked) return;
    hapticCorrect();
    if (useAbaPedagogy) recordLiveResult('correct');
    const latencyMs = Date.now() - taskStartTime.current;
    setSuccessType('pure');
    recordAnswer({
      topicId: topic.id,
      lessonId: lesson.id,
      correct: true,
      taskId: task.id,
      taskIndex: currentIndex,
      promptLevel: 0,
      latencyMs,
      successType: 'pure',
      sessionId,
      attemptNo: trialCount,
    });
    setFeedback('correct');
    setHasChecked(true);
  };

  const handleTherapistRetry = () => {
    if (taskTransitionBusy) return;
    replayTherapistTaskTts();
  };

  const showAbaSkipBelow =
    useAbaPedagogy && task.skippable && task.type !== 'input';

  return (
    <Screen
      scroll
      backgroundImage={lessonBackgroundImage}
      backgroundImageTint={lessonBackgroundTint}
      style={{ position: 'relative' }}
    >
      <LessonRepeatSpeechFab />
      {abaReinforcement ? (
        <ABAReinforcementBanner
          visible
          phrase={abaReinforcement.phrase}
          emoji={abaReinforcement.emoji}
          reduceMotion={reduceMotion}
          onFinished={finishAbaReinforcement}
        />
      ) : null}
      {resumedNotice ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: theme.colors.primary + '15',
            borderRadius: theme.radii.sm,
            paddingHorizontal: theme.spacing.sm,
            paddingVertical: 6,
            marginBottom: theme.spacing.sm,
          }}
        >
          <MaterialIcons name="history" size={16} color={theme.colors.primary} />
          <AppText variant="small" style={{ color: theme.colors.primary, flex: 1 }}>
            {t('lesson.resumedNotice')}
          </AppText>
        </View>
      ) : null}
      {/* Progress bar */}
      <View style={{ marginBottom: theme.spacing.sm }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
          <AppText variant="small" style={{ color: theme.colors.textMuted }}>
            {t('lesson.taskOf', { index: currentIndex + 1, total: totalTasks })}
          </AppText>
        </View>
        <View style={{ height: 8, backgroundColor: theme.colors.border, borderRadius: 4, overflow: 'hidden' }}>
          <View
            style={{
              height: '100%',
              width: `${((currentIndex + (hasChecked ? 1 : 0)) / totalTasks) * 100}%`,
              backgroundColor: accentColor,
              borderRadius: 4,
            }}
          />
        </View>
      </View>

      {/* ABA: trial counter badge */}
      {useAbaPedagogy && trialCount > 1 && (
        <View
          style={{
            backgroundColor: theme.colors.secondary + '20',
            borderRadius: theme.radii.sm,
            paddingHorizontal: theme.spacing.sm,
            paddingVertical: 4,
            alignSelf: 'flex-start',
            marginBottom: theme.spacing.sm,
          }}
        >
          <AppText variant="small" style={{ color: theme.colors.secondary, fontWeight: '700' }}>
            {t('lesson.abaTrial', { n: trialCount })}
          </AppText>
        </View>
      )}

      {useAbaPedagogy ? (
        <AppText
          variant="small"
          style={{ color: theme.colors.primary, fontWeight: '700', marginBottom: theme.spacing.sm }}
        >
          {t('lesson.abaInstruction')}
        </AppText>
      ) : (
        <AppText variant="small" style={{ color: theme.colors.textMuted, marginBottom: theme.spacing.sm }}>
          {t('lesson.standardTaskLabel')}
        </AppText>
      )}

      <AppText variant="title" accessibilityRole="header">
        {t(lesson.titleKey)}
      </AppText>
      <Spacer size="sm" />

      <Spacer size="lg" />

      {/* Hint Card (Prompt Level 1+, both standard and ABA mode) */}
      {hintText && promptLevel >= 1 && (
        <View
          style={{
            borderLeftWidth: 4,
            borderLeftColor: theme.colors.primary,
            backgroundColor: theme.colors.primary + '15',
            borderRadius: theme.radii.sm,
            padding: theme.spacing.md,
            marginBottom: theme.spacing.md,
          }}
        >
          <AppText variant="small" style={{ color: theme.colors.primary, fontWeight: '700', marginBottom: 4 }}>
            {t('lesson.hintFromTali')}
          </AppText>
          <AppText variant="small">{hintText}</AppText>
        </View>
      )}

      <Card>
        {task.visualCount != null && task.visualEmoji ? (
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: theme.spacing.sm,
              marginBottom: theme.spacing.md,
            }}
            accessibilityLabel={`${task.visualCount} ${task.visualEmoji}`}
          >
            {(() => {
              const visualEmoji = task.visualEmoji;
              return Array.from({ length: task.visualCount }, (_, i) => {
                const countImg = VISUAL_COUNT_IMAGE_BY_EMOJI[visualEmoji];
                return countImg ? (
                  <NanoBananaIcon key={i} source={countImg} size={40} accessibilityLabel={visualEmoji} />
                ) : (
                  <AppText key={i} style={{ fontSize: 36 }}>
                    {visualEmoji}
                  </AppText>
                );
              });
            })()}
          </View>
        ) : task.visualEmoji && !isTherapistLedTask(task) ? (
          // Standalone illustrative emoji (no count) - gives text-only task
          // types (kindergarten/grade-1 content) a visual anchor alongside
          // the question instead of pure text.
          <View style={{ alignItems: 'center', marginBottom: theme.spacing.md }}>
            <AppText style={{ fontSize: 48 }} accessibilityLabel={task.visualEmoji}>
              {task.visualEmoji}
            </AppText>
          </View>
        ) : null}

        <Pressable
          onPress={() => {
            if (!ttsEnabled) return;
            const line = lt(task.questionKey);
            void playLessonTaskVoiceLine(
              lesson.id,
              lessonTaskQuestionVoiceKey(lesson.id, task.id, language),
              line,
              language,
            );
          }}
          accessibilityRole="button"
        >
          <AppText style={{ fontSize: theme.typography.body }}>
            {lt(task.questionKey)}
          </AppText>
        </Pressable>
        <Spacer size="md" />

        {selectHint &&
          !isTherapistLedTask(task) &&
          (task.type === 'multiple_choice' ||
            task.type === 'fill_blank' ||
            task.type === 'world_knowledge' ||
            task.type === 'image_word_match' ||
            task.type === 'image_point' ||
            task.type === 'sorting' ||
            task.type === 'routine_chain') && (
              <View style={{ marginBottom: theme.spacing.sm, padding: theme.spacing.sm, backgroundColor: theme.colors.accent + '22', borderRadius: theme.radii.sm }}>
                <AppText style={{ color: theme.colors.secondary, fontWeight: '600', fontSize: 14 }}>
                  {t('lesson.selectAnswerHint')}
                </AppText>
              </View>
            )}

        {isTherapistLedTask(task) ? (
          <View style={{ gap: theme.spacing.md }}>
            {task.type === 'vocal_imitation' && (
              <AppText style={{ fontSize: 40, fontWeight: '700', textAlign: 'center' }}>
                {lt(task.soundTextKey)}
              </AppText>
            )}
            {task.type === 'word_repetition' && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 4 }}>
                {splitWordSyllables(lt(task.wordKey)).map((syll, i) => (
                  <AppText
                    key={`${syll}-${i}`}
                    style={{
                      fontSize: 36,
                      fontWeight: i === (task.stressSyllableIndex ?? -1) ? '900' : '600',
                      color:
                        i === (task.stressSyllableIndex ?? -1)
                          ? theme.colors.primary
                          : theme.colors.text,
                    }}
                  >
                    {syll}
                  </AppText>
                ))}
              </View>
            )}
            {task.type === 'volume_control' && (
              <View>
                <AppText style={{ textAlign: 'center', marginBottom: theme.spacing.sm }}>
                  {lt(task.promptTextKey)}
                </AppText>
                <View
                  style={{
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: theme.colors.border,
                    marginVertical: theme.spacing.md,
                    justifyContent: 'center',
                  }}
                >
                  <View
                    style={{
                      position: 'absolute',
                      width: '24%',
                      height: 22,
                      borderRadius: 11,
                      backgroundColor: theme.colors.primary + '99',
                      left: task.direction === 'louder' ? '72%' : '4%',
                    }}
                  />
                </View>
              </View>
            )}
            {task.type === 'action_instruction' && (
              <View style={{ alignItems: 'center', gap: theme.spacing.md }}>
                {getAbaLessonImage(task.illustrationKey) ? (
                  <Image
                    source={getAbaLessonImage(task.illustrationKey)!}
                    style={{ width: 160, height: 160, resizeMode: 'contain' }}
                    accessibilityIgnoresInvertColors
                  />
                ) : null}
                <AppText style={{ fontSize: 36, fontWeight: '800', textAlign: 'center' }}>
                  {lt(task.actionKey)}
                </AppText>
              </View>
            )}
            {!hasChecked && (
              <View style={{ flexDirection: 'row', gap: theme.spacing.sm, justifyContent: 'center', flexWrap: 'wrap' }}>
                <Button variant="secondary" onPress={handleTherapistRetry} disabled={taskTransitionBusy}>
                  {t('lesson.abaTherapistConfirmRetry')}
                </Button>
                <Button onPress={handleTherapistDone} disabled={taskTransitionBusy}>
                  {t('lesson.abaTherapistConfirmDone')}
                </Button>
              </View>
            )}
          </View>
        ) : task.type === 'multiple_choice' ? (
          <View accessibilityRole="radiogroup" accessibilityLabel={t('lesson.multipleChoiceLabel')}>
            {!hasChecked && (
              <View style={{ alignItems: 'flex-end', marginBottom: theme.spacing.sm }}>
                <VoiceInputButton
                  onTranscript={(transcript) => {
                    if (hasChecked || taskTransitionBusy) return;
                    const lower = transcript.toLowerCase();
                    const mcTask = task as MultipleChoiceTask;
                    const match = displayOptions.find((o) =>
                      'textKey' in o &&
                      o.textKey &&
                      (optionText(o.textKey).toLowerCase().includes(lower) ||
                        lower.includes(optionText(o.textKey).toLowerCase())),
                    );
                    if (match) { setSelectedOptionId(match.id); setSelectHint(false); }
                  }}
                  disabled={hasChecked || taskTransitionBusy}
                />
              </View>
            )}
            {displayOptions.map((option) => {
              const isSelected = selectedOptionId === option.id;
              const showCorrect = hasChecked && feedback === 'correct' && option.correct;
              const showWrong = hasChecked && feedback === 'incorrect' && isSelected;
              const isVisualTarget =
                promptLevel >= 1 && option.correct && !hasChecked;
              const isDisabledByPrompt =
                promptLevel >= 2 && !option.correct && !hasChecked;

              return (
                <Pressable
                  key={option.id}
                  onPress={() => {
                    if (!hasChecked && !isDisabledByPrompt && !taskTransitionBusy) {
                      setSelectedOptionId(option.id);
                      setSelectHint(false);
                    }
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{
                    selected: isSelected,
                    disabled: isDisabledByPrompt || taskTransitionBusy,
                  }}
                  style={{
                    marginBottom: theme.spacing.sm,
                    opacity: isDisabledByPrompt || taskTransitionBusy ? 0.3 : 1,
                  }}
                  disabled={isDisabledByPrompt || taskTransitionBusy}
                >
                  <Card
                    highlighted={isSelected && !hasChecked}
                    style={{
                      borderWidth: showCorrect || showWrong || isVisualTarget ? 2 : undefined,
                      borderColor: showCorrect || isVisualTarget
                        ? theme.colors.success
                        : showWrong
                          ? useAbaPedagogy
                            ? theme.colors.primary
                            : theme.colors.error
                          : undefined,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <AppText style={{ fontSize: theme.typography.body }}>
                        {optionText(('textKey' in option && option.textKey) ? option.textKey : '')}
                      </AppText>
                      {showCorrect && (
                        <NanoBananaIcon source={NANO_UI.check} size={22} accessibilityLabel="OK" />
                      )}
                      {showWrong && !useAbaPedagogy ? (
                        <NanoBananaIcon source={NANO_UI.x} size={22} accessibilityLabel="X" />
                      ) : null}
                    </View>
                  </Card>
                </Pressable>
              );
            })}
          </View>
        ) : task.type === 'world_knowledge' ? (
          <View accessibilityRole="radiogroup" accessibilityLabel={t('lesson.multipleChoiceLabel')}>
            {(task as WorldKnowledgeTask).options.map((option) => {
              const isSelected = selectedOptionId === option.id;
              const showCorrect = hasChecked && feedback === 'correct' && option.correct;
              const showWrong = hasChecked && feedback === 'incorrect' && isSelected;
              const isVisualTarget =
                promptLevel >= 1 && option.correct && !hasChecked;
              const isDisabledByPrompt =
                promptLevel >= 2 && !option.correct && !hasChecked;
              const label = option.textKey ? optionText(option.textKey) : '';
              const src = option.imageKey ? getAbaLessonImage(option.imageKey) : undefined;

              return (
                <Pressable
                  key={option.id}
                  onPress={() => {
                    if (!hasChecked && !isDisabledByPrompt && !taskTransitionBusy) {
                      setSelectedOptionId(option.id);
                      setSelectHint(false);
                    }
                  }}
                  accessibilityRole="radio"
                  style={{
                    marginBottom: theme.spacing.sm,
                    opacity: isDisabledByPrompt || taskTransitionBusy ? 0.3 : 1,
                  }}
                  disabled={isDisabledByPrompt || taskTransitionBusy}
                >
                  <Card
                    highlighted={isSelected && !hasChecked}
                    style={{
                      borderWidth: showCorrect || showWrong || isVisualTarget ? 2 : undefined,
                      borderColor: showCorrect || isVisualTarget
                        ? theme.colors.success
                        : showWrong
                          ? useAbaPedagogy
                            ? theme.colors.primary
                            : theme.colors.error
                          : undefined,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      {src ? (
                        <Image source={src} style={{ width: 48, height: 48, resizeMode: 'contain' }} />
                      ) : null}
                      {label ? (
                        <AppText style={{ fontSize: theme.typography.body, flex: 1 }}>{label}</AppText>
                      ) : null}
                      {showCorrect && (
                        <NanoBananaIcon source={NANO_UI.check} size={22} accessibilityLabel="OK" />
                      )}
                      {showWrong && !useAbaPedagogy ? (
                        <NanoBananaIcon source={NANO_UI.x} size={22} accessibilityLabel="X" />
                      ) : null}
                    </View>
                  </Card>
                </Pressable>
              );
            })}
          </View>
        ) : task.type === 'image_word_match' ? (
          <View accessibilityRole="radiogroup" accessibilityLabel={t('lesson.multipleChoiceLabel')}>
            {(task as ImageWordMatchTask).direction === 'image_to_word' && (task as ImageWordMatchTask).promptImageKey ? (
              <View style={{ alignItems: 'center', marginBottom: theme.spacing.md }}>
                {getAbaLessonImage((task as ImageWordMatchTask).promptImageKey!) ? (
                  <Image
                    source={getAbaLessonImage((task as ImageWordMatchTask).promptImageKey!)!}
                    style={{ width: 140, height: 140, resizeMode: 'contain' }}
                  />
                ) : null}
              </View>
            ) : (task as ImageWordMatchTask).promptTextKey ? (
              <AppText style={{ marginBottom: theme.spacing.md, fontSize: theme.typography.body, textAlign: 'center' }}>
                {lt((task as ImageWordMatchTask).promptTextKey!)}
              </AppText>
            ) : null}
            {(task as ImageWordMatchTask).options.map((option) => {
              const isSelected = selectedOptionId === option.id;
              const showCorrect = hasChecked && feedback === 'correct' && option.correct;
              const showWrong = hasChecked && feedback === 'incorrect' && isSelected;
              const isVisualTarget =
                promptLevel >= 1 && option.correct && !hasChecked;
              const isDisabledByPrompt =
                promptLevel >= 2 && !option.correct && !hasChecked;
              const label = option.textKey ? optionText(option.textKey) : '';
              const src = option.imageKey ? getAbaLessonImage(option.imageKey) : undefined;

              return (
                <Pressable
                  key={option.id}
                  onPress={() => {
                    if (!hasChecked && !isDisabledByPrompt && !taskTransitionBusy) {
                      setSelectedOptionId(option.id);
                      setSelectHint(false);
                    }
                  }}
                  accessibilityRole="radio"
                  style={{
                    marginBottom: theme.spacing.sm,
                    opacity: isDisabledByPrompt || taskTransitionBusy ? 0.3 : 1,
                  }}
                  disabled={isDisabledByPrompt || taskTransitionBusy}
                >
                  <Card
                    highlighted={isSelected && !hasChecked}
                    style={{
                      borderWidth: showCorrect || showWrong || isVisualTarget ? 2 : undefined,
                      borderColor: showCorrect || isVisualTarget
                        ? theme.colors.success
                        : showWrong
                          ? useAbaPedagogy
                            ? theme.colors.primary
                            : theme.colors.error
                          : undefined,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      {src ? (
                        <Image source={src} style={{ width: 48, height: 48, resizeMode: 'contain' }} />
                      ) : null}
                      {label ? (
                        <AppText style={{ fontSize: theme.typography.body, flex: 1 }}>{label}</AppText>
                      ) : null}
                      {showCorrect && (
                        <NanoBananaIcon source={NANO_UI.check} size={22} accessibilityLabel="OK" />
                      )}
                      {showWrong && !useAbaPedagogy ? (
                        <NanoBananaIcon source={NANO_UI.x} size={22} accessibilityLabel="X" />
                      ) : null}
                    </View>
                  </Card>
                </Pressable>
              );
            })}
          </View>
        ) : task.type === 'fill_blank' ? (
          <View>
            {(() => {
              const fbTask = task as FillBlankTask;
              let blankDisplay = '…';
              if (hasChecked) {
                const co = fbTask.options.find((o) => o.correct);
                if (co) blankDisplay = lt(co.textKey);
              } else if (selectedOptionId) {
                const so = fbTask.options.find((o) => o.id === selectedOptionId);
                if (so) blankDisplay = lt(so.textKey);
              }
              const parts = lt(fbTask.sentenceKey).split('_');
              return (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginBottom: theme.spacing.md }}>
                  {parts.map((part, i, arr) => (
                    <React.Fragment key={i}>
                      <AppText style={{ fontSize: 22 }}>{part}</AppText>
                      {i < arr.length - 1 ? (
                        <View
                          style={{
                            minWidth: 40,
                            borderBottomWidth: 3,
                            borderColor: theme.colors.primary,
                            marginHorizontal: 4,
                            paddingHorizontal: 4,
                          }}
                        >
                          <AppText style={{ fontSize: 22, textAlign: 'center' }}>{blankDisplay}</AppText>
                        </View>
                      ) : null}
                    </React.Fragment>
                  ))}
                </View>
              );
            })()}
            {(task as FillBlankTask).options.map((option) => {
              const isSelected = selectedOptionId === option.id;
              const showCorrect = hasChecked && feedback === 'correct' && option.correct;
              const showWrong = hasChecked && feedback === 'incorrect' && isSelected;
              const isVisualTarget =
                promptLevel >= 1 && option.correct && !hasChecked;
              const isDisabledByPrompt =
                promptLevel >= 2 && !option.correct && !hasChecked;
              return (
                <Pressable
                  key={option.id}
                  onPress={() => {
                    if (!hasChecked && !isDisabledByPrompt && !taskTransitionBusy) {
                      setSelectedOptionId(option.id);
                      setSelectHint(false);
                    }
                  }}
                  style={{
                    marginBottom: theme.spacing.sm,
                    opacity: isDisabledByPrompt || taskTransitionBusy ? 0.3 : 1,
                  }}
                  disabled={isDisabledByPrompt || taskTransitionBusy}
                >
                  <Card
                    highlighted={isSelected && !hasChecked}
                    style={{
                      borderWidth: showCorrect || showWrong || isVisualTarget ? 2 : undefined,
                      borderColor: showCorrect || isVisualTarget
                        ? theme.colors.success
                        : showWrong
                          ? useAbaPedagogy
                            ? theme.colors.primary
                            : theme.colors.error
                          : undefined,
                    }}
                  >
                    <AppText style={{ fontSize: theme.typography.body }}>{optionText(option.textKey)}</AppText>
                  </Card>
                </Pressable>
              );
            })}
          </View>
        ) : task.type === 'image_point' ? (
          <View>
            {getAbaLessonImage((task as ImagePointTask).imageKey) ? (
              <View
                accessibilityRole="radiogroup"
                accessibilityLabel={t('lesson.imagePointGroupLabel')}
                style={{ width: '100%', aspectRatio: 1, position: 'relative', marginBottom: theme.spacing.md }}
              >
                <Image
                  source={getAbaLessonImage((task as ImagePointTask).imageKey)!}
                  style={{ width: '100%', height: '100%', resizeMode: 'contain' }}
                />
                {(task as ImagePointTask).hotspots.map((h, hotspotIndex) => {
                  const isSelected = selectedOptionId === h.id;
                  const showCorrect = hasChecked && feedback === 'correct' && h.correct;
                  const showWrong = hasChecked && feedback === 'incorrect' && isSelected;
                  const isHotVisual =
                    promptLevel >= 1 && h.correct && !hasChecked;
                  return (
                    <Pressable
                      key={h.id}
                      onPress={() => {
                        if (!hasChecked && !taskTransitionBusy) {
                          setSelectedOptionId(h.id);
                          setSelectHint(false);
                        }
                      }}
                      accessibilityRole="radio"
                      accessibilityLabel={
                        h.labelKey
                          ? lt(h.labelKey)
                          : t('lesson.imagePointOptionLabel', { index: hotspotIndex + 1 })
                      }
                      accessibilityState={{ selected: isSelected, disabled: hasChecked || taskTransitionBusy }}
                      style={{
                        position: 'absolute',
                        left: `${h.x * 100}%`,
                        top: `${h.y * 100}%`,
                        width: 52,
                        height: 52,
                        marginLeft: -26,
                        marginTop: -26,
                        borderRadius: 26,
                        borderWidth: isSelected || showCorrect || showWrong || isHotVisual ? 3 : 2,
                        borderColor: showCorrect || isHotVisual
                          ? theme.colors.success
                          : showWrong
                            ? useAbaPedagogy
                              ? theme.colors.primary
                              : theme.colors.error
                            : isSelected
                              ? theme.colors.secondary
                              : '#ffffffaa',
                        backgroundColor: '#00000022',
                      }}
                      disabled={hasChecked || taskTransitionBusy}
                    />
                  );
                })}
              </View>
            ) : (
              <AppText>{t('errors.lessonNotFound')}</AppText>
            )}
          </View>
        ) : task.type === 'sorting' ? (
          <View>
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel={t('lesson.sortingGroupsLabel')}
              style={{ flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.md, flexWrap: 'wrap' }}
            >
              {(task as SortingTask).groups.map((g) => {
                const pickedItem = (task as SortingTask).items.find((i) => i.id === sortPickItemId);
                const isHintTarget =
                  promptLevel >= 2 && !!pickedItem && pickedItem.groupId === g.id && !hasChecked;
                return (
                  <Pressable
                    key={g.id}
                    onPress={() => {
                      if (hasChecked || taskTransitionBusy || !sortPickItemId) return;
                      setSortAssignments((prev) => ({ ...prev, [sortPickItemId]: g.id }));
                      setSortPickItemId(null);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={lt(g.labelKey)}
                    accessibilityState={{ disabled: hasChecked || taskTransitionBusy || !sortPickItemId }}
                    style={{
                      flex: 1,
                      minWidth: 120,
                      padding: theme.spacing.md,
                      borderRadius: theme.radii.md,
                      borderWidth: isHintTarget ? 3 : 2,
                      borderColor: isHintTarget ? theme.colors.success : theme.colors.border,
                      backgroundColor: theme.colors.surfaceAlt,
                    }}
                  >
                    <AppText style={{ textAlign: 'center', fontWeight: '700' }}>{lt(g.labelKey)}</AppText>
                  </Pressable>
                );
              })}
            </View>
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel={t('lesson.sortingItemsLabel')}
              style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}
            >
              {(task as SortingTask).items.map((it, itemIndex) => {
                const picked = sortPickItemId === it.id;
                const assigned = sortAssignments[it.id];
                const src = getAbaLessonImage(it.imageKey);
                return (
                  <Pressable
                    key={it.id}
                    onPress={() => {
                      if (hasChecked || taskTransitionBusy) return;
                      setSortPickItemId(it.id);
                      setSelectHint(false);
                    }}
                    accessibilityRole="radio"
                    accessibilityLabel={t('lesson.sortingItemLabel', { index: itemIndex + 1 })}
                    accessibilityState={{ selected: picked, disabled: hasChecked || taskTransitionBusy }}
                    style={{
                      padding: theme.spacing.sm,
                      borderRadius: theme.radii.md,
                      borderWidth: 2,
                      borderColor: picked ? theme.colors.secondary : theme.colors.border,
                      opacity: assigned ? 0.5 : 1,
                    }}
                  >
                    {src ? <Image source={src} style={{ width: 56, height: 56, resizeMode: 'contain' }} /> : null}
                    {assigned ? (
                      <AppText variant="small" style={{ textAlign: 'center' }}>
                        {lt((task as SortingTask).groups.find((g) => g.id === assigned)?.labelKey ?? '')}
                      </AppText>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : task.type === 'routine_chain' ? (
          <View>
            <AppText variant="small" style={{ marginBottom: theme.spacing.sm, color: theme.colors.textMuted }}>
              {t('lesson.abaRoutineTapOrder')}
            </AppText>
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel={t('lesson.abaRoutineTapOrder')}
              style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}
            >
              {(() => {
                const nextCorrectStepId = routineShuffledSteps
                  .filter((s) => !routinePickedIds.includes(s.id))
                  .sort((a, b) => a.order - b.order)[0]?.id;
                return routineShuffledSteps.map((step) => {
                  const picked = routinePickedIds.includes(step.id);
                  const src = getAbaLessonImage(step.imageKey);
                  const isHintTarget = promptLevel >= 2 && !hasChecked && !picked && step.id === nextCorrectStepId;
                  return (
                    <Pressable
                      key={step.id}
                      disabled={picked || hasChecked || taskTransitionBusy}
                      onPress={() => {
                        setRoutinePickedIds((prev) => [...prev, step.id]);
                        setSelectHint(false);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={lt(step.labelKey)}
                      accessibilityState={{ disabled: picked || hasChecked || taskTransitionBusy }}
                      style={{
                        width: 100,
                        padding: theme.spacing.sm,
                        borderRadius: theme.radii.md,
                        borderWidth: isHintTarget ? 3 : 2,
                        borderColor: isHintTarget ? theme.colors.success : theme.colors.border,
                        opacity: picked ? 0.35 : 1,
                        alignItems: 'center',
                      }}
                    >
                      {src ? <Image source={src} style={{ width: 48, height: 48, resizeMode: 'contain' }} /> : null}
                      <AppText variant="small" style={{ textAlign: 'center' }}>
                        {lt(step.labelKey)}
                      </AppText>
                    </Pressable>
                  );
                });
              })()}
            </View>
          </View>
        ) : task.type === 'input' && task.skippable ? (
          <View style={{ alignItems: 'center', paddingVertical: theme.spacing.md }}>
            <Button
              variant="secondary"
              onPress={handleSkip}
              disabled={taskTransitionBusy}
              style={{ minWidth: 200 }}
            >
              {t('lesson.skipTask')}
            </Button>
          </View>
        ) : task.type === 'input' ? (
          <View>
            <AppText style={{ marginBottom: theme.spacing.sm }}>{t('lesson.inputLabel')}</AppText>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
              <TextInput
                value={inputValue}
                onChangeText={setInputValue}
                placeholder={t(task.placeholderKey ?? 'lesson.answerPlaceholder')}
                placeholderTextColor={theme.colors.textMuted}
                editable={!hasChecked && !taskTransitionBusy}
                style={{
                  flex: 1,
                  borderWidth: 2,
                  borderColor: hasChecked
                    ? feedback === 'correct'
                      ? theme.colors.success
                      : useAbaPedagogy
                        ? theme.colors.primary
                        : theme.colors.error
                    : theme.colors.border,
                  borderRadius: theme.radii.md,
                  paddingHorizontal: theme.spacing.md,
                  paddingVertical: theme.spacing.sm + 2,
                  fontSize: theme.typography.body,
                  color: theme.colors.text,
                  backgroundColor: theme.colors.surfaceAlt,
                }}
                accessible
                accessibilityLabel={t('lesson.inputLabel')}
              />
              <VoiceInputButton
                onTranscript={(text) => setInputValue(text)}
                disabled={hasChecked || taskTransitionBusy}
              />
            </View>
            {promptLevel >= 2 && !hasChecked && task.answer.trim().length > 0 && (
              <AppText variant="small" style={{ marginTop: theme.spacing.sm, color: theme.colors.primary }}>
                {t('lesson.inputFirstLetterHint', { letter: task.answer.trim()[0]!.toUpperCase() })}
              </AppText>
            )}
          </View>
        ) : (
          <AppText>{t('errors.lessonNotFound')}</AppText>
        )}

        {showAbaSkipBelow ? (
          <View style={{ alignItems: 'center', paddingTop: theme.spacing.md }}>
            <Button variant="secondary" onPress={handleSkip} disabled={taskTransitionBusy} style={{ minWidth: 200 }}>
              {t('lesson.skipTask')}
            </Button>
          </View>
        ) : null}

        <Spacer size="md" />

        {feedback === 'correct' && !useAbaPedagogy && (
          <View
            style={{
              backgroundColor: theme.colors.success + '22',
              borderRadius: theme.radii.md,
              padding: theme.spacing.sm,
            }}
          >
            <AppText style={{ color: theme.colors.success, fontWeight: '600', fontSize: 18 }}>
              {correctFeedbackText}
            </AppText>
          </View>
        )}
        {feedback === 'incorrect' && (
          <View
            style={{
              backgroundColor: useAbaPedagogy ? theme.colors.primary + '16' : theme.colors.error + '22',
              borderRadius: theme.radii.md,
              padding: theme.spacing.sm,
            }}
          >
            <AppText
              style={{
                color: useAbaPedagogy ? theme.colors.primary : theme.colors.error,
                fontWeight: '600',
              }}
            >
              {incorrectFeedbackText}
            </AppText>
          </View>
        )}
      </Card>

      <Spacer size="lg" />

      {/* Large voice input row — shown when task is not yet checked */}
      {!hasChecked && !isTherapistLedTask(task) && (
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.sm }}>
          <VoiceInputButton
            large
            label={t('voiceInput.speakAnswer')}
            onTranscript={(transcript) => {
              if (hasChecked || taskTransitionBusy) return;
                const lower = transcript.toLowerCase();
              if (task.type === 'multiple_choice') {
                const mcTask = task as MultipleChoiceTask;
                const match = mcTask.options.find((o) =>
                  optionText(o.textKey).toLowerCase().includes(lower) ||
                  lower.includes(optionText(o.textKey).toLowerCase()),
                );
                if (match) { setSelectedOptionId(match.id); setSelectHint(false); }
              } else if (task.type === 'fill_blank') {
                const fb = task as FillBlankTask;
                const match = fb.options.find((o) => lt(o.textKey).toLowerCase().includes(lower));
                if (match) { setSelectedOptionId(match.id); setSelectHint(false); }
              } else if (task.type === 'world_knowledge') {
                const wk = task as WorldKnowledgeTask;
                const match = wk.options.find((o) =>
                  o.textKey
                    ? lt(o.textKey).toLowerCase().includes(lower) ||
                      lower.includes(lt(o.textKey).toLowerCase())
                    : false,
                );
                if (match) { setSelectedOptionId(match.id); setSelectHint(false); }
              } else if (task.type === 'image_word_match') {
                const im = task as ImageWordMatchTask;
                const match = im.options.find((o) =>
                  o.textKey
                    ? optionText(o.textKey).toLowerCase().includes(lower) ||
                      lower.includes(optionText(o.textKey).toLowerCase())
                    : false,
                );
                if (match) { setSelectedOptionId(match.id); setSelectHint(false); }
              } else if (task.type === 'input') {
                setInputValue(transcript);
              }
            }}
            disabled={hasChecked || taskTransitionBusy}
          />
        </View>
      )}

      {!(isTherapistLedTask(task) && !hasChecked) ? (
      <Button
        onPress={handlePrimaryPress}
        disabled={taskTransitionBusy}
        style={{
          backgroundColor: !hasChecked
            ? theme.colors.secondary
            : feedback === 'correct'
              ? theme.colors.success
              : useAbaPedagogy
                ? theme.colors.primary
                : theme.colors.error,
          borderColor: !hasChecked
            ? theme.colors.secondary
            : feedback === 'correct'
              ? theme.colors.success
              : useAbaPedagogy
                ? theme.colors.primary
                : theme.colors.error,
          shadowColor: !hasChecked ? theme.colors.secondary : theme.colors.primary,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.22,
          shadowRadius: 10,
          elevation: 5,
        }}
      >
        {checkButtonLabel}
      </Button>
      ) : (
        <Spacer size="md" />
      )}

      <BreakReminderModal
        visible={breakModalVisible}
        breakDurationMinutes={breakDurationMinutes}
        onDismiss={dismissBreakReminder}
      />

      <TaliFAB
        lessonId={lesson.id}
        topicId={topic.id}
        taskContext={companionTaskContext ? undefined : taskDescriptionForTali}
        companionTaskContext={companionTaskContext}
        lessonTitle={t(lesson.titleKey)}
      />
    </Screen>
  );
}

export default function LessonScreen() {
  return (
    <ConsentGate>
      <LessonScreenContent />
    </ConsentGate>
  );
}

