import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { normalizeCode } from '@sci/classroom';
import { useDeviceInfo } from '../platform/DeviceTierContext';
import { usePaused } from './bus';
import { classroom, type ClassroomState } from './client';
import { classroomUrl, configuredClassroomUrl } from './config';
import { isAppMode, loadHostAddress, parseHostAddress, saveHostAddress } from './hostAddress';

const useClassroom = (): ClassroomState => useSyncExternalStore(classroom.subscribe, classroom.getState);

const statusText = (s: ClassroomState): string =>
  `수업 ${s.session!.code} · ${s.session!.group}모둠 · ${s.link === 'online' ? '연결됨' : '다시 연결 중'}`;

/**
 * 모든 화면에서 한 번 마운트된다: 새로고침 뒤 다시 참여, 멈춤 막, 단원 화면의 작은 상태 표시.
 * (이 파일은 서버 주소가 있을 때만 불러온다.)
 */
export function ClassroomHost({ showPill }: { showPill: boolean }) {
  const state = useClassroom();
  const paused = usePaused();
  const { tier } = useDeviceInfo();
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 등급을 알 때만 다시 참여한다(deviceTier 없이 join하면 교사 화면에서 등급이 빠진다).
    const url = classroomUrl();
    if (url && tier) classroom.restore(url, tier);
  }, [tier]);

  // 막이 뜨면 포커스를 막으로 옮긴다(아래 화면은 inert라 포커스를 잃는다).
  useEffect(() => {
    if (paused) overlayRef.current?.focus();
  }, [paused]);

  return (
    <>
      {showPill && state.session && (
        <p className="classroom-pill" role="status" data-testid="classroom-status">
          {statusText(state)}
        </p>
      )}
      <div aria-live="assertive" aria-atomic="true">
        {paused && (
          <div className="pause-overlay" ref={overlayRef} tabIndex={-1} data-testid="pause-overlay">
            <p className="pause-text">선생님 말씀을 들어요 ✋</p>
          </div>
        )}
      </div>
      {paused && (
        // 아래 화면은 inert라서, 선생님이 사라져도 나갈 수 있게 막 위에 따로 버튼을 둔다(막의 문구와는 별개).
        <div className="pause-leave-wrap">
          <button type="button" className="pause-leave" data-testid="pause-leave" onClick={() => classroom.leave()}>
            수업 나가기
          </button>
        </div>
      )}
    </>
  );
}

const FOCUSABLE = 'input:not([disabled]), button:not([disabled]), [href], select, textarea, [tabindex]:not([tabindex="-1"])';

/** 단원 목록 머리글: 수업 참여 버튼, 참여 중이면 상태와 나가기. */
export function ClassroomControl() {
  const state = useClassroom();
  const [open, setOpen] = useState(false);
  return (
    <div className="classroom-control">
      {state.session && !(open && state.link === 'connecting') ? (
        <>
          <span role="status" data-testid="classroom-status">
            {statusText(state)}
          </span>
          <button type="button" onClick={() => classroom.leave()}>
            수업 나가기
          </button>
        </>
      ) : (
        <button type="button" onClick={() => setOpen(true)}>
          수업 참여
        </button>
      )}
      {state.notice && !state.session && (
        <p role="alert" className="classroom-notice">
          {state.notice}{' '}
          <button type="button" onClick={() => classroom.clearNotice()}>
            확인
          </button>
        </p>
      )}
      {open && <JoinDialog onClose={() => setOpen(false)} />}
    </div>
  );
}

function JoinDialog({ onClose }: { onClose: () => void }) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const state = useClassroom();
  const { tier } = useDeviceInfo();
  const [code, setCode] = useState('');
  const [group, setGroup] = useState<number | null>(null);
  // 앱(APK)에서는 선생님 PC 주소를 입력받는다. 웹은 지금까지처럼 주소창의 ?classroom=·빌드 변수만 쓴다.
  const appMode = useMemo(() => isAppMode(), []);
  const [host, setHost] = useState(() => (appMode ? loadHostAddress() : ''));
  const hostUrl = appMode && host.trim() ? parseHostAddress(host) : null;
  const hostBad = appMode && host.trim() !== '' && hostUrl === null;
  // 앱에서 칸을 비우면 빌드 변수·?classroom=로 정한 주소를 쓴다(없으면 참여할 수 없다).
  const targetUrl = appMode ? (host.trim() ? hostUrl : configuredClassroomUrl()) : classroomUrl();
  const normalized = normalizeCode(code);
  const joining = state.link === 'connecting';
  const joined = state.session !== null && state.link === 'online';

  // 참여가 끝나면 대화상자를 닫는다.
  useEffect(() => {
    if (joined) onClose();
  }, [joined, onClose]);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    classroom.clearError();
    return () => opener?.focus?.();
  }, []);

  const submit = () => {
    const url = targetUrl;
    if (!url || !normalized || group === null || joining) return;
    // 쓴 주소를 기억한다(앱을 다시 켜도 다시 참여할 수 있게). 주소 문자열만 저장한다.
    if (appMode && host.trim()) saveHostAddress(host);
    classroom.join(url, tier, { code: normalized, group });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
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
        <h2 id={titleId}>수업 참여</h2>
        {appMode && (
          <div className="host-field-wrap">
            <label className="code-field host-field">
              <span>선생님 PC 주소</span>
              <input
                type="text"
                value={host}
                maxLength={200}
                inputMode="url"
                autoCapitalize="none"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder="192.168.0.10:8787"
                aria-invalid={hostBad}
                aria-describedby={`${titleId}-host`}
                onChange={(e) => setHost(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submit();
                }}
              />
            </label>
            <small id={`${titleId}-host`}>{hostBad ? '주소를 다시 확인해 주세요. 예: 192.168.0.10:8787' : '선생님 화면에 보이는 「학생 앱에 입력할 주소」를 쓰세요.'}</small>
          </div>
        )}
        <p>선생님이 칠판에 쓴 수업 코드 6자와 우리 모둠 번호를 골라 주세요.</p>
        <label className="code-field">
          <span>수업 코드 (6자)</span>
          <input
            type="text"
            value={code}
            maxLength={6}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
            }}
          />
        </label>
        <fieldset className="plain predict-group">
          <legend>모둠 번호</legend>
          <div className="choices">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
              <button key={n} type="button" className={group === n ? 'selected' : ''} aria-pressed={group === n} onClick={() => setGroup(n)}>
                {n}모둠
              </button>
            ))}
          </div>
        </fieldset>
        <div role="alert" className="classroom-error">
          {state.error}
        </div>
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            닫기
          </button>
          <button type="button" className="run" disabled={!normalized || group === null || joining || !targetUrl} onClick={submit}>
            {joining ? '연결 중…' : '참여하기'}
          </button>
        </div>
      </div>
    </div>
  );
}
