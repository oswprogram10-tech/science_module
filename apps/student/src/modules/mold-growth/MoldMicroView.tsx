import { useMemo, useState } from 'react';
import type { MoldSample } from '@sci/engine-life';
import type { ViewProps } from '../types';
import { moldColor, seeded, startSample } from './initial';

const W = 240;
const H = 262;
const CX = 120;
const CY = 120;
const R = 100;

/** 배율 단계: zoom은 ×100 그림에 대한 확대 배수, scale은 축척 막대(60 px)가 뜻하는 길이 */
export const MAGNIFICATIONS = [
  { label: '×40', zoom: 0.4, scale: '0.5 mm' },
  { label: '×100', zoom: 1, scale: '0.2 mm' },
  { label: '×400', zoom: 4, scale: '0.05 mm' },
] as const;
export type Magnification = (typeof MAGNIFICATIONS)[number]['label'];
const SCALE_BAR_PX = 60;

export const SCOPE_NOTE = '곰팡이는 가는 실 같은 균사로 퍼지고, 포자로 퍼져 나가요.';
export const NO_MOLD_TEXT = '아직 곰팡이가 보이지 않아요';

interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}
interface Tip {
  x: number;
  y: number;
}
const MAIN_MAX = 12;
const BRANCHES_PER_MAIN = 3;

/** 시드 고정 균사 가지: 가운데 둘레에서 바깥으로 뻗는 줄기마다 곁가지 셋. 앞에서부터 쓰므로 자라는 모습이 된다. */
function makeHyphae() {
  const rnd = seeded(4242);
  const mains = Array.from({ length: MAIN_MAX }, (_, i) => {
    const angle = ((i + rnd() * 0.6) / MAIN_MAX) * Math.PI * 2;
    const ox = (rnd() - 0.5) * 20;
    const oy = (rnd() - 0.5) * 20;
    const bend = (rnd() - 0.5) * 0.5;
    const subs = Array.from({ length: BRANCHES_PER_MAIN }, (_, j) => ({
      at: 0.3 + 0.2 * j + rnd() * 0.08,
      turn: (j % 2 === 0 ? 1 : -1) * (0.5 + rnd() * 0.4),
      len: 0.4 + rnd() * 0.15,
    }));
    return { angle, ox, oy, bend, subs };
  });
  return mains;
}

/** 균사 선들과 가지 끝(포자 자리)을 계산한다. 좌표는 시야 가운데가 원점인 그림 좌표(배율 ×100 기준). */
export function buildHyphae(coverPct: number) {
  const mains = makeHyphae();
  const count = coverPct <= 0 ? 0 : Math.min(MAIN_MAX, Math.max(1, Math.round(3 + (MAIN_MAX - 3) * (coverPct / 100))));
  const length = coverPct <= 0 ? 0 : 16 + 74 * (coverPct / 100);
  const segments: Segment[] = [];
  const tips: Tip[] = [];
  for (const m of mains.slice(0, count)) {
    const ex = m.ox + Math.cos(m.angle + m.bend) * length;
    const ey = m.oy + Math.sin(m.angle + m.bend) * length;
    segments.push({ x1: m.ox, y1: m.oy, x2: ex, y2: ey });
    tips.push({ x: ex, y: ey });
    for (const b of m.subs) {
      const bx = m.ox + (ex - m.ox) * b.at;
      const by = m.oy + (ey - m.oy) * b.at;
      const a = m.angle + b.turn;
      const sx = bx + Math.cos(a) * length * b.len;
      const sy = by + Math.sin(a) * length * b.len;
      segments.push({ x1: bx, y1: by, x2: sx, y2: sy });
      tips.push({ x: sx, y: sy });
    }
  }
  return { segments, tips };
}

/** 그릴 포자 덩어리 수: 가지 끝 수에 spores(0~1)를 곱한다. 곰팡이가 있고 포자가 조금이라도 생겼으면 하나는 보인다. */
export const sporeCount = (spores: number, tipCount: number) => (spores <= 0 || tipCount === 0 ? 0 : Math.max(1, Math.round(spores * tipCount)));

