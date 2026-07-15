import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TaliVideo } from './TaliVideo';
import { TaliModal } from './TaliModal';
import type { TaskContext } from '../services/companionService';
import { useAppTheme } from '../theme';

/** Tab bar height from (tabs)/_layout — FAB must sit above it or taps hit tabs instead. */
const TAB_BAR_HEIGHT = 72;

const FAB_SIZE = 80;
const FAB_VIDEO = 72;

export type TaliFABProps = {
  lessonId?: string;
  topicId?: string;
  context?: string;
  taskContext?: string;
  /** Structured task for /api/tali (question, options, correct answer for model — not shown verbatim to child). */
  companionTaskContext?: TaskContext;
  reportSummary?: string;
  lessonTitle?: string;
  /** When true (e.g. on map tabs), FAB is placed above the bottom tab bar. */
  withTabBar?: boolean;
};

export function TaliFAB({
  lessonId,
  topicId,
  context,
  taskContext,
  companionTaskContext,
  reportSummary,
  lessonTitle,
  withTabBar = false,
}: TaliFABProps) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const [modalVisible, setModalVisible] = useState(false);

  const bottomOffset =
    insets.bottom + (withTabBar ? TAB_BAR_HEIGHT + 12 : 20);

  return (
    <>
      <Pressable
        onPress={() => setModalVisible(true)}
        style={({ pressed }) => ({
          position: 'absolute',
          bottom: bottomOffset,
          right: Math.max(16, insets.right + 8),
          zIndex: 999,
          elevation: 12,
          width: FAB_SIZE,
          height: FAB_SIZE,
          borderRadius: FAB_SIZE / 2,
          backgroundColor: theme.colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.88 : 1,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
        })}
        accessibilityRole="button"
        accessibilityLabel="Tali"
      >
        <View
          style={{
            width: FAB_VIDEO,
            height: FAB_VIDEO,
            borderRadius: FAB_VIDEO / 2,
            overflow: 'hidden',
          }}
        >
          <TaliVideo emotion="default" size={FAB_VIDEO} bgColor={theme.colors.primary} />
        </View>
      </Pressable>
      <TaliModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        lessonId={lessonId}
        topicId={topicId}
        context={context}
        taskContext={taskContext}
        companionTaskContext={companionTaskContext}
        reportSummary={reportSummary}
        lessonTitle={lessonTitle}
      />
    </>
  );
}
