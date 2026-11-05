import { breezeOf, type BreezeSample } from '@sci/engine-earth';
import type { ViewProps } from '../types';
import { IDLE_SAMPLE, breezeNote, clamp01, toParams } from './initial';

// viewBox 폭 240은 1280 px 화면에서 이 칸의 실제 폭(약 230 px)과 거의 같다. 글자 14는 화면에서도 약 13 px 이상이다.
export const W = 240;
export const H = 214;
/** 모래·물 그릇 윗면과 바닥, 가운데 칸막이 x */
const SURF = 150;
const FLOOR = 196;
const DIV_X = 120;
/** 온도계 막대: 15~40 °C를 이 높이에 그린다(그래프 y축과 같다). */
const BAR_Y = 52;
const BAR_H = 94;
const T_MIN = 15;
const T_MAX = 40;
/** 향 연기가 바람이 가장 셀 때(|wind| = 1) 옆으로 기우는 정도(그림 단위) */
export const SMOKE_LEAN = 40;
const SMOKE_BASE_Y = 120;
const SMOKE_TOP_Y = 94;

/** 낮에는 밝은 상자, 밤에는 어두운 상자. 상자 안의 글자와 선은 상자 색에 맞춰 따로 정한다(화면 테마와 무관). */
const PALETTE = {
  day: { bg: '#fffbeb', ink: '#1f2937', smoke: '#6b7280' },
  night: { bg: '#0f1b3d', ink: '#f1f5f9', smoke: '#cbd5e1' },
};

/** 전등 아래쪽 y: 20 cm는 80, 40 cm는 28(멀수록 높이 걸린다) */
export const lampBottomY = (lampCm: number) => Math.min(96, Math.max(26, 80 - 2.6 * (lampCm - 20)));
/** 향 연기가 옆으로 기우는 정도: 바다 → 육지(wind > 0)이면 왼쪽(육지 쪽)으로 기운다. */
export const smokeLean = (wind: number) => -SMOKE_LEAN * wind || 0;
const barHeight = (c: number) => BAR_H * clamp01((c - T_MIN) / (T_MAX - T_MIN));

