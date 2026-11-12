import type { BlShape, BlTime, ButterflyLifeSample } from '@sci/engine-life';
import type { ViewProps } from '../types';
import { SHAPE_TEXT, TIME_TEXT, lifeNote, lifeResult, lifeShape, toParams } from './initial';

// viewBox 폭 240은 1280 px 화면에서 이 칸의 실제 폭(약 230 px)과 거의 같다. 글자 14는 화면에서도 약 13 px 이상이다.
export const W = 240;
export const H = 196;
/** 사육 상자 */
export const CAGE = { x: 14, y: 46, w: 212, h: 142 };
/** 몸 옆 자: 0 mm의 x와 1 mm의 폭(그림 단위), 자의 몸통 */
export const RULER = { x0: 24, perMm: 5.3, y: 156, h: 28, left: 18, right: 222 };
/** 몸을 그리는 가운데 높이 */
export const BODY_Y = 100;
/** 사육 상자 바탕: 아침과 저녁의 빛깔만 다르다(대조 변인). */
export const CAGE_FILL: Record<BlTime, string> = { morning: '#fef9c3', evening: '#c7d2fe' };
export const LEAF_FILL = '#bef264';
const GREEN = '#16a34a';
const OUTLINE = '#14532d';

/** mm → 그림 x */
export const mmX = (mm: number) => RULER.x0 + RULER.perMm * mm;
/** 껍데기의 빛깔: 날이 갈수록 옅어진다. */
export const SHELL_FILL: Record<number, string> = { 18: '#6b8e23', 21: '#b7c98f', 24: '#dfe6c8' };

function Creature({ shape, day, length }: { shape: BlShape; day: number; length: number }) {
  const w = length * RULER.perMm;
  if (shape === 'egg') {
    return <ellipse data-testid="creature" data-shape={shape} cx={mmX(0) + w / 2} cy={BODY_Y} rx={w / 2} ry={w / 3.2} fill="#facc15" stroke="#854d0e" strokeWidth="1.5" />;
  }
  if (shape === 'small' || shape === 'larva' || shape === 'big') {
    const h = shape === 'small' ? 6 : shape === 'larva' ? (length >= 20 ? 12 : 9) : 15;
    const segs = Math.floor(w / 14);
    return (
      <g data-testid="creature" data-shape={shape}>
        <rect x={mmX(0)} y={BODY_Y - h / 2} width={w} height={h} rx={h / 2} fill={GREEN} stroke={OUTLINE} strokeWidth="1.5" />
        {Array.from({ length: segs }, (_, i) => (
          <line key={i} x1={mmX(0) + 12 + i * 14} y1={BODY_Y - h / 2 + 1.5} x2={mmX(0) + 12 + i * 14} y2={BODY_Y + h / 2 - 1.5} stroke={OUTLINE} strokeWidth="1" opacity="0.6" />
        ))}
        <circle cx={mmX(0) + w - h / 2} cy={BODY_Y - h * 0.1} r={Math.max(1.2, h / 8)} fill="#111827" />
      </g>
    );
  }
  if (shape === 'shell') {
    const h = 18;
    const x = mmX(0);
    return (
      <g data-testid="creature" data-shape={shape} data-fill={SHELL_FILL[day]}>
        <line x1={CAGE.x + 8} y1={CAGE.y + 12} x2={CAGE.x + CAGE.w - 8} y2={CAGE.y + 12} stroke="#78350f" strokeWidth="4" strokeLinecap="round" />
        <line x1={x + w * 0.35} y1={CAGE.y + 12} x2={x + w * 0.35} y2={BODY_Y - h / 2 + 2} stroke="#475569" strokeWidth="1.5" />
        <line x1={x + w * 0.65} y1={CAGE.y + 12} x2={x + w * 0.65} y2={BODY_Y - h / 2 + 2} stroke="#475569" strokeWidth="1.5" />
        <rect x={x} y={BODY_Y - h / 2} width={w} height={h} rx={h / 2} fill={SHELL_FILL[day] ?? '#b7c98f'} stroke="#3f4d1f" strokeWidth="2" />
        <line x1={x + 6} y1={BODY_Y} x2={x + w - 6} y2={BODY_Y} stroke="#3f4d1f" strokeWidth="1" opacity="0.5" />
      </g>
    );
  }
  // 날개를 편 나비(위에서 본 모습): 몸 길이는 머리 끝에서 배 끝까지
  const x = mmX(0);
  const wing = (dy: number, big: boolean) => (
    <g stroke="#475569" strokeWidth="1.5" fill="#ffffff">
      <ellipse cx={x + w * (big ? 0.42 : 0.3)} cy={BODY_Y + dy * (big ? 24 : 15)} rx={big ? 40 : 26} ry={big ? 22 : 15} transform={`rotate(${dy * (big ? -22 : 18)} ${x + w * 0.4} ${BODY_Y})`} />
      {big && <circle cx={x + w * 0.5} cy={BODY_Y + dy * 30} r="3" fill="#111827" stroke="none" />}
    </g>
  );
  return (
    <g data-testid="creature" data-shape={shape}>
      {wing(-1, true)}
      {wing(1, true)}
      {wing(-1, false)}
      {wing(1, false)}
      <rect x={x} y={BODY_Y - 3.5} width={w} height={7} rx={3.5} fill="#1f2937" stroke="#111827" strokeWidth="1" />
      <line x1={x + w} y1={BODY_Y - 2} x2={x + w + 9} y2={BODY_Y - 10} stroke="#1f2937" strokeWidth="1.5" />
      <line x1={x + w} y1={BODY_Y + 2} x2={x + w + 9} y2={BODY_Y + 10} stroke="#1f2937" strokeWidth="1.5" />
    </g>
  );
}

