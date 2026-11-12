/**
 * Доступ к подкрепителю (раздел 8, Ц3.5, Ц3.6; модель `model/accessRun.ts`): строка 72 с кольцом 56 и силуэтом 24 по
 * центру, сцена на всё поле под ней (543 на SE). В T кольцо исчезает и сцена замирает; после доигрывания рамка
 * сворачивается в карточку 160 на её место в блоке обмена (calm и reduce motion — смена кадра), карточка стоит секунду. Одна раскладка
 * с экраном обмена: раскрытие кончается ровно там, где стоит сцена.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { abaAccessScene, abaExchange, abaPairingLayout } from '../../../design/abaTokens';
import { RewardScene } from '../access/RewardScene';
import { accessLeft, accessRingVisible, type AccessRun } from '../model/accessRun';
import { NonTrialRow } from '../parts';
import { AccessRing, PictureCard } from '../reinforcer';
import { GrowFrame } from './ExchangeView';

export function AccessView({ run, tick, reinforcerId, moving, onExit }: { run: AccessRun; tick: number; reinforcerId: string; moving: boolean; onExit?: () => void }) {
  const { t } = useTranslation();
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
