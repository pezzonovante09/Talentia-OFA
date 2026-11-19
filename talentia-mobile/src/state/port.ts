/**
 * Текущий порт прогресса приложения. В срезе — без записи (`noRecordPort`); с аккаунтом на
 * устройстве (`useAccount.boot`, этап 10) сюда ставится `sqlitePort(db)`. Экраны берут порт отсюда,
 * тесты подменяют `setProgressPort`.
 */
import { noRecordPort, type ProgressPort } from '../services/progressPort';

let current: ProgressPort = noRecordPort;

export const progressPort = (): ProgressPort => current;
export function setProgressPort(port: ProgressPort): void {
  current = port;
}
