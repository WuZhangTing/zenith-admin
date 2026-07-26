import { describe, expect, it } from 'vitest';
import {
  canonicalizeCmsResourceUris,
  cmsResourceUri,
  extractCandidateUrls,
  extractCmsResourceIds,
  extractCmsResourceRefFields,
  parseCmsResourceUri,
  remapCmsResourceUris,
  resolveCmsResourceUris,
} from './cms-resource-uri';

describe('cms-resource-uri', () => {
  describe('parseCmsResourceUri', () => {
    it('只在整串恰好是句柄时返回 id', () => {
      expect(parseCmsResourceUri('cms-res://42')).toBe(42);
      expect(parseCmsResourceUri('cms-res://0')).toBeNull();
      expect(parseCmsResourceUri('cms-res://abc')).toBeNull();
      expect(parseCmsResourceUri('<img src="cms-res://42">')).toBeNull();
      expect(parseCmsResourceUri(null)).toBeNull();
    });
  });

  describe('extractCmsResourceIds', () => {
    it('深度遍历字符串 / 数组 / 对象并去重', () => {
      const value = {
        coverImage: cmsResourceUri(7),
        body: '<p><img src="cms-res://7"><img src="cms-res://9"></p>',
        mediaData: { images: [{ url: cmsResourceUri(9) }, { url: cmsResourceUri(11) }] },
      };
      expect(extractCmsResourceIds(value)).toEqual([7, 9, 11]);
    });

    it('无句柄时返回空数组', () => {
      expect(extractCmsResourceIds({ body: '<p>纯文本</p>' })).toEqual([]);
    });
  });

  describe('extractCmsResourceRefFields', () => {
    it('按顶层字段归集引用', () => {
      const refs = extractCmsResourceRefFields({
        coverImage: cmsResourceUri(1),
        body: `<img src="${cmsResourceUri(2)}">`,
        summary: '没有素材',
      });
      expect(refs).toEqual([
        { field: 'coverImage', resourceId: 1 },
        { field: 'body', resourceId: 2 },
      ]);
    });
  });

  describe('extractCandidateUrls', () => {
    it('识别 HTML 属性中的站内路径与绝对 URL', () => {
      const urls = extractCandidateUrls({
        body: '<img src="/uploads/2026/a.jpg"><a href="https://cdn.test/x/b.png">下载</a>',
      });
      expect(urls).toContain('/uploads/2026/a.jpg');
      expect(urls).toContain('https://cdn.test/x/b.png');
    });

    it('标量列整串即 URL 时同样能被识别', () => {
      expect(extractCandidateUrls({ coverImage: '/api/files/abc/content' }))
        .toContain('/api/files/abc/content');
    });
  });

  describe('canonicalizeCmsResourceUris', () => {
    it('把已登记 URL 替换为句柄，未登记的原样保留', () => {
      const out = canonicalizeCmsResourceUris(
        {
          coverImage: '/uploads/a.jpg',
          body: '<img src="/uploads/a.jpg"><img src="https://other.test/x.png">',
        },
        new Map([['/uploads/a.jpg', 5]]),
      );
      expect(out.coverImage).toBe('cms-res://5');
      expect(out.body).toBe('<img src="cms-res://5"><img src="https://other.test/x.png">');
    });

    it('长 URL 优先匹配，避免前缀相同的地址被抢先替换', () => {
      const out = canonicalizeCmsResourceUris(
        { body: '<a href="/uploads/a.jpg.bak"><img src="/uploads/a.jpg">' },
        new Map([['/uploads/a.jpg', 1], ['/uploads/a.jpg.bak', 2]]),
      );
      expect(out.body).toBe('<a href="cms-res://2"><img src="cms-res://1">');
    });

    it('空映射时原样返回', () => {
      const input = { body: '<img src="/uploads/a.jpg">' };
      expect(canonicalizeCmsResourceUris(input, new Map())).toBe(input);
    });
  });

  describe('resolveCmsResourceUris', () => {
    it('句柄还原为真实 URL', () => {
      const out = resolveCmsResourceUris(
        { body: `<img src="${cmsResourceUri(3)}">`, cover: cmsResourceUri(4) },
        (id) => (id === 3 ? '/uploads/three.jpg' : '/uploads/four.jpg'),
      );
      expect(out.body).toBe('<img src="/uploads/three.jpg">');
      expect(out.cover).toBe('/uploads/four.jpg');
    });

    it('素材缺失时替换为空串，不把内部句柄泄露到页面', () => {
      const out = resolveCmsResourceUris({ cover: cmsResourceUri(99) }, () => null);
      expect(out.cover).toBe('');
    });

    it('不修改入参', () => {
      const input = { nested: { cover: cmsResourceUri(1) } };
      const out = resolveCmsResourceUris(input, () => '/x.jpg');
      expect(input.nested.cover).toBe(cmsResourceUri(1));
      expect(out.nested.cover).toBe('/x.jpg');
    });

    it('保留非字符串叶子与数组结构', () => {
      const out = resolveCmsResourceUris(
        { sort: 3, flag: true, images: [{ url: cmsResourceUri(1), width: 100 }] },
        () => '/x.jpg',
      );
      expect(out).toEqual({ sort: 3, flag: true, images: [{ url: '/x.jpg', width: 100 }] });
    });
  });

  describe('remapCmsResourceUris', () => {
    it('按映射改写句柄，缺失映射的保持原值', () => {
      const out = remapCmsResourceUris(
        { body: `<img src="${cmsResourceUri(1)}"><img src="${cmsResourceUri(2)}">` },
        new Map([[1, 100]]),
      );
      expect(out.body).toBe('<img src="cms-res://100"><img src="cms-res://2">');
    });
  });
});
