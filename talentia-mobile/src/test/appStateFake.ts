/**
 * Подмена `AppState` для тестов сворачивания: подписчики `addEventListener` копятся в списке, события `background` /
 * `active` / `inactive` шлёт тест (`emit`, внутри `act`).
 *
 * Подмена присваиванием, а не `jest.spyOn`: `mockRestore` у мока React Native снял бы и его реализацию, и следующие
 * экраны получили бы `undefined`. `restore()` возвращает исходные свойства — звать в `afterEach` или `finally`, чтобы
 * подмена не осталась следующему тесту и после падения.
 */
import { AppState, type AppStateStatus } from 'react-native';

import { act } from './render';

type Listener = (s: AppStateStatus) => void;
type WritableAppState = { currentState: unknown; addEventListener: typeof AppState.addEventListener };

export type AppStateFake = {
  /** Подменить `addEventListener` (`beforeEach`); список подписчиков пуст. */
  install(): void;
  /** Вернуть исходные `addEventListener` и, если его трогали, `currentState`. */
  restore(): void;
  /** Подписчики сейчас (копия): отписка (`remove`) убирает своего. */
  handlers(): Listener[];
  /** Поставить `AppState.currentState` (в моке React Native там функция). */
  setCurrent(s: AppStateStatus): void;
  /**
   * Событие всем подписчикам внутри `act`. С `syncCurrentState` — как на устройстве: `currentState` обновляется раньше
   * подписчиков; без него `currentState` не трогается.
   */
  emit(s: AppStateStatus): Promise<void>;
};

export function appStateFake({ syncCurrentState = false }: { syncCurrentState?: boolean } = {}): AppStateFake {
  const app = AppState as unknown as WritableAppState;
  let listeners: Listener[] = [];
  let saved: { add: WritableAppState['addEventListener']; current: unknown; currentTouched: boolean } | null = null;

  const setCurrent = (s: AppStateStatus) => {
    if (saved === null) throw new Error('appStateFake: install() в beforeEach');
    saved.currentTouched = true;
    app.currentState = s;
  };

  return {
    install() {
      listeners = [];
      saved = { add: app.addEventListener, current: app.currentState, currentTouched: false };
      app.addEventListener = ((_type: string, fn: Listener) => {
        listeners.push(fn);
        return {
          remove: () => {
            listeners = listeners.filter((h) => h !== fn);
          },
        };
      }) as typeof AppState.addEventListener;
    },
    restore() {
      if (saved === null) return;
      app.addEventListener = saved.add;
      if (saved.currentTouched) app.currentState = saved.current;
      saved = null;
      listeners = [];
    },
    handlers: () => listeners.slice(),
    setCurrent,
    emit: (s: AppStateStatus) =>
      act(async () => {
        if (syncCurrentState) setCurrent(s);
        listeners.slice().forEach((h) => h(s));
      }),
  };
}
