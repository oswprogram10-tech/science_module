import type { VariableExperiment as Experiment } from '@sci/schema';

/** 배율 */
export const MC_POWERS = [40, 100, 400] as const;
export type McPower = (typeof MC_POWERS)[number];
export const MC_FOCUS = ['off', 'on'] as const;
export type McFocus = (typeof MC_FOCUS)[number];
export const MC_STAINS = ['none', 'iodine'] as const;
export type McStain = (typeof MC_STAINS)[number];
export const MC_SAMPLES = ['onion', 'cheek'] as const;
export type McSample = (typeof MC_SAMPLES)[number];
/** 받침 유리 이름표 색: 계산에 쓰지 않는 대조 변인 */
export const MC_LABELS = ['yellow', 'green'] as const;
export type McLabel = (typeof MC_LABELS)[number];
/** 보인 것(범주). 값이 곧 결과표와 튜터 입력에 쓰는 글자다. */
export const MC_SEEN = { blurry: '흐릿함', clear: '투명한 칸들', tinted: '색이 든 칸들', dots: '칸마다 진한 점이 있음' } as const;
export type McSeen = (typeof MC_SEEN)[keyof typeof MC_SEEN];

export interface MicroscopeParams {
  power: McPower;
  focus: McFocus;
  stain: McStain;
  sample: McSample;
  slideLabel: McLabel;
}

export interface MicroscopeSample {
  /** 초 */
  t: number;
  /** 화면에서 본 칸 하나의 길이(mm). 초점을 맞추지 않으면 NaN(칸이 보이지 않는다). */
  size: number;
  /** 초점이 맞은 정도(0 흐림 ~ 1 또렷함). 초점을 맞추지 않으면 내내 0이다. */
  sharp: number;
}

export interface MicroscopeResult {
  /** 화면에서 본 칸 하나의 길이(mm), 정수. 초점을 맞추지 않으면 NaN. */
  size: number;
  /** 보인 것(범주) */
  seen: McSeen;
}

export interface MicroscopeOutput {
  samples: MicroscopeSample[];
  result: MicroscopeResult;
}

/** 실제 칸 하나의 길이(µm): 양파 표피 0.25 mm, 입안 안쪽 표피 0.06 mm */
export const MC_CELL_UM: Record<McSample, number> = { onion: 250, cheek: 60 };

export const MC_TOTAL_S = 2;
export const MC_SAMPLE_S = 0.05;
/** 초점은 1.2초 동안 맞춰지고 2초까지 멈춰 있다. */
export const MC_RISE_S = 1.2;
/** 화면에서 두 칸 길이를 같다고 보는 기준(mm) */
export const MC_SAME_MM = 0.5;
/** 칸 길이 그래프의 y축 끝(mm). 가장 큰 값은 양파 400배의 100 mm. */
export const MC_SIZE_MAX = 110;

const roundTo = (x: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round(x * f) / f || 0;
};

const checkParams = (p: MicroscopeParams): void => {
  const bad = (name: string, v: unknown, list: readonly (string | number)[]) => new RangeError(`${name} ${String(v)}은(는) ${list.join(', ')} 중 하나여야 합니다.`);
  if (!(MC_POWERS as readonly number[]).includes(Number(p.power))) throw bad('배율', p.power, MC_POWERS);
  if (!(MC_FOCUS as readonly string[]).includes(p.focus)) throw bad('초점', p.focus, MC_FOCUS);
  if (!(MC_STAINS as readonly string[]).includes(p.stain)) throw bad('염색', p.stain, MC_STAINS);
  if (!(MC_SAMPLES as readonly string[]).includes(p.sample)) throw bad('관찰 재료', p.sample, MC_SAMPLES);
  if (!(MC_LABELS as readonly string[]).includes(p.slideLabel)) throw bad('받침 유리 이름표 색', p.slideLabel, MC_LABELS);
};

/** 화면에서 본 칸 하나의 길이(mm) = 실제 길이 × 배율, 정수. 초점이 맞지 않으면 NaN. */
export const microscopeSizeOf = (p: Pick<MicroscopeParams, 'power' | 'focus' | 'sample'>): number =>
  p.focus === 'on' ? Math.round((MC_CELL_UM[p.sample] * Number(p.power)) / 1000) : Number.NaN;

/** 보인 것: 초점 안 맞춤 흐릿함 / 맞춤·염색 안 함 투명한 칸들 / 맞춤·염색함 40배 색이 든 칸들, 100·400배 칸마다 진한 점 */
export const microscopeSeenOf = (p: Pick<MicroscopeParams, 'power' | 'focus' | 'stain'>): McSeen => {
  if (p.focus !== 'on') return MC_SEEN.blurry;
  if (p.stain !== 'iodine') return MC_SEEN.clear;
  return Number(p.power) === 40 ? MC_SEEN.tinted : MC_SEEN.dots;
};

export const microscopeResultOf = (p: MicroscopeParams): MicroscopeResult => ({ size: microscopeSizeOf(p), seen: microscopeSeenOf(p) });

/**
 * 현미경으로 세포 관찰하기. 수치는 근사값이며 교사 검수 대상이다. 난수 없음.
 * 칸 길이는 실제 길이 × 배율이다. 받침 유리 이름표 색은 계산에 쓰지 않는다. 초점을 맞추면 0~1.2초 동안 또렷해진다(0.05초 간격).
 */
export function simulateMicroscope(params: MicroscopeParams): MicroscopeOutput {
  checkParams(params);
  const result = microscopeResultOf(params);
  const steps = Math.round(MC_TOTAL_S / MC_SAMPLE_S);
  const samples: MicroscopeSample[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = roundTo(i * MC_SAMPLE_S, 6);
    const u = Math.min(1, t / MC_RISE_S);
    const ease = 1 - (1 - u) * (1 - u);
    samples.push({
      t,
      size: Number.isNaN(result.size) ? Number.NaN : roundTo(result.size * ease, 9),
      sharp: params.focus === 'on' ? roundTo(ease, 9) : 0,
    });
  }
  return { samples, result };
}

/** 두 샘플 사이를 선형 보간한다. 값이 없는(NaN) 칸 길이는 NaN으로 남는다. */
export function interpolateMicroscope(a: MicroscopeSample, b: MicroscopeSample, k: number): MicroscopeSample {
  const lerp = (x: number, y: number) => x + (y - x) * k;
  return { t: lerp(a.t, b.t), size: lerp(a.size, b.size), sharp: lerp(a.sharp, b.sharp) };
}

const KEYS = ['power', 'focus', 'stain', 'sample', 'slideLabel'] as const;
const ALLOWED: Record<(typeof KEYS)[number], readonly (string | number)[]> = { power: MC_POWERS, focus: MC_FOCUS, stain: MC_STAINS, sample: MC_SAMPLES, slideLabel: MC_LABELS };

/** 매니페스트의 현미경으로 세포 관찰하기 실험이 모델이 다룰 수 있는 범위인지 검사한다. */
export function validateMicroscopeExperiment(exp: Experiment): string[] {
  const errors: string[] = [];
  for (const key of KEYS) {
    const v = exp.variables.find((x) => x.key === key);
    if (!v) {
      errors.push(`변인 "${key}"이(가) 없습니다.`);
      continue;
    }
    for (const o of v.options) {
      if (!ALLOWED[key].includes(o.value as never)) errors.push(`변인 "${key}"의 선택지 값 ${JSON.stringify(o.value)}: ${ALLOWED[key].join(', ')} 중 하나여야 합니다.`);
    }
  }
  return errors;
}
