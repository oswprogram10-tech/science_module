import { SEOUL_ANNUAL_TEMPERATURE, SEOUL_FIRST_30, SEOUL_LAST_30, periodMean, seoulDecadeMeans } from '@sci/engine-ssi';
import { useNarrow } from '../sky-observation/useNarrow';
import {
  CLIMATE_DATA_CAUTION,
  CLIMATE_DATA_INTRO,
  CLIMATE_DATA_NO_DATA,
  CLIMATE_DATA_QUESTION,
  CLIMATE_DATA_SOURCE,
  CLIMATE_DATA_TABLE_CAPTION,
  CLIMATE_DATA_TABLE_HEADS,
  CLIMATE_DATA_TABLE_SUMMARY,
  CLIMATE_DATA_TITLE,
  CLIMATE_DATA_X_LABEL,
  CLIMATE_DATA_Y_LABEL,
  climateDataAria,
  climateDataFirstLabel,
  climateDataLastLabel,
} from './initial';

const X_MIN = 1907;
const X_MAX = 2025;
const Y_MIN = 9;
const Y_MAX = 16;
const X_TICKS = [1910, 1940, 1970, 2000, 2025];
const Y_TICKS = [10, 12, 14, 16];

interface Place {
  /** 라벨 줄들(좁은 화면은 두 줄) */
  lines: string[];
  /** 글자 시작(또는 끝) 가로 위치: 연도 */
  year: number;
  anchor: 'start' | 'end' | 'middle';
  /** 첫 줄 글자 중심의 세로 위치: 기온(°C) */
  level: number;
}

interface Layout {
  W: number;
  H: number;
  l: number;
  r: number;
  t: number;
  b: number;
  font: number;
  narrow: boolean;
}

export const WIDE: Layout = { W: 640, H: 300, l: 58, r: 22, t: 12, b: 52, font: 15, narrow: false };
export const NARROW: Layout = { W: 340, H: 320, l: 50, r: 22, t: 12, b: 52, font: 15, narrow: true };

/** 값이 있는 해끼리 이어지는 구간들. 값이 없는 해에서 끊긴다. */
export function segments(): { year: number; meanC: number }[][] {
  const out: { year: number; meanC: number }[][] = [];
  let cur: { year: number; meanC: number }[] = [];
  for (const d of SEOUL_ANNUAL_TEMPERATURE) {
    if (d.meanC === null) {
      if (cur.length) out.push(cur);
      cur = [];
    } else cur.push({ year: d.year, meanC: d.meanC });
  }
  if (cur.length) out.push(cur);
  return out;
}

