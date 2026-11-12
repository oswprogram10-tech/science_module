import type { SoundTransmitResult, SoundTransmitSample } from '@sci/engine-physics';
import type { ViewProps } from '../types';
import { TrialBars } from '../TrialBars';

/** 시행별 막대 그래프: 시행마다 소음계 눈금 막대 */
export function SoundBarsView(props: ViewProps<SoundTransmitSample>) {
  return (
    <TrialBars<SoundTransmitSample>
      {...props}
      caption="시행별 막대 그래프"
      yTitle="소음계 눈금"
      testPrefix="sound"
      nowLevel={props.snapshot?.level ?? 0}
      resultLevel={(r) => (r as SoundTransmitResult).level}
      barFill="#d97706"
    />
  );
}
