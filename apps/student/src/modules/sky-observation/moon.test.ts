import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MOON_SHAPE_NAMES, moonDay } from '@sci/engine-earth';
import { parseManifest, type ObservationExperiment } from '@sci/schema';
import { FALLBACK_PROBE, guardOutput, renderAndGuard } from '@sci/tutor';
import earthJson from '../../../../../content/units/g6-earth-motion/manifest.json';
import nightJson from '../../../../../content/units/g4-night-sky/manifest.json';
import { FEEDBACK_IDLE, FEEDBACK_MATCH, FEEDBACK_MISMATCH } from './feedback';
import { modelAnswer } from './model';
import { MoonGroundView, MoonSpaceView } from './MoonView';
import { MOON_DAY_DEFAULT, MOON_HIDDEN_NOTE, litWidth, moonLitPath, moonScene } from './moonModel';
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

const exp = parseManifest(nightJson).experiments[0] as ObservationExperiment;
const guard = { forbiddenAnswers: exp.tutor.forbiddenAnswers, limits: exp.limits };
const task = (id: string) => exp.tasks.find((t) => t.id === id)!;
const fresh = () => createInitialState(exp);
const start = (id: string, prediction: string) => predict(select(fresh(), exp, id), exp, prediction);
const days = Array.from({ length: 29 }, (_, i) => i + 1);
const hash = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);
const shapeNames = Object.values(MOON_SHAPE_NAMES);

describe('달 모양 과제: 매니페스트', () => {
  it('달 과제 둘은 4학년 밤하늘 관찰 과제 4개 뒤에 덧붙었고, 앞 네 과제·금지 구절·limits는 한 글자도 바뀌지 않았다', () => {
    expect(exp.tasks.map((t) => t.id)).toEqual(['planet-size', 'planet-distance', 'find-polaris', 'polaris-still', 'moon-change', 'full-moon']);
    // 이 해시는 달 과제를 옮겨 오기 전 g4-night-sky의 tasks·금지 구절·limits를 JSON.stringify한 값이다.
    const raw = nightJson.experiments[0]!;
    expect(hash(raw.tasks.slice(0, 4))).toBe('bd33272858035ec1');
    expect(hash(raw.tutor.forbiddenAnswers.slice(0, 21))).toBe('6c9708490aa0ad86');
    expect(hash(raw.limits.slice(0, 7))).toBe('f78801f1574303cb');
    expect(raw.tutor.forbiddenAnswers).toHaveLength(37);
    expect(exp.limits.slice(7)).toEqual(['위상', '이각', '삭망월', '황도']);
    expect(exp.params).toEqual({ latDeg: 37.5 });
    expect(parseManifest(nightJson).standards).toEqual(['4과13-01', '4과13-02', '4과13-03']);
  });

  it('6학년 지구의 운동 매니페스트는 달 과제를 넣기 전과 같다(성취기준만 다르다)', () => {
    const g6 = parseManifest(earthJson);
    expect(g6.standards).toEqual(['6과12-01', '6과12-02', '6과12-03']);
    // 달 과제를 넣기 전(1a9a9fb^)의 매니페스트에서 standards만 현재 값으로 바꾼 것과 같다. 그 값(["6과12-01"])으로 되돌려 해시를 잰다.
    expect(hash({ ...earthJson, standards: ['6과12-01'] })).toBe('6ba836217f7e3636');
    const g6exp = g6.experiments[0] as ObservationExperiment;
    expect(g6exp.tasks.map((t) => t.view)).toEqual(['rotation', 'rotation', 'rotation', 'revolution', 'revolution']);
    expect(g6exp.tasks.some((t) => t.view === 'moon')).toBe(false);
    expect(g6exp.limits).not.toContain('위상');
  });

  it('4학년 기존 과제 4개의 보기 종류는 그대로이고, 달 과제 둘이 맨 뒤다', () => {
    expect(exp.tasks.map((t) => t.view)).toEqual(['solar-system', 'solar-system', 'north-sky', 'north-sky', 'moon', 'moon']);
    expect(exp.tasks.slice(0, 4).every(isNightView)).toBe(true);
    expect(exp.tasks.slice(4).every((t) => t.view === 'moon' && !isNightView(t))).toBe(true);
  });

  it('과제 모델 결과는 선택지 안에 있다: waxes-east, 15', () => {
    expect(modelAnswer(exp, task('moon-change'), {})).toBe('waxes-east');
    expect(modelAnswer(exp, task('full-moon'), {})).toBe('15');
    expect(task('moon-change').options.map((o) => o.value)).toEqual(['waxes-east', 'wanes-west', 'same']);
    expect(task('full-moon').options.map((o) => o.value)).toEqual(['3', '8', '15', '22']);
  });

  it('4학년 단원의 달 모델 값은 기준값 표(g6-moon-phase-ext.md §1)와 같다(서울 37.5°, 저녁 7시)', () => {
    const table: [number, number, number, number, number][] = [
      [1, 12.2, 0.011, -2.2, 271.7],
      [3, 36.6, 0.098, 17.0, 256.5],
      [8, 97.5, 0.566, 51.9, 192.2],
      [10, 121.9, 0.764, 49.4, 153.5],
      [15, 182.9, 0.999, 9.6, 97.5],
      [22, 268.2, 0.516, -49.4, 26.4],
    ];
    for (const [d, phi, frac, alt, az] of table) {
      const m = moonScene(exp, d);
      expect(m.phiDeg, `${d}일 φ`).toBeCloseTo(phi, 0);
      expect(m.frac, `${d}일 frac`).toBeCloseTo(frac, 2);
      expect(Math.abs(m.pos.altDeg - alt), `${d}일 고도`).toBeLessThanOrEqual(0.2);
      expect(Math.abs(m.pos.azDeg - az), `${d}일 방위각`).toBeLessThanOrEqual(0.2);
    }
  });

  it('금지 구절 활용형도 막는다', () => {
    const blocked = [
      '달이 점점 차올라요',
      '점점 차오르면서 보여요',
      '점점 차오른다고 해요',
      '차오르면서 동쪽으로 가요',
      '보름달은 음력 15일 무렵이에요',
      '15일 무렵에 보름달이 떠요',
      '달이 동쪽으로 옮겨 가요',
      '동쪽으로 옮겨 갑니다',
      '달은 스스로 빛을 내지 않아요',
      '달은 햇빛을 받는 부분이 밝아요',
    ];
    for (const b of blocked) expect(guardOutput(b, guard).ok, b).toBe(false);
    for (const l of ['위상', '이각', '삭망월', '황도']) expect(guardOutput(`${l}이에요`, guard).ok, l).toBe(false);
  });
});

