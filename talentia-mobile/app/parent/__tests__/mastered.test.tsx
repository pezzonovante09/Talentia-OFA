/**
 * «Освоено» полностью (`app/parent/mastered.tsx`, «Показать все» на главной): все освоенные навыки
 * выбранного ребёнка с названием и регионом; навыки в работе и чужие — не здесь. База — in-memory.
 */
import MasteredScreen from '../mastered';
import { emptySkill } from '../../../src/domain/mastery';
import { memoryDb, writeLessonState } from '../../../src/services/local/__tests__/nodeSql';
import { newProfile } from '../../../src/services/local/profiles';
import type { SqlDb } from '../../../src/services/local/sql';
import { useAccount } from '../../../src/state/account';
import { useParentView } from '../../../src/state/parentView';
import { ParentThemeProvider } from '../../../src/ui/parent/theme';
import { fireEvent, renderWithProviders, screen, waitFor } from '../../../src/test/render';

jest.mock('expo-router', () => {
  const router = { replace: jest.fn(), push: jest.fn(), back: jest.fn(), dismissAll: jest.fn() };
  return { __router: router, useRouter: () => router, Redirect: () => null };
});
const router = (jest.requireMock('expo-router') as { __router: { back: jest.Mock } }).__router;

const KID1 = '00000000-0000-4000-8000-0000000000d7';
const KID2 = '00000000-0000-4000-8000-0000000000d8';
const p1 = newProfile({ childId: KID1, band: '5-6', interfaceLang: 'ru', createdAt: '2026-10-25T00:00:00.000Z', name: 'Айдар' });
const p2 = newProfile({ childId: KID2, band: '7', interfaceLang: 'ru', createdAt: '2026-10-25T00:00:00.000Z' });
const AT = '2026-10-24T10:00:00.000Z';
const mastered = (id: string) => ({ ...emptySkill(id), box: 4 as const, attempts: 5, correct: 5 });

let db: SqlDb;
const render = () => renderWithProviders(<ParentThemeProvider><MasteredScreen /></ParentThemeProvider>);

beforeEach(async () => {
  jest.clearAllMocks();
  db = await memoryDb();
  useParentView.setState({ childId: null });
  useAccount.setState({ status: 'ready', accountId: 'acc', db, profiles: [p1, p2], consent: 'granted' });
});

describe('«Освоено» полностью', () => {
  it('больше пяти освоенных — показаны все, с названием и регионом', async () => {
    const ids = ['subitize-1-3', 'count-to-5', 'count-to-10', 'numeral-1-5', 'a-skill', 'b-skill'];
    await writeLessonState(db, KID1, 'skills', ids.map(mastered), AT);
    await render();
    await waitFor(() => expect(screen.getByText('Считает до пяти')).toBeTruthy());
    // шесть строк: четыре из каталога (с регионом «Числа») и два id без записи в каталоге — как есть
    expect([screen.getAllByText('Числа').length, screen.queryAllByText(/^[ab]-skill$/).length]).toEqual([4, 2]);
  });

  it('навык в работе (не box 4) в списке не показан', async () => {
    await writeLessonState(db, KID1, 'skills', [mastered('count-to-5'), { ...emptySkill('count-to-10'), box: 2, attempts: 3, correct: 2 }], AT);
    await render();
    await waitFor(() => expect(screen.getByText('Считает до пяти')).toBeTruthy());
    expect(screen.getAllByText('Числа')).toHaveLength(1);
  });

  it('выбран второй ребёнок — его навыки, а не первого', async () => {
    await writeLessonState(db, KID1, 'skills', [mastered('count-to-5')], AT);
    await writeLessonState(db, KID2, 'skills', [mastered('b-skill')], AT);
    useParentView.setState({ childId: KID2 });
    await render();
    await waitFor(() => expect(screen.getByText('b-skill')).toBeTruthy());
    expect(screen.queryByText('Считает до пяти')).toBeNull();
  });

  it('«Назад» — назад', async () => {
    await render();
    await fireEvent.press(screen.getByRole('button', { name: 'Назад' }));
    expect(router.back).toHaveBeenCalled();
  });
});
