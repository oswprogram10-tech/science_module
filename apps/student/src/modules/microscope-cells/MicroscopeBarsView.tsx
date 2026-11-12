import { MC_SIZE_MAX, type MicroscopeResult, type MicroscopeSample } from '@sci/engine-life';
import type { ViewProps } from '../types';
import { TrialBars } from '../TrialBars';

/** 시행별 막대 그래프: 시행마다 화면에서 본 칸 하나의 길이(mm) 막대. 칸이 보이지 않은 시행(초점 안 맞춤)은 막대 없이 "—"로 쓴다. */
export function MicroscopeBarsView(props: ViewProps<MicroscopeSample>) {
  return (
    <TrialBars<MicroscopeSample>
      {...props}
      caption="시행별 막대 그래프"
      yTitle="칸 하나의 길이(mm)"
      testPrefix="cell"
      nowLevel={props.snapshot?.size ?? 0}
      resultLevel={(r) => (r as MicroscopeResult).size}
      barFill="#0d9488"
      levelMax={MC_SIZE_MAX}
      ticks={[0, 50, 100]}
      unit="mm"
    />
  );
}
