import type { BulbResult, BulbSample } from '@sci/engine-physics';
import type { ViewProps } from '../types';
import { TrialBars } from '../TrialBars';

/** 시행별 막대 그래프: 시행마다 전구의 밝기(눈금) 막대. 전구에 불 켜기와 전지 직렬연결 비교가 함께 쓴다. */
export function BulbBarsView(props: ViewProps<BulbSample>) {
  return (
    <TrialBars<BulbSample>
      {...props}
      caption="시행별 막대 그래프"
      yTitle="전구의 밝기(눈금)"
      testPrefix="bulb"
      nowLevel={props.snapshot?.level ?? 0}
      resultLevel={(r) => (r as BulbResult).brightness}
      barFill="#ca8a04"
    />
  );
}
