/**
 * PageErrorBoundary 行为契约。
 *
 * 关键回归点：动态模块（chunk）加载失败时，浏览器已缓存 rejected 的
 * module promise，仅重置边界状态的重试必然再次失败——「重试」必须整页刷新。
 * 普通运行时错误则只重置边界，让子树重新渲染。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import { PageErrorBoundary } from './PageErrorBoundary';

function Boom({ error }: Readonly<{ error: Error }>): ReactNode {
  throw error;
}

const reloadMock = vi.fn();
const originalLocation = globalThis.location;

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  // jsdom 的 location.reload 不可直接 spy，整体替换后于 afterEach 还原
  Object.defineProperty(globalThis, 'location', {
    configurable: true,
    value: { ...originalLocation, reload: reloadMock },
  });
});

afterEach(() => {
  Object.defineProperty(globalThis, 'location', { configurable: true, value: originalLocation });
  vi.restoreAllMocks();
  reloadMock.mockReset();
});

describe('chunk 加载失败', () => {
  it.each([
    new TypeError('Failed to fetch dynamically imported module: https://x/assets/Page-abc.js'),
    new TypeError('error loading dynamically imported module'),
    new TypeError('Importing a module script failed.'),
    Object.assign(new Error('Loading chunk 42 failed.'), { name: 'ChunkLoadError' }),
  ])('shows the asset-failure copy and retries with a full reload: %s', (error) => {
    render(
      <PageErrorBoundary>
        <Boom error={error} />
      </PageErrorBoundary>,
    );

    expect(screen.getByText('页面资源加载失败')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /重新加载/ }));
    expect(reloadMock).toHaveBeenCalledTimes(1);
  });
});

describe('普通运行时错误', () => {
  it('resets the boundary on retry without reloading the page', () => {
    let shouldThrow = true;
    function MaybeBoom() {
      if (shouldThrow) throw new Error('render exploded');
      return <div>恢复成功</div>;
    }

    render(
      <PageErrorBoundary>
        <MaybeBoom />
      </PageErrorBoundary>,
    );

    expect(screen.getByText('页面加载出错')).toBeInTheDocument();
    shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: /重新加载/ }));

    expect(reloadMock).not.toHaveBeenCalled();
    expect(screen.getByText('恢复成功')).toBeInTheDocument();
  });

  it('resets automatically when resetKey changes (route navigation)', () => {
    let shouldThrow = true;
    function MaybeBoom() {
      if (shouldThrow) throw new Error('page A exploded');
      return <div>页面 B</div>;
    }

    const { rerender } = render(
      <PageErrorBoundary resetKey="/a">
        <MaybeBoom />
      </PageErrorBoundary>,
    );
    expect(screen.getByText('页面加载出错')).toBeInTheDocument();

    shouldThrow = false;
    rerender(
      <PageErrorBoundary resetKey="/b">
        <MaybeBoom />
      </PageErrorBoundary>,
    );
    expect(screen.getByText('页面 B')).toBeInTheDocument();
  });
});