describe('달 모양 과제: 저장소', () => {
  it('음력 날짜 처음 값은 3일이고, 예측 전에는 바뀌지 않으며, 범위는 1~29일이다', () => {
    expect(fresh().tasks['moon-change']!.day).toBe(MOON_DAY_DEFAULT);
    const sel = select(fresh(), exp, 'moon-change');
    expect(setDay(sel, exp, 10)).toBe(sel);
    const s = predict(sel, exp, 'waxes-east');
    expect(canRecord(s, exp)).toBe(false);
    expect(current(setDay(s, exp, 99), exp).ts.day).toBe(29);
    expect(current(setDay(s, exp, -4), exp).ts.day).toBe(1);
    expect(current(setDay(s, exp, 9.6), exp).ts.day).toBe(10);
    expect(setDay(s, exp, 3)).toBe(s);
    expect(setDay(s, exp, Number.NaN)).toBe(s);
    expect(canRecord(setDay(s, exp, 10), exp)).toBe(true);
  });

  it('다른 보기에서는 날짜를 바꿀 수 없고, 달 보기에서는 시각·달 슬라이더가 동작하지 않는다', () => {
    const sun = predict(select(fresh(), exp, 'sun-path'), exp, 'still');
    expect(setDay(sun, exp, 10)).toBe(sun);
    const moon = start('moon-change', 'same');
    expect(setHour(moon, exp, 9)).toBe(moon);
    expect(setMonth(moon, exp, 9)).toBe(moon);
    expect(moon.trail).toEqual([]);
  });

  it('기록과 튜터 상황: 맞게 기록해야 모양 이름이 열리고 피드백이 바뀐다', () => {
    let s = setDay(start('moon-change', 'same'), exp, 10);
    expect(tutorSituation(s, exp)).toBe('observing');
    const wrong = record(s, exp, 'same');
    expect(recordMatchesModel(exp, task('moon-change'), current(wrong, exp).ts)).toBe(false);
    expect(feedbackKind(wrong, exp)).toBe('mismatch');
    expect(tutorSituation(wrong, exp)).toBe('record-mismatch');
    s = record(s, exp, 'waxes-east');
    expect(recordMatchesModel(exp, task('moon-change'), current(s, exp).ts)).toBe(true);
    expect(tutorSituation(s, exp)).toBe('prediction-mismatch');
    const full = record(setDay(start('full-moon', '15'), exp, 15), exp, '15');
    expect(feedbackKind(full, exp)).toBe('match');
    expect(tutorSituation(full, exp)).toBe('record-match');
    expect(feedbackKind(record(setDay(start('full-moon', '15'), exp, 15), exp, '3'), exp)).toBe('mismatch');
  });

  it('두 과제의 모든 예측·기록 상황에서 튜터 문장이 가드를 통과하고 폴백이 아니다', () => {
    for (const t of exp.tasks.slice(4)) {
      for (const pred of t.options) {
        for (const rec of t.options) {
          let s = predict(select(fresh(), exp, t.id), exp, pred.value);
          for (const when of ['before', 'observing', 'recorded']) {
            if (when === 'observing') s = setDay(s, exp, 10);
            if (when === 'recorded') s = record(s, exp, rec.value);
            const text = renderAndGuard(tutorSituation(s, exp), {}, t.probes, guard);
            expect(text, `${t.id}/${pred.value}/${rec.value}/${when}`).not.toBe(FALLBACK_PROBE);
            expect(guardOutput(text, guard).ok).toBe(true);
          }
        }
      }
    }
    for (const f of [FEEDBACK_IDLE, FEEDBACK_MATCH, FEEDBACK_MISMATCH]) expect(guardOutput(f, guard).ok, f).toBe(true);
  });
});

