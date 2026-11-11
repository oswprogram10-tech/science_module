import type { ReactNode } from 'react';

/**
 * 퇴적암 알갱이 카드 그림(지층과 화석 두 번째 활동). 암석의 단면을 알갱이 무늬로 그리고 글자는 넣지 않는다
 * (그림은 장식이라 스크린 리더에는 읽히지 않는다). 윤곽선은 currentColor, 채움색은 두 배경 모두에서 보이는 중간 밝기를 쓴다.
 * 단면의 알갱이 크기는 그림에 그대로 보이고, 암석 이름은 그림에도 화면에도 쓰지 않는다.
 *  - 가·나·다: 알갱이가 보이지 않는 고운 단면 / 라·마·바: 모래알만 한 알갱이 단면 / 사·아: 둥근 돌 조각이 박힌 단면
 *
 * 기본 그림은 단면만 보여 주고 어떤 특징의 결과도 드러내지 않는다. 그림 위쪽 띠(y < 15)는 비워 둔다.
 * 살펴본 특징(shown)에 대해서만 이 띠에 주황색 돋보기 확대 원이 겹쳐진다(칸마다 원 하나).
 *  - grain(알갱이 크기): 왼쪽 원. 원 안에 점이 아주 작고 촘촘하면 알갱이가 보이지 않는 것, 중간 점이면 모래알만 한 것, 큰 동그라미 몇 개면 콩알보다 큰 것이다.
 *  - smooth(문지른 느낌): 가운데 원. 원 안의 선이 곧으면 매끄럽고, 울퉁불퉁하면 까끌까끌한 것이다.
 *  - pebble(박힌 조각): 오른쪽 원. 원 안에 큰 둥근 조각이 있으면 박혀 있는 것이고, 고운 점뿐이면 아니다.
 * 시험하지 않은 특징의 결과는 그림에 그려지지 않는다.
 */
const S = { stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const ORANGE = '#e06a00';

/** 같은 점이 매번 같은 자리에 찍히도록 인덱스로 위치를 정한다(의사 난수 아님). */
function speckle(n: number, r: number, color: string, opacity = 0.85): ReactNode {
  const out: ReactNode[] = [];
  for (let i = 0; i < n; i++) {
    const x = 7 + ((i * 37 + (i % 3) * 11) % 50);
    const y = 20 + ((i * 53 + (i % 5) * 7) % 37);
    out.push(<circle key={i} cx={x} cy={y} r={r} fill={color} fillOpacity={opacity} stroke="none" />);
  }
  return out;
}

/** 둥근 돌 조각(자갈). */
const pebble = (x: number, y: number, r: number, fill: string): ReactNode => <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill={fill} strokeWidth={1.2} />;

function Section({ fill, children }: { fill: string; children: ReactNode }) {
  return (
    <g {...S}>
      <rect x="5" y="18" width="54" height="41" rx="3" fill={fill} />
      {children}
    </g>
  );
}

const ICONS: Record<string, ReactNode> = {
  'rg-a': <Section fill="#a9afb5">{speckle(70, 0.5, '#6b7077')}</Section>,
  'rg-b': <Section fill="#51555c">{speckle(70, 0.5, '#9aa0a8')}</Section>,
  'rg-c': <Section fill="#b4634f">{speckle(70, 0.5, '#7a3a2c')}</Section>,
  'rg-d': <Section fill="#d3b370">{speckle(42, 1.2, '#9a7a3c')}</Section>,
  'rg-e': <Section fill="#aeb2b6">{speckle(42, 1.2, '#72777d')}</Section>,
  'rg-f': <Section fill="#c27862">{speckle(42, 1.2, '#83432f')}</Section>,
  'rg-g': (
    <Section fill="#b09a82">
      {speckle(30, 1, '#7d6a55')}
      {pebble(16, 30, 5.4, '#d9c9b3')}
      {pebble(35, 28, 4.2, '#8f8f98')}
      {pebble(50, 33, 5, '#c58b6a')}
      {pebble(24, 48, 5.6, '#a5a79e')}
      {pebble(44, 49, 4.6, '#dcd2c2')}
    </Section>
  ),
  'rg-h': (
    <Section fill="#9ea4a9">
      {speckle(30, 1, '#6a7075')}
      {pebble(15, 33, 4.6, '#cfd3d6')}
      {pebble(32, 27, 5.4, '#7c8288')}
      {pebble(49, 31, 4.4, '#d7d9dc')}
      {pebble(21, 49, 5, '#7c8288')}
      {pebble(40, 48, 5.6, '#c3c7ca')}
    </Section>
  ),
};

export type GrainSize = 'fine' | 'sand' | 'gravel';

/**
 * 살펴본 결과(사양 §4 표와 같다): 알갱이 크기, 손으로 문지르면 매끄러운가, 둥근 돌 조각이 박혀 있나.
 * 살펴본 특징에 대해서만 그림에 쓰인다. 매니페스트의 카드 특징값과 같은지 단위 테스트가 확인한다.
 */
export const GRAIN_RESULT: Record<string, { grain: GrainSize; smooth: boolean; pebble: boolean }> = {
  'rg-a': { grain: 'fine', smooth: true, pebble: false },
  'rg-b': { grain: 'fine', smooth: true, pebble: false },
  'rg-c': { grain: 'fine', smooth: true, pebble: false },
  'rg-d': { grain: 'sand', smooth: false, pebble: false },
  'rg-e': { grain: 'sand', smooth: false, pebble: false },
  'rg-f': { grain: 'sand', smooth: false, pebble: false },
  'rg-g': { grain: 'gravel', smooth: false, pebble: true },
  'rg-h': { grain: 'gravel', smooth: false, pebble: true },
};

export const GRAIN_ICON_KEYS = Object.keys(ICONS);

/** 확대 원 안에 그리는 알갱이(중심 cx, 8). */
function lensGrains(cx: number, size: GrainSize): ReactNode {
  if (size === 'fine') {
    const dots: ReactNode[] = [];
    for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) dots.push(<circle key={`${i}-${j}`} cx={cx - 4 + i * 2} cy={4 + j * 2} r="0.45" fill={ORANGE} stroke="none" />);
    return dots;
  }
  if (size === 'sand') {
    return [[-3, -2], [0, -3.4], [3, -1.6], [-2.4, 1.6], [1, 1.2], [3.4, 3.2], [-4, 3.8]].map(([dx, dy], i) => <circle key={i} cx={cx + dx!} cy={8 + dy!} r="1.2" fill={ORANGE} stroke="none" />);
  }
  return [[-2.6, -1.8, 2.6], [2.8, 2.2, 2.4]].map(([dx, dy, r], i) => <circle key={i} cx={cx + dx!} cy={8 + dy!} r={r!} fill="none" />);
}

