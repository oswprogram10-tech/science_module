import { HM_DIFFS, HM_DRYS, HM_TABLE, type HumiditySample } from '@sci/engine-earth';
import type { ViewProps } from '../types';
import { PLACE_TEXT, clamp01, humidityNote, humidityResult, startSample, toParams } from './initial';

// viewBox 폭 240은 1280 px 화면에서 이 칸의 실제 폭(약 230 px)과 거의 같다. 글자 14는 화면에서도 약 13 px 이상이다.
export const W = 240;
export const H = 424;
/** 두 온도계: 눈금은 0~35 °C */
export const THERMO_MAX_C = 35;
export const TUBE = { top: 80, bulbY: 176 };
export const DRY_X = 74;
export const WET_X = 150;
/** 벽(온도계 뒤): 겉 색깔만 다르다. */
export const WALL = { x: 34, y: 70, w: 176, h: 128 };
export const WALL_FILL: Record<'white' | 'gray', string> = { white: '#ffffff', gray: '#9ca3af' };
/** 습도표: 첫 열(건구 온도)과 7개 열(온도 차 0~6) */
export const TABLE = { x0: 44, colW: 27, headY: 264, rowY0: 290, rowH: 22 };
/** 강조한 칸의 바탕과 글자 색(밝은·어두운 화면 모두 대비가 충분한 고정색) */
export const HIT_FILL = '#facc15';
export const HIT_TEXT = '#111827';

/** 온도(°C) → 수은 기둥 윗끝 y */
export const mercuryTop = (c: number): number => {
  const span = TUBE.bulbY - 6 - TUBE.top;
  return TUBE.bulbY - 6 - clamp01(c / THERMO_MAX_C) * span;
};

const cellX = (col: number) => TABLE.x0 + col * TABLE.colW;

