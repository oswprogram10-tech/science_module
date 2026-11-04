import { describe, expect, it } from 'vitest';
import manifestJson from '../../../content/units/g5-solution/manifest.json';
import { parseManifest, type ClassificationExperiment, type VariableExperiment } from '@sci/schema';
import {
  FALLBACK_PROBE,
  guardOutput,
  renderAndGuard,
  renderProbe,
  selectProbe,
  type ProbeContext,
} from './index';

const exp = parseManifest(manifestJson).experiments[0]! as VariableExperiment;
const labels = Object.fromEntries(exp.variables.map((v) => [v.key, v.label]));
const keys = exp.variables.map((v) => v.key);
const guard = { forbiddenAnswers: exp.tutor.forbiddenAnswers, limits: exp.limits };
const probes = exp.tutor.probes;

const ctx = (c: Partial<ProbeContext>): ProbeContext => ({ labels, ivKey: 'waterTempC', ...c });

describe('selectProbe 우선순위', () => {
  it('실행 전 -> before-run', () => {
    expect(selectProbe(ctx({}), probes, guard)).toContain('물의 온도를 바꾸면');
  });
  it('confounded', () => {
    const t = selectProbe(
      ctx({ lastAnalysis: { kind: 'confounded', changed: ['waterTempC', 'waterMl'] } }),
      probes,
      guard,
    );
    expect(t).toBe(
      '물의 온도와 물의 양이 함께 바뀌었어요. 녹은 양이 달라진 까닭이 어느 쪽 때문인지 어떻게 알아낼 수 있을까요?',
    );
  });
  it('iv-unchanged', () => {
    const t = selectProbe(
      ctx({ lastAnalysis: { kind: 'iv-unchanged', changed: ['stir'] } }),
      probes,
      guard,
    );
    expect(t).toBe(
      '물의 온도는 그대로인데 젓기가 바뀌었어요. 처음에 알아보려던 것을 확인하려면 다음에는 무엇을 바꿔야 할까요?',
    );
  });
  it('probe가 매니페스트에 없으면 FALLBACK_PROBE', () => {
    const without = probes.filter((p) => p.when !== 'iv-unchanged');
    expect(
      selectProbe(ctx({ lastAnalysis: { kind: 'iv-unchanged', changed: ['stir'] } }), without, guard),
    ).toBe(FALLBACK_PROBE);
  });
  it('repeat', () => {
    expect(selectProbe(ctx({ lastAnalysis: { kind: 'repeat', changed: [] } }), probes, guard)).toContain(
      '앞 시행과 조건이 같아요',
    );
  });
  it('prediction-mismatch가 iv별 fair-test보다 앞선다', () => {
    const t = selectProbe(
      ctx({
        ivKey: 'stir',
        lastAnalysis: { kind: 'fair-test', changed: ['stir'] },
        prediction: 'increase',
        observed: 'same',
      }),
      probes,
      guard,
    );
    expect(t).toContain('예측과 결과가 달랐네요');
  });
  it('fair-test + stir -> iv가 stir인 fair-test', () => {
    const t = selectProbe(
      ctx({
        ivKey: 'stir',
        lastAnalysis: { kind: 'fair-test', changed: ['stir'] },
        prediction: 'same',
        observed: 'same',
      }),
      probes,
      guard,
    );
    expect(t).toContain('젓는 빠르기');
  });
  it('fair-test -> fair-test', () => {
    const t = selectProbe(
      ctx({ lastAnalysis: { kind: 'fair-test', changed: ['waterTempC'] }, prediction: 'increase', observed: 'increase' }),
      probes,
      guard,
    );
    expect(t).toBe('물의 온도만 바꾸었을 때 녹은 양과 걸린 시간은 각각 어떻게 달라졌나요? 표에서 두 줄을 비교해 볼까요?');
  });
  it('iv가 일치하는 probe를 먼저, 없으면 iv 없는 probe를 고른다', () => {
    const list = [
      { when: 'fair-test', text: '일반' },
      { when: 'fair-test', iv: 'a', text: 'A용' },
      { when: 'fair-test', iv: 'b', text: 'B용' },
    ];
    const c = (iv: string) =>
      ctx({ ivKey: iv, lastAnalysis: { kind: 'fair-test', changed: [iv] }, prediction: 'same', observed: 'same' });
    expect(selectProbe(c('a'), list, guard)).toBe('A용');
    expect(selectProbe(c('b'), list, guard)).toBe('B용');
    expect(selectProbe(c('z'), list, guard)).toBe('일반');
    // iv가 없는 probe가 없고 일치하는 것도 없으면 고정 문구
    expect(selectProbe(c('z'), list.slice(1), guard)).toBe(FALLBACK_PROBE);
    // 순서와 무관하게 iv 일치가 우선
    expect(selectProbe(c('a'), [list[1]!, list[0]!], guard)).toBe('A용');
  });
  it('first-trial', () => {
    expect(selectProbe(ctx({ lastAnalysis: { kind: 'first-trial', changed: [] } }), probes, guard)).toContain(
      '기준으로 삼을 거예요',
    );
  });
});

