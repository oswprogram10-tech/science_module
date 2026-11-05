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
  electric: '⚠ 가정용 콘센트 전기로는 절대 실험하지 않아요.',
  // `hot`은 연소·전기 단원도 쓰는데 그 화면은 그대로 두려고, 단원 모듈 이름을 붙인 키로 이 단원에만 보여 준다.
  'magma-cooling:hot': '⚠ 녹인 물질과 접시는 굳은 뒤에도 한동안 뜨거워요.',
  // `sunlight`의 기본 문구는 렌즈를 쓰는 빛 단원용이라, 이 단원은 모듈 이름을 붙인 키로 따로 쓴다.
  'sun-angle:sunlight': '⚠ 태양을 직접 바라보면 눈을 다칠 수 있어요.',
  // 곰팡이가 핀 음식은 먹거나 냄새를 맡지 않는다. 다른 단원이 `microbe`를 쓸 때를 생각해 모듈 이름을 붙인 키로 둔다.
  'mold-growth:microbe': '⚠ 곰팡이가 핀 음식은 먹거나 냄새를 맡지 않아요.',
  // 화면의 맥박은 가상 친구의 값이다. 다른 단원이 `exercise`를 쓸 때를 생각해 모듈 이름을 붙인 키로 둔다.
  'exercise-body:exercise': '⚠ 이 화면의 맥박은 가상 친구의 값이에요. 내 맥박은 손목을 짚어 직접 세어 봐요.',
  // 자석 실험의 상시 문구. 다른 단원이 `magnet`을 쓸 때를 생각해 모듈 이름을 붙인 키로 둔다.
  'magnet-distance:magnet': '⚠ 자석은 휴대 전화·카드와 떨어진 곳에서 써요.',
  // 소금 얼음물은 아주 차갑다. 다른 단원이 `cold`를 쓸 때를 생각해 모듈 이름을 붙인 키로 둔다.
  'freeze-melt:cold': '⚠ 소금 얼음물은 아주 차가워요. 맨손으로 오래 만지지 않아요.',
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
        .map((k) => ({ k, text: ALWAYS_NOTICE[`${experiment.module}:${k}`] ?? ALWAYS_NOTICE[k] }))
        .filter((n) => n.text)
        .map(({ k, text }) => (
          <p className="warning" role="note" key={k}>{text}</p>
        ))}
      <button type="button" className="secondary" onClick={onReset} disabled={locked}>처음부터 다시</button>
    </aside>
  );
}
