/**
 * Голос Tali и вопросов, звуки ABA (№158). Экраны зовут `voice.say(key)` там, где по SCREENS.md
 * звучит реплика или звук; что именно звучит, решает подключённый проигрыватель.
 *
 * - `createSilentVoice` — только помнит последнюю фразу (тесты, отладка, ключ без файла).
 * - `createAudioVoice` — файл из сборки по ключу (`SOUND_FILES`, `assets/audio/`), одна фраза за раз:
 *   новая обрывает прежнюю. Нет файла — молчит, как раньше. Сеть и запись не участвуют.
 *
 * Корень приложения ставит настоящий проигрыватель (`setVoiceBackend`); экраны держат один `voice`.
 */
export type VoicePort = {
  say(key: string, params?: Record<string, string | number>): void;
  stop(): void;
  /** Последняя произнесённая фраза — для тестов и отладки. */
  readonly last: { key: string; params?: Record<string, string | number> } | null;
};

export function createSilentVoice(): VoicePort {
  let last: VoicePort['last'] = null;
  return {
    say(key, params) {
      last = { key, params };
    },
    stop() {
      last = null;
    },
    get last() {
      return last;
    },
  };
}

/** Проигрыватель файла: в приложении — `expo-audio` (`audioPlayer.ts`), в тестах — запись вызовов. */
export type SoundPlayer = {
  play(source: number): void;
  stop(): void;
};

/** Ключ реплики или звука → файл из бандла (`require('…/assets/audio/…')`). Наполняется озвучкой (этап 13). */
export const SOUND_FILES: Record<string, number> = {};

export function createAudioVoice(player: SoundPlayer, files: Readonly<Record<string, number>> = SOUND_FILES): VoicePort {
  const silent = createSilentVoice();
  return {
    say(key, params) {
      silent.say(key, params);
      const source = files[key];
      player.stop();
      if (source !== undefined) player.play(source);
    },
    stop() {
      silent.stop();
      player.stop();
    },
    get last() {
      return silent.last;
    },
  };
}

let backend: VoicePort = createSilentVoice();

/** Подключить проигрыватель (корень приложения). Тесты оставляют молчащий. */
export function setVoiceBackend(next: VoicePort): void {
  backend.stop();
  backend = next;
}

export const voice: VoicePort = {
  say: (key, params) => backend.say(key, params),
  stop: () => backend.stop(),
  get last() {
    return backend.last;
  },
};