describe('치환', () => {
  it('받침에 맞춰 조사를 바꾼다', () => {
    expect(renderProbe('{iv}을(를) 바꿔요', { iv: '물의 양', changed: [] })).toBe('물의 양을 바꿔요');
    expect(renderProbe('{iv}을(를) 바꿔요', { iv: '젓기', changed: [] })).toBe('젓기를 바꿔요');
    expect(renderProbe('{changed}이(가) 바뀜', { iv: '', changed: ['젓기', '물의 양'] })).toBe(
      '젓기와 물의 양이 바뀜',
    );
  });
  it('한글이 아닌 낱말 뒤에는 괄호형이 남는다', () => {
    expect(renderProbe('{iv}을(를)', { iv: 'pH', changed: [] })).toBe('pH을(를)');
  });
});

describe('guardOutput', () => {
  it('공백을 무시한 부분 문자열로 비교한다', () => {
    const r = guardOutput('온도가  높을수록 더 많이 녹아요', guard);
    expect(r.ok).toBe(false);
    expect(r.hits).toContain('온도가 높을수록 더 많이 녹');
  });
  it('우회 시도를 잡는다', () => {
    const cases = [
      '온도가 높을수록, 더 많이 녹아요',
      '분\u200b자',
      '분자'.normalize('NFD'),
      '온도가 높을수록 ... 더 많이 녹',
    ];
    for (const c of cases) expect(guardOutput(c, guard).ok, c).toBe(false);
  });
  it('limits도 걸러낸다', () => {
    expect(guardOutput('이온이 퍼져요', guard).ok).toBe(false);
  });
  it('걸리면 고정 문구로 바꾼다', () => {
    const bad = [{ when: 'before-run', text: '저어도 녹는 양은 같아요' }];
    expect(selectProbe(ctx({}), bad, guard)).toBe(FALLBACK_PROBE);
  });
});

describe('매니페스트 probe 전수 검사', () => {
  const subsets = (arr: string[]): string[][] => {
    const out: string[][] = [];
    for (let m = 1; m < 1 << arr.length; m++) out.push(arr.filter((_, i) => m & (1 << i)));
    return out;
  };
  it('모든 변인 조합으로 치환해도 가드를 통과한다', () => {
    let count = 0;
    for (const probe of probes) {
      for (const iv of keys) {
        for (const changed of subsets(keys)) {
          const text = renderProbe(probe.text, {
            iv: labels[iv]!,
            changed: changed.map((k) => labels[k]!),
          });
          expect(guardOutput(text, guard).ok, text).toBe(true);
          expect(text).not.toMatch(/[{}]|\(를\)|\(가\)|\(과\)/);
          count++;
        }
      }
    }
    expect(count).toBe(probes.length * keys.length * 15);
  });
});

// ---------- 여러 가지 기체 매니페스트 ----------
import gasesJson from '../../../content/units/g4-gases/manifest.json';
import acidBaseJson from '../../../content/units/g6-acid-base/manifest.json';

