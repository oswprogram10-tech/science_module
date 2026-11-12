import {
  BL_DAYS,
  BL_EAT_LABEL,
  BL_MOVE_LABEL,
  BL_TIMES,
  BL_TIME_LABEL,
  BL_WINGS_LABEL,
  butterflyResultOf,
  shapeOfDay,
  type BlShape,
  type BlTime,
  type ButterflyLifeParams,
  type ButterflyLifeResult,
  type ButterflyLifeSample,
} from '@sci/engine-life';
import type { Values } from '@sci/gateway';

const pickTime = (v: unknown): BlTime => ((BL_TIMES as readonly string[]).includes(String(v)) ? (v as BlTime) : 'morning');

export const toParams = (values: Values): ButterflyLifeParams => {
  const n = Number(values.day);
  return { day: (BL_DAYS as readonly number[]).includes(n) ? n : 1, time: pickTime(values.time) };
};

/** 고른 조건 그대로의 결과 */
export const lifeResult = (values: Values): ButterflyLifeResult => butterflyResultOf(toParams(values).day);

/** 고른 조건에서 그릴 모양(실행한 뒤에만 그린다) */
export const lifeShape = (values: Values): BlShape => shapeOfDay(toParams(values).day);

export const TIME_TEXT = BL_TIME_LABEL;

/** 결과 열 글자 */
export const lengthText = (r: Pick<ButterflyLifeResult, 'length'>) => String(r.length);
export const eatText = (r: Pick<ButterflyLifeResult, 'eat'>) => BL_EAT_LABEL[r.eat];
export const moveText = (r: Pick<ButterflyLifeResult, 'move'>) => BL_MOVE_LABEL[r.move];
export const wingsText = (r: Pick<ButterflyLifeResult, 'wings'>) => BL_WINGS_LABEL[r.wings];

/** 모양을 말로 풀이한 것(접근성 이름용). 단계 이름은 쓰지 않는다. */
export const SHAPE_TEXT: Record<BlShape, string> = {
  egg: '잎 뒷면의 노란 알',
  small: '잎 위의 작은 초록 벌레',
  larva: '잎 위의 초록 벌레',
  big: '잎 위의 큰 초록 벌레',
  shell: '실을 걸고 매달린 단단한 껍데기',
  adult: '흰 날개를 편 나비',
};

/** 눈으로 보기 아래 문구(실행한 뒤) */
export const lifeNote = (day: number, r: ButterflyLifeResult) => `${day}일째 · 몸 길이 ${r.length} mm · 먹이: ${BL_EAT_LABEL[r.eat]} · 움직임: ${BL_MOVE_LABEL[r.move]} · 날개: ${BL_WINGS_LABEL[r.wings]}`;

/** 가상 자(cm): 관찰한 날에 닿은 뒤에만 몸 길이를 읽는다. 처음 값은 0. */
export const rulerCm = (snapshot: ButterflyLifeSample | null): number => (snapshot !== null && Number.isFinite(snapshot.length) ? snapshot.length / 10 : 0);

export const GUIDE_TEXT = '교실에서 기르는 배추흰나비와 함께 보며 기록해요.';
