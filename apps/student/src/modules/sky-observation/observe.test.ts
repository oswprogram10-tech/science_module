import { describe, expect, it } from 'vitest';
import { parseManifest, type ObservationExperiment } from '@sci/schema';
import { renderAndGuard, FALLBACK_PROBE } from '@sci/tutor';
import earthJson from '../../../../../content/units/g6-earth-motion/manifest.json';
import { FEEDBACK_IDLE, FEEDBACK_MATCH, FEEDBACK_MISMATCH, feedbackText } from './feedback';
import { formatHour, groundScene, modelAnswer, seoulScreenAngle, screenAngleIsDay, sideOf } from './model';
import {
  canObserve,
  canRecord,
  createInitialState,
  createObserveStore,
  current,
  feedbackKind,
  isCompleted,
  predict,
  record,
  select,
  setControl,
  setHour,
  setMonth,
  tutorSituation,
} from './observeStore';

const exp = parseManifest(earthJson).experiments[0] as ObservationExperiment;
const fresh = () => createInitialState(exp);
const task = (id: string) => exp.tasks.find((t) => t.id === id)!;
const guard = { forbiddenAnswers: exp.tutor.forbiddenAnswers, limits: exp.limits };

/** 과제를 고르고 예측한 상태. */
const start = (id: string, prediction: string) => predict(select(fresh(), exp, id), exp, prediction);

describe('순수 저장소: 잠금 규칙', () => {
  it('예측하기 전에는 시각·달·조건을 바꿀 수 없다', () => {
    const s = fresh();
    expect(canObserve(s, exp)).toBe(false);
    expect(setHour(s, exp, 9)).toBe(s);
    expect(setControl(s, exp, 'rotation', 'reverse')).toBe(s);
    const season = select(s, exp, 'season-stars');
    expect(setMonth(season, exp, 1)).toBe(season);
  });

  it('조작하기 전에는 기록할 수 없다', () => {
    const s = start('sun-path', 'east-to-west');
    expect(canObserve(s, exp)).toBe(true);
    expect(canRecord(s, exp)).toBe(false);
    expect(record(s, exp, 'east-to-west')).toBe(s);
    const moved = setHour(s, exp, 9);
    expect(canRecord(moved, exp)).toBe(true);
    expect(isCompleted(record(moved, exp, 'east-to-west'), 'sun-path')).toBe(true);
  });

  it('슬라이더 값은 0.5 단위로 맞추고 범위를 지키며, 같은 값이면 조작으로 치지 않는다', () => {
    const s = start('sun-path', 'still');
    expect(setHour(s, exp, 12)).toBe(s);
    expect(current(setHour(s, exp, 9.3), exp).ts.hour).toBe(9.5);
    expect(current(setHour(s, exp, 99), exp).ts.hour).toBe(24);
    expect(current(setHour(s, exp, -3), exp).ts.hour).toBe(0);
    expect(setHour(s, exp, Number.NaN)).toBe(s);
    const season = predict(select(fresh(), exp, 'season-stars'), exp, 'same');
    expect(current(setMonth(season, exp, 99), exp).ts.month).toBe(12);
    expect(current(setMonth(season, exp, 0), exp).ts.month).toBe(1);
  });

  it('rotation 과제는 달을, revolution 과제는 시각을 바꿀 수 없다', () => {
    const rot = start('sun-path', 'still');
    expect(setMonth(rot, exp, 1)).toBe(rot);
    const rev = predict(select(fresh(), exp, 'season-stars'), exp, 'same');
    expect(setHour(rev, exp, 9)).toBe(rev);
    expect(setControl(rev, exp, 'rotation', 'reverse')).toBe(rev);
  });

  it('선택지나 조작에 없는 값은 무시한다', () => {
    const s = select(fresh(), exp, 'sun-path');
    expect(predict(s, exp, 'orion')).toBe(s);
    const p = predict(s, exp, 'still');
    expect(setControl(p, exp, 'rotation', 'sideways')).toBe(p);
    expect(setControl(p, exp, 'nope', 'reverse')).toBe(p);
    expect(select(p, exp, 'nope')).toBe(p);
    expect(record(setHour(p, exp, 9), exp, 'orion')).toEqual(setHour(p, exp, 9));
  });

  it('과제별 처음 값: 태양 정오, 별 밤 9시(1월 15일), 계절 달 4월', () => {
    const s = fresh();
    expect(s.tasks['sun-path']!.hour).toBe(12);
    expect(s.tasks['star-path']!.hour).toBe(21);
    expect(s.tasks['season-stars']!.month).toBe(4);
    expect(s.tasks['sun-path']!.controls).toEqual({ rotation: 'forward' });
    expect(s.tasks['day-night']!.controls).toEqual({});
    expect(s.tasks['sun-path']!.prediction).toBeNull();
  });

  it('과제마다 상태를 따로 가지고, 완료 표시는 기록하면 켜진다', () => {
    let s = start('sun-path', 'east-to-west');
    s = record(setHour(s, exp, 9), exp, 'east-to-west');
    s = select(s, exp, 'day-night');
    expect(isCompleted(s, 'sun-path')).toBe(true);
    expect(isCompleted(s, 'day-night')).toBe(false);
    expect(current(s, exp).ts.prediction).toBeNull();
    s = select(s, exp, 'sun-path');
    expect(current(s, exp).ts.recorded?.value).toBe('east-to-west');
  });

  it('지나온 시각(태양 점선)은 과제를 바꾸거나 조건을 바꾸면 지운다', () => {
    let s = start('sun-path', 'east-to-west');
    expect(s.trail).toEqual([12]);
    s = setHour(setHour(s, exp, 9), exp, 15);
    expect(s.trail).toEqual([12, 9, 15]);
    expect(setControl(s, exp, 'rotation', 'reverse').trail).toEqual([15]);
    expect(select(s, exp, 'day-night').trail).toEqual([12]);
    expect(select(s, exp, 'season-stars').trail).toEqual([]);
  });

  it('스토어가 구독자에게 변경을 알린다', () => {
    const store = createObserveStore(fresh());
    let calls = 0;
    const off = store.subscribe(() => calls++);
    store.update((s) => predict(s, exp, 'still'));
    store.update((s) => s);
    off();
    store.update((s) => select(s, exp, 'day-night'));
    expect(calls).toBe(1);
  });
});

