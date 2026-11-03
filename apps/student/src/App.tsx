import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
  analyzeTrial,
  canRun,
  observedOutcome,
  structuralFeedback,
  type Prediction,
} from '@sci/gateway';
import { createRuntime, sampleAt, type Trial } from '@sci/runtime';
import { selectProbe } from '@sci/tutor';
import { MemoryRecorder, buildStatement, toExtensions } from '@sci/xapi';
import type { VariableExperiment } from '@sci/schema';
import { ClassifyLab } from './modules/indicator-classify/ClassifyLab';
import { UNITS, parseRoute, unitHash, type UnitEntry } from './units';
import type { AnyModule } from './modules/types';
import { DesignPanel } from './components/DesignPanel';
import { GraphView } from './components/GraphView';
import { SensorBar } from './components/SensorBar';
import { ResultsTable } from './components/ResultsTable';
import { UnitList } from './components/UnitList';

const subscribeHash = (cb: () => void) => {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
};
const getHash = () => window.location.hash;

export function App() {
  const hash = useSyncExternalStore(subscribeHash, getHash);
  const route = parseRoute(hash);
  const unit =
    route.page === 'unit' ? UNITS.find((u): u is Extract<UnitEntry, { ok: true }> => u.ok && u.id === route.unitId) : undefined;

  // 알 수 없는(또는 불러오지 못한) 단원 id면 목록으로 돌아간다.
  useEffect(() => {
    if (route.page === 'unit' && !unit) window.location.replace('#/');
  }, [route.page, unit]);

  if (unit) {
    // key: 단원을 바꾸면 런타임 상태를 새로 만든다.
    if (unit.activity === 'classify') {
      return <ClassifyLab key={unit.id} unitId={unit.id} title={unit.manifest.title} experiment={unit.experiment} />;
    }
    return <Lab key={unit.id} unitId={unit.id} title={unit.manifest.title} experiment={unit.experiment} module={unit.module} />;
  }
  return <UnitList units={UNITS} hrefOf={unitHash} />;
}

const ACTOR_ID = 'anon-student-001';
const activityId = (unitId: string, expId: string) => `https://sci-bridge.local/activities/${unitId}/${expId}`;

function Lab({
  unitId,
  title,
  experiment,
  module: mod,
}: {
  unitId: string;
  title: string;
  experiment: VariableExperiment;
  module: AnyModule;
}) {
  const defaults = useMemo(
    () => Object.fromEntries(experiment.variables.map((v) => [v.key, v.default])),
    [experiment],
  );
  const runtime = useMemo(
    () =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      createRuntime<any, any>({
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const active: Trial<any, any> | undefined = state.trials.find((t) => t.id === state.active);
  const snapshot = active ? sampleAt(active, state.playhead, mod.interpolate) : null;
  const prevOfActive = active ? state.trials[active.index - 2] : undefined;

  const shownValues = active ? active.values : state.values;
  const viewProps = {
    experiment,
    trial: active,
    snapshot,
    values: shownValues,
    playhead: state.playhead,
  };

  const gate = canRun({ ivKey: state.ivKey, prediction: state.prediction }, experiment.gateway);

  const onRun = () => {
    if (!gate.ok || state.playing) return;
    try {
      const snap = runtime.getSnapshot();
      const emit = (verb: string, result?: Record<string, unknown>) => {
        const stmt = buildStatement({ actorId: ACTOR_ID, verb, objectId: activityId(unitId, experiment.id), result });
        recorder.record(stmt);
        console.debug('[xAPI]', stmt);
      };
      const trial = runtime.run(
        (values) => mod.simulate(values, experiment),
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

  // 센서: 모든 값은 sampleAt 스냅샷(과 화면에 보이는 시행의 조건)에서만 읽는다.
  const sensorSpecs = mod.sensors(snapshot, shownValues);

  // 피드백·튜터: 재생이 끝난 뒤에 보여 준다.
  const shown = state.playing ? state.trials.slice(0, -1) : state.trials;
  const last = shown[shown.length - 1];
  const lastPrev = last ? shown[last.index - 2] : undefined;
  const feedback = last ? structuralFeedback(last.analysis, labels, last.ivKey, experiment.dependent[0]!.label) : null;
  let observed: Prediction | null = null;
  if (last && lastPrev && last.analysis.kind === 'fair-test') {
    observed = observedOutcome(
      lastPrev.result[mod.metric.resultKey],
      last.result[mod.metric.resultKey],
      mod.metric.sameThreshold(experiment),
    );
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
        <a className="back" href="#/">← 단원 목록</a>
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
            <mod.MacroView {...viewProps} />
            <mod.MicroView {...viewProps} />
            <GraphView
              module={mod}
              trial={active}
              prev={prevOfActive}
              playhead={state.playhead}
              playing={state.playing}
              onPlayhead={runtime.setPlayhead}
              describedBy="results-table"
            />
          </div>
          <SensorBar specs={sensorSpecs} />
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
          <ResultsTable experiment={experiment} module={mod} trials={state.trials} playingId={state.playing ? state.active : null} />
        </section>
      </main>
    </div>
  );
}