describe('달 모양 보기: 값과 모양', () => {
  it('3일은 오른쪽(서쪽)이 밝고 10일은 더 넓게 밝으며 더 동쪽(왼쪽)에 있다', () => {
    const a = moonScene(exp, 3);
    const b = moonScene(exp, 10);
    expect([a.litSide, a.waxing, a.visible, a.percent, a.side]).toEqual(['오른쪽', true, true, 10, '서쪽']);
    expect([b.litSide, b.waxing, b.percent]).toEqual(['오른쪽', true, 76]);
    expect(b.frac).toBeGreaterThan(a.frac);
    expect(b.pos.azDeg).toBeLessThan(a.pos.azDeg);
    expect(moonScene(exp, 20).litSide).toBe('왼쪽');
  });

  it('모양 경로: 오른쪽이 밝으면 위→아래 바깥 호가 오른쪽(sweep 1), 왼쪽이 밝으면 왼쪽(sweep 0)', () => {
    const arcs = (p: string) => [...p.matchAll(/A([\d.]+),([\d.]+) 0 0 (\d)/g)].map((m) => ({ rx: Number(m[1]), ry: Number(m[2]), sweep: m[3] }));
    const crescentR = arcs(moonLitPath(100, 100, 20, 0.1, true));
    expect(crescentR[0]).toMatchObject({ rx: 20, sweep: '1' });
    expect(crescentR[1]).toMatchObject({ sweep: '0' }); // 초승: 경계가 밝은 쪽 안으로 휜다
    expect(crescentR[1]!.rx).toBeCloseTo(20 * 0.8, 1);
    const gibbousR = arcs(moonLitPath(100, 100, 20, 0.9, true));
    expect(gibbousR[1]).toMatchObject({ sweep: '1' }); // 보름에 가까움: 경계가 어두운 쪽으로 불룩
    const crescentL = arcs(moonLitPath(100, 100, 20, 0.1, false));
    expect(crescentL[0]).toMatchObject({ sweep: '0' });
    expect(crescentL[1]).toMatchObject({ sweep: '1' });
    expect(arcs(moonLitPath(100, 100, 20, 0.5, true))[1]!.rx).toBeLessThan(0.1);
    expect(litWidth(24, 0.5)).toBe(24);
  });
});

