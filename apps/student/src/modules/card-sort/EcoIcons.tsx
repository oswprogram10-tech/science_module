import type { ReactNode } from 'react';

/**
 * 생태계를 이루는 것 카드 그림(생물과 환경 두 번째 활동). 햇빛·물·공기·흙·돌과 토끼·참새·지렁이·민들레·버섯을
 * 단순한 도형으로 그리고 글자는 넣지 않는다(그림은 장식이라 스크린 리더에는 읽히지 않는다).
 * 윤곽선은 currentColor, 채움색은 두 배경 모두에서 보이는 중간 밝기를 쓴다.
 *
 * 기본 그림은 그것의 모습만 보여 주고 어떤 특징의 결과도 드러내지 않는다. 그림 위쪽 띠(y < 15)는 비워 둔다.
 * 살펴본 특징(shown)에 대해서만 이 띠에 주황색 결과 표시가 겹쳐진다.
 *  - grow(자람 살펴보기): 왼쪽 칸. 작은 동그라미 옆에 큰 동그라미가 있으면 자란 것이고, 크기가 같으면 달라지지 않은 것이다.
 *  - food(양분 살펴보기): 가운데 칸. 네모(몸)로 들어가는 화살표가 있으면 양분을 얻는 것이고, 네모만 있으면 아니다.
 *  - move(움직임 살펴보기): 오른쪽 칸. 점 뒤에 이어지는 화살표가 있으면 스스로 옮겨 다니는 것이고, 점 아래 받침만 있으면 아니다.
 * 시험하지 않은 특징의 결과는 그림에 그려지지 않는다.
 */
