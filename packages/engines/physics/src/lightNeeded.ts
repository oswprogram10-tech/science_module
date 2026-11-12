import type { VariableExperiment as Experiment } from '@sci/schema';

export const LN_FLASHLIGHTS = ['off', 'on'] as const;
export type LnFlashlight = (typeof LN_FLASHLIGHTS)[number];
export const LN_OBJECTS = ['doll', 'bulb'] as const;
export type LnObject = (typeof LN_OBJECTS)[number];
export const LN_BOXES = ['black', 'white'] as const;
export type LnBox = (typeof LN_BOXES)[number];
/** 구멍으로 본 물체(범주) */
export type LnVisible = 'hidden' | 'visible';

export interface LightNeededParams {
  /** 상자 안 손전등 */
  flashlight: LnFlashlight;
  /** 상자 안 물체: 인형 / 켜진 작은 전구 */
  object: LnObject;
  /** 상자 겉 색깔: 계산에 쓰지 않는 대조 변인(안쪽은 둘 다 검은색이라 빛이 새지 않는다) */
  boxColor: LnBox;
}

export interface LightNeededSample {
  /** 초 */
  t: number;
  /** 상자 안 밝기(눈금 0~10): 0에서 최종 값까지 올라간다. */
  level: number;
  /** 구멍으로 본 장면에 물체가 나타난 정도(0 깜깜함 ~ 1 보임). 보이지 않는 조건이면 내내 0이다. */
  seen: number;
}

export interface LightNeededResult {
  /** 상자 안 밝기(눈금 0~10), 정수 */
  brightness: number;
  /** 구멍으로 본 물체(범주) */
  visible: LnVisible;
}

export interface LightNeededOutput {
  samples: LightNeededSample[];
  result: LightNeededResult;
}

/** 구멍으로 본 물체 글자 */
export const LN_VISIBLE_LABEL: Record<LnVisible, string> = { hidden: '보이지 않음', visible: '보임' };

/** 조건별 결과 표(손전등 끔·켬). 수치는 근사값이며 교사 검수 대상이다. */
export const LN_TABLE: Record<LnObject, Record<LnFlashlight, LightNeededResult>> = {
  doll: { off: { brightness: 0, visible: 'hidden' }, on: { brightness: 8, visible: 'visible' } },
  bulb: { off: { brightness: 3, visible: 'visible' }, on: { brightness: 9, visible: 'visible' } },
};

export const LN_LEVEL_MAX = 10;
export const LN_TOTAL_S = 2;
export const LN_SAMPLE_S = 0.05;
/** 밝기는 1.5초 동안 올라가고 2초까지 멈춰 있다. */
export const LN_RISE_S = 1.5;
/** 화면에서 두 밝기를 같다고 보는 기준(눈금) */
export const LN_SAME_LEVEL = 0.5;

const roundTo = (x: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round(x * f) / f || 0;
};

const checkParams = (p: LightNeededParams): void => {
  const bad = (name: string, v: unknown, list: readonly string[]) => new RangeError(`${name} ${String(v)}은(는) ${list.join(', ')} 중 하나여야 합니다.`);
  if (!(LN_FLASHLIGHTS as readonly string[]).includes(p.flashlight)) throw bad('상자 안 손전등', p.flashlight, LN_FLASHLIGHTS);
  if (!(LN_OBJECTS as readonly string[]).includes(p.object)) throw bad('상자 안 물체', p.object, LN_OBJECTS);
  if (!(LN_BOXES as readonly string[]).includes(p.boxColor)) throw bad('상자 겉 색깔', p.boxColor, LN_BOXES);
};

/** 상자 안 밝기(눈금)와 구멍으로 본 물체. 상자 겉 색깔은 쓰지 않는다. */
export const lightNeededResultOf = (p: Pick<LightNeededParams, 'flashlight' | 'object'>): LightNeededResult => ({ ...LN_TABLE[p.object][p.flashlight] });

/**
 * 깜깜한 상자 안의 물체 보기. 수치는 근사값이며 교사 검수 대상이다. 난수 없음.
 * 인형은 손전등을 끄면 밝기 0·보이지 않음, 켜면 8·보임. 켜진 작은 전구는 손전등을 끄면 3·보임, 켜면 9·보임.
 * 상자 겉 색깔은 계산에 쓰지 않는다. 밝기는 0~1.5초 동안 올라가고 2초까지 멈춰 있다(0.05초 간격).
 */
export function simulateLightNeeded(params: LightNeededParams): LightNeededOutput {
  checkParams(params);
  const result = lightNeededResultOf(params);
  const steps = Math.round(LN_TOTAL_S / LN_SAMPLE_S);
  const samples: LightNeededSample[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = roundTo(i * LN_SAMPLE_S, 6);
    const u = Math.min(1, t / LN_RISE_S);
    const ease = 1 - (1 - u) * (1 - u);
    samples.push({ t, level: roundTo(result.brightness * ease, 9), seen: result.visible === 'visible' ? roundTo(ease, 9) : 0 });
  }
  return { samples, result };
}

/** 두 샘플 사이를 선형 보간한다. */
export function interpolateLightNeeded(a: LightNeededSample, b: LightNeededSample, k: number): LightNeededSample {
  const lerp = (x: number, y: number) => x + (y - x) * k;
  return { t: lerp(a.t, b.t), level: lerp(a.level, b.level), seen: lerp(a.seen, b.seen) };
}

const KEYS = ['flashlight', 'object', 'boxColor'] as const;
const ALLOWED: Record<(typeof KEYS)[number], readonly string[]> = { flashlight: LN_FLASHLIGHTS, object: LN_OBJECTS, boxColor: LN_BOXES };

/** 매니페스트의 물체를 보려면 빛이 필요할까 실험이 모델이 다룰 수 있는 범위인지 검사한다. */
export function validateLightNeededExperiment(exp: Experiment): string[] {
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
