import type { HeatContactSample } from '@sci/engine-physics';
import type { ViewProps } from '../types';
import { CUP_TEXT, LABEL_TEXT, clamp01, heatNote, startSample, toParams } from './initial';

// viewBox 폭 240은 1280 px 화면에서 이 칸의 실제 폭(약 230 px)과 거의 같다. 글자 14는 화면에서도 약 13 px 이상이다.
export const W = 240;
export const H = 252;
/** 바깥 비커와 안쪽 컵 */
export const OUTER = { x0: 40, x1: 214, top: 112, bottom: 234 };
export const INNER = { x0: 66, x1: 140, top: 112, bottom: 206 };
/** 물 윗면(y): 안쪽은 100 mL 고정, 바깥은 100 mL일 때 낮고 300 mL일 때 높다. */
export const INNER_WATER_TOP = 142;
export const outerWaterTop = (coldMl: number) => (coldMl >= 300 ? 128 : 190);
/** 가상 온도계: 안쪽 컵 속과 바깥 물속 */
export const THERMO = {
  inner: { x: 104, top: 102, bulbY: 190 },
  outer: { x: 184, top: 102, bulbY: 220 },
};
export const THERMO_MAX_C = 80;

/** 온도 → 수은 기둥 윗끝 y(0 °C는 구 위, 80 °C는 관 윗끝) */
export const mercuryTop = (which: 'inner' | 'outer', c: number): number => {
  const t = THERMO[which];
  const span = t.bulbY - 6 - t.top;
  return t.bulbY - 6 - clamp01(c / THERMO_MAX_C) * span;
};

const LABEL_FILL = { yellow: '#facc15', green: '#22c55e' } as const;

export function HeatMacroView({ trial, snapshot, values }: ViewProps<HeatContactSample>) {
  const p = toParams(values);
  // 실행하기 전에는 처음 온도(t = 0)를 보여 준다. 10분 뒤의 값은 실행한 뒤에야 나타난다.
  const s = snapshot ?? startSample(values);
  const ran = trial !== undefined;
  const note = ran ? heatNote(s) : `처음: 안쪽 ${p.hotC} °C, 바깥 20 °C. 실험하면 온도가 어떻게 달라지는지 볼 수 있어요.`;
  const metal = p.cup === 'metal';
  const waterTop = outerWaterTop(p.coldMl);
  const tag = { x: INNER.x0 + 6, y: 168, w: 22, h: 14 };

  return (
    <figure className="view heat-macro" aria-label="눈으로 보기">
      <figcaption>눈으로 보기</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`비커 안의 컵: 안쪽 컵 ${p.hotC} °C 물 100 mL, ${CUP_TEXT[p.cup]}, ${LABEL_TEXT[p.label]} 이름표. 바깥 비커 20 °C 찬물 ${p.coldMl} mL. ${note}`}>
        <text x="12" y="18" fontSize="14" fontWeight="700" fill="currentColor" data-testid="inner-label">안쪽 컵: {p.hotC} °C 물 100 mL</text>
        <text x="12" y="36" fontSize="14" fill="currentColor" data-testid="cup-label">{CUP_TEXT[p.cup]} · {LABEL_TEXT[p.label]} 이름표</text>
        <text x="12" y="54" fontSize="14" fill="currentColor" data-testid="outer-label">바깥: 20 °C 찬물 {p.coldMl} mL</text>
        <g data-testid="heat-art" data-cup={p.cup} data-label={p.label} data-cold={p.coldMl} data-inner={s.innerC.toFixed(2)} data-outer={s.outerC.toFixed(2)}>
          {/* 바깥 비커와 찬물 */}
          <rect x={OUTER.x0} y={waterTop} width={OUTER.x1 - OUTER.x0} height={OUTER.bottom - waterTop} fill="#8cc4ee" />
          <path d={`M${OUTER.x0} ${OUTER.top} V${OUTER.bottom} H${OUTER.x1} V${OUTER.top}`} fill="none" stroke="currentColor" strokeWidth="2.5" />
          {/* 안쪽 컵: 금속은 두껍고 회색, 플라스틱은 얇고 흰색 */}
          <rect data-testid="inner-water" x={INNER.x0} y={INNER_WATER_TOP} width={INNER.x1 - INNER.x0} height={INNER.bottom - INNER_WATER_TOP} fill="#f2a65a" />
          <path
            data-testid="inner-cup"
            data-material={p.cup}
            d={`M${INNER.x0} ${INNER.top} V${INNER.bottom} H${INNER.x1} V${INNER.top}`}
            fill="none"
            stroke={metal ? '#64748b' : '#e2e8f0'}
            strokeWidth={metal ? 5 : 2.5}
          />
          {!metal && <path d={`M${INNER.x0} ${INNER.top} V${INNER.bottom} H${INNER.x1} V${INNER.top}`} fill="none" stroke="currentColor" strokeWidth="1" opacity="0.55" />}
          {/* 이름표 */}
          <rect data-testid="cup-tag" data-color={p.label} x={tag.x} y={tag.y} width={tag.w} height={tag.h} fill={LABEL_FILL[p.label]} stroke="currentColor" strokeWidth="1.2" />
          {/* 온도계 두 개와 읽는 값 */}
          {(['inner', 'outer'] as const).map((k) => {
            const t = THERMO[k];
            const c = k === 'inner' ? s.innerC : s.outerC;
            return (
              <g key={k} data-testid={`thermo-${k}`}>
                <text x={t.x} y="82" fontSize="14" textAnchor="middle" fill="currentColor">{k === 'inner' ? '안쪽' : '바깥'}</text>
                <text x={t.x} y="98" fontSize="14" fontWeight="700" textAnchor="middle" fill="currentColor">{c.toFixed(1)} °C</text>
                <rect x={t.x - 3} y={t.top} width="6" height={t.bulbY - 6 - t.top} rx="3" fill="#fff" stroke="currentColor" strokeWidth="1.2" />
                <circle cx={t.x} cy={t.bulbY} r="6" fill="#d9443a" stroke="currentColor" strokeWidth="1.2" />
                <rect data-testid={`mercury-${k}`} x={t.x - 1.5} y={mercuryTop(k, c)} width="3" height={t.bulbY - 6 - mercuryTop(k, c)} fill="#d9443a" />
              </g>
            );
          })}
        </g>
      </svg>
      <p className="view-note" data-testid="heat-note">{note}</p>
    </figure>
  );
}