const S = { stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const ORANGE = '#e06a00';
const GREEN = '#58a14f';
const SOIL = '#a98467';

const ground = (y: number): ReactNode => <path d={`M4 ${y} H60`} />;

const ICONS: Record<string, ReactNode> = {
  'eco-sunlight': (
    <g {...S}>
      <circle cx="32" cy="38" r="10" fill="#f6c431" />
      <path d="M32 20 V24 M32 52 V56 M14 38 H18 M46 38 H50 M19 25 L22 28 M45 25 L42 28 M19 51 L22 48 M45 51 L42 48" />
    </g>
  ),
  'eco-water': (
    <g {...S}>
      <path d="M32 18 Q46 36 46 44 A14 14 0 0 1 18 44 Q18 36 32 18 Z" fill="#7fc3ee" fillOpacity={0.75} />
      <path d="M25 44 Q26 50 31 52" fill="none" strokeWidth={1.4} />
    </g>
  ),
  'eco-air': (
    <g {...S}>
      <path d="M8 28 H36 A5 5 0 1 0 31 23" fill="none" />
      <path d="M8 38 H46 A5.5 5.5 0 1 1 40.5 43.5" fill="none" />
      <path d="M8 48 H30 A4.5 4.5 0 1 1 25.5 52.5" fill="none" />
    </g>
  ),
  'eco-soil': (
    <g {...S}>
      <path d="M6 56 Q16 38 32 32 Q48 38 58 56 Z" fill={SOIL} fillOpacity={0.85} />
      <path d="M22 48 h.1 M32 42 h.1 M42 48 h.1 M30 52 h.1 M38 54 h.1 M16 54 h.1" strokeWidth={3} />
    </g>
  ),
  'eco-rock': (
    <g {...S}>
      <path d="M10 54 L16 34 L30 24 L46 28 L54 44 L50 54 Z" fill="#9aa2aa" />
      <path d="M16 34 L30 40 L46 28 M30 40 L34 54" fill="none" strokeWidth={1.2} />
    </g>
  ),
  'eco-rabbit': (
    <g {...S}>
      {ground(56)}
      <ellipse cx="28" cy="44" rx="14" ry="9" fill="#d9c4a8" />
      <circle cx="44" cy="38" r="7" fill="#d9c4a8" />
      <path d="M41 32 Q38 18 42 18 Q46 20 44 32 M46 32 Q48 20 52 22 Q53 26 49 33" fill="#d9c4a8" />
      <circle cx="47" cy="38" r="1" fill="currentColor" stroke="none" />
      <circle cx="14" cy="42" r="3.2" fill="#f4f1ec" />
      <path d="M24 52 V56 M34 52 V56" />
    </g>
  ),
  'eco-sparrow': (
    <g {...S}>
      <path d="M8 56 H60" />
      <path d="M12 36 Q22 28 36 32 Q46 34 46 42 Q40 50 26 48 Q14 46 12 36 Z" fill="#b08a62" />
      <circle cx="44" cy="32" r="6" fill="#b08a62" />
      <path d="M49 31 L56 33 L49 35 Z" fill="#e0b84a" strokeWidth={1.4} />
      <path d="M12 36 L6 32 L8 40 Z" fill="#8f6d49" />
      <path d="M22 38 Q30 34 34 42" fill="none" strokeWidth={1.4} />
      <circle cx="45" cy="31" r="1" fill="currentColor" stroke="none" />
      <path d="M28 48 V56 M34 48 V56" />
    </g>
  ),
  'eco-earthworm': (
    <g {...S}>
      <path d="M4 32 H60" />
      <rect x="4" y="32" width="56" height="28" fill={SOIL} fillOpacity={0.5} strokeWidth={1.2} />
      <path d="M10 50 Q18 40 26 48 T42 48 T54 42" fill="none" stroke="#c7777f" strokeWidth={6} />
      <path d="M10 50 Q18 40 26 48 T42 48 T54 42" fill="none" strokeWidth={1.2} strokeDasharray="1.5 3.5" />
    </g>
  ),
  'eco-dandelion': (
    <g {...S}>
      {ground(54)}
      <path d="M32 54 V28" fill="none" stroke={GREEN} strokeWidth={2.2} />
      <path d="M32 54 Q20 52 14 46 Q24 46 32 52 M32 54 Q44 52 50 46 Q40 46 32 52" fill={GREEN} strokeWidth={1.2} />
      <circle cx="32" cy="24" r="6.5" fill="#f2d33c" />
      <path d="M32 17 V31 M25 24 H39 M27 19 L37 29 M37 19 L27 29" strokeWidth={1} />
    </g>
  ),
  'eco-mushroom': (
    <g {...S}>
      <path d="M4 56 H60" />
      <path d="M26 56 V42 Q26 40 28 40 H36 Q38 40 38 42 V56 Z" fill="#efe6d6" />
      <path d="M12 42 Q12 20 32 20 Q52 20 52 42 Z" fill="#d1604a" />
      <circle cx="24" cy="32" r="2.6" fill="#f4f1ec" strokeWidth={1} />
      <circle cx="36" cy="28" r="2.2" fill="#f4f1ec" strokeWidth={1} />
      <circle cx="43" cy="36" r="2" fill="#f4f1ec" strokeWidth={1} />
    </g>
  ),
};

/**
 * 살펴본 결과(사양 §3 표와 같다): 시간이 지나면 자라거나 수가 늘어나나, 살아가려면 양분이 필요한가, 스스로 자리를 옮겨 다니나.
 * 살펴본 특징에 대해서만 그림에 쓰인다. 매니페스트의 카드 특징값과 같은지 단위 테스트가 확인한다.
 */
export const ECO_RESULT: Record<string, { grow: boolean; food: boolean; move: boolean }> = {
  'eco-sunlight': { grow: false, food: false, move: false },
  'eco-water': { grow: false, food: false, move: false },
  'eco-air': { grow: false, food: false, move: false },
  'eco-soil': { grow: false, food: false, move: false },
  'eco-rock': { grow: false, food: false, move: false },
  'eco-rabbit': { grow: true, food: true, move: true },
  'eco-sparrow': { grow: true, food: true, move: true },
  'eco-earthworm': { grow: true, food: true, move: true },
  'eco-dandelion': { grow: true, food: true, move: false },
  'eco-mushroom': { grow: true, food: true, move: false },
};

export const ECO_ICON_KEYS = Object.keys(ICONS);

export function EcoIcon({ icon, size = 56, shown = [] }: { icon: string; size?: number; shown?: string[] }) {
  const scene = ICONS[icon];
  const truth = ECO_RESULT[icon];
  const showGrow = !!truth && shown.includes('grow');
  const showFood = !!truth && shown.includes('food');
  const showMove = !!truth && shown.includes('move');

  return (
    <svg className="animal-icon eco-icon" viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" focusable="false">
      {scene ?? <circle cx="32" cy="32" r="20" fill="none" stroke="currentColor" strokeWidth="2.5" />}
      {showGrow && truth && (
        <g className="eco-result eco-grow" data-grows={truth.grow ? 'true' : 'false'} fill="none" stroke={ORANGE} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx={truth.grow ? 7 : 7.5} cy="9" r={truth.grow ? 2 : 3.2} />
          <circle cx={truth.grow ? 15 : 16.5} cy="8" r={truth.grow ? 5 : 3.2} />
        </g>
      )}
      {showFood && truth && (
        <g className="eco-result eco-food" data-needs={truth.food ? 'true' : 'false'} fill="none" stroke={ORANGE} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="30" y="4" width="8" height="8" rx="1.5" />
          {truth.food && <path d="M23 8 H29 M26.6 5.4 L29.2 8 L26.6 10.6" />}
        </g>
      )}
      {showMove && truth && (
        <g className="eco-result eco-move" data-moves={truth.move ? 'true' : 'false'} fill="none" stroke={ORANGE} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="48" cy="8" r="3" fill={ORANGE} stroke="none" />
          {truth.move ? <path d="M52 8 H60 M57.4 5.4 L60 8 L57.4 10.6" /> : <path d="M48 11.5 V14 M44.5 14 H51.5" />}
        </g>
      )}
    </svg>
  );
}
