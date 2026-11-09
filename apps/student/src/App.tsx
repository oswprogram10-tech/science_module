import { Suspense, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
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
import { MockSafetyDetector, type SafetyEvent, type SafetyEventType } from '@sci/vision';
import { ClassifyLab } from './modules/indicator-classify/ClassifyLab';
import { CardSortLab } from './modules/card-sort/CardSortLab';
import { PortfolioLab } from './modules/career-portfolio/PortfolioLab';
import { logbook } from './logbook';
import { ObserveLab } from './modules/sky-observation/ObserveLab';
import { readPlaybackSeconds } from './playback';
import { UNITS, activityOf, parseRoute, unitHash, type ActivityEntry, type UnitEntry } from './units';
import type { AnyModule } from './modules/types';
import { restPlayheadOf } from './modules/restPlayhead';
import { ACTIVITY_PANEL_ID, ActivityTabs, ActivityTabsContext, ActivityTabsSlot, activityTabId } from './components/ActivityTabs';
import { DesignPanel } from './components/DesignPanel';
import { GraphView } from './components/GraphView';
import { SensorBar } from './components/SensorBar';
import { ResultsTable } from './components/ResultsTable';
import { UnitList } from './components/UnitList';
import { MockSafetyPanel } from './components/safety/MockSafetyPanel';
import { SafetyAlertBanner } from './components/safety/SafetyAlertBanner';
import { SafetyDialog } from './components/safety/SafetyDialog';
import { devMode } from './components/safety/devMode';
import { ExperimentIdContext, reportSafety, reportSafetyClear, useClassroomStatus, usePaused } from './classroom/bus';
import { classroomUrl } from './classroom/config';
import { ErrorBoundary } from './classroom/ErrorBoundary';
import { LazyHost } from './classroom/lazy';
import { resolveSafetyMessages, speak } from './components/safety/safetyMessages';

const subscribeHash = (cb: () => void) => {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
};
const getHash = () => window.location.hash;

export function App() {
  const hash = useSyncExternalStore(subscribeHash, getHash);
  const paused = usePaused();
  const classroomOn = useMemo(() => classroomUrl() !== null, []);
  return (
    <>
      {/* 선생님이 "모두 멈춤"을 누르면 아래 화면은 입력을 받지 않는다. */}
      <div inert={paused}>
        <Routes />
      </div>
      {classroomOn && (
        <ErrorBoundary>
          <Suspense fallback={null}>
            <LazyHost showPill={parseRoute(hash).page === 'unit'} />
          </Suspense>
        </ErrorBoundary>
      )}
    </>
  );
}

function Routes() {
  const hash = useSyncExternalStore(subscribeHash, getHash);
  const route = parseRoute(hash);
  const unit =
    route.page === 'unit' ? UNITS.find((u): u is Extract<UnitEntry, { ok: true }> => u.ok && u.id === route.unitId) : undefined;

  // 알 수 없는(또는 불러오지 못한) 단원 id면 목록으로 돌아간다.
  useEffect(() => {
    if (route.page === 'unit' && !unit) window.location.replace('#/');
  }, [route.page, unit]);

  if (unit) {
    const act = activityOf(unit, route.page === 'unit' ? route.experimentId : undefined);
    const key = `${unit.id}/${act.experiment.id}`;
    // 활동이 둘 이상일 때만 탭을 둔다. 하나뿐인 단원은 컨텍스트가 비어 화면이 그대로다.
    const tabs =
      unit.activities.length > 1 ? (
        <ActivityTabs
          activities={unit.activities}
          currentId={act.experiment.id}
          onSelect={(id) => {
            window.location.hash = unitHash(unit.id, id);
          }}
        />
      ) : null;
    return (
      <ExperimentIdContext.Provider value={tabs ? act.experiment.id : undefined}>
        <ActivityTabsContext.Provider value={tabs}>
          {tabs ? (
            // 여러 활동 단원만: 고른 활동 화면 전체를 탭 패널로 묶는다(탭 목록도 화면 머리 아래에 있어 패널 안에 들어간다).
            <div role="tabpanel" id={ACTIVITY_PANEL_ID} aria-labelledby={activityTabId(act.experiment.id)}>
              {renderLab(unit.id, unit.manifest.title, act, key)}
            </div>
          ) : (
            renderLab(unit.id, unit.manifest.title, act, key)
          )}
        </ActivityTabsContext.Provider>
      </ExperimentIdContext.Provider>
    );
  }
  return <UnitList units={UNITS} hrefOf={unitHash} />;
}

function renderLab(unitId: string, title: string, act: ActivityEntry, key: string) {
  // key: 단원이나 활동을 바꾸면 런타임 상태를 새로 만든다.
  switch (act.activity) {
    case 'classify':
      return <ClassifyLab key={key} unitId={unitId} title={title} experiment={act.experiment} />;
    case 'card-sort':
      return <CardSortLab key={key} unitId={unitId} title={title} experiment={act.experiment} />;
    case 'portfolio':
      return <PortfolioLab key={key} unitId={unitId} title={title} experiment={act.experiment} unitTitles={UNIT_TITLES} />;
    case 'observe':
      return <ObserveLab key={key} unitId={unitId} title={title} experiment={act.experiment} />;
    default:
      return <Lab key={key} unitId={unitId} title={title} experiment={act.experiment} module={act.module} />;
  }
}

/** 진로 활동이 "준비 중"을 가려내는 데 쓰는 단원 id -> 이름. */
const UNIT_TITLES: Record<string, string> = Object.fromEntries(
  UNITS.flatMap((u) => (u.ok ? [[u.id, u.manifest.title] as const] : [])),
);

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
  const playbackSeconds = useMemo(readPlaybackSeconds, []);
  const runtime = useMemo(
    () =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      createRuntime<any, any>({
        defaults,
        clock: () => performance.now(),
        canRun: (s) => canRun(s, experiment.gateway).ok,
        playbackSeconds,
      }),
    [defaults, experiment, playbackSeconds],
  );
  const [runError, setRunError] = useState<string | null>(null);
  const recorder = useMemo(() => new MemoryRecorder(), []);
  const state = useSyncExternalStore(runtime.subscribe, runtime.getSnapshot);

  // 안전: 점검표(처음 실행할 때 한 번), 모의 감지기 경고(?dev=1 패널에서 일으킨다)
  const safetyItems = experiment.safetyChecklist ?? [];
  const safetyMessages = useMemo(() => resolveSafetyMessages(experiment.safetyMessages), [experiment]);
  const detector = useMemo(() => new MockSafetyDetector(), []);
  const dev = useMemo(devMode, []);
  const paused = usePaused();
  const [alerts, setAlerts] = useState<SafetyEventType[]>([]);
  const [safetyConfirmed, setSafetyConfirmed] = useState(false);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const alertMessages = alerts.map((a) => safetyMessages[a]);

  const emit = useCallback(
    (verb: string, result?: Record<string, unknown>) => {
      const stmt = buildStatement({ actorId: ACTOR_ID, verb, objectId: activityId(unitId, experiment.id), result });
      recorder.record(stmt);
      console.debug('[xAPI]', stmt);
    },
    [unitId, experiment.id, recorder],
  );

  useEffect(() => {
    detector.start((e: SafetyEvent) => {
      setAlerts((a) => [...a, e.type]);
      reportSafety(e.type);
      speak(safetyMessages[e.type]);
      emit('safety-alert', { extensions: toExtensions({ type: e.type }) });
    });
    return () => detector.stop();
  }, [detector, safetyMessages, emit]);

  const labels = useMemo(
    () => Object.fromEntries(experiment.variables.map((v) => [v.key, v.label])),
    [experiment],
  );

  // 재생 루프: requestAnimationFrame으로 runtime.tickNow 호출
  useEffect(() => {
    if (!state.playing || paused) return;
    let id = requestAnimationFrame(function frame() {
      runtime.tickNow();
      id = requestAnimationFrame(frame);
    });
    return () => cancelAnimationFrame(id);
  }, [state.playing, paused, runtime]);

  // 재생이 끝나면 모듈이 정한 시각으로 플레이헤드를 옮긴다(시행마다 한 번).
  const restedTrial = useRef<string | null>(null);
  useEffect(() => {
    if (state.playing || !state.active || mod.restPlayhead === undefined) return;
    if (restedTrial.current === state.active) return;
    // 숫자는 그대로, 함수는 그 시행의 조건·결과로 계산한다(시행마다 시각이 다른 단원).
    const trial = state.trials.find((t) => t.id === state.active);
    if (!trial) return;
    restedTrial.current = state.active;
    const rest = restPlayheadOf(mod, experiment, trial);
    if (rest !== undefined) runtime.setPlayhead(rest);
  }, [state.playing, state.active, state.trials, mod, experiment, runtime]);

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

  const safetyLocked = alerts.length > 0;
  const onRun = () => {
    if (!gate.ok || state.playing || safetyLocked) return;
    if (safetyItems.length > 0 && !safetyConfirmed) {
      setSafetyOpen(true);
      return;
    }
    doRun();
  };

  const onConfirmSafety = () => {
    setSafetyConfirmed(true);
    setSafetyOpen(false);
    emit('safety-confirmed');
    doRun();
  };

  const doRun = () => {
    try {
      const snap = runtime.getSnapshot();
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
        // 탐구 기록장(학생이 켰을 때만 기록한다): 시행별 값이 아니라 요약만 남긴다.
        const prevTrial = snap.trials[trial.index - 2];
        const observedNow =
          trial.analysis.kind === 'fair-test' && prevTrial
            ? observedOutcome(
                prevTrial.result[mod.metric.resultKey],
                trial.result[mod.metric.resultKey],
                mod.metric.sameThreshold(experiment),
              )
            : null;
        logbook.noteVariableTrial(unitId, {
          iv: trial.ivKey,
          fair: trial.analysis.kind === 'fair-test',
          ...(trial.prediction ? { predictionMatched: observedNow === trial.prediction } : {}),
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

  // 수업 연결(있을 때만 쓰인다): 진행 요약을 알린다. 튜터 문장·센서 값은 보내지 않는다.
  useClassroomStatus({
    unitId,
    activity: 'variable',
    phase: state.playing ? 'running' : state.trials.length > 0 ? 'reviewing' : 'designing',
    trials: state.trials.length,
    ...(last ? { lastKind: last.analysis.kind } : {}),
    mismatch: !!(observed && last?.prediction && observed !== last.prediction),
    safetyLocked,
  });

  return (
    <div className="app">
      <SafetyAlertBanner
        messages={alertMessages}
        onDismiss={() => {
          reportSafetyClear(alerts);
          setAlerts([]);
        }}
      />
      <header className="top">
        <a className="back" href="#/">← 단원 목록</a>
        <h1>{title}</h1>
        <p className="question">탐구 질문: {experiment.question}</p>
      </header>
      <ActivityTabsSlot />

      <main className="layout">
        <DesignPanel
          experiment={experiment}
          state={state}
          gate={
            safetyLocked
              ? { ok: false, reasons: [...gate.reasons, '안전 경고를 먼저 확인해 주세요.'] }
              : gate
          }
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
              experiment={experiment}
              trial={active}
              prev={prevOfActive}
              playhead={state.playhead}
              playing={state.playing}
              onPlayhead={runtime.setPlayhead}
              describedBy="results-table"
            />
          </div>
          {sensorSpecs.length > 0 && <SensorBar specs={sensorSpecs} />}
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
          {mod.ResultsExtra && <mod.ResultsExtra experiment={experiment} values={shownValues} />}
        </section>
      </main>

      {dev && <MockSafetyPanel onTrigger={(t) => detector.trigger(t)} />}

      {safetyOpen && (
        <SafetyDialog
          items={safetyItems}
          intro="실험을 시작하기 전에 모두 확인해 주세요."
          onConfirm={onConfirmSafety}
          onCancel={() => setSafetyOpen(false)}
        />
      )}
    </div>
  );
}
