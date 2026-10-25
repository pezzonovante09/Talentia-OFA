/**
 * «Удалено» (`app/parent/done.tsx`) — после удаления аккаунта: обратно только к выбору профиля
 * (`replace('/')`, без «Назад» в стёртый аккаунт). Политика (`app/parent/policy.tsx`) — экраном
 * внутри приложения, «Назад» — назад.
 */
import DoneScreen from '../done';
import PolicyScreen from '../policy';
import { ParentThemeProvider } from '../../../src/ui/parent/theme';
import { fireEvent, renderWithProviders, screen } from '../../../src/test/render';

jest.mock('expo-router', () => {
  const router = { replace: jest.fn(), push: jest.fn(), back: jest.fn(), dismissAll: jest.fn() };
  return { __router: router, useRouter: () => router, Redirect: () => null };
});
const router = (jest.requireMock('expo-router') as { __router: { replace: jest.Mock; back: jest.Mock; push: jest.Mock } }).__router;

beforeEach(() => jest.clearAllMocks());

describe('«Удалено»', () => {
  const render = () => renderWithProviders(<ParentThemeProvider><DoneScreen /></ParentThemeProvider>);

  it('заголовок «Удалено» и «Данные на этом устройстве очищены»', async () => {
    await render();
    expect(screen.getByRole('header', { name: 'Удалено' })).toBeTruthy();
    expect(screen.getByText('Данные на этом устройстве очищены')).toBeTruthy();
  });

  it('«К выбору профиля» заменяет стек первым запуском, а не возвращает назад', async () => {
    await render();
    await fireEvent.press(screen.getByTestId('deleted-to-profiles'));
    expect([router.replace.mock.calls, router.back.mock.calls.length, router.push.mock.calls.length]).toEqual([[['/']], 0, 0]);
  });

  it('кнопки «Назад» нет: вернуться в удалённый аккаунт нельзя', async () => {
    await render();
    expect(screen.queryByRole('button', { name: 'Назад' })).toBeNull();
  });
});

describe('политика конфиденциальности', () => {
  const render = () => renderWithProviders(<ParentThemeProvider><PolicyScreen /></ParentThemeProvider>);

  it('заголовок и текст политики на экране', async () => {
    await render();
    expect(screen.getByText('Политика конфиденциальности')).toBeTruthy();
    expect(screen.getByText(/В интернет ничего не отправляется/)).toBeTruthy();
  });

  it('«Назад» — назад', async () => {
    await render();
    await fireEvent.press(screen.getByTestId('policy-back'));
    expect(router.back).toHaveBeenCalledTimes(1);
  });
});
