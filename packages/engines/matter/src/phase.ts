import type { VariableExperiment as Experiment } from '@sci/schema';

export const PHASE_PROCESSES = ['freeze', 'melt'] as const;
export type PhaseProcess = (typeof PHASE_PROCESSES)[number];
export const PHASE_TUBES = ['glass', 'plastic'] as const;
export type PhaseTube = (typeof PHASE_TUBES)[number];

export interface PhaseParams {
  process: PhaseProcess;
  startMl: number;
  /** 시험관 종류: 계산에 쓰지 않는 대조 변인 */
  tube: PhaseTube;
}

export interface PhaseOptions {
  /** 한 시행의 길이(분) */
  totalMin?: number;
  sampleEveryMin?: number;
}

export interface PhaseSample {
  /** 분 */
  t: number;
  /** 부피 변화(mL) = V(t) − V(0) */
  dV: number;
  /** 부피(mL) */
  volume: number;
  /** 얼음이 된 몫(0~1) */
  frozen: number;
  tempC: number;
  massG: number;
}

export interface PhaseResult {
  /** 부피 변화(mL), 소수 첫째 자리 */
  dV: number;
  /** 나중 부피(mL), 소수 첫째 자리 */
  volumeEnd: number;
  /** "처음 g → 나중 g" 글자. 무게는 변하지 않지만 처음 양에 따라 달라서 글자로 보인다. */
  mass: string;
  massStart: number;
  massEnd: number;
}

export interface PhaseOutput {
  samples: PhaseSample[];
  result: PhaseResult;
}

/** 물이 얼면 부피가 늘어나는 비율(근사값, 교사 검수 대상) */
export const EXPAND = 0.09;
/** 물 1 mL의 무게(g) */
export const WATER_G_PER_ML = 1.0;
export const START_MIN = 5;
export const START_MAX = 25;

const round = (x: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round(x * f) / f || 0;
};

/** 식기 시작하는 때(분) */
export const coolMin = (startMl: number) => 2 + 0.2 * startMl;
/** 다 얼거나 다 녹는 때(분) */
export const endMin = (startMl: number) => coolMin(startMl) + 1.0 * startMl;

function checkParams(p: PhaseParams): void {
  if (!(PHASE_PROCESSES as readonly string[]).includes(p.process)) {
    throw new RangeError(`과정 ${String(p.process)}은(는) ${PHASE_PROCESSES.join(', ')} 중 하나여야 합니다.`);
  }
  if (!(PHASE_TUBES as readonly string[]).includes(p.tube)) {
    throw new RangeError(`시험관 ${String(p.tube)}은(는) ${PHASE_TUBES.join(', ')} 중 하나여야 합니다.`);
  }
  if (typeof p.startMl !== 'number' || !Number.isFinite(p.startMl) || p.startMl < START_MIN || p.startMl > START_MAX) {
    throw new RangeError(`처음 물의 양 ${String(p.startMl)}은(는) ${START_MIN}~${START_MAX} mL여야 합니다.`);
  }
}

/** 얼음이 된 몫. 얼리기는 0 → 1, 녹이기는 1 → 0. */
export function frozenAt(process: PhaseProcess, startMl: number, t: number): number {
  const tc = coolMin(startMl);
  const k = Math.min(1, Math.max(0, (t - tc) / (1.0 * startMl)));
  return process === 'freeze' ? k : 1 - k;
}

/** 센서용 온도(°C). 얼거나 녹는 동안에는 0 °C에 머문다. */
export function tempAt(process: PhaseProcess, startMl: number, t: number): number {
  const tc = coolMin(startMl);
  const te = endMin(startMl);
  const eps = 1e-9;
  if (t >= tc - eps && t <= te + eps) return 0;
  if (t < tc) return process === 'freeze' ? 20 * (1 - t / tc) : -8 * (1 - t / tc);
  return process === 'freeze' ? -10 + 10 * Math.exp(-(t - te) / 3) : 25 - 25 * Math.exp(-(t - te) / 8);
}

