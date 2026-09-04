import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import { updateDriveShareLinkSchema } from '@zenith/shared/drive';
import { authMiddleware } from '../../middleware/auth';
import { guard, setAuditAfterData, setAuditBeforeData } from '../../middleware/guard';
import { IdParam, PaginationQuery, commonErrorResponses, dateRangeBound, jsonContent, ok, okBody, okMsg, okPaginated, validationHook } from '../../lib/openapi-schemas';
import { DriveShareAccessLogDTO, DriveShareLinkDTO } from '../../lib/openapi-dtos';
import {
  deleteDriveShareLink,
  getShareLinkBeforeAudit,
  listMyShareLinks,
  listShareAccessLogs,
  revokeDriveShareLink,
  updateDriveShareLink,
} from '../../services/drive/drive-share.service';

const router = new OpenAPIHono({ defaultHook: validationHook });
const TAG = '企业网盘-外链';
const STATES = ['active', 'expired', 'exhausted', 'disabled', 'revoked'] as const;

const listRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/', tags: [TAG], summary: '我创建的外链',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:link:create' })] as const,
    request: {
      query: PaginationQuery.extend({
        keyword: z.string().optional(),
        spaceId: z.coerce.number().int().positive().optional(),
        state: z.enum(STATES).optional(),
        startTime: dateRangeBound('创建时间起'),
        endTime: dateRangeBound('创建时间止'),
      }),
    },
    responses: { ...commonErrorResponses, ...okPaginated(DriveShareLinkDTO, '外链列表') },
  }),
  handler: async (c) => c.json(okBody(await listMyShareLinks(c.req.valid('query'))), 200),
});

const updateRoute_ = defineOpenAPIRoute({
  route: createRoute({
    method: 'put', path: '/{id}', tags: [TAG], summary: '修改外链（创建者或节点 manager）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:link:create', audit: { description: '修改网盘外链', module: '企业网盘', recordBody: false } })] as const,
    request: { params: IdParam, body: { content: jsonContent(updateDriveShareLinkSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(DriveShareLinkDTO, '已更新') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    setAuditBeforeData(c, await getShareLinkBeforeAudit(id));
    return c.json(okBody(await updateDriveShareLink(id, c.req.valid('json')), '已更新'), 200);
  },
});

const revokeRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/{id}/revoke', tags: [TAG], summary: '撤销外链（保留记录）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:link:create', audit: { description: '撤销网盘外链', module: '企业网盘' } })] as const,
    request: { params: IdParam },
    responses: { ...commonErrorResponses, ...okMsg('已撤销') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    setAuditBeforeData(c, await getShareLinkBeforeAudit(id));
    await revokeDriveShareLink(id);
    setAuditAfterData(c, await getShareLinkBeforeAudit(id));
    return c.json(okBody(null, '已撤销'), 200);
  },
});

const deleteRoute_ = defineOpenAPIRoute({
  route: createRoute({
    method: 'delete', path: '/{id}', tags: [TAG], summary: '删除外链记录',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:link:create', audit: { description: '删除网盘外链', module: '企业网盘' } })] as const,
    request: { params: IdParam },
    responses: { ...commonErrorResponses, ...okMsg('已删除') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    setAuditBeforeData(c, await getShareLinkBeforeAudit(id));
    await deleteDriveShareLink(id);
    return c.json(okBody(null, '已删除'), 200);
  },
});

const accessLogsRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/{id}/access-logs', tags: [TAG], summary: '外链访问日志',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:link:create' })] as const,
    request: { params: IdParam, query: PaginationQuery },
    responses: { ...commonErrorResponses, ...okPaginated(DriveShareAccessLogDTO, '访问日志') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    const { page, pageSize } = c.req.valid('query');
    return c.json(okBody(await listShareAccessLogs(id, page, pageSize)), 200);
  },
});

router.openapiRoutes([listRoute, updateRoute_, revokeRoute, deleteRoute_, accessLogsRoute] as const);

export default router;
