import type { ReactNode } from 'react';

/**
 * 화산에서 나오는 것 카드 그림(땅의 변화 세 번째 활동). 화산과 화산 모형을 단순한 도형으로 그리고 글자는 넣지 않는다
 * (그림은 장식이라 스크린 리더에는 읽히지 않는다). 윤곽선은 currentColor, 채움색은 두 배경 모두에서 보이는 중간 밝기를 쓴다.
 *  - 화산 가스·용암·화산재·화산 암석 조각: 산 모양 화산 / 모형 넷: 쟁반 위의 작은 산 모양 모형
 *
 * 기본 그림은 장면만 보여 주고 어떤 특징의 결과도 드러내지 않는다. 그림 위쪽 띠(y < 15)는 비워 둔다.
 * 살펴본 특징(shown)에 대해서만 이 띠에 주황색 돋보기 확대 원이 겹쳐진다(칸마다 원 하나).
 *  - source(사진 설명 읽기): 왼쪽 원. 큰 산이면 실제 화산, 쟁반 위의 작은 산이면 화산 모형이다.
 *  - shape(돋보기로 보기): 가운데 원. 네모 조각이면 모양이 일정한 것이고, 물결선이면 일정하지 않은 것이다.
 *  - flow(흘러가는 모습 지켜보기): 오른쪽 원. 비스듬한 선 아래로 물방울이 떨어지면 흘러내리는 것이고, 선 위에 가만히 있는 점이면 아니다.
 * 시험하지 않은 특징의 결과는 그림에 그려지지 않는다.
 */
const S = { stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const ORANGE = '#e06a00';
const ROCK = '#8d8a86';
const SMOKE = '#c3c8cd';
const MELT = '#d9462b';

/** 실제 화산(큰 산)과 화산 모형(쟁반 위의 작은 산). */
const real = (): ReactNode => <path d="M4 58 L22 28 H42 L60 58 Z" fill="#9b8470" />;
const model = (): ReactNode => (
  <g>
    <rect x="6" y="54" width="52" height="5" rx="1.5" fill="#b9c2c9" />
    <path d="M14 54 L25 34 H39 L50 54 Z" fill="#c99a7a" />
  </g>
);

const dots = (pts: number[][], r: number, fill: string): ReactNode => pts.map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill={fill} stroke="none" />);

const ICONS: Record<string, ReactNode> = {
  'vc-gas': (
    <g {...S}>
      {real()}
      <path d="M32 28 Q26 22 31 18 Q36 21 33 25 M33 25 Q40 22 38 17" fill="none" stroke={SMOKE} strokeWidth={3.4} />
      <path d="M24 17 Q20 20 25 22" fill="none" stroke={SMOKE} strokeWidth={3} />
    </g>
  ),
  'vc-lava': (
    <g {...S}>
      {real()}
      <path d="M28 28 L32 31 L29 38 L35 46 L31 58 H37 L42 46 L36 37 L38 29 Z" fill={MELT} strokeWidth={1.2} />
      <path d="M26 24 L28 28 M38 24 L36 28 M32 20 V27" stroke={MELT} strokeWidth={2} />
    </g>
  ),
  'vc-ash': (
    <g {...S}>
      <path d="M8 24 Q4 24 5 20 Q6 15 12 17 Q15 11 22 14 Q28 10 33 15 Q40 14 41 20 Q47 20 46 24 Z" fill="#b2b5ba" strokeWidth={1.4} />
      <path d="M6 58 H58" />
      <path d="M12 58 V48 H24 V58 M16 48 L18 43 L22 48 M34 58 V46 H48 V58 M38 46 L41 41 L45 46" fill="#d8cdbb" strokeWidth={1.4} />
      {dots([[10, 32], [18, 36], [26, 30], [32, 38], [40, 33], [48, 38], [14, 44], [28, 44], [52, 30], [22, 52], [42, 54]], 1.2, '#6d6a66')}
    </g>
  ),
  'vc-rock': (
    <g {...S}>
      <path d="M4 58 L22 28 H42 L60 58 Z" fill="#9b8470" strokeWidth={1.4} />
      <path d="M14 52 L18 46 L25 47 L27 53 Z" fill={ROCK} strokeWidth={1.4} />
      <path d="M30 44 L35 39 L41 42 L40 49 L33 50 Z" fill="#6f6c68" strokeWidth={1.4} />
      <path d="M43 56 L47 50 L53 53 L51 58 Z" fill={ROCK} strokeWidth={1.4} />
      {dots([[20, 51], [36, 44], [47, 54]], 1, '#3e3c3a')}
    </g>
  ),
  'vc-m-smoke': (
    <g {...S}>
      {model()}
      <path d="M32 34 Q27 29 31 25 Q36 28 33 31 M33 31 Q39 28 37 23" fill="none" stroke={SMOKE} strokeWidth={3.2} />
    </g>
  ),
  'vc-m-flow': (
    <g {...S}>
      {model()}
      <path d="M28 34 L31 38 L28 44 L32 50 L30 54 H36 L38 48 L34 42 L36 35 Z" fill={MELT} strokeWidth={1.2} />
    </g>
  ),
  'vc-m-piece': (
    <g {...S}>
      {model()}
      <path d="M8 54 L11 49 L16 50 L16 54 Z M46 54 L49 48 L55 50 L54 54 Z" fill={ROCK} strokeWidth={1.3} />
      <path d="M24 28 L30 24 L35 27 L33 32 Z" fill={ROCK} strokeWidth={1.3} />
    </g>
  ),
  'vc-m-powder': (
    <g {...S}>
      {model()}
      {dots([[10, 51], [13, 53], [17, 52], [47, 52], [51, 50], [54, 53], [44, 53], [20, 53], [56, 51], [8, 53]], 1.1, '#6d6a66')}
      {dots([[28, 29], [33, 27], [37, 30], [31, 31]], 1, '#6d6a66')}
    </g>
  ),
};

