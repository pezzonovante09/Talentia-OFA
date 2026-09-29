import {
  applyOutcome,
  emptySkill,
  isDue,
  isMastered,
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
