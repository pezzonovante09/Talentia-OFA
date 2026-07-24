import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const patches = {
  en: {
    auth: {
      consentGuardian:
        'I confirm I am the parent or legal guardian of the child who will use this app.',
      consentGuardianProfile:
        'I am the parent/guardian and I consent to creating this child profile and processing learning data as described in the Privacy Policy.',
      consentPrivacyPrefix: 'I agree to the',
      errorConsentRequired:
        'Please confirm parental consent and accept Privacy & Terms to continue.',
    },
    settings: {
      resetConfirm:
        'This clears progress and settings on this device only. Your cloud account and saved progress are not deleted. Continue?',
      deleteAccount: 'Delete account',
      deleteAccountTitle: 'Delete account',
      deleteAccountConfirm:
        'This permanently deletes your account and cloud learning data (profile, progress, analytics). This cannot be undone.',
      deleteAccountButton: 'Delete forever',
      deleteAccountFailed:
        'Could not delete the account. Check your connection and try again.',
    },
  },
  ru: {
    auth: {
      consentGuardian:
        'Я подтверждаю, что я родитель или законный представитель ребёнка, который будет пользоваться приложением.',
      consentGuardianProfile:
        'Я родитель/опекун и даю согласие на создание профиля ребёнка и обработку данных об обучении согласно Политике конфиденциальности.',
      consentPrivacyPrefix: 'Я принимаю',
      errorConsentRequired:
        'Подтвердите согласие родителя и примите Политику и Условия, чтобы продолжить.',
    },
    settings: {
      resetConfirm:
        'Будут очищены прогресс и настройки только на этом устройстве. Облачный аккаунт и сохранённый прогресс не удаляются. Продолжить?',
      deleteAccount: 'Удалить аккаунт',
      deleteAccountTitle: 'Удаление аккаунта',
      deleteAccountConfirm:
        'Аккаунт и облачные данные обучения (профиль, прогресс, аналитика) будут удалены навсегда. Это нельзя отменить.',
      deleteAccountButton: 'Удалить навсегда',
      deleteAccountFailed:
        'Не удалось удалить аккаунт. Проверьте соединение и попробуйте снова.',
    },
  },
  ky: {
    auth: {
      consentGuardian:
        'Мен бул тиркемени колдоно турган баланын ата-энеси же мыйзамдуу өкүлү экенимди ырастайм.',
      consentGuardianProfile:
        'Мен ата-эне/камкорчумун жана баланын профилин түзүүгө жана окуу маалыматтарын Купуя саясатына ылайык иштетүүгө макулмун.',
      consentPrivacyPrefix: 'Мен кабыл алам',
      errorConsentRequired:
        'Улантуу үчүн ата-эненин макулдугун жана Купуя саясатын/Шарттарды ырастаңыз.',
    },
    settings: {
      resetConfirm:
        'Бул түзмөктөгү прогресс жана жөндөөлөр гана тазаланат. Булут аккаунту жана сакталган прогресс өчүрүлбөйт. Уланталыбы?',
      deleteAccount: 'Аккаунтту өчүрүү',
      deleteAccountTitle: 'Аккаунтту өчүрүү',
      deleteAccountConfirm:
        'Аккаунтуңуз жана булуттагы окуу маалыматтары (профиль, прогресс, аналитика) түбөлүккө өчүрүлөт. Муну кайтарууга болбойт.',
      deleteAccountButton: 'Түбөлүккө өчүр',
      deleteAccountFailed:
        'Аккаунтту өчүрүү мүмкүн болбоду. Байланышты текшерип, кайра аракет кылыңыз.',
    },
  },
};

for (const loc of /** @type {const} */ (['en', 'ru', 'ky'])) {
  const p = path.join(root, 'src', 'i18n', 'locales', `${loc}.json`);
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  Object.assign(data.auth, patches[loc].auth);
  Object.assign(data.settings, patches[loc].settings);
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n');
}
console.log('i18n consent/delete keys patched');
