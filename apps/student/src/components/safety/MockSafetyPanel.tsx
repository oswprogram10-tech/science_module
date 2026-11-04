import type { SafetyEventType } from '@sci/vision';
import { useDeviceInfo } from '../../platform/DeviceTierContext';
import { MOCK_LABELS, MOCK_TYPES } from './safetyMessages';

/** 개발용(`?dev=1`) 모의 안전 상황 패널. */
export function MockSafetyPanel({ onTrigger }: { onTrigger: (type: SafetyEventType) => void }) {
  const { tier, signals, forced } = useDeviceInfo();
  const mem = signals?.memoryGb === undefined ? '메모리 알 수 없음' : `메모리 ${signals.memoryGb} GB`;
  const cores = signals?.cores === undefined ? '코어 알 수 없음' : `코어 ${signals.cores}`;
  return (
    <>
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
    <section className="panel dev-panel" aria-label="개발용: 기기 등급">
      <h2>개발용: 기기 등급</h2>
      <p data-testid="device-tier">
        기기 등급 {tier} ({mem}, {cores}{forced ? ', 주소로 지정' : ''})
      </p>
    </section>
    </>
  );
}
