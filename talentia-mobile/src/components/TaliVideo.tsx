import React, { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { useVideoPlayer, VideoView, type VideoSource } from 'expo-video';

export type TaliEmotion = 'idle' | 'energetic' | 'friendly' | 'default';

const SOURCES: Record<TaliEmotion, VideoSource> = {
  idle: require('../../assets/videos/tali-idle.mp4'),
  energetic: require('../../assets/videos/tali-energetic.mp4'),
  friendly: require('../../assets/videos/tali-friendly.mp4'),
  default: require('../../assets/videos/tali-default.mp4'),
};

type Props = {
  emotion?: TaliEmotion;
  size?: number;
  /**
   * Background color of the surrounding container.
   * On Android, VideoView (SurfaceView) cannot be transparent — pass the
   * parent's background color here so the video blends seamlessly.
   * Defaults to 'transparent' which works on iOS.
   */
  bgColor?: string;
};

export function TaliVideo({ emotion = 'default', size = 80, bgColor = 'transparent' }: Props) {
  const player = useVideoPlayer(SOURCES[emotion], (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  // Ensure playback starts after the player is ready (covers Android delayed init)
  useEffect(() => {
    player.loop = true;
    player.muted = true;
    player.play();
  }, [player]);

  // Restart when emotion changes (source switches)
  useEffect(() => {
    player.loop = true;
    player.play();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emotion]);

  // Auto-restart if playback stops unexpectedly (e.g. audio focus loss)
  useEffect(() => {
    const sub = player.addListener('statusChange', ({ status }) => {
      if (status === 'readyToPlay' && !player.playing) {
        player.play();
      }
    });
    return () => sub.remove();
  }, [player]);

  // On Android, SurfaceView ignores CSS transparency.
  // Use the provided bgColor (should match the parent container) so the
  // solid video background blends in visually.
  // Default Android fallback matches the app's main background (#EBF9FF).
  const containerBg = Platform.OS === 'android' ? (bgColor === 'transparent' ? '#EBF9FF' : bgColor) : 'transparent';

  return (
    <View
      style={{
        width: size,
        height: size,
        backgroundColor: containerBg,
        borderRadius: size / 2,
        overflow: 'hidden',
      }}
    >
      <VideoView
        player={player}
        style={{ width: size, height: size, backgroundColor: 'transparent' }}
        contentFit="contain"
        nativeControls={false}
      />
    </View>
  );
}
