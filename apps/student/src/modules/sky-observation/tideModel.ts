import { mudflatExposed, rocksSubmerged, tideHeight, tideRising } from '@sci/engine-earth';
import type { ObservationTask } from '@sci/schema';
import { formatHour } from './model';

/** 바닷가 보기(tide)를 쓰는 과제인가. */
export const isTideView = (task: ObservationTask): boolean => task.view === 'tide';

/** 높이를 "−3.5"처럼(소수 첫째 자리, 음수는 −). */
export const heightText = (h: number): string => {
  const r = Math.round(h * 10) / 10;
  return `${r < 0 ? '−' : ''}${Math.abs(r).toFixed(1)}`;
};

export interface TideDot {
  hour: number;
  height: number;
}

export interface TideScene {
  hour: number;
  /** "오전 8시"처럼. */
  timeLabel: string;
  /** 바닷물 높이(m). */
  height: number;
  heightLabel: string;
  rising: boolean;
  exposed: boolean;
  submerged: boolean;
  /** 하루 그래프에 남긴 점(시각 순). */
  dots: TideDot[];
  /** 이름("밀물"·"썰물")은 화면 문구에 쓰지 않는다. 기록을 맞게 한 뒤에만 stateNote로 보여 준다. */
  caption: string;
  aria: string;
  graphCaption: string;
  graphAria: string;
  /** 기록을 맞게 한 뒤에만 보여 주는 문구. */
  stateNote: string;
}

export const TIDE_GRAPH_HINT = '슬라이더로 지나온 시각의 바닷물 높이를 점으로 남겨요';

export function tideScene(hour: number, trail: number[]): TideScene {
  const height = tideHeight(hour);
  const rising = tideRising(hour);
  const exposed = mudflatExposed(hour);
  const submerged = rocksSubmerged(hour);
  const timeLabel = formatHour(hour);
  const heightLabel = heightText(height);
  const flat = exposed ? '갯벌이 물 밖에 나와 있어요' : '갯벌이 물에 잠겨 있어요';
  const rocks = submerged ? '바닷가 바위는 물에 잠겨 있고' : '바닷가 바위는 물 위에 있고';
  const caption = `${timeLabel} · 바닷물 높이 ${heightLabel} m · ${rocks} ${flat}`;
  const aria = `바닷가 보기: ${timeLabel}, 옆에서 본 바닷가. 왼쪽이 육지이고 오른쪽으로 갯벌과 바다가 있어요. 바닷물 높이는 ${heightLabel} m이고, ${rocks} ${flat}`;
  const dots = [...new Set(trail)].sort((a, b) => a - b).map((h) => ({ hour: h, height: tideHeight(h) }));
  const graphCaption = `${TIDE_GRAPH_HINT} · 점 ${dots.length}개`;
  const graphAria = `하루 그래프: 가로는 시각 0시부터 24시, 세로는 바닷물 높이 −4 m부터 4 m. 지나온 시각 ${dots.length}곳의 높이를 점으로 남겼고, 지금은 ${timeLabel}에 ${heightLabel} m예요`;
  const stateNote = rising ? '지금은: 밀물(바닷물이 들어오는 중)' : '지금은: 썰물(바닷물이 빠져나가는 중)';
  return { hour, timeLabel, height, heightLabel, rising, exposed, submerged, dots, caption, aria, graphCaption, graphAria, stateNote };
}
