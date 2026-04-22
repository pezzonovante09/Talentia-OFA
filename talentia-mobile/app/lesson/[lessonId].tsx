import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Modal, Pressable, TextInput, View } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import * as Haptics from 'expo-haptics';
import { NanoBananaIcon } from '../../src/components/NanoBananaIcon';
import { NANO_UI, getNanoNpcForWorld, resolveScreenBackground } from '../../src/constants/nanoBananaAssets';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Screen } from '../../src/components/Screen';
import { ABAReinforcementBanner } from '../../src/components/ABAReinforcementBanner';
import { TaliVideo } from '../../src/components/TaliVideo';
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
  IntroSlide,
  filterTasksForProfile,
  getLesson,
  getTopicForLesson,
  getWorldForLesson,
  type FillBlankTask,
  type ImagePointTask,
  type ImageWordMatchTask,
  type RoutineChainTask,
  type SortingTask,
  type WorldKnowledgeTask,
} from '../../src/data/worlds';
import { getBiomeDisplayEmoji } from '../../src/utils/biomeDisplay';
import { useProgressStore, getLevelFromXP } from '../../src/store/progressStore';
import { useCollectiblesStore, COLLECTIBLES_META } from '../../src/store/collectiblesStore';
import { useAuth } from '../../src/context/AuthContext';
import { useSettingsStore } from '../../src/store/settingsStore';
import { getHint, explainError, type TaskContext } from '../../src/services/CompanionService';
import { useSpeech } from '../../src/hooks/useSpeech';
import {
  getBundledVoiceModuleId,
  lessonBundledVoiceKey,
  tryPlayBundledLessonVoice,
} from '../../src/services/lessonBundledVoice';
import {
  lessonTaskOptionVoiceKey,
  lessonTaskQuestionVoiceKey,
  playLessonTaskVoiceLine,
} from '../../src/services/lessonTaskBundledVoice';
import { speakViaTali, stopTaliSpeech, type TaliTtsLanguage } from '../../src/services/ttsService';
import { getAbaLessonImage } from '../../src/constants/abaLessonImages';
import { useAbaTokenStore } from '../../src/store/abaTokenStore';
import { useAbaLiveSessionStore } from '../../src/store/abaLiveSessionStore';
import { ABATokenReward } from '../../src/components/ABATokenReward';
import { ABAPuzzleScreen } from '../../src/components/ABAPuzzleScreen';
import { flushAnalyticsQueue } from '../../src/services/analyticsService';
import i18nInstance from '../../src/i18n';

type Phase = 'dialog' | 'intro' | 'tasks' | 'aba_tokens' | 'aba_puzzle' | 'reward';
type Feedback = 'idle' | 'correct' | 'incorrect';
type PromptLevel = 0 | 1 | 2;
type SuccessType = 'pure' | 'assisted';

function mapLangToTaliTts(code: string): TaliTtsLanguage {
  return code === 'en' ? 'en' : 'ru';
}

const ABA_REINFORCE_KEYS = [
  'lesson.abaReinforce1',
  'lesson.abaReinforce2',
  'lesson.abaReinforce3',
  'lesson.abaReinforce4',
  'lesson.abaReinforce5',
  'lesson.abaReinforce6',
  'lesson.abaReinforce7',
  'lesson.abaReinforce8',
] as const;

function isTherapistLedTask(t: LessonTask): boolean {
  return (
    t.type === 'vocal_imitation' ||
    t.type === 'word_repetition' ||
    t.type === 'volume_control' ||
    t.type === 'action_instruction'
  );
}

function shuffleArray<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}

/** Syllable-ish chunks for stress highlight (Cyrillic + Latin). */
function abaTaskInstructionI18nKey(taskType: LessonTask['type']): string {
  if (taskType === 'action_instruction') return 'lesson.aba_action_instruction';
  return `lesson.aba_${taskType}_instruction`;
}

function splitWordSyllables(word: string): string[] {
  const vowel = /[aeiouyаеёиоуыэюяAEIOUYАЕЁИОУЫЭЮЯ]/;
  const parts: string[] = [];
  let buf = '';
  for (const ch of word) {
    buf += ch;
    if (vowel.test(ch)) {
      parts.push(buf);
      buf = '';
    }
  }
  if (buf.length) parts.push(buf);
  return parts.length ? parts : [word];
}

// ── Typing animation hook ────────────────────────────────────────────────────
function useTypingText(text: string, speed = 22): { displayed: string; done: boolean } {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);
  useEffect(() => {
    setDisplayed('');
    setDone(false);
    if (!text) { setDone(true); return; }
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) { setDone(true); clearInterval(interval); }
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed]);
  return { displayed, done };
}

// ── Confetti particle ────────────────────────────────────────────────────────
const CONFETTI_COLORS = ['#FF9E66', '#18C1B5', '#FFD96A', '#FF5C7A', '#1AB58A', '#8B5CF6'];

function ConfettiParticle({ delay, color, startX }: { delay: number; color: string; startX: number }) {
  const y = useRef(new Animated.Value(0)).current;
  const x = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const dx = (Math.random() - 0.5) * 280;
    const dy = -(Math.random() * 320 + 120);
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 100, useNativeDriver: true }),
        Animated.spring(y, { toValue: dy, useNativeDriver: true, tension: 40, friction: 6 }),
        Animated.spring(x, { toValue: dx, useNativeDriver: true, tension: 40, friction: 6 }),
        Animated.timing(rotate, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
      Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  const spin = rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: startX,
        top: 0,
        width: 10,
        height: 10,
        borderRadius: 2,
        backgroundColor: color,
        transform: [{ translateY: y }, { translateX: x }, { rotate: spin }],
        opacity,
      }}
    />
  );
}

function Confetti() {
  const particles = useMemo(
    () =>
      Array.from({ length: 30 }, (_, i) => ({
        key: i,
        delay: i * 30,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        startX: 120 + (i % 5) * 20,
      })),
    [],
  );
  return (
    <View style={{ position: 'absolute', top: 80, left: 0, right: 0, height: 0, overflow: 'visible' }} pointerEvents="none">
      {particles.map((p) => (
        <ConfettiParticle key={p.key} delay={p.delay} color={p.color} startX={p.startX} />
      ))}
    </View>
  );
}

