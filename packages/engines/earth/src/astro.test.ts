import { describe, expect, it } from 'vitest';
import { observationAnswerSchema, parseManifest, type ObservationExperiment } from '@sci/schema';
import {
  CONSTELLATIONS,
  CONSTELLATION_KEYS,
  answerFor,
  controlCombos,
  dayOfMonth15,
  isDaylight,
  nearestConstellation,
  raSun,
  southConstellationAt,
  southConstellationAt9pm,
  skyAngularDistanceDeg,
  starMotionDeg,
  starPosition,
  starTaskPositions,
  sunDeclination,
  sunPosition,
  validateSkyObservation,
} from './astro';
import earthJson from '../../../../content/units/g6-earth-motion/manifest.json';
import nightSkyJson from '../../../../content/units/g4-night-sky/manifest.json';

const exp = parseManifest(earthJson).experiments[0] as ObservationExperiment;
const nightExp = parseManifest(nightSkyJson).experiments[0] as ObservationExperiment;

describe('태양 위치 (서울, 위도 37.5°N)', () => {
  it('정오 고도: 춘분 52.5, 하지 75.9, 동지 29.1', () => {
    expect(sunPosition({ hour: 12, dayOfYear: 80 }).altDeg).toBeCloseTo(52.5, 1);
    expect(sunPosition({ hour: 12, dayOfYear: 172 }).altDeg).toBeCloseTo(75.9, 1);
    expect(sunPosition({ hour: 12, dayOfYear: 355 }).altDeg).toBeCloseTo(29.1, 1);
  });

  it('춘분 7·9·12·15·17시의 방위각', () => {
    const expected: [number, number][] = [[7, 99.3], [9, 121.3], [12, 180.0], [15, 238.7], [17, 260.7]];
    for (const [hour, az] of expected) {
      expect(sunPosition({ hour, dayOfYear: 80 }).azDeg).toBeCloseTo(az, 1);
    }
    expect(sunPosition({ hour: 9, dayOfYear: 80 }).azDeg).toBeLessThan(180);
    expect(sunPosition({ hour: 15, dayOfYear: 80 }).azDeg).toBeGreaterThan(180);
  });

  it('reverse이면 방위각이 360 - az가 되고 증감 방향이 뒤집힌다', () => {
    for (const hour of [7, 9, 12, 15, 17]) {
      const f = sunPosition({ hour, dayOfYear: 80 });
      const r = sunPosition({ hour, dayOfYear: 80, rotation: 'reverse' });
      expect(r.azDeg).toBeCloseTo((360 - f.azDeg) % 360, 6);
      expect(r.altDeg).toBeCloseTo(f.altDeg, 6);
    }
    const dF = sunPosition({ hour: 15, dayOfYear: 80 }).azDeg - sunPosition({ hour: 9, dayOfYear: 80 }).azDeg;
    const dR =
      sunPosition({ hour: 15, dayOfYear: 80, rotation: 'reverse' }).azDeg -
      sunPosition({ hour: 9, dayOfYear: 80, rotation: 'reverse' }).azDeg;
    expect(dF).toBeGreaterThan(0);
    expect(dR).toBeLessThan(0);
  });

  it('적위와 태양의 적경', () => {
    expect(sunDeclination(80)).toBeCloseTo(0, 6);
    expect(sunDeclination(172)).toBeCloseTo(23.44, 1);
    expect(raSun(80)).toBeCloseTo(0, 6);
    expect(raSun(15)).toBeCloseTo(19.73, 1);
  });

  it('정오에는 태양이 남쪽 자오선에 있다', () => {
    expect(sunPosition({ hour: 12, dayOfYear: 200 }).azDeg).toBeCloseTo(180, 6);
  });
});

describe('낮·밤', () => {
  it('서울 12시가 낮이면 반대편은 밤이고, 그 반대도 성립한다', () => {
    for (let hour = 0; hour < 24; hour += 0.5) {
      expect(isDaylight({ hour, lonOffsetDeg: 180 })).toBe(!isDaylight({ hour, lonOffsetDeg: 0 }));
    }
    expect(isDaylight({ hour: 12, lonOffsetDeg: 0 })).toBe(true);
    expect(isDaylight({ hour: 12, lonOffsetDeg: 180 })).toBe(false);
    expect(isDaylight({ hour: 0, lonOffsetDeg: 0 })).toBe(false);
    expect(isDaylight({ hour: 0, lonOffsetDeg: 180 })).toBe(true);
  });
});

