/**
 * Сцена награды (правка 2, 2026-11-12; Ц2.9): по позиции каталога — своя сцена, у остальных пока заглушка
 * (`PlaceholderScene`). В выбор попадают только позиции из `REWARD_SCENE_READY` (правка 1). Общее для всех сцен —
 * `SceneFrame`: без «верно/неверно», счёта, текста ребёнку и проигрыша; после конца касания не принимаются. Концовки
 * сцен (пузыри лопаются по одному, узор к раскладке 1) написаны, но сейчас не видны: занятие начинает доступ без
 * доигрывания, и в момент конца сцена сразу сворачивается в карточку (`aba-pedagogy-specialist`: по процедуре допустимо).
 */
import { BubblesScene } from './BubblesScene';
import { KaleidoscopeScene } from './KaleidoscopeScene';
import { PaintDropScene } from './PaintDropScene';
import { PlaceholderScene } from './PlaceholderScene';
import { SingTogetherScene } from './SingTogetherScene';
import { TaliDanceScene } from './TaliDanceScene';

export function RewardScene({ reinforcerId, ended, still }: { reinforcerId: string; ended: boolean; still: boolean }) {
  switch (reinforcerId) {
    case 'bubbles':
      return <BubblesScene ended={ended} still={still} />;
    case 'kaleidoscope':
      return <KaleidoscopeScene ended={ended} still={still} />;
    case 'tali_dance':
      return <TaliDanceScene ended={ended} still={still} />;
    case 'paint_drop':
      return <PaintDropScene ended={ended} still={still} />;
    case 'sing_together':
      return <SingTogetherScene ended={ended} still={still} />;
    default:
      return <PlaceholderScene reinforcerId={reinforcerId} ended={ended} />;
  }
}
