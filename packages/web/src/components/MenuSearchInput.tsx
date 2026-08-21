import { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import MenuCommandPalette from './MenuCommandPalette';
import './MenuSearchInput.css';

export interface FlatMenuItem {
  id: number;
  title: string;
  path: string;
  icon?: string;
  breadcrumb: string[];
}

interface MenuSearchInputProps {
  readonly menus: FlatMenuItem[];
}

export default function MenuSearchInput({ menus }: MenuSearchInputProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Listen for global Ctrl+K shortcut dispatched from palette
  useEffect(() => {
    const handler = () => setOpen(true);
    globalThis.addEventListener('open-menu-palette', handler);
    return () => globalThis.removeEventListener('open-menu-palette', handler);
  }, []);

  const handleClose = () => {
    setOpen(false);
    // Blur the button to remove focus outline after closing the palette
    setTimeout(() => {
      buttonRef.current?.blur();
    }, 0);
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="menu-search-trigger"
        onClick={() => setOpen(true)}
        title="搜索菜单 (Ctrl+K)"
        aria-label="搜索菜单"
      >
        <span className="menu-search-trigger__icon">
          <Search size={16} strokeWidth={1.8} />
        </span>
        <span className="menu-search-trigger__label">搜索菜单</span>
        <kbd className="menu-search-trigger__kbd">Ctrl K</kbd>
      </button>
      <MenuCommandPalette menus={menus} open={open} onClose={handleClose} />
    </>
  );
}
