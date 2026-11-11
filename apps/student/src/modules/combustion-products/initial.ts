import {
  CP_BURN_MIN,
  CP_JARS,
  CP_OUTCOME_LABEL,
  CP_TESTS,
  limewaterOutcome,
  simulateCombustionProducts,
  type CombustionProductsParams,
  type CombustionProductsResult,
  type CombustionProductsSample,
  type CpOutcome,
  type CpTest,
} from '@sci/engine-matter';
import type { Values } from '@sci/gateway';

const pick = <T extends string>(list: readonly T[], v: unknown, fallback: T): T => ((list as readonly string[]).includes(String(v)) ? (v as T) : fallback);

export const toParams = (values: Values): CombustionProductsParams => {
  const burn = Number(values.burnMin);
  return {
    burnMin: burn === 1 || burn === 3 ? burn : 0,
    test: pick(CP_TESTS, values.test, 'paper'),
    jar: pick(CP_JARS, values.jar, 'clear'),
  };
};

/** 고른 조건 그대로 계산한 샘플과 결과 */
export const productsOutput = (values: Values) => simulateCombustionProducts(toParams(values));

export const productsResult = (values: Values): CombustionProductsResult => productsOutput(values).result;

export const outcomeName = (o: CpOutcome): string => CP_OUTCOME_LABEL[o];

export const TEST_TEXT: Record<CpTest, string> = { paper: '푸른색 염화 코발트 종이', limewater: '석회수' };
/** 눈으로 보기와 기록에 쓰는 짧은 이름 */
export const TEST_SHORT: Record<CpTest, string> = { paper: '코발트 종이', limewater: '석회수' };
export const JAR_TEXT: Record<string, string> = { clear: '투명', blue: '연한 파랑' };
export const BURN_TEXT: Record<number, string> = { 0: '태우지 않음', 1: '1분', 3: '3분' };

/** 집기병 색: 투명은 색이 없고, 연한 파랑은 옅게 칠한다. */
export const JAR_FILL: Record<string, string | null> = { clear: null, blue: '#bfdbfe' };

export const PAPER_BLUE = '#2563eb';
export const PAPER_RED = '#dc2626';
/** 석회수(맑음)의 옅은 물색과 뿌옇게 흐려질 때의 우윳빛 */
export const LIME_CLEAR = '#bae6fd';
export const LIME_MILK = '#e7e5e4';

const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
/** 푸른색(0)에서 붉은색(1)까지 섞은 색 */
export const paperFill = (red: number): string => {
  const k = Math.min(1, Math.max(0, red));
  const [a, b] = [hex(PAPER_BLUE), hex(PAPER_RED)];
  return `#${a.map((x, i) => Math.round(x + (b[i]! - x) * k).toString(16).padStart(2, '0')).join('')}`;
};

/** 그 순간의 검사 결과(범주): 종이는 절반 넘게 붉어지면 붉은색, 석회수는 뿌연 정도로 정한다. */
export const outcomeNow = (s: Pick<CombustionProductsSample, 'cloud' | 'red'>, test: CpTest): CpOutcome => (test === 'paper' ? (s.red >= 0.5 ? 'paperRed' : 'paperBlue') : limewaterOutcome(s.cloud));

/** 뿌연 정도(눈금 0~10) 글자: 종이 검사이면 "—" */
export const cloudText = (cloud: number | null): string => (cloud === null || !Number.isFinite(cloud) ? '—' : String(Math.round(cloud * 10) / 10));

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export { CP_BURN_MIN };
