/**
 * 内容发布 → 分享短链（发布副作用，fire-and-forget）。
 *
 * 站点未绑定域名或内容为外链时静默跳过；
 * 幂等复用 short-link 域的 ensureShortLink（bizType=cms_content，bizRef=内容 ID），
 * 重新发布或改址时同步更新短链目标。
 */
import { and, eq } from 'drizzle-orm';
import { db } from '../../db';
import { cmsContents, cmsChannels, cmsSites } from '../../db/schema';
import logger from '../../lib/logger';
import { ensureShortLink } from '../short-link/short-link.service';
import { siteOrigin } from './cms-render.service';
import { contentUrl } from './cms-urls';

export function triggerShortLinkForContent(contentId: number): void {
  void (async () => {
    const [row] = await db.select({
      content: cmsContents,
      channelPath: cmsChannels.path,
      channelDetailPathRule: cmsChannels.detailPathRule,
      site: cmsSites,
    })
      .from(cmsContents)
      .innerJoin(cmsChannels, and(
        eq(cmsContents.channelId, cmsChannels.id),
      ))
      .innerJoin(cmsSites, and(
        eq(cmsContents.siteId, cmsSites.id),
      ))
      .where(eq(cmsContents.id, contentId))
      .limit(1);
    if (!row || row.content.status !== 'published' || row.content.externalLink?.trim()) return;
    const origin = siteOrigin(row.site);
    if (!origin) return;
    const path = contentUrl('', { path: row.channelPath, detailPathRule: row.channelDetailPathRule }, row.content);
    await ensureShortLink({
      targetUrl: `${origin}${path}`,
      bizType: 'cms_content',
      bizRef: String(contentId),
      title: row.content.title,
      tenantId: null,
    });
  })().catch((err) => {
    logger.warn(`[CMS] 内容 ${contentId} 发布短链生成失败`, err);
  });
}
