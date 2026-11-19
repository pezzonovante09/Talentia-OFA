/**
 * Предохранитель сети прототипа (ментор П2, ворота «данные» №121). ESLint (`offlineRules`) ловит
 * сеть в исходниках, но не адрес, собранный в рантайме, и не код зависимостей: предохранитель на
 * старте заменяет сетевые глобалы бросающей функцией. Включён вне `__DEV__` — в сборке `preview`,
 * которую получают дети; в dev-сборке Metro сам ходит в сеть (горячая перезагрузка, отладчик).
 * Снимается вместе с ESLint-запретом — для одного адаптера `src/services/remote/**`.
 *
 * Имена перебираются строками: модуль — сам запрет, а не обход правил ESLint о `fetch`.
 */
export const NETWORK_GLOBALS = ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource'] as const;

export class NetworkBlockedError extends Error {
  constructor(name: string) {
    super(`${name}: сеть в прототипе закрыта (ворота «данные», №121)`);
    this.name = 'NetworkBlockedError';
  }
}

/** Включён ли предохранитель: всегда, кроме dev-сборки разработчика. */
export const networkFuseEnabled = (dev: boolean): boolean => !dev;

/** Заменить сетевые глобалы `target` бросающими функциями (и конструкторами). */
export function installNetworkFuse(target: object = globalThis): void {
  for (const name of NETWORK_GLOBALS) {
    const blocked = function blockedNetwork(): never {
      throw new NetworkBlockedError(name);
    };
    try {
      Object.defineProperty(target, name, { value: blocked, writable: false, configurable: false, enumerable: false });
    } catch {
      // свойство уже несменяемое — присвоить, если позволено
      (target as Record<string, unknown>)[name] = blocked;
    }
  }
}
