/**
 * Гейт родительского раздела. Спецификация — «Гейт» в `PARENT.md`.
 *
 * На семейном планшете живёт сессия родителя, и единственное, что отделяет
 * восьмилетку от раздела, — этот гейт. Поэтому он проектируется как граница, а не
 * как заставка: три уровня, автозакрытие, повторное подтверждение для необратимого.
 *
 * Здесь только правила — без экранов, хранилища и криптографии. Хеш и случайность
 * приходят снаружи, чтобы правила проверялись тестом детерминированно.
 */

// ---------------------------------------------------------------------------
// PIN
// ---------------------------------------------------------------------------

/** Шесть цифр, а не четыре: запасной путь, когда биометрии нет. */
export const PIN_LENGTH = 6;

/**
 * Годится ли PIN. Кроме длины отсекаются очевидные: одна цифра шесть раз и прямой
 * ряд — их ребёнок угадает, увидев клавиатуру.
 */
export function pinProblem(pin: string): 'length' | 'digits' | 'repeated' | 'sequence' | null {
  if (pin.length !== PIN_LENGTH) return 'length';
  if (!/^\d+$/.test(pin)) return 'digits';
  if (new Set(pin).size === 1) return 'repeated';
  const d = [...pin].map(Number);
  const step = d[1] - d[0];
  if ((step === 1 || step === -1) && d.every((x, i) => i === 0 || x - d[i - 1] === step)) return 'sequence';
  return null;
}

/** Хеш-функция устройства, например SHA-256 из `expo-crypto`. Возвращает hex. */
export type Digest = (input: string) => Promise<string>;

/** Что лежит в SecureStore вместо PIN. Версия — чтобы однажды сменить схему без сброса. */
export type PinRecord = { v: 1; salt: string; hash: string };

/**
 * PIN хранится хешем с солью, а не открытым текстом, как в прежней версии.
 *
 * Честно о пределе: шесть цифр — миллион вариантов, и от перебора хеш не спасает.
 * Он защищает от другого — PIN, прочитанный из резервной копии или отладчиком, не
 * раскрывается и не подходит к банковскому приложению, где родитель, скорее всего,
 * использует те же цифры. От перебора защищают лимит попыток и SecureStore.
 */
export async function hashPin(pin: string, salt: string, digest: Digest): Promise<PinRecord> {
  return { v: 1, salt, hash: await digest(`talentia-pin:v1:${salt}:${pin}`) };
}

/** Сравнение без раннего выхода: время ответа не подсказывает, сколько символов совпало. */
function sameHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyPin(pin: string, record: PinRecord, digest: Digest): Promise<boolean> {
  const candidate = await hashPin(pin, record.salt, digest);
  return sameHex(candidate.hash, record.hash);
}

// ---------------------------------------------------------------------------
// Раскладка
// ---------------------------------------------------------------------------

/** Случайный источник в [0, 1). */
export type Rng = () => number;

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'] as const;

/**
 * Раскладка клавиш — новая при каждом показе и не такая, как в прошлый раз.
 *
 * Ребёнок рядом запоминает не цифры, а **позиции**, и с первого раза: при
 * фиксированной раскладке PIN перестаёт быть секретом, как только его один раз
 * набрали при ребёнке. Перемешивание снимает эту атаку целиком.
 */
export function shuffledKeypad(rng: Rng, previous?: readonly string[]): string[] {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const keys = [...DIGITS];
    for (let i = keys.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [keys[i], keys[j]] = [keys[j], keys[i]];
    }
    const same = previous && previous.length === keys.length && previous.every((k, i) => k === keys[i]);
    if (!same) return keys;
  }
  // Генератор, десять раз подряд давший ту же перестановку, сломан — сдвигаем вручную.
  const base = previous ? [...previous] : [...DIGITS];
  return [...base.slice(1), base[0]];
}

// ---------------------------------------------------------------------------
// Лимит попыток
// ---------------------------------------------------------------------------

/** После стольких ошибок подряд — блокировка. */
export const PIN_MAX_ATTEMPTS = 5;

/** Блокировки нарастают: 1 → 5 → 15 минут, дальше 15. Сохранено из прежней версии. */
export const LOCKOUT_STEPS_MS = [60_000, 5 * 60_000, 15 * 60_000] as const;

/**
 * Состояние лимита. Хранится в SecureStore отдельно от AsyncStorage: иначе очистка
 * данных приложения сбрасывала бы таймер.
 */
export type LockoutState = { failures: number; level: number; lockedUntil: number | null };

export const NO_LOCKOUT: LockoutState = { failures: 0, level: 0, lockedUntil: null };

export function isLocked(s: LockoutState, now: number): boolean {
  return s.lockedUntil !== null && now < s.lockedUntil;
}

export function registerFailure(s: LockoutState, now: number): LockoutState {
  if (isLocked(s, now)) return s;
  const failures = s.failures + 1;
  if (failures < PIN_MAX_ATTEMPTS) return { ...s, failures, lockedUntil: null };
  const step = LOCKOUT_STEPS_MS[Math.min(s.level, LOCKOUT_STEPS_MS.length - 1)];
  return { failures: 0, level: s.level + 1, lockedUntil: now + step };
}

/** Верный PIN — счётчик и нарастание сбрасываются. */
export function registerSuccess(): LockoutState {
  return NO_LOCKOUT;
}