export function BreezeMacroView({ trial, snapshot, values, experiment }: ViewProps<BreezeSample>) {
  void experiment;
  const p = toParams(values);
  const ran = trial !== undefined;
  // 실행 전에는 어느 쪽이 따뜻한지 드러나지 않도록 두 쪽 모두 주변 온도·바람 없음으로 그린다.
  const s: BreezeSample = ran ? (snapshot ?? IDLE_SAMPLE) : IDLE_SAMPLE;
  const night = p.phase === 'night';
  const pal = night ? PALETTE.night : PALETTE.day;
  const lampOn = !night;
  const lb = lampBottomY(p.lampCm);
  const lean = smokeLean(s.wind);
  const leanKind = !ran ? 'none' : breezeOf(s.diff) === 'sea-to-land' ? 'left' : breezeOf(s.diff) === 'land-to-sea' ? 'right' : 'none';
  const note = ran ? breezeNote(s) : '실험하면 모래와 물의 온도, 향 연기가 흐르는 방향을 볼 수 있어요.';
  const tempText = (c: number) => (ran ? `${c.toFixed(1)} °C` : '? °C');
  const smokeEnd = 120 + lean;
  const smoke = `M120 ${SMOKE_BASE_Y} C120 108 ${(120 + lean * 0.6).toFixed(1)} 100 ${smokeEnd.toFixed(1)} ${SMOKE_TOP_Y}`;
  const midY = (lb + 6 + SURF) / 2;

  return (
    <figure className="view breeze-macro" aria-label="눈으로 보기">
      <figcaption>눈으로 보기</figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`투명 상자 안에 왼쪽 모래(육지)와 오른쪽 물(바다)을 나란히 두고 위에서 ${p.lampCm} cm 떨어진 전등을 ${lampOn ? '켠' : '끈'} ${night ? '밤' : '낮'} 그림. 가운데 향 연기가 흐르는 방향을 볼 수 있어요. ${note}`}
      >
        {/* 투명 상자 */}
        <rect data-testid="box" data-phase={p.phase} x="8" y="8" width="224" height="196" rx="8" fill={pal.bg} stroke={pal.ink} strokeWidth="2" />
        {night && (
          <g data-testid="stars" fill="#f8fafc">
            <circle cx="150" cy="22" r="1.6" />
            <circle cx="186" cy="30" r="1.2" />
            <circle cx="206" cy="18" r="1.6" />
            <circle cx="96" cy="16" r="1.2" />
          </g>
        )}
        <text x="14" y="23" fontSize="16" fontWeight="700" fill={pal.ink}>{night ? '밤' : '낮'}</text>

        {/* 전등: 낮에는 켜져 빛이 퍼지고, 밤에는 꺼진다 */}
        {lampOn && <polygon data-testid="light-cone" points={`108,${lb + 8} 132,${lb + 8} 200,${SURF - 2} 40,${SURF - 2}`} fill="#fde047" fillOpacity="0.28" />}
        {lb - 18 > 14 && <line x1="120" y1="8" x2="120" y2={lb - 18} stroke={pal.ink} strokeWidth="1.5" />}
        <path d={`M94 ${lb} L146 ${lb} L132 ${lb - 18} L108 ${lb - 18} Z`} fill={lampOn ? '#d1d5db' : '#64748b'} stroke={pal.ink} strokeWidth="2" strokeLinejoin="round" />
        <ellipse data-testid="bulb" data-on={lampOn ? 'true' : 'false'} cx="120" cy={lb + 3} rx="7" ry="6" fill={lampOn ? '#facc15' : '#94a3b8'} stroke={pal.ink} strokeWidth="1.5" />
        {/* 전등과의 거리 */}
        <g data-testid="lamp-distance" data-cm={p.lampCm} stroke={pal.ink} strokeWidth="1.5" fill="none">
          <line x1="160" y1={lb + 6} x2="160" y2={SURF - 2} />
          <line x1="154" y1={lb + 6} x2="166" y2={lb + 6} />
          <line x1="154" y1={SURF - 2} x2="166" y2={SURF - 2} />
        </g>
        <rect x="165" y={midY - 13} width="44" height="19" rx="3" fill={pal.bg} fillOpacity="0.92" />
        <text x="168" y={midY + 2} fontSize="14" fontWeight="700" fill={pal.ink}>{p.lampCm} cm</text>

        {/* 모래(육지)와 물(바다) */}
        <rect data-testid="sand" x="14" y={SURF} width="104" height={FLOOR - SURF} fill="#d9a45b" stroke="#8a5a2b" strokeWidth="2" />
        <g fill="#8a5a2b" opacity="0.55">
          {[[28, 158], [46, 166], [62, 156], [82, 164], [100, 158], [38, 184], [74, 188], [96, 180]].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="1.5" />
          ))}
        </g>
        <rect data-testid="water" x="122" y={SURF} width="104" height={FLOOR - SURF} fill="#7cc4ee" stroke="#2f6fa6" strokeWidth="2" />
        <path d={`M124 ${SURF + 5} q8 -4 16 0 t16 0 t16 0 t16 0 t16 0 t16 0`} fill="none" stroke="#2f6fa6" strokeWidth="1.5" opacity="0.7" />
        <text x="66" y="182" textAnchor="middle" fontSize="14" fontWeight="700" fill="#3f2a14">모래 (육지)</text>
        <text x="174" y="182" textAnchor="middle" fontSize="14" fontWeight="700" fill="#06304f">물 (바다)</text>
        {/* 가운데 칸막이 */}
        <line x1={DIV_X} y1={SURF - 8} x2={DIV_X} y2={FLOOR} stroke={pal.ink} strokeWidth="3" />

        {/* 향과 연기: 연기는 바람이 불어 가는 쪽으로 기울고, 기우는 정도는 |wind|에 비례한다 */}
        <line x1="120" y1={SURF - 8} x2="120" y2={SMOKE_BASE_Y + 6} stroke="#92400e" strokeWidth="3" strokeLinecap="round" />
        <circle cx="120" cy={SMOKE_BASE_Y + 3} r="3" fill="#ef4444" />
        <g data-testid="smoke" data-lean={leanKind} data-wind={s.wind.toFixed(2)} data-dx={lean.toFixed(1)} fill="none" stroke={pal.smoke} strokeLinecap="round">
          <path d={smoke} strokeWidth="8" opacity="0.28" />
          <path d={smoke} strokeWidth="3" opacity="0.9" />
        </g>

        {/* 온도계 막대와 숫자 */}
        <g data-testid="thermo-sand">
          <rect x="14" y={BAR_Y} width="10" height={BAR_H} rx="5" fill="none" stroke={pal.ink} strokeWidth="1.5" />
          <rect data-testid="sand-bar" data-h={barHeight(s.sand).toFixed(1)} x="16" y={BAR_Y + BAR_H - barHeight(s.sand)} width="6" height={barHeight(s.sand)} fill="#b45309" />
          <text data-testid="sand-temp" x="14" y="44" fontSize="14" fontWeight="700" fill={pal.ink}>{tempText(s.sand)}</text>
        </g>
        <g data-testid="thermo-water">
          <rect x="216" y={BAR_Y} width="10" height={BAR_H} rx="5" fill="none" stroke={pal.ink} strokeWidth="1.5" />
          <rect data-testid="water-bar" data-h={barHeight(s.water).toFixed(1)} x="218" y={BAR_Y + BAR_H - barHeight(s.water)} width="6" height={barHeight(s.water)} fill="#2563eb" />
          <text data-testid="water-temp" x="226" y="44" textAnchor="end" fontSize="14" fontWeight="700" fill={pal.ink}>{tempText(s.water)}</text>
        </g>
      </svg>
      <p className="view-note" data-testid="breeze-note">{note}</p>
    </figure>
  );
}
