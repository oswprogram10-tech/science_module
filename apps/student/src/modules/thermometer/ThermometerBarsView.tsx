import type { ThermometerResult, ThermometerSample } from '@sci/engine-physics';
import type { ViewProps } from '../types';
import { TrialBars } from '../TrialBars';

/** 시행별 막대 그래프: 시행마다 온도계 눈금(°C) 막대(0~40 °C) */
export function ThermometerBarsView(props: ViewProps<ThermometerSample>) {
  return (
    <TrialBars<ThermometerSample>
      {...props}
      caption="시행별 막대 그래프"
      yTitle="온도계 눈금(°C)"
      testPrefix="thermo"
      nowLevel={props.snapshot?.level ?? 0}
      resultLevel={(r) => (r as ThermometerResult).reading}
      barFill="#dc2626"
      levelMax={40}
      ticks={[0, 10, 20, 30, 40]}
      unit=" °C"
    />
  );
}