describe('별자리', () => {
  it('오후 9시 남쪽 하늘: 1월 15일 orion, 4월 15일 leo, 8월 16일 cygnus, 10월 15일 pegasus', () => {
    expect(southConstellationAt9pm(15)).toBe('orion');
    expect(southConstellationAt9pm(105)).toBe('leo');
    expect(southConstellationAt9pm(228)).toBe('cygnus');
    expect(southConstellationAt9pm(288)).toBe('pegasus');
  });

  it('15일 기준 날짜 환산과 열두 달 모두 별자리가 정해진다', () => {
    expect([1, 4, 8, 10].map(dayOfMonth15)).toEqual([15, 105, 227, 288]);
    for (let m = 1; m <= 12; m++) expect(CONSTELLATION_KEYS).toContain(southConstellationAt9pm(dayOfMonth15(m)));
  });

  it('가장 가까운 별자리는 24시간 순환 거리로 정한다', () => {
    expect(nearestConstellation(0.2)).toBe('pegasus');
    expect(nearestConstellation(23.9)).toBe('pegasus');
    expect(nearestConstellation(3)).toBe('orion');
    expect(southConstellationAt(15, 21)).toBe('orion');
    expect(southConstellationAt(15, 24)).toBe('orion');
  });

  it('별자리마다 별 4~7개와 올바른 선 인덱스를 가진다', () => {
    for (const k of CONSTELLATION_KEYS) {
      const c = CONSTELLATIONS[k];
      expect(c.stars.length).toBeGreaterThanOrEqual(4);
      expect(c.stars.length).toBeLessThanOrEqual(7);
      for (const [a, b] of c.lines) {
        expect(c.stars[a]).toBeDefined();
        expect(c.stars[b]).toBeDefined();
      }
    }
  });

  it('1월 15일 오후 9시 오리온자리는 남쪽 하늘의 지평선 위에 있다', () => {
    const o = CONSTELLATIONS.orion.stars[3]!;
    const p = starPosition({ raHours: o.ra, decDeg: o.dec, hour: 21, dayOfYear: 15 });
    expect(p.altDeg).toBeGreaterThan(30);
    expect(p.azDeg).toBeGreaterThan(120);
    expect(p.azDeg).toBeLessThan(200);
  });

  it('별은 밤 동안 방위각이 늘어난다(동 → 서). reverse이면 줄어든다', () => {
    const o = CONSTELLATIONS.orion.stars[3]!;
    const az = (hour: number, rotation: 'forward' | 'reverse') =>
      starPosition({ raHours: o.ra, decDeg: o.dec, hour, dayOfYear: 15, rotation }).azDeg;
    expect(az(24, 'forward')).toBeGreaterThan(az(21, 'forward'));
    expect(az(24, 'reverse')).toBeLessThan(az(21, 'reverse'));
  });
});

describe('answerFor: 모델에서 계산한 과제 정답', () => {
  it('다섯 규칙의 결과를 controls 조합별로 고정한다', () => {
    expect(answerFor('sun-path-direction', { rotation: 'forward' })).toBe('east-to-west');
    expect(answerFor('sun-path-direction', { rotation: 'reverse' })).toBe('west-to-east');
    expect(answerFor('sun-path-direction', {})).toBe('east-to-west');
    expect(answerFor('star-path-direction', { rotation: 'forward' })).toBe('east-to-west');
    expect(answerFor('star-path-direction', { rotation: 'reverse' })).toBe('west-to-east');
    expect(answerFor('antipode-day-night', {})).toBe('night');
    expect(answerFor('antipode-day-night', { rotation: 'reverse' })).toBe('night');
    expect(answerFor('constellation-changes', {})).toBe('changes');
    expect(answerFor('winter-constellation', {})).toBe('orion');
  });

  it('모든 규칙이 매니페스트의 선택지 안에서 답한다', () => {
    for (const rule of observationAnswerSchema.options) {
      const tasks = [...exp.tasks, ...nightExp.tasks].filter((t) => t.answer === rule);
      expect(tasks.length, rule).toBeGreaterThan(0);
      for (const t of tasks) {
        for (const combo of controlCombos(t.controls)) {
          expect(t.options.map((o) => o.value), `${t.id} ${JSON.stringify(combo)}`).toContain(answerFor(rule, combo));
        }
      }
    }
  });

  it('날짜가 달라도 방위각 증감으로 계산한다', () => {
    for (const dayOfYear of [80, 172, 355]) {
      expect(answerFor('sun-path-direction', { rotation: 'forward' }, { dayOfYear })).toBe('east-to-west');
      expect(answerFor('sun-path-direction', { rotation: 'reverse' }, { dayOfYear })).toBe('west-to-east');
    }
  });
});

