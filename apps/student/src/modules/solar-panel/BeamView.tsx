import type { SolarSample } from '@sci/engine-ssi';
import type { ViewProps } from '../types';
import { BEAM_COUNT, BEAM_GAP, BEAM_IDLE_NOTE, BEAM_NOTE, BEAM_P0, BLOCKED_COUNT, LIMITS_TEXT, LIMITS_TITLE, PANEL_LEN, beamLayout, sunAltOf, toParams } from './initial';

// 글자 14는 화면에서도 약 13 px 이상이다(viewBox 폭 240은 이 칸의 실제 폭과 거의 같다).
export const W = 240;
export const H = 240;
export const GROUND_Y = 226;
/** 패널 단면 가운데 */
const C = { x: 120, y: 160 };
/** 줄기 길이(패널에 닿는 자리에서 거슬러 올라가는 길이) */
const BEAM_LEN = 110;
const STOP_BACK = 44;
const SUNLIGHT = '#eab308';

const rad = (deg: number) => (deg * Math.PI) / 180;
const fix = (n: number) => n.toFixed(1);

function Arrow({ x, y, deg, color, opacity, testid }: { x: number; y: number; deg: number; color: string; opacity: number; testid?: string }) {
  return <path data-testid={testid} transform={`translate(${fix(x)} ${fix(y)}) rotate(${fix(deg)})`} d="M-9 -5 L0 0 L-9 5 Z" fill={color} stroke={color} strokeWidth="1.5" strokeLinejoin="round" opacity={opacity} />;
}

