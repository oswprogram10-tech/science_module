import type { ReactNode } from 'react';

/**
 * 우리 주변의 물 카드 그림(물의 상태 변화 두 번째 활동). 장면을 단순한 도형으로 그리고 글자는 넣지 않는다
 * (그림은 장식이라 스크린 리더에는 읽히지 않는다). 윤곽선은 currentColor, 채움색은 두 배경 모두에서 보이는 중간 밝기를 쓴다.
 * 물의 상태 이름은 그림에도 화면에도 쓰지 않는다.
 *
 * 기본 그림은 장면만 보여 주고 어떤 특징의 결과도 드러내지 않는다. 그림 위쪽 띠(y < 15)는 비워 둔다.
 * 살펴본 특징(shown)에 대해서만 이 띠에 주황색 돋보기 확대 원이 겹쳐진다(칸마다 원 하나).
 *  - shape(만져 보기): 왼쪽 원. 네모가 그대로면 모양이 일정한 것이고, 물결선이면 일정하지 않은 것이다.
 *  - flow(기울여 보기): 가운데 원. 비스듬한 선 아래로 물방울이 떨어지면 흘러내리는 것이고, 선 위에 가만히 있는 점이면 아니다.
 *  - see(가까이 보기): 오른쪽 원. 뜬 눈이면 눈에 보이는 것이고, 빗금 친 눈이면 보이지 않는 것이다.
 * 시험하지 않은 특징의 결과는 그림에 그려지지 않는다.
 */
