import React, { useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Screen } from '../src/components/Screen';
import { AppText } from '../src/components/Text';
import { Spacer } from '../src/components/Spacer';
import { Card } from '../src/components/Card';
import { Button } from '../src/components/Button';
import { TaliVideo } from '../src/components/TaliVideo';
import { useAppTheme } from '../src/theme';
import { sendToCompanion, getHint, getScienceFact, getMotivation } from '../src/services/CompanionService';
import { useSettingsStore } from '../src/store/settingsStore';
import { useProgressStore } from '../src/store/progressStore';
import { useAuth } from '../src/context/AuthContext';

type Message = {
  id: string;
  from: 'child' | 'tali';
  text: string;
};

const QUICK_ACTIONS = ['quickHint', 'quickFact', 'quickMotivation'] as const;

export default function TaliScreen() {
  const { lessonId, topicId, context, reportSummary, lessonTitle } = useLocalSearchParams<{
    lessonId?: string;
    topicId?: string;
    context?: string;
    reportSummary?: string;
    lessonTitle?: string;
  }>();
  const { t } = useTranslation();
  const theme = useAppTheme();
  const language = useSettingsStore((s) => s.language);
  const methodology = useSettingsStore((s) => s.methodology);
  const childName = useSettingsStore((s) => s.childName);
  const { profile } = useAuth();
  const streakCount = useProgressStore((s) => s.streakCount);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);

  const hasBackend = !!process.env.EXPO_PUBLIC_BACKEND_URL;
  const isParentContext = context === 'parent' && reportSummary;
  const hasLessonContext = !!lessonId || !!topicId;

  const addMessage = (from: 'child' | 'tali', text: string) => {
    setMessages((prev) => {
      const next = [...prev, { id: `${Date.now()}-${from}`, from, text }];
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
      return next;
    });
  };

  const sendMessage = async (userText: string, overrideMessage?: string) => {
    if (!userText.trim()) return;
    addMessage('child', userText);
    setInput('');

    if (!hasBackend) {
      addMessage('tali', t('tali.errorNoBackend'));
      return;
    }

    try {
      setSending(true);
      const reply = await sendToCompanion({
        message: overrideMessage ?? userText,
        language,
        lessonId: lessonId ? String(lessonId) : undefined,
        topicId: topicId ? String(topicId) : undefined,
        parentContext: isParentContext ? String(reportSummary) : undefined,
      });
      addMessage('tali', reply ?? t('tali.errorGeneric'));
    } finally {
      setSending(false);
    }
  };

  const handleQuickAction = async (action: typeof QUICK_ACTIONS[number]) => {
    const label = t(`tali.${action}`);
    addMessage('child', label);
    if (!hasBackend) { addMessage('tali', t('tali.errorNoBackend')); return; }
    try {
      setSending(true);
      let reply: string | null = null;
      if (action === 'quickHint') {
        reply = await getHint(
          { questionPrompt: '', subjectId: topicId ? 'science' : 'math', topicId: topicId ?? '', lessonId: lessonId ?? '', childMode: 'standard', methodology: null },
          language,
        );
      } else if (action === 'quickFact') {
        reply = await getScienceFact(
          topicId ? 'science' : 'math',
          topicId ?? '',
          language,
          profile?.child_mode ?? 'standard',
          methodology,
        );
      } else if (action === 'quickMotivation') {
        reply = await getMotivation(language);
      }
      addMessage('tali', reply ?? t('tali.errorGeneric'));
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
            backgroundColor: theme.colors.primary + '15',
            borderRadius: theme.radii.lg,
            padding: theme.spacing.md,
            marginBottom: theme.spacing.md,
            borderWidth: 1.5,
            borderColor: theme.colors.primary + '30',
          }}
        >
          <TaliVideo emotion="idle" size={56} bgColor={theme.colors.primary + '15'} />
          <View style={{ flex: 1 }}>
            <AppText variant="subtitle" style={{ fontWeight: '800', color: theme.colors.primary }}>
              {t('tali.name')}
            </AppText>
            <AppText variant="small" style={{ color: theme.colors.textMuted }}>
              {t('tali.intro')}
            </AppText>
            {hasLessonContext && lessonTitle ? (
              <AppText variant="small" style={{ color: theme.colors.primary, marginTop: 4 }}>
                {t('tali.contextLesson', { lesson: lessonTitle })}
              </AppText>
            ) : null}
          </View>
          <View style={{ alignItems: 'center' }}>
            <AppText style={{ fontSize: 18 }}>🔥</AppText>
            <AppText variant="small" style={{ color: theme.colors.secondary, fontWeight: '700' }}>
              {streakCount}
            </AppText>
          </View>
        </View>

        {/* Quick action chips */}
        {!isParentContext && (
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap', marginBottom: theme.spacing.md }}>
            {QUICK_ACTIONS.map((action) => (
              <Pressable
                key={action}
                onPress={() => !sending && handleQuickAction(action)}
                style={({ pressed }) => ({
                  opacity: pressed || sending ? 0.6 : 1,
                  backgroundColor: theme.colors.surfaceAlt,
                  borderRadius: theme.radii.pill,
                  paddingHorizontal: theme.spacing.md,
                  paddingVertical: theme.spacing.sm,
                  borderWidth: 1.5,
                  borderColor: theme.colors.border,
                })}
              >
                <AppText variant="small" style={{ fontWeight: '600' }}>
                  {action === 'quickHint' ? '💡' : action === 'quickFact' ? '🔬' : '🌟'}{' '}
                  {t(`tali.${action}`)}
                </AppText>
              </Pressable>
            ))}
          </View>
        )}

        {/* Messages */}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: theme.spacing.lg }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: theme.spacing.xl }}>
              <TaliVideo emotion="default" size={100} bgColor={theme.colors.background} />
              <Spacer size="md" />
              <AppText style={{ color: theme.colors.textMuted, textAlign: 'center' }}>
                {childName ? `${childName}, ` : ''}{t('tali.intro')}
              </AppText>
            </View>
          }
          renderItem={({ item }) => {
            const isChild = item.from === 'child';
            return (
              <View
                style={{
                  alignItems: isChild ? 'flex-end' : 'flex-start',
                  marginBottom: theme.spacing.sm,
                }}
              >
                {!isChild && (
                  <AppText variant="small" style={{ color: theme.colors.primary, fontWeight: '700', marginBottom: 4, marginLeft: theme.spacing.sm }}>
                    🦖 {t('tali.name')}
                  </AppText>
                )}
                <Card
                  highlighted={isChild}
                  style={{
                    maxWidth: '80%',
                    backgroundColor: isChild ? theme.colors.secondary : theme.colors.surface,
                    borderWidth: isChild ? 0 : 1.5,
                    borderColor: theme.colors.primary + '30',
                  }}
                >
                  <AppText style={{ color: isChild ? '#fff' : theme.colors.text, lineHeight: 22 }}>
                    {item.text}
                  </AppText>
                </Card>
              </View>
            );
          }}
        />

        {sending && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.sm }}>
            <AppText style={{ fontSize: 18 }}>🦖</AppText>
            <AppText variant="small" style={{ color: theme.colors.textMuted }}>
              {t('lesson.dialogTyping')}
            </AppText>
          </View>
        )}

        {/* Input */}
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
            placeholder={t('tali.inputPlaceholder')}
            placeholderTextColor={theme.colors.textMuted}
            onSubmitEditing={() => sendMessage(input)}
            returnKeyType="send"
            style={{
              flex: 1,
              borderWidth: 2,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.md,
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.sm,
              fontSize: theme.typography.body,
              color: theme.colors.text,
              backgroundColor: theme.colors.surface,
            }}
            accessible
            accessibilityLabel={t('tali.inputPlaceholder')}
          />
          <Button
            onPress={() => sendMessage(input)}
            loading={sending}
            disabled={sending || !input.trim()}
            variant="primary"
          >
            {t('tali.send')}
          </Button>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
