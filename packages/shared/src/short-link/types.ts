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

// ─── 渠道推广分析 ─────────────────────────────────────────────────────────────
export interface ChannelAnalysisRow {
  /** 维度值（utm_source / utm_medium / utm_campaign），未设置归为「未设置」 */
  name: string;
  /** 短链点击（PV） */
  clicks: number;
  /** 独立访客 */
  uv: number;
  /** 转化事件数（选择了转化事件时返回） */
  conversions: number | null;
  /** 转化率（conversions / clicks，保留 4 位小数；clicks=0 时为 null） */
  convRate: number | null;
}

export interface ChannelAnalysisResult {
  totals: {
    clicks: number;
    uv: number;
    /** 窗口内产生过点击的短链数 */
    links: number;
    conversions: number | null;
  };
  trend: ShortLinkTrendPoint[];
  rows: ChannelAnalysisRow[];
}
