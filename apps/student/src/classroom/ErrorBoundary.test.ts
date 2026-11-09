import { describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

describe('ErrorBoundary', () => {
  it('정상일 때는 자식을 그대로 그린다', () => {
    const b = new ErrorBoundary({ children: 'child' });
    expect(b.render()).toBe('child');
  });

  it('불러오기에 실패하면(오류가 올라오면) null을 그리고 경고만 남긴다', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const b = new ErrorBoundary({ children: 'child' });
    const err = new Error('Failed to fetch dynamically imported module');
    b.state = { ...b.state, ...ErrorBoundary.getDerivedStateFromError() };
    b.componentDidCatch(err);
    expect(b.render()).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
