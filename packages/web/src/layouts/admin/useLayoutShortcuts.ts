import { useEffect, type Dispatch, type SetStateAction } from 'react';

// ─── 锁屏快捷键 Alt+L / 侧边栏 toggle Alt+S ────────────────────────────────
export function useLayoutShortcuts({
  enableShortcuts,
  enableLockScreen,
  hasPassword,
  lock,
  collapsed,
  handleCollapseChange,
  isContentFullscreen,
  setIsContentFullscreen,
}: {
  enableShortcuts: boolean | undefined;
  enableLockScreen: boolean | undefined;
  hasPassword: () => boolean;
  lock: () => void;
  collapsed: boolean;
  handleCollapseChange: (isCollapsed: boolean) => void;
  isContentFullscreen: boolean;
  setIsContentFullscreen: Dispatch<SetStateAction<boolean>>;
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) return;
      // Esc 退出内容全屏不属于快捷键开关管辖（关闭行为始终可用）
      if (e.key === 'Escape' && isContentFullscreen) {
        setIsContentFullscreen(false);
        return;
      }
      if (!(enableShortcuts ?? true)) return;
      if (e.altKey && e.key === 'l' && (enableLockScreen ?? false) && hasPassword()) {
        e.preventDefault();
        lock();
      }
      if (e.altKey && e.key === 's') {
        e.preventDefault();
        handleCollapseChange(!collapsed);
      }
      if (e.altKey && e.key === 'c') {
        e.preventDefault();
        setIsContentFullscreen((v) => !v);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enableShortcuts, enableLockScreen, hasPassword, lock, collapsed, handleCollapseChange, isContentFullscreen, setIsContentFullscreen]);
}
