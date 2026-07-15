import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  clearLessonResume,
  getLessonResume,
  saveLessonResume,
} from '../lessonResumeStore';

describe('lessonResumeStore', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('saves and restores mistakeCount + hadSkips for the matching lessonId', async () => {
    await saveLessonResume({
      lessonId: 'lesson-1',
      phase: 'tasks',
      index: 2,
      mistakeCount: 3,
      hadSkips: true,
    });
    const resume = await getLessonResume('lesson-1');
    expect(resume).toMatchObject({
      lessonId: 'lesson-1',
      phase: 'tasks',
      index: 2,
      mistakeCount: 3,
      hadSkips: true,
    });
    expect(await getLessonResume('other-lesson')).toBeNull();
  });

  it('treats legacy v1 checkpoints without hadSkips as hadSkips=true (anti-farm)', async () => {
    await AsyncStorage.setItem(
      'talentia:lessonResume:v1',
      JSON.stringify({
        lessonId: 'legacy',
        phase: 'tasks',
        index: 1,
        savedAt: Date.now(),
      }),
    );
    const resume = await getLessonResume('legacy');
    expect(resume).not.toBeNull();
    expect(resume?.hadSkips).toBe(true);
    expect(resume?.mistakeCount).toBe(0);
  });

  it('ignores checkpoints older than 24h', async () => {
    await AsyncStorage.setItem(
      'talentia:lessonResume:v2',
      JSON.stringify({
        lessonId: 'old',
        phase: 'dialog',
        index: 0,
        mistakeCount: 0,
        hadSkips: false,
        savedAt: Date.now() - 25 * 60 * 60 * 1000,
      }),
    );
    expect(await getLessonResume('old')).toBeNull();
  });

  it('clearLessonResume removes only the matching lesson checkpoint', async () => {
    await saveLessonResume({
      lessonId: 'keep-me',
      phase: 'intro',
      index: 0,
      mistakeCount: 0,
      hadSkips: false,
    });
    await clearLessonResume('other');
    expect(await getLessonResume('keep-me')).not.toBeNull();
    await clearLessonResume('keep-me');
    expect(await getLessonResume('keep-me')).toBeNull();
  });
});
