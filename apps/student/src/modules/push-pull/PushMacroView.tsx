import type { PushAction, PushColor, PushObject, PushPullSample } from '@sci/engine-physics';
import { PUSH_CONTACT_S } from '@sci/engine-physics';
import type { ViewProps } from '../types';
import { ACTION_TEXT, COLOR_TEXT, OBJECT_TEXT, STRENGTH_TEXT, clamp01, pushNote, startSample, toParams } from './initial';

// viewBox 폭 240은 1280 px 화면에서 이 칸의 실제 폭(약 230 px)과 거의 같다. 글자 14는 화면에서도 약 13 px 이상이다.
export const W = 240;
export const H = 168;
/** 물체가 놓인 책상 윗면 */
export const TABLE_Y = 112;
/** 출발점(물체 가운데 x)과 1 cm당 그림 단위 */
export const START_X = 40;
export const CM = 1.7;
/** 자의 눈금 */
export const RULER_Y = 128;
export const RULER_LABELS = [0, 20, 40, 60, 80] as const;
/** 물체 반폭 */
export const HALF_W: Record<PushObject, number> = { cart: 20, ball: 12, clay: 13 };
export const FILL: Record<PushColor, string> = { red: '#ef4444', blue: '#3b82f6' };
const SKIN = '#f2b48c';
/** 줄을 당기는 손의 처음 가운데 x와 당기는 동안 더 가는 거리(그림 단위) */
export const PULL_HAND_X = 212;
const PULL_HAND_MOVE = 6;

/** 출발점에서 d cm 떨어진 물체의 가운데 x */
export const objectX = (distanceCm: number) => START_X + CM * distanceCm;
/** 찰흙의 가로·세로 배율: 밀면 납작해지고(가로로 넓고 낮게), 당기면 길게 늘어난다. 다른 물체는 1이다. */
export const clayScale = (object: PushObject, action: PushAction, deform: number): { sx: number; sy: number } => {
  if (object !== 'clay') return { sx: 1, sy: 1 };
  return action === 'push' ? { sx: 1 + 0.35 * deform, sy: 1 - 0.3 * deform } : { sx: 1 + 0.6 * deform, sy: 1 - 0.2 * deform };
};
/** 손이 물체에 닿기까지의 진행(0~1). 손의 움직임은 어떤 조건에서도 같다. */
export const reach = (t: number) => clamp01(t / PUSH_CONTACT_S);

function Obj({ object, color, deform, action }: { object: PushObject; color: PushColor; deform: number; action: PushAction }) {
  const fill = FILL[color];
  if (object === 'cart') {
    return (
      <g data-testid="obj-art" data-object="cart">
        <rect x="-20" y="-20" width="40" height="12" rx="2" fill={fill} stroke="currentColor" strokeWidth="2" />
        <circle cx="-12" cy="-5" r="5" fill="#475569" stroke="currentColor" strokeWidth="2" />
        <circle cx="12" cy="-5" r="5" fill="#475569" stroke="currentColor" strokeWidth="2" />
      </g>
    );
  }
  if (object === 'ball') {
    return (
      <g data-testid="obj-art" data-object="ball">
        <circle cx="0" cy="-12" r="12" fill={fill} stroke="currentColor" strokeWidth="2" />
        <path d="M-12 -12 Q0 -4 12 -12" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </g>
    );
  }
  const { sx, sy } = clayScale('clay', action, deform);
  return (
    <g data-testid="obj-art" data-object="clay" data-deform={deform.toFixed(2)} transform={`scale(${sx.toFixed(3)} ${sy.toFixed(3)})`}>
      <rect x="-13" y="-24" width="26" height="24" rx="9" fill={fill} stroke="currentColor" strokeWidth="2" />
    </g>
  );
}

function Hand({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g data-testid="hand" data-x={cx.toFixed(1)}>
      <rect x={cx - 8} y={cy - 9} width="18" height="18" rx="6" fill={SKIN} stroke="currentColor" strokeWidth="2" />
    </g>
  );
}

