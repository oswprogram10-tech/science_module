import type { HumidityResult, HumiditySample } from '@sci/engine-earth';
import type { ViewProps } from '../types';
import { TrialBars } from '../TrialBars';

/** 시행별 막대 그래프: 시행마다 습도(%) 막대 */
export function HumidityBarsView(props: ViewProps<HumiditySample>) {
  return (
    <TrialBars<HumiditySample>
      {...props}
      caption="시행별 막대 그래프"
      yTitle="습도(%)"
      testPrefix="humidity"
      nowLevel={props.snapshot?.rh ?? 0}
      resultLevel={(r) => (r as HumidityResult).rh}
      barFill="#0e7490"
      levelMax={100}
      ticks={[0, 50, 100]}
      unit="%"
    />
  );
}
