import { countingTopic, numeralsTopic } from '../numbers-5-6';
import { allLessons, lessonById, lessonsBefore, REGIONS, regionLessons, regionMapLessons, regionOfLesson } from '../index';
import { REVIEW_LESSON_ID } from '../../domain/parentReport';

describe('реестр контента (срез: Мир чисел, 5–6)', () => {
  it('один регион, две темы, шесть уроков в порядке тем', () => {
    expect(REGIONS.map((r) => r.id)).toEqual(['numbers']);
    const lessons = regionLessons('numbers');
    expect(lessons).toHaveLength(6);
    expect(lessons.map((l) => l.id)).toEqual([...countingTopic.lessons, ...numeralsTopic.lessons].map((l) => l.id));
    expect(new Set(lessons.map((l) => l.id)).size).toBe(6);
  });

  it('уроки для карты несут id и полосу', () => {
    expect(regionMapLessons('numbers')).toEqual(regionLessons('numbers').map((l) => ({ id: l.id, band: l.band })));
    expect(regionMapLessons('words')).toEqual([]);
  });

  it('поиск по id и регион урока', () => {
    const first = regionLessons('numbers')[0];
    expect(lessonById(first.id)).toBe(first);
    expect(regionOfLesson(first.id)).toBe('numbers');
    expect(lessonById('nope')).toBeUndefined();
    expect(regionOfLesson('nope')).toBeUndefined();
  });

  it('lessonsBefore — все предыдущие уроки региона, у первого пусто', () => {
    const [l1, l2, l3, l4] = regionLessons('numbers');
    expect(lessonsBefore(l1.id)).toEqual([]);
    expect(lessonsBefore(l4.id).map((l) => l.id)).toEqual([l1.id, l2.id, l3.id]);
    expect(lessonsBefore('nope')).toEqual([]);
  });

  it('id «review» занят сессией повторения: lessonById его не знает, allLessons — все уроки регионов', () => {
    expect(lessonById(REVIEW_LESSON_ID)).toBeUndefined();
    expect(allLessons().map((l) => l.id)).toEqual(REGIONS.flatMap((r) => regionLessons(r.id)).map((l) => l.id));
    expect(allLessons().every((l) => l.id !== REVIEW_LESSON_ID)).toBe(true);
  });

  it('урок с id «review» в контенте роняет реестр при загрузке', () => {
    jest.isolateModules(() => {
      const actual = jest.requireActual<typeof import('../numbers-5-6')>('../numbers-5-6');
      const [first, ...rest] = actual.countingTopic.lessons;
      jest.doMock('../numbers-5-6', () => ({
        ...actual,
        countingTopic: { ...actual.countingTopic, lessons: [{ ...first, id: 'review' }, ...rest] },
      }));
      expect(() => jest.requireActual<typeof import('../index')>('../index')).toThrow(/review/);
      jest.dontMock('../numbers-5-6');
    });
  });
});
