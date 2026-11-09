import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityTabsSlot } from '../../components/ActivityTabs';
import { isDaylight } from '@sci/engine-earth';
import type { ObservationExperiment } from '@sci/schema';
import { renderAndGuard } from '@sci/tutor';
import { MemoryRecorder, buildStatement, toExtensions } from '@sci/xapi';
import { readPlaybackSeconds } from '../../playback';
import { useClassroomStatus, usePaused } from '../../classroom/bus';
import { logbook } from '../../logbook';
import { GroundView } from './GroundView';
import { MoonGroundView, MoonSpaceView } from './MoonView';
import { NorthSkyView } from './NorthSkyView';
import { SolarSystemView } from './SolarSystemView';
import { RevolutionSpaceView, RotationSpaceView } from './SpaceView';
import { feedbackText } from './feedback';
import { dayFor, formatHour, groundScene, rotationOf, sunTrail } from './model';
import { MOON_DAY_MAX, MOON_DAY_MIN, isMoonView, moonDayLabel, moonScene } from './moonModel';
import { NORTH_HOUR_MAX, NORTH_HOUR_MIN, compareOf, isNightView, nightLabel, northScene, solarScene } from './nightModel';
import {
  canObserve,
  canRecord,
  createInitialState,
  createObserveStore,
  current,
  feedbackKind,
  isCompleted,
  predict,
  record,
  recordMatchesModel,
  select,
  setControl,
  setDay,
  setHour,
  setMonth,
  setSkyToggle,
  touchView,
  tutorSituation,
  type Value,
} from './observeStore';

const ACTOR_ID = 'anon-student-001';
const activityId = (unitId: string, expId: string) => `https://sci-bridge.local/activities/${unitId}/${expId}`;

const prefersReducedMotion = (): boolean => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

