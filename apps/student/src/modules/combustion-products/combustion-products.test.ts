import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { guardOutput } from '@sci/tutor';
import { observedOutcome } from '@sci/gateway';
import { CP_BURN_MIN, CP_JARS, CP_OUTCOME_LABEL, CP_TESTS, simulateCombustionProducts, type CombustionProductsSample } from '@sci/engine-matter';
import type { VariableExperiment } from '@sci/schema';
import { GraphView } from '../../components/GraphView';
import { UNITS } from '../../units';
import { MODULES } from '../index';
import { combustionProductsModule } from './index';
import { BURN_TEXT, JAR_FILL, JAR_TEXT, LIME_CLEAR, PAPER_BLUE, PAPER_RED, TEST_SHORT, TEST_TEXT, cloudText, outcomeNow, paperFill } from './initial';
import { CANDLE, ProductsMacroView, candleHeight } from './ProductsMacroView';
import { MAX_ROWS, ProductsRecordView, rowsOf } from './ProductsRecordView';

const unit = UNITS.find((u) => u.id === 'g6-combustion')!;
if (!unit.ok) throw new Error('g6-combustion이 없어요');
const activity = unit.activities[1]!;
if (activity.activity !== 'variable') throw new Error('g6-combustion 활동 2가 변인 실험이 아니에요');
const experiment = activity.experiment;
const firstExp = unit.activities[0]!.experiment as VariableExperiment;
type V = { burnMin: number; test: string; jar: string };
const base: V = { burnMin: 0, test: 'paper', jar: 'clear' };
const CONDITIONS: V[] = CP_BURN_MIN.flatMap((burnMin) => CP_TESTS.flatMap((test) => CP_JARS.map((jar) => ({ burnMin, test, jar }))));
const sim = (v: V) => combustionProductsModule.simulate(v, experiment) as ReturnType<typeof simulateCombustionProducts>;
const at = (v: V, t: number): CombustionProductsSample => sim(v).samples.find((s) => Math.abs(s.t - t) < 1e-9)!;
let seq = 0;
const trialOf = (v: V) => ({ id: `t${++seq}`, index: seq, samples: sim(v).samples, result: sim(v).result, values: v }) as never;
const macro = (v: V, snapshot: CombustionProductsSample | null, ran = true) => renderToStaticMarkup(createElement(ProductsMacroView, { experiment, trial: ran ? trialOf(v) : undefined, snapshot, values: v, playhead: 0 }));
const record = (trials: V[], snapshot: CombustionProductsSample | null, activeIndex = trials.length - 1) => {
  const list = trials.map(trialOf) as { id: string }[];
  return renderToStaticMarkup(createElement(ProductsRecordView, { experiment, trial: list[activeIndex] as never, snapshot, values: trials[activeIndex] ?? base, playhead: 0, trials: list as never }));
};
const emptyRecord = (v: V = base) => renderToStaticMarkup(createElement(ProductsRecordView, { experiment, trial: undefined, snapshot: null, values: v, playhead: 0, trials: [] }));
const count = (html: string, id: string) => (html.match(new RegExp(`data-testid="${id}"`, 'g')) ?? []).length;
const shownText = (html: string) => [...html.replace(/<[^>]+>/g, '\n').split('\n'), ...[...html.matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1]!)].map((t) => t.trim()).filter(Boolean);
const TIMES = [0, 0.5, 1, 2, 3];
const graphOf = (v: V, prev?: V) => renderToStaticMarkup(createElement(GraphView, { module: combustionProductsModule as never, experiment, trial: trialOf(v), prev: prev ? trialOf(prev) : undefined, playhead: 3, playing: false, onPlayhead: () => {}, describedBy: 'results-table' }));

