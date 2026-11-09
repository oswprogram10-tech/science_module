import { chancePerContact, type SpreadSample } from '@sci/engine-ssi';
import type { ViewProps } from '../types';
import { CONTACT_NOTE, toParams } from './initial';
import { PersonDot } from './ClassroomView';

export const W = 240;
export const H = 236;
const CX = 120;
const CY = 96;
const RING = 76;
/** 선 굵기 = 한 번 만날 때 옮을 확률 × 이 값. 습관 없이 0.08이면 4. */
export const WIDTH_PER_CHANCE = 50;
/** 실험 전에는 습관에 따른 굵기 차이(결과)를 드러내지 않고 모두 같은 굵기로 그린다. */
export const NEUTRAL_WIDTH = 2.5;

export const lineWidth = (chance: number) => WIDTH_PER_CHANCE * chance;

/** 방패 아이콘. 손 씻기는 물방울, 마스크는 가로 줄 두 개를 그려 색 외의 무늬로도 구분한다. */
function Shield({ kind, x, y, testid }: { kind: 'wash' | 'mask'; x: number; y: number; testid?: string }) {
  return (
    <g data-testid={testid} data-kind={kind} transform={`translate(${x} ${y})`}>
      <path className={kind === 'wash' ? 'shield-wash' : 'shield-mask'} d="M0 -9 L8 -6 L8 1 Q8 7 0 10 Q-8 7 -8 1 L-8 -6 Z" />
      {kind === 'wash' ? (
        <path d="M0 -4 Q4 1 0 4 Q-4 1 0 -4 Z" fill="#fff" />
      ) : (
        <path d="M-4 -1.5 H4 M-4 2.5 H4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      )}
    </g>
  );
}

export function ContactView({ trial, values }: ViewProps<SpreadSample>) {
  const p = toParams(values);
  const ran = trial !== undefined;
  const chance = chancePerContact(p);
  const width = ran ? lineWidth(chance) : NEUTRAL_WIDTH;
  const n = p.contacts;
  const ends = Array.from({ length: n }, (_, i) => {
    const a = (-90 + (360 * i) / n) * (Math.PI / 180);
    return { x: CX + RING * Math.cos(a), y: CY + RING * Math.sin(a), ux: Math.cos(a), uy: Math.sin(a) };
  });
  const legendY = 218;
  return (
    <figure className="view spread-contact" aria-label="옮겨 가는 길 보기">
      <figcaption>옮겨 가는 길 보기</figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`아픈 친구 한 명과 하루에 가까이 만나는 친구 ${n}명을 선으로 이은 그림. 손 씻기 ${p.wash === 'often' ? '자주 씻음' : '잘 안 씻음'}, 마스크 ${p.mask === 'on' ? '씀' : '안 씀'}. ${CONTACT_NOTE}`}
      >
        <g data-testid="contacts" data-count={n} data-ran={ran ? 'true' : 'false'}>
          {ends.map((e, i) => (
            <line key={i} data-testid="contact-line" data-width={width.toFixed(2)} x1={CX} y1={CY} x2={e.x} y2={e.y} stroke="currentColor" strokeWidth={width} strokeLinecap="round" />
          ))}
        </g>
        {ends.map((e, i) => (
          <PersonDot key={i} testid="contact-friend" state="healthy" cx={e.x} cy={e.y} r={8} />
        ))}
        <PersonDot testid="contact-sick" state="sick" cx={CX} cy={CY} r={12} />
        {/* 지키는 습관은 선 위의 방패로 나타낸다. 손 씻기는 선의 안쪽, 마스크는 바깥쪽에 둔다. */}
        {p.wash === 'often' && ends.map((e, i) => <Shield key={`w${i}`} testid="shield-wash" kind="wash" x={CX + (e.x - CX) * 0.42} y={CY + (e.y - CY) * 0.42} />)}
        {p.mask === 'on' && ends.map((e, i) => <Shield key={`m${i}`} testid="shield-mask" kind="mask" x={CX + (e.x - CX) * 0.68} y={CY + (e.y - CY) * 0.68} />)}
        <g data-testid="contact-legend" fontSize="14" fill="currentColor">
          <line x1="6" y1={legendY} x2="30" y2={legendY} stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          <text x="34" y={legendY + 5} fontSize="14" fill="currentColor">만남</text>
          <Shield kind="wash" x={90} y={legendY} />
          <text x="102" y={legendY + 5} fontSize="14" fill="currentColor">손 씻기</text>
          <Shield kind="mask" x={166} y={legendY} />
          <text x="178" y={legendY + 5} fontSize="14" fill="currentColor">마스크</text>
        </g>
      </svg>
      <p className="view-note" data-testid="contact-note">{CONTACT_NOTE}</p>
    </figure>
  );
}
