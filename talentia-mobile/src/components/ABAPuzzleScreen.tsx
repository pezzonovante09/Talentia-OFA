import React from 'react';
import { Image, View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from './Text';
import { Button } from './Button';
import { Spacer } from './Spacer';
import { useAppTheme } from '../theme';
import { ABA_PUZZLE_PIECE_COUNT } from '../store/abaTokenStore';

const PUZZLE_IMAGE = require('../../assets/images/aba/aba-puzzle-bear.png');
const CELEBRATION_CONFETTI = require('../../assets/images/aba/celebration-confetti.png');

/** Source image dimensions (6 tiles: 3×2 of 200×133). */
const PUZZLE_SRC_W = 600;
const PUZZLE_SRC_H = 400;
const PIECE_SRC_W = 200;
const PIECE_SRC_H = 133;

type Props = {
  placedPieces: number;
  /** True when puzzle was just completed this session */
  showCelebration: boolean;
  onCelebrationDismiss: () => void;
  onContinueToReward: () => void;
};

export function ABAPuzzleScreen({
  placedPieces,
  showCelebration,
  onCelebrationDismiss,
  onContinueToReward,
}: Props) {
  const { t } = useTranslation();
  const theme = useAppTheme();

  const cellW = 76;
  const cellH = 52;
  const scale = Math.min(cellW / PIECE_SRC_W, cellH / PIECE_SRC_H);
  const imgDisplayW = PUZZLE_SRC_W * scale;
  const imgDisplayH = PUZZLE_SRC_H * scale;

  if (showCelebration) {
    return (
      <View style={{ flex: 1 }}>
        <Image
          source={CELEBRATION_CONFETTI}
          style={StyleSheet.absoluteFillObject}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            padding: theme.spacing.xl,
            zIndex: 1,
          }}
        >
          <AppText variant="title" style={{ textAlign: 'center', marginBottom: theme.spacing.md }}>
            {t('lesson.abaPuzzleCompleteTitle')}
          </AppText>
          <AppText
            variant="body"
            style={{ textAlign: 'center', color: theme.colors.textMuted, marginBottom: theme.spacing.lg }}
          >
            {t('lesson.abaPuzzleCompleteBody')}
          </AppText>
          <Spacer size="xl" />
          <Button
            onPress={() => {
              onCelebrationDismiss();
              onContinueToReward();
            }}
          >
            {t('lesson.abaPuzzleContinue')}
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: theme.spacing.lg }}>
      <AppText variant="subtitle" style={{ textAlign: 'center', marginBottom: theme.spacing.md }}>
        {t('lesson.abaPuzzleProgressTitle')}
      </AppText>
      <View
        style={{
          alignSelf: 'center',
          width: cellW * 3 + 4,
          flexDirection: 'row',
          flexWrap: 'wrap',
          borderWidth: 2,
          borderColor: theme.colors.border,
          borderRadius: theme.radii.md,
          overflow: 'hidden',
          marginBottom: theme.spacing.lg,
        }}
      >
        {Array.from({ length: ABA_PUZZLE_PIECE_COUNT }, (_, i) => {
          const filled = i < placedPieces;
          const col = i % 3;
          const row = Math.floor(i / 3);
          return (
            <View
              key={i}
              style={{
                width: cellW,
                height: cellH,
                overflow: 'hidden',
                justifyContent: 'center',
                alignItems: 'center',
                borderWidth: 0.5,
                borderColor: theme.colors.border,
                backgroundColor: filled ? undefined : theme.colors.surfaceAlt,
                borderStyle: filled ? 'solid' : 'dashed',
              }}
            >
              {filled ? (
                <Image
                  source={PUZZLE_IMAGE}
                  style={{
                    width: imgDisplayW,
                    height: imgDisplayH,
                    marginLeft: -col * PIECE_SRC_W * scale,
                    marginTop: -row * PIECE_SRC_H * scale,
                  }}
                  resizeMode="stretch"
                  accessibilityIgnoresInvertColors
                />
              ) : null}
            </View>
          );
        })}
      </View>
      <AppText variant="small" style={{ textAlign: 'center', color: theme.colors.textMuted }}>
        {t('lesson.abaPuzzlePieces', { placed: placedPieces, total: ABA_PUZZLE_PIECE_COUNT })}
      </AppText>
      <Spacer size="lg" />
      <Button onPress={onContinueToReward}>{t('lesson.abaTokenContinue')}</Button>
    </View>
  );
}
