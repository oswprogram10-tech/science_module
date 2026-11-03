import { capacityG, type Solute } from './solubility';

export interface DissolutionParams {
  solute: Solute;
  waterMl: number;
  waterTempC: number;
  stir: 0 | 1 | 2;
}

export interface DissolutionOptions {
  spoonGrams?: number;
  dt?: number;
  sampleEvery?: number;
  maxTimeS?: number;
}

export interface DissolutionSample {
  t: number;
  addedG: number;
  dissolvedG: number;
  undissolvedG: number;
}

export interface DissolutionResult {
  dissolvedG: number;
  spoonsFullyDissolved: number;
  timeS: number;
  saturated: boolean;
  truncated: boolean;
}

export interface DissolutionOutput {
  samples: DissolutionSample[];
  result: DissolutionResult;
}

export const BASE_RATE: readonly [number, number, number] = [0.05, 0.2, 0.5];

const EPS = 1e-9;
const round = (x: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round(x * f) / f;
};

/** 녹는 속도 (g/s). 젓기는 속도만 바꾼다. */
export function dissolveRate(stir: 0 | 1 | 2, tempC: number): number {
  return BASE_RATE[stir] * (1 + (tempC - 20) / 40);
}

export function simulateDissolution(
  params: DissolutionParams,
  opts: DissolutionOptions = {},
): DissolutionOutput {
  const { spoonGrams = 2, dt = 0.1, sampleEvery = 1, maxTimeS = 20000 } = opts;
  const capacity = capacityG(params.solute, params.waterTempC, params.waterMl);
  const rate = dissolveRate(params.stir, params.waterTempC);
  const sampleSteps = Math.max(1, Math.round(sampleEvery / dt));
  const maxSteps = Math.round(maxTimeS / dt);

  let added = spoonGrams;
  let dissolved = 0;
  let step = 0;
  let saturated = false;
  let truncated = false;
  const samples: DissolutionSample[] = [];
  const push = (s: number) =>
    samples.push({
      t: round(s * dt, 6),
      addedG: added,
      dissolvedG: dissolved,
      undissolvedG: added - dissolved,
    });
  push(0);

  for (;;) {
    step++;
    const undissolved = added - dissolved;
    dissolved += Math.min(rate * dt, undissolved, capacity - dissolved);
    if (dissolved > capacity) dissolved = capacity;
    // 넣은 숟가락이 다 녹으면 즉시 다음 숟가락을 넣는다.
    if (added - dissolved <= EPS) {
      dissolved = added;
      added += spoonGrams;
    }
    if (dissolved >= capacity - EPS && added - dissolved > EPS) saturated = true;
    else if (step >= maxSteps) truncated = true;

    const done = saturated || truncated;
    if (step % sampleSteps === 0 || done) push(step);
    if (done) break;
  }

  const timeS = round(step * dt, 6);
  const dissolvedG = round(dissolved, 1);
  return {
    samples,
    result: {
      dissolvedG,
      spoonsFullyDissolved: Math.floor(dissolvedG / spoonGrams + EPS),
      timeS,
      saturated,
      truncated,
    },
  };
}