// ---------------------------------------------------------------------------
// Сессия раздела: автозакрытие и свежесть
// ---------------------------------------------------------------------------

/** Раздел закрывается сам после стольких миллисекунд без касаний. */
export const IDLE_CLOSE_MS = 2 * 60_000;

/** Окно, в котором подтверждение гейта годится для необратимого действия. */
export const FRESH_CONFIRM_MS = 5 * 60_000;

/**
 * Открытый раздел. В прежней версии это был локальный `useState`, переживавший и
 * уход в фон, и возврат: планшет отдали ребёнку с открытым разделом — он его читает.
 */
export type GateSession = { openedAt: number; lastActivityAt: number; confirmedAt: number };

export function openSession(now: number): GateSession {
  return { openedAt: now, lastActivityAt: now, confirmedAt: now };
}

/** Касание внутри раздела продлевает сессию; закрытую — не воскрешает. */
export function touch(s: GateSession | null, now: number): GateSession | null {
  if (!isOpen(s, now)) return null;
  return { ...(s as GateSession), lastActivityAt: now };
}

export function isOpen(s: GateSession | null, now: number): boolean {
  return s !== null && now - s.lastActivityAt < IDLE_CLOSE_MS;
}

/** Уход приложения в фон закрывает раздел сразу, без окна. */
export function onBackground(): null {
  return null;
}

/** Повторное подтверждение (биометрия или PIN) внутри открытого раздела. */
export function reconfirm(s: GateSession | null, now: number): GateSession | null {
  if (!isOpen(s, now)) return null;
  return { ...(s as GateSession), lastActivityAt: now, confirmedAt: now };
}

// ---------------------------------------------------------------------------
// Что требует повторного подтверждения
// ---------------------------------------------------------------------------

export type SensitiveAction =
  | 'clear_progress'
  | 'delete_child'
  | 'revoke_consent'
  | 'change_mode'
  | 'change_band'
  | 'grant_access'
  | 'transfer_ownership'
  | 'delete_account';

/**
 * Чем подтверждается действие.
 *
 * `gate_fresh` — биометрия или PIN не старше пяти минут. `email_otp` — код из письма:
 * удаление аккаунта подтверждает взрослого, а не устройство, и проверяет это сервер
 * (`/api/account/delete`), не приложение.
 */
export type Confirmation = 'gate_fresh' | 'gate_now' | 'email_otp';

export const CONFIRMATION: Record<SensitiveAction, Confirmation> = {
  clear_progress: 'gate_fresh',
  delete_child: 'gate_fresh',
  revoke_consent: 'gate_fresh',
  change_mode: 'gate_fresh',
  change_band: 'gate_fresh',
  grant_access: 'gate_fresh',
  transfer_ownership: 'gate_fresh',
  /**
   * Временно, до облака (решение владельца 2026-10-25, проверка приватности): почты в локальной
   * версии нет, поэтому `gate_now` — PIN вводится на самом экране удаления, окно свежести не
   * считается. С появлением `cloud_sync` у аккаунта возвращается `email_otp` — `deleteAccountConfirmation`.
   */
  delete_account: 'gate_now',
};

/** Чем подтверждается удаление аккаунта: пока нет облачного согласия — PIN на месте, с ним — код из письма. */
export function deleteAccountConfirmation(hasCloudGrant: boolean): Confirmation {
  return hasCloudGrant ? 'email_otp' : CONFIRMATION.delete_account;
}

/** Можно ли выполнить действие без нового подтверждения прямо сейчас. `gate_now` и `email_otp` — никогда. */
export function canPerform(action: SensitiveAction, s: GateSession | null, now: number): boolean {
  if (CONFIRMATION[action] !== 'gate_fresh') return false;
  return isOpen(s, now) && now - (s as GateSession).confirmedAt <= FRESH_CONFIRM_MS;
}

// ---------------------------------------------------------------------------
// Порог намерения
// ---------------------------------------------------------------------------

/**
 * Одноразовая задача перед первой настройкой PIN — выше полосы 9–10: умножение
 * двузначного на двузначное. Это **порог намерения**, и называется так честно — в
 * тексте экрана и здесь. Упорный ребёнок с калькулятором его пройдёт, поэтому
 * выдавать его за проверяемое родительское согласие нельзя. Возраст проверяет
 * подтверждение почты при регистрации: ящик не его.
 */
export type IntentChallenge = { a: number; b: number; answer: number };

export function intentChallenge(rng: Rng): IntentChallenge {
  // 13–29 без круглых: умножение на 10 или 20 решается в уме за секунду
  const pick = () => {
    for (;;) {
      const n = 13 + Math.floor(rng() * 17);
      if (n % 10 !== 0) return n;
    }
  };
  const a = pick();
  const b = pick();
  return { a, b, answer: a * b };
}

export function checkIntent(c: IntentChallenge, input: string): boolean {
  return /^\s*\d+\s*$/.test(input) && Number(input.trim()) === c.answer;
}

// ---------------------------------------------------------------------------
// Web
// ---------------------------------------------------------------------------

/** Раздел, который нельзя защитить, не показывается вовсе. На web нет ни биометрии, ни SecureStore. */
export function gateAvailable(platform: 'ios' | 'android' | 'web' | string): boolean {
  return platform === 'ios' || platform === 'android';
}
