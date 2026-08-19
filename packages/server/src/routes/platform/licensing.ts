import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import { authMiddleware } from '../../middleware/auth';
import { guard } from '../../middleware/guard';
import { platformAdminOnly } from '../../middleware/platform-admin';
import { PaginationQuery, jsonContent, validationHook, commonErrorResponses, ok, okPaginated, okMsg, okBody } from '../../lib/openapi-schemas';
import { LICENSE_EDITIONS, LICENSE_FEATURES, LICENSE_STATUSES, activateLicenseSchema } from '@zenith/shared/licensing';
import {
  getLicensingStatus,
  activateLicense,
  deactivateLicense,
  listLicenseEvents,
} from '../../services/platform/licensing.service';

const licensingRoute = new OpenAPIHono({ defaultHook: validationHook });

const platformAdminMiddleware = platformAdminOnly({ message: '仅平台管理员可管理 License 授权' });

const LicenseLimitsDTO = z.object({
  maxUsers: z.number().int().nullable(),
  maxTenants: z.number().int().nullable(),
  maxNodes: z.number().int().nullable(),
});

const LicenseInfoDTO = z.object({
  id: z.number().int(),
  licenseId: z.string(),
  status: z.enum(LICENSE_STATUSES),
  edition: z.enum(LICENSE_EDITIONS),
  editionLabel: z.string(),
  customerId: z.string(),
  customerName: z.string(),
  features: z.array(z.enum(LICENSE_FEATURES)),
  limits: LicenseLimitsDTO,
  issuedAt: z.string(),
  notBefore: z.string(),
  expiresAt: z.string(),
  graceUntil: z.string(),
  maintenanceUntil: z.string().nullable(),
  keyId: z.string(),
  activatedAt: z.string(),
  lastVerifiedAt: z.string().nullable(),
  invalidReason: z.string().nullable(),
  replacedById: z.number().int().nullable(),
}).openapi('LicenseInfo');

const LicensingStatusDTO = z.object({
  installation: z.object({
    installationId: z.string(),
    licenseEpoch: z.number().int(),
    createdAt: z.string(),
    mode: z.string(),
    activeNodes: z.number().int(),
  }),
  license: LicenseInfoDTO.nullable(),
  effective: z.object({
    mode: z.string(),
    status: z.string(),
    features: z.array(z.string()),
    limits: LicenseLimitsDTO.nullable(),
    expiresAt: z.string().nullable(),
    graceUntil: z.string().nullable(),
    restricted: z.boolean(),
  }),
  usingTestKey: z.boolean(),
}).openapi('LicensingStatus');

const LicenseEventDTO = z.object({
  id: z.number().int(),
  licenseId: z.number().int().nullable(),
  type: z.string(),
  typeLabel: z.string(),
  detail: z.string().nullable(),
  createdAt: z.string(),
}).openapi('LicenseEvent');

const statusRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/status', tags: ['Licensing'], summary: 'License 状态总览',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, platformAdminMiddleware, guard({ permission: 'system:license:view' })] as const,
    responses: { ...ok(LicensingStatusDTO, 'ok'), ...commonErrorResponses },
  }),
  handler: async (c) => c.json(okBody(await getLicensingStatus()), 200),
});

const activateRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/activate', tags: ['Licensing'], summary: '激活 / 替换 License',
    security: [{ BearerAuth: [] }],
    middleware: [
      authMiddleware,
      platformAdminMiddleware,
      guard({ permission: 'system:license:manage', audit: { module: 'License 授权', description: '激活 License', recordBody: false } }),
    ] as const,
    request: { body: { content: jsonContent(activateLicenseSchema), required: true } },
    responses: { ...ok(LicenseInfoDTO, '激活成功'), ...commonErrorResponses },
  }),
  handler: async (c) => {
    const { envelope } = c.req.valid('json');
    const user = c.get('user');
    return c.json(okBody(await activateLicense(envelope, user?.userId ?? null), '激活成功'), 200);
  },
});

const deactivateRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/deactivate', tags: ['Licensing'], summary: '停用当前 License',
    security: [{ BearerAuth: [] }],
    middleware: [
      authMiddleware,
      platformAdminMiddleware,
      guard({ permission: 'system:license:manage', audit: { module: 'License 授权', description: '停用 License' } }),
    ] as const,
    responses: { ...okMsg('已停用'), ...commonErrorResponses },
  }),
  handler: async (c) => {
    await deactivateLicense();
    return c.json(okBody(null, '已停用'), 200);
  },
});

const eventsRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/events', tags: ['Licensing'], summary: 'License 事件日志',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, platformAdminMiddleware, guard({ permission: 'system:license:view' })] as const,
    request: { query: PaginationQuery },
    responses: { ...okPaginated(LicenseEventDTO, 'ok'), ...commonErrorResponses },
  }),
  handler: async (c) => c.json(okBody(await listLicenseEvents(c.req.valid('query'))), 200),
});

licensingRoute.openapiRoutes([statusRoute, activateRoute, deactivateRoute, eventsRoute] as const);

export default licensingRoute;
