/**
 * Подкрепитель на детских экранах ABA: картинка позиции (до ассета — заглушка), ячейка доски, выбор тапом 2.3 /
 * `choose` сопряжения (Ц2.4) и полоса взрослого. Логика выбора — `model/reinforcerChoiceRun.ts`; здесь только вид.
 */
import { useTranslation } from "react-i18next";
import { Pressable, Text, useColorScheme, View } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";

import { REINFORCERS } from "../../content/aba/reinforcers";
import {
  abaAdultPanelColors,
  abaReinforcerCard,
  abaReinforcerChoice,
  abaTokenBoard,
  ABA_CONTROL_STROKE,
  ABA_STRIP_SILHOUETTE,
  ABA_STRIP_SILHOUETTE_GAP,
} from "../../design/abaTokens";
import { radii } from "../../design/tokens";
import type { ChoiceRun } from "./model/reinforcerChoiceRun";
import { ChildPressable, useAbaColors } from "./parts";

const labelKeyOf = (id: string) =>
  REINFORCERS.find((r) => r.id === id)?.labelKey ?? id;

/**
 * Картинка позиции каталога. Ассетов ещё нет (`asset-pipeline`): в `__DEV__` — название словом, чтобы пройти
 * занятие и различать позиции; в сборке — нейтральный силуэт.
 */
export function ReinforcerArt({
  id,
  size,
  silhouette = false,
}: {
  id: string;
  size: number;
  silhouette?: boolean;
}) {
  const { t } = useTranslation();
  const c = useAbaColors();
  if (__DEV__ && !silhouette) {
    return (
      <View
        testID={`aba-reinforcer-stub-${id}`}
        style={{
          width: size,
          height: size,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            color: c.plateOutline,
            fontSize: Math.max(10, size / 7),
            fontWeight: "700",
            textAlign: "center",
          }}
          numberOfLines={2}
          adjustsFontSizeToFit
        >
          {t(labelKeyOf(id))}
        </Text>
      </View>
    );
  }
  return (
    <Svg width={size} height={size} testID={`aba-reinforcer-stub-${id}`}>
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={size * 0.35}
        fill={silhouette ? c.ink : "none"}
        stroke={c.plateOutline}
        strokeWidth={2}
      />
    </Svg>
  );
}

/** Ячейка доски жетонов: пустая — заливка слота и пунктир; заработанная — жёлтая, контур и сплошная звезда (`tokenCell`). */
export function TokenCell({
  size,
  filled,
  testID,
}: {
  size: number;
  filled: boolean;
  testID?: string;
}) {
  const c = useAbaColors();
  const s = abaTokenBoard.stroke;
  const r = size / 2;
  const star = (() => {
    const pts: string[] = [];
    for (let i = 0; i < 10; i += 1) {
      const a = (Math.PI / 5) * i - Math.PI / 2;
      const rr = i % 2 === 0 ? r * 0.55 : r * 0.24;
      pts.push(`${r + rr * Math.cos(a)},${r + rr * Math.sin(a)}`);
    }
    return `M${pts.join("L")}Z`;
  })();
  return (
    <View
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={size} height={size}>
        <Circle
          cx={r}
          cy={r}
          r={r - s / 2}
          fill={filled ? c.tokenEarned : c.tokenSlot}
          stroke={filled ? c.tokenOutline : c.tokenSlotOutline}
          strokeWidth={s}
          strokeDasharray={filled ? undefined : "6 5"}
        />
        {filled && <Path d={star} fill={c.tokenOutline} />}
      </Svg>
    </View>
  );
}

/** Карточка подкрепителя: белая, контур 3, выбранная — контур 6 внутрь; `pulse` — общий пульс «Сам» 1.04. */
function ReinforcerCard({
  id,
  size,
  selected,
  pulse,
  frameShownAt,
  onTap,
}: {
  id: string;
  size: number;
  selected: boolean;
  pulse: boolean;
  frameShownAt: number;
  onTap: (at: number) => void;
}) {
  const { t } = useTranslation();
  const c = useAbaColors();
  const stroke = selected
    ? abaReinforcerChoice.selected.stroke
    : ABA_CONTROL_STROKE;
  return (
    <ChildPressable
      frameShownAt={frameShownAt}
      onCommit={onTap}
      testID={`aba-reinforcer-${id}`}
      accessibilityLabel={t(labelKeyOf(id))}
      style={{
        width: size,
        height: size,
        borderRadius: radii.lg,
        borderWidth: stroke,
        borderColor: c.controlInk,
        backgroundColor: c.controlFill,
        alignItems: "center",
        justifyContent: "center",
        transform: [
          { scale: pulse ? abaReinforcerChoice.aloneRepeat.pulse.scale : 1 },
        ],
      }}
    >
      <View style={{ backgroundColor: c.plate, borderRadius: radii.md }}>
        <ReinforcerArt id={id} size={size - 32} />
      </View>
    </ChildPressable>
  );
}

