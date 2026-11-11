import type { ReactNode } from 'react';

/**
 * 변하기 전과 후 카드 그림(물질의 연소 세 번째 활동). 장면을 단순한 도형으로 그리고 글자는 넣지 않는다
 * (그림은 장식이라 스크린 리더에는 읽히지 않는다). 윤곽선은 currentColor, 채움색은 두 배경 모두에서 보이는 중간 밝기를 쓴다.
 * 변화의 이름(화학 변화·물리 변화)은 그림에도 화면에도 쓰지 않는다.
 *
 * 기본 그림은 장면만 보여 주고 어떤 특징의 결과도 드러내지 않는다. 그림 위쪽 띠(y < 15)는 비워 둔다.
 * 살펴본 특징(shown)에 대해서만 이 띠에 주황색 돋보기 확대 원이 겹쳐진다(칸마다 원 하나, 특징이 둘이라 왼쪽과 오른쪽).
 *  - newprop(변하기 전과 후 견주어 보기): 왼쪽 원. 화살표 앞뒤가 같은 모양이면 새 성질이 생기지 않은 것이고, 다른 모양이면 생긴 것이다.
 *  - heat(어떻게 했는지 읽기): 오른쪽 원. 불꽃이면 열을 가한 것이고, 빗금 친 불꽃이면 가하지 않은 것이다.
 * 시험하지 않은 특징의 결과는 그림에 그려지지 않는다.
 */
const S = { stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const ORANGE = '#e06a00';
const WATER = '#7fc3ee';
const WAX = '#efe6c8';

const flame = (x: number, y: number): ReactNode => <path d={`M${x} ${y} Q${x - 4} ${y - 5} ${x} ${y - 11} Q${x + 1} ${y - 6} ${x + 3} ${y - 8} Q${x + 5} ${y - 3} ${x} ${y} Z`} fill="#f2a33a" strokeWidth={1.2} />;

const ICONS: Record<string, ReactNode> = {
  'pc-paper-cut': (
    <g {...S}>
      <rect x="10" y="26" width="22" height="28" fill="#f7f7f2" />
      <rect x="36" y="26" width="18" height="28" fill="#f7f7f2" />
      <path d="M34 22 V58" strokeDasharray="2 3" strokeWidth={1.2} />
    </g>
  ),
  'pc-paper-burn': (
    <g {...S}>
      <path d="M16 54 V34 H44 V54 Z" fill="#4b4947" />
      <path d="M16 34 L22 38 L28 32 L34 38 L40 31 L44 34" fill="#f7f7f2" strokeWidth={1.4} />
      {flame(26, 32)}
      {flame(38, 30)}
    </g>
  ),
  'pc-ice-melt': (
    <g {...S}>
      <rect x="10" y="30" width="18" height="18" rx="2" fill="#c9e6f5" />
      <path d="M32 48 H56 V44 Q44 38 32 44 Z" fill={WATER} fillOpacity={0.8} />
      <path d="M30 54 H58" strokeWidth={1.4} />
    </g>
  ),
  'pc-sugar-water': (
    <g {...S}>
      <path d="M16 26 L19 56 H45 L48 26 Z" fill={WATER} fillOpacity={0.45} />
      <path d="M28 18 L36 36" strokeWidth={2.4} stroke="#a9b4bd" />
      {[[26, 52], [31, 54], [36, 52], [40, 54]].map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="2.4" height="2.4" fill="#ffffff" stroke="none" />
      ))}
    </g>
  ),
  'pc-egg': (
    <g {...S}>
      <path d="M32 18 C42 18 46 32 44 42 C42 52 22 52 20 42 C18 32 22 18 32 18 Z" fill="#f4f0e4" />
      <ellipse cx="32" cy="38" rx="6" ry="6.4" fill="#f2c94c" strokeWidth={1.2} />
      <path d="M14 58 H50" strokeWidth={1.4} />
    </g>
  ),
  'pc-nail': (
    <g {...S}>
      <path d="M12 54 L40 24 L44 28 L16 58 Z" fill="#9aa1a8" />
      <rect x="38" y="19" width="10" height="5" rx="1" transform="rotate(42 43 21.5)" fill="#9aa1a8" />
      {[[22, 46], [28, 42], [34, 36], [18, 52], [26, 50]].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="1.5" fill="#b0562c" stroke="none" />
      ))}
    </g>
  ),
  'pc-clay': (
    <g {...S}>
      <path d="M8 50 Q6 40 16 38 Q22 30 30 36 Q38 28 44 38 Q56 38 54 48 Q52 56 40 54 H16 Q10 56 8 50 Z" fill="#b07a55" />
      <path d="M20 46 H30 M36 44 H46" strokeWidth={1.2} />
    </g>
  ),
  'pc-milk': (
    <g {...S}>
      <path d="M18 24 L20 56 H44 L46 24 Z" fill="#f6f4ea" />
      <path d="M18 24 H46" />
      <path d="M24 34 Q28 30 31 34 M33 40 Q37 36 40 40 M25 46 Q29 42 32 46" fill="none" stroke="#c9b86a" strokeWidth={1.6} />
      <path d="M30 20 Q26 16 30 12" fill="none" strokeWidth={1.2} stroke="#8aa05a" />
    </g>
  ),
  'pc-candle-burn': (
    <g {...S}>
      <rect x="24" y="34" width="16" height="22" rx="1.5" fill={WAX} />
      <path d="M32 34 V30" strokeWidth={1.4} />
      {flame(32, 30)}
      <path d="M40 24 Q44 20 41 16" fill="none" stroke="#6d6a66" strokeWidth={1.6} />
    </g>
  ),
  'pc-candle-melt': (
    <g {...S}>
      <path d="M24 34 H40 V56 H24 Z" fill={WAX} />
      <path d="M24 34 Q24 42 27 42 Q29 42 29 36 M34 34 Q34 48 37 48 Q40 48 40 38" fill={WAX} strokeWidth={1.4} />
      <path d="M32 34 V29" strokeWidth={1.4} />
      <path d="M44 56 Q48 50 52 56 Z" fill={WAX} strokeWidth={1.4} />
    </g>
  ),
};

