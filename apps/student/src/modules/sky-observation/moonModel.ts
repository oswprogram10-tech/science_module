import { LUNAR_DAY_MAX, LUNAR_DAY_MIN, moonDay, type MoonDay } from '@sci/engine-earth';
import type { ObservationExperiment, ObservationTask } from '@sci/schema';
import { latOf, sideOf } from './model';

/** 달 보기에서 음력 날짜 슬라이더의 범위와 처음 값. */
export const MOON_DAY_MIN = LUNAR_DAY_MIN;
export const MOON_DAY_MAX = LUNAR_DAY_MAX;
export const MOON_DAY_DEFAULT = 3;

/** 달 보기(moon)를 쓰는 과제인가. */
export const isMoonView = (task: ObservationTask): boolean => task.view === 'moon';

export const clampMoonDay = (d: number): number => Math.min(MOON_DAY_MAX, Math.max(MOON_DAY_MIN, Math.round(d)));

export const moonDayLabel = (d: number): string => `음력 ${d}일`;

/**
 * 밝은 부분의 모양(SVG path). 중심 (cx, cy), 반지름 r.
 * 위아래 끝점을 잇는 바깥 반원 하나와, 밝고 어두운 경계(타원 반쪽)로 이루어진다.
 * waxing이면 오른쪽(서쪽)이 밝고, 아니면 왼쪽(동쪽)이 밝다.
 */
export function moonLitPath(cx: number, cy: number, r: number, frac: number, waxing: boolean): string {
  const k = 1 - 2 * frac; // cos φ: 0보다 크면 초승·그믐 쪽(밝은 부분이 반달보다 좁음)
  const rx = Math.max(0.01, r * Math.abs(k));
  const outer = waxing ? 1 : 0;
  const inner = k > 0 === waxing ? 0 : 1;
  const f = (n: number) => n.toFixed(2);
  return `M${f(cx)},${f(cy - r)} A${f(r)},${f(r)} 0 0 ${outer} ${f(cx)},${f(cy + r)} A${f(rx)},${f(r)} 0 0 ${inner} ${f(cx)},${f(cy - r)} Z`;
}

/** 달 지름 방향으로 잰 밝은 부분의 길이(지름이 2r일 때 2r·frac). */
export const litWidth = (r: number, frac: number): number => 2 * r * frac;

export interface MoonScene extends MoonDay {
  side: ReturnType<typeof sideOf>;
  /** 밝은 쪽: 오른쪽(서쪽)인가 왼쪽(동쪽)인가. */
  litSide: '오른쪽' | '왼쪽';
  percent: number;
  /** 모양 이름은 화면 문구에 쓰지 않는다. 기록을 마친 뒤에만 shapeNote로 보여 준다. */
  groundCaption: string;
  spaceCaption: string;
  groundAria: string;
  spaceAria: string;
  hiddenNote: string;
}

export const MOON_HIDDEN_NOTE = '이 시각에는 달이 보이지 않아요';

export function moonScene(exp: ObservationExperiment, day: number): MoonScene {
  const m = moonDay(day, latOf(exp));
  const side = sideOf(m.pos.azDeg);
  const litSide = m.waxing ? '오른쪽' : '왼쪽';
  const percent = Math.round(m.frac * 100);
  const label = moonDayLabel(day);
  const bright = percent >= 99 ? `밝은 부분은 달 전체의 약 ${percent}%예요` : `밝은 부분은 달 전체의 약 ${percent}%이고 ${litSide}이 밝아요`;
  const groundCaption = m.visible
    ? `${label} 저녁 7시 · 달은 ${side} 하늘에 있고 ${bright}`
    : `${label} 저녁 7시 · 달이 지평선 아래에 있어서 보이지 않아요`;
  const groundAria = m.visible
    ? `땅에서 보기: ${label} 저녁 7시 남쪽 하늘. 달은 ${side} 하늘, 높이 약 ${Math.round(m.pos.altDeg)}도에 있고 ${bright}`
    : `땅에서 보기: ${label} 저녁 7시 남쪽 하늘. ${MOON_HIDDEN_NOTE}`;
  const spaceCaption = `${label} · 북극 위에서 본 태양, 지구, 달`;
  const spaceAria = `우주에서 보기: ${label}, 북극 위에서 본 태양, 지구, 달. 태양은 왼쪽에 있고 달은 지구 둘레를 돌며 언제나 태양 쪽 반이 밝아요`;
  return { ...m, side, litSide, percent, groundCaption, spaceCaption, groundAria, spaceAria, hiddenNote: MOON_HIDDEN_NOTE };
}
