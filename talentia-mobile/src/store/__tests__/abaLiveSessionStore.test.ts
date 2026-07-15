const mockGetSession = jest.fn().mockResolvedValue({
  data: { session: { user: { id: 'user-1' } } },
});
const mockFrom = jest.fn();

jest.mock('@/src/services/supabase', () => ({
  supabase: {
    auth: { getSession: (...args: unknown[]) => mockGetSession(...args) },
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

jest.mock('@/src/services/syncStatus', () => ({
  syncWithRetry: (_label: string, fn: () => Promise<void>) => {
    void fn();
    return Promise.resolve();
  },
}));

import { useAbaLiveSessionStore } from '../abaLiveSessionStore';

function chainableUpdate() {
  const chain: { eq: jest.Mock } = {
    eq: jest.fn(function eq(this: unknown) {
      return chain;
    }),
  };
  return Object.assign(chain, {
    then(onFulfilled: (v: { error: null }) => unknown) {
      return Promise.resolve({ error: null }).then(onFulfilled);
    },
  });
}

describe('abaLiveSessionStore finish/clear', () => {
  beforeEach(() => {
    mockFrom.mockReset();
    mockFrom.mockImplementation(() => ({
      delete: jest.fn(() => ({
        eq: jest.fn(() => ({ eq: jest.fn().mockResolvedValue({ error: null }) })),
      })),
      insert: jest.fn().mockResolvedValue({ error: null }),
      update: jest.fn(() => chainableUpdate()),
    }));

    useAbaLiveSessionStore.setState({
      active: true,
      lessonId: 'lesson-1',
      lessonTitleKey: 'data.lessons.x',
      taskIndex: 2,
      totalTasks: 4,
      lastResult: 'correct',
      lastUpdated: Date.now(),
      tasksCompleted: 2,
      tasksSkipped: 0,
      mistakes: 1,
      lastSummary: null,
    });
  });

  afterEach(() => {
    useAbaLiveSessionStore.setState({
      active: false,
      lessonId: null,
      lessonTitleKey: null,
      taskIndex: 0,
      totalTasks: 0,
      lastResult: null,
      lastUpdated: null,
      tasksCompleted: 0,
      tasksSkipped: 0,
      mistakes: 0,
      lastSummary: null,
    });
  });

  it('finishSession marks inactive and records tokens in lastSummary', () => {
    useAbaLiveSessionStore.getState().finishSession(3);
    const s = useAbaLiveSessionStore.getState();
    expect(s.active).toBe(false);
    expect(s.lastSummary?.tokensEarned).toBe(3);
    expect(s.lastSummary?.lessonId).toBe('lesson-1');
  });

  it('clearSession is a no-op for remote writes when already inactive', () => {
    useAbaLiveSessionStore.getState().finishSession(2);
    const fromCallsBefore = mockFrom.mock.calls.length;
    useAbaLiveSessionStore.getState().clearSession();
    expect(useAbaLiveSessionStore.getState().active).toBe(false);
    expect(mockFrom.mock.calls.length).toBe(fromCallsBefore);
  });

  it('coalesces rapid progress updates under the 2.5s throttle window', async () => {
    jest.useFakeTimers();
    mockFrom.mockClear();

    const store = useAbaLiveSessionStore.getState();
    store.setTaskProgress(1, 4);
    store.setTaskProgress(2, 4);
    store.setTaskProgress(3, 4);

    expect(mockFrom.mock.calls.length).toBeLessThanOrEqual(1);
    await jest.advanceTimersByTimeAsync(2600);
    expect(useAbaLiveSessionStore.getState().taskIndex).toBe(3);
    jest.useRealTimers();
  });
});
