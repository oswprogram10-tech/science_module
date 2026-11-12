import type { VariableExperiment as Experiment } from '@sci/schema';

export const TH_HANDS = ['none', 'cold', 'warm'] as const;
export type ThHand = (typeof TH_HANDS)[number];
export const TH_TARGETS = ['water', 'rod', 'wood'] as const;
export type ThTarget = (typeof TH_TARGETS)[number];
export const TH_TOOLS = ['alcohol', 'ir'] as const;
export type ThTool = (typeof TH_TOOLS)[number];
export const TH_EYES = ['above', 'level', 'below'] as const;
export type ThEye = (typeof TH_EYES)[number];
/** 손 느낌(범주): 차갑게 → 미지근하게 → 따뜻하게 */
export const TH_FEELS = ['cold', 'lukewarm', 'warm'] as const;
export type ThFeel = (typeof TH_FEELS)[number];

export interface ThermometerParams {
  /** 먼저 손을 넣었던 물 */
  hand: ThHand;
  /** 재는 것 */
  target: ThTarget;
  /** 온도계 */
  tool: ThTool;
  /** 눈금을 읽은 눈높이: 알코올 온도계에만 영향 */
  eye: ThEye;
}

export interface ThermometerSample {
  /** 초 */
  t: number;
  /** 온도계 눈금(°C): 처음 온도에서 읽은 값까지 올라간다. */
  level: number;
  /** 온도계가 잰 실제 온도(°C): 눈높이의 영향이 없다. */
  trueC: number;
  /** 손 느낌이 나타난 정도(0 ~ 1): 실행 전에는 그리지 않는다. */
  felt: number;
}

export interface ThermometerResult {
  /** 온도계 눈금(°C), 정수 */
  reading: number;
  /** 손 느낌(범주) */
  feel: ThFeel;
}

export interface ThermometerOutput {
  samples: ThermometerSample[];
  result: ThermometerResult;
}

export const TH_FEEL_LABEL: Record<ThFeel, string> = { cold: '차갑게 느껴짐', lukewarm: '미지근하게 느껴짐', warm: '따뜻하게 느껴짐' };

/** 실제 온도(°C): 미지근한 물 25, 같은 방의 철봉 22, 나무 판 22 */
export const TH_TRUE_C: Record<ThTarget, number> = { water: 25, rod: 22, wood: 22 };
/** 손을 넣지 않았을 때의 손 느낌 */
export const TH_BASE_FEEL: Record<ThTarget, ThFeel> = { water: 'lukewarm', rod: 'cold', wood: 'lukewarm' };
/** 눈금을 읽는 눈높이에 따라 알코올 온도계 값이 어긋나는 정도(°C) */
export const TH_EYE_SHIFT: Record<ThEye, number> = { above: 1, level: 0, below: -1 };

export const TH_START_C = 20;
export const TH_TOTAL_S = 2;
export const TH_SAMPLE_S = 0.05;
/** 눈금은 1.5초 동안 오르고 2초까지 멈춰 있다. */
export const TH_RISE_S = 1.5;
/** 화면에서 두 눈금을 같다고 보는 기준(°C) */
export const TH_SAME_C = 0.5;

const roundTo = (x: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round(x * f) / f || 0;
};

const checkParams = (p: ThermometerParams): void => {
  const bad = (name: string, v: unknown, list: readonly string[]) => new RangeError(`${name} ${String(v)}은(는) ${list.join(', ')} 중 하나여야 합니다.`);
  if (!(TH_HANDS as readonly string[]).includes(p.hand)) throw bad('먼저 손을 넣었던 물', p.hand, TH_HANDS);
  if (!(TH_TARGETS as readonly string[]).includes(p.target)) throw bad('재는 것', p.target, TH_TARGETS);
  if (!(TH_TOOLS as readonly string[]).includes(p.tool)) throw bad('온도계', p.tool, TH_TOOLS);
  if (!(TH_EYES as readonly string[]).includes(p.eye)) throw bad('눈높이', p.eye, TH_EYES);
};

/** 손 느낌: 찬물에 넣었던 손은 한 단계 따뜻하게, 따뜻한 물에 넣었던 손은 한 단계 차갑게 느낀다(끝 단계에서 멈춤). */
export const feelOf = (p: Pick<ThermometerParams, 'hand' | 'target'>): ThFeel => {
  const base = TH_FEELS.indexOf(TH_BASE_FEEL[p.target]);
  const shift = p.hand === 'cold' ? 1 : p.hand === 'warm' ? -1 : 0;
  return TH_FEELS[Math.min(TH_FEELS.length - 1, Math.max(0, base + shift))]!;
};

/** 온도계 눈금(°C): 알코올 온도계는 눈높이에 따라 ±1, 적외선 온도계는 언제나 실제 온도 */
export const readingOf = (p: Pick<ThermometerParams, 'target' | 'tool' | 'eye'>): number => TH_TRUE_C[p.target] + (p.tool === 'alcohol' ? TH_EYE_SHIFT[p.eye] : 0);

export const thermometerResultOf = (p: ThermometerParams): ThermometerResult => ({ reading: readingOf(p), feel: feelOf(p) });

/**
 * 손 느낌과 온도계로 온도 재기. 수치는 근사값이며 교사 검수 대상이다. 난수 없음.
 * 눈금은 20 °C에서 0~1.5초 동안 읽은 값까지 올라가 2초까지 멈춰 있고(0.05초 간격), 손 느낌 표시는 1.5초에 완전히 나타난다.
 */
export function simulateThermometer(params: ThermometerParams): ThermometerOutput {
  checkParams(params);
  const result = thermometerResultOf(params);
  const trueC = TH_TRUE_C[params.target];
  const steps = Math.round(TH_TOTAL_S / TH_SAMPLE_S);
  const samples: ThermometerSample[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = roundTo(i * TH_SAMPLE_S, 6);
    const u = Math.min(1, t / TH_RISE_S);
    const ease = 1 - (1 - u) * (1 - u);
    samples.push({ t, level: roundTo(TH_START_C + (result.reading - TH_START_C) * ease, 9), trueC: roundTo(TH_START_C + (trueC - TH_START_C) * ease, 9), felt: roundTo(u, 9) });
  }
  return { samples, result };
}

/** 두 샘플 사이를 선형 보간한다. */
export function interpolateThermometer(a: ThermometerSample, b: ThermometerSample, k: number): ThermometerSample {
  const lerp = (x: number, y: number) => x + (y - x) * k;
  return { t: lerp(a.t, b.t), level: lerp(a.level, b.level), trueC: lerp(a.trueC, b.trueC), felt: lerp(a.felt, b.felt) };
}

const KEYS = ['hand', 'target', 'tool', 'eye'] as const;
const ALLOWED: Record<(typeof KEYS)[number], readonly string[]> = { hand: TH_HANDS, target: TH_TARGETS, tool: TH_TOOLS, eye: TH_EYES };

/** 매니페스트의 온도계로 온도 재기 실험이 모델이 다룰 수 있는 범위인지 검사한다. */
export function validateThermometerExperiment(exp: Experiment): string[] {
  const errors: string[] = [];
  for (const key of KEYS) {
    const v = exp.variables.find((x) => x.key === key);
    if (!v) {
      errors.push(`변인 "${key}"이(가) 없습니다.`);
      continue;
    }
    for (const o of v.options) {
      if (typeof o.value !== 'string' || !ALLOWED[key].includes(o.value)) errors.push(`변인 "${key}"의 선택지 값 ${JSON.stringify(o.value)}: ${ALLOWED[key].join(', ')} 중 하나여야 합니다.`);
    }
  }
  return errors;
}
