import type { VariableExperiment as Experiment } from '@sci/schema';

export type Strength = 'weak' | 'strong';
export type StringColor = 'red' | 'yellow';

export interface StringSoundParams {
  /** 튕기는 세기 */
  strength: Strength;
  /** 떨리는 줄의 길이(cm) */
  lengthCm: number;
  /** 고무줄 색. 계산에는 쓰지 않는다(대조 변인). */
  color: StringColor;
}

export interface StringSoundOptions {
  /** 보여 주는 시간 창(ms) */
  windowMs?: number;
  /** 표본 간격(ms) */
  sampleEveryMs?: number;
}

export interface StringSoundSample {
  /** 시각(ms) */
  t: number;
  /** 줄의 떨림(-A~A) */
  displacement: number;
  /** 떨림의 크기 A */
  amplitude: number;
  /** 1초 동안 떨린 횟수(번) */
  freq: number;
  /** 소리의 크기(가상 소리 센서 눈금) */
  level: number;
}

export interface StringSoundResult {
  /** 1초 동안 떨린 횟수(번), 정수 */
  freq: number;
  /** 소리의 크기(눈금), 소수 첫째 자리 */
  level: number;
  /** 시간 창 안의 물결 개수(freq × 창), 소수 첫째 자리. 결과표에는 쓰지 않는다. */
  wavesInWindow: number;
}

export interface StringSoundOutput {
  samples: StringSoundSample[];
  result: StringSoundResult;
}

export const STRENGTHS: readonly Strength[] = ['weak', 'strong'];
export const STRING_COLORS: readonly StringColor[] = ['red', 'yellow'];

/** 줄의 길이(cm)에 곱해 1초 동안 떨린 횟수가 되는 상수: freq = 6600 / 길이 */
const FREQ_CONST = 6600;
/** 떨림의 크기 */
export const AMPLITUDE: Record<Strength, number> = { weak: 0.4, strong: 1 };
/** A = 1일 때 소리의 크기 눈금(기준) */
const LEVEL_BASE = 70;
const MIN_CM = 10;
const MAX_CM = 40;

const round = (x: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round(x * f) / f;
};

/** 소리의 크기 눈금: 70 + 20·log10(A), 소수 첫째 자리 */
export const levelOf = (amplitude: number) => round(LEVEL_BASE + 20 * Math.log10(amplitude), 1);

function checkParams(p: StringSoundParams): void {
  if (!STRENGTHS.includes(p.strength)) throw new RangeError(`튕기는 세기 ${String(p.strength)}은(는) weak, strong 중 하나여야 합니다.`);
  if (!Number.isFinite(p.lengthCm) || p.lengthCm < MIN_CM || p.lengthCm > MAX_CM) throw new RangeError(`줄의 길이 ${String(p.lengthCm)}은(는) ${MIN_CM} 이상 ${MAX_CM} 이하(cm)여야 합니다.`);
  if (!STRING_COLORS.includes(p.color)) throw new RangeError(`고무줄 색 ${String(p.color)}은(는) red, yellow 중 하나여야 합니다.`);
}

/**
 * 줄의 떨림 모델. 수치는 근사값이며 교사 검수 대상이다.
 * 떨린 횟수 freq = 6600 / 길이(cm), 떨림의 크기 A는 약하게 0.4·세게 1.0,
 * 소리의 크기 = 70 + 20·log10(A). 20 ms 안의 감쇠는 무시하고 색은 계산에 쓰지 않는다.
 */
export function simulateStringSound(params: StringSoundParams, opts: StringSoundOptions = {}): StringSoundOutput {
  const { windowMs = 20, sampleEveryMs = 0.1 } = opts;
  checkParams(params);
  if (!(windowMs > 0) || !(sampleEveryMs > 0)) throw new RangeError('시간과 표본 간격은 0보다 커야 합니다.');

  const amplitude = AMPLITUDE[params.strength];
  const freq = Math.round(FREQ_CONST / params.lengthCm);
  const level = levelOf(amplitude);
  const at = (t: number): StringSoundSample => ({
    t: round(t, 6),
    // + 0: -0을 0으로
    displacement: amplitude * Math.sin((2 * Math.PI * freq * t) / 1000) + 0,
    amplitude,
    freq,
    level,
  });

  const steps = Math.floor(windowMs / sampleEveryMs + 1e-9);
  const samples: StringSoundSample[] = [];
  for (let i = 0; i <= steps; i++) samples.push(at(i * sampleEveryMs));
  if (samples[samples.length - 1]!.t < windowMs - 1e-9) samples.push(at(windowMs));

  return { samples, result: { freq, level, wavesInWindow: round((freq * windowMs) / 1000, 1) } };
}

/** 두 샘플 사이를 선형 보간한다. */
export function interpolateStringSound(a: StringSoundSample, b: StringSoundSample, k: number): StringSoundSample {
  const lerp = (x: number, y: number) => x + (y - x) * k;
  return {
    t: lerp(a.t, b.t),
    displacement: lerp(a.displacement, b.displacement),
    amplitude: lerp(a.amplitude, b.amplitude),
    freq: lerp(a.freq, b.freq),
    level: lerp(a.level, b.level),
  };
}

const KEYS = ['strength', 'lengthCm', 'color'] as const;

/** 매니페스트의 줄 소리 실험이 모델이 다룰 수 있는 범위인지 검사한다. */
export function validateStringSoundExperiment(exp: Experiment): string[] {
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
      if (key === 'lengthCm') {
        if (typeof val !== 'number' || !Number.isFinite(val)) bad('숫자여야 합니다.');
        else if (val < MIN_CM || val > MAX_CM) bad(`줄의 길이는 ${MIN_CM}~${MAX_CM} cm 범위여야 합니다.`);
      } else if (key === 'strength') {
        if (typeof val !== 'string' || !STRENGTHS.includes(val as Strength)) bad(`${STRENGTHS.join(', ')} 중 하나여야 합니다.`);
      } else if (typeof val !== 'string' || !STRING_COLORS.includes(val as StringColor)) {
        bad(`${STRING_COLORS.join(', ')} 중 하나여야 합니다.`);
      }
    }
  }
  return errors;
}
