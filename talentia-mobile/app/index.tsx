import { View } from 'react-native';

import { useDesign } from '../src/design';

/** Пустой экран: пока нет фронта, приложение только запускается. */
export default function Index() {
  const theme = useDesign();
  return <View style={{ flex: 1, backgroundColor: theme.colors.background }} />;
}