export function ButterflyMacroView({ trial, values }: ViewProps<ButterflyLifeSample>) {
  const p = toParams(values);
  const ran = trial !== undefined;
  const r = lifeResult(values);
  const shape = lifeShape(values);
  // 실행하기 전에는 몸(알·벌레·껍데기·나비)을 그리지 않는다. 빈 사육 상자와 잎, 자만 있다.
  const note = ran ? lifeNote(p.day, r) : '실험하면 사육 상자 속 모습이 나타나요.';
  const ticks = Array.from({ length: 7 }, (_, i) => i * 5);

  return (
    <figure className="view life-macro" aria-label="눈으로 보기">
      <figcaption>눈으로 보기</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`교실 사육 상자 속 모습. 관찰한 날은 ${p.day}일째, 관찰한 때는 ${TIME_TEXT[p.time]}. ${ran ? SHAPE_TEXT[shape] : '아직 아무것도 그려지지 않았어요.'}. 아래에 몸 길이를 재는 자(mm)가 있어요.`}>
        <text x="12" y="18" fontSize="14" fontWeight="700" fill="currentColor" data-testid="day-label">{p.day}일째 · {TIME_TEXT[p.time]}</text>
        <text x="12" y="38" fontSize="14" fill="currentColor" data-testid="cage-label">교실 사육 상자 속 모습</text>
        <g data-testid="life-art" data-day={p.day} data-time={p.time} data-ran={ran ? 'true' : 'false'}>
          <rect data-testid="cage" data-fill={CAGE_FILL[p.time]} x={CAGE.x} y={CAGE.y} width={CAGE.w} height={CAGE.h} rx="6" fill={CAGE_FILL[p.time]} stroke="currentColor" strokeWidth="2" />
          {/* 배추잎 */}
          <g data-testid="leaf" stroke="#4d7c0f" strokeWidth="1.5">
            <ellipse cx="120" cy="104" rx="98" ry="30" fill={LEAF_FILL} />
            <line x1="26" y1="104" x2="214" y2="104" />
          </g>
          {ran && <Creature shape={shape} day={p.day} length={r.length} />}
          {/* 몸 옆의 자(mm): 바탕이 있는 도구라 글자색을 고정한다. */}
          <g data-testid="ruler">
            <rect x={RULER.left} y={RULER.y} width={RULER.right - RULER.left} height={RULER.h} fill="#fef3c7" stroke="#92400e" strokeWidth="1.5" />
            {ticks.map((mm) => (
              <line key={mm} x1={mmX(mm)} y1={RULER.y} x2={mmX(mm)} y2={RULER.y + (mm % 10 === 0 ? 10 : 6)} stroke="#1f2937" strokeWidth="1.5" />
            ))}
            {[0, 10, 20, 30].map((mm) => (
              <text key={mm} x={mmX(mm)} y={RULER.y + 24} textAnchor="middle" fontSize="14" fill="#1f2937">{mm}</text>
            ))}
            <text x={RULER.right - 6} y={RULER.y + 24} textAnchor="end" fontSize="14" fill="#1f2937">mm</text>
          </g>
        </g>
      </svg>
      <p className="view-note" data-testid="life-note">{note}</p>
    </figure>
  );
}
