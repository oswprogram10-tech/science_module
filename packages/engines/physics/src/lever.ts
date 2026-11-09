import type { VariableExperiment as Experiment } from '@sci/schema';

export type WeightShape = 'cylinder' | 'cube';
export type TiltSide = 'left' | 'level' | 'right';

export interface LeverParams {
  /** 오른쪽에 매단 추의 수(개) */
  count: number;
  /** 오른쪽 추의 거리(받침점에서 몇 칸) */
  distance: number;
  /** 추의 모양. 계산에는 쓰지 않는다(대조 변인). */
  shape: WeightShape;
}

export interface LeverOptions {
  durationS?: number;
  sampleEveryS?: number;
}

export interface LeverSample {
  t: number;
  /** 막대의 기울기(도). 오른쪽이 내려가면 +, 왼쪽이 내려가면 −. */
  angleDeg: number;
  /** 오른쪽 끝의 높이(cm) */
  rightHeightCm: number;
  /** 화면용 "돌리려는 정도"(왼쪽: 고정 8). 숫자로 보여 주지 않는다. */
  leftTurn: number;
  /** 화면용 "돌리려는 정도"(오른쪽: 추의 수 × 거리). 숫자로 보여 주지 않는다. */
  rightTurn: number;
}

export interface LeverResult {
  side: TiltSide;
  /** 끝값(cm), 정수 */
  rightHeightCm: number;
  /** 끝이 바닥에 닿는 시각(초), 소수 셋째 자리. 수평이면 null. 결과표에는 쓰지 않는다. */
  touchS: number | null;
}

export interface LeverOutput {
  samples: LeverSample[];
  result: LeverResult;
}

export const SHAPES: readonly WeightShape[] = ['cylinder', 'cube'];

const G = 9.8;
/** 추 하나의 질량(kg) */
const WEIGHT_KG = 0.05;
/** 눈금 한 칸(m) */
const CELL_M = 0.05;
/** 막대 반길이(m) */
const HALF_M = 0.45;
const BAR_KG = 0.2;
/** 받침점 높이(cm와 m) */
const PIVOT_CM = 10;
const PIVOT_M = 0.1;
/** 왼쪽 고정 조건: 추 2개 × 4칸 */
const LEFT_COUNT = 2;
const LEFT_CELLS = 4;
/** 왼쪽의 "돌리려는 정도"(개 × 칸) */
export const LEFT_TURN = LEFT_COUNT * LEFT_CELLS;
/** 끝이 바닥에 닿는 최대 기울기(라디안). 약 12.8° */
export const THETA_MAX = Math.asin(PIVOT_M / HALF_M);

const round = (x: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round(x * f) / f;
};

function checkParams(p: LeverParams): void {
  if (!Number.isInteger(p.count) || p.count < 1 || p.count > 6) throw new RangeError(`추의 수 ${String(p.count)}은(는) 1 이상 6 이하의 정수여야 합니다.`);
  if (!Number.isInteger(p.distance) || p.distance < 1 || p.distance > 8) throw new RangeError(`추의 거리 ${String(p.distance)}은(는) 1 이상 8 이하의 정수 칸이어야 합니다.`);
  if (!SHAPES.includes(p.shape)) throw new RangeError(`추의 모양 ${String(p.shape)}은(는) cylinder, cube 중 하나여야 합니다.`);
}

/**
 * 막대 수평 잡기 모델. 수치는 근사값이며 교사 검수 대상이다.
 * D = 오른쪽(개 × 칸) − 왼쪽(2개 × 4칸). D의 부호가 기우는 쪽이고 D = 0이면 수평이다.
 * 각가속도를 일정하다고 보고 θ(t) = min(θmax, ½αt²), α = g·m·c·|D| / I.
 * 오른쪽 끝 높이 = 10 − s × 45 × sin θ (cm).
 */
