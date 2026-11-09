import { describe, expect, it } from 'vitest';
import manifestJson from '../../../../content/units/g6-acid-base/manifest.json';
import { parseManifest, type ClassificationExperiment } from '@sci/schema';
import {
  checkClassification,
  evidenceGroup,
  indicatorColor,
  indicatorColorChart,
  truthGroup,
  validateIndicatorExperiment,
  type GroupKey,
} from './index';

const exp = parseManifest(manifestJson).experiments[0] as ClassificationExperiment;
const clone = (): ClassificationExperiment => JSON.parse(JSON.stringify(exp));

const EXPECTED: Record<string, [string, string, string, string]> = {
  //            파란 리트머스, 붉은 리트머스, 페놀프탈레인, 양배추
  hcl: ['red', 'red', 'clear', 'cabRed'],
  lemon: ['red', 'red', 'clear', 'cabRed'],
  vinegar: ['red', 'red', 'clear', 'cabPink'],
  soda: ['red', 'red', 'clear', 'cabPink'],
  soap: ['blue', 'blue', 'magenta', 'cabBlue'],
  cleaner: ['blue', 'blue', 'magenta', 'cabGreen'],
  limewater: ['blue', 'blue', 'magenta', 'cabYellow'],
  naoh: ['blue', 'blue', 'magenta', 'cabYellow'],
};
const INDS = ['blueLitmus', 'redLitmus', 'phenol', 'cabbage'];

describe('indicatorColor', () => {
  it('8×4 전 조합이 표와 일치한다', () => {
    for (const s of exp.solutions) {
      INDS.forEach((ind, i) => {
        expect(indicatorColor(exp, s.key, ind), `${s.key}/${ind}`).toBe(EXPECTED[s.key]![i]);
      });
    }
  });
  it('경계값: level ≤ max인 첫 항목', () => {
    const e = clone();
    e.solutions.push({ key: 'edge', label: '경계', level: 7 });
    expect(indicatorColor(e, 'edge', 'blueLitmus')).toBe('red');
    expect(truthGroup(e, 'edge')).toBe('base');
  });
  it('알 수 없는 키는 오류', () => {
    expect(() => indicatorColor(exp, 'nope', 'phenol')).toThrow();
    expect(() => indicatorColor(exp, 'hcl', 'nope')).toThrow();
  });
});

describe('truthGroup', () => {
  it('level < 7이면 acid', () => {
    const acids = ['hcl', 'lemon', 'vinegar', 'soda'];
    for (const s of exp.solutions) expect(truthGroup(exp, s.key)).toBe(acids.includes(s.key) ? 'acid' : 'base');
  });
});

describe('evidenceGroup', () => {
  it('결정할 수 없는 결과는 null', () => {
    expect(evidenceGroup(exp, 'soap', [])).toBeNull();
    expect(evidenceGroup(exp, 'soap', ['redLitmus'])).toBe('base'); // 붉은 종이가 푸르게
    expect(evidenceGroup(exp, 'soap', ['blueLitmus'])).toBeNull(); // 푸른 종이는 그대로
    expect(evidenceGroup(exp, 'lemon', ['redLitmus'])).toBeNull(); // 붉은 종이는 그대로
    expect(evidenceGroup(exp, 'lemon', ['phenol'])).toBeNull(); // 무색
    expect(evidenceGroup(exp, 'lemon', ['blueLitmus', 'redLitmus', 'phenol'])).toBe('acid');
    expect(evidenceGroup(exp, 'lemon', ['redLitmus', 'phenol'])).toBeNull();
  });
  it('결정 가능한 결과가 있으면 그 쪽', () => {
    expect(evidenceGroup(exp, 'soap', ['phenol'])).toBe('base');
    expect(evidenceGroup(exp, 'soda', ['cabbage'])).toBe('acid'); // 연한 붉은색
    expect(evidenceGroup(exp, 'cleaner', ['cabbage'])).toBe('base');
    expect(evidenceGroup(exp, 'lemon', ['blueLitmus'])).toBe('acid');
  });
  it('양배추 보라는 null', () => {
    const e = clone();
    e.solutions.push({ key: 'water', label: '물', level: 7 });
    expect(indicatorColor(e, 'water', 'cabbage')).toBe('cabPurple');
    expect(evidenceGroup(e, 'water', ['cabbage'])).toBeNull();
  });
  it('결정 가능한 색이 하나라도 나오면 정답 무리와 같다', () => {
    for (const s of exp.solutions) {
      for (let mask = 1; mask < 16; mask++) {
        const tested = INDS.filter((_, i) => mask & (1 << i));
        const ev = evidenceGroup(exp, s.key, tested);
        if (ev !== null) expect(ev, `${s.key}/${tested}`).toBe(truthGroup(exp, s.key));
      }
    }
  });
});

