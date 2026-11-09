import { useId, type ReactNode } from 'react';

/**
 * 물체 카드 그림(물체와 물질). 단순한 도형으로 물질감을 그리고 글자는 넣지 않는다(그림은 장식이라 스크린 리더에는 읽히지 않는다).
 * 윤곽선은 currentColor(밝은 화면 어두운 글자색, 어두운 화면 밝은 글자색), 채움색은 두 배경 모두에서 보이는 중간 밝기를 쓴다.
 *  - 쇠못: 철회색 몸통과 하얀 광택 줄 / 유리구슬: 속이 비치는 연한 하늘색 공과 하얀 반사
 *  - 나무 블록: 갈색 면과 나뭇결 / 플라스틱 자: 비치는 푸른 판과 눈금 / 고무줄: 두꺼운 붉은 고리
 *  - 종이: 하얀 쪽과 접힌 귀퉁이, 줄 / 면 손수건: 무늬 있는 천과 박음질 / 알루미늄 포일: 은색 판과 반짝이는 줄
 *
 * 기본 그림은 모두 반듯하고 마른 모습이라 어떤 성질도 드러내지 않는다.
 * 시험한 특징(shown)에 대해서만 결과 그림이 겹쳐진다: 눌림(모양이 그대로이거나 납작해짐), 구부림(곧거나 휘어짐),
 * 물방울(동그랗게 맺히거나 번지며 스밈). 시험하지 않은 특징의 결과는 그림에 그려지지 않는다.
 */
