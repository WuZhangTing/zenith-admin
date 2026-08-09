import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MasterDetailLayout } from './MasterDetailLayout';
import { NavListPanel } from './NavListPanel';

function StatefulMaster() {
  const [count, setCount] = useState(0);
  return (
    <>
      <MasterDetailLayout.Header>列表</MasterDetailLayout.Header>
      <button type="button" onClick={() => setCount((value) => value + 1)}>计数 {count}</button>
    </>
  );
}

describe('MasterDetailLayout side switching', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('switches the visual side without remounting master content', () => {
    const { container } = render(
      <MasterDetailLayout
        persistKey="test-layout"
        master={<StatefulMaster />}
        detail={<div>详情</div>}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '计数 0' }));
    expect(screen.getByRole('button', { name: '计数 1' })).toBeTruthy();
    expect((container.firstElementChild as HTMLElement).style.flexDirection).toBe('row');

    fireEvent.click(screen.getByRole('button', { name: '将侧栏移到右侧' }));

    expect((container.firstElementChild as HTMLElement).style.flexDirection).toBe('row-reverse');
    expect(screen.getByRole('button', { name: '计数 1' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '将侧栏移到左侧' })).toBeTruthy();
    expect(localStorage.getItem('mdLayout.test-layout.side')).toBe('right');
  });

  it('supports controlled side changes', () => {
    const onSideChange = vi.fn();
    render(
      <MasterDetailLayout
        side="left"
        onSideChange={onSideChange}
        master={<MasterDetailLayout.Header>列表</MasterDetailLayout.Header>}
        detail={<div>详情</div>}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '将侧栏移到右侧' }));
    expect(onSideChange).toHaveBeenCalledWith('right');
  });

  it('supports custom master headers through the explicit SideToggle', () => {
    const { container } = render(
      <MasterDetailLayout
        master={(
          <div>
            自定义标题
            <MasterDetailLayout.SideToggle />
          </div>
        )}
        detail={<div>详情</div>}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '将侧栏移到右侧' }));
    expect((container.firstElementChild as HTMLElement).style.flexDirection).toBe('row-reverse');
  });

  it('injects the toggle into NavListPanel headers', () => {
    const { container } = render(
      <MasterDetailLayout
        master={<NavListPanel headerExtra={<button type="button">新建</button>} />}
        detail={<div>详情</div>}
      />,
    );

    expect(screen.getByRole('button', { name: '将侧栏移到右侧' })).toBeTruthy();
    expect(container.querySelector('.nav-list-panel__header-extra--full')).toBeTruthy();
  });

  it('restores a persisted side and can disable switching', () => {
    localStorage.setItem('mdLayout.saved-layout.side', 'right');
    const { container } = render(
      <MasterDetailLayout
        persistKey="saved-layout"
        sideSwitchable={false}
        master={<MasterDetailLayout.Header>列表</MasterDetailLayout.Header>}
        detail={<div>详情</div>}
      />,
    );

    expect((container.firstElementChild as HTMLElement).style.flexDirection).toBe('row-reverse');
    expect(screen.queryByRole('button', { name: /将侧栏移到/ })).toBeNull();
  });
});
