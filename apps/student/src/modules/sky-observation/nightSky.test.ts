import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NARROW, NorthSkyView, WIDE, northLabels } from './NorthSkyView';
import type { Box } from './labelLayout';
import { STAR_TASK_DAY, northStar, starPosition } from '@sci/engine-earth';
import { parseManifest, type ObservationExperiment } from '@sci/schema';
import { FALLBACK_PROBE, guardOutput, renderAndGuard } from '@sci/tutor';
import earthJson from '../../../../../content/units/g6-earth-motion/manifest.json';
import nightJson from '../../../../../content/units/g4-night-sky/manifest.json';
import { FEEDBACK_IDLE, FEEDBACK_MATCH, FEEDBACK_MISMATCH } from './feedback';
import { defaultHour, groundScene, modelAnswer } from './model';
import { NORTH_HOUR_DEFAULT, NORTH_HOUR_MAX, NORTH_HOUR_MIN, azOffset, compareOf, isNightView, nightLabel, northScene, solarScene } from './nightModel';
import {
  canRecord,
  createInitialState,
  current,
  feedbackKind,
  predict,
  record,
  recordMatchesModel,
  select,
  setControl,
  setHour,
  setMonth,
  setSkyToggle,
  touchView,
  tutorSituation,
} from './observeStore';

const exp = parseManifest(nightJson).experiments[0] as ObservationExperiment;
const g6 = parseManifest(earthJson).experiments[0] as ObservationExperiment;
const guard = { forbiddenAnswers: exp.tutor.forbiddenAnswers, limits: exp.limits };
const fresh = () => createInitialState(exp);
const task = (id: string) => exp.tasks.find((t) => t.id === id)!;
const start = (id: string, prediction: string) => predict(select(fresh(), exp, id), exp, prediction);

describe('밤하늘 관찰: 모델 정답과 매니페스트', () => {
  it('과제별 모델 결과는 문자열이고 선택지 안에 있다', () => {
    expect(modelAnswer(exp, task('planet-size'), { compare: 'size' })).toBe('11');
    expect(modelAnswer(exp, task('planet-size'), { compare: 'distance' })).toBe('11');
    expect(modelAnswer(exp, task('planet-distance'), { compare: 'distance' })).toBe('30');
    expect(modelAnswer(exp, task('find-polaris'), {})).toBe('polaris');
    expect(modelAnswer(exp, task('polaris-still'), { rotation: 'forward' })).toBe('nearly-still');
    expect(modelAnswer(exp, task('polaris-still'), { rotation: 'reverse' })).toBe('nearly-still');
    for (const t of exp.tasks) {
      expect(t.options.map((o) => o.value)).toContain(modelAnswer(exp, t, {}));
    }
  });

  it('새 보기를 쓰는 과제는 네 개 모두이고, 지구의 운동 과제는 하나도 새 보기가 아니다', () => {
    expect(exp.tasks.every(isNightView)).toBe(true);
    expect(g6.tasks.some(isNightView)).toBe(false);
    expect(g6.tasks.slice(0, 5).map((t) => t.view)).toEqual(['rotation', 'rotation', 'rotation', 'revolution', 'revolution']);
  });
});