/** Полоса взрослого 88 на месте «Начать» (раздел 4): подпись и три кнопки названиями, без картинок. */
function AdultStrip({
  options,
  onTap,
}: {
  options: string[];
  onTap: (id: string) => void;
}) {
  const { t } = useTranslation();
  const p = abaAdultPanelColors(useColorScheme() === "dark" ? "dark" : "light");
  return (
    <View
      testID="aba-adult-strip"
      style={{
        height: abaReinforcerChoice.adultStripHeight,
        backgroundColor: p.band,
        borderRadius: radii.md,
        padding: 8,
        gap: 6,
      }}
    >
      <Text
        style={{ color: p.label, fontSize: 14, lineHeight: 20 }}
        numberOfLines={1}
      >
        {t("abaSession.adultChooses")}
      </Text>
      <View style={{ flexDirection: "row", gap: 8, flex: 1 }}>
        {options.map((id) => (
          <Pressable
            key={id}
            onPress={() => onTap(id)}
            testID={`aba-adult-choose-${id}`}
            accessibilityRole="button"
            style={{
              flex: 1,
              height: 48,
              borderRadius: radii.sm,
              borderWidth: 1,
              borderColor: p.border,
              backgroundColor: p.button,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{ color: p.label, fontSize: 14 }}
              numberOfLines={2}
              adjustsFontSizeToFit
            >
              {t(labelKeyOf(id))}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/**
 * Экран выбора (раздел 4 / Ц2.4): две карточки в ряд, третья по центру, доска с силуэтом выбранного, внизу 88 —
 * пусто или полоса взрослого. Карточка — `abaReinforcerCardSize` от размеров зоны.
 */
export function ReinforcerChoiceView({
  run,
  options,
  cardSize,
  boardCells,
  pulse,
  onTap,
  onAdultTap,
}: {
  run: ChoiceRun;
  options: string[];
  cardSize: number;
  boardCells: number;
  pulse: boolean;
  onTap: (id: string, at: number) => void;
  onAdultTap: (id: string) => void;
}) {
  const c = useAbaColors();
  const card = (id: string) => (
    <ReinforcerCard
      key={id}
      id={id}
      size={cardSize}
      selected={run.selected === id}
      pulse={pulse}
      frameShownAt={run.shownAt}
      onTap={(at) => onTap(id, at)}
    />
  );
  const gap = abaReinforcerCard.gap;
  return (
    <View style={{ flex: 1 }} testID="aba-choice">
      <View style={{ flexDirection: "row", justifyContent: "center", gap }}>
        {options.slice(0, 2).map(card)}
      </View>
      <View style={{ alignItems: "center", marginTop: gap }}>
        {options[2] !== undefined && card(options[2])}
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          marginTop: gap,
          gap: ABA_STRIP_SILHOUETTE_GAP,
        }}
      >
        {run.selected ? (
          <ReinforcerArt
            id={run.selected}
            size={ABA_STRIP_SILHOUETTE}
            silhouette
          />
        ) : (
          <Svg
            width={ABA_STRIP_SILHOUETTE}
            height={ABA_STRIP_SILHOUETTE}
            testID="aba-choice-silhouette-empty"
          >
            <Circle
              cx={20}
              cy={20}
              r={18.5}
              fill="none"
              stroke={c.tokenSlotOutline}
              strokeWidth={3}
              strokeDasharray="6 5"
            />
          </Svg>
        )}
        {Array.from({ length: boardCells }, (_, i) => (
          <TokenCell key={i} size={abaTokenBoard.size} filled={false} />
        ))}
      </View>
      <View style={{ flex: 1 }} />
      <View
        style={{
          height: abaReinforcerChoice.adultStripHeight,
          marginBottom: 8,
        }}
      >
        {run.stripShownAt !== null && (
          <AdultStrip options={options} onTap={onAdultTap} />
        )}
      </View>
    </View>
  );
}

/** Кольцо доступа без чисел (раздел 8): диаметр 56, штрих 6, дуга `reinforcement` убывает по часовой от 12 часов. */
export function AccessRing({
  left,
  size = 56,
}: {
  left: number;
  size?: number;
}) {
  const c = useAbaColors();
  const w = 6;
  const r = (size - w) / 2;
  const frac = Math.max(0, Math.min(1, left));
  const a = 2 * Math.PI * frac;
  const x = size / 2 + r * Math.sin(a);
  const y = size / 2 - r * Math.cos(a);
  const arc =
    frac >= 1
      ? null
      : `M${size / 2},${size / 2 - r} A${r},${r} 0 ${frac > 0.5 ? 1 : 0} 1 ${x},${y}`;
  return (
    <View
      testID="aba-access-ring"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={c.tokenSlot}
          strokeWidth={w}
          fill="none"
        />
        {frac >= 1 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={c.reinforcement}
            strokeWidth={w}
            fill="none"
          />
        ) : (
          frac > 0 && (
            <Path
              d={arc!}
              stroke={c.reinforcement}
              strokeWidth={w}
              fill="none"
            />
          )
        )}
        <Rect
          x={size / 2 - 6}
          y={size / 2 - 6}
          width={12}
          height={12}
          rx={6}
          fill={c.ink}
        />
      </Svg>
    </View>
  );
}
