import type { LightNeededSample, LnBox, LnObject } from '@sci/engine-physics';
import type { ViewProps } from '../types';
import { BOX_TEXT, FLASHLIGHT_TEXT, OBJECT_TEXT, clamp01, lightNote, lightResult, startSample, toParams, visibleText } from './initial';

// viewBox 폭 240은 1280 px 화면에서 이 칸의 실제 폭(약 230 px)과 거의 같다. 글자 14는 화면에서도 약 13 px 이상이다.
export const W = 240;
export const H = 240;
/** 위에서 본 상자: 바깥 벽과 안쪽 */
export const BOX = { x: 40, y: 52, w: 140, h: 100, wall: 9 };
/** 들여다보는 구멍(왼쪽 벽)의 가운데 높이 */
export const HOLE_Y = 103;
/** 구멍으로 본 장면을 보여 주는 둥근 창 */
export const WINDOW = { cx: 186, cy: 198, r: 34 };
/** 상자 안쪽 색(빛이 새지 않는 검은색) */
export const INSIDE = '#0b1220';
/** 상자 겉 색깔(안쪽은 둘 다 검은색) */
export const BOX_FILL: Record<LnBox, string> = { black: '#1f2937', white: '#f8fafc' };

/** 상자 안 물체 그림(위에서 본 모습이 아니라 옆모습). cx, cy는 그림의 중심. s는 크기 배율. */
function ObjectArt({ object, cx, cy, s, testid }: { object: LnObject; cx: number; cy: number; s: number; testid: string }) {
  if (object === 'doll') {
    return (
      <g data-testid={testid} data-object="doll" stroke="#374151" strokeWidth="1.5">
        <circle cx={cx} cy={cy - 8 * s} r={8 * s} fill="#f5c9a0" />
        <rect x={cx - 9 * s} y={cy + 1 * s} width={18 * s} height={22 * s} rx={4 * s} fill="#60a5fa" />
      </g>
    );
  }
  return (
    <g data-testid={testid} data-object="bulb" stroke="#374151" strokeWidth="1.5">
      <rect x={cx - 5 * s} y={cy + 9 * s} width={10 * s} height={9 * s} fill="#94a3b8" />
      <circle cx={cx} cy={cy} r={11 * s} fill="#fde047" />
    </g>
  );
}

export function LightMacroView({ trial, snapshot, values }: ViewProps<LightNeededSample>) {
  const p = toParams(values);
  const ran = trial !== undefined;
  const s = snapshot ?? startSample(values);
  const r = lightResult(values);
  // 실행하기 전에는 구멍으로 본 장면을 그리지 않는다(빈 둥근 창). 빛의 길 화살표는 언제나 그리지 않는다.
  const seen = ran ? clamp01(s.seen) : 0;
  const state = !ran ? 'empty' : r.visible === 'visible' ? 'object' : 'dark';
  const note = ran ? lightNote(s, r) : '실험하면 구멍으로 본 장면이 둥근 창에 나타나요.';
  const inner = { x: BOX.x + BOX.wall, y: BOX.y + BOX.wall, w: BOX.w - 2 * BOX.wall, h: BOX.h - 2 * BOX.wall };
  const on = p.flashlight === 'on';

  return (
    <figure className="view light-macro" aria-label="눈으로 보기">
      <figcaption>눈으로 보기</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`위에서 본 깜깜한 상자 단면. 상자 안 물체는 ${OBJECT_TEXT[p.object]}, ${FLASHLIGHT_TEXT[p.flashlight]}. ${BOX_TEXT[p.boxColor]}. 구멍으로 들여다봐요. ${note}`}>
        <text x="12" y="18" fontSize="14" fontWeight="700" fill="currentColor" data-testid="object-label">{OBJECT_TEXT[p.object]} · {FLASHLIGHT_TEXT[p.flashlight]}</text>
        <text x="12" y="38" fontSize="14" fill="currentColor" data-testid="box-label">{BOX_TEXT[p.boxColor]} · 안쪽은 검은색</text>
        <g data-testid="light-art" data-flashlight={p.flashlight} data-object={p.object} data-box={p.boxColor} data-seen={seen.toFixed(2)}>
          {/* 상자: 바깥 벽(겉 색깔)과 검은 안쪽, 왼쪽 벽의 구멍 */}
          <rect data-testid="box-wall" data-fill={BOX_FILL[p.boxColor]} x={BOX.x} y={BOX.y} width={BOX.w} height={BOX.h} fill={BOX_FILL[p.boxColor]} stroke="currentColor" strokeWidth="2" />
          <rect x={inner.x} y={inner.y} width={inner.w} height={inner.h} fill={INSIDE} stroke="currentColor" strokeWidth="1" />
          <rect data-testid="peek-hole" x={BOX.x - 1} y={HOLE_Y - 6} width={BOX.wall + 2} height="12" fill={INSIDE} />
          {/* 눈 */}
          <g data-testid="eye" stroke="currentColor" strokeWidth="1.5">
            <ellipse cx="22" cy={HOLE_Y} rx="13" ry="8" fill="#ffffff" />
            <circle cx="26" cy={HOLE_Y} r="4" fill="#1f2937" />
          </g>
          {/* 상자 안: 손전등과 물체 */}
          <g data-testid="flashlight" data-on={on ? 'true' : 'false'} stroke="#374151" strokeWidth="1.5">
            <rect x="60" y="68" width="22" height="10" fill="#64748b" />
            <polygon points="82,66 92,64 92,82 82,80" fill={on ? '#fde047' : '#cbd5e1'} />
          </g>
          <ObjectArt object={p.object} cx={150} cy={HOLE_Y - 4} s={1} testid="box-object" />
          {/* 구멍으로 본 장면(둥근 창) */}
          <clipPath id="peek-clip"><circle cx={WINDOW.cx} cy={WINDOW.cy} r={WINDOW.r - 1} /></clipPath>
          <circle
            data-testid="peek-window"
            data-state={state}
            cx={WINDOW.cx}
            cy={WINDOW.cy}
            r={WINDOW.r}
            fill={ran ? INSIDE : 'none'}
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray={ran ? undefined : '5 4'}
          />
          {ran && r.visible === 'visible' && (
            <g clipPath="url(#peek-clip)" opacity={seen.toFixed(2)}>
              <ObjectArt object={p.object} cx={WINDOW.cx} cy={WINDOW.cy - 4} s={1.1} testid="peek-object" />
            </g>
          )}
        </g>
        <text x="12" y="192" fontSize="14" fill="currentColor">구멍으로</text>
        <text x="12" y="212" fontSize="14" fill="currentColor" data-testid="peek-caption">본 모습</text>
        {ran && <text x="12" y="232" fontSize="14" fontWeight="700" fill="currentColor" data-testid="peek-text">{visibleText(r)}</text>}
      </svg>
      <p className="view-note" data-testid="light-note">{note}</p>
    </figure>
  );
}
