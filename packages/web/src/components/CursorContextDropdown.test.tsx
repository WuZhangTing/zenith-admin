import type { ReactNode } from 'react';
import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface MockDropdownProps {
  readonly children?: ReactNode;
  readonly render?: ReactNode;
  readonly visible?: boolean;
  readonly trigger?: string;
  readonly position?: string;
  readonly autoAdjustOverflow?: boolean;
  readonly clickToHide?: boolean;
  readonly closeOnEsc?: boolean;
  readonly rePosKey?: string | number;
  readonly getPopupContainer?: () => HTMLElement;
  readonly onClickOutSide?: () => void;
  readonly onVisibleChange?: (visible: boolean) => void;
}

const dropdownState = vi.hoisted(() => ({
  calls: [] as MockDropdownProps[],
}));

vi.mock('@douyinfe/semi-ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@douyinfe/semi-ui')>();
  const React = await import('react');

  const MockDropdown = (props: MockDropdownProps) => {
    dropdownState.calls.push(props);
    return React.createElement(
      React.Fragment,
      null,
      props.children,
      props.visible ? props.render : null,
    );
  };

  return { ...actual, Dropdown: MockDropdown };
});

import { CursorContextDropdown } from './CursorContextDropdown';

function latestDropdownProps(): MockDropdownProps {
  const props = dropdownState.calls.at(-1);
  if (!props) throw new Error('dropdown was not rendered');
  return props;
}

describe('CursorContextDropdown', () => {
  beforeEach(() => {
    dropdownState.calls.length = 0;
  });

  it('provides the shared Semi positioning contract at the cursor point', () => {
    const { container } = render(
      <CursorContextDropdown
        point={{ x: 998, y: 742 }}
        contextKey="message:42"
        render={<div role="menu" style={{ minWidth: 176 }}>菜单</div>}
        onClose={vi.fn()}
      />,
    );

    const props = latestDropdownProps();
    expect(props).toMatchObject({
      visible: true,
      trigger: 'click',
      position: 'bottomLeft',
      autoAdjustOverflow: true,
      clickToHide: true,
      closeOnEsc: true,
      rePosKey: 'message:42:998:742',
    });
    expect(props.getPopupContainer?.()).toBe(document.body);

    const menu = container.querySelector<HTMLElement>('[role="menu"]');
    expect(menu).toHaveStyle({
      minWidth: '176px',
      maxHeight: 'calc(100vh - 16px)',
      overflowY: 'auto',
    });

    const anchor = container.querySelector<HTMLElement>('span[aria-hidden="true"]');
    expect(anchor).not.toHaveAttribute('tabindex');
    expect(anchor).toHaveStyle({
      position: 'fixed',
      left: '998px',
      top: '742px',
      width: '1px',
      height: '1px',
      pointerEvents: 'none',
    });
  });

  it('keeps the viewport constraints when the menu supplies its own overflow styles', () => {
    const { container } = render(
      <CursorContextDropdown
        point={{ x: 10, y: 20 }}
        contextKey="file:1"
        render={(
          <div role="menu" style={{ maxHeight: 900, overflowY: 'visible' }}>
            菜单
          </div>
        )}
        onClose={vi.fn()}
      />,
    );

    expect(container.querySelector<HTMLElement>('[role="menu"]')).toHaveStyle({
      maxHeight: 'calc(100vh - 16px)',
      overflowY: 'auto',
    });
  });

  it('repositions the same anchor when the context or coordinates change', () => {
    const { container, rerender } = render(
      <CursorContextDropdown
        point={{ x: 998, y: 742 }}
        contextKey="message:42"
        render={<div role="menu">菜单</div>}
        onClose={vi.fn()}
      />,
    );
    const anchor = container.querySelector<HTMLElement>('span[aria-hidden="true"]');

    rerender(
      <CursorContextDropdown
        point={{ x: 240, y: 180 }}
        contextKey="message:43"
        render={<div role="menu">菜单</div>}
        onClose={vi.fn()}
      />,
    );

    expect(latestDropdownProps().rePosKey).toBe('message:43:240:180');
    expect(container.querySelector('span[aria-hidden="true"]')).toBe(anchor);
    expect(anchor).toHaveStyle({ left: '240px', top: '180px' });
  });

  it('closes once when Semi emits overlapping close notifications', () => {
    const onClose = vi.fn();
    render(
      <CursorContextDropdown
        point={{ x: 10, y: 20 }}
        contextKey="file:1"
        render={<div role="menu">菜单</div>}
        onClose={onClose}
      />,
    );
    const props = latestDropdownProps();

    act(() => props.onVisibleChange?.(true));
    expect(onClose).not.toHaveBeenCalled();

    act(() => {
      props.onClickOutSide?.();
      props.onVisibleChange?.(false);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
