/**
 * Каталог подкрепителей для сервисов ABA: пары, которые не ставятся в одну тройку выбора (`apartFrom` каталога,
 * `song` и `sing_together` — один подкрепитель двумя способами). Домен контент не читает — пары приходят во входе
 * (`reinforcerApart`, `apart`; №164).
 */
import { REINFORCERS } from '../../content/aba/reinforcers';
import { apartPairs } from '../../domain/abaReinforcerCatalog';

export const REINFORCER_APART: readonly [string, string][] = apartPairs(REINFORCERS);