describe('밤하늘 관찰: 저장소', () => {
  it('처음 값: 북쪽 하늘 과제는 밤 9시, 태양계 과제의 조작 기본값은 매니페스트를 따른다', () => {
    expect(defaultHour(task('find-polaris'))).toBe(21);
    expect(NORTH_HOUR_DEFAULT).toBe(21);
    const s = fresh();
    expect(s.tasks['planet-size']!.controls).toEqual({ compare: 'size' });
    expect(s.tasks['planet-distance']!.controls).toEqual({ compare: 'distance' });
    expect(s.tasks['polaris-still']!.controls).toEqual({ rotation: 'forward' });
    expect(s.tasks['find-polaris']!.hour).toBe(21);
    expect(s.tasks['find-polaris']!.guide).toBe(false);
    expect(s.tasks['find-polaris']!.trailOn).toBe(false);
  });

  it('예측 전에는 시각·토글·비교 조작이 잠겨 있다', () => {
    const north = select(fresh(), exp, 'find-polaris');
    expect(setHour(north, exp, 24)).toBe(north);
    expect(setSkyToggle(north, exp, 'guide', true)).toBe(north);
    const solar = select(fresh(), exp, 'planet-size');
    expect(setControl(solar, exp, 'compare', 'distance')).toBe(solar);
    expect(touchView(solar, exp)).toBe(solar);
  });

  it('북쪽 하늘 시각은 오후 7시~새벽 3시, 0.5시 단위로 맞춘다', () => {
    const s = start('find-polaris', 'polaris');
    expect(current(setHour(s, exp, 19), exp).ts.hour).toBe(19);
    expect(current(setHour(s, exp, 24), exp).ts.hour).toBe(24);
    expect(current(setHour(s, exp, 27), exp).ts.hour).toBe(27);
    expect(current(setHour(s, exp, 99), exp).ts.hour).toBe(NORTH_HOUR_MAX);
    expect(current(setHour(s, exp, 3), exp).ts.hour).toBe(NORTH_HOUR_MIN);
    expect(current(setHour(s, exp, 22.3), exp).ts.hour).toBe(22.5);
    expect(setHour(s, exp, 21)).toBe(s);
    expect(setHour(s, exp, Number.NaN)).toBe(s);
    expect(setMonth(s, exp, 3)).toBe(s);
  });

  it('별 자취는 시각을 옮긴 사이의 30분 단계를 모두 남기고, 조건이나 과제를 바꾸면 지운다', () => {
    let s = start('polaris-still', 'nearly-still');
    expect(s.trail).toEqual([21]);
    s = setHour(s, exp, 24);
    expect(s.trail).toEqual([21, 21.5, 22, 22.5, 23, 23.5, 24]);
    s = setHour(s, exp, 22);
    expect(s.trail).toEqual([21, 21.5, 22, 22.5, 23, 23.5, 24]);
    s = setControl(s, exp, 'rotation', 'reverse');
    expect(s.trail).toEqual([22]);
    s = select(s, exp, 'find-polaris');
    expect(s.trail).toEqual([21]);
  });

  it('토글(길잡이 선·별 자취)과 비교 버튼은 관찰로 치고, 같은 값을 다시 눌러도 상태를 바꾸지 않는다', () => {
    const n = start('find-polaris', 'polaris');
    expect(canRecord(n, exp)).toBe(false);
    const g = setSkyToggle(n, exp, 'guide', true);
    expect(current(g, exp).ts.guide).toBe(true);
    expect(canRecord(g, exp)).toBe(true);
    expect(setSkyToggle(g, exp, 'guide', true)).toBe(g);
    expect(current(setSkyToggle(g, exp, 'trailOn', true), exp).ts.trailOn).toBe(true);

    const p = start('planet-size', '2');
    expect(canRecord(p, exp)).toBe(false);
    // 이미 고른 "크기 비교"를 다시 눌러도 살펴본 것으로 친다.
    const touched = touchView(p, exp);
    expect(canRecord(touched, exp)).toBe(true);
    expect(touchView(touched, exp)).toBe(touched);
    const toggled = setControl(p, exp, 'compare', 'distance');
    expect(canRecord(toggled, exp)).toBe(true);
    // 다른 보기에서는 토글이 동작하지 않는다.
    expect(setSkyToggle(p, exp, 'guide', true)).toBe(p);
    expect(touchView(start('find-polaris', 'polaris'), exp)).toEqual(start('find-polaris', 'polaris'));
  });

  it('기록과 튜터 상황: 맞으면 record-match, 다르면 record-mismatch, 맞지만 예측과 다르면 prediction-mismatch', () => {
    let s = touchView(start('planet-size', '2'), exp);
    expect(tutorSituation(s, exp)).toBe('observing');
    const wrong = record(s, exp, '2');
    expect(recordMatchesModel(exp, task('planet-size'), current(wrong, exp).ts)).toBe(false);
    expect(feedbackKind(wrong, exp)).toBe('mismatch');
    expect(tutorSituation(wrong, exp)).toBe('record-mismatch');
    s = record(s, exp, '11');
    expect(feedbackKind(s, exp)).toBe('match');
    expect(tutorSituation(s, exp)).toBe('prediction-mismatch');
    const ok = record(touchView(start('planet-size', '11'), exp), exp, '11');
    expect(tutorSituation(ok, exp)).toBe('record-match');
  });

  it('모든 과제·예측·기록 상황에서 튜터 문장이 가드를 통과하고 폴백이 아니며, 피드백도 금지 구절이 없다', () => {
    for (const t of exp.tasks) {
      for (const pred of t.options) {
        for (const rec of t.options) {
          let s = predict(select(fresh(), exp, t.id), exp, pred.value);
          for (const when of ['before', 'observing', 'recorded']) {
            if (when === 'observing') s = t.view === 'north-sky' ? setHour(s, exp, 24) : touchView(s, exp);
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

describe('밤하늘 관찰: 태양계 모형 보기 값', () => {
  const textOf = (answer: Parameters<typeof solarScene>[0], hide: boolean) => {
    const sc = solarScene(answer, hide, 'size');
    return Object.fromEntries(sc.rows.map((r) => [r.key, [r.sizeText, r.distText]]));
  };

  it('크기 과제는 기록 전에 목성 배수만 "?"로 둔다. 다른 행성 숫자와 거리는 그대로 보인다', () => {
    const t = textOf('jupiter-earth-size', true);
    expect(t.jupiter).toEqual(['지구의 약 ?배', '5.2칸']);
    expect(t.saturn![0]).toBe('지구의 약 9.4배');
    expect(t.mercury![0]).toBe('지구의 약 0.4배');
    expect(t.earth![0]).toBe('기준(1배)');
    expect(t.neptune).toEqual(['지구의 약 3.9배', '30칸']);
    const shown = textOf('jupiter-earth-size', false);
    expect(shown.jupiter![0]).toBe('지구의 약 11배');
    expect(solarScene('jupiter-earth-size', true, 'size').sunText).toBe('태양(지구의 약 109배)');
  });

  it('거리 과제는 기록 전에 해왕성의 칸 수만 "?"로 둔다', () => {
    const t = textOf('neptune-distance', true);
    expect(t.neptune).toEqual(['지구의 약 3.9배', '?칸']);
    expect(t.jupiter).toEqual(['지구의 약 11배', '5.2칸']);
    expect(t.uranus![1]).toBe('19칸');
    expect(textOf('neptune-distance', false).neptune![1]).toBe('30칸');
    // 접근성 이름에도 숨긴 숫자가 새지 않는다.
    expect(solarScene('neptune-distance', true, 'distance').ariaLabel).toContain('해왕성 ?칸');
    expect(solarScene('neptune-distance', true, 'distance').ariaLabel).not.toContain('해왕성 30칸');
    expect(solarScene('jupiter-earth-size', true, 'size').ariaLabel).not.toContain('목성 지구의 약 11배');
  });

  it('지구 지름을 10 px로 두면 목성 원은 약 112 px이고 태양 호는 그 109배 축척이다', () => {
    const sc = solarScene('jupiter-earth-size', true, 'size');
    expect(sc.sunPx).toBeCloseTo(1091.8, 1);
    expect(compareOf({ compare: 'distance' })).toBe('distance');
    expect(compareOf({})).toBe('size');
  });
});

describe('밤하늘 관찰: 북쪽 하늘 보기 값', () => {
  const sceneAt = (hour: number, guide = false, trailHours: number[] = [], controls = {}) =>
    northScene(exp, { hour, controls }, trailHours, guide);
  const pos = (sc: ReturnType<typeof sceneAt>, key: string) => sc.stars.find((s) => s.key === key)!.point;

  it('별 16개를 서울 위치로 계산하고 북극성은 북쪽 하늘 위도 높이에 있다', () => {
    const sc = sceneAt(21);
    expect(sc.stars).toHaveLength(16);
    const pol = pos(sc, 'polaris');
    expect(Math.abs(pol.altDeg - 37.5)).toBeLessThan(1);
    expect(Math.abs(azOffset(pol.azDeg))).toBeLessThan(3);
    const s = northStar('dubhe');
    const direct = starPosition({ raHours: s.ra, decDeg: s.dec, hour: 21, dayOfYear: STAR_TASK_DAY, latDeg: 37.5 });
    expect(pos(sc, 'dubhe')).toEqual(direct);
  });

  it('밤 9시 → 자정에 북극성의 화면 위치 변화는 두베의 1/20 미만이다(역방향 자전도 같다)', () => {
    for (const rotation of ['forward', 'reverse']) {
      const a = sceneAt(21, false, [], { rotation });
      const b = sceneAt(24, false, [], { rotation });
      const d = (key: string) => {
        const p = pos(a, key);
        const q = pos(b, key);
        return Math.hypot(azOffset(q.azDeg) - azOffset(p.azDeg), q.altDeg - p.altDeg);
      };
      expect(d('dubhe'), rotation).toBeGreaterThan(10);
      expect(d('polaris') * 20, rotation).toBeLessThan(d('dubhe'));
    }
  });

  it('길잡이 선은 두베에서 시작해 북극성 2.6° 안에서 끝난다. 끄면 선이 없다', () => {
    const sc = sceneAt(21, true);
    expect(sc.guide.length).toBeGreaterThan(10);
    expect(sc.guideMarks).toHaveLength(5);
    const dubhe = pos(sc, 'dubhe');
    expect(sc.guide[0]!.altDeg).toBeCloseTo(dubhe.altDeg, 6);
    const end = sc.guide[sc.guide.length - 1]!;
    expect(sc.guideMarks[4]).toEqual(end);
    const sky = (p: { altDeg: number; azDeg: number }, q: { altDeg: number; azDeg: number }) => {
      const v = (x: { altDeg: number; azDeg: number }) => {
        const al = (x.altDeg * Math.PI) / 180;
        const az = (x.azDeg * Math.PI) / 180;
        return [Math.cos(al) * Math.cos(az), Math.cos(al) * Math.sin(az), Math.sin(al)];
      };
      const a = v(p);
      const b = v(q);
      return (Math.acos(a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!) * 180) / Math.PI;
    };
    expect(sky(end, pos(sc, 'polaris'))).toBeCloseTo(2.6, 1);
    expect(sceneAt(21, false).guide).toEqual([]);
  });

  it('별 자취는 현재 시각을 뺀 지난 시각들의 별 위치다', () => {
    const sc = sceneAt(24, false, [21, 22, 24, 22]);
    expect(sc.trail.map((t) => t.hour)).toEqual([21, 22]);
    expect(sc.trail[0]!.stars).toHaveLength(16);
  });

  it('시각 표기: 24시는 자정, 27시는 오전 3시', () => {
    expect(nightLabel(19)).toBe('오후 7시');
    expect(nightLabel(21)).toBe('오후 9시');
    expect(nightLabel(24)).toBe('자정(오전 12시)');
    expect(nightLabel(25.5)).toBe('오전 1시 30분');
    expect(nightLabel(27)).toBe('오전 3시');
    expect(sceneAt(24).ariaLabel).toContain('자정');
  });
});

describe('북쪽 하늘 보기: 선택지의 별은 기록 전에도 모두 이름이 있다', () => {
  it('북극성·코카브·카펠라·직녀성(보이는 별)과 북두칠성·카시오페이아 이름이 보인다', () => {
    const html = renderToStaticMarkup(createElement(NorthSkyView, { scene: northScene(exp, { hour: 21, controls: {} }, [], false), showTrail: false }));
    for (const t of ['북극성', '코카브', '카펠라', '북두칠성', '카시오페이아']) expect(html, t).toContain(`>${t}<`);
    // 밤 9시 서울에서 직녀성은 지평선 아래라 그려지지 않는다. 떠오르는 새벽 3시에는 이름이 붙는다.
    expect(html).not.toContain('>직녀성<');
    const late = renderToStaticMarkup(createElement(NorthSkyView, { scene: northScene(exp, { hour: 27, controls: {} }, [], false), showTrail: false }));
    expect(late).toContain('>직녀성<');
  });
});

describe('지구의 운동(g6) 화면은 그대로다', () => {
  it('g6 땅에서 보기 문구와 시각 처음 값', () => {
    const t = (id: string) => g6.tasks.find((x) => x.id === id)!;
    expect(defaultHour(t('sun-path'))).toBe(12);
    expect(defaultHour(t('star-path'))).toBe(21);
    expect(defaultHour(t('season-stars'))).toBe(21);
    const sun9 = groundScene(g6, t('sun-path'), { hour: 9, month: 4, controls: { rotation: 'forward' } });
    expect(sun9.caption).toBe('오전 9시 · 태양이 동쪽 하늘에 있어요');
    expect(sun9.ariaLabel).toBe('땅에서 보기: 오전 9시, 태양은 동쪽 하늘');
    const winter = groundScene(g6, t('winter-stars'), { hour: 21, month: 1, controls: {} });
    expect(winter.caption).toBe('밤 9시 · 남쪽 하늘: 오리온자리');
  });

  it('g6 저장소는 시각을 0~24로, 달을 1~12로 맞추고 새 토글은 받지 않는다', () => {
    const s0 = createInitialState(g6);
    const s = predict(select(s0, g6, 'sun-path'), g6, 'still');
    expect(current(setHour(s, g6, 99), g6).ts.hour).toBe(24);
    expect(current(setHour(s, g6, -3), g6).ts.hour).toBe(0);
    expect(setSkyToggle(s, g6, 'guide', true)).toBe(s);
    expect(touchView(s, g6)).toBe(s);
    expect(s.trail).toEqual([12]);
  });
});

describe('밤하늘 관찰: 북쪽 하늘 이름 배치', () => {
  const hours: number[] = [];
  for (let h = NORTH_HOUR_MIN; h <= NORTH_HOUR_MAX; h += 0.5) hours.push(h);
  const overlap = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

  for (const [name, L] of [['넓은 화면', WIDE], ['좁은 화면', NARROW]] as const) {
    it(`${name}: 모든 시각·길잡이 선 유무에서 이름끼리 겹치지 않고 별 점을 덮지 않으며 하늘 안에 있다`, () => {
      let crossings = 0;
      for (const hour of hours)
        for (const guide of [false, true]) {
          const sc = northScene(exp, { hour, controls: {} }, [], guide);
          const labels = northLabels(sc, L);
          for (let i = 0; i < labels.length; i++)
            for (let j = i + 1; j < labels.length; j++)
              expect(overlap(labels[i]!.box, labels[j]!.box), `${hour}시 ${labels[i]!.text}·${labels[j]!.text}`).toBe(false);
          for (const l of labels) {
            expect(l.box.x, `${hour}시 ${l.text}`).toBeGreaterThanOrEqual(0);
            expect(l.box.x + l.box.w, `${hour}시 ${l.text}`).toBeLessThanOrEqual(L.W);
            expect(l.box.y + l.box.h, `${hour}시 ${l.text}`).toBeLessThanOrEqual(L.horizon);
            for (const s of sc.stars) {
              if (s.point.altDeg <= 0 || Math.abs(azOffset(s.point.azDeg)) > 75) continue;
              const x = L.cx + azOffset(s.point.azDeg) * L.pxPerDeg;
              const y = L.horizon - s.point.altDeg * L.pxPerAlt;
              expect(overlap(l.box, { x: x - 3.5, y: y - 3.5, w: 7, h: 7 }), `${hour}시 ${l.text}이 ${s.key} 점을 덮음`).toBe(false);
            }
          }
          crossings += labels.length;
        }
      expect(crossings).toBeGreaterThan(0);
    });
  }
});
