import type { LightNeededResult, LightNeededSample } from '@sci/engine-physics';
import type { ViewProps } from '../types';
import { TrialBars } from '../TrialBars';

/** 시행별 막대 그래프: 시행마다 상자 안 밝기(눈금) 막대 */
export function LightBarsView(props: ViewProps<LightNeededSample>) {
  return (
    <TrialBars<LightNeededSample>
      {...props}
      caption="시행별 막대 그래프"
      yTitle="상자 안 밝기(눈금)"
      testPrefix="light"
      nowLevel={props.snapshot?.level ?? 0}
      resultLevel={(r) => (r as LightNeededResult).brightness}
      barFill="#ca8a04"
    />
  );
}
