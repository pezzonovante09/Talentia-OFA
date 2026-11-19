/**
 * Токены раскладки экранов среза (SCREENS.md 8; docs/design/slice-screens-2026-10-24.md). Экраны не
 * прокручиваются, поэтому бюджеты высот — часть спецификации: на SE 375×667 (safe area 20) всё должно
 * помещаться, включая единственную кнопку пути ребёнка.
 */
import { contrast, SHAPE_CONTRAST, TEXT_CONTRAST } from '../contrast';
import {
  atlasGrid,
  atlasPage,
  atlasPageHeight,
  badge,
  basketArt,
  exitLayer,
  firstRun,
  firstRunHeight,
  HINT_MAX_LINES,
  HINT_MIN_LINE_HEIGHT,
  HINT_MIN_SIZE,
  icon,
  lessonFixedHeight,
  lessonFontCaps,
  lessonLayout,
  lessonTiming,
  mapLane,
  mapLayout,
  mapNodeState,
  palettes,
  profileCard,
  PROMPT_MAX_LINES,
  PROMPT_MIN_LINE_HEIGHT,
  PROMPT_MIN_SIZE,
  taliCrop,
  taliSize,
  touch,
  typography,
} from '../tokens';

const SE = { height: 667, safeTop: 20, width: 375 };
const W = SE.width - 32;

describe('каркас урока (lessonLayout)', () => {
  it('высоты слотов и зазоры — по SCREENS.md 1.1, кратны 4', () => {
    expect([lessonLayout.topBar, lessonLayout.prompt, lessonLayout.bubble, lessonLayout.actionBar]).toEqual([64, 72, 80, 88]);
    expect(lessonLayout.tali).toBe(taliCrop.slot);
    Object.values(lessonLayout).forEach((v) => expect(v % 4).toBe(0));
  });

  it('фиксированная часть 356 оставляет на SE зону задания X = 275 ≥ двум рядам плиток 72 + зазор', () => {
    expect(lessonFixedHeight()).toBe(356);
    const x = SE.height - SE.safeTop - lessonFixedHeight() - 16;
    expect(x).toBe(275);
    expect(x).toBeGreaterThanOrEqual(touch.comfortable * 2 + touch.gap);
  });

  it('вопрос и реплика в запасном виде помещаются в свои слоты только при множителе 1', () => {
    expect(PROMPT_MIN_SIZE * PROMPT_MAX_LINES).toBeLessThanOrEqual(lessonLayout.prompt);
    expect(PROMPT_MIN_LINE_HEIGHT * PROMPT_MAX_LINES * lessonFontCaps.promptFallback).toBe(lessonLayout.prompt);
    expect(PROMPT_MIN_LINE_HEIGHT * PROMPT_MAX_LINES * lessonFontCaps.prompt).toBeGreaterThan(lessonLayout.prompt);
    expect(HINT_MIN_SIZE).toBeLessThan(PROMPT_MIN_SIZE);
    expect(HINT_MIN_LINE_HEIGHT * HINT_MAX_LINES * lessonFontCaps.bubble).toBeLessThanOrEqual(lessonLayout.bubble - 12);
  });

  it('значки: статус 32 над плиткой, остальные 24; вынос 8 — сетка 4', () => {
    expect(badge.status).toBe(icon.size);
    expect([badge.pairShape, badge.pin, badge.socket, badge.mini]).toEqual([24, 24, 24, 24]);
    expect(badge.outset % 4).toBe(0);
    expect(icon.badge).toBe(badge.pin);
  });
});

describe('первый запуск', () => {
  it('входит в SE без прокрутки: 616 ≤ 667 (было 656; карточка «+» 120 ниже кнопки ребёнка)', () => {
    expect(firstRunHeight(SE.safeTop)).toBe(616);
    expect(firstRunHeight(SE.safeTop)).toBeLessThanOrEqual(SE.height);
  });

  it('кнопка без записи — единственная primary 88, вход для взрослых 48 ≥ 44 с замком 24', () => {
    expect(firstRun.noSavePrimary).toBe(true);
    expect(touch.primary).toBe(88);
    expect(firstRun.adultEntryHit).toBeGreaterThanOrEqual(44);
    expect(firstRun.adultEntryHit).toBeLessThan(touch.min);
    expect(firstRun.adultIcon).toBe(icon.badge);
    expect(firstRun.childActionFirst).toBe(true);
    expect(firstRun.adultSecondTapMs).toBeGreaterThanOrEqual(2000);
  });

  it('карточка «+» 120 — меньше детской 160, с замком 24 в углу; оба размера ≥ touch.min', () => {
    expect(profileCard.addSize).toBeLessThan(profileCard.size);
    expect(profileCard.addSize).toBeGreaterThanOrEqual(touch.min);
    expect(profileCard.addBadge).toBe(icon.badge);
    expect(profileCard.addBadgeInset + profileCard.addBadge).toBeLessThan(profileCard.addSize / 2);
    expect(profileCard.addRowAlign).toBe('bottom');
  });

  it('карточка профиля 160 с аватаром 88 и местом под имя входит в W с зазором; Tali hero 120 — не крупнее карточки', () => {
    expect(profileCard.size + profileCard.gap + profileCard.size).toBeLessThanOrEqual(W);
    expect(profileCard.avatar + profileCard.nameSlot).toBeLessThan(profileCard.size);
    expect(taliSize.hero).toBeLessThan(profileCard.size);
    expect(taliSize.crop).toBe(taliCrop.slot);
  });
});

