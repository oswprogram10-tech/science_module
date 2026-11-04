import { useState } from 'react';
import { COUNT_MAX, COUNT_MIN, COUNT_SECONDS, SLOT_KEYS, SLOT_LABEL, type SlotKey } from './model';
import { useRealPulse } from './useRealPulse';
import { ConsentDialog } from './ConsentDialog';
import type { ControllerDeps } from './controller';

export type FriendPulse = Record<SlotKey, number | null>;

/**
 * 결과표 아래의 "내 맥박 재기(선택)". 기본은 접혀 있다.
 * friend는 같은 시점의 가상 친구 값이다. 내 값은 시뮬레이션·결과표·예측 비교·튜터에 연결하지 않는다.
 */
export function RealPulsePanel({ friend, controllerDeps }: { friend: FriendPulse; controllerDeps?: Partial<Omit<ControllerDeps, 'dispatch'>> }) {
  const [state, ctl] = useRealPulse(controllerDeps);
  const [asking, setAsking] = useState(false);
  const locked = !state.consent;
  const busy = state.counting !== null || state.entering !== null;

  return (
    <details
      className="real-pulse box"
      onToggle={(e) => {
        // 처음 펼칠 때 허가를 묻는다.
        if ((e.currentTarget as HTMLDetailsElement).open && !state.consent) setAsking(true);
      }}
    >
      <summary>내 맥박 재기(선택)</summary>
      <p className="rp-notice">내 맥박은 사람마다 달라요. 가상 친구와 똑같지 않아도 괜찮아요.</p>

      {locked ? (
        <p className="rp-consent-state">
          <span className="tag">허가 전</span> 내 맥박을 재려면 먼저 허가가 필요해요.{' '}
          <button type="button" onClick={() => setAsking(true)}>허가 화면 열기</button>
        </p>
      ) : (
        <p className="rp-consent-state"><span className="tag control">허가함</span> 값은 이 기기 안에만 있고 곧 지워져요.</p>
      )}

      <div className="rp-ble">
        {state.ble === 'connected' ? (
          <button type="button" disabled={locked} onClick={ctl.disconnectBle}>심박 센서 연결 끊기</button>
        ) : (
          <button type="button" disabled={locked || state.ble === 'connecting'} onClick={ctl.connectBle}>블루투스 심박 센서 연결</button>
        )}
        <span className="rp-ble-status" role="status" aria-live="polite">
          {state.ble === 'connected'
            ? `센서 연결됨${state.live === null ? ' · 값을 기다리는 중' : ` · 최근 값 ${state.live}회/분`}`
            : state.bleMessage}
        </span>
      </div>

      <ul className="rp-slots" aria-label="내 맥박과 가상 친구 맥박">
        {SLOT_KEYS.map((k) => {
          const mine = state.slots[k];
          const counting = state.counting?.slot === k ? state.counting : null;
          const entering = state.entering === k;
          return (
            <li key={k} className="rp-slot" data-slot={k}>
              <strong className="rp-slot-name">{SLOT_LABEL[k]}</strong>
              <span className="rp-mine">
                내 측정: <output aria-label={`${SLOT_LABEL[k]} 내 맥박`}>{mine === null ? '–' : `${mine}회/분`}</output>
              </span>
              <span className="rp-friend">
                가상 친구: <output aria-label={`${SLOT_LABEL[k]} 가상 친구 맥박`}>{friend[k] === null ? '–' : `${friend[k]}회/분`}</output>
              </span>
              <span className="rp-actions">
                {counting ? (
                  <>
                    <span role="timer" aria-live="off" className="rp-timer">남은 시간 {counting.remaining}초</span>
                    <button type="button" onClick={ctl.cancelCount}>멈추기</button>
                  </>
                ) : entering ? (
                  <form
                    className="rp-enter"
                    onSubmit={(e) => {
                      e.preventDefault();
                      ctl.submitCount(k, state.draft);
                    }}
                  >
                    <label>
                      {COUNT_SECONDS}초 동안 센 횟수
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        autoFocus
                        value={state.draft}
                        aria-describedby="rp-hint"
                        onChange={(e) => ctl.setDraft(e.target.value)}
                      />
                    </label>
                    <button type="submit">기록(×4)</button>
                  </form>
                ) : (
                  <>
                    <button type="button" disabled={locked || busy} onClick={() => ctl.startCount(k)}>{COUNT_SECONDS}초 재기</button>
                    {state.ble === 'connected' && (
                      <button type="button" disabled={locked || state.live === null} onClick={() => state.live !== null && ctl.saveLive(k, state.live)}>센서 값 넣기</button>
                    )}
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      <p id="rp-hint" className="rp-hint">손목에 손가락을 대고 {COUNT_SECONDS}초 동안 센 횟수({COUNT_MIN}~{COUNT_MAX})를 넣으면 4를 곱해 1분 값으로 적어요.</p>
      {state.error && <p className="rp-error" role="alert">{state.error}</p>}
      <p className="rp-notice-wipe" role="status" aria-live="polite">{state.notice}</p>

      <div className="rp-buttons">
        <button type="button" disabled={locked} onClick={ctl.clear}>지금 지우기</button>
        <button type="button" disabled={locked} onClick={ctl.withdraw}>그만두기</button>
      </div>

      {asking && (
        <ConsentDialog
          onGrant={() => {
            ctl.grant();
            setAsking(false);
          }}
          onDecline={() => setAsking(false)}
        />
      )}
    </details>
  );
}