/**
 * 살펴본 결과(사양 §3 표와 같다): 나온 곳(real/model), 알갱이나 조각의 모양이 일정한가(keep), 땅 위를 따라 흘러내리는가.
 * 살펴본 특징에 대해서만 그림에 쓰인다. 매니페스트의 카드 특징값과 같은지 단위 테스트가 확인한다.
 */
export const VOLCANO_RESULT: Record<string, { source: 'real' | 'model'; shape: 'keep' | 'change'; flow: boolean }> = {
  'vc-gas': { source: 'real', shape: 'change', flow: false },
  'vc-lava': { source: 'real', shape: 'change', flow: true },
  'vc-ash': { source: 'real', shape: 'keep', flow: false },
  'vc-rock': { source: 'real', shape: 'keep', flow: false },
  'vc-m-smoke': { source: 'model', shape: 'change', flow: false },
  'vc-m-flow': { source: 'model', shape: 'change', flow: true },
  'vc-m-piece': { source: 'model', shape: 'keep', flow: false },
  'vc-m-powder': { source: 'model', shape: 'keep', flow: false },
};

export const VOLCANO_ICON_KEYS = Object.keys(ICONS);

export function VolcanoIcon({ icon, size = 56, shown = [] }: { icon: string; size?: number; shown?: string[] }) {
  const scene = ICONS[icon];
  const truth = VOLCANO_RESULT[icon];
  const lens = (cx: number) => <circle cx={cx} cy="8" r="6.6" fill="#ffffff" fillOpacity={0.55} />;
  const common = { fill: 'none', stroke: ORANGE, strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

  return (
    <svg className="animal-icon volcano-icon" viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" focusable="false">
      {scene ?? <circle cx="32" cy="32" r="20" fill="none" stroke="currentColor" strokeWidth="2.5" />}
      {truth && shown.includes('source') && (
        <g className="vc-result vc-source" data-source={truth.source} {...common}>
          {lens(12)}
          {truth.source === 'real' ? <path d="M6.5 12 L12 3.5 L17.5 12 Z" /> : <path d="M8.5 10.5 L12 5.5 L15.5 10.5 Z M6.5 13 H17.5" />}
        </g>
      )}
      {truth && shown.includes('shape') && (
        <g className="vc-result vc-shape" data-shape={truth.shape} {...common}>
          {lens(32)}
          {truth.shape === 'keep' ? <rect x="28" y="4" width="8" height="8" /> : <path d="M26.5 8 Q29 3 32 8 T37.5 8" />}
        </g>
      )}
      {truth && shown.includes('flow') && (
        <g className="vc-result vc-flow" data-flow={truth.flow ? 'true' : 'false'} {...common}>
          {lens(52)}
          <path d="M47 5 L57 8" />
          {truth.flow ? <path d="M53 9.5 V13 M56.5 9.5 V12.5" /> : <circle cx="50.5" cy="5.6" r="1" fill={ORANGE} stroke="none" />}
        </g>
      )}
    </svg>
  );
}
