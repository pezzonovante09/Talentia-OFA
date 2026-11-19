/**
 * Проигрыватель файлов из сборки на `expo-audio` (№158): только воспроизведение — без микрофона,
 * без фона, без сети. `playsInSilentMode`: в ABA похвала без жетона держится на голосе, и в
 * беззвучном режиме iOS она не должна пропадать (`aba-pedagogy-specialist`, `child-ux-specialist`).
 */
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

import type { SoundPlayer } from './voice';

export function expoSoundPlayer(): SoundPlayer {
  void setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false, allowsRecording: false }).catch(() => undefined);
  let current: AudioPlayer | null = null;
  return {
    play(source) {
      current = createAudioPlayer(source);
      current.play();
    },
    stop() {
      if (!current) return;
      current.pause();
      current.remove();
      current = null;
    },
  };
}
