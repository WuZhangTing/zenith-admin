import { useEffect } from 'react';
import { Debouncer, Throttler } from '@tanstack/react-pacer';

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
    // 闲置计时 = 尾沿防抖：每次活动重置，超时无活动即锁屏
    const idleDebouncer = new Debouncer(() => lock(), { wait: autoLockMinutes * 60_000 });
    // 活动事件高频触发，1s 前沿节流重置计时
    const activityThrottler = new Throttler(() => idleDebouncer.maybeExecute(), {
      wait: 1000, leading: true, trailing: false,
    });
    const onActivity = () => activityThrottler.maybeExecute();
    const onVisibility = () => { if (!document.hidden) onActivity(); };
    const events = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'] as const;
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true, capture: true }));
    document.addEventListener('visibilitychange', onVisibility);
    idleDebouncer.maybeExecute();
    return () => {
      idleDebouncer.cancel();
      activityThrottler.cancel();
      events.forEach((e) => window.removeEventListener(e, onActivity, { capture: true }));
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [autoLockMinutes, enableLockScreen, isLocked, hasPassword, lock]);
}
