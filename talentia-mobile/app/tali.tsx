import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { TaliModal } from '../src/components/TaliModal';

export default function TaliRoute() {
  const router = useRouter();
  const { lessonId, topicId, context, reportSummary, lessonTitle } = useLocalSearchParams<{
    lessonId?: string;
    topicId?: string;
    context?: string;
    reportSummary?: string;
    lessonTitle?: string;
  }>();

  return (
    <View style={{ flex: 1 }}>
      <TaliModal
        visible
        onClose={() => router.back()}
        lessonId={lessonId ? String(lessonId) : undefined}
        topicId={topicId ? String(topicId) : undefined}
        context={context ? String(context) : undefined}
        reportSummary={reportSummary ? String(reportSummary) : undefined}
        lessonTitle={lessonTitle ? String(lessonTitle) : undefined}
      />
    </View>
  );
}
