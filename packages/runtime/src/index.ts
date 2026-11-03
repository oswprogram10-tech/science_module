import type { DissolutionOutput, DissolutionResult, DissolutionSample } from '@sci/engine-matter';
import type { Prediction, TrialAnalysis, TrialLike, Values } from '@sci/gateway';

export const PLAYBACK_SECONDS = 8;

export interface Trial {
  id: string;
  index: number;
  values: Values;
  ivKey: string | null;
  prediction: Prediction | null;
  samples: DissolutionSample[];
  result: DissolutionResult;
  analysis: TrialAnalysis;
}

export interface RuntimeState {
  values: Values;
  ivKey: string | null;
  prediction: Prediction | null;
  trials: Trial[];
  /** 화면과 센서가 보여 주는 시행 id. */
  active: string | null;
  playing: boolean;
  /** 시뮬레이션 시간(초). */
  playhead: number;
}

export type SimulateFn = (values: Values) => DissolutionOutput;
export type AnalyzeFn = (prev: Trial | undefined, current: TrialLike) => TrialAnalysis;

export interface RuntimeOptions {
  defaults: Values;
  playbackSeconds?: number;
  /** 주입 가능한 시계(ms). tickNow가 사용한다. */
  clock?: () => number;
}

/** 시행의 전체 sim 시간(초). */
export function trialDuration(trial: Trial): number {
  const last = trial.samples[trial.samples.length - 1];
  return last ? last.t : 0;
}

/**
 * 샘플 사이를 선형 보간한 스냅샷. 모든 화면과 센서는 이 값만 읽는다.
 */
export function sampleAt(trial: Trial, t: number): DissolutionSample {
  const s = trial.samples;
  const first = s[0]!;
  const last = s[s.length - 1]!;
  if (t <= first.t) return { ...first };
  if (t >= last.t) return { ...last };
  let lo = 0;
  let hi = s.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (s[mid]!.t <= t) lo = mid;
    else hi = mid;
  }
  const a = s[lo]!;
  const b = s[hi]!;
  const k = (t - a.t) / (b.t - a.t);
  const lerp = (x: number, y: number) => x + (y - x) * k;
  // 넣은 양은 계단식이다: 앞 숟가락이 다 녹는 순간 다음 숟가락이 들어간다.
  const dissolvedRaw = lerp(a.dissolvedG, b.dissolvedG);
  const addedG = dissolvedRaw >= a.addedG - 1e-9 ? b.addedG : a.addedG;
  const dissolvedG = Math.min(dissolvedRaw, addedG);
  return { t, addedG, dissolvedG, undissolvedG: addedG - dissolvedG };
}

export function createRuntime(options: RuntimeOptions) {
  const playback = options.playbackSeconds ?? PLAYBACK_SECONDS;
  const clock = options.clock ?? (() => Date.now());
  const initial = (): RuntimeState => ({
    values: { ...options.defaults },
    ivKey: null,
    prediction: null,
    trials: [],
    active: null,
    playing: false,
    playhead: 0,
  });

  let state = initial();
  let lastClock: number | null = null;
  const listeners = new Set<() => void>();

  const set = (patch: Partial<RuntimeState>) => {
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
  };
  const activeTrial = () => state.trials.find((t) => t.id === state.active);

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: (): RuntimeState => state,

    setValue(key: string, value: string | number) {
      if (state.playing) return;
      set({ values: { ...state.values, [key]: value } });
    },
    setIV(key: string | null) {
      if (state.playing) return;
      set({ ivKey: key });
    },
    setPrediction(p: Prediction | null) {
      if (state.playing) return;
      set({ prediction: p });
    },

    run(simulateFn: SimulateFn, analyzeFn: AnalyzeFn): Trial | null {
      if (state.playing) return null;
      const values = { ...state.values };
      const { samples, result } = simulateFn(values);
      const prev = state.trials[state.trials.length - 1];
      const analysis = analyzeFn(prev, { values, ivKey: state.ivKey });
      const index = state.trials.length + 1;
      const trial: Trial = {
        id: `trial-${index}`,
        index,
        values,
        ivKey: state.ivKey,
        prediction: state.prediction,
        samples,
        result,
        analysis,
      };
      const duration = trialDuration(trial);
      lastClock = null;
      set({
        trials: [...state.trials, trial],
        active: trial.id,
        playing: duration > 0,
        playhead: 0,
        prediction: null, // 다음 시행에 새 예측을 요구한다.
      });
      return trial;
    },

    /** 실제 경과 시간(ms)만큼 재생을 진행한다. 전체 sim 시간이 실제 8초에 대응한다. */
    tick(realDtMs: number) {
      if (!state.playing) return;
      const trial = activeTrial();
      if (!trial) return;
      const duration = trialDuration(trial);
      const next = state.playhead + (realDtMs / 1000) * (duration / playback);
      if (next >= duration) set({ playhead: duration, playing: false });
      else set({ playhead: next });
    },

    /** 주입된 시계로 경과 시간을 재서 tick을 호출한다. */
    tickNow() {
      const now = clock();
      if (lastClock !== null) this.tick(now - lastClock);
      lastClock = state.playing ? now : null;
    },

    /** 재생이 끝난 뒤(또는 멈춘 상태)에만 플레이헤드를 옮길 수 있다. */
    setPlayhead(t: number) {
      if (state.playing) return;
      const trial = activeTrial();
      if (!trial) return;
      const clamped = Math.min(Math.max(t, 0), trialDuration(trial));
      if (clamped !== state.playhead) set({ playhead: clamped });
    },

    reset() {
      lastClock = null;
      set(initial());
    },
  };
}

export type Runtime = ReturnType<typeof createRuntime>;
