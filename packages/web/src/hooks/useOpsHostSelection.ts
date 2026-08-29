import { useCallback, useState } from 'react';

const OPS_HOST_SELECTION_KEY = 'zenith_ops_selected_host';

/** 跨运维页面持久化当前主机；null 表示本机。 */
export function useOpsHostSelection(initial?: number | null) {
  const [hostId, setHostIdState] = useState<number | null>(() => {
    if (initial !== undefined) return initial;
    if (typeof window === 'undefined') return null;
    const value = Number(localStorage.getItem(OPS_HOST_SELECTION_KEY));
    return Number.isInteger(value) && value > 0 ? value : null;
  });
  const setHostId = useCallback((next: number | null) => {
    setHostIdState(next);
    if (next == null) localStorage.removeItem(OPS_HOST_SELECTION_KEY);
    else localStorage.setItem(OPS_HOST_SELECTION_KEY, String(next));
  }, []);
  return [hostId, setHostId] as const;
}
