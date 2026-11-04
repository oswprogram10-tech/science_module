import type { SafetyEventType } from '@sci/vision';
import { MOCK_LABELS, MOCK_TYPES } from './safetyMessages';

/** 개발용(`?dev=1`) 모의 안전 상황 패널. */
export function MockSafetyPanel({ onTrigger }: { onTrigger: (type: SafetyEventType) => void }) {
  return (
    <section className="panel dev-panel" aria-label="개발용: 모의 안전 상황">
      <h2>개발용: 모의 안전 상황</h2>
      <div className="choices">
        {MOCK_TYPES.map((t) => (
          <button key={t} type="button" onClick={() => onTrigger(t)}>
            {MOCK_LABELS[t]} ({t})
          </button>
        ))}
      </div>
    </section>
  );
}
