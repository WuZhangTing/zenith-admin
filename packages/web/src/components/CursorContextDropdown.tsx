import { cloneElement, useCallback, useRef } from 'react';
import type { CSSProperties, ReactElement } from 'react';
import { Dropdown } from '@douyinfe/semi-ui';

export interface CursorPoint {
  readonly x: number;
  readonly y: number;
}

interface CursorContextDropdownProps {
  readonly point: CursorPoint;
  readonly contextKey: string | number;
  readonly render: ReactElement<{ style?: CSSProperties }>;
  readonly onClose: () => void;
}

const viewportMenuStyle: CSSProperties = {
  maxHeight: 'calc(100vh - 16px)',
  overflowY: 'auto',
};

function withViewportMenuStyle(
  content: ReactElement<{ style?: CSSProperties }>,
): ReactElement<{ style?: CSSProperties }> {
  return cloneElement(content, {
    style: { ...content.props.style, ...viewportMenuStyle },
  });
}

function getPopupContainer(): HTMLElement {
  return document.body;
}

/** Semi Dropdown adapter for menus that must open at the pointer coordinates. */
export function CursorContextDropdown({
  point,
  contextKey,
  render,
  onClose,
}: Readonly<CursorContextDropdownProps>) {
  const rePosKey = `${contextKey}:${point.x}:${point.y}`;
  const closedKeyRef = useRef<string | null>(null);

  const closeOnce = useCallback(() => {
    if (closedKeyRef.current === rePosKey) return;
    closedKeyRef.current = rePosKey;
    onClose();
  }, [onClose, rePosKey]);

  return (
    <Dropdown
      visible
      trigger="click"
      position="bottomLeft"
      autoAdjustOverflow
      rePosKey={rePosKey}
      render={withViewportMenuStyle(render)}
      getPopupContainer={getPopupContainer}
      clickToHide
      closeOnEsc
      onClickOutSide={closeOnce}
      onVisibleChange={(visible) => { if (!visible) closeOnce(); }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'fixed',
          left: point.x,
          top: point.y,
          width: 1,
          height: 1,
          pointerEvents: 'none',
        }}
      />
    </Dropdown>
  );
}