describe('레지스트리', () => {
  it('g6-combustion 활동 2는 combustion-products 모듈로 로드되고 첫 활동(candle-jar)은 그대로다', () => {
    expect([unit.manifest.title, unit.manifest.grade, unit.manifest.engine, unit.manifest.standards]).toEqual(['물질의 연소', 6, 'matter', ['6과14-02', '6과14-03']]);
    expect(unit.activities.map((a) => [a.activity, a.experiment.id, a.module.kind])).toEqual([['variable', 'candle-jar', 'candle-jar'], ['variable', 'combustion-products', 'combustion-products']]);
    expect(unit.module.kind).toBe('candle-jar');
    expect(activity.module).toBe(combustionProductsModule);
    expect(MODULES['combustion-products'].kind).toBe('combustion-products');
    expect(experiment.safety).toEqual(['fire', 'hot']);
    expect(combustionProductsModule.validate(experiment)).toEqual([]);
  });

  it('매니페스트의 문구와 변인이 사양과 같다 (예측 문구는 변화 단계로 다듬었다)', () => {
    expect([experiment.title, experiment.question, experiment.predictionPrompt]).toEqual(['연소 전과 후 비교하기', '초가 타고 난 뒤에는 어떤 물질이 생길까?', '예측: 검사 결과의 변화 단계는?']);
    expect(experiment.variables.map((v) => [v.key, v.label, v.default])).toEqual([['burnMin', '초를 태운 시간', 0], ['test', '검사 방법', 'paper'], ['jar', '집기병 색', 'clear']]);
    expect(experiment.variables.map((v) => v.options.map((o) => [o.value, o.label]))).toEqual([
      [[0, '태우지 않음'], [1, '1분'], [3, '3분']],
      [['paper', '푸른색 염화 코발트 종이'], ['limewater', '석회수']],
      [['clear', '투명'], ['blue', '연한 파랑']],
    ]);
    expect(experiment.dependent.map((d) => [d.key, d.label, d.unit])).toEqual([['result', '검사 결과', ''], ['cloud', '석회수 뿌연 정도', '눈금'], ['shorterMm', '초가 짧아진 길이', 'mm'], ['stage', '변화 단계', '단계']]);
    expect(experiment.limits).toEqual(['산화', '탄화수소', '화학 반응식', '수증기 응결']);
    expect(CP_BURN_MIN.map((b) => BURN_TEXT[b])).toEqual(experiment.variables[0]!.options.map((o) => o.label));
    expect(CP_TESTS.map((t) => TEST_TEXT[t])).toEqual(experiment.variables[1]!.options.map((o) => o.label));
    expect(CP_JARS.map((j) => JAR_TEXT[j])).toEqual(experiment.variables[2]!.options.map((o) => o.label));
  });

  it('안전: 불 점검표와 경고 문구는 첫 활동(집기병으로 덮은 촛불)과 같다', () => {
    expect(experiment.safetyChecklist).toEqual(firstExp.safetyChecklist);
    expect(experiment.safetyChecklist).toHaveLength(3);
    expect(experiment.safety).toEqual(firstExp.safety);
    expect(experiment.safetyMessages).toEqual(firstExp.safetyMessages);
  });
});

