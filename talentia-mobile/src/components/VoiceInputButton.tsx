import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';

type Props = {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  large?: boolean;
  label?: string;
};

/** Check once at load time — expo-speech-recognition requires a dev build, fails in Expo Go */
let isSpeechRecognitionAvailable = false;
try {
  require('expo-speech-recognition');
  isSpeechRecognitionAvailable = true;
} catch {
  // Expo Go or web — native module not available
}

/**
 * Wrapper that loads VoiceInputButtonNative only when expo-speech-recognition is available.
 * Returns null in Expo Go and on web. Requires development build for voice input.
 */
export function VoiceInputButton(props: Props) {
  const [NativeButton, setNativeButton] = useState<React.ComponentType<Props> | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web' || !isSpeechRecognitionAvailable) return;
    import('./VoiceInputButtonNative')
      .then((mod) => setNativeButton(() => mod.VoiceInputButtonNative))
      .catch(() => setNativeButton(null));
  }, []);

  if (Platform.OS === 'web' || !isSpeechRecognitionAvailable || !NativeButton) return null;
  return <NativeButton {...props} />;
}
