import { describe, expect, it } from 'vitest';
import { checkClassification, truthGroup } from '@sci/engine-matter';
import { parseManifest, type ClassificationExperiment } from '@sci/schema';
import acidBaseJson from '../../../../../content/units/g6-acid-base/manifest.json';
import {
  allPlaced,
  check,
  confirmSafety,
  createClassifyStore,
  createInitialState,
  dismissAlerts,
  place,
  predict,
  raiseAlert,
  select,
  testBlock,
  testIndicator,
  tutorSituation,
  type ClassifyState,
} from './classifyStore';
import { FEEDBACK_IDLE, classifyFeedback } from './feedback';
import { readIndicatorColor, similarityOf } from './colorRead';
import { SAFETY_MESSAGES } from '../../components/safety/safetyMessages';

const exp = parseManifest(acidBaseJson).experiments[0] as ClassificationExperiment;
const ev = { type: 'NO_GOGGLES', confidence: 1, ts: 1 } as const;

const fresh = () => createInitialState();
const ready = (sol: string, s: ClassifyState = fresh()) => predict(select(s, exp, sol), exp, sol, 'acid');

describe('classifyStore: 시험 가능 조건', () => {
  it('용액을 고르기 전과 예측 전에는 시험할 수 없다', () => {
    let s = fresh();
    expect(testBlock(s, exp)).toBe('no-selection');
    expect(testIndicator(s, exp, 'phenol')).toBe(s);
    s = select(s, exp, 'lemon');
    expect(testBlock(s, exp)).toBe('no-prediction');
    expect(testIndicator(s, exp, 'phenol')).toBe(s);
    s = predict(s, exp, 'lemon', 'unsure');
    expect(testBlock(s, exp)).toBeNull();
    s = testIndicator(s, exp, 'phenol');
    expect(s.tests.lemon).toEqual(['phenol']);
  });

  it('예측은 용액마다 따로 받는다', () => {
    const s = select(ready('lemon'), exp, 'vinegar');
    expect(testBlock(s, exp)).toBe('no-prediction');
  });

  it('위험 용액은 점검표를 확인하기 전에 시험할 수 없고, 확인은 세션 동안 유지된다', () => {
    let s = ready('hcl');
    expect(testBlock(s, exp)).toBe('safety-required');
    expect(testIndicator(s, exp, 'phenol')).toBe(s);
    s = confirmSafety(s);
    expect(s.safetyConfirmed).toBe(true);
    s = testIndicator(s, exp, 'phenol');
    expect(s.tests.hcl).toEqual(['phenol']);
    // 다른 위험 용액에도 다시 묻지 않는다.
    expect(testBlock(ready('naoh', s), exp)).toBeNull();
    // 위험하지 않은 용액은 점검표와 무관하다.
    expect(testBlock(ready('lemon'), exp)).toBeNull();
  });

  it('안전 경고가 떠 있는 동안에는 시험할 수 없고 닫으면 다시 가능하다', () => {
    let s = raiseAlert(ready('lemon'), ev);
    expect(testBlock(s, exp)).toBe('alert-active');
    expect(testIndicator(s, exp, 'phenol')).toBe(s);
    s = dismissAlerts(s);
    expect(s.alerts).toEqual([]);
    expect(testBlock(s, exp)).toBeNull();
    expect(dismissAlerts(s)).toBe(s);
  });

  it('시험 순서를 기억하고 같은 지시약 재시험은 기록을 늘리지 않으며 모르는 지시약은 무시한다', () => {
    let s = ready('lemon');
    s = testIndicator(s, exp, 'cabbage');
    s = testIndicator(s, exp, 'phenol');
    const again = testIndicator(s, exp, 'cabbage');
    expect(again).toBe(s);
    expect(s.tests.lemon).toEqual(['cabbage', 'phenol']);
    expect(testIndicator(s, exp, 'ghost')).toBe(s);
  });
});

