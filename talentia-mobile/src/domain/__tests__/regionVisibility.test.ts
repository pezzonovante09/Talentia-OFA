import { lessonLanguages, topicVisible, visibleRegions } from '../regionVisibility';
import type { ChildLanguageSettings } from '../regionVisibility';
import type { AgeBand, Topic } from '../../types/task';

const topic = (band: AgeBand, instructionLanguages?: Topic['instructionLanguages']): Topic => ({
  id: `t-${band}`,
  titleKey: 'k',
  instructionLanguages,
  lessons: [{ id: 'l', titleKey: 'k', band, hook: { taliPose: 'hello', lineKey: 'k' }, tasks: [], atlasEntryKey: 'k' }],
});
const ru: ChildLanguageSettings = { interfaceLang: 'ru', kyrgyzRegion: false };

describe('видимость регионов и тем', () => {
  it('регион кыргызского — только если включён этому ребёнку (№38, №50)', () => {
    expect(visibleRegions(ru)).toEqual(['numbers', 'words', 'nature', 'workshop']);
    expect(visibleRegions({ ...ru, kyrgyzRegion: true })).toContain('kyrgyz');
    expect(topicVisible('kyrgyz', topic('7'), ru)).toBe(false);
    expect(topicVisible('kyrgyz', topic('7'), { ...ru, kyrgyzRegion: true })).toBe(true);
  });

  it('Побережье слов есть при любом интерфейсе (№47)', () => {
    for (const interfaceLang of ['ru', 'en', 'ky'] as const) {
      expect(topicVisible('words', topic('7'), { interfaceLang, kyrgyzRegion: false })).toBe(true);
    }
  });

  it('при en-интерфейсе подготовительный английский 5-6, 7, 8 скрыт, 9-10 остаётся (№49)', () => {
    const en: ChildLanguageSettings = { interfaceLang: 'en', kyrgyzRegion: false };
    expect(['5-6', '7', '8', '9-10'].map((b) => topicVisible('workshop', topic(b as AgeBand), en))).toEqual([false, false, false, true]);
    expect(topicVisible('workshop', topic('5-6'), ru)).toBe(true);
  });

  it('тема с instructionLanguages видна только при своём языке', () => {
    expect(topicVisible('nature', topic('8', ['ru']), { interfaceLang: 'ky', kyrgyzRegion: false })).toBe(false);
    expect(topicVisible('nature', topic('8', ['ru']), ru)).toBe(true);
  });

  it('Tali и инструкции — на языке интерфейса, материал — язык региона (№47, №48)', () => {
    expect(lessonLanguages('words', { interfaceLang: 'ky', kyrgyzRegion: false })).toEqual({ voice: 'ky', material: 'ru' });
    expect(lessonLanguages('kyrgyz', { interfaceLang: 'ru', kyrgyzRegion: true })).toEqual({ voice: 'ru', material: 'ky' });
    expect(lessonLanguages('numbers', ru)).toEqual({ voice: 'ru', material: null });
  });
});
