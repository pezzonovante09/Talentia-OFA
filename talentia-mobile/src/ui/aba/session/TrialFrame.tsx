/**
 * Кадр пробы на одном каркасе (раздел 5, Ц2): пауза перед SD, сама проба, последствие и жетон за участие. Строка 72,
 * полоса, инструкция и поле стоят на месте — меняется только то, что принадлежит фазе; плашка `token_praise` закрывает
 * полосу и поле (Ц2.6.1). Что нажато и что дальше — решает экран сессии.
 */
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { abaReinforcementOverlay, type abaChoiceZone, type abaLayoutByTier } from '../../../design/abaTokens';
import type { AbaSessionState, TrialStep } from '../../../domain/abaSession';
import { adultPanelButtons, type PanelButton } from '../../../domain/abaScoring';
import { matchVisual, optionActive, type MatchEvent } from '../model/matchTrialRun';
import type { Phase } from '../model/sessionPhase';
import { MatchField, ReinforcementOverlay, TopBar } from './parts';

type Props = {
  phase: Extract<Phase, { kind: 'pause' | 'trial' | 'consequence' | 'participation' }>;
  step: TrialStep;
  session: AbaSessionState;
  layout: (typeof abaLayoutByTier)[keyof typeof abaLayoutByTier];
  zone: (typeof abaChoiceZone)[keyof typeof abaChoiceZone];
  calm: boolean;
  still: boolean;
  strip: ReactNode;
  sdKey: string | null;
  instruction: (key: string | null) => ReactNode;
  panel: (buttons: readonly PanelButton[], pressed: PanelButton | null, onPress: (b: PanelButton, at: number) => void) => ReactNode;
  onTrial: (e: MatchEvent) => void;
  /** Карточка «перерыв» вне пробы: пауза перед SD, последствие, жетон за участие. */
  onBreakCard: () => void;
  onHoldCard: (down: boolean) => void;
  onRefuse: () => void;
};

export function TrialFrame({ phase, step, session: s, layout, zone, calm, still, strip, sdKey, instruction, panel, onTrial, onBreakCard, onHoldCard, onRefuse }: Props) {
  const r = phase.kind === 'trial' ? phase.run : null;
  const empty = phase.kind === 'pause' || phase.kind === 'participation' || (phase.kind === 'consequence' && phase.empty);
  const overlayH = layout.tokenBoard + layout.gapAfterBoard + layout.instruction + layout.hintBand + zone.sample + 24 + zone.choice;
  const buttons = r && s.config === 'with_adult' ? adultPanelButtons(s.config, step, r.awaitingL4) : (['adult_prompted', 'refusal'] as PanelButton[]);
  const frame = r ? r.sdEndedAt : 0;
  return (
    <>
      <TopBar
        breakCard={{
          frameShownAt: phase.kind === 'consequence' ? phase.run.markedAt : frame,
          highlight: (phase.kind === 'consequence' || phase.kind === 'participation') && phase.breakAsked,
          onHold: onHoldCard,
          onTap: (at) => (phase.kind === 'trial' ? onTrial({ type: 'break_card', at }) : onBreakCard()),
        }}
      />
      {phase.kind === 'consequence' && phase.overlay ? (
        <ReinforcementOverlay size={s.board.size} earnedBefore={phase.earnedBefore} landed={phase.landed} calm={calm} moving={!still} height={Math.min(overlayH, abaReinforcementOverlay.tali + 288)} />
      ) : (
        <>
          {strip}
          <View style={{ height: layout.gapAfterBoard }} />
          {instruction(empty ? null : sdKey)}
          <MatchField
            sampleId={step.sampleCardId!}
            field={step.field!}
            visual={r ? matchVisual(r) : null}
            sampleTouched={r ? r.sampleTouchedAt !== null : phase.kind === 'consequence'}
            // в последствии и пока проба пишется варианты не «гаснут»: цвет «неактивно» читался бы как «неверно»
            activeIds={r && !r.done ? step.field!.filter((id) => optionActive(r, id)) : step.field!}
            chosenId={r ? r.chosenCardId : phase.kind === 'consequence' ? phase.chosenId : null}
            sampleSize={zone.sample}
            choiceSize={zone.choice}
            frameShownAt={frame}
            empty={empty}
            onSample={(at) => onTrial({ type: 'tap_sample', at })}
            onOption={(id, at) => onTrial({ type: 'tap_option', id, at })}
          />
        </>
      )}
      <View style={{ flex: 1 }} />
      {panel(
        phase.kind === 'trial' ? buttons : ['refusal'],
        phase.kind === 'trial' ? phase.pressed : null,
        (b, at) => (phase.kind === 'trial' ? onTrial({ type: 'adult', button: b, at }) : b === 'refusal' ? onRefuse() : undefined),
      )}
    </>
  );
}
