import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { tideHeight } from '@sci/engine-earth';
import { parseManifest, type ObservationExperiment } from '@sci/schema';
import { FALLBACK_PROBE, guardOutput, renderAndGuard } from '@sci/tutor';
import seaJson from '../../../../../content/units/g3-earth-sea/manifest.json';
import nightJson from '../../../../../content/units/g4-night-sky/manifest.json';
import earthJson from '../../../../../content/units/g6-earth-motion/manifest.json';
import { FEEDBACK_IDLE, FEEDBACK_MATCH, FEEDBACK_MISMATCH } from './feedback';
import { formatHour, modelAnswer } from './model';
import { TideGraphView, TideShoreView } from './TideView';
import { heightText, isTideView, tideScene } from './tideModel';
import { isNightView } from './nightModel';
import {
  canRecord,
  createInitialState,
  current,
  feedbackKind,
  predict,
  record,
  recordMatchesModel,
  select,
  setDay,
  setHour,
  setMonth,
  tutorSituation,
} from './observeStore';

const manifest = parseManifest(seaJson);
const exp = manifest.experiments[1] as ObservationExperiment;
const guard = { forbiddenAnswers: exp.tutor.forbiddenAnswers, limits: exp.limits };
const task = (id: string) => exp.tasks.find((t) => t.id === id)!;
const fresh = () => createInitialState(exp);
const start = (id: string, prediction: string) => predict(select(fresh(), exp, id), exp, prediction);
const hours = Array.from({ length: 49 }, (_, i) => i / 2);
const NAMES = ['밀물', '썰물'];

describe('밀물과 썰물 관찰: 매니페스트', () => {
  it('성취기준은 4과06-01·4과06-02·4과06-03이고, 활동 2는 관찰 활동 tide이며 과제 둘이 tide 보기다', () => {
    expect(manifest.standards).toEqual(['4과06-01', '4과06-02', '4과06-03']);
    expect(manifest.experiments.map((e) => e.id)).toEqual(['sea-water', 'tide', 'land-sea-dots']);
    expect(exp.tasks.map((t) => t.id)).toEqual(['tide-count', 'tide-flat']);
    expect(exp.tasks.every((t) => isTideView(t) && !isNightView(t))).toBe(true);
    expect(modelAnswer(exp, task('tide-count'), {})).toBe('2');
    expect(modelAnswer(exp, task('tide-flat'), {})).toBe('mudflat');
  });

  it('활동 1(바닷물과 강물 비교하기)의 내용은 바뀌지 않았다: 변인 3개, 한계 용어 7개', () => {
    const e1 = manifest.experiments[0]!;
    expect(e1.id).toBe('sea-water');
    expect('variables' in e1 && e1.variables.map((v) => v.key)).toEqual(['water', 'volumeMl', 'dish']);
    expect(e1.limits).toEqual(['염분', '염화 나트륨', '용질', '용매', '농도', '밀도', '퍼밀']);
  });

  it('기존 관찰 단원(밤하늘, 지구의 운동)에는 tide 보기가 없다', () => {
    for (const j of [nightJson, earthJson]) {
      const o = parseManifest(j).experiments[0] as ObservationExperiment;
      expect(o.tasks.some(isTideView)).toBe(false);
    }
  });

  it('금지 구절(활용형 포함)과 한계 용어를 가드가 막는다', () => {
    const blocked = [
      '하루에 두 번 들어와요',
      '하루에 두 번씩이에요',
      '하루 두 번이에요',
      '두 번씩 들어오는 거예요',
      '두 번씩 들어와요',
      '갯벌이 드러나요',
      '갯벌이 드러납니다',
      '갯벌이 드러난 모습이에요',
      '갯벌이 나타나요',
      '갯벌이 나타납니다',
      '밀물은 바닷물이 들어오는 때예요',
      '밀물은 바닷물이 들어옵니다',
      '썰물은 바닷물이 빠져나가는 때예요',
      '썰물은 바닷물이 빠져나갑니다',
    ];
    for (const b of blocked) expect(guardOutput(b, guard).ok, b).toBe(false);
    for (const l of ['조석', '만조', '간조', '조차', '기조력', '인력', '반일주조']) expect(guardOutput(`${l}이에요`, guard).ok, l).toBe(false);
  });

  it('모든 probe는 질문이고 가드를 통과하며, record-match에서 갯벌의 가치를 열어 두는 질문을 한다', () => {
    for (const t of exp.tasks) {
      for (const p of t.probes) {
        expect(p.text.trim().endsWith('?'), `${t.id}/${p.when}`).toBe(true);
        const g = guardOutput(p.text, guard);
        expect(g.ok, `${t.id}/${p.when}: ${g.hits}`).toBe(true);
      }
    }
    const last = task('tide-flat').probes.find((p) => p.when === 'record-match')!.text;
    expect(last).toContain('생물');
    expect(last).toContain('갯벌이 사라지면');
  });
});

