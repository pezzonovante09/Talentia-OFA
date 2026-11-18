/**
 * Поле шага «коснись картинки» (решение 1, часть В): только образец, без вариантов (`MatchField` с пустым полем). L1 —
 * метка над образцом (та же, что L1 наблюдения `match`); L3 — модель: точка касания в центре образца (временная замена
 * «экранной руке», `abaSampleTouch` — на ревью `design-lead`).
 */
import { View } from 'react-native';

import { abaLayout, abaSampleTouch } from '../../../design/abaTokens';
import type { PromptVisualPlan } from '../../../domain/abaPrompting';
import { useAbaColors } from '../parts';
import { MatchField } from './parts';

export function SampleTouchField({
  sampleId,
  level,
  touched,
  sampleSize,
  frameShownAt,
  onSample,
}: {
  sampleId: string;
  level: 0 | 1 | 3;
  touched: boolean;
  sampleSize: number;
  frameShownAt: number;
  onSample: (at: number) => void;
}) {
  const c = useAbaColors();
  const visual: PromptVisualPlan = {
    focus: level >= 1 ? { on: 'sample', id: sampleId, pulse: false } : null,
    activeChoiceIds: [],
    highlightCorrect: false,
    adultPhysical: false,
    plateMark: null,
  };
  const d = abaSampleTouch.handDot;
  return (
    <View>
      <MatchField
        sampleId={sampleId}
        field={[]}
        visual={visual}
        sampleTouched={touched}
        activeIds={[]}
        chosenId={null}
        sampleSize={sampleSize}
        choiceSize={0}
        frameShownAt={frameShownAt}
        empty={false}
        onSample={onSample}
        onOption={() => undefined}
      />
      {level === 3 && !touched && (
        <View
          pointerEvents="none"
          testID="aba-touch-model"
          style={{
            position: 'absolute',
            top: abaLayout.hintBand + sampleSize / 2 - d / 2,
            alignSelf: 'center',
            width: d,
            height: d,
            borderRadius: d / 2,
            backgroundColor: c.ink,
            opacity: abaSampleTouch.handDotOpacity,
          }}
        />
      )}
    </View>
  );
}
