import { describe, expect, it } from 'vitest';
import {
  CODE_ALPHABET,
  MAX_MESSAGE_BYTES,
  normalizeCode,
  parseClientMessage,
  parseServerMessage,
} from './protocol';

const j = (o: unknown) => JSON.stringify(o);
const TOKEN = '0123456789abcdef0123456789abcdef';

describe('수업 코드', () => {
  it('헷갈리는 글자(0 O 1 I L)를 쓰지 않는다', () => {
    for (const c of '0O1IL') expect(CODE_ALPHABET).not.toContain(c);
    expect(CODE_ALPHABET).toHaveLength(31);
  });
  it('공백을 지우고 대문자로 바꾼다', () => {
    expect(normalizeCode(' abc 234 ')).toBe('ABC234');
  });
  it('길이나 글자가 틀리면 null', () => {
    expect(normalizeCode('ABC23')).toBeNull();
    expect(normalizeCode('ABC0O1')).toBeNull();
  });
});

describe('클라이언트 메시지', () => {
  it('정상 join·status·safety·safetyClear', () => {
    expect(parseClientMessage(j({ t: 'join', code: 'ABC234', group: 3, deviceTier: 'B', appVersion: '0.0.0' }))).toMatchObject({ t: 'join', group: 3 });
    expect(
      parseClientMessage(j({ t: 'status', unitId: 'g5-solution', activity: 'variable', phase: 'running', trials: 2, lastKind: 'fair-test', mismatch: false, safetyLocked: false })),
    ).toMatchObject({ t: 'status', trials: 2 });
    expect(parseClientMessage(j({ t: 'status', phase: 'idle', trials: 0, safetyLocked: false }))).not.toBeNull();
    expect(parseClientMessage(j({ t: 'safety', type: 'NO_GOGGLES', at: 1700000000000 }))).not.toBeNull();
    expect(parseClientMessage(j({ t: 'safetyClear', type: 'FOOD' }))).not.toBeNull();
  });
  it('진로 활동은 단계만 받고, 글·직업 같은 다른 필드는 거부한다', () => {
    const base = { t: 'status', unitId: 'g6-career', activity: 'portfolio', phase: 'running', trials: 3, lastKind: 'stage-3', safetyLocked: false };
    expect(parseClientMessage(j(base))).toMatchObject({ activity: 'portfolio', trials: 3 });
    expect(parseClientMessage(j({ ...base, job: 'vet' }))).toBeNull();
    expect(parseClientMessage(j({ ...base, text: '궁금한 것' }))).toBeNull();
  });
  it('정상 교사 메시지', () => {
    expect(parseClientMessage(j({ t: 'create' }))).not.toBeNull();
    expect(parseClientMessage(j({ t: 'create', secret: 'pw' }))).toMatchObject({ secret: 'pw' });
    expect(parseClientMessage(j({ t: 'create', secret: 'x'.repeat(64) }))).not.toBeNull();
    expect(parseClientMessage(j({ t: 'create', secret: 'x'.repeat(65) }))).toBeNull();
    expect(parseClientMessage(j({ t: 'create', secret: 1 }))).toBeNull();
    expect(parseServerMessage(j({ t: 'error', code: 'bad_secret' }))).not.toBeNull();
    expect(parseClientMessage(j({ t: 'watch', code: 'ABC234', token: TOKEN }))).not.toBeNull();
    expect(parseClientMessage(j({ t: 'pause', on: true }))).not.toBeNull();
    expect(parseClientMessage(j({ t: 'ack', group: 2, type: 'SPILL' }))).not.toBeNull();
    expect(parseClientMessage(j({ t: 'end' }))).not.toBeNull();
  });
  it('잘못된 메시지는 null', () => {
    expect(parseClientMessage('not json')).toBeNull();
    expect(parseClientMessage(j({ t: 'nope' }))).toBeNull();
    expect(parseClientMessage(j({ t: 'join', code: 'ABC234', group: 13, appVersion: '1' }))).toBeNull();
    expect(parseClientMessage(j({ t: 'join', code: 'ABC234', group: 0, appVersion: '1' }))).toBeNull();
    expect(parseClientMessage(j({ t: 'join', code: 'abc234', group: 1, appVersion: '1' }))).toBeNull();
    expect(parseClientMessage(j({ t: 'join', code: 'ABC234', group: 1.5, appVersion: '1' }))).toBeNull();
    expect(parseClientMessage(j({ t: 'pause', on: 'yes' }))).toBeNull();
    expect(parseClientMessage(j({ t: 'watch', code: 'ABC234', token: 'short' }))).toBeNull();
    expect(parseClientMessage(j({ t: 'safety', type: 'FIRE', at: 1 }))).toBeNull();
  });
  it('정해지지 않은 필드(예: 튜터 대화 원문)는 거절한다', () => {
    expect(parseClientMessage(j({ t: 'status', phase: 'idle', trials: 0, safetyLocked: false, tutorText: '정답은…' }))).toBeNull();
  });
  it('8 KB를 넘으면 null', () => {
    const big = j({ t: 'status', phase: 'idle', trials: 0, safetyLocked: false, lastKind: 'x'.repeat(MAX_MESSAGE_BYTES) });
    expect(parseClientMessage(big)).toBeNull();
  });
});

