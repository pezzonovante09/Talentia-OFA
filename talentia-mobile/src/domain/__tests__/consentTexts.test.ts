/**
 * Страж связи «текст согласия ↔ версия» (контрольный аудит 2026-11-09, Ж4, `child-privacy-compliance`).
 *
 * Версия согласия (`CURRENT_CONSENT_TEXTS`) меняется только при существенной правке текста, и тогда старые
 * согласия становятся `outdated` — родителя спрашивают заново. Но сам текст лежит в локалях, и правка
 * `parent.consent.body` без подъёма версии молча оставляла бы старые согласия действующими на новый текст.
 * Здесь для каждой текущей версии записан sha256 заголовка и тела на этом языке. Текст изменился — тест падает:
 * поднимите версию в `src/domain/consentTexts.ts` (`ru-draft-N`, `en-draft-N`, `ky-draft-N` вместе) и запишите
 * новый хеш рядом с новой версией. Версия поднята без правки текста — тоже падение: у новой версии хеша нет.
 *
 * Хеш — node `crypto`, а не `services/digest` (его мок в Jest отдаёт постоянные байты). Кыргызского текста нет
 * (№108): `ky-*` версии проверяются, как только ключ появится в `ky.json`.
 */
import { createHash } from 'crypto';

import en from '../../i18n/locales/en.json';
import ky from '../../i18n/locales/ky.json';
import ru from '../../i18n/locales/ru.json';
import type { ConsentScope } from '../consent';
import { CURRENT_CONSENT_TEXTS } from '../consentTexts';

type Locale = Record<string, unknown>;
const LOCALES: Record<string, Locale> = { ru, en, ky };

/**
 * Где лежит текст согласия области — все строки экрана, которые утверждают что-то о данных: заголовок, тело и
 * подпись под согласием ABA («Только на этом устройстве» — существенное утверждение о хранении).
 */
const TEXT_KEYS: Partial<Record<ConsentScope, readonly string[]>> = {
  account_local: ['parent.consent.title', 'parent.consent.body'],
  aba_processing: ['parent.aba.consentTitle', 'parent.aba.consentBody', 'parent.aba.localOnly'],
};

/** Хеши текущих версий. Новая версия — новая строка; старые строки можно удалять вместе с версией. */
const KNOWN_HASHES: Record<string, string> = {
  'account_local:ru-draft-1': '0f6159f617cc8542cd5bc8d38ca69ea49069e55ee7135d8e25cd74a0897e762c',
  'account_local:en-draft-1': '533e4ed847e171ab3837772369fbbbcb1bcbae2373544e1661cf27e3189cec6d',
  'aba_processing:ru-draft-3': 'b6e760af8850f8af9a8daf12740377695495fd126458665f8788856975245085',
  'aba_processing:en-draft-3': 'e1aef0b702ce523ea83e82efeeb405141b41c13124c986abc925f72efdf3360f',
};

const pick = (obj: Locale, path: string): string | undefined =>
  path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Locale)[k] : undefined), obj) as string | undefined;

const hashOf = (parts: readonly string[]) => createHash('sha256').update(parts.join('\n'), 'utf8').digest('hex');

describe('текст согласия привязан к версии', () => {
  const cases: [ConsentScope, string, string][] = [];
  for (const [scope, versions] of Object.entries(CURRENT_CONSENT_TEXTS) as [ConsentScope, readonly string[]][]) {
    if (!TEXT_KEYS[scope]) continue;
    for (const v of versions) cases.push([scope, v.split('-')[0], v]);
  }

  it.each(cases)('%s: версия %s/%s — текст тот, на который она выдана', (scope, lang, version) => {
    const parts = TEXT_KEYS[scope]!.map((k) => pick(LOCALES[lang], k));
    if (parts.some((p) => p === undefined)) {
      // языка ещё нет (ky, №108): версия заведена заранее, проверять нечего; экран показывает ru (`consentLang`)
      expect(lang).toBe('ky');
      return;
    }
    const actual = hashOf(parts as string[]);
    const expected = KNOWN_HASHES[`${scope}:${version}`];
    expect({ version, hash: actual, hint: expected ? 'текст изменился — поднимите версию в consentTexts.ts и обновите хеш' : 'новая версия — запишите её хеш в KNOWN_HASHES' }).toEqual({
      version,
      hash: expected,
      hint: expect.any(String),
    });
  });

  it('у областей без текста в приложении версии не проверяются — список областей с текстом полон', () => {
    // появится экран согласия на облако, ИИ, голос или телеметрию — добавьте его ключи в TEXT_KEYS
    const withText = Object.keys(TEXT_KEYS).sort();
    expect(withText).toEqual(['aba_processing', 'account_local']);
  });
});
