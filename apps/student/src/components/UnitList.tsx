import type { UnitEntry } from '../units';

export function UnitList({ units, hrefOf }: { units: UnitEntry[]; hrefOf: (id: string) => string }) {
  const grades = [
    ...new Set(units.filter((u) => u.ok).map((u) => (u as Extract<UnitEntry, { ok: true }>).manifest.grade)),
  ].sort((a, b) => a - b);
  const broken = units.filter((u): u is Extract<UnitEntry, { ok: false }> => !u.ok);

  return (
    <div className="app">
      <header className="top">
        <h1>과학 실험 단원 목록</h1>
        <p className="question">실험해 볼 단원을 골라 주세요.</p>
      </header>
      <main className="unit-list">
        {grades.map((grade) => (
          <section key={grade} aria-labelledby={`grade-${grade}`}>
            <h2 id={`grade-${grade}`}>{grade}학년</h2>
            <ul className="cards">
              {units.map((u) =>
                u.ok && u.manifest.grade === grade ? (
                  <li key={u.id}>
                    <button type="button" className="unit-card" onClick={() => (window.location.hash = hrefOf(u.id))}>
                      <span className="unit-title">{u.manifest.title}</span>
                      <span className="unit-question">탐구 질문: {u.experiment.question}</span>
                      {u.manifest.standards.length > 0 && (
                        <span className="unit-standards">성취기준 {u.manifest.standards.join(', ')}</span>
                      )}
                    </button>
                  </li>
                ) : null,
              )}
            </ul>
          </section>
        ))}
        {broken.length > 0 && (
          <section aria-labelledby="unit-errors">
            <h2 id="unit-errors">불러오지 못한 단원</h2>
            <ul className="cards">
              {broken.map((u) => (
                <li key={u.id} className="unit-card error" role="alert">
                  <span className="unit-title">{u.title}</span>
                  <span>콘텐츠를 불러오지 못했어요. 매니페스트 검증에 실패했습니다.</span>
                  <ul>
                    {u.issues.map((i) => (
                      <li key={i}>{i}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