/** 물이 얼 때와 얼음이 녹을 때의 부피와 무게. 시험관 종류는 계산에 쓰지 않는다. 난수 없음. */
export function simulatePhase(params: PhaseParams, opts: PhaseOptions = {}): PhaseOutput {
  const { totalMin = 30, sampleEveryMin = 0.1 } = opts;
  checkParams(params);
  const v0 = params.startMl;
  if (endMin(v0) > totalMin) {
    throw new RangeError(`변화가 끝나는 때 ${endMin(v0)}분이 시행 길이 ${totalMin}분을 넘습니다.`);
  }
  const volumeAt = (f: number) => v0 * (1 + EXPAND * f);
  const startVolume = volumeAt(frozenAt(params.process, v0, 0));
  const massG = v0 * WATER_G_PER_ML;
  const steps = Math.round(totalMin / sampleEveryMin);

  const samples: PhaseSample[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = round(i * sampleEveryMin, 6);
    const frozen = frozenAt(params.process, v0, t);
    const volume = volumeAt(frozen);
    samples.push({ t, dV: volume - startVolume, volume, frozen, tempC: tempAt(params.process, v0, t), massG });
  }
  const end = samples[samples.length - 1]!;
  return {
    samples,
    result: {
      dV: round(end.dV, 1),
      volumeEnd: round(end.volume, 1),
      mass: `${massG.toFixed(1)} g → ${massG.toFixed(1)} g`,
      massStart: massG,
      massEnd: massG,
    },
  };
}

/** 두 샘플 사이를 선형 보간한다. */
export function interpolatePhase(a: PhaseSample, b: PhaseSample, k: number): PhaseSample {
  const lerp = (x: number, y: number) => x + (y - x) * k;
  return {
    t: lerp(a.t, b.t),
    dV: lerp(a.dV, b.dV),
    volume: lerp(a.volume, b.volume),
    frozen: lerp(a.frozen, b.frozen),
    tempC: lerp(a.tempC, b.tempC),
    massG: lerp(a.massG, b.massG),
  };
}

const PHASE_KEYS = ['process', 'startMl', 'tube'] as const;

/** 매니페스트의 물의 상태 변화 실험이 모델이 다룰 수 있는 범위인지 검사한다. */
export function validatePhaseExperiment(exp: Experiment): string[] {
  const errors: string[] = [];
  const total = exp.params?.totalMin;
  const totalMin = typeof total === 'number' && Number.isFinite(total) && total > 0 ? total : null;
  if (totalMin === null) errors.push('params.totalMin은(는) 0보다 큰 숫자여야 합니다.');
  for (const key of PHASE_KEYS) {
    const v = exp.variables.find((x) => x.key === key);
    if (!v) {
      errors.push(`변인 "${key}"이(가) 없습니다.`);
      continue;
    }
    for (const o of v.options) {
      const val = o.value;
      const bad = (why: string) => errors.push(`변인 "${key}"의 선택지 값 ${JSON.stringify(val)}: ${why}`);
      if (key === 'process') {
        if (typeof val !== 'string' || !(PHASE_PROCESSES as readonly string[]).includes(val)) bad(`${PHASE_PROCESSES.join(', ')} 중 하나여야 합니다.`);
      } else if (key === 'tube') {
        if (typeof val !== 'string' || !(PHASE_TUBES as readonly string[]).includes(val)) bad(`${PHASE_TUBES.join(', ')} 중 하나여야 합니다.`);
      } else if (typeof val !== 'number' || !Number.isFinite(val)) {
        bad('숫자여야 합니다.');
      } else if (val < START_MIN || val > START_MAX) {
        bad(`처음 물의 양은 ${START_MIN}~${START_MAX} mL 범위여야 합니다.`);
      } else if (totalMin !== null && endMin(val) > totalMin) {
        bad(`변화가 끝나는 때 ${endMin(val)}분이 시행 길이 ${totalMin}분을 넘습니다.`);
      }
    }
  }
  return errors;
}
