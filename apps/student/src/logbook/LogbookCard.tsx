import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { UNAVAILABLE_TEXT, logbook, useLogbookVersion } from './index';

const FOCUSABLE = 'input:not([disabled]), button:not([disabled]), [href], select, textarea, [tabindex]:not([tabindex="-1"])';

/** 쉬운 말 안내 대화상자. Esc는 취소와 같고, 포커스는 안에 가둔다. */
function LogbookDialog({ title, children, onCancel }: { title: string; children: ReactNode; onCancel: () => void }) {
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
        <h2 id={titleId}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

/** 켜기 전에 보여 주는 안내. 꼭 알아야 할 다섯 가지를 쉬운 말로 쓴다. */
export const CONSENT_POINTS = [
  '남기는 것: 어느 단원에서 어떤 탐구를 했는지, 날짜, 해 본 횟수 같은 짧은 요약이에요. 이름은 남기지 않아요. 진로 단원에서 쓴 글은 저장할 때만 남아요.',
  '이 기기에만 남아요.',
  '서버나 선생님 화면으로 보내지 않아요.',
  '언제든 "모두 지우기"로 전부 지울 수 있어요.',
  '같은 기기를 쓰는 친구가 이 기록을 볼 수 있어요. 함께 쓰는 기기라면 켜기 전에 생각해 보세요.',
] as const;

type Dialog = null | 'consent' | 'off';

/** 단원 목록에 놓는 "탐구 기록장" 카드: 켜기(안내 대화상자), 끄기(지울지 묻기), 모두 지우기. */
export function LogbookCard() {
  useLogbookVersion();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [msg, setMsg] = useState('');
  const enabled = logbook.isEnabled();
  const usable = logbook.usable();
  const stored = logbook.hasStoredData();
  const count = logbook.entries().length;

  const turnOn = () => {
    setDialog(null);
    setMsg(logbook.enable() ? '기록장을 켰어요.' : `켜지 못했어요. ${UNAVAILABLE_TEXT}.`);
  };
  const turnOff = (clear: boolean) => {
    setDialog(null);
    const ok = logbook.disable(clear);
    setMsg(!ok ? '기록장을 끄지 못했어요.' : clear ? '기록장을 끄고 기록을 모두 지웠어요.' : '기록장을 껐어요. 남은 기록은 이 기기에 있어요.');
  };
  const wipe = () => setMsg(logbook.clearAll() ? '기록을 모두 지웠어요. 기록장은 꺼져 있어요.' : '지우지 못했어요.');

  return (
    <section className="logbook-card" aria-labelledby="logbook-h">
      <h2 id="logbook-h">탐구 기록장</h2>
      {!usable ? (
        <p className="logbook-warn" role="status">{UNAVAILABLE_TEXT}</p>
      ) : enabled ? (
        <>
          <p>켜져 있어요. 단원에서 한 탐구가 이 기기에 짧은 요약으로 남아요. (남은 기록 {count}개)</p>
          <div className="logbook-actions">
            <button type="button" onClick={() => setDialog('off')}>기록장 끄기</button>
            <button type="button" onClick={wipe}>모두 지우기</button>
          </div>
        </>
      ) : (
        <>
          <p>
            내가 한 탐구를 이 기기에 남겨 두는 기능이에요. 지금은 꺼져 있어서 아무것도 남지 않아요.
            {stored && ' 이전에 남긴 기록이 이 기기에 있어요.'}
          </p>
          <div className="logbook-actions">
            <button type="button" onClick={() => setDialog('consent')}>기록장 켜기</button>
            {stored && <button type="button" onClick={wipe}>모두 지우기</button>}
          </div>
        </>
      )}
      <p className="logbook-msg" role="status">{msg}</p>

      {dialog === 'consent' && (
        <LogbookDialog title="탐구 기록장을 켤까요?" onCancel={() => setDialog(null)}>
          <ul className="consent-list">
            {CONSENT_POINTS.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <div className="modal-actions">
            <button type="button" onClick={() => setDialog(null)}>안 켤래요</button>
            <button type="button" className="run" onClick={turnOn}>켤게요</button>
          </div>
        </LogbookDialog>
      )}
      {dialog === 'off' && (
        <LogbookDialog title="기록장을 끌까요?" onCancel={() => setDialog(null)}>
          <p>끄면 앞으로는 기록하지 않아요. 지금까지 남은 기록도 지울까요?</p>
          <div className="modal-actions">
            <button type="button" onClick={() => setDialog(null)}>취소</button>
            <button type="button" onClick={() => turnOff(false)}>기록은 남기고 끄기</button>
            <button type="button" className="run" onClick={() => turnOff(true)}>기록도 지우고 끄기</button>
          </div>
        </LogbookDialog>
      )}
    </section>
  );
}
