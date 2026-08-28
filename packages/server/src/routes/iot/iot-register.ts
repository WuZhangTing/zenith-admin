/**
 * IoT 动态注册 API（/api/iot/whitelist + 产品注册密钥）
 *
 * 设备侧注册端点在 ingest 路由（POST /api/iot/ingest/register，产品注册密钥签名）。
 */
import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import { authMiddleware } from '../../middleware/auth';
import { guard } from '../../middleware/guard';
import {
  ErrorResponse, jsonContent, PaginationQuery, validationHook, commonErrorResponses,
  ok, okPaginated, okMsg, IdParam, okBody,
} from '../../lib/openapi-schemas';
import { IotWhitelistEntryDTO } from '../../lib/openapi-dtos';
import { createIotWhitelistSchema } from '@zenith/shared/iot';
import {
  createIotWhitelistEntries, deleteIotWhitelistEntry, disableIotRegistration,
  getIotWhitelistStats, listIotWhitelist, resetIotRegistrationSecret,
} from '../../services/iot/iot-register.service';

export const iotWhitelistRouter = new OpenAPIHono({ defaultHook: validationHook });

const StatsDTO = z.object({
  total: z.number().int(),
  used: z.number().int(),
}).openapi('IotWhitelistStats');

const statsRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/stats',
    tags: ['IoT 动态注册'], summary: '白名单统计（总数/已核销）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'iot:register:manage' })] as const,
    request: {
      query: z.object({ productId: z.coerce.number().int().positive().optional() }),
    },
    responses: { ...commonErrorResponses, ...ok(StatsDTO, 'ok') },
  }),
  handler: async (c) => {
    const { productId } = c.req.valid('query');
    return c.json(okBody(await getIotWhitelistStats(productId)), 200);
  },
});

const listRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/',
    tags: ['IoT 动态注册'], summary: '注册白名单列表',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'iot:register:manage' })] as const,
    request: {
      query: PaginationQuery.extend({
        keyword: z.string().optional(),
        productId: z.coerce.number().int().positive().optional(),
        used: z.enum(['true', 'false']).optional()
          .transform((v) => (v === undefined ? undefined : v === 'true')),
      }),
    },
    responses: { ...commonErrorResponses, ...okPaginated(IotWhitelistEntryDTO, 'ok') },
  }),
  handler: async (c) => c.json(okBody(await listIotWhitelist(c.req.valid('query'))), 200),
});

const ImportResultDTO = z.object({
  total: z.number().int(),
  inserted: z.number().int(),
  skipped: z.number().int(),
}).openapi('IotWhitelistImportResult');

const createRoute_ = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/',
    tags: ['IoT 动态注册'], summary: '批量导入白名单 SN（重复跳过）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'iot:register:manage',
      audit: { description: '导入 IoT 注册白名单', module: 'IoT 动态注册' },
    })] as const,
    request: { body: { content: jsonContent(createIotWhitelistSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(ImportResultDTO, '导入完成') },
  }),
  handler: async (c) => c.json(okBody(await createIotWhitelistEntries(c.req.valid('json')), '导入完成'), 200),
});

const deleteRoute_ = defineOpenAPIRoute({
  route: createRoute({
    method: 'delete', path: '/{id}',
    tags: ['IoT 动态注册'], summary: '删除白名单条目（已核销的不可删除）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'iot:register:manage',
      audit: { description: '删除 IoT 注册白名单', module: 'IoT 动态注册' },
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
    await deleteIotWhitelistEntry(id);
    return c.json(okBody(null, '删除成功'), 200);
  },
});

const RegistrationSecretDTO = z.object({
  registrationSecret: z.string(),
}).openapi('IotRegistrationSecret');

const resetSecretRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/products/{id}/registration-secret',
    tags: ['IoT 动态注册'], summary: '开启/重置产品注册密钥（明文仅本次返回）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'iot:register:manage',
      audit: { description: '重置 IoT 产品注册密钥', module: 'IoT 动态注册' },
    })] as const,
    request: { params: IdParam },
    responses: {
      ...commonErrorResponses,
      ...ok(RegistrationSecretDTO, '已重置'),
      404: { content: jsonContent(ErrorResponse), description: '产品不存在' },
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    return c.json(okBody(await resetIotRegistrationSecret(id), '注册密钥已重置，请妥善保存'), 200);
  },
});

const disableSecretRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'delete', path: '/products/{id}/registration-secret',
    tags: ['IoT 动态注册'], summary: '关闭产品动态注册（已注册设备不受影响）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'iot:register:manage',
      audit: { description: '关闭 IoT 产品动态注册', module: 'IoT 动态注册' },
    })] as const,
    request: { params: IdParam },
    responses: {
      ...commonErrorResponses,
      ...okMsg('已关闭'),
      404: { content: jsonContent(ErrorResponse), description: '产品不存在' },
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    await disableIotRegistration(id);
    return c.json(okBody(null, '动态注册已关闭'), 200);
  },
});

iotWhitelistRouter.openapiRoutes([
  statsRoute,
  listRoute,
  createRoute_,
  deleteRoute_,
  resetSecretRoute,
  disableSecretRoute,
] as const);