export function BeamView({ trial, values, experiment }: ViewProps<SolarSample>) {
  const ran = trial !== undefined;
  const p = toParams(values);
  const alt = sunAltOf(experiment);
  // 햇빛이 가는 방향(오른쪽 아래로 alt°)과 패널 방향(오른쪽 위로 기울기°)
  const d = { x: Math.cos(rad(alt)), y: Math.sin(rad(alt)) };
  const u = { x: Math.cos(rad(p.tilt)), y: -Math.sin(rad(p.tilt)) };
  const at = (pos: number) => ({ x: C.x + pos * u.x, y: C.y + pos * u.y });
  const note = ran ? BEAM_NOTE : BEAM_IDLE_NOTE;
  const cloudy = p.weather === 'cloudy';
  const shaded = p.shade === 'half';
  const layout = beamLayout(p.tilt, p.shade, alt);
  const hits = layout.beams.filter((b) => b.state === 'hit').length;
  const blocked = layout.beams.filter((b) => b.state === 'blocked').length;
  const baseOpacity = ran && cloudy ? 0.45 : 1;
  const highEnd = at(PANEL_LEN / 2);

  // 실행 전: 조건과 상관없이 같은 짧은 줄기 6개만(패널에 닿지 않는다). 패널은 고른 기울기 그대로 놓인다.
  const idleBeams = Array.from({ length: BEAM_COUNT }, (_, i) => {
    const q = { x: C.x + (BEAM_P0 + i * BEAM_GAP), y: C.y };
    const x1 = q.x - BEAM_LEN * d.x;
    const y1 = q.y - BEAM_LEN * d.y;
    return { i, x1, y1, x2: x1 + 52 * d.x, y2: y1 + 52 * d.y };
  });
  const sourceFirst = ran ? (() => { const q = at(layout.beams[0]!.p); return { x: q.x - BEAM_LEN * d.x, y: q.y - BEAM_LEN * d.y }; })() : { x: idleBeams[0]!.x1, y: idleBeams[0]!.y1 };

  const label = ran
    ? `햇빛 줄기 6개가 기울기 ${p.tilt}°인 패널 단면에 닿는 그림. 패널에 닿는 줄기는 ${hits}개${shaded ? `, 나무에 막힌 줄기는 ${blocked}개` : ''}. 줄기 간격은 ${fix(layout.spacing)}로 ${layout.spacing > BEAM_GAP + 0.05 ? '기울어 닿아서 더 넓어요' : '가장 촘촘해요'}. ${note}`
    : `햇빛 줄기 6개와 기울기 ${p.tilt}°인 패널 단면 그림. ${note}`;

  return (
    <figure className="view solar-beams" aria-label="빛이 닿는 모습 보기">
      <figcaption>빛이 닿는 모습 보기</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        <line x1="0" y1={GROUND_Y} x2={W} y2={GROUND_Y} stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
        <line x1={C.x} y1={C.y} x2={C.x} y2={GROUND_Y} stroke="currentColor" strokeWidth="3" />

        {ran ? (
          <g data-testid="beams" data-total={BEAM_COUNT} data-hit={hits} data-blocked={blocked} data-spacing={fix(layout.spacing)} data-weather={p.weather}>
            {layout.beams.map((b) => {
              const q = at(b.p);
              const src = { x: q.x - BEAM_LEN * d.x, y: q.y - BEAM_LEN * d.y };
              let end = q;
              if (b.state === 'blocked') end = { x: q.x - STOP_BACK * d.x, y: q.y - STOP_BACK * d.y };
              else if (b.state === 'miss') {
                const t = (GROUND_Y - q.y) / d.y;
                end = { x: q.x + t * d.x, y: GROUND_Y };
              }
              const o = baseOpacity * (b.state === 'miss' ? 0.4 : 1);
              return (
                <g key={b.index} data-testid="beam" data-state={b.state} data-p={fix(b.p)}>
                  <line x1={fix(src.x)} y1={fix(src.y)} x2={fix(end.x)} y2={fix(end.y)} stroke={SUNLIGHT} strokeWidth="3" strokeLinecap="round" opacity={o} />
                  <Arrow x={end.x} y={end.y} deg={alt} color={SUNLIGHT} opacity={o} />
                </g>
              );
            })}
            {/* 닿은 자리 점 */}
            {layout.beams.filter((b) => b.state === 'hit').map((b) => {
              const q = at(b.p);
              return <circle key={b.index} data-testid="hit-dot" cx={fix(q.x)} cy={fix(q.y)} r="4" fill="#ef4444" stroke="currentColor" strokeWidth="1" />;
            })}
          </g>
        ) : (
          <g data-testid="beams-idle">
            {idleBeams.map((b) => (
              <g key={b.i} data-testid="beam-idle">
                <line x1={fix(b.x1)} y1={fix(b.y1)} x2={fix(b.x2)} y2={fix(b.y2)} stroke={SUNLIGHT} strokeWidth="3" strokeLinecap="round" />
                <Arrow x={b.x2} y={b.y2} deg={alt} color={SUNLIGHT} opacity={1} />
              </g>
            ))}
          </g>
        )}

        {/* 그늘: 막힌 줄기 위쪽의 나무 */}
        {ran && shaded && (() => {
          const a = at(layout.beams[0]!.p);
          const b = at(layout.beams[BLOCKED_COUNT - 1]!.p);
          const m = { x: (a.x + b.x) / 2 - STOP_BACK * d.x - 6 * d.x, y: (a.y + b.y) / 2 - STOP_BACK * d.y - 6 * d.y };
          const rx = Math.hypot(b.x - a.x, b.y - a.y) / 2 + 22;
          return (
            <g data-testid="canopy">
              <ellipse cx={fix(m.x)} cy={fix(m.y)} rx={fix(rx)} ry="10" transform={`rotate(${fix(-p.tilt)} ${fix(m.x)} ${fix(m.y)})`} fill="#16a34a" stroke="currentColor" strokeWidth="1.5" />
              <text x={fix(Math.min(W - 30, Math.max(30, m.x - 6)))} y={fix(m.y + 30)} textAnchor="middle" fontSize="14" fontWeight="700" fill="currentColor">나무</text>
            </g>
          );
        })()}

        {/* 패널 단면 */}
        <g data-testid="panel-section" data-tilt={p.tilt} transform={`translate(${C.x} ${C.y}) rotate(${-p.tilt})`}>
          <rect x={-PANEL_LEN / 2} y="-5" width={PANEL_LEN} height="10" rx="1.5" fill="#1d4ed8" stroke="currentColor" strokeWidth="2" />
          {ran && shaded && <rect data-testid="shade-section" x={-PANEL_LEN / 2} y="-5" width={PANEL_LEN / 2} height="10" fill="#111827" fillOpacity="0.62" />}
        </g>

        <text data-testid="label-sun" x={Math.max(4, Math.round(sourceFirst.x) - 24)} y={Math.max(18, Math.round(sourceFirst.y) - 8)} fontSize="14" fontWeight="700" fill="currentColor">햇빛</text>
        <text data-testid="label-panel" x={Math.min(W - 32, Math.round(highEnd.x) + 10)} y={Math.round(highEnd.y) - 4} fontSize="14" fontWeight="700" fill="currentColor">패널</text>
      </svg>
      <p className="view-note" data-testid="beam-note">{note}</p>
      <details className="limits" data-testid="model-limits">
        <summary>{LIMITS_TITLE}</summary>
        <p>{LIMITS_TEXT}</p>
      </details>
    </figure>
  );
}
