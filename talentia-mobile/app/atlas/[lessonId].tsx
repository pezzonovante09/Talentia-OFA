import { View } from 'react-native';

import { useDesign } from '../../src/design';
import { RequireSession } from '../../src/ui/RequireSession';

/** Страница атласа — шаг 5 среза; пока заглушка внутри сеанса. */
export default function AtlasScreen() {
  const theme = useDesign();
  return (
    <RequireSession>
      <View style={{ flex: 1, backgroundColor: theme.colors.background }} testID="atlas-screen" />
    </RequireSession>
  );
}
