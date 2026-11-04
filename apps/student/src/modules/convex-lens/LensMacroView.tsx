import type { ConvexLensSample } from '@sci/engine-physics';
import type { ViewProps } from '../types';
import { brightnessText, initialSample, lensResult, optionLabel } from './initial';

// viewBox 폭 240은 1280 px 화면에서 이 칸의 실제 폭(약 230 px)과 거의 같다. 글자 14는 화면에서도 약 13 px 이상이다.
const W = 240;
const CX = 128; // 렌즈와 종이의 가운데
const LENS_Y = 76;
const CM_PX = 8; // 거리 1 cm = 8 px
const LENS_PX_PER_CM = 10; // 렌즈 지름 1 cm = 10 px
const TABLE_Y = 296;
const PAPER_HALF_H = 18;
const SPOT_PX_PER_MM = 1.25;
const SPOT_MIN_PX = 3;
const SPOT_MAX_PX = 100;

type Rgb = [number, number, number];
const FAINT: Rgb = [255, 229, 102]; // 연노랑
const BRIGHT: Rgb = [255, 251, 230]; // 흰 노랑
const hex = ([r, g, b]: Rgb) => `#${[r, g, b].map((x) => Math.round(x).toString(16).padStart(2, '0')).join('')}`;

/** 빛 원의 색: log(밝기 배율)에 비례해 연노랑에서 흰 노랑으로. 1배 → 연노랑, 1000배 이상 → 흰 노랑. */
export function spotColor(concentration: number): string {
  const k = Math.min(1, Math.max(0, Math.log(Math.max(1, concentration)) / Math.log(1000)));
  return hex([0, 1, 2].map((i) => FAINT[i]! + (BRIGHT[i]! - FAINT[i]!) * k) as Rgb);
}

/** 빛 원의 화면 지름(px): spotMm에 비례하되 최소 3 px, 종이 안에 들어오게 자른다. */
export const spotPx = (spotMm: number) => Math.min(SPOT_MAX_PX, Math.max(SPOT_MIN_PX, spotMm * SPOT_PX_PER_MM));

