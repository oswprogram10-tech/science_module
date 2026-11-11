import { crystalCount, type SeaDishKind, type SeaWaterSample } from '@sci/engine-earth';
import type { ViewProps } from '../types';
import { DISH_TEXT, WATER_TEXT, seaWaterNote, startSample, toParams } from './initial';

// viewBox 폭 240은 1280 px 화면에서 이 칸의 실제 폭(약 230 px)과 거의 같다. 글자 14는 화면에서도 약 13 px 이상이다.
export const W = 240;
export const H = 184;
/** 접시 가장자리 높이 */
const RIM_Y = 74;
const CENTER_X = 120;

/** 접시 바닥(가운데)의 높이와 물이 가득 찼을 때의 깊이 */
export const DISH_BOTTOM: Record<SeaDishKind, number> = { round: 104, square: 108 };
const DISH_DEPTH: Record<SeaDishKind, number> = { round: 30, square: 34 };
const DISH_PATH: Record<SeaDishKind, string> = {
  round: `M50 ${RIM_Y} Q120 134 190 ${RIM_Y} Z`,
  square: `M52 ${RIM_Y} L60 108 H180 L188 ${RIM_Y} Z`,
};
/** 접시에 물이 가득 찬 양(mL): 그림에서 물 높이를 정하는 기준 */
const FULL_ML = 100;

/** 접시 바닥의 높이(x에서) */
export const dishFloorY = (kind: SeaDishKind, x: number) => {
  if (kind === 'square') return DISH_BOTTOM.square;
  const t = (x - 50) / 140;
  return RIM_Y + 120 * t * (1 - t);
};

/** 접시 위 하얀 결정 자리: 가운데에서 바깥으로, 아래 줄부터(한 줄에 10개) */
export function crystalSlots(kind: SeaDishKind, n: number): { x: number; y: number }[] {
  const order = [4.5, 5.5, 3.5, 6.5, 2.5, 7.5, 1.5, 8.5, 0.5, 9.5];
  return Array.from({ length: n }, (_, i) => {
    const row = Math.floor(i / 10);
    const x = CENTER_X + (order[i % 10]! - 5) * 8;
    return { x, y: dishFloorY(kind, x) - 4.5 - row * 7 };
  });
}

/** 접시 속 물 높이(그림 단위) */
export const waterHeight = (kind: SeaDishKind, ml: number) => (Math.max(0, ml) / FULL_ML) * DISH_DEPTH[kind];

export function SeaWaterMacroView({ trial, snapshot, values, experiment }: ViewProps<SeaWaterSample>) {
  const p = toParams(values);
  const ran = trial !== undefined;
  const s = snapshot ?? startSample(values, experiment);
  const note = ran ? seaWaterNote(s) : '실험하면 접시의 물이 증발한 뒤 접시에 무엇이 남는지 볼 수 있어요.';
  const heating = ran && s.heating;
  // 다 마른 모습은 실행한 뒤에만 그린다.
  const dry = ran && !s.heating;
  const crystals = dry ? crystalCount(s.residueG) : 0;
  const slots = crystalSlots(p.dish, crystals);
  const wh = waterHeight(p.dish, s.dishWaterMl);
  const bottom = DISH_BOTTOM[p.dish];

  return (
    <figure className="view sea-water-macro" aria-label="눈으로 보기">
      <figcaption>눈으로 보기</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${WATER_TEXT[p.water]} ${p.volumeMl} mL를 ${DISH_TEXT[p.dish]}에 붓고 알코올램프로 가열해요. ${note}`}>
        <defs>
          <clipPath id="sw-dish-clip">
            <path d={DISH_PATH[p.dish]} />
          </clipPath>
        </defs>
        <text x="12" y="20" fontSize="14" fontWeight="700" fill="currentColor" data-testid="water-label">{WATER_TEXT[p.water]} {p.volumeMl} mL</text>
        <text x="12" y="42" fontSize="14" fill="currentColor" data-testid="dish-label">{DISH_TEXT[p.dish]}</text>

        <g data-testid="dish-art" data-dish={p.dish} data-heating={heating ? 'true' : 'false'} data-dry={dry ? 'true' : 'false'} data-dish-water={s.dishWaterMl.toFixed(2)}>
          <g clipPath="url(#sw-dish-clip)">
            {wh > 0.05 && <rect x="40" y={bottom - wh} width="160" height={wh + 2} fill="#8ec9ee" fillOpacity="0.9" data-testid="dish-water" />}
          </g>
          {/* 강물은 다 말라도 거의 보이지 않는 얇은 자국만 남는다 */}
          {dry && crystals === 0 && <rect x="92" y={bottom - 1.5} width="56" height="1.5" fill="#9ca3af" fillOpacity="0.5" data-testid="dish-film" />}
          {slots.map((q, i) => (
            <rect key={i} data-testid="dish-crystal" x={q.x - 3} y={q.y - 3} width="6" height="6" fill="#ffffff" stroke="#374151" strokeWidth="1" />
          ))}
          <path d={DISH_PATH[p.dish]} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
          {heating && s.dishWaterMl > 1e-9 && (
            <g data-testid="steam" fill="none" stroke="#6b7280" strokeWidth="1.8" strokeLinecap="round">
              <path d="M104 66 q-4 -5 0 -10 q4 -5 0 -10" />
              <path d="M120 66 q-4 -5 0 -10 q4 -5 0 -10" />
              <path d="M136 66 q-4 -5 0 -10 q4 -5 0 -10" />
            </g>
          )}
          {/* 삼발이(받침)와 석면 망 위에 접시를 올리고, 바로 아래 가운데에 알코올램프를 둔다 */}
          <g data-testid="lamp-stand" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="62" y1={bottom + 2} x2="178" y2={bottom + 2} />
            <line x1="68" y1={bottom + 2} x2="54" y2="152" />
            <line x1="172" y1={bottom + 2} x2="186" y2="152" />
            <line x1="40" y1="152" x2="200" y2="152" strokeWidth="2" />
          </g>
          {heating && <ellipse cx={CENTER_X} cy={bottom + 12} rx="6" ry="8" fill="#f97316" stroke="#c2410c" strokeWidth="1.2" data-testid="flame" />}
          <rect x="117" y="126" width="6" height="8" fill="#6b7280" data-testid="lamp-wick" />
          <rect x="96" y="134" width="48" height="18" rx="5" fill="#cbd5e1" stroke="currentColor" strokeWidth="2" data-testid="lamp-body" />
        </g>
        <text x={CENTER_X} y="173" fontSize="14" textAnchor="middle" fill="currentColor">알코올램프</text>
      </svg>
      <p className="view-note" data-testid="sea-water-note">{note}</p>
    </figure>
  );
}
