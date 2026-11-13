import {
  applyLessonOutcomes,
  applyOutcome,
  emptySkill,
  isDue,
  isMastered,
  skillsForReviewSession,
  skillsToReview,
  starsForLesson,
  type SkillState,
} from '../mastery';

describe('освоение навыка', () => {
  it('четыре верных ответа подряд доводят навык до освоенного', () => {
    let s = emptySkill('count-to-5');
    for (let lesson = 1; lesson <= 4; lesson += 1) s = applyOutcome(s, 'correct', lesson);
    expect({ box: s.box, освоен: isMastered(s) }).toEqual({ box: 4, освоен: true });
  });

  it('показанный ответ возвращает навык в первую коробку', () => {
    let s = emptySkill('count-to-5');
    for (let lesson = 1; lesson <= 4; lesson += 1) s = applyOutcome(s, 'correct', lesson);
    s = applyOutcome(s, 'helped', 5);
    expect({ box: s.box, подряд: s.correctInRow }).toEqual({ box: 1, подряд: 0 });
  });

  it('ответ с подсказки не двигает навык ни вперёд, ни назад', () => {
    let s = applyOutcome(emptySkill('x'), 'correct', 1);
    const before = s.box;
    s = applyOutcome(s, 'hinted', 2);
    expect({ box: s.box, подряд: s.correctInRow }).toEqual({ box: before, подряд: 0 });
  });

  it('спираль темы: верно вне срока не двигает часы повторения, с подсказкой — двигает', () => {
    // урок 1 — первая встреча (коробка 2), урок 2 — спираль не в срок: коробка и часы стоят, счётчики растут
    const first = applyLessonOutcomes(emptySkill('x'), ['correct', 'correct'], 1, '2026-10-01');
    const spiral = applyLessonOutcomes(first, ['correct'], 2, '2026-10-02');
    expect({ box: spiral.box, lesson: spiral.lastSeenLesson, day: spiral.lastSeenDay, attempts: spiral.attempts }).toEqual({ box: 2, lesson: 1, day: '2026-10-01', attempts: 3 });
    // урок 3 — в срок (зазор 2 от урока 1): коробка 3, часы на урок 3
    const due = applyLessonOutcomes(spiral, ['correct'], 3, '2026-10-03');
    expect({ box: due.box, lesson: due.lastSeenLesson }).toEqual({ box: 3, lesson: 3 });
    // подсказка не в срок — часы заново, коробка стоит
    const hinted = applyLessonOutcomes(first, ['hinted'], 2, '2026-10-02');
    expect({ box: hinted.box, lesson: hinted.lastSeenLesson, day: hinted.lastSeenDay }).toEqual({ box: 2, lesson: 2, day: '2026-10-02' });
  });

  it('сессия повторения: навык, встреченный сегодня, не предлагается', () => {
    const today = applyLessonOutcomes(emptySkill('a'), ['helped'], 3, '2026-10-05');
    const earlier = { ...applyLessonOutcomes(emptySkill('b'), ['correct'], 1, '2026-10-01'), lastSeenLesson: 1 };
    const due = skillsForReviewSession([today, earlier], 4, '2026-10-05');
    expect(due.map((s) => s.skill)).toEqual(['b']);
    expect(skillsToReview([today, earlier], 4, 2, '2026-10-05').map((s) => s.skill)).toEqual(['a', 'b']);
  });

  it('ошибка не портит статистику попыток', () => {
    let s = emptySkill('x');
    s = applyOutcome(s, 'correct', 1);
    s = applyOutcome(s, 'helped', 2);
    expect({ попыток: s.attempts, верных: s.correct }).toEqual({ попыток: 2, верных: 1 });
  });

  it('чем дальше коробка, тем реже повторение', () => {
    const at = (box: 1 | 2 | 3 | 4) => {
      const s: SkillState = { ...emptySkill('x'), box, lastSeenLesson: 0 };
      // наименьший номер урока, на котором навык снова спросят
      for (let l = 1; l <= 40; l += 1) if (isDue(s, l)) return l;
      return -1;
    };
    expect([at(1), at(2), at(3), at(4)]).toEqual([1, 2, 5, 12]);
  });

  it('навык, который ещё ни разу не встречался, не просится на повторение', () => {
    expect(isDue(emptySkill('x'), 10)).toBe(false);
  });

  it('на повторение идут сначала навыки из младших коробок', () => {
    const mk = (skill: string, box: 1 | 2 | 3 | 4) => ({
      ...emptySkill(skill),
      box,
      lastSeenLesson: 0,
    });
    const out = skillsToReview([mk('крепкий', 3), mk('шаткий', 1), mk('средний', 2)], 20);
    expect(out.map((s) => s.skill)).toEqual(['шаткий', 'средний']);
  });

  it('в урок подмешивается не больше двух повторений', () => {
    const all = ['a', 'b', 'c', 'd'].map((n) => ({ ...emptySkill(n), lastSeenLesson: 0 }));
    expect(skillsToReview(all, 20).length).toBe(2);
  });

  it('звёзды: без ошибок три, одна подсказка две, показанный ответ одна', () => {
    expect(starsForLesson(['correct', 'correct', 'correct'])).toBe(3);
    expect(starsForLesson(['correct', 'hinted', 'correct'])).toBe(2);
    expect(starsForLesson(['correct', 'hinted', 'hinted'])).toBe(1);
    expect(starsForLesson(['correct', 'correct', 'helped'])).toBe(1);
  });
});
