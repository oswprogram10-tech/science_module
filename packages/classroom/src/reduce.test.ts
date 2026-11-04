import { describe, expect, it } from 'vitest';
import { EXPIRE_MS, STALE_MS, checkJoin, createClass, isExpired, reduce, toSnapshot, type ClassEvent, type ClassState } from './reduce';

const T0 = 1_000_000;
const run = (s: ClassState, ...events: ClassEvent[]) => events.reduce(reduce, s);
const fresh = () => createClass('ABC234', T0);
const status = { unitId: 'g5-solution', activity: 'variable' as const, phase: 'running' as const, trials: 1, safetyLocked: false };

describe('reduce: 참여', () => {
  it('모둠이 참여하면 연결됨', () => {
    const s = run(fresh(), { type: 'join', group: 3, deviceTier: 'B', now: T0 + 1 });
    expect(toSnapshot(s).groups).toEqual([
      { group: 3, online: true, lastSeen: T0 + 1, deviceTier: 'B', trials: 0, mismatch: false, safety: [], safetyLocked: false },
    ]);
  });
  it('모둠 번호 순으로 정렬한다', () => {
    const s = run(fresh(), { type: 'join', group: 5, now: T0 }, { type: 'join', group: 2, now: T0 });
    expect(toSnapshot(s).groups.map((g) => g.group)).toEqual([2, 5]);
  });
  it('같은 모둠이 연결 중이면 group_taken', () => {
    const s = run(fresh(), { type: 'join', group: 2, now: T0 });
    expect(checkJoin(s, 2, T0 + 1000)).toBe('group_taken');
    expect(checkJoin(s, 3, T0 + 1000)).toBeNull();
    // 거절된 join은 상태를 바꾸지 않는다.
    expect(reduce(s, { type: 'join', group: 2, deviceTier: 'C', now: T0 + 1000 })).toBe(s);
  });
  it('30초 넘게 조용한 연결은 새 연결로 바꾼다(재접속 교체)', () => {
    let s = run(fresh(), { type: 'join', group: 2, deviceTier: 'A', now: T0 }, { type: 'status', group: 2, status, now: T0 + 100 });
    expect(checkJoin(s, 2, T0 + 100 + STALE_MS)).toBeNull();
    s = reduce(s, { type: 'join', group: 2, deviceTier: 'C', now: T0 + 100 + STALE_MS });
    const g = toSnapshot(s).groups[0]!;
    expect(g.online).toBe(true);
    expect(g.deviceTier).toBe('C');
    expect(g.trials).toBe(1); // 상태는 이어진다
  });
  it('끊긴 모둠은 바로 다시 참여할 수 있고 마지막 응답 시각이 남는다', () => {
    let s = run(fresh(), { type: 'join', group: 2, now: T0 }, { type: 'leave', group: 2, now: T0 + 5000 });
    const g = toSnapshot(s).groups[0]!;
    expect(g.online).toBe(false);
    expect(g.lastSeen).toBe(T0);
    expect(checkJoin(s, 2, T0 + 6000)).toBeNull();
    s = reduce(s, { type: 'join', group: 2, now: T0 + 6000 });
    expect(toSnapshot(s).groups[0]!.online).toBe(true);
  });
  it('seen은 lastSeen을 늘려 교체를 막는다', () => {
    const s = run(fresh(), { type: 'join', group: 2, now: T0 }, { type: 'seen', group: 2, now: T0 + 29_000 });
    expect(checkJoin(s, 2, T0 + 40_000)).toBe('group_taken');
  });
});

