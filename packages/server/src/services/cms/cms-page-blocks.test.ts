import { describe, expect, it } from 'vitest';
import { sanitizeCmsPageBlocks } from './cms-page-blocks';

describe('CMS imported visual content safety', () => {
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
