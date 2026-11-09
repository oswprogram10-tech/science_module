import type { ReactNode } from 'react';

/**
 * 혼합물 카드 그림(혼합물의 분리 두 번째 활동). 두 재료를 섞어 쌓아 놓은 모습을 단순한 도형으로 그리고 글자는 넣지 않는다
 * (그림은 장식이라 스크린 리더에는 읽히지 않는다). 윤곽선은 currentColor, 채움색은 두 배경 모두에서 보이는 중간 밝기를 쓴다.
 *  - 콩과 좁쌀: 큰 갈색 콩과 작은 노란 알갱이 / 쌀과 모래: 흰 쌀알과 고운 갈색 모래
 *  - 철 가루와 모래: 어두운 회색 가루와 갈색 모래 / 철 구슬과 유리 구슬: 크기가 같은 어두운 공과 하늘색 공
 *  - 소금과 모래: 흰 네모 알갱이와 갈색 모래 / 설탕과 콩: 작은 흰 알갱이와 큰 갈색 콩
 *
 * 기본 그림은 두 재료가 섞여 있을 뿐이라 어떤 성질도 드러내지 않는다.
 * 시험한 특징(shown)에 대해서만 결과 그림이 겹쳐진다: 크기 비교선(두 알갱이의 너비를 나란히 잰 선),
 * 자석(붙는 혼합물은 자석 끝에 어두운 알갱이가 달라붙음), 물에 넣기(물이 담긴 비커 바닥에 가라앉거나, 녹는 재료는 보이지 않게 됨).
 * 시험하지 않은 특징의 결과는 그림에 그려지지 않는다.
 */
const S = { stroke: 'currentColor', strokeWidth: 0.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const ORANGE = '#e06a00';

type Pt = readonly [number, number];
type Rot = readonly [number, number, number];

/** 큰 알갱이를 놓는 자리. */
const BIG: Pt[] = [[20, 52], [30, 54], [41, 52], [26, 45], [37, 46], [31, 38]];
/** 작은 알갱이를 놓는 자리. */
const SMALL: Pt[] = [
  [16, 56], [24, 57], [35, 57], [46, 56], [50, 52], [14, 52], [44, 45], [48, 48], [20, 46],
  [22, 40], [28, 41], [38, 40], [42, 40], [33, 31], [26, 35], [37, 34],
];
/** 아주 고운 가루 두 종류를 번갈아 놓는 자리(같은 크기). */
const FINE_A: Pt[] = [[18, 55], [28, 56], [38, 55], [47, 54], [22, 48], [33, 49], [43, 47], [27, 41], [36, 41], [32, 34]];
const FINE_B: Pt[] = [[23, 56], [33, 56], [43, 56], [17, 51], [28, 52], [38, 51], [48, 50], [22, 43], [32, 44], [41, 42], [31, 37]];
/** 크기가 같은 구슬 두 종류의 자리. */
const BALL_A: Pt[] = [[22, 51], [38, 51], [30, 40]];
const BALL_B: Pt[] = [[30, 53], [46, 51], [38, 40]];

const dots = (pts: Pt[], r: number, fill: string, opacity = 1): ReactNode =>
  pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={r} fill={fill} fillOpacity={opacity} />);
const ovals = (pts: Pt[], rx: number, ry: number, fill: string): ReactNode =>
  pts.map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx={rx} ry={ry} fill={fill} transform={`rotate(${(i * 47) % 90 - 30} ${x} ${y})`} />);
const squares = (pts: Pt[], side: number, fill: string): ReactNode =>
  pts.map(([x, y], i) => (
    <rect key={i} x={x - side / 2} y={y - side / 2} width={side} height={side} fill={fill} transform={`rotate(${(i * 31) % 70} ${x} ${y})`} />
  ));
const rice = (pts: Pt[]): ReactNode =>
  pts.map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx={3.4} ry={1.6} fill="#fbf8ef" transform={`rotate(${(i * 53) % 150 - 60} ${x} ${y})`} />);

/** 재료 a와 b. 기본 그림은 둘 다 그린다. */
const LAYERS: Record<string, { a: ReactNode; b: ReactNode }> = {
  'mix-bean-millet': {
    a: ovals(BIG, 4.2, 3, '#9a5b2e'),
    b: dots(SMALL, 1.15, '#e8c23a'),
  },
  'mix-rice-sand': {
    a: rice([[20, 52], [30, 54], [41, 52], [26, 45], [37, 46], [31, 38], [46, 46], [16, 47]]),
    b: dots(SMALL, 1, '#b8946a'),
  },
  'mix-iron-sand': {
    a: dots(FINE_A, 1.4, '#4a4f55'),
    b: dots(FINE_B, 1.4, '#c9a46c'),
  },
  'mix-iron-glass': {
    a: dots(BALL_A, 4.3, '#5c636b'),
    b: dots(BALL_B, 4.3, '#8fd0e8', 0.7),
  },
  'mix-salt-sand': {
    a: squares(FINE_A, 2.6, '#f4f6f8'),
    b: dots(FINE_B, 1.4, '#c9a46c'),
  },
  'mix-sugar-bean': {
    a: squares(SMALL, 2.3, '#f4f6f8'),
    b: ovals(BIG.slice(0, 5), 4.2, 3, '#9a5b2e'),
  },
};

