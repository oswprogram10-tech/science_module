import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { simulateDissolution, type DissolutionParams } from '@sci/engine-matter';
import {
  analyzeTrial,
  canRun,
  observedOutcome,
  structuralFeedback,
  type Prediction,
} from '@sci/gateway';
import { createRuntime, sampleAt, type Trial } from '@sci/runtime';
import { MockScaleDriver, MockTemperatureDriver } from '@sci/sensors';
import { selectProbe } from '@sci/tutor';
import { MemoryRecorder, buildStatement, toExtensions } from '@sci/xapi';
import type { Experiment } from '@sci/schema';
import { loadManifest } from './manifest';
import { DesignPanel } from './components/DesignPanel';
import { BeakerView } from './components/BeakerView';
import { ParticleView } from './components/ParticleView';
import { GraphView } from './components/GraphView';
import { SensorBar } from './components/SensorBar';
import { ResultsTable } from './components/ResultsTable';

export function App() {
  const loaded = useMemo(loadManifest, []);
  if (!loaded.ok) {
    return (
      <main className="error-screen" role="alert">
        <h1>콘텐츠를 불러오지 못했어요</h1>
        <p>매니페스트 검증에 실패했습니다.</p>
        <ul>
          {loaded.issues.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      </main>
    );
  }
  return <Lab title={loaded.manifest.title} experiment={loaded.experiment} />;
}

const ACTOR_ID = 'anon-student-001';
const activityId = (expId: string) => `https://sci-bridge.local/activities/g5-solution/${expId}`;

function Lab({ title, experiment }: { title: string; experiment: Experiment }) {
  const defaults = useMemo(
    () => Object.fromEntries(experiment.variables.map((v) => [v.key, v.default])),
    [experiment],
  );
  const runtime = useMemo(
    () =>
      createRuntime({
        defaults,
        clock: () => performance.now(),
        canRun: (s) => canRun(s, experiment.gateway).ok,
      }),
    [defaults, experiment],
  );
  const [runError, setRunError] = useState<string | null>(null);
  const recorder = useMemo(() => new MemoryRecorder(), []);
  const state = useSyncExternalStore(runtime.subscribe, runtime.getSnapshot);

  const labels = useMemo(
    () => Object.fromEntries(experiment.variables.map((v) => [v.key, v.label])),
    [experiment],
  );

  // 재생 루프: requestAnimationFrame으로 runtime.tickNow 호출
  useEffect(() => {
    if (!state.playing) return;
    let id = requestAnimationFrame(function frame() {
      runtime.tickNow();
      id = requestAnimationFrame(frame);
    });
    return () => cancelAnimationFrame(id);
  }, [state.playing, runtime]);

  const active: Trial | undefined = state.trials.find((t) => t.id === state.active);
  const snapshot = active ? sampleAt(active, state.playhead) : null;
  const prevOfActive = active ? state.trials[active.index - 2] : undefined;

  const gate = canRun({ ivKey: state.ivKey, prediction: state.prediction }, experiment.gateway);

  const onRun = () => {
    if (!gate.ok || state.playing) return;
    try {
      const snap = runtime.getSnapshot();
      const emit = (verb: string, result?: Record<string, unknown>) => {
        const stmt = buildStatement({ actorId: ACTOR_ID, verb, objectId: activityId(experiment.id), result });
        recorder.record(stmt);
        console.debug('[xAPI]', stmt);
      };
      const trial = runtime.run(
        (values) =>
          simulateDissolution(values as unknown as DissolutionParams, {
            spoonGrams: experiment.spoonGrams,
          }),
        (prev, cur) => analyzeTrial(prev, cur, labels),
      );
      if (trial) {
        for (const v of experiment.variables) {
          if (v.key !== snap.ivKey) {
            emit('controlled-variable', {
              extensions: toExtensions({ variable: v.key, value: snap.values[v.key] }),
            });
          }
        }
        emit('predicted', {
          ...(snap.prediction ? { response: snap.prediction } : {}),
          extensions: toExtensions({ iv: snap.ivKey }),
        });
        emit('experimented', {
          extensions: toExtensions({ trial: trial.index, kind: trial.analysis.kind, ...trial.result }),
        });
        setRunError(null);
      }
    } catch (e) {
      console.error(e);
      setRunError('실험을 실행하지 못했어요. 선생님께 알려 주세요.');
    }
  };

  // 센서: 모든 값은 sampleAt 스냅샷에서만 읽는다.
  const tempSource = Number(state.trials.length ? (active?.values.waterTempC ?? 20) : state.values.waterTempC);
  const waterMl = Number(active ? active.values.waterMl : state.values.waterMl);
  const scaleSource = waterMl + (snapshot?.addedG ?? 0);
  const sourceRef = useRef({ tempSource, scaleSource });
  sourceRef.current = { tempSource, scaleSource };
  const tempDriver = useMemo(() => new MockTemperatureDriver(() => sourceRef.current.tempSource, 20250101), []);
  const scaleDriver = useMemo(() => new MockScaleDriver(() => sourceRef.current.scaleSource, 20250102), []);
  const scaleKey = Math.round(scaleSource * 100);
  // 원천 값이 바뀔 때만 다시 읽어 숫자가 매 프레임 깜빡이지 않게 한다.
  /* eslint-disable react-hooks/exhaustive-deps */
  const tempReading = useMemo(() => tempDriver.read(), [tempDriver, tempSource]);
  const scaleReading = useMemo(() => scaleDriver.read(), [scaleDriver, scaleKey]);
  /* eslint-enable react-hooks/exhaustive-deps */

  // 피드백·튜터: 재생이 끝난 뒤에 보여 준다.
  const shown = state.playing ? state.trials.slice(0, -1) : state.trials;
  const last = shown[shown.length - 1];
  const lastPrev = last ? shown[last.index - 2] : undefined;
  const feedback = last ? structuralFeedback(last.analysis, labels, last.ivKey) : null;
  let observed: Prediction | null = null;
  if (last && lastPrev && last.analysis.kind === 'fair-test') {
    observed = observedOutcome(lastPrev.result.dissolvedG, last.result.dissolvedG, experiment.spoonGrams);
  }
  const probe = selectProbe(
    {
      lastAnalysis: last?.analysis,
      ivKey: last ? last.ivKey : state.ivKey,
      labels,
      prediction: last?.prediction ?? null,
      observed,
    },
    experiment.tutor.probes,
    { forbiddenAnswers: experiment.tutor.forbiddenAnswers, limits: experiment.limits },
  );

  return (
    <div className="app">
      <header className="top">
        <h1>{title}</h1>
        <p className="question">탐구 질문: {experiment.question}</p>
      </header>

      <main className="layout">
        <DesignPanel
          experiment={experiment}
          state={state}
          gate={gate}
          onValue={runtime.setValue}
          onIV={runtime.setIV}
          onPrediction={runtime.setPrediction}
          onRun={onRun}
          onReset={runtime.reset}
        />

        <section className="center" aria-label="실험 화면">
          <div className="views">
            <BeakerView
              trial={active}
              snapshot={snapshot}
              waterMl={waterMl}
              spoonGrams={experiment.spoonGrams}
              playhead={state.playhead}
            />
            <ParticleView snapshot={snapshot} />
            <GraphView
              trial={active}
              prev={prevOfActive}
              playhead={state.playhead}
              playing={state.playing}
              onPlayhead={runtime.setPlayhead}
              describedBy="results-table"
            />
          </div>
          <SensorBar temperature={tempReading} scale={scaleReading} />
          <div className="boxes">
            <div className="box feedback" aria-live="polite">
              <h2>피드백</h2>
              <p>{runError ?? feedback ?? '비교할 내용이 생기면 여기에 알려 줄게요.'}</p>
            </div>
            <div className="box tutor" aria-live="polite">
              <h2>생각해 볼까요?</h2>
              <p>{probe}</p>
            </div>
          </div>
          <ResultsTable experiment={experiment} trials={state.trials} playingId={state.playing ? state.active : null} />
        </section>
      </main>
    </div>
  );
}
