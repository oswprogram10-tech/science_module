import type { VariableExperiment as Experiment } from '@sci/schema';

export type MagnetCount = 1 | 2;
export type BetweenKind = 'none' | 'paper' | 'plastic' | 'iron';

export interface MagnetParams {
  /** 자석과 클립 더미 사이의 거리(cm). 0이면 닿는다. */
  gapCm: number;
  /** 자석의 수(겹침) */
  magnets: MagnetCount;
  /** 자석과 클립 사이에 둔 물체 */
  between: BetweenKind;
}

export interface MagnetOptions {
  /** 전체 시간(초) */
  totalS?: number;
  sampleEveryS?: number;
}

export interface MagnetSample {
  t: number;
  /** 클립 더미 위 자석의 높이(cm). 5에서 gapCm까지 내려왔다가 올라간다. */
  heightCm: number;
  /** 지금까지 끌려와 붙은 클립 수(정수). 한 번 붙으면 들어 올려도 붙어 있다. */
  clipsHeld: number;
  /** 화면용 "자석의 힘이 미치는 정도": 사이에 철판이 있으면 0, 아니면 자석의 세기. */
  reach: number;
}

export interface MagnetResult {
  /** 끝값(개), 정수 */
  clips: number;
}

export interface MagnetOutput {
  samples: MagnetSample[];
  result: MagnetResult;
}

export const MAGNET_COUNTS: readonly MagnetCount[] = [1, 2];
export const BETWEENS: readonly BetweenKind[] = ['none', 'paper', 'plastic', 'iron'];

/** 자석이 내려오기 전 높이(cm) */
export const START_HEIGHT_CM = 5;
/** 내려오는 시간의 끝(초) */
export const DOWN_END_S = 3;
/** 멈춰 있는 시간의 끝(초). 이때부터 올라간다. */
export const HOLD_END_S = 4;

const MAX_GAP_CM = 4;

/** 자석의 세기: 1개 1.0, 2개 1.6 */
export const strengthOf = (magnets: MagnetCount): number => (magnets === 2 ? 1.6 : 1);

const round = (x: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round(x * f) / f;
};

/** 자석에서 g cm 떨어진 클립 더미가 끌려올 수 있는 클립 수: floor(12·s / (1 + g/1.5)³). 철판이 있으면 0. */
export function clipsAt(gapCm: number, magnets: MagnetCount, between: BetweenKind): number {
  if (between === 'iron') return 0;
  return Math.floor((12 * strengthOf(magnets)) / (1 + gapCm / 1.5) ** 3 + 1e-9);
}

function checkParams(p: MagnetParams): void {
  if (typeof p.gapCm !== 'number' || !Number.isFinite(p.gapCm) || p.gapCm < 0 || p.gapCm > MAX_GAP_CM) {
    throw new RangeError(`자석과 클립 사이의 거리 ${String(p.gapCm)}은(는) 0 이상 ${MAX_GAP_CM} 이하(cm)여야 합니다.`);
  }
  if (!MAGNET_COUNTS.includes(p.magnets)) throw new RangeError(`자석의 수 ${String(p.magnets)}은(는) 1, 2 중 하나여야 합니다.`);
  if (!BETWEENS.includes(p.between)) throw new RangeError(`사이에 둔 물체 ${String(p.between)}은(는) none, paper, plastic, iron 중 하나여야 합니다.`);
}

/**
 * 자석과 클립 모델. 수치는 근사값이며 교사 검수 대상이다.
 * 자석은 0~3 s에 5 cm에서 gapCm까지 일정하게 내려오고, 3~4 s에 멈췄다가, 4~6 s에 5 cm까지 올라간다.
 * 붙은 클립 수 = 지금까지 지나온 가장 낮은 높이에서 끌려올 수 있는 클립 수. 종이·플라스틱은 결과를 바꾸지 않고 철판이면 0이다.
 */
export function simulateMagnet(params: MagnetParams, opts: MagnetOptions = {}): MagnetOutput {
  const { totalS = 6, sampleEveryS = 0.05 } = opts;
  checkParams(params);
  if (!(totalS > 0) || !(sampleEveryS > 0)) throw new RangeError('시간과 표본 간격은 0보다 커야 합니다.');

  const { gapCm, magnets, between } = params;
  const reach = between === 'iron' ? 0 : strengthOf(magnets);
  const heightAt = (t: number) => {
    if (t <= DOWN_END_S) return START_HEIGHT_CM + ((gapCm - START_HEIGHT_CM) * t) / DOWN_END_S;
    if (t <= HOLD_END_S) return gapCm;
    return Math.min(START_HEIGHT_CM, gapCm + ((START_HEIGHT_CM - gapCm) * (t - HOLD_END_S)) / (totalS - HOLD_END_S));
  };
  const at = (t: number): MagnetSample => {
    const heightCm = heightAt(t);
    // 지나온 가장 낮은 높이: 내려오는 동안은 지금 높이, 그 뒤에는 gapCm
    const lowest = t <= DOWN_END_S ? heightCm : gapCm;
    return { t: round(t, 6), heightCm: round(heightCm, 6), clipsHeld: clipsAt(lowest, magnets, between), reach };
  };

  const steps = Math.floor(totalS / sampleEveryS + 1e-9);
  const samples: MagnetSample[] = [];
  for (let i = 0; i <= steps; i++) samples.push(at(round(i * sampleEveryS, 6)));
  if (samples[samples.length - 1]!.t < totalS - 1e-9) samples.push(at(totalS));

  return { samples, result: { clips: samples[samples.length - 1]!.clipsHeld } };
}

/** 두 샘플 사이를 보간한다. 붙은 클립 수는 정수라서 다음 표본에 닿기 전까지 앞 값을 그대로 쓴다. */
export function interpolateMagnet(a: MagnetSample, b: MagnetSample, k: number): MagnetSample {
  const lerp = (x: number, y: number) => x + (y - x) * k;
  return { t: lerp(a.t, b.t), heightCm: lerp(a.heightCm, b.heightCm), clipsHeld: k >= 1 ? b.clipsHeld : a.clipsHeld, reach: lerp(a.reach, b.reach) };
}

const KEYS = ['gapCm', 'magnets', 'between'] as const;

/** 매니페스트의 자석 실험이 모델이 다룰 수 있는 범위인지 검사한다. */
export function validateMagnetExperiment(exp: Experiment): string[] {
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
      if (key === 'gapCm') {
        if (typeof val !== 'number' || !Number.isFinite(val)) bad('숫자여야 합니다.');
        else if (val < 0 || val > MAX_GAP_CM) bad(`거리는 0~${MAX_GAP_CM} cm 범위여야 합니다.`);
      } else if (key === 'magnets') {
        if (val !== 1 && val !== 2) bad('1 또는 2여야 합니다.');
      } else if (typeof val !== 'string' || !BETWEENS.includes(val as BetweenKind)) {
        bad(`${BETWEENS.join(', ')} 중 하나여야 합니다.`);
      }
    }
  }
  return errors;
}
