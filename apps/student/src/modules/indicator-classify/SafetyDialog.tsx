import { useEffect, useId, useRef, useState } from 'react';

const FOCUSABLE = 'input:not([disabled]), button:not([disabled]), [href], select, textarea, [tabindex]:not([tabindex="-1"])';

/** 안전 점검표 대화상자. 모두 체크해야 확인할 수 있고, Esc로 닫는다. 포커스는 대화상자 안에 가둔다. */
export function SafetyDialog({
  items,
  onConfirm,
  onCancel,
}: {
  items: string[];
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const [checked, setChecked] = useState<boolean[]>(() => items.map(() => false));
  const allChecked = checked.every(Boolean);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    return () => opener?.focus?.();
  }, []);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onCancel();
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
        <h2 id={titleId}>안전 점검표</h2>
        <p>위험한 용액을 시험하기 전에 모두 확인해 주세요.</p>
        <ul className="checklist">
          {items.map((text, i) => (
            <li key={text}>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={checked[i]}
                  onChange={(e) => setChecked((c) => c.map((v, j) => (j === i ? e.target.checked : v)))}
                />
                <span>{text}</span>
              </label>
            </li>
          ))}
        </ul>
        <div className="modal-actions">
          <button type="button" onClick={onCancel}>
            닫기
          </button>
          <button type="button" className="run" disabled={!allChecked} onClick={onConfirm}>
            확인했어요
          </button>
        </div>
      </div>
    </div>
  );
}
