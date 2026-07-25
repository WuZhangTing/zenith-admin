import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  buildCmsChannelCodeLink, buildCmsEntityLink, buildCmsInternalLink, isCmsEntityLink, isCmsSiteLink,
  isValidCmsLink, parseCmsLink, remapCmsEntityLink,
} from '@zenith/shared';

describe('CMS 链接协议', () => {
  it('按 scheme 分层解析实体引用 / 站内路径 / 站外链接', () => {
    expect(parseCmsLink('entity:content/123')).toEqual({ kind: 'entity', entityType: 'content', id: 123, code: null });
    expect(parseCmsLink('entity:channel/45')).toEqual({ kind: 'entity', entityType: 'channel', id: 45, code: null });
    expect(parseCmsLink('internal:/news/')).toEqual({ kind: 'internal', path: '/news/' });
    expect(parseCmsLink('https://example.com')).toEqual({ kind: 'external', url: 'https://example.com' });
  });

  it('按栏目标识引用栏目（站点复制后仍有效的稳定写法）', () => {
    expect(parseCmsLink('entity:channel@news')).toEqual({ kind: 'entity', entityType: 'channel', id: null, code: 'news' });
    expect(parseCmsLink('entity:channel@notice-2')).toEqual({ kind: 'entity', entityType: 'channel', id: null, code: 'notice-2' });
    expect(buildCmsChannelCodeLink('news')).toBe('entity:channel@news');
    expect(isCmsEntityLink('entity:channel@news')).toBe(true);
    expect(isCmsSiteLink('entity:channel@news')).toBe(true);
    // 标识只允许小写字母/数字/中划线；内容不支持 @ 写法
    for (const bad of ['entity:channel@News', 'entity:channel@', 'entity:channel@a_b', 'entity:content@news']) {
      expect(parseCmsLink(bad)).toBeNull();
      expect(isValidCmsLink(bad)).toBe(false);
    }
  });

  it('把历史自由文本数据无损归类，不破坏既有链接', () => {
    // 裸相对路径按站内路径处理（资源治理里已有 /files/download.zip 这类存量数据）
    expect(parseCmsLink('/files/download.zip')).toEqual({ kind: 'internal', path: '/files/download.zip' });
    // 协议相对地址是站外，必须排在裸路径判断之前
    expect(parseCmsLink('//cdn.example.com/a.js')).toEqual({ kind: 'external', url: '//cdn.example.com/a.js' });
    expect(parseCmsLink('mailto:hi@example.com')).toEqual({ kind: 'external', url: 'mailto:hi@example.com' });
    expect(parseCmsLink('  ')).toBeNull();
  });

  it('前缀正确但格式非法时判为非法，不降级成外链', () => {
    for (const bad of ['entity:content/abc', 'entity:foo/1', 'entity:content/0', 'internal:news']) {
      expect(parseCmsLink(bad)).toBeNull();
      expect(isValidCmsLink(bad)).toBe(false);
    }
    // 空值放行（链接字段本就可选）
    expect(isValidCmsLink('')).toBe(true);
    expect(isValidCmsLink(null)).toBe(true);
  });

  it('构造与判定辅助函数互为逆运算', () => {
    expect(buildCmsEntityLink('content', 7)).toBe('entity:content/7');
    expect(buildCmsInternalLink('news/')).toBe('internal:/news/');
    expect(isCmsEntityLink('entity:channel/2')).toBe(true);
    expect(isCmsEntityLink('https://a.com')).toBe(false);
    expect(isCmsSiteLink('/about.html')).toBe(true);
    expect(isCmsSiteLink('https://a.com')).toBe(false);
  });

  it('站点导入时改写实体 id，映射缺失则置空而非错指同 id 记录', () => {
    const remap = remapCmsEntityLink('entity:content/10', (type, id) => (type === 'content' && id === 10 ? 99 : undefined));
    expect(remap).toBe('entity:content/99');
    // 目标未随包导入 → 置空，绝不能保留旧 id 指向本站不相干的记录
    expect(remapCmsEntityLink('entity:channel/10', () => undefined)).toBeNull();
    // 非实体链接原样透传
    expect(remapCmsEntityLink('https://a.com', () => 1)).toBe('https://a.com');
    // 按 code 引用无需重映射，这正是 code 相对 id 的价值
    expect(remapCmsEntityLink('entity:channel@news', () => undefined)).toBe('entity:channel@news');
  });

  it('渲染层解析链接，而非在写入时固化 URL（保证目标改 slug 后自动跟随）', async () => {
    const service = await readFile(new URL('./cms-link.service.ts', import.meta.url), 'utf8');
    expect(service).toContain('buildCmsLinkResolver');
    expect(service).toContain('MAX_HOPS');

    const render = await readFile(new URL('./cms-render.service.ts', import.meta.url), 'utf8');
    // 列表项 / 详情页 302 / 栏目页 302 / RSS 四个出口都必须走解析
    expect(render).toContain('resolveLink');
    expect(render).toContain('resolveCmsLink(site.id, baseUrl, row.externalLink)');
    expect(render).toContain('resolveCmsLink(site.id, baseUrl, channel.linkUrl)');
  });

  it('站点导入把 entity 链接里的 id 一并重映射', async () => {
    const source = await readFile(new URL('./cms-site-transfer.service.ts', import.meta.url), 'utf8');
    expect(source).toContain('remapCmsEntityLink');
    expect(source).toContain('contentIdMap');
    expect(source).toContain('channelIdMap');
  });
});
