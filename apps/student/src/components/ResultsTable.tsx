import type { VariableExperiment as Experiment } from '@sci/schema';
import type { Trial } from '@sci/runtime';
import type { AnyModule } from '../modules/types';
import { OBSERVED_LABEL, PREDICTION_LABEL, observedOutcome } from '@sci/gateway';

export function ResultsTable({
  experiment,
  module: mod,
  trials,
  playingId,
}: {
  experiment: Experiment;
  module: AnyModule;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  trials: Trial<any, any>[];
  playingId: string | null;
}) {
  const columns = mod.resultColumns(experiment);
  const metricOf = (t: Trial<any, any>) => t.result[mod.metric.resultKey] as number; // eslint-disable-line @typescript-eslint/no-explicit-any
  const threshold = mod.metric.sameThreshold(experiment);
  const optionLabel = (key: string, value: string | number) =>
    experiment.variables.find((v) => v.key === key)?.options.find((o) => o.value === value)?.label ?? String(value);

  return (
    <div className="results">
      <h2>결과표</h2>
      <div className="table-wrap" role="region" aria-label="결과표(좌우로 밀어서 볼 수 있어요)" tabIndex={0}>
        <table id="results-table">
          <caption className="sr-only">시행별 조건과 결과</caption>
          <thead>
            <tr>
              <th scope="col">시행</th>
              {experiment.variables.map((v) => (
                <th scope="col" key={v.key}>{v.label}</th>
              ))}
              {columns.map((c) => (
                <th scope="col" key={c.label}>{c.label}</th>
              ))}
              <th scope="col">예측·결과</th>
            </tr>
          </thead>
          <tbody>
            {trials.length === 0 && (
              <tr><td colSpan={experiment.variables.length + columns.length + 2}>아직 실험한 결과가 없어요.</td></tr>
            )}
            {trials.map((t) => {
              const running = t.id === playingId;
              const prev = trials[t.index - 2];
              let outcome = '';
              if (t.prediction) outcome = `예측: ${PREDICTION_LABEL[t.prediction]}`;
              if (!running && t.prediction && prev && t.analysis.kind === 'fair-test') {
                outcome += ` / 결과: ${OBSERVED_LABEL[observedOutcome(metricOf(prev), metricOf(t), threshold)]}`;
              }
              return (
                <tr key={t.id}>
                  <th scope="row">{t.index}</th>
                  {experiment.variables.map((v) => {
                    const changed = t.analysis.changed.includes(v.key);
                    return (
                      <td key={v.key} className={changed ? 'changed' : undefined}>
                        {optionLabel(v.key, t.values[v.key]!)}
                        {changed && <span className="changed-mark"> (바뀜)</span>}
                      </td>
                    );
                  })}
                  {running ? (
                    <td colSpan={columns.length}>실험 중…</td>
                  ) : (
                    <>
                      {columns.map((c) => (
                        <td key={c.label}>{c.value(t.result)}</td>
                      ))}
                    </>
                  )}
                  <td>{running ? '' : outcome || '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