export function ObserveLab({
  unitId,
  title,
  experiment: exp,
}: {
  unitId: string;
  title: string;
  experiment: ObservationExperiment;
}) {
  const store = useMemo(() => createObserveStore(createInitialState(exp)), [exp]);
  const state = useSyncExternalStore(store.subscribe, store.getState);
  const recorder = useMemo(() => new MemoryRecorder(), []);
  const reduced = useMemo(prefersReducedMotion, []);
  const daySeconds = useMemo(() => readPlaybackSeconds() ?? 8, []);
  const [playing, setPlaying] = useState(false);
  const paused = usePaused();

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

  const { task, ts } = current(state, exp);
  const enabled = canObserve(state, exp);
  const recordable = canRecord(state, exp);
  const rotation = rotationOf(ts.controls);
  const optionLabel = (v: Value | null | undefined) => task.options.find((o) => o.value === v)?.label ?? '';

  /** 첫 조작은 'observed'로 알린다. */
  const noteObserved = (wasObserved: boolean, detail: Record<string, unknown>) => {
    if (!wasObserved || 'control' in detail) emit('observed', { task: task.id, ...detail });
  };

  const onHour = useCallback(
    (hour: number) => {
      const before = store.getState();
      const after = store.update((s) => setHour(s, exp, hour));
      if (after !== before) {
        const was = before.tasks[before.selected]!.observed;
        if (!was) emit('observed', { task: before.selected, kind: 'hour' });
      }
    },
    [store, exp, emit],
  );

  // 재생: 하루를 daySeconds초에 돌린다. 끝나거나 화면에서 사라지면 반드시 멈춘다.
  const hourRef = useRef(ts.hour);
  hourRef.current = ts.hour;
  const hourLo = task.view === 'north-sky' ? NORTH_HOUR_MIN : 0;
  const hourHi = task.view === 'north-sky' ? NORTH_HOUR_MAX : 24;
  useEffect(() => {
    if (!playing || paused) return;
    const start = hourRef.current >= hourHi ? hourLo : hourRef.current;
    const t0 = performance.now();
    let id = 0;
    const frame = () => {
      const h = Math.min(hourHi, start + ((performance.now() - t0) / 1000) * ((hourHi - hourLo) / daySeconds));
      onHour(h);
      if (h >= hourHi) {
        setPlaying(false);
        return;
      }
      id = requestAnimationFrame(frame);
    };
    id = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(id);
  }, [playing, paused, daySeconds, onHour, hourLo, hourHi]);

  const onDay = (day: number) => {
    const before = store.getState();
    const after = store.update((s) => setDay(s, exp, day));
    if (after !== before) noteObserved(before.tasks[before.selected]!.observed, { kind: 'day' });
  };

  const onSelectTask = (id: string) => {
    setPlaying(false);
    store.update((s) => select(s, exp, id));
  };

  const onPredict = (value: Value) => {
    const before = store.getState();
    const after = store.update((s) => predict(s, exp, value));
    if (after !== before) emit('predicted', { task: task.id, prediction: String(value) });
  };

  const onMonth = (month: number) => {
    const before = store.getState();
    const after = store.update((s) => setMonth(s, exp, month));
    if (after !== before) noteObserved(before.tasks[before.selected]!.observed, { kind: 'month' });
  };

  const onControl = (key: string, value: Value) => {
    const before = store.getState();
    let after = store.update((s) => setControl(s, exp, key, value));
    // 태양계 모형 보기는 이미 고른 쪽을 눌러도 살펴본 것으로 친다.
    if (task.view === 'solar-system') after = store.update((s) => touchView(s, exp));
    if (after !== before) {
      setPlaying(false);
      noteObserved(before.tasks[before.selected]!.observed, { kind: 'control', control: key, value: String(value) });
    }
  };

  const onSkyToggle = (key: 'guide' | 'trailOn', on: boolean) => {
    const before = store.getState();
    const after = store.update((s) => setSkyToggle(s, exp, key, on));
    if (after !== before) noteObserved(before.tasks[before.selected]!.observed, { kind: 'toggle', toggle: key, value: String(on) });
  };

  const onRecord = (value: Value) => {
    const before = store.getState();
    const after = store.update((s) => record(s, exp, value));
    if (after === before) return;
    const cur = current(after, exp);
    emit('recorded', {
      task: task.id,
      option: String(value),
      matchesModel: recordMatchesModel(exp, cur.task, cur.ts),
    });
    if (!isCompleted(before, task.id)) emit('task-completed', { task: task.id });
    // 탐구 기록장(학생이 켰을 때만): 어떤 과제를 기록했는지와 모델과 맞았는지만 남긴다.
    logbook.noteObservation(unitId, task.id, recordMatchesModel(exp, cur.task, cur.ts) === true);
  };

  // ---- 화면 값 ----
  const scene = groundScene(exp, task, ts);
  const trail = task.view === 'rotation' ? sunTrail(exp, task, ts, state.trail) : [];
  const spaceLabel =
    task.view === 'rotation'
      ? `우주에서 보기: ${scene.timeLabel}, 북극 위에서 본 지구. 우리나라는 ${
          isDaylight({ hour: ts.hour, lonOffsetDeg: 0 }) ? '태양 빛을 받는 낮' : '태양 빛을 받지 못하는 밤'
        } 쪽에 있고, ${
          task.answer === 'antipode-day-night'
            ? `지구 반대편은 ${isDaylight({ hour: ts.hour, lonOffsetDeg: 180 }) ? '낮' : '밤'} 쪽에 있어요. `
            : ''
        }지구는 ${rotation === 'forward' ? '서쪽에서 동쪽으로' : '동쪽에서 서쪽으로'} 돌아요`
      : `우주에서 보기: ${ts.month}월 15일, 지구는 태양 둘레 궤도 위에 있고 밤하늘은 태양 반대쪽을 향해요`;

  const situation = tutorSituation(state, exp);
  const doneCount = exp.tasks.filter((t) => isCompleted(state, t.id)).length;
  // 수업 연결(있을 때만 쓰인다): 진행 요약만 알린다.
  useClassroomStatus({
    unitId,
    activity: 'observe',
    phase: doneCount > 0 ? 'reviewing' : ts.prediction !== null ? 'running' : 'designing',
    trials: doneCount,
    lastKind: situation,
    mismatch: situation === 'prediction-mismatch' || situation === 'record-mismatch',
    safetyLocked: false,
  });

  const tutorText = renderAndGuard(situation, {}, task.probes, {
    forbiddenAnswers: exp.tutor.forbiddenAnswers,
    limits: exp.limits,
  });
  const feedback = feedbackText(feedbackKind(state, exp));
  const showAntipode = task.answer === 'antipode-day-night';

  // 새 보기: 정답이 되는 숫자는 기록이 모델 결과와 같을 때만 보여 준다.
  const night = isNightView(task);
  const revealed = recordMatchesModel(exp, task, ts) === true;
  const solar = task.view === 'solar-system' ? solarScene(task.answer, !revealed, compareOf(ts.controls)) : null;
  const north = task.view === 'north-sky' ? northScene(exp, ts, state.trail, ts.guide) : null;
  const moon = isMoonView(task) ? moonScene(exp, ts.day) : null;
  const nightCaption = solar
    ? compareOf(ts.controls) === 'size'
      ? '크기 비교 · 지구 지름을 10 px로 그렸어요'
      : '거리 비교 · 태양에서 지구까지가 1칸이에요'
    : north
      ? `${north.timeLabel} · 북쪽 하늘`
      : '';
  const recordHint =
    task.view === 'solar-system'
      ? '크기 비교나 거리 비교를 눌러 관찰하면 기록할 수 있어요.'
      : task.view === 'north-sky'
        ? '시각을 바꾸거나 길잡이 선·별 자취를 켜서 관찰하면 기록할 수 있어요.'
        : task.view === 'moon'
          ? '음력 날짜를 바꾸어 달을 관찰하면 기록할 수 있어요.'
          : '시각이나 달, 조건을 한 번 바꾸어 관찰하면 기록할 수 있어요.';

  return (
    <div className="app">
      <header className="top">
        <a className="back" href="#/">← 단원 목록</a>
        <h1>{title}</h1>
        <p className="question">탐구 질문: {exp.question}</p>
      </header>
      <ActivityTabsSlot />

      <main className="observe-layout">
        <section className="panel" aria-label="과제 목록">
          <h2>과제 목록</h2>
          <ul className="task-list">
            {exp.tasks.map((t) => {
              const done = isCompleted(state, t.id);
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    className={state.selected === t.id ? 'selected' : ''}
                    aria-current={state.selected === t.id ? 'true' : undefined}
                    onClick={() => onSelectTask(t.id)}
                  >
                    <span>{t.title}</span>
                    {done && (
                      <span className="done-tag">
                        <span aria-hidden="true">✓ </span>완료
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <div className="center">
          <div className="observe-views">
            {moon ? (
              <>
                <figure className="view observe-view">
                  <figcaption>땅에서 보기</figcaption>
                  <MoonGroundView scene={moon} />
                  <p className="view-note" data-testid="moon-ground-caption">{moon.groundCaption}</p>
                  {revealed && (
                    <p className="view-note" data-testid="moon-shape-name">
                      <strong>이 날의 달: {moon.shapeName}</strong>
                    </p>
                  )}
                </figure>
                <figure className="view observe-view space">
                  <figcaption>우주에서 보기</figcaption>
                  <MoonSpaceView scene={moon} />
                  <p className="view-note" data-testid="moon-space-caption">{moon.spaceCaption}</p>
                </figure>
              </>
            ) : night ? (
              <figure className="view observe-view">
                <figcaption>{task.view === 'solar-system' ? '태양계 모형 보기' : '북쪽 하늘 보기'}</figcaption>
                {solar && <SolarSystemView scene={solar} compare={compareOf(ts.controls)} />}
                {north && <NorthSkyView scene={north} showTrail={ts.trailOn} />}
                <p className="view-note" data-testid="night-caption">{nightCaption}</p>
              </figure>
            ) : (
              <>
            <figure className="view observe-view">
              <figcaption>땅에서 보기</figcaption>
              <GroundView scene={scene} trail={trail} />
              <p className="view-note" data-testid="ground-caption">{scene.caption}</p>
            </figure>
            <figure className="view observe-view space">
              <figcaption>우주에서 보기</figcaption>
              {task.view === 'rotation' ? (
                <RotationSpaceView hour={ts.hour} rotation={rotation} showAntipode={showAntipode} ariaLabel={spaceLabel} />
              ) : (
                <RevolutionSpaceView month={ts.month} dayOfYear={dayFor(exp, task, ts.month)} ariaLabel={spaceLabel} />
              )}
              <p className="view-note" data-testid="space-caption">
                {task.view === 'rotation' ? `북극 위에서 본 모습 · ${scene.timeLabel}` : `${ts.month}월 15일 · 밤 9시`}
              </p>
            </figure>
              </>
            )}
          </div>

          <section className="panel" aria-label="관찰하기">
            <h2>관찰하기</h2>
            {!enabled && (
              <p className="hint" aria-live="polite">
                예측을 먼저 골라 주세요.
              </p>
            )}
            {task.view === 'rotation' ? (
              <div className="slider-row">
                <span id="slider-label" className="slider-name">시각</span>
                <input
                  type="range"
                  min={0}
                  max={24}
                  step={0.5}
                  value={ts.hour}
                  disabled={!enabled}
                  aria-labelledby="slider-label"
                  aria-valuetext={formatHour(ts.hour)}
                  onChange={(e) => {
                    setPlaying(false);
                    onHour(Number(e.target.value));
                  }}
                />
                <span className="slider-value" aria-hidden="true">{formatHour(ts.hour)}</span>
                {!reduced && (
                  <button type="button" className="secondary play" disabled={!enabled} onClick={() => setPlaying((p) => !p)}>
                    {playing ? '⏸ 멈추기' : '▶ 재생'}
                  </button>
                )}
              </div>
            ) : task.view === 'north-sky' ? (
              <>
                <div className="slider-row">
                  <span id="slider-label" className="slider-name">시각</span>
                  <input
                    type="range"
                    min={NORTH_HOUR_MIN}
                    max={NORTH_HOUR_MAX}
                    step={0.5}
                    value={ts.hour}
                    disabled={!enabled}
                    aria-labelledby="slider-label"
                    aria-valuetext={nightLabel(ts.hour)}
                    onChange={(e) => {
                      setPlaying(false);
                      onHour(Number(e.target.value));
                    }}
                  />
                  <span className="slider-value" aria-hidden="true">{nightLabel(ts.hour)}</span>
                  {!reduced && (
                    <button type="button" className="secondary play" disabled={!enabled} onClick={() => setPlaying((p) => !p)}>
                      {playing ? '⏸ 멈추기' : '▶ 재생'}
                    </button>
                  )}
                </div>
                <fieldset className="plain control-group" disabled={!enabled}>
                  <legend>보기 도우미</legend>
                  <div className="choices">
                    <button
                      type="button"
                      className={ts.guide ? 'selected' : ''}
                      aria-pressed={ts.guide}
                      onClick={() => onSkyToggle('guide', !ts.guide)}
                    >
                      길잡이 선 보기
                    </button>
                    <button
                      type="button"
                      className={ts.trailOn ? 'selected' : ''}
                      aria-pressed={ts.trailOn}
                      onClick={() => onSkyToggle('trailOn', !ts.trailOn)}
                    >
                      별 자취 남기기
                    </button>
                  </div>
                </fieldset>
              </>
            ) : task.view === 'moon' ? (
              <>
                <div className="slider-row">
                  <span id="slider-label" className="slider-name">음력 날짜</span>
                  <input
                    type="range"
                    min={MOON_DAY_MIN}
                    max={MOON_DAY_MAX}
                    step={1}
                    value={ts.day}
                    disabled={!enabled}
                    aria-labelledby="slider-label"
                    aria-valuetext={moonDayLabel(ts.day)}
                    onChange={(e) => onDay(Number(e.target.value))}
                  />
                  <span className="slider-value" aria-hidden="true">{moonDayLabel(ts.day)}</span>
                </div>
                <p className="hint">저녁 7시에 남쪽 하늘을 바라본 모습이에요.</p>
              </>
            ) : task.view === 'solar-system' ? (
              <p className="hint">크기 비교와 거리 비교를 눌러 가며 살펴보세요.</p>
            ) : (
              <>
                <div className="slider-row">
                  <span id="slider-label" className="slider-name">달</span>
                  <input
                    type="range"
                    min={1}
                    max={12}
                    step={1}
                    value={ts.month}
                    disabled={!enabled}
                    aria-labelledby="slider-label"
                    aria-valuetext={`${ts.month}월`}
                    onChange={(e) => onMonth(Number(e.target.value))}
                  />
                  <span className="slider-value" aria-hidden="true">{ts.month}월</span>
                </div>
                <p className="hint">시각은 밤 9시로 맞춰져 있어요.</p>
              </>
            )}
            {(task.controls ?? []).map((c) => (
              <fieldset key={c.key} className="plain control-group" disabled={!enabled}>
                <legend>{c.label}</legend>
                <div className="choices">
                  {c.options.map((o) => (
                    <button
                      key={String(o.value)}
                      type="button"
                      className={ts.controls[c.key] === o.value ? 'selected' : ''}
                      aria-pressed={ts.controls[c.key] === o.value}
                      onClick={() => onControl(c.key, o.value)}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </fieldset>
            ))}
          </section>
        </div>

        <div className="side">
          <section className="panel" aria-label="예측">
            <h2>예측</h2>
            <fieldset className="plain predict-group">
              <legend>{task.question}</legend>
              <div className="choices">
                {task.options.map((o) => (
                  <button
                    key={String(o.value)}
                    type="button"
                    className={ts.prediction === o.value ? 'selected' : ''}
                    aria-pressed={ts.prediction === o.value}
                    onClick={() => onPredict(o.value)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </fieldset>
          </section>

          <section className="panel" aria-label="관찰 기록">
            <h2>관찰 기록</h2>
            <fieldset className="plain predict-group" disabled={!recordable}>
              <legend>내가 관찰한 것은 무엇인가요?</legend>
              <div className="choices">
                {task.options.map((o) => (
                  <button
                    key={String(o.value)}
                    type="button"
                    className={ts.recorded?.value === o.value ? 'selected' : ''}
                    aria-pressed={ts.recorded?.value === o.value}
                    onClick={() => onRecord(o.value)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </fieldset>
            {!recordable && (
              <p className="hint">
                {enabled ? recordHint : '예측을 고르고 관찰한 뒤에 기록할 수 있어요.'}
              </p>
            )}
            <p className="compare" data-testid="compare" aria-live="polite">
              {ts.recorded
                ? `예측: ${optionLabel(ts.prediction)} / 관찰: ${optionLabel(ts.recorded.value)}`
                : '기록하면 예측과 관찰을 나란히 보여 줄게요.'}
            </p>
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
    </div>
  );
}
