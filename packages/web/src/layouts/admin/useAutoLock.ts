import { useEffect } from 'react';

// ─── 无操作自动锁屏 ─────────────────────────────────────────────────────────
export function useAutoLock(
  autoLockMinutes: number,
  enableLockScreen: boolean | undefined,
  isLocked: boolean,
  hasPassword: () => boolean,
  lock: () => void,
) {
  useEffect(() => {
    if (autoLockMinutes <= 0 || !(enableLockScreen ?? false) || isLocked || !hasPassword()) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastReset = 0;
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => lock(), autoLockMinutes * 60_000);
    };
    // 活动事件高频触发，1s 节流重置计时
    const onActivity = () => {
      const now = Date.now();
      if (now - lastReset > 1000) {
        lastReset = now;
        arm();
      }
    };
    const onVisibility = () => { if (!document.hidden) onActivity(); };
    const events = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'] as const;
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true, capture: true }));
    document.addEventListener('visibilitychange', onVisibility);
    arm();
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, onActivity, { capture: true }));
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [autoLockMinutes, enableLockScreen, isLocked, hasPassword, lock]);
}
