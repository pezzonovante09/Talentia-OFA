import { View } from 'react-native';

import { useDesign } from '../src/design';
import { RequireSession } from '../src/ui/RequireSession';

/** Карта региона — шаг 2 среза; пока заглушка внутри сеанса. */
export default function MapScreen() {
  const theme = useDesign();
  return (
    <RequireSession>
      <View style={{ flex: 1, backgroundColor: theme.colors.regions.numbers }} testID="map-screen" />
    </RequireSession>
  );
}