export function simulateLever(params: LeverParams, opts: LeverOptions = {}): LeverOutput {
  const { durationS = 1, sampleEveryS = 0.01 } = opts;
  checkParams(params);
  if (!(durationS > 0) || !(sampleEveryS > 0)) throw new RangeError('시간과 표본 간격은 0보다 커야 합니다.');

  const rightTurn = params.count * params.distance;
  const diff = rightTurn - LEFT_TURN;
  const s = Math.sign(diff);
  const inertia =
    (BAR_KG * (2 * HALF_M) ** 2) / 12 +
    WEIGHT_KG * LEFT_COUNT * (LEFT_CELLS * CELL_M) ** 2 +
    WEIGHT_KG * params.count * (params.distance * CELL_M) ** 2;
  const alpha = (G * WEIGHT_KG * CELL_M * Math.abs(diff)) / inertia;

  const thetaAt = (t: number) => (diff === 0 ? 0 : Math.min(THETA_MAX, 0.5 * alpha * t * t));
  const at = (t: number): LeverSample => {
    const theta = thetaAt(t);
    return {
      t: round(t, 6),
      // + 0: -0을 0으로
      angleDeg: s * ((theta * 180) / Math.PI) + 0,
      rightHeightCm: PIVOT_CM - s * 45 * Math.sin(theta) + 0,
      leftTurn: LEFT_TURN,
      rightTurn,
    };
  };

  const steps = Math.floor(durationS / sampleEveryS + 1e-9);
  const samples: LeverSample[] = [];
  for (let i = 0; i <= steps; i++) samples.push(at(i * sampleEveryS));
  if (samples[samples.length - 1]!.t < durationS - 1e-9) samples.push(at(durationS));

  const last = samples[samples.length - 1]!;
  return {
    samples,
    result: {
      side: s > 0 ? 'right' : s < 0 ? 'left' : 'level',
      rightHeightCm: Math.round(last.rightHeightCm),
      touchS: diff === 0 ? null : round(Math.sqrt((2 * THETA_MAX) / alpha), 3),
    },
  };
}

/** 두 샘플 사이를 선형 보간한다. */
export function interpolateLever(a: LeverSample, b: LeverSample, k: number): LeverSample {
  const lerp = (x: number, y: number) => x + (y - x) * k;
  return {
    t: lerp(a.t, b.t),
    angleDeg: lerp(a.angleDeg, b.angleDeg),
    rightHeightCm: lerp(a.rightHeightCm, b.rightHeightCm),
    leftTurn: lerp(a.leftTurn, b.leftTurn),
    rightTurn: lerp(a.rightTurn, b.rightTurn),
  };
}

const KEYS = ['count', 'distance', 'shape'] as const;

/** 매니페스트의 막대 수평 잡기 실험이 모델이 다룰 수 있는 범위인지 검사한다. */
export function validateLeverExperiment(exp: Experiment): string[] {
  const errors: string[] = [];
  for (const key of KEYS) {
    const v = exp.variables.find((x) => x.key === key);
    if (!v) {
      errors.push(`변인 "${key}"이(가) 없습니다.`);
      continue;
    }
    for (const o of v.options) {
      const val = o.value;
      const bad = (why: string) => errors.push(`변인 "${key}"의 선택지 값 ${JSON.stringify(val)}: ${why}`);
      if (key === 'count') {
        if (typeof val !== 'number' || !Number.isInteger(val)) bad('정수여야 합니다.');
        else if (val < 1 || val > 6) bad('추의 수는 1~6개 범위여야 합니다.');
      } else if (key === 'distance') {
        if (typeof val !== 'number' || !Number.isInteger(val)) bad('정수여야 합니다.');
        else if (val < 1 || val > 8) bad('추의 거리는 1~8칸 범위여야 합니다.');
      } else if (typeof val !== 'string' || !SHAPES.includes(val as WeightShape)) {
        bad(`${SHAPES.join(', ')} 중 하나여야 합니다.`);
      }
    }
  }
  return errors;
}
