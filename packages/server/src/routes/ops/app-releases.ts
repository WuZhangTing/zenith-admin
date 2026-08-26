/**
 * 应用版本管理（管理侧 API）。
 *
 * 应用 / 版本 / 制品 CRUD、发布状态机（publish / revoke）、灰度调整与升级看板统计。
 * 公开侧（客户端检查更新 / 制品分发）在 public-app-releases.ts，不要混入本文件。
 */
import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import {
  APP_ARCHES,
  APP_FILE_ARTIFACT_KINDS,
  APP_PLATFORMS,
  APP_RELEASE_CHANNELS,
  APP_RELEASE_STATUSES,
  createAppReleaseSchema,
  createClientAppSchema,
  createExternalArtifactSchema,
  setAppReleaseRolloutSchema,
  updateAppReleaseSchema,
  updateClientAppSchema,
} from '@zenith/shared/ops';
import { authMiddleware } from '../../middleware/auth';
import { guard, setAuditBeforeData } from '../../middleware/guard';
import {
  ErrorResponse,
  IdParam,
  PaginationQuery,
  commonErrorResponses,
  errBody,
  jsonContent,
  ok,
  okBody,
  okMsg,
  okPaginated,
  validationHook,
} from '../../lib/openapi-schemas';
import { AppArtifactDTO, AppReleaseDTO, AppReleaseStatsDTO, ClientAppDTO, ClientDeviceDTO } from '../../lib/openapi-dtos';
import {
  addExternalArtifact,
  addFileArtifact,
  createAppRelease,
  createClientApp,
  deleteAppArtifact,
  deleteAppRelease,
  deleteClientApp,
  getAppArtifactBeforeAudit,
  getAppRelease,
  getAppReleaseBeforeAudit,
  getAppReleaseStats,
  getClientAppBeforeAudit,
  listAllClientApps,
  listAppReleases,
  listClientApps,
  publishAppRelease,
  revokeAppRelease,
  setAppReleaseRollout,
  updateAppRelease,
  updateClientApp,
} from '../../services/ops/app-releases.service';
import {
  adminUnbindDevicePush,
  deleteClientDevice,
  getClientDeviceBeforeAudit,
  listClientDevices,
} from '../../services/ops/client-devices.service';

const router = new OpenAPIHono({ defaultHook: validationHook });

// ─── 应用 ────────────────────────────────────────────────────────────────────

const listAppsRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/apps',
    tags: ['应用版本管理'], summary: '应用列表',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'system:app-release:list' })] as const,
    request: {
      query: PaginationQuery.extend({
        keyword: z.string().max(256).optional(),
        status: z.enum(['enabled', 'disabled']).optional(),
      }),
    },
    responses: { ...commonErrorResponses, ...okPaginated(ClientAppDTO, '应用列表') },
  }),
  handler: async (c) => c.json(okBody(await listClientApps(c.req.valid('query'))), 200),
});

const allAppsRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/apps/all',
    tags: ['应用版本管理'], summary: '全部启用应用（应用切换器）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'system:app-release:list' })] as const,
    responses: { ...commonErrorResponses, ...ok(z.array(ClientAppDTO), '全部启用应用') },
  }),
  handler: async (c) => c.json(okBody(await listAllClientApps()), 200),
});

const createAppRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/apps',
    tags: ['应用版本管理'], summary: '创建应用',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'system:app-release:create',
      audit: { description: '创建应用', module: '应用版本管理' },
    })] as const,
    request: { body: { content: jsonContent(createClientAppSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(ClientAppDTO, '创建成功') },
  }),
  handler: async (c) => c.json(okBody(await createClientApp(c.req.valid('json')), '创建成功'), 200),
});

const updateAppRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'put', path: '/apps/{id}',
    tags: ['应用版本管理'], summary: '更新应用',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'system:app-release:update',
      audit: { description: '更新应用', module: '应用版本管理' },
    })] as const,
    request: { params: IdParam, body: { content: jsonContent(updateClientAppSchema), required: true } },
    responses: {
      ...commonErrorResponses,
      ...ok(ClientAppDTO, '更新成功'),
      404: { content: jsonContent(ErrorResponse), description: '不存在' },
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    setAuditBeforeData(c, await getClientAppBeforeAudit(id));
    return c.json(okBody(await updateClientApp(id, c.req.valid('json')), '更新成功'), 200);
  },
});

const deleteAppRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'delete', path: '/apps/{id}',
    tags: ['应用版本管理'], summary: '删除应用',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'system:app-release:delete',
      audit: { description: '删除应用', module: '应用版本管理' },
    })] as const,
    request: { params: IdParam },
    responses: {
      ...commonErrorResponses,
      ...okMsg('删除成功'),
      404: { content: jsonContent(ErrorResponse), description: '不存在' },
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    setAuditBeforeData(c, await getClientAppBeforeAudit(id));
    await deleteClientApp(id);
    return c.json(okBody(null, '删除成功'), 200);
  },
});

// ─── 版本 ────────────────────────────────────────────────────────────────────

const listReleasesRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/releases',
    tags: ['应用版本管理'], summary: '版本列表',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'system:app-release:list' })] as const,
    request: {
      query: PaginationQuery.extend({
        appId: z.coerce.number().int().positive().optional(),
        channel: z.enum(APP_RELEASE_CHANNELS).optional(),
        status: z.enum(APP_RELEASE_STATUSES).optional(),
        keyword: z.string().max(256).optional(),
      }),
    },
    responses: { ...commonErrorResponses, ...okPaginated(AppReleaseDTO, '版本列表') },
  }),
  handler: async (c) => c.json(okBody(await listAppReleases(c.req.valid('query'))), 200),
});

const getReleaseRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/releases/{id}',
    tags: ['应用版本管理'], summary: '版本详情（含制品）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'system:app-release:list' })] as const,
    request: { params: IdParam },
    responses: {
      ...commonErrorResponses,
      ...ok(AppReleaseDTO, '版本详情'),
      404: { content: jsonContent(ErrorResponse), description: '不存在' },
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    return c.json(okBody(await getAppRelease(id)), 200);
  },
});

const createReleaseRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/releases',
    tags: ['应用版本管理'], summary: '创建版本（草稿）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'system:app-release:create',
      audit: { description: '创建版本', module: '应用版本管理' },
    })] as const,
    request: { body: { content: jsonContent(createAppReleaseSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(AppReleaseDTO, '创建成功') },
  }),
  handler: async (c) => c.json(okBody(await createAppRelease(c.req.valid('json')), '创建成功'), 200),
});

const updateReleaseRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'put', path: '/releases/{id}',
    tags: ['应用版本管理'], summary: '更新版本',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'system:app-release:update',
      audit: { description: '更新版本', module: '应用版本管理' },
    })] as const,
    request: { params: IdParam, body: { content: jsonContent(updateAppReleaseSchema), required: true } },
    responses: {
      ...commonErrorResponses,
      ...ok(AppReleaseDTO, '更新成功'),
      404: { content: jsonContent(ErrorResponse), description: '不存在' },
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    setAuditBeforeData(c, await getAppReleaseBeforeAudit(id));
    return c.json(okBody(await updateAppRelease(id, c.req.valid('json')), '更新成功'), 200);
  },
});

const deleteReleaseRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'delete', path: '/releases/{id}',
    tags: ['应用版本管理'], summary: '删除版本（草稿 / 已撤回）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'system:app-release:delete',
      audit: { description: '删除版本', module: '应用版本管理' },
    })] as const,
    request: { params: IdParam },
    responses: {
      ...commonErrorResponses,
      ...okMsg('删除成功'),
      404: { content: jsonContent(ErrorResponse), description: '不存在' },
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    setAuditBeforeData(c, await getAppReleaseBeforeAudit(id));
    await deleteAppRelease(id);
    return c.json(okBody(null, '删除成功'), 200);
  },
});

const publishReleaseRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/releases/{id}/publish',
    tags: ['应用版本管理'], summary: '发布版本',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'system:app-release:publish',
      audit: { description: '发布版本', module: '应用版本管理' },
    })] as const,
    request: { params: IdParam },
    responses: {
      ...commonErrorResponses,
      ...ok(AppReleaseDTO, '发布成功'),
      404: { content: jsonContent(ErrorResponse), description: '不存在' },
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    setAuditBeforeData(c, await getAppReleaseBeforeAudit(id));
    return c.json(okBody(await publishAppRelease(id), '发布成功'), 200);
  },
});

const revokeReleaseRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/releases/{id}/revoke',
    tags: ['应用版本管理'], summary: '撤回版本',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'system:app-release:publish',
      audit: { description: '撤回版本', module: '应用版本管理' },
    })] as const,
    request: { params: IdParam },
    responses: {
      ...commonErrorResponses,
      ...ok(AppReleaseDTO, '撤回成功'),
      404: { content: jsonContent(ErrorResponse), description: '不存在' },
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    setAuditBeforeData(c, await getAppReleaseBeforeAudit(id));
    return c.json(okBody(await revokeAppRelease(id), '撤回成功'), 200);
  },
});

const rolloutRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'put', path: '/releases/{id}/rollout',
    tags: ['应用版本管理'], summary: '调整灰度比例',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'system:app-release:update',
      audit: { description: '调整灰度比例', module: '应用版本管理' },
    })] as const,
    request: { params: IdParam, body: { content: jsonContent(setAppReleaseRolloutSchema), required: true } },
    responses: {
      ...commonErrorResponses,
      ...ok(AppReleaseDTO, '调整成功'),
      404: { content: jsonContent(ErrorResponse), description: '不存在' },
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    setAuditBeforeData(c, await getAppReleaseBeforeAudit(id));
    const { rolloutPercent } = c.req.valid('json');
    return c.json(okBody(await setAppReleaseRollout(id, rolloutPercent), '调整成功'), 200);
  },
});

// ─── 制品 ────────────────────────────────────────────────────────────────────

/** multipart 字段校验（文件本体由 parseBody 提取） */
const uploadArtifactFieldsSchema = z.object({
  platform: z.enum(APP_PLATFORMS),
  arch: z.enum(APP_ARCHES).default('x64'),
  kind: z.enum(APP_FILE_ARTIFACT_KINDS).default('installer'),
});

const uploadArtifactRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/releases/{id}/artifacts',
    tags: ['应用版本管理'], summary: '上传制品文件',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'system:app-release:create',
      audit: { description: '上传制品', module: '应用版本管理', recordBody: false },
    })] as const,
    request: {
      params: IdParam,
      body: {
        content: {
          'multipart/form-data': {
            schema: z.object({
              file: z.any().openapi({ type: 'string', format: 'binary' }),
              platform: z.enum(APP_PLATFORMS),
              arch: z.enum(APP_ARCHES).optional(),
              kind: z.enum(APP_FILE_ARTIFACT_KINDS).optional(),
            }),
          },
        },
        required: true,
      },
    },
    responses: {
      ...commonErrorResponses,
      ...ok(AppArtifactDTO, '上传成功'),
      400: { content: jsonContent(ErrorResponse), description: '制品参数不合法或未选择文件' },
      404: { content: jsonContent(ErrorResponse), description: '版本不存在' },
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    const body = await c.req.parseBody();
    const parsed = uploadArtifactFieldsSchema.safeParse({
      platform: body.platform,
      arch: body.arch || undefined,
      kind: body.kind || undefined,
    });
    if (!parsed.success) return c.json(errBody(parsed.error.issues[0]?.message ?? '制品参数不合法', 400), 400);
    if (!(body.file instanceof File)) return c.json(errBody('请选择要上传的制品文件', 400), 400);
    const artifact = await addFileArtifact(id, parsed.data, body.file);
    return c.json(okBody(artifact, '上传成功'), 200);
  },
});

const externalArtifactRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/releases/{id}/artifacts/external',
    tags: ['应用版本管理'], summary: '添加外链制品（App Store / TestFlight 等）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'system:app-release:create',
      audit: { description: '添加外链制品', module: '应用版本管理' },
    })] as const,
    request: { params: IdParam, body: { content: jsonContent(createExternalArtifactSchema), required: true } },
    responses: {
      ...commonErrorResponses,
      ...ok(AppArtifactDTO, '添加成功'),
      404: { content: jsonContent(ErrorResponse), description: '版本不存在' },
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    return c.json(okBody(await addExternalArtifact(id, c.req.valid('json')), '添加成功'), 200);
  },
});

const deleteArtifactRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'delete', path: '/artifacts/{id}',
    tags: ['应用版本管理'], summary: '删除制品',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'system:app-release:delete',
      audit: { description: '删除制品', module: '应用版本管理' },
    })] as const,
    request: { params: IdParam },
    responses: {
      ...commonErrorResponses,
      ...okMsg('删除成功'),
      404: { content: jsonContent(ErrorResponse), description: '不存在' },
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    setAuditBeforeData(c, await getAppArtifactBeforeAudit(id));
    await deleteAppArtifact(id);
    return c.json(okBody(null, '删除成功'), 200);
  },
});

// ─── 看板统计 ────────────────────────────────────────────────────────────────

const statsRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/stats',
    tags: ['应用版本管理'], summary: '升级看板统计',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'system:app-release:list' })] as const,
    request: {
      query: z.object({
        appId: z.coerce.number().int().positive(),
        days: z.coerce.number().int().min(1).max(90).default(30),
      }),
    },
    responses: { ...commonErrorResponses, ...ok(AppReleaseStatsDTO, '看板统计') },
  }),
  handler: async (c) => {
    const { appId, days } = c.req.valid('query');
    return c.json(okBody(await getAppReleaseStats(appId, days)), 200);
  },
});

// ─── 设备中心（管理端）───────────────────────────────────────────────────────

const listDevicesRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/devices',
    tags: ['应用版本管理'], summary: '设备列表（统一设备中心）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'system:app-release:list' })] as const,
    request: {
      query: PaginationQuery.extend({
        appId: z.coerce.number().int().positive().optional(),
        platform: z.enum(APP_PLATFORMS).optional(),
        subjectType: z.enum(['user', 'member']).optional(),
        pushBound: z.enum(['true', 'false']).optional(),
        keyword: z.string().max(256).optional(),
      }),
    },
    responses: { ...commonErrorResponses, ...okPaginated(ClientDeviceDTO, '设备列表') },
  }),
  handler: async (c) => {
    const { pushBound, ...rest } = c.req.valid('query');
    return c.json(okBody(await listClientDevices({ ...rest, pushBound: pushBound === 'true' })), 200);
  },
});

const unbindDeviceRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'put', path: '/devices/{id}/unbind',
    tags: ['应用版本管理'], summary: '解绑设备推送（保留设备档案）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'system:app-release:update',
      audit: { description: '解绑设备推送', module: '应用版本管理' },
    })] as const,
    request: { params: IdParam },
    responses: {
      ...commonErrorResponses,
      ...okMsg('解绑成功'),
      404: { content: jsonContent(ErrorResponse), description: '不存在' },
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    setAuditBeforeData(c, await getClientDeviceBeforeAudit(id));
    await adminUnbindDevicePush(id);
    return c.json(okBody(null, '解绑成功'), 200);
  },
});

const deleteDeviceRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'delete', path: '/devices/{id}',
    tags: ['应用版本管理'], summary: '删除设备档案',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'system:app-release:delete',
      audit: { description: '删除设备档案', module: '应用版本管理' },
    })] as const,
    request: { params: IdParam },
    responses: {
      ...commonErrorResponses,
      ...okMsg('删除成功'),
      404: { content: jsonContent(ErrorResponse), description: '不存在' },
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    setAuditBeforeData(c, await getClientDeviceBeforeAudit(id));
    await deleteClientDevice(id);
    return c.json(okBody(null, '删除成功'), 200);
  },
});

router.openapiRoutes([
  listAppsRoute,
  allAppsRoute,
  createAppRoute,
  updateAppRoute,
  deleteAppRoute,
  listReleasesRoute,
  statsRoute,
  listDevicesRoute,
  unbindDeviceRoute,
  deleteDeviceRoute,
  getReleaseRoute,
  createReleaseRoute,
  updateReleaseRoute,
  deleteReleaseRoute,
  publishReleaseRoute,
  revokeReleaseRoute,
  rolloutRoute,
  uploadArtifactRoute,
  externalArtifactRoute,
  deleteArtifactRoute,
] as const);

export default router;