describe('checkClassification', () => {
  type P = Record<string, GroupKey | null>;
  const base = (): { tests: Record<string, string[]>; placement: P } => {
    const tests: Record<string, string[]> = {};
    const placement: P = {};
    for (const s of exp.solutions) {
      tests[s.key] = ['cabbage', 'phenol', 'redLitmus', 'blueLitmus'];
      placement[s.key] = truthGroup(exp, s.key);
    }
    return { tests, placement };
  };
  const status = (r: ReturnType<typeof checkClassification>, sol: string) =>
    r.items.find((i) => i.solution === sol)!.status;

  it('모두 맞게 시험·배치하면 check-complete', () => {
    const r = checkClassification(exp, base());
    expect(r.items).toHaveLength(8);
    expect(r.items.every((i) => i.status === 'consistent')).toBe(true);
    expect(r.kind).toBe('check-complete');
  });
  it('네 가지 status', () => {
    const st = base();
    st.tests.hcl = []; // untested
    st.tests.lemon = ['phenol']; // undetermined (무색)
    st.placement.vinegar = null; // unplaced
    st.placement.soap = 'acid'; // inconsistent
    const r = checkClassification(exp, st);
    expect(status(r, 'hcl')).toBe('untested');
    expect(status(r, 'lemon')).toBe('undetermined');
    expect(status(r, 'vinegar')).toBe('unplaced');
    expect(status(r, 'soap')).toBe('inconsistent');
    expect(status(r, 'soda')).toBe('consistent');
  });
  it('kind 우선순위: inconsistent > untested류 > complete', () => {
    const st = base();
    st.tests.hcl = [];
    expect(checkClassification(exp, st).kind).toBe('check-untested');
    st.tests.lemon = ['phenol'];
    expect(checkClassification(exp, st).kind).toBe('check-untested');
    st.placement.soap = 'acid';
    expect(checkClassification(exp, st).kind).toBe('check-inconsistent');
    const st2 = base();
    st2.placement.soda = null;
    expect(checkClassification(exp, st2).kind).toBe('check-untested');
    expect(checkClassification(exp, { tests: {}, placement: {} }).kind).toBe('check-untested');
  });
});

describe('indicatorColorChart', () => {
  it('지시약이 낼 수 있는 색(초기색 포함)을 중복 없이 돌려준다', () => {
    expect(indicatorColorChart(exp, 'redLitmus').map((c) => c.key)).toEqual(['red', 'blue']);
    expect(indicatorColorChart(exp, 'cabbage').map((c) => c.key)).toEqual([
      'cabPurple', 'cabRed', 'cabPink', 'cabBlue', 'cabGreen', 'cabYellow',
    ]);
    expect(indicatorColorChart(exp, 'phenol')[0]).toEqual({ key: 'clear', hex: '#f1f1ee' });
  });
});

describe('validateIndicatorExperiment', () => {
  it('현재 매니페스트는 통과', () => {
    expect(validateIndicatorExperiment(exp)).toEqual([]);
  });
  it('colors에 없는 색 키', () => {
    const e = clone();
    e.indicators[2]!.colors[1]!.color = 'ghost';
    expect(validateIndicatorExperiment(e).join()).toContain('ghost');
    const f = clone();
    f.indicators[0]!.initial = 'ghost2';
    expect(validateIndicatorExperiment(f).join()).toContain('ghost2');
  });
  it('범위가 오름차순이 아니거나 마지막이 99가 아님', () => {
    const e = clone();
    e.indicators[3]!.colors[2]!.max = 1;
    expect(validateIndicatorExperiment(e).join()).toContain('오름차순');
    const f = clone();
    f.indicators[0]!.colors[1]!.max = 14;
    expect(validateIndicatorExperiment(f).join()).toContain('99');
  });
  it('키 중복과 groups', () => {
    const e = clone();
    e.solutions[1]!.key = 'hcl';
    e.indicators[1]!.key = 'blueLitmus';
    e.groups[1]!.key = 'neutral';
    const msg = validateIndicatorExperiment(e).join('\n');
    expect(msg).toContain('용액 키가 중복');
    expect(msg).toContain('지시약 키가 중복');
    expect(msg).toContain('acid와 base');
  });
});
