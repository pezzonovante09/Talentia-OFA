/**
 * Конфигурация сборки для сторов (раунд 3, `release-readiness-auditor`): разрешения только под
 * работающую функцию — разрешение без функции причина отказа в сторе (CLAUDE.md). Тест держит
 * `app.json`, `eas.json` и `package.json` от тихого отката.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..');
const read = (f: string) => JSON.parse(fs.readFileSync(path.join(root, f), 'utf-8'));
const app = read('app.json').expo;
const eas = read('eas.json');
const pkg = read('package.json');

const plugin = (name: string) => app.plugins.find((p: unknown) => p === name || (Array.isArray(p) && p[0] === name));

describe('app.json: разрешения и платформы', () => {
  it('Android: разрешений нет, опасные заблокированы, рекламный идентификатор тоже', () => {
    expect(app.android.permissions).toEqual([]);
    expect(app.android.blockedPermissions).toEqual(
      expect.arrayContaining([
        'android.permission.RECORD_AUDIO',
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
        'android.permission.SYSTEM_ALERT_WINDOW',
        'com.google.android.gms.permission.AD_ID',
      ]),
    );
  });

  it('резервная копия запрещена, ориентация портретная', () => {
    expect(app.android.allowBackup).toBe(false);
    expect(app.orientation).toBe('portrait');
  });

  it('iOS: планшета нет (iPad в «Отложено»), в Info.plist нет строк микрофона, речи, Face ID, геолокации, камеры', () => {
    expect(app.ios.supportsTablet).toBe(false);
    const keys = Object.keys(app.ios.infoPlist);
    expect(keys.filter((k) => /^NS.*UsageDescription$/.test(k))).toEqual([]);
  });

  it('expo-secure-store не добавляет Face ID без функции', () => {
    expect(plugin('expo-secure-store')).toEqual(['expo-secure-store', { faceIDPermission: false }]);
  });

  it('локализации iOS: ru, en, ky; язык разработки ru', () => {
    expect(app.ios.infoPlist.CFBundleLocalizations).toEqual(['ru', 'en', 'ky']);
    expect(app.ios.infoPlist.CFBundleDevelopmentRegion).toBe('ru');
  });

  it('палитра: значок и заставка на фоне приложения (#FFF3E3 светлая, #1B1410 тёмная), не шаблон Expo', () => {
    expect(app.android.adaptiveIcon.backgroundColor).toBe('#FFF3E3');
    // фоновая картинка шаблона Expo (голубая сетка) перекрывает backgroundColor — её в конфиге быть не должно
    expect(app.android.adaptiveIcon.backgroundImage).toBeUndefined();
    const splash = plugin('expo-splash-screen')[1];
    expect(splash.backgroundColor).toBe('#FFF3E3');
    expect(splash.dark.backgroundColor).toBe('#1B1410');
  });

  it('экспорт-шифрование: только стандартное (HTTPS)', () => {
    expect(app.ios.infoPlist.ITSAppUsesNonExemptEncryption).toBe(false);
  });
});

describe('eas.json и package.json', () => {
  it('версии сборок ведёт EAS (remote), а не локальный app.json', () => {
    expect(eas.cli.appVersionSource).toBe('remote');
    expect(eas.build.production.android.autoIncrement).toBe(true);
    expect(eas.build.production.ios.autoIncrement).toBe(true);
  });

  it('в приложении нет SDK микрофона, речи, уведомлений, камеры, геолокации, рекламы, аналитики, Sentry', () => {
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    const forbidden = [
      /speech/,
      /expo-audio/,
      /expo-av/,
      /expo-notifications/,
      /expo-camera/,
      /expo-location/,
      /expo-contacts/,
      /expo-tracking/,
      /admob/,
      /facebook/,
      /firebase/,
      /amplitude/,
      /mixpanel/,
      /sentry/,
      /segment/,
    ];
    expect(deps.filter((d) => forbidden.some((re) => re.test(d)))).toEqual([]);
  });

  it('пакет не зависит от самого себя (корневой монорепо)', () => {
    expect(pkg.dependencies['talentia-monorepo']).toBeUndefined();
  });
});
