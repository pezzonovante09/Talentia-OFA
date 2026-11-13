/**
 * Рисунок стимула на плите `match` (Ц2.12, `src/content/aba/stimuli.ts`). Формы — вектором кодом по `ABA_SHAPE_SPEC`
 * (ромб 60° / 120°, не повёрнутый квадрат; кольцо — внутренний диаметр 0.5), одна заливка на поле; цвета — круг или
 * квадрат своего hex, одинаковый в обеих темах; контур у всех `#2A1A12` 2 pt.
 *
 * Предметы — картинка из реестра (`ABA_OBJECT_ART`). Пока её нет: в сборке разработчика — **различимая** заглушка по
 * id (решение владельца 2026-10-27), в выпуске цель с такой карточкой к сессии не допускается (`readyAbaTargets`),
 * и сюда предмет без картинки не попадает; на всякий случай — нейтральный силуэт.
 */
import type * as React from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Path, Polygon, Rect } from 'react-native-svg';

import { ABA_OBJECT_ART } from '../../assets/registry';
import { ABA_SHAPE_SPEC, ABA_STIMULI, type AbaStimulus } from '../../content/aba/stimuli';
import { illustrationInk } from '../../design/tokens';

const OUTLINE = illustrationInk;
const byId = new Map(ABA_STIMULI.map((s) => [s.id, s]));

function Shape({ s, size }: { s: Extract<AbaStimulus, { kind: 'shape' }>; size: number }) {
  const c = size / 2;
  // одна площадь у всех форм (правка 3): ребёнок не выбирает «большую» или «маленькую»
  const area = ABA_SHAPE_SPEC.area * size * size;
  switch (s.shape) {
    case 'circle':
      return <Circle cx={c} cy={c} r={Math.sqrt(area / Math.PI)} fill={s.fill} stroke={OUTLINE} strokeWidth={2} />;
    case 'ring': {
      // кольцо — заливка между двумя окружностями и тот же контур, что у остальных форм (правка 3)
      const k = ABA_SHAPE_SPEC.ringInnerRatio;
      const R = Math.sqrt(area / (Math.PI * (1 - k * k)));
      const r = R * k;
      const d = `M${c - R},${c}a${R},${R} 0 1,0 ${2 * R},0a${R},${R} 0 1,0 ${-2 * R},0ZM${c - r},${c}a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0Z`;
      return <Path d={d} fill={s.fill} fillRule="evenodd" stroke={OUTLINE} strokeWidth={2} />;
    }
    case 'square': {
      const side = Math.sqrt(area);
      return <Rect x={c - side / 2} y={c - side / 2} width={side} height={side} fill={s.fill} stroke={OUTLINE} strokeWidth={2} />;
    }
    case 'triangle': {
      // прежние пропорции: основание 2k, высота 1.6k; площадь 1.6k²
      const k = Math.sqrt(area / 1.6);
      const h = k * 1.6;
      return <Polygon points={`${c},${c - h / 2} ${c + k},${c + h / 2} ${c - k},${c + h / 2}`} fill={s.fill} stroke={OUTLINE} strokeWidth={2} />;
    }
    case 'rhombus': {
      // острый угол 60°: полудиагонали в отношении tan(30°); площадь 2·long·short
      const ratio = Math.tan((ABA_SHAPE_SPEC.rhombusAcuteDeg / 2) * (Math.PI / 180));
      const long = Math.sqrt(area / (2 * ratio));
      const short = long * ratio;
      return <Polygon points={`${c},${c - long} ${c + short},${c} ${c},${c + long} ${c - short},${c}`} fill={s.fill} stroke={OUTLINE} strokeWidth={2} />;
    }
  }
}

export function StimulusPlate({ stimulusId, size, art = ABA_OBJECT_ART }: { stimulusId: string; size: number; art?: Readonly<Record<string, unknown>> }) {
  const s = byId.get(stimulusId);
  if (!s) return null;
  if (s.kind === 'object') {
    const Art = art[s.id];
    if (typeof Art === 'function') {
      const Component = Art as (p: { width: number; height: number }) => React.JSX.Element;
      return <Component width={size} height={size} />;
    }
    if (__DEV__) {
      // различимая заглушка разработчика: имя предмета словом — только чтобы пройти занятие без картинок
      return (
        <View testID={`aba-stub-${s.id}`} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: OUTLINE, fontSize: Math.max(12, size / 6), fontWeight: '700' }} numberOfLines={2} adjustsFontSizeToFit>
            {s.id.replace('aba-obj-', '')}
          </Text>
        </View>
      );
    }
    return (
      <Svg width={size} height={size} testID={`aba-stub-${s.id}`}>
        <Circle cx={size / 2} cy={size / 2} r={size * 0.35} fill="none" stroke={OUTLINE} strokeWidth={2} strokeDasharray="6 6" />
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size} testID={`aba-stim-${s.id}`}>
      {s.kind === 'shape' ? (
        <Shape s={s} size={size} />
      ) : s.carrier === 'square' ? (
        <Rect x={size * 0.15} y={size * 0.15} width={size * 0.7} height={size * 0.7} fill={s.hex} stroke={OUTLINE} strokeWidth={2} />
      ) : (
        <Circle cx={size / 2} cy={size / 2} r={size * 0.36} fill={s.hex} stroke={OUTLINE} strokeWidth={2} />
      )}
    </Svg>
  );
}
