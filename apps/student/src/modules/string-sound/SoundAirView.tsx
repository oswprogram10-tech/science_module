import type { StringSoundSample } from '@sci/engine-physics';
import type { ViewProps } from '../types';
import { useLoopPhase, usePrefersReducedMotion } from '../transpiration/motion';
import { startSample } from './initial';

const W = 240;
const H = 150;
const STRING_X = 22;
const AIR_X0 = 44;
const AIR_X1 = 188;
const COL_GAP = 4.5;
const ROWS = 5;
const ROW_GAP = 16;
const AIR_Y0 = 40;
/** 파동이 퍼지는 빠르기(그림 단위/초). 밀집 간격 λ(440번이면 24)와 같게 두면 440번일 때 한 점이 초당 1바퀴 오간다. */
const WAVE_SPEED = 24;
/** λ = LAMBDA_K / freq: 밀집 간격은 1초 동안 떨린 횟수에 반비례 */
const LAMBDA_K = 24 * 440;
/** 알갱이가 앞뒤로 움직이는 폭(그림 단위): 떨림의 크기 A에 비례. A = 1 이면 3.5 */
export const MOVE_PX = 3.5;

/** 밀집 간격(그림 단위): 1초 동안 떨린 횟수에 반비례 */
export const lambdaOf = (freq: number) => LAMBDA_K / freq;
/** 알갱이가 앞뒤로 움직이는 폭(그림 단위) */
export const moveOf = (amplitude: number) => MOVE_PX * amplitude;

/** 알갱이의 x. phase는 줄의 떨림이 한 바퀴 돈 횟수(0, 1, 2 …) */
export function airX(x0: number, freq: number, amplitude: number, phase: number): number {
  return x0 + moveOf(amplitude) * Math.sin(2 * Math.PI * (phase - (x0 - STRING_X) / lambdaOf(freq)));
}

/** 촘촘한 곳(밀집)의 가운데 x들: 줄에서 λ 간격. 알갱이가 가장 몰리는 자리는 u = λ(phase − k)이다. */
export function denseCenters(freq: number, phase: number): number[] {
  const lam = lambdaOf(freq);
  const lo = AIR_X0 - STRING_X;
  const hi = AIR_X1 - STRING_X;
  const out: number[] = [];
  for (let k = Math.ceil(phase - hi / lam); k <= Math.floor(phase - lo / lam); k++) out.push(STRING_X + lam * (phase - k));
  return out.sort((a, b) => a - b);
}

export const COLS = Array.from({ length: Math.floor((AIR_X1 - AIR_X0) / COL_GAP) + 1 }, (_, i) => AIR_X0 + i * COL_GAP);

export function SoundAirView({ trial, snapshot, values, playhead }: ViewProps<StringSoundSample>) {
  const reduced = usePrefersReducedMotion();
  const ran = trial !== undefined;
  const s = snapshot ?? startSample(values);
  const last = trial ? (trial.samples as StringSoundSample[]).at(-1)!.t : 0;
  // 실험 중(플레이헤드가 끝에 닿기 전)에만 움직인다. 화면이 사라지면 useLoopPhase가 바로 취소한다.
  const running = ran && !reduced && playhead < last - 1e-9;
  // 줄이 한 바퀴 떨 때 파동은 1 / λ만큼 퍼진다. 파동이 퍼지는 빠르기가 같으므로 한 점의 바퀴 수는 freq에 비례한다(440번이면 초당 1바퀴).
  const loop = useLoopPhase(running, WAVE_SPEED / lambdaOf(s.freq));
  // 멈춘 화면(움직임 줄이기, 재생이 끝난 뒤)은 플레이헤드 시각의 위상으로 그린다.
  const still = (s.freq * s.t) / 1000;
  const phase = running ? loop : still;
  // 실험 전에는 알갱이가 가만히 고르게 놓여 있다.
  const amp = ran ? s.amplitude : 0;
  const freq = s.freq;

  return (
    <figure className="view air-view" aria-label="공기 알갱이 보기">
      <figcaption>공기 알갱이 보기</figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={ran ? '줄에서 귀 쪽으로 공기 알갱이가 촘촘해졌다 성겨졌다 하며 떨림을 전하는 그림' : '줄과 공기 알갱이와 귀를 그린 그림. 실험하면 알갱이가 떨리며 떨림을 전해요.'}
      >
        {/* 줄 */}
        <line x1={STRING_X} y1="26" x2={STRING_X} y2="128" stroke="#7c5a2a" strokeWidth="4" strokeLinecap="round" />
        <text x={STRING_X} y="144" textAnchor="middle" fontSize="14" fill="currentColor">줄</text>

        {/* 공기 알갱이 */}
        {/* 촘촘한 곳(밀집) 표시: 실험을 한 뒤에는 멈춘 화면에서도 언제나 그린다. 간격은 1/freq에 비례하고 진하기는 A에 비례한다. */}
        {ran && (
          <g data-testid="dense-bands" fill="#1d4ed8">
            {denseCenters(freq, phase).map((cx) => (
              <rect key={cx.toFixed(2)} data-testid="dense-band" x={(cx - lambdaOf(freq) / 6).toFixed(2)} y={AIR_Y0 - 9} width={(lambdaOf(freq) / 3).toFixed(2)} height={(ROWS - 1) * ROW_GAP + 18} rx="3" fillOpacity={(0.08 + 0.12 * amp).toFixed(3)} />
            ))}
          </g>
        )}
        <g data-testid="air" data-amp={amp} data-freq={freq} data-running={running ? 'true' : 'false'} fill="#3b82f6" fillOpacity="0.85">
          {Array.from({ length: ROWS }, (_, r) =>
            COLS.map((x0, c) => <circle key={`${r}:${c}`} cx={airX(x0 + (r % 2) * 1.5, freq, amp, phase).toFixed(2)} cy={AIR_Y0 + r * ROW_GAP} r="1.8" />),
          )}
        </g>
        <text x={(AIR_X0 + AIR_X1) / 2} y="20" textAnchor="middle" fontSize="14" fontWeight="700" fill="currentColor">공기</text>

        {/* 귀 */}
        <g data-testid="ear" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M206 54 C206 34 232 34 232 58 C232 76 218 80 218 94 C218 108 200 112 200 98" />
          <path d="M214 56 C214 48 224 48 224 58 C224 66 216 68 216 76" />
        </g>
        <text x="216" y="144" textAnchor="middle" fontSize="14" fill="currentColor">귀</text>
      </svg>
      <p className="view-note">줄의 떨림이 공기를 떨리게 하고, 그 떨림이 귀에 전해져 소리가 들려요.</p>
    </figure>
  );
}