const S = { stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const ORANGE = '#e06a00';
const WATER = '#7fc3ee';
const ICE = '#c9e6f5';

const cup = (level: number, fill: string): ReactNode => (
  <g {...S}>
    <path d={`M16 ${level} L18 56 H46 L48 ${level} Z`} fill={fill} fillOpacity={0.7} strokeWidth={1.2} />
    <path d="M15 24 L18 56 H46 L49 24" fill="none" />
  </g>
);

const ICONS: Record<string, ReactNode> = {
  'wa-icicle': (
    <g {...S}>
      <path d="M8 20 H56" />
      <path d="M12 20 L16 50 L20 20 Z M24 20 L28 58 L32 20 Z M36 20 L39 44 L44 20 Z M47 20 L50 38 L54 20 Z" fill={ICE} />
    </g>
  ),
  'wa-ice-cup': (
    <g {...S}>
      {cup(30, WATER)}
      <rect x="24" y="28" width="14" height="13" rx="2" fill={ICE} />
      <path d="M27 31 L33 31" strokeWidth={1} />
    </g>
  ),
  'wa-snowman': (
    <g {...S}>
      <circle cx="32" cy="46" r="11" fill="#f4f8fb" />
      <circle cx="32" cy="29" r="8" fill="#f4f8fb" />
      <circle cx="29.5" cy="27.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="34.5" cy="27.5" r="0.9" fill="currentColor" stroke="none" />
      <path d="M32 30 L37 31 L32 32 Z" fill="#e8873a" strokeWidth={1} />
    </g>
  ),
  'wa-rain': (
    <g {...S}>
      <path d="M14 26 Q10 26 10 22 Q10 17 16 18 Q18 12 25 14 Q30 10 36 15 Q42 14 43 20 Q48 20 48 24 Q48 27 44 27 H14 Z" fill="#b8c1c9" strokeWidth={1.4} />
      {[[18, 34], [26, 40], [34, 33], [42, 41], [22, 50], [32, 52], [46, 52]].map(([x, y]) => (
        <path key={`${x}-${y}`} d={`M${x} ${y} l-1.4 4`} stroke={WATER} strokeWidth={2} />
      ))}
    </g>
  ),
  'wa-aquarium': (
    <g {...S}>
      <rect x="8" y="22" width="48" height="34" rx="2" fill={WATER} fillOpacity={0.5} />
      <path d="M8 28 H56" strokeWidth={1.2} />
      <path d="M22 42 Q28 36 34 42 Q28 48 22 42 Z M34 42 L39 38 V46 Z" fill="#e8873a" strokeWidth={1.2} />
      <path d="M14 56 Q16 50 18 56 M46 56 Q48 48 50 56" fill="none" stroke="#58a14f" strokeWidth={1.6} />
    </g>
  ),
  'wa-dew': (
    <g {...S}>
      <path d="M8 52 Q30 20 58 30 Q34 34 8 52 Z" fill="#58a14f" />
      {[[26, 36], [36, 33], [44, 32]].map(([x, y]) => (
        <path key={`${x}-${y}`} d={`M${x} ${y - 4} Q${x + 3.6} ${y} ${x} ${y + 2.4} Q${x - 3.6} ${y} ${x} ${y - 4} Z`} fill={WATER} fillOpacity={0.85} strokeWidth={1.1} />
      ))}
    </g>
  ),
  'wa-cold-cup': (
    <g {...S}>
      <path d="M18 24 L21 56 H43 L46 24 Z" fill="#dbe8f0" fillOpacity={0.9} />
      <path d="M22 24 L24 34" stroke="#ffffff" strokeWidth={1} />
      {[[24, 32], [38, 30], [28, 42], [40, 44], [33, 50], [23, 51]].map(([x, y]) => (
        <path key={`${x}-${y}`} d={`M${x} ${y - 3} Q${x + 2.6} ${y} ${x} ${y + 2} Q${x - 2.6} ${y} ${x} ${y - 3} Z`} fill={WATER} stroke={WATER} strokeWidth={0.8} />
      ))}
    </g>
  ),
  'wa-laundry': (
    <g {...S}>
      <path d="M6 22 H58" />
      <path d="M16 22 V46 H34 V22 Z" fill="#f2efe4" />
      <path d="M36 22 V40 H52 V22 Z" fill="#d9e4f2" />
      <path d="M40 52 Q42 48 40 45 M46 53 Q48 49 46 46" fill="none" strokeWidth={1.2} strokeDasharray="1.5 2.4" />
    </g>
  ),
  'wa-bubble': (
    <g {...S}>
      <path d="M8 28 H56 V56 H8 Z" fill={WATER} fillOpacity={0.5} strokeWidth={1.2} />
      {[[20, 46, 3], [30, 40, 5], [42, 48, 3.4], [38, 34, 2.2]].map(([x, y, r]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill="#eaf5fb" fillOpacity={0.8} strokeWidth={1.2} />
      ))}
    </g>
  ),
  'wa-steam': (
    <g {...S}>
      <path d="M14 56 V38 Q14 32 22 32 H40 L50 26 V30 L42 36 V56 Z" fill="#b9bec4" />
      <path d="M50 24 Q46 20 50 16 Q54 22 50 24 M46 28 Q42 22 47 18" fill="none" stroke="#c9d0d6" strokeWidth={3} />
      <path d="M52 22 Q58 18 54 28" fill="none" stroke="#c9d0d6" strokeWidth={3} />
    </g>
  ),
};

/**
 * 살펴본 결과(사양 §2 표와 같다): 모양이 일정한가(keep), 기울이면 흘러내리는가, 눈에 보이는가.
 * 살펴본 특징에 대해서만 그림에 쓰인다. 매니페스트의 카드 특징값과 같은지 단위 테스트가 확인한다.
 */
export const WATER_AROUND_RESULT: Record<string, { shape: 'keep' | 'change'; flow: boolean; see: boolean }> = {
  'wa-icicle': { shape: 'keep', flow: false, see: true },
  'wa-ice-cup': { shape: 'keep', flow: false, see: true },
  'wa-snowman': { shape: 'keep', flow: false, see: true },
  'wa-rain': { shape: 'change', flow: true, see: true },
  'wa-aquarium': { shape: 'change', flow: true, see: true },
  'wa-dew': { shape: 'change', flow: true, see: true },
  'wa-cold-cup': { shape: 'change', flow: true, see: true },
  'wa-laundry': { shape: 'change', flow: false, see: false },
  'wa-bubble': { shape: 'change', flow: false, see: false },
  'wa-steam': { shape: 'change', flow: false, see: true },
};

export const WATER_AROUND_ICON_KEYS = Object.keys(ICONS);

export function WaterAroundIcon({ icon, size = 56, shown = [] }: { icon: string; size?: number; shown?: string[] }) {
  const scene = ICONS[icon];
  const truth = WATER_AROUND_RESULT[icon];
  const lens = (cx: number) => <circle cx={cx} cy="8" r="6.6" fill="#ffffff" fillOpacity={0.55} />;
  const common = { fill: 'none', stroke: ORANGE, strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

  return (
    <svg className="animal-icon water-around-icon" viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" focusable="false">
      {scene ?? <circle cx="32" cy="32" r="20" fill="none" stroke="currentColor" strokeWidth="2.5" />}
      {truth && shown.includes('shape') && (
        <g className="wa-result wa-shape" data-shape={truth.shape} {...common}>
          {lens(12)}
          {truth.shape === 'keep' ? <rect x="8" y="4" width="8" height="8" /> : <path d="M6.5 8 Q9 3 12 8 T17.5 8" />}
        </g>
      )}
      {truth && shown.includes('flow') && (
        <g className="wa-result wa-flow" data-flow={truth.flow ? 'true' : 'false'} {...common}>
          {lens(32)}
          <path d="M27 5 L37 8" />
          {truth.flow ? <path d="M33 9.5 V13 M36.5 9.5 V12.5" /> : <circle cx="30.5" cy="5.6" r="1" fill={ORANGE} stroke="none" />}
        </g>
      )}
      {truth && shown.includes('see') && (
        <g className="wa-result wa-see" data-see={truth.see ? 'true' : 'false'} {...common}>
          {lens(52)}
          <path d="M47 8 Q52 3 57 8 Q52 13 47 8 Z" strokeWidth={1.3} />
          <circle cx="52" cy="8" r="1.3" fill={ORANGE} stroke="none" />
          {!truth.see && <path d="M47.5 12.5 L56.5 3.5" />}
        </g>
      )}
    </svg>
  );
}
