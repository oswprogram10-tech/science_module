import type { ReactNode } from 'react';

/**
 * 동물 카드 그림. 단순한 도형으로 그리고 글자는 넣지 않는다(그림은 장식이라 스크린 리더에는 읽히지 않는다).
 * 윤곽선은 currentColor(밝은 화면 어두운 글자색, 어두운 화면 밝은 글자색), 채움색은 두 배경 모두에서 보이는 중간 밝기를 쓴다.
 */
const S = { stroke: 'currentColor', strokeWidth: 2.5, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const EYE = { fill: 'currentColor' } as const;

const ICONS: Record<string, ReactNode> = {
  ant: (
    <g {...S}>
      <path d="M22 38 L12 50 M32 38 L30 52 M42 38 L52 50 M22 32 L10 28 M32 32 L32 22 M42 32 L54 28" fill="none" />
      <ellipse cx="16" cy="36" rx="9" ry="7" fill="#b5651d" />
      <ellipse cx="30" cy="36" rx="7" ry="6" fill="#c9792c" />
      <ellipse cx="46" cy="36" rx="11" ry="8" fill="#b5651d" />
      <path d="M10 30 L5 22 M14 29 L16 20" fill="none" />
      <circle cx="12" cy="35" r="1.6" {...EYE} stroke="none" />
    </g>
  ),
  snail: (
    <g {...S}>
      <path d="M6 50 C6 42 14 42 22 42 L54 42 C60 42 60 50 54 50 Z" fill="#9ec08a" />
      <path d="M8 44 L5 30 M14 43 L15 30" fill="none" />
      <circle cx="38" cy="30" r="14" fill="#e0952b" />
      <path d="M38 30 m0 0 a4 4 0 1 1 4 4 a8 8 0 1 1 -8 -8" fill="none" />
      <circle cx="9" cy="46" r="1.6" {...EYE} stroke="none" />
    </g>
  ),
  earthworm: (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 40 C16 24 24 24 30 38 S44 52 56 28" stroke="currentColor" strokeWidth="13" />
      <path d="M8 40 C16 24 24 24 30 38 S44 52 56 28" stroke="#e58a8a" strokeWidth="8.5" />
      <path d="M22 28 L23 33 M35 43 L36 48" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="56" cy="27" r="1.4" fill="currentColor" stroke="none" />
    </g>
  ),
  cat: (
    <g {...S}>
      <path d="M14 30 L14 10 L26 20 M50 30 L50 10 L38 20" fill="#f0b35c" />
      <ellipse cx="32" cy="36" rx="20" ry="17" fill="#f0b35c" />
      <circle cx="24" cy="33" r="2.2" {...EYE} stroke="none" />
      <circle cx="40" cy="33" r="2.2" {...EYE} stroke="none" />
      <path d="M29 40 L35 40 L32 44 Z" fill="#e58a8a" />
      <path d="M32 44 C32 48 27 48 26 46 M32 44 C32 48 37 48 38 46" fill="none" strokeWidth="2" />
      <path d="M8 38 L20 40 M8 46 L20 43 M56 38 L44 40 M56 46 L44 43" fill="none" strokeWidth="1.8" />
    </g>
  ),
  crucian: (
    <g {...S}>
      <path d="M48 32 L60 20 L60 44 Z" fill="#5aa0d8" />
      <ellipse cx="30" cy="32" rx="22" ry="14" fill="#7fb6e3" />
      <path d="M24 19 C28 12 36 14 38 20" fill="#5aa0d8" />
      <path d="M26 34 C30 40 36 40 38 36" fill="none" strokeWidth="2" />
      <path d="M44 24 C46 30 46 34 44 40" fill="none" strokeWidth="1.8" />
      <circle cx="16" cy="29" r="2.2" {...EYE} stroke="none" />
    </g>
  ),
  /* 걷는 다리 8개와 집게다리 2개, 모두 10개(관찰 문장과 같다). */
  crab: (
    <g {...S}>
      <path d="M17 36 L5 38 M17 41 L6 47 M20 46 L11 55 M25 49 L20 60 M47 36 L59 38 M47 41 L58 47 M44 46 L53 55 M39 49 L44 60" fill="none" />
      <path d="M18 30 L10 18 M46 30 L54 18" fill="none" />
      <circle cx="9" cy="14" r="7" fill="#e0574a" />
      <path d="M9 7 L9 14" fill="none" strokeWidth="2" />
      <circle cx="55" cy="14" r="7" fill="#e0574a" />
      <path d="M55 7 L55 14" fill="none" strokeWidth="2" />
      <ellipse cx="32" cy="38" rx="17" ry="12" fill="#e0574a" />
      <path d="M26 27 L26 24 M38 27 L38 24" fill="none" />
      <circle cx="26" cy="23" r="2" {...EYE} stroke="none" />
      <circle cx="38" cy="23" r="2" {...EYE} stroke="none" />
    </g>
  ),
  sparrow: (
    <g {...S}>
      <path d="M12 40 L2 48 L10 50 Z" fill="#8a5a2b" />
      <ellipse cx="32" cy="38" rx="20" ry="14" fill="#a9794a" />
      <circle cx="46" cy="24" r="9" fill="#a9794a" />
      <path d="M54 22 L62 25 L54 28 Z" fill="#e0952b" />
      <path d="M22 36 C28 26 40 30 42 40 C34 46 26 44 22 36 Z" fill="#8a5a2b" />
      <path d="M28 52 L28 60 M38 52 L38 60" fill="none" />
      <circle cx="48" cy="22" r="1.8" {...EYE} stroke="none" />
    </g>
  ),
  butterfly: (
    <g {...S}>
      <path d="M32 30 C20 10 4 14 8 30 C10 38 22 38 32 32 Z" fill="#f08fb5" />
      <path d="M32 34 C22 36 10 40 14 52 C20 60 30 48 32 38 Z" fill="#9b6fd1" />
      <path d="M32 30 C44 10 60 14 56 30 C54 38 42 38 32 32 Z" fill="#f08fb5" />
      <path d="M32 34 C42 36 54 40 50 52 C44 60 34 48 32 38 Z" fill="#9b6fd1" />
      <rect x="29.5" y="22" width="5" height="30" rx="2.5" fill="#4b3a2a" />
      <path d="M31 22 C28 14 24 10 22 8 M33 22 C36 14 40 10 42 8" fill="none" strokeWidth="2" />
    </g>
  ),
};

export function AnimalIcon({ icon, size = 56 }: { icon: string; size?: number }) {
  return (
    <svg className="animal-icon" viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" focusable="false">
      {ICONS[icon] ?? <circle cx="32" cy="32" r="20" fill="none" stroke="currentColor" strokeWidth="2.5" />}
    </svg>
  );
}

export const ANIMAL_ICON_KEYS = Object.keys(ICONS);