export function PushMacroView({ trial, snapshot, values }: ViewProps<PushPullSample>) {
  const p = toParams(values);
  const ran = trial !== undefined;
  const s = snapshot ?? startSample(values);
  const note = ran ? pushNote(s) : '실험하면 물체가 어디까지 움직이는지 볼 수 있어요.';
  const half = HALF_W[p.object];
  const cx = objectX(s.distanceCm);
  const c = reach(s.t);
  const handY = TABLE_Y - 14;
  // 밀기: 손이 물체 왼쪽에서 다가가 닿는다. 당기기: 물체에 맨 줄을 쥔 손이 오른쪽에서 잡아당긴다.
  const sc = clayScale(p.object, p.action, s.deform);
  const pushHandX = START_X - half * sc.sx - 10 - (1 - c) * 20;
  const pullHandX = PULL_HAND_X + PULL_HAND_MOVE * c;
  const objRight = cx + half * sc.sx;

  return (
    <figure className="view push-macro" aria-label="눈으로 보기">
      <figcaption>눈으로 보기</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`책상 위 ${OBJECT_TEXT[p.object]}을(를) ${ACTION_TEXT[p.action]}, 힘의 세기 ${STRENGTH_TEXT[p.strength]}, 물체 색깔 ${COLOR_TEXT[p.color]}. ${note}`}>
        <text x="12" y="18" fontSize="14" fontWeight="700" fill="currentColor" data-testid="push-label">{OBJECT_TEXT[p.object]} · {ACTION_TEXT[p.action]}</text>
        <text x="12" y="38" fontSize="14" fill="currentColor" data-testid="push-sub">힘 {STRENGTH_TEXT[p.strength]} · 색 {COLOR_TEXT[p.color]}</text>
        <line x1="4" y1={TABLE_Y} x2={W - 4} y2={TABLE_Y} stroke="#64748b" strokeWidth="2" />
        <g data-testid="push-art" data-object={p.object} data-action={p.action} data-color={p.color} data-x={cx.toFixed(1)} data-dist={s.distanceCm.toFixed(2)}>
          {p.action === 'pull' && (
            <g data-testid="string">
              <path d={`M${objRight.toFixed(1)} ${handY} Q${((objRight + pullHandX - 8) / 2).toFixed(1)} ${handY + 8} ${(pullHandX - 8).toFixed(1)} ${handY}`} fill="none" stroke="currentColor" strokeWidth="2" />
            </g>
          )}
          <g transform={`translate(${cx.toFixed(1)} ${TABLE_Y})`}>
            <Obj object={p.object} color={p.color} deform={s.deform} action={p.action} />
          </g>
          {p.action === 'push' ? <Hand cx={pushHandX} cy={handY} /> : <Hand cx={pullHandX} cy={handY} />}
        </g>
        {/* 바닥의 자: 출발점이 0 */}
        <g data-testid="floor-ruler">
          <line x1={START_X} y1={RULER_Y} x2={START_X + CM * 90} y2={RULER_Y} stroke="currentColor" strokeWidth="2" />
          {Array.from({ length: 10 }, (_, i) => (
            <line key={i} x1={START_X + CM * i * 10} y1={RULER_Y} x2={START_X + CM * i * 10} y2={RULER_Y + (i % 2 === 0 ? 10 : 6)} stroke="currentColor" strokeWidth="1.5" />
          ))}
          {RULER_LABELS.map((v) => (
            <text key={v} x={START_X + CM * v} y={RULER_Y + 28} textAnchor="middle" fontSize="14" fill="currentColor">{v}</text>
          ))}
          <text x={START_X + CM * 90 + 4} y={RULER_Y + 28} fontSize="14" fill="currentColor">cm</text>
        </g>
      </svg>
      <p className="view-note" data-testid="push-note">{note}</p>
    </figure>
  );
}
