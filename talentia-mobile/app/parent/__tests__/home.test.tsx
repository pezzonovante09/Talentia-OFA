/**
 * Главный экран родителя (`app/parent/index.tsx`): редиректы без профилей и при устаревшем согласии;
 * с профилем — имя, «За неделю», «Освоено», «Даётся тяжело» из локальной базы; сегменты при двух
 * детях; строки настроек, данных и «Занятий ABA» ведут в свои роуты.
 */
import ParentHome from '../index';
import { emptySkill } from '../../../src/domain/mastery';
import { memoryDb, writeLessonRun, writeLessonState } from '../../../src/services/local/__tests__/nodeSql';
import { newProfile } from '../../../src/services/local/profiles';
import type { SqlDb } from '../../../src/services/local/sql';
import { useAccount } from '../../../src/state/account';
import { useChildSession } from '../../../src/state/childSession';
import { useParentView } from '../../../src/state/parentView';
import { ParentThemeProvider } from '../../../src/ui/parent/theme';
import { fireEvent, renderWithProviders, screen, waitFor, within } from '../../../src/test/render';

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  const router = { replace: jest.fn(), push: jest.fn(), back: jest.fn(), dismissAll: jest.fn() };
  return {
    __router: router,
    useRouter: () => router,
    Redirect: ({ href }: { href: string }) => React.createElement(Text, { testID: 'redirect' }, href),
  };
});
const router = (jest.requireMock('expo-router') as { __router: { push: jest.Mock; dismissAll: jest.Mock } }).__router;

const KID1 = '00000000-0000-4000-8000-0000000000c1';
const KID2 = '00000000-0000-4000-8000-0000000000c2';
const p1 = newProfile({ childId: KID1, band: '5-6', interfaceLang: 'ru', createdAt: '2026-10-25T00:00:00.000Z', name: 'Айдар' });
const p2 = newProfile({ childId: KID2, band: '8', interfaceLang: 'ru', createdAt: '2026-10-25T00:00:00.000Z' });

const hourAgo = () => new Date(Date.now() - 3_600_000).toISOString();
const tenDaysAgo = () => new Date(Date.now() - 10 * 86_400_000).toISOString();

let db: SqlDb;
const render = () => renderWithProviders(<ParentThemeProvider><ParentHome /></ParentThemeProvider>);

beforeEach(async () => {
  jest.clearAllMocks();
  db = await memoryDb();
  useParentView.setState({ childId: null });
  useChildSession.getState().reset();
  useAccount.setState({ status: 'ready', accountId: 'acc', db, profiles: [p1], consent: 'granted' });
});

describe('редиректы', () => {
  it('нет профилей → новый профиль', async () => {
    useAccount.setState({ profiles: [] });
    await render();
    expect(screen.getByTestId('redirect').props.children).toBe('/parent/profile/new');
  });

  it('устаревший текст согласия → повторное согласие, даже если профили есть', async () => {
    useAccount.setState({ consent: 'outdated' });
    await render();
    expect(screen.getByTestId('redirect').props.children).toBe('/parent/reconsent');
  });
});

