import {
  NORTH_STARS,
  PLANETS,
  STAR_TASK_DAY,
  distanceCells,
  formatRatio,
  northStar,
  pointOnGreatCircle,
  sizeRatio,
  starPosition,
  sunSizeRatio,
  type NorthStarGroup,
  type NorthStarKey,
  type PlanetKey,
  type SkyPoint,
} from '@sci/engine-earth';
import type { ObservationAnswerRule, ObservationExperiment, ObservationTask } from '@sci/schema';
import { formatHour, latOf, rotationOf, type Controls } from './model';

/** 새 보기(태양계 모형 보기, 북쪽 하늘 보기)를 쓰는 과제인가. */
export const isNightView = (task: ObservationTask): boolean => task.view === 'solar-system' || task.view === 'north-sky';

/** 북쪽 하늘 보기의 시각 범위(오후 7시~새벽 3시. 24를 넘으면 다음 날 새벽). */
export const NORTH_HOUR_MIN = 19;
export const NORTH_HOUR_MAX = 27;
export const NORTH_HOUR_DEFAULT = 21;

/** 시각 표기. 24시는 자정으로 알려 준다. */
export const nightLabel = (hour: number): string => (hour === 24 ? '자정(오전 12시)' : formatHour(hour));

// ---- 태양계 모형 ----

export type CompareMode = 'size' | 'distance';
export const compareOf = (controls: Controls): CompareMode => (controls.compare === 'distance' ? 'distance' : 'size');

export interface SolarRow {
  key: PlanetKey;
  name: string;
  /** 지구 지름의 몇 배인가. */
  ratio: number;
  /** 태양~지구를 1칸으로 한 거리(칸). */
  cells: number;
  /** 화면 글자. 정답이 되는 숫자는 기록 전에 "?"로 바뀐다. */
  sizeText: string;
  distText: string;
  sizeHidden: boolean;
  distHidden: boolean;
}

export interface SolarScene {
  rows: SolarRow[];
  sunText: string;
  /** 태양 지름(px). 지구 지름을 EARTH_PX로 둔 같은 축척이다. */
  sunPx: number;
  ariaLabel: string;
}

/** 지구 지름을 이 픽셀로 그린다. */
export const EARTH_PX = 10;

/** 태양계 모형 보기의 계산값. hideAnswer가 참이면 그 과제의 정답이 되는 숫자 하나만 "?"로 둔다. */
export function solarScene(answer: ObservationAnswerRule, hideAnswer: boolean, compare: CompareMode): SolarScene {
  const rows: SolarRow[] = PLANETS.map((p) => {
    const ratio = sizeRatio(p.key);
    const cells = distanceCells(p.key);
    const sizeHidden = hideAnswer && answer === 'jupiter-earth-size' && p.key === 'jupiter';
    const distHidden = hideAnswer && answer === 'neptune-distance' && p.key === 'neptune';
    return {
      key: p.key,
      name: p.name,
      ratio,
      cells,
      sizeText: p.key === 'earth' ? '기준(1배)' : `지구의 약 ${sizeHidden ? '?' : formatRatio(ratio)}배`,
      distText: `${distHidden ? '?' : formatRatio(cells)}칸`,
      sizeHidden,
      distHidden,
    };
  });
  const sunText = `태양(지구의 약 ${formatRatio(sunSizeRatio())}배)`;
  const list = rows.map((r) => `${r.name} ${compare === 'size' ? r.sizeText : r.distText}`).join(', ');
  const ariaLabel =
    compare === 'size'
      ? `태양계 모형 보기, 크기 비교. 지구 지름을 10 px로 그린 행성 원 여덟 개: ${list}. ${sunText}`
      : `태양계 모형 보기, 거리 비교. 태양에서 지구까지를 1칸으로 한 거리 막대, 0칸부터 30칸: ${list}`;
  return { rows, sunText, sunPx: sunSizeRatio() * EARTH_PX, ariaLabel };
}

// ---- 북쪽 하늘 ----

export interface NorthStarPoint {
  key: NorthStarKey;
  group: NorthStarGroup;
  name: string;
  point: SkyPoint;
}

export interface NorthScene {
  hour: number;
  timeLabel: string;
  stars: NorthStarPoint[];
  /** 지난 시각들의 별 위치(현재 시각은 뺀다). */
  trail: { hour: number; stars: NorthStarPoint[] }[];
  /** 두베에서 메라크→두베 방향 5배 연장 끝점까지 점선이 지나는 하늘 위의 점들. */
  guide: SkyPoint[];
  /** 연장선 위에 두 별 사이 거리(1배)마다 찍는 눈금 다섯 개. */
  guideMarks: SkyPoint[];
  ariaLabel: string;
}

const GUIDE_SAMPLES = 30;

/** 방위각을 북(0)을 가운데로 한 -180~180 차이로. */
export const azOffset = (azDeg: number): number => ((((azDeg + 180) % 360) + 360) % 360) - 180;

export function northScene(
  exp: ObservationExperiment,
  state: { hour: number; controls: Controls },
  trailHours: number[],
  showGuide: boolean,
): NorthScene {
  const latDeg = latOf(exp);
  const rotation = rotationOf(state.controls);
  const positions = (hour: number): NorthStarPoint[] =>
    NORTH_STARS.map((s) => ({
      key: s.key,
      group: s.group,
      name: s.name,
      point: starPosition({ raHours: s.ra, decDeg: s.dec, hour, dayOfYear: STAR_TASK_DAY, latDeg, rotation }),
    }));
  const merak = northStar('merak');
  const dubhe = northStar('dubhe');
  const along = (t: number): SkyPoint => {
    const p = pointOnGreatCircle({ raHours: merak.ra, decDeg: merak.dec }, { raHours: dubhe.ra, decDeg: dubhe.dec }, t);
    return starPosition({ raHours: p.raHours, decDeg: p.decDeg, hour: state.hour, dayOfYear: STAR_TASK_DAY, latDeg, rotation });
  };
  const timeLabel = nightLabel(state.hour);
  return {
    hour: state.hour,
    timeLabel,
    stars: positions(state.hour),
    trail: [...new Set(trailHours)]
      .filter((h) => h !== state.hour)
      .sort((a, b) => a - b)
      .map((hour) => ({ hour, stars: positions(hour) })),
    guide: showGuide ? Array.from({ length: GUIDE_SAMPLES + 1 }, (_, i) => along(1 + (5 * i) / GUIDE_SAMPLES)) : [],
    guideMarks: showGuide ? [2, 3, 4, 5, 6].map(along) : [],
    ariaLabel: `북쪽 하늘 보기: ${timeLabel}, 땅에서 북쪽을 바라본 하늘에 북두칠성과 카시오페이아 등 별이 보여요${
      showGuide ? '. 길잡이 선이 보여요' : ''
    }`,
  };
}
