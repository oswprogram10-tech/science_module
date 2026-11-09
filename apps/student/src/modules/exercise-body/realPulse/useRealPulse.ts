import { useEffect, useReducer, useRef, useState } from 'react';
import { pickBleTransport } from '../../../platform/bleTransport';
import { createRealPulseController, type ControllerDeps, type RealPulseController } from './controller';
import { initialState, reducer, type RealPulseState } from './model';

/**
 * 내 맥박 재기의 상태(React 상태, 메모리만)와 조작. 이 화면이 사라지면 상태와 함께 값도 사라진다.
 * deps는 테스트용으로 시간 도구·전송을 바꿔 끼우는 자리다.
 */
export function useRealPulse(deps: Partial<Omit<ControllerDeps, 'dispatch'>> = {}): [RealPulseState, RealPulseController] {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const depsRef = useRef(deps);
  const [controller] = useState(() =>
    createRealPulseController({ createTransport: pickBleTransport, ...depsRef.current, dispatch }),
  );
  // 단원 화면을 떠나면(해제) 시간 도구·센서 연결을 정리한다.
  useEffect(() => {
    controller.attach();
    return () => controller.dispose();
  }, [controller]);
  return [state, controller];
}
