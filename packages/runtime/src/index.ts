import type { Prediction, TrialAnalysis, TrialLike, Values } from '@sci/gateway';

export const PLAYBACK_SECONDS = 8;
/** tickNow 한 번에 진행할 수 있는 최대 실제 경과 시간(ms). 백그라운드 탭에서 돌아와도 재생이 한 번에 끝나지 않게 한다. */
export const MAX_TICK_MS = 100;

export interface Trial<S extends { t: number } = { t: number }, R = unknown> {
  id: string;
  index: number;
  values: Values;
  ivKey: string | null;
  prediction: Prediction | null;
  samples: S[];
  result: R;
  analysis: TrialAnalysis;
}

export interface RuntimeState<S extends { t: number } = { t: number }, R = unknown> {
  values: Values;
  ivKey: string | null;
  prediction: Prediction | null;
  trials: Trial<S, R>[];
  /** 화면과 센서가 보여 주는 시행 id. */
  active: string | null;
  playing: boolean;
  /** 시뮬레이션 시간(초). */
  playhead: number;
}

export type SimulateFn<S extends { t: number }, R> = (values: Values) => { samples: S[]; result: R };
export type AnalyzeFn<S extends { t: number }, R> = (
  prev: Trial<S, R> | undefined,
  current: TrialLike,
) => TrialAnalysis;

export interface RuntimeOptions<S extends { t: number } = { t: number }, R = unknown> {
  defaults: Values;
  playbackSeconds?: number;
  /** 주입 가능한 시계(ms). tickNow가 사용한다. */
  clock?: () => number;
  /** 실행 가능 여부. false를 돌려주면 run()은 아무것도 하지 않는다. */
  canRun?: (state: RuntimeState<S, R>) => boolean;
}

/** 시행의 전체 sim 시간(초). */
export function trialDuration<S extends { t: number }>(trial: { samples: S[] }): number {
  const last = trial.samples[trial.samples.length - 1];
  return last ? last.t : 0;
}

export type InterpolateFn<S extends { t: number }> = (a: S, b: S, k: number) => S;

/** 기본 보간: 숫자 필드를 모두 선형 보간하고, 숫자가 아닌 필드는 앞 샘플의 값을 쓴다. */
export function lerpSample<S extends { t: number }>(a: S, b: S, k: number): S {
  const out: Record<string, unknown> = { ...a };
  for (const key of Object.keys(a)) {
    const x = (a as Record<string, unknown>)[key];
    const y = (b as Record<string, unknown>)[key];
    if (typeof x === 'number' && typeof y === 'number') out[key] = x + (y - x) * k;
  }
  return out as S;
}

/**
 * 샘플 사이를 보간한 스냅샷. 모든 화면과 센서는 이 값만 읽는다.
 * interpolate를 생략하면 숫자 필드를 모두 선형 보간한다.
 */
export function sampleAt<S extends { t: number }>(
  trial: { samples: S[] },
  t: number,
  interpolate: InterpolateFn<S> = lerpSample,
): S {
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
  return { ...interpolate(a, b, k), t };
}

export function createRuntime<S extends { t: number }, R>(options: RuntimeOptions<S, R>) {
  const playback = options.playbackSeconds ?? PLAYBACK_SECONDS;
  const clock = options.clock ?? (() => Date.now());
  const initial = (): RuntimeState<S, R> => ({
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

  const set = (patch: Partial<RuntimeState<S, R>>) => {
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
    getSnapshot: (): RuntimeState<S, R> => state,

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

    run(simulateFn: SimulateFn<S, R>, analyzeFn: AnalyzeFn<S, R>): Trial<S, R> | null {
      if (state.playing) return null;
      if (options.canRun && !options.canRun(state)) return null;
      const values = { ...state.values };
      const { samples, result } = simulateFn(values);
      const prev = state.trials[state.trials.length - 1];
      const analysis = analyzeFn(prev, { values, ivKey: state.ivKey });
      const index = state.trials.length + 1;
      const trial: Trial<S, R> = {
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
      if (lastClock !== null) this.tick(Math.min(Math.max(now - lastClock, 0), MAX_TICK_MS));
      lastClock = state.playing ? now : null;
    },

    /** 재생이 끝난 뒤(또는 멈춘 상태)에만 플레이헤드를 옮길 수 있다. */
    setPlayhead(t: number) {
      if (state.playing || !Number.isFinite(t)) return;
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

export type Runtime<S extends { t: number }, R> = ReturnType<typeof createRuntime<S, R>>;
