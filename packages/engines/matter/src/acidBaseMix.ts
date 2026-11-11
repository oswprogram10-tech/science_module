import type { VariableExperiment as Experiment } from '@sci/schema';

export const MIX_DROPS = [0, 10, 20, 30, 40] as const;
/** 넣는 방향: acid = 묽은 염산 10 mL에 묽은 수산화 나트륨 용액을 넣음, base = 묽은 수산화 나트륨 용액 10 mL에 묽은 염산을 넣음 */
export const MIX_DIRECTIONS = ['acid', 'base'] as const;
export type MixDirection = (typeof MIX_DIRECTIONS)[number];
export const MIX_INDICATORS = ['cabbage', 'phenol'] as const;
export type MixIndicator = (typeof MIX_INDICATORS)[number];
export const MIX_BEAKERS = [50, 100] as const;

/** 색 키. 이름 체계는 단원 첫 활동(지시약으로 여러 가지 용액 분류하기)의 colors와 같다. */
export type MixColor = 'cabRed' | 'cabPink' | 'cabPurple' | 'cabBlue' | 'cabGreen' | 'cabYellow' | 'clear' | 'magenta';

/** 색 이름: 첫 활동 매니페스트의 colors[키].label과 같은 글자 */
export const MIX_COLOR_LABEL: Record<MixColor, string> = {
  cabRed: '붉은색',
  cabPink: '연한 붉은색',
  cabPurple: '보라색',
  cabBlue: '푸른색',
  cabGreen: '초록색',
  cabYellow: '노란색',
  clear: '색 변화 없음',
  magenta: '붉은색',
};

/** 지시약의 색 띠(칸 순서): 칸 번호는 이 순서의 1부터의 자리다. */
export const MIX_SCALE: Record<MixIndicator, readonly MixColor[]> = {
  cabbage: ['cabRed', 'cabPink', 'cabPurple', 'cabBlue', 'cabGreen', 'cabYellow'],
  phenol: ['clear', 'magenta'],
};

export interface AcidBaseMixParams {
  /** 넣은 방울 수 */
  drops: number;
  /** 넣는 방향 */
  direction: MixDirection;
  /** 지시약 */
  indicator: MixIndicator;
  /** 비커 크기(mL): 계산에 쓰지 않는 대조 변인 */
  beaker: number;
}

export interface AcidBaseMixSample {
  /** 초 */
  t: number;
  /** 그때까지 넣은 방울 수(0 → 고른 방울 수) */
  drops: number;
  /** 그때의 지시약 색이 색 띠에서 몇 번째 칸인가(1부터) */
  slot: number;
}

export interface AcidBaseMixResult {
  /** 지시약 색(범주) */
  color: MixColor;
  /** 넣은 양(mL), 소수 첫째 자리 */
  addedMl: number;
  /** 지시약 색이 색 띠에서 몇 번째 칸인가(1부터). 예측 비교에 쓴다. */
  slot: number;
}

export interface AcidBaseMixOutput {
  samples: AcidBaseMixSample[];
  result: AcidBaseMixResult;
}

/** 한 방울의 양(mL) */
export const DROP_ML = 0.5;
/** 처음 용액의 양(mL) */
export const START_ML = 10;
/** 두 용액 모두 0.1 mol/L이다. 한 방울(0.5 mL)에는 0.05 mmol이 들어 있다. */
export const DROP_MMOL = 0.05;
/** 처음 용액 1.0 mmol = 방울 20개 분 */
export const START_UNITS = 20;
export const MIX_TOTAL_S = 3;
export const MIX_SAMPLE_S = 0.1;

/** 색 띠 경계(내부 값). 첫 활동 매니페스트의 지시약 색 경계와 같다. */
export const CABBAGE_BOUNDS = [2.5, 6, 8, 10.5, 12] as const;
/** 페놀프탈레인: 8.2보다 작으면 색이 없다. */
export const PHENOL_BOUND = 8.2;

const roundTo = (x: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round(x * f) / f || 0;
};

const checkParams = (p: AcidBaseMixParams): void => {
  if (typeof p.drops !== 'number' || !(MIX_DROPS as readonly number[]).includes(p.drops)) throw new RangeError(`넣은 방울 수 ${String(p.drops)}은(는) ${MIX_DROPS.join(', ')} 중 하나여야 합니다.`);
  if (!(MIX_DIRECTIONS as readonly string[]).includes(p.direction)) throw new RangeError(`넣는 방향 ${String(p.direction)}은(는) ${MIX_DIRECTIONS.join(', ')} 중 하나여야 합니다.`);
  if (!(MIX_INDICATORS as readonly string[]).includes(p.indicator)) throw new RangeError(`지시약 ${String(p.indicator)}은(는) ${MIX_INDICATORS.join(', ')} 중 하나여야 합니다.`);
  if (typeof p.beaker !== 'number' || !(MIX_BEAKERS as readonly number[]).includes(p.beaker)) throw new RangeError(`비커 크기 ${String(p.beaker)}은(는) ${MIX_BEAKERS.join(', ')} mL 중 하나여야 합니다.`);
};

