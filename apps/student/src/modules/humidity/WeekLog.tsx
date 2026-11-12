import type { Values } from '@sci/gateway';
import type { VariableExperiment } from '@sci/schema';

export interface WeekLogData {
  title: string;
  note: string;
  columns: string[];
  rows: string[][];
}

/** 매니페스트 params.weekLog에서 일주일 날씨 기록을 읽는다. 모양이 맞지 않으면 null. */
export function readWeekLog(experiment: Pick<VariableExperiment, 'params'>): WeekLogData | null {
  const raw = experiment.params?.weekLog;
  if (typeof raw !== 'object' || raw === null) return null;
  const { title, note, columns, rows } = raw as Record<string, unknown>;
  const strings = (x: unknown): x is string[] => Array.isArray(x) && x.every((v) => typeof v === 'string');
  if (typeof title !== 'string' || typeof note !== 'string' || !strings(columns) || columns.length === 0) return null;
  if (!Array.isArray(rows) || !rows.every((r) => strings(r) && r.length === columns.length)) return null;
  return { title, note, columns, rows: rows as string[][] };
}

/** 결과표 아래 "일주일 날씨 기록". 예시 자료를 표로 보여 줄 뿐, 시뮬레이션·결과·튜터에는 이어지지 않는다. */
export function WeekLog({ experiment }: { experiment: VariableExperiment; values: Values }) {
  const log = readWeekLog(experiment);
  if (!log) return null;
  return (
    <section className="week-log" data-testid="week-log" aria-label={log.title}>
      <h3>{log.title}</h3>
      <p className="week-log-note">{log.note}</p>
      <div className="week-log-wrap">
        <table>
          <caption className="sr-only">{log.title}</caption>
          <thead>
            <tr>
              {log.columns.map((c) => (
                <th key={c} scope="col">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {log.rows.map((r) => (
              <tr key={r[0]}>
                {r.map((cell, i) => (i === 0 ? <th key={i} scope="row">{cell}</th> : <td key={i}>{cell}</td>))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