/**
 * 살펴본 결과(사양 §4 표와 같다): 처음 물질에 없던 성질이 생겼는가, 열을 가했는가.
 * 살펴본 특징에 대해서만 그림에 쓰인다. 매니페스트의 카드 특징값과 같은지 단위 테스트가 확인한다.
 */
export const PROPERTY_RESULT: Record<string, { newprop: boolean; heat: boolean }> = {
  'pc-paper-cut': { newprop: false, heat: false },
  'pc-paper-burn': { newprop: true, heat: true },
  'pc-ice-melt': { newprop: false, heat: true },
  'pc-sugar-water': { newprop: false, heat: false },
  'pc-egg': { newprop: true, heat: true },
  'pc-nail': { newprop: true, heat: false },
  'pc-clay': { newprop: false, heat: false },
  'pc-milk': { newprop: true, heat: false },
  'pc-candle-burn': { newprop: true, heat: true },
  'pc-candle-melt': { newprop: false, heat: true },
};

export const PROPERTY_ICON_KEYS = Object.keys(ICONS);

export function PropertyChangeIcon({ icon, size = 56, shown = [] }: { icon: string; size?: number; shown?: string[] }) {
  const scene = ICONS[icon];
  const truth = PROPERTY_RESULT[icon];
  const lens = (cx: number) => <circle cx={cx} cy="8" r="6.6" fill="#ffffff" fillOpacity={0.55} />;
  const common = { fill: 'none', stroke: ORANGE, strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

  return (
    <svg className="animal-icon property-icon" viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" focusable="false">
      {scene ?? <circle cx="32" cy="32" r="20" fill="none" stroke="currentColor" strokeWidth="2.5" />}
      {truth && shown.includes('newprop') && (
        <g className="pc-result pc-newprop" data-newprop={truth.newprop ? 'true' : 'false'} {...common}>
          {lens(20)}
          <rect x="14" y="5.5" width="4" height="5" />
          <path d="M19 8 H21.4" />
          {truth.newprop ? <path d="M23 10.5 L25 5.5 L27 10.5 Z" /> : <rect x="22.6" y="5.5" width="4" height="5" />}
        </g>
      )}
      {truth && shown.includes('heat') && (
        <g className="pc-result pc-heat" data-heat={truth.heat ? 'true' : 'false'} {...common}>
          {lens(44)}
          <path d="M44 12.5 Q40 8.5 44 2.5 Q45 6.5 46.6 5 Q48.4 9 44 12.5 Z" strokeWidth={1.3} />
          {!truth.heat && <path d="M39.5 12.5 L48.5 3.5" />}
        </g>
      )}
    </svg>
  );
}
