import type { ReactNode } from 'react';

/**
 * 암석 표본 그림(지층과 화석). 단순한 도형으로 암석의 질감을 그리고 글자는 넣지 않는다(그림은 장식이라 스크린 리더에는 읽히지 않는다).
 * 윤곽선은 currentColor(밝은 화면 어두운 글자색, 어두운 화면 밝은 글자색), 채움색은 두 배경 모두에서 보이는 중간 밝기를 쓴다.
 *  - 역암: 둥근 자갈이 박힌 회갈색 / 사암: 고운 모래알의 누런 암석 / 이암: 매끈한 어두운 갈색
 *  - 석회암: 점이 거의 없는 연한 크림색 / 셰일: 얇은 판이 겹친 청회색
 *
 * 화석 모양은 표본의 화석을 살펴본 뒤(shown에 'fossil'이 있을 때)에만 그려진다. 그림이 정답을 미리 드러내지 않게 하려는 것이다.
 * 화석이 없는 표본은 살펴본 뒤에도 아무것도 더해지지 않는다. 높이 숫자는 그림에 쓰지 않는다.
 */
const S = { stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

/** 같은 블록 모양에 면의 색만 바꾼다: 앞면, 윗면, 오른쪽 옆면. */
function Block({ front, top, side, children }: { front: string; top: string; side: string; children: ReactNode }) {
  return (
    <g {...S}>
      <path d="M6 26 L18 14 L58 14 L46 26 Z" fill={top} />
      <path d="M46 26 L58 14 L58 42 L46 54 Z" fill={side} />
      <rect x="6" y="26" width="40" height="28" fill={front} />
      {children}
    </g>
  );
}

const TEX = { fill: 'none', strokeLinecap: 'round' } as const;

const ICONS: Record<string, ReactNode> = {
  conglomerate: (
    <Block front="#a89684" top="#c4b4a2" side="#85756a">
      <g stroke="#5e4f43" strokeWidth="1.3" fill="#d8c7b0">
        <circle cx="14" cy="34" r="4.2" />
        <circle cx="26" cy="32" r="3.2" />
        <circle cx="38" cy="35" r="4.4" />
        <circle cx="19" cy="45" r="3.6" fill="#b7a58f" />
        <circle cx="31" cy="46" r="4.4" />
        <circle cx="41" cy="47" r="2.6" fill="#b7a58f" />
      </g>
      <g stroke="#5e4f43" strokeWidth="1.1" fill="#d8c7b0">
        <circle cx="30" cy="19" r="2.2" />
        <circle cx="44" cy="18" r="1.8" />
        <circle cx="52" cy="22" r="1.9" transform="translate(0 -1)" />
      </g>
    </Block>
  ),
  sandstone: (
    <Block front="#d9b878" top="#e8cf9a" side="#b99655">
      <g {...TEX} stroke="#8a6a30" strokeWidth="2">
        <path d="M11 33 L11.1 33 M19 36 L19.1 36 M27 32 L27.1 32 M35 35 L35.1 35 M42 32 L42.1 32 M13 41 L13.1 41 M22 43 L22.1 43 M31 40 L31.1 40 M39 43 L39.1 43 M12 49 L12.1 49 M20 50 L20.1 50 M29 48 L29.1 48 M37 50 L37.1 50 M43 48 L43.1 48" />
        <path d="M25 18 L25.1 18 M33 17 L33.1 17 M42 19 L42.1 19 M50 18 L50.1 18" strokeWidth="1.6" />
      </g>
    </Block>
  ),
  mudstone: (
    <Block front="#8a766b" top="#a69288" side="#6a584f">
      <g {...TEX} stroke="#4a3b33" strokeWidth="1.2">
        <path d="M11 33 L20 33 M27 36 L38 36 M12 41 L24 41 M31 44 L41 44 M10 49 L19 49 M26 50 L36 50" />
      </g>
      <g {...TEX} stroke="#b9a99d" strokeWidth="1" strokeOpacity="0.8">
        <path d="M15 37 L24 37 M30 40 L40 40 M14 45 L26 45" />
      </g>
    </Block>
  ),
  limestone: (
    <Block front="#d8d6c6" top="#e9e7da" side="#b9b7a6">
      <g {...TEX} stroke="#8f8d7d" strokeWidth="1.5">
        <path d="M12 34 L12.1 34 M24 38 L24.1 38 M35 33 L35.1 33 M18 47 L18.1 47 M31 49 L31.1 49 M41 43 L41.1 43" />
        <path d="M15 40 L21 40 M33 41 L38 41" strokeOpacity="0.6" />
      </g>
    </Block>
  ),
  shale: (
    <Block front="#6d7885" top="#8996a4" side="#55606c">
      <g {...TEX} stroke="#c9d3de" strokeWidth="1.3" strokeOpacity="0.85">
        <path d="M7 30 L45 30 M7 34 L45 34 M7 38 L45 38 M7 42 L45 42 M7 46 L45 46 M7 50 L45 50" />
      </g>
      <g {...TEX} stroke="#3d4650" strokeWidth="1.2">
        <path d="M7 32 L45 32 M7 36 L45 36 M7 40 L45 40 M7 44 L45 44 M7 48 L45 48 M7 52 L45 52" />
      </g>
    </Block>
  ),
};

const FOSSIL_STYLE = { fill: '#ffffff', fillOpacity: 0.6, stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const FOSSIL_LINE = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

/** 화석 모양. 이 그림 key의 표본에서 화석을 살펴본 뒤에만 쓰인다. 화석이 없는 표본은 항목이 없다. */
const FOSSILS: Record<string, ReactNode> = {
  // 조개 껍데기: 부채꼴과 결
  sandstone: (
    <g>
      <path d="M13 50 Q13 33 26 33 Q39 33 39 50 Z" {...FOSSIL_STYLE} />
      <path d="M26 50 L26 34 M26 50 L18 36 M26 50 L34 36 M26 50 L14 42 M26 50 L38 42" {...FOSSIL_LINE} strokeWidth={1.2} />
    </g>
  ),
  // 고사리 잎: 줄기와 작은 잎
  mudstone: (
    <g>
      <path d="M12 50 Q22 42 40 32" {...FOSSIL_LINE} strokeWidth={2} />
      <path d="M17 47 L15 40 M22 44 L21 36 M27 41 L27 33 M32 38 L34 31 M17 47 L21 52 M22 44 L27 48 M27 41 L33 45 M32 38 L38 41" {...FOSSIL_LINE} />
    </g>
  ),
  // 산호: 가지가 갈라진 모양
  limestone: (
    <g>
      <path d="M26 52 L26 40 M26 45 L19 37 M26 42 L33 34 M19 37 L16 31 M19 37 L23 31 M33 34 L30 29 M33 34 L38 31" {...FOSSIL_LINE} strokeWidth={2.4} />
      <circle cx="16" cy="30" r="1.8" {...FOSSIL_STYLE} />
      <circle cx="23" cy="30" r="1.8" {...FOSSIL_STYLE} />
      <circle cx="30" cy="28" r="1.8" {...FOSSIL_STYLE} />
      <circle cx="38" cy="30" r="1.8" {...FOSSIL_STYLE} />
    </g>
  ),
  // 나뭇잎: 잎몸과 잎맥
  shale: (
    <g>
      <path d="M12 50 Q14 33 38 32 Q40 48 12 50 Z" {...FOSSIL_STYLE} />
      <path d="M12 50 L35 35 M20 44 L22 37 M26 41 L28 34 M24 44 L32 45 M30 40 L37 42" {...FOSSIL_LINE} strokeWidth={1.2} />
    </g>
  ),
};

export const STRATA_ICON_KEYS = Object.keys(ICONS);

export function StrataIcon({ icon, size = 56, shown = [] }: { icon: string; size?: number; shown?: string[] }) {
  const body = ICONS[icon];
  const fossil = shown.includes('fossil') ? FOSSILS[icon] : undefined;
  return (
    <svg className="animal-icon strata-icon" viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" focusable="false">
      {body ?? <circle cx="32" cy="32" r="20" fill="none" stroke="currentColor" strokeWidth="2.5" />}
      {fossil && (
        <g className="strata-fossil" data-testid="fossil-shape">
          {fossil}
        </g>
      )}
    </svg>
  );
}