/**
 * 시험 결과(사양 §나.1 표와 같다): 두 알갱이의 크기가 다른가, 한 가지가 자석에 붙는가, 한 가지만 물에 녹는가.
 * 시험한 특징에 대해서만 그림에 쓰인다. 매니페스트의 카드 특징값과 같은지 단위 테스트가 확인한다.
 */
export const MIXTURE_RESULT: Record<string, { size: boolean; magnet: boolean; dissolve: boolean }> = {
  'mix-bean-millet': { size: true, magnet: false, dissolve: false },
  'mix-rice-sand': { size: true, magnet: false, dissolve: false },
  'mix-iron-sand': { size: false, magnet: true, dissolve: false },
  'mix-iron-glass': { size: false, magnet: true, dissolve: false },
  'mix-salt-sand': { size: false, magnet: false, dissolve: true },
  'mix-sugar-bean': { size: true, magnet: false, dissolve: true },
};

/** 크기 비교선의 길이(두 알갱이의 너비를 같은 배율로 잰 값). 길이가 다르면 크기가 다른 혼합물이다. */
export const MIXTURE_SIZE_BARS: Record<string, [number, number]> = {
  'mix-bean-millet': [25, 7],
  'mix-rice-sand': [20, 6],
  'mix-iron-sand': [8, 8],
  'mix-iron-glass': [24, 24],
  'mix-salt-sand': [8, 8],
  'mix-sugar-bean': [25, 7],
};

/** 물에 녹는 재료(없으면 null). */
export const MIXTURE_DISSOLVES: Record<string, 'a' | 'b' | null> = {
  'mix-bean-millet': null,
  'mix-rice-sand': null,
  'mix-iron-sand': null,
  'mix-iron-glass': null,
  'mix-salt-sand': 'a',
  'mix-sugar-bean': 'a',
};

export const MIXTURE_ICON_KEYS = Object.keys(LAYERS);

const STUCK: Pt[] = [[45, 19], [48, 21.5], [44, 22.5], [61, 19], [58, 21.5], [62, 22.5]];

export function MixtureIcon({ icon, size = 56, shown = [] }: { icon: string; size?: number; shown?: string[] }) {
  const layers = LAYERS[icon];
  const truth = MIXTURE_RESULT[icon];
  const bars = MIXTURE_SIZE_BARS[icon];
  const showSize = !!truth && !!bars && shown.includes('size');
  const showMagnet = !!truth && shown.includes('magnet');
  const showWater = !!truth && shown.includes('dissolve');
  const gone = showWater ? MIXTURE_DISSOLVES[icon] : null;

  let pile: ReactNode = (
    <g {...S}>
      {layers?.a}
      {layers?.b}
    </g>
  );
  if (showWater && layers) {
    const kept = gone === 'a' ? layers.b : gone === 'b' ? layers.a : null;
    pile = (
      <>
        <g className="mix-result mix-beaker" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="17" y="34" width="32" height="23" fill="#6bbcf2" fillOpacity="0.35" stroke="none" />
          <path d="M17 34 Q25 31.5 33 34 T49 34" stroke="#1d6fb0" strokeWidth="1.4" />
          <path d="M15 26 L15 58 L51 58 L51 26" />
        </g>
        {gone ? (
          <>
            <g className="mix-result mix-gone" fill="none" stroke="#1d6fb0" strokeWidth="1.1" strokeDasharray="1.5 2.5" strokeLinecap="round">
              <ellipse cx="33" cy="46" rx="12" ry="6" fill="#ffffff" fillOpacity="0.14" />
            </g>
            <g transform="translate(10.8 22.2) scale(0.6)" {...S}>{kept}</g>
          </>
        ) : (
          <g className="mix-result mix-settle" transform="translate(10.8 22.2) scale(0.6)" {...S}>
            {layers.a}
            {layers.b}
          </g>
        )}
      </>
    );
  }

  return (
    <svg className="animal-icon mixture-icon" viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" focusable="false">
      {layers ? pile : <circle cx="32" cy="32" r="20" fill="none" stroke="currentColor" strokeWidth="2.5" />}
      {showSize && bars && (
        <g className="mix-result mix-size" fill="none" stroke={ORANGE} strokeWidth="2.6" strokeLinecap="round">
          <path className="mix-size-a" data-length={bars[0]} d={`M4 5 L${4 + bars[0]} 5`} />
          <path className="mix-size-b" data-length={bars[1]} d={`M4 12 L${4 + bars[1]} 12`} />
        </g>
      )}
      {showMagnet && truth && (
        <g className="mix-result mix-magnet">
          <path d="M46 16 L46 9 A7.5 7.5 0 0 1 61 9 L61 16" fill="none" stroke="#d9453d" strokeWidth="5" />
          <path d="M46 16 L46 18 M61 16 L61 18" fill="none" stroke="#c4ced8" strokeWidth="5" />
          {truth.magnet && (
            <g className="mix-stuck" stroke="currentColor" strokeWidth="0.6">
              {dots(STUCK, 1.5, '#4a4f55')}
            </g>
          )}
        </g>
      )}
    </svg>
  );
}
