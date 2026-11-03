import type { GasSample } from '@sci/engine-matter';
import type { ViewProps } from '../types';

const BOTTOM = 230; // 0 mL 위치(고무마개 쪽)
const PX_PER_ML = 2.4;
const SCALE_MAX = 60;
const BARREL_L = 70;
const BARREL_R = 130;

const BATH: Record<number, { fill: string; label: string }> = {
  0: { fill: '#8cc2ee', label: '얼음물' },
  20: { fill: '#dde2e7', label: '실온 물' },
  60: { fill: '#f2a65a', label: '뜨거운 물' },
};

function bathStyle(temp: number) {
  if (BATH[temp]) return BATH[temp]!;
  // 목록에 없는 온도: 가장 가까운 색을 쓰고 숫자를 글자로 적는다.
  const near = temp < 10 ? BATH[0]! : temp < 40 ? BATH[20]! : BATH[60]!;
  return { fill: near.fill, label: `${temp} °C 물` };
}

export function GasMacroView({ experiment, trial, snapshot, values }: ViewProps<GasSample>) {
  const startMl = Number(values.startMl);
  const volume = snapshot?.volumeMl ?? startMl;
  const push = Number(values.push);
  const bath = bathStyle(Number(values.bathTempC));
  const pistonY = BOTTOM - volume * PX_PER_ML;
  const topY = BOTTOM - SCALE_MAX * PX_PER_ML;
  const pushLabel =
    experiment.variables.find((v) => v.key === 'push')?.options.find((o) => o.value === values.push)?.label ?? '';
  const arrowW = push === 2 ? 8 : 3;
  const handleY = pistonY - 46;
  const ticks = Array.from({ length: SCALE_MAX / 10 + 1 }, (_, i) => i * 10);

  return (
    <figure className="view syringe" aria-label="눈으로 보기">
      <figcaption>눈으로 보기</figcaption>
      <svg
        viewBox="0 0 200 276"
        role="img"
        aria-label={`주사기: 기체의 부피 ${volume.toFixed(1)} mL, ${bath.label}${pushLabel ? `, 피스톤 ${pushLabel}` : ''}`}
      >
        {/* 물통 */}
        <rect x="24" y="170" width="152" height="92" rx="6" fill={bath.fill} stroke="currentColor" strokeWidth="2" />
        <text x="100" y="256" textAnchor="middle" fontSize="12" fontWeight="700" fill="#1d2733">{bath.label}</text>
        {/* 기체 */}
        <rect x={BARREL_L + 1} y={pistonY} width={BARREL_R - BARREL_L - 2} height={BOTTOM - pistonY} fill="rgba(120,160,200,0.18)" />
        {/* 통 */}
        <path d={`M ${BARREL_L} ${topY} L ${BARREL_L} ${BOTTOM} L ${BARREL_R} ${BOTTOM} L ${BARREL_R} ${topY}`} fill="none" stroke="currentColor" strokeWidth="2.5" />
        {/* 고무마개 */}
        <rect x={BARREL_L + 8} y={BOTTOM} width={BARREL_R - BARREL_L - 16} height="10" rx="2" fill="#5a4a3a" stroke="currentColor" />
        {/* 눈금 */}
        <g fontSize="10" fill="currentColor">
          {ticks.map((ml) => (
            <g key={ml}>
              <line x1={BARREL_L - 8} x2={BARREL_L} y1={BOTTOM - ml * PX_PER_ML} y2={BOTTOM - ml * PX_PER_ML} stroke="currentColor" strokeWidth="1.5" />
              <text x={BARREL_L - 11} y={BOTTOM - ml * PX_PER_ML + 3.5} textAnchor="end">{ml}</text>
            </g>
          ))}
          <text x={BARREL_L - 11} y={topY - 8} textAnchor="end">mL</text>
        </g>
        {/* 피스톤 */}
        <rect x={BARREL_L + 1} y={pistonY - 7} width={BARREL_R - BARREL_L - 2} height="8" fill="#8a949e" stroke="currentColor" />
        <rect x="96" y={pistonY - 40} width="8" height="34" fill="#8a949e" stroke="currentColor" />
        <rect x="80" y={handleY} width="40" height="7" rx="2" fill="#8a949e" stroke="currentColor" />
        {/* 누르는 힘 */}
        {push > 0 && (
          <g aria-hidden="true" fill="#c0392b" stroke="#c0392b">
            <line x1="100" y1={handleY - 34} x2="100" y2={handleY - 10} strokeWidth={arrowW} />
            <polygon points={`${100 - 6 - arrowW},${handleY - 12} ${100 + 6 + arrowW},${handleY - 12} 100,${handleY - 1}`} stroke="none" />
            <text x="136" y={handleY - 20} fontSize="11" stroke="none">{push === 2 ? '세게' : '살짝'}</text>
          </g>
        )}
      </svg>
      <p className="view-note" aria-live="off">
        {trial ? `주사기 눈금 ${volume.toFixed(1)} mL` : `주사기 눈금 ${volume.toFixed(1)} mL · 실험을 실행해 보세요.`}
      </p>
    </figure>
  );
}