describe('밀물과 썰물 관찰: 저장소', () => {
  it('처음 시각은 오전 2시이고, 예측 전에는 바뀌지 않으며, 0~24시를 30분 단위로 오간다', () => {
    expect(fresh().tasks['tide-count']!.hour).toBe(2);
    const sel = select(fresh(), exp, 'tide-count');
    expect(sel.trail).toEqual([2]);
    expect(setHour(sel, exp, 8)).toBe(sel);
    const s = predict(sel, exp, '1');
    expect(canRecord(s, exp)).toBe(false);
    expect(setHour(s, exp, 2)).toBe(s);
    expect(setHour(s, exp, Number.NaN)).toBe(s);
    expect(current(setHour(s, exp, 99), exp).ts.hour).toBe(24);
    expect(current(setHour(s, exp, -3), exp).ts.hour).toBe(0);
    expect(current(setHour(s, exp, 8.3), exp).ts.hour).toBe(8.5);
    expect(canRecord(setHour(s, exp, 8), exp)).toBe(true);
  });

  it('지나온 시각은 건너뛴 30분 칸도 모아 하루 그래프의 점이 되고, 과제를 바꾸면 지운다', () => {
    const s = setHour(start('tide-count', '2'), exp, 4);
    expect(s.trail).toEqual([2, 2.5, 3, 3.5, 4]);
    expect(setHour(s, exp, 3).trail).toEqual([2, 2.5, 3, 3.5, 4]);
    const other = select(s, exp, 'tide-flat');
    expect(other.trail).toEqual([2]);
    // 돌아오면 그 과제의 시각(4시)에서 새로 모은다.
    expect(select(other, exp, 'tide-count').trail).toEqual([4]);
  });

  it('tide 보기에서는 날짜·달 슬라이더가 동작하지 않는다', () => {
    const s = start('tide-flat', 'mudflat');
    expect(setDay(s, exp, 10)).toBe(s);
    expect(setMonth(s, exp, 9)).toBe(s);
  });

  it('기록과 튜터 상황: 맞게 기록해야 이름이 열리고 피드백이 바뀐다', () => {
    const s = setHour(start('tide-count', '1'), exp, 8);
    expect(tutorSituation(s, exp)).toBe('observing');
    const wrong = record(s, exp, '4');
    expect(recordMatchesModel(exp, task('tide-count'), current(wrong, exp).ts)).toBe(false);
    expect(feedbackKind(wrong, exp)).toBe('mismatch');
    expect(tutorSituation(wrong, exp)).toBe('record-mismatch');
    const right = record(s, exp, '2');
    expect(recordMatchesModel(exp, task('tide-count'), current(right, exp).ts)).toBe(true);
    expect(feedbackKind(right, exp)).toBe('match');
    expect(tutorSituation(right, exp)).toBe('prediction-mismatch');
    const flat = record(setHour(start('tide-flat', 'mudflat'), exp, 8), exp, 'mudflat');
    expect(tutorSituation(flat, exp)).toBe('record-match');
    expect(feedbackKind(record(setHour(start('tide-flat', 'mudflat'), exp, 8), exp, 'desert'), exp)).toBe('mismatch');
  });

  it('두 과제의 모든 예측·기록 상황에서 튜터 문장이 가드를 통과하고 폴백이 아니다', () => {
    for (const t of exp.tasks) {
      for (const pred of t.options) {
        for (const rec of t.options) {
          let s = predict(select(fresh(), exp, t.id), exp, pred.value);
          for (const when of ['before', 'observing', 'recorded']) {
            if (when === 'observing') s = setHour(s, exp, 8);
            if (when === 'recorded') s = record(s, exp, rec.value);
            const text = renderAndGuard(tutorSituation(s, exp), {}, t.probes, guard);
            expect(text, `${t.id}/${pred.value}/${rec.value}/${when}`).not.toBe(FALLBACK_PROBE);
            expect(guardOutput(text, guard).ok, text).toBe(true);
          }
        }
      }
    }
    for (const f of [FEEDBACK_IDLE, FEEDBACK_MATCH, FEEDBACK_MISMATCH]) expect(guardOutput(f, guard).ok, f).toBe(true);
  });
});

