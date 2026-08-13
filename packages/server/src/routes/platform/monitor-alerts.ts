import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import {
  MONITOR_ALERT_EVENT_STATUSES,
  MONITOR_ALERT_LEVELS,
  MONITOR_ALERT_NOTIFY_STATUSES,
  MONITOR_METRICS,
} from '@zenith/shared/platform';
import { authMiddleware } from '../../middleware/auth';
import { guard, setAuditBeforeData } from '../../middleware/guard';
import {
  jsonContent, validationHook, commonErrorResponses, ok, okMsg, okPaginated, IdParam, PaginationQuery, okBody,
  dateRangeBound,
} from '../../lib/openapi-schemas';
import {
  MonitorAlertRuleDTO, MonitorAlertEventDTO, CreateMonitorAlertRuleDTO, UpdateMonitorAlertRuleDTO,
} from '../../lib/openapi-dtos';
import {
  listRules, createRule, updateRule, deleteRule, deleteRules, setRuleEnabled, setRulesEnabled, listEvents,
  getMonitorAlertRuleBeforeAudit,
} from '../../services/platform/monitor-alert.service';

const monitorAlertsRouter = new OpenAPIHono({ defaultHook: validationHook });

/** HTTP query 只有字符串：`z.boolean()` 会把 `?enabled=false` 判成校验失败 */
const boolParam = z.enum(['true', 'false']).transform((v) => v === 'true').optional();

const RuleQuery = PaginationQuery.extend({
  keyword: z.string().max(128).optional(),
  metric: z.enum(MONITOR_METRICS).optional(),
  level: z.enum(MONITOR_ALERT_LEVELS).optional(),
  enabled: boolParam,
  state: z.enum(['ok', 'firing']).optional(),
});

const EventQuery = PaginationQuery.extend({
  keyword: z.string().max(128).optional(),
  metric: z.enum(MONITOR_METRICS).optional(),
  level: z.enum(MONITOR_ALERT_LEVELS).optional(),
  status: z.enum(MONITOR_ALERT_EVENT_STATUSES).optional(),
  notifyStatus: z.enum(MONITOR_ALERT_NOTIFY_STATUSES).optional(),
  ruleId: z.coerce.number().int().positive().optional(),
  startTime: dateRangeBound('触发时间起'),
  endTime: dateRangeBound('触发时间止'),
});

const EnabledBody = z.object({ enabled: z.boolean() });

const IdsBody = z.object({ ids: z.array(z.number().int().positive()).min(1, '请至少选择一条规则').max(200) });

const BatchEnabledBody = IdsBody.extend({ enabled: z.boolean() });

// ─── 告警事件（先于 /{id} 注册，避免冲突）──────────────────────────────────
const eventsList = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/events', tags: ['AlertCenter'], summary: '获取告警事件列表',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'alert:event:list' })] as const,
    request: { query: EventQuery },
    responses: { ...okPaginated(MonitorAlertEventDTO, '告警事件'), ...commonErrorResponses },
  }),
  handler: async (c) => c.json(okBody(await listEvents(c.req.valid('query'))), 200),
});

// ─── 告警规则 CRUD ─────────────────────────────────────────────────────────
const rulesList = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/', tags: ['AlertCenter'], summary: '获取告警规则列表',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'alert:rule:list' })] as const,
    request: { query: RuleQuery },
    responses: { ...okPaginated(MonitorAlertRuleDTO, '告警规则'), ...commonErrorResponses },
  }),
  handler: async (c) => c.json(okBody(await listRules(c.req.valid('query'))), 200),
});

const ruleCreate = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/', tags: ['AlertCenter'], summary: '创建告警规则',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'alert:rule:create', audit: { description: '创建告警规则', module: '告警中心' } })] as const,
    request: { body: { content: jsonContent(CreateMonitorAlertRuleDTO), required: true } },
    responses: { ...ok(MonitorAlertRuleDTO, '创建成功'), ...commonErrorResponses },
  }),
  handler: async (c) => c.json(okBody(await createRule(c.req.valid('json')), '创建成功'), 200),
});

