import type { ClassificationExperiment } from '@sci/schema';

export type GroupKey = 'acid' | 'base';

export type ClassifyStatus = 'consistent' | 'inconsistent' | 'untested' | 'unplaced' | 'undetermined';
export type CheckKind = 'check-complete' | 'check-inconsistent' | 'check-untested';

export interface CheckItem {
  solution: string;
  status: ClassifyStatus;
}

export interface CheckResult {
  items: CheckItem[];
  kind: CheckKind;
}

/** checkClassification이 읽는 상태의 일부. 저장소 상태가 그대로 들어맞는다. */
export interface ClassifyInput {
  tests: Record<string, string[] | undefined>;
  placement: Record<string, GroupKey | null | undefined>;
}

/** 색 → 어느 쪽 용액임을 알려 주는가. 여기에 없는 색(clear, cabPurple)은 결정할 수 없다. */
const COLOR_SIDE: Record<string, GroupKey> = {
  red: 'acid',
  cabRed: 'acid',
  cabPink: 'acid',
  blue: 'base',
  magenta: 'base',
  cabBlue: 'base',
  cabGreen: 'base',
  cabYellow: 'base',
};

function findSolution(exp: ClassificationExperiment, key: string) {
  const s = exp.solutions.find((x) => x.key === key);
  if (!s) throw new Error(`알 수 없는 용액: ${key}`);
  return s;
}

function findIndicator(exp: ClassificationExperiment, key: string) {
  const i = exp.indicators.find((x) => x.key === key);
  if (!i) throw new Error(`알 수 없는 지시약: ${key}`);
  return i;
}

/** 지시약의 colors를 순서대로 보고 level ≤ max인 첫 항목의 색. */
export function indicatorColor(exp: ClassificationExperiment, solutionKey: string, indicatorKey: string): string {
  const level = findSolution(exp, solutionKey).level;
  const ind = findIndicator(exp, indicatorKey);
  const hit = ind.colors.find((c) => level <= c.max);
  return (hit ?? ind.colors[ind.colors.length - 1]!).color;
}

/** 정답 무리. level < 7이면 acid, 아니면 base. */
export function truthGroup(exp: ClassificationExperiment, solutionKey: string): GroupKey {
  return findSolution(exp, solutionKey).level < 7 ? 'acid' : 'base';
}

/**
 * 그 용액에서 학생이 실제로 시험한 지시약 결과만으로 어느 쪽인지 판단한다.
 * 결정할 수 없는 결과(clear, cabPurple, 초기색과 같은 리트머스)는 건너뛰고, 결정 가능한 첫 결과의 쪽을 돌려준다.
 */
export function evidenceGroup(
  exp: ClassificationExperiment,
  solutionKey: string,
  testedIndicators: readonly string[],
): GroupKey | null {
  for (const indKey of testedIndicators) {
    const ind = findIndicator(exp, indKey);
    const color = indicatorColor(exp, solutionKey, indKey);
    if (ind.kind === 'paper' && color === ind.initial) continue;
    const side = COLOR_SIDE[color];
    if (side) return side;
  }
  return null;
}

export function checkClassification(exp: ClassificationExperiment, state: ClassifyInput): CheckResult {
  const items: CheckItem[] = exp.solutions.map((s) => {
    const tested = state.tests[s.key] ?? [];
    const placed = state.placement[s.key] ?? null;
    let status: ClassifyStatus;
    if (tested.length === 0) status = 'untested';
    else {
      const evidence = evidenceGroup(exp, s.key, tested);
      if (evidence === null) status = 'undetermined';
      else if (placed === null) status = 'unplaced';
      else status = placed === evidence ? 'consistent' : 'inconsistent';
    }
    return { solution: s.key, status };
  });
  const has = (st: ClassifyStatus) => items.some((i) => i.status === st);
  let kind: CheckKind;
  if (has('inconsistent')) kind = 'check-inconsistent';
  else if (has('untested') || has('undetermined') || has('unplaced')) kind = 'check-untested';
  else kind = 'check-complete';
  return { items, kind };
}

/** 지시약 하나가 낼 수 있는 색(초기색 포함)의 색표. 카메라 색 판독의 비교 대상이다. */
export function indicatorColorChart(
  exp: ClassificationExperiment,
  indicatorKey: string,
): { key: string; hex: string }[] {
  const ind = findIndicator(exp, indicatorKey);
  const keys = [...new Set([ind.initial, ...ind.colors.map((c) => c.color)])];
  return keys.flatMap((key) => {
    const def = exp.colors[key];
    return def ? [{ key, hex: def.hex }] : [];
  });
}

/** 매니페스트의 분류 활동이 엔진이 다룰 수 있는지 검사한다. 문제마다 한국어 메시지 하나씩. */
export function validateIndicatorExperiment(exp: ClassificationExperiment): string[] {
  const errors: string[] = [];
  const dup = (what: string, keys: string[]) => {
    const seen = new Set<string>();
    for (const k of keys) {
      if (seen.has(k)) errors.push(`${what} 키가 중복됩니다: ${k}`);
      seen.add(k);
    }
  };
  dup('용액', exp.solutions.map((s) => s.key));
  dup('지시약', exp.indicators.map((i) => i.key));

  const groupKeys = exp.groups.map((g) => g.key).sort().join(',');
  if (groupKeys !== 'acid,base') errors.push('groups는 acid와 base 두 무리여야 합니다.');

  for (const ind of exp.indicators) {
    const need = (color: string, where: string) => {
      if (!exp.colors[color]) errors.push(`지시약 "${ind.key}"의 ${where} 색 "${color}"이(가) colors에 없습니다.`);
    };
    need(ind.initial, '처음');
    ind.colors.forEach((c) => need(c.color, '결과'));
    for (let i = 1; i < ind.colors.length; i++) {
      if (!(ind.colors[i]!.max > ind.colors[i - 1]!.max)) {
        errors.push(`지시약 "${ind.key}"의 colors 범위는 오름차순이어야 합니다.`);
        break;
      }
    }
    if (ind.colors[ind.colors.length - 1]!.max !== 99) {
      errors.push(`지시약 "${ind.key}"의 colors 마지막 max는 99여야 합니다.`);
    }
  }
  return errors;
}