export function LensMacroView({ experiment, snapshot, values }: ViewProps<ConvexLensSample>) {
  const s = snapshot ?? initialSample(values, experiment);
  const { spotMm, concentration } = lensResult(values, experiment);
  const distanceCm = Number(values.distanceCm);
  const diameterCm = Number(values.diameterCm);
  const high = values.curve === 'high';
  const scorched = s.scorched >= 0.5;

  const lensR = (diameterCm * LENS_PX_PER_CM) / 2;
  const bulge = high ? 16 : 8; // 렌즈 두께
  const paperY = LENS_Y + distanceCm * CM_PX;
  const paperBottom = paperY + PAPER_HALF_H;
  const dPx = spotPx(spotMm);
  const rx = dPx / 2;
  const ry = Math.min(rx * 0.3, PAPER_HALF_H - 2);
  const brightText = brightnessText(concentration);
  const note = scorched
    ? '⚠ 종이가 그을리고 있어요. 실제 실험에서는 바로 렌즈를 치워요.'
    : `빛 원 ${spotMm.toFixed(1)} mm · ${s.spotC.toFixed(1)} °C`;
  const curveLabel = optionLabel(experiment, 'curve', values.curve);

  return (
    <figure className="view lens" aria-label="눈으로 보기">
      <figcaption>눈으로 보기</figcaption>
      <svg
        viewBox={`0 0 ${W} 306`}
        role="img"
        aria-label={`볼록 렌즈와 종이: ${curveLabel}, 지름 ${diameterCm} cm, 렌즈와 종이 사이 ${distanceCm} cm, 빛 원 ${spotMm.toFixed(1)} mm, ${brightText}, 온도 ${s.spotC.toFixed(1)} °C${scorched ? ', 종이가 그을림' : ''}`}
      >
        {/* 해 */}
        <g stroke="#d98a00" strokeWidth="2" strokeLinecap="round">
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i * Math.PI) / 4;
            return <line key={i} x1={CX + 17 * Math.cos(a)} y1={24 + 17 * Math.sin(a)} x2={CX + 23 * Math.cos(a)} y2={24 + 23 * Math.sin(a)} />;
          })}
        </g>
        <circle cx={CX} cy={24} r="12" fill="#ffd23f" stroke="#d98a00" strokeWidth="1.5" />
        {/* 해에서 내려오는 햇빛 */}
        <g stroke="#e69500" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.8">
          {[-0.8, 0, 0.8].map((k) => (
            <line key={k} x1={CX + k * lensR} y1="52" x2={CX + k * lensR} y2={LENS_Y - bulge / 2 - 2} />
          ))}
        </g>

        {/* 받침대와 렌즈 */}
        <rect x="10" y={TABLE_Y} width={W - 20} height="8" rx="2" fill="#b89a6e" stroke="currentColor" strokeWidth="1.5" />
        <line x1="22" y1={LENS_Y} x2="22" y2={TABLE_Y} stroke="currentColor" strokeWidth="4" />
        <line x1="22" y1={LENS_Y} x2={CX - lensR} y2={LENS_Y} stroke="currentColor" strokeWidth="3" />

        {/* 종이 아래 받침 */}
        <rect x={CX - 6} y={paperBottom} width="12" height={TABLE_Y - paperBottom} fill="#9aa4ae" stroke="currentColor" strokeWidth="1" />

        {/* 렌즈를 지나 종이로 모이는 빛 */}
        <polygon
          data-testid="light-cone"
          points={`${CX - lensR},${LENS_Y} ${CX + lensR},${LENS_Y} ${CX + rx},${paperY} ${CX - rx},${paperY}`}
          fill="#ffd23f"
          opacity="0.28"
        />

        {/* 종이: 비스듬히 본 흰 종이 */}
        <polygon
          points={`${CX - 50},${paperY - PAPER_HALF_H} ${CX + 50},${paperY - PAPER_HALF_H} ${CX + 70},${paperBottom} ${CX - 70},${paperBottom}`}
          fill="#fff"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        {scorched && (
          <g data-testid="scorch">
            <ellipse cx={CX} cy={paperY} rx={rx + 6} ry={ry + 3} fill="#6b3f1d" opacity="0.75" />
            <g fill="none" stroke="#7d868e" strokeWidth="2.5" strokeLinecap="round" opacity="0.85">
              <path d={`M${CX - 4} ${paperY - 4} q-7 -9 0 -17 q7 -8 0 -16`} />
              <path d={`M${CX + 6} ${paperY - 4} q7 -9 0 -17 q-7 -8 0 -16`} />
            </g>
          </g>
        )}
        <ellipse data-testid="light-spot" cx={CX} cy={paperY} rx={rx} ry={ry} fill={spotColor(concentration)} stroke="#8a6d00" strokeWidth="1.2" />

        {/* 렌즈: 지름과 볼록한 정도(두께)를 반영한다 */}
        <path
          data-testid="lens-shape"
          d={`M${CX - lensR} ${LENS_Y} Q${CX} ${LENS_Y - bulge} ${CX + lensR} ${LENS_Y} Q${CX} ${LENS_Y + bulge} ${CX - lensR} ${LENS_Y} Z`}
          fill="#bfe3f7"
          fillOpacity="0.85"
          stroke="currentColor"
          strokeWidth="2"
        />

        {/* 밝기는 색뿐 아니라 글자로도 알려 준다 */}
        <text x={CX} y={paperBottom + 18} textAnchor="middle" fontSize="14" fontWeight="700" fill="currentColor" stroke="var(--card)" strokeWidth="3" paintOrder="stroke">
          {brightText}
        </text>
      </svg>
      <p className="view-note">{note}</p>
    </figure>
  );
}
