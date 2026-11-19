/**
 * Фабрики моков для тестов экранов ABA (`app/aba/__tests__/*`). Вызов `jest.mock` остаётся в каждом файле теста (его
 * поднимает babel-jest над импортами), фабрика берёт тело отсюда через `jest.requireActual`:
 *
 *   jest.mock('expo-router', () => jest.requireActual<typeof import('../../../src/test/abaScreenMocks')>('../../../src/test/abaScreenMocks').expoRouterMock());
 *
 * Модуль ничего из приложения не импортирует на верхнем уровне: фабрика мока вызывается, когда модуль впервые нужен, и
 * импорт приложения отсюда замкнул бы загрузку на сам мок.
 */

/** Роутер: `__router` — общие `jest.fn` для проверок (`jest.requireMock('expo-router').__router`); `Redirect` пишет href. */
export function expoRouterMock() {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  const router = { replace: jest.fn(), push: jest.fn(), back: jest.fn(), dismissTo: jest.fn() };
  return {
    __router: router,
    useRouter: () => router,
    useLocalSearchParams: () => ({}),
    Redirect: ({ href }: { href: string }) => React.createElement(Text, { testID: 'redirect' }, href),
  };
}

/**
 * Картинки предметов в реестре есть (2026-11-06), в Jest каждый `.svg` — один и тот же `SvgMock` без id стимула.
 * Тесту нужно знать, какой предмет на плите (`stimOf` → верный вариант), поэтому каждая картинка — свой View с
 * `testID="aba-art-<id>"`; допуск целей (`readyAbaTargets`) при этом остаётся как в продукте — картинка есть.
 */
export function registryWithArtTestIds() {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  const actual = jest.requireActual<typeof import('../assets/registry')>('../assets/registry');
  const art = Object.fromEntries(
    Object.entries(actual.ABA_OBJECT_ART).map(([id, Art]) => [id, Art == null ? null : (props: Record<string, unknown>) => React.createElement(View, { ...props, testID: `aba-art-${id}` })]),
  );
  return { ...actual, ABA_OBJECT_ART: art };
}

/**
 * `expo-crypto` в Jest детерминирован (jest.setup.js): без счётчика вторая проба сессии получает тот же id и падает на
 * UNIQUE `aba_trials.id` — тесты с двумя пробами подряд были бы невозможны.
 */
export function countingAbaIds() {
  let n = 0;
  return {
    newAbaId: () => `00000000-0000-4000-8000-${String((n += 1)).padStart(12, '0')}`,
    /** Счётчик общий на модуль: `beforeEach` обнуляет его, чтобы id не зависели от упавших ранее тестов. */
    __reset: () => {
      n = 0;
    },
  };
}
