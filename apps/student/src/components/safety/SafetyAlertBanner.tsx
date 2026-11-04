/** 안전 경고 배너. 같은 문구는 한 번만 보여 주고, 확인하면 닫는다. */
export function SafetyAlertBanner({ messages, onDismiss }: { messages: string[]; onDismiss: () => void }) {
  if (messages.length === 0) return null;
  return (
    <div className="alert-banner" role="alert">
      <div>
        {[...new Set(messages)].map((m) => (
          <p key={m}>{m}</p>
        ))}
      </div>
      <button type="button" onClick={onDismiss}>
        착용했어요
      </button>
    </div>
  );
}
