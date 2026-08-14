import React, { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { NanoBananaIcon } from './NanoBananaIcon';
import { NANO_UI } from '../constants/nanoBananaAssets';
import { AppText } from './Text';
import { Spacer } from './Spacer';
import { Card } from './Card';
import { Button } from './Button';
import { VoiceInputButton } from './VoiceInputButton';
import { TaliVideo } from './TaliVideo';
import { useAppTheme } from '../theme';
import {
  sendToCompanion,
  getHint,
  getScienceFact,
  getMotivation,
  type TaskContext,
} from '../services/companionService';
import { mapLanguageCodeToTaliTts, speakViaTali, stopTaliSpeech } from '../services/ttsService';
import { useSettingsStore } from '../store/settingsStore';
import { useProgressStore } from '../store/progressStore';
import { useAuth } from '../context/AuthContext';

type Message = {
  id: string;
  from: 'child' | 'tali';
  text: string;
};

const QUICK_ACTIONS = ['quickHint', 'quickFact', 'quickMotivation'] as const;

export type TaliModalProps = {
  visible: boolean;
  onClose: () => void;
  lessonId?: string;
  topicId?: string;
  context?: string;
  reportSummary?: string;
  lessonTitle?: string;
  /** Lesson task description (question + options); prepended to chat API messages only */
  taskContext?: string;
  /** Same lesson as structured payload for /api/tali (preferred over string taskContext). */
  companionTaskContext?: TaskContext;
};

const SHEET_HEIGHT = Math.round(Dimensions.get('window').height * 0.9);

export function TaliModal({
  visible,
  onClose,
  lessonId,
  topicId,
  context,
  reportSummary,
  lessonTitle,
  taskContext,
  companionTaskContext,
}: TaliModalProps) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const language = useSettingsStore((s) => s.language);
  const methodology = useSettingsStore((s) => s.methodology);
  const childName = useSettingsStore((s) => s.childName);
  const taliSpeakEnabled = useSettingsStore((s) => s.taliSpeakEnabled);
  const profile = useAuth((s) => s.profile);
  const streakCount = useProgressStore((s) => s.streakCount);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  /** Avoids the same touch that opened the modal closing it via backdrop (RN touch pass-through). */
  const [backdropCloseEnabled, setBackdropCloseEnabled] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);
  const prevVisible = useRef(false);

  const hasBackend = !!process.env.EXPO_PUBLIC_BACKEND_URL;
  const isParentContext = context === 'parent' && !!reportSummary;
  const hasLessonContext = !!lessonId || !!topicId;

  useEffect(() => {
    return () => {
      void stopTaliSpeech();
    };
  }, []);

  useEffect(() => {
    if (visible && !prevVisible.current) {
      setMessages([]);
      setInput('');
      setSending(false);
    }
    prevVisible.current = visible;
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      setBackdropCloseEnabled(false);
      return;
    }
    setBackdropCloseEnabled(false);
    const id = setTimeout(() => setBackdropCloseEnabled(true), 450);
    return () => clearTimeout(id);
  }, [visible]);

  const addMessage = (from: 'child' | 'tali', text: string) => {
    setMessages((prev) => {
      const next = [...prev, { id: `${Date.now()}-${from}`, from, text }];
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
      return next;
    });
    if (from === 'tali' && taliSpeakEnabled) {
      const ttsLang = mapLanguageCodeToTaliTts(language);
      void speakViaTali(text, ttsLang);
    }
  };

  const buildApiMessage = (userText: string) => {
    const trimmed = userText.trim();
    if (companionTaskContext) {
      return trimmed;
    }
    if (taskContext?.trim()) {
      return `[${taskContext.trim()}]\n${trimmed}`;
    }
    return trimmed;
  };

  const sendMessage = async (userText: string) => {
    if (!userText.trim()) return;
    const displayText = userText.trim();
    addMessage('child', displayText);
    setInput('');

    if (!hasBackend) {
      addMessage('tali', t('tali.errorNoBackend'));
      return;
    }

    try {
      setSending(true);
      const reply = await sendToCompanion({
        message: buildApiMessage(displayText),
        language,
        lessonId: lessonId ? String(lessonId) : undefined,
        topicId: topicId ? String(topicId) : undefined,
        parentContext: isParentContext ? String(reportSummary) : undefined,
        taskContext: companionTaskContext,
      });
      addMessage('tali', reply ?? t('tali.errorGeneric'));
    } finally {
      setSending(false);
    }
  };

  const handleQuickAction = async (action: (typeof QUICK_ACTIONS)[number]) => {
    const label = t(`tali.${action}`);
    addMessage('child', label);
    if (!hasBackend) {
      addMessage('tali', t('tali.errorNoBackend'));
      return;
    }
    try {
      setSending(true);
      let reply: string | null = null;
      if (action === 'quickHint') {
        const hintCtx: TaskContext =
          companionTaskContext ??
          ({
            questionPrompt: '',
            subjectId: topicId ? 'science' : 'math',
            topicId: topicId ?? '',
            lessonId: lessonId ?? '',
            childMode: profile?.child_mode ?? 'standard',
            methodology:
              profile?.child_mode === 'special' ? (profile.methodology ?? 'aba') : null,
          } satisfies TaskContext);
        reply = await getHint(hintCtx, language);
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
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalRoot}>
        <Pressable
          style={StyleSheet.absoluteFillObject}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          onPress={onClose}
        >
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: theme.colors.overlay }]} />
        </Pressable>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetAvoid}
        >
          <View
            style={{
              height: SHEET_HEIGHT,
              backgroundColor: theme.colors.surface,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              overflow: 'hidden',
              paddingHorizontal: theme.spacing.lg,
              paddingTop: theme.spacing.sm,
              paddingBottom: theme.spacing.md,
            }}
            pointerEvents="auto"
          >
                <View
                  style={{
                    alignItems: 'center',
                    paddingVertical: theme.spacing.sm,
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: theme.colors.border,
                    }}
                  />
                </View>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    marginBottom: theme.spacing.sm,
                  }}
                >
                  <Pressable
                    onPress={onClose}
                    accessibilityRole="button"
                    accessibilityLabel={t('common.close')}
                    hitSlop={12}
                  >
                    <MaterialIcons name="close" size={28} color={theme.colors.textMuted} />
                  </Pressable>
                </View>

                <View style={{ flex: 1 }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: theme.spacing.md,
                      backgroundColor: theme.colors.primarySoft,
                      borderRadius: theme.radii.lg,
                      padding: theme.spacing.md,
                      marginBottom: theme.spacing.md,
                      borderWidth: 1.5,
                      borderColor: theme.colors.primarySoftBorder,
                    }}
                  >
                    <TaliVideo emotion="idle" size={56} bgColor={theme.colors.primarySoft} />
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
                      <NanoBananaIcon source={NANO_UI.streak} size={20} />
                      <AppText variant="small" style={{ color: theme.colors.secondary, fontWeight: '700' }}>
                        {streakCount}
                      </AppText>
                    </View>
                  </View>

                  {!isParentContext && (
                    <View
                      style={{
                        flexDirection: 'row',
                        gap: theme.spacing.sm,
                        flexWrap: 'wrap',
                        marginBottom: theme.spacing.md,
                      }}
                    >
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
                            {t(`tali.${action}`)}
                          </AppText>
                        </Pressable>
                      ))}
                    </View>
                  )}

                  <FlatList
                    ref={listRef}
                    data={messages}
                    keyExtractor={(item) => item.id}
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingBottom: theme.spacing.lg, flexGrow: 1 }}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    ListEmptyComponent={
                      <View style={{ alignItems: 'center', paddingTop: theme.spacing.xl }}>
                        <TaliVideo emotion="default" size={100} bgColor={theme.colors.surface} />
                        <Spacer size="md" />
                        <AppText style={{ color: theme.colors.textMuted, textAlign: 'center' }}>
                          {childName ? `${childName}, ` : ''}
                          {t('tali.intro')}
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
                            <AppText
                              variant="small"
                              style={{
                                color: theme.colors.primary,
                                fontWeight: '700',
                                marginBottom: 4,
                                marginLeft: theme.spacing.sm,
                              }}
                            >
                              {t('tali.name')}
                            </AppText>
                          )}
                          <Card
                            highlighted={isChild}
                            style={{
                              maxWidth: '80%',
                              backgroundColor: isChild ? theme.colors.secondary : theme.colors.surfaceAlt,
                              borderWidth: isChild ? 0 : 1.5,
                              borderColor: theme.colors.primarySoftBorder,
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
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: theme.spacing.sm,
                        marginBottom: theme.spacing.sm,
                      }}
                    >
                      <MaterialIcons name="chat-bubble-outline" size={20} color={theme.colors.textMuted} />
                      <AppText variant="small" style={{ color: theme.colors.textMuted }}>
                        {t('lesson.dialogTyping')}
                      </AppText>
                    </View>
                  )}

                  <View style={{ marginBottom: theme.spacing.sm }}>
                    <VoiceInputButton
                      large
                      label={t('voiceInput.speakAnswer')}
                      disabled={sending}
                      onTranscript={(text) => {
                        const trimmed = text.trim();
                        if (!trimmed || sending) return;
                        void sendMessage(trimmed);
                      }}
                    />
                  </View>

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
                        backgroundColor: theme.colors.background,
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
                </View>
              </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetAvoid: {
    width: '100%',
  },
  sheetAboveBackdrop: {
    zIndex: 1,
    elevation: 10,
  },
});
