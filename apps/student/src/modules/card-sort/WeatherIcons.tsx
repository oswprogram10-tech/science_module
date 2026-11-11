import type { ReactNode } from 'react';

/**
 * 이슬·안개·구름 카드 그림(날씨와 우리 생활 두 번째 활동). 장면을 단순한 도형으로 그리고 글자는 넣지 않는다
 * (그림은 장식이라 스크린 리더에는 읽히지 않는다). 윤곽선은 currentColor, 채움색은 두 배경 모두에서 보이는 중간 밝기를 쓴다.
 *  - 아침 풀잎에 맺힌 물방울: 풀잎 위의 물방울 / 차가운 컵 겉에 맺힌 물방울: 컵 겉의 물방울
 *  - 겨울 아침 창문 안쪽에 맺힌 물방울: 창유리의 물방울
 *  - 새벽 강가를 덮은 뿌연 공기: 강 위에 낮게 깔린 회색 안개 층 / 산골짜기에 낮게 깔린 뿌연 공기: 골짜기 바닥의 회색 층
 *  - 하얀 구름: 하늘에 뜬 하얀 덩어리 / 비행기 창밖으로 보이는 구름: 비행기 창과 날개 너머의 구름 / 먹구름: 하늘을 덮은 어두운 덩어리
 *
 * 기본 그림은 장면만 보여 주고 어떤 특징의 결과도 드러내지 않는다. 그림 위쪽 띠(y < 15)와 오른쪽 눈금자(x > 53)는 비워 둔다.
 * 살펴본 특징(shown)에 대해서만 주황색 결과 표시가 겹쳐진다.
 *  - surface(만져 보기): 왼쪽 위의 판과 물방울. 물방울이 판에 닿아 있으면 붙어 있는 것이고, 떨어져 있으면 붙어 있지 않은 것이다.
 *  - air(주변 공기 살펴보기): 위쪽 가운데의 점선 원(주변 공기). 원 안에 알갱이가 흩어져 떠 있으면 공기 중에 떠 있는 것이고, 비어 있으면 아니다.
 *  - high(올려다보기): 오른쪽 눈금자와 표시 화살표. 화살표가 눈금자의 위쪽 절반에 있으면 높은 하늘에 있는 것이다.
 * 시험하지 않은 특징의 결과는 그림에 그려지지 않는다.
 */
