import type { CombustionSample } from '@sci/engine-matter';
import type { ViewProps } from '../types';

const BASE_Y = 240; // 받침 윗면
const CX = 100;
const CANDLE_H = 50;
const CANDLE_W = { thin: 10, thick: 18 } as const;

/** 집기병 크기 세 단계: 폭, 높이 */
const JARS = [
  { max: 250, w: 96, h: 112 },
  { max: 500, w: 124, h: 148 },
  { max: Infinity, w: 164, h: 196 },
] as const;

/** 안쪽 벽의 물방울 자리(집기병 안쪽 비율 좌표). fog에 비례해 앞에서부터 나타난다. */
const DROPS: [number, number][] = [
  [0.06, 0.2], [0.94, 0.28], [0.08, 0.42], [0.92, 0.5], [0.05, 0.62], [0.95, 0.7], [0.09, 0.8], [0.9, 0.86],
  [0.2, 0.08], [0.5, 0.05], [0.8, 0.09], [0.12, 0.3], [0.88, 0.38], [0.1, 0.55], [0.9, 0.62], [0.07, 0.9],
  [0.93, 0.92], [0.3, 0.06], [0.7, 0.06], [0.15, 0.72],
];

const optLabel = (exp: ViewProps<CombustionSample>['experiment'], key: string, value: unknown) =>
  exp.variables.find((v) => v.key === key)?.options.find((o) => o.value === value)?.label ?? String(value ?? '');

export function CandleMacroView({ experiment, trial, snapshot, values }: ViewProps<CombustionSample>) {
  const jarMl = Number(values.jarMl);
  const thick = values.candle === 'thick';
  const count = Number(values.candleCount) === 2 ? 2 : 1;
  const red = values.candleColor === 'red';
  const jar = JARS.find((j) => jarMl <= j.max)!;
  const candleW = thick ? CANDLE_W.thick : CANDLE_W.thin;
  const xs = count === 2 ? [CX - 22, CX + 22] : [CX];
  const colorLabel = optLabel(experiment, 'candleColor', values.candleColor);
  const candleLabel = optLabel(experiment, 'candle', values.candle);

  // 실험 전에는 불이 켜진 처음 상태를 보여 준다.
  const flame = snapshot ? snapshot.flame : 1;
  const burning = snapshot ? snapshot.lit >= 0.5 : true;
  const fog = snapshot?.fog ?? 0;
  const drops = Math.round(fog * DROPS.length);
  const jarTop = BASE_Y - jar.h;
  const jarL = CX - jar.w / 2;
  const jarR = CX + jar.w / 2;
  const t = snapshot?.t ?? 0;
  const extinguishS = trial ? (trial.result as { extinguishS: number }).extinguishS : 0;

  const note = !snapshot
    ? '실험을 실행하면 집기병으로 촛불을 덮어요.'
    : burning
      ? `불이 타고 있어요 · ${t.toFixed(1)}초`
      : `불이 꺼졌어요 · ${extinguishS.toFixed(1)}초`;

  return (
    <figure className="view candle" aria-label="눈으로 보기">
      <figcaption>눈으로 보기</figcaption>
      <svg
        viewBox="0 0 200 276"
        role="img"
        aria-label={`집기병으로 덮은 초: ${colorLabel} ${candleLabel} ${count}개, 집기병 ${jarMl} mL, ${snapshot ? (burning ? '불이 타고 있어요' : '불이 꺼졌어요') : '실험 전'}`}
      >
        {/* 받침 */}
        <rect x="10" y={BASE_Y} width="180" height="12" rx="3" fill="#b89a6e" stroke="currentColor" strokeWidth="1.5" />
        <text x={CX} y={BASE_Y + 28} textAnchor="middle" fontSize="12" fontWeight="700" fill="currentColor">
          {colorLabel} · {candleLabel} {count}개
        </text>

        {/* 초 */}
        {xs.map((x) => (
          <g key={x}>
            <rect
              x={x - candleW / 2}
              y={BASE_Y - CANDLE_H}
              width={candleW}
              height={CANDLE_H}
              fill={red ? '#d9443a' : '#f7f3e8'}
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <line x1={x} x2={x} y1={BASE_Y - CANDLE_H} y2={BASE_Y - CANDLE_H - 5} stroke="#333" strokeWidth="1.5" />
            {burning && flame > 0.02 && (
              <g transform={`translate(${x} ${BASE_Y - CANDLE_H - 5}) scale(${0.35 + 0.65 * flame})`}>
                <g className="flame">
                  <path d="M0 0 C-9 -8 -7 -22 0 -34 C7 -22 9 -8 0 0 Z" fill="#f5a623" stroke="#c25e00" strokeWidth="1" />
                  <path d="M0 -1 C-4 -5 -3 -13 0 -19 C3 -13 4 -5 0 -1 Z" fill="#fff3a0" />
                </g>
              </g>
            )}
            {!burning && (
              <g fill="none" stroke="#8a949e" strokeWidth="1.8" strokeLinecap="round" opacity={0.8}>
                <path d={`M${x - 3} ${BASE_Y - CANDLE_H - 8} q-5 -8 0 -15 q5 -7 0 -14`} />
                <path d={`M${x + 1} ${BASE_Y - CANDLE_H - 8} q5 -9 0 -17 q-5 -8 1 -16`} />
                <path d={`M${x + 5} ${BASE_Y - CANDLE_H - 8} q-4 -6 0 -12`} />
              </g>
            )}
          </g>
        ))}

        {/* 집기병: 투명한 유리 */}
        <path
          d={`M${jarL} ${BASE_Y} V${jarTop + 18} Q${jarL} ${jarTop} ${jarL + 18} ${jarTop} H${jarR - 18} Q${jarR} ${jarTop} ${jarR} ${jarTop + 18} V${BASE_Y}`}
          fill="rgba(160, 205, 235, 0.18)"
          stroke="currentColor"
          strokeWidth="2.5"
        />
        {/* 안쪽 벽의 물방울 */}
        {DROPS.slice(0, drops).map(([fx, fy], i) => (
          <circle key={i} cx={jarL + 5 + fx * (jar.w - 10)} cy={jarTop + 8 + fy * (jar.h - 16)} r="2.2" fill="#6db3f2" stroke="#2f6da3" strokeWidth="0.6" />
        ))}
      </svg>
      <p className="view-note">{note}</p>
    </figure>
  );
}