describe('결과 열·센서·그래프·예측 기준', () => {
  it('결과 열: 사양 표(종이: 푸른색 그대로/붉은색으로 변함, 석회수: 맑음/조금 뿌예짐/뿌예짐)와 뿌연 정도("—"), 짧아진 길이, 변화 단계, 집기병 색 무영향', () => {
    const cols = combustionProductsModule.resultColumns(experiment);
    expect(cols.map((c) => c.label)).toEqual(['검사 결과', '석회수 뿌연 정도(눈금 0~10)', '초가 짧아진 길이(mm)', '변화 단계(0 = 변화 없음)']);
    const row = (burnMin: number, test: string, jar = 'clear') => cols.map((c) => c.value(sim({ burnMin, test, jar }).result));
    for (const jar of ['clear', 'blue']) {
      expect(row(0, 'paper', jar)).toEqual(['푸른색 그대로', '—', '0.0', '0']);
      expect(row(1, 'paper', jar)).toEqual(['붉은색으로 변함', '—', '1.0', '1']);
      expect(row(3, 'paper', jar)).toEqual(['붉은색으로 변함', '—', '3.0', '1']);
      expect(row(0, 'limewater', jar)).toEqual(['맑음', '0', '0.0', '0']);
      expect(row(1, 'limewater', jar)).toEqual(['조금 뿌예짐', '3', '1.0', '1']);
      expect(row(3, 'limewater', jar)).toEqual(['뿌예짐', '8', '3.0', '2']);
    }
    expect(cloudText(null)).toBe('—');
    expect(cloudText(Number.NaN)).toBe('—');
  });

  it('센서는 없다(검사 결과는 눈으로 본다)', () => {
    expect(combustionProductsModule.sensors(null, base)).toEqual([]);
    expect(combustionProductsModule.sensors(at(base, 1), base)).toEqual([]);
  });

  it('그래프 설정: y 0~10(석회수 뿌연 정도), x 0~3분, 선 하나, 종이 검사 안내 글자, 재생이 끝나면 끝에 둔다', () => {
    const g = combustionProductsModule.graph;
    expect([g.yLabel, g.yMin, g.yTicks, g.xLabel, g.xTicks, g.series, g.markers, g.emptyText]).toEqual(['석회수 뿌연 정도(눈금)', undefined, [0, 2, 4, 6, 8, 10], '시간(분)', [0, 1, 2, 3], undefined, undefined, '종이 검사는 선을 그리지 않아요.']);
    expect(combustionProductsModule.restPlayhead).toBeUndefined();
    expect(combustionProductsModule.metric.sampleKey).toBe('cloud');
    expect(combustionProductsModule.metric.resultKey).toBe('stage');
    for (const v of CONDITIONS) expect(sim(v).samples.at(-1)!.t).toBe(3);
  });

  it('예측 비교는 변화 단계: 태운 시간을 늘리면 늘어남, 줄이면 줄어듦, 검사 방법(3분 석회수→종이)은 줄어듦, 집기병 색은 변하지 않음', () => {
    const m = combustionProductsModule.metric;
    const stage = (v: V) => sim(v).result[m.resultKey as 'stage'];
    const th = m.sameThreshold(experiment);
    expect(th).toBe(0.5);
    expect(observedOutcome(stage(base), stage({ ...base, burnMin: 1 }), th)).toBe('increase');
    expect(observedOutcome(stage({ ...base, burnMin: 1, test: 'limewater' }), stage({ ...base, burnMin: 3, test: 'limewater' }), th)).toBe('increase');
    expect(observedOutcome(stage({ ...base, burnMin: 1 }), stage({ ...base, burnMin: 0 }), th)).toBe('decrease');
    expect(observedOutcome(stage({ ...base, burnMin: 3, test: 'limewater' }), stage({ ...base, burnMin: 3, test: 'paper' }), th)).toBe('decrease');
    // 1분과 3분의 종이 검사는 둘 다 붉은색이라 변하지 않음
    expect(observedOutcome(stage({ ...base, burnMin: 1 }), stage({ ...base, burnMin: 3 }), th)).toBe('same');
    for (const v of CONDITIONS) expect(observedOutcome(stage(v), stage({ ...v, jar: v.jar === 'clear' ? 'blue' : 'clear' }), th)).toBe('same');
  });

  it('석회수 그래프는 선을 그리고 y축 눈금 0~10이 있다', () => {
    const html = graphOf({ burnMin: 3, test: 'limewater', jar: 'clear' });
    expect(html).toContain('석회수 뿌연 정도');
    expect(html).toContain('시간(분)');
    expect([...html.matchAll(/text-anchor="end"[^>]*>([^<]+)</g)].map((m) => m[1])).toEqual(['0', '2', '4', '6', '8', '10']);
    expect([...html.matchAll(/text-anchor="middle"[^>]*>(\d)</g)].map((m) => m[1])).toEqual(['0', '1', '2', '3']);
    expect(html.match(/<polyline/g)).toHaveLength(1);
    expect(html).not.toContain('graph-empty');
    expect(html).not.toContain('NaN');
  });

  it('종이 검사는 그래프에 선을 그리지 않고 안내 글자만 쓴다 (NaN 없음). 앞 시행이 석회수여도 이번 시행의 선은 없다', () => {
    for (const burnMin of CP_BURN_MIN) {
      const html = graphOf({ burnMin, test: 'paper', jar: 'clear' });
      expect(html.match(/<polyline/g)).toBeNull();
      expect(html).toContain('종이 검사는 선을 그리지 않아요.');
      expect(html).not.toContain('NaN');
    }
    const mixed = graphOf({ burnMin: 1, test: 'paper', jar: 'clear' }, { burnMin: 3, test: 'limewater', jar: 'clear' });
    expect(mixed.match(/<polyline/g)).toHaveLength(1);
    expect(mixed).toContain('stroke-dasharray="5 4"');
    // 앞 시행이 종이이면 흐린 선이 없다
    const prevPaper = graphOf({ burnMin: 3, test: 'limewater', jar: 'clear' }, { burnMin: 1, test: 'paper', jar: 'clear' });
    expect(prevPaper.match(/<polyline/g)).toHaveLength(1);
    expect(prevPaper).not.toContain('stroke-dasharray="5 4"');
    // 슬라이더 읽기 글자에도 NaN이 없다
    expect(graphOf({ burnMin: 1, test: 'paper', jar: 'clear' })).toContain('없음');
  });
});

