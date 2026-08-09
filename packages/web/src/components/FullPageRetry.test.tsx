import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { ApiError } from '@/lib/query';
import FullPageRetry from './FullPageRetry';

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true });
  globalThis.dispatchEvent(new Event(value ? 'online' : 'offline'));
}

function advance(seconds: number) {
  act(() => {
    vi.advanceTimersByTime(seconds * 1000);
  });
}

const baseProps = {
  title: '暂时无法连接服务器',
  description: '登录凭证已保留，请检查网络后重试。',
};

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('FullPageRetry', () => {
  it('announces the failure and exposes both the retry and the escape hatch', () => {
    const onRetry = vi.fn();
    const onSecondary = vi.fn();

    render(
      <FullPageRetry
        {...baseProps}
        autoRetry={false}
        onRetry={onRetry}
        secondaryAction={{ label: '重新登录', onClick: onSecondary }}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('暂时无法连接服务器');
    expect(screen.getByRole('alert')).toHaveTextContent('登录凭证已保留，请检查网络后重试。');

    act(() => screen.getByRole('button', { name: /重试/ }).click());
    expect(onRetry).toHaveBeenCalledTimes(1);

    act(() => screen.getByRole('button', { name: '重新登录' }).click());
    expect(onSecondary).toHaveBeenCalledTimes(1);
  });

  it('auto retries on a backing-off countdown', () => {
    const onRetry = vi.fn();
    render(<FullPageRetry {...baseProps} onRetry={onRetry} />);

    expect(screen.getByText('5 秒后自动重试')).toBeInTheDocument();

    advance(5);
    expect(onRetry).toHaveBeenCalledTimes(1);
    // 第二次等待被拉长，持续失败时不会一直高频打服务端
    expect(screen.getByText('10 秒后自动重试')).toBeInTheDocument();

    advance(10);
    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(screen.getByText('20 秒后自动重试')).toBeInTheDocument();
  });

  it('pauses the countdown while a retry is in flight', () => {
    const onRetry = vi.fn();
    render(<FullPageRetry {...baseProps} retrying onRetry={onRetry} />);

    expect(screen.getByText('正在重新连接…')).toBeInTheDocument();

    advance(30);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it('switches to offline copy and stops requesting while the device is offline', () => {
    const onRetry = vi.fn();
    render(<FullPageRetry {...baseProps} onRetry={onRetry} />);

    act(() => setOnline(false));

    expect(screen.getByRole('alert')).toHaveTextContent('网络连接已断开');
    expect(screen.getByText('网络恢复后将自动重试')).toBeInTheDocument();

    advance(60);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it('retries immediately when the network comes back', () => {
    const onRetry = vi.fn();
    render(<FullPageRetry {...baseProps} onRetry={onRetry} />);

    act(() => setOnline(false));
    advance(3);
    expect(onRetry).not.toHaveBeenCalled();

    act(() => setOnline(true));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('distinguishes a responding server from an unreachable one', () => {
    render(
      <FullPageRetry
        {...baseProps}
        autoRetry={false}
        error={new ApiError(500, '内部错误')}
        onRetry={() => {}}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('服务器返回异常');
    expect(screen.getByRole('alert')).toHaveTextContent('内部错误（错误码 500）');
  });

  it('keeps the connection copy for transport-level failures', () => {
    render(
      <FullPageRetry
        {...baseProps}
        autoRetry={false}
        error={new ApiError(-1, '网络请求失败，请检查网络连接')}
        onRetry={() => {}}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('暂时无法连接服务器');
  });

  it('reports maintenance instead of a connection failure', () => {
    render(
      <FullPageRetry
        {...baseProps}
        autoRetry={false}
        error={new ApiError(503, '系统维护中，请稍后重试')}
        onRetry={() => {}}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('系统维护中');
  });
});