describe('g4-gases 매니페스트 probe', () => {
  const g = parseManifest(gasesJson).experiments[0]! as VariableExperiment;
  const gLabels = Object.fromEntries(g.variables.map((v) => [v.key, v.label]));
  const gKeys = g.variables.map((v) => v.key);
  const gGuard = { forbiddenAnswers: g.tutor.forbiddenAnswers, limits: g.limits };
  const gCtx = (c: Partial<ProbeContext>): ProbeContext => ({ labels: gLabels, ivKey: 'push', ...c });
  const fair = (iv: string): Partial<ProbeContext> => ({
    ivKey: iv,
    lastAnalysis: { kind: 'fair-test', changed: [iv] },
    prediction: 'same',
    observed: 'same',
  });

  it('iv별 fair-test 질문을 고른다', () => {
    expect(selectProbe(gCtx(fair('bathTempC')), g.tutor.probes, gGuard)).toContain('알갱이의 움직임');
    expect(selectProbe(gCtx(fair('gasType')), g.tutor.probes, gGuard)).toContain('기체의 종류만 바꾸었을 때');
    expect(selectProbe(gCtx(fair('push')), g.tutor.probes, gGuard)).toBe(
      '피스톤을 누르는 힘만 바꾸었을 때 주사기 눈금은 어떻게 달라졌나요? 알갱이 화면에서 알갱이 사이의 거리도 살펴볼까요?',
    );
  });

  it('모든 변인 조합으로 치환해도 가드를 통과한다 ("몰"이 일반 낱말에 걸리지 않는다)', () => {
    for (const probe of g.tutor.probes) {
      for (const iv of gKeys) {
        for (const changed of [...gKeys.map((k) => [k]), gKeys]) {
          const text = renderProbe(probe.text, { iv: gLabels[iv]!, changed: changed.map((k) => gLabels[k]!) });
          expect(guardOutput(text, gGuard).ok, text).toBe(true);
          expect(text).not.toMatch(/[{}]|\(를\)|\(가\)|\(과\)/);
        }
      }
    }
    for (const t of ['몰라요', '잘 몰랐어요', '물을 몰래 넣었어요']) {
      expect(guardOutput(t, gGuard).ok, t).toBe(false); // 참고: 낱말 단위가 아니라 부분 문자열 비교
    }
  });
});

describe('renderAndGuard (활동 유형과 무관한 탐침)', () => {
  const ab = parseManifest(acidBaseJson).experiments[0]! as ClassificationExperiment;
  const abGuard = { forbiddenAnswers: ab.tutor.forbiddenAnswers, limits: ab.limits };

  it('{solution}을 바꾸고 조사를 맞춘다', () => {
    expect(renderAndGuard('before-test', { solution: '식초' }, ab.tutor.probes, abGuard)).toBe(
      '식초는 산성일까요, 염기성일까요? 왜 그렇게 생각했나요?',
    );
    expect(renderAndGuard('before-test', { solution: '레몬즙' }, ab.tutor.probes, abGuard)).toContain('레몬즙은 산성일까요');
    expect(renderAndGuard('before-test', { solution: '탄산수' }, ab.tutor.probes, abGuard)).toContain('탄산수는 ');
    expect(renderAndGuard('check-inconsistent', { solution: '석회수' }, ab.tutor.probes, abGuard)).toContain('석회수의 지시약');
  });
  it('맞는 probe가 없으면 FALLBACK_PROBE', () => {
    expect(renderAndGuard('nope', {}, ab.tutor.probes, abGuard)).toBe(FALLBACK_PROBE);
  });
  it('가드에 걸리면 FALLBACK_PROBE', () => {
    const probes = [{ when: 'x', text: '{solution}은(는) 산성 용액이에요.' }];
    expect(renderAndGuard('x', { solution: '식초' }, probes, abGuard)).toBe(FALLBACK_PROBE);
  });
  it('전수 가드: 모든 probe × 모든 용액 이름이 가드를 통과하고 폴백이 아니다', () => {
    for (const probe of ab.tutor.probes) {
      for (const s of ab.solutions) {
        const out = renderAndGuard(probe.when, { solution: s.label }, ab.tutor.probes, abGuard);
        expect(out, `${probe.when}/${s.label}`).not.toBe(FALLBACK_PROBE);
        expect(guardOutput(out, abGuard).ok, `${probe.when}/${s.label}: ${out}`).toBe(true);
        expect(out).not.toMatch(/\{|\}|\(를\)|\(는\)|\(가\)|pH/);
      }
    }
  });
  it('금지 문장은 실제로 가드에 걸린다', () => {
    for (const phrase of ab.tutor.forbiddenAnswers) expect(guardOutput(phrase, abGuard).ok).toBe(false);
  });
});

