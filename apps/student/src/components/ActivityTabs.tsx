import { createContext, useContext, useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import type { ActivityEntry } from '../units';

/** 활동이 둘 이상인 단원의 활동 탭. 활동이 하나인 단원은 이 컨텍스트가 비어 있어 아무것도 그려지지 않는다. */
export const ActivityTabsContext = createContext<ReactNode>(null);

/** 각 실험 화면이 단원 머리 아래에 둔다. 탭이 없으면 null이라 DOM에 아무것도 남지 않는다. */
export function ActivityTabsSlot() {
  return <>{useContext(ActivityTabsContext)}</>;
}

/** 고른 활동 화면을 감싸는 탭 패널의 id. 패널은 하나이고 고른 탭만 이 패널을 가리킨다(고르지 않은 활동의 화면은 만들지 않음). */
export const ACTIVITY_PANEL_ID = 'activity-panel';
export const activityTabId = (experimentId: string) => `activity-tab-${experimentId}`;

/** 탭을 바꾸면 화면이 새로 만들어지므로, 키보드로 바꾼 직후에는 새 화면의 선택된 탭으로 초점을 돌려준다. */
let refocusSelected = false;

export function ActivityTabs({
  activities,
  currentId,
  onSelect,
}: {
  activities: ActivityEntry[];
  currentId: string;
  onSelect: (experimentId: string) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = Math.max(0, activities.findIndex((a) => a.experiment.id === currentId));

  useEffect(() => {
    if (!refocusSelected) return;
    refocusSelected = false;
    refs.current[current]?.focus();
  }, [current]);

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const n = activities.length;
    const next =
      e.key === 'ArrowRight' || e.key === 'ArrowDown' ? (i + 1) % n
      : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? (i + n - 1) % n
      : e.key === 'Home' ? 0
      : e.key === 'End' ? n - 1
      : -1;
    if (next < 0) return;
    e.preventDefault();
    refocusSelected = true;
    onSelect(activities[next]!.experiment.id);
  };

  return (
    <div className="activity-tabs" role="tablist" aria-label="활동 고르기">
      {activities.map((a, i) => (
        <button
          key={a.experiment.id}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="tab"
          id={activityTabId(a.experiment.id)}
          aria-selected={i === current}
          aria-controls={i === current ? ACTIVITY_PANEL_ID : undefined}
          tabIndex={i === current ? 0 : -1}
          className={`activity-tab${i === current ? ' selected' : ''}`}
          onClick={() => {
            if (i !== current) onSelect(a.experiment.id);
          }}
          onKeyDown={(e) => onKeyDown(e, i)}
        >
          활동 {i + 1} · {a.experiment.title}
        </button>
      ))}
    </div>
  );
}