export function ClimateDataPanel() {
  const L = useNarrow() ? NARROW : WIDE;
  const first = periodMean(...SEOUL_FIRST_30);
  const last = periodMean(...SEOUL_LAST_30);
  const firstShown = first.shown ?? '';
  const lastShown = last.shown ?? '';
  const sx = (year: number) => L.l + ((year - X_MIN) / (X_MAX - X_MIN)) * (L.W - L.l - L.r);
  const sy = (c: number) => L.t + ((Y_MAX - c) / (Y_MAX - Y_MIN)) * (L.H - L.t - L.b);
  const lh = L.font + 2; // 줄 간격
  const FS = L.font;

  const firstPlace: Place = L.narrow
    ? { lines: ['처음 30년 ', `평균 ${firstShown} °C`], year: 1908, anchor: 'start', level: 13.7 }
    : { lines: [climateDataFirstLabel(firstShown)], year: 1908, anchor: 'start', level: 13.7 };
  const lastPlace: Place = L.narrow
    ? { lines: ['최근 30년 ', `평균 ${lastShown} °C`], year: 2025, anchor: 'end', level: 10.2 }
    : { lines: [climateDataLastLabel(lastShown)], year: 2025, anchor: 'end', level: 10.2 };
  const noData: Place = { lines: [CLIMATE_DATA_NO_DATA], year: 1951.5, anchor: 'middle', level: 15.4 };
  const aria = climateDataAria(firstShown, lastShown);
  // 두 줄 라벨의 글자 합이 문구와 같은지는 단위 테스트가 확인한다.
  const labelText = (p: Place, id: string) => (
    <text data-testid={id} x={sx(p.year)} y={sy(p.level) + FS * 0.35} textAnchor={p.anchor} fontSize={FS} fill="currentColor">
      {p.lines.map((line, i) => (
        <tspan key={line} x={sx(p.year)} dy={i === 0 ? 0 : lh}>{line}</tspan>
      ))}
    </text>
  );
  const midFirst = (SEOUL_FIRST_30[0] + SEOUL_FIRST_30[1]) / 2;
  const midLast = (SEOUL_LAST_30[0] + SEOUL_LAST_30[1]) / 2;
  const decades = seoulDecadeMeans();

  return (
    <details className="climate-data" data-testid="climate-data">
      <summary>{CLIMATE_DATA_TITLE}</summary>
      <p>{CLIMATE_DATA_INTRO}</p>
      <svg
        className="climate-svg"
        viewBox={`0 0 ${L.W} ${L.H}`}
        role="img"
        aria-label={aria}
        data-testid="climate-svg"
        data-layout={L.narrow ? 'narrow' : 'wide'}
      >
        <rect x={L.l} y={L.t} width={L.W - L.l - L.r} height={L.H - L.t - L.b} fill="none" stroke="var(--cd-axis)" />
        {/* 값이 없는 해(1950~1953) 띠 */}
        <rect data-testid="climate-gap" x={sx(1949)} y={L.t} width={sx(1954) - sx(1949)} height={L.H - L.t - L.b} fill="var(--cd-gap)" />
        <g fontSize={FS} fill="currentColor">
          {X_TICKS.map((t) => (
            <g key={`x${t}`}>
              <line x1={sx(t)} x2={sx(t)} y1={L.H - L.b} y2={L.H - L.b + 4} stroke="var(--cd-axis)" />
              <text x={sx(t)} y={L.H - L.b + 19} textAnchor="middle">{t}</text>
            </g>
          ))}
          {Y_TICKS.map((g) => (
            <g key={`y${g}`}>
              <line x1={L.l} x2={L.W - L.r} y1={sy(g)} y2={sy(g)} stroke="currentColor" opacity="0.12" />
              <line x1={L.l - 4} x2={L.l} y1={sy(g)} y2={sy(g)} stroke="var(--cd-axis)" />
              <text x={L.l - 7} y={sy(g) + 5} textAnchor="end">{g}</text>
            </g>
          ))}
          <text x={(L.l + L.W - L.r) / 2} y={L.H - 7} textAnchor="middle">{CLIMATE_DATA_X_LABEL}</text>
          <text transform={`translate(15 ${(L.t + L.H - L.b) / 2}) rotate(-90)`} textAnchor="middle">{CLIMATE_DATA_Y_LABEL}</text>
        </g>
        {/* 기간 평균: 굵은 점선 두 개(모양이 서로 다르다) */}
        <line data-testid="climate-mean-first" x1={sx(SEOUL_FIRST_30[0])} x2={sx(SEOUL_FIRST_30[1])} y1={sy(first.mean ?? 0)} y2={sy(first.mean ?? 0)} stroke="var(--cd-mean-a)" strokeWidth="4" strokeDasharray="10 6" />
        <line data-testid="climate-mean-last" x1={sx(SEOUL_LAST_30[0])} x2={sx(SEOUL_LAST_30[1])} y1={sy(last.mean ?? 0)} y2={sy(last.mean ?? 0)} stroke="var(--cd-mean-b)" strokeWidth="4" strokeDasharray="2 6" strokeLinecap="round" />
        {/* 라벨과 평균선을 잇는 가는 선 */}
        <line x1={sx(midFirst)} x2={sx(midFirst)} y1={sy(firstPlace.level) + (firstPlace.lines.length - 1) * lh + FS * 0.7} y2={sy(first.mean ?? 0)} stroke="var(--cd-mean-a)" strokeWidth="1.5" />
        <line x1={sx(midLast)} x2={sx(midLast)} y1={sy(lastPlace.level) - FS * 0.7} y2={sy(last.mean ?? 0)} stroke="var(--cd-mean-b)" strokeWidth="1.5" />
        {/* 해마다의 값: 값이 없는 해에서 끊긴 선과 작은 점 */}
        {segments().map((seg) => (
          <path
            key={seg[0]!.year}
            data-testid="climate-segment"
            data-from={seg[0]!.year}
            data-to={seg[seg.length - 1]!.year}
            d={seg.map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p.year).toFixed(1)} ${sy(p.meanC).toFixed(1)}`).join(' ')}
            fill="none"
            stroke="var(--cd-line)"
            strokeWidth="1.2"
          />
        ))}
        {SEOUL_ANNUAL_TEMPERATURE.map((d) =>
          d.meanC === null ? null : <circle key={d.year} data-testid="climate-dot" data-year={d.year} cx={sx(d.year)} cy={sy(d.meanC)} r="2" fill="var(--cd-line)" />,
        )}
        {labelText(firstPlace, 'climate-label-first')}
        {labelText(lastPlace, 'climate-label-last')}
        {labelText(noData, 'climate-label-gap')}
      </svg>
      <p>{CLIMATE_DATA_QUESTION}</p>
      <p>{CLIMATE_DATA_CAUTION}</p>
      <details className="climate-table" data-testid="climate-table">
        <summary>{CLIMATE_DATA_TABLE_SUMMARY}</summary>
          <table>
            <caption>{CLIMATE_DATA_TABLE_CAPTION}</caption>
            <thead>
              <tr>
                <th scope="col">{CLIMATE_DATA_TABLE_HEADS[0]}</th>
                <th scope="col">{CLIMATE_DATA_TABLE_HEADS[1]}</th>
              </tr>
            </thead>
            <tbody>
              {decades.map((d) => (
                <tr key={d.from}>
                  <td>{d.from}~{d.to}</td>
                  <td>{d.shown}{d.count !== 10 ? ` (자료 ${d.count}해)` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
      </details>
      <p className="climate-source">{CLIMATE_DATA_SOURCE}</p>
    </details>
  );
}
