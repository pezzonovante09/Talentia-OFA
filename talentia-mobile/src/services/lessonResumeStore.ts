import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'talentia:lessonResume:v2';
/** Legacy key from the first resume implementation (phase/index only). */
const LEGACY_STORAGE_KEY = 'talentia:lessonResume:v1';

/** Resume checkpoints older than this are ignored — the child likely moved on to something else. */
const RESUME_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type LessonResumePhase = 'dialog' | 'intro' | 'tasks';

export type LessonResumeState = {
  lessonId: string;
  phase: LessonResumePhase;
  /** Index within whichever list `phase` refers to (dialog lines, intro slides, or tasks). */
  index: number;
  /** Mistakes accumulated so far — restored so skip/star anti-farming survives process death. */
  mistakeCount: number;
  /** Whether any task was skipped — restored so a kill-app mid-skip cannot farm 3 stars. */
  hadSkips: boolean;
  savedAt: number;
};

export type LessonResumeInput = Omit<LessonResumeState, 'savedAt'>;

/**
 * Persists a single "in progress" lesson checkpoint so a child who exits
 * mid-lesson (back button, app kill, phone call, etc.) can pick up where
 * they left off instead of losing progress and restarting from the top.
 * Only one lesson can be "in progress" at a time by design — starting or
 * resuming a different lesson simply overwrites this checkpoint.
 */
export async function saveLessonResume(state: LessonResumeInput): Promise<void> {
  try {
    const payload: LessonResumeState = {
      ...state,
      mistakeCount: Math.max(0, state.mistakeCount | 0),
      hadSkips: Boolean(state.hadSkips),
      savedAt: Date.now(),
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    // Drop legacy key so an old incomplete checkpoint cannot overwrite v2 later.
    await AsyncStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Best-effort: losing a checkpoint just means the lesson restarts from the top.
  }
}

function normalizeResume(parsed: Partial<LessonResumeState> & { lessonId?: string }): LessonResumeState | null {
  if (!parsed || typeof parsed.lessonId !== 'string') return null;
  if (parsed.phase !== 'dialog' && parsed.phase !== 'intro' && parsed.phase !== 'tasks') return null;
  if (typeof parsed.index !== 'number' || parsed.index < 0) return null;
  if (typeof parsed.savedAt !== 'number' || Date.now() - parsed.savedAt > RESUME_MAX_AGE_MS) return null;
  return {
    lessonId: parsed.lessonId,
    phase: parsed.phase,
    index: parsed.index,
    // Legacy v1 checkpoints lacked these fields — treat as non-perfect to avoid skip→3★ bypass.
    mistakeCount: typeof parsed.mistakeCount === 'number' ? Math.max(0, parsed.mistakeCount) : 0,
    hadSkips: typeof parsed.hadSkips === 'boolean' ? parsed.hadSkips : true,
    savedAt: parsed.savedAt,
  };
}

export async function getLessonResume(lessonId: string): Promise<LessonResumeState | null> {
  try {
    let raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      raw = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
    }
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LessonResumeState>;
    const normalized = normalizeResume(parsed);
    if (!normalized || normalized.lessonId !== lessonId) return null;
    return normalized;
  } catch {
    return null;
  }
}

export async function clearLessonResume(lessonId?: string): Promise<void> {
  try {
    if (lessonId) {
      for (const key of [STORAGE_KEY, LEGACY_STORAGE_KEY]) {
        const raw = await AsyncStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw) as LessonResumeState;
          if (parsed.lessonId !== lessonId) continue;
          await AsyncStorage.removeItem(key);
        }
      }
      return;
    }
    await AsyncStorage.removeItem(STORAGE_KEY);
    await AsyncStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Ignore — worst case a stale checkpoint lingers until it expires or is overwritten.
  }
}
