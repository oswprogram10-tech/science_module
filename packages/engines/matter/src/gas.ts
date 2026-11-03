import type { Experiment } from '@sci/schema';

export const GAS_TYPES = ['air', 'oxygen', 'carbonDioxide'] as const;
export type GasType = (typeof GAS_TYPES)[number];

export interface GasParams {
  push: 0 | 1 | 2;
  bathTempC: number;
  gasType: GasType;
  startMl: number;
}

export interface GasOptions {
  dt?: number;
  sampleEvery?: number;
  durationS?: number;
  syringeMaxMl?: number;
}

export interface GasSample {
  t: number;
  volumeMl: number;
  pressureAtm: number;
  gasTempC: number;
}

export interface GasResult {
  volumeMl: number;
  changeMl: number;
  settleS: number;
}

export interface GasOutput {
  samples: GasSample[];
  result: GasResult;
}

/** 누르는 힘 단계별 가하는 압력(대기압의 배수). */
export const EXTERNAL_PRESSURE: readonly [number, number, number] = [1, 1.25, 2];
export const ROOM_TEMP_C = 20;
export const PRESSURE_TAU_S = 0.5;
export const TEMP_TAU_S = 6;
const KELVIN = 273.15;
const REF_K = ROOM_TEMP_C + KELVIN;

const round = (x: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round(x * f) / f;
};

function checkParams(p: GasParams): void {
  if (![0, 1, 2].includes(p.push)) {
    throw new RangeError(`누르는 힘 ${String(p.push)}은(는) 0, 1, 2 중 하나여야 합니다.`);
  }
  if (typeof p.bathTempC !== 'number' || !Number.isFinite(p.bathTempC)) {
    throw new RangeError(`물의 온도 ${String(p.bathTempC)}은(는) 유한한 수여야 합니다.`);
  }
  if (!(GAS_TYPES as readonly string[]).includes(p.gasType)) {
    throw new RangeError(`기체의 종류 ${String(p.gasType)}은(는) ${GAS_TYPES.join(', ')} 중 하나여야 합니다.`);
  }
  if (typeof p.startMl !== 'number' || !Number.isFinite(p.startMl) || !(p.startMl > 0)) {
    throw new RangeError(`처음 부피 ${String(p.startMl)}은(는) 0보다 큰 유한한 수여야 합니다.`);
  }
}

/** 주사기에 갇힌 기체의 부피 변화. 기체 종류는 부피에 영향을 주지 않는다(알갱이 색만 바뀐다). */
export function simulateGas(params: GasParams, opts: GasOptions = {}): GasOutput {
  const { dt = 0.05, sampleEvery = 0.25, durationS = 30, syringeMaxMl = 60 } = opts;
  checkParams(params);
  const pExt = EXTERNAL_PRESSURE[params.push];
  const sampleSteps = Math.max(1, Math.round(sampleEvery / dt));
  const steps = Math.round(durationS / dt);

  const samples: GasSample[] = [];
  for (let step = 0; step <= steps; step++) {
    if (step % sampleSteps !== 0 && step !== steps) continue;
    const t = round(step * dt, 6);
    const pressureAtm = 1 + (pExt - 1) * (1 - Math.exp(-t / PRESSURE_TAU_S));
    const gasTempC = ROOM_TEMP_C + (params.bathTempC - ROOM_TEMP_C) * (1 - Math.exp(-t / TEMP_TAU_S));
    const volumeMl = (params.startMl / pressureAtm) * ((gasTempC + KELVIN) / REF_K);
    if (volumeMl > syringeMaxMl) {
      throw new RangeError(`기체의 부피 ${volumeMl.toFixed(1)} mL가 주사기 눈금 ${syringeMaxMl} mL를 넘습니다.`);
    }
    samples.push({ t, volumeMl, pressureAtm, gasTempC });
  }

  const finalVol = samples[samples.length - 1]!.volumeMl;
  // 안정 시각: 마지막 값의 ±1% 안에 처음 들어와 그 뒤로 벗어나지 않는 시각
  const tol = Math.abs(finalVol) * 0.01;
  let settleIdx = samples.length - 1;
  while (settleIdx > 0 && Math.abs(samples[settleIdx - 1]!.volumeMl - finalVol) <= tol) settleIdx--;

  return {
    samples,
    result: {
      volumeMl: round(finalVol, 1),
      changeMl: round(finalVol - params.startMl, 1),
      settleS: round(samples[settleIdx]!.t, 1),
    },
  };
}

/** 두 샘플 사이를 선형 보간한다. */
export function interpolateGas(a: GasSample, b: GasSample, k: number): GasSample {
  const lerp = (x: number, y: number) => x + (y - x) * k;
  return {
    t: lerp(a.t, b.t),
    volumeMl: lerp(a.volumeMl, b.volumeMl),
    pressureAtm: lerp(a.pressureAtm, b.pressureAtm),
    gasTempC: lerp(a.gasTempC, b.gasTempC),
  };
}

const GAS_KEYS = ['push', 'bathTempC', 'gasType', 'startMl'] as const;

/** 매니페스트의 기체 실험이 모델이 다룰 수 있는 범위인지 검사한다. */
export function validateGasExperiment(exp: Experiment): string[] {
  const errors: string[] = [];
  const opts: Record<string, (string | number)[]> = {};
  for (const key of GAS_KEYS) {
    const v = exp.variables.find((x) => x.key === key);
    if (!v) {
      errors.push(`변인 "${key}"이(가) 없습니다.`);
      continue;
    }
    opts[key] = v.options.map((o) => o.value);
    for (const val of opts[key]!) {
      const bad = (why: string) => errors.push(`변인 "${key}"의 선택지 값 ${JSON.stringify(val)}: ${why}`);
      if (key === 'push') {
        if (val !== 0 && val !== 1 && val !== 2) bad('0, 1, 2 중 하나여야 합니다.');
      } else if (key === 'bathTempC') {
        if (typeof val !== 'number' || !Number.isFinite(val)) bad('숫자여야 합니다.');
        else if (val < 0 || val > 80) bad('온도는 0~80 °C 범위여야 합니다.');
      } else if (key === 'gasType') {
        if (typeof val !== 'string' || !(GAS_TYPES as readonly string[]).includes(val)) {
          bad(`${GAS_TYPES.join(', ')} 중 하나여야 합니다.`);
        }
      } else if (key === 'startMl') {
        if (typeof val !== 'number' || !Number.isFinite(val)) bad('숫자여야 합니다.');
        else if (!(val > 0)) bad('0보다 커야 합니다.');
      }
    }
  }
  const max = exp.params?.syringeMaxMl;
  if (typeof max !== 'number' || !Number.isFinite(max) || !(max > 0)) {
    errors.push('params.syringeMaxMl은(는) 0보다 큰 숫자여야 합니다.');
  }
  if (errors.length > 0) return errors;

  // 모든 조합이 주사기 눈금 안에 들어오는지 확인한다.
  for (const push of opts.push!) {
    for (const bathTempC of opts.bathTempC!) {
      for (const startMl of opts.startMl!) {
        try {
          simulateGas(
            { push: push as 0 | 1 | 2, bathTempC: bathTempC as number, gasType: 'air', startMl: startMl as number },
            { syringeMaxMl: max as number },
          );
        } catch (e) {
          errors.push(
            `조건(누르는 힘 ${push}, ${bathTempC} °C, ${startMl} mL)에서 주사기 눈금을 넘습니다: ${(e as Error).message}`,
          );
        }
      }
    }
  }
  return errors;
}
