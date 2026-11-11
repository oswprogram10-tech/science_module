import type { SpringObject, SpringScaleSample } from '@sci/engine-physics';
import type { ViewProps } from '../types';
import { COLOR_FILL, COLOR_TEXT, OBJECT_TEXT, springNote, startSample, toParams } from './initial';

// viewBox 폭 240은 1280 px 화면에서 이 칸의 실제 폭(약 230 px)과 거의 같다. 글자 14는 화면에서도 약 13 px 이상이다.
export const W = 240;
export const H = 262;
/** 용수철을 거는 막대의 y, 늘어나지 않았을 때 용수철 아래 끝(눈금 0 cm)의 y */
export const BAR_Y = 52;
export const ZERO_Y = 80;
/** 1 cm당 그림 단위 */
export const PER_CM = 4.4;
/** 세운 자의 x와 눈금 글자의 x */
export const RULER_X = 44;
/** 걸었을 때 용수철·추·물체의 가운데 x */
export const SPRING_X = 112;
export const DISC = { w: 40, h: 8, gap: 1 } as const;
/** 함께 거는 물체 상자의 크기: 가위와 풀을 눈으로 구별하기 어렵도록 모든 물체가 같은 크기이다. */
export const OBJ = { w: 44, h: 30 } as const;
/** 걸기 전 추와 물체를 놓아 둔 받침의 바닥 y와 가운데 x */
export const TRAY = { y: 244, weightsX: 160, objectX: 212 } as const;
export const RULER_LABELS = [0, 5, 10, 15] as const;

/** 늘어난 길이(cm) → 용수철 아래 끝의 y */
export const bottomY = (stretchCm: number) => ZERO_Y + PER_CM * stretchCm;

function ObjectIcon({ object }: { object: Exclude<SpringObject, 'none'> }) {
  // 모든 물체는 44 × 30 상자 안에 그린다(원점은 상자 왼쪽 위).
  switch (object) {
    case 'case':
      return (
        <g data-testid="obj-icon" data-object="case">
          <rect x="0" y="0" width={OBJ.w} height={OBJ.h} rx="8" fill="#6366f1" stroke="currentColor" strokeWidth="2" />
          <line x1="6" y1="15" x2={OBJ.w - 6} y2="15" stroke="#e0e7ff" strokeWidth="2" strokeDasharray="3 3" />
        </g>
      );
    case 'scissors':
      return (
        <g data-testid="obj-icon" data-object="scissors">
          <rect x="0" y="0" width={OBJ.w} height={OBJ.h} rx="4" fill="#f1f5f9" stroke="currentColor" strokeWidth="2" />
          <circle cx="12" cy="21" r="5" fill="none" stroke="#dc2626" strokeWidth="2" />
          <circle cx="12" cy="9" r="5" fill="none" stroke="#dc2626" strokeWidth="2" />
          <line x1="16" y1="18" x2="38" y2="9" stroke="#475569" strokeWidth="2" />
          <line x1="16" y1="12" x2="38" y2="21" stroke="#475569" strokeWidth="2" />
        </g>
      );
    case 'glue':
      return (
        <g data-testid="obj-icon" data-object="glue">
          <rect x="0" y="0" width={OBJ.w} height={OBJ.h} rx="4" fill="#f1f5f9" stroke="currentColor" strokeWidth="2" />
          <rect x="6" y="9" width="26" height="12" rx="2" fill="#38bdf8" stroke="#0c4a6e" strokeWidth="2" />
          <rect x="32" y="11" width="8" height="8" rx="1" fill="#f8fafc" stroke="#0c4a6e" strokeWidth="2" />
        </g>
      );
    case 'pencils':
      return (
        <g data-testid="obj-icon" data-object="pencils">
          <rect x="0" y="0" width={OBJ.w} height={OBJ.h} rx="4" fill="#f1f5f9" stroke="currentColor" strokeWidth="2" />
          {['#ef4444', '#f59e0b', '#22c55e', '#3b82f6'].map((c, i) => (
            <line key={c} x1={9 + i * 9} y1="5" x2={9 + i * 9} y2="25" stroke={c} strokeWidth="5" strokeLinecap="round" />
          ))}
        </g>
      );
  }
}

function Discs({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <rect key={i} data-testid="weight-disc" x={-DISC.w / 2} y={i * (DISC.h + DISC.gap)} width={DISC.w} height={DISC.h} rx="2" fill="#94a3b8" stroke="currentColor" strokeWidth="1.5" />
      ))}
    </>
  );
}