// ---------- 물질의 연소 매니페스트 ----------
import combustionJson from '../../../content/units/g6-combustion/manifest.json';

describe('g6-combustion 매니페스트 probe', () => {
  const c = parseManifest(combustionJson).experiments[0]! as VariableExperiment;
  const cLabels = Object.fromEntries(c.variables.map((v) => [v.key, v.label]));
  const cKeys = c.variables.map((v) => v.key);
  const cGuard = { forbiddenAnswers: c.tutor.forbiddenAnswers, limits: c.limits };
  const cCtx = (x: Partial<ProbeContext>): ProbeContext => ({ labels: cLabels, ivKey: 'jarMl', ...x });
  const fair = (iv: string): Partial<ProbeContext> => ({
    ivKey: iv,
    lastAnalysis: { kind: 'fair-test', changed: [iv] },
    prediction: 'same',
    observed: 'same',
  });

  it('iv별 fair-test 질문을 고른다', () => {
    expect(selectProbe(cCtx(fair('jarMl')), c.tutor.probes, cGuard)).toContain('집기병 안에 무엇이');
    expect(selectProbe(cCtx(fair('candleColor')), c.tutor.probes, cGuard)).toContain('초의 색깔만 바꾸었을 때');
    expect(selectProbe(cCtx(fair('candleCount')), c.tutor.probes, cGuard)).toContain('센서 값도 함께 비교해 볼까요?');
  });

  it('모든 probe × 모든 변인 조합으로 치환해도 가드를 통과한다 (오검출 없음)', () => {
    let n = 0;
    for (const probe of c.tutor.probes) {
      for (const iv of cKeys) {
        for (const changed of [...cKeys.map((k) => [k]), cKeys]) {
          const text = renderProbe(probe.text, { iv: cLabels[iv]!, changed: changed.map((k) => cLabels[k]!) });
          expect(guardOutput(text, cGuard).ok, text).toBe(true);
          expect(text).not.toMatch(/[{}]|\(를\)|\(가\)|\(과\)/);
          n++;
        }
      }
    }
    expect(n).toBe(c.tutor.probes.length * cKeys.length * (cKeys.length + 1));
  });

  it('금지 구절을 담은 문장은 실제로 막는다', () => {
    for (const f of c.tutor.forbiddenAnswers) expect(guardOutput(`${f}요`, cGuard).ok, f).toBe(false);
  });

  it('모든 시행 상황에서 고른 질문이 가드를 통과하고 폴백이 아니다', () => {
    const situations: Partial<ProbeContext>[] = [
      {},
      { lastAnalysis: { kind: 'first-trial', changed: [] } },
      { lastAnalysis: { kind: 'confounded', changed: ['jarMl', 'candle'] } },
      { lastAnalysis: { kind: 'iv-unchanged', changed: ['candle'] } },
      { lastAnalysis: { kind: 'repeat', changed: [] } },
      { ...fair('jarMl'), prediction: 'increase', observed: 'decrease' },
    ];
    for (const s of situations) {
      const text = selectProbe(cCtx(s), c.tutor.probes, cGuard);
      expect(text).not.toBe(FALLBACK_PROBE);
      expect(guardOutput(text, cGuard).ok, text).toBe(true);
    }
  });
});