describe('reduce: 상태·경고', () => {
  const joined = () => run(fresh(), { type: 'join', group: 1, now: T0 });
  it('status가 카드에 반영된다', () => {
    const s = reduce(joined(), { type: 'status', group: 1, status: { ...status, lastKind: 'confounded', mismatch: true }, now: T0 + 10 });
    expect(toSnapshot(s).groups[0]).toMatchObject({ unitId: 'g5-solution', activity: 'variable', phase: 'running', trials: 1, lastKind: 'confounded', mismatch: true });
  });
  it('참여하지 않은 모둠의 이벤트는 무시한다', () => {
    const s = fresh();
    expect(reduce(s, { type: 'status', group: 4, status, now: T0 })).toBe(s);
    expect(reduce(s, { type: 'safety', group: 4, safetyType: 'SPILL', at: 1, now: T0 })).toBe(s);
  });
  it('경고 -> 확인 -> 학생이 닫음: 둘 다 해야 사라진다', () => {
    let s = reduce(joined(), { type: 'safety', group: 1, safetyType: 'NO_GOGGLES', at: 111, now: T0 + 1 });
    expect(toSnapshot(s).groups[0]!.safety).toEqual([{ type: 'NO_GOGGLES', at: 111, acked: false }]);
    s = reduce(s, { type: 'ack', group: 1, safetyType: 'NO_GOGGLES', now: T0 + 2 });
    expect(toSnapshot(s).groups[0]!.safety).toEqual([{ type: 'NO_GOGGLES', at: 111, acked: true }]);
    s = reduce(s, { type: 'safetyClear', group: 1, safetyType: 'NO_GOGGLES', now: T0 + 3 });
    expect(toSnapshot(s).groups[0]!.safety).toEqual([]);
  });
  it('학생이 먼저 닫아도 교사가 확인하기 전에는 남는다', () => {
    let s = reduce(joined(), { type: 'safety', group: 1, safetyType: 'FOOD', at: 5, now: T0 + 1 });
    s = reduce(s, { type: 'safetyClear', group: 1, safetyType: 'FOOD', now: T0 + 2 });
    expect(toSnapshot(s).groups[0]!.safety).toEqual([{ type: 'FOOD', at: 5, acked: false }]);
    s = reduce(s, { type: 'ack', group: 1, safetyType: 'FOOD', now: T0 + 3 });
    expect(toSnapshot(s).groups[0]!.safety).toEqual([]);
  });
  it('같은 종류의 경고가 다시 오면 새 경고로 센다', () => {
    let s = reduce(joined(), { type: 'safety', group: 1, safetyType: 'SPILL', at: 1, now: T0 + 1 });
    s = reduce(s, { type: 'ack', group: 1, safetyType: 'SPILL', now: T0 + 2 });
    s = reduce(s, { type: 'safety', group: 1, safetyType: 'SPILL', at: 9, now: T0 + 3 });
    expect(toSnapshot(s).groups[0]!.safety).toEqual([{ type: 'SPILL', at: 9, acked: false }]);
  });
  it('끊겼다 다시 와도 경고가 남는다', () => {
    let s = reduce(joined(), { type: 'safety', group: 1, safetyType: 'NO_GLOVES', at: 1, now: T0 + 1 });
    s = run(s, { type: 'leave', group: 1, now: T0 + 2 }, { type: 'join', group: 1, now: T0 + 3 });
    expect(toSnapshot(s).groups[0]!.safety).toHaveLength(1);
  });
});

describe('reduce: 멈춤·만료', () => {
  it('pause on/off', () => {
    let s = reduce(fresh(), { type: 'pause', on: true, now: T0 + 1 });
    expect(toSnapshot(s).paused).toBe(true);
    s = reduce(s, { type: 'pause', on: false, now: T0 + 2 });
    expect(toSnapshot(s).paused).toBe(false);
  });
  it('연결이 없고 6시간이 지나면 만료', () => {
    const s = fresh();
    expect(isExpired(s, T0 + EXPIRE_MS - 1, false)).toBe(false);
    expect(isExpired(s, T0 + EXPIRE_MS, false)).toBe(true);
    expect(isExpired(s, T0 + EXPIRE_MS, true)).toBe(false);
  });
  it('활동이 있으면 만료 시계가 다시 시작한다', () => {
    const s = reduce(fresh(), { type: 'touch', now: T0 + EXPIRE_MS - 10 });
    expect(isExpired(s, T0 + EXPIRE_MS + 10, false)).toBe(false);
  });
});

describe('리뷰 반영 v0.1', () => {
  const joined = () => reduce(fresh(), { type: 'join', group: 1, now: T0 });
  const locked = { ...status, safetyLocked: true };
  it('STALE_MS는 75초(ping 30초의 2.5배)', () => {
    expect(STALE_MS).toBe(75_000);
  });
  it('잠금 없음 status가 오면 교사가 확인한 경고는 지우고 미확인 경고는 남긴다', () => {
    let s = run(joined(), { type: 'safety', group: 1, safetyType: 'SPILL', at: 1, now: T0 + 1 }, { type: 'safety', group: 1, safetyType: 'FOOD', at: 2, now: T0 + 1 });
    s = run(s, { type: 'status', group: 1, status: locked, now: T0 + 2 }, { type: 'ack', group: 1, safetyType: 'SPILL', now: T0 + 3 });
    // 잠긴 채라면 확인된 경고도 남는다
    s = reduce(s, { type: 'status', group: 1, status: locked, now: T0 + 4 });
    expect(toSnapshot(s).groups[0]!.safety.map((x) => [x.type, x.acked])).toEqual([['SPILL', true], ['FOOD', false]]);
    s = reduce(s, { type: 'status', group: 1, status, now: T0 + 5 });
    expect(toSnapshot(s).groups[0]!.safety.map((x) => [x.type, x.acked])).toEqual([['FOOD', false]]);
  });
  it('잠금 없음으로 끝난 모둠이 다시 join하면 확인된 경고를 지운다', () => {
    let s = run(joined(), { type: 'status', group: 1, status, now: T0 + 1 }, { type: 'safety', group: 1, safetyType: 'SPILL', at: 1, now: T0 + 2 }, { type: 'ack', group: 1, safetyType: 'SPILL', now: T0 + 3 });
    s = run(s, { type: 'leave', group: 1, now: T0 + 4 }, { type: 'join', group: 1, now: T0 + 5 });
    expect(toSnapshot(s).groups[0]!.safety).toEqual([]);
  });
});

