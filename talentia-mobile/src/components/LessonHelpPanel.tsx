import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TextInput,
  View,
  ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialIcons } from '@expo/vector-icons';

import { AppText } from './Text';
import { Card } from './Card';
import { Button } from './Button';
import { useAppTheme } from '../theme';
import { sendToCompanion, type TaskContext } from '../services/CompanionService';

type Message = {
  id: string;
  from: 'child' | 'tali';
  text: string;
};

type LessonHelpPanelProps = {
  taskContext: TaskContext;
  language: string;
  onClose: () => void;
};

export function LessonHelpPanel({
  taskContext,
  language,
  onClose,
}: LessonHelpPanelProps) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  const hasBackend = !!process.env.EXPO_PUBLIC_BACKEND_URL;

  const handleSend = async () => {
    if (!input.trim()) return;
    const childMessage: Message = {
      id: String(Date.now()),
      from: 'child',
      text: input.trim(),
    };
    setMessages((prev) => [...prev, childMessage]);
    const userInput = input.trim();
    setInput('');

    if (!hasBackend) {
      const errorMessage: Message = {
        id: `${Date.now()}-error`,
        from: 'tali',
        text: t('tali.errorNoBackend'),
      };
      setMessages((prev) => [...prev, errorMessage]);
      return;
    }

    // Build contextual message that includes task info so the AI always knows what task is active
    const taskLines: string[] = [];
    if (taskContext.questionPrompt) {
      taskLines.push(`Задание: "${taskContext.questionPrompt}"`);
    }
    if (taskContext.answerOptions && taskContext.answerOptions.length > 0) {
      taskLines.push(`Варианты ответов: ${taskContext.answerOptions.join(', ')}`);
    }
    const contextPrefix = taskLines.length > 0 ? `[${taskLines.join('. ')}]\n` : '';

    // Detect if the child mentioned the correct answer — tell AI to praise them
    const correctAnswer = taskContext.correctAnswer ?? '';
    const childMentionedCorrect =
      correctAnswer.length > 0 &&
      userInput.toLowerCase().includes(correctAnswer.toLowerCase());
    const praiseHint = childMentionedCorrect
      ? '[ВАЖНО: ребёнок назвал правильный ответ — похвали его искренне и поздравь!]\n'
      : '';

    const contextualMessage = praiseHint + contextPrefix + userInput;

    try {
      setSending(true);
      const reply = await sendToCompanion({
        message: contextualMessage,
        language,
        lessonId: taskContext.lessonId,
        topicId: taskContext.topicId,
        taskContext,
      });
      const responseText = reply ?? t('tali.errorGeneric');
      const taliMessage: Message = {
        id: `${Date.now()}-tali`,
        from: 'tali',
        text: responseText,
      };
      setMessages((prev) => [...prev, taliMessage]);
    } finally {
      setSending(false);
    }
  };

  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderTopLeftRadius: theme.radii.lg,
        borderTopRightRadius: theme.radii.lg,
        padding: theme.spacing.md,
        maxHeight: 280,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: theme.spacing.sm,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
          <AppText style={{ fontSize: 18 }}>🦖</AppText>
          <AppText variant="subtitle">{t('lesson.helpPanelTitle')}</AppText>
        </View>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        >
          <MaterialIcons
            name="close"
            size={24}
            color={theme.colors.textMuted}
          />
        </Pressable>
      </View>

      {/* Current task context */}
      {taskContext.questionPrompt ? (
        <View
          style={{
            backgroundColor: theme.colors.primary + '15',
            borderRadius: theme.radii.md,
            padding: theme.spacing.sm,
            marginBottom: theme.spacing.sm,
            borderLeftWidth: 3,
            borderLeftColor: theme.colors.primary,
          }}
        >
          <AppText variant="small" style={{ color: theme.colors.primary, fontWeight: '700', marginBottom: 2 }}>
            📋 {t('lesson.currentTask')}
          </AppText>
          <AppText variant="small" style={{ color: theme.colors.text }} numberOfLines={2}>
            {taskContext.questionPrompt}
          </AppText>
        </View>
      ) : null}

      <ScrollView
        style={{ maxHeight: 120, marginBottom: theme.spacing.sm }}
        showsVerticalScrollIndicator={false}
      >
        {messages.map((item) => {
          const isChild = item.from === 'child';
          return (
            <View
              key={item.id}
              style={{
                alignItems: isChild ? 'flex-end' : 'flex-start',
                marginBottom: theme.spacing.xs,
              }}
            >
              <Card
                highlighted={isChild}
                style={{
                  maxWidth: '90%',
                  paddingVertical: theme.spacing.xs,
                  paddingHorizontal: theme.spacing.sm,
                  backgroundColor: isChild
                    ? theme.colors.secondary
                    : theme.colors.surfaceAlt,
                }}
              >
                <AppText variant="small">{item.text}</AppText>
              </Card>
            </View>
          );
        })}
      </ScrollView>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
          }}
        >
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={t('lesson.helpPanelPlaceholder')}
            placeholderTextColor={theme.colors.textMuted}
            style={{
              flex: 1,
              borderWidth: 2,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.md,
              paddingHorizontal: theme.spacing.sm,
              paddingVertical: theme.spacing.xs,
              fontSize: theme.typography.small,
              color: theme.colors.text,
              backgroundColor: theme.colors.surfaceAlt,
            }}
            accessible
            accessibilityLabel={t('lesson.helpPanelPlaceholder')}
          />
          <Button
            onPress={handleSend}
            loading={sending}
            disabled={sending}
            variant="primary"
          >
            {t('tali.send')}
          </Button>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
