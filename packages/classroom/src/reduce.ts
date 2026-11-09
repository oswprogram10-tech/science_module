import {
  MAX_GROUPS,
  type DeviceTier,
  type ErrorCode,
  type GroupView,
  type SafetyType,
  type Snapshot,
  type StatusMessage,
} from './protocol';

/**
 * 연결이 이 시간(ms) 넘게 조용하면 같은 모둠 번호의 새 연결로 바꾼다.
 * ping은 30초마다 보내고, 한 번 놓쳐도 바로 바뀌지 않도록 ping 간격의 2.5배로 둔다.
 */
export const STALE_MS = 75_000;
/** 연결이 하나도 없이 이 시간이 지나면 수업을 지운다. */
export const EXPIRE_MS = 6 * 60 * 60 * 1000;
/** 교사 연결이 이 시간(ms) 동안 하나도 없으면(학생이 남아 있어도) 수업을 지운다. */
export const TEACHERLESS_EXPIRE_MS = 30 * 60 * 1000;
/** 멈춤 상태에서 교사 연결이 이 시간(ms) 동안 없으면 멈춤을 푼다. */
export const TEACHER_GONE_UNPAUSE_MS = 30_000;

export interface SafetyEntry {
  type: SafetyType;
  at: number;
  acked: boolean;
  /** 학생이 배너를 닫았는가. 교사가 확인하고 학생도 닫아야 목록에서 빠진다. */
  cleared: boolean;
}

export interface GroupRecord {
  group: number;
  online: boolean;
  lastSeen: number;
  deviceTier?: DeviceTier;
  status?: Omit<StatusMessage, 't'>;
  safety: SafetyEntry[];
}

export interface ClassState {
  code: string;
  paused: boolean;
  createdAt: number;
  lastActivity: number;
  groups: Record<number, GroupRecord | undefined>;
}

export type ClassEvent =
  | { type: 'join'; group: number; deviceTier?: DeviceTier; now: number }
  | { type: 'leave'; group: number; now: number }
  | { type: 'seen'; group: number; now: number }
  | { type: 'status'; group: number; status: Omit<StatusMessage, 't'>; now: number }
  | { type: 'safety'; group: number; safetyType: SafetyType; at: number; now: number }
  | { type: 'safetyClear'; group: number; safetyType: SafetyType; now: number }
  | { type: 'ack'; group: number; safetyType: SafetyType; now: number }
  | { type: 'pause'; on: boolean; now: number }
  | { type: 'touch'; now: number };

export function createClass(code: string, now: number): ClassState {
  return { code, paused: false, createdAt: now, lastActivity: now, groups: {} };
}

/** 모둠이 들어올 수 있는가. 안 되면 오류 코드를 돌려준다. */
export function checkJoin(state: ClassState, group: number, now: number): ErrorCode | null {
  const g = state.groups[group];
  if (!g) return Object.keys(state.groups).length >= MAX_GROUPS ? 'class_full' : null;
  if (g.online && now - g.lastSeen < STALE_MS) return 'group_taken';
  return null;
}

/** 연결이 없고 마지막 활동이 오래됐는가. hasConnections: 교사나 학생 연결이 하나라도 있는가. */
export function isExpired(state: ClassState, now: number, hasConnections: boolean): boolean {
  return !hasConnections && now - state.lastActivity >= EXPIRE_MS;
}

const dropAcked = (list: SafetyEntry[]): SafetyEntry[] => list.filter((s) => !s.acked);

function withGroup(state: ClassState, group: number, now: number, fn: (g: GroupRecord) => GroupRecord): ClassState {
  const prev = state.groups[group];
  if (!prev) return state;
  return { ...state, lastActivity: now, groups: { ...state.groups, [group]: fn({ ...prev, lastSeen: now }) } };
}

