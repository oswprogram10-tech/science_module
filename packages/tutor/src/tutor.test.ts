import { describe, expect, it } from 'vitest';
import manifestJson from '../../../content/units/g5-solution/manifest.json';
import { parseManifest, type ClassificationExperiment, type ObservationExperiment, type VariableExperiment } from '@sci/schema';
import earthMotionJson from '../../../content/units/g6-earth-motion/manifest.json';
import nightSkyJson from '../../../content/units/g4-night-sky/manifest.json';
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

// ---------- 밤하늘 관찰(관찰 활동 재사용) 매니페스트 ----------
describe('밤하늘 관찰 과제 probe 전수 검사', () => {
  const n = parseManifest(nightSkyJson).experiments[0]! as ObservationExperiment;
  const nGuard = { forbiddenAnswers: n.tutor.forbiddenAnswers, limits: n.limits };
  const WHENS = ['before-observe', 'observing', 'record-mismatch', 'record-match', 'prediction-mismatch'] as const;

  it('과제 6개(태양계 2 · 북쪽 하늘 2 · 달 2) × 5가지 when이 모두 있고 가드를 통과하며 폴백이 아니고 그대로 출력된다', () => {
    let count = 0;
    expect(n.tasks).toHaveLength(6);
    for (const task of n.tasks) {
      expect(task.probes.map((p) => p.when).sort(), task.id).toEqual([...WHENS].sort());
      for (const when of WHENS) {
        const probe = task.probes.find((p) => p.when === when)!;
        const out = renderAndGuard(when, {}, task.probes, nGuard);
        expect(out, `${task.id}/${when}`).not.toBe(FALLBACK_PROBE);
        expect(out).toBe(probe.text);
        expect(guardOutput(probe.text, nGuard).ok, `${task.id}/${when}: ${probe.text}`).toBe(true);
        expect(out).not.toMatch(/\{|\}|\(를\)|\(는\)|\(가\)/);
        count++;
      }
    }
    expect(count).toBe(30);
  });

  it('모든 probe는 질문형이고, 어려운 용어(limits)와 정답 문장이 없다', () => {
    for (const task of n.tasks) {
      for (const probe of task.probes) {
        expect(probe.text.endsWith('?'), `${task.id}/${probe.when}: ${probe.text}`).toBe(true);
        for (const l of n.limits) expect(probe.text, `${task.id}/${probe.when}`).not.toContain(l);
        for (const f of n.tutor.forbiddenAnswers) expect(probe.text, `${task.id}/${probe.when}`).not.toContain(f);
      }
    }
  });

  it('금지 문장과 limits 용어는 실제로 가드에 걸린다', () => {
    for (const phrase of n.tutor.forbiddenAnswers) expect(guardOutput(phrase, nGuard).ok, phrase).toBe(false);
    for (const l of n.limits) expect(guardOutput(`${l}이에요`, nGuard).ok, l).toBe(false);
  });

  it('활용형·조사가 붙은 정답 문장도 가드에 걸린다', () => {
    const inflected = [
      '목성은 지구보다 약 11배',
      '목성은 지구보다 11배예요',
      '목성은 지구보다 약 11배 커요',
      '목성의 지름은 지구의 약 11배예요',
      '목성은 약 11배 큽니다',
      '해왕성까지 약 30칸이에요',
      '해왕성까지 30칸쯤 돼요',
      '해왕성은 약 30칸 떨어져 있어요',
      '30칸쯤 될 거예요',
      '북극성은 거의 움직이지 않아요',
      '북극성은 움직이지 않는 것처럼 보여요',
      '북극성은 거의 제자리에 있어요',
      '거의 제자리에 있어요',
      '5배만큼 늘이면 북극성에 닿아요',
      '5배 늘이면 북극성이에요',
      '가장 큰 행성은 목성이에요',
      '목성이 가장 큰 행성이에요',
    ];
    for (const text of inflected) expect(guardOutput(text, nGuard).ok, text).toBe(false);
  });

  it('렌더 단계에서도 정답 문장이 든 probe는 폴백으로 바뀐다', () => {
    const bad = [{ when: 'record-match', text: '목성은 지구보다 약 11배 커요.' }];
    expect(renderAndGuard('record-match', {}, bad, nGuard)).toBe(FALLBACK_PROBE);
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

// ---------- 식물의 구조와 기능(증산 작용) 매니페스트 ----------
import plantJson from '../../../content/units/g6-plant/manifest.json';

describe('g6-plant 매니페스트 probe', () => {
  const e = parseManifest(plantJson).experiments[0]! as VariableExperiment;
  const eLabels = Object.fromEntries(e.variables.map((v) => [v.key, v.label]));
  const eKeys = e.variables.map((v) => v.key);
  const eGuard = { forbiddenAnswers: e.tutor.forbiddenAnswers, limits: e.limits };
  const eCtx = (x: Partial<ProbeContext>): ProbeContext => ({ labels: eLabels, ivKey: 'leaves', ...x });
  const fair = (iv: string): Partial<ProbeContext> => ({
    ivKey: iv,
    lastAnalysis: { kind: 'fair-test', changed: [iv] },
    prediction: 'same',
    observed: 'same',
  });

  it('iv별 fair-test 질문을 고른다', () => {
    expect(selectProbe(eCtx(fair('leaves')), e.tutor.probes, eGuard)).toContain('잎을 모두 딴 줄기와 잎이 달린 줄기에서 비닐봉지 안은 어떻게 달랐나요? 물은 어디로 갔을까요?');
    expect(selectProbe(eCtx(fair('startMl')), e.tutor.probes, eGuard)).toContain('남은 양과 줄어든 양을 구분해서 볼까요');
    // 전용 질문이 없는 변인은 공통 fair-test 질문
    expect(selectProbe(eCtx(fair('light')), e.tutor.probes, eGuard)).toContain('빛만 바꾸었을 때 줄어든 물의 양과 비닐봉지 안의 모습은 어떻게 달라졌나요');
    expect(selectProbe(eCtx(fair('wind')), e.tutor.probes, eGuard)).toContain('바람만 바꾸었을 때 줄어든 물의 양과 비닐봉지 안의 모습은 어떻게 달라졌나요');
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
      { lastAnalysis: { kind: 'confounded', changed: ['leaves', 'light'] } },
      { lastAnalysis: { kind: 'iv-unchanged', changed: ['wind'] } },
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

// ---------- 생물과 환경(먹이 관계) 매니페스트 ----------
import ecosystemJson from '../../../content/units/g4-ecosystem/manifest.json';

describe('g4-ecosystem 매니페스트 probe', () => {
  const e = parseManifest(ecosystemJson).experiments[0]! as VariableExperiment;
  const eLabels = Object.fromEntries(e.variables.map((v) => [v.key, v.label]));
  const eKeys = e.variables.map((v) => v.key);
  const eGuard = { forbiddenAnswers: e.tutor.forbiddenAnswers, limits: e.limits };
  const eCtx = (x: Partial<ProbeContext>): ProbeContext => ({ labels: eLabels, ivKey: 'rabbits0', ...x });
  const fair = (iv: string): Partial<ProbeContext> => ({
    ivKey: iv,
    lastAnalysis: { kind: 'fair-test', changed: [iv] },
    prediction: 'same',
    observed: 'same',
  });

  it('iv별 fair-test 질문을 고른다', () => {
    expect(selectProbe(eCtx(fair('foxes0')), e.tutor.probes, eGuard)).toContain('먹이 그물 그림에서 무엇이 빠졌을까요?');
    expect(selectProbe(eCtx(fair('furColor')), e.tutor.probes, eGuard)).toContain('털 색만 바꾸었을 때 결과가 달라졌나요?');
    // 전용 질문이 없는 변인은 공통 fair-test 질문
    expect(selectProbe(eCtx(fair('rabbits0')), e.tutor.probes, eGuard)).toContain('처음 토끼 수만 바꾸었을 때 풀, 토끼, 여우의 수는 각각 어떻게 달라졌나요');
    expect(selectProbe(eCtx(fair('rain')), e.tutor.probes, eGuard)).toContain('비가 오는 정도만 바꾸었을 때 풀, 토끼, 여우의 수는 각각 어떻게 달라졌나요');
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
      { lastAnalysis: { kind: 'confounded', changed: ['rabbits0', 'rain'] } },
      { lastAnalysis: { kind: 'iv-unchanged', changed: ['furColor'] } },
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

// ---------- 다양한 생물과 우리 생활(곰팡이가 자라는 조건) 매니페스트 ----------
import microbeJson from '../../../content/units/g4-microbe/manifest.json';

describe('g4-microbe 매니페스트 probe', () => {
  const e = parseManifest(microbeJson).experiments[0]! as VariableExperiment;
  const eLabels = Object.fromEntries(e.variables.map((v) => [v.key, v.label]));
  const eKeys = e.variables.map((v) => v.key);
  const eGuard = { forbiddenAnswers: e.tutor.forbiddenAnswers, limits: e.limits };
  const eCtx = (x: Partial<ProbeContext>): ProbeContext => ({ labels: eLabels, ivKey: 'moisture', ...x });
  const fair = (iv: string): Partial<ProbeContext> => ({
    ivKey: iv,
    lastAnalysis: { kind: 'fair-test', changed: [iv] },
    prediction: 'same',
    observed: 'same',
  });

  it('iv별 fair-test 질문을 고른다', () => {
    expect(selectProbe(eCtx(fair('tempC')), e.tutor.probes, eGuard)).toContain('냉장고 속 빵에서는 무슨 일이 일어났나요?');
    expect(selectProbe(eCtx(fair('light')), e.tutor.probes, eGuard)).toContain('빛만 바꾸었을 때 결과가 달라졌나요?');
    // 전용 질문이 없는 변인은 공통 fair-test 질문
    expect(selectProbe(eCtx(fair('moisture')), e.tutor.probes, eGuard)).toContain('빵의 물기만 바꾸었을 때 곰팡이가 덮은 넓이와 처음 보인 날은 각각 어떻게 달라졌나요');
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

  it('화면에 보이는 매니페스트 글(질문, 변인·선택지 이름, 점검표, 경고 문구)에는 limits 용어가 없다', () => {
    const shown = [
      e.title,
      e.question,
      e.predictionPrompt,
      ...e.variables.flatMap((v) => [v.label, ...v.options.map((o) => o.label)]),
      ...e.dependent.map((d) => d.label),
      ...e.tutor.probes.map((p) => p.text),
      ...(e.safetyChecklist ?? []),
      ...Object.values(e.safetyMessages ?? {}),
    ];
    for (const text of shown) for (const l of e.limits) expect(text, text).not.toContain(l);
  });

  it('모든 시행 상황에서 고른 질문이 가드를 통과하고 폴백이 아니다', () => {
    const situations: Partial<ProbeContext>[] = [
      {},
      { lastAnalysis: { kind: 'first-trial', changed: [] } },
      { lastAnalysis: { kind: 'confounded', changed: ['moisture', 'tempC'] } },
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

// ---------- 우리 몸의 구조와 기능(운동과 맥박·호흡) 매니페스트 ----------
import bodyJson from '../../../content/units/g5-body/manifest.json';

describe('g5-body 매니페스트 probe', () => {
  const e = parseManifest(bodyJson).experiments[0]! as VariableExperiment;
  const eLabels = Object.fromEntries(e.variables.map((v) => [v.key, v.label]));
  const eKeys = e.variables.map((v) => v.key);
  const eGuard = { forbiddenAnswers: e.tutor.forbiddenAnswers, limits: e.limits };
  const eCtx = (x: Partial<ProbeContext>): ProbeContext => ({ labels: eLabels, ivKey: 'kind', ...x });
  const fair = (iv: string): Partial<ProbeContext> => ({
    ivKey: iv,
    lastAnalysis: { kind: 'fair-test', changed: [iv] },
    prediction: 'same',
    observed: 'same',
  });

  it('iv별 fair-test 질문을 고른다', () => {
    expect(selectProbe(eCtx(fair('kind')), e.tutor.probes, eGuard)).toContain('몸속 기관 그림에서 심장과 폐는 어떻게 달라 보였나요?');
    expect(selectProbe(eCtx(fair('wrist')), e.tutor.probes, eGuard)).toContain('손목만 바꾸었을 때 결과가 달라졌나요?');
    // 전용 질문이 없는 변인은 공통 fair-test 질문
    expect(selectProbe(eCtx(fair('minutes')), e.tutor.probes, eGuard)).toContain('운동 시간만 바꾸었을 때 맥박과 호흡은 각각 어떻게 달라졌나요');
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

  it('오검출 없음: 종류 전용 질문의 "몸이 무엇을 더 필요로 했을까요?"는 금지 구절 "산소가 더 필요하기 때문"에 걸리지 않고, 금지 구절 문장은 막는다', () => {
    const kindProbe = e.tutor.probes.find((p) => p.iv === 'kind')!;
    expect(kindProbe.text).toContain('몸이 무엇을 더 필요로 했을까요?');
    expect(guardOutput(kindProbe.text, eGuard).ok).toBe(true);
    expect(guardOutput('산소가 더 필요하기 때문이에요', eGuard).ok).toBe(false);
  });

  it('금지 구절을 담은 문장과 limits 용어를 담은 문장은 실제로 막는다', () => {
    for (const f of e.tutor.forbiddenAnswers) expect(guardOutput(`${f}요`, eGuard).ok, f).toBe(false);
    for (const l of e.limits) expect(guardOutput(`${l}이에요`, eGuard).ok, l).toBe(false);
  });

  it('화면에 보이는 매니페스트 글(질문, 변인·선택지 이름, 점검표, 경고 문구)에는 limits 용어가 없다', () => {
    const shown = [
      e.title,
      e.question,
      e.predictionPrompt,
      ...e.variables.flatMap((v) => [v.label, ...v.options.map((o) => o.label)]),
      ...e.dependent.map((d) => d.label),
      ...e.tutor.probes.map((p) => p.text),
      ...(e.safetyChecklist ?? []),
      ...Object.values(e.safetyMessages ?? {}),
    ];
    for (const text of shown) for (const l of e.limits) expect(text, text).not.toContain(l);
  });

  it('모든 시행 상황에서 고른 질문이 가드를 통과하고 폴백이 아니다', () => {
    const situations: Partial<ProbeContext>[] = [
      {},
      { lastAnalysis: { kind: 'first-trial', changed: [] } },
      { lastAnalysis: { kind: 'confounded', changed: ['kind', 'minutes'] } },
      { lastAnalysis: { kind: 'iv-unchanged', changed: ['wrist'] } },
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


// ---------- 힘과 우리 생활(막대의 수평 잡기) 매니페스트 ----------
import forceJson from '../../../content/units/g3-force/manifest.json';

describe('g3-force 매니페스트 probe', () => {
  const e = parseManifest(forceJson).experiments[0]! as VariableExperiment;
  const eLabels = Object.fromEntries(e.variables.map((v) => [v.key, v.label]));
  const eKeys = e.variables.map((v) => v.key);
  const eGuard = { forbiddenAnswers: e.tutor.forbiddenAnswers, limits: e.limits };
  const eCtx = (x: Partial<ProbeContext>): ProbeContext => ({ labels: eLabels, ivKey: 'distance', ...x });
  const fair = (iv: string): Partial<ProbeContext> => ({
    ivKey: iv,
    lastAnalysis: { kind: 'fair-test', changed: [iv] },
    prediction: 'same',
    observed: 'same',
  });

  it('iv별 fair-test 질문을 고른다', () => {
    expect(selectProbe(eCtx(fair('distance')), e.tutor.probes, eGuard)).toContain('수평이 된 자리가 있었나요?');
    expect(selectProbe(eCtx(fair('count')), e.tutor.probes, eGuard)).toContain('추를 어디로 옮겨 보면 좋을까요?');
    expect(selectProbe(eCtx(fair('shape')), e.tutor.probes, eGuard)).toContain('모양만 바꾸었을 때 막대는 달라졌나요?');
  });

  it('예측과 결과가 다르면 돌리려는 정도 그림을 보라고 한다', () => {
    const text = selectProbe(eCtx({ ...fair('count'), prediction: 'increase', observed: 'decrease' }), e.tutor.probes, eGuard);
    expect(text).toContain('돌리려는 정도 보기');
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

  it('오검출 없음: 추의 수 전용 질문은 막히지 않고, 규칙을 말하는 문장은 막는다', () => {
    const countProbe = e.tutor.probes.find((p) => p.iv === 'count')!;
    expect(countProbe.text).toContain('추를 어디로 옮겨 보면 좋을까요?');
    expect(guardOutput(countProbe.text, eGuard).ok).toBe(true);
    for (const rule of ['무거운 쪽으로 기울어요', '받침점에서 멀수록 더 많이 기울어요', '무게와 거리를 곱하면 돼요', '무거운 물체를 받침점에 가깝게 놓아요', '모양은 관계없어요']) {
      expect(guardOutput(rule, eGuard).ok, rule).toBe(false);
    }
  });

  it('금지 구절을 담은 문장과 limits 용어를 담은 문장은 실제로 막는다', () => {
    for (const f of e.tutor.forbiddenAnswers) expect(guardOutput(`${f}요`, eGuard).ok, f).toBe(false);
    for (const l of e.limits) expect(guardOutput(`${l}이에요`, eGuard).ok, l).toBe(false);
  });

  it('곱셈 규칙은 어느 질문에도 나오지 않고, 화면에 보이는 글에는 limits 용어가 없다', () => {
    const shown = [
      e.title,
      e.question,
      e.predictionPrompt,
      ...e.variables.flatMap((v) => [v.label, ...v.options.map((o) => o.label)]),
      ...e.dependent.map((d) => d.label),
      ...e.tutor.probes.map((p) => p.text),
    ];
    for (const text of shown) {
      for (const l of e.limits) expect(text, text).not.toContain(l);
      expect(text, text).not.toMatch(/곱|×/);
    }
  });

  it('모든 시행 상황에서 고른 질문이 가드를 통과하고 폴백이 아니다', () => {
    const situations: Partial<ProbeContext>[] = [
      {},
      { lastAnalysis: { kind: 'first-trial', changed: [] } },
      { lastAnalysis: { kind: 'confounded', changed: ['count', 'distance'] } },
      { lastAnalysis: { kind: 'iv-unchanged', changed: ['shape'] } },
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


// ---------- 소리의 성질(줄을 튕겨 소리의 세기와 높낮이 알아보기) 매니페스트 ----------
import soundJson from '../../../content/units/g3-sound/manifest.json';

describe('g3-sound 매니페스트 probe', () => {
  const e = parseManifest(soundJson).experiments[0]! as VariableExperiment;
  const eLabels = Object.fromEntries(e.variables.map((v) => [v.key, v.label]));
  const eKeys = e.variables.map((v) => v.key);
  const eGuard = { forbiddenAnswers: e.tutor.forbiddenAnswers, limits: e.limits };
  const eCtx = (x: Partial<ProbeContext>): ProbeContext => ({ labels: eLabels, ivKey: 'lengthCm', ...x });
  const fair = (iv: string): Partial<ProbeContext> => ({
    ivKey: iv,
    lastAnalysis: { kind: 'fair-test', changed: [iv] },
    prediction: 'same',
    observed: 'same',
  });

  it('iv별 fair-test 질문을 고른다', () => {
    expect(selectProbe(eCtx(fair('strength')), e.tutor.probes, eGuard)).toContain('물결의 높이와 물결의 개수 가운데 무엇이 달라졌나요?');
    expect(selectProbe(eCtx(fair('lengthCm')), e.tutor.probes, eGuard)).toContain('같은 시간 동안 물결이 몇 개 있었나요?');
    // 색은 전용 질문이 없어 공통 fair-test 질문을 쓴다
    expect(selectProbe(eCtx(fair('color')), e.tutor.probes, eGuard)).toContain('물결의 높이와 개수를 나누어 볼까요?');
  });

  it('예측과 결과가 다르면 흐린 선과 물결 개수를 비교하라고 한다', () => {
    const text = selectProbe(eCtx({ ...fair('lengthCm'), prediction: 'decrease', observed: 'increase' }), e.tutor.probes, eGuard);
    expect(text).toContain('흐린 선과 물결 개수');
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

  it('오검출 없음: 전용 질문은 막히지 않고, 규칙을 말하는 문장은 막는다', () => {
    for (const iv of ['strength', 'lengthCm']) {
      const p = e.tutor.probes.find((x) => x.iv === iv)!;
      expect(guardOutput(p.text, eGuard).ok, p.text).toBe(true);
    }
    for (const rule of ['세게 튕기면 소리가 커져요', '줄이 짧을수록 높은 소리가 나요', '짧은 줄이 더 빨리 떨려요', '세기는 높낮이와 관계없어요', '색은 관계없어요']) {
      expect(guardOutput(rule, eGuard).ok, rule).toBe(false);
    }
  });

  it('금지 구절을 담은 문장과 limits 용어를 담은 문장은 실제로 막는다', () => {
    for (const f of e.tutor.forbiddenAnswers) expect(guardOutput(`${f}요`, eGuard).ok, f).toBe(false);
    for (const l of e.limits) expect(guardOutput(`${l}이에요`, eGuard).ok, l).toBe(false);
  });

  it('화면에 보이는 글에는 진동수·진폭·Hz·dB·헤르츠·데시벨이 없다', () => {
    const shown = [
      e.title,
      e.question,
      e.predictionPrompt,
      ...e.variables.flatMap((v) => [v.label, v.unit ?? '', ...v.options.map((o) => o.label)]),
      ...e.dependent.flatMap((d) => [d.label, d.unit ?? '']),
      ...e.tutor.probes.map((p) => p.text),
    ];
    for (const text of shown) {
      for (const l of e.limits) expect(text, text).not.toContain(l);
      expect(text, text).not.toMatch(/Hz|dB/i);
    }
  });

  it('모든 시행 상황에서 고른 질문이 가드를 통과하고 폴백이 아니다', () => {
    const situations: Partial<ProbeContext>[] = [
      {},
      { lastAnalysis: { kind: 'first-trial', changed: [] } },
      { lastAnalysis: { kind: 'confounded', changed: ['strength', 'lengthCm'] } },
      { lastAnalysis: { kind: 'iv-unchanged', changed: ['color'] } },
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


// ---------- 자석의 이용(자석과 클립 사이의 거리) 매니페스트 ----------
import magnetJson from '../../../content/units/g4-magnet/manifest.json';

describe('g4-magnet 매니페스트 probe', () => {
  const e = parseManifest(magnetJson).experiments[0]! as VariableExperiment;
  const eLabels = Object.fromEntries(e.variables.map((v) => [v.key, v.label]));
  const eKeys = e.variables.map((v) => v.key);
  const eGuard = { forbiddenAnswers: e.tutor.forbiddenAnswers, limits: e.limits };
  const eCtx = (x: Partial<ProbeContext>): ProbeContext => ({ labels: eLabels, ivKey: 'gapCm', ...x });
  const fair = (iv: string): Partial<ProbeContext> => ({
    ivKey: iv,
    lastAnalysis: { kind: 'fair-test', changed: [iv] },
    prediction: 'same',
    observed: 'same',
  });
  const BETWEEN_Q = '사이에 둔 물체만 바꾸었어요. 어떤 물체를 두었을 때 클립이 끌려왔고, 어떤 물체일 때 달랐나요? 그 물체는 무엇으로 만들어졌을까요?';

  it('iv별 fair-test 질문을 고른다', () => {
    expect(selectProbe(eCtx(fair('gapCm')), e.tutor.probes, eGuard)).toContain("'자석의 힘이 미치는 곳' 그림에서 클립 더미는 어디쯤에 있었나요?");
    expect(selectProbe(eCtx(fair('between')), e.tutor.probes, eGuard)).toBe(BETWEEN_Q);
    // 자석의 수는 전용 질문이 없어 공통 fair-test 질문을 쓴다
    expect(selectProbe(eCtx(fair('magnets')), e.tutor.probes, eGuard)).toContain('자석의 수만 바꾸었을 때 클립의 수는 어떻게 달라졌나요?');
  });

  it('사이 물체 전용 질문 "그 물체는 무엇으로 만들어졌을까요?"는 가드에 걸리지 않는다 (오검출 없음)', () => {
    const p = e.tutor.probes.find((x) => x.iv === 'between')!;
    expect(p.text).toContain('그 물체는 무엇으로 만들어졌을까요?');
    expect(guardOutput(p.text, eGuard).ok, p.text).toBe(true);
    for (const f of e.tutor.forbiddenAnswers) expect(p.text).not.toContain(f);
  });

  it('예측과 결과가 다르면 클립 수가 언제 늘었는지 살펴보라고 한다', () => {
    const text = selectProbe(eCtx({ ...fair('gapCm'), prediction: 'decrease', observed: 'increase' }), e.tutor.probes, eGuard);
    expect(text).toContain('자석이 내려오는 동안 클립 수가 언제 늘었는지');
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

  it('규칙을 말하는 문장과 금지 구절·limits 용어를 담은 문장은 막는다', () => {
    for (const rule of ['가까울수록 클립이 많이 붙어요', '멀수록 클립이 적게 붙어요', '자석을 겹치면 더 많이 붙어요', '종이는 자석의 힘을 막지 못해요', '철판이 자석의 힘을 막아요', '철판은 자석에 붙어 있어요']) {
      expect(guardOutput(rule, eGuard).ok, rule).toBe(false);
    }
    for (const f of e.tutor.forbiddenAnswers) expect(guardOutput(`${f}요`, eGuard).ok, f).toBe(false);
    for (const l of e.limits) expect(guardOutput(`${l}이에요`, eGuard).ok, l).toBe(false);
  });

  it('화면에 보이는 글에는 자기력·자기장·자기력선이 없다', () => {
    const shown = [
      e.title,
      e.question,
      e.predictionPrompt,
      ...e.variables.flatMap((v) => [v.label, v.unit ?? '', ...v.options.map((o) => o.label)]),
      ...e.dependent.flatMap((d) => [d.label, d.unit ?? '']),
      ...(e.safetyChecklist ?? []),
      ...e.tutor.probes.map((p) => p.text),
      '자석의 힘은 자석에서 멀어질수록 약해져요.',
      '⚠ 자석은 휴대 전화·카드와 떨어진 곳에서 써요.',
    ];
    for (const text of shown) for (const l of e.limits) expect(text, text).not.toContain(l);
  });

  it('모든 시행 상황에서 고른 질문이 가드를 통과하고 폴백이 아니다', () => {
    const situations: Partial<ProbeContext>[] = [
      {},
      { lastAnalysis: { kind: 'first-trial', changed: [] } },
      { lastAnalysis: { kind: 'confounded', changed: ['gapCm', 'between'] } },
      { lastAnalysis: { kind: 'iv-unchanged', changed: ['magnets'] } },
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


// ---------- 물체의 운동(출발 높이와 수레의 속력) 매니페스트 ----------
import motionJson from '../../../content/units/g6-motion/manifest.json';

describe('g6-motion 매니페스트 probe', () => {
  const e = parseManifest(motionJson).experiments[0]! as VariableExperiment;
  const eLabels = Object.fromEntries(e.variables.map((v) => [v.key, v.label]));
  const eKeys = e.variables.map((v) => v.key);
  const eGuard = { forbiddenAnswers: e.tutor.forbiddenAnswers, limits: e.limits };
  const eCtx = (x: Partial<ProbeContext>): ProbeContext => ({ labels: eLabels, ivKey: 'heightCm', ...x });
  const fair = (iv: string): Partial<ProbeContext> => ({
    ivKey: iv,
    lastAnalysis: { kind: 'fair-test', changed: [iv] },
    prediction: 'same',
    observed: 'same',
  });
  const HEIGHT_Q = '출발 높이만 바꾸었어요. 같은 1 m를 가는 데 걸린 시간이 어떻게 달랐나요? 시간이 짧으면 속력은 어떻게 될까요?';

  it('iv별 fair-test 질문을 고른다', () => {
    expect(selectProbe(eCtx(fair('heightCm')), e.tutor.probes, eGuard)).toBe(HEIGHT_Q);
    expect(selectProbe(eCtx(fair('load')), e.tutor.probes, eGuard)).toContain('실은 추만 바꾸었을 때 걸린 시간이 달라졌나요?');
    // 바닥은 전용 질문이 없어 공통 fair-test 질문을 쓴다
    expect(selectProbe(eCtx(fair('floor')), e.tutor.probes, eGuard)).toContain('바닥만 바꾸었을 때 걸린 시간과 속력은 어떻게 달라졌나요?');
  });

  it('높이 전용 질문 "시간이 짧으면 속력은 어떻게 될까요?"는 질문이라 가드에 걸리지 않는다 (오검출 없음)', () => {
    const p = e.tutor.probes.find((x) => x.iv === 'heightCm')!;
    expect(p.text).toContain('시간이 짧으면 속력은 어떻게 될까요?');
    expect(guardOutput(p.text, eGuard).ok, p.text).toBe(true);
    for (const f of e.tutor.forbiddenAnswers) expect(p.text).not.toContain(f);
  });

  it('예측과 결과가 다르면 위치 그래프에서 1 m에 먼저 닿은 선을 보라고 한다', () => {
    const text = selectProbe(eCtx({ ...fair('heightCm'), prediction: 'decrease', observed: 'increase' }), e.tutor.probes, eGuard);
    expect(text).toContain('1 m에 먼저 닿은 선');
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

  it('규칙을 말하는 문장과 금지 구절·limits 용어를 담은 문장은 막는다', () => {
    for (const rule of ['높은 곳에서 출발할수록 빠르다', '높을수록 속력이 크다', '수건 바닥에서는 느려져요', '무게는 빠르기와 관계없어요', '추를 실어도 속력은 같아요']) {
      expect(guardOutput(rule, eGuard).ok, rule).toBe(false);
    }
    for (const f of e.tutor.forbiddenAnswers) expect(guardOutput(`${f}요`, eGuard).ok, f).toBe(false);
    for (const l of e.limits) expect(guardOutput(`${l}이에요`, eGuard).ok, l).toBe(false);
  });

  it('화면에 보이는 글에는 가속도·에너지·마찰 계수가 없다', () => {
    const shown = [
      e.title,
      e.question,
      e.predictionPrompt,
      ...e.variables.flatMap((v) => [v.label, v.unit ?? '', ...v.options.map((o) => o.label)]),
      ...e.dependent.flatMap((d) => [d.label, d.unit ?? '']),
      ...e.tutor.probes.map((p) => p.text),
      '속력은 간 거리를 걸린 시간으로 나누어 구해요.',
      '이동 거리 1 m',
      '1 m에 닿으면 계산해요',
    ];
    for (const text of shown) {
      for (const l of e.limits) expect(text, text).not.toContain(l);
      expect(text, text).not.toMatch(/가속도|에너지|마찰 계수/);
    }
  });

  it('모든 시행 상황에서 고른 질문이 가드를 통과하고 폴백이 아니다', () => {
    const situations: Partial<ProbeContext>[] = [
      {},
      { lastAnalysis: { kind: 'first-trial', changed: [] } },
      { lastAnalysis: { kind: 'confounded', changed: ['heightCm', 'floor'] } },
      { lastAnalysis: { kind: 'iv-unchanged', changed: ['load'] } },
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

// ---------- 물의 상태 변화(물이 얼 때와 얼음이 녹을 때) 매니페스트 ----------
import waterStateJson from '../../../content/units/g4-water-state/manifest.json';

describe('g4-water-state 매니페스트 probe', () => {
  const e = parseManifest(waterStateJson).experiments[0]! as VariableExperiment;
  const eLabels = Object.fromEntries(e.variables.map((v) => [v.key, v.label]));
  const eKeys = e.variables.map((v) => v.key);
  const eGuard = { forbiddenAnswers: e.tutor.forbiddenAnswers, limits: e.limits };
  const eCtx = (x: Partial<ProbeContext>): ProbeContext => ({ labels: eLabels, ivKey: 'process', ...x });
  const fair = (iv: string): Partial<ProbeContext> => ({
    ivKey: iv,
    lastAnalysis: { kind: 'fair-test', changed: [iv] },
    prediction: 'same',
    observed: 'same',
  });

  it('iv별 fair-test 질문을 고른다', () => {
    expect(selectProbe(eCtx(fair('process')), e.tutor.probes, eGuard)).toContain('과정만 바꾸었어요. 얼리기와 녹이기에서 시험관 속 높이 표시는 어떻게 달랐나요?');
    expect(selectProbe(eCtx(fair('tube')), e.tutor.probes, eGuard)).toContain('시험관 종류만 바꾸었을 때 결과가 달라졌나요?');
    // 처음 양은 전용 질문이 없어 공통 fair-test 질문을 쓴다
    expect(selectProbe(eCtx(fair('startMl')), e.tutor.probes, eGuard)).toContain('처음 물의 양만 바꾸었을 때 부피 변화와 무게는 각각 어떻게 되었나요?');
  });

  it('실행 전 질문 "무게는 어떻게 될 것 같나요?"는 질문이라 가드에 걸리지 않는다 (오검출 없음)', () => {
    const text = selectProbe(eCtx({}), e.tutor.probes, eGuard);
    expect(text).toContain('무게는 어떻게 될 것 같나요?');
    expect(guardOutput(text, eGuard).ok, text).toBe(true);
  });

  it('예측과 결과가 다르면 그래프에서 부피가 변하기 시작한 때와 온도를 보라고 한다', () => {
    const text = selectProbe(eCtx({ ...fair('process'), prediction: 'decrease', observed: 'increase' }), e.tutor.probes, eGuard);
    expect(text).toContain('그때 온도는 얼마였는지');
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

  it('금지 구절은 활용형(늘어나·커져·줄어들·같아·변하지)까지 막는다', () => {
    for (const answer of [
      '물이 얼면 부피가 늘어나요',
      '물이 얼면 부피가 커져요',
      '얼음이 녹으면 부피가 줄어들어요',
      '얼음이 녹으면 부피가 줄어요',
      '부피가 작아져요',
      '무게는 변하지 않아요',
      '무게가 변하지 않았어요',
      '무게는 그대로예요',
      '무게는 같아요',
      '무게가 같았어요',
      '물이 많을수록 부피가 더 많이 변해요',
      '물이 많을수록 부피가 더 커져요',
    ]) {
      expect(guardOutput(answer, eGuard).ok, answer).toBe(false);
    }
    for (const l of e.limits) expect(guardOutput(`${l}이에요`, eGuard).ok, l).toBe(false);
  });

  it('질문과 화면에 보이는 글은 금지 구절·limits 용어와 겹치지 않는다', () => {
    const shown = [
      e.title,
      e.question,
      e.predictionPrompt,
      ...e.variables.flatMap((v) => [v.label, v.unit ?? '', ...v.options.map((o) => o.label)]),
      ...e.dependent.flatMap((d) => [d.label, d.unit ?? '']),
      ...(e.safetyChecklist ?? []),
      ...Object.values(e.safetyMessages ?? {}),
      '얼음이 될 때 알갱이 수는 같고, 알갱이 사이가 조금 넓어져요.',
      '⚠ 소금 얼음물은 아주 차가워요. 맨손으로 오래 만지지 않아요.',
      '알갱이 수 18개',
      '처음 높이',
      '지금 높이',
      '얼기 시작',
      '다 얼었어요',
      '녹기 시작',
      '다 녹았어요',
    ];
    for (const text of shown) expect(guardOutput(text, eGuard).ok, text).toBe(true);
  });

  it('모든 시행 상황에서 고른 질문이 가드를 통과하고 폴백이 아니다', () => {
    const situations: Partial<ProbeContext>[] = [
      {},
      { lastAnalysis: { kind: 'first-trial', changed: [] } },
      { lastAnalysis: { kind: 'confounded', changed: ['process', 'tube'] } },
      { lastAnalysis: { kind: 'iv-unchanged', changed: ['tube'] } },
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

// ---------- 혼합물의 분리(소금과 모래) 매니페스트 ----------
import mixtureJson from '../../../content/units/g5-mixture/manifest.json';

describe('g5-mixture 매니페스트 probe', () => {
  const e = parseManifest(mixtureJson).experiments[0]! as VariableExperiment;
  const eLabels = Object.fromEntries(e.variables.map((v) => [v.key, v.label]));
  const eKeys = e.variables.map((v) => v.key);
  const eGuard = { forbiddenAnswers: e.tutor.forbiddenAnswers, limits: e.limits };
  const eCtx = (x: Partial<ProbeContext>): ProbeContext => ({ labels: eLabels, ivKey: 'waterMl', ...x });
  const fair = (iv: string): Partial<ProbeContext> => ({
    ivKey: iv,
    lastAnalysis: { kind: 'fair-test', changed: [iv] },
    prediction: 'same',
    observed: 'same',
  });

  it('iv별 fair-test 질문을 고른다', () => {
    expect(selectProbe(eCtx(fair('waterMl')), e.tutor.probes, eGuard)).toContain('녹이는 동안 비커 바닥에 남은 것은 무엇이었나요?');
    expect(selectProbe(eCtx(fair('filter')), e.tutor.probes, eGuard)).toContain('얻은 소금의 양은 같았는데, 증발 접시 위 가루는 어떻게 달랐나요?');
    // 젓는 도구는 전용 질문이 없어 공통 fair-test 질문을 쓴다
    expect(selectProbe(eCtx(fair('stirrer')), e.tutor.probes, eGuard)).toContain('젓는 도구만 바꾸었을 때 얻은 소금과 섞인 모래는 각각 어떻게 되었나요?');
  });

  it('거르기 질문 "얻은 소금의 양은 같았는데"는 결과 서술이지만 가드에 걸리지 않는다 (오검출 없음)', () => {
    const text = selectProbe(eCtx(fair('filter')), e.tutor.probes, eGuard);
    expect(text).toContain('얻은 소금의 양은 같았는데');
    expect(guardOutput(text, eGuard).ok, text).toBe(true);
  });

  it('예측과 결과가 다르면 그래프에서 접시 위 고체가 늘기 시작한 때를 보라고 한다', () => {
    const text = selectProbe(eCtx({ ...fair('waterMl'), prediction: 'increase', observed: 'decrease' }), e.tutor.probes, eGuard);
    expect(text).toContain('접시 위 고체가 언제부터 늘기 시작했는지');
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

  it('금지 구절은 활용형(녹지 않아·더 많이 얻·섞이지 않아·물에 녹고 모래는)까지 막는다', () => {
    for (const answer of [
      '물이 적으면 소금이 다 녹지 않아요',
      '소금이 다 녹지 않아서 덜 얻어요',
      '다 녹지 않아',
      '물을 많이 넣으면 소금을 더 많이 얻어요',
      '소금을 더 많이 얻을 수 있어요',
      '거름종이로 걸러야 모래가 섞이지 않아요',
      '모래가 섞이지 않아요',
      '모래가 섞이지 않았어요',
      '소금은 물에 녹고 모래는 녹지 않아요',
      '소금은 물에 녹고 모래는 안 녹아요',
      '모래는 물에 녹지 않아요',
      '젓는 도구는 관계없어요',
      '젓는 도구는 상관없어요',
      '젓는 도구는 결과에 영향이 없어요',
    ]) {
      expect(guardOutput(answer, eGuard).ok, answer).toBe(false);
    }
    for (const l of e.limits) expect(guardOutput(`${l}이에요`, eGuard).ok, l).toBe(false);
  });

  it('질문과 화면에 보이는 글은 금지 구절·limits 용어와 겹치지 않는다', () => {
    const shown = [
      e.title,
      e.question,
      e.predictionPrompt,
      ...e.variables.flatMap((v) => [v.label, v.unit ?? '', ...v.options.map((o) => o.label)]),
      ...e.dependent.flatMap((d) => [d.label, d.unit ?? '']),
      ...(e.safetyChecklist ?? []),
      ...Object.values(e.safetyMessages ?? {}),
      '녹은 소금 알갱이는 아주 작아서 거름종이 구멍을 지나가요.',
      '윗물을 따르면 가라앉지 않은 모래 알갱이도 함께 넘어갈 수 있어요.',
      '⚠ 증발 접시와 알코올램프는 아주 뜨거워요. 선생님과 함께 다뤄요.',
      '녹은 소금',
      '녹지 않은 소금',
      '모래',
      '거름종이',
      '비커 속 확대',
      '1 녹이기 (0~3분)',
      '2 거르기 (3~8분)',
      '2 따르기 (3~8분)',
      '3 증발시키기 (8~20분)',
      '깔때기·거름종이',
      '윗물만 따르기',
      '받는 비커',
      '증발 접시',
      '알코올램프',
      '12.0분 · 증발시키기 · 접시 위 가루 6.5 g',
      '접시 위 가루(g)',
      '거르기 시작',
      '가열 시작',
    ];
    for (const text of shown) expect(guardOutput(text, eGuard).ok, text).toBe(true);
  });

  it('모든 시행 상황에서 고른 질문이 가드를 통과하고 폴백이 아니다', () => {
    const situations: Partial<ProbeContext>[] = [
      {},
      { lastAnalysis: { kind: 'first-trial', changed: [] } },
      { lastAnalysis: { kind: 'confounded', changed: ['waterMl', 'filter'] } },
      { lastAnalysis: { kind: 'iv-unchanged', changed: ['stirrer'] } },
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

// ---------- 땅의 변화 두 번째 활동(흐르는 물) 매니페스트 ----------
describe('g4-land 흐르는 물(stream-table) 활동 probe', () => {
  const e = parseManifest(landJson).experiments[1]! as VariableExperiment;
  const eLabels = Object.fromEntries(e.variables.map((v) => [v.key, v.label]));
  const eKeys = e.variables.map((v) => v.key);
  const eGuard = { forbiddenAnswers: e.tutor.forbiddenAnswers, limits: e.limits };
  const eCtx = (x: Partial<ProbeContext>): ProbeContext => ({ labels: eLabels, ivKey: 'slope', ...x });
  const fair = (iv: string): Partial<ProbeContext> => ({
    ivKey: iv,
    lastAnalysis: { kind: 'fair-test', changed: [iv] },
    prediction: 'same',
    observed: 'same',
  });

  it('iv별 fair-test 질문을 고른다', () => {
    expect(selectProbe(eCtx(fair('slope')), e.tutor.probes, eGuard)).toContain('물이 흐르는 빠르기는 어떻게 달라 보였나요?');
    expect(selectProbe(eCtx(fair('vessel')), e.tutor.probes, eGuard)).toContain('그릇만 바꾸었을 때 결과가 달라졌나요?');
    // 물의 양은 전용 질문이 없어 공통 fair-test 질문(두 선을 함께 보기)을 쓴다
    expect(selectProbe(eCtx(fair('waterL')), e.tutor.probes, eGuard)).toContain('흘려보내는 물의 양만 바꾸었을 때 위쪽과 아래쪽 흙은 각각 어떻게 달라졌나요?');
  });

  it('예측과 결과가 다르면 깎인 흙과 쌓인 흙이 어디로 갔는지 그림에서 찾아보라고 한다', () => {
    const text = selectProbe(eCtx({ ...fair('slope'), prediction: 'increase', observed: 'same' }), e.tutor.probes, eGuard);
    expect(text).toContain('깎인 흙과 쌓인 흙은 각각 어디로 갔을지');
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

  it('금지 구절은 사양의 네 가지와 활용형(가파를수록 많이 깎여·물이 많을수록 많이 깎여·더 많이 쌓여·낮은 곳에 쌓여)까지 막는다', () => {
    for (const answer of [
      '가파를수록 흙이 많이 깎여요',
      '언덕이 가파를수록 흙이 많이 깎인다',
      '가파를수록 많이 깎여요',
      '가파를수록 더 많이 깎여요',
      '가파를수록 흙이 더 많이 깎여요',
      '가파를수록 많이 쌓여요',
      '가파르면 흙이 많이 깎여요',
      '경사가 급할수록 흙이 많아요',
      '물이 많을수록 흙이 많이 깎여요',
      '물이 많을수록 많이 깎여요',
      '물이 많을수록 더 많이 깎여요',
      '물이 많을수록 더 많이 쌓여요',
      '물이 많으면 흙이 많이 깎여요',
      '물의 양이 많을수록 흙이 달라져요',
      '흙이 더 많이 쌓여요',
      '더 많이 쌓여서 부채꼴이 돼요',
      '높은 곳의 흙을 깎아 낮은 곳에 쌓아요',
      '높은 곳의 흙을 깎아서 옮겨요',
      '낮은 곳에 쌓여요',
      '흙이 낮은 곳으로 옮겨져요',
      '그릇은 관계없어요',
      '그릇은 상관없어요',
      '그릇은 결과에 영향을 주지 않아요',
      '그릇은 영향이 없어요',
      '그릇과 관계없이 같아요',
      '그릇이 달라도 같아요',
    ]) {
      expect(guardOutput(answer, eGuard).ok, answer).toBe(false);
    }
    for (const l of e.limits) expect(guardOutput(`${l}이에요`, eGuard).ok, l).toBe(false);
  });

  it('질문과 화면에 보이는 글은 금지 구절·limits 용어와 겹치지 않는다', () => {
    const shown = [
      e.title,
      e.question,
      e.predictionPrompt,
      ...e.variables.flatMap((v) => [v.label, v.unit ?? '', ...v.options.map((o) => o.label)]),
      ...e.dependent.flatMap((d) => [d.label, d.unit ?? '']),
      '실험하면 물이 흙 언덕을 어떻게 바꾸는지 볼 수 있어요.',
      '60.0초 · 깎인 흙 100 g · 쌓인 흙 80 g',
      '깎인 곳',
      '쌓인 곳',
      '물받이',
      '물길 단면 확대',
      '물',
      '흙 알갱이',
      '흐르는 물은 흙 알갱이를 함께 옮겨요.',
      '흙의 양(g)',
      '깎인 흙(g)',
      '쌓인 흙(g)',
      '붓기 끝',
      '가상 전자저울: 쌓인 흙',
    ];
    for (const text of shown) expect(guardOutput(text, eGuard).ok, text).toBe(true);
  });

  it('모든 시행 상황에서 고른 질문이 가드를 통과하고 폴백이 아니다', () => {
    const situations: Partial<ProbeContext>[] = [
      {},
      { lastAnalysis: { kind: 'first-trial', changed: [] } },
      { lastAnalysis: { kind: 'confounded', changed: ['slope', 'waterL'] } },
      { lastAnalysis: { kind: 'iv-unchanged', changed: ['vessel'] } },
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

// ---------- 날씨와 우리 생활(바닷가 낮과 밤의 바람) 매니페스트 ----------
import weatherJson from '../../../content/units/g5-weather/manifest.json';

describe('g5-weather 매니페스트 probe', () => {
  const e = parseManifest(weatherJson).experiments[0]! as VariableExperiment;
  const eLabels = Object.fromEntries(e.variables.map((v) => [v.key, v.label]));
  const eKeys = e.variables.map((v) => v.key);
  const eGuard = { forbiddenAnswers: e.tutor.forbiddenAnswers, limits: e.limits };
  const eCtx = (x: Partial<ProbeContext>): ProbeContext => ({ labels: eLabels, ivKey: 'phase', ...x });
  const fair = (iv: string): Partial<ProbeContext> => ({
    ivKey: iv,
    lastAnalysis: { kind: 'fair-test', changed: [iv] },
    prediction: 'same',
    observed: 'same',
  });

  it('iv별 fair-test 질문을 고른다', () => {
    expect(selectProbe(eCtx(fair('phase')), e.tutor.probes, eGuard)).toContain('어느 쪽이 더 따뜻했나요?');
    expect(selectProbe(eCtx(fair('phase')), e.tutor.probes, eGuard)).toContain('화살표가 위로 올라가는 곳은 어디였나요?');
    expect(selectProbe(eCtx(fair('bowl')), e.tutor.probes, eGuard)).toContain('그릇만 바꾸었을 때 결과가 달라졌나요?');
    // 전등과의 거리는 전용 질문이 없어 공통 fair-test 질문(두 온도 선과 향 연기)을 쓴다
    expect(selectProbe(eCtx(fair('lampCm')), e.tutor.probes, eGuard)).toContain('전등과의 거리만 바꾸었을 때 두 온도 선과 향 연기의 방향은 어떻게 달라졌나요?');
  });

  it('실행 전 질문은 향 연기가 어느 쪽으로 흐를지 예측하게 하고, 예측과 결과가 다르면 두 선이 벌어지는 빠르기를 비교하게 한다', () => {
    expect(selectProbe(eCtx({}), e.tutor.probes, eGuard)).toContain('향 연기는 어느 쪽으로 흐를까요?');
    const text = selectProbe(eCtx({ ...fair('phase'), prediction: 'increase', observed: 'same' }), e.tutor.probes, eGuard);
    expect(text).toContain('두 선이 벌어지는 빠르기');
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

  it('금지 구절은 사양의 여섯 가지와 활용형(더 빨리 데워져·빨리 뜨거워·더 빨리 식어·바다에서 육지로 불어 등)까지 막는다', () => {
    for (const answer of [
      '모래가 물보다 빨리 데워져요',
      '모래가 더 빨리 데워져요',
      '모래가 빨리 데워져요',
      '모래는 물보다 빨리 데워진다',
      '모래가 빨리 뜨거워져요',
      '모래가 더 빨리 뜨거워져요',
      '모래가 물보다 빨리 뜨거워져요',
      '모래가 물보다 빨리 식어요',
      '모래가 더 빨리 식어요',
      '모래가 빨리 식어요',
      '모래는 빨리 식는다',
      '물은 천천히 데워져요',
      '물은 천천히 식어요',
      '물이 모래보다 천천히 식어요',
      '육지가 바다보다 빨리 데워져요',
      '낮에는 바다에서 육지로 바람이 불어요',
      '낮에는 바다에서 육지로 불어요',
      '밤에는 육지에서 바다로 바람이 불어요',
      '바다에서 육지로 불어요',
      '육지에서 바다로 불어요',
      '바람이 바다에서 육지로 불어요',
      '바람이 육지에서 바다로 불어요',
      '따뜻한 공기가 위로 올라가요',
      '따뜻한 공기는 위로 올라가요',
      '따뜻한 공기는 위로 떠올라요',
      '공기가 위로 올라가요',
      '공기는 위로 올라간다',
      '그릇은 관계없어요',
      '그릇은 상관없어요',
      '그릇은 결과에 영향을 주지 않아요',
      '그릇은 영향이 없어요',
      '그릇과 관계없이 같아요',
      '그릇이 달라도 같아요',
    ]) {
      expect(guardOutput(answer, eGuard).ok, answer).toBe(false);
    }
    for (const l of e.limits) expect(guardOutput(`${l}이에요`, eGuard).ok, l).toBe(false);
  });

  it('질문과 화면에 보이는 글은 금지 구절·limits 용어와 겹치지 않는다', () => {
    const shown = [
      e.title,
      e.question,
      e.predictionPrompt,
      ...e.variables.flatMap((v) => [v.label, v.unit ?? '', ...v.options.map((o) => o.label)]),
      ...e.dependent.flatMap((d) => [d.label, d.unit ?? '']),
      ...(e.safetyChecklist ?? []),
      ...Object.values(e.safetyMessages ?? {}),
      '⚠ 향과 전등은 선생님과 함께 다뤄요.',
      '실험하면 모래와 물의 온도, 향 연기가 흐르는 방향을 볼 수 있어요.',
      '10.0분 · 모래 34.7 °C · 물 26.3 °C · 바람: 바다 → 육지',
      '10.0분 · 모래 21.2 °C · 물 23.8 °C · 바람: 육지 → 바다',
      '0.0분 · 모래 20.0 °C · 물 20.0 °C · 바람: 거의 없음',
      '낮',
      '밤',
      '모래 (육지)',
      '물 (바다)',
      '20 cm',
      '40 cm',
      '? °C',
      '공기의 움직임 보기',
      '따뜻한 쪽',
      '차가운 쪽',
      '바닥 근처 바람',
      '육지 (모래)',
      '바다 (물)',
      '땅 가까이에서는 공기가 차가운 쪽에서 따뜻한 쪽으로 옮겨 가요.',
      '두 쪽의 온도가 같아서 공기가 한쪽으로 움직이지 않아요.',
      '실험하면 공기가 어느 쪽으로 움직이는지 볼 수 있어요.',
      '바다 → 육지',
      '육지 → 바다',
      '거의 없음',
      '온도(°C)',
      '모래 온도(°C)',
      '물 온도(°C)',
      '가상 온도계: 모래',
      '가상 온도계: 물',
      '모래 온도',
      '물 온도',
      '온도 차(°C)',
      '바람 방향',
    ];
    for (const text of shown) expect(guardOutput(text, eGuard).ok, text).toBe(true);
  });

  it('모든 시행 상황에서 고른 질문이 가드를 통과하고 폴백이 아니다', () => {
    const situations: Partial<ProbeContext>[] = [
      {},
      { lastAnalysis: { kind: 'first-trial', changed: [] } },
      { lastAnalysis: { kind: 'confounded', changed: ['phase', 'lampCm'] } },
      { lastAnalysis: { kind: 'iv-unchanged', changed: ['bowl'] } },
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

// ---------- 감염병과 건강한 생활(우리 반 감염 전파) 매니페스트 ----------
import healthJson from '../../../content/units/g3-health/manifest.json';

describe('g3-health 매니페스트 probe', () => {
  const e = parseManifest(healthJson).experiments[0]! as VariableExperiment;
  const eLabels = Object.fromEntries(e.variables.map((v) => [v.key, v.label]));
  const eKeys = e.variables.map((v) => v.key);
  const eGuard = { forbiddenAnswers: e.tutor.forbiddenAnswers, limits: e.limits };
  const eCtx = (x: Partial<ProbeContext>): ProbeContext => ({ labels: eLabels, ivKey: 'wash', ...x });
  const fair = (iv: string): Partial<ProbeContext> => ({
    ivKey: iv,
    lastAnalysis: { kind: 'fair-test', changed: [iv] },
    prediction: 'same',
    observed: 'same',
  });

  it('iv별 fair-test 질문을 고른다', () => {
    expect(selectProbe(eCtx(fair('contacts')), e.tutor.probes, eGuard)).toContain('교실 그림에서 아픈 친구가 늘어나는 빠르기는 어땠나요?');
    expect(selectProbe(eCtx(fair('seat')), e.tutor.probes, eGuard)).toContain('이 계산이 자리를 어떻게 다루는지 생각해 볼까요?');
    // 손 씻기·마스크는 전용 질문이 없어 공통 fair-test 질문(그래프의 두 선, 가장 높은 곳)을 쓴다
    for (const iv of ['wash', 'mask']) expect(selectProbe(eCtx(fair(iv)), e.tutor.probes, eGuard)).toContain('그래프의 두 선은 어떻게 달라졌나요? 가장 높은 곳이 언제였는지도 볼까요?');
  });

  it('실행 전 질문은 감염된 사람 수를 예측하게 하고, 예측과 결과가 다르면 두 선을 나누어 보게 한다', () => {
    expect(selectProbe(eCtx({}), e.tutor.probes, eGuard)).toContain('감염된 사람 수가 어떻게 될지 예측해 볼까요?');
    const text = selectProbe(eCtx({ ...fair('wash'), prediction: 'increase', observed: 'same' }), e.tutor.probes, eGuard);
    expect(text).toContain('지금 아픈 사람 선과 지금까지 감염된 사람 선을 나누어 볼까요?');
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

  it('금지 구절은 사양의 다섯 가지와 활용형까지 막는다', () => {
    for (const answer of [
      // 사양의 다섯 가지
      '손을 자주 씻으면 덜 퍼져요',
      '마스크를 쓰면 덜 퍼져요',
      '만나는 사람이 많을수록 많이 퍼져요',
      '자리는 관계없어요',
      '여러 습관을 함께 지키면 효과가 더 커요',
      // 손 씻기
      '손을 자주 씻으면 덜 퍼진다',
      '손을 자주 씻으면 적게 퍼져요',
      '손을 자주 씻으면 줄어들어요',
      '손을 씻으면 덜 퍼져요',
      '손 씻기를 자주 하면 덜 퍼져요',
      '손 씻기를 하면 적게 퍼져요',
      '손 씻기는 퍼지는 것을 줄여요',
      '자주 씻으면 덜 퍼져',
      // 마스크
      '마스크를 쓰면 적게 퍼져요',
      '마스크를 쓰면 훨씬 덜 퍼져요',
      '마스크를 쓰면 잘 안 퍼져요',
      '마스크를 쓰면 감염이 줄어요',
      '마스크는 퍼지는 것을 줄여요',
      // 만나는 사람 수
      '많이 만날수록 많이 퍼져요',
      '많이 만날수록 빨리 퍼져요',
      '많이 만나면 많이 퍼져요',
      '만나는 사람이 많을수록 빨리 퍼져요',
      '만나는 사람이 많을수록 더 많이 퍼져요',
      '만나는 친구가 많을수록 많이 퍼져요',
      '만나는 친구 수가 많을수록 빨리 퍼져요',
      '친구를 많이 만날수록 퍼져요',
      // 자리
      '자리는 상관없어요',
      '자리는 영향이 없어요',
      '자리는 결과에 영향을 주지 않아요',
      '자리와 관계없이 같아요',
      '자리가 달라도 같아요',
      '자리는 중요하지 않아요',
      // 함께 지키기
      '함께 지키면 더 효과가 있어요',
      '함께 지키면 효과가 더 커져요',
      '함께 지키면 더 적게 퍼져요',
      '함께 지키면 훨씬 줄어요',
      '여러 습관을 같이 지키면 좋아요',
      '같이 지키면 효과가 더 커요',
      '둘 다 지키면 효과가 더 커요',
      '함께 하면 더 효과가 있어요',
    ]) {
      expect(guardOutput(answer, eGuard).ok, answer).toBe(false);
    }
    for (const l of e.limits) expect(guardOutput(`${l}이에요`, eGuard).ok, l).toBe(false);
  });

  it('질문과 화면에 보이는 글은 금지 구절·limits 용어와 겹치지 않는다', () => {
    const shown = [
      e.title,
      e.question,
      e.predictionPrompt,
      ...e.variables.flatMap((v) => [v.label, v.unit ?? '', ...v.options.map((o) => o.label)]),
      ...e.dependent.flatMap((d) => [d.label, d.unit ?? '']),
      '이 숫자는 공부를 위해 만든 가상 반의 계산이에요. 실제 병의 예측이 아니에요.',
      '만날 때마다 병이 옮을 수 있는 기회가 생겨요.',
      '0일째 · 지금 아픈 사람 1명 · 지금까지 감염 1명',
      '20일째 · 지금 아픈 사람 3명 · 지금까지 감염 12명',
      '눈으로 보기: 교실',
      '옮겨 가는 길 보기',
      '칠판 (앞)',
      '건강',
      '아픔',
      '나음',
      '만남',
      '손 씻기',
      '마스크',
      '사람 수(명)',
      '날짜(일)',
      '지금 아픈 사람(명)',
      '지금까지 감염된 사람(명)',
      '20일 동안 감염된 사람(명)',
      '가장 많이 아팠던 날의 아픈 사람(명)',
      '가상 반의 자리 6칸씩 5줄에 앉은 사람 30명. 건강 18명, 아픔 3명, 나음 9명.',
      '아픈 친구 한 명과 하루에 가까이 만나는 친구 8명을 선으로 이은 그림. 손 씻기 자주 씻음, 마스크 씀.',
      '결과: 줄어들었다',
      '결과: 늘어났다',
      '결과: 변하지 않았다',
    ];
    for (const text of shown) expect(guardOutput(text, eGuard).ok, text).toBe(true);
  });

  it('탓하는 표현이 없다', () => {
    const all = [e.title, e.question, e.predictionPrompt, ...e.tutor.probes.map((p) => p.text)].join(' ');
    expect(all).not.toMatch(/탓|잘못|퍼뜨|옮긴 사람|감염시/);
  });

  it('모든 시행 상황에서 고른 질문이 가드를 통과하고 폴백이 아니다', () => {
    const situations: Partial<ProbeContext>[] = [
      {},
      { lastAnalysis: { kind: 'first-trial', changed: [] } },
      { lastAnalysis: { kind: 'confounded', changed: ['wash', 'mask'] } },
      { lastAnalysis: { kind: 'iv-unchanged', changed: ['seat'] } },
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

// ---------- 기후변화와 우리 생활(온실 모형) 매니페스트 ----------
import climateJson from '../../../content/units/g4-climate/manifest.json';

describe('g4-climate 매니페스트 probe', () => {
  const e = parseManifest(climateJson).experiments[0]! as VariableExperiment;
  const eLabels = Object.fromEntries(e.variables.map((v) => [v.key, v.label]));
  const eKeys = e.variables.map((v) => v.key);
  const eGuard = { forbiddenAnswers: e.tutor.forbiddenAnswers, limits: e.limits };
  const eCtx = (x: Partial<ProbeContext>): ProbeContext => ({ labels: eLabels, ivKey: 'cover', ...x });
  const fair = (iv: string): Partial<ProbeContext> => ({
    ivKey: iv,
    lastAnalysis: { kind: 'fair-test', changed: [iv] },
    prediction: 'same',
    observed: 'same',
  });

  it('iv별 fair-test 질문을 고른다', () => {
    expect(selectProbe(eCtx(fair('air')), e.tutor.probes, eGuard)).toContain('덮개를 바꾸었을 때와 비교하면 차이가 컸나요, 작았나요?');
    expect(selectProbe(eCtx(fair('cap')), e.tutor.probes, eGuard)).toContain('뚜껑 색만 바꾸었을 때 결과가 달라졌나요?');
    expect(selectProbe(eCtx(fair('cover')), e.tutor.probes, eGuard)).toContain('오른 온도는 얼마나 달라졌나요? 그래프의 앞 시행 선과 비교해 볼까요?');
  });

  it('실행 전 질문은 병 속 온도를 예측하게 하고, 예측과 결과가 다르면 열이 드나드는 모습을 보게 한다', () => {
    expect(selectProbe(eCtx({}), e.tutor.probes, eGuard)).toContain('병 속 온도가 어떻게 될지 예측해 볼까요?');
    const text = selectProbe(eCtx({ ...fair('cover'), prediction: 'decrease', observed: 'increase' }), e.tutor.probes, eGuard);
    expect(text).toContain('열이 드나드는 모습 그림에서 빠져나가는 화살표를 살펴볼까요?');
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

  it('금지 구절은 사양의 네 가지와 활용형까지 막는다', () => {
    for (const answer of [
      // 사양의 네 가지
      '덮개를 씌우면 온도가 더 올라요',
      '이산화 탄소가 많으면 온도가 더 올라요',
      '열이 빠져나가지 못하기 때문이에요',
      '뚜껑 색은 관계없어요',
      // 덮개
      '덮개를 씌우면 더 올라요',
      '덮개를 씌우면 온도가 올라간다',
      '덮개를 씌우면 온도가 높아요',
      '덮개를 씌우면 온도가 높아진다',
      '덮개를 씌우면 온도가 더 높아요',
      '덮개를 씌우면 더 높아져요',
      '덮개를 씌우면 훨씬 뜨거워요',
      '덮개를 씌우면 더 따뜻해요',
      '덮개를 씌울수록 온도가 올라요',
      '덮개를 씌운 병이 더 뜨거워요',
      '덮개가 있으면 온도가 올라요',
      '덮개가 있으면 더 올라요',
      // 이산화 탄소
      '이산화 탄소가 많으면 더 올라요',
      '이산화 탄소가 많으면 온도가 높아요',
      '이산화 탄소가 많을수록 온도가 올라요',
      '이산화 탄소를 넣으면 온도가 올라요',
      '이산화 탄소를 더 넣으면 더 따뜻해요',
      '이산화 탄소가 늘어나면 온도가 올라가요',
      // 열의 이동
      '열이 빠져나가지 못해서 올라가요',
      '열이 빠져나가지 못하니까 올라가요',
      '열이 빠져나가지 않아서 더 올라가요',
      '열이 안 빠져나가요',
      '열이 못 빠져나가요',
      '열이 갇혀서 올라가요',
      '열을 가둬요',
      '비닐이 열이 빠져나가는 것을 막아요',
      // 뚜껑 색
      '뚜껑 색은 상관없어요',
      '뚜껑 색은 영향이 없어요',
      '뚜껑 색은 결과에 영향을 주지 않아요',
      '뚜껑 색과 관계없이 같아요',
      '뚜껑 색이 달라도 같아요',
      '뚜껑 색은 중요하지 않아요',
      '뚜껑은 관계없어요',
    ]) {
      expect(guardOutput(answer, eGuard).ok, answer).toBe(false);
    }
    for (const l of e.limits) expect(guardOutput(`${l}이에요`, eGuard).ok, l).toBe(false);
  });

  it('질문과 화면에 보이는 글은 금지 구절·limits 용어와 겹치지 않는다', () => {
    const shown = [
      e.title,
      e.question,
      e.predictionPrompt,
      ...e.variables.flatMap((v) => [v.label, v.unit ?? '', ...v.options.map((o) => o.label)]),
      ...e.dependent.flatMap((d) => [d.label, d.unit ?? '']),
      ...(e.safetyChecklist ?? []),
      ...Object.values(e.safetyMessages ?? {}),
      '⚠ 전등 갓은 뜨거워요. 이산화 탄소는 선생님이 넣어 줘요.',
      '공기층은 담요처럼 열이 빠져나가는 것을 늦춰요.',
      '실제 지구는 병보다 훨씬 크고, 바다·구름·숲 같은 많은 것이 함께 영향을 줘요.',
      '모형의 한계',
      '실험하면 병 속 온도가 어떻게 달라지는지 볼 수 있어요.',
      '실험하면 빛과 열이 드나드는 모습을 볼 수 있어요.',
      '20.0분 · 병 속 27.8 °C (처음보다 +5.8 °C)',
      '눈으로 보기',
      '열이 드나드는 모습 보기',
      '들어오는 빛',
      '빠져나가는 열',
      '되돌아오는 열',
      '이산화 탄소 +',
      '투명 비닐',
      '흰색 뚜껑',
      '파란색 뚜껑',
      '가상 온도계: 병 속',
      '병 속 온도(°C)',
      '시간(분)',
      '오른 온도(°C)',
      '20분 뒤 온도(°C)',
      '결과: 늘어났다',
      '결과: 줄어들었다',
      '결과: 변하지 않았다',
    ];
    for (const text of shown) expect(guardOutput(text, eGuard).ok, text).toBe(true);
  });

  it('모든 시행 상황에서 고른 질문이 가드를 통과하고 폴백이 아니다', () => {
    const situations: Partial<ProbeContext>[] = [
      {},
      { lastAnalysis: { kind: 'first-trial', changed: [] } },
      { lastAnalysis: { kind: 'confounded', changed: ['cover', 'air'] } },
      { lastAnalysis: { kind: 'iv-unchanged', changed: ['cap'] } },
      { lastAnalysis: { kind: 'repeat', changed: [] } },
      ...eKeys.flatMap((k) => [fair(k), { ...fair(k), prediction: 'decrease' as const, observed: 'increase' as const }]),
    ];
    for (const s of situations) {
      const text = selectProbe(eCtx(s), e.tutor.probes, eGuard);
      expect(text).not.toBe(FALLBACK_PROBE);
      expect(guardOutput(text, eGuard).ok, text).toBe(true);
    }
  });
});

// ---------- 자원과 에너지(태양광 패널) 매니페스트 ----------
import energyJson from '../../../content/units/g5-energy/manifest.json';

describe('g5-energy 매니페스트 probe', () => {
  const e = parseManifest(energyJson).experiments[0]! as VariableExperiment;
  const eLabels = Object.fromEntries(e.variables.map((v) => [v.key, v.label]));
  const eKeys = e.variables.map((v) => v.key);
  const eGuard = { forbiddenAnswers: e.tutor.forbiddenAnswers, limits: e.limits };
  const eCtx = (x: Partial<ProbeContext>): ProbeContext => ({ labels: eLabels, ivKey: 'tilt', ...x });
  const fair = (iv: string): Partial<ProbeContext> => ({ ivKey: iv, lastAnalysis: { kind: 'fair-test', changed: [iv] }, prediction: 'same', observed: 'same' });

  it('iv별 fair-test 질문을 고른다', () => {
    expect(selectProbe(eCtx(fair('tilt')), e.tutor.probes, eGuard)).toContain('세 가지 각도를 모두 해 보았나요?');
    expect(selectProbe(eCtx(fair('frame')), e.tutor.probes, eGuard)).toContain('테두리 색만 바꾸었을 때 결과가 달라졌나요?');
    expect(selectProbe(eCtx(fair('weather')), e.tutor.probes, eGuard)).toContain('만든 전기와 프로펠러 그래프는 어떻게 달라졌나요?');
  });

  it('실행 전 질문과 예측 불일치 질문', () => {
    expect(selectProbe(eCtx({}), e.tutor.probes, eGuard)).toContain('만든 전기의 양이 어떻게 될지 예측해 볼까요?');
    const text = selectProbe(eCtx({ ...fair('tilt'), prediction: 'decrease', observed: 'increase' }), e.tutor.probes, eGuard);
    expect(text).toContain('빛줄기의 간격을 볼까요?');
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

  it('금지 구절은 사양의 다섯 가지와 활용형까지 막는다', () => {
    for (const answer of [
      '30°일 때 가장 많이 만들어요', '30도일 때 가장 많이 만들어요', '30°에서 제일 많이 만들어요', '30도에서 가장 많이 만들어요', '30°가 가장 많이 만들어요',
      '빛이 똑바로 닿을수록 많이 만들어요', '똑바로 닿을수록 많이 만들어요', '똑바로 닿으면 더 많이 만들어요', '수직으로 닿을수록 많아요', '빛이 강할수록 많아요',
      '흐린 날에는 적게 만들어요', '흐린 날은 적게 만들어요', '흐린 날은 전기가 줄어요', '흐리면 적게 만들어요', '구름이 끼면 줄어요', '맑은 날에 더 많이 만들어요',
      '그늘이 지면 줄어요', '그늘이 지면 적게 만들어요', '그늘이 생기면 줄어들어요', '그늘이 있으면 덜 만들어요', '가려지면 줄어요', '그늘 때문에 줄어요',
      '테두리 색은 관계없어요', '테두리 색은 상관없어요', '테두리 색은 영향이 없어요', '테두리 색과 관계없이 같아요', '테두리 색이 달라도 같아요', '테두리는 관계없어요',
    ]) expect(guardOutput(answer, eGuard).ok, answer).toBe(false);
    for (const l of e.limits) expect(guardOutput(`${l}이에요`, eGuard).ok, l).toBe(false);
  });

  it('질문과 화면에 보이는 글은 금지 구절·limits 용어와 겹치지 않는다', () => {
    const shown = [
      e.title, e.question, e.predictionPrompt,
      ...e.variables.flatMap((v) => [v.label, v.unit ?? '', ...v.options.map((o) => o.label)]),
      ...e.dependent.flatMap((d) => [d.label, d.unit ?? '']),
      ...(e.safetyChecklist ?? []), ...Object.values(e.safetyMessages ?? {}),
      '⚠ 태양을 직접 보지 않아요.',
      '같은 넓이에 닿는 빛줄기가 많을수록 전기를 많이 만들어요.',
      '실제 패널은 일부만 가려져도 더 많이 줄 수 있어요. 태양 높이는 계절과 시각에 따라 달라져요.',
      '모형의 한계', '실험하면 패널이 만든 전기의 양을 볼 수 있어요.', '실험하면 햇빛이 패널에 닿는 모습을 볼 수 있어요.',
      '60.0초 · 만든 전기 433 mW · 돈 횟수 104번',
      '눈으로 보기', '빛이 닿는 모습 보기', '태양', '그늘', '나무', '프로펠러', '햇빛', '패널', '가상 전력계', '프로펠러가 돈 횟수(번)', '시간(초)',
      '만든 전기(mW)', '1분 동안 돈 횟수(번)', '결과: 늘어났다', '결과: 줄어들었다', '결과: 변하지 않았다',
    ];
    for (const text of shown) expect(guardOutput(text, eGuard).ok, text).toBe(true);
  });

  it('모든 시행 상황에서 고른 질문이 가드를 통과하고 폴백이 아니다', () => {
    const situations: Partial<ProbeContext>[] = [
      {}, { lastAnalysis: { kind: 'first-trial', changed: [] } }, { lastAnalysis: { kind: 'confounded', changed: ['tilt', 'weather'] } },
      { lastAnalysis: { kind: 'iv-unchanged', changed: ['frame'] } }, { lastAnalysis: { kind: 'repeat', changed: [] } },
      ...eKeys.flatMap((k) => [fair(k), { ...fair(k), prediction: 'decrease' as const, observed: 'increase' as const }]),
    ];
    for (const s of situations) {
      const text = selectProbe(eCtx(s), e.tutor.probes, eGuard);
      expect(text).not.toBe(FALLBACK_PROBE);
      expect(guardOutput(text, eGuard).ok, text).toBe(true);
    }
  });
});

// ---------- 지구와 바다(바닷물과 강물 비교하기) 매니페스트 ----------
import earthSeaJson from '../../../content/units/g3-earth-sea/manifest.json';

describe('g3-earth-sea 매니페스트 probe', () => {
  const e = parseManifest(earthSeaJson).experiments[0]! as VariableExperiment;
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
    expect(selectProbe(eCtx(fair('water')), e.tutor.probes, eGuard)).toContain('물의 종류만 바꾸었어요. 물이 다 마른 뒤 접시에는 무엇이 보이나요?');
    expect(selectProbe(eCtx(fair('volumeMl')), e.tutor.probes, eGuard)).toContain('물의 양만 바꾸었어요. 물이 다 마른 시간은 어떻게 달라졌나요?');
    expect(selectProbe(eCtx(fair('dish')), e.tutor.probes, eGuard)).toContain('접시 모양만 바꾸었을 때 결과가 달라졌나요?');
  });

  it('예측과 결과가 다르면 접시의 물이 0이 되는 때와 남은 것을 그림에서 찾아보라고 한다', () => {
    const text = selectProbe(eCtx({ ...fair('water'), prediction: 'increase', observed: 'same' }), e.tutor.probes, eGuard);
    expect(text).toContain('접시에 남은 물이 0이 되는 때');
  });

  it('모든 probe는 질문형이고, 모든 probe × 모든 변인 조합으로 치환해도 가드를 통과한다 (오검출 없음)', () => {
    let n = 0;
    for (const probe of e.tutor.probes) {
      expect(probe.text.trim().endsWith('?'), probe.text).toBe(true);
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

  it('모든 시행 상황에서 고른 질문이 가드를 통과하고 폴백이 아니다', () => {
    const situations: Partial<ProbeContext>[] = [
      {},
      { lastAnalysis: { kind: 'first-trial', changed: [] } },
      { lastAnalysis: { kind: 'confounded', changed: ['water', 'volumeMl'] } },
      { lastAnalysis: { kind: 'iv-unchanged', changed: ['dish'] } },
      { lastAnalysis: { kind: 'repeat', changed: [] } },
      ...eKeys.flatMap((k) => [fair(k), { ...fair(k), prediction: 'increase' as const, observed: 'same' as const }]),
    ];
    for (const s of situations) {
      const text = selectProbe(eCtx(s), e.tutor.probes, eGuard);
      expect(text).not.toBe(FALLBACK_PROBE);
      expect(guardOutput(text, eGuard).ok, text).toBe(true);
    }
  });

  it('금지 구절은 사양의 목록과 활용형까지 막는다', () => {
    for (const answer of [
      '바닷물에는 소금이 녹아 있어요',
      '바닷물에는 소금이 들어 있어요',
      '바닷물에 소금이 녹아 있답니다',
      '바닷물을 증발시키면 소금이 남아요',
      '바닷물은 하얀 가루가 남아요',
      '강물에는 소금이 거의 없어요',
      '강물은 아무것도 남지 않아요',
      '강물은 아무것도 남지 않았어요',
      '물이 많을수록 가루가 많이 남아요',
      '물을 많이 부을수록 가루가 늘어요',
      '접시 모양은 관계없어요',
      '접시 모양은 상관없어요',
      '접시 모양은 영향이 없어요',
      '접시 모양은 결과에 영향을 주지 않아요',
      '접시 모양과 관계없이 같아요',
      '접시 모양이 달라도 같아요',
    ]) {
      expect(guardOutput(answer, eGuard).ok, answer).toBe(false);
    }
    for (const l of e.limits) expect(guardOutput(`${l}이에요`, eGuard).ok, l).toBe(false);
  });
});

// ---------- 변인 실험 두 번째 활동: 지레와 빗면, 소리 나는 물체의 떨림, 자석과 자석 사이 ----------
describe('변인 실험 활동 2 매니페스트 probe (lever-lift, sound-vibration, magnet-poles)', () => {
  const CASES = [
    {
      name: 'g3-force 활동 2(lever-lift)',
      json: forceJson,
      iv: { tool: '쓰는 도구만 바꾸었어요.', armCm: '힘을 주는 쪽 길이만 바꾸었어요.', color: '물체 색깔만 바꾸었을 때' },
      mismatch: '힘과 거리 보기',
      rules: ['받침점에서 멀수록 힘이 적게 들어요', '빗면이 길수록 힘이 적게 들어요', '지레를 쓰면 힘이 덜 들어요', '빗면을 쓰면 힘이 덜 들어요', '힘은 적게 드는 대신 더 많이 당겨야 해요', '색깔은 관계없어요'],
    },
    {
      name: 'g3-sound 활동 2(sound-vibration)',
      json: soundJson,
      iv: { sound: '소리 내기만 바꾸었어요.', loud: '소리의 세기만 바꾸었어요.', object: '물체만 바꾸었어요.', seed: '좁쌀 색만 바꾸었을 때' },
      mismatch: '좁쌀 높이가 가장 높은 때',
      rules: ['소리가 나는 물체는 떨려요', '소리를 멈추면 떨림이 멈춰요', '떨림이 멈추면 소리도 멈춰요', '세게 칠수록 많이 떨려요', '떨림이 클수록 소리가 커요', '좁쌀 색은 관계없어요'],
    },
    {
      name: 'g4-magnet 활동 2(magnet-poles)',
      json: magnetJson,
      iv: { facing: '마주 보는 극만 바꾸었어요.', gapCm: '두 자석 사이 거리만 바꾸었어요.', size: '자석 크기만 바꾸었어요.', cover: '자석 겉 색칠만 바꾸었을 때' },
      mismatch: "'거리 재기' 그림",
      rules: ['같은 극끼리 밀어요', '같은 극끼리는 밀어내요', '다른 극끼리 끌어요', '다른 극끼리는 끌어당겨요', '가까울수록 세게 당겨요', '멀수록 약해져요', '색칠은 관계없어요'],
    },
  ];
  for (const c of CASES) {
    describe(c.name, () => {
      const e = parseManifest(c.json).experiments[1]! as VariableExperiment;
      const eLabels = Object.fromEntries(e.variables.map((v) => [v.key, v.label]));
      const eKeys = e.variables.map((v) => v.key);
      const eGuard = { forbiddenAnswers: e.tutor.forbiddenAnswers, limits: e.limits };
      const eCtx = (x: Partial<ProbeContext>): ProbeContext => ({ labels: eLabels, ivKey: eKeys[0]!, ...x });
      const fair = (iv: string): Partial<ProbeContext> => ({ ivKey: iv, lastAnalysis: { kind: 'fair-test', changed: [iv] }, prediction: 'same', observed: 'same' });

      it('iv별 fair-test 질문을 고른다', () => {
        for (const [iv, start] of Object.entries(c.iv)) expect(selectProbe(eCtx(fair(iv)), e.tutor.probes, eGuard), iv).toContain(start);
      });

      it('예측과 결과가 다르면 그림·그래프에서 확인하라고 한다', () => {
        const text = selectProbe(eCtx({ ...fair(eKeys[0]!), prediction: 'increase', observed: 'same' }), e.tutor.probes, eGuard);
        expect(text).toContain(c.mismatch);
      });

      it('모든 probe는 질문형이고, 모든 probe × 모든 변인 조합으로 치환해도 가드를 통과한다 (오검출 없음)', () => {
        let n = 0;
        for (const probe of e.tutor.probes) {
          expect(probe.text.trim().endsWith('?'), probe.text).toBe(true);
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

      it('모든 시행 상황에서 고른 질문이 가드를 통과하고 폴백이 아니다', () => {
        const situations: Partial<ProbeContext>[] = [
          {},
          { lastAnalysis: { kind: 'first-trial', changed: [] } },
          { lastAnalysis: { kind: 'confounded', changed: eKeys.slice(0, 2) } },
          { lastAnalysis: { kind: 'iv-unchanged', changed: [eKeys[eKeys.length - 1]!] } },
          { lastAnalysis: { kind: 'repeat', changed: [] } },
          ...eKeys.flatMap((k) => [fair(k), { ...fair(k), prediction: 'increase' as const, observed: 'same' as const }]),
        ];
        for (const s of situations) {
          const text = selectProbe(eCtx(s), e.tutor.probes, eGuard);
          expect(text).not.toBe(FALLBACK_PROBE);
          expect(guardOutput(text, eGuard).ok, text).toBe(true);
        }
      });

      it('금지 구절과 한계 용어를 담은 문장은 실제로 막는다', () => {
        for (const f of e.tutor.forbiddenAnswers) expect(guardOutput(`${f}요`, eGuard).ok, f).toBe(false);
        for (const l of e.limits) expect(guardOutput(`${l}이에요`, eGuard).ok, l).toBe(false);
        for (const rule of c.rules) expect(guardOutput(rule, eGuard).ok, rule).toBe(false);
        for (const probe of e.tutor.probes) {
          for (const f of e.tutor.forbiddenAnswers) expect(probe.text, probe.text).not.toContain(f);
          for (const l of e.limits) expect(probe.text, probe.text).not.toContain(l);
        }
      });
    });
  }
});

// ---------- 변인 실험 두 번째 활동: 용액의 진하기 비교하기, 온도가 다른 두 물이 닿으면, 산성 용액과 염기성 용액 섞기 ----------
describe('변인 실험 활동 2 매니페스트 probe (concentration, heat-contact, acid-base-mix)', () => {
  const CASES = [
    {
      name: 'g5-solution 활동 2(concentration)',
      json: manifestJson,
      iv: { spoons: '넣은 설탕만 바꾸었어요.', waterMl: '물의 양만 바꾸었어요.', sugar: '설탕 종류만 바꾸었어요.', cup: '비커 모양만 바꾸었을 때' },
      mismatch: '시행별 막대 그래프',
      rules: ['설탕을 많이 넣을수록 진해요', '설탕이 많을수록 진해요', '물이 많을수록 연해요', '물을 많이 넣을수록 연해져요', '진할수록 방울토마토가 높이 떠요', '진할수록 높이 떠요', '흰 설탕은 색으로 비교할 수 없어요', '비커 모양은 관계없어요'],
    },
    {
      name: 'g5-heat 활동 2(heat-contact)',
      json: heatJson,
      iv: { hotC: '안쪽 컵 물의 처음 온도만 바꾸었어요.', coldMl: '바깥 찬물의 양만 바꾸었어요.', cup: '안쪽 컵 재료만 바꾸었어요.', label: '이름표 색만 바꾸었을 때' },
      mismatch: '그래프의 두 선과 열화상 화면',
      rules: ['열이 이동해요', '열이 옮겨 가요', '열이 전달돼요', '따뜻한 쪽에서 차가운 쪽으로 가요', '두 온도가 같아질 때까지 변해요', '온도가 같아져요', '찬물이 많을수록 더 낮아져요', '이름표 색은 관계없어요'],
    },
    {
      name: 'g6-acid-base 활동 2(acid-base-mix)',
      json: acidBaseJson,
      iv: { drops: '넣은 방울 수만 바꾸었어요.', direction: '넣는 방향만 바꾸었어요.', indicator: '지시약만 바꾸었어요.', beaker: '비커 크기만 바꾸었을 때' },
      mismatch: '색 띠 기록',
      rules: ['중화가 일어나요', '중성이 돼요', '산성이 약해져요', '염기성이 약해져요', '산성이 점점 약해져요', '염기성으로 변해요', '비커 크기는 관계없어요'],
    },
  ];
  for (const c of CASES) {
    describe(c.name, () => {
      const e = parseManifest(c.json).experiments[1]! as VariableExperiment;
      const eLabels = Object.fromEntries(e.variables.map((v) => [v.key, v.label]));
      const eKeys = e.variables.map((v) => v.key);
      const eGuard = { forbiddenAnswers: e.tutor.forbiddenAnswers, limits: e.limits };
      const eCtx = (x: Partial<ProbeContext>): ProbeContext => ({ labels: eLabels, ivKey: eKeys[0]!, ...x });
      const fair = (iv: string): Partial<ProbeContext> => ({ ivKey: iv, lastAnalysis: { kind: 'fair-test', changed: [iv] }, prediction: 'same', observed: 'same' });

      it('iv별 fair-test 질문을 고른다', () => {
        for (const [iv, start] of Object.entries(c.iv)) expect(selectProbe(eCtx(fair(iv)), e.tutor.probes, eGuard), iv).toContain(start);
      });

      it('예측과 결과가 다르면 그림·그래프에서 확인하라고 한다', () => {
        const text = selectProbe(eCtx({ ...fair(eKeys[0]!), prediction: 'increase', observed: 'same' }), e.tutor.probes, eGuard);
        expect(text).toContain(c.mismatch);
      });

      it('모든 probe는 질문형이고, 모든 probe × 모든 변인 조합으로 치환해도 가드를 통과한다 (오검출 없음)', () => {
        let n = 0;
        for (const probe of e.tutor.probes) {
          expect(probe.text.trim().endsWith('?'), probe.text).toBe(true);
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

      it('모든 시행 상황에서 고른 질문이 가드를 통과하고 폴백이 아니다', () => {
        const situations: Partial<ProbeContext>[] = [
          {},
          { lastAnalysis: { kind: 'first-trial', changed: [] } },
          { lastAnalysis: { kind: 'confounded', changed: eKeys.slice(0, 2) } },
          { lastAnalysis: { kind: 'iv-unchanged', changed: [eKeys[eKeys.length - 1]!] } },
          { lastAnalysis: { kind: 'repeat', changed: [] } },
          ...eKeys.flatMap((k) => [fair(k), { ...fair(k), prediction: 'increase' as const, observed: 'same' as const }]),
        ];
        for (const s of situations) {
          const text = selectProbe(eCtx(s), e.tutor.probes, eGuard);
          expect(text).not.toBe(FALLBACK_PROBE);
          expect(guardOutput(text, eGuard).ok, text).toBe(true);
        }
      });

      it('금지 구절과 한계 용어를 담은 문장은 실제로 막는다', () => {
        for (const f of e.tutor.forbiddenAnswers) expect(guardOutput(`${f}요`, eGuard).ok, f).toBe(false);
        for (const l of e.limits) expect(guardOutput(`${l}이에요`, eGuard).ok, l).toBe(false);
        for (const rule of c.rules) expect(guardOutput(rule, eGuard).ok, rule).toBe(false);
        for (const probe of e.tutor.probes) {
          for (const f of e.tutor.forbiddenAnswers) expect(probe.text, probe.text).not.toContain(f);
          for (const l of e.limits) expect(probe.text, probe.text).not.toContain(l);
        }
      });
    });
  }
});

// ---------- 변인 실험 두 번째 활동: 시간에 따른 위치 변화, 연소 전과 후 비교하기 ----------
describe('변인 실험 활동 2 매니페스트 probe (position-time, combustion-products)', () => {
  const CASES = [
    {
      name: 'g6-motion 활동 2(position-time)',
      json: motionJson,
      iv: { object: '보는 물체만 바꾸었어요.', watchS: '관찰 시간만 바꾸었어요.', weather: '날씨만 바꾸었을 때' },
      mismatch: '1초마다 겹쳐 그린 그림',
      rules: ['위치가 변하면 운동해요', '위치가 바뀌면 운동이에요', '위치가 변하지 않으면 운동하지 않아요', '위치가 바뀌지 않으면 운동하지 않아요', '나무는 운동하지 않아요', '달팽이도 운동해요', '날씨는 관계없어요', '날씨는 상관없어요', '날씨는 영향이 없어요', '날씨와 관계없이 같아요', '날씨가 달라도 같아요'],
    },
    {
      name: 'g6-combustion 활동 2(combustion-products)',
      json: combustionJson,
      iv: { burnMin: '초를 태운 시간만 바꾸었어요.', test: '검사 방법만 바꾸었어요.', jar: '집기병 색만 바꾸었을 때' },
      mismatch: '눈으로 보기의 검사 도구',
      rules: ['물이 생겨요', '물이 생긴 거예요', '이산화 탄소가 생겨요', '이산화 탄소가 생깁니다', '물과 이산화 탄소가 나와요', '집기병 색은 관계없어요', '집기병 색은 상관없어요', '집기병 색은 영향이 없어요', '집기병 색과 관계없이 같아요', '집기병 색이 달라도 같아요'],
    },
  ];
  for (const c of CASES) {
    describe(c.name, () => {
      const e = parseManifest(c.json).experiments[1]! as VariableExperiment;
      const eLabels = Object.fromEntries(e.variables.map((v) => [v.key, v.label]));
      const eKeys = e.variables.map((v) => v.key);
      const eGuard = { forbiddenAnswers: e.tutor.forbiddenAnswers, limits: e.limits };
      const eCtx = (x: Partial<ProbeContext>): ProbeContext => ({ labels: eLabels, ivKey: eKeys[0]!, ...x });
      const fair = (iv: string): Partial<ProbeContext> => ({ ivKey: iv, lastAnalysis: { kind: 'fair-test', changed: [iv] }, prediction: 'same', observed: 'same' });

      it('iv별 fair-test 질문을 고른다', () => {
        for (const [iv, start] of Object.entries(c.iv)) expect(selectProbe(eCtx(fair(iv)), e.tutor.probes, eGuard), iv).toContain(start);
      });

      it('예측과 결과가 다르면 그림·그래프에서 확인하라고 한다', () => {
        const text = selectProbe(eCtx({ ...fair(eKeys[0]!), prediction: 'increase', observed: 'same' }), e.tutor.probes, eGuard);
        expect(text).toContain(c.mismatch);
      });

      it('모든 probe는 질문형이고, 모든 probe × 모든 변인 조합으로 치환해도 가드를 통과한다 (오검출 없음)', () => {
        let n = 0;
        for (const probe of e.tutor.probes) {
          expect(probe.text.trim().endsWith('?'), probe.text).toBe(true);
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

      it('모든 시행 상황에서 고른 질문이 가드를 통과하고 폴백이 아니다', () => {
        const situations: Partial<ProbeContext>[] = [
          {},
          { lastAnalysis: { kind: 'first-trial', changed: [] } },
          { lastAnalysis: { kind: 'confounded', changed: eKeys.slice(0, 2) } },
          { lastAnalysis: { kind: 'iv-unchanged', changed: [eKeys[eKeys.length - 1]!] } },
          { lastAnalysis: { kind: 'repeat', changed: [] } },
          ...eKeys.flatMap((k) => [fair(k), { ...fair(k), prediction: 'increase' as const, observed: 'same' as const }]),
        ];
        for (const s of situations) {
          const text = selectProbe(eCtx(s), e.tutor.probes, eGuard);
          expect(text).not.toBe(FALLBACK_PROBE);
          expect(guardOutput(text, eGuard).ok, text).toBe(true);
        }
      });

      it('금지 구절과 한계 용어를 담은 문장은 실제로 막는다', () => {
        for (const f of e.tutor.forbiddenAnswers) expect(guardOutput(`${f}요`, eGuard).ok, f).toBe(false);
        for (const l of e.limits) expect(guardOutput(`${l}이에요`, eGuard).ok, l).toBe(false);
        for (const rule of c.rules) expect(guardOutput(rule, eGuard).ok, rule).toBe(false);
        for (const probe of e.tutor.probes) {
          for (const f of e.tutor.forbiddenAnswers) expect(probe.text, probe.text).not.toContain(f);
          for (const l of e.limits) expect(probe.text, probe.text).not.toContain(l);
        }
      });
    });
  }
});
