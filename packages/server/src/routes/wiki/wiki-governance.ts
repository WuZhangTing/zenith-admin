import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import {
  WIKI_GOVERNANCE_KINDS,
  importWikiDocsSchema,
  wikiGovernanceArchiveSchema,
  wikiGovernanceBatchSchema,
  wikiGovernanceOwnerSchema,
  wikiGovernanceReviewSchema,
} from '@zenith/shared/wiki';
import { authMiddleware } from '../../middleware/auth';
import { guard } from '../../middleware/guard';
import {
  jsonContent, PaginationQuery, validationHook, commonErrorResponses,
  ok, okPaginated, okMsg, okBody,
} from '../../lib/openapi-schemas';
import { WikiGovernanceDocDTO, WikiImportResultDTO, WikiNoResultKeywordDTO } from '../../lib/openapi-dtos';
import {
  archiveGovernanceDocs, importWikiDocs, listGovernanceDocs, listNoResultKeywords,
  remindGovernanceOwners, setGovernanceOwner, setGovernanceReview,
} from '../../services/wiki/governance.service';

const governanceRouter = new OpenAPIHono({ defaultHook: validationHook });

const listRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/docs',
    tags: ['知识中心-治理'], summary: '治理清单（过期/待复审/长期未更新/无负责人/积压/已归档）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'wiki:governance:list' })] as const,
    request: {
      query: PaginationQuery.extend({
        kind: z.enum(WIKI_GOVERNANCE_KINDS).openapi({ param: { name: 'kind', in: 'query' }, example: 'expired' }),
      }),
    },
    responses: { ...commonErrorResponses, ...okPaginated(WikiGovernanceDocDTO, '治理清单') },
  }),
  handler: async (c) => {
    const { kind, ...q } = c.req.valid('query');
    return c.json(okBody(await listGovernanceDocs(kind, q)), 200);
  },
});

const noResultRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/no-result-keywords',
    tags: ['知识中心-治理'], summary: '无结果搜索关键词（近 30 天知识缺口）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'wiki:governance:list' })] as const,
    responses: { ...commonErrorResponses, ...ok(z.array(WikiNoResultKeywordDTO), '无结果关键词') },
  }),
  handler: async (c) => c.json(okBody(await listNoResultKeywords()), 200),
});

const remindRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/remind',
    tags: ['知识中心-治理'], summary: '批量提醒负责人',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'wiki:governance:remind',
      audit: { description: '提醒文档负责人', module: '知识中心' },
    })] as const,
    request: { body: { content: jsonContent(wikiGovernanceBatchSchema), required: true } },
    responses: { ...commonErrorResponses, ...okMsg('已提醒') },
  }),
  handler: async (c) => {
    const { ids } = c.req.valid('json');
    const sent = await remindGovernanceOwners(ids);
    return c.json(okBody(null, `已提醒 ${sent} 位负责人`), 200);
  },
});

const archiveRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/archive',
    tags: ['知识中心-治理'], summary: '批量归档 / 取消归档',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'wiki:governance:archive',
      audit: { description: '归档文档', module: '知识中心' },
    })] as const,
    request: { body: { content: jsonContent(wikiGovernanceArchiveSchema), required: true } },
    responses: { ...commonErrorResponses, ...okMsg('操作成功') },
  }),
  handler: async (c) => {
    const { ids, archived } = c.req.valid('json');
    const count = await archiveGovernanceDocs(ids, archived);
    return c.json(okBody(null, `${archived ? '已归档' : '已取消归档'} ${count} 篇`), 200);
  },
});

const ownerRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/owner',
    tags: ['知识中心-治理'], summary: '批量指定负责人',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'wiki:governance:edit',
      audit: { description: '指定文档负责人', module: '知识中心' },
    })] as const,
    request: { body: { content: jsonContent(wikiGovernanceOwnerSchema), required: true } },
    responses: { ...commonErrorResponses, ...okMsg('已指定') },
  }),
  handler: async (c) => {
    const { ids, ownerId } = c.req.valid('json');
    const count = await setGovernanceOwner(ids, ownerId);
    return c.json(okBody(null, `已为 ${count} 篇文档指定负责人`), 200);
  },
});

const reviewRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/review-cycle',
    tags: ['知识中心-治理'], summary: '批量设置复审周期与有效期',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'wiki:governance:edit',
      audit: { description: '设置文档复审周期', module: '知识中心' },
    })] as const,
    request: { body: { content: jsonContent(wikiGovernanceReviewSchema), required: true } },
    responses: { ...commonErrorResponses, ...okMsg('已设置') },
  }),
  handler: async (c) => {
    const { ids, reviewCycleDays, expireAt } = c.req.valid('json');
    const count = await setGovernanceReview(ids, reviewCycleDays, expireAt);
    return c.json(okBody(null, `已为 ${count} 篇文档设置复审`), 200);
  },
});

const importRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/import',
    tags: ['知识中心-治理'], summary: '批量导入 Markdown 文件为草稿',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'wiki:doc:create',
      audit: { description: '批量导入文档', module: '知识中心' },
    })] as const,
    request: { body: { content: jsonContent(importWikiDocsSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(WikiImportResultDTO, '导入结果') },
  }),
  handler: async (c) => {
    const result = await importWikiDocs(c.req.valid('json'));
    return c.json(okBody(result, `已导入 ${result.importedCount} 篇草稿`), 200);
  },
});

governanceRouter.openapiRoutes([
  listRoute,
  noResultRoute,
  remindRoute,
  archiveRoute,
  ownerRoute,
  reviewRoute,
  importRoute,
] as const);

export default governanceRouter;
