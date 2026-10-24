import { regionLessons } from '../../content';
import { buildMapModel } from '../mapModel';
import { DEFAULT_SETTINGS, type ChildSessionState } from '../childSession';
import { EMPTY_PROGRESS } from '../../services/progressPort';
import { initI18n } from '../../i18n';

const NOW = new Date('2026-10-24T10:00:00.000Z');
const base: Pick<ChildSessionState, 'progress' | 'activeLesson' | 'portion' | 'settings'> = {
  progress: EMPTY_PROGRESS,
  activeLesson: null,
  portion: { left: 3, grantedDay: '2026-10-24' },
  settings: DEFAULT_SETTINGS,
};
const all = () => true;
const lessons = regionLessons('numbers');

describe('buildMapModel', () => {
  it('чистая установка: первый урок открыт, Tali указывает на него, повторение тихое', () => {
    const m = buildMapModel(base, NOW, 'numbers', all);
    expect(m.states).toEqual(['open', 'ahead', 'ahead', 'ahead', 'ahead', 'ahead']);
    expect(m.pointer).toBe(0);
    expect(m.review).toBe('quiet');
    expect(m.unavailable.size).toBe(0);
  });

  it('после первого урока: он пройден, открыт второй', () => {
    const m = buildMapModel(
      { ...base, progress: { ...EMPTY_PROGRESS, lessonCounter: 1, atlas: [{ lessonId: lessons[0].id, atlasEntryKey: 'k', stars: 3, firstLesson: 0 }] }, portion: { left: 2, grantedDay: '2026-10-24' } },
      NOW,
      'numbers',
      all,
    );
    expect(m.states.slice(0, 3)).toEqual(['done', 'open', 'ahead']);
    expect(m.pointer).toBe(1);
  });

  it('порция потрачена — следующий урок спит, указателя нет (повторять нечего)', () => {
    const m = buildMapModel({ ...base, portion: { left: 0, grantedDay: '2026-10-24' } }, NOW, 'numbers', all);
    expect(m.states[0]).toBe('sleeping');
    expect(m.pointer).toBeNull();
  });

  it('без перевода (ky): все уроки недоступны, указатель никуда не ставится', () => {
    const m = buildMapModel(base, NOW, 'numbers', () => false);
    expect(m.unavailable.size).toBe(6);
    expect(m.pointer).toBeNull();
  });

  it('настоящие локали: в ru доступны все шесть, в ky — ни одного', () => {
    initI18n({ lng: 'ru' });
    const m = buildMapModel(base, NOW, 'numbers');
    expect(m.unavailable.size).toBe(0);
    initI18n({ lng: 'ky' });
    expect(buildMapModel(base, NOW, 'numbers').unavailable.size).toBe(6);
  });
});
