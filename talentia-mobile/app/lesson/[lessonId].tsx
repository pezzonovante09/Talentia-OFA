import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Modal, Pressable, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Screen } from '../../src/components/Screen';
import { TaliVideo } from '../../src/components/TaliVideo';
import { AppText } from '../../src/components/Text';
import { Spacer } from '../../src/components/Spacer';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { LessonHelpPanel } from '../../src/components/LessonHelpPanel';
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
} from '../../src/data/worlds';
import { getBiomeDisplayEmoji } from '../../src/utils/biomeDisplay';
import { useProgressStore, getLevelFromXP } from '../../src/store/progressStore';
import { useCollectiblesStore, COLLECTIBLES_META } from '../../src/store/collectiblesStore';
import { useAuth } from '../../src/context/AuthContext';
import { useSettingsStore } from '../../src/store/settingsStore';
import { getHint, explainError, type TaskContext } from '../../src/services/CompanionService';
import { useSpeech } from '../../src/hooks/useSpeech';
import { flushAnalyticsQueue } from '../../src/services/analyticsService';
import i18nInstance from '../../src/i18n';

type Phase = 'dialog' | 'intro' | 'tasks' | 'reward';
type Feedback = 'idle' | 'correct' | 'incorrect';
type PromptLevel = 0 | 1 | 2;
type SuccessType = 'pure' | 'assisted';

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
        <AppText key={i} style={{ fontSize: size, opacity: i <= stars ? 1 : 0.25 }}>⭐</AppText>
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
  const breakReminderEnabled = useSettingsStore((s) => s.breakReminderEnabled);
  const sessionDurationMinutes = useSettingsStore((s) => s.sessionDurationMinutes);
  const breakDurationMinutes = useSettingsStore((s) => s.breakDurationMinutes);

  const recordAnswer = useProgressStore((s) => s.recordAnswer);
  const markLessonCompleted = useProgressStore((s) => s.markLessonCompleted);
  const addXP = useProgressStore((s) => s.addXP);
  const xp = useProgressStore((s) => s.xp);
  const topicsState = useProgressStore((s) => s.topics);
  const addItem = useCollectiblesStore((s) => s.addItem);

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

  // ALL hooks must be declared before any early return
  const tasks = useMemo(() => {
    if (!lesson) return [];
    const filtered = filterTasksForProfile(lesson.tasks, profile ? {
      child_mode: profile.child_mode,
      methodology: profile.methodology,
    } : null);
    const range = 1;
    const byDifficulty = filtered.filter(
      (tk) => tk.difficulty >= topicDifficulty - range && tk.difficulty <= topicDifficulty + range,
    );
    return byDifficulty.length > 0 ? byDifficulty : filtered;
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
  const [helpPanelOpen, setHelpPanelOpen] = useState(false);
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

  // ABA Engine state
  const [promptLevel, setPromptLevel] = useState<PromptLevel>(0);
  const [hintText, setHintText] = useState<string | null>(null);
  const [successType, setSuccessType] = useState<SuccessType>('pure');

  const totalTasks = tasks.length;
  const isLastTask = totalTasks > 0 && currentIndex === totalTasks - 1;

  const checkButtonLabel = useMemo(() => {
    if (!hasChecked) return t('lesson.checkAnswer');
    if (feedback === 'incorrect') return t('lesson.tryAgain');
    if (isLastTask) return t('lesson.finishLesson');
    return t('lesson.nextTask');
  }, [hasChecked, feedback, isLastTask, t]);

  const correctFeedbackText = useMemo(() => {
    if (feedback === 'correct' && successType === 'assisted') {
      return t('lesson.abaAssistedSuccess');
    }
    return t('lesson.abaCorrect');
  }, [feedback, successType, t]);

  const incorrectFeedbackText = useMemo(() => {
    if (promptLevel >= 2) return t('lesson.abaVerbalPromptFeedback');
    if (promptLevel >= 1) return t('lesson.abaVisualPromptFeedback');
    return t('lesson.abaIncorrect');
  }, [promptLevel, t]);

  // Flush queued analytics on mount
  useEffect(() => {
    if (user?.id) {
      flushAnalyticsQueue(user.id).catch(() => {});
    }
  }, [user?.id]);

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
  const npcEmoji = world?.npcEmoji ?? '🦕';
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
    answerOptions:
      task?.type === 'multiple_choice'
        ? (task as MultipleChoiceTask).options.map((o) =>
            isEnglishLesson ? tEn(o.textKey) : t(o.textKey),
          )
        : undefined,
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
    methodology: 'aba',
    correctAnswer:
      task?.type === 'multiple_choice'
        ? (() => {
            const opt = (task as MultipleChoiceTask).options.find((o) => o.correct);
            return opt ? (isEnglishLesson ? tEn(opt.textKey) : t(opt.textKey)) : undefined;
          })()
        : 'answer' in (task ?? {})
          ? String((task as unknown as { answer: string }).answer)
          : undefined,
  });

  // ── Dialog phase ─────────────────────────────────────────────────────────
  if (phase === 'dialog') {
    const line = dialog[dialogIndex];
    const isTali = line.speaker === 'tali';
    const speakerName = isTali ? `${t('tali.name')} 🦖` : `${npcName} ${npcEmoji}`;
    const speakerColor = isTali ? theme.colors.primary : accentColor;
    const isLastLine = dialogIndex === dialog.length - 1;
    const fullText = t(line.textKey);

    return (
      <DialogPhase
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
        onGoToMap={() => router.replace('/(tabs)/map')}
      />
    );
  }

  // ── Tasks phase ───────────────────────────────────────────────────────────
  if (!task) {
    return <Screen><AppText>{t('errors.lessonNotFound')}</AppText></Screen>;
  }

  const difficulty = topicsState[topic.id]?.difficulty ?? 1;

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
    taskStartTime.current = Date.now();
    lastWrongAnswer.current = null;
  };

  const handlePrimaryPress = () => {
    if (!hasChecked) {
      if (task.type === 'multiple_choice' && !selectedOptionId) {
        setSelectHint(true);
        return;
      }
      let correct = false;
      if (task.type === 'multiple_choice') {
        const mcTask = task as MultipleChoiceTask;
        const selectedOption = mcTask.options.find((o) => o.id === selectedOptionId);
        correct = !!selectedOption?.correct;
        if (!correct && selectedOption) {
          lastWrongAnswer.current = optionText(selectedOption.textKey);
        }
      } else {
        const expected = String(task.answer).trim().toLowerCase();
        const input = inputValue.trim().toLowerCase();
        const expNum = parseFloat(expected);
        const inpNum = parseFloat(input);
        const bothNumeric = !Number.isNaN(expNum) && !Number.isNaN(inpNum);
        correct = bothNumeric ? expNum === inpNum : expected === input;
        if (!correct) {
          lastWrongAnswer.current = inputValue.trim();
        }
      }

      const latencyMs = Date.now() - taskStartTime.current;

      if (correct) {
        hapticCorrect();
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

        // When child succeeded after verbal prompt (level 2), explain error via Tali
        if (promptLevel >= 2 && lastWrongAnswer.current) {
          const taskCtx = buildTaskContext();
          explainError(taskCtx, lastWrongAnswer.current, language)
            .then((msg) => { if (msg) setHintText(msg); })
            .catch(() => {});
        }
      } else {
        hapticWrong();
        const newMistakeCount = mistakeCount + 1;
        setMistakeCount(newMistakeCount);
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

        // Prompt Hierarchy
        if (mistakeCount === 0) {
          // 1st wrong → Visual Prompt: show AI hint + highlight correct option
          setPromptLevel(1);
          const taskCtx = buildTaskContext();
          getHint(taskCtx, language)
            .then((hint) => { if (hint) setHintText(hint); })
            .catch(() => {});
        } else if (mistakeCount >= 1) {
          // 2nd+ wrong → Verbal Prompt: disable wrong options, speak correct answer
          setPromptLevel(2);
          if (task.type === 'multiple_choice') {
            const correctOpt = (task as MultipleChoiceTask).options.find((o) => o.correct);
            if (correctOpt) {
              speak(optionText(correctOpt.textKey));
            }
          }
        }
      }

      setFeedback(correct ? 'correct' : 'incorrect');
      setHasChecked(true);
      return;
    }

    // Wrong answer → reset for retry (keep promptLevel from before)
    if (feedback === 'incorrect') {
      setSelectedOptionId(null);
      setInputValue('');
      setFeedback('idle');
      setHasChecked(false);
      setSelectHint(false);
      return;
    }

    // Correct → advance
    if (isLastTask) {
      const reward = lesson.reward;
      const xpGain = reward?.xp ?? 20;
      const prevLevel = getLevelFromXP(xp);
      const totalMistakes = mistakeCount;
      const stars: 1 | 2 | 3 = totalMistakes === 0 ? 3 : totalMistakes <= 2 ? 2 : 1;

      markLessonCompleted({ topicId: topic.id, lessonId: lesson.id, mistakeCount: totalMistakes });
      addXP(xpGain);

      const newXP = xp + xpGain;
      const nextLevel = getLevelFromXP(newXP);

      if (reward?.item) {
        addItem(reward.item);
        const meta = COLLECTIBLES_META[reward.item];
        setEarnedItem(meta?.emoji ?? '🎁');
      }

      setEarnedXP(xpGain);
      setEarnedStars(stars);
      setLeveledUp(nextLevel > prevLevel);
      setNewLevel(nextLevel);
      setPhase('reward');
    } else {
      setCurrentIndex((prev) => prev + 1);
      resetForNextTask();
      fadeIn();
    }
  };

  return (
    <Screen scroll>
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
      {trialCount > 1 && (
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
            🔄 {t('lesson.abaTrial', { n: trialCount })}
          </AppText>
        </View>
      )}

      {/* ABA: structured instruction label */}
      <AppText
        variant="small"
        style={{ color: theme.colors.primary, fontWeight: '700', marginBottom: theme.spacing.sm }}
      >
        📋 {t('lesson.abaInstruction')}
      </AppText>

      <AppText variant="title" accessibilityRole="header">
        {t(lesson.titleKey)}
      </AppText>
      <Spacer size="sm" />

      <Button variant="ghost" onPress={() => setHelpPanelOpen(true)}>
        {t('lesson.needHelp')}
      </Button>

      {helpPanelOpen && (
        <>
          <Spacer size="md" />
          <LessonHelpPanel
            taskContext={buildTaskContext()}
            language={language}
            onClose={() => setHelpPanelOpen(false)}
          />
        </>
      )}

      <Spacer size="lg" />

      {/* ABA Hint Card (Visual Prompt Level 1+) */}
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
            💡 {t('lesson.hintFromTali')}
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

        <Pressable onPress={() => speak(t(task.questionKey))} accessibilityRole="button">
          <AppText style={{ fontSize: theme.typography.body }}>
            {t(task.questionKey)}
          </AppText>
        </Pressable>
        <Spacer size="md" />

        {task.type === 'multiple_choice' ? (
          <View accessibilityRole="radiogroup" accessibilityLabel={t('lesson.multipleChoiceLabel')}>
            {selectHint && (
              <View style={{ marginBottom: theme.spacing.sm, padding: theme.spacing.sm, backgroundColor: theme.colors.accent + '22', borderRadius: theme.radii.sm }}>
                <AppText style={{ color: theme.colors.secondary, fontWeight: '600', fontSize: 14 }}>
                  {t('lesson.selectAnswerHint')}
                </AppText>
              </View>
            )}
            {/* Voice button for MC */}
            {!hasChecked && (
              <View style={{ alignItems: 'flex-end', marginBottom: theme.spacing.sm }}>
                <VoiceInputButton
                  onTranscript={(transcript) => {
                    if (hasChecked) return;
                    const lower = transcript.toLowerCase();
                    const mcTask = task as MultipleChoiceTask;
                    const match = mcTask.options.find((o) =>
                      (isEnglishLesson ? tEn(o.textKey) : t(o.textKey)).toLowerCase().includes(lower) ||
                      lower.includes((isEnglishLesson ? tEn(o.textKey) : t(o.textKey)).toLowerCase()),
                    );
                    if (match) { setSelectedOptionId(match.id); setSelectHint(false); }
                  }}
                  disabled={hasChecked}
                />
              </View>
            )}
            {(task as MultipleChoiceTask).options.map((option) => {
              const isSelected = selectedOptionId === option.id;
              const showCorrect = hasChecked && feedback === 'correct' && option.correct;
              const showWrong = hasChecked && feedback === 'incorrect' && isSelected;
              // Visual Prompt: highlight correct option with success glow
              const isVisualTarget = promptLevel >= 1 && option.correct && !hasChecked;
              // Verbal Prompt: disable wrong options
              const isDisabledByPrompt = promptLevel >= 2 && !option.correct && !hasChecked;

              return (
                <Pressable
                  key={option.id}
                  onPress={() => {
                    if (!hasChecked && !isDisabledByPrompt) {
                      speak(optionText(option.textKey));
                      setSelectedOptionId(option.id);
                      setSelectHint(false);
                    }
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected, disabled: isDisabledByPrompt }}
                  style={{ marginBottom: theme.spacing.sm, opacity: isDisabledByPrompt ? 0.3 : 1 }}
                  disabled={isDisabledByPrompt}
                >
                  <Card
                    highlighted={isSelected && !hasChecked}
                    style={{
                      borderWidth: showCorrect || showWrong || isVisualTarget ? 2 : undefined,
                      borderColor: showCorrect || isVisualTarget
                        ? theme.colors.success
                        : showWrong
                          ? theme.colors.error
                          : undefined,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <AppText style={{ fontSize: theme.typography.body }}>
                        {optionText(option.textKey)}
                      </AppText>
                      {showCorrect && <AppText>✅</AppText>}
                      {showWrong && <AppText>❌</AppText>}
                    </View>
                  </Card>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View>
            <AppText style={{ marginBottom: theme.spacing.sm }}>{t('lesson.inputLabel')}</AppText>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
              <TextInput
                value={inputValue}
                onChangeText={setInputValue}
                placeholder={t(task.placeholderKey ?? 'lesson.answerPlaceholder')}
                placeholderTextColor={theme.colors.textMuted}
                editable={!hasChecked}
                style={{
                  flex: 1,
                  borderWidth: 2,
                  borderColor: hasChecked
                    ? feedback === 'correct' ? theme.colors.success : theme.colors.error
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
                disabled={hasChecked}
              />
            </View>
          </View>
        )}

        <Spacer size="md" />

        {feedback === 'correct' && (
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
              backgroundColor: theme.colors.error + '22',
              borderRadius: theme.radii.md,
              padding: theme.spacing.sm,
            }}
          >
            <AppText style={{ color: theme.colors.error, fontWeight: '600' }}>
              {incorrectFeedbackText}
            </AppText>
          </View>
        )}
      </Card>

      <Spacer size="lg" />

      <Button
        onPress={handlePrimaryPress}
        style={{
          backgroundColor: !hasChecked
            ? theme.colors.secondary
            : feedback === 'correct'
              ? theme.colors.success
              : theme.colors.error,
          borderColor: !hasChecked
            ? theme.colors.secondary
            : feedback === 'correct'
              ? theme.colors.success
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
    </Screen>
  );
}

// ── Intro phase component ──────────────────────────────────────────────────
function IntroPhase({
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
  const fullBodyText = t(slide.bodyKey);
  const { displayed } = useTypingText(fullBodyText, 18);

  return (
    <Screen>
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

          {/* Title */}
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

          {/* Body card */}
          <Card
            style={{
              borderLeftWidth: 4,
              borderLeftColor: accentColor,
              backgroundColor: accentColor + '10',
              marginBottom: theme.spacing.xl,
            }}
          >
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
    </Screen>
  );
}

// ── Dialog phase component ─────────────────────────────────────────────────
function DialogPhase({
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
  const { displayed } = useTypingText(fullText, 22);

  return (
    <Screen>
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
                }}
              >
                <AppText style={{ fontSize: 40 }}>{npcEmoji}</AppText>
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
                borderBottomColor: theme.colors.surface,
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

          <Button onPress={onNext}>
            {isLastLine ? t('lesson.dialogStartLesson') : t('lesson.dialogContinue')}
          </Button>
        </View>
      </Animated.View>
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
  onGoToMap,
}: {
  earnedXP: number;
  earnedItemEmoji: string | null;
  leveledUp: boolean;
  newLevel: number;
  earnedStars: 1 | 2 | 3;
  lessonTitle: string;
  theme: ReturnType<typeof useAppTheme>;
  onGoToMap: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Screen scroll>
      <View style={{ alignItems: 'center', paddingTop: theme.spacing.xl, position: 'relative' }}>
        <Confetti />

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
            <AppText style={{ fontSize: 40 }}>⭐</AppText>
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
              <AppText style={{ fontSize: 40 }}>{earnedItemEmoji}</AppText>
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
              <AppText style={{ fontSize: 40 }}>⬆️</AppText>
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
