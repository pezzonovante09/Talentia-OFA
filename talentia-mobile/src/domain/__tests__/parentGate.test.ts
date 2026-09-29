import { createHash } from 'node:crypto';

import {
  canPerform,
  checkIntent,
  FRESH_CONFIRM_MS,
  gateAvailable,
  hashPin,
  IDLE_CLOSE_MS,
  intentChallenge,
  isLocked,
  isOpen,
  LOCKOUT_STEPS_MS,
  NO_LOCKOUT,
  onBackground,
  openSession,
  pinProblem,
  reconfirm,
  registerFailure,
  registerSuccess,
  shuffledKeypad,
  touch,
  verifyPin,
  type Digest,
  type LockoutState,
  type Rng,
} from '../parentGate';

const sha256: Digest = async (s) => createHash('sha256').update(s).digest('hex');
const cycle = (...xs: number[]): Rng => {
  let i = 0;
  return () => xs[i++ % xs.length];
};

describe('PIN', () => {
  it('шесть цифр', () => {
    expect([pinProblem('4827'), pinProblem('48a7x1'), pinProblem('482719')]).toEqual(['length', 'digits', null]);
  });

  it('очевидные PIN отклоняются', () => {
    expect([pinProblem('111111'), pinProblem('123456'), pinProblem('987654')]).toEqual([
      'repeated',
      'sequence',
      'sequence',
    ]);
  });

  it('хранится хеш с солью, не сам PIN', async () => {
    const rec = await hashPin('482719', 'salt-a', sha256);
    expect(JSON.stringify(rec)).not.toContain('482719');
    expect(rec.hash).not.toBe((await hashPin('482719', 'salt-b', sha256)).hash);
  });

  it('верный PIN проходит, неверный — нет', async () => {
    const rec = await hashPin('482719', 'salt-a', sha256);
    expect([await verifyPin('482719', rec, sha256), await verifyPin('482718', rec, sha256)]).toEqual([true, false]);
  });
});

describe('раскладка', () => {
  it('все десять цифр, каждая один раз', () => {
    const keys = shuffledKeypad(cycle(0.3, 0.7, 0.1, 0.9));
    expect([...keys].sort()).toEqual(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
  });

  it('не повторяет прошлую раскладку — позиции не запомнить', () => {
    const first = shuffledKeypad(cycle(0.5));
    // тот же генератор дал бы ту же перестановку
    expect(shuffledKeypad(cycle(0.5), first)).not.toEqual(first);
  });

  it('сломанный генератор всё равно не повторяет раскладку', () => {
    const first = shuffledKeypad(cycle(0.99));
    expect(shuffledKeypad(cycle(0.99), first)).not.toEqual(first);
  });
});

describe('лимит попыток', () => {
  const failTimes = (s: LockoutState, n: number, now: number) => {
    let x = s;
    for (let i = 0; i < n; i += 1) x = registerFailure(x, now);
    return x;
  };

  it('четыре ошибки — ещё можно, пятая — блокировка на минуту', () => {
    const four = failTimes(NO_LOCKOUT, 4, 0);
    expect(isLocked(four, 0)).toBe(false);
    const five = registerFailure(four, 0);
    expect({ заперт: isLocked(five, 1), до: five.lockedUntil }).toEqual({ заперт: true, до: LOCKOUT_STEPS_MS[0] });
  });

  it('блокировки нарастают: 1 → 5 → 15 минут, дальше 15', () => {
    let s = NO_LOCKOUT;
    let t = 0;
    const durations: number[] = [];
    for (let k = 0; k < 4; k += 1) {
      s = failTimes(s, 5, t);
      durations.push((s.lockedUntil as number) - t);
      t = s.lockedUntil as number;
    }
    expect(durations).toEqual([60_000, 300_000, 900_000, 900_000]);
  });

  it('во время блокировки ошибки не копятся', () => {
    const locked = failTimes(NO_LOCKOUT, 5, 0);
    expect(registerFailure(locked, 10)).toEqual(locked);
  });

  it('верный PIN сбрасывает всё', () => {
    expect(registerSuccess()).toEqual(NO_LOCKOUT);
  });
});

describe('сессия раздела', () => {
  it('закрывается сама через две минуты без касаний', () => {
    const s = openSession(0);
    expect([isOpen(s, IDLE_CLOSE_MS - 1), isOpen(s, IDLE_CLOSE_MS)]).toEqual([true, false]);
  });

  it('касание продлевает, закрытую не воскрешает', () => {
    const s = touch(openSession(0), 60_000);
    expect(isOpen(s, 60_000 + IDLE_CLOSE_MS - 1)).toBe(true);
    expect(touch(openSession(0), IDLE_CLOSE_MS + 1)).toBeNull();
  });

  it('уход в фон закрывает сразу', () => {
    expect(isOpen(onBackground(), 0)).toBe(false);
  });
});

describe('повторное подтверждение', () => {
  it('необратимое — только в пять минут после подтверждения, даже если раздел открыт', () => {
    let s = openSession(0);
    // родитель работает в разделе шесть минут подряд: раздел открыт, подтверждение устарело
    for (let t = 60_000; t <= 6 * 60_000; t += 60_000) s = touch(s, t)!;
    expect(isOpen(s, 6 * 60_000)).toBe(true);
    expect(canPerform('delete_child', s, 6 * 60_000)).toBe(false);
    s = reconfirm(s, 6 * 60_000)!;
    expect(canPerform('delete_child', s, 6 * 60_000 + 1)).toBe(true);
  });

  it('окно свежести — пять минут от подтверждения', () => {
    let s = openSession(0);
    for (let t = 60_000; t <= FRESH_CONFIRM_MS; t += 60_000) s = touch(s, t)!;
    expect(canPerform('change_band', s, FRESH_CONFIRM_MS)).toBe(true);
    s = touch(s, FRESH_CONFIRM_MS + 1)!;
    expect(canPerform('change_band', s, FRESH_CONFIRM_MS + 1)).toBe(false);
  });

  it('в свежем окне — можно', () => {
    const s = openSession(0);
    expect(canPerform('revoke_consent', s, 60_000)).toBe(true);
  });

  it('удаление аккаунта гейтом не подтверждается — только кодом из письма на сервере', () => {
    expect(canPerform('delete_account', openSession(0), 1)).toBe(false);
  });

  it('в закрытом разделе ничего нельзя', () => {
    expect(canPerform('change_band', null, 0)).toBe(false);
  });
});

describe('порог намерения', () => {
  it('двузначное на двузначное без круглых — выше полосы 9–10', () => {
    for (const v of [0, 0.2, 0.41, 0.99]) {
      const c = intentChallenge(cycle(v, 0.5));
      expect(c.a).toBeGreaterThanOrEqual(13);
      expect(c.a % 10).not.toBe(0);
      expect(c.answer).toBe(c.a * c.b);
    }
  });

  it('ответ проверяется строго', () => {
    const c = { a: 17, b: 23, answer: 391 };
    expect([checkIntent(c, '391'), checkIntent(c, ' 391 '), checkIntent(c, '390'), checkIntent(c, '391abc')]).toEqual([
      true,
      true,
      false,
      false,
    ]);
  });
});

describe('web', () => {
  it('раздел, который нельзя защитить, не показывается', () => {
    expect([gateAvailable('ios'), gateAvailable('android'), gateAvailable('web')]).toEqual([true, true, false]);
  });
});
