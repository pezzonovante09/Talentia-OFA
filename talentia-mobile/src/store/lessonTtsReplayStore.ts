import { create } from 'zustand';

import type { TaliTtsLanguage } from '../services/ttsService';

export type LessonTtsReplayPayload =
  | { kind: 'neural'; text: string; lang: TaliTtsLanguage }
  | { kind: 'expo'; text: string; locale: string }
  | { kind: 'bundled'; moduleId: number };

type State = {
  last: LessonTtsReplayPayload | null;
  setLast: (p: LessonTtsReplayPayload | null) => void;
};

export const useLessonTtsReplayStore = create<State>((set) => ({
  last: null,
  setLast: (p) => set({ last: p }),
}));
