/**
 * Каталог подкрепителей ABA v1 (№149; состав — `aba-pedagogy-specialist` 2026-10-25, седьмая беззвучная —
 * `paint_drop`, владелец 2026-10-26). Сцены — `docs/design/aba-screens-2026-10-25.md` Ц2.9: каждая отвечает на
 * одиночный тап, кончается сама, работает офлайн. Нельзя: еда, внешние экраны, покупки, коллекции и наклейки,
 * разговор с Tali, физический контакт, свои названия и фото.
 */
import type { ReinforcerItem } from '../../types/aba';

/**
 * Награды, у которых есть настоящая сцена (правка 1, 2026-11-12): в выбор идут только они, как цели — только с
 * картинками. Пока готовых меньше `MIN_REINFORCER_POOL` после всех фильтров, выбор берёт весь каталог, как раньше
 * (`services/local/abaStart.ts`): иначе занятие не начнётся. С 2026-11-13 готовы 7: шесть беззвучных и «Поём вместе»;
 * барабан, ксилофон, песенка и пазл — партия 2.
 */
export const REWARD_SCENE_READY: ReadonlySet<string> = new Set(['bubbles', 'kaleidoscope', 'pinwheel', 'marble_run', 'tali_dance', 'paint_drop', 'sing_together']);

export const REINFORCERS: readonly ReinforcerItem[] = [
  { id: 'bubbles', labelKey: 'abaReinforcer.items.bubbles', sound: false, classes: ['bubble'] },
  { id: 'kaleidoscope', labelKey: 'abaReinforcer.items.kaleidoscope', sound: false, classes: ['pattern'] },
  { id: 'pinwheel', labelKey: 'abaReinforcer.items.pinwheel', sound: false, classes: ['pinwheel'] },
  // шарик — стеклянная капля, не мяч; ведёрко сцены убрано из стимулов `match`
  { id: 'marble_run', labelKey: 'abaReinforcer.items.marble_run', sound: false, classes: ['ball', 'bucket'] },
  { id: 'puzzle4', labelKey: 'abaReinforcer.items.puzzle4', sound: false, minAccessMs: 40_000, classes: ['puzzle'] },
  { id: 'tali_dance', labelKey: 'abaReinforcer.items.tali_dance', sound: false, classes: ['tali'] },
  { id: 'paint_drop', labelKey: 'abaReinforcer.items.paint_drop', sound: false, classes: ['paint'] },
  { id: 'drum', labelKey: 'abaReinforcer.items.drum', sound: true, classes: ['instrument'] },
  { id: 'xylophone', labelKey: 'abaReinforcer.items.xylophone', sound: true, classes: ['instrument'] },
  { id: 'song', labelKey: 'abaReinforcer.items.song', sound: true, classes: ['music'], apartFrom: ['sing_together'] },
  { id: 'sing_together', labelKey: 'abaReinforcer.items.sing_together', sound: false, configs: ['with_adult'], classes: ['music'] },
];