/** 서버 상태 변화. 순수 함수이며 규칙에 맞지 않는 이벤트는 상태를 그대로 돌려준다. */
export function reduce(state: ClassState, event: ClassEvent): ClassState {
  switch (event.type) {
    case 'join': {
      if (checkJoin(state, event.group, event.now) !== null) return state;
      const prev = state.groups[event.group];
      const rec: GroupRecord = {
        group: event.group,
        online: true,
        lastSeen: event.now,
        ...(event.deviceTier ? { deviceTier: event.deviceTier } : {}),
        ...(prev?.status ? { status: prev.status } : {}),
        // 이전 연결의 마지막 상태가 잠금 없음이었다면 확인된 경고는 오래된 것이다.
        safety: prev ? (prev.status && !prev.status.safetyLocked ? dropAcked(prev.safety) : prev.safety) : [],
      };
      return { ...state, lastActivity: event.now, groups: { ...state.groups, [event.group]: rec } };
    }
    case 'leave': {
      const prev = state.groups[event.group];
      if (!prev) return state;
      // lastSeen은 그대로 둔다: 교사 화면의 "끊김 · n분 전"이 마지막으로 응답한 때를 가리킨다.
      return { ...state, lastActivity: event.now, groups: { ...state.groups, [event.group]: { ...prev, online: false } } };
    }
    case 'seen':
      return withGroup(state, event.group, event.now, (g) => g);
    case 'status':
      return withGroup(state, event.group, event.now, (g) => ({
        ...g,
        status: event.status,
        // 잠금이 풀렸다고 알려 오면(새로고침 등) 교사가 이미 확인한 경고는 남기지 않는다.
        safety: event.status.safetyLocked ? g.safety : dropAcked(g.safety),
      }));
    case 'safety':
      return withGroup(state, event.group, event.now, (g) => ({
        ...g,
        safety: [
          ...g.safety.filter((s) => s.type !== event.safetyType),
          { type: event.safetyType, at: event.at, acked: false, cleared: false },
        ],
      }));
    case 'safetyClear':
      return withGroup(state, event.group, event.now, (g) => ({
        ...g,
        // 교사가 아직 확인하지 않은 경고는 학생이 닫아도 남긴다.
        safety: g.safety.flatMap((s) =>
          s.type !== event.safetyType ? [s] : s.acked ? [] : [{ ...s, cleared: true }],
        ),
      }));
    case 'ack': {
      const prev = state.groups[event.group];
      if (!prev) return state;
      return {
        ...state,
        lastActivity: event.now,
        groups: {
          ...state.groups,
          [event.group]: {
            ...prev,
            safety: prev.safety.flatMap((s) =>
              s.type !== event.safetyType ? [s] : s.cleared ? [] : [{ ...s, acked: true }],
            ),
          },
        },
      };
    }
    case 'pause':
      return { ...state, paused: event.on, lastActivity: event.now };
    case 'touch':
      return { ...state, lastActivity: event.now };
  }
}

export function toGroupView(g: GroupRecord): GroupView {
  const s = g.status;
  return {
    group: g.group,
    online: g.online,
    lastSeen: g.lastSeen,
    ...(g.deviceTier ? { deviceTier: g.deviceTier } : {}),
    ...(s?.unitId ? { unitId: s.unitId } : {}),
    ...(s?.activity ? { activity: s.activity } : {}),
    ...(s?.experimentId ? { experimentId: s.experimentId } : {}),
    ...(s ? { phase: s.phase } : {}),
    trials: s?.trials ?? 0,
    ...(s?.lastKind ? { lastKind: s.lastKind } : {}),
    mismatch: s?.mismatch ?? false,
    safety: g.safety.map(({ type, at, acked }) => ({ type, at, acked })),
    safetyLocked: s?.safetyLocked ?? false,
  };
}

/** 교사에게 보낼 전체 상태. 모둠 번호 순. */
export function toSnapshot(state: ClassState): Snapshot {
  const groups = Object.values(state.groups)
    .filter((g): g is GroupRecord => !!g)
    .sort((a, b) => a.group - b.group)
    .map(toGroupView);
  return { t: 'snapshot', code: state.code, paused: state.paused, groups };
}