describe('с профилем', () => {
  it('без прохождений: имя, «Ещё не занимались», нули недели, пустые «Освоено» и «Даётся тяжело»', async () => {
    await render();
    expect(screen.getByTestId('home-name').props.children).toBe('Айдар');
    expect(screen.getByTestId('home-last').props.children).toBe('Ещё не занимались');
    await waitFor(() => expect(screen.getByText('Пока ничего — после первого урока здесь появятся темы')).toBeTruthy());
    expect(screen.getByTestId('hard-empty').props.children).toBe('Сейчас ничего не застряло');
    expect(screen.getByTestId('week-n-0').props.children).toBe('0');
    expect(screen.getByTestId('week-n-2').props.children).toBe('0');
    expect(screen.queryByTestId('child-segments')).toBeNull();
  });

  it('с прохождениями и навыками: «сегодня», неделя, освоенный навык с регионом, трудный с попытками', async () => {
    await writeLessonRun(db, { id: 'r1', childId: KID1, lessonId: 'l1', startedAt: hourAgo(), taskSeconds: [60, 60, 60], reviewTasks: 2 });
    await writeLessonRun(db, { id: 'r2', childId: KID1, lessonId: 'l1', startedAt: tenDaysAgo(), taskSeconds: [60], reviewTasks: 0 });
    // чужой ребёнок — в отчёт не попадает
    await writeLessonRun(db, { id: 'r3', childId: KID2, lessonId: 'l1', startedAt: hourAgo(), taskSeconds: [600], reviewTasks: 5 });
    await writeLessonState(db, KID1, 'skills', [
      { ...emptySkill('count-to-5'), box: 4, attempts: 8, correct: 8 },
      { ...emptySkill('subitize-1-3'), box: 1, attempts: 4, correct: 1 },
      { ...emptySkill('count-to-10'), box: 2, attempts: 1, correct: 0 },
    ], hourAgo());

    await render();

    await waitFor(() => expect(screen.getByTestId('home-last').props.children).toBe('Последний раз — сегодня'));
    expect(screen.getByTestId('week-n-0').props.children).toBe('1'); // дней из 7
    expect(screen.getByTestId('week-n-1').props.children).toBe('3'); // минут
    expect(screen.getByTestId('week-n-2').props.children).toBe('1'); // уроков
    expect(screen.getByTestId('week-n-3').props.children).toBe('2'); // повторений
    expect(screen.getAllByTestId('week-strip-on')).toHaveLength(1);

    expect(screen.getByTestId('mastered-count-to-5')).toBeTruthy();
    expect(screen.getByText('Считает до пяти')).toBeTruthy();
    expect(screen.getByText('Числа')).toBeTruthy();
    expect(screen.queryByTestId('mastered-all')).toBeNull();

    expect(screen.getByTestId('hard-subitize-1-3')).toBeTruthy();
    expect(screen.getByText('4 попыток, 1 верных')).toBeTruthy();
    expect(screen.queryByTestId('hard-empty')).toBeNull();
    // навык с одной попыткой — не трудный, а «в работе»
    expect(screen.queryByTestId('hard-count-to-10')).toBeNull();
    expect(within(screen.getByTestId('card-progress')).getByText('1')).toBeTruthy();
  });

  it('больше пяти освоенных: показаны пять и ссылка «Показать все (6)» ведёт в список', async () => {
    const ids = ['subitize-1-3', 'count-to-5', 'count-to-10', 'numeral-1-5', 'a-skill', 'b-skill'];
    await writeLessonState(db, KID1, 'skills', ids.map((id) => ({ ...emptySkill(id), box: 4 as const, attempts: 5, correct: 5 })), hourAgo());
    await render();
    await waitFor(() => expect(screen.getByTestId('mastered-all')).toBeTruthy());
    expect(screen.getAllByTestId(/^mastered-(?!all$)/)).toHaveLength(5);
    await fireEvent.press(screen.getByTestId('mastered-all'));
    expect(router.push).toHaveBeenCalledWith('/parent/mastered');
  });

  it('двое детей: сегменты, безымянный — «Профиль 2», переключение меняет имя и отчёт', async () => {
    useAccount.setState({ profiles: [p1, p2] });
    await writeLessonRun(db, { id: 'r1', childId: KID2, lessonId: 'l1', startedAt: hourAgo(), taskSeconds: [60], reviewTasks: 0 });
    await render();
    expect(screen.getByTestId('child-segments')).toBeTruthy();
    expect(screen.getByTestId('home-name').props.children).toBe('Айдар');
    await waitFor(() => expect(screen.getByTestId('home-last').props.children).toBe('Ещё не занимались'));
    await fireEvent.press(screen.getByTestId(`child-segments-${KID2}`));
    expect(useParentView.getState().childId).toBe(KID2);
    expect(screen.getByTestId('home-name').props.children).toBe('Профиль 2');
    await waitFor(() => expect(screen.getByTestId('home-last').props.children).toBe('Последний раз — сегодня'));
  });

  it('выбранный ранее ребёнок, которого больше нет, — показывается первый', async () => {
    useParentView.setState({ childId: 'gone' });
    await render();
    expect(screen.getByTestId('home-name').props.children).toBe('Айдар');
  });

  it('строки и кнопки ведут в свои роуты; «Готово» закрывает раздел', async () => {
    await render();
    await fireEvent.press(screen.getByTestId('row-settings'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/parent/profile/[childId]', params: { childId: KID1 } });
    await fireEvent.press(screen.getByTestId('row-consents'));
    expect(router.push).toHaveBeenCalledWith('/parent/consents');
    await fireEvent.press(screen.getByTestId('row-data'));
    expect(router.push).toHaveBeenCalledWith('/parent/data');
    await fireEvent.press(screen.getByTestId('home-add-child'));
    expect(router.push).toHaveBeenCalledWith('/parent/profile/new');
    await fireEvent.press(screen.getByTestId('parent-done'));
    expect(router.dismissAll).toHaveBeenCalled();
  });

  it('карточка «Занятия ABA»: строка «Пошаговая практика со взрослым» ведёт в /parent/aba', async () => {
    await render();
    expect(within(screen.getByTestId('card-aba')).getByText('Занятия ABA')).toBeTruthy();
    expect(screen.getByTestId('row-aba').props.accessibilityLabel).toBe('Пошаговая практика со взрослым');
    await fireEvent.press(screen.getByTestId('row-aba'));
    expect(router.push).toHaveBeenCalledWith('/parent/aba');
  });

  it('строка настроек показывает полосу ребёнка с длинным тире', async () => {
    await render();
    expect(screen.getByText('5–6')).toBeTruthy();
  });
});

describe('«Даётся тяжело»: совет по навыку (разбор 2026-10-31, вопрос 57)', () => {
  it('у трудного навыка строка hard-<skill>-tip — совет из content.skillTips.<skill>, а не общий hardAdvice', async () => {
    await writeLessonState(db, KID1, 'skills', [{ ...emptySkill('subitize-1-3'), box: 1, attempts: 4, correct: 1 }], hourAgo());
    await render();
    await waitFor(() => expect(screen.getByTestId('hard-subitize-1-3')).toBeTruthy());
    expect(screen.getByTestId('hard-subitize-1-3-tip').props.children).toBe('Дома: покажите 2–3 предмета — сколько, не считая?');
    expect(screen.queryByText('Дома: посчитайте вместе что-нибудь настоящее — ложки, ступеньки, пуговицы.')).toBeNull();
  });

  it('у каждого трудного навыка — свой совет', async () => {
    await writeLessonState(db, KID1, 'skills', [
      { ...emptySkill('subitize-1-3'), box: 1, attempts: 4, correct: 1 },
      { ...emptySkill('zero'), box: 1, attempts: 3, correct: 0 },
    ], hourAgo());
    await render();
    await waitFor(() => expect(screen.getByTestId('hard-zero-tip')).toBeTruthy());
    expect(screen.getByTestId('hard-zero-tip').props.children).toBe('Дома: тарелка пуста — спросите «сколько?». Это ноль.');
    expect(screen.getByTestId('hard-subitize-1-3-tip').props.children).toBe('Дома: покажите 2–3 предмета — сколько, не считая?');
  });

  it('безошибочный первый урок (4 из 4 верных, коробка 2) трудностью не считается — блок пуст', async () => {
    await writeLessonState(db, KID1, 'skills', [{ ...emptySkill('count-to-5'), box: 2, attempts: 4, correct: 4 }], hourAgo());
    await render();
    await waitFor(() => expect(screen.getByTestId('hard-empty').props.children).toBe('Сейчас ничего не застряло'));
    expect(screen.queryByTestId('hard-count-to-5')).toBeNull();
    // и он же — «в работе»
    expect(within(screen.getByTestId('card-progress')).getByText('1')).toBeTruthy();
  });

  it('коробка 2 с пятью попытками и верных меньше половины — в блоке, с советом навыка', async () => {
    await writeLessonState(db, KID1, 'skills', [{ ...emptySkill('count-to-5'), box: 2, attempts: 5, correct: 2 }], hourAgo());
    await render();
    await waitFor(() => expect(screen.getByTestId('hard-count-to-5')).toBeTruthy());
    expect(screen.getByTestId('hard-count-to-5-tip').props.children).toBe('Дома: считайте вслух до 5 — ступеньки, ложки, пальцы.');
  });
});

/** Контрольный аудит 2026-11-09, UX п. 13 (B6): итог урока не записался — взрослый видит карточку. */
describe('сбой записи итога', () => {
  it('lastWriteError есть → карточка card-write-failed с заголовком и текстом', async () => {
    useChildSession.setState({ lastWriteError: 'disk I/O error' });
    await render();
    const card = screen.getByTestId('card-write-failed');
    expect(within(card).getByText('Итог урока не записался')).toBeTruthy();
    expect(within(card).getByText(/сохранить его на устройстве не удалось/)).toBeTruthy();
  });

  it('сырой текст ошибки базы взрослому не показывается', async () => {
    useChildSession.setState({ lastWriteError: 'disk I/O error' });
    await render();
    expect(screen.queryByText(/disk I\/O error/)).toBeNull();
  });

  it('карточка сбоя стоит выше имени ребёнка', async () => {
    useChildSession.setState({ lastWriteError: 'x' });
    await render();
    const order = screen.getAllByTestId(/^(card-write-failed|home-name)$/).map((el) => el.props.testID);
    expect(order).toEqual(['card-write-failed', 'home-name']);
  });

  it('lastWriteError нет → карточки нет', async () => {
    await render();
    expect(screen.queryByTestId('card-write-failed')).toBeNull();
  });
});
