/**
 * 页签栏重渲染回归测试
 *
 * 约束：AdminLayout 因与页签无关的 state（WebSocket 未读数、锁屏、偏好面板…）
 * 重渲染时，页签不得参与 reconciliation。这里用一个最小宿主复现该场景。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useMemo, useState } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import type { TabItem } from '@/hooks/useTabsStore';
import { useEventCallback } from '@/hooks/useEventCallback';
import { TabBarItem, type TabBarItemActions } from './TabBarItem';

const renderCounts = new Map<string, number>();

vi.mock('./TabBarItem', async () => {
  const actual = await vi.importActual<typeof import('./TabBarItem')>('./TabBarItem');
  const { memo } = await import('react');
  // 包一层计数，再套 memo —— 与真实组件相同的 memo 语义
  const Counted = memo((props: Parameters<typeof actual.TabBarItem>[0]) => {
    renderCounts.set(props.tab.key, (renderCounts.get(props.tab.key) ?? 0) + 1);
    const Inner = actual.TabBarItem;
    return <Inner {...props} />;
  });
  return { ...actual, TabBarItem: Counted };
});

const TABS: TabItem[] = [
  { key: '/', title: '首页', closable: false },
  { key: '/a', title: 'A 页', closable: true },
  { key: '/b', title: 'B 页', closable: true },
];

/** 模拟 AdminLayout：持有一个与页签无关的高频 state */
function Host() {
  const [unrelated, setUnrelated] = useState(0);
  const [activeKey, setActiveKey] = useState('/a');

  const onSelect = useEventCallback((key: string) => setActiveKey(key));
  const noop = useEventCallback(() => {});

  // 与 AdminLayout 一致：稳定回调 + useMemo 使操作集合只创建一次
  const actions = useMemo(() => ({
    onSelect,
    onClose: noop, onRefresh: noop, onDoubleClick: noop, onMiddleClick: noop,
    onPinToggle: noop, onToggleFullscreen: noop, onToggleFavorite: noop,
    onCopyName: noop, onCopyLink: noop, onCopyBreadcrumb: noop, onOpenInNewWindow: noop,
    onCloseOthers: noop, onCloseLeft: noop, onCloseRight: noop, onCloseAll: noop,
    onDragStart: noop, onDragOver: noop, onDrop: noop, onDragEnd: noop, onDragLeave: noop,
  }) as unknown as TabBarItemActions, [onSelect, noop]);

  return (
    <div>
      <button type="button" data-testid="bump" onClick={() => setUnrelated((v) => v + 1)}>
        bump {unrelated}
      </button>
      {TABS.map((tab) => (
        <TabBarItem
          key={tab.key}
          tab={tab}
          actions={actions}
          isActive={tab.key === activeKey}
          isEntering={false}
          isExiting={false}
          isDragging={false}
          isDragOver={false}
          hasClosableLeft={false}
          hasClosableRight={false}
          hasClosableOthers
          hasAnyClosable
          favMenuId={null}
          faved={false}
          showIcon={false}
          isContentFullscreen={false}
        />
      ))}
    </div>
  );
}

describe('页签栏重渲染', () => {
  beforeEach(() => {
    renderCounts.clear();
  });

  it('无关 state 变化不重渲染任何页签', () => {
    render(<Host />);
    expect(renderCounts.get('/a')).toBe(1);

    // 模拟 WebSocket 未读数之类的更新连打 5 次
    for (let i = 0; i < 5; i += 1) {
      act(() => {
        fireEvent.click(screen.getByTestId('bump'));
      });
    }
    expect(screen.getByText('bump 5')).toBeTruthy();

    // 页签渲染次数必须保持不变
    expect(renderCounts.get('/')).toBe(1);
    expect(renderCounts.get('/a')).toBe(1);
    expect(renderCounts.get('/b')).toBe(1);
  });

  it('切换激活页签只重渲染受影响的两个页签', () => {
    render(<Host />);
    renderCounts.clear();

    act(() => {
      fireEvent.click(screen.getByText('B 页'));
    });

    // 仅「原激活 /a」与「新激活 /b」的 isActive 变化，首页不受影响
    expect(renderCounts.get('/a')).toBe(1);
    expect(renderCounts.get('/b')).toBe(1);
    expect(renderCounts.get('/')).toBeUndefined();
  });
});
