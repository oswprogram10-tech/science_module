// 내 맥박 재기(선택 기능)의 상태와 규칙. 실측값은 이 파일의 React 상태(메모리)에만 있다.
// 저장소(localStorage·sessionStorage·IndexedDB·Cache), 교사 연결, xAPI, 콘솔, 주소로 보내지 않는다.
// 시뮬레이션·결과표·예측 비교·튜터 입력에도 쓰지 않는다. (사양 §0 H1~H4)

export type SlotKey = 'before' | 'after' | 'later';
export const SLOT_KEYS: readonly SlotKey[] = ['before', 'after', 'later'];
export const SLOT_LABEL: Record<SlotKey, string> = { before: '운동 전', after: '운동 직후', later: '3분 뒤' };

/** 15초 동안 센 횟수로 허용하는 범위 */
export const COUNT_MIN = 5;
export const COUNT_MAX = 60;
export const COUNT_SECONDS = 15;
/** 마지막 측정 뒤 이 시간이 지나면 지운다(밀리초). */
export const EXPIRE_MS = 30 * 60 * 1000;

/** 15초 동안 센 횟수(5~60의 정수) → 회/분(×4). 올바르지 않으면 null. */
export function countToBpm(text: string): number | null {
  if (!/^\s*\d{1,3}\s*$/.test(text)) return null;
  const n = Number(text);
  return n >= COUNT_MIN && n <= COUNT_MAX ? n * 4 : null;
}

export type BleStatus = 'idle' | 'connecting' | 'connected' | 'error';

export interface RealPulseState {
  /** 허가 여부. 앱이 켜져 있는 동안만 유효하고 저장하지 않는다. */
  consent: boolean;
  slots: Record<SlotKey, number | null>;
  /** 블루투스 심박 센서가 보낸 가장 최근 값 */
  live: number | null;
  ble: BleStatus;
  bleMessage: string;
  /** 15초 세기 진행 중 */
  counting: { slot: SlotKey; remaining: number } | null;
  /** 15초가 끝나 센 횟수를 입력받는 중 */
  entering: SlotKey | null;
  draft: string;
  error: string;
  /** 지웠다는 안내(화면에 값은 없다) */
  notice: string;
}

export const emptySlots = (): Record<SlotKey, number | null> => ({ before: null, after: null, later: null });

export const initialState = (): RealPulseState => ({
  consent: false,
  slots: emptySlots(),
  live: null,
  ble: 'idle',
  bleMessage: '',
  counting: null,
  entering: null,
  draft: '',
  error: '',
  notice: '',
});

/** 값이 하나라도 남아 있는지(칸, 센서 값, 입력 중인 숫자) */
export const hasValues = (s: RealPulseState) => SLOT_KEYS.some((k) => s.slots[k] !== null) || s.live !== null || s.draft !== '';

export type WipeReason = 'manual' | 'expired' | 'pagehide' | 'withdraw';

export type Action =
  | { type: 'grant' }
  | { type: 'wipe'; reason: WipeReason }
  | { type: 'setSlot'; slot: SlotKey; bpm: number }
  | { type: 'live'; bpm: number }
  | { type: 'ble'; status: BleStatus; message: string }
  | { type: 'beginCount'; slot: SlotKey }
  | { type: 'tick'; remaining: number }
  | { type: 'countDone' }
  | { type: 'cancelCount' }
  | { type: 'draft'; text: string }
  | { type: 'error'; message: string };

const NOTICE: Record<WipeReason, string> = {
  manual: '내 맥박을 지웠어요.',
  expired: '30분이 지나서 내 맥박을 지웠어요.',
  pagehide: '',
  withdraw: '그만두었어요. 내 맥박을 모두 지웠어요.',
};

export function reducer(s: RealPulseState, a: Action): RealPulseState {
  switch (a.type) {
    case 'grant':
      return { ...initialState(), consent: true };
    case 'wipe':
      // 허가는 철회(그만두기)와 앱 종료 직전(pagehide)에만 거둔다. 그 밖에는 허가를 남기고 값만 지운다.
      return { ...initialState(), consent: a.reason === 'manual' || a.reason === 'expired' ? s.consent : false, notice: NOTICE[a.reason] };
    case 'setSlot':
      return { ...s, slots: { ...s.slots, [a.slot]: a.bpm }, counting: null, entering: null, draft: '', error: '', notice: '' };
    case 'live':
      return { ...s, live: a.bpm, notice: '' };
    case 'ble':
      return { ...s, ble: a.status, bleMessage: a.message, ...(a.status === 'idle' || a.status === 'error' ? { live: null } : {}) };
    case 'beginCount':
      return { ...s, counting: { slot: a.slot, remaining: COUNT_SECONDS }, entering: null, draft: '', error: '', notice: '' };
    case 'tick':
      return s.counting ? { ...s, counting: { ...s.counting, remaining: a.remaining } } : s;
    case 'countDone':
      return s.counting ? { ...s, counting: null, entering: s.counting.slot } : s;
    case 'cancelCount':
      return { ...s, counting: null, entering: null, draft: '' };
    case 'draft':
      return { ...s, draft: a.text, error: '' };
    case 'error':
      return { ...s, error: a.message };
  }
}
