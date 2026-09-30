// eslint-disable-next-line @typescript-eslint/no-require-imports
const plugin = require('../withNoDataBackup');

const APP_DELEGATE = `import Expo
@main
class AppDelegate: ExpoAppDelegate {
  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}`;

describe('данные вне резервной копии', () => {
  it('iOS: каталог базы помечается при запуске, повторный прогон не дублирует', () => {
    const once = plugin.addIosBackupExclusion(APP_DELEGATE);
    expect(once).toContain('isExcludedFromBackup = true');
    expect(once).toContain('appendingPathComponent("SQLite"');
    expect(once.indexOf('isExcludedFromBackup')).toBeLessThan(once.indexOf('let delegate'));
    expect(plugin.addIosBackupExclusion(once)).toBe(once);
  });

  it('iOS: не нашли точку вставки — ошибка сборки, а не тихий пропуск', () => {
    expect(() => plugin.addIosBackupExclusion('class Foo {}')).toThrow(/iCloud/);
  });

  it('Android: облачная копия и перенос на новое устройство исключают всё', () => {
    const xml: string = plugin.dataExtractionRulesXml();
    for (const section of ['cloud-backup', 'device-transfer']) {
      const body = xml.split(`<${section}>`)[1].split(`</${section}>`)[0];
      for (const domain of ['root', 'file', 'database', 'sharedpref', 'external']) {
        expect(body).toContain(`domain="${domain}"`);
      }
    }
    expect(plugin.fullBackupContentXml()).toContain('domain="database"');
  });

  it('Android: атрибуты <application>', () => {
    const manifest = { manifest: { application: [{ $: { 'android:name': '.MainApplication' } }] } };
    const out = plugin.setApplicationBackupAttrs(manifest);
    expect(out.manifest.application[0].$).toMatchObject({
      'android:allowBackup': 'false',
      'android:dataExtractionRules': '@xml/talentia_data_extraction_rules',
      'android:fullBackupContent': '@xml/talentia_backup_rules',
    });
  });
});
