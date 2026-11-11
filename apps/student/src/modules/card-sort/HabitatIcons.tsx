import type { ReactNode } from 'react';

/**
 * 사는 곳과 동물의 생김새 카드 그림(동물의 생활 두 번째 활동). 동물을 단순한 도형으로 그리고 글자는 넣지 않는다
 * (그림은 장식이라 스크린 리더에는 읽히지 않는다). 윤곽선은 currentColor, 채움색은 두 배경 모두에서 보이는 중간 밝기를 쓴다.
 *  - 붕어·상어: 물속 / 두더지·지렁이: 흙 속 / 사막여우·낙타: 모래 언덕 / 북극곰·북극여우: 눈과 얼음
 *
 * 기본 그림은 동물의 모습만 보여 주고 어떤 특징의 결과도 드러내지 않는다. 그림 위쪽 띠(y < 15)는 비워 둔다.
 * 살펴본 특징(shown)에 대해서만 이 띠에 주황색 결과 표시가 겹쳐진다.
 *  - habitat(사는 곳 살펴보기): 왼쪽 칸. 물결(물속) / 땅 밑 굴(땅속) / 해와 모래 언덕(사막) / 눈송이(추운 곳)
 *  - fins(몸 옆과 등 살펴보기): 가운데 칸. 선 위에 얇은 막 모양이 솟아 있으면 있는 것이고, 선만 있으면 없는 것이다.
 *  - fur(몸 겉 만져 보기): 오른쪽 칸. 선 위에 털 모양 짧은 선이 서 있으면 털로 덮인 것이고, 선만 있으면 아니다.
 * 시험하지 않은 특징의 결과는 그림에 그려지지 않는다.
 */
