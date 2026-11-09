import type { VariableExperiment as Experiment } from '@sci/schema';

export const WASH_KINDS = ['rarely', 'often'] as const;
export type WashKind = (typeof WASH_KINDS)[number];
export const MASK_KINDS = ['off', 'on'] as const;
export type MaskKind = (typeof MASK_KINDS)[number];
export const SEAT_KINDS = ['front', 'back'] as const;
export type SeatKind = (typeof SEAT_KINDS)[number];

export interface SpreadParams {
  wash: WashKind;
  mask: MaskKind;
  /** 하루에 가까이 만나는 친구 수(명) */
  contacts: number;
  /** 처음 아픈 친구의 자리: 계산에 쓰지 않는 대조 변인 */
  seat: SeatKind;
}

export interface SpreadOptions {
  days?: number;
  /** 적분 간격(일) */
  dt?: number;
}

export interface SpreadSample {
  /** 날짜(일) */
  t: number;
  susceptible: number;
  sick: number;
  recovered: number;
  /** 지금까지 감염된 사람 = N − S */
  total: number;
}

export interface SpreadResult {
  /** 20일 동안 감염된 사람(처음 1명 포함), 반올림 정수 */
  total: number;
  /** 가장 많이 아팠던 날의 아픈 사람, 반올림 정수 */
  peak: number;
}

export interface SpreadOutput {
  samples: SpreadSample[];
  result: SpreadResult;
  /** 반올림 전 값 */
  raw: { total: number; peak: number };
}

/** 가상 반의 사람 수 (근사 모델, 교사 검수 대상) */
export const CLASS_SIZE = 30;
export const INITIAL_SICK = 1;
/** 만남 한 번당 옮을 확률 */
export const TRANSMISSION_PER_CONTACT = 0.08;
/** 회복률(/일) */
export const RECOVERY_PER_DAY = 0.2;
/** 줄임 배율 */
export const WASH_FACTOR = 0.6;
export const MASK_FACTOR = 0.5;
export const DEFAULT_DAYS = 20;
export const DEFAULT_DT = 0.05;
export const CONTACTS_MIN = 1;
export const CONTACTS_MAX = 15;

/** 습관에 따른 옮을 확률 배율(손 씻기 × 마스크) */
export const reduction = (p: Pick<SpreadParams, 'wash' | 'mask'>) => (p.wash === 'often' ? WASH_FACTOR : 1) * (p.mask === 'on' ? MASK_FACTOR : 1);

/** 만남 한 번에서 실제로 옮을 확률: p × 배율 */
export const chancePerContact = (p: Pick<SpreadParams, 'wash' | 'mask'>) => TRANSMISSION_PER_CONTACT * reduction(p);

/** β = contacts·p·(배율들의 곱) */
export const betaOf = (p: SpreadParams) => p.contacts * chancePerContact(p);

function checkParams(p: SpreadParams): void {
  if (!(WASH_KINDS as readonly string[]).includes(p.wash)) throw new RangeError(`손 씻기 ${String(p.wash)}은(는) ${WASH_KINDS.join(', ')} 중 하나여야 합니다.`);
  if (!(MASK_KINDS as readonly string[]).includes(p.mask)) throw new RangeError(`마스크 ${String(p.mask)}은(는) ${MASK_KINDS.join(', ')} 중 하나여야 합니다.`);
  if (!(SEAT_KINDS as readonly string[]).includes(p.seat)) throw new RangeError(`자리 ${String(p.seat)}은(는) ${SEAT_KINDS.join(', ')} 중 하나여야 합니다.`);
  if (!Number.isInteger(p.contacts) || p.contacts < CONTACTS_MIN || p.contacts > CONTACTS_MAX) {
    throw new RangeError(`만나는 친구 수 ${String(p.contacts)}은(는) ${CONTACTS_MIN}~${CONTACTS_MAX}명의 정수여야 합니다.`);
  }
}

/**
 * 우리 반 감염 전파 모델(SIR 단순화, 오일러 방법). 수치는 근사값이며 교사 검수 대상이다.
 * 매 단계: new = β·S·I/N·dt, rec = γ·I·dt → S −= new; I += new − rec; R += rec. 자리(seat)는 계산에 쓰지 않는다. 난수 없음.
 */
