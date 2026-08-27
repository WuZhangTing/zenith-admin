/**
 * 短链统计：P1 以点击明细为数据源实时聚合；
 * P2 起历史日粒度由 short_link_daily_stats 物化承接（明细可按保留策略瘦身）。
 */
import { and, count, countDistinct, desc, eq, gte, sql } from 'drizzle-orm';
import type { ShortLinkStats, ShortLinkTrendPoint } from '@zenith/shared/short-link';
import { SHORT_LINK_STATS_DEFAULT_DAYS, SHORT_LINK_STATS_MAX_DAYS, SHORT_LINK_STATS_TOP_LIMIT } from '@zenith/shared/short-link';
import { db } from '../../db';
import { shortLinkClicks } from '../../db/schema';
import { formatDate } from '../../lib/datetime';
import { clampDays } from '../../lib/analytics-helpers';
import { ensureShortLinkExists } from './short-link.service';

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function windowStart(days: number): Date {
  const d = startOfToday();
  d.setDate(d.getDate() - (days - 1));
  return d;
}

/** 维度分布查询（非爬虫口径，窗口内 Top N） */
async function dimensionBreakdown(linkId: number, since: Date, column: 'deviceType' | 'os' | 'browser' | 'province') {
  const col = shortLinkClicks[column];
  const rows = await db
    .select({ name: col, count: count() })
    .from(shortLinkClicks)
    .where(and(eq(shortLinkClicks.linkId, linkId), eq(shortLinkClicks.isBot, false), gte(shortLinkClicks.clickedAt, since)))
    .groupBy(col)
    .orderBy(desc(count()))
    .limit(SHORT_LINK_STATS_TOP_LIMIT);
  return rows.map((r) => ({ name: r.name ?? '未知', count: Number(r.count) }));
}

/** 来源分布：按 referer 主机名聚合，空值归为「直接访问」 */
async function refererBreakdown(linkId: number, since: Date) {
  const host = sql<string>`coalesce(nullif(split_part(split_part(${shortLinkClicks.referer}, '://', 2), '/', 1), ''), '直接访问')`;
  const rows = await db
    .select({ name: host, count: count() })
    .from(shortLinkClicks)
    .where(and(eq(shortLinkClicks.linkId, linkId), eq(shortLinkClicks.isBot, false), gte(shortLinkClicks.clickedAt, since)))
    .groupBy(host)
    .orderBy(desc(count()))
    .limit(SHORT_LINK_STATS_TOP_LIMIT);
  return rows.map((r) => ({ name: r.name, count: Number(r.count) }));
}

export async function getShortLinkStats(id: number, days?: number): Promise<ShortLinkStats> {
  await ensureShortLinkExists(id);
  const windowDays = clampDays(days, SHORT_LINK_STATS_DEFAULT_DAYS, SHORT_LINK_STATS_MAX_DAYS);
  const since = windowStart(windowDays);
  const today = startOfToday();
  const notBot = and(eq(shortLinkClicks.linkId, id), eq(shortLinkClicks.isBot, false));

  const dateExpr = sql<string>`to_char(${shortLinkClicks.clickedAt}, 'YYYY-MM-DD')`;

  const [totalsRow, todayRow, trendRows, devices, browsers, regions, referers] = await Promise.all([
    db.select({ pv: count(), uv: countDistinct(shortLinkClicks.visitorId) }).from(shortLinkClicks).where(notBot),
    db
      .select({ pv: count(), uv: countDistinct(shortLinkClicks.visitorId) })
      .from(shortLinkClicks)
      .where(and(notBot, gte(shortLinkClicks.clickedAt, today))),
    db
      .select({ date: dateExpr, pv: count(), uv: countDistinct(shortLinkClicks.visitorId) })
      .from(shortLinkClicks)
      .where(and(notBot, gte(shortLinkClicks.clickedAt, since)))
      .groupBy(dateExpr)
      .orderBy(dateExpr),
    dimensionBreakdown(id, since, 'deviceType'),
    dimensionBreakdown(id, since, 'browser'),
    dimensionBreakdown(id, since, 'province'),
    refererBreakdown(id, since),
  ]);

  // 趋势按窗口补零，保证图表 x 轴连续
  const trendMap = new Map(trendRows.map((r) => [r.date, { pv: Number(r.pv), uv: Number(r.uv) }]));
  const trend: ShortLinkTrendPoint[] = [];
  for (let i = 0; i < windowDays; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    const key = formatDate(d);
    const point = trendMap.get(key);
    trend.push({ date: key, pv: point?.pv ?? 0, uv: point?.uv ?? 0 });
  }

  return {
    totals: {
      pv: Number(totalsRow[0]?.pv ?? 0),
      uv: Number(totalsRow[0]?.uv ?? 0),
      todayPv: Number(todayRow[0]?.pv ?? 0),
      todayUv: Number(todayRow[0]?.uv ?? 0),
    },
    trend,
    devices,
    browsers,
    regions,
    referers,
  };
}
