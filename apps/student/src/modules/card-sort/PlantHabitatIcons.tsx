import type { ReactNode } from 'react';

/**
 * 사는 곳과 식물의 생김새 카드 그림(식물의 생활 두 번째 활동). 식물을 단순한 도형으로 그리고 글자는 넣지 않는다
 * (그림은 장식이라 스크린 리더에는 읽히지 않는다). 윤곽선은 currentColor, 채움색은 두 배경 모두에서 보이는 중간 밝기를 쓴다.
 *  - 부레옥잠·개구리밥: 물 위 / 검정말: 물속 / 연꽃: 바닥에 뿌리를 내리고 잎이 물 위로 솟음 / 선인장·소나무·민들레·강아지풀: 땅
 *
 * 기본 그림은 식물의 모습만 보여 주고 어떤 특징의 결과도 드러내지 않는다. 그림 위쪽 띠(y < 15)는 비워 둔다.
 * 살펴본 특징(shown)에 대해서만 이 띠에 주황색 결과 표시가 겹쳐진다.
 *  - place(자라는 곳 살펴보기): 왼쪽 칸. 물결이면 물에서, 땅 선과 풀 모양이면 땅에서 자라는 것이다.
 *  - float(물 위 살펴보기): 가운데 칸. 물결선 위에 동그라미가 얹혀 있으면 물 위에 떠 있는 것이고, 아래에 잠겨 있으면 아니다.
 *  - needle(잎 모양 살펴보기): 오른쪽 칸. 가늘고 뾰족한 모양이면 가시나 바늘 모양 잎이고, 둥근 모양이면 아니다.
 * 시험하지 않은 특징의 결과는 그림에 그려지지 않는다.
 */
