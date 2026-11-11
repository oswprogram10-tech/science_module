/**
 * 튜터 질문의 "상황" 이름(교사 화면과 교사 검토 문서가 같은 말을 쓴다)과, 활동 종류별로 생길 수 있는 상황 목록,
 * 교사 화면에서 자리표시를 보이는 방법.
 */

export const SITUATION_LABELS: Record<string, string> = {
  'before-run': '실행 전(예측할 때)',
  'first-trial': '첫 시행 뒤',
  confounded: '조건을 두 개 넘게 함께 바꿨을 때',
  'iv-unchanged': '알아보려던 조건은 그대로 두고 다른 조건을 바꿨을 때',
  repeat: '같은 조건으로 다시 했을 때',
  'fair-test': '한 조건만 바꿨을 때',
  'prediction-mismatch': '예측과 결과가 다를 때',
  'pick-card': '카드를 고를 때',
  'before-observe': '관찰하기 전',
  sorting: '나누는 중',
  'choose-criterion': '기준을 고를 때',
  'check-unplaced': '아직 넣지 않은 카드가 있을 때',
  'check-unobserved': '관찰하지 않고 넣었을 때',
  'check-inconsistent': '관찰 기록과 다르게 넣었을 때',
  'check-complete': '다 맞게 넣었을 때',
  'check-subjective': '주관 기준을 골랐을 때',
  finished: '모두 마쳤을 때',
  'tree-split-empty': '한쪽 갈래가 비었을 때',
  'tree-next-node': '다음 갈래로 넘어갈 때',
  'order-check-unplaced': '아직 놓지 않은 카드가 있을 때',
  'order-check-unobserved': '관찰하지 않고 놓았을 때',
  'order-check-inconsistent': '관찰 기록과 다르게 놓았을 때',
  'order-check-complete': '다 맞게 놓았을 때',
  'before-test': '검사하기 전',
  testing: '검사하는 중',
  'check-untested': '검사하지 않고 넣었을 때',
  'stage-1': '1단계',
  'stage-2': '2단계',
  'stage-3': '3단계',
  'stage-4': '4단계',
  observing: '관찰하는 중',
  'record-mismatch': '기록이 관찰과 다를 때',
  'record-match': '기록이 관찰과 맞을 때',
};

/**
 * 상황 이름. 조작변인(iv)이 있는 fair-test는 "‘〈iv 라벨〉’만 바꿨을 때", 관찰 과제의 질문은 앞에 "[과제 이름] "을 붙인다.
 * 모르는 when은 when 글자를 그대로 쓴다.
 */
export function situationLabel(when: string, opts: { ivLabel?: string; taskTitle?: string } = {}): string {
  const base = when === 'fair-test' && opts.ivLabel ? `‘${opts.ivLabel}’만 바꿨을 때` : (SITUATION_LABELS[when] ?? when);
  return opts.taskTitle ? `[${opts.taskTitle}] ${base}` : base;
}

/** 활동 종류. 카드 분류는 배치 형태(layout)별로 쓰는 상황이 다르다. */
export type ActivityKind = 'variable' | 'groups' | 'tree' | 'order' | 'classify' | 'observation' | 'portfolio';

const GROUPS_WHENS = [
  'choose-criterion',
  'pick-card',
  'before-observe',
  'sorting',
  'check-subjective',
  'check-unplaced',
  'check-unobserved',
  'check-inconsistent',
  'check-complete',
  'finished',
];

/**
 * "질문 더하기"에서 고를 수 있는, 활동 종류별로 생길 수 있는 상황(when). 지금 매니페스트에 쓰이는 when에서 모았고,
 * 모듈의 situation 함수(`classifyWhen`, `observeWhen`, `cardSortWhen`, 변인 실험의 `pickProbeKey`)가 돌려주는 값과 맞는지 단위 테스트로 고정한다.
 * variable의 fair-test는 조작변인(iv)마다 따로 더할 수 있다.
 * (g3-plantlife의 트리 활동 매니페스트에는 일어나지 않는 check-complete 질문이 있다. 기본 질문 목록에는 보이지만 더하기 후보에는 없다.)
 */
export const SITUATIONS_BY_KIND: Record<ActivityKind, readonly string[]> = {
  variable: ['before-run', 'first-trial', 'confounded', 'iv-unchanged', 'repeat', 'fair-test', 'prediction-mismatch'],
  groups: GROUPS_WHENS,
  // 트리에서는 check-complete 확인이 tree-split-empty / tree-next-node / finished로 바뀌므로 check-complete는 일어나지 않는다.
  tree: [...GROUPS_WHENS.filter((w) => w !== 'check-complete'), 'tree-split-empty', 'tree-next-node'],
  order: [
    'pick-card',
    'before-observe',
    'sorting',
    'order-check-unplaced',
    'order-check-unobserved',
    'order-check-inconsistent',
    'order-check-complete',
    // 순서를 맞춘 뒤 이어서 하는 무리 나누기 확인(followUp)
    'check-unplaced',
    'check-unobserved',
    'check-inconsistent',
    'finished',
  ],
  classify: ['before-test', 'testing', 'prediction-mismatch', 'check-untested', 'check-inconsistent', 'check-complete'],
  observation: ['before-observe', 'observing', 'record-mismatch', 'record-match', 'prediction-mismatch'],
  portfolio: ['stage-1', 'stage-2', 'stage-3', 'stage-4'],
};

/** 매니페스트의 활동(module, layout)에서 활동 종류를 구한다. */
export function activityKindOf(exp: { module: string; layout?: string }): ActivityKind {
  if (exp.module === 'card-sort') return exp.layout === 'tree' ? 'tree' : exp.layout === 'order' ? 'order' : 'groups';
  if (exp.module === 'indicator-classify') return 'classify';
  if (exp.module === 'sky-observation') return 'observation';
  if (exp.module === 'career-portfolio') return 'portfolio';
  return 'variable';
}

/** 자리표시 이름 -> 교사 화면에서 보이는 말. */
export const PLACEHOLDER_DISPLAY: Record<string, string> = {
  iv: '〔바꾼 조건〕',
  changed: '〔함께 바뀐 조건〕',
  card: '〔카드 이름〕',
  criterion: '〔기준〕',
  solution: '〔용액 이름〕',
};

/** 검사할 때 자리표시를 바꿔 넣는 예시 말. */
export const PLACEHOLDER_SAMPLE: Record<string, string> = {
  iv: '조건',
  changed: '조건',
  card: '카드',
  criterion: '기준',
  solution: '용액',
};

/** 저장 형태(`{iv}`)를 교사 화면 형태(〔바꾼 조건〕)로. */
export function toDisplayText(text: string): string {
  let out = text;
  for (const [k, v] of Object.entries(PLACEHOLDER_DISPLAY)) out = out.replaceAll(`{${k}}`, v);
  return out;
}

/** 교사 화면 형태(〔바꾼 조건〕)를 저장 형태(`{iv}`)로. `toDisplayText`의 역함수. */
export function fromDisplayText(text: string): string {
  let out = text;
  for (const [k, v] of Object.entries(PLACEHOLDER_DISPLAY)) out = out.replaceAll(v, `{${k}}`);
  return out;
}
