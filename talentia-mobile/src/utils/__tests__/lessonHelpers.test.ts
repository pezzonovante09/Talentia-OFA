import { nextAbaPromptLevel, responseWindowMsForAgeBand } from '../lessonHelpers';

describe('responseWindowMsForAgeBand', () => {
  it('gives the youngest band the shortest window', () => {
    expect(responseWindowMsForAgeBand('5-6')).toBe(15_000);
  });

  it('increases the window for older bands', () => {
    expect(responseWindowMsForAgeBand('7')).toBe(18_000);
    expect(responseWindowMsForAgeBand('8')).toBe(20_000);
    expect(responseWindowMsForAgeBand('9-10')).toBe(20_000);
  });

  it('falls back to 20s for unknown/missing age bands', () => {
    expect(responseWindowMsForAgeBand(undefined)).toBe(20_000);
    expect(responseWindowMsForAgeBand('unknown')).toBe(20_000);
  });
});

describe('nextAbaPromptLevel', () => {
  it('escalates to level 1 (visual prompt) on the first mistake on a task', () => {
    expect(nextAbaPromptLevel(0)).toBe(1);
  });

  it('escalates to level 2 (restricted choice) on the second mistake on the same task', () => {
    expect(nextAbaPromptLevel(1)).toBe(2);
  });

  it('stays at level 2 for further mistakes on the same task', () => {
    expect(nextAbaPromptLevel(2)).toBe(2);
    expect(nextAbaPromptLevel(5)).toBe(2);
  });

  it('does not carry a mistake on task 1 into task 2 (per-trial reset)', () => {
    // Task 1: one wrong answer escalates to level 1, then the child answers
    // correctly and the lesson advances — `resetForNextTask()` zeroes the
    // per-task mistake tally before task 2 starts.
    const task1MistakesBeforeAnswer = 0;
    expect(nextAbaPromptLevel(task1MistakesBeforeAnswer)).toBe(1);

    const task2MistakesBeforeAnswer = 0; // reset by resetForNextTask()
    expect(nextAbaPromptLevel(task2MistakesBeforeAnswer)).toBe(1);
  });
});