describe('밀물과 썰물 관찰: 값과 화면', () => {
  it('높이 표시는 소수 첫째 자리이고 음수는 −로 쓴다', () => {
    expect(heightText(3.5)).toBe('3.5');
    expect(heightText(-3.4999)).toBe('−3.5');
    expect(heightText(0.04)).toBe('0.0');
    expect(tideScene(8, []).heightLabel).toBe('−3.5');
    expect(tideScene(2, []).heightLabel).toBe('3.5');
  });

  const shore = (h: number, trail: number[] = [h]) => renderToStaticMarkup(createElement(TideShoreView, { scene: tideScene(h, trail) }));
  const graph = (h: number, trail: number[] = [h]) => renderToStaticMarkup(createElement(TideGraphView, { scene: tideScene(h, trail) }));
  const num = (html: string, name: string) => Number(new RegExp(`${name}="(-?[\\d.]+)"`).exec(html)![1]);
  const count = (html: string, id: string) => (html.match(new RegExp(`data-testid="${id}"`, 'g')) ?? []).length;

  it('2시에서 8시로 가면 바닷물 선이 내려가고(y가 커짐) 갯벌이 드러나며 생물 아이콘이 나온다', () => {
    const a = shore(2);
    const b = shore(8);
    expect(num(b, 'data-y')).toBeGreaterThan(num(a, 'data-y') + 100);
    expect(num(a, 'data-height')).toBeCloseTo(3.5, 1);
    expect(num(b, 'data-height')).toBeCloseTo(-3.5, 1);
    expect(a).toContain('data-exposed="false"');
    expect(a).toContain('data-rocks-submerged="true"');
    expect(b).toContain('data-exposed="true"');
    expect(b).toContain('data-rocks-submerged="false"');
    expect(count(a, 'tide-life')).toBe(0);
    expect(count(b, 'tide-life')).toBe(4);
    // 높이를 정할 때 쓰는 기준: 가운데 높이 0 m 근처에서는 갯벌이 잠겨 있다.
    expect(shore(5)).toContain('data-exposed="false"');
  });

  it('바닷가 그림의 글자: 육지, 갯벌, 바다, 바닷물 높이, 시각, 눈금', () => {
    const html = shore(8);
    for (const t of ['>육지<', '>갯벌<', '>바다<', '>바닷물 높이<', '>오전 8시<', '>m<', '>3<', '>0<', '>−3<']) expect(html, t).toContain(t);
  });

  it('하루 그래프: 지나온 시각만큼 점이 있고 지금 자리를 표시한다', () => {
    const html = graph(4, [2, 2.5, 3, 3.5, 4]);
    expect(count(html, 'tide-graph-dot')).toBe(5);
    expect(num(html, 'data-hour')).toBe(4);
    expect(html).toContain(`data-height="${tideHeight(4).toFixed(2)}"`);
    for (const t of ['>높이(m)<', '>시각(시)<', '>0<', '>6<', '>12<', '>18<', '>24<']) expect(html, t).toContain(t);
  });

  it('어느 시각에도 그림·문구에 "밀물"·"썰물"이 없고, 모든 화면 문구가 가드를 통과한다(기록 전)', () => {
    for (const h of hours) {
      const sc = tideScene(h, [h]);
      const texts = [sc.caption, sc.aria, sc.graphCaption, sc.graphAria, shore(h), graph(h), formatHour(h)];
      for (const text of texts) {
        for (const n of NAMES) expect(text, `${formatHour(h)} "${n}"`).not.toContain(n);
        const g = guardOutput(text, guard);
        expect(g.ok, `${formatHour(h)}: ${g.hits}`).toBe(true);
      }
    }
  });

  it('이름 문구(기록을 맞게 한 뒤에만 보임)는 오르는 중이면 밀물, 내리는 중이면 썰물이고 가드를 통과한다', () => {
    expect(tideScene(5, []).stateNote).toBe('지금은: 썰물(바닷물이 빠져나가는 중)');
    expect(tideScene(11, []).stateNote).toBe('지금은: 밀물(바닷물이 들어오는 중)');
    for (const h of hours) {
      const g = guardOutput(tideScene(h, []).stateNote, guard);
      expect(g.ok, `${formatHour(h)}: ${g.hits}`).toBe(true);
    }
  });

  it('활동 1(바닷물과 강물 비교하기)의 화면 문구는 활동 2의 금지 구절·한계 용어와 상관없이 따로 검사된다(활동 2 가드는 활동 1 문구를 막지 않는다)', () => {
    expect(guardOutput('알코올램프로 증발 접시를 가열해요', guard).ok).toBe(true);
  });
});