describe('순수 저장소: 피드백 종류와 튜터 상황', () => {
  const observe = (id: string, prediction: string, fn: (s: ReturnType<typeof fresh>) => ReturnType<typeof fresh>) =>
    fn(start(id, prediction));

  it('튜터 상황: 예측 전 → 기록 전 → (기록·모델 불일치) → (예측·기록 불일치) → 그 밖', () => {
    let s = select(fresh(), exp, 'sun-path');
    expect(tutorSituation(s, exp)).toBe('before-observe');
    s = predict(s, exp, 'west-to-east');
    expect(tutorSituation(s, exp)).toBe('observing');
    s = setHour(s, exp, 9);
    expect(tutorSituation(s, exp)).toBe('observing');
    // 기록이 모델과 같지만 예측과 다름
    const r1 = record(s, exp, 'east-to-west');
    expect(tutorSituation(r1, exp)).toBe('prediction-mismatch');
    expect(feedbackKind(r1, exp)).toBe('match');
    // 기록이 모델과 다름(예측과도 다름): record-mismatch가 먼저다
    const r2 = record(s, exp, 'still');
    expect(tutorSituation(r2, exp)).toBe('record-mismatch');
    expect(feedbackKind(r2, exp)).toBe('mismatch');
    // 기록이 모델과 다르고 예측과 같음
    const r3 = record(s, exp, 'west-to-east');
    expect(tutorSituation(r3, exp)).toBe('record-mismatch');
    // 예측 = 기록 = 모델
    const ok = observe('sun-path', 'east-to-west', (x) => record(setHour(x, exp, 9), exp, 'east-to-west'));
    expect(tutorSituation(ok, exp)).toBe('record-match');
    expect(feedbackKind(ok, exp)).toBe('match');
  });

  it('조건을 "만약에"로 둔 채 같은 기록을 다시 하면 그 조건의 결과와 비교한다', () => {
    let s = observe('sun-path', 'east-to-west', (x) => record(setHour(x, exp, 9), exp, 'east-to-west'));
    expect(feedbackKind(s, exp)).toBe('match');
    s = setControl(s, exp, 'rotation', 'reverse');
    // 다시 기록하기 전까지는 기록 당시 조건으로 비교한다.
    expect(feedbackKind(s, exp)).toBe('match');
    s = record(s, exp, 'east-to-west');
    expect(feedbackKind(s, exp)).toBe('mismatch');
    expect(tutorSituation(s, exp)).toBe('record-mismatch');
    s = record(s, exp, 'west-to-east');
    expect(feedbackKind(s, exp)).toBe('match');
    expect(tutorSituation(s, exp)).toBe('prediction-mismatch');
  });

  it('모든 과제·모든 기록 상황에서 튜터 문장이 가드를 통과하고 폴백이 아니다', () => {
    for (const t of exp.tasks) {
      for (const pred of t.options) {
        for (const rec of t.options) {
          let s = predict(select(fresh(), exp, t.id), exp, pred.value);
          for (const when of ['before', 'observing', 'recorded']) {
            if (when === 'observing') s = t.view === 'rotation' ? setHour(s, exp, 9) : setMonth(s, exp, 1);
            if (when === 'recorded') s = record(s, exp, rec.value);
            const text = renderAndGuard(tutorSituation(s, exp), {}, t.probes, guard);
            expect(text, `${t.id}/${pred.value}/${rec.value}/${when}`).not.toBe(FALLBACK_PROBE);
          }
        }
      }
    }
  });

  it('피드백 문장', () => {
    expect(feedbackText('idle')).toBe(FEEDBACK_IDLE);
    expect(feedbackText('match')).toBe('관찰한 내용을 잘 기록했어요.');
    expect(feedbackText('mismatch')).toBe('관찰 화면을 다시 살펴볼까요?');
    expect(FEEDBACK_MATCH).not.toBe(FEEDBACK_MISMATCH);
    for (const f of [FEEDBACK_IDLE, FEEDBACK_MATCH, FEEDBACK_MISMATCH]) expect(f).not.toMatch(/틀렸|정답|오답/);
  });
});

