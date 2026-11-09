import type { InsulatedCupSample } from '@sci/engine-physics';
import type { ViewProps } from '../types';
import { initialSample, optionLabel } from './initial';

const CX = 100;
const BASE_Y = 236; // 받침 윗면
const CUP_W = 76;
const CUP_H = 120;
const WATER_H_200 = 92; // 200 mL일 때 물 높이
const LAYER_PX = 7; // 1겹의 두께
const THERMO_X = CX + 14;

type WrapKey = 'paper' | 'cotton' | 'bubble' | 'foil';
const WRAP_FILL: Record<WrapKey, string> = {
  paper: 'url(#wrap-paper)',
  cotton: 'url(#wrap-cotton)',
  bubble: 'url(#wrap-bubble)',
  foil: 'url(#wrap-foil)',
};

/** 김 줄기 수: (waterC - roomC)에 비례해 1~3개. */
export const steamCount = (waterC: number, roomC: number, startC = 60) =>
  Math.min(3, Math.max(1, Math.round((3 * (waterC - roomC)) / (startC - roomC))));

export function CupMacroView({ experiment, snapshot, values }: ViewProps<InsulatedCupSample>) {
  const roomC = Number(experiment.params?.roomC ?? 20);
  const startC = Number(experiment.params?.startC ?? 60);
  const s = snapshot ?? initialSample(values, experiment);
  const wrap = String(values.wrap);
  const wrapped = wrap !== 'none';
  const layers = Number(values.layers) === 2 ? 2 : 1;
  const lidOn = values.lid === 'on';
  const waterMl = Number(values.waterMl);
  const waterH = (WATER_H_200 * waterMl) / 200;
  const wrapLabel = optionLabel(experiment, 'wrap', values.wrap);
  const lidLabel = optionLabel(experiment, 'lid', values.lid);

  const cupL = CX - CUP_W / 2;
  const cupR = CX + CUP_W / 2;
  const cupTop = BASE_Y - CUP_H;
  const waterTop = BASE_Y - waterH;
  const thick = layers * LAYER_PX;
  const steams = steamCount(s.waterC, roomC, startC);
  const minutes = Math.round(s.t / 60);
  const wrapText = wrapped ? `${wrapLabel} ${layers}겹` : wrapLabel;

  return (
    <figure className="view cup" aria-label="눈으로 보기">
      <figcaption>눈으로 보기</figcaption>
      <svg
        viewBox="0 0 200 276"
        role="img"
        aria-label={`보온 컵: ${wrapText}, ${lidLabel}, 물 ${waterMl} mL, 물의 온도 ${s.waterC.toFixed(1)} °C`}
      >
        <defs>
          <pattern id="wrap-paper" width="8" height="5" patternUnits="userSpaceOnUse">
            <rect width="8" height="5" fill="#f4efe0" />
            <line x1="0" y1="2.5" x2="8" y2="2.5" stroke="#8a7a52" strokeWidth="0.8" />
          </pattern>
          <pattern id="wrap-cotton" width="7" height="7" patternUnits="userSpaceOnUse">
            <rect width="7" height="7" fill="#fbf9f4" />
            <circle cx="2" cy="2" r="1.3" fill="#9a9488" />
            <circle cx="5.5" cy="5.5" r="1.3" fill="#9a9488" />
          </pattern>
          <pattern id="wrap-bubble" width="10" height="10" patternUnits="userSpaceOnUse">
            <rect width="10" height="10" fill="#dff0fa" />
            <circle cx="5" cy="5" r="3.6" fill="none" stroke="#3f84b5" strokeWidth="1" />
          </pattern>
          <pattern id="wrap-foil" width="8" height="8" patternUnits="userSpaceOnUse">
            <rect width="8" height="8" fill="#d6dade" />
            <line x1="0" y1="8" x2="8" y2="0" stroke="#7d868e" strokeWidth="1.2" />
          </pattern>
        </defs>

        {/* 받침 */}
        <rect x="10" y={BASE_Y} width="180" height="12" rx="3" fill="#b89a6e" stroke="currentColor" strokeWidth="1.5" />
        <text x={CX} y={BASE_Y + 28} textAnchor="middle" fontSize="12" fontWeight="700" fill="currentColor">
          {wrapText}
        </text>

        {/* 감싼 재료: 컵 옆면을 둘러싼다. 2겹이면 두께가 두 배 */}
        {wrapped && (
          <g data-testid="wrap-layer">
            <rect x={cupL - thick} y={cupTop} width={thick} height={CUP_H} fill={WRAP_FILL[wrap as WrapKey]} stroke="currentColor" strokeWidth="1.2" />
            <rect x={cupR} y={cupTop} width={thick} height={CUP_H} fill={WRAP_FILL[wrap as WrapKey]} stroke="currentColor" strokeWidth="1.2" />
          </g>
        )}

        {/* 컵과 물 */}
        <rect x={cupL} y={waterTop} width={CUP_W} height={waterH} fill="#8cc4ee" />
        <path d={`M${cupL} ${cupTop} V${BASE_Y} H${cupR} V${cupTop}`} fill="none" stroke="currentColor" strokeWidth="2.5" />

        {/* 가상 온도계: 물속에 꽂혀 있다 */}
        <g>
          <rect x={THERMO_X - 3} y={cupTop - 26} width="6" height={BASE_Y - 12 - (cupTop - 26)} rx="3" fill="#fff" stroke="currentColor" strokeWidth="1.2" />
          <circle cx={THERMO_X} cy={BASE_Y - 12} r="6" fill="#d9443a" stroke="currentColor" strokeWidth="1.2" />
          <rect x={THERMO_X - 1.5} y={waterTop + 6} width="3" height={BASE_Y - 12 - waterTop - 6} fill="#d9443a" />
        </g>

        {/* 뚜껑 또는 김 */}
        {lidOn ? (
          <g data-testid="lid">
            <rect x={cupL - 6} y={cupTop - 8} width={CUP_W + 12} height="8" rx="3" fill="#8f99a3" stroke="currentColor" strokeWidth="1.5" />
            <rect x={CX - 5} y={cupTop - 14} width="10" height="6" rx="2" fill="#8f99a3" stroke="currentColor" strokeWidth="1.2" />
          </g>
        ) : (
          <g data-testid="steam" fill="none" stroke="#8a949e" strokeWidth="2" strokeLinecap="round" opacity={0.85}>
            {Array.from({ length: steams }, (_, i) => {
              const x = CX - 24 + i * 20 + (steams === 1 ? 24 : steams === 2 ? 10 : 0);
              return <path key={i} d={`M${x} ${waterTop - 4} q-6 -10 0 -18 q6 -9 0 -18`} />;
            })}
          </g>
        )}
      </svg>
      <p className="view-note">
        물 {s.waterC.toFixed(1)} °C · {minutes}분
      </p>
    </figure>
  );
}
