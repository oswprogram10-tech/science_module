import type { VariableExperiment as Experiment } from '@sci/schema';

export const ST_MEDIUMS = ['air', 'water', 'wood', 'string'] as const;
export type StMedium = (typeof ST_MEDIUMS)[number];
export const ST_BLOCKS = ['none', 'box', 'sponge', 'cotton'] as const;
export type StBlock = (typeof ST_BLOCKS)[number];
export const ST_CLOCKS = ['red', 'blue'] as const;
export type StClock = (typeof ST_CLOCKS)[number];
/** 귀에 들리나요(범주) */
export type StHeard = 'heard' | 'unheard';

export interface SoundTransmitParams {
  /** 소리를 전하는 것 */
  medium: StMedium;
  /** 소리 나는 물체(알람 시계)를 감싼 것 */
  block: StBlock;
  /** 알람 시계 색깔: 계산에 쓰지 않는 대조 변인 */
  clockColor: StClock;
}

export interface SoundTransmitSample {
  /** 초 */
  t: number;
  /** 소음계 눈금(0~10): 0에서 최종 값까지 올라간다. */
  level: number;
}

export interface SoundTransmitResult {
  /** 소음계 눈금(0~10), 정수 */
  level: number;
  /** 귀에 들리나요(범주) */
  heard: StHeard;
}

export interface SoundTransmitOutput {
  samples: SoundTransmitSample[];
  result: SoundTransmitResult;
}

export const ST_HEARD_LABEL: Record<StHeard, string> = { heard: '들림', unheard: '들리지 않음' };

/** 소리를 전하는 것에 따른 기본 눈금. 수치는 근사값이며 교사 검수 대상이다. */
export const ST_BASE_LEVEL: Record<StMedium, number> = { air: 5, water: 7, wood: 8, string: 7 };
/** 감싼 것에 따라 빼는 눈금 */
export const ST_CUT_LEVEL: Record<StBlock, number> = { none: 0, box: 1, sponge: 2, cotton: 3 };
export const ST_LEVEL_MAX = 10;
/** 눈금이 이 값 이상이면 귀에 들린다. */
export const ST_HEARD_MIN = 1;
export const ST_TOTAL_S = 2;
export const ST_SAMPLE_S = 0.05;
/** 바늘은 1.5초 동안 움직이고 2초까지 멈춰 있다. */
export const ST_RISE_S = 1.5;
/** 화면에서 두 눈금을 같다고 보는 기준 */
export const ST_SAME_LEVEL = 0.5;

const roundTo = (x: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round(x * f) / f || 0;
};

const checkParams = (p: SoundTransmitParams): void => {
  const bad = (name: string, v: unknown, list: readonly string[]) => new RangeError(`${name} ${String(v)}은(는) ${list.join(', ')} 중 하나여야 합니다.`);
  if (!(ST_MEDIUMS as readonly string[]).includes(p.medium)) throw bad('소리를 전하는 것', p.medium, ST_MEDIUMS);
  if (!(ST_BLOCKS as readonly string[]).includes(p.block)) throw bad('감싼 것', p.block, ST_BLOCKS);
  if (!(ST_CLOCKS as readonly string[]).includes(p.clockColor)) throw bad('알람 시계 색깔', p.clockColor, ST_CLOCKS);
};

/** 소음계 눈금 = max(0, 기본 눈금 − 감싼 것이 줄이는 눈금) */
export const soundTransmitLevelOf = (p: Pick<SoundTransmitParams, 'medium' | 'block'>): number => Math.max(0, ST_BASE_LEVEL[p.medium] - ST_CUT_LEVEL[p.block]);

/** 눈금이 1 이상이면 들림 */
export const heardOf = (level: number): StHeard => (level >= ST_HEARD_MIN ? 'heard' : 'unheard');

/**
 * 소리가 전달되는 물질과 소음 줄이기. 수치는 근사값이며 교사 검수 대상이다. 난수 없음.
 * 기본 눈금은 공기 5, 물 7, 책상 나무 8, 실 7. 감싼 것은 없음 0, 종이 상자 1, 스펀지 2, 솜 3을 빼고(0보다 작아지지 않는다),
 * 눈금이 1 이상이면 들린다. 알람 시계 색깔은 계산에 쓰지 않는다. 바늘은 0~1.5초 동안 움직이고 2초까지 멈춰 있다(0.05초 간격).
 */
export function simulateSoundTransmit(params: SoundTransmitParams): SoundTransmitOutput {
  checkParams(params);
  const level = soundTransmitLevelOf(params);
  const steps = Math.round(ST_TOTAL_S / ST_SAMPLE_S);
  const samples: SoundTransmitSample[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = roundTo(i * ST_SAMPLE_S, 6);
    const u = Math.min(1, t / ST_RISE_S);
    const ease = 1 - (1 - u) * (1 - u);
    samples.push({ t, level: roundTo(level * ease, 9) });
  }
  return { samples, result: { level, heard: heardOf(level) } };
}

/** 두 샘플 사이를 선형 보간한다. */
export function interpolateSoundTransmit(a: SoundTransmitSample, b: SoundTransmitSample, k: number): SoundTransmitSample {
  const lerp = (x: number, y: number) => x + (y - x) * k;
  return { t: lerp(a.t, b.t), level: lerp(a.level, b.level) };
}

const KEYS = ['medium', 'block', 'clockColor'] as const;
const ALLOWED: Record<(typeof KEYS)[number], readonly string[]> = { medium: ST_MEDIUMS, block: ST_BLOCKS, clockColor: ST_CLOCKS };

/** 매니페스트의 소리가 전달되는 물질과 소음 줄이기 실험이 모델이 다룰 수 있는 범위인지 검사한다. */
export function validateSoundTransmitExperiment(exp: Experiment): string[] {
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
