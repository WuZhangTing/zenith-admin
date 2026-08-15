import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView, trackPageLeave } from '@/utils/tracker';

/**
 * Auto-tracks page enter / leave for the current route.
 *
 * Place this hook in a page component (or in a global layout) to
 * automatically record dwell time. The SDK owns the full page lifecycle:
 * visible-time accounting, max scroll depth, and the pagehide fallback that
 * emits page_leave on full reload / tab close (where React cleanup never runs).
 * This hook only reports SPA route boundaries.
 *
 * @param pageTitle  Human-readable page title, e.g. '用户管理'
 * @param enabled    是否启用采集（默认 true，保持后台现状）；由 false→true 时为当前页补发 page_view，
 *                   由 true→false（或组件卸载）时产生匹配的 page_leave。
 */
export function usePageTracker(pageTitle?: string, enabled = true) {
  const location = useLocation();

  useEffect(() => {
    if (!enabled) return;
    trackPageView(location.pathname, pageTitle);
    return () => { trackPageLeave(location.pathname); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, enabled]);
}
