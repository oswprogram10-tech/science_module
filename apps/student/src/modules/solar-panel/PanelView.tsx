import type { SolarSample } from '@sci/engine-ssi';
import type { ViewProps } from '../types';
import { useLoopPhase, usePrefersReducedMotion } from '../transpiration/motion';
import { IDLE_NOTE, IDLE_SAMPLE, panelNote, toParams } from './initial';

// viewBox 폭 240은 1280 px 화면에서 이 칸의 실제 폭과 거의 같다. 글자 14는 화면에서도 약 13 px 이상이다.
export const W = 240;
export const H = 232;
export const GROUND_Y = 190;
/** 받침 위 경첩(패널 아래쪽 끝)과 패널 길이 */
export const HINGE = { x: 78, y: 172 };
export const LEN = 100;
/** 태양 중심과 햇빛 방향(태양 높이 60°이면 오른쪽 아래로 60°) */
const SUN = { x: 55, y: 40 };
/** 프로펠러 중심 */
const PROP = { x: 207, y: 140 };
/** 프로펠러가 도는 빠르기: 1분 동안 돈 횟수(= P·0.24)를 초당 바퀴 수로 바꾼 값 */
const lapsPerS = (turns60: number) => turns60 / 60;

const rad = (deg: number) => (deg * Math.PI) / 180;
const fix = (n: number) => n.toFixed(1);

/** 패널 위쪽 끝(경첩에서 길이 100만큼) */
export const panelEnd = (tilt: number) => ({ x: HINGE.x + LEN * Math.cos(rad(tilt)), y: HINGE.y - LEN * Math.sin(rad(tilt)) });