describe('달 모양 보기: 화면', () => {
  const ground = (d: number) => renderToStaticMarkup(createElement(MoonGroundView, { scene: moonScene(exp, d) }));
  const space = (d: number) => renderToStaticMarkup(createElement(MoonSpaceView, { scene: moonScene(exp, d) }));
  const attr = (html: string, name: string) => Number(new RegExp(`${name}="([\\d.-]+)"`).exec(html)![1]);

  it('땅에서 보기: 10일 달은 3일 달보다 왼쪽(동쪽)에 있고 밝은 부분이 넓다', () => {
    const g3 = ground(3);
    const g10 = ground(10);
    expect(attr(g10, 'cx')).toBeLessThan(attr(g3, 'cx'));
    expect(attr(g10, 'data-lit-width')).toBeGreaterThan(attr(g3, 'data-lit-width'));
    expect(g3).toContain('data-waxing="true"');
    expect(ground(20)).not.toContain('data-testid="moon-ground"');
    for (const t of ['>동<', '>남<', '>서<', '>달<', '>음력 3일<']) expect(g3, t).toContain(t);
  });

  it('보이지 않는 날(1, 18, 22, 26)에는 달을 그리지 않고 "보이지 않아요" 문구를 띄운다', () => {
    for (const d of [1, 18, 22, 26]) {
      const html = ground(d);
      expect(html, `${d}일`).not.toContain('data-testid="moon-disc"');
      expect(html).toContain(`>${MOON_HIDDEN_NOTE}<`);
      expect(moonScene(exp, d).groundCaption).toContain('보이지 않아요');
    }
    expect(ground(8)).not.toContain(MOON_HIDDEN_NOTE);
  });

  it('우주에서 보기: 달은 언제나 태양 쪽(왼쪽) 반이 밝고, 라벨이 있다', () => {
    for (const d of days) {
      const html = space(d);
      expect(html, `${d}일`).toContain('data-lit-side="sun"');
      for (const t of ['>태양<', '>지구<', '>달<', `>음력 ${d}일<`]) expect(html, `${d}일 ${t}`).toContain(t);
    }
    // 1일 달은 태양 가까이(왼쪽), 15일 달은 지구 건너편(오른쪽).
    const cxOf = (d: number) => attr(space(d).slice(space(d).indexOf('moon-space"')), 'cx');
    expect(cxOf(1)).toBeLessThan(cxOf(8));
    expect(cxOf(15)).toBeGreaterThan(cxOf(8));
  });

  it('어느 날 어느 화면에도 모양 이름이 없고, 모든 화면 문구가 튜터 가드를 통과한다', () => {
    for (const d of days) {
      const sc = moonScene(exp, d);
      const texts = [sc.groundCaption, sc.spaceCaption, sc.groundAria, sc.spaceAria, sc.hiddenNote, ground(d), space(d)];
      for (const text of texts) {
        for (const n of shapeNames) expect(text, `${d}일 "${n}"`).not.toContain(n);
        for (const n of ['초승', '상현', '하현', '그믐', '보름', '삭 무렵']) expect(text, `${d}일 "${n}"`).not.toContain(n);
        expect(guardOutput(text, guard).ok, `${d}일: ${guardOutput(text, guard).hits}`).toBe(true);
      }
    }
  });

  it('모양 이름은 모델 값이다(기록 뒤에만 화면이 쓴다): 3일 초승달, 15일 보름달', () => {
    expect(moonScene(exp, 3).shapeName).toBe('초승달');
    expect(moonScene(exp, 15).shapeName).toBe('보름달');
    expect(moonScene(exp, 10).shapeName).toBe(moonDay(10).shapeName);
  });
});