export function MoldMicroView({ experiment, snapshot, values }: ViewProps<MoldSample>) {
  const s = snapshot ?? startSample(values, experiment);
  const [mag, setMag] = useState<Magnification>('×100');
  const m = MAGNIFICATIONS.find((x) => x.label === mag)!;
  const z = m.zoom;
  const hyphae = useMemo(() => buildHyphae(s.coverPct), [s.coverPct]);
  const none = s.coverPct <= 0;
  const spores = hyphae.tips.slice(0, sporeCount(s.spores, hyphae.tips.length));
  const color = moldColor(s.spores);
  const stroke = 1.2 + 0.8 * z;
  const ball = 3.2 * z + 1.5;
  const x = (v: number) => CX + v * z;
  const y = (v: number) => CY + v * z;

  return (
    <figure className="view mold-scope" aria-label="가상 현미경으로 보기">
      <figcaption>가상 현미경으로 보기</figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`가상 현미경 ${mag}: ${none ? NO_MOLD_TEXT : `균사 ${hyphae.segments.length}가닥, 포자 덩어리 ${spores.length}개`}`}
      >
        <defs>
          <clipPath id="mold-scope-clip">
            <circle cx={CX} cy={CY} r={R} />
          </clipPath>
        </defs>
        <circle cx={CX} cy={CY} r={R} fill="#f8fafc" />
        <g clipPath="url(#mold-scope-clip)" data-testid="scope-field" data-mag={mag}>
          {hyphae.segments.map((g, i) => (
            <line key={i} data-testid="hypha" x1={x(g.x1)} y1={y(g.y1)} x2={x(g.x2)} y2={y(g.y2)} stroke={color} strokeWidth={stroke} strokeLinecap="round" />
          ))}
          {spores.map((p, i) => (
            <g key={i} data-testid="spore">
              <circle cx={x(p.x)} cy={y(p.y)} r={ball} fill="#0f766e" stroke="#134e4a" strokeWidth="1" />
              <circle cx={x(p.x) - ball * 0.3} cy={y(p.y) - ball * 0.3} r={ball * 0.28} fill="#99f6e4" />
            </g>
          ))}
        </g>
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="#475569" strokeWidth="4" />
        <text data-testid="scope-mag" x={CX - R + 8} y={CY - R + 22} fontSize="16" fontWeight="700" fill="#0f172a" stroke="#f8fafc" strokeWidth="3" paintOrder="stroke">{mag}</text>
        {none && <text x={CX} y={CY + 5} textAnchor="middle" fontSize="14" fill="#0f172a">{NO_MOLD_TEXT}</text>}

        {/* 축척 막대 */}
        <line x1={CX - R + 8} y1={CY + R - 14} x2={CX - R + 8 + SCALE_BAR_PX} y2={CY + R - 14} stroke="#0f172a" strokeWidth="3" />
        <text data-testid="scope-scale" x={CX - R + 8 + SCALE_BAR_PX + 6} y={CY + R - 9} fontSize="14" fill="#0f172a" stroke="#f8fafc" strokeWidth="3" paintOrder="stroke">{m.scale}</text>

        {/* 라벨 */}
        <g fontSize="14" fill="currentColor">
          <line x1="40" y1="246" x2="62" y2="246" stroke={color} strokeWidth="3" strokeLinecap="round" />
          <text x="68" y="251">균사</text>
          <circle cx="132" cy="246" r="5" fill="#0f766e" stroke="#134e4a" strokeWidth="1" />
          <text x="142" y="251">포자</text>
        </g>
      </svg>
      <p className="view-note">{SCOPE_NOTE}</p>
      <div className="scope-zoom" role="group" aria-label="현미경 배율">
        {MAGNIFICATIONS.map((o) => (
          <button key={o.label} type="button" className={mag === o.label ? 'selected' : undefined} aria-pressed={mag === o.label} onClick={() => setMag(o.label)}>
            {o.label}
          </button>
        ))}
      </div>
    </figure>
  );
}
