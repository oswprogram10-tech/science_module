import type { VariableExperiment as Experiment } from '@sci/schema';

/** 관찰한 날(일째). 교실에서 기르는 배추흰나비를 이 날들에 관찰해 기록한다. */
export const BL_DAYS = [1, 3, 6, 9, 12, 15, 18, 21, 24, 28, 30] as const;
export const BL_TIMES = ['morning', 'evening'] as const;
export type BlTime = (typeof BL_TIMES)[number];
/** 먹이를 먹나요 / 움직이나요 / 날개 (범주) */
export type BlEat = 'eat' | 'noeat';
export type BlMove = 'crawl' | 'still' | 'fly';
export type BlWings = 'yes' | 'no';
/** 그림 모양: 단계 이름은 화면에 쓰지 않으므로 모양 이름만 둔다. */
export type BlShape = 'egg' | 'small' | 'larva' | 'big' | 'shell' | 'adult';

export interface ButterflyLifeParams {
  /** 관찰한 날(일째) */
  day: number;
  /** 관찰한 때: 계산에 쓰지 않는 대조 변인 */
  time: BlTime;
}

export interface ButterflyLifeSample {
  /** 관찰한 날 축(일, 0~30). 이 모델의 그래프 가로축이다. */
  t: number;
  /** 몸 길이(mm): 관찰한 날에만 값이 있고 나머지 날은 NaN(관찰하지 않은 날은 그리지 않는다). */
  length: number;
}

export interface ButterflyLifeResult {
  /** 몸 길이(mm), 정수 */
  length: number;
  eat: BlEat;
  move: BlMove;
  wings: BlWings;
}

export interface ButterflyLifeOutput {
  samples: ButterflyLifeSample[];
  result: ButterflyLifeResult;
}

interface Row extends ButterflyLifeResult {
  shape: BlShape;
}

/** 날마다 모습·길이·먹이·움직임·날개. 수치는 근사값이며 교사 검수 대상이다. */
export const BL_TABLE: Record<number, Row> = {
  1: { shape: 'egg', length: 1, eat: 'noeat', move: 'still', wings: 'no' },
  3: { shape: 'egg', length: 1, eat: 'noeat', move: 'still', wings: 'no' },
  6: { shape: 'small', length: 3, eat: 'eat', move: 'crawl', wings: 'no' },
  9: { shape: 'larva', length: 10, eat: 'eat', move: 'crawl', wings: 'no' },
  12: { shape: 'larva', length: 20, eat: 'eat', move: 'crawl', wings: 'no' },
  15: { shape: 'big', length: 28, eat: 'eat', move: 'crawl', wings: 'no' },
  18: { shape: 'shell', length: 22, eat: 'noeat', move: 'still', wings: 'no' },
  21: { shape: 'shell', length: 22, eat: 'noeat', move: 'still', wings: 'no' },
  24: { shape: 'shell', length: 22, eat: 'noeat', move: 'still', wings: 'no' },
  28: { shape: 'adult', length: 20, eat: 'eat', move: 'fly', wings: 'yes' },
  30: { shape: 'adult', length: 20, eat: 'eat', move: 'fly', wings: 'yes' },
};

export const BL_EAT_LABEL: Record<BlEat, string> = { eat: '먹음', noeat: '먹지 않음' };
export const BL_MOVE_LABEL: Record<BlMove, string> = { crawl: '기어 다님', still: '거의 움직이지 않음', fly: '날아다님' };
export const BL_WINGS_LABEL: Record<BlWings, string> = { yes: '있음', no: '없음' };
export const BL_TIME_LABEL: Record<BlTime, string> = { morning: '아침', evening: '저녁' };

/** 그래프 가로축 끝(일)과 세로축 끝(mm) */
export const BL_X_MAX = 30;
export const BL_Y_MAX_MM = 30;
/** 화면에서 두 몸 길이를 같다고 보는 기준(mm): 길이는 정수라 1 mm 이상 달라야 다르다. */
export const BL_SAME_MM = 0.5;

const checkParams = (p: ButterflyLifeParams): void => {
  if (typeof p.day !== 'number' || !(BL_DAYS as readonly number[]).includes(p.day)) throw new RangeError(`관찰한 날 ${String(p.day)}은(는) ${BL_DAYS.join(', ')} 중 하나여야 합니다.`);
  if (!(BL_TIMES as readonly string[]).includes(p.time)) throw new RangeError(`관찰한 때 ${String(p.time)}은(는) ${BL_TIMES.join(', ')} 중 하나여야 합니다.`);
};

/** 그날 모습(그림 모양) */
export const shapeOfDay = (day: number): BlShape => BL_TABLE[day]!.shape;

/** 몸 길이·먹이·움직임·날개. 관찰한 때는 쓰지 않는다. */
export const butterflyResultOf = (day: number): ButterflyLifeResult => {
  const { length, eat, move, wings } = BL_TABLE[day]!;
  return { length, eat, move, wings };
};

/**
 * 배추흰나비 관찰 기록. 수치는 근사값이며 교사 검수 대상이다. 난수 없음.
 * 관찰한 날(1·3·6·9·12·15·18·21·24·28·30일째)마다 표의 몸 길이·먹이·움직임·날개를 돌려주고, 관찰한 때(아침·저녁)는 쓰지 않는다.
 * 표본은 하루(t = 0~관찰한 날)마다 하나이고, 몸 길이는 관찰한 날에만 값이 있다(나머지 날은 NaN이라 그리지 않는다).
 */
export function simulateButterflyLife(params: ButterflyLifeParams): ButterflyLifeOutput {
  checkParams(params);
  const result = butterflyResultOf(params.day);
  const samples: ButterflyLifeSample[] = [];
  for (let t = 0; t <= params.day; t++) samples.push({ t, length: t === params.day ? result.length : NaN });
  return { samples, result };
}

/** 두 샘플 사이: 몸 길이는 두 날 모두 값이 있을 때만 이어 주고, 아니면 도착한 날에서야 값이 생긴다. */
export function interpolateButterflyLife(a: ButterflyLifeSample, b: ButterflyLifeSample, k: number): ButterflyLifeSample {
  const both = Number.isFinite(a.length) && Number.isFinite(b.length);
  return { t: a.t + (b.t - a.t) * k, length: both ? a.length + (b.length - a.length) * k : k >= 1 ? b.length : a.length };
}

/** 매니페스트의 배추흰나비 관찰 기록이 모델이 다룰 수 있는 범위인지 검사한다. */
export function validateButterflyLifeExperiment(exp: Experiment): string[] {
  const errors: string[] = [];
  const allowed: Record<string, readonly (string | number)[]> = { day: BL_DAYS, time: BL_TIMES };
  for (const key of Object.keys(allowed)) {
    const v = exp.variables.find((x) => x.key === key);
    if (!v) {
      errors.push(`변인 "${key}"이(가) 없습니다.`);
      continue;
    }
    for (const o of v.options) {
      if (!allowed[key]!.includes(o.value)) errors.push(`변인 "${key}"의 선택지 값 ${JSON.stringify(o.value)}: ${allowed[key]!.join(', ')} 중 하나여야 합니다.`);
    }
  }
  return errors;
}
