import { Select } from '@douyinfe/semi-ui';
import { useEffect } from 'react';
import { useAllCmsSites } from '@/hooks/queries/cms';

interface CmsSiteSelectProps {
  value: number | undefined;
  onChange: (siteId: number) => void;
  width?: number | string;
}

/** 当前站点选择的持久化 key：全部 CMS 管理页共享同一份 */
const CMS_SITE_STORAGE_KEY = 'zenith_cms_site';

function readStoredSiteId(): number | undefined {
  try {
    const raw = localStorage.getItem(CMS_SITE_STORAGE_KEY);
    const id = raw ? Number(raw) : Number.NaN;
    return Number.isInteger(id) && id > 0 ? id : undefined;
  } catch {
    return undefined;
  }
}

function storeSiteId(id: number): void {
  try {
    localStorage.setItem(CMS_SITE_STORAGE_KEY, String(id));
  } catch {
    // storage 不可用时静默降级为页面内状态
  }
}

/**
 * CMS 各管理页共用的站点切换器。
 *
 * 「当前站点」为全 CMS 模块共享上下文：任一页面切换站点即写入 localStorage，
 * 其余页面（以及 F5 刷新后）挂载时自动恢复同一站点，避免 20+ 菜单间反复重选、
 * 或在错误站点下建栏目/内容。恢复优先级：已存储站点（仍有权限可见）→ 默认站点 → 首个站点。
 */
export function CmsSiteSelect({ value, onChange, width = 200 }: Readonly<CmsSiteSelectProps>) {
  const { data: sites } = useAllCmsSites();

  useEffect(() => {
    if (value === undefined && sites && sites.length > 0) {
      const stored = readStoredSiteId();
      const preferred = sites.find((s) => s.id === stored)
        ?? sites.find((s) => s.isDefault)
        ?? sites[0];
      onChange(preferred.id);
    }
  }, [value, sites, onChange]);

  return (
    <Select
      placeholder="选择站点"
      value={value}
      onChange={(v) => {
        storeSiteId(v as number);
        onChange(v as number);
      }}
      style={{ width }}
      optionList={(sites ?? []).map((s) => ({ value: s.id, label: s.name }))}
    />
  );
}

/** 生成站点前台预览地址（无域名绑定时走 /__cms/{code} 预览前缀） */
export function cmsPreviewUrl(siteCode: string, path = ''): string {
  return `/__cms/${siteCode}/${path.replace(/^\/+/, '')}`;
}
