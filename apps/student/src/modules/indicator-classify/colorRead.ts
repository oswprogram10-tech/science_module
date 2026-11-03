import { indicatorColorChart } from '@sci/engine-matter';
import type { ClassificationExperiment } from '@sci/schema';
import { averageRoi, matchColor } from '@sci/vision';

export type Similarity = '높음' | '보통' | '낮음';

export interface ColorReading {
  indicator: string;
  best: string;
  bestLabel: string;
  deltaE: number;
  confident: boolean;
  similarity: Similarity;
}

export const READ_FAIL_MESSAGE = '색을 읽기 어려워요. 밝은 곳에서 흰 종이를 뒤에 대고 다시 찍어 보세요.';
export const PRIVACY_NOTE = '사진은 이 기기 안에서만 처리하고 저장하거나 보내지 않아요.';

/** 색차를 학생에게 보일 말로 바꾼다. 숫자는 보이지 않는다. */
export function similarityOf(deltaE: number): Similarity {
  if (deltaE <= 10) return '높음';
  if (deltaE <= 20) return '보통';
  return '낮음';
}

/** 프레임(RGBA)의 가운데 영역 평균색을 그 지시약의 색표와 비교한다. */
export function readIndicatorColor(
  exp: ClassificationExperiment,
  indicator: string,
  data: Uint8ClampedArray,
  width: number,
  height: number,
): ColorReading {
  const rgb = averageRoi(data, width, height);
  const m = matchColor(rgb, indicatorColorChart(exp, indicator));
  return {
    indicator,
    best: m.best,
    bestLabel: exp.colors[m.best]?.label ?? m.best,
    deltaE: m.deltaE,
    confident: m.confident,
    similarity: similarityOf(m.deltaE),
  };
}