describe('모델 정답과 화면 값', () => {
  it('과제별 모델 결과(조건별)', () => {
    expect(modelAnswer(exp, task('sun-path'), { rotation: 'forward' })).toBe('east-to-west');
    expect(modelAnswer(exp, task('sun-path'), { rotation: 'reverse' })).toBe('west-to-east');
    expect(modelAnswer(exp, task('day-night'), {})).toBe('night');
    expect(modelAnswer(exp, task('star-path'), { rotation: 'forward' })).toBe('east-to-west');
    expect(modelAnswer(exp, task('star-path'), { rotation: 'reverse' })).toBe('west-to-east');
    expect(modelAnswer(exp, task('season-stars'), {})).toBe('changes');
    expect(modelAnswer(exp, task('winter-stars'), {})).toBe('orion');
  });

  it('시각 표기', () => {
    expect(formatHour(9)).toBe('오전 9시');
    expect(formatHour(12)).toBe('오후 12시');
    expect(formatHour(15)).toBe('오후 3시');
    expect(formatHour(0)).toBe('오전 12시');
    expect(formatHour(24)).toBe('오전 12시');
    expect(formatHour(15.5)).toBe('오후 3시 30분');
  });

  it('땅에서 보기 문구: 낮에는 동쪽 → 남쪽 → 서쪽, 밤에는 남쪽 하늘의 별자리', () => {
    const sun = (hour: number) => groundScene(exp, task('sun-path'), { hour, month: 4, controls: { rotation: 'forward' } });
    expect(sun(9).caption).toBe('오전 9시 · 태양이 동쪽 하늘에 있어요');
    expect(sun(12).caption).toBe('오후 12시 · 태양이 남쪽 하늘에 있어요');
    expect(sun(15).caption).toBe('오후 3시 · 태양이 서쪽 하늘에 있어요');
    expect(sun(9).ariaLabel).toBe('땅에서 보기: 오전 9시, 태양은 동쪽 하늘');
    expect(sun(0).isDay).toBe(false);
    const rev = groundScene(exp, task('sun-path'), { hour: 9, month: 4, controls: { rotation: 'reverse' } });
    expect(rev.caption).toBe('오전 9시 · 태양이 서쪽 하늘에 있어요');
    const month = (m: number) => groundScene(exp, task('season-stars'), { hour: 3, month: m, controls: {} });
    expect(month(1).caption).toBe('밤 9시 · 남쪽 하늘: 오리온자리');
    expect(month(4).caption).toBe('밤 9시 · 남쪽 하늘: 사자자리');
    expect(month(8).caption).toBe('밤 9시 · 남쪽 하늘: 백조자리');
    expect(month(10).caption).toBe('밤 9시 · 남쪽 하늘: 페가수스자리');
    expect(month(1).constellations.length).toBe(4);
    const star = groundScene(exp, task('star-path'), { hour: 24, month: 4, controls: { rotation: 'forward' } });
    expect(star.caption).toBe('오전 12시 · 남쪽 하늘: 오리온자리');
    // 태양 과제의 밤에는 별자리를 그리지 않는다.
    expect(sun(0).constellations).toEqual([]);
    expect(sun(0).caption).toBe('오전 12시 · 밤이라 태양이 보이지 않아요');
  });

  it('우리나라 표시는 정오에 태양 쪽(왼쪽)이고 6시·18시에 경계에 놓인다', () => {
    expect(screenAngleIsDay(seoulScreenAngle(12, 'forward'))).toBe(true);
    expect(screenAngleIsDay(seoulScreenAngle(0, 'forward'))).toBe(false);
    expect(Math.cos(seoulScreenAngle(12, 'forward'))).toBeCloseTo(-1, 6);
    expect(Math.cos(seoulScreenAngle(6, 'forward'))).toBeCloseTo(0, 6);
    // 방향을 뒤집으면 같은 시각에 반대쪽 경계로 간다.
    expect(Math.sin(seoulScreenAngle(15, 'forward'))).toBeCloseTo(-Math.sin(seoulScreenAngle(15, 'reverse')), 6);
    expect([sideOf(121), sideOf(180), sideOf(239), sideOf(60)]).toEqual(['동쪽', '남쪽', '서쪽', '동쪽']);
  });
});
