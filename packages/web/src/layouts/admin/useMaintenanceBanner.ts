import { useCallback, useEffect, useState } from 'react';
import { Toast } from '@douyinfe/semi-ui';
import { request } from '@/utils/request';

// ─── 维护模式横幅（超管提示） ─────────────────────────────────────────
export function useMaintenanceBanner(isSuperAdmin: boolean) {
  const [maintenanceBannerEnabled, setMaintenanceBannerEnabled] = useState(false);
  const [maintenanceBannerMsg, setMaintenanceBannerMsg] = useState('');
  const [disablingMaintenance, setDisablingMaintenance] = useState(false);

  useEffect(() => {
    if (!isSuperAdmin) return;
    request.get<{ enabled: boolean; message: string }>('/api/maintenance/status', { silent: true })
      .then((res) => {
        if (res.code === 0 && res.data?.enabled) {
          setMaintenanceBannerEnabled(true);
          setMaintenanceBannerMsg(res.data.message);
        }
      });
  }, [isSuperAdmin]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ message?: string } | null>).detail;
      setMaintenanceBannerEnabled(true);
      setMaintenanceBannerMsg(detail?.message ?? '系统维护中');
    };
    globalThis.addEventListener('maintenance:enabled', handler);
    return () => globalThis.removeEventListener('maintenance:enabled', handler);
  }, [isSuperAdmin]);

  // 监听维护状态变更（由管理页面或横幅触发）
  useEffect(() => {
    if (!isSuperAdmin) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ enabled?: boolean; message?: string } | null>).detail;
      if (detail?.enabled === false) {
        setMaintenanceBannerEnabled(false);
      } else if (detail?.enabled === true) {
        setMaintenanceBannerEnabled(true);
        setMaintenanceBannerMsg(detail?.message ?? '系统维护中');
      } else {
        // no detail — re-fetch
        request.get<{ enabled: boolean; message: string }>('/api/maintenance/status', { silent: true })
          .then((res) => {
            if (res.code === 0) {
              setMaintenanceBannerEnabled(res.data?.enabled ?? false);
              if (res.data?.message) setMaintenanceBannerMsg(res.data.message);
            }
          });
      }
    };
    globalThis.addEventListener('maintenance:statusChanged', handler);
    return () => globalThis.removeEventListener('maintenance:statusChanged', handler);
  }, [isSuperAdmin]);

  const handleDisableMaintenance = useCallback(async () => {
    setDisablingMaintenance(true);
    try {
      const res = await request.put<{ enabled: boolean }>('/api/maintenance', { enabled: false });
      if (res.code === 0) {
        setMaintenanceBannerEnabled(false);
        Toast.success('维护模式已关闭');
        globalThis.dispatchEvent(new CustomEvent('maintenance:statusChanged'));
      }
    } finally {
      setDisablingMaintenance(false);
    }
  }, []);

  return { maintenanceBannerEnabled, maintenanceBannerMsg, disablingMaintenance, handleDisableMaintenance };
}
