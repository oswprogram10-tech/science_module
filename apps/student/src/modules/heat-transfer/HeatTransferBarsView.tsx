import type { HeatTransferResult, HeatTransferSample } from '@sci/engine-physics';
import type { ViewProps } from '../types';
import { TrialBars } from '../TrialBars';
import { transferResult } from './initial';

/** 시행별 막대 그래프: 시행마다 가장 먼 곳까지 열이 전해진 시간(초) 막대(0~130초). 재생 중인 시행의 막대는 초시계처럼 걸린 시간까지 자란다. */
export function HeatTransferBarsView(props: ViewProps<HeatTransferSample>) {
  const now = props.snapshot ? Math.min(props.snapshot.t, transferResult(props.values).time) : 0;
  return (
    <TrialBars<HeatTransferSample>
      {...props}
      caption="시행별 막대 그래프"
      yTitle="걸린 시간(초)"
      testPrefix="transfer"
      nowLevel={now}
      resultLevel={(r) => (r as HeatTransferResult).time}
      barFill="#c2410c"
      levelMax={130}
      ticks={[0, 65, 130]}
      unit="초"
    />
  );
}
