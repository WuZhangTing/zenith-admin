import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { cmsWidgetDataSchema, type CmsResolvedWidget } from '@zenith/shared';
import { getThemeWidgetSlots, listThemeWidgetRenderers } from '../../cms/themes/registry';
import { renderCmsWidgetHtml } from '../../cms/themes/widgets';

async function source(name: string): Promise<string> {
  return readFile(new URL(`./${name}`, import.meta.url), 'utf8');
}

describe('CMS page widgets', () => {
  it('validates manual and live-source items while rejecting ambiguous input', () => {
    expect(cmsWidgetDataSchema.parse({
      items: [
        { id: 'manual', sourceType: 'manual', title: '手工条目' },
        { id: 'content', sourceType: 'content', sourceId: 1 },
        { id: 'channel', sourceType: 'channel', sourceId: 2 },
      ],
    }).items).toHaveLength(3);

    expect(() => cmsWidgetDataSchema.parse({
      items: [{ id: 'manual', sourceType: 'manual' }],
    })).toThrow(/标题不能为空/);
    expect(() => cmsWidgetDataSchema.parse({
      items: [{ id: 'content', sourceType: 'content' }],
    })).toThrow(/来源 ID/);
    expect(() => cmsWidgetDataSchema.parse({
      items: [
        { id: 'same', sourceType: 'manual', title: 'A' },
        { id: 'same', sourceType: 'manual', title: 'B' },
      ],
    })).toThrow(/不能重复/);
  });

  it('renders all registered templates with React escaping', () => {
    const base: Omit<CmsResolvedWidget, 'rendererKey'> = {
      id: 1,
      name: '推荐 <script>',
      type: 'manual-list',
      items: [{
        id: 'one',
        sourceType: 'manual',
        sourceId: null,
        title: '<img src=x onerror=alert(1)>',
        summary: '安全摘要',
        url: '/safe',
        image: null,
        displayDate: null,
      }],
    };
    for (const rendererKey of ['list-sidebar', 'list-grid', 'list-carousel'] as const) {
      const html = renderCmsWidgetHtml({ ...base, rendererKey });
      expect(html).toContain('cms-widget');
      expect(html).not.toContain('<script>');
      expect(html).not.toContain('<img src=x onerror');
      expect(html).toContain('&lt;img');
    }
  });

  it('declares the same home sidebar slot for both built-in themes', () => {
    for (const theme of ['default', 'docs']) {
      expect(getThemeWidgetSlots(theme)).toEqual([expect.objectContaining({
        key: 'home.sidebar',
        allowedTypes: ['manual-list'],
      })]);
      expect(listThemeWidgetRenderers(theme, 'manual-list').map((item) => item.key)).toEqual([
        'list-sidebar',
        'list-grid',
        'list-carousel',
      ]);
    }
  });

  it('keeps page refs, source guards, transfer and rendering wired end to end', async () => {
    const [pages, contents, channels, transfer, render] = await Promise.all([
      source('cms-pages.service.ts'),
      source('cms-contents.service.ts'),
      source('cms-channels.service.ts'),
      source('cms-site-transfer.service.ts'),
      source('cms-render.service.ts'),
    ]);
    expect(pages).toContain('syncCmsPageWidgetRefs');
    expect(pages).toContain('deleteCmsPageWidgetRefs');
    expect(contents).toContain("assertCmsWidgetSourcesMutable('content'");
    expect(contents).toContain("submitCmsWidgetSourceRefreshSideEffect('content'");
    expect(contents).toContain("assertCmsWidgetSourcesMutable('content', [id], tx)");
    expect(channels).toContain("assertCmsWidgetSourcesMutable('channel'");
    expect(channels).toContain("assertCmsWidgetSourcesMutable('channel', [id], tx)");
    expect(channels).toContain('submitCmsWidgetChannelRefreshSideEffect([id])');
    expect(transfer).toContain('widgetIdMap');
    expect(transfer).toContain('remapImportedWidgetBlocks');
    expect(render).toContain('resolveCmsWidgetPlacements');
    expect(render).toContain("resolveCmsWidgetSlotForRender(site.id, 'home.sidebar'");
  });
});
