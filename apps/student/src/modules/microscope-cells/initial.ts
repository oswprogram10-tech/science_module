import {
  MC_FOCUS,
  MC_LABELS,
  MC_POWERS,
  MC_SAMPLES,
  MC_STAINS,
  simulateMicroscope,
  type McFocus,
  type McLabel,
  type McPower,
  type McSample,
  type McStain,
  type MicroscopeParams,
  type MicroscopeResult,
  type MicroscopeSample,
} from '@sci/engine-life';
import type { Values } from '@sci/gateway';

const pick = <T extends string>(list: readonly T[], v: unknown, fallback: T): T => ((list as readonly string[]).includes(String(v)) ? (v as T) : fallback);

export const toParams = (values: Values): MicroscopeParams => ({
  power: ((MC_POWERS as readonly number[]).includes(Number(values.power)) ? Number(values.power) : 40) as McPower,
  focus: pick<McFocus>(MC_FOCUS, values.focus, 'off'),
  stain: pick<McStain>(MC_STAINS, values.stain, 'none'),
  sample: pick<McSample>(MC_SAMPLES, values.sample, 'onion'),
  slideLabel: pick<McLabel>(MC_LABELS, values.slideLabel, 'yellow'),
});

/** 고른 조건 그대로 계산한 샘플과 결과 */
export const microscopeOutput = (values: Values) => simulateMicroscope(toParams(values));

/** 실험 전(스냅샷이 없을 때) 화면이 쓰는 t = 0 의 샘플 */
export const startSample = (values: Values): MicroscopeSample => microscopeOutput(values).samples[0]!;

export const microscopeResult = (values: Values): MicroscopeResult => microscopeOutput(values).result;

export const POWER_TEXT: Record<McPower, string> = { 40: '40배', 100: '100배', 400: '400배' };
export const FOCUS_TEXT: Record<McFocus, string> = { off: '초점을 맞추지 않음', on: '초점을 맞춤' };
export const STAIN_TEXT: Record<McStain, string> = { none: '염색하지 않음', iodine: '아이오딘 용액으로 염색함' };
export const SAMPLE_TEXT: Record<McSample, string> = { onion: '양파 표피', cheek: '입안 안쪽 표피' };
export const LABEL_TEXT: Record<McLabel, string> = { yellow: '노란색', green: '초록색' };

/** 결과표와 안내 문구의 칸 길이: 칸이 보이지 않으면(NaN) "—" */
export const sizeText = (size: number): string => (Number.isFinite(size) ? String(Math.round(size)) : '—');

/** 눈으로 보기 아래 문구 */
export const microscopeNote = (s: Pick<MicroscopeSample, 't' | 'size'>, r: MicroscopeResult) =>
  `${s.t.toFixed(1)}초 · 칸 하나의 길이 ${Number.isFinite(s.size) ? s.size.toFixed(1) : '—'}mm · 보인 것: ${r.seen}`;
export const MICROSCOPE_NOTE_EMPTY = '실험하면 둥근 시야에 보이는 모습이 나타나요.';

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