const S = { stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const ARROW = { fill: 'none', stroke: '#e06a00', strokeWidth: 3, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

const ICONS: Record<string, ReactNode> = {
  nail: (
    <g {...S}>
      <ellipse cx="11" cy="32" rx="4.5" ry="11" fill="#8d99a6" />
      <path d="M14 29 L52 29 L60 32 L52 35 L14 35 Z" fill="#9aa6b3" />
      <path d="M16 30.8 L50 30.8" fill="none" stroke="#ffffff" strokeOpacity="0.8" strokeWidth="1.6" />
      <path d="M10 24 L10 31" fill="none" stroke="#ffffff" strokeOpacity="0.75" strokeWidth="1.6" />
    </g>
  ),
  marble: (
    <g {...S}>
      <circle cx="32" cy="34" r="20" fill="#8fd0e8" fillOpacity="0.55" />
      <path d="M22 36 C26 28 36 30 40 36 C44 42 36 48 30 46" fill="none" stroke="#2f86a3" strokeWidth="2.4" />
      <circle cx="32" cy="34" r="13" fill="none" stroke="#ffffff" strokeOpacity="0.6" strokeWidth="1.4" />
      <path d="M19 28 C21 22 26 18 31 17" fill="none" stroke="#ffffff" strokeOpacity="0.95" strokeWidth="3" />
    </g>
  ),
  woodblock: (
    <g {...S}>
      <path d="M8 28 L20 16 L58 16 L46 28 Z" fill="#dcae72" />
      <path d="M46 28 L58 16 L58 42 L46 54 Z" fill="#a8733a" />
      <rect x="8" y="28" width="38" height="26" fill="#c18c4f" />
      <path d="M12 34 C22 31 32 37 42 34 M12 41 C22 38 32 44 42 41 M12 48 C22 45 32 50 42 48" fill="none" stroke="#6e4519" strokeWidth="1.3" />
      <path d="M26 21 C32 19 40 22 48 20 M50 24 C52 28 52 34 52 40" fill="none" stroke="#7a4e1f" strokeWidth="1.2" />
    </g>
  ),
  ruler: (
    <g {...S}>
      <rect x="4" y="22" width="56" height="20" rx="2.5" fill="#72bfe0" fillOpacity="0.85" />
      <path d="M10 22 L10 29 M16 22 L16 26 M22 22 L22 29 M28 22 L28 26 M34 22 L34 29 M40 22 L40 26 M46 22 L46 29 M52 22 L52 26" fill="none" strokeWidth="1.6" />
      <circle cx="52" cy="35" r="2.2" fill="none" strokeWidth="1.6" />
      <path d="M8 38 L40 38" fill="none" stroke="#ffffff" strokeOpacity="0.85" strokeWidth="1.8" />
    </g>
  ),
  rubberband: (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="32" cy="34" rx="22" ry="13" stroke="currentColor" strokeWidth="10.5" />
      <ellipse cx="32" cy="34" rx="22" ry="13" stroke="#d9453d" strokeWidth="6.5" />
      <path d="M16 28 C20 23 26 21 32 21" stroke="#ffffff" strokeOpacity="0.7" strokeWidth="1.8" />
    </g>
  ),
  paper: (
    <g {...S}>
      <path d="M16 14 L40 14 L50 24 L50 56 L16 56 Z" fill="#f4f1e6" />
      <path d="M40 14 L40 24 L50 24" fill="#d6cfb8" />
      <path d="M22 33 L44 33 M22 39 L44 39 M22 45 L44 45 M22 51 L36 51" fill="none" stroke="#8c8c8c" strokeWidth="1.4" />
    </g>
  ),
  handkerchief: (
    <g {...S}>
      <path d="M9 14 Q32 10 55 14 Q58 33 55 52 Q32 56 9 52 Q6 33 9 14 Z" fill="#f0a9bb" />
      <path d="M13 18 Q32 15 51 18 Q53 33 51 48 Q32 51 13 48 Q11 33 13 18 Z" fill="none" stroke="#ffffff" strokeOpacity="0.85" strokeWidth="1.3" strokeDasharray="3 3" />
      <path d="M22 16 L22 52 M32 14 L32 54 M42 16 L42 52 M8 26 L56 26 M7 36 L57 36 M8 46 L56 46" fill="none" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="1.4" />
    </g>
  ),
  foil: (
    <g {...S}>
      <path d="M6 44 L20 16 L58 16 L46 44 Z" fill="#c4ced8" />
      <path d="M16 38 L26 20 M26 40 L36 20 M38 40 L47 22" fill="none" stroke="#ffffff" strokeOpacity="0.85" strokeWidth="2.6" />
      <path d="M6 44 L46 44 L46 49 L6 49 Z" fill="#9aa6b3" />
    </g>
  ),
};

/**
 * 시험 결과(교과서 표와 같다): 눌러도 모양이 그대로인가, 구부리면 휘어지는가, 물을 빨아들이는가.
 * 시험한 특징에 대해서만 그림에 쓰인다. 매니페스트의 카드 특징값과 같은지 단위 테스트가 확인한다.
 */
export const MATERIAL_RESULT: Record<string, { hard: boolean; bends: boolean; absorbs: boolean }> = {
  nail: { hard: true, bends: false, absorbs: false },
  marble: { hard: true, bends: false, absorbs: false },
  woodblock: { hard: true, bends: false, absorbs: true },
  ruler: { hard: true, bends: true, absorbs: false },
  rubberband: { hard: false, bends: true, absorbs: false },
  paper: { hard: false, bends: true, absorbs: true },
  handkerchief: { hard: false, bends: true, absorbs: true },
  foil: { hard: false, bends: true, absorbs: false },
};

/** 물방울을 떨어뜨릴 자리와 번지는 크기. */
const DROP: Record<string, { x: number; y: number; rx: number; ry: number }> = {
  nail: { x: 34, y: 29, rx: 0, ry: 0 },
  marble: { x: 32, y: 15, rx: 0, ry: 0 },
  woodblock: { x: 34, y: 22, rx: 9, ry: 3.6 },
  ruler: { x: 32, y: 22, rx: 0, ry: 0 },
  rubberband: { x: 32, y: 22, rx: 0, ry: 0 },
  paper: { x: 33, y: 30, rx: 8, ry: 6 },
  handkerchief: { x: 32, y: 32, rx: 17, ry: 12 },
  foil: { x: 36, y: 20, rx: 0, ry: 0 },
};

/** 납작하게 눌릴 때의 바닥 높이와 세로 배율. */
const FLOOR = 56;
const SQUASH = 0.7;
const squashed = (y: number) => FLOOR + (y - FLOOR) * SQUASH;

export const MATERIAL_ICON_KEYS = Object.keys(ICONS);

export function MaterialIcon({ icon, size = 56, shown = [] }: { icon: string; size?: number; shown?: string[] }) {
  const uid = useId().replace(/:/g, '');
  const body = ICONS[icon];
  const truth = MATERIAL_RESULT[icon];
  const press = !!truth && shown.includes('hard');
  const bend = !!truth && shown.includes('bends');
  const drop = !!truth && shown.includes('absorbs');
  const flat = press && !truth!.hard;
  const bent = bend && truth!.bends;

  let drawing: ReactNode = body;
  if (bent) {
    drawing = (
      <>
        <clipPath id={`${uid}-l`}><rect x="0" y="0" width="32" height="64" /></clipPath>
        <clipPath id={`${uid}-r`}><rect x="32" y="0" width="32" height="64" /></clipPath>
        <g clipPath={`url(#${uid}-l)`}><g transform="rotate(11 32 34)">{body}</g></g>
        <g clipPath={`url(#${uid}-r)`}><g transform="rotate(-11 32 34)">{body}</g></g>
      </>
    );
  }
  if (flat) drawing = <g transform={`translate(0 ${FLOOR * (1 - SQUASH)}) scale(1 ${SQUASH})`}>{drawing}</g>;

  const d = DROP[icon];
  const dy = d ? (flat ? squashed(d.y) : d.y) : 0;

  return (
    <svg className="animal-icon material-icon" viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" focusable="false">
      {body ? drawing : <circle cx="32" cy="32" r="20" fill="none" stroke="currentColor" strokeWidth="2.5" />}
      {press && (
        <g className="mat-result mat-press" {...ARROW}>
          <path d="M32 1 L32 10 M28 6.5 L32 10.5 L36 6.5" />
        </g>
      )}
      {bend && (
        <g className="mat-result mat-bend" {...ARROW} strokeWidth={2.6}>
          <path d="M3 18 Q2 26 7 31 M3.5 27 L7 31.5 L10 27" />
          <path d="M61 18 Q62 26 57 31 M60.5 27 L57 31.5 L54 27" />
        </g>
      )}
      {drop && d && truth!.absorbs && (
        <g className="mat-result mat-stain">
          <ellipse cx={d.x} cy={dy} rx={d.rx} ry={d.ry * (flat ? SQUASH : 1)} fill="#1c4f86" fillOpacity="0.5" stroke="#1c4f86" strokeWidth="1.2" strokeDasharray="2 2" />
        </g>
      )}
      {drop && d && !truth!.absorbs && (
        <g className="mat-result mat-bead">
          <ellipse cx={d.x} cy={dy - 2.8} rx="4.2" ry="3.2" fill="#6bbcf2" stroke="#1d6fb0" strokeWidth="1.3" />
          <circle cx={d.x - 1.4} cy={dy - 3.8} r="1" fill="#ffffff" />
        </g>
      )}
    </svg>
  );
}