export function GrainIcon({ icon, size = 56, shown = [] }: { icon: string; size?: number; shown?: string[] }) {
  const scene = ICONS[icon];
  const truth = GRAIN_RESULT[icon];
  const showGrain = !!truth && shown.includes('grain');
  const showSmooth = !!truth && shown.includes('smooth');
  const showPebble = !!truth && shown.includes('pebble');
  const lens = (cx: number) => <circle cx={cx} cy="8" r="6.6" fill="#ffffff" fillOpacity={0.55} />;

  return (
    <svg className="animal-icon grain-icon" viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" focusable="false">
      {scene ?? <circle cx="32" cy="32" r="20" fill="none" stroke="currentColor" strokeWidth="2.5" />}
      {showGrain && truth && (
        <g className="rg-result rg-grain" data-grain={truth.grain} fill="none" stroke={ORANGE} strokeWidth="1.6" strokeLinecap="round">
          {lens(12)}
          {lensGrains(12, truth.grain)}
        </g>
      )}
      {showSmooth && truth && (
        <g className="rg-result rg-smooth" data-smooth={truth.smooth ? 'true' : 'false'} fill="none" stroke={ORANGE} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          {lens(32)}
          <path d={truth.smooth ? 'M27 8 H37' : 'M27 10 L29 5 L31 11 L33 5 L35 11 L37 6'} />
        </g>
      )}
      {showPebble && truth && (
        <g className="rg-result rg-pebble" data-pebble={truth.pebble ? 'true' : 'false'} fill="none" stroke={ORANGE} strokeWidth="1.6" strokeLinecap="round">
          {lens(52)}
          {truth.pebble ? <circle cx="52" cy="8" r="3.6" /> : <path d="M48.5 6 h.1 M52 10.5 h.1 M55 6.5 h.1 M50 9.6 h.1" strokeWidth="1.2" />}
        </g>
      )}
    </svg>
  );
}
