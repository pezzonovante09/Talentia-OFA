/**
 * Голос Tali и вопросов. В срезе озвучки нет (этап 13: запись ru/ky, `assets/audio/` пуст) —
 * `silentVoice` только помнит последнюю фразу, чтобы тесты и отладка видели, что экран собирался
 * сказать. Экраны зовут `voice.say(key)` там, где по SCREENS.md звучит реплика; подмена на реальный
 * порт не трогает экраны.
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

export const voice: VoicePort = createSilentVoice();
