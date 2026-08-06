import { useState } from 'react';
import { Dropdown } from '@douyinfe/semi-ui';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CursorContextDropdown } from './CursorContextDropdown';

function DropdownHarness({ onClose }: Readonly<{ onClose: () => void }>) {
  const [open, setOpen] = useState(true);
  const close = () => {
    onClose();
    setOpen(false);
  };

  return (
    <>
      <button type="button">外部区域</button>
      {open && (
        <CursorContextDropdown
          point={{ x: 100, y: 120 }}
          contextKey="integration"
          onClose={close}
          render={(
            <Dropdown.Menu>
              <Dropdown.Item>执行操作</Dropdown.Item>
            </Dropdown.Menu>
          )}
        />
      )}
    </>
  );
}

describe('CursorContextDropdown with Semi Dropdown', () => {
  it('closes through clickToHide when a menu item is clicked', async () => {
    const onClose = vi.fn();
    render(<DropdownHarness onClose={onClose} />);

    fireEvent.click(await screen.findByText('执行操作'));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('执行操作')).not.toBeInTheDocument();
  });

  it('closes when the document receives an outside pointer action', async () => {
    const onClose = vi.fn();
    render(<DropdownHarness onClose={onClose} />);
    await screen.findByText('执行操作');

    fireEvent.mouseDown(screen.getByRole('button', { name: '外部区域' }));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('执行操作')).not.toBeInTheDocument();
  });

  it('closes when Escape is pressed inside the menu', async () => {
    const onClose = vi.fn();
    render(<DropdownHarness onClose={onClose} />);

    fireEvent.keyDown(await screen.findByText('执行操作'), {
      key: 'Escape',
      code: 'Escape',
    });

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('执行操作')).not.toBeInTheDocument();
  });
});