describe('눈으로 보기', () => {
  it('실행 전에는 조건과 상관없이 결과를 그리지 않는다: 불꽃 없음, 초 그대로, 검사 결과 "실험하면 나타나요"', () => {
    for (const v of CONDITIONS) {
      const html = macro(v, null, false);
      expect(html, JSON.stringify(v)).toContain('data-result="none"');
      expect(html).toContain('data-lit="no"');
      expect(html).toContain('data-shorter="0"');
      expect(count(html, 'flame')).toBe(0);
      expect(html).toContain('검사 결과: 실험하면 나타나요');
      expect(html).toContain(`data-height="${CANDLE.fullH}"`);
      // 석회수는 맑은 채, 종이는 푸른색 그대로(검사를 하기 전의 모습)
      if (v.test === 'limewater') expect(html).toContain('data-cloud="0.0"');
      else expect(html).toContain(`data-fill="${PAPER_BLUE}"`);
      expect(html).not.toContain(`data-fill="${PAPER_RED}"`);
    }
  });

  it('실행한 뒤 검사 결과는 그 순간 값에서 정해지고 결과 이름을 글자로 함께 쓴다 (색각 접근성)', () => {
    for (const v of CONDITIONS) {
      for (const t of TIMES) {
        const s = at(v, t);
        const o = outcomeNow(s, v.test as 'paper');
        const html = macro(v, s);
        expect(html, JSON.stringify([v, t])).toContain(`data-result="${o}"`);
        expect(html).toContain(`검사 결과: ${CP_OUTCOME_LABEL[o]}`);
        expect(html).toContain(`data-shorter="${Math.round(s.shorterMm * 10) / 10}"`);
      }
      // 끝 시각의 결과는 모델 결과와 같다
      expect(macro(v, at(v, 3))).toContain(`검사 결과: ${CP_OUTCOME_LABEL[sim(v).result.result]}`);
    }
  });

  it('불꽃은 태우는 동안에만, 초는 태운 시간만큼 짧아지고(1 mm = 4 그림 단위), 3분 태운 뒤에는 3 mm 짧다', () => {
    for (const v of CONDITIONS) {
      for (const t of TIMES) {
        const lit = t < v.burnMin - 1e-9;
        const html = macro(v, at(v, t));
        expect(count(html, 'flame'), JSON.stringify([v, t])).toBe(lit ? 1 : 0);
        expect(html).toContain(`data-lit="${lit ? 'yes' : 'no'}"`);
        expect(html).toContain(`data-height="${candleHeight(at(v, t).shorterMm).toFixed(0)}"`);
      }
    }
    expect(candleHeight(0)).toBe(50);
    expect(candleHeight(3)).toBe(38);
    expect(macro({ ...base, burnMin: 3 }, at({ ...base, burnMin: 3 }, 3))).toContain('data-shorter="3"');
  });

  it('검사 도구: 종이는 푸른색에서 붉은색으로, 석회수는 맑은 물색에서 우윳빛으로 바뀌고 두 도구가 한 그림에 함께 나오지 않는다', () => {
    const p3: V = { burnMin: 3, test: 'paper', jar: 'clear' };
    expect(macro(p3, at(p3, 3))).toContain(`data-fill="${PAPER_RED}"`);
    expect(macro(p3, at(p3, 3))).not.toContain('tool-limewater');
    expect(paperFill(0)).toBe(PAPER_BLUE);
    expect(paperFill(1)).toBe(PAPER_RED);
    const l3: V = { burnMin: 3, test: 'limewater', jar: 'clear' };
    const html = macro(l3, at(l3, 3));
    expect(html).toContain('data-cloud="8.0"');
    expect(html).toContain('tool-limewater');
    expect(html).not.toContain('tool-paper');
    expect(html).toContain(LIME_CLEAR);
    // 뿌연 정도는 시간에 따라 늘어난다
    const level = (t: number) => Number(macro(l3, at(l3, t)).match(/data-testid="lime-milk" data-cloud="([\d.]+)"/)![1]);
    expect(level(0)).toBeLessThan(level(1));
    expect(level(1)).toBeLessThan(level(3));
  });

  it('그림에는 물방울·김 서림 같은 "물이 생김"을 보이는 그림이 없다 (금지 구절)', () => {
    for (const v of CONDITIONS) {
      const html = macro(v, at(v, 3));
      expect(html).not.toMatch(/data-testid="(drop|fog|droplet|bubble)/);
    }
  });

  it('집기병 색은 칠만 바꾸고 결과·글자(집기병 색 줄 빼고)는 바꾸지 않는다 (대조 변인)', () => {
    expect(JAR_FILL).toEqual({ clear: null, blue: '#bfdbfe' });
    const strip = (h: string) => shownText(h).filter((t) => !t.includes('집기병 색'));
    for (const v of CONDITIONS) {
      const other = { ...v, jar: v.jar === 'clear' ? 'blue' : 'clear' };
      for (const t of TIMES) {
        const a = macro(v, at(v, t));
        const b = macro(other, at(other, t));
        expect(strip(a)).toEqual(strip(b));
        expect(a.match(/data-result="(\w+)"/)![1]).toBe(b.match(/data-result="(\w+)"/)![1]);
      }
      expect(macro(v, at(v, 3))).toContain(`data-jar="${v.jar}"`);
      expect(macro(v, at(v, 3))).toContain(`집기병 색: ${JAR_TEXT[v.jar]}`);
    }
    expect(macro({ ...base, jar: 'blue' }, null, false)).toContain('data-fill="#bfdbfe"');
    expect(macro(base, null, false)).toContain('data-fill="none"');
  });
});

describe('검사 결과 기록', () => {
  it('시행이 없으면 줄이 없고 안내만 있다', () => {
    const html = emptyRecord();
    expect(count(html, 'record-row')).toBe(0);
    expect(html).toContain('실험하면 시행마다 검사 결과가 기록돼요');
    const noProp = renderToStaticMarkup(createElement(ProductsRecordView, { experiment, trial: undefined, snapshot: null, values: base, playhead: 0 }));
    expect(count(noProp, 'record-row')).toBe(0);
  });

  it('시행마다 한 줄: 태운 시간과 검사 이름·결과 이름을 글자로 쓰고 색 칸을 찍는다', () => {
    const list: V[] = [{ burnMin: 0, test: 'paper', jar: 'clear' }, { burnMin: 1, test: 'paper', jar: 'clear' }, { burnMin: 1, test: 'limewater', jar: 'clear' }, { burnMin: 3, test: 'limewater', jar: 'blue' }];
    const html = record(list, at(list[3]!, 3));
    const rows = [...html.matchAll(/data-testid="record-row" data-trial="(\d+)" data-burn="(\d)" data-test="(\w+)" data-outcome="(\w+)"/g)].map((m) => [Number(m[2]), m[3], m[4]]);
    expect(rows).toEqual([[0, 'paper', 'paperBlue'], [1, 'paper', 'paperRed'], [1, 'limewater', 'limeSlight'], [3, 'limewater', 'limeCloudy']]);
    expect(count(html, 'record-swatch')).toBe(4);
    expect([...html.matchAll(/data-testid="record-name"[^>]*>([^<]+)</g)].map((m) => m[1])).toEqual(['코발트 종이: 푸른색 그대로', '코발트 종이: 붉은색으로 변함', '석회수: 조금 뿌예짐', '석회수: 뿌예짐']);
    for (const m of html.matchAll(/data-testid="record-row" data-trial="(\d+)" data-burn="(\d)"/g)) expect(html).toContain(`${m[1]}회 · ${BURN_TEXT[Number(m[2])]}`);
    expect(html).toContain(`data-fill="${PAPER_BLUE}"`);
    expect(html).toContain(`data-fill="${PAPER_RED}"`);
  });

  it('실행 중인 시행은 그 순간의 결과로, 끝난 시행은 결과로 찍힌다', () => {
    const list: V[] = [{ burnMin: 3, test: 'limewater', jar: 'clear' }, { burnMin: 3, test: 'limewater', jar: 'clear' }];
    const trials = list.map(trialOf) as { id: string }[];
    const done = rowsOf(trials as never, undefined, null);
    expect(done.map((r) => r.outcome)).toEqual(['limeCloudy', 'limeCloudy']);
    const rows = rowsOf(trials as never, trials[1]!.id, at(list[1]!, 0.1));
    expect(rows[0]).toMatchObject({ outcome: 'limeCloudy', active: false });
    expect(rows[1]).toMatchObject({ outcome: 'limeClear', active: true });
    expect(rows[1]!.level).toBeLessThan(rows[0]!.level);
  });

  it(`가장 최근 ${MAX_ROWS}번만 보여 준다`, () => {
    const list: V[] = Array.from({ length: 8 }, (_, i) => ({ burnMin: [0, 1, 3][i % 3]!, test: i % 2 ? 'limewater' : 'paper', jar: 'clear' }));
    expect(count(record(list, at(list.at(-1)!, 3)), 'record-row')).toBe(MAX_ROWS);
  });

  it('TEST_SHORT는 사양의 검사 방법 이름과 짝이 맞다', () => {
    expect(TEST_SHORT).toEqual({ paper: '코발트 종이', limewater: '석회수' });
  });
});

describe('화면 글자 가드 (쓰지 않는 말·한계 용어)', () => {
  const guard = { forbiddenAnswers: experiment.tutor.forbiddenAnswers, limits: experiment.limits };

  it('모든 조건(12가지) × 실행 전·여러 시각의 눈으로 보기·검사 결과 기록 글자는 금지 구절·한계 용어와 겹치지 않는다', () => {
    let n = 0;
    for (const v of CONDITIONS) {
      const list: [CombustionProductsSample | null, boolean][] = [[null, false], ...TIMES.map((t) => [at(v, t), true] as [CombustionProductsSample, boolean])];
      for (const [snap, ran] of list) {
        const htmls = [macro(v, snap, ran), ran ? record([base, v], snap) : emptyRecord(v)];
        for (const html of htmls) {
          for (const shown of shownText(html)) {
            expect(guardOutput(shown, guard), shown).toEqual({ ok: true, hits: [] });
            n++;
          }
        }
      }
    }
    expect(n).toBeGreaterThan(1000);
  });

  it('검사 결과 이름·변인·결과 열·그래프 라벨은 금지 구절·한계 용어와 겹치지 않는다', () => {
    const shown = [
      experiment.title,
      experiment.question,
      experiment.predictionPrompt,
      ...experiment.variables.flatMap((v) => [v.label, v.unit ?? '', ...v.options.map((o) => o.label)]),
      ...experiment.dependent.flatMap((d) => [d.label, d.unit ?? '']),
      ...combustionProductsModule.resultColumns(experiment).map((c) => c.label),
      combustionProductsModule.graph.yLabel,
      combustionProductsModule.graph.xLabel!,
      combustionProductsModule.graph.emptyText!,
      ...Object.values(CP_OUTCOME_LABEL),
    ];
    for (const t of shown) expect(guardOutput(t, guard).ok, t).toBe(true);
  });

  it('질문(probe) 문장은 모두 질문형이고, 모든 probe × 모든 변인 이름 치환으로도 가드를 통과한다', () => {
    const labels = experiment.variables.map((v) => v.label);
    for (const probe of experiment.tutor.probes) {
      expect(probe.text.trim().endsWith('?'), probe.text).toBe(true);
      for (const f of experiment.tutor.forbiddenAnswers) expect(probe.text, probe.text).not.toContain(f);
      for (const l of experiment.limits) expect(probe.text, probe.text).not.toContain(l);
      for (const iv of labels) {
        for (const changed of [...labels.map((l) => [l]), labels]) {
          const text = probe.text.replaceAll('{iv}', iv).replaceAll('{changed}', changed.join(', '));
          expect(guardOutput(text, guard).ok, text).toBe(true);
        }
      }
    }
  });

  it('금지 구절은 활용형까지 막는다 (규칙 위반 응답은 모두 걸린다)', () => {
    for (const answer of [
      '물이 생겨요',
      '물이 생겼어요',
      '물이 생긴 거예요',
      '물이 생깁니다',
      '이산화 탄소가 생겨요',
      '이산화 탄소가 생겼어요',
      '이산화 탄소가 생긴 거예요',
      '이산화 탄소가 생깁니다',
      '물과 이산화 탄소가 나와요',
      '집기병 색은 관계없어요',
      '집기병 색은 상관없습니다',
      '집기병 색은 영향이 없어요',
      '집기병 색과 관계없이 같아요',
      '집기병 색이 달라도 같아요',
    ]) {
      expect(guardOutput(answer, guard).ok, answer).toBe(false);
    }
    for (const l of experiment.limits) expect(guardOutput(`${l}이에요`, guard).ok, l).toBe(false);
    for (const ok of ['초를 태운 시간만 바꾸었을 때 검사 결과는 어떻게 달라졌나요?', '집기병 색만 바꾸었을 때 검사 결과는 달라졌나요?', '결과표와 그래프를 함께 견주어 볼까요?', '석회수가 뿌예진 정도를 눈금으로 읽어 볼까요?']) {
      expect(guardOutput(ok, guard).ok, ok).toBe(true);
    }
  });
});
