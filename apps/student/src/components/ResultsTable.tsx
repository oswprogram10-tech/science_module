import type { Experiment } from '@sci/schema';
import type { Trial } from '@sci/runtime';
import { OBSERVED_LABEL, PREDICTION_LABEL, observedOutcome } from '@sci/gateway';

export function ResultsTable({
  experiment,
  trials,
  playingId,
}: {
  experiment: Experiment;
  trials: Trial[];
  playingId: string | null;
}) {
  const optionLabel = (key: string, value: string | number) =>
    experiment.variables.find((v) => v.key === key)?.options.find((o) => o.value === value)?.label ?? String(value);

  return (
    <div className="results">
      <h2>결과표</h2>
      <div className="table-wrap">
        <table id="results-table">
          <caption className="sr-only">시행별 조건과 결과</caption>
          <thead>
            <tr>
              <th scope="col">시행</th>
              {experiment.variables.map((v) => (
                <th scope="col" key={v.key}>{v.label}</th>
              ))}
              <th scope="col">녹은 양(g)</th>
              <th scope="col">숟가락 수</th>
              <th scope="col">걸린 시간(초)</th>
              <th scope="col">예측·결과</th>
            </tr>
          </thead>
          <tbody>
            {trials.length === 0 && (
              <tr><td colSpan={experiment.variables.length + 5}>아직 실험한 결과가 없어요.</td></tr>
            )}
            {trials.map((t) => {
              const running = t.id === playingId;
              const prev = trials[t.index - 2];
              let outcome = '';
              if (t.prediction) outcome = `예측: ${PREDICTION_LABEL[t.prediction]}`;
              if (!running && t.prediction && prev && t.analysis.kind === 'fair-test') {
                outcome += ` / 결과: ${OBSERVED_LABEL[observedOutcome(prev.result.dissolvedG, t.result.dissolvedG, experiment.spoonGrams)]}`;
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
                    <td colSpan={3}>실험 중…</td>
                  ) : (
                    <>
                      <td>{t.result.dissolvedG.toFixed(1)}</td>
                      <td>{t.result.spoonsFullyDissolved}</td>
                      <td>{t.result.timeS.toFixed(1)}</td>
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