const S = { stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const ORANGE = '#e06a00';
const DROP = '#6bbcf2';
const SKY = '#7fc3ee';

/** 장면 안의 물방울 하나. */
const drop = (x: number, y: number, r = 2.3): ReactNode => <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill={DROP} fillOpacity={0.85} strokeWidth={1.1} />;

/** 구름 모양(오른쪽 아래가 둥근 한 덩어리). 가로 약 30, 세로 약 20. */
const CLOUD = 'M14 42 H44 A7 7 0 0 0 44 28 A10 10 0 0 0 26 24 A9 9 0 0 0 14 42 Z';

const haze = (items: Array<[number, number, number, number]>): ReactNode =>
  items.map(([cx, cy, rx, ry], i) => <ellipse key={i} cx={cx} cy={cy} rx={rx} ry={ry} fill="#b9c1c9" fillOpacity={0.8} stroke="none" />);

const blade = (x: number, tip: number): ReactNode => (
  <path key={x} d={`M${x} 58 Q${x - 1} ${tip + 16} ${x + 6} ${tip} Q${x + 7} ${tip + 18} ${x + 9} 58 Z`} fill="#58a14f" strokeWidth={1.4} />
);

const ICONS: Record<string, ReactNode> = {
  'wx-grass-drops': (
    <g {...S}>
      <path d="M4 58 H52" />
      {blade(12, 24)}
      {blade(24, 18)}
      {blade(36, 26)}
      {drop(17, 33)}
      {drop(19, 41, 2)}
      {drop(30, 28)}
      {drop(31, 37, 2.6)}
      {drop(42, 35)}
    </g>
  ),
  'wx-cup-drops': (
    <g {...S}>
      <path d="M6 58 H50" />
      <path d="M18 22 L46 22 L42 56 L22 56 Z" fill="#c4e4f7" fillOpacity={0.45} />
      {drop(17.6, 31)}
      {drop(19, 41, 2)}
      {drop(21, 50)}
      {drop(46, 31, 2)}
      {drop(44, 42)}
      {drop(42.6, 51, 2)}
    </g>
  ),
  'wx-window-drops': (
    <g {...S}>
      <rect x="9" y="18" width="42" height="40" fill="#cfe8f5" fillOpacity={0.4} />
      <path d="M30 18 V58 M9 38 H51" />
      {drop(16, 25, 1.8)}
      {drop(22, 30, 2)}
      {drop(18, 33, 1.6)}
      {drop(38, 24, 2)}
      {drop(44, 29, 1.8)}
      {drop(15, 46, 2)}
      {drop(24, 51, 1.8)}
      {drop(38, 45, 1.8)}
      {drop(45, 52, 2)}
    </g>
  ),
  'wx-river-haze': (
    <g {...S}>
      <path d="M4 40 L14 30 L24 38 L34 28 L44 38 L52 33" fill="none" strokeOpacity={0.55} />
      <path d="M4 48 Q10 46 16 48 T28 48 T40 48 T52 48 V58 H4 Z" fill={DROP} fillOpacity={0.4} />
      {haze([[14, 45, 11, 6], [27, 41, 13, 7], [40, 45, 12, 6], [22, 50, 12, 4], [38, 50, 12, 4]])}
    </g>
  ),
  'wx-valley-haze': (
    <g {...S}>
      <path d="M4 58 L16 24 L30 50 L44 22 L53 58 Z" fill="#8fa77f" fillOpacity={0.85} />
      {haze([[30, 53, 15, 5], [30, 48, 9, 4]])}
    </g>
  ),
  'wx-white-cloud': (
    <g {...S}>
      <rect x="4" y="17" width="48" height="42" rx="4" fill={SKY} fillOpacity={0.3} strokeWidth={1} />
      <path d={CLOUD} transform="translate(5 12) scale(0.85)" fill="#f4f6f8" />
    </g>
  ),
  'wx-plane-cloud': (
    <g {...S}>
      <rect x="9" y="17" width="38" height="42" rx="15" fill={SKY} fillOpacity={0.35} strokeWidth={2.4} />
      <path d={CLOUD} transform="translate(11 21) scale(0.6)" fill="#f4f6f8" />
      <path d="M26 58 L47 47 L47 58 Z" fill="#9aa5b0" strokeWidth={1.4} />
    </g>
  ),
  'wx-dark-cloud': (
    <g {...S}>
      <rect x="4" y="17" width="48" height="42" rx="4" fill="#5b6572" fillOpacity={0.35} strokeWidth={1} />
      <path d="M8 40 H48 A8 8 0 0 0 48 25 A12 12 0 0 0 26 22 A10 10 0 0 0 8 40 Z" transform="translate(-2 9) scale(0.9)" fill="#6b7480" />
    </g>
  ),
};

/**
 * 살펴본 결과(사양 §1 표와 같다): 물체 겉에 붙어 있나, 공기 중에 떠 있나, 높은 하늘에 있나.
 * 살펴본 특징에 대해서만 그림에 쓰인다. 매니페스트의 카드 특징값과 같은지 단위 테스트가 확인한다.
 */
export const WEATHER_RESULT: Record<string, { surface: boolean; air: boolean; high: boolean }> = {
  'wx-grass-drops': { surface: true, air: false, high: false },
  'wx-cup-drops': { surface: true, air: false, high: false },
  'wx-window-drops': { surface: true, air: false, high: false },
  'wx-river-haze': { surface: false, air: true, high: false },
  'wx-valley-haze': { surface: false, air: true, high: false },
  'wx-white-cloud': { surface: false, air: true, high: true },
  'wx-plane-cloud': { surface: false, air: true, high: true },
  'wx-dark-cloud': { surface: false, air: true, high: true },
};

/** 눈금자 위 표시 화살표의 세로 위치(그림 좌표, 눈금자는 y 18~58). 위쪽 절반(y < 38)이면 높은 하늘이다. */
export const WEATHER_HEIGHT_MARK: Record<string, number> = {
  'wx-grass-drops': 54,
  'wx-cup-drops': 54,
  'wx-window-drops': 52,
  'wx-river-haze': 54,
  'wx-valley-haze': 52,
  'wx-white-cloud': 24,
  'wx-plane-cloud': 20,
  'wx-dark-cloud': 28,
};
export const WEATHER_RULER = { top: 18, bottom: 58, mid: 38 } as const;

export const WEATHER_ICON_KEYS = Object.keys(ICONS);

export function WeatherIcon({ icon, size = 56, shown = [] }: { icon: string; size?: number; shown?: string[] }) {
  const scene = ICONS[icon];
  const truth = WEATHER_RESULT[icon];
  const markY = WEATHER_HEIGHT_MARK[icon];
  const showSurface = !!truth && shown.includes('surface');
  const showAir = !!truth && shown.includes('air');
  const showHigh = !!truth && markY !== undefined && shown.includes('high');
  const ticks = [18, 28, 38, 48, 58];

  return (
    <svg className="animal-icon weather-icon" viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" focusable="false">
      {scene ?? <circle cx="32" cy="32" r="20" fill="none" stroke="currentColor" strokeWidth="2.5" />}
      {showSurface && truth && (
        <g className="wx-result wx-surface" data-attached={truth.surface ? 'true' : 'false'} fill="none" stroke={ORANGE} strokeWidth="2.6" strokeLinecap="round">
          <path d="M4 13 H24" />
          <circle cx="14" cy={truth.surface ? 8.7 : 4.5} r="3" fill={ORANGE} stroke="none" />
        </g>
      )}
      {showAir && truth && (
        <g className="wx-result wx-air" data-floating={truth.air ? 'true' : 'false'} fill="none" stroke={ORANGE} strokeWidth="1.6" strokeLinecap="round">
          <circle cx="40" cy="8" r="6.5" strokeDasharray="2.2 2.6" />
          {truth.air && (
            <g className="wx-floating" fill={ORANGE} stroke="none">
              <circle cx="37" cy="7" r="1.4" />
              <circle cx="42.4" cy="5.4" r="1.4" />
              <circle cx="41" cy="10.6" r="1.4" />
            </g>
          )}
        </g>
      )}
      {showHigh && truth && markY !== undefined && (
        <g className="wx-result wx-high" data-mark-y={markY} fill="none" stroke={ORANGE} strokeWidth="2" strokeLinecap="round">
          <path d={`M58 ${WEATHER_RULER.top} V${WEATHER_RULER.bottom}`} />
          {ticks.map((t) => (
            <path key={t} d={`M56 ${t} H60`} />
          ))}
          <path d={`M52.5 ${markY} L57 ${markY - 3.2} L57 ${markY + 3.2} Z`} fill={ORANGE} />
        </g>
      )}
    </svg>
  );
}
