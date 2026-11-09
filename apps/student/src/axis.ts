/** 그래프 축 눈금: 1·2·5×10^k 간격으로 4~6개 정도의 깔끔한 눈금을 만든다. */
export interface NiceScale {
  max: number;
  step: number;
  ticks: number[];
  decimals: number;
}

export function niceScale(dataMax: number, targetTicks = 4): NiceScale {
  const max = dataMax > 0 && Number.isFinite(dataMax) ? dataMax : 1;
  const rough = max / targetTicks;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const n = rough / pow;
  const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
  const count = Math.max(1, Math.ceil(max / step - 1e-9));
  const decimals = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
  const ticks = Array.from({ length: count + 1 }, (_, i) => +(i * step).toFixed(decimals));
  return { max: ticks[ticks.length - 1]!, step, ticks, decimals };
}

export function formatTick(v: number, decimals: number): string {
  return v.toFixed(decimals);
}

export interface YAxis extends NiceScale {
  min: number;
}

/** y축: yMin부터 시작하는 눈금. yMin이 0이면 niceScale(dataMax × 1.05)와 같다. */
export function yAxis(dataMax: number, yMin = 0): YAxis {
  const s = niceScale((dataMax - yMin) * 1.05);
  return {
    min: yMin,
    step: s.step,
    decimals: s.decimals,
    ticks: s.ticks.map((t) => +(yMin + t).toFixed(s.decimals)),
    max: +(yMin + s.max).toFixed(s.decimals),
  };
}
