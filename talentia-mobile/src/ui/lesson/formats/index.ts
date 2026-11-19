/** Таблица форматов среза (скилл `format-screen`, шаг 3). `point`, `group`, `build` — этапы 12 и 17. */
import type { TaskFormat } from '../../../types/task';
import { chooseSpec } from './ChooseTask';
import { matchSpec } from './MatchTask';
import { orderSpec } from './OrderTask';
import type { FormatSpec } from './types';

export const FORMATS: Partial<Record<TaskFormat, FormatSpec<any>>> = {
  choose: chooseSpec,
  match: matchSpec,
  order: orderSpec,
};

export const formatSupported = (format: TaskFormat): boolean => format in FORMATS;
