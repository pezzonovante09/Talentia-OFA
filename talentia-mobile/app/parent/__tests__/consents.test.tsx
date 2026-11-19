/**
 * Согласия (`app/parent/consents.tsx`): одна область — хранение на устройстве; статус словом;
 * дата и версия последнего принятого текста из журнала; при устаревшем тексте — «Прочитать и
 * подтвердить»; «Отозвать и удалить аккаунт» ведёт в удаление аккаунта. База — in-memory SQLite.
 */
import ConsentsScreen from '../consents';
import { appendConsentEvent } from '../../../src/services/local/consentLog';
import { memoryDb, TEST_ACCOUNT_CONSENT } from '../../../src/services/local/__tests__/nodeSql';
import type { SqlDb } from '../../../src/services/local/sql';
import { useAccount } from '../../../src/state/account';
import { ParentThemeProvider } from '../../../src/ui/parent/theme';
import { fireEvent, renderWithProviders, screen, waitFor } from '../../../src/test/render';

jest.mock('expo-router', () => {
  const router = { replace: jest.fn(), push: jest.fn(), back: jest.fn(), dismissAll: jest.fn() };
  return { __router: router, useRouter: () => router, Redirect: () => null };
});
const router = (jest.requireMock('expo-router') as { __router: { push: jest.Mock; back: jest.Mock } }).__router;

const ACC = '0a1b2c3d-0000-4000-8000-0000000000e2';
let db: SqlDb;
const ruDay = (iso: string) => new Date(iso).toLocaleDateString('ru-RU');
const render = () => renderWithProviders(<ParentThemeProvider><ConsentsScreen /></ParentThemeProvider>);

beforeEach(async () => {
  jest.clearAllMocks();
  db = await memoryDb();
  useAccount.setState({ status: 'ready', accountId: ACC, db, profiles: [], consent: 'granted' });
});

describe('согласия', () => {
  it('действует: область, «Действует», дата и версия принятого текста; кнопки повторного подтверждения нет', async () => {
    await render();
    expect(screen.getByText('Хранение на этом устройстве')).toBeTruthy();
    expect(screen.getByTestId('consent-status').props.children).toBe('Действует');
    await waitFor(() => expect(screen.getByText(`Принято ${ruDay(TEST_ACCOUNT_CONSENT.at)} · текст ${TEST_ACCOUNT_CONSENT.textVersion}`)).toBeTruthy());
    expect(screen.queryByTestId('consent-reconfirm')).toBeNull();
  });

  it('несколько согласий в журнале — показано последнее', async () => {
    await appendConsentEvent(db, { id: 'g2', scope: 'account_local', action: 'grant', childId: null, textVersion: 'ru-draft-1', confirmedBy: 'pin', actorId: ACC, at: '2026-06-15T10:00:00.000Z' }, 'owner');
    await render();
    await waitFor(() => expect(screen.getByText(`Принято ${ruDay('2026-06-15T10:00:00.000Z')} · текст ru-draft-1`)).toBeTruthy());
    expect(screen.queryByText(`Принято ${ruDay(TEST_ACCOUNT_CONSENT.at)} · текст ${TEST_ACCOUNT_CONSENT.textVersion}`)).toBeNull();
  });

  it('текст устарел: статус «Текст обновился — подтвердите заново», «Прочитать и подтвердить» ведёт в /parent/reconsent', async () => {
    useAccount.setState({ consent: 'outdated' });
    await render();
    expect(screen.getByTestId('consent-status').props.children).toBe('Текст обновился — подтвердите заново');
    await fireEvent.press(screen.getByTestId('consent-reconfirm'));
    expect(router.push).toHaveBeenCalledWith('/parent/reconsent');
  });

  it('«Отозвать и удалить аккаунт» ведёт в confirm с action delete_account; «Назад» — назад', async () => {
    await render();
    await fireEvent.press(screen.getByTestId('consent-revoke'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/parent/confirm/[action]', params: { action: 'delete_account' } });
    await fireEvent.press(screen.getByTestId('consents-back'));
    expect(router.back).toHaveBeenCalled();
  });
});
