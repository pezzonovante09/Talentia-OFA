import { View } from 'react-native';

import { useDesign } from '../../src/design';
import { RequireSession } from '../../src/ui/RequireSession';

/** Экран урока — шаг 3 среза; пока заглушка внутри сеанса. */
export default function LessonScreen() {
  const theme = useDesign();
  return (
    <RequireSession>
      <View style={{ flex: 1, backgroundColor: theme.colors.background }} testID="lesson-screen" />
    </RequireSession>
  );
}