describe('classifyStore: 배치와 확인', () => {
  const fillAll = (s0: ClassifyState, wrong: string[] = []) => {
    let s = s0;
    for (const sol of exp.solutions) {
      const truth = truthGroup(exp, sol.key);
      const g = wrong.includes(sol.key) ? (truth === 'acid' ? 'base' : 'acid') : truth;
      s = place(s, exp, sol.key, g);
    }
    return s;
  };

  it('8개를 모두 배치하기 전에는 확인할 수 없다', () => {
    let s = place(fresh(), exp, 'lemon', 'acid');
    expect(allPlaced(s, exp)).toBe(false);
    expect(check(s, exp)).toBe(s);
    s = fillAll(s);
    expect(allPlaced(s, exp)).toBe(true);
    expect(check(s, exp).checked).not.toBeNull();
  });

  it('무리에서 뺄 수 있고, 모르는 용액은 무시한다', () => {
    let s = place(fresh(), exp, 'lemon', 'acid');
    s = place(s, exp, 'lemon', null);
    expect(s.placement.lemon).toBeNull();
    expect(place(s, exp, 'ghost', 'acid')).toBe(s);
  });

  it('확인 결과는 checkClassification과 같고, 시험·배치가 바뀌면 지워진다', () => {
    let s = fillAll(fresh());
    s = check(s, exp);
    expect(s.checked).toEqual(checkClassification(exp, s));
    expect(s.checked!.kind).toBe('check-untested'); // 아무것도 시험하지 않았다
    const moved = place(s, exp, 'lemon', 'base');
    expect(moved.checked).toBeNull();
    const tested = testIndicator(ready('lemon', s), exp, 'cabbage');
    expect(tested.checked).toBeNull();
  });

  it('제대로 시험하고 배치하면 check-complete, 어긋나면 check-inconsistent', () => {
    let s = fresh();
    for (const sol of exp.solutions) {
      s = confirmSafety(predict(select(s, exp, sol.key), exp, sol.key, 'unsure'));
      s = testIndicator(s, exp, 'cabbage');
      s = testIndicator(s, exp, 'redLitmus');
    }
    // 양배추 지시약만으로 모두 판단 가능하다.
    expect(check(fillAll(s), exp).checked!.kind).toBe('check-complete');
    const bad = check(fillAll(s, ['soap']), exp).checked!;
    expect(bad.kind).toBe('check-inconsistent');
    expect(bad.items.find((i) => i.solution === 'soap')!.status).toBe('inconsistent');
  });

  it('저장소는 구독자에게 변경을 알린다', () => {
    const store = createClassifyStore();
    let n = 0;
    const off = store.subscribe(() => n++);
    store.update((s) => select(s, exp, 'lemon'));
    store.update((s) => s); // 변화 없음
    expect(n).toBe(1);
    off();
    store.update((s) => select(s, exp, 'soda'));
    expect(n).toBe(1);
    expect(store.getState().selected).toBe('soda');
  });
});

describe('튜터 상황 선택', () => {
  it('규칙 순서: 확인 결과 > 시험 전 > 예측 불일치 > 시험 중', () => {
    let s = ready('lemon');
    expect(tutorSituation(s, exp)).toEqual({ when: 'before-test', solution: '레몬즙' });
    s = testIndicator(s, exp, 'phenol'); // 무색: 결정할 수 없음
    expect(tutorSituation(s, exp).when).toBe('testing');
    s = testIndicator(s, exp, 'cabbage'); // 붉은색 → 산성, 예측도 산성
    expect(tutorSituation(s, exp).when).toBe('testing');
    const mismatch = testIndicator(predict(select(s, exp, 'soap'), exp, 'soap', 'acid'), exp, 'phenol');
    expect(tutorSituation(mismatch, exp)).toEqual({ when: 'prediction-mismatch', solution: '빨랫비누 물' });
    const unsure = testIndicator(predict(select(s, exp, 'soap'), exp, 'soap', 'unsure'), exp, 'phenol');
    expect(tutorSituation(unsure, exp).when).toBe('testing');
    const checked = { ...mismatch, checked: { items: [{ solution: 'soap', status: 'inconsistent' as const }], kind: 'check-inconsistent' as const } };
    expect(tutorSituation(checked, exp)).toEqual({ when: 'check-inconsistent', solution: '빨랫비누 물' });
  });
});

