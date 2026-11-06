/** Голос и звуки (№158): файл по ключу, одна фраза за раз, без файла — молчит. */
import { createAudioVoice, setVoiceBackend, voice, type SoundPlayer } from '../voice';

function recorder(): SoundPlayer & { calls: string[] } {
  const calls: string[] = [];
  return { calls, play: (s) => void calls.push(`play:${s}`), stop: () => void calls.push('stop') };
}

describe('голос', () => {
  it('ключ с файлом играет его, новая фраза обрывает прежнюю; без файла — только молчание и память', () => {
    const p = recorder();
    const v = createAudioVoice(p, { 'aba.token': 11, 'aba.praise.1': 12 });
    v.say('aba.token');
    v.say('aba.praise.1');
    v.say('lesson.busy');
    expect(p.calls).toEqual(['stop', 'play:11', 'stop', 'play:12', 'stop']);
    expect(v.last).toEqual({ key: 'lesson.busy', params: undefined });
  });

  it('voice делегирует подключённому проигрывателю; смена проигрывателя останавливает прежний', () => {
    const a = recorder();
    const b = recorder();
    setVoiceBackend(createAudioVoice(a, { k: 1 }));
    voice.say('k');
    setVoiceBackend(createAudioVoice(b, { k: 2 }));
    voice.say('k');
    expect(a.calls).toEqual(['stop', 'play:1', 'stop']);
    expect(b.calls).toEqual(['stop', 'play:2']);
    expect(voice.last?.key).toBe('k');
  });
});
