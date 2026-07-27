import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import type { CmsBaseContext } from '../../cms/themes/types';
import { renderBlocksHtml } from '../../cms/themes/blocks';
import { sanitizeCmsImportedFragment, normalizeImportedCmsFragmentType } from './cms-fragment-content';
import { sanitizeCmsPageBlocks } from './cms-page-blocks';

describe('CMS imported visual content safety', () => {
  it('sanitizes imported HTML fragments', () => {
    const clean = sanitizeCmsImportedFragment(
      'html',
      '<div onclick="alert(1)"><script>alert(2)</script><a href="javascript:alert(3)">link</a><p>safe</p></div>',
    );
    expect(clean).toContain('<p>safe</p>');
    expect(clean).not.toMatch(/onclick|script|javascript:/i);
  });

  it('拒绝已移除的 json 类型（写入口），导入包则降级为 text 而非整包失败', () => {
    expect(() => sanitizeCmsImportedFragment('json', '{"a":1}')).toThrow();
    expect(normalizeImportedCmsFragmentType('json')).toBe('text');
    expect(normalizeImportedCmsFragmentType('image')).toBe('image');
    expect(normalizeImportedCmsFragmentType('who-knows')).toBe('html');
    expect(normalizeImportedCmsFragmentType(undefined)).toBe('html');
  });

  it('text 碎片按纯文本渲染，HTML 样值保持惰性', () => {
    const rendered = renderBlocksHtml({
      blocks: [{
        id: 'text-fragment',
        type: 'fragment',
        props: { code: 'unsafe-text' },
      }],
      ctx: {
        fragments: {
          'unsafe-text': { type: 'text', content: '<img src=x onerror=alert(1)>' },
        },
      } as CmsBaseContext,
      contentListData: new Map(),
    });
    expect(rendered).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(rendered).not.toContain('<img src=x');
  });

  it('routes default and docs theme fragments through the safe renderer', async () => {
    const [defaultTheme, docsTheme] = await Promise.all([
      readFile(new URL('../../cms/themes/default/templates.tsx', import.meta.url), 'utf8'),
      readFile(new URL('../../cms/themes/docs/index.tsx', import.meta.url), 'utf8'),
    ]);
    expect(defaultTheme).toContain('CmsFragmentContent');
    expect(defaultTheme).not.toContain('__html: fragment.content');
    expect(docsTheme).toContain('CmsFragmentContent');
    expect(docsTheme).not.toContain('__html: banner.content');
  });

  it('validates block shape and sanitizes nested richtext HTML', () => {
    const blocks = sanitizeCmsPageBlocks([
      {
        id: 'rich-1',
        type: 'richtext',
        props: {
          html: '<p onmouseover="alert(1)">text<img src="data:text/html,evil"></p>',
        },
      },
    ]);
    expect(blocks).toHaveLength(1);
    expect(String(blocks[0].props.html)).toContain('<p>text');
    expect(String(blocks[0].props.html)).not.toMatch(/onmouseover|data:/i);
  });

  it('rejects unknown, duplicate or malformed blocks', () => {
    expect(() => sanitizeCmsPageBlocks({})).toThrow();
    expect(() => sanitizeCmsPageBlocks([{ id: 'x', type: 'unknown', props: {} }])).toThrow();
    expect(() => sanitizeCmsPageBlocks([
      { id: 'same', type: 'hero', props: {} },
      { id: 'same', type: 'image', props: {} },
    ])).toThrow();
  });
});