export function HumidityMacroView({ trial, snapshot, values }: ViewProps<HumiditySample>) {
  const p = toParams(values);
  const ran = trial !== undefined;
  const s = snapshot ?? startSample(values);
  const r = humidityResult(values);
  // 습구 온도와 습도표의 칸은 실행한 뒤에만 보인다. 실행 전에는 두 온도계가 모두 건구 온도를 가리킨다.
  const note = ran ? humidityNote(s) : '실험하면 습구 온도가 내려가요. 습도표에서 습도를 찾아볼 수 있어요.';
  const wetLabel = ran ? `${Math.round(s.wetC * 10) / 10} °C` : '? °C';
  const diffIndex = HM_DIFFS.indexOf(p.diff as (typeof HM_DIFFS)[number]);

  return (
    <figure className="view humidity-macro" aria-label="눈으로 보기">
      <figcaption>눈으로 보기</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`건습구 습도계와 습도표. 건구 온도 ${p.dry} °C, 건구와 습구의 온도 차 ${p.diff} °C, ${PLACE_TEXT[p.place]}. ${note}`}>
        <text x="12" y="18" fontSize="14" fontWeight="700" fill="currentColor" data-testid="dry-label">건구 온도 {p.dry} °C</text>
        <text x="12" y="38" fontSize="14" fill="currentColor" data-testid="place-label">온도 차 {p.diff} °C · {PLACE_TEXT[p.place]}</text>
        <g data-testid="humidity-art" data-place={p.place} data-dry={p.dry} data-diff={p.diff} data-wet={s.wetC.toFixed(2)}>
          <rect data-testid="wall" data-fill={WALL_FILL[p.place]} x={WALL.x} y={WALL.y} width={WALL.w} height={WALL.h} fill={WALL_FILL[p.place]} stroke="currentColor" strokeWidth="1.5" />
          {/* 건구 온도계 */}
          <text x={DRY_X} y="62" fontSize="14" fontWeight="700" textAnchor="middle" fill="currentColor" data-testid="dry-reading">{p.dry} °C</text>
          <g data-testid="thermo-dry">
            <rect x={DRY_X - 4} y={TUBE.top} width="8" height={TUBE.bulbY - 6 - TUBE.top} rx="4" fill="#fff" stroke="#374151" strokeWidth="1.2" />
            <circle cx={DRY_X} cy={TUBE.bulbY} r="8" fill="#d9443a" stroke="#374151" strokeWidth="1.2" />
            <rect data-testid="mercury-dry" x={DRY_X - 2} y={mercuryTop(s.dryC)} width="4" height={TUBE.bulbY - 6 - mercuryTop(s.dryC)} fill="#d9443a" />
          </g>
          {/* 습구 온도계: 구에 젖은 헝겊을 감고, 헝겊 끝은 물통에 담겨 있다. */}
          <text x={WET_X} y="62" fontSize="14" fontWeight="700" textAnchor="middle" fill="currentColor" data-testid="wet-reading">{wetLabel}</text>
          <g data-testid="thermo-wet">
            <rect x={WET_X - 4} y={TUBE.top} width="8" height={TUBE.bulbY - 6 - TUBE.top} rx="4" fill="#fff" stroke="#374151" strokeWidth="1.2" />
            <ellipse data-testid="wet-cloth" cx={WET_X} cy={TUBE.bulbY} rx="13" ry="14" fill="#93c5fd" stroke="#374151" strokeWidth="1.2" />
            <circle cx={WET_X} cy={TUBE.bulbY} r="8" fill="#d9443a" stroke="#374151" strokeWidth="1.2" />
            <rect data-testid="mercury-wet" x={WET_X - 2} y={mercuryTop(s.wetC)} width="4" height={TUBE.bulbY - 6 - mercuryTop(s.wetC)} fill="#d9443a" />
            <path d={`M${WET_X + 10} ${TUBE.bulbY + 4} Q${WET_X + 26} ${TUBE.bulbY + 6} 186 ${TUBE.bulbY + 8}`} fill="none" stroke="#60a5fa" strokeWidth="4" />
            <rect x="174" y={TUBE.bulbY + 4} width="26" height="20" fill="#bfdbfe" stroke="#374151" strokeWidth="1.2" />
          </g>
        </g>
        <text x={DRY_X} y="218" fontSize="14" textAnchor="middle" fill="currentColor">건구</text>
        <text x={WET_X} y="218" fontSize="14" textAnchor="middle" fill="currentColor">습구(젖은 헝겊)</text>
        <text x="12" y="240" fontSize="14" fontWeight="700" fill="currentColor">습도표(%)</text>
        <text x="12" y="258" fontSize="14" fill="currentColor">가로 온도 차(°C), 세로 건구(°C)</text>
        {/* 습도표: 건구 온도 행 × 온도 차 열. 두 값이 만나는 칸은 실행한 뒤에만 강조한다. */}
        <g data-testid="humidity-table" data-hit={ran ? 'true' : 'false'}>
          {HM_DIFFS.map((d, c) => (
            <text key={`h${d}`} data-testid="table-diff" x={cellX(c) + TABLE.colW / 2} y={TABLE.headY + 18} fontSize="14" fontWeight={ran && c === diffIndex ? 700 : 400} textAnchor="middle" fill="currentColor">{d}</text>
          ))}
          {HM_DRYS.map((dry, ri) => {
            const top = TABLE.rowY0 + ri * TABLE.rowH;
            return (
              <g key={dry}>
                <text data-testid="table-dry" x={TABLE.x0 - 6} y={top + 16} fontSize="14" fontWeight={ran && dry === p.dry ? 700 : 400} textAnchor="end" fill="currentColor">{dry}</text>
                {HM_TABLE[dry].map((v, c) => {
                  const hit = ran && dry === p.dry && c === diffIndex;
                  return (
                    <g key={c} data-testid="table-cell" data-dry={dry} data-diff={HM_DIFFS[c]} data-value={v} data-hit={hit ? 'true' : 'false'}>
                      <rect x={cellX(c)} y={top} width={TABLE.colW} height={TABLE.rowH} fill={hit ? HIT_FILL : 'none'} stroke="currentColor" strokeWidth={hit ? 2 : 0.6} strokeOpacity={hit ? 1 : 0.4} />
                      <text x={cellX(c) + TABLE.colW / 2} y={top + 16} fontSize="14" fontWeight={hit ? 700 : 400} textAnchor="middle" fill={hit ? HIT_TEXT : 'currentColor'}>{v}</text>
                    </g>
                  );
                })}
              </g>
            );
          })}
        </g>
        {ran && <text x="12" y="418" fontSize="14" fontWeight="700" fill="currentColor" data-testid="rh-text">습도 {r.rh} %</text>}
      </svg>
      <p className="view-note" data-testid="humidity-note">{note}</p>
    </figure>
  );
}
