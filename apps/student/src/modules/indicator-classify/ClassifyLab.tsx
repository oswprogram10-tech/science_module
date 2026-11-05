import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { indicatorColor, type GroupKey } from '@sci/engine-matter';
import { josa } from '@sci/gateway';
import type { ClassificationExperiment } from '@sci/schema';
import { renderAndGuard } from '@sci/tutor';
import { MockSafetyDetector, type SafetyEvent } from '@sci/vision';
import { MemoryRecorder, buildStatement, toExtensions } from '@sci/xapi';
import {
  allPlaced,
  check,
  confirmSafety,
  createClassifyStore,
  dismissAlerts,
  place,
  predict,
  raiseAlert,
  select,
  testBlock,
  testIndicator,
  tutorSituation,
  type Prediction,
} from './classifyStore';
import { ColorReader, type ReadSource } from './ColorReader';
import type { ColorReading } from './colorRead';
import { PatternDefs, Swatch, TestTube } from './ColorViews';
import { TUTOR_NO_SELECTION, classifyFeedback } from './feedback';
import { MockSafetyPanel } from '../../components/safety/MockSafetyPanel';
import { SafetyAlertBanner } from '../../components/safety/SafetyAlertBanner';
import { SafetyDialog } from '../../components/safety/SafetyDialog';
import { devMode } from '../../components/safety/devMode';
import { reportSafety, reportSafetyClear, useClassroomStatus } from '../../classroom/bus';
import { logbook } from '../../logbook';
import { HAZARD_NOTICE, SAFETY_MESSAGES, speak } from '../../components/safety/safetyMessages';

const ACTOR_ID = 'anon-student-001';
const activityId = (unitId: string, expId: string) => `https://sci-bridge.local/activities/${unitId}/${expId}`;

const PREDICTIONS: { value: Prediction; label: string }[] = [
  { value: 'acid', label: '산성일 것 같아요' },
  { value: 'base', label: '염기성일 것 같아요' },
  { value: 'unsure', label: '잘 모르겠어요' },
];
const PREDICTION_SHORT: Record<Prediction, string> = { acid: '산성', base: '염기성', unsure: '모르겠어요' };

