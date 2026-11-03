/**
 * Обмен без кнопки и ожидание цикла сопряжения (Ц3.2, Ц3.4; модель `model/exchangeRun.ts`): строка 72 · блок 272 по
 * центру — карточка 160 · 24 · ряд 88 (крупная доска или Tali 88 · 16 · ячейка 64). Одна раскладка у сопряжения,
 * обмена в сессии и хвоста конца — карточка на одном y на всех путях. Движение (въезд жетона, полёт в карточку,
 * раскрытие рамки в сцену) — только при `moving`; calm и reduce motion — смены кадра, их сроки ведёт модель.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Easing, Platform, View } from 'react-native';

import { abaBoardCell, abaExchange, abaPairingLayout, abaTokenBoard } from '../../../design/abaTokens';
import { radii } from '../../../design/tokens';
import { TaliFigure } from '../../TaliFigure';
import { exchangeView, type ExchangeRun } from '../model/exchangeRun';
import { NonTrialRow, PressOnly, useAbaColors } from '../parts';
import { PictureCard, ReinforcerArt, TokenCell } from '../reinforcer';

const NATIVE_DRIVER = Platform.OS !== 'web';
const BLOCK = abaExchange.cardSize + abaPairingLayout.gapCardRow + abaExchange.rowHeight;

type Rect = { x: number; y: number; w: number; h: number };

/** Карточка картинки, растущая в рамку сцены или сворачивающаяся в карточку (Ц3.4, Ц3.5): рамка и картинка в центре. */
export function GrowFrame({ from, to, ms, reinforcerId, testID }: { from: Rect; to: Rect; ms: number; reinforcerId: string; testID?: string }) {
  const c = useAbaColors();
  const p = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    // рамка — размер и место (layout), поэтому без нативного драйвера: один вид, 360 мс
    Animated.timing(p, { toValue: 1, duration: ms, useNativeDriver: false }).start();
  }, [p, ms]);
  const lerp = (a: number, b: number) => p.interpolate({ inputRange: [0, 1], outputRange: [a, b] });
  return (
    <Animated.View
      testID={testID}
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: lerp(from.x, to.x),
        top: lerp(from.y, to.y),
        width: lerp(from.w, to.w),
        height: lerp(from.h, to.h),
        borderRadius: radii.lg,
        borderWidth: abaTokenBoard.stroke,
        borderColor: c.plateOutline,
        backgroundColor: c.plate,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <ReinforcerArt id={reinforcerId} size={abaExchange.cardSize - 32} />
    </Animated.View>
  );
}

/** Жетон уходит из ячейки в центр карточки (`abaExchange.fly`) и пропадает, долетев. */
function FlyingToken({ from, to, size }: { from: { x: number; y: number }; to: { x: number; y: number }; size: number }) {
  const p = useRef(new Animated.Value(0)).current;
  const [gone, setGone] = useState(false);
  useEffect(() => {
    Animated.timing(p, { toValue: 1, duration: abaExchange.fly.ms, easing: Easing.in(Easing.quad), useNativeDriver: NATIVE_DRIVER }).start(() => setGone(true));
  }, [p]);
  if (gone) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: from.x - size / 2,
        top: from.y - size / 2,
        transform: [
          { translateX: p.interpolate({ inputRange: [0, 1], outputRange: [0, to.x - from.x] }) },
          { translateY: p.interpolate({ inputRange: [0, 1], outputRange: [0, to.y - from.y] }) },
          { scale: p.interpolate({ inputRange: [0, 1], outputRange: [1, abaExchange.fly.scaleTo] }) },
        ],
      }}
    >
      <TokenCell size={size} filled />
    </Animated.View>
  );
}

/** Жетон сопряжения въезжает в ячейку от Tali (`abaExchange.landMs`). */
function LandingToken({ size, fromDx }: { size: number; fromDx: number }) {
  const p = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(p, { toValue: 1, duration: abaExchange.landMs, useNativeDriver: NATIVE_DRIVER }).start();
  }, [p]);
  return (
    <Animated.View style={{ transform: [{ translateX: p.interpolate({ inputRange: [0, 1], outputRange: [fromDx, 0] }) }] }}>
      <TokenCell size={size} filled testID="aba-exchange-token-landing" />
    </Animated.View>
  );
}

/** Поле под строкой 72: отступы 16, размер для расчёта полёта и раскрытия. */
function useArea(fallbackWidth: number) {
  const [area, setArea] = useState<{ w: number; h: number } | null>(null);
  const onLayout = (e: { nativeEvent: { layout: { width: number; height: number } } }) => setArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  return { area, w: area?.w ?? fallbackWidth, onLayout };
}

/** Блок «карточка · 24 · ряд 88» по центру поля; `card: null` — слот карточки пуст (ожидание цикла, Ц3.2). */
function Block({ card, row }: { card: ReactNode | null; row: ReactNode }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: abaExchange.cardSize, height: abaExchange.cardSize, alignItems: 'center', justifyContent: 'center' }}>{card}</View>
      <View style={{ height: abaExchange.rowHeight, marginTop: abaPairingLayout.gapCardRow, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>{row}</View>
    </View>
  );
}