const ruleUpdate = defineOpenAPIRoute({
  route: createRoute({
    method: 'put', path: '/{id}', tags: ['AlertCenter'], summary: '更新告警规则',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'alert:rule:update', audit: { description: '更新告警规则', module: '告警中心' } })] as const,
    request: { params: IdParam, body: { content: jsonContent(UpdateMonitorAlertRuleDTO), required: true } },
    responses: { ...ok(MonitorAlertRuleDTO, '更新成功'), ...commonErrorResponses },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    setAuditBeforeData(c, await getMonitorAlertRuleBeforeAudit(id));
    return c.json(okBody(await updateRule(id, c.req.valid('json')), '更新成功'), 200);
  },
});

const ruleToggle = defineOpenAPIRoute({
  route: createRoute({
    method: 'patch', path: '/{id}/enabled', tags: ['AlertCenter'], summary: '启用/禁用告警规则',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'alert:rule:update', audit: { description: '切换告警规则状态', module: '告警中心' } })] as const,
    request: { params: IdParam, body: { content: jsonContent(EnabledBody), required: true } },
    responses: { ...ok(MonitorAlertRuleDTO, '操作成功'), ...commonErrorResponses },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    setAuditBeforeData(c, await getMonitorAlertRuleBeforeAudit(id));
    return c.json(okBody(await setRuleEnabled(id, c.req.valid('json').enabled), '操作成功'), 200);
  },
});

const ruleBatchToggle = defineOpenAPIRoute({
  route: createRoute({
    method: 'patch', path: '/batch/enabled', tags: ['AlertCenter'], summary: '批量启用/禁用告警规则',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'alert:rule:update', audit: { description: '批量切换告警规则状态', module: '告警中心' } })] as const,
    request: { body: { content: jsonContent(BatchEnabledBody), required: true } },
    responses: { ...okMsg('操作成功'), ...commonErrorResponses },
  }),
  handler: async (c) => {
    const { ids, enabled } = c.req.valid('json');
    const count = await setRulesEnabled(ids, enabled);
    return c.json(okBody(null, `已${enabled ? '启用' : '停用'} ${count} 条规则`), 200);
  },
});

// `DELETE /batch` 必须注册在 `DELETE /{id}` 之前，否则会被匹配成 id="batch"
const ruleBatchDelete = defineOpenAPIRoute({
  route: createRoute({
    method: 'delete', path: '/batch', tags: ['AlertCenter'], summary: '批量删除告警规则',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'alert:rule:delete', audit: { description: '批量删除告警规则', module: '告警中心' } })] as const,
    request: { body: { content: jsonContent(IdsBody), required: true } },
    responses: { ...okMsg('删除成功'), ...commonErrorResponses },
  }),
  handler: async (c) => {
    await deleteRules(c.req.valid('json').ids);
    return c.json(okBody(null, '删除成功'), 200);
  },
});

const ruleDelete = defineOpenAPIRoute({
  route: createRoute({
    method: 'delete', path: '/{id}', tags: ['AlertCenter'], summary: '删除告警规则',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'alert:rule:delete', audit: { description: '删除告警规则', module: '告警中心' } })] as const,
    request: { params: IdParam },
    responses: { ...okMsg('删除成功'), ...commonErrorResponses },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    setAuditBeforeData(c, await getMonitorAlertRuleBeforeAudit(id));
    await deleteRule(id);
    return c.json(okBody(null, '删除成功'), 200);
  },
});

monitorAlertsRouter.openapiRoutes([
  // 批量路由必须先于 `/{id}` 系列注册，否则 `/batch` 会被匹配成 id="batch"
  eventsList, rulesList, ruleCreate, ruleBatchToggle, ruleBatchDelete, ruleUpdate, ruleToggle, ruleDelete,
] as const);

export default monitorAlertsRouter;