// ── Stars display ─────────────────────────────────────────────────────────────
function StarsRow({ stars, size = 28 }: { stars: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 4 }}>
      {[1, 2, 3].map((i) => (
        <NanoBananaIcon
          key={i}
          source={NANO_UI.stars}
          size={size}
          style={{ opacity: i <= stars ? 1 : 0.25 }}
        />
      ))}
    </View>
  );
}

// ── Main lesson screen ────────────────────────────────────────────────────────
export default function LessonScreen() {
  const { lessonId } = useLocalSearchParams<{ lessonId?: string; topicId?: string }>();
  const { t } = useTranslation();
  const theme = useAppTheme();
  const router = useRouter();

  const { profile, user } = useAuth();
  const language = useSettingsStore((s) => s.language);
  const ttsEnabled = useSettingsStore((s) => s.ttsEnabled);
  const reduceMotion = useSettingsStore((s) => s.reduceMotion);
  const breakReminderEnabled = useSettingsStore((s) => s.breakReminderEnabled);
  const sessionDurationMinutes = useSettingsStore((s) => s.sessionDurationMinutes);
  const breakDurationMinutes = useSettingsStore((s) => s.breakDurationMinutes);

  const recordAnswer = useProgressStore((s) => s.recordAnswer);
  const markLessonCompleted = useProgressStore((s) => s.markLessonCompleted);
  const addXP = useProgressStore((s) => s.addXP);
  const xp = useProgressStore((s) => s.xp);
  const topicsState = useProgressStore((s) => s.topics);
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

  // Resolve lesson data before any conditional renders
  const lesson = lessonId ? getLesson(String(lessonId)) : null;
  const topic = lessonId ? getTopicForLesson(String(lessonId)) : null;
  const world = lessonId ? getWorldForLesson(String(lessonId)) : null;

  const isEnglishLesson = topic?.subject === 'reading';
  const tEn = useCallback((key: string) => i18nInstance.t(key, { lng: 'en' }), []);
  const optionText = useCallback(
    (key: string) => (isEnglishLesson ? tEn(key) : t(key)),
    [isEnglishLesson, tEn, t],
  );

  const topicDifficulty = topic ? (topicsState[topic.id]?.difficulty ?? 1) : 1;

  /** ABA: иерархия подсказок, подсветка верного ответа, озвучка правильного варианта — только в режиме «особый» (special). */
  const useAbaPedagogy = profile?.child_mode === 'special';

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
    const baseFiltered = filterTasksForProfile(lesson.tasks, profile ? {
      child_mode: profile.child_mode,
      methodology: profile.methodology,
    } : null);
    const baseIds = new Set(baseFiltered.map((t) => t.id));
    const ordered = lesson.tasks.filter((tk) => {
      if (profile?.child_mode === 'special' && tk.audience === 'special_aba') return true;
      return baseIds.has(tk.id);
    });
    const range = 1;
    const byDifficulty = ordered.filter(
      (tk) => tk.difficulty >= topicDifficulty - range && tk.difficulty <= topicDifficulty + range,
    );
    return byDifficulty.length > 0 ? byDifficulty : ordered;
  }, [lesson, profile, topicDifficulty]);

  const hasDialog = (lesson?.dialog?.length ?? 0) > 0;
  const hasIntro = (lesson?.intro?.length ?? 0) > 0;
  const initialPhase: Phase = hasDialog ? 'dialog' : hasIntro ? 'intro' : 'tasks';

  const [phase, setPhase] = useState<Phase>(initialPhase);
  const [dialogIndex, setDialogIndex] = useState(0);
  const [introIndex, setIntroIndex] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [feedback, setFeedback] = useState<Feedback>('idle');
  const [hasChecked, setHasChecked] = useState(false);
  const [selectHint, setSelectHint] = useState(false);
  const [mistakeCount, setMistakeCount] = useState(0);
  const [trialCount, setTrialCount] = useState(1);
  const [earnedXP, setEarnedXP] = useState(0);
  const [earnedItem, setEarnedItem] = useState<string | null>(null);
  const [leveledUp, setLeveledUp] = useState(false);
  const [newLevel, setNewLevel] = useState(0);
  const [earnedStars, setEarnedStars] = useState<1 | 2 | 3>(3);
  const [breakModalVisible, setBreakModalVisible] = useState(false);
  const sessionStartRef = useRef<number | null>(null);
  const lessonRewardClaimedRef = useRef(false);
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

  // ABA Engine state
  const [promptLevel, setPromptLevel] = useState<PromptLevel>(0);
  const [hintText, setHintText] = useState<string | null>(null);
  const [successType, setSuccessType] = useState<SuccessType>('pure');

  const totalTasks = tasks.length;
  const isLastTask = totalTasks > 0 && currentIndex === totalTasks - 1;

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
    if (!useAbaPedagogy) {
      return t('lesson.standardCorrect');
    }
    if (feedback === 'correct' && successType === 'assisted') {
      return t('lesson.abaAssistedSuccess');
    }
    return t('lesson.abaCorrect');
  }, [feedback, successType, t, useAbaPedagogy]);

  const incorrectFeedbackText = useMemo(() => {
    if (!useAbaPedagogy) {
      return t('lesson.standardIncorrect');
    }
    if (promptLevel >= 2) return t('lesson.abaVerbalPromptFeedback');
    if (promptLevel >= 1) return t('lesson.abaVisualPromptFeedback');
    return t('lesson.abaIncorrect');
  }, [promptLevel, t, useAbaPedagogy]);

  const taskDescriptionForTali = useMemo(() => {
    const tk = tasks[currentIndex];
    if (!tk || !lesson || !topic) return '';
    const questionPrompt = t(tk.questionKey);
    const lines: string[] = [];
    if (questionPrompt) lines.push(`Задание: "${questionPrompt}"`);
    if (tk.type === 'multiple_choice') {
      const opts = (tk as MultipleChoiceTask).options.map((o) => optionText(o.textKey));
      if (opts.length) lines.push(`Варианты ответов: ${opts.join(', ')}`);
    } else if (tk.type === 'fill_blank') {
      const opts = (tk as FillBlankTask).options.map((o) => t(o.textKey));
      if (opts.length) lines.push(`Варианты: ${opts.join(', ')}`);
    } else if (tk.type === 'world_knowledge') {
      const wk = tk as WorldKnowledgeTask;
      const opts = wk.options.map((o) => (o.textKey ? t(o.textKey) : o.imageKey ?? '')).filter(Boolean);
      if (opts.length) lines.push(`Варианты: ${opts.join(', ')}`);
    } else if (tk.type === 'image_word_match') {
      const im = tk as ImageWordMatchTask;
      const opts = im.options.map((o) => (o.textKey ? t(o.textKey) : o.imageKey ?? '')).filter(Boolean);
      if (opts.length) lines.push(`Варианты: ${opts.join(', ')}`);
    } else if (tk.type === 'vocal_imitation') {
      lines.push(t(tk.soundTextKey));
    } else if (tk.type === 'word_repetition') {
      lines.push(t(tk.wordKey));
    } else if (tk.type === 'action_instruction') {
      lines.push(t(tk.actionKey));
    }
    return lines.join('. ');
  }, [tasks, currentIndex, lesson, topic, t, optionText]);

  // Flush queued analytics on mount
  useEffect(() => {
    if (user?.id) {
      flushAnalyticsQueue(user.id).catch(() => {});
    }
  }, [user?.id]);

  useEffect(() => {
    lessonRewardClaimedRef.current = false;
    setAbaReinforcement(null);
    abaCorrectProceedRef.current = null;
    liveSessionStartedRef.current = false;
    lastAbaReinforceIdx.current = null;
    clearLiveSession();
    return () => {
      if (taskGapTimerRef.current) {
        clearTimeout(taskGapTimerRef.current);
        taskGapTimerRef.current = null;
      }
    };
  }, [lessonId, clearLiveSession]);

  // Auto-speak task question when a new task appears (вшитый mp3 при наличии)
  useEffect(() => {
    if (phase !== 'tasks' || !lesson || !ttsEnabled) return;
    const tk = tasks[currentIndex];
    if (!tk) return;
    const speakLines = async () => {
      const q = t(tk.questionKey);
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
          await speakViaTali(inst, mapLangToTaliTts(language));
        }
      }
      if (tk.type === 'vocal_imitation') {
        await speakViaTali(t(tk.soundTextKey), mapLangToTaliTts(language));
        if (tk.audioPromptKey) {
          await speakViaTali(t(tk.audioPromptKey), mapLangToTaliTts(language));
        }
      } else if (tk.type === 'word_repetition') {
        await speakViaTali(t(tk.wordKey), mapLangToTaliTts(language));
      } else if (tk.type === 'volume_control') {
        await speakViaTali(t(tk.promptTextKey), mapLangToTaliTts(language));
      } else if (tk.type === 'action_instruction') {
        await speakViaTali(t(tk.actionKey), mapLangToTaliTts(language));
      }
    };
    const delay = setTimeout(() => {
      void speakLines();
    }, 500);
    return () => clearTimeout(delay);
  }, [phase, currentIndex, tasks, lesson, language, t, ttsEnabled, useAbaPedagogy]);

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
      void speakViaTali(abaReinforcement.phrase, mapLangToTaliTts(language));
    }, 200);
    return () => clearTimeout(delay);
  }, [abaReinforcement, ttsEnabled, useAbaPedagogy, language]);

  // Auto-speak feedback when it changes (ABA: correct — only banner, no duplicate TTS)
  useEffect(() => {
    if (feedback === 'correct') {
      if (useAbaPedagogy) return;
      const delay = setTimeout(() => speak(correctFeedbackText), 200);
      return () => clearTimeout(delay);
    }
    if (feedback === 'incorrect') {
      const delay = setTimeout(() => speak(incorrectFeedbackText), 200);
      return () => clearTimeout(delay);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedback, correctFeedbackText, incorrectFeedbackText, useAbaPedagogy]);

  // Break reminder
  useEffect(() => {
    if (!breakReminderEnabled || phase !== 'tasks') return;
    if (sessionStartRef.current === null) {
      sessionStartRef.current = Date.now();
    }
    const interval = setInterval(() => {
      const start = sessionStartRef.current;
      if (!start || breakModalVisible) return;
      const elapsed = (Date.now() - start) / (60 * 1000);
      if (elapsed >= sessionDurationMinutes) {
        setBreakModalVisible(true);
        sessionStartRef.current = null;
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [breakReminderEnabled, phase, sessionDurationMinutes, breakModalVisible]);

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

  const buildTaskContext = (): TaskContext => ({
    questionPrompt: task ? t(task.questionKey) : '',
    answerOptions: (() => {
      if (!task) return undefined;
      if (task.type === 'multiple_choice') {
        return (task as MultipleChoiceTask).options.map((o) =>
            isEnglishLesson ? tEn(o.textKey) : t(o.textKey),
        );
      }
      if (task.type === 'fill_blank') {
        return (task as FillBlankTask).options.map((o) => t(o.textKey));
      }
      if (task.type === 'world_knowledge') {
        return (task as WorldKnowledgeTask).options.map((o) =>
          o.textKey ? t(o.textKey) : o.imageKey ?? '',
        );
      }
      if (task.type === 'image_word_match') {
        return (task as ImageWordMatchTask).options.map((o) =>
          o.textKey ? t(o.textKey) : o.imageKey ?? '',
        );
      }
      return undefined;
    })(),
    subjectId:
      topic.subject === 'math'
        ? 'math'
        : topic.subject === 'reading'
          ? 'english'
          : topic.subject === 'social'
            ? 'social'
            : 'science',
    topicId: topic.id,
    lessonId: lesson.id,
    childMode: profile?.child_mode ?? 'standard',
    methodology:
      profile?.child_mode === 'special' ? (profile.methodology ?? 'aba') : 'standard',
    correctAnswer: (() => {
      if (!task) return undefined;
      if (task.type === 'multiple_choice') {
            const opt = (task as MultipleChoiceTask).options.find((o) => o.correct);
            return opt ? (isEnglishLesson ? tEn(opt.textKey) : t(opt.textKey)) : undefined;
      }
      if (task.type === 'fill_blank') {
        const opt = (task as FillBlankTask).options.find((o) => o.correct);
        return opt ? t(opt.textKey) : undefined;
      }
      if (task.type === 'world_knowledge') {
        const opt = (task as WorldKnowledgeTask).options.find((o) => o.correct);
        if (!opt) return undefined;
        return opt.textKey ? t(opt.textKey) : opt.imageKey;
      }
      if (task.type === 'image_word_match') {
        const opt = (task as ImageWordMatchTask).options.find((o) => o.correct);
        if (!opt) return undefined;
        return opt.textKey ? t(opt.textKey) : opt.imageKey;
      }
      if (task.type === 'input') return String(task.answer);
      return undefined;
    })(),
  });

  // ── Dialog phase ─────────────────────────────────────────────────────────
  if (phase === 'dialog') {
    const line = dialog[dialogIndex];
    const isTali = line.speaker === 'tali';
    const speakerName = isTali ? t('tali.name') : `${npcName}${npcEmoji ? ` ${npcEmoji}` : ''}`.trim();
    const speakerColor = isTali ? theme.colors.primary : accentColor;
    const isLastLine = dialogIndex === dialog.length - 1;
    const fullText = t(line.textKey);

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
        t={t}
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
        t={t}
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

  const difficulty = topicsState[topic.id]?.difficulty ?? 1;
  const TASK_GAP_MS = 1500;

  const resetForNextTask = () => {
    setSelectedOptionId(null);
    setInputValue('');
    setFeedback('idle');
    setHasChecked(false);
    setSelectHint(false);
    setTrialCount(1);
    setPromptLevel(0);
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

    const reward = lesson.reward;
    const xpGain = reward?.xp ?? 20;
    const prevLevel = getLevelFromXP(xp);
    const stars: 1 | 2 | 3 = totalMistakes === 0 ? 3 : totalMistakes <= 2 ? 2 : 1;

    markLessonCompleted({ topicId: topic.id, lessonId: lesson.id, mistakeCount: totalMistakes });
    addXP(xpGain);

    const newXP = xp + xpGain;
    const nextLevel = getLevelFromXP(newXP);

    if (reward?.item) {
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
    if (useAbaPedagogy) {
      setPendingAbaTokenCount(stars);
      setPhase('aba_tokens');
    } else {
    setPhase('reward');
    }
  };

  const handleSkip = () => {
    if (taskTransitionBusy) return;
    if (useAbaPedagogy && ttsEnabled) {
      void speakViaTali(t('lesson.abaSkipFeedback'), mapLangToTaliTts(language));
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

  const playAbaLevel2CorrectVoice = () => {
    if (!ttsEnabled) return;
    if (task.type === 'multiple_choice') {
      const correctOpt = (task as MultipleChoiceTask).options.find((o) => o.correct);
      if (correctOpt) {
        const line = optionText(correctOpt.textKey);
        void playLessonTaskVoiceLine(
          lesson.id,
          lessonTaskOptionVoiceKey(lesson.id, task.id, correctOpt.id, language),
          line,
          language,
        );
      }
    } else if (task.type === 'fill_blank') {
      const correctOpt = (task as FillBlankTask).options.find((o) => o.correct);
      if (correctOpt) {
        void playLessonTaskVoiceLine(
          lesson.id,
          lessonTaskOptionVoiceKey(lesson.id, task.id, correctOpt.id, language),
          t(correctOpt.textKey),
          language,
        );
      }
    } else if (task.type === 'world_knowledge' || task.type === 'image_word_match') {
      const opts = task.options;
      const co = opts.find((o) => o.correct);
      if (co?.textKey) void speakViaTali(t(co.textKey), mapLangToTaliTts(language));
    } else if (task.type === 'image_point') {
      const hp = (task as ImagePointTask).hotspots.find((h) => h.correct);
      if (hp?.labelKey) void speakViaTali(t(hp.labelKey), mapLangToTaliTts(language));
    }
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
        if (!correct && selectedOption) lastWrongAnswer.current = t(selectedOption.textKey);
      } else if (task.type === 'world_knowledge') {
        const wk = task as WorldKnowledgeTask;
        const selectedOption = wk.options.find((o) => o.id === selectedOptionId);
        correct = !!selectedOption?.correct;
        if (!correct && selectedOption) {
          lastWrongAnswer.current = selectedOption.textKey
            ? t(selectedOption.textKey)
            : selectedOption.imageKey ?? '';
        }
      } else if (task.type === 'image_word_match') {
        const im = task as ImageWordMatchTask;
        const selectedOption = im.options.find((o) => o.id === selectedOptionId);
        correct = !!selectedOption?.correct;
        if (!correct && selectedOption) {
          lastWrongAnswer.current = selectedOption.textKey
            ? t(selectedOption.textKey)
            : selectedOption.imageKey ?? '';
        }
      } else if (task.type === 'image_point') {
        const ip = task as ImagePointTask;
        const h = ip.hotspots.find((x) => x.id === selectedOptionId);
        correct = !!h?.correct;
        if (!correct && h?.labelKey) lastWrongAnswer.current = t(h.labelKey);
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
            .catch(() => {});
        }
      } else {
        hapticWrong();
        if (useAbaPedagogy) recordLiveResult('incorrect');
        const newMistakeCount = mistakeCount + 1;
        setMistakeCount(newMistakeCount);
        setTrialCount((c) => c + 1);

        recordAnswer({
          topicId: topic.id,
          lessonId: lesson.id,
          correct: false,
          taskId: task.id,
          taskIndex: currentIndex,
          promptLevel: useAbaPedagogy ? promptLevel : 0,
          latencyMs,
          sessionId,
          attemptNo: trialCount,
        });

        if (useAbaPedagogy) {
          if (mistakeCount === 0) {
            setPromptLevel(1);
            const taskCtx = buildTaskContext();
            getHint(taskCtx, language)
              .then((hint) => { if (hint) setHintText(hint); })
              .catch(() => {});
          } else if (mistakeCount >= 1) {
            setPromptLevel(2);
            playAbaLevel2CorrectVoice();
          }
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
      setTaskTransitionBusy(true);
      abaCorrectProceedRef.current = () => {
        if (isLastTask) {
          completeLessonFlow(mistakeCount);
        } else {
          setCurrentIndex((prev) => prev + 1);
          resetForNextTask();
          fadeIn();
        }
      };
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
      const q = t(task.questionKey);
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
          await speakViaTali(inst, mapLangToTaliTts(language));
        }
      }
      if (task.type === 'vocal_imitation') {
        await speakViaTali(t(task.soundTextKey), mapLangToTaliTts(language));
        if (task.audioPromptKey) {
          await speakViaTali(t(task.audioPromptKey), mapLangToTaliTts(language));
        }
      } else if (task.type === 'word_repetition') {
        await speakViaTali(t(task.wordKey), mapLangToTaliTts(language));
      } else if (task.type === 'volume_control') {
        await speakViaTali(t(task.promptTextKey), mapLangToTaliTts(language));
      } else if (task.type === 'action_instruction') {
        await speakViaTali(t(task.actionKey), mapLangToTaliTts(language));
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
      {/* Progress bar */}
      <View style={{ marginBottom: theme.spacing.sm }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
          <AppText variant="small" style={{ color: theme.colors.textMuted }}>
            {t('lesson.taskOf', { index: currentIndex + 1, total: totalTasks })}
          </AppText>
          <AppText variant="small" style={{ color: theme.colors.textMuted }}>
            {t('lesson.difficultyNow', { difficulty })}
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

      {/* ABA Hint Card (Visual Prompt Level 1+) */}
      {useAbaPedagogy && hintText && promptLevel >= 1 && (
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
            {Array.from({ length: task.visualCount }, (_, i) => (
              <AppText key={i} style={{ fontSize: 36 }}>
                {task.visualEmoji}
              </AppText>
            ))}
          </View>
        ) : null}

        <Pressable
          onPress={() => {
            if (!ttsEnabled) return;
            const line = t(task.questionKey);
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
            {t(task.questionKey)}
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
                {t(task.soundTextKey)}
              </AppText>
            )}
            {task.type === 'word_repetition' && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 4 }}>
                {splitWordSyllables(t(task.wordKey)).map((syll, i) => (
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
                  {t(task.promptTextKey)}
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
                  {t(task.actionKey)}
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
                    const match = mcTask.options.find((o) =>
                      (isEnglishLesson ? tEn(o.textKey) : t(o.textKey)).toLowerCase().includes(lower) ||
                      lower.includes((isEnglishLesson ? tEn(o.textKey) : t(o.textKey)).toLowerCase()),
                    );
                    if (match) { setSelectedOptionId(match.id); setSelectHint(false); }
                  }}
                  disabled={hasChecked || taskTransitionBusy}
                />
              </View>
            )}
            {(task as MultipleChoiceTask).options.map((option) => {
              const isSelected = selectedOptionId === option.id;
              const showCorrect = hasChecked && feedback === 'correct' && option.correct;
              const showWrong = hasChecked && feedback === 'incorrect' && isSelected;
              const isVisualTarget =
                useAbaPedagogy && promptLevel >= 1 && option.correct && !hasChecked;
              const isDisabledByPrompt =
                useAbaPedagogy && promptLevel >= 2 && !option.correct && !hasChecked;

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
                        {optionText(option.textKey)}
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
                useAbaPedagogy && promptLevel >= 1 && option.correct && !hasChecked;
              const isDisabledByPrompt =
                useAbaPedagogy && promptLevel >= 2 && !option.correct && !hasChecked;
              const label = option.textKey
                ? isEnglishLesson
                  ? tEn(option.textKey)
                  : t(option.textKey)
                : '';
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
                {t((task as ImageWordMatchTask).promptTextKey!)}
              </AppText>
            ) : null}
            {(task as ImageWordMatchTask).options.map((option) => {
              const isSelected = selectedOptionId === option.id;
              const showCorrect = hasChecked && feedback === 'correct' && option.correct;
              const showWrong = hasChecked && feedback === 'incorrect' && isSelected;
              const isVisualTarget =
                useAbaPedagogy && promptLevel >= 1 && option.correct && !hasChecked;
              const isDisabledByPrompt =
                useAbaPedagogy && promptLevel >= 2 && !option.correct && !hasChecked;
              const label = option.textKey ? (isEnglishLesson ? tEn(option.textKey) : t(option.textKey)) : '';
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
                if (co) blankDisplay = t(co.textKey);
              } else if (selectedOptionId) {
                const so = fbTask.options.find((o) => o.id === selectedOptionId);
                if (so) blankDisplay = t(so.textKey);
              }
              const parts = t(fbTask.sentenceKey).split('_');
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
                useAbaPedagogy && promptLevel >= 1 && option.correct && !hasChecked;
              const isDisabledByPrompt =
                useAbaPedagogy && promptLevel >= 2 && !option.correct && !hasChecked;
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
                    <AppText style={{ fontSize: theme.typography.body }}>{t(option.textKey)}</AppText>
                  </Card>
                </Pressable>
              );
            })}
          </View>
        ) : task.type === 'image_point' ? (
          <View>
            {getAbaLessonImage((task as ImagePointTask).imageKey) ? (
              <View style={{ width: '100%', aspectRatio: 1, position: 'relative', marginBottom: theme.spacing.md }}>
                <Image
                  source={getAbaLessonImage((task as ImagePointTask).imageKey)!}
                  style={{ width: '100%', height: '100%', resizeMode: 'contain' }}
                />
                {(task as ImagePointTask).hotspots.map((h) => {
                  const isSelected = selectedOptionId === h.id;
                  const showCorrect = hasChecked && feedback === 'correct' && h.correct;
                  const showWrong = hasChecked && feedback === 'incorrect' && isSelected;
                  const isHotVisual =
                    useAbaPedagogy && promptLevel >= 1 && h.correct && !hasChecked;
                  return (
                    <Pressable
                      key={h.id}
                      onPress={() => {
                        if (!hasChecked && !taskTransitionBusy) {
                          setSelectedOptionId(h.id);
                          setSelectHint(false);
                        }
                      }}
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
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.md, flexWrap: 'wrap' }}>
              {(task as SortingTask).groups.map((g) => (
                <Pressable
                  key={g.id}
                  onPress={() => {
                    if (hasChecked || taskTransitionBusy || !sortPickItemId) return;
                    setSortAssignments((prev) => ({ ...prev, [sortPickItemId]: g.id }));
                    setSortPickItemId(null);
                  }}
                  style={{
                    flex: 1,
                    minWidth: 120,
                    padding: theme.spacing.md,
                    borderRadius: theme.radii.md,
                    borderWidth: 2,
                    borderColor: theme.colors.border,
                    backgroundColor: theme.colors.surfaceAlt,
                  }}
                >
                  <AppText style={{ textAlign: 'center', fontWeight: '700' }}>{t(g.labelKey)}</AppText>
                </Pressable>
              ))}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
              {(task as SortingTask).items.map((it) => {
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
                        {t((task as SortingTask).groups.find((g) => g.id === assigned)?.labelKey ?? '')}
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
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
              {routineShuffledSteps.map((step) => {
                const picked = routinePickedIds.includes(step.id);
                const src = getAbaLessonImage(step.imageKey);
                return (
                  <Pressable
                    key={step.id}
                    disabled={picked || hasChecked || taskTransitionBusy}
                    onPress={() => {
                      setRoutinePickedIds((prev) => [...prev, step.id]);
                      setSelectHint(false);
                    }}
                    style={{
                      width: 100,
                      padding: theme.spacing.sm,
                      borderRadius: theme.radii.md,
                      borderWidth: 2,
                      borderColor: theme.colors.border,
                      opacity: picked ? 0.35 : 1,
                      alignItems: 'center',
                    }}
                  >
                    {src ? <Image source={src} style={{ width: 48, height: 48, resizeMode: 'contain' }} /> : null}
                    <AppText variant="small" style={{ textAlign: 'center' }}>
                      {t(step.labelKey)}
                    </AppText>
                  </Pressable>
                );
              })}
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
                  (isEnglishLesson ? tEn(o.textKey) : t(o.textKey)).toLowerCase().includes(lower) ||
                  lower.includes((isEnglishLesson ? tEn(o.textKey) : t(o.textKey)).toLowerCase()),
                );
                if (match) { setSelectedOptionId(match.id); setSelectHint(false); }
              } else if (task.type === 'fill_blank') {
                const fb = task as FillBlankTask;
                const match = fb.options.find((o) => t(o.textKey).toLowerCase().includes(lower));
                if (match) { setSelectedOptionId(match.id); setSelectHint(false); }
              } else if (task.type === 'world_knowledge') {
                const wk = task as WorldKnowledgeTask;
                const match = wk.options.find((o) =>
                  o.textKey
                    ? t(o.textKey).toLowerCase().includes(lower) ||
                      lower.includes(t(o.textKey).toLowerCase())
                    : false,
                );
                if (match) { setSelectedOptionId(match.id); setSelectHint(false); }
              } else if (task.type === 'image_word_match') {
                const im = task as ImageWordMatchTask;
                const match = im.options.find((o) =>
                  o.textKey
                    ? (isEnglishLesson ? tEn(o.textKey) : t(o.textKey)).toLowerCase().includes(lower) ||
                      lower.includes((isEnglishLesson ? tEn(o.textKey) : t(o.textKey)).toLowerCase())
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

      <Modal
        visible={breakModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setBreakModalVisible(false);
          sessionStartRef.current = Date.now();
        }}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: theme.spacing.xl,
          }}
          onPress={() => {
            setBreakModalVisible(false);
            sessionStartRef.current = Date.now();
          }}
        >
          <Pressable
            style={{
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radii.lg,
              padding: theme.spacing.xl,
              maxWidth: 320,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <AppText variant="title" style={{ marginBottom: theme.spacing.sm }}>
              {t('breakReminder.title')}
            </AppText>
            <AppText variant="body" style={{ color: theme.colors.textMuted, marginBottom: theme.spacing.lg }}>
              {t('breakReminder.body', { minutes: breakDurationMinutes })}
            </AppText>
            <Button
              onPress={() => {
                setBreakModalVisible(false);
                sessionStartRef.current = Date.now();
              }}
            >
              {t('breakReminder.dismiss')}
            </Button>
          </Pressable>
        </Pressable>
      </Modal>

      <TaliFAB
        lessonId={lesson.id}
        topicId={topic.id}
        taskContext={taskDescriptionForTali}
        lessonTitle={t(lesson.titleKey)}
      />
    </Screen>
  );
}

// ── Intro phase component ──────────────────────────────────────────────────
function IntroPhase({
  lessonId,
  backgroundImage,
  backgroundImageTint,
  slide,
  slideIndex,
  totalSlides,
  isLastSlide,
  accentColor,
  fadeAnim,
  theme,
  t,
  onNext,
}: {
  lessonId: string;
  backgroundImage: ImageSourcePropType;
  backgroundImageTint: 'default' | 'light';
  slide: IntroSlide;
  slideIndex: number;
  totalSlides: number;
  isLastSlide: boolean;
  accentColor: string;
  fadeAnim: Animated.Value;
  theme: ReturnType<typeof useAppTheme>;
  t: (key: string) => string;
  onNext: () => void;
}) {
  const { speak } = useSpeech();
  const ttsEnabled = useSettingsStore((s) => s.ttsEnabled);
  const language = useSettingsStore((s) => s.language);
  const fullBodyText = t(slide.bodyKey);
  const { displayed } = useTypingText(fullBodyText, 18);

  useEffect(() => {
    if (!ttsEnabled) return;
    const title = t(slide.titleKey);
    const body = t(slide.bodyKey);
    const fallback = `${title}. ${body}`;
    const key = lessonBundledVoiceKey(lessonId, 'intro', slideIndex, language);
    const mod = getBundledVoiceModuleId(key);
    const delay = setTimeout(() => {
      void (async () => {
        if (mod !== undefined) {
          const ok = await tryPlayBundledLessonVoice(mod);
          if (!ok) speak(fallback);
        } else {
          speak(fallback);
        }
      })();
    }, 400);
    return () => {
      clearTimeout(delay);
      void stopTaliSpeech();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slideIndex, lessonId, language, ttsEnabled]);

  return (
    <Screen
      backgroundImage={backgroundImage}
      backgroundImageTint={backgroundImageTint}
      style={{ position: 'relative' }}
    >
      <Animated.View style={{ opacity: fadeAnim, flex: 1 }}>
        <View style={{ flex: 1, justifyContent: 'center', paddingVertical: theme.spacing.xl }}>
          {/* Progress dots */}
          {totalSlides > 1 && (
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: theme.spacing.lg }}>
              {Array.from({ length: totalSlides }, (_, i) => (
                <View
                  key={i}
                  style={{
                    width: i === slideIndex ? 24 : 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: i <= slideIndex ? accentColor : theme.colors.border,
                  }}
                />
              ))}
            </View>
          )}

          {/* Tali thinking + slide emoji */}
          <View style={{ alignItems: 'center', marginBottom: theme.spacing.lg, flexDirection: 'row', justifyContent: 'center', gap: theme.spacing.md }}>
            <TaliVideo emotion="idle" size={110} bgColor={theme.colors.surface} />
            {slide.emoji && (
              <AppText style={{ fontSize: 56 }}>{slide.emoji}</AppText>
            )}
          </View>

          {/* Title + body: solid white for readability on scene background */}
          <Card
            style={{
              borderLeftWidth: 4,
              borderLeftColor: accentColor,
              backgroundColor: '#FFFFFF',
              marginBottom: theme.spacing.xl,
            }}
          >
            <AppText
              variant="subtitle"
              style={{
                fontWeight: '800',
                color: accentColor,
                textAlign: 'left',
                marginBottom: theme.spacing.md,
              }}
            >
              {t(slide.titleKey)}
            </AppText>
            <View style={{ position: 'relative' }}>
              <AppText style={{ lineHeight: 30, fontSize: 17, opacity: 0 }} aria-hidden>
                {fullBodyText}
              </AppText>
              <AppText style={{ lineHeight: 30, fontSize: 17, position: 'absolute', top: 0, left: 0, right: 0 }}>
                {displayed}
              </AppText>
            </View>
          </Card>

          <Button
            onPress={onNext}
            style={{
              backgroundColor: accentColor,
              borderColor: accentColor,
            }}
          >
            {isLastSlide ? t('lesson.introStart') : t('lesson.introNext')}
          </Button>
        </View>
      </Animated.View>
      <LessonRepeatSpeechFab />
    </Screen>
  );
}

// ── Dialog phase component ─────────────────────────────────────────────────
function DialogPhase({
  lessonId,
  worldId,
  backgroundImage,
  backgroundImageTint,
  fullText,
  speakerName,
  speakerColor,
  isTali,
  npcEmoji,
  worldBiome,
  worldTitleKey,
  worldAccentColor,
  dialogIndex,
  totalLines,
  isLastLine,
  fadeAnim,
  theme,
  t,
  onNext,
}: {
  lessonId: string;
  worldId?: string;
  backgroundImage: ImageSourcePropType;
  backgroundImageTint: 'default' | 'light';
  fullText: string;
  speakerName: string;
  speakerColor: string;
  isTali: boolean;
  npcEmoji: string;
  worldBiome?: string;
  worldTitleKey?: string;
  worldAccentColor: string;
  dialogIndex: number;
  totalLines: number;
  isLastLine: boolean;
  fadeAnim: Animated.Value;
  theme: ReturnType<typeof useAppTheme>;
  t: (key: string) => string;
  onNext: () => void;
}) {
  const { speak } = useSpeech();
  const ttsEnabled = useSettingsStore((s) => s.ttsEnabled);
  const language = useSettingsStore((s) => s.language);
  const { displayed } = useTypingText(fullText, 22);
  const npcAvatar = worldId ? getNanoNpcForWorld(worldId) : undefined;

  useEffect(() => {
    if (!ttsEnabled) return;
    const key = lessonBundledVoiceKey(lessonId, 'dialog', dialogIndex, language);
    const mod = getBundledVoiceModuleId(key);
    const delay = setTimeout(() => {
      void (async () => {
        if (mod !== undefined) {
          const ok = await tryPlayBundledLessonVoice(mod);
          if (!ok) speak(fullText);
        } else {
          speak(fullText);
        }
      })();
    }, 300);
    return () => {
      clearTimeout(delay);
      void stopTaliSpeech();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullText, dialogIndex, lessonId, language, ttsEnabled]);

  return (
    <Screen
      backgroundImage={backgroundImage}
      backgroundImageTint={backgroundImageTint}
      style={{ position: 'relative' }}
    >
      <Animated.View style={{ opacity: fadeAnim, flex: 1 }}>
        <View style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: theme.spacing.xl }}>
          {/* World banner */}
          {worldBiome && worldTitleKey && (
            <View style={{ alignItems: 'center', marginBottom: theme.spacing.xl }}>
              <AppText style={{ fontSize: 64 }}>{getBiomeDisplayEmoji(worldBiome)}</AppText>
              <AppText variant="small" style={{ color: worldAccentColor, fontWeight: '700', marginTop: theme.spacing.xs }}>
                {t(worldTitleKey)}
              </AppText>
            </View>
          )}

          {/* Speaker avatar */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginBottom: theme.spacing.sm, gap: theme.spacing.sm }}>
            {isTali ? (
              <TaliVideo emotion="idle" size={72} bgColor={theme.colors.background} />
            ) : (
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  backgroundColor: speakerColor + '22',
                  borderWidth: 2,
                  borderColor: speakerColor + '88',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                {npcAvatar ? (
                  <NanoBananaIcon source={npcAvatar} size={66} />
                ) : (
                  <AppText style={{ fontSize: 40 }}>{npcEmoji}</AppText>
                )}
              </View>
            )}
            <AppText variant="small" style={{ color: speakerColor, fontWeight: '700', marginBottom: 6 }}>
              {speakerName}
            </AppText>
          </View>

          {/* Dialog bubble */}
          <View style={{ position: 'relative', marginBottom: theme.spacing.lg }}>
            <View
              style={{
                position: 'absolute',
                top: -11,
                left: 32,
                width: 0,
                height: 0,
                borderStyle: 'solid',
                borderLeftWidth: 10,
                borderLeftColor: 'transparent',
                borderRightWidth: 10,
                borderRightColor: 'transparent',
                borderBottomWidth: 12,
                borderBottomColor: '#FFFFFF',
                zIndex: 1,
              }}
            />
            <View
              style={{
                position: 'absolute',
                top: -14,
                left: 30,
                width: 0,
                height: 0,
                borderStyle: 'solid',
                borderLeftWidth: 12,
                borderLeftColor: 'transparent',
                borderRightWidth: 12,
                borderRightColor: 'transparent',
                borderBottomWidth: 14,
                borderBottomColor: speakerColor + '55',
                zIndex: 0,
              }}
            />
            <Card
              style={{
                borderLeftWidth: 4,
                borderLeftColor: speakerColor,
                backgroundColor: '#FFFFFF',
              }}
            >
              <View style={{ position: 'relative' }}>
                <AppText style={{ lineHeight: 30, opacity: 0 }} aria-hidden>
                  {fullText}
                </AppText>
                <AppText style={{ lineHeight: 30, position: 'absolute', top: 0, left: 0, right: 0 }}>
                  {displayed}
                </AppText>
              </View>
            </Card>
          </View>

          {totalLines > 1 && (
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: theme.spacing.lg }}>
              {Array.from({ length: totalLines }, (_, i) => (
                <View
                  key={i}
                  style={{
                    width: i === dialogIndex ? 20 : 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: i <= dialogIndex ? theme.colors.primary : theme.colors.border,
                  }}
                />
              ))}
            </View>
          )}

          <Button
            onPress={onNext}
            style={{
              minHeight: 54,
              paddingVertical: 16,
            }}
          >
            {isLastLine ? t('lesson.dialogStartLesson') : t('lesson.dialogContinue')}
          </Button>
        </View>
      </Animated.View>
      <LessonRepeatSpeechFab />
    </Screen>
  );
}

// ── Reward phase component ────────────────────────────────────────────────
function RewardPhase({
  earnedXP,
  earnedItemEmoji,
  leveledUp,
  newLevel,
  earnedStars,
  lessonTitle,
  theme,
  backgroundImage,
  backgroundImageTint,
  onGoToMap,
}: {
  earnedXP: number;
  earnedItemEmoji: string | null;
  leveledUp: boolean;
  newLevel: number;
  earnedStars: 1 | 2 | 3;
  lessonTitle: string;
  theme: ReturnType<typeof useAppTheme>;
  backgroundImage: ImageSourcePropType;
  backgroundImageTint: 'default' | 'light';
  onGoToMap: () => void;
}) {
  const { t } = useTranslation();
  const reduceMotion = useSettingsStore((s) => s.reduceMotion);
  return (
    <Screen scroll backgroundImage={backgroundImage} backgroundImageTint={backgroundImageTint}>
      <View style={{ alignItems: 'center', paddingTop: theme.spacing.xl, position: 'relative' }}>
        {!reduceMotion && <Confetti />}

        <TaliVideo emotion="energetic" size={140} bgColor={theme.colors.background} />
        <Spacer size="sm" />
        <AppText variant="title" style={{ textAlign: 'center' }}>
          {t('lesson.rewardTitle')}
        </AppText>
        <Spacer size="sm" />
        <AppText style={{ color: theme.colors.textMuted, textAlign: 'center' }}>{lessonTitle}</AppText>
        <Spacer size="md" />

        {/* Stars */}
        <StarsRow stars={earnedStars} size={36} />
        <AppText variant="small" style={{ color: theme.colors.textMuted, marginTop: 6 }}>
          {t('lesson.starsEarned', { stars: earnedStars })}
        </AppText>

        <Spacer size="lg" />

        <Card style={{ width: '100%', alignItems: 'center', gap: theme.spacing.md }}>
          <View
            style={{
              backgroundColor: theme.colors.success + '22',
              borderRadius: theme.radii.lg,
              paddingHorizontal: theme.spacing.xl,
              paddingVertical: theme.spacing.md,
              alignItems: 'center',
              width: '100%',
            }}
          >
            <NanoBananaIcon source={NANO_UI.lightning} size={40} accessibilityLabel="XP" />
            <AppText
              variant="subtitle"
              style={{ color: theme.colors.success, fontWeight: '700', marginTop: theme.spacing.xs }}
            >
              {t('lesson.rewardXP', { xp: earnedXP })}
            </AppText>
          </View>

          {earnedItemEmoji && (
            <View
              style={{
                backgroundColor: theme.colors.secondary + '22',
                borderRadius: theme.radii.lg,
                paddingHorizontal: theme.spacing.xl,
                paddingVertical: theme.spacing.md,
                alignItems: 'center',
                width: '100%',
              }}
            >
              <NanoBananaIcon source={NANO_UI.gift} size={40} accessibilityLabel="" />
              <AppText
                variant="small"
                style={{ color: theme.colors.secondary, fontWeight: '700', marginTop: theme.spacing.xs }}
              >
                {t('lesson.rewardItem', { item: earnedItemEmoji })}
              </AppText>
            </View>
          )}

          {leveledUp && (
            <View
              style={{
                backgroundColor: theme.colors.primary + '22',
                borderRadius: theme.radii.lg,
                paddingHorizontal: theme.spacing.xl,
                paddingVertical: theme.spacing.md,
                alignItems: 'center',
                width: '100%',
              }}
            >
              <NanoBananaIcon source={NANO_UI.levelUp} size={40} accessibilityLabel="" />
              <AppText
                variant="small"
                style={{ color: theme.colors.primary, fontWeight: '700', marginTop: theme.spacing.xs }}
              >
                {t('lesson.rewardLevelUp', { level: newLevel })}
              </AppText>
            </View>
          )}
        </Card>

        <Spacer size="xl" />
        <Button onPress={onGoToMap} style={{ width: '100%' }}>
          {t('lesson.goToMap')}
        </Button>
      </View>
      <Spacer size="xl" />
    </Screen>
  );
}
