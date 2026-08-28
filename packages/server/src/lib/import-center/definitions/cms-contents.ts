/**
 * CMS 内容批量导入 Definition（收编 cms-tasks 原私有任务 cms-content-import）。
 * 需要页面上下文 siteId/channelId（contextSchema 校验），逐行创建草稿内容。
 */
import { z } from 'zod';
import { createCmsContent, ensureCmsContentTargetAccess } from '../../../services/cms/cms-contents.service';
import { registerImport } from '../registry';

const contextSchema = z.object({
  siteId: z.coerce.number().int().positive({ message: '缺少站点参数' }),
  channelId: z.coerce.number().int().positive({ message: '缺少栏目参数' }),
});

interface ContentRow {
  title: string;
  summary: string | null;
  body: string | null;
  author: string | null;
  source: string | null;
}

interface Prepared {
  siteId: number;
  channelId: number;
}

export function registerCmsContentsImport(): void {
  registerImport<ContentRow, Prepared>({
    entity: 'cms.contents',
    title: 'CMS 内容',
    module: 'CMS内容管理',
    permission: 'cms:content:create',
    description: '批量导入内容为草稿（需在内容管理页选定站点与栏目后发起）',
    maxRows: 2000,
    columns: [
      { key: 'title', header: '标题', required: true, example: '示例文章标题' },
      { key: 'summary', header: '摘要' },
      { key: 'body', header: '正文' },
      { key: 'author', header: '作者' },
      { key: 'source', header: '来源' },
    ],
    contextSchema,
    async prepare(context) {
      const { siteId, channelId } = contextSchema.parse(context);
      await ensureCmsContentTargetAccess(siteId, channelId);
      return { siteId, channelId };
    },
    parseRow(cells) {
      if (!cells.title) throw new Error('标题为必填项');
      return {
        title: cells.title.slice(0, 255),
        summary: cells.summary || null,
        body: cells.body || null,
        author: cells.author || null,
        source: cells.source || null,
      };
    },
    async insertRow(row, prepared) {
      await createCmsContent({
        siteId: prepared.siteId,
        channelId: prepared.channelId,
        title: row.title,
        summary: row.summary,
        body: row.body,
        author: row.author,
        source: row.source,
        extend: {},
        isTop: false,
        isRecommend: false,
        isHot: false,
        sort: 0,
        tagIds: [],
        extraChannelIds: [],
        relatedIds: [],
      });
    },
    rowLabel: (row) => row.title,
  });
}
