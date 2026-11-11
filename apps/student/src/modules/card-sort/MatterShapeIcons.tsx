import type { ReactNode } from 'react';

/**
 * 모양과 부피 카드 그림(물체와 물질 두 번째 활동). 물질을 단순한 도형으로 그리고 글자는 넣지 않는다
 * (그림은 장식이라 스크린 리더에는 읽히지 않는다). 윤곽선은 currentColor, 채움색은 두 배경 모두에서 보이는 중간 밝기를 쓴다.
 *  - 나무 토막·돌·지우개·모래: 마른 물질 / 물·우유·식용유: 컵에 담긴 물질 / 주사기 속 공기: 주사기 / 풍선 속 헬륨: 풍선
 *
 * 기본 그림은 물질의 모습만 보여 주고 어떤 특징의 결과도 드러내지 않는다. 그림 위쪽 띠(y < 15)는 비워 둔다.
 * 살펴본 특징(shown)에 대해서만 이 띠에 주황색 돋보기 확대 원이 겹쳐진다(칸마다 원 하나).
 *  - shape(넓은 그릇과 좁은 그릇에 옮겨 보기): 왼쪽 원. 네모가 그대로면 모양이 그대로인 것이고, 물결선이면 그릇을 따라 바뀌는 것이다.
 *  - volume(눈금 있는 그릇에 옮겨 눈금 보기): 가운데 원. 같은 길이의 두 줄이면 부피가 그대로, 길이가 다른 두 줄이면 바뀌는 것이다.
 *  - see(가까이 들여다보기): 오른쪽 원. 뜬 눈이면 눈에 보이는 것이고, 빗금 친 눈이면 보이지 않는 것이다.
 * 시험하지 않은 특징의 결과는 그림에 그려지지 않는다.
 */
const S = { stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const ORANGE = '#e06a00';

const glass = (fill: string, level: number): ReactNode => (
  <g {...S}>
    <path d={`M18 ${level} L20 56 H44 L46 ${level} Z`} fill={fill} fillOpacity={0.85} />
    <path d="M17 24 L20 56 H44 L47 24" fill="none" />
  </g>
);

const ICONS: Record<string, ReactNode> = {
  'ms-wood': (
    <g {...S}>
      <rect x="14" y="26" width="36" height="28" rx="2" fill="#b98c5a" />
      <ellipse cx="32" cy="40" rx="9" ry="6" fill="none" strokeWidth={1.2} />
      <ellipse cx="32" cy="40" rx="4" ry="2.6" fill="none" strokeWidth={1.2} />
      <path d="M14 33 H50" strokeWidth={1} />
    </g>
  ),
  'ms-stone': (
    <g {...S}>
      <path d="M12 46 L16 32 L28 24 L42 27 L52 38 L48 52 L28 54 Z" fill="#9ca0a6" />
      <path d="M24 34 L32 32 M36 44 L44 42" strokeWidth={1.2} />
      <circle cx="30" cy="46" r="1.2" fill="#f0f0f0" stroke="none" />
      <circle cx="40" cy="35" r="1" fill="#f0f0f0" stroke="none" />
    </g>
  ),
  'ms-eraser': (
    <g {...S}>
      <rect x="12" y="30" width="40" height="22" rx="5" fill="#f4f1ea" />
      <rect x="12" y="30" width="14" height="22" rx="5" fill="#4a86d6" />
      <path d="M26 30 V52" strokeWidth={1.4} />
    </g>
  ),
  'ms-sand': (
    <g {...S}>
      <path d="M8 54 Q32 18 56 54 Z" fill="#d9bd7a" />
      {[[26, 46], [32, 40], [38, 47], [30, 51], [43, 52], [22, 52]].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="1.1" fill="#a07f3d" stroke="none" />
      ))}
    </g>
  ),
  'ms-water': glass('#7fc3ee', 30),
  'ms-milk': glass('#f6f4ea', 30),
  'ms-oil': glass('#e6c335', 30),
  'ms-syringe': (
    <g {...S}>
      <rect x="18" y="28" width="30" height="14" rx="2" fill="#e8f0f6" fillOpacity={0.9} />
      <path d="M18 35 H6 M6 30 V40" />
      <path d="M48 35 H58" strokeWidth={1.4} />
      <path d="M26 28 V42 M34 28 V42 M42 28 V42" strokeWidth={1} />
      <rect x="30" y="31" width="4" height="8" fill="#a9b4bd" strokeWidth={1} />
    </g>
  ),
  'ms-helium': (
    <g {...S}>
      <path d="M32 18 C46 18 50 30 46 38 C43 44 37 46 32 46 C27 46 21 44 18 38 C14 30 18 18 32 18 Z" fill="#e8708f" />
      <path d="M29 46 L32 50 L35 46 Z" fill="#e8708f" strokeWidth={1.2} />
      <path d="M32 50 Q28 54 33 57 Q36 59 32 62" fill="none" strokeWidth={1.2} />
      <path d="M25 26 Q27 23 30 22" fill="none" stroke="#ffffff" strokeWidth={1.4} />
    </g>
  ),
};

