import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import { asyncTaskSchema } from '@zenith/shared/tasks';
import {
  DRIVE_ACTIVITY_ACTIONS,
  DRIVE_SPACE_TYPES,
  adminUpdateDriveSpaceSchema,
  createDepartmentDriveSpaceSchema,
  driveSettingsSchema,
} from '@zenith/shared/drive';
import { authMiddleware } from '../../middleware/auth';
import { guard, setAuditAfterData, setAuditBeforeData } from '../../middleware/guard';
import { IdParam, PaginationQuery, commonErrorResponses, dateRangeBound, jsonContent, ok, okBody, okMsg, okPaginated, validationHook } from '../../lib/openapi-schemas';
import { DriveActivityDTO, DriveAdminStatsDTO, DriveSettingsDTO, DriveShareLinkDTO, DriveSpaceDTO } from '../../lib/openapi-dtos';
import { mapAsyncTask } from '../../lib/task-center';
import { listDriveActivitiesForAdmin } from '../../services/drive/drive-activity.service';
import { getDriveAdminStats } from '../../services/drive/drive-admin.service';
import { getDriveSettings, updateDriveSettings } from '../../services/drive/drive-settings.service';
import { adminRevokeDriveShareLink, getShareLinkBeforeAudit, listShareLinksForAdmin } from '../../services/drive/drive-share.service';
import { adminUpdateDriveSpace, createDepartmentSpace, deleteDriveSpace, ensureDriveSpaceExists, listDriveSpacesForAdmin } from '../../services/drive/drive-spaces.service';
import { submitRecalcUsageTask, submitReindexTask } from '../../services/drive/drive-tasks.service';

const router = new OpenAPIHono({ defaultHook: validationHook });
const TAG = '企业网盘-管理';
const STATES = ['active', 'expired', 'exhausted', 'disabled', 'revoked'] as const;

const statsRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/stats', tags: [TAG], summary: '网盘统计概览',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:admin:stats:view' })] as const,
    responses: { ...commonErrorResponses, ...ok(DriveAdminStatsDTO, '统计') },
  }),
  handler: async (c) => c.json(okBody(await getDriveAdminStats()), 200),
});

const settingsRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/settings', tags: [TAG], summary: '网盘设置',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:setting:view' })] as const,
    responses: { ...commonErrorResponses, ...ok(DriveSettingsDTO, '设置') },
  }),
  handler: async (c) => c.json(okBody(await getDriveSettings()), 200),
});

const saveSettingsRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'put', path: '/settings', tags: [TAG], summary: '保存网盘设置（整体替换）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:setting:edit', audit: { description: '保存网盘设置', module: '企业网盘' } })] as const,
    request: { body: { content: jsonContent(driveSettingsSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(DriveSettingsDTO, '已保存') },
  }),
  handler: async (c) => {
    setAuditBeforeData(c, await getDriveSettings());
    return c.json(okBody(await updateDriveSettings(c.req.valid('json')), '已保存'), 200);
  },
});

const spacesRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/spaces', tags: [TAG], summary: '全部空间（租户 + 数据权限收窄）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:admin:space:list' })] as const,
    request: {
      query: PaginationQuery.extend({
        keyword: z.string().optional(),
        type: z.enum(DRIVE_SPACE_TYPES).optional(),
        status: z.enum(['enabled', 'disabled']).optional(),
        departmentId: z.coerce.number().int().positive().optional(),
        ownerId: z.coerce.number().int().positive().optional(),
      }),
    },
    responses: { ...commonErrorResponses, ...okPaginated(DriveSpaceDTO, '空间列表') },
  }),
  handler: async (c) => c.json(okBody(await listDriveSpacesForAdmin(c.req.valid('query'))), 200),
});

const createDepartmentSpaceRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/spaces/department', tags: [TAG], summary: '创建部门空间',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:admin:space:edit', audit: { description: '创建部门网盘空间', module: '企业网盘' } })] as const,
    request: { body: { content: jsonContent(createDepartmentDriveSpaceSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(DriveSpaceDTO, '创建成功') },
  }),
  handler: async (c) => c.json(okBody(await createDepartmentSpace(c.req.valid('json')), '创建成功'), 200),
});

const updateSpaceRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'put', path: '/spaces/{id}', tags: [TAG], summary: '治理空间（配额 / 状态 / 所有者 / 外链开关）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:admin:space:edit', audit: { description: '治理网盘空间', module: '企业网盘' } })] as const,
    request: { params: IdParam, body: { content: jsonContent(adminUpdateDriveSpaceSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(DriveSpaceDTO, '已更新') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    setAuditBeforeData(c, await ensureDriveSpaceExists(id));
    return c.json(okBody(await adminUpdateDriveSpace(id, c.req.valid('json')), '已更新'), 200);
  },
});

const deleteSpaceRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'delete', path: '/spaces/{id}', tags: [TAG], summary: '删除空空间',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:admin:space:delete', audit: { description: '删除网盘空间', module: '企业网盘' } })] as const,
    request: { params: IdParam },
    responses: { ...commonErrorResponses, ...okMsg('删除成功') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    setAuditBeforeData(c, await ensureDriveSpaceExists(id));
    await deleteDriveSpace(id);
    return c.json(okBody(null, '删除成功'), 200);
  },
});

const recalcRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/spaces/recalc', tags: [TAG], summary: '重算容量（任务中心；不传 spaceId 为全部）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:admin:space:edit', audit: { description: '重算网盘容量', module: '企业网盘' } })] as const,
    request: { body: { content: jsonContent(z.object({ spaceId: z.number().int().positive().optional() })), required: false } },
    responses: { ...commonErrorResponses, ...ok(asyncTaskSchema, '任务已提交') },
  }),
  handler: async (c) => {
    const body = c.req.valid('json');
    const task = await submitRecalcUsageTask(body?.spaceId);
    return c.json(okBody(mapAsyncTask(task), '任务已提交'), 200);
  },
});

const reindexRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/reindex', tags: [TAG], summary: '补建缩略图 / 全文索引（任务中心）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:admin:space:edit', audit: { description: '补建网盘索引', module: '企业网盘' } })] as const,
    request: { body: { content: jsonContent(z.object({ spaceId: z.number().int().positive().optional() })), required: false } },
    responses: { ...commonErrorResponses, ...ok(asyncTaskSchema, '任务已提交') },
  }),
  handler: async (c) => {
    const body = c.req.valid('json');
    const task = await submitReindexTask(body?.spaceId);
    return c.json(okBody(mapAsyncTask(task), '任务已提交'), 200);
  },
});

const shareLinksRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/share-links', tags: [TAG], summary: '全部外链（治理）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:admin:link:list' })] as const,
    request: {
      query: PaginationQuery.extend({
        keyword: z.string().optional(),
        spaceId: z.coerce.number().int().positive().optional(),
        createdBy: z.coerce.number().int().positive().optional(),
        state: z.enum(STATES).optional(),
        startTime: dateRangeBound('创建时间起'),
        endTime: dateRangeBound('创建时间止'),
      }),
    },
    responses: { ...commonErrorResponses, ...okPaginated(DriveShareLinkDTO, '外链列表') },
  }),
  handler: async (c) => c.json(okBody(await listShareLinksForAdmin(c.req.valid('query'))), 200),
});

const revokeShareLinkRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/share-links/{id}/revoke', tags: [TAG], summary: '管理员撤销外链',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:admin:link:revoke', audit: { description: '管理员撤销网盘外链', module: '企业网盘' } })] as const,
    request: { params: IdParam },
    responses: { ...commonErrorResponses, ...okMsg('已撤销') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    setAuditBeforeData(c, await getShareLinkBeforeAudit(id));
    await adminRevokeDriveShareLink(id);
    setAuditAfterData(c, await getShareLinkBeforeAudit(id));
    return c.json(okBody(null, '已撤销'), 200);
  },
});

const activitiesRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/activities', tags: [TAG], summary: '全局文件动态审计',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:admin:activity:list' })] as const,
    request: {
      query: PaginationQuery.extend({
        keyword: z.string().optional(),
        spaceId: z.coerce.number().int().positive().optional(),
        actorId: z.coerce.number().int().positive().optional(),
        action: z.enum(DRIVE_ACTIVITY_ACTIONS).optional(),
        startTime: dateRangeBound('时间起'),
        endTime: dateRangeBound('时间止'),
      }),
    },
    responses: { ...commonErrorResponses, ...okPaginated(DriveActivityDTO, '动态') },
  }),
  handler: async (c) => c.json(okBody(await listDriveActivitiesForAdmin(c.req.valid('query'))), 200),
});

router.openapiRoutes([
  statsRoute, settingsRoute, saveSettingsRoute,
  spacesRoute, createDepartmentSpaceRoute, recalcRoute, updateSpaceRoute, deleteSpaceRoute, reindexRoute,
  shareLinksRoute, revokeShareLinkRoute, activitiesRoute,
] as const);

export default router;