export function PanelView({ trial, snapshot, values, experiment, playhead }: ViewProps<SolarSample>) {
  const reduced = usePrefersReducedMotion();
  const p = toParams(values);
  const ran = trial !== undefined;
  const s: SolarSample = ran ? (snapshot ?? IDLE_SAMPLE) : IDLE_SAMPLE;
  const note = ran ? panelNote(s) : IDLE_NOTE;
  const cloudy = p.weather === 'cloudy';
  const shaded = p.shade === 'half';
  const alt = typeof experiment.params?.sunAltDeg === 'number' ? experiment.params.sunAltDeg : 60;
  const last = trial ? (trial.samples as SolarSample[]).at(-1)!.t : 0;
  const rate = ran ? lapsPerS(((trial!.samples as SolarSample[]).at(-1)!.turns)) : 0;
  // 전기를 만드는 동안(재생 중이고 플레이헤드가 끝에 닿기 전)에만 돈다. 움직임 줄이기이면 언제나 멈춰 있다.
  const spinning = ran && !reduced && rate > 1e-9 && playhead < last - 1e-9;
  const phase = useLoopPhase(spinning, rate);
  const angle = phase * 360;

  const R = panelEnd(p.tilt);
  // 햇빛 방향(해에서 패널 쪽): 태양 높이 alt이면 오른쪽 아래로 alt°
  const dx = Math.cos(rad(alt));
  const dy = Math.sin(rad(alt));
  const px = dy;
  const py = -dx;
  const rays = [-1, 0, 1].map((k) => ({ x1: SUN.x + 22 * dx + k * 16 * px, y1: SUN.y + 22 * dy + k * 16 * py, x2: SUN.x + 104 * dx + k * 16 * px, y2: SUN.y + 104 * dy + k * 16 * py }));
  const rayOpacity = cloudy ? 0.3 : 0.95;
  const ARC_R = 34;
  const a1 = { x: HINGE.x + ARC_R, y: HINGE.y };
  const a2 = { x: HINGE.x + ARC_R * Math.cos(rad(p.tilt)), y: HINGE.y - ARC_R * Math.sin(rad(p.tilt)) };
  const la = rad(p.tilt / 3);
  const labelX = HINGE.x + 56 * Math.cos(la);
  const labelY = p.tilt === 0 ? HINGE.y - 12 : HINGE.y - 56 * Math.sin(la) + 5;
  const label = `햇빛이 비추는 운동장에 놓인 태양광 패널 그림. 태양 높이 ${alt}°, 패널 기울기 ${p.tilt}°, ${cloudy ? '흐린 날' : '맑은 날'}, ${shaded ? '나무 그늘이 패널 절반을 가림' : '그늘 없음'}, 테두리 ${p.frame === 'black' ? '검은색' : '은색'}. 전선으로 프로펠러와 이어져 있어요. ${note}`;

  return (
    <figure className="view solar-macro" aria-label="눈으로 보기">
      <figcaption>눈으로 보기</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        {/* 땅 */}
        <rect x="0" y={GROUND_Y} width={W} height={H - GROUND_Y} fill="#86efac" fillOpacity="0.3" />
        <line x1="0" y1={GROUND_Y} x2={W} y2={GROUND_Y} stroke="currentColor" strokeWidth="1.5" opacity="0.6" />

        {/* 태양과 햇빛(흐린 날이면 구름이 가리고 햇빛이 흐려진다) */}
        <g data-testid="sun" data-alt={alt} opacity={cloudy ? 0.6 : 1}>
          <circle cx={SUN.x} cy={SUN.y} r="13" fill="#facc15" stroke="#a16207" strokeWidth="2" />
        </g>
        <g data-testid="sunrays" data-weather={p.weather} opacity={rayOpacity}>
          {rays.map((r, i) => (
            <g key={i}>
              <line x1={fix(r.x1)} y1={fix(r.y1)} x2={fix(r.x2)} y2={fix(r.y2)} stroke="#eab308" strokeWidth="3" strokeLinecap="round" />
              <path transform={`translate(${fix(r.x2)} ${fix(r.y2)}) rotate(${alt})`} d="M-9 -5 L0 0 L-9 5 Z" fill="#eab308" stroke="#eab308" strokeWidth="1.5" strokeLinejoin="round" />
            </g>
          ))}
        </g>
        {cloudy && (
          <g data-testid="clouds" fill="#e5e7eb" stroke="#6b7280" strokeWidth="1.5">
            <ellipse cx="40" cy="54" rx="20" ry="11" />
            <ellipse cx="64" cy="48" rx="22" ry="13" />
            <ellipse cx="86" cy="55" rx="18" ry="10" />
          </g>
        )}
        <text x="76" y="22" fontSize="14" fontWeight="700" fill="currentColor">태양</text>

        {/* 나무와 그림자(그늘 절반) */}
        {shaded && (
          <g data-testid="tree">
            <rect x="28" y="142" width="8" height="48" fill="#92400e" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="32" cy="126" r="22" fill="#16a34a" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="52" cy="136" r="14" fill="#16a34a" stroke="currentColor" strokeWidth="1.5" />
            <text x="32" y="96" textAnchor="middle" fontSize="14" fontWeight="700" fill="currentColor">그늘</text>
            <ellipse cx="86" cy="193" rx="38" ry="4" fill="#111827" fillOpacity="0.3" />
          </g>
        )}

        {/* 받침, 패널, 전선 */}
        <rect x="66" y={HINGE.y} width="24" height={GROUND_Y - HINGE.y} fill="#9ca3af" stroke="currentColor" strokeWidth="1.5" />
        <line x1={fix(R.x)} y1={fix(R.y)} x2={fix(R.x)} y2={GROUND_Y} stroke="currentColor" strokeWidth="3" />
        <g data-testid="panel" data-tilt={p.tilt} data-frame={p.frame} transform={`translate(${HINGE.x} ${HINGE.y}) rotate(${-p.tilt})`}>
          <rect x="0" y="-5" width={LEN} height="10" rx="1.5" fill="#1d4ed8" stroke={p.frame === 'silver' ? '#9ca3af' : '#111827'} strokeWidth="3" />
          {[25, 50, 75].map((x) => (
            <line key={x} x1={x} y1="-5" x2={x} y2="5" stroke="#ffffff" strokeWidth="1" opacity="0.6" />
          ))}
          {shaded && <rect data-testid="shade" x="0" y="-5" width={LEN / 2} height="10" fill="#111827" fillOpacity="0.62" />}
        </g>
        <circle cx={HINGE.x} cy={HINGE.y} r="3.5" fill="#f3f4f6" stroke="currentColor" strokeWidth="1.5" />

        {/* 기울기 치수: 바닥과 패널 사이의 각 */}
        <line x1={HINGE.x} y1={HINGE.y} x2={HINGE.x + 60} y2={HINGE.y} stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
        {p.tilt > 0 && <path data-testid="tilt-arc" d={`M${fix(a1.x)} ${fix(a1.y)} A${ARC_R} ${ARC_R} 0 0 0 ${fix(a2.x)} ${fix(a2.y)}`} fill="none" stroke="currentColor" strokeWidth="1.5" />}
        <text data-testid="tilt-label" x={fix(labelX)} y={fix(labelY)} textAnchor="middle" fontSize="14" fontWeight="700" fill="currentColor">{p.tilt}°</text>

        <path d={`M${HINGE.x + 12} ${GROUND_Y - 4} Q144 206 196 ${GROUND_Y - 6}`} fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" data-testid="wire" />
        <rect x="196" y="164" width="22" height={GROUND_Y - 164} fill="#d1d5db" stroke="currentColor" strokeWidth="1.5" />
        <line x1={PROP.x} y1={PROP.y} x2={PROP.x} y2="164" stroke="currentColor" strokeWidth="2.5" />
        <g data-testid="propeller" data-running={spinning ? 'true' : 'false'} data-angle={fix(angle)} transform={`translate(${PROP.x} ${PROP.y}) rotate(${fix(angle)})`}>
          {[0, 90, 180, 270].map((a) => (
            <ellipse key={a} cx="0" cy="-13" rx="5" ry="12" transform={`rotate(${a})`} fill="#f97316" stroke="currentColor" strokeWidth="1.5" />
          ))}
          <circle r="4" fill="#f3f4f6" stroke="currentColor" strokeWidth="1.5" />
        </g>
        <text x={PROP.x} y="104" textAnchor="middle" fontSize="14" fontWeight="700" fill="currentColor">프로펠러</text>
      </svg>
      <p className="view-note" data-testid="panel-note">{note}</p>
    </figure>
  );
}