/** 용액의 부피(mL) = 10 + 0.5 × 방울 수 */
export const volumeMlOf = (drops: number): number => START_ML + DROP_ML * drops;

/** 넣은 양(mL) = 0.5 × 방울 수, 소수 첫째 자리 */
export const addedMlOf = (drops: number): number => roundTo(DROP_ML * drops, 1);

/**
 * 내부 산도 값 p. 화면에는 보이지 않는다(수치 비공개).
 * 처음 용액 1.0 mmol(방울 20개 분)에 반대쪽 용액을 방울 수만큼(1방울 0.05 mmol) 넣는다. 같으면 7, 산이 남으면 −log10, 염기가 남으면 14 + log10.
 * 방울 수는 정수라서 0.05 mmol 단위의 정수로 세어, 소수 계산 오차 없이 같은 양인지 가려낸다.
 */
export function insideValueOf(drops: number, direction: MixDirection): number {
  const left = START_UNITS - drops;
  if (left === 0) return 7;
  // 처음 용액 쪽이 남으면(left > 0) 그 쪽 성질, 넣은 쪽이 남으면(left < 0) 반대쪽 성질
  const acidLeft = direction === 'acid' ? left > 0 : left < 0;
  const conc = (Math.abs(left) * DROP_MMOL) / volumeMlOf(drops);
  return acidLeft ? -Math.log10(conc) : 14 + Math.log10(conc);
}

/** 지시약 색: 붉은 양배추 지시약은 6가지, 페놀프탈레인은 2가지 */
export function colorOf(p: number, indicator: MixIndicator): MixColor {
  if (indicator === 'phenol') return p < PHENOL_BOUND ? 'clear' : 'magenta';
  const scale = MIX_SCALE.cabbage;
  const i = CABBAGE_BOUNDS.findIndex((b) => p < b);
  return scale[i === -1 ? scale.length - 1 : i]!;
}

/** 색 띠에서 몇 번째 칸인가(1부터) */
export const slotOf = (color: MixColor, indicator: MixIndicator): number => MIX_SCALE[indicator].indexOf(color) + 1;

/** 방울을 이만큼 넣었을 때의 지시약 색 */
export const colorAtDrops = (drops: number, direction: MixDirection, indicator: MixIndicator): MixColor => colorOf(insideValueOf(drops, direction), indicator);

/**
 * 산성 용액과 염기성 용액 섞기. 수치는 근사값이며 교사 검수 대상이다. 난수 없음.
 * 두 용액 모두 0.1 mol/L, 처음 용액 10 mL, 한 방울 0.5 mL. 방울을 0~3초 동안 차례로 넣고(0.1초 간격) 3초 뒤에는 그대로 둔다.
 * 비커 크기는 계산에 쓰지 않는다. 화면에 내부 산도 값은 보이지 않는다.
 */
export function simulateAcidBaseMix(params: AcidBaseMixParams): AcidBaseMixOutput {
  checkParams(params);
  const color = colorAtDrops(params.drops, params.direction, params.indicator);
  const result: AcidBaseMixResult = { color, addedMl: addedMlOf(params.drops), slot: slotOf(color, params.indicator) };
  const steps = Math.round(MIX_TOTAL_S / MIX_SAMPLE_S);
  const samples: AcidBaseMixSample[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = roundTo(i * MIX_SAMPLE_S, 6);
    // 방울은 처음부터 한 방울씩 차례로: 시간이 지나면 정수 방울 수만큼 넣은 상태가 된다.
    const drops = Math.round(params.drops * (i / steps));
    samples.push({ t, drops, slot: slotOf(colorAtDrops(drops, params.direction, params.indicator), params.indicator) });
  }
  return { samples, result };
}

/** 두 샘플 사이를 선형 보간한다. */
export function interpolateAcidBaseMix(a: AcidBaseMixSample, b: AcidBaseMixSample, k: number): AcidBaseMixSample {
  const lerp = (x: number, y: number) => x + (y - x) * k;
  return { t: lerp(a.t, b.t), drops: lerp(a.drops, b.drops), slot: lerp(a.slot, b.slot) };
}

const KEYS = ['drops', 'direction', 'indicator', 'beaker'] as const;
const ALLOWED: Record<(typeof KEYS)[number], readonly (string | number)[]> = { drops: MIX_DROPS, direction: MIX_DIRECTIONS, indicator: MIX_INDICATORS, beaker: MIX_BEAKERS };

/** 매니페스트의 산성 용액과 염기성 용액 섞기 실험이 모델이 다룰 수 있는 범위인지 검사한다. */
export function validateAcidBaseMixExperiment(exp: Experiment): string[] {
  const errors: string[] = [];
  for (const key of KEYS) {
    const v = exp.variables.find((x) => x.key === key);
    if (!v) {
      errors.push(`변인 "${key}"이(가) 없습니다.`);
      continue;
    }
    for (const o of v.options) {
      if (!ALLOWED[key].includes(o.value)) errors.push(`변인 "${key}"의 선택지 값 ${JSON.stringify(o.value)}: ${ALLOWED[key].join(', ')} 중 하나여야 합니다.`);
    }
  }
  return errors;
}
