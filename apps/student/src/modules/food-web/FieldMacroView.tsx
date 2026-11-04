import type { FoodWebSample } from '@sci/engine-life';
import type { ViewProps } from '../types';
import { CLOUDS, FUR_TEXT, RAIN_LINES, RAIN_TEXT, foodWebNote, furOf, rainOf, shownCounts, startSample } from './initial';

// viewBox 폭 240은 1280 px 화면에서 이 칸의 실제 폭(약 230 px)과 거의 같다. 글자 14는 화면에서도 약 13 px 이상이다.
const W = 240;
const H = 296;
const INK = '#1f2937';
export const MAX_RABBITS_DRAWN = 30;
export const MAX_FOXES_DRAWN = 10;
export const MAX_TUFTS = 24;
const SKY_H = 70;
const GROUND_Y = 78;
const GROUND_H = 190;

/** 풀 무더기 수: 풀의 양(%)에 비례 */
export const tuftCount = (grassPct: number) => Math.round((Math.min(100, Math.max(0, grassPct)) / 100) * MAX_TUFTS);

/** 풀 색: 적을수록 옅은 연두, 많을수록 진한 초록 */
export function grassColor(grassPct: number): string {
  const k = Math.min(1, Math.max(0, grassPct / 100));
  const from = [217, 249, 157];
  const to = [21, 128, 61];
  return `rgb(${from.map((f, i) => Math.round(f + (to[i]! - f) * k)).join(',')})`;
}

/** 그릴 동물 수와 넘는 수 */
export const drawn = (n: number, max: number) => ({ shown: Math.min(n, max), extra: Math.max(0, n - max) });

/** 격자 자리: perRow개씩 한 줄 */
const grid = (n: number, perRow: number, x0: number, dx: number, y0: number, dy: number) =>
  Array.from({ length: n }, (_, i) => ({ x: x0 + (i % perRow) * dx, y: y0 + Math.floor(i / perRow) * dy }));

function Rabbit({ x, y, fur }: { x: number; y: number; fur: 'white' | 'brown' }) {
  const fill = fur === 'white' ? '#ffffff' : '#92400e';
  const stroke = fur === 'white' ? '#6b7280' : '#451a03';
  return (
    <g data-testid="rabbit" data-fur={fur}>
      <ellipse cx={x - 2} cy={y} rx="7" ry="5" fill={fill} stroke={stroke} strokeWidth="1.2" />
      <circle cx={x + 6} cy={y - 3} r="3.8" fill={fill} stroke={stroke} strokeWidth="1.2" />
      <ellipse cx={x + 5} cy={y - 10} rx="1.6" ry="4.4" fill={fill} stroke={stroke} strokeWidth="1" />
      <ellipse cx={x + 8.5} cy={y - 10} rx="1.6" ry="4.4" fill={fill} stroke={stroke} strokeWidth="1" />
    </g>
  );
}

function Fox({ x, y }: { x: number; y: number }) {
  return (
    <g data-testid="fox">
      <ellipse cx={x - 12} cy={y + 1} rx="6" ry="3.5" fill="#ea580c" stroke="#7c2d12" strokeWidth="1.2" />
      <ellipse cx={x - 17} cy={y + 1} rx="2.4" ry="2.2" fill="#ffffff" stroke="#7c2d12" strokeWidth="0.8" />
      <ellipse cx={x - 2} cy={y} rx="9" ry="5.5" fill="#ea580c" stroke="#7c2d12" strokeWidth="1.2" />
      <circle cx={x + 9} cy={y - 3} r="4.6" fill="#ea580c" stroke="#7c2d12" strokeWidth="1.2" />
      <polygon points={`${x + 6},${y - 6} ${x + 7},${y - 12} ${x + 10},${y - 7}`} fill="#ea580c" stroke="#7c2d12" strokeWidth="1" />
      <polygon points={`${x + 10},${y - 7} ${x + 13},${y - 12} ${x + 13},${y - 5}`} fill="#ea580c" stroke="#7c2d12" strokeWidth="1" />
    </g>
  );
}

function Cloud({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g data-testid="cloud" fill="#cbd5e1" stroke="#64748b" strokeWidth="1.2">
      <circle cx={cx - 10} cy={cy} r="9" />
      <circle cx={cx + 2} cy={cy - 5} r="11" />
      <circle cx={cx + 13} cy={cy} r="8" />
    </g>
  );
}

