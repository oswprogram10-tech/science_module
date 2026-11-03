import type { Experiment } from '@sci/schema';
import { SOLUBILITY_TABLE, SOLUTES } from './solubility';

const REQUIRED_KEYS = ['solute', 'waterTempC', 'waterMl', 'stir'] as const;

function tempRange(): [number, number] {
  let min = -Infinity;
  let max = Infinity;
  for (const rows of Object.values(SOLUBILITY_TABLE)) {
    min = Math.max(min, rows[0]![0]);
    max = Math.min(max, rows[rows.length - 1]![0]);
  }
  return [min, max];
}

/**
 * 매니페스트의 용해 실험 변인이 엔진이 다룰 수 있는 범위인지 검사한다.
 * 문제마다 한국어 메시지 하나씩, 없으면 빈 배열.
 */
export function validateDissolutionExperiment(exp: Experiment): string[] {
  const errors: string[] = [];
  const [tMin, tMax] = tempRange();
  for (const key of REQUIRED_KEYS) {
    const v = exp.variables.find((x) => x.key === key);
    if (!v) {
      errors.push(`변인 "${key}"이(가) 없습니다.`);
      continue;
    }
    for (const o of v.options) {
      const val = o.value;
      const bad = (why: string) => errors.push(`변인 "${key}"의 선택지 값 ${JSON.stringify(val)}: ${why}`);
      if (key === 'solute') {
        if (typeof val !== 'string' || !(SOLUTES as readonly string[]).includes(val)) {
          bad(`용해도 표에 없는 용질입니다. (${SOLUTES.join(', ')} 중 하나여야 해요)`);
        }
      } else if (key === 'waterTempC') {
        if (typeof val !== 'number' || !Number.isFinite(val)) bad('숫자여야 합니다.');
        else if (val < tMin || val > tMax) bad(`온도는 ${tMin}~${tMax} °C 범위여야 합니다.`);
      } else if (key === 'waterMl') {
        if (typeof val !== 'number' || !Number.isFinite(val)) bad('숫자여야 합니다.');
        else if (!(val > 0)) bad('0보다 커야 합니다.');
      } else if (key === 'stir') {
        if (val !== 0 && val !== 1 && val !== 2) bad('0, 1, 2 중 하나여야 합니다.');
      }
    }
  }
  return errors;
}