const S = { stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const ORANGE = '#e06a00';
const WATER = '#7fc3ee';
const GREEN = '#58a14f';
const SOIL = '#a98467';

const pond = (top: number): ReactNode => <rect x="4" y={top} width="56" height={58 - top} fill={WATER} fillOpacity={0.35} strokeWidth={1.2} />;
const bed = (): ReactNode => <rect x="4" y="55" width="56" height="5" fill={SOIL} fillOpacity={0.6} strokeWidth={1.2} />;
const ground = (y: number): ReactNode => (
  <>
    <path d={`M4 ${y} H60`} />
    <rect x="4" y={y} width="56" height={60 - y} fill={SOIL} fillOpacity={0.5} strokeWidth={1.2} />
  </>
);

const ICONS: Record<string, ReactNode> = {
  'pl-hyacinth': (
    <g {...S}>
      {pond(42)}
      <ellipse cx="22" cy="40" rx="6" ry="5.5" fill={GREEN} />
      <ellipse cx="42" cy="40" rx="6" ry="5.5" fill={GREEN} />
      <path d="M32 40 V22 M28 26 L32 20 L36 26" strokeWidth={1.6} fill="#b58fd6" />
      <path d="M20 46 V54 M24 46 V56 M40 46 V55 M44 46 V54" strokeWidth={1.2} />
    </g>
  ),
  'pl-duckweed': (
    <g {...S}>
      {pond(36)}
      {[14, 24, 34, 44, 52].map((x, i) => (
        <g key={x}>
          <circle cx={x} cy={36 + (i % 2)} r="3.6" fill={GREEN} />
          <path d={`M${x} ${40 + (i % 2)} V${48 + (i % 3) * 3}`} strokeWidth={1} />
        </g>
      ))}
    </g>
  ),
  'pl-hydrilla': (
    <g {...S}>
      {pond(20)}
      {bed()}
      {[14, 26, 38, 50].map((x, i) => (
        <g key={x}>
          <path d={`M${x} 55 Q${x + 4} 44 ${x} 34 Q${x - 3} 28 ${x + 1} ${24 + i}`} fill="none" stroke={GREEN} strokeWidth={2} />
          <path d={`M${x} 46 L${x - 4} 44 M${x} 40 L${x + 4} 38 M${x} 34 L${x - 4} 32`} strokeWidth={1.2} stroke={GREEN} />
        </g>
      ))}
    </g>
  ),
  'pl-lotus': (
    <g {...S}>
      {pond(34)}
      {bed()}
      <path d="M26 55 V30 M42 55 V36" strokeWidth={2} stroke={GREEN} fill="none" />
      <ellipse cx="26" cy="29" rx="11" ry="3.6" fill={GREEN} />
      <path d="M40 36 Q42 24 46 22 Q48 28 44 36 Z" fill="#f2a1c2" />
      <path d="M36 36 Q38 28 42 24 Q42 30 40 36 Z" fill="#f7bfd6" strokeWidth={1.2} />
    </g>
  ),
  'pl-cactus': (
    <g {...S}>
      <path d="M4 56 H60" fill="none" />
      <path d="M4 56 V58 Q30 62 60 58 V56 Z" fill="#e3c585" fillOpacity={0.7} strokeWidth={1.2} />
      <rect x="25" y="20" width="14" height="36" rx="7" fill={GREEN} />
      <path d="M25 40 H18 V30 M39 36 H46 V26" fill="none" stroke={GREEN} strokeWidth={5} />
      <path d="M25 40 H18 V30 M39 36 H46 V26" fill="none" strokeWidth={1.2} />
      <path d="M32 24 V30 M29 32 L32 36 M35 40 L32 44 M32 48 V52 M16 30 L13 28 M48 26 L51 24" strokeWidth={1.2} />
    </g>
  ),
  'pl-pine': (
    <g {...S}>
      {ground(54)}
      <rect x="29" y="44" width="6" height="10" fill="#8a6a4a" />
      <path d="M32 18 L44 34 H20 Z M32 28 L48 46 H16 Z" fill="#3f8a55" />
      <path d="M26 38 L24 40 M32 36 V40 M38 38 L40 40 M22 46 L20 48 M32 44 V48 M42 46 L44 48" strokeWidth={1.2} />
    </g>
  ),
  'pl-dandelion': (
    <g {...S}>
      {ground(54)}
      <path d="M32 54 V28" fill="none" stroke={GREEN} strokeWidth={2.2} />
      <path d="M32 54 Q20 52 14 46 Q24 46 32 52 M32 54 Q44 52 50 46 Q40 46 32 52 M32 54 Q22 48 20 40 Q30 44 32 52" fill={GREEN} strokeWidth={1.2} />
      <circle cx="32" cy="24" r="6.5" fill="#f2d33c" />
      <path d="M32 17 V31 M25 24 H39 M27 19 L37 29 M37 19 L27 29" strokeWidth={1} />
    </g>
  ),
  'pl-foxtail': (
    <g {...S}>
      {ground(54)}
      {[18, 28, 38, 48].map((x, i) => (
        <path key={x} d={`M${x} 54 Q${x + 2} ${36 - i * 2} ${x + 8 - i * 4} ${28 + i * 2}`} fill="none" stroke={GREEN} strokeWidth={2.2} />
      ))}
      <path d="M30 40 Q36 24 44 22" fill="none" strokeWidth={1.2} />
      <ellipse cx="42" cy="23" rx="7" ry="3.2" fill="#c8b86a" transform="rotate(-25 42 23)" />
    </g>
  ),
};

/**
 * 살펴본 결과(사양 §2 표와 같다): 자라는 곳, 물 위에 떠 있나, 잎이 가시나 바늘처럼 가늘고 뾰족한가.
 * 살펴본 특징에 대해서만 그림에 쓰인다. 매니페스트의 카드 특징값과 같은지 단위 테스트가 확인한다.
 */
export const PLANT_HABITAT_RESULT: Record<string, { place: 'water' | 'land'; float: boolean; needle: boolean }> = {
  'pl-hyacinth': { place: 'water', float: true, needle: false },
  'pl-duckweed': { place: 'water', float: true, needle: false },
  'pl-hydrilla': { place: 'water', float: false, needle: false },
  'pl-lotus': { place: 'water', float: false, needle: false },
  'pl-cactus': { place: 'land', float: false, needle: true },
  'pl-pine': { place: 'land', float: false, needle: true },
  'pl-dandelion': { place: 'land', float: false, needle: false },
  'pl-foxtail': { place: 'land', float: false, needle: false },
};

export const PLANT_HABITAT_ICON_KEYS = Object.keys(ICONS);

export function PlantHabitatIcon({ icon, size = 56, shown = [] }: { icon: string; size?: number; shown?: string[] }) {
  const scene = ICONS[icon];
  const truth = PLANT_HABITAT_RESULT[icon];
  const showPlace = !!truth && shown.includes('place');
  const showFloat = !!truth && shown.includes('float');
  const showNeedle = !!truth && shown.includes('needle');

  return (
    <svg className="animal-icon plant-habitat-icon" viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" focusable="false">
      {scene ?? <circle cx="32" cy="32" r="20" fill="none" stroke="currentColor" strokeWidth="2.5" />}
      {showPlace && truth && (
        <g className="ph-result ph-place" data-place={truth.place} fill="none" stroke={ORANGE} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          {truth.place === 'water' ? <path d="M5 6 Q8.5 3 12 6 T19 6 M5 11 Q8.5 8 12 11 T19 11" /> : <path d="M5 13 H19 M9 13 V7 M12 13 V5 M15 13 V7" />}
        </g>
      )}
      {showFloat && truth && (
        <g className="ph-result ph-float" data-floating={truth.float ? 'true' : 'false'} fill="none" stroke={ORANGE} strokeWidth="1.8" strokeLinecap="round">
          <path d="M25 9 Q28.5 6 32 9 T39 9" />
          <circle cx="32" cy={truth.float ? 4 : 13} r="2.4" fill={ORANGE} stroke="none" />
        </g>
      )}
      {showNeedle && truth && (
        <g className="ph-result ph-needle" data-pointed={truth.needle ? 'true' : 'false'} fill="none" stroke={ORANGE} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          {truth.needle ? <path d="M52 2 L53.4 13 L50.6 13 Z" fill={ORANGE} /> : <ellipse cx="52" cy="8" rx="5" ry="5.5" />}
        </g>
      )}
    </svg>
  );
}
