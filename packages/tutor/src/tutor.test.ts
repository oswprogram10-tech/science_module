import { describe, expect, it } from 'vitest';
import manifestJson from '../../../content/units/g5-solution/manifest.json';
import { parseManifest, type ClassificationExperiment, type ObservationExperiment, type VariableExperiment } from '@sci/schema';
import earthMotionJson from '../../../content/units/g6-earth-motion/manifest.json';
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
  it('괄호 설명으로 끝나는 라벨은 괄호 앞 낱말에 맞춘다', () => {
    expect(renderProbe('{iv}을(를) 바꿔요', { iv: '계절(공전 위치)', changed: [] })).toBe('계절(공전 위치)을 바꿔요');
    expect(renderProbe('{changed}이(가) 바뀌었어요', { iv: '', changed: ['자전축 기울기', '계절(공전 위치)'] })).toBe('자전축 기울기와 계절(공전 위치)이 바뀌었어요');
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

// ---------- 열과 우리 생활(보온 컵) 매니페스트 ----------
import heatJson from '../../../content/units/g5-heat/manifest.json';

describe('g5-heat 매니페스트 probe', () => {
  const h = parseManifest(heatJson).experiments[0]! as VariableExperiment;
  const hLabels = Object.fromEntries(h.variables.map((v) => [v.key, v.label]));
  const hKeys = h.variables.map((v) => v.key);
  const hGuard = { forbiddenAnswers: h.tutor.forbiddenAnswers, limits: h.limits };
  const hCtx = (x: Partial<ProbeContext>): ProbeContext => ({ labels: hLabels, ivKey: 'wrap', ...x });
  const fair = (iv: string): Partial<ProbeContext> => ({
    ivKey: iv,
    lastAnalysis: { kind: 'fair-test', changed: [iv] },
    prediction: 'same',
    observed: 'same',
  });

  it('iv별 fair-test 질문을 고른다', () => {
    expect(selectProbe(hCtx(fair('wrap')), h.tutor.probes, hGuard)).toContain('열화상 화면에서 컵 바깥의 색');
    expect(selectProbe(hCtx(fair('lid')), h.tutor.probes, hGuard)).toContain('김이 나는 모습');
    expect(selectProbe(hCtx(fair('layers')), h.tutor.probes, hGuard)).toContain('겹 수만 바꾸었을 때 결과가 달라졌나요?');
    expect(selectProbe(hCtx(fair('waterMl')), h.tutor.probes, hGuard)).toContain('물의 양만 바꾸었을 때 물이 식은 정도');
  });

  it('모든 probe × 모든 변인 조합으로 치환해도 가드를 통과한다 (오검출 없음)', () => {
    let n = 0;
    for (const probe of h.tutor.probes) {
      for (const iv of hKeys) {
        for (const changed of [...hKeys.map((k) => [k]), hKeys]) {
          const text = renderProbe(probe.text, { iv: hLabels[iv]!, changed: changed.map((k) => hLabels[k]!) });
          expect(guardOutput(text, hGuard).ok, text).toBe(true);
          expect(text).not.toMatch(/[{}]|\(를\)|\(가\)|\(과\)/);
          n++;
        }
      }
    }
    expect(n).toBe(h.tutor.probes.length * hKeys.length * (hKeys.length + 1));
  });

  it('금지 구절을 담은 문장은 실제로 막는다', () => {
    for (const f of h.tutor.forbiddenAnswers) expect(guardOutput(`${f}요`, hGuard).ok, f).toBe(false);
  });

  it('모든 시행 상황에서 고른 질문이 가드를 통과하고 폴백이 아니다', () => {
    const situations: Partial<ProbeContext>[] = [
      {},
      { lastAnalysis: { kind: 'first-trial', changed: [] } },
      { lastAnalysis: { kind: 'confounded', changed: ['wrap', 'lid'] } },
      { lastAnalysis: { kind: 'iv-unchanged', changed: ['lid'] } },
      { lastAnalysis: { kind: 'repeat', changed: [] } },
      { ...fair('wrap'), prediction: 'increase', observed: 'decrease' },
    ];
    for (const s of situations) {
      const text = selectProbe(hCtx(s), h.tutor.probes, hGuard);
      expect(text).not.toBe(FALLBACK_PROBE);
      expect(guardOutput(text, hGuard).ok, text).toBe(true);
    }
  });
});

// ---------- 빛의 성질(볼록 렌즈) 매니페스트 ----------
import lightJson from '../../../content/units/g5-light/manifest.json';

describe('g5-light 매니페스트 probe', () => {
  const l = parseManifest(lightJson).experiments[0]! as VariableExperiment;
  const lLabels = Object.fromEntries(l.variables.map((v) => [v.key, v.label]));
  const lKeys = l.variables.map((v) => v.key);
  const lGuard = { forbiddenAnswers: l.tutor.forbiddenAnswers, limits: l.limits };
  const lCtx = (x: Partial<ProbeContext>): ProbeContext => ({ labels: lLabels, ivKey: 'distanceCm', ...x });
  const fair = (iv: string): Partial<ProbeContext> => ({
    ivKey: iv,
    lastAnalysis: { kind: 'fair-test', changed: [iv] },
    prediction: 'same',
    observed: 'same',
  });

  it('iv별 fair-test 질문을 고른다', () => {
    expect(selectProbe(lCtx(fair('distanceCm')), l.tutor.probes, lGuard)).toContain('빛이 한곳에 모이는 곳과 종이의 위치를 비교해');
    expect(selectProbe(lCtx(fair('diameterCm')), l.tutor.probes, lGuard)).toContain('렌즈의 크기만 바꾸었을 때 빛 원의 크기와 밝기');
    expect(selectProbe(lCtx(fair('curve')), l.tutor.probes, lGuard)).toContain('렌즈가 볼록한 정도만 바꾸었을 때 빛 원의 크기와 온도');
  });

  it('모든 probe × 모든 변인 조합으로 치환해도 가드를 통과한다 (오검출 없음)', () => {
    let n = 0;
    for (const probe of l.tutor.probes) {
      for (const iv of lKeys) {
        for (const changed of [...lKeys.map((k) => [k]), lKeys]) {
          const text = renderProbe(probe.text, { iv: lLabels[iv]!, changed: changed.map((k) => lLabels[k]!) });
          expect(guardOutput(text, lGuard).ok, text).toBe(true);
          expect(text).not.toMatch(/[{}]|\(를\)|\(가\)|\(과\)/);
          n++;
        }
      }
    }
    expect(n).toBe(l.tutor.probes.length * lKeys.length * (lKeys.length + 1));
  });

  it('금지 구절을 담은 문장은 실제로 막는다', () => {
    for (const f of l.tutor.forbiddenAnswers) expect(guardOutput(`${f}요`, lGuard).ok, f).toBe(false);
  });

  it('모든 시행 상황에서 고른 질문이 가드를 통과하고 폴백이 아니다', () => {
    const situations: Partial<ProbeContext>[] = [
      {},
      { lastAnalysis: { kind: 'first-trial', changed: [] } },
      { lastAnalysis: { kind: 'confounded', changed: ['distanceCm', 'curve'] } },
      { lastAnalysis: { kind: 'iv-unchanged', changed: ['curve'] } },
      { lastAnalysis: { kind: 'repeat', changed: [] } },
      { ...fair('distanceCm'), prediction: 'increase', observed: 'decrease' },
    ];
    for (const s of situations) {
      const text = selectProbe(lCtx(s), l.tutor.probes, lGuard);
      expect(text).not.toBe(FALLBACK_PROBE);
      expect(guardOutput(text, lGuard).ok, text).toBe(true);
    }
  });
});

// ---------- 전기의 이용(전자석) 매니페스트 ----------
import electricityJson from '../../../content/units/g6-electricity/manifest.json';

describe('g6-electricity 매니페스트 probe', () => {
  const e = parseManifest(electricityJson).experiments[0]! as VariableExperiment;
  const eLabels = Object.fromEntries(e.variables.map((v) => [v.key, v.label]));
  const eKeys = e.variables.map((v) => v.key);
  const eGuard = { forbiddenAnswers: e.tutor.forbiddenAnswers, limits: e.limits };
  const eCtx = (x: Partial<ProbeContext>): ProbeContext => ({ labels: eLabels, ivKey: 'turns', ...x });
  const fair = (iv: string): Partial<ProbeContext> => ({
    ivKey: iv,
    lastAnalysis: { kind: 'fair-test', changed: [iv] },
    prediction: 'same',
    observed: 'same',
  });

  it('iv별 fair-test 질문을 고른다', () => {
    expect(selectProbe(eCtx(fair('battery')), e.tutor.probes, eGuard)).toContain('점이 움직이는 빠르기는 어떻게 달랐나요');
    expect(selectProbe(eCtx(fair('direction')), e.tutor.probes, eGuard)).toContain('클립의 수와 나침반 바늘은 각각 어떻게 되었나요');
    expect(selectProbe(eCtx(fair('core')), e.tutor.probes, eGuard)).toContain('속에 넣은 것만 바꾸었을 때 클립의 수가 어떻게 달라졌나요');
    expect(selectProbe(eCtx(fair('turns')), e.tutor.probes, eGuard)).toContain('에나멜선을 감은 횟수만 바꾸었을 때 붙은 클립의 수');
  });

  it('모든 probe × 모든 변인 조합으로 치환해도 가드를 통과한다 (오검출 없음)', () => {
    let n = 0;
    for (const probe of e.tutor.probes) {
      for (const iv of eKeys) {
        for (const changed of [...eKeys.map((k) => [k]), eKeys]) {
          const text = renderProbe(probe.text, { iv: eLabels[iv]!, changed: changed.map((k) => eLabels[k]!) });
          expect(guardOutput(text, eGuard).ok, text).toBe(true);
          expect(text).not.toMatch(/[{}]|\(를\)|\(가\)|\(과\)/);
          n++;
        }
      }
    }
    expect(n).toBe(e.tutor.probes.length * eKeys.length * (eKeys.length + 1));
  });

  it('금지 구절을 담은 문장은 실제로 막는다', () => {
    for (const f of e.tutor.forbiddenAnswers) expect(guardOutput(`${f}요`, eGuard).ok, f).toBe(false);
  });

  it('모든 시행 상황에서 고른 질문이 가드를 통과하고 폴백이 아니다', () => {
    const situations: Partial<ProbeContext>[] = [
      {},
      { lastAnalysis: { kind: 'first-trial', changed: [] } },
      { lastAnalysis: { kind: 'confounded', changed: ['turns', 'battery'] } },
      { lastAnalysis: { kind: 'iv-unchanged', changed: ['battery'] } },
      { lastAnalysis: { kind: 'repeat', changed: [] } },
      { ...fair('turns'), prediction: 'increase', observed: 'same' },
      { ...fair('direction'), prediction: 'increase', observed: 'same' },
    ];
    for (const s of situations) {
      const text = selectProbe(eCtx(s), e.tutor.probes, eGuard);
      expect(text).not.toBe(FALLBACK_PROBE);
      expect(guardOutput(text, eGuard).ok, text).toBe(true);
    }
  });
});

// ---------- 땅의 변화(마그마 냉각) 매니페스트 ----------
import landJson from '../../../content/units/g4-land/manifest.json';

describe('g4-land 매니페스트 probe', () => {
  const e = parseManifest(landJson).experiments[0]! as VariableExperiment;
  const eLabels = Object.fromEntries(e.variables.map((v) => [v.key, v.label]));
  const eKeys = e.variables.map((v) => v.key);
  const eGuard = { forbiddenAnswers: e.tutor.forbiddenAnswers, limits: e.limits };
  const eCtx = (x: Partial<ProbeContext>): ProbeContext => ({ labels: eLabels, ivKey: 'place', ...x });
  const fair = (iv: string): Partial<ProbeContext> => ({
    ivKey: iv,
    lastAnalysis: { kind: 'fair-test', changed: [iv] },
    prediction: 'same',
    observed: 'same',
  });

  it('iv별 fair-test 질문을 고른다', () => {
    expect(selectProbe(eCtx(fair('place')), e.tutor.probes, eGuard)).toContain('온도가 내려가는 빠르기를 비교해 볼까요');
    expect(selectProbe(eCtx(fair('color')), e.tutor.probes, eGuard)).toContain('색깔만 바꾸었을 때 알갱이 크기가 달라졌나요');
    expect(selectProbe(eCtx(fair('grams')), e.tutor.probes, eGuard)).toContain('알갱이 크기와 굳는 데 걸린 시간');
  });

  it('모든 probe × 모든 변인 조합으로 치환해도 가드를 통과한다 (오검출 없음)', () => {
    let n = 0;
    for (const probe of e.tutor.probes) {
      for (const iv of eKeys) {
        for (const changed of [...eKeys.map((k) => [k]), eKeys]) {
          const text = renderProbe(probe.text, { iv: eLabels[iv]!, changed: changed.map((k) => eLabels[k]!) });
          expect(guardOutput(text, eGuard).ok, text).toBe(true);
          expect(text).not.toMatch(/[{}]|\(를\)|\(가\)|\(과\)/);
          n++;
        }
      }
    }
    expect(n).toBe(e.tutor.probes.length * eKeys.length * (eKeys.length + 1));
  });

  it('금지 구절을 담은 문장은 실제로 막는다', () => {
    for (const f of e.tutor.forbiddenAnswers) expect(guardOutput(`${f}요`, eGuard).ok, f).toBe(false);
    for (const l of e.limits) expect(guardOutput(`${l}이에요`, eGuard).ok, l).toBe(false);
  });

  it('모든 시행 상황에서 고른 질문이 가드를 통과하고 폴백이 아니다', () => {
    const situations: Partial<ProbeContext>[] = [
      {},
      { lastAnalysis: { kind: 'first-trial', changed: [] } },
      { lastAnalysis: { kind: 'confounded', changed: ['place', 'dish'] } },
      { lastAnalysis: { kind: 'iv-unchanged', changed: ['dish'] } },
      { lastAnalysis: { kind: 'repeat', changed: [] } },
      { ...fair('place'), prediction: 'increase', observed: 'same' },
      { ...fair('color'), prediction: 'increase', observed: 'same' },
    ];
    for (const s of situations) {
      const text = selectProbe(eCtx(s), e.tutor.probes, eGuard);
      expect(text).not.toBe(FALLBACK_PROBE);
      expect(guardOutput(text, eGuard).ok, text).toBe(true);
    }
  });
});

// ---------- 지구의 운동(관찰 활동) 매니페스트 ----------
describe('지구의 운동 과제 probe 전수 검사', () => {
  const o = parseManifest(earthMotionJson).experiments[0]! as ObservationExperiment;
  const oGuard = { forbiddenAnswers: o.tutor.forbiddenAnswers, limits: o.limits };

  it('모든 과제 × 모든 probe가 가드를 통과하고 폴백이 아니며 그대로 출력된다', () => {
    let count = 0;
    for (const task of o.tasks) {
      for (const probe of task.probes) {
        const out = renderAndGuard(probe.when, {}, task.probes, oGuard);
        expect(out, `${task.id}/${probe.when}`).not.toBe(FALLBACK_PROBE);
        expect(out).toBe(probe.text);
        expect(guardOutput(probe.text, oGuard).ok, `${task.id}/${probe.when}: ${probe.text}`).toBe(true);
        expect(out).not.toMatch(/\{|\}|\(를\)|\(는\)|\(가\)/);
        count++;
      }
    }
    expect(count).toBe(25);
  });

  it('과제 probe에는 어려운 용어(limits)와 정답 문장이 없다', () => {
    for (const task of o.tasks) {
      for (const probe of task.probes) {
        for (const l of o.limits) expect(probe.text, `${task.id}/${probe.when}`).not.toContain(l);
        for (const f of o.tutor.forbiddenAnswers) expect(probe.text, `${task.id}/${probe.when}`).not.toContain(f);
      }
    }
  });

  it('금지 문장과 limits 용어는 실제로 가드에 걸린다', () => {
    for (const phrase of o.tutor.forbiddenAnswers) expect(guardOutput(phrase, oGuard).ok).toBe(false);
    for (const l of o.limits) expect(guardOutput(`${l}이에요`, oGuard).ok, l).toBe(false);
  });
});

// ---------- 계절의 변화(태양 고도) 매니페스트 ----------
import seasonsJson from '../../../content/units/g6-seasons/manifest.json';

describe('g6-seasons 매니페스트 probe', () => {
  const e = parseManifest(seasonsJson).experiments[0]! as VariableExperiment;
  const eLabels = Object.fromEntries(e.variables.map((v) => [v.key, v.label]));
  const eKeys = e.variables.map((v) => v.key);
  const eGuard = { forbiddenAnswers: e.tutor.forbiddenAnswers, limits: e.limits };
  const eCtx = (x: Partial<ProbeContext>): ProbeContext => ({ labels: eLabels, ivKey: 'season', ...x });
  const fair = (iv: string): Partial<ProbeContext> => ({
    ivKey: iv,
    lastAnalysis: { kind: 'fair-test', changed: [iv] },
    prediction: 'same',
    observed: 'same',
  });

  it('iv별 fair-test 질문을 고른다', () => {
    expect(selectProbe(eCtx(fair('season')), e.tutor.probes, eGuard)).toContain('우주에서 보기 화면에서 지구의 자전축과 태양 빛이 우리나라에 닿는 모습');
    expect(selectProbe(eCtx(fair('tiltDeg')), e.tutor.probes, eGuard)).toContain('이 기울기에서 계절을 바꾸면 결과가 어떻게 될지');
    expect(selectProbe(eCtx(fair('stickCm')), e.tutor.probes, eGuard)).toContain('달라진 값과 달라지지 않은 값은 각각 무엇인가요');
  });

  it('모든 probe × 모든 변인 조합으로 치환해도 가드를 통과한다 (오검출 없음)', () => {
    let n = 0;
    for (const probe of e.tutor.probes) {
      for (const iv of eKeys) {
        for (const changed of [...eKeys.map((k) => [k]), eKeys]) {
          const text = renderProbe(probe.text, { iv: eLabels[iv]!, changed: changed.map((k) => eLabels[k]!) });
          expect(guardOutput(text, eGuard).ok, text).toBe(true);
          // "계절(공전 위치)"처럼 괄호로 끝나는 라벨도 괄호 앞 낱말로 조사를 맞추므로 괄호형 조사가 남지 않아야 한다.
          expect(text).not.toMatch(/[{}]/);
          expect(text).not.toMatch(/(을\(를\)|이\(가\)|와\(과\)|은\(는\))/);
          n++;
        }
      }
    }
    expect(n).toBe(e.tutor.probes.length * eKeys.length * (eKeys.length + 1));
  });

  it('금지 구절을 담은 문장과 limits 용어를 담은 문장은 실제로 막는다', () => {
    for (const f of e.tutor.forbiddenAnswers) expect(guardOutput(`${f}요`, eGuard).ok, f).toBe(false);
    for (const l of e.limits) expect(guardOutput(`${l}이에요`, eGuard).ok, l).toBe(false);
  });

  it('화면에 보이는 매니페스트 글(질문, 변인·선택지 이름, 점검표)에는 limits 용어가 없다', () => {
    const shown = [
      e.title,
      e.question,
      e.predictionPrompt,
      ...e.variables.flatMap((v) => [v.label, ...v.options.map((o) => o.label)]),
      ...e.dependent.map((d) => d.label),
      ...(e.safetyChecklist ?? []),
      ...e.tutor.probes.map((p) => p.text),
    ];
    for (const text of shown) for (const l of e.limits) expect(text, text).not.toContain(l);
  });

  it('모든 시행 상황에서 고른 질문이 가드를 통과하고 폴백이 아니다', () => {
    const situations: Partial<ProbeContext>[] = [
      {},
      { lastAnalysis: { kind: 'first-trial', changed: [] } },
      { lastAnalysis: { kind: 'confounded', changed: ['season', 'tiltDeg'] } },
      { lastAnalysis: { kind: 'iv-unchanged', changed: ['stickCm'] } },
      { lastAnalysis: { kind: 'repeat', changed: [] } },
      { ...fair('season'), prediction: 'increase', observed: 'same' },
      { ...fair('tiltDeg'), prediction: 'increase', observed: 'same' },
      { ...fair('stickCm'), prediction: 'increase', observed: 'same' },
    ];
    for (const s of situations) {
      const text = selectProbe(eCtx(s), e.tutor.probes, eGuard);
      expect(text).not.toBe(FALLBACK_PROBE);
      expect(guardOutput(text, eGuard).ok, text).toBe(true);
    }
  });
});

// ---------- 생물의 한살이(싹 트는 조건) 매니페스트 ----------
import lifecycleJson from '../../../content/units/g3-lifecycle/manifest.json';

describe('g3-lifecycle 매니페스트 probe', () => {
  const e = parseManifest(lifecycleJson).experiments[0]! as VariableExperiment;
  const eLabels = Object.fromEntries(e.variables.map((v) => [v.key, v.label]));
  const eKeys = e.variables.map((v) => v.key);
  const eGuard = { forbiddenAnswers: e.tutor.forbiddenAnswers, limits: e.limits };
  const eCtx = (x: Partial<ProbeContext>): ProbeContext => ({ labels: eLabels, ivKey: 'water', ...x });
  const fair = (iv: string): Partial<ProbeContext> => ({
    ivKey: iv,
    lastAnalysis: { kind: 'fair-test', changed: [iv] },
    prediction: 'same',
    observed: 'same',
  });

  it('iv별 fair-test 질문을 고른다', () => {
    expect(selectProbe(eCtx(fair('light')), e.tutor.probes, eGuard)).toContain('빛만 바꾸었을 때 싹 튼 씨앗 수와 떡잎 색은 각각 어떻게 되었나요');
    expect(selectProbe(eCtx(fair('tempC')), e.tutor.probes, eGuard)).toContain('그래프에서 싹이 트기 시작한 때를 비교해 볼까요');
    expect(selectProbe(eCtx(fair('water')), e.tutor.probes, eGuard)).toContain('물만 바꾸었을 때 싹 튼 씨앗 수와 처음 싹 튼 날은 각각 어떻게 달라졌나요');
  });

  it('모든 probe × 모든 변인 조합으로 치환해도 가드를 통과한다 (오검출 없음)', () => {
    let n = 0;
    for (const probe of e.tutor.probes) {
      for (const iv of eKeys) {
        for (const changed of [...eKeys.map((k) => [k]), eKeys]) {
          const text = renderProbe(probe.text, { iv: eLabels[iv]!, changed: changed.map((k) => eLabels[k]!) });
          expect(guardOutput(text, eGuard).ok, text).toBe(true);
          expect(text).not.toMatch(/[{}]/);
          expect(text).not.toMatch(/(을\(를\)|이\(가\)|와\(과\)|은\(는\))/);
          n++;
        }
      }
    }
    expect(n).toBe(e.tutor.probes.length * eKeys.length * (eKeys.length + 1));
  });

  it('질문 문장은 금지 구절·limits 용어와 겹치지 않는다', () => {
    for (const probe of e.tutor.probes) {
      for (const f of e.tutor.forbiddenAnswers) expect(probe.text, probe.text).not.toContain(f);
      for (const l of e.limits) expect(probe.text, probe.text).not.toContain(l);
    }
  });

  it('금지 구절을 담은 문장과 limits 용어를 담은 문장은 실제로 막는다', () => {
    for (const f of e.tutor.forbiddenAnswers) expect(guardOutput(`${f}요`, eGuard).ok, f).toBe(false);
    for (const l of e.limits) expect(guardOutput(`${l}이에요`, eGuard).ok, l).toBe(false);
  });

  it('화면에 보이는 매니페스트 글(질문, 변인·선택지 이름)에는 limits 용어가 없다', () => {
    const shown = [
      e.title,
      e.question,
      e.predictionPrompt,
      ...e.variables.flatMap((v) => [v.label, ...v.options.map((o) => o.label)]),
      ...e.dependent.map((d) => d.label),
      ...e.tutor.probes.map((p) => p.text),
    ];
    for (const text of shown) for (const l of e.limits) expect(text, text).not.toContain(l);
  });

  it('모든 시행 상황에서 고른 질문이 가드를 통과하고 폴백이 아니다', () => {
    const situations: Partial<ProbeContext>[] = [
      {},
      { lastAnalysis: { kind: 'first-trial', changed: [] } },
      { lastAnalysis: { kind: 'confounded', changed: ['water', 'tempC'] } },
      { lastAnalysis: { kind: 'iv-unchanged', changed: ['light'] } },
      { lastAnalysis: { kind: 'repeat', changed: [] } },
      ...eKeys.flatMap((k) => [fair(k), { ...fair(k), prediction: 'increase' as const, observed: 'same' as const }]),
    ];
    for (const s of situations) {
      const text = selectProbe(eCtx(s), e.tutor.probes, eGuard);
      expect(text).not.toBe(FALLBACK_PROBE);
      expect(guardOutput(text, eGuard).ok, text).toBe(true);
    }
  });
});
