import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import { HTTPException } from 'hono/http-exception';
import { FirewallStatusDTO, FirewallRuleListDTO, AddFirewallRuleDTO } from '../../lib/openapi-dtos';
import {
  ok,
  okMsg,
  okBody,
  jsonContent,
  validationHook,
  commonErrorResponses,
} from '../../lib/openapi-schemas';
import { authMiddleware } from '../../middleware/auth';
import { guard, setAuditAfterData, setAuditBeforeData } from '../../middleware/guard';
import {
  addFirewallRule,
  deleteFirewallRule,
  getFirewallStatus,
  listFirewallRules,
  setFirewallEnabled,
} from '../../services/ops/firewall.service';
import { assertRemoteHostAccess } from '../../lib/host-access';

const firewallRouter = new OpenAPIHono({ defaultHook: validationHook });
const HostQuery = z.object({ hostId: z.coerce.number().int().positive().optional() });

function assertLocalFirewallWrite(hostId?: number): void {
  if (hostId != null) {
    throw new HTTPException(400, { message: '远端防火墙仅支持只读查看，禁止远程变更' });
  }
}

const FirewallRuleIdParam = z.object({
  id: z.string().openapi({
    param: { name: 'id', in: 'path' },
    example: '1',
    description: '防火墙规则 ID',
  }),
});

const statusRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get',
    path: '/',
    tags: ['Firewall'],
    summary: '获取防火墙状态',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'system:firewall:view' })] as const,
    request: { query: HostQuery },
    responses: { ...commonErrorResponses, ...ok(FirewallStatusDTO, '防火墙状态') },
  }),
  handler: async (c) => {
    const { hostId } = c.req.valid('query');
    await assertRemoteHostAccess(c, hostId);
    return c.json(okBody(await getFirewallStatus(hostId)), 200);
  },
});

const listRulesRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get',
    path: '/rules',
    tags: ['Firewall'],
    summary: '获取防火墙规则列表',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'system:firewall:view' })] as const,
    request: { query: HostQuery },
    responses: { ...commonErrorResponses, ...ok(FirewallRuleListDTO, '防火墙规则列表') },
  }),
  handler: async (c) => {
    const { hostId } = c.req.valid('query');
    await assertRemoteHostAccess(c, hostId);
    return c.json(okBody(await listFirewallRules(hostId)), 200);
  },
});

const addRuleRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post',
    path: '/rules',
    tags: ['Firewall'],
    summary: '添加防火墙规则',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'system:firewall:manage', audit: { module: '系统运维', description: '添加防火墙规则' } })] as const,
    request: {
      query: HostQuery,
      body: { content: jsonContent(AddFirewallRuleDTO), required: true },
    },
    responses: { ...commonErrorResponses, ...okMsg('规则已添加') },
  }),
  handler: async (c) => {
    assertLocalFirewallWrite(c.req.valid('query').hostId);
    setAuditBeforeData(c, await listFirewallRules());
    await addFirewallRule(c.req.valid('json'));
    setAuditAfterData(c, await listFirewallRules());
    return c.json(okBody(null, '规则已添加'), 200);
  },
});

const deleteRuleRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'delete',
    path: '/rules/{id}',
    tags: ['Firewall'],
    summary: '删除防火墙规则',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'system:firewall:manage', audit: { module: '系统运维', description: '删除防火墙规则' } })] as const,
    request: { params: FirewallRuleIdParam, query: HostQuery },
    responses: { ...commonErrorResponses, ...okMsg('规则已删除') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    assertLocalFirewallWrite(c.req.valid('query').hostId);
    setAuditBeforeData(c, await listFirewallRules());
    await deleteFirewallRule(id);
    setAuditAfterData(c, await listFirewallRules());
    return c.json(okBody(null, '规则已删除'), 200);
  },
});

const enableRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post',
    path: '/enable',
    tags: ['Firewall'],
    summary: '启用防火墙',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'system:firewall:manage', audit: { module: '系统运维', description: '启用防火墙' } })] as const,
    request: { query: HostQuery },
    responses: { ...commonErrorResponses, ...okMsg('防火墙已启用') },
  }),
  handler: async (c) => {
    assertLocalFirewallWrite(c.req.valid('query').hostId);
    setAuditBeforeData(c, await getFirewallStatus());
    await setFirewallEnabled(true);
    setAuditAfterData(c, await getFirewallStatus());
    return c.json(okBody(null, '防火墙已启用'), 200);
  },
});

const disableRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post',
    path: '/disable',
    tags: ['Firewall'],
    summary: '禁用防火墙',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'system:firewall:manage', audit: { module: '系统运维', description: '禁用防火墙' } })] as const,
    request: { query: HostQuery },
    responses: { ...commonErrorResponses, ...okMsg('防火墙已关闭') },
  }),
  handler: async (c) => {
    assertLocalFirewallWrite(c.req.valid('query').hostId);
    setAuditBeforeData(c, await getFirewallStatus());
    await setFirewallEnabled(false);
    setAuditAfterData(c, await getFirewallStatus());
    return c.json(okBody(null, '防火墙已关闭'), 200);
  },
});

firewallRouter.openapiRoutes([
  statusRoute,
  listRulesRoute,
  addRuleRoute,
  deleteRuleRoute,
  enableRoute,
  disableRoute,
] as const);

export default firewallRouter;
