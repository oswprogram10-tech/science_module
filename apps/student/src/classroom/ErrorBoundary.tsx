import { Component, type ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}
interface State {
  failed: boolean;
}

/**
 * 수업 화면 조각(lazy)을 내려받지 못하거나 그리다 실패해도 학생 앱 전체가 무너지지 않게 한다(R4).
 * 실패하면 아무것도 그리지 않는다. 수업 기능만 조용히 빠진다.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown): void {
    console.warn('수업 화면을 불러오지 못했어요. 수업 기능 없이 계속해요.', error);
  }

  render(): ReactNode {
    return this.state.failed ? null : (this.props.children ?? null);
  }
}
