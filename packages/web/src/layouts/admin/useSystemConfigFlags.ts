import { useEffect, useState } from 'react';
import type { SystemConfig } from '@zenith/shared/platform';
import { request } from '@/utils/request';

// ─── 水印配置 ──────────────────────────────────────────────────────────────
export function useWatermarkConfig() {
  const [watermarkConfig, setWatermarkConfig] = useState({ enabled: false, content: '', fontSize: 14, opacity: 0.15 });

  useEffect(() => {
    request.get<{ list: SystemConfig[]; total: number }>('/api/system-configs?keys=watermark_enabled,watermark_content,watermark_font_size,watermark_opacity', { silent: true })
      .then((res) => {
        if (res.code === 0 && res.data?.list) {
          const list = res.data.list;
          const enabled = list.find((c) => c.configKey === 'watermark_enabled')?.configValue === 'true';
          const content = list.find((c) => c.configKey === 'watermark_content')?.configValue ?? '';
          const fontSize = Number(list.find((c) => c.configKey === 'watermark_font_size')?.configValue) || 14;
          const opacity = (Number(list.find((c) => c.configKey === 'watermark_opacity')?.configValue) || 15) / 100;
          setWatermarkConfig({ enabled, content, fontSize, opacity });
        }
      });
  }, []);

  return watermarkConfig;
}

// ─── 快捷聊天系统开关 ─────────────────────────────────────────────────────
export function useQuickChatEnabled() {
  const [quickChatEnabled, setQuickChatEnabled] = useState(false);

  useEffect(() => {
    request.get<{ configValue: string }>('/api/system-configs/public/quick_chat_enabled', { silent: true })
      .then((res) => {
        if (res.code === 0) setQuickChatEnabled(res.data?.configValue === 'true');
      });
  }, []);

  return quickChatEnabled;
}
