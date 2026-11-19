/**
 * Данные ребёнка не уходят в резервные копии системы (PARENT.md, «Данные на устройстве»;
 * AUDIT.md, блокер 4). Резервная копия — главный реальный путь утечки: копия базы с
 * пробами ABA (данные о развитии ребёнка) оказалась бы в iCloud или Google Drive родителя
 * и на новом устройстве, вне удаления и срока хранения приложения.
 *
 * iOS: expo-sqlite держит базу в `Documents/SQLite`, а он по умолчанию уходит в iCloud и
 * iTunes. Настройки в app.json для этого нет — при запуске приложение ставит на каталог
 * `isExcludedFromBackup`; AsyncStorage исключается ключом Info.plist.
 * Android: `allowBackup: false` (app.json) не закрывает перенос на новое устройство на
 * Android 12+ — `dataExtractionRules` исключают всё и из облачной копии, и из переноса;
 * `fullBackupContent` — то же для старых версий.
 *
 * Чистые функции экспортируются для тестов (`__tests__/withNoDataBackup.test.ts`).
 */
const { withAndroidManifest, withAppDelegate, withDangerousMod, withInfoPlist } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARK = '// talentia: база вне резервной копии';

const IOS_SNIPPET = `
    ${MARK}
    if let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first {
      var dir = docs.appendingPathComponent("SQLite", isDirectory: true)
      try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
      var values = URLResourceValues()
      values.isExcludedFromBackup = true
      try? dir.setResourceValues(values)
    }
`;

/** Вставить исключение в начало `didFinishLaunchingWithOptions`. Не нашли — ошибка сборки, а не молчание. */
function addIosBackupExclusion(src) {
  if (src.includes(MARK)) return src;
  const re = /(didFinishLaunchingWithOptions[^{]*\{)/;
  if (!re.test(src)) {
    throw new Error('withNoDataBackup: не найден didFinishLaunchingWithOptions в AppDelegate — исключение из iCloud не поставлено');
  }
  return src.replace(re, `$1${IOS_SNIPPET}`);
}

const DOMAINS = ['root', 'file', 'database', 'sharedpref', 'external'];

function dataExtractionRulesXml() {
  const excludes = DOMAINS.map((d) => `    <exclude domain="${d}" path="." />`).join('\n');
  return `<?xml version="1.0" encoding="utf-8"?>
<data-extraction-rules>
  <cloud-backup>
${excludes}
  </cloud-backup>
  <device-transfer>
${excludes}
  </device-transfer>
</data-extraction-rules>
`;
}

function fullBackupContentXml() {
  const excludes = DOMAINS.map((d) => `  <exclude domain="${d}" path="." />`).join('\n');
  return `<?xml version="1.0" encoding="utf-8"?>
<full-backup-content>
${excludes}
</full-backup-content>
`;
}

/** Атрибуты `<application>`: запрет бэкапа и ссылки на правила. */
function setApplicationBackupAttrs(manifest) {
  const app = manifest.manifest.application?.[0];
  if (!app) throw new Error('withNoDataBackup: в AndroidManifest нет <application>');
  app.$ = {
    ...app.$,
    'android:allowBackup': 'false',
    'android:dataExtractionRules': '@xml/talentia_data_extraction_rules',
    'android:fullBackupContent': '@xml/talentia_backup_rules',
  };
  return manifest;
}

function withNoDataBackup(config) {
  config = withInfoPlist(config, (c) => {
    c.modResults.RCTAsyncStorageExcludeFromBackup = true;
    return c;
  });
  config = withAppDelegate(config, (c) => {
    c.modResults.contents = addIosBackupExclusion(c.modResults.contents);
    return c;
  });
  config = withAndroidManifest(config, (c) => {
    c.modResults = setApplicationBackupAttrs(c.modResults);
    return c;
  });
  config = withDangerousMod(config, [
    'android',
    async (c) => {
      const dir = path.join(c.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res', 'xml');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'talentia_data_extraction_rules.xml'), dataExtractionRulesXml());
      fs.writeFileSync(path.join(dir, 'talentia_backup_rules.xml'), fullBackupContentXml());
      return c;
    },
  ]);
  return config;
}

module.exports = withNoDataBackup;
module.exports.addIosBackupExclusion = addIosBackupExclusion;
module.exports.dataExtractionRulesXml = dataExtractionRulesXml;
module.exports.fullBackupContentXml = fullBackupContentXml;
module.exports.setApplicationBackupAttrs = setApplicationBackupAttrs;
