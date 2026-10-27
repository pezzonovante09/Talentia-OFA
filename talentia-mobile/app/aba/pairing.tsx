/**
 * Экран ABA (этап 11) — наполняется в своей фазе; пока — переход на карту.
 */
import { Redirect } from 'expo-router';

export default function AbaPairing() {
  return <Redirect href="/map" />;
}
