/**
 * Подкрепитель на детских экранах ABA: картинка позиции (до ассета — заглушка), ячейка доски, выбор тапом 2.3 /
 * `choose` сопряжения (Ц2.4) и полоса взрослого. Логика выбора — `model/reinforcerChoiceRun.ts`; здесь только вид.
 */
import { useTranslation } from "react-i18next";
import { Pressable, Text, useColorScheme, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { REINFORCERS } from "../../content/aba/reinforcers";
import { useChildT } from "../../i18n";
import {
  abaAccessRing,
  abaAdultPanelColors,
  abaExchange,
  abaReinforcerCard,
  abaReinforcerChoice,
  abaTokenBoard,
  inactiveChoice,
  ABA_CONTROL_STROKE,
  ABA_STRIP_SILHOUETTE,
  ABA_STRIP_SILHOUETTE_GAP,
  abaAdultPanel,
} from "../../design/abaTokens";
import { parentTypography } from "../../design/parentTokens";
import { radii } from "../../design/tokens";
import { AbaText } from "./AbaText";
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
  // название — ребёнку, на его языке (№190)
  const t = useChildT();
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
  // название — ребёнку, на его языке (№190)
  const t = useChildT();
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
      {/* полоса 88 уже на 2 pt меньше содержимого — без роста шрифта (`design-lead`, этап F) */}
      <AbaText type={parentTypography.caption} color={p.label} max={1} lines={1} adjustsFontSizeToFit minimumFontScale={0.9}>
        {t("abaSession.adultChooses")}
      </AbaText>
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
            <AbaText
              type={parentTypography.caption}
              color={p.label}
              max={abaAdultPanel.maxFontSizeMultiplier}
              // одно слово — одна строка: при двух RN переносит «Калейдоскоп» по буквам вместо ужатия
              lines={t(labelKeyOf(id)).includes(" ") ? 2 : 1}
              minimumFontScale={abaAdultPanel.minimumFontScale}
              style={{ textAlign: "center" }}
              adjustsFontSizeToFit
            >
              {t(labelKeyOf(id))}
            </AbaText>
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

/**
 * Кольцо доступа без чисел (раздел 8, Ц3.6): диаметр 56, штрих 6, дуга `reinforcement` убывает по часовой от 12
 * часов; внутри — силуэт позиции 24 `ink` (`reinforcerId`): «время этой игрушки». Таймер перерыва — без силуэта.
 */
export function AccessRing({
  left,
  size = abaAccessRing.size,
  reinforcerId,
}: {
  left: number;
  size?: number;
  reinforcerId?: string | null;
}) {
  const c = useAbaColors();
  const w = abaAccessRing.stroke;
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
      </Svg>
      {reinforcerId && (
        <View
          style={{ position: "absolute", left: (size - abaAccessRing.silhouette) / 2, top: (size - abaAccessRing.silhouette) / 2 }}
          testID="aba-access-ring-silhouette"
        >
          <ReinforcerArt id={reinforcerId} size={abaAccessRing.silhouette} silhouette />
        </View>
      )}
    </View>
  );
}

/**
 * Карточка картинки подкрепителя 160 (Ц3.4; обмен, ожидание сопряжения, кадр конца доступа): поверхность картинки
 * (`abaPictureSurface`: `plate` и всегда тёмный `plateOutline` — в тёмной схеме утолщение 3 → 6 видно), контур 3 или 6
 * «получено». Не нажимается: касание отвечает сжатием 0.94 без действия и записи (ни одна цель не молчит). Для
 * экранного чтеца — название позиции, а не Tali.
 */
export function PictureCard({
  id,
  stroke = ABA_CONTROL_STROKE,
  size = abaExchange.cardSize,
  testID,
}: {
  id: string;
  stroke?: number;
  size?: number;
  testID?: string;
}) {
  // название — ребёнку, на его языке (№190)
  const t = useChildT();
  const c = useAbaColors();
  return (
    <Pressable
      accessibilityRole="image"
      accessibilityLabel={t(labelKeyOf(id))}
      testID={testID}
      style={({ pressed }) => ({
        transform: [{ scale: pressed ? inactiveChoice.tapPress.scale : 1 }],
        width: size,
        height: size,
        borderRadius: radii.lg,
        borderWidth: stroke,
        borderColor: c.plateOutline,
        backgroundColor: c.plate,
        alignItems: "center",
        justifyContent: "center",
      })}
    >
      <ReinforcerArt id={id} size={size - 32} />
    </Pressable>
  );
}
