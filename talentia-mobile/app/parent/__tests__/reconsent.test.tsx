/**
 * Повторное согласие (`app/parent/reconsent.tsx`): при устаревшем тексте — только «Подтвердить»
 * и «Удалить аккаунт» (плюс политика). «Подтвердить» пишет новое согласие `account_local` в базу
 * настоящим `grantConsent` и уводит на главную родителя.
 */
import ReconsentScreen from '../reconsent';
import { memoryDb } from '../../../src/services/local/__tests__/nodeSql';
import { accountConsentStatus } from '../../../src/services/local/account';
import { appendConsentEvent, readConsentLog } from '../../../src/services/local/consentLog';
import type { SqlDb } from '../../../src/services/local/sql';
import { useAccount } from '../../../src/state/account';
import { ParentThemeProvider } from '../../../src/ui/parent/theme';
import { fireEvent, renderWithProviders, screen, waitFor } from '../../../src/test/render';

jest.mock('expo-router', () => {
  const router = { replace: jest.fn(), push: jest.fn(), back: jest.fn(), dismissAll: jest.fn() };
  return { __router: router, useRouter: () => router, Redirect: () => null };
});
const router = (jest.requireMock('expo-router') as { __router: { replace: jest.Mock; push: jest.Mock } }).__router;
// Отклонение из `onPress` экрана ушло бы необработанным, и jest засчитал бы его тесту в обход
// `it.failing`; кнопка-обёртка его гасит — в тесте видно только то, что видит родитель.
jest.mock('../../../src/ui/parent/primitives', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const actual = jest.requireActual<typeof import('../../../src/ui/parent/primitives')>('../../../src/ui/parent/primitives');
  return {
    ...actual,
    ParentButton: (props: Parameters<typeof actual.ParentButton>[0]) =>
      React.createElement(actual.ParentButton, { ...props, onPress: () => void Promise.resolve(props.onPress() as unknown).catch(() => undefined) }),
  };
});

const ACC = '0a1b2c3d-0000-4000-8000-0000000000e1';
const realGrant = useAccount.getState().grantConsent;
let db: SqlDb;

const render = () => renderWithProviders(<ParentThemeProvider><ReconsentScreen /></ParentThemeProvider>);
const grants = async () => (await readConsentLog(db)).filter((e) => e.scope === 'account_local' && e.action === 'grant');

beforeEach(async () => {
  jest.clearAllMocks();
  // согласие в базе — по версии текста, которой больше нет среди текущих
  db = await memoryDb(undefined, { account: false });
  await appendConsentEvent(db, { id: 'old-grant', scope: 'account_local', action: 'grant', childId: null, textVersion: 'ru-old-0', confirmedBy: 'pin', actorId: ACC, at: '2026-01-01T00:00:00.000Z' }, 'owner');
  if ((await accountConsentStatus(db)) !== 'outdated') throw new Error('подготовка: согласие должно быть устаревшим');
  useAccount.setState({ status: 'ready', accountId: ACC, db, profiles: [], consent: 'outdated', grantConsent: realGrant });
});

describe('повторное согласие', () => {
  it('заголовок «Текст согласия обновился», «Что изменилось» и текст согласия', async () => {
    await render();
    expect(screen.getByRole('header', { name: 'Текст согласия обновился' })).toBeTruthy();
    expect(screen.getByText('Что изменилось')).toBeTruthy();
    expect(screen.getByText(/Ничего не уходит в интернет/)).toBeTruthy();
  });

  it('«Подтвердить» — новое согласие в журнале, статус granted, переход на главную родителя', async () => {
    const before = (await grants()).length;
    await render();
    await fireEvent.press(screen.getByTestId('reconsent-confirm'));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/parent'));
    expect([(await grants()).length - before, useAccount.getState().consent]).toEqual([1, 'granted']);
  });

  it('«Удалить аккаунт» ведёт в confirm с action delete_account, согласие не пишется', async () => {
    const before = (await grants()).length;
    await render();
    await fireEvent.press(screen.getByTestId('reconsent-delete'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/parent/confirm/[action]', params: { action: 'delete_account' } });
    expect((await grants()).length).toBe(before);
  });

  it('«Политика конфиденциальности» открывает /parent/policy', async () => {
    await render();
    await fireEvent.press(screen.getByRole('button', { name: 'Политика конфиденциальности' }));
    expect(router.push).toHaveBeenCalledWith('/parent/policy');
  });

  /**
   * Регрессия (исправлено 2026-10-25): `onPress` «Подтвердить» — `try { … } finally { setBusy(false) }` без
   * `catch` (app/parent/reconsent.tsx:33–40). Сбой записи согласия уходит необработанным
   * отклонением: кнопка снова активна, родитель не видит, что ничего не произошло, и не понимает,
   * почему его снова возвращает на этот экран. На `setup.tsx` и `confirm/[action].tsx` тот же сбой
   * показывается текстом `parent.failed`.
   */
  it('сбой записи согласия — показана ошибка «Не получилось. Попробуйте ещё раз», перехода нет', async () => {
    useAccount.setState({ grantConsent: jest.fn(async () => Promise.reject(new Error('внедрённый сбой записи'))) });
    await render();
    await fireEvent.press(screen.getByTestId('reconsent-confirm'));
    await waitFor(() => expect(screen.getByText('Не получилось. Попробуйте ещё раз')).toBeTruthy());
    expect(router.replace).not.toHaveBeenCalled();
  });
});
