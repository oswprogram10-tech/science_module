import { MC_CELL_UM, type McPower, type McSample, type McStain, type MicroscopeSample } from '@sci/engine-life';
import type { ViewProps } from '../types';
import { FOCUS_TEXT, LABEL_TEXT, MICROSCOPE_NOTE_EMPTY, POWER_TEXT, SAMPLE_TEXT, STAIN_TEXT, clamp01, microscopeNote, microscopeResult, startSample, toParams } from './initial';

// 현미경 옆모습과 둥근 시야. 그림 안에는 글자가 없다(설명은 아래 문구와 접근성 이름에 있다).
export const W = 240;
export const H = 240;
/** 둥근 시야 */
export const FIELD = { cx: 176, cy: 112, r: 56 };
/** 시야 그림에서 화면 1 mm가 차지하는 길이(그림 단위) */
export const PX_PER_MM = 0.8;
/** 받침 유리 이름표 색 */
export const LABEL_FILL: Record<string, string> = { yellow: '#fde047', green: '#86efac' };
const FIELD_BG = '#f8fafc';
const INK = '#92400e';
const WALL = '#94a3b8';

/** 시야에 그리는 칸의 길이(그림 단위) = 화면에서 본 칸 길이(mm) × PX_PER_MM. 초점과 상관없이 조건(배율·재료)으로 정한다. */
export const cellLengthPx = (sample: McSample, power: McPower) => ((MC_CELL_UM[sample] * power) / 1000) * PX_PER_MM;

/** 칸 무늬(타일). 양파는 길쭉한 벽돌 모양이 줄지어 있고, 입안은 둥글고 불규칙한 칸이 흩어져 있다. */
function CellPattern({ id, sample, power, stain }: { id: string; sample: McSample; power: McPower; stain: McStain }) {
  const L = cellLengthPx(sample, power);
  const stained = stain === 'iodine';
  const dots = stained && power !== 40;
  const sw = Math.max(0.6, L * (stained ? 0.07 : 0.045));
  const wall = stained ? INK : WALL;
  const tint = stained ? '#fcd34d' : 'none';
  const dotR = Math.max(1.3, L * 0.07);
  if (sample === 'onion') {
    const w = L / 3.2;
    return (
      <pattern id={id} patternUnits="userSpaceOnUse" x={FIELD.cx - FIELD.r} y={FIELD.cy - FIELD.r} width={L} height={2 * w}>
        <rect x="0" y="0" width={L} height={2 * w} fill={tint} fillOpacity={stained ? 0.5 : 0} />
        <g stroke={wall} strokeWidth={sw} fill="none">
          <line x1="0" y1="0" x2={L} y2="0" />
          <line x1="0" y1={w} x2={L} y2={w} />
          <line x1="0" y1="0" x2="0" y2={w} />
          <line x1={L / 2} y1={w} x2={L / 2} y2={2 * w} />
        </g>
        {dots && (
          <g fill={INK}>
            <circle cx={L / 2} cy={w / 2} r={dotR} />
            <circle cx="0" cy={1.5 * w} r={dotR} />
            <circle cx={L} cy={1.5 * w} r={dotR} />
          </g>
        )}
      </pattern>
    );
  }
  const T = 2.2 * L;
  const cells: [number, number, number][] = [[0.28, 0.3, 0.46], [0.72, 0.22, 0.4], [0.4, 0.72, 0.44], [0.86, 0.7, 0.38]];
  return (
    <pattern id={id} patternUnits="userSpaceOnUse" x={FIELD.cx - FIELD.r} y={FIELD.cy - FIELD.r} width={T} height={T}>
      {cells.map(([fx, fy, fr], i) => (
        <g key={i}>
          <circle cx={fx * T} cy={fy * T} r={fr * L} fill={tint} fillOpacity={stained ? 0.5 : 0.12} stroke={wall} strokeWidth={sw} />
          {dots && <circle cx={fx * T} cy={fy * T} r={dotR} fill={INK} />}
        </g>
      ))}
    </pattern>
  );
}