export function SpringMacroView({ trial, snapshot, values }: ViewProps<SpringScaleSample>) {
  const p = toParams(values);
  const ran = trial !== undefined;
  const s = snapshot ?? startSample(values);
  const note = ran ? springNote(s) : '실험하면 용수철이 얼마나 늘어나는지 볼 수 있어요.';
  const hasObj = p.object !== 'none';
  const stack = p.weights * (DISC.h + DISC.gap);
  const by = bottomY(ran ? s.stretchCm : 0);
  // 실행하기 전에는 추와 물체가 받침에 놓여 있고, 실행하면 용수철 끝에 걸린다.
  const weightsTop = ran ? by + 10 : TRAY.y - stack;
  const weightsX = ran ? SPRING_X : TRAY.weightsX;
  const objTop = ran ? by + 10 + stack + (stack > 0 ? 4 : 0) : TRAY.y - OBJ.h;
  const objX = ran ? SPRING_X : TRAY.objectX;
  const coils = 9;
  const coilTop = BAR_Y + 4;
  const coilLen = Math.max(8, by - coilTop);
  const zig = Array.from({ length: coils * 2 + 1 }, (_, i) => `${(SPRING_X + (i === 0 || i === coils * 2 ? 0 : i % 2 === 0 ? -9 : 9)).toFixed(1)} ${(coilTop + (coilLen * i) / (coils * 2)).toFixed(1)}`).join(' L');

  return (
    <figure className="view spring-macro" aria-label="눈으로 보기">
      <figcaption>눈으로 보기</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`용수철저울: 추 ${p.weights}개, 함께 건 물체 ${hasObj ? OBJECT_TEXT[p.object] : '없음'}, 용수철 색깔 ${COLOR_TEXT[p.springColor]}. ${note}`}>
        <text x="12" y="18" fontSize="14" fontWeight="700" fill="currentColor" data-testid="spring-label">추 {p.weights}개 · {hasObj ? OBJECT_TEXT[p.object] : '물체 없음'}</text>
        <text x="12" y="38" fontSize="14" fill="currentColor" data-testid="spring-sub">용수철 {COLOR_TEXT[p.springColor]}</text>
        {/* 용수철을 거는 막대 */}
        <line x1={SPRING_X - 40} y1={BAR_Y} x2={SPRING_X + 40} y2={BAR_Y} stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        {/* 세운 자: 위쪽 0 cm가 늘어나지 않은 용수철의 아래 끝 */}
        <g data-testid="spring-ruler">
          <line x1={RULER_X} y1={ZERO_Y} x2={RULER_X} y2={ZERO_Y + PER_CM * 18} stroke="currentColor" strokeWidth="2" />
          {Array.from({ length: 19 }, (_, i) => (
            <line key={i} x1={RULER_X - (i % 5 === 0 ? 10 : 6)} y1={ZERO_Y + PER_CM * i} x2={RULER_X} y2={ZERO_Y + PER_CM * i} stroke="currentColor" strokeWidth="1.5" />
          ))}
          {RULER_LABELS.map((v) => (
            <text key={v} x={RULER_X - 14} y={ZERO_Y + PER_CM * v + 5} textAnchor="end" fontSize="14" fill="currentColor">{v}</text>
          ))}
        </g>
        <g data-testid="spring-art" data-weights={p.weights} data-object={p.object} data-stretch={(ran ? s.stretchCm : 0).toFixed(2)} data-hung={ran ? 'yes' : 'no'}>
          <path d={`M${zig}`} fill="none" stroke={COLOR_FILL[p.springColor]} strokeWidth="3" strokeLinejoin="round" data-testid="spring-coil" data-color={p.springColor} />
          {/* 용수철 아래 끝의 고리와 자를 가리키는 지시선 */}
          <circle cx={SPRING_X} cy={by + 4} r="4" fill="none" stroke="currentColor" strokeWidth="2" />
          <line x1={RULER_X + 2} y1={by} x2={SPRING_X - 10} y2={by} stroke="#dc2626" strokeWidth="2" data-testid="spring-pointer" />
          {ran && stack > 0 && <line x1={SPRING_X} y1={by + 8} x2={SPRING_X} y2={weightsTop} stroke="currentColor" strokeWidth="1.5" />}
          {ran && stack === 0 && hasObj && <line x1={SPRING_X} y1={by + 8} x2={SPRING_X} y2={objTop} stroke="currentColor" strokeWidth="1.5" />}
          <g transform={`translate(${weightsX} ${weightsTop.toFixed(1)})`} data-testid="weights-stack">
            <Discs count={p.weights} />
          </g>
          {p.object !== 'none' && (
            <g transform={`translate(${(objX - OBJ.w / 2).toFixed(1)} ${objTop.toFixed(1)})`} data-testid="obj-box" data-hung={ran ? 'yes' : 'no'}>
              <ObjectIcon object={p.object} />
            </g>
          )}
          {ran && stack > 0 && hasObj && <line x1={SPRING_X} y1={weightsTop + stack - 1} x2={SPRING_X} y2={objTop} stroke="currentColor" strokeWidth="1.5" />}
        </g>
      </svg>
      <p className="view-note" data-testid="spring-note">{note}</p>
    </figure>
  );
}
