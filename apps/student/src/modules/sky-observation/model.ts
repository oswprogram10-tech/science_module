import {
  CONSTELLATIONS,
  CONSTELLATION_KEYS,
  EQUINOX_DAY,
  STAR_TASK_DAY,
  STAR_TASK_START_HOUR,
  dayOfMonth15,
  raSun,
  southConstellationAt,
  starPosition,
  sunPosition,
  type ConstellationKey,
  type Rotation,
  type SkyPoint,
} from '@sci/engine-earth';
import type { ObservationExperiment, ObservationTask } from '@sci/schema';
import { latOf, modelAnswer } from '@sci/tutor';

// 모델 결과 계산은 튜터 데이터 도구와 공유하므로 @sci/tutor에 있다.
export { latOf, modelAnswer };

export type Controls = Record<string, string | number>;

/** 계절 과제의 시각(오후 9시). */
export const NIGHT_HOUR = 21;
/** 계절 과제에서 달 슬라이더의 처음 값. */
export const DEFAULT_MONTH = 4;

const paramDay = (exp: ObservationExperiment): number => {
  const v = exp.params?.dayOfYear;
  return typeof v === 'number' ? v : EQUINOX_DAY;
};

/** 과제의 처음 시각. 별 과제와 계절 과제는 밤 9시, 나머지는 정오. */
export function defaultHour(task: ObservationTask): number {
  if (task.view === 'revolution') return NIGHT_HOUR;
  return task.answer === 'star-path-direction' ? STAR_TASK_START_HOUR : 12;
}

/** 과제와 달 슬라이더 값으로 정해지는 날짜(일 번호). */
export function dayFor(exp: ObservationExperiment, task: ObservationTask, month: number): number {
  if (task.view === 'revolution') return dayOfMonth15(month);
  if (task.answer === 'star-path-direction') return STAR_TASK_DAY;
  return paramDay(exp);
}

/** 이 과제에서 화면에 쓰는 시각. 계절 과제는 밤 9시로 고정이다. */
export const hourFor = (task: ObservationTask, hour: number): number => (task.view === 'revolution' ? NIGHT_HOUR : hour);

/** 이 과제가 별자리를 그리는가(별 과제·계절 과제). */
export const showsStars = (task: ObservationTask): boolean =>
  task.view === 'revolution' || task.answer === 'star-path-direction';

export const rotationOf = (controls: Controls): Rotation => (controls.rotation === 'reverse' ? 'reverse' : 'forward');

/** 오전 9시, 오후 12시, 오후 3시 30분처럼. 0시와 24시는 오전 12시. */
export function formatHour(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  const whole = Math.floor(h);
  const minutes = Math.round((h - whole) * 60);
  const ampm = whole < 12 ? '오전' : '오후';
  const h12 = whole % 12 === 0 ? 12 : whole % 12;
  return minutes === 0 ? `${ampm} ${h12}시` : `${ampm} ${h12}시 ${minutes}분`;
}

export type SunSide = '동쪽' | '남쪽' | '서쪽';
/** 방위각을 동·남·서 중 가까운 쪽으로. 북쪽 방향은 가까운 동·서쪽으로 본다. */
export function sideOf(azDeg: number): SunSide {
  if (azDeg < 150 || azDeg > 330) return '동쪽';
  if (azDeg <= 210) return '남쪽';
  return '서쪽';
}

export interface SceneStar {
  ra: number;
  dec: number;
  point: SkyPoint;
}

export interface SceneConstellation {
  key: ConstellationKey;
  name: string;
  stars: SceneStar[];
  lines: [number, number][];
}

export interface GroundScene {
  hour: number;
  dayOfYear: number;
  timeLabel: string;
  sun: SkyPoint;
  isDay: boolean;
  side: SunSide;
  southKey: ConstellationKey;
  southName: string;
  constellations: SceneConstellation[];
  caption: string;
  ariaLabel: string;
}

/** 땅에서 보기 화면이 그리는 모든 값. 화면 문구와 aria-label도 여기서 정한다. */
export function groundScene(
  exp: ObservationExperiment,
  task: ObservationTask,
  state: { hour: number; month: number; controls: Controls },
): GroundScene {
  const hour = hourFor(task, state.hour);
  const dayOfYear = dayFor(exp, task, state.month);
  const rotation = rotationOf(state.controls);
  const latDeg = latOf(exp);
  const sun = sunPosition({ hour, dayOfYear, latDeg, rotation });
  const isDay = sun.altDeg > 0;
  const side = sideOf(sun.azDeg);
  const southKey = southConstellationAt(dayOfYear, hour);
  const southName = CONSTELLATIONS[southKey].name;
  const timeLabel = task.view === 'revolution' ? '밤 9시' : formatHour(hour);
  const constellations: SceneConstellation[] =
    !isDay && showsStars(task)
      ? CONSTELLATION_KEYS.map((key) => {
          const c = CONSTELLATIONS[key];
          return {
            key,
            name: c.name,
            lines: c.lines,
            stars: c.stars.map((s) => ({
              ra: s.ra,
              dec: s.dec,
              point: starPosition({ raHours: s.ra, decDeg: s.dec, hour, dayOfYear, latDeg, rotation }),
            })),
          };
        })
      : [];
  // 별을 그리지 않는 과제(태양·낮과 밤)의 밤에는 별자리 이름 대신 태양이 보이지 않는다고 알린다.
  const caption = isDay
    ? `${timeLabel} · 태양이 ${side} 하늘에 있어요`
    : showsStars(task)
      ? `${timeLabel} · 남쪽 하늘: ${southName}`
      : `${timeLabel} · 밤이라 태양이 보이지 않아요`;
  const ariaLabel = isDay
    ? `땅에서 보기: ${timeLabel}, 태양은 ${side} 하늘`
    : showsStars(task)
      ? `땅에서 보기: ${timeLabel}, 밤하늘 남쪽에 ${southName}`
      : `땅에서 보기: ${timeLabel}, 밤이라 태양이 보이지 않아요`;
  return { hour, dayOfYear, timeLabel, sun, isDay, side, southKey, southName, constellations, caption, ariaLabel };
}

/** 우주에서 보기(공전)의 지구 위치: 궤도 위 각도(°, 수학 방향, 오른쪽이 0, 반시계 +). */
export function earthOrbitAngleDeg(dayOfYear: number): number {
  return (((raSun(dayOfYear) * 15 + 180) % 360) + 360) % 360;
}

/** 우주에서 보기(자전)의 우리나라 위치: 화면 각도(rad, y가 아래로 늘어나는 화면 좌표). 정오에 태양 쪽(왼쪽). */
export function seoulScreenAngle(hour: number, rotation: Rotation): number {
  const dir = rotation === 'reverse' ? -1 : 1;
  return Math.PI - dir * ((hour - 12) / 24) * 2 * Math.PI;
}

/** 우주에서 보기(자전)에서 그 위치가 낮 쪽(태양을 향한 반쪽)인가. */
export const screenAngleIsDay = (angle: number): boolean => Math.cos(angle) < 0;

/** 지나온 시각들의 태양 위치(시각 순). */
export function sunTrail(
  exp: ObservationExperiment,
  task: ObservationTask,
  state: { month: number; controls: Controls },
  hours: number[],
): SkyPoint[] {
  const dayOfYear = dayFor(exp, task, state.month);
  const rotation = rotationOf(state.controls);
  return [...hours]
    .sort((a, b) => a - b)
    .map((hour) => sunPosition({ hour, dayOfYear, latDeg: latOf(exp), rotation }));
}
