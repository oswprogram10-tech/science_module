import type { VariableExperiment as Experiment } from '@sci/schema';
import type { RuntimeState } from '@sci/runtime';
import { PREDICTION_LABEL, josa, type Prediction } from '@sci/gateway';

interface Props {
  experiment: Experiment;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  state: RuntimeState<any, any>;
  gate: { ok: boolean; reasons: string[] };
  onValue: (key: string, value: string | number) => void;
  onIV: (key: string | null) => void;
  onPrediction: (p: Prediction | null) => void;
  onRun: () => void;
  onReset: () => void;
}

/** 매니페스트 safety 종류 중, 조건과 상관없이 실행 버튼 아래에 항상 보여 주는 경고. */
const ALWAYS_NOTICE: Record<string, string> = {
  sunlight: '⚠ 렌즈로 해를 직접 보면 눈을 크게 다칠 수 있어요.',
};

const PREDICTION_ICON: Record<Prediction, string> = { increase: '▲', decrease: '▼', same: '＝' };

export function DesignPanel({ experiment, state, gate, onValue, onIV, onPrediction, onRun, onReset }: Props) {
  const locked = state.playing;
  return (
    <aside className="panel design" aria-label="실험 설계">
      <h2>실험 설계</h2>
      <fieldset disabled={locked} className="plain">
        {experiment.variables.map((v) => {
          const isIV = state.ivKey === v.key;
          return (
            <div className={`variable${isIV ? ' is-iv' : ''}`} key={v.key}>
              <div className="variable-head">
                <span id={`var-${v.key}`} className="variable-label">{v.label}</span>
                <span className="variable-tools">
                  {state.ivKey && !isIV && <span className="tag control">같게 할 조건</span>}
                  <label className={`iv-radio${isIV ? ' checked' : ''}`}>
                    <input type="radio" name="iv" checked={isIV} onChange={() => onIV(v.key)} aria-label={`${v.label}${josa(v.label, "을/를")} 바꿀 조건으로 고르기`} />
                    <span>바꿀 조건</span>
                  </label>
                </span>
              </div>
              <div role="group" aria-labelledby={`var-${v.key}`} className="choices">
                {v.options.map((o) => {
                  const selected = state.values[v.key] === o.value;
                  return (
                    <button
                      key={String(o.value)}
                      type="button"
                      className={`choice${selected ? ' selected' : ''}`}
                      aria-pressed={selected}
                      onClick={() => onValue(v.key, o.value)}
                    >
                      {selected ? '✓ ' : ''}{o.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {(experiment.safetyNotices ?? [])
          .filter((n) => state.values[n.key] === n.value)
          .map((n) => (
            <p className="warning" role="note" key={`${n.key}:${String(n.value)}`}>
              {n.text}
            </p>
          ))}

        <div className="predict">
          <span id="predict-label" className="variable-label">{experiment.predictionPrompt}</span>
          <div role="group" aria-labelledby="predict-label" className="choices">
            {(['increase', 'decrease', 'same'] as const).map((p) => {
              const selected = state.prediction === p;
              return (
                <button
                  key={p}
                  type="button"
                  className={`choice${selected ? ' selected' : ''}`}
                  aria-pressed={selected}
                  onClick={() => onPrediction(p)}
                >
                  {PREDICTION_ICON[p]} {PREDICTION_LABEL[p]}
                </button>
              );
            })}
          </div>
        </div>
      </fieldset>

      <button type="button" className="run" disabled={!gate.ok || locked} aria-describedby="run-reasons" onClick={onRun}>
        {locked ? '실험 중…' : '▶ 실험 실행'}
      </button>
      <ul id="run-reasons" className="reasons" aria-live="polite">
        {!gate.ok && !locked && gate.reasons.map((r) => <li key={r}>{r}</li>)}
      </ul>
      {experiment.safety
        .filter((k) => ALWAYS_NOTICE[k])
        .map((k) => (
          <p className="warning" role="note" key={k}>{ALWAYS_NOTICE[k]}</p>
        ))}
      <button type="button" className="secondary" onClick={onReset} disabled={locked}>처음부터 다시</button>
    </aside>
  );
}