const exitLabels = (t: (k: string) => string) => ({ exitLabel: t('abaSession.exit'), exitHint: t('abaSession.exitHint') });

/**
 * Ожидание перед циклом сопряжения в конце (Ц3.2, №171): раскладка ожидания сопряжения с пустым слотом карточки —
 * Tali `idle`, пустая ячейка 64; статично. Карточка подкрепителя появится вместе с жетоном.
 */
export function PairingWaitView({ onExit }: { onExit?: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={{ flex: 1, paddingHorizontal: 16 }} testID="aba-end-wait">
      <NonTrialRow onExit={onExit} {...exitLabels(t)} />
      <View style={{ flex: 1, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' }}>
        <Block
          card={null}
          row={
            <>
              <PressOnly accessibilityLabel={t('abaSession.tali')}>
                <TaliFigure pose="idle" size={abaPairingLayout.tali} crop accessibilityLabel={t('abaSession.tali')} testID="aba-end-wait-tali" />
              </PressOnly>
              <View style={{ width: abaPairingLayout.gapTaliCell }} />
              <TokenCell size={abaPairingLayout.cell} filled={false} testID="aba-exchange-token-empty" />
            </>
          }
        />
      </View>
    </View>
  );
}

/**
 * Экран обмена (Ц3.4): `pairing` — ряд Tali и одна ячейка (сопряжение, цикл в конце), иначе крупная доска из
 * `run.cells`. Жетоны лежат до вылета; «получено» — контур карточки 6; на раскрытии ряд исчезает, рамка растёт в сцену.
 */
export function ExchangeView({
  run,
  at,
  reinforcerId,
  pairing,
  moving,
  onExit,
  testID,
}: {
  run: ExchangeRun;
  at: number;
  reinforcerId: string;
  pairing: boolean;
  moving: boolean;
  /** Без него место выхода в строке 72 пустое: на экране сессии выход один на все кадры (Ц4, огр. 9). */
  onExit?: () => void;
  testID: string;
}) {
  const { t } = useTranslation();
  const v = exchangeView(run, at);
  const { area, w, onLayout } = useArea(343);
  const h = area?.h ?? 0;
  const n = pairing ? 1 : run.cells;
  const cell = pairing ? abaPairingLayout.cell : abaBoardCell(w, n);
  const gap = pairing ? abaPairingLayout.gapTaliCell : abaTokenBoard.gap;
  // геометрия блока в поле (для полёта и раскрытия): карточка по центру, ряд на 24 ниже
  const top = (h - BLOCK) / 2;
  const card: Rect = { x: (w - abaExchange.cardSize) / 2, y: top, w: abaExchange.cardSize, h: abaExchange.cardSize };
  const rowY = top + abaExchange.cardSize + abaPairingLayout.gapCardRow + abaExchange.rowHeight / 2;
  const rowW = pairing ? abaPairingLayout.tali + gap + cell : n * cell + (n - 1) * gap;
  const cellX = (i: number) => (pairing ? (w + rowW) / 2 - cell / 2 : (w - rowW) / 2 + i * (cell + gap) + cell / 2);
  const filledAt = (i: number) => v.tokenInCell && i >= v.flown;
  const cells = Array.from({ length: n }, (_, i) =>
    pairing && moving && v.stage === 'land' ? (
      <LandingToken key={i} size={cell} fromDx={-(abaPairingLayout.tali + gap)} />
    ) : (
      <TokenCell key={i} size={cell} filled={filledAt(i)} testID={filledAt(i) ? 'aba-exchange-token-filled' : 'aba-exchange-token-empty'} />
    ),
  );
  const row = pairing ? (
    <>
      <PressOnly accessibilityLabel={t('abaSession.tali')}>
        <TaliFigure pose="point" size={abaPairingLayout.tali} crop accessibilityLabel={t('abaSession.tali')} testID="aba-exchange-tali" />
      </PressOnly>
      <View style={{ width: gap }} />
      {cells}
    </>
  ) : (
    <View style={{ flexDirection: 'row', gap }}>{cells}</View>
  );
  const opening = (v.stage === 'open' || v.stage === 'done') && moving && area !== null;
  return (
    <View style={{ flex: 1, paddingHorizontal: 16 }} testID={testID}>
      <NonTrialRow onExit={onExit} {...exitLabels(t)} />
      <View style={{ flex: 1, paddingVertical: 16 }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }} onLayout={onLayout}>
          {!opening && <Block card={<PictureCard id={reinforcerId} stroke={v.cardStroke} testID="aba-exchange-card" />} row={v.rowVisible ? row : null} />}
          {moving &&
            area &&
            v.stage === 'fly' &&
            Array.from({ length: v.flown }, (_, i) => <FlyingToken key={i} from={{ x: cellX(i), y: rowY }} to={{ x: w / 2, y: top + abaExchange.cardSize / 2 }} size={cell} />)}
          {opening && <GrowFrame from={card} to={{ x: 0, y: 0, w, h }} ms={abaExchange.openMs} reinforcerId={reinforcerId} testID="aba-exchange-open" />}
        </View>
      </View>
    </View>
  );
}