export function FieldMacroView({ experiment, snapshot, values }: ViewProps<FoodWebSample>) {
  const s = snapshot ?? startSample(values, experiment);
  const rain = rainOf(values);
  const fur = furOf(values);
  const c = shownCounts(s);
  const note = foodWebNote(s);
  const clouds = CLOUDS[rain];
  const lines = RAIN_LINES[rain];
  const tufts = tuftCount(s.grassPct);
  const color = grassColor(s.grassPct);
  const rabbits = drawn(c.rabbits, MAX_RABBITS_DRAWN);
  const foxes = drawn(c.foxes, MAX_FOXES_DRAWN);
  const cloudXs = [100, 148, 196].slice(0, clouds);
  const lineXs = Array.from({ length: lines }, (_, i) => 84 + (lines === 1 ? 0 : (i * 132) / (lines - 1)));
  // 풀 무더기는 아래쪽 두 줄(12개씩), 토끼는 위쪽 세 줄(10마리씩), 여우는 그 아래 두 줄(5마리씩)
  const tuftSpots = grid(MAX_TUFTS, 12, 18, 18.5, 250, 12).slice(0, tufts);
  const rabbitSpots = grid(rabbits.shown, 10, 22, 21, 112, 22);
  const foxSpots = grid(foxes.shown, 5, 48, 38, 186, 24);

  return (
    <figure className="view field-macro" aria-label="눈으로 보기">
      <figcaption>눈으로 보기</figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`풀밭 풍경: 비 ${RAIN_TEXT[rain]}, 토끼 털 ${FUR_TEXT[fur]}, ${note}`}
      >
        {/* 하늘: 구름과 빗줄기 */}
        <rect x="0" y="0" width={W} height={SKY_H} rx="8" fill="#dbeafe" />
        <text x="8" y="22" fontSize="14" fill={INK}>비 {RAIN_TEXT[rain]}</text>
        <g data-testid="clouds" data-count={clouds}>
          {cloudXs.map((x) => (
            <Cloud key={x} cx={x} cy={26} />
          ))}
        </g>
        <g data-testid="rain-lines" data-count={lines} stroke="#2563eb" strokeWidth="2" strokeLinecap="round">
          {lineXs.map((x) => (
            <line key={x} data-testid="rain-line" x1={x} y1="46" x2={x - 3} y2="60" />
          ))}
        </g>

        {/* 풀밭 */}
        <rect x="0" y={GROUND_Y} width={W} height={GROUND_H} rx="8" fill="#f3efe0" />
        <g data-testid="tufts" data-count={tufts} data-color={color}>
          {tuftSpots.map((p, i) => (
            <path key={i} data-testid="tuft" d={`M${p.x - 6} ${p.y} q2 -12 4 -2 q1 -10 3 -1 q2 -11 4 1 q2 -8 3 2z`} fill={color} stroke="#14532d" strokeWidth="0.8" />
          ))}
        </g>
        <g data-testid="rabbits" data-count={rabbits.shown}>
          {rabbitSpots.map((p, i) => (
            <Rabbit key={i} x={p.x} y={p.y} fur={fur} />
          ))}
        </g>
        {rabbits.extra > 0 && (
          <text data-testid="rabbits-extra" x={W - 8} y="170" textAnchor="end" fontSize="14" fontWeight="700" fill={INK}>토끼 +{rabbits.extra}</text>
        )}
        <g data-testid="foxes" data-count={foxes.shown}>
          {foxSpots.map((p, i) => (
            <Fox key={i} x={p.x} y={p.y} />
          ))}
        </g>
        {foxes.extra > 0 && (
          <text data-testid="foxes-extra" x={W - 8} y="236" textAnchor="end" fontSize="14" fontWeight="700" fill={INK}>여우 +{foxes.extra}</text>
        )}
        {c.foxes === 0 && (
          <text data-testid="no-fox" x={W / 2} y="200" textAnchor="middle" fontSize="14" fill={INK}>여우가 없어요</text>
        )}
        <text x={W / 2} y="288" textAnchor="middle" fontSize="14" fill="currentColor">토끼 털 색: {FUR_TEXT[fur]}</text>
      </svg>
      <p className="view-note">{note}</p>
    </figure>
  );
}
