import { BleError, BleHeartRateDriver, type BleTransport } from '@sci/sensors';
import { BLE_MESSAGES } from '../../../components/RealTemperature';
import { COUNT_MAX, COUNT_MIN, COUNT_SECONDS, EXPIRE_MS, countToBpm, type Action, type SlotKey, type WipeReason } from './model';

/** 시간 도구. 테스트에서 가짜로 바꿔 끼운다. 기본은 호출할 때의 전역 setTimeout·clearTimeout이다. */
export interface Timers {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export const realTimers: Timers = {
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (h) => globalThis.clearTimeout(h as ReturnType<typeof setTimeout>),
};

export interface ControllerDeps {
  /** 상태를 바꾸는 곳(React의 dispatch) */
  dispatch(a: Action): void;
  timers?: Timers;
  /** 앱 종료 직전 신호(pagehide)를 받는 대상. 기본은 window. */
  pageTarget?: EventTarget | null;
  /** 블루투스 전송. 없으면(null) 이 기기에서는 쓸 수 없다. */
  createTransport?: () => BleTransport | null;
  expireMs?: number;
}

/**
 * 부수 효과(시간, 블루투스, pagehide)를 맡는다. 실측값은 여기에 두지 않고 dispatch로 React 상태에만 넘긴다.
 * 지우는 때: 지금 지우기, 그만두기, 마지막 측정 뒤 30분, pagehide, 화면을 떠날 때(dispose).
 */
export function createRealPulseController(deps: ControllerDeps) {
  const timers = deps.timers ?? realTimers;
  const expireMs = deps.expireMs ?? EXPIRE_MS;
  let consent = false;
  let disposed = false;
  let expiry: unknown = null;
  let countTimer: unknown = null;
  let driver: BleHeartRateDriver | null = null;
  let unsub: (() => void) | null = null;

  const clearExpiry = () => {
    if (expiry !== null) timers.clearTimeout(expiry);
    expiry = null;
  };
  const clearCount = () => {
    if (countTimer !== null) timers.clearTimeout(countTimer);
    countTimer = null;
  };
  const releaseBle = () => {
    unsub?.();
    unsub = null;
    const d = driver;
    driver = null;
    if (d) void d.disconnect().catch(() => undefined);
  };

  /** 마지막 측정 시각을 지금으로 옮긴다: 이 시각부터 30분 뒤에 지운다. */
  const touch = () => {
    clearExpiry();
    expiry = timers.setTimeout(() => wipe('expired'), expireMs);
  };

  function wipe(reason: WipeReason) {
    clearExpiry();
    clearCount();
    releaseBle();
    if (reason === 'withdraw' || reason === 'pagehide') consent = false;
    deps.dispatch({ type: 'wipe', reason });
  }

  // 앱이 종료되기 직전(또는 bfcache로 들어가기 직전)에 지운다. 되살아나도 값이 없고 허가를 다시 묻는다.
  const target = deps.pageTarget === undefined ? (typeof window === 'undefined' ? null : window) : deps.pageTarget;
  const onPageHide = () => wipe('pagehide');

  return {
    /** 화면에 붙을 때 pagehide를 듣기 시작한다(개발 모드의 효과 재실행에도 다시 붙을 수 있다). */
    attach() {
      disposed = false;
      target?.removeEventListener('pagehide', onPageHide);
      target?.addEventListener('pagehide', onPageHide);
    },
    grant() {
      consent = true;
      deps.dispatch({ type: 'grant' });
    },
    /** 그만두기: 허가를 거두고 모두 지운다. */
    withdraw: () => wipe('withdraw'),
    /** 지금 지우기: 값만 지우고 허가는 남긴다. */
    clear: () => wipe('manual'),

    setDraft(text: string) {
      if (consent && !disposed) deps.dispatch({ type: 'draft', text });
    },
    /** 15초 세기를 시작한다. 허가 전에는 아무것도 하지 않는다. */
    startCount(slot: SlotKey) {
      if (!consent || disposed) return;
      clearCount();
      deps.dispatch({ type: 'beginCount', slot });
      let remaining = COUNT_SECONDS;
      const step = () => {
        remaining -= 1;
        if (remaining <= 0) {
          countTimer = null;
          deps.dispatch({ type: 'countDone' });
          return;
        }
        deps.dispatch({ type: 'tick', remaining });
        countTimer = timers.setTimeout(step, 1000);
      };
      countTimer = timers.setTimeout(step, 1000);
    },
    cancelCount() {
      clearCount();
      deps.dispatch({ type: 'cancelCount' });
    },
    /** 센 횟수(15초)를 기록한다. 올바르면 true. */
    submitCount(slot: SlotKey, text: string): boolean {
      if (!consent || disposed) return false;
      const bpm = countToBpm(text);
      if (bpm === null) {
        deps.dispatch({ type: 'error', message: `${COUNT_MIN}에서 ${COUNT_MAX} 사이의 숫자를 넣어 주세요.` });
        return false;
      }
      deps.dispatch({ type: 'setSlot', slot, bpm });
      touch();
      return true;
    },
    /** 센서가 보낸 값을 칸에 넣는다. */
    saveLive(slot: SlotKey, bpm: number) {
      if (!consent || disposed) return;
      deps.dispatch({ type: 'setSlot', slot, bpm });
      touch();
    },

    /** 블루투스 심박 센서를 연결한다(사용자 조작 안에서 불러야 한다). */
    connectBle() {
      if (!consent || disposed) return;
      releaseBle();
      const transport = deps.createTransport?.() ?? null;
      if (!transport) {
        deps.dispatch({ type: 'ble', status: 'error', message: BLE_MESSAGES.unsupported });
        return;
      }
      const d = new BleHeartRateDriver(transport);
      driver = d;
      deps.dispatch({ type: 'ble', status: 'connecting', message: '연결하는 중이에요.' });
      unsub = d.subscribe((r) => {
        if (driver !== d || !consent) return;
        deps.dispatch({ type: 'live', bpm: r.value });
        touch();
      });
      d.connect().then(
        () => {
          if (driver === d) deps.dispatch({ type: 'ble', status: 'connected', message: '센서 연결됨' });
        },
        (e: unknown) => {
          if (driver !== d) return;
          releaseBle();
          deps.dispatch({ type: 'ble', status: 'error', message: BLE_MESSAGES[e instanceof BleError ? e.code : 'failed'] });
        },
      );
    },
    disconnectBle() {
      releaseBle();
      deps.dispatch({ type: 'ble', status: 'idle', message: '연결을 끊었어요.' });
    },

    /** 화면을 떠난다(컴포넌트 해제): 시간 도구와 센서 연결을 모두 정리한다. 값은 상태와 함께 사라진다. */
    dispose() {
      disposed = true;
      consent = false;
      clearExpiry();
      clearCount();
      releaseBle();
      target?.removeEventListener('pagehide', onPageHide);
    },
  };
}

export type RealPulseController = ReturnType<typeof createRealPulseController>;