export function ClassifyLab({
  unitId,
  title,
  experiment: exp,
}: {
  unitId: string;
  title: string;
  experiment: ClassificationExperiment;
}) {
  const store = useMemo(() => createClassifyStore(), []);
  const state = useSyncExternalStore(store.subscribe, store.getState);
  const recorder = useMemo(() => new MemoryRecorder(), []);
  const detector = useMemo(() => new MockSafetyDetector(), []);
  const dev = useMemo(devMode, []);
  const [pendingIndicator, setPendingIndicator] = useState<string | null>(null);
  const [chip, setChip] = useState<string | null>(null);
  const [readerIndicator, setReaderIndicator] = useState(exp.indicators[0]!.key);
  /** 마지막으로 시험한 결과가 바뀐 지시약: 색 변화 애니메이션을 이 지시약에만 보인다. */
  const [justTested, setJustTested] = useState<string | null>(null);

  const emit = useCallback(
    (verb: string, extensions?: Record<string, unknown>) => {
      const stmt = buildStatement({
        actorId: ACTOR_ID,
        verb,
        objectId: activityId(unitId, exp.id),
        result: extensions ? { extensions: toExtensions(extensions) } : undefined,
      });
      recorder.record(stmt);
      console.debug('[xAPI]', stmt);
    },
    [unitId, exp.id, recorder],
  );

  // 안전 감지기: 이벤트가 오면 배너, 음성, xAPI.
  useEffect(() => {
    detector.start((e: SafetyEvent) => {
      store.update((s) => raiseAlert(s, e));
      reportSafety(e.type);
      speak(SAFETY_MESSAGES[e.type]);
      emit('safety-alert', { type: e.type });
    });
    return () => detector.stop();
  }, [detector, store, emit]);

  const solutionOf = (key: string) => exp.solutions.find((s) => s.key === key)!;
  const sel = state.selected ? solutionOf(state.selected) : null;
  const selTests = sel ? (state.tests[sel.key] ?? []) : [];
  const block = testBlock(state, exp);
  const indicatorsLocked = block === 'no-selection' || block === 'no-prediction' || block === 'alert-active';

  const doTest = (indicator: string) => {
    const before = store.getState();
    const after = store.update((s) => testIndicator(s, exp, indicator));
    if (after !== before && after.selected) {
      setJustTested(indicator);
      emit('tested', {
        solution: after.selected,
        indicator,
        color: indicatorColor(exp, after.selected, indicator),
      });
    }
  };

  const onIndicator = (indicator: string) => {
    setReaderIndicator(indicator);
    if (testBlock(store.getState(), exp) === 'safety-required') {
      setPendingIndicator(indicator);
      return;
    }
    doTest(indicator);
  };

  const onConfirmSafety = () => {
    store.update(confirmSafety);
    emit('safety-confirmed');
    const next = pendingIndicator;
    setPendingIndicator(null);
    if (next) doTest(next);
  };

  const onPredict = (p: Prediction) => {
    if (!sel) return;
    store.update((s) => predict(s, exp, sel.key, p));
    emit('predicted', { solution: sel.key, prediction: p });
  };

  const onPlace = (group: GroupKey | null) => {
    if (!chip) return;
    const next = store.update((s) => place(s, exp, chip, group));
    setChip(null);
    emit('classified', { placement: { ...next.placement } });
  };

  const onCheck = () => {
    const next = store.update((s) => check(s, exp));
    if (!next.checked) return;
    const counts: Record<string, number> = {};
    for (const i of next.checked.items) counts[i.status] = (counts[i.status] ?? 0) + 1;
    emit('checked', { kind: next.checked.kind, ...counts });
    if (next.checked.kind === 'check-complete') logbook.noteClassifyComplete(unitId);
  };

  const onReading = (r: ColorReading, source: ReadSource) => {
    emit('color-read', { indicator: r.indicator, best: r.best, deltaE: Math.round(r.deltaE * 10) / 10, confident: r.confident, source });
  };

  // 튜터
  const situation = tutorSituation(state, exp);
  const tutorText =
    !state.selected && !state.checked
      ? TUTOR_NO_SELECTION
      : renderAndGuard(situation.when, { solution: situation.solution }, exp.tutor.probes, {
          forbiddenAnswers: exp.tutor.forbiddenAnswers,
          limits: exp.limits,
        });
  const feedback = classifyFeedback(exp, state.checked);

  // 실험대: 시험관 액체색은 마지막으로 넣은 용액형 지시약의 결과색.
  const lastDrop = [...selTests].reverse().find((k) => exp.indicators.find((i) => i.key === k)?.kind === 'drop');
  const liquidKey = sel && lastDrop ? indicatorColor(exp, sel.key, lastDrop) : null;
  const lastDropInitial = lastDrop ? exp.indicators.find((i) => i.key === lastDrop)!.initial : undefined;

  const placed = (g: GroupKey | null) =>
    exp.solutions.filter((s) => (state.placement[s.key] ?? null) === g);
  const groupLabel = (g: GroupKey) => exp.groups.find((x) => x.key === g)?.label ?? g;
  const ready = allPlaced(state, exp);

  const alertMessages = [...new Set(state.alerts.map((a) => SAFETY_MESSAGES[a.type]))];

  // 수업 연결(있을 때만 쓰인다): 진행 요약만 알린다.
  const testCount = Object.values(state.tests).reduce((n, t) => n + (t?.length ?? 0), 0);
  useClassroomStatus({
    unitId,
    activity: 'classify',
    phase: state.checked ? 'reviewing' : testCount > 0 ? 'running' : 'designing',
    trials: testCount,
    lastKind: situation.when,
    mismatch: situation.when === 'prediction-mismatch',
    safetyLocked: state.alerts.length > 0,
  });

  return (
    <div className="app">
      <PatternDefs />
      <SafetyAlertBanner messages={alertMessages} onDismiss={() => {
          reportSafetyClear(state.alerts.map((a) => a.type));
          store.update(dismissAlerts);
        }} />
      <header className="top">
        <a className="back" href="#/">← 단원 목록</a>
        <h1>{title}</h1>
        <p className="question">탐구 질문: {exp.question}</p>
      </header>

      <main className="classify-layout">
        <section className="panel" aria-label="용액 고르기">
          <h2>용액 고르기</h2>
          <ul className="solution-list">
            {exp.solutions.map((s) => (
              <li key={s.key}>
                <button
                  type="button"
                  className={state.selected === s.key ? 'selected' : ''}
                  aria-pressed={state.selected === s.key}
                  onClick={() => {
                    setJustTested(null);
                    store.update((st) => select(st, exp, s.key));
                  }}
                >
                  {s.label}
                  {s.hazard && (
                    <span className="hazard-tag">
                      <span aria-hidden="true">⚠ </span>주의
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          <fieldset className="plain predict-group" disabled={!sel}>
            <legend>{sel ? `${sel.label}${josa(sel.label, '은/는')} 어떨 것 같아요?` : '용액을 먼저 골라 주세요.'}</legend>
            <div className="choices">
              {PREDICTIONS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  className={sel && state.predictions[sel.key] === p.value ? 'selected' : ''}
                  aria-pressed={!!sel && state.predictions[sel.key] === p.value}
                  onClick={() => onPredict(p.value)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </fieldset>
        </section>

        <div className="center">
          <section className="panel" aria-label="실험대">
            <h2>실험대</h2>
            {sel?.hazard && <p className="warning">{HAZARD_NOTICE}</p>}
            <div className="bench">
              <figure className="view bench-tube">
                <figcaption>{sel ? sel.label : '용액을 골라 주세요.'}</figcaption>
                <TestTube
                  key={sel?.key ?? 'none'}
                  exp={exp}
                  label={sel ? sel.label : '빈'}
                  liquidKey={liquidKey}
                  fromKey={lastDrop === justTested ? lastDropInitial : undefined}
                />
              </figure>
              <div className="bench-controls">
                <div className="choices">
                  {exp.indicators.map((ind) => (
                    <button
                      key={ind.key}
                      type="button"
                      className={selTests.includes(ind.key) ? 'selected' : ''}
                      disabled={indicatorsLocked}
                      onClick={() => onIndicator(ind.key)}
                    >
                      {ind.label}
                    </button>
                  ))}
                </div>
                <p className="hint" aria-live="polite">
                  {block === 'no-selection' && '먼저 용액을 골라 주세요.'}
                  {block === 'no-prediction' && '예측을 먼저 골라 주세요.'}
                  {block === 'alert-active' && '안전 경고를 먼저 확인해 주세요.'}
                </p>
                <ul key={sel?.key ?? 'none'} className="results-list" aria-label="시험 결과">
                  {selTests.length === 0 && <li className="hint">지시약을 누르면 결과가 여기에 나타나요.</li>}
                  {selTests.map((k) => {
                    const ind = exp.indicators.find((i) => i.key === k)!;
                    const colorKey = indicatorColor(exp, sel!.key, k);
                    return (
                      <li key={k}>
                        <Swatch
                          exp={exp}
                          colorKey={colorKey}
                          fromKey={k === justTested ? ind.initial : undefined}
                          width={ind.kind === 'paper' ? 20 : 28}
                          height={ind.kind === 'paper' ? 44 : 28}
                        />
                        <span>
                          {ind.label}: <strong>{exp.colors[colorKey]?.label ?? colorKey}</strong>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </section>

          <ColorReader exp={exp} indicator={readerIndicator} onIndicator={setReaderIndicator} onReading={onReading} />
        </div>

        <div className="side">
          <section className="panel" aria-label="분류하기">
            <h2>분류하기</h2>
            <p className="hint">용액 이름을 누르고, 넣고 싶은 칸의 버튼을 눌러요.</p>
            <div className="bins">
              {([...exp.groups.map((g) => g.key as GroupKey), null] as (GroupKey | null)[]).map((g) => {
                const label = g ? groupLabel(g) : '아직 정하지 않음';
                return (
                  <div key={g ?? 'none'} className="bin" role="group" aria-label={label}>
                    <h3>{label}</h3>
                    <ul className="chips">
                      {placed(g).map((s) => (
                        <li key={s.key}>
                          <button
                            type="button"
                            className={chip === s.key ? 'selected' : ''}
                            aria-pressed={chip === s.key}
                            onClick={() => setChip(chip === s.key ? null : s.key)}
                          >
                            {s.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                    <button type="button" className="secondary" disabled={!chip} onClick={() => onPlace(g)}>
                      {label}에 놓기
                    </button>
                  </div>
                );
              })}
            </div>
            <button type="button" className="run" disabled={!ready} onClick={onCheck}>
              분류 확인하기
            </button>
            {!ready && <p className="hint">용액 8개를 모두 무리에 넣으면 확인할 수 있어요.</p>}
          </section>

          <div className="boxes single">
            <div className="box feedback" aria-live="polite">
              <h2>피드백</h2>
              <p>{feedback}</p>
            </div>
            <div className="box tutor" aria-live="polite">
              <h2>생각해 볼까요?</h2>
              <p>{tutorText}</p>
            </div>
          </div>
        </div>
      </main>

      <section className="results" aria-label="결과표">
        <div className="table-wrap" role="region" aria-label="용액별 결과표(좌우로 밀어서 볼 수 있어요)" tabIndex={0}>
          <table id="results-table">
            <caption className="sr-only">용액별 예측, 지시약 결과, 넣은 무리</caption>
            <thead>
              <tr>
                <th scope="col">용액</th>
                <th scope="col">예측</th>
                {exp.indicators.map((i) => (
                  <th key={i.key} scope="col">
                    {i.label}
                  </th>
                ))}
                <th scope="col">넣은 무리</th>
              </tr>
            </thead>
            <tbody>
              {exp.solutions.map((s) => {
                const tested = state.tests[s.key] ?? [];
                const pred = state.predictions[s.key];
                const g = state.placement[s.key] ?? null;
                return (
                  <tr key={s.key}>
                    <th scope="row">{s.label}</th>
                    <td>{pred ? PREDICTION_SHORT[pred] : '–'}</td>
                    {exp.indicators.map((i) => {
                      if (!tested.includes(i.key)) return <td key={i.key}>–</td>;
                      const c = indicatorColor(exp, s.key, i.key);
                      return (
                        <td key={i.key}>
                          <span className="cell-color">
                            <Swatch exp={exp} colorKey={c} width={18} height={18} />
                            {exp.colors[c]?.label ?? c}
                          </span>
                        </td>
                      );
                    })}
                    <td>{g ? groupLabel(g) : '–'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {dev && <MockSafetyPanel onTrigger={(t) => detector.trigger(t)} />}

      {pendingIndicator && (
        <SafetyDialog items={exp.safetyChecklist} onConfirm={onConfirmSafety} onCancel={() => setPendingIndicator(null)} />
      )}
    </div>
  );
}