describe('피드백 문장', () => {
  const result = (kind: 'check-complete' | 'check-inconsistent' | 'check-untested', items: [string, 'consistent' | 'inconsistent' | 'untested' | 'unplaced' | 'undetermined'][]) => ({
    kind,
    items: items.map(([solution, status]) => ({ solution, status })),
  });

  it('확인 전과 세 가지 결과', () => {
    expect(classifyFeedback(exp, null)).toBe(FEEDBACK_IDLE);
    expect(classifyFeedback(exp, result('check-complete', [['lemon', 'consistent']]))).toBe(
      '관찰한 지시약 색 변화와 분류가 서로 잘 맞아요.',
    );
    expect(classifyFeedback(exp, result('check-inconsistent', [['soap', 'inconsistent'], ['lemon', 'consistent']]))).toBe(
      '빨랫비누 물은 관찰한 지시약 색 변화와 넣은 무리를 다시 비교해 볼까요?',
    );
    expect(
      classifyFeedback(exp, result('check-untested', [['hcl', 'untested'], ['soda', 'undetermined'], ['soap', 'consistent']])),
    ).toBe('묽은 염산, 탄산수는 아직 분류할 단서가 부족해요. 다른 지시약으로도 시험해 볼까요?');
  });

  it('판정 문구, 정답 무리, 숫자를 드러내지 않는다', () => {
    const texts = [
      classifyFeedback(exp, result('check-inconsistent', [['vinegar', 'inconsistent']])),
      classifyFeedback(exp, result('check-untested', [['vinegar', 'untested']])),
      classifyFeedback(exp, result('check-complete', [])),
    ];
    for (const t of texts) {
      expect(t).not.toMatch(/틀렸|정답|pH|\d/);
      expect(t).not.toContain('산성');
    }
  });
});

describe('색 읽기와 안전 문구', () => {
  const solid = (hex: number, w = 20, h = 20) => {
    const d = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      d[i * 4] = (hex >> 16) & 255;
      d[i * 4 + 1] = (hex >> 8) & 255;
      d[i * 4 + 2] = hex & 255;
      d[i * 4 + 3] = 255;
    }
    return d;
  };

  it('색표 색 그대로의 프레임은 그 색으로 읽힌다', () => {
    const r = readIndicatorColor(exp, 'cabbage', solid(0xc86fa8), 20, 20);
    expect(r).toMatchObject({ best: 'cabPink', bestLabel: '연한 붉은색', confident: true, similarity: '높음' });
    const lit = readIndicatorColor(exp, 'redLitmus', solid(0x5b7fc7), 20, 20);
    expect(lit).toMatchObject({ best: 'blue', bestLabel: '푸른색', confident: true });
  });
  it('회색은 확신하지 못한다', () => {
    expect(readIndicatorColor(exp, 'cabbage', solid(0x808080), 20, 20).confident).toBe(false);
  });
  it('닮은 정도 구간', () => {
    expect(similarityOf(3)).toBe('높음');
    expect(similarityOf(15)).toBe('보통');
    expect(similarityOf(40)).toBe('낮음');
  });
  it('안전 경고는 유형마다 한 문장이고 NO_GOGGLES는 사양 문구', () => {
    expect(SAFETY_MESSAGES.NO_GOGGLES).toBe('산성 용액 실험 전 보안경을 먼저 착용해 주세요!');
    expect(new Set(Object.values(SAFETY_MESSAGES)).size).toBe(4);
  });
});