/**
 * 살펴본 결과(사양 §1 표와 같다): 모양(keep/change), 부피(keep/change), 눈에 보이는가.
 * 살펴본 특징에 대해서만 그림에 쓰인다. 매니페스트의 카드 특징값과 같은지 단위 테스트가 확인한다.
 */
export type KeepChange = 'keep' | 'change';
export const MATTER_RESULT: Record<string, { shape: KeepChange; volume: KeepChange; see: boolean }> = {
  'ms-wood': { shape: 'keep', volume: 'keep', see: true },
  'ms-stone': { shape: 'keep', volume: 'keep', see: true },
  'ms-eraser': { shape: 'keep', volume: 'keep', see: true },
  'ms-sand': { shape: 'keep', volume: 'keep', see: true },
  'ms-water': { shape: 'change', volume: 'keep', see: true },
  'ms-milk': { shape: 'change', volume: 'keep', see: true },
  'ms-oil': { shape: 'change', volume: 'keep', see: true },
  'ms-syringe': { shape: 'change', volume: 'change', see: false },
  'ms-helium': { shape: 'change', volume: 'change', see: false },
};

export const MATTER_ICON_KEYS = Object.keys(ICONS);

export function MatterShapeIcon({ icon, size = 56, shown = [] }: { icon: string; size?: number; shown?: string[] }) {
  const scene = ICONS[icon];
  const truth = MATTER_RESULT[icon];
  const lens = (cx: number) => <circle cx={cx} cy="8" r="6.6" fill="#ffffff" fillOpacity={0.55} />;
  const common = { fill: 'none', stroke: ORANGE, strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

  return (
    <svg className="animal-icon matter-shape-icon" viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" focusable="false">
      {scene ?? <circle cx="32" cy="32" r="20" fill="none" stroke="currentColor" strokeWidth="2.5" />}
      {truth && shown.includes('shape') && (
        <g className="ms-result ms-shape" data-shape={truth.shape} {...common}>
          {lens(12)}
          {truth.shape === 'keep' ? <rect x="8" y="4" width="8" height="8" /> : <path d="M6.5 8 Q9 3 12 8 T17.5 8" />}
        </g>
      )}
      {truth && shown.includes('volume') && (
        <g className="ms-result ms-volume" data-volume={truth.volume} {...common}>
          {lens(32)}
          {truth.volume === 'keep' ? <path d="M27 5.5 H37 M27 10.5 H37" /> : <path d="M27 5.5 H37 M27 10.5 H32" />}
        </g>
      )}
      {truth && shown.includes('see') && (
        <g className="ms-result ms-see" data-see={truth.see ? 'true' : 'false'} {...common}>
          {lens(52)}
          <path d="M47 8 Q52 3 57 8 Q52 13 47 8 Z" strokeWidth={1.3} />
          <circle cx="52" cy="8" r="1.3" fill={ORANGE} stroke="none" />
          {!truth.see && <path d="M47.5 12.5 L56.5 3.5" />}
        </g>
      )}
    </svg>
  );
}
