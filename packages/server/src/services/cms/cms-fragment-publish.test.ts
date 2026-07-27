/**
 * 碎片改动 → 前台生效链路的回归防线。
 *
 * 背景：碎片被主题模板与搭建页区块引用，改完必须重建站点静态产物并清 dynamic 页面缓存。
 * 此前四个写入口都没接这条链路，导致 static 模式永远是旧产物、hybrid 命中旧静态文件、
 * dynamic 最长 10 分钟才过期——「应急公告」「合规文案」这类核心用法直接失效。
 */
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { cmsFragmentRenderChanged, type CmsFragmentRenderFields } from './cms-fragment-content';

const base: CmsFragmentRenderFields = { code: 'home-banner', type: 'html', status: 'enabled', content: '<p>a</p>' };

describe('碎片渲染影响判定', () => {
  it('内容 / 类型 / 标识 / 状态变化都要重建', () => {
    expect(cmsFragmentRenderChanged(base, { ...base, content: '<p>b</p>' })).toBe(true);
    expect(cmsFragmentRenderChanged(base, { ...base, type: 'text' })).toBe(true);
    expect(cmsFragmentRenderChanged(base, { ...base, code: 'home-side' })).toBe(true);
    expect(cmsFragmentRenderChanged(base, { ...base, status: 'disabled' })).toBe(true);
  });

  it('仅改后台备注类字段不重建（整站重建代价高，不能被无关字段触发）', () => {
    expect(cmsFragmentRenderChanged(base, { ...base })).toBe(false);
  });

  it('停用态之间的改动不重建（停用碎片不进渲染上下文）', () => {
    const off = { ...base, status: 'disabled' };
    expect(cmsFragmentRenderChanged(off, { ...off, content: '<p>changed</p>' })).toBe(false);
    expect(cmsFragmentRenderChanged(off, { ...off, code: 'other' })).toBe(false);
  });

  it('从停用改回启用要重建', () => {
    expect(cmsFragmentRenderChanged({ ...base, status: 'disabled' }, base)).toBe(true);
  });
});

describe('碎片写入口接入发布链路', () => {
  const source = () => readFile(new URL('./cms-fragments.service.ts', import.meta.url), 'utf8');

  it('创建 / 更新 / 删除 / 批量删除都会入队重建并清缓存', async () => {
    const text = await source();
    for (const reason of ['碎片创建', '碎片更新', '碎片删除', '碎片批量删除']) {
      expect(text).toContain(`insertFragmentRebuildOutbox(tx, site`);
      expect(text).toContain(reason);
    }
    expect(text.match(/flushFragmentRebuild\(/g)?.length).toBeGreaterThanOrEqual(5);
  });

  it('站点锁在业务写入之前获取（锁序：站点 → 业务行，防与其它 CMS 变更死锁）', async () => {
    const text = await source();
    expect(text).toMatch(/lockFragmentSites\(tx, \[data\.siteId\]\)[\s\S]{0,200}?tx\.insert\(cmsFragments\)/);
    expect(text).toMatch(/lockFragmentSites\(tx, \[current\.siteId\]\)[\s\S]{0,200}?tx\.update\(cmsFragments\)/);
    expect(text).toMatch(/lockFragmentSites\(tx, affectedSiteIds\)[\s\S]{0,200}?tx\.delete\(cmsFragments\)/);
  });

  it('dynamic 模式页面缓存按站点清理', async () => {
    const cache = await readFile(new URL('./cms-page-cache.service.ts', import.meta.url), 'utf8');
    // SCAN 分批删除而非 KEYS，避免阻塞 Redis
    expect(cache).toContain('redis.scan(cursor');
    expect(cache).not.toContain('redis.keys(');
    expect(cache).toContain('${CMS_PAGE_CACHE_PREFIX}${siteId}:*');
  });
});
