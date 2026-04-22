import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export const ABA_PUZZLE_PIECE_COUNT = 6;

type AbaTokenState = {
  /** Tokens accumulated toward the next puzzle piece */
  tokensTowardPiece: number;
  /** How many pieces placed on the current puzzle (0..ABA_PUZZLE_PIECE_COUNT) */
  placedPieces: number;
  addLessonTokens: (
    amount: number,
    tokensPerPiece?: number,
  ) => { newPieces: number; puzzleCompleted: boolean };
  /** After celebration: clear board, keep jar */
  resetPuzzleAfterCelebration: () => void;
  resetPuzzleProgress: () => void;
};

const defaultTokensPerPiece = 5;

export const useAbaTokenStore = create<AbaTokenState>()(
  persist(
    (set, get) => ({
      tokensTowardPiece: 0,
      placedPieces: 0,

      addLessonTokens: (amount, tokensPerPiece = defaultTokensPerPiece) => {
        let { tokensTowardPiece, placedPieces } = get();
        let total = tokensTowardPiece + Math.max(0, Math.min(3, amount));
        let newPieces = 0;
        let puzzleCompleted = false;
        while (total >= tokensPerPiece && placedPieces < ABA_PUZZLE_PIECE_COUNT) {
          total -= tokensPerPiece;
          placedPieces += 1;
          newPieces += 1;
        }
        if (placedPieces >= ABA_PUZZLE_PIECE_COUNT) {
          puzzleCompleted = true;
        }
        set({
          tokensTowardPiece: total,
          placedPieces: Math.min(placedPieces, ABA_PUZZLE_PIECE_COUNT),
        });
        return { newPieces, puzzleCompleted };
      },

      resetPuzzleAfterCelebration: () => set({ placedPieces: 0 }),

      resetPuzzleProgress: () => set({ tokensTowardPiece: 0, placedPieces: 0 }),
    }),
    {
      name: 'talentia-aba-tokens',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        tokensTowardPiece: s.tokensTowardPiece,
        placedPieces: s.placedPieces,
      }),
    },
  ),
);