const S = { stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const ORANGE = '#e06a00';
const WATER = '#7fc3ee';
const SOIL = '#a98467';

const water = (y: number): ReactNode => <path d={`M4 ${y} Q10 ${y - 3} 16 ${y} T28 ${y} T40 ${y} T52 ${y} T60 ${y} V60 H4 Z`} fill={WATER} fillOpacity={0.35} strokeWidth={1.2} />;
const soil = (y: number): ReactNode => <rect x="4" y={y} width="56" height={60 - y} fill={SOIL} fillOpacity={0.5} strokeWidth={1.2} />;
const sand = (): ReactNode => <path d="M4 60 V52 Q18 42 32 50 T60 48 V60 Z" fill="#e3c585" fillOpacity={0.7} strokeWidth={1.2} />;
const ice = (): ReactNode => <path d="M4 60 V54 H60 V60 Z" fill="#d8ecf7" fillOpacity={0.8} strokeWidth={1.2} />;
const legs = (xs: number[], y1: number, y2: number): ReactNode => xs.map((x) => <path key={x} d={`M${x} ${y1} V${y2}`} />);

const ICONS: Record<string, ReactNode> = {
  'hb-crucian': (
    <g {...S}>
      {water(54)}
      <path d="M12 36 Q28 22 44 36 Q28 50 12 36 Z" fill="#c9b38a" />
      <path d="M44 36 L56 27 L56 45 Z" fill="#b59d70" />
      <path d="M24 28 Q30 21 38 30" fill="#b59d70" />
      <path d="M26 42 Q31 49 36 41" fill="#b59d70" />
      <circle cx="19" cy="34" r="1.3" fill="currentColor" stroke="none" />
    </g>
  ),
  'hb-shark': (
    <g {...S}>
      {water(55)}
      <path d="M6 38 Q26 24 48 36 L58 28 L56 40 L58 50 L46 42 Q26 52 6 38 Z" fill="#8fa3b5" />
      <path d="M26 30 L32 17 L38 33 Z" fill="#7c90a3" />
      <path d="M28 46 L36 54 L38 44 Z" fill="#7c90a3" />
      <circle cx="14" cy="36" r="1.3" fill="currentColor" stroke="none" />
      <path d="M17 41 Q20 42 23 41" fill="none" strokeWidth="1.2" />
    </g>
  ),
  'hb-mole': (
    <g {...S}>
      <path d="M4 34 H60" fill="none" />
      {soil(34)}
      <ellipse cx="32" cy="47" rx="22" ry="9" fill="#2f2a26" fillOpacity={0.35} strokeWidth={1.2} />
      <ellipse cx="34" cy="47" rx="12" ry="6.5" fill="#4a4540" />
      <path d="M22 47 L14 49 L22 51 Z" fill="#e6b7a8" strokeWidth={1.4} />
      <path d="M26 53 L22 56 M30 54 L28 58" strokeWidth={2.2} />
      <circle cx="26" cy="45" r="1" fill="#f4f6f8" stroke="none" />
    </g>
  ),
  'hb-earthworm': (
    <g {...S}>
      <path d="M4 34 H60" fill="none" />
      {soil(34)}
      <path d="M10 52 Q18 42 26 50 T42 50 T54 44" fill="none" stroke="#c7777f" strokeWidth={6} />
      <path d="M10 52 Q18 42 26 50 T42 50 T54 44" fill="none" strokeWidth={1.2} strokeDasharray="1.5 3.5" />
    </g>
  ),
  'hb-desertfox': (
    <g {...S}>
      {sand()}
      <ellipse cx="30" cy="42" rx="14" ry="7" fill="#d9b98a" />
      <path d="M40 40 Q52 38 56 46 Q48 46 40 44 Z" fill="#cba87a" />
      <path d="M20 38 L12 36 L16 44 Z" fill="#d9b98a" />
      <path d="M12 36 L9 24 L16 31 Z M17 33 L18 21 L23 32 Z" fill="#d9b98a" />
      {legs([24, 28, 34, 38], 48, 54)}
      <circle cx="14.5" cy="38.5" r="1" fill="currentColor" stroke="none" />
    </g>
  ),
  'hb-camel': (
    <g {...S}>
      {sand()}
      <path d="M14 38 Q20 26 27 34 Q32 24 38 34 L46 38 V44 H14 Z" fill="#c9a26b" />
      <path d="M46 38 Q50 30 52 24 L58 26 L57 31 Q54 32 52 38 Z" fill="#c9a26b" />
      {legs([18, 24, 38, 44], 44, 56)}
      <circle cx="55.5" cy="27" r="1" fill="currentColor" stroke="none" />
    </g>
  ),
  'hb-polarbear': (
    <g {...S}>
      {ice()}
      <ellipse cx="30" cy="40" rx="18" ry="9" fill="#f1f1f1" />
      <circle cx="49" cy="35" r="6.5" fill="#f1f1f1" />
      <circle cx="46" cy="29" r="2.2" fill="#f1f1f1" />
      <circle cx="53" cy="29" r="2.2" fill="#f1f1f1" />
      <circle cx="55" cy="37" r="1.4" fill="currentColor" stroke="none" />
      {legs([20, 26, 36, 42], 46, 54)}
      <circle cx="51" cy="34" r="0.9" fill="currentColor" stroke="none" />
    </g>
  ),
  'hb-arcticfox': (
    <g {...S}>
      {ice()}
      <ellipse cx="30" cy="42" rx="12" ry="6.5" fill="#f6f6f6" />
      <path d="M18 40 Q8 36 8 46 Q14 50 20 45 Z" fill="#f6f6f6" />
      <circle cx="43" cy="38" r="5.5" fill="#f6f6f6" />
      <path d="M40 34 L40 28 L44 33 Z M45 33 L48 28 L48 35 Z" fill="#f6f6f6" strokeWidth={1.4} />
      <circle cx="47" cy="39" r="1" fill="currentColor" stroke="none" />
      {legs([26, 31, 36], 47, 54)}
    </g>
  ),
};

/**
 * 살펴본 결과(사양 §1 표와 같다): 사는 곳, 몸 옆과 등에 얇은 막이 있나, 몸이 털로 덮여 있나.
 * 살펴본 특징에 대해서만 그림에 쓰인다. 매니페스트의 카드 특징값과 같은지 단위 테스트가 확인한다.
 */
export const HABITAT_RESULT: Record<string, { habitat: 'water' | 'underground' | 'desert' | 'cold'; fins: boolean; fur: boolean }> = {
  'hb-crucian': { habitat: 'water', fins: true, fur: false },
  'hb-shark': { habitat: 'water', fins: true, fur: false },
  'hb-mole': { habitat: 'underground', fins: false, fur: true },
  'hb-earthworm': { habitat: 'underground', fins: false, fur: false },
  'hb-desertfox': { habitat: 'desert', fins: false, fur: true },
  'hb-camel': { habitat: 'desert', fins: false, fur: true },
  'hb-polarbear': { habitat: 'cold', fins: false, fur: true },
  'hb-arcticfox': { habitat: 'cold', fins: false, fur: true },
};

export const HABITAT_ICON_KEYS = Object.keys(ICONS);

const HABITAT_MARK: Record<string, ReactNode> = {
  water: <path d="M5 6 Q8.5 3 12 6 T19 6 M5 11 Q8.5 8 12 11 T19 11" />,
  underground: <path d="M5 5 H19 M7 14 A5 5 0 0 1 17 14" />,
  desert: (
    <>
      <circle cx="9" cy="5" r="2.4" />
      <path d="M5 13 Q10 7 14 11 T19 12" />
    </>
  ),
  cold: <path d="M12 2 V14 M6.8 5 L17.2 11 M6.8 11 L17.2 5" />,
};

export function HabitatIcon({ icon, size = 56, shown = [] }: { icon: string; size?: number; shown?: string[] }) {
  const scene = ICONS[icon];
  const truth = HABITAT_RESULT[icon];
  const showHabitat = !!truth && shown.includes('habitat');
  const showFins = !!truth && shown.includes('fins');
  const showFur = !!truth && shown.includes('fur');

  return (
    <svg className="animal-icon habitat-icon" viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" focusable="false">
      {scene ?? <circle cx="32" cy="32" r="20" fill="none" stroke="currentColor" strokeWidth="2.5" />}
      {showHabitat && truth && (
        <g className="hb-result hb-habitat" data-habitat={truth.habitat} fill="none" stroke={ORANGE} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          {HABITAT_MARK[truth.habitat]}
        </g>
      )}
      {showFins && truth && (
        <g className="hb-result hb-fins" data-fins={truth.fins ? 'true' : 'false'} fill="none" stroke={ORANGE} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M25 13 H39" />
          {truth.fins && <path d="M28 13 L32 4 L36 13 Z" fill={ORANGE} />}
        </g>
      )}
      {showFur && truth && (
        <g className="hb-result hb-fur" data-fur={truth.fur ? 'true' : 'false'} fill="none" stroke={ORANGE} strokeWidth="1.8" strokeLinecap="round">
          <path d="M45 13 H59" />
          {truth.fur && <path className="hb-hairs" d="M47 13 V7 M50.5 13 V5 M54 13 V5 M57 13 V7" />}
        </g>
      )}
    </svg>
  );
}