describe('매니페스트 검사', () => {
  it('지구의 운동 매니페스트는 문제가 없다', () => {
    expect(validateSkyObservation(exp)).toEqual([]);
  });

  it('밤하늘 관찰 매니페스트도 문제가 없다(모든 조작 조합의 모델 결과가 선택지에 있다)', () => {
    expect(validateSkyObservation(nightExp)).toEqual([]);
  });

  it('선택지에 없는 모델 결과, 빠진 질문, 겹치는 id를 찾아낸다', () => {
    const bad = JSON.parse(JSON.stringify(exp)) as ObservationExperiment;
    bad.tasks[1]!.options = [{ value: 'day', label: '낮이에요' }, { value: 'x', label: 'x' }];
    bad.tasks[2]!.probes.pop();
    bad.tasks[3]!.id = bad.tasks[0]!.id;
    bad.params = { latDeg: 120 };
    const issues = validateSkyObservation(bad);
    expect(issues.some((i) => i.includes('day-night') && i.includes('"night"'))).toBe(true);
    expect(issues.some((i) => i.includes('star-path') && i.includes('prediction-mismatch'))).toBe(true);
    expect(issues.some((i) => i.includes('겹칩니다'))).toBe(true);
    expect(issues.some((i) => i.includes('latDeg'))).toBe(true);
  });
});

describe('밤하늘 관찰의 새 정답 규칙 네 개', () => {
  it('결과: 목성 11, 해왕성 30, 길잡이 별 polaris, 북극성 nearly-still', () => {
    expect(answerFor('jupiter-earth-size', {})).toBe('11');
    expect(answerFor('neptune-distance', {})).toBe('30');
    expect(answerFor('pointer-star-target', {})).toBe('polaris');
    expect(answerFor('polaris-motion', {})).toBe('nearly-still');
  });

  it('결과는 모두 문자열이고 조작(compare, rotation)이 있어도 같다', () => {
    for (const compare of ['size', 'distance']) {
      expect(answerFor('jupiter-earth-size', { compare })).toBe('11');
      expect(answerFor('neptune-distance', { compare })).toBe('30');
    }
    for (const rotation of ['forward', 'reverse']) {
      expect(answerFor('polaris-motion', { rotation })).toBe('nearly-still');
      expect(typeof answerFor('polaris-motion', { rotation })).toBe('string');
    }
  });

  it('북극성은 밤 9시 → 자정에 1° 미만(≈0.56°), 북두칠성 두베는 20° 이상 움직인다(역방향 자전도 같다)', () => {
    expect(starMotionDeg('polaris')).toBeLessThan(1);
    expect(starMotionDeg('polaris')).toBeCloseTo(0.56, 1);
    expect(starMotionDeg('polaris', { rotation: 'reverse' })).toBeLessThan(1);
    expect(starMotionDeg('dubhe')).toBeGreaterThanOrEqual(20);
    expect(starMotionDeg('dubhe', { rotation: 'reverse' })).toBeGreaterThanOrEqual(20);
  });

  it('별 과제의 두 위치 사이 각거리는 starMotionDeg와 같고, 두베는 밤 9시 → 자정에 높아진다', () => {
    const [a, b] = starTaskPositions('dubhe');
    expect(skyAngularDistanceDeg(a, b)).toBeCloseTo(starMotionDeg('dubhe'), 6);
    expect(skyAngularDistanceDeg(a, a)).toBeCloseTo(0, 6);
    expect(b.altDeg).toBeGreaterThan(a.altDeg);
  });
});
