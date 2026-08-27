import type { ShortLinkBizType, ShortLinkRedirectType } from './constants';

export type ShortLinkStatus = 'enabled' | 'disabled';

export interface ShortLink {
  id: number;
  code: string;
  /** 完整短链地址（服务端按 PUBLIC_BASE_URL 拼装） */
  shortUrl: string;
  targetUrl: string;
  title: string | null;
  redirectType: ShortLinkRedirectType;
  status: ShortLinkStatus;
  /** YYYY-MM-DD HH:mm:ss，null = 永久有效 */
  expiresAt: string | null;
  /** 是否已过期（服务端按当前时间计算） */
  expired: boolean;
  maxVisits: number | null;
  password: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
  bizType: ShortLinkBizType;
  bizRef: string | null;
  remark: string | null;
  totalPv: number;
  lastVisitAt: string | null;
  createdBy?: number | null;
  updatedBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

// ─── 统计 ─────────────────────────────────────────────────────────────────────
export interface ShortLinkStatsTotals {
  pv: number;
  uv: number;
  todayPv: number;
  todayUv: number;
}

export interface ShortLinkTrendPoint {
  /** YYYY-MM-DD */
  date: string;
  pv: number;
  uv: number;
}

export interface ShortLinkDimensionItem {
  name: string;
  count: number;
}

export interface ShortLinkStats {
  totals: ShortLinkStatsTotals;
  trend: ShortLinkTrendPoint[];
  devices: ShortLinkDimensionItem[];
  browsers: ShortLinkDimensionItem[];
  regions: ShortLinkDimensionItem[];
  referers: ShortLinkDimensionItem[];
}