export function simulateSpread(params: SpreadParams, opts: SpreadOptions = {}): SpreadOutput {
  const { days = DEFAULT_DAYS, dt = DEFAULT_DT } = opts;
  checkParams(params);
  if (!(Number.isInteger(days) && days > 0)) throw new RangeError(`기간 ${days}일은 0보다 큰 정수여야 합니다.`);
  if (!(dt > 0 && dt <= 1)) throw new RangeError(`적분 간격 ${dt}은(는) 0보다 크고 1 이하여야 합니다.`);
  const beta = betaOf(params);
  const perDay = Math.round(1 / dt);
  let S = CLASS_SIZE - INITIAL_SICK;
  let I = INITIAL_SICK;
  let R = 0;
  let peak = I;
  const sample = (t: number): SpreadSample => ({ t, susceptible: S, sick: I, recovered: R, total: CLASS_SIZE - S });
  const samples: SpreadSample[] = [sample(0)];
  for (let day = 1; day <= days; day++) {
    for (let k = 0; k < perDay; k++) {
      const nw = ((beta * S * I) / CLASS_SIZE) * dt;
      const rec = RECOVERY_PER_DAY * I * dt;
      S -= nw;
      I += nw - rec;
      R += rec;
      if (I > peak) peak = I;
    }
    samples.push(sample(day));
  }
  const rawTotal = CLASS_SIZE - S;
  return { samples, result: { total: Math.round(rawTotal), peak: Math.round(peak) }, raw: { total: rawTotal, peak } };
}

/** 두 샘플 사이를 선형 보간한다. */
export function interpolateSpread(a: SpreadSample, b: SpreadSample, k: number): SpreadSample {
  const lerp = (x: number, y: number) => x + (y - x) * k;
  return { t: lerp(a.t, b.t), susceptible: lerp(a.susceptible, b.susceptible), sick: lerp(a.sick, b.sick), recovered: lerp(a.recovered, b.recovered), total: lerp(a.total, b.total) };
}

/** 반올림한 S/I/R 합이 N이 되도록 가장 큰 나머지 방식으로 정수 인원을 나눈다. 같은 나머지는 S, I, R 순서로 먼저 올린다. */
export function largestRemainder(values: number[], total: number = CLASS_SIZE): number[] {
  const sum = values.reduce((a, b) => a + b, 0);
  const scaled = values.map((v) => (sum > 0 ? (v / sum) * total : 0));
  const out = scaled.map((v) => Math.floor(v + 1e-9));
  let rest = total - out.reduce((a, b) => a + b, 0);
  const order = scaled.map((v, i) => ({ i, frac: v - Math.floor(v + 1e-9) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let j = 0; rest > 0; j = (j + 1) % order.length, rest--) out[order[j]!.i]! += 1;
  return out;
}

/** 샘플의 건강·아픔·나음 인원(합 30) */
export function headcount(s: Pick<SpreadSample, 'susceptible' | 'sick' | 'recovered'>): { healthy: number; sick: number; recovered: number } {
  const [healthy, sick, recovered] = largestRemainder([s.susceptible, s.sick, s.recovered]);
  return { healthy: healthy!, sick: sick!, recovered: recovered! };
}

const SPREAD_KEYS = ['wash', 'mask', 'contacts', 'seat'] as const;

/** 매니페스트의 감염 전파 실험이 모델이 다룰 수 있는 범위인지 검사한다. */
export function validateSpreadExperiment(exp: Experiment): string[] {
  const errors: string[] = [];
  const days = exp.params?.days;
  if (!(typeof days === 'number' && Number.isInteger(days) && days > 0)) errors.push('params.days은(는) 0보다 큰 정수여야 합니다.');
  for (const key of SPREAD_KEYS) {
    const v = exp.variables.find((x) => x.key === key);
    if (!v) {
      errors.push(`변인 "${key}"이(가) 없습니다.`);
      continue;
    }
    for (const o of v.options) {
      const val = o.value;
      const bad = (why: string) => errors.push(`변인 "${key}"의 선택지 값 ${JSON.stringify(val)}: ${why}`);
      const kinds = key === 'wash' ? WASH_KINDS : key === 'mask' ? MASK_KINDS : key === 'seat' ? SEAT_KINDS : null;
      if (kinds) {
        if (typeof val !== 'string' || !(kinds as readonly string[]).includes(val)) bad(`${kinds.join(', ')} 중 하나여야 합니다.`);
      } else if (typeof val !== 'number' || !Number.isInteger(val) || val < CONTACTS_MIN || val > CONTACTS_MAX) {
        bad(`만나는 친구 수는 ${CONTACTS_MIN}~${CONTACTS_MAX}명의 정수여야 합니다.`);
      }
    }
  }
  return errors;
}
