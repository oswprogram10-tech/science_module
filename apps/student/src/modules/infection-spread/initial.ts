import { CLASS_SIZE, headcount, simulateSpread, type MaskKind, type SeatKind, type SpreadParams, type SpreadResult, type SpreadSample, type WashKind } from '@sci/engine-ssi';
import type { Values } from '@sci/gateway';
import type { VariableExperiment } from '@sci/schema';

/** 매니페스트 params에서 모델 옵션을 읽는다. */
export const spreadOptions = (exp?: VariableExperiment) => ({
  days: typeof exp?.params?.days === 'number' ? exp.params.days : undefined,
});

export const toParams = (values: Values): SpreadParams => ({
  wash: (values.wash === 'often' ? 'often' : 'rarely') satisfies WashKind,
  mask: (values.mask === 'on' ? 'on' : 'off') satisfies MaskKind,
  contacts: Number(values.contacts),
  seat: (values.seat === 'back' ? 'back' : 'front') satisfies SeatKind,
});

export const spreadOutput = (values: Values, exp?: VariableExperiment) => simulateSpread(toParams(values), spreadOptions(exp));

export const spreadResult = (values: Values, exp?: VariableExperiment): SpreadResult => spreadOutput(values, exp).result;

/** 실험 전(0일째): 처음 아픈 1명만 있다. 조건에 따라 달라지지 않는 시작 상태라 결과를 드러내지 않는다. */
export const START_SAMPLE: SpreadSample = { t: 0, susceptible: CLASS_SIZE - 1, sick: 1, recovered: 0, total: 1 };

/** 항상 보이는 안내 문구 */
export const DISCLAIMER = '이 숫자는 공부를 위해 만든 가상 반의 계산이에요. 실제 병의 예측이 아니에요.';

/** 교실 그림 아래 문구 */
export const spreadNote = (s: SpreadSample) => {
  const c = headcount(s);
  return `${Math.round(s.t)}일째 · 지금 아픈 사람 ${c.sick}명 · 지금까지 감염 ${c.sick + c.recovered}명`;
};

/** 만남 그림 아래 문구(화면 설명) */
export const CONTACT_NOTE = '만날 때마다 병이 옮을 수 있는 기회가 생겨요.';

export type PersonState = 'healthy' | 'sick' | 'recovered';

export const SEAT_COLS = 6;
export const SEAT_ROWS = 5;

/** 처음 아픈 친구의 자리(번호 = 줄 × 6 + 칸): 앞줄은 맨 앞줄 셋째 칸, 뒷줄은 맨 뒷줄 넷째 칸 */
export const ORIGIN_SEAT: Record<SeatKind, number> = { front: 2, back: (SEAT_ROWS - 1) * SEAT_COLS + 3 };

/** 자리에 상관없이 같은 감염 순서(고루 흩어진 고정 순서). 처음 아픈 친구의 자리만 맨 앞에 놓는다. */
const SCATTER = Array.from({ length: CLASS_SIZE }, (_, k) => (k * 7 + 4) % CLASS_SIZE);

export function infectionOrder(seat: SeatKind): number[] {
  const origin = ORIGIN_SEAT[seat];
  return [origin, ...SCATTER.filter((n) => n !== origin)];
}

/** 자리마다의 상태. 감염 순서에서 앞에서부터 나은 사람, 아픈 사람, 나머지는 건강하다. 결정론적이고 난수가 없다. */
export function seatStates(s: Pick<SpreadSample, 'susceptible' | 'sick' | 'recovered'>, seat: SeatKind): PersonState[] {
  const c = headcount(s);
  const out: PersonState[] = Array.from({ length: CLASS_SIZE }, () => 'healthy');
  infectionOrder(seat).forEach((n, i) => {
    if (i < c.recovered) out[n] = 'recovered';
    else if (i < c.recovered + c.sick) out[n] = 'sick';
  });
  return out;
}

export const STATE_LABEL: Record<PersonState, string> = { healthy: '건강', sick: '아픔', recovered: '나음' };

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