describe('status의 experimentId (선택, 하위 호환)', () => {
  const base = { t: 'status', unitId: 'g5-mixture', activity: 'card-sort', phase: 'running', trials: 2, safetyLocked: false };
  it('오래된 클라이언트처럼 experimentId가 없어도 통과한다', () => {
    const m = parseClientMessage(j(base));
    expect(m).toMatchObject({ t: 'status', unitId: 'g5-mixture' });
    expect(m).not.toHaveProperty('experimentId');
  });
  it('있으면 읽히고 shortText(1~64자)가 아니면 거부한다', () => {
    expect(parseClientMessage(j({ ...base, experimentId: 'separation-methods' }))).toMatchObject({ experimentId: 'separation-methods' });
    expect(parseClientMessage(j({ ...base, experimentId: '' }))).toBeNull();
    expect(parseClientMessage(j({ ...base, experimentId: 'x'.repeat(65) }))).toBeNull();
    expect(parseClientMessage(j({ ...base, experimentId: 3 }))).toBeNull();
  });
  it('교사에게 가는 스냅샷도 experimentId가 있거나 없거나 통과한다', () => {
    const group = { group: 1, online: true, lastSeen: 1, unitId: 'g5-mixture', activity: 'card-sort', phase: 'running', trials: 2, mismatch: false, safety: [], safetyLocked: false };
    for (const g of [group, { ...group, experimentId: 'separation-methods' }]) {
      expect(parseServerMessage(j({ t: 'snapshot', code: 'ABC234', paused: false, groups: [g] }))).not.toBeNull();
    }
  });
});

describe('서버 메시지', () => {
  it('정상 메시지를 읽는다', () => {
    expect(parseServerMessage(j({ t: 'joined', code: 'ABC234', group: 1 }))).not.toBeNull();
    expect(parseServerMessage(j({ t: 'error', code: 'group_taken' }))).not.toBeNull();
    expect(parseServerMessage(j({ t: 'created', code: 'ABC234', token: TOKEN }))).not.toBeNull();
    expect(
      parseServerMessage(
        j({ t: 'snapshot', code: 'ABC234', paused: false, groups: [{ group: 1, online: true, lastSeen: 1, trials: 0, mismatch: false, safety: [], safetyLocked: false }] }),
      ),
    ).not.toBeNull();
  });
  it('모르는 오류 코드는 null', () => {
    expect(parseServerMessage(j({ t: 'error', code: 'boom' }))).toBeNull();
  });
});
