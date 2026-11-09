import { useEffect, useId, useRef } from 'react';

const FOCUSABLE = 'input:not([disabled]), button:not([disabled]), [href], select, textarea, [tabindex]:not([tabindex="-1"])';

/** 내 맥박 재기 허가 화면. 허가하지 않으면 측정 기능은 잠겨 있다. Esc는 "안 할래요"와 같다. 포커스는 안에 가둔다. */
export function ConsentDialog({ onGrant, onDecline }: { onGrant: () => void; onDecline: () => void }) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    return () => opener?.focus?.();
  }, []);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onDecline();
      return;
    }
    if (e.key !== 'Tab') return;
    const nodes = ref.current ? [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)] : [];
    if (nodes.length === 0) return;
    const first = nodes[0]!;
    const last = nodes[nodes.length - 1]!;
    const active = document.activeElement;
    if (e.shiftKey && (active === first || !ref.current?.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !ref.current?.contains(active))) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="modal-backdrop">
      <div ref={ref} className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={onKeyDown}>
        <h2 id={titleId}>내 맥박 재기</h2>
        <ul className="consent-list">
          <li>내 맥박을 재서 가상 친구와 비교해 볼 수 있어요.</li>
          <li>재는 것은 손목에서 센 맥박이나, 블루투스 심박 센서가 알려 주는 심박이에요.</li>
          <li>잰 값은 이 기기 안에만 잠깐 두고 서버로 보내지 않아요.</li>
          <li>앱을 끄거나 이 단원을 나가거나 &ldquo;지금 지우기&rdquo;를 누르면 바로 지워져요.</li>
          <li>언제든 그만둘 수 있어요.</li>
        </ul>
        <div className="modal-actions">
          <button type="button" onClick={onDecline}>안 할래요</button>
          <button type="button" className="run" onClick={onGrant}>허가할게요</button>
        </div>
      </div>
    </div>
  );
}
