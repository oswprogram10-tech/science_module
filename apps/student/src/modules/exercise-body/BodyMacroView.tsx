import type { BodySample } from '@sci/engine-life';
import type { ViewProps } from '../types';
import { KIND_TEXT, PHASE_TEXT, WRIST_TEXT, bodyNote, kindOf, phaseAt, startSample, wristOf } from './initial';

// viewBox 폭 240은 1280 px 화면에서 이 칸의 실제 폭(약 230 px)과 거의 같다. 글자 14는 화면에서도 약 13 px 이상이다.
const W = 240;
const H = 262;

type Pose = ReturnType<typeof poseOf>;

/** 가상 친구의 관절 자리(정면). 팔은 viewBox 기준 왼쪽(친구의 오른손)과 오른쪽(친구의 왼손)이다. */
function poseOf(kind: 'sit' | 'walk' | 'run') {
  switch (kind) {
    case 'sit':
      return {
        hip: [120, 150] as const,
        // 앉은 모습: 무릎을 앞으로 굽히고 발은 아래로
        legs: [[[98, 166], [98, 206]], [[142, 166], [142, 206]]] as const,
        // [팔꿈치, 손]. 손은 무릎 위에 놓는다.
        armL: [[96, 112], [100, 154]] as const,
        armR: [[144, 112], [140, 154]] as const,
      };
    case 'walk':
      return {
        hip: [120, 148] as const,
        legs: [[[110, 178], [96, 208]], [[132, 178], [146, 208]]] as const,
        armL: [[100, 112], [90, 138]] as const,
        armR: [[140, 112], [152, 138]] as const,
      };
    case 'run':
      return {
        hip: [120, 148] as const,
        legs: [[[100, 170], [90, 200]], [[146, 164], [162, 188]]] as const,
        armL: [[96, 108], [104, 84]] as const,
        armR: [[144, 108], [136, 132]] as const,
      };
  }
}

/** 땀방울 수: 운동 중에만, 강도가 셀수록 많다. */
export const sweatCount = (effort: number) => (effort <= 0 ? 0 : Math.min(3, Math.ceil(effort * 3)));

const SWEAT = [
  [96, 46],
  [148, 50],
  [140, 30],
] as const;

export function BodyMacroView({ experiment, snapshot, values }: ViewProps<BodySample>) {
  const s = snapshot ?? startSample(values, experiment);
  const kind = kindOf(values);
  const wrist = wristOf(values);
  const phase = phaseAt(s.t, values, experiment);
  // 앉아 있기는 운동이 아니므로 언제나 "쉬는 중"이다.
  const band = kind === 'sit' ? PHASE_TEXT.rest : PHASE_TEXT[phase];
  const pose: Pose = poseOf(kind);
  const note = bodyNote(s);
  const sweat = sweatCount(s.effort);
  // 맥박을 재는 손목: 친구의 왼손은 그림의 오른쪽에 있다(정면).
  const pulseHand = (wrist === 'left' ? pose.armR : pose.armL)[1];
  const [hx, hy] = pose.hip;
  const limb = { stroke: 'currentColor', strokeWidth: 5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };

  return (
    <figure className="view body-macro" aria-label="눈으로 보기">
      <figcaption>눈으로 보기</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`가상 친구가 ${KIND_TEXT[kind]}: ${band}, ${WRIST_TEXT[wrist]}에서 맥박을 재요, ${note}`}>
        {/* 상태 띠 */}
        <rect data-testid="phase-band" data-phase={kind === 'sit' ? 'rest' : phase} x="4" y="4" width="232" height="26" rx="13" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <text x={W / 2} y="22" textAnchor="middle" fontSize="14" fontWeight="700" fill="currentColor">{band}</text>

        {/* 앉기: 의자 */}
        {kind === 'sit' && (
          <g data-testid="chair" stroke="#8a5a14" strokeWidth="4" strokeLinecap="round" fill="none">
            <line x1="76" y1="156" x2="164" y2="156" />
            <line x1="164" y1="156" x2="164" y2="212" />
            <line x1="76" y1="156" x2="76" y2="212" />
            <line x1="164" y1="108" x2="164" y2="156" />
          </g>
        )}

        {/* 가상 친구 */}
        <g data-testid="friend" data-pose={kind}>
          <circle cx="120" cy="62" r="15" fill="#fde7c8" stroke="currentColor" strokeWidth="2.5" />
          <path {...limb} d={`M120 77 L120 ${hy}`} />
          <path {...limb} d={`M120 90 L${pose.armL[0][0]} ${pose.armL[0][1]} L${pose.armL[1][0]} ${pose.armL[1][1]}`} />
          <path {...limb} d={`M120 90 L${pose.armR[0][0]} ${pose.armR[0][1]} L${pose.armR[1][0]} ${pose.armR[1][1]}`} />
          <path {...limb} d={`M${hx} ${hy} L${pose.legs[0][0][0]} ${pose.legs[0][0][1]} L${pose.legs[0][1][0]} ${pose.legs[0][1][1]}`} />
          <path {...limb} d={`M${hx} ${hy} L${pose.legs[1][0][0]} ${pose.legs[1][0][1]} L${pose.legs[1][1][0]} ${pose.legs[1][1][1]}`} />
        </g>

        {/* 땀방울: 운동 중에만 */}
        {SWEAT.slice(0, sweat).map(([x, y]) => (
          <path key={`${x}-${y}`} data-testid="sweat" d={`M${x} ${y - 7} q-6 8 0 12 q6 -4 0 -12z`} fill="#3b82f6" stroke="#1d4ed8" strokeWidth="1" />
        ))}

        {/* 맥박을 재는 손목: 손가락을 댄 모양(고리 + 손가락 두 개)과 글자 */}
        <g data-testid="pulse-wrist" data-wrist={wrist}>
          <circle cx={pulseHand[0]} cy={pulseHand[1]} r="10" fill="none" stroke="#dc2626" strokeWidth="3" />
          <path d={`M${pulseHand[0] - 5} ${pulseHand[1] + 14} L${pulseHand[0] - 2} ${pulseHand[1] + 3} M${pulseHand[0] + 3} ${pulseHand[1] + 14} L${pulseHand[0] + 2} ${pulseHand[1] + 3}`} stroke="#dc2626" strokeWidth="4" strokeLinecap="round" />
        </g>

        {/* 가상 친구 라벨과 손목 글자 */}
        <rect x="68" y="222" width="104" height="22" rx="11" fill="#fef3c7" stroke="#a15c00" strokeWidth="1.5" />
        <text data-testid="friend-label" x={W / 2} y="238" textAnchor="middle" fontSize="14" fontWeight="700" fill="#1d2733">가상 친구</text>
        <text x={W / 2} y="258" textAnchor="middle" fontSize="14" fill="currentColor">{KIND_TEXT[kind]} · {WRIST_TEXT[wrist]}</text>
      </svg>
      <p className="view-note">{note}</p>
    </figure>
  );
}
