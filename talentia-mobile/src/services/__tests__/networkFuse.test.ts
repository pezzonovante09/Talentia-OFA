/** Предохранитель сети прототипа (ментор П2). */
import { installNetworkFuse, NETWORK_GLOBALS, NetworkBlockedError, networkFuseEnabled } from '../networkFuse';

describe('предохранитель сети', () => {
  it('включён в сборке для детей, выключен только в dev', () => {
    expect(networkFuseEnabled(false)).toBe(true);
    expect(networkFuseEnabled(true)).toBe(false);
  });

  it('вызов и конструктор сетевых глобалов бросают; заменить обратно нельзя', () => {
    const g: Record<string, unknown> = { fetch: () => 'ok', XMLHttpRequest: class {}, WebSocket: class {}, EventSource: class {} };
    installNetworkFuse(g);
    for (const name of NETWORK_GLOBALS) {
      const f = g[name] as (...a: unknown[]) => unknown;
      expect(() => f('https://example')).toThrow(NetworkBlockedError);
      expect(() => new (f as unknown as new () => unknown)()).toThrow(NetworkBlockedError);
      expect(() => {
        'use strict';
        g[name] = () => 'again';
      }).toThrow(TypeError);
    }
  });

  it('корень приложения ставит предохранитель на старте', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const src: string = require('fs').readFileSync(require('path').join(__dirname, '../../../app/_layout.tsx'), 'utf8');
    expect(src).toMatch(/if \(networkFuseEnabled\(__DEV__\)\) installNetworkFuse\(\);/);
  });
});