describe('карта', () => {
  it('на 5–6 видны доступный узел и два замка; остальное — пунктир без плиты', () => {
    expect(mapNodeState.visibleAhead).toBe(2);
    expect(mapNodeState.explored).toBe(touch.min);
    expect(mapNodeState.iconSize).toBe(icon.size);
  });

  it('Tali 96, зазор 16 и узел 72 умещаются в W; защита открытия = nextGuard; порог панорамирования 12', () => {
    expect(taliSize.map + mapLane.taliNodeGap + mapLayout.node).toBeLessThanOrEqual(W);
    expect(mapLane.taliNodeGap).toBe(touch.gap);
    expect(mapLane.openGuardMs).toBe(lessonTiming.nextGuard);
    expect(mapLane.panThreshold).toBeGreaterThanOrEqual(12);
    expect(mapLane.centerOn).toBe('available');
  });
});

describe('страница атласа', () => {
  it('входит в SE без прокрутки: 654 ≤ 667 (было 646; плашка 64 и печать 48)', () => {
    expect(atlasPageHeight(SE.safeTop)).toBe(654);
    expect(atlasPageHeight(SE.safeTop)).toBeLessThanOrEqual(SE.height);
  });

  it('слоты ленты ≥ touch.min и не равны узлу карты; 3 слота 212 < W, хвост ≥ touch.min — живая зона до края', () => {
    expect(atlasPage.futureSlot).toBeGreaterThanOrEqual(touch.min);
    expect(atlasPage.futureSlot).not.toBe(mapLayout.node);
    expect(atlasPage.futureSlots).toBe(3);
    const slotsWidth = atlasPage.futureSlots * atlasPage.futureSlot + (atlasPage.futureSlots - 1) * touch.gap;
    expect(slotsWidth).toBe(212);
    expect(slotsWidth).toBeLessThan(W);
    expect(W - slotsWidth - touch.gap).toBeGreaterThanOrEqual(touch.min);
    expect(atlasPage.stamp).toBeLessThan(atlasPage.plate);
    expect(atlasPage.stampSound).toBe(true);
    expect(atlasPage.stampAfterMs).toBe(lessonTiming.modelStepMin);
    expect(atlasPage.stampMaxWaitMs).toBeGreaterThan(atlasPage.stampAfterMs);
  });

  it('коллекция: два столбца 164 с зазором 16 входят в экран SE; карточка ≥ touch.min; состав карточки = 216', () => {
    expect(atlasGrid.columns * atlasGrid.card.w + (atlasGrid.columns - 1) * atlasGrid.gap).toBeLessThanOrEqual(SE.width - 2 * 16 + 2);
    expect(atlasGrid.card.w).toBeGreaterThanOrEqual(touch.min);
    expect(12 + atlasGrid.frame + 8 + typography.label.lineHeight * atlasGrid.titleLines + 8 + atlasGrid.plate + 12).toBe(atlasGrid.card.h);
    expect(atlasGrid.stamp).toBe(icon.badge);
    expect(atlasGrid.gap).toBe(touch.gap);
    expect(atlasGrid.futureCards).toBe(1);
    expect(atlasGrid.columnsFocus).toBe(1);
  });

  it('вывод находки: резерв 3 строк body = 78', () => {
    expect(typography.body.lineHeight * atlasPage.findingLines).toBe(78);
  });
});

describe('корзинка для нуля — слой иллюстрации', () => {
  it('контур фигур на заливке корзинки держит ≥ 3:1, заливка не зависит от схемы', () => {
    expect(contrast(basketArt.outline, basketArt.fill)).toBeGreaterThanOrEqual(SHAPE_CONTRAST);
    expect(contrast(basketArt.outline, basketArt.fill)).toBeGreaterThanOrEqual(TEXT_CONTRAST);
    expect(basketArt.stroke).toBe('base');
    expect(basketArt.padInStimulus).toBe(16);
  });

  it('причина фиксации: на surfaceAlt тёмной схемы тот же контур не прошёл бы и 3:1', () => {
    expect(contrast(basketArt.outline, palettes.dark.normal.surfaceAlt)).toBeLessThan(SHAPE_CONTRAST);
  });
});

describe('слой выхода', () => {
  it('отступ 48, зазоры 16/24, подпись о сохранении скрыта без аккаунта', () => {
    expect(exitLayer).toEqual({ topInset: 48, taliGap: 16, buttonGap: 24, progressNote: 'hide_when_no_account' });
  });
});