/** 현미경 옆모습: 접안렌즈, 경통, 대물렌즈(배율마다 띠 1~3개), 재물대와 받침 유리, 조동 나사. 초점을 맞추면 경통이 내려와 받침 유리에 가까워진다. */
function Microscope({ power, focus, label, stain, sample }: { power: McPower; focus: boolean; label: string; stain: McStain; sample: McSample }) {
  const dy = focus ? 0 : -10;
  const bands = power === 40 ? 1 : power === 100 ? 2 : 3;
  return (
    <g data-testid="microscope" data-power={power} data-focus={focus ? 'on' : 'off'} stroke="#374151" strokeWidth="1.5">
      {/* 받침과 팔 */}
      <rect x="10" y="214" width="96" height="14" rx="5" fill="#94a3b8" />
      <rect x="76" y="44" width="16" height="174" rx="5" fill="#64748b" />
      {/* 재물대와 받침 유리 */}
      <rect x="18" y="160" width="68" height="8" fill="#475569" />
      <g data-testid="slide">
        <rect x="26" y="150" width="52" height="10" fill="#e0f2fe" fillOpacity="0.8" />
        <rect data-testid="slide-label" data-color={label} x="26" y="150" width="14" height="10" fill={LABEL_FILL[label]} />
        <ellipse cx="58" cy="155" rx="8" ry="3" fill={stain === 'iodine' ? '#d97706' : sample === 'onion' ? '#fde68a' : '#d1d5db'} stroke="none" />
      </g>
      {/* 경통과 대물렌즈: 초점을 맞추면 내려온다 */}
      <g transform={`translate(0 ${dy})`} data-testid="tube">
        <rect x="36" y="14" width="22" height="12" rx="3" fill="#475569" />
        <rect x="39" y="26" width="16" height="58" fill="#94a3b8" />
        <rect x="36" y="44" width="56" height="16" rx="4" fill="#64748b" />
        <rect x="34" y="84" width="26" height="10" rx="2" fill="#475569" />
        <rect x="42" y="94" width="10" height="42" fill="#cbd5e1" />
        {Array.from({ length: bands }, (_, i) => <line key={i} x1="42" y1={104 + i * 8} x2="52" y2={104 + i * 8} stroke="#1f2937" strokeWidth="2.5" />)}
        <rect x="43" y="136" width="8" height="4" fill="#475569" />
      </g>
      {/* 조동 나사(손잡이) */}
      <g data-testid="coarse-knob">
        <circle cx="84" cy="184" r="11" fill="#cbd5e1" />
        <line x1="84" y1="176" x2="84" y2="192" strokeWidth="3" />
        <line x1="76" y1="184" x2="92" y2="184" strokeWidth="3" />
      </g>
    </g>
  );
}

export function MicroscopeMacroView({ trial, snapshot, values }: ViewProps<MicroscopeSample>) {
  const p = toParams(values);
  const ran = trial !== undefined;
  const s = snapshot ?? startSample(values);
  const r = microscopeResult(values);
  // 실행하기 전에는 시야를 비운다(점선 둥근 틀만). 실행한 뒤에는 초점이 맞은 정도(sharp)만큼 또렷하게 그린다.
  const sharp = ran ? clamp01(s.sharp) : 0;
  const blur = (1 - sharp) * 5;
  const note = ran ? microscopeNote(s, r) : MICROSCOPE_NOTE_EMPTY;
  const patternId = 'mc-cells';

  return (
    <figure className="view microscope-macro" aria-label="눈으로 보기">
      <figcaption>눈으로 보기</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`현미경 옆모습. 받침 유리는 ${SAMPLE_TEXT[p.sample]}, 배율 ${POWER_TEXT[p.power]}, ${FOCUS_TEXT[p.focus]}, ${STAIN_TEXT[p.stain]}, 받침 유리 이름표 색 ${LABEL_TEXT[p.slideLabel]}. 오른쪽은 접안렌즈로 들여다본 둥근 시야. ${note}`}>
        <defs>
          <clipPath id="mc-clip"><circle cx={FIELD.cx} cy={FIELD.cy} r={FIELD.r - 1} /></clipPath>
          <filter id="mc-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation={blur.toFixed(2)} /></filter>
          <CellPattern id={patternId} sample={p.sample} power={p.power} stain={p.stain} />
        </defs>
        <Microscope power={p.power} focus={p.focus === 'on'} label={p.slideLabel} stain={p.stain} sample={p.sample} />
        {/* 둥근 시야 */}
        <circle
          data-testid="field"
          data-state={ran ? 'seen' : 'empty'}
          data-sharp={sharp.toFixed(2)}
          data-seen={ran ? r.seen : ''}
          data-sample={p.sample}
          data-stain={p.stain}
          data-power={p.power}
          cx={FIELD.cx}
          cy={FIELD.cy}
          r={FIELD.r}
          fill={ran ? FIELD_BG : 'none'}
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray={ran ? undefined : '5 4'}
        />
        {ran && (
          <g clipPath="url(#mc-clip)">
            <g filter={blur > 0.05 ? 'url(#mc-blur)' : undefined} data-testid="field-cells">
              <circle cx={FIELD.cx} cy={FIELD.cy} r={FIELD.r} fill={`url(#${patternId})`} />
            </g>
          </g>
        )}
      </svg>
      <p className="view-note" data-testid="microscope-note">{note}</p>
    </figure>
  );
}
