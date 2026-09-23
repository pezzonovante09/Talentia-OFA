/**
 * Схема заданий. Спецификация — `FORMATS.md` в корне репозитория.
 *
 * Главное отличие от прежней схемы: формат описывает **действие**, а не подачу.
 * Раньше `multiple_choice` и `world_knowledge` были разными типами, хотя ребёнок
 * в обоих тыкает в один вариант из нескольких — отличались они лишь тем, что в
 * одном варианты текстом, а в другом картинкой. Из-за этого, чтобы добавить
 * картиночный вопрос, автору приходилось заводить новый формат вместо флага, и
 * из двенадцати типов наполнили два.
 */

export type AgeBand = '5-6' | '7' | '8' | '9-10';

/**
 * Как показаны элементы задания.
 *
 * До 7 лет допустима только `picture`, и каждый элемент обязан быть озвучен:
 * нечитающий ребёнок не «хуже справится» с текстовым интерфейсом — для него
 * такого интерфейса не существует. Ограничение лежит на подаче, а не на
 * действии: сами действия малышу доступны почти все.
 */
export type Presentation = 'picture' | 'text';

/** Элемент, который ребёнок видит: подпись, картинка, озвучка. */
export type Media = {
  /** Ключ локали с подписью. */
  labelKey: string;
  /**
   * Имя фигуры, которую рисует вектором `<CountableShape>`, либо имя файла в
   * `assets/images/items`. Для заданий на счёт хватает фигур: рисовать камень
   * кружком дешевле, чем заводить картинку, и стиль совпадает гарантированно.
   */
  shape?: 'stone' | 'berry' | 'leaf' | 'dot';
  image?: string;
  /** Сколько фигур нарисовать. Только вместе с `shape`. */
  count?: number;
  /** Ключ озвучки. Обязателен на полосе 5-6. */
  audioKey?: string;
};

type BaseTask = {
  id: string;
  /** Ключ вопроса. На полосе 5-6 он звучит голосом, а не читается. */
  promptKey: string;
  promptAudioKey?: string;
  /** Подсказка после первой ошибки: ошибка обязана давать следующий шаг. */
  hintKey?: string;
  /**
   * То, о чём спрашивают: группа предметов, картинка, слово. В задании
   * «сколько их?» без этого поля нечего считать.
   */
  stimulus?: Media;
};

/** Выбрать один из 2–4 вариантов. Узнавание. С 4 лет. */
export type ChooseTask = BaseTask & {
  format: 'choose';
  presentation: Presentation;
  options: Array<Media & { id: string; correct: boolean }>;
};

/**
 * Показать место на картинке. Пространственное мышление. С 4 лет.
 *
 * Зоны заданы долями кадра, а не пикселями: сцена растягивается под ширину
 * экрана, и пиксельные координаты разъехались бы на первом же другом телефоне.
 */
export type PointTask = BaseTask & {
  format: 'point';
  scene: string;
  targets: Array<{
    id: string;
    x: number;
    y: number;
    /** Радиус в долях ширины кадра. Не меньше 0.1 — палец ребёнка крупный. */
    r: number;
    correct: boolean;
    labelKey?: string;
  }>;
};

/** Соединить пары. Связь между понятиями. С 5 лет. Тап по одному, тап по второму. */
export type MatchTask = BaseTask & {
  format: 'match';
  presentation: Presentation;
  pairs: Array<{ id: string; left: Media; right: Media }>;
};

/** Разложить по порядку. Последовательность. С 5 лет. */
export type OrderTask = BaseTask & {
  format: 'order';
  presentation: Presentation;
  /** `position` — верный порядок, от нуля. Порядок показа перемешивается. */
  items: Array<Media & { id: string; position: number }>;
};

/** Разложить по группам. Классификация. С 6 лет. */
export type GroupTask = BaseTask & {
  format: 'group';
  presentation: Presentation;
  groups: Array<{ id: string; labelKey: string; shape?: Media['shape']; image?: string }>;
  items: Array<Media & { id: string; groupId: string }>;
};

/** Собрать ответ из фрагментов или ввести. Припоминание, а не узнавание. С 7 лет. */
export type BuildTask = BaseTask & {
  format: 'build';
  /** Готовые фрагменты для сборки; без них — ввод с клавиатуры. */
  fragments?: Array<{ id: string; labelKey: string }>;
  answer: string;
};

export type Task = ChooseTask | PointTask | MatchTask | OrderTask | GroupTask | BuildTask;
export type TaskFormat = Task['format'];

/** С какого возраста доступен формат. */
export const FORMAT_MIN_BAND: Record<TaskFormat, AgeBand> = {
  choose: '5-6',
  point: '5-6',
  match: '5-6',
  order: '5-6',
  group: '5-6',
  build: '7',
};

export type Lesson = {
  id: string;
  titleKey: string;
  band: AgeBand;
  /** Завязка: 10–20 секунд голосом. Поза Tali и его реплика. */
  hook: { taliPose: 'hello' | 'found' | 'point' | 'cheer' | 'puzzled' | 'write'; lineKey: string };
  tasks: Task[];
  /** Что вписывается в атлас по итогам урока. */
  atlasEntryKey: string;
};

export type Topic = { id: string; titleKey: string; lessons: Lesson[] };
export type Region = {
  id: 'numbers' | 'words' | 'nature' | 'workshop';
  titleKey: string;
  topics: Topic[];
};
