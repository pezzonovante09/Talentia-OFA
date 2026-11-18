/**
 * Доступ к подкрепителю (раздел 8, Ц3.5, Ц3.6; модель `model/accessRun.ts`): строка 72 с кольцом 56 и силуэтом 24 по
 * центру, сцена на всё поле под ней (543 на SE). В T кольцо исчезает и сцена замирает; после доигрывания рамка
 * сворачивается в карточку 160 на её место в блоке обмена (calm и reduce motion — смена кадра), карточка стоит секунду. Одна раскладка
 * с экраном обмена: раскрытие кончается ровно там, где стоит сцена.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, useColorScheme, View } from 'react-native';

import { abaAccessScene, abaAdultPanelColors, abaAdultSheet, abaExchange, abaPairingLayout, abaRewardScene } from '../../../design/abaTokens';
import { parentPressed, parentTypography } from '../../../design/parentTokens';
import { AbaText } from '../AbaText';
import { RewardScene } from '../access/RewardScene';
import { accessLeft, accessRingVisible, type AccessRun } from '../model/accessRun';
import { NonTrialRow } from '../parts';
import { AccessRing, PictureCard } from '../reinforcer';
import { GrowFrame } from './ExchangeView';

export function AccessView({
  run,
  tick,
  reinforcerId,
  moving,
  onExit,
  onAdultDone,
}: {
  run: AccessRun;
  tick: number;
  reinforcerId: string;
  moving: boolean;
  onExit?: () => void;
  /** «Готово» взрослого у «Награды от взрослого» (решение 14): конец доступа раньше кольца (`finishAccessNow`). */
  onAdultDone?: () => void;
}) {
  const { t } = useTranslation();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const [area, setArea] = useState<{ w: number; h: number } | null>(null);
  // слот карточки блока обмена «карточка · 24 · ряд 88»: сцена убирается в ту же карточку, из которой раскрылась
  const block = abaExchange.cardSize + abaPairingLayout.gapCardRow + abaExchange.rowHeight;
  const card = area && { x: (area.w - abaExchange.cardSize) / 2, y: (area.h - block) / 2, w: abaExchange.cardSize, h: abaExchange.cardSize };
  const scene = run.stage === 'play' || run.stage === 'settle';
  return (
    <View style={{ flex: 1, paddingHorizontal: 16 }} testID={`aba-access-${run.stage}`}>
      <NonTrialRow onExit={onExit} exitLabel={t('abaSession.exit')} exitHint={t('abaSession.exitHint')}>
        {accessRingVisible(run) && <AccessRing left={accessLeft(run, tick)} reinforcerId={reinforcerId} />}
      </NonTrialRow>
      <View style={{ flex: 1, paddingVertical: 16 }}>
        <View style={{ flex: 1, alignItems: 'center' }} onLayout={(e) => setArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
          {scene && (
            <View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}>
              {/* своя сцена у готовых наград, у остальных — заглушка (правка 2) */}
              <RewardScene reinforcerId={reinforcerId} ended={run.stage !== 'play'} still={!moving} />
            </View>
          )}
          {/* «Готово» взрослого поверх низа сцены, не в раскладке: место карточки конца то же, что у обмена */}
          {reinforcerId === 'from_adult' && run.stage === 'play' && onAdultDone && (
            <AdultDone label={t('abaSession.fromAdultDone')} scheme={scheme} onPress={onAdultDone} />
          )}
          {run.stage === 'fold' && moving && area && card && (
            <GrowFrame from={{ x: 0, y: 0, w: area.w, h: area.h }} to={card} ms={abaAccessScene.endFrame.foldMs} reinforcerId={reinforcerId} testID="aba-access-fold" />
          )}
          {/* место карточки известно после `onLayout`: на кадре конца после возврата она не прыгает из угла, первый кадр — фон */}
          {card && (run.stage === 'hold' || run.stage === 'done' || (run.stage === 'fold' && !moving)) && (
            <View style={{ position: 'absolute', left: card.x, top: card.y }}>
              <PictureCard id={reinforcerId} stroke={abaAccessScene.endFrame.cardStroke} testID="aba-access-card" />
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

/** Кнопка листа взрослого (№203: белая, граница 1.5 `edge`, радиус 14, без борта детских кнопок); срабатывает по отпусканию. */
function AdultDone({ label, scheme, onPress }: { label: string; scheme: 'light' | 'dark'; onPress: () => void }) {
  const p = abaAdultPanelColors(scheme);
  const K = abaRewardScene.fromAdult;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID="aba-from-adult-done"
      style={({ pressed }) => ({
        position: 'absolute',
        left: K.doneInset,
        right: K.doneInset,
        bottom: K.doneInset,
        height: K.doneHeight,
        borderRadius: abaAdultSheet.buttonRadius,
        borderWidth: abaAdultSheet.buttonBorder,
        borderColor: pressed ? p.label : p.border,
        backgroundColor: pressed ? parentPressed[scheme].card : p.button,
        alignItems: 'center',
        justifyContent: 'center',
      })}
    >
      <AbaText type={parentTypography.label} color={p.label} max={1.3} lines={1} adjustsFontSizeToFit>
        {label}
      </AbaText>
    </Pressable>
  );
}
