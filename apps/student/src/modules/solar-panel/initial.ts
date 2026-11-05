import { SOLAR_DEFAULT_SUN_ALT_DEG, alignment, incidenceDeg, simulateSolar, type FrameKind, type ShadeKind, type SolarParams, type SolarResult, type SolarSample, type WeatherKind } from '@sci/engine-ssi';
import type { Values } from '@sci/gateway';
import type { VariableExperiment } from '@sci/schema';

/** 매니페스트 params에서 모델 옵션을 읽는다. */
export const solarOptions = (exp?: VariableExperiment) => ({
  totalS: typeof exp?.params?.totalS === 'number' ? exp.params.totalS : undefined,
  sunAltDeg: typeof exp?.params?.sunAltDeg === 'number' ? exp.params.sunAltDeg : undefined,
});

/** 화면이 쓰는 태양 높이(°): 매니페스트 값, 없으면 60 */
export const sunAltOf = (exp?: VariableExperiment) => solarOptions(exp).sunAltDeg ?? SOLAR_DEFAULT_SUN_ALT_DEG;

export const toParams = (values: Values): SolarParams => ({
  tilt: Number.isFinite(Number(values.tilt)) ? Number(values.tilt) : 0,
  weather: (values.weather === 'cloudy' ? 'cloudy' : 'sunny') satisfies WeatherKind,
  shade: (values.shade === 'half' ? 'half' : 'none') satisfies ShadeKind,
  frame: (values.frame === 'silver' ? 'silver' : 'black') satisfies FrameKind,
});

export const solarOutput = (values: Values, exp?: VariableExperiment) => simulateSolar(toParams(values), solarOptions(exp));

export const solarResult = (values: Values, exp?: VariableExperiment): SolarResult => solarOutput(values, exp).result;

/** 실험 전(0초): 전기를 만들지 않는 시작 상태이다. 조건에 따라 달라지지 않아 결과를 드러내지 않는다. */
export const IDLE_SAMPLE: SolarSample = { t: 0, powerMw: 0, turns: 0, light: 0 };

/** 눈으로 보기 아래 문구 */
export const panelNote = (s: Pick<SolarSample, 't' | 'powerMw' | 'turns'>) => `${s.t.toFixed(1)}초 · 만든 전기 ${Math.round(s.powerMw)} mW · 돈 횟수 ${Math.round(s.turns)}번`;

export const IDLE_NOTE = '실험하면 패널이 만든 전기의 양을 볼 수 있어요.';
export const BEAM_IDLE_NOTE = '실험하면 햇빛이 패널에 닿는 모습을 볼 수 있어요.';
/** 빛이 닿는 모습 아래 문구(화면 설명) */
export const BEAM_NOTE = '같은 넓이에 닿는 빛줄기가 많을수록 전기를 많이 만들어요.';
export const LIMITS_TITLE = '모형의 한계';
export const LIMITS_TEXT = '실제 패널은 일부만 가려져도 더 많이 줄 수 있어요. 태양 높이는 계절과 시각에 따라 달라져요.';

// ---- 빛이 닿는 모습(단면) 기하 ----
export const BEAM_COUNT = 6;
/** 패널 단면 길이, 빛줄기의 수직 간격, 첫 줄기가 닿는 자리(패널 가운데에서의 거리, 아래쪽 끝 쪽이 음수) */
export const PANEL_LEN = 100;
export const BEAM_GAP = 18;
export const BEAM_P0 = -45;
/** 그늘이면 패널 아래쪽 절반에 닿을 줄기(앞의 3개)가 막힌다 */
export const BLOCKED_COUNT = BEAM_COUNT / 2;

export type BeamState = 'hit' | 'blocked' | 'miss';
export interface BeamInfo {
  index: number;
  /** 패널을 따라 잰 닿는 자리(가운데 0, 패널 아래쪽 끝 쪽이 음수) */
  p: number;
  state: BeamState;
}

/** 줄기 6개가 패널에 닿는 자리: p = −45 + i·(18 / cos(inc)). 패널(길이 100) 밖이면 비켜 가고, 그늘이면 앞 3개는 막힌다. */
export function beamLayout(tilt: number, shade: ShadeKind, sunAltDeg = SOLAR_DEFAULT_SUN_ALT_DEG) {
  const spacing = BEAM_GAP / alignment(tilt, sunAltDeg);
  const beams: BeamInfo[] = Array.from({ length: BEAM_COUNT }, (_, i) => {
    const p = BEAM_P0 + i * spacing;
    const state: BeamState = p > PANEL_LEN / 2 + 1e-9 ? 'miss' : shade === 'half' && i < BLOCKED_COUNT ? 'blocked' : 'hit';
    return { index: i, p, state };
  });
  return { spacing, inc: incidenceDeg(tilt, sunAltDeg), beams };
}
