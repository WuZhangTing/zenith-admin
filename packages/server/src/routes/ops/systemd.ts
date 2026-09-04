import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import { HTTPException } from 'hono/http-exception';
import { authMiddleware } from '../../middleware/auth';
import { guard, setAuditBeforeData } from '../../middleware/guard';
import {
  validationHook, ok, commonErrorResponses, okBody, okMsg,
  HostQuery,
} from '../../lib/openapi-schemas';
import {
  isSystemdAvailable, listServices, controlService, getServiceLogs, tailServiceLogs, getServiceDetail,
} from '../../services/ops/systemd.service';
import { assertRemoteHostAccess, resolveHostIdQuery } from '../../lib/host-access';
import { streamProcessOutput } from '../../lib/http-stream';

const router = new OpenAPIHono({ defaultHook: validationHook });
const VIEW_PERM = 'system:service:view';
const MANAGE_PERM = 'system:service:manage';

/** 验证服务名：只允许合法字符，防止命令注入 */
function validateServiceName(name: string): void {
  if (!/^[a-zA-Z0-9_@.-]{1,128}$/.test(name)) throw new HTTPException(400, { message: '非法服务名称' });
}

// ─── 流式路由：实时日志 ────────────────────────────────────────────────────────
router.get('/:name/logs/stream', authMiddleware, guard({ permission: VIEW_PERM }), async (c) => {
  const name = c.req.param('name');
  validateServiceName(name);
  const hostId = await resolveHostIdQuery(c);

  return streamProcessOutput(c, (onData, onExit) => tailServiceLogs(name, onData, onExit, hostId));
});

// ─── OpenAPI 路由 ─────────────────────────────────────────────────────────────

const ServiceDTO = z.object({
  name: z.string(), description: z.string(),
  loadState: z.string(), activeState: z.string(), subState: z.string(),
});

const checkRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/check', summary: '检查 systemd 可用性', tags: ['Systemd'],
    middleware: [authMiddleware, guard({ permission: VIEW_PERM })] as const,
    request: { query: HostQuery },
    responses: { ...commonErrorResponses, ...ok(z.object({ available: z.boolean() }), 'systemd 可用性') },
  }),
  handler: async (c) => {
    const { hostId } = c.req.valid('query');
    await assertRemoteHostAccess(c, hostId);
    const available = await isSystemdAvailable(hostId);
    return c.json(okBody({ available }), 200);
  },
});

const listRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/', summary: '列出 systemd 服务', tags: ['Systemd'],
    middleware: [authMiddleware, guard({ permission: VIEW_PERM })] as const,
    request: { query: HostQuery },
    responses: { ...commonErrorResponses, ...ok(z.array(ServiceDTO), '服务列表') },
  }),
  handler: async (c) => {
    const { hostId } = c.req.valid('query');
    await assertRemoteHostAccess(c, hostId);
    const services = await listServices(hostId);
    return c.json(okBody(services), 200);
  },
});

const controlRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/:name/:action', summary: '控制服务（启停/重启/开机自启/屏蔽）', tags: ['Systemd'],
    middleware: [authMiddleware, guard({
      permission: MANAGE_PERM,
      audit: { description: '控制 systemd 服务', module: '服务管理' },
    })] as const,
    request: {
      params: z.object({ name: z.string(), action: z.enum(['start', 'stop', 'restart', 'reload', 'enable', 'disable', 'mask', 'unmask']) }),
      query: HostQuery,
    },
    responses: { ...commonErrorResponses, ...okMsg('操作成功') },
  }),
  handler: async (c) => {
    const { name, action } = c.req.valid('param');
    const { hostId } = c.req.valid('query');
    await assertRemoteHostAccess(c, hostId);
    validateServiceName(name);
    setAuditBeforeData(c, { name, hostId: hostId ?? null, detail: await getServiceDetail(name, hostId) });
    await controlService(name, action, hostId);
    return c.json(okBody(null, '操作成功'), 200);
  },
});

const detailRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/:name/detail', summary: '获取服务详情', tags: ['Systemd'],
    middleware: [authMiddleware, guard({ permission: VIEW_PERM })] as const,
    request: { params: z.object({ name: z.string() }), query: HostQuery },
    responses: { ...commonErrorResponses, ...ok(z.record(z.string(), z.string()), '服务详情') },
  }),
  handler: async (c) => {
    const { name } = c.req.valid('param');
    const { hostId } = c.req.valid('query');
    await assertRemoteHostAccess(c, hostId);
    validateServiceName(name);
    const detail = await getServiceDetail(name, hostId);
    return c.json(okBody(detail), 200);
  },
});

const logsRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/:name/logs', summary: '获取服务近期日志', tags: ['Systemd'],
    middleware: [authMiddleware, guard({ permission: VIEW_PERM })] as const,
    request: { params: z.object({ name: z.string() }), query: HostQuery },
    responses: { ...commonErrorResponses, ...ok(z.object({ logs: z.string() }), '服务日志') },
  }),
  handler: async (c) => {
    const { name } = c.req.valid('param');
    const { hostId } = c.req.valid('query');
    await assertRemoteHostAccess(c, hostId);
    validateServiceName(name);
    const logs = await getServiceLogs(name, 200, hostId);
    return c.json(okBody({ logs }), 200);
  },
});

router.openapiRoutes([checkRoute, listRoute, controlRoute, detailRoute, logsRoute] as const);

export default router;
