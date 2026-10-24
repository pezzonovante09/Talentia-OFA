/**
 * Фон карты по `mapBackdrop()`: светлая обычная — панорама региона; тёмная обычная — заливка региона +
 * контур горизонта той же панорамы + ориентир-«вывеска» ≥ 64; calm — песок `background`. Панорама
 * прижата к низу и обрезается по ширине (`xMidYMax slice`): верхние 64 — ровная заливка под полосу.
 */
import { StyleSheet, View } from 'react-native';

import { REGION_HORIZONS, REGION_LANDMARKS, REGION_PANORAMAS } from '../../assets/registry';
import { useDesign } from '../../design';
import { mapBackdrop, mapLayout } from '../../design/tokens';
import type { Region } from '../../types/task';

export type MapBackdropProps = { region: Region['id']; width: number; height: number };

export function MapBackdrop({ region, width, height }: MapBackdropProps) {
  const theme = useDesign();
  const kind = mapBackdrop({ scheme: theme.scheme, calmMode: theme.calmMode });
  const Panorama = REGION_PANORAMAS[region];
  const Horizon = REGION_HORIZONS[region];
  const Landmark = REGION_LANDMARKS[region];

  if (kind === 'panorama' && Panorama) {
    return (
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: theme.colors.regions[region] }]} testID="map-backdrop-panorama" pointerEvents="none">
        <Panorama width={width} height={height} preserveAspectRatio="xMidYMax slice" />
      </View>
    );
  }
  if (kind === 'flat_region') {
    return (
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: theme.colors.regions[region] }]} testID="map-backdrop-flat" pointerEvents="none">
        {Horizon && <Horizon width={width} height={height} preserveAspectRatio="xMidYMax slice" color={theme.colors.outline} />}
        {Landmark && (
          <View style={{ position: 'absolute', left: width / 2 - mapLayout.landmarkMin / 2, top: height * 0.3 }}>
            <Landmark width={mapLayout.landmarkMin} height={mapLayout.landmarkMin} color={theme.colors.onRegion} stroke={theme.colors.outline} />
          </View>
        )}
      </View>
    );
  }
  return <View style={[StyleSheet.absoluteFillObject, { backgroundColor: theme.colors.background }]} testID="map-backdrop-sand" pointerEvents="none" />;
}
