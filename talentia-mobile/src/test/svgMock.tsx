/**
 * Jest не прогоняет svg через react-native-svg-transformer: любой `*.svg` — пустой View с
 * `testID="svg"` и пробросом пропсов, чтобы тесты видели размер и цвет, которые экран передал.
 */
import { View } from 'react-native';

export default function SvgMock(props: Record<string, unknown>) {
  return <View testID="svg" {...props} />;
}
