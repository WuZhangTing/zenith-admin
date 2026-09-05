import { OpenAPIHono } from '@hono/zod-openapi';
import { loginLogContract } from '@zenith/shared/identity';
import { authMiddleware } from '../../middleware/auth';
import { guard, setAuditAfterData, setAuditBeforeData } from '../../middleware/guard';
import { defineContractRoute } from '../../lib/contract-route';
import { validationHook, okBody } from '../../lib/openapi-schemas';
import { listLoginLogs, loginLogStats, cleanLoginLogs, getCleanLoginLogsBeforeAudit } from '../../services/identity/login-logs.service';

const loginLogsRoute = new OpenAPIHono({ defaultHook: validationHook });

const read = [authMiddleware, guard({ permission: 'system:log:login' })] as const;

const listRoute = defineContractRoute(loginLogContract.list, {
  middleware: read,
  handler: async (c) => c.json(okBody(await listLoginLogs(c.req.valid('query'))), 200),
});

const statsRoute = defineContractRoute(loginLogContract.stats, {
  middleware: read,
  handler: async (c) => c.json(okBody(await loginLogStats(c.req.valid('query').days)), 200),
});

const cleanRoute = defineContractRoute(loginLogContract.clean, {
  middleware: [authMiddleware, guard({
    permission: 'system:log:login',
    audit: { description: '清除登录日志', module: '登录日志' },
  })] as const,
  handler: async (c) => {
    const { days } = c.req.valid('query');
    const before = await getCleanLoginLogsBeforeAudit(days);
    setAuditBeforeData(c, before);
    const deleted = await cleanLoginLogs(days);
    setAuditAfterData(c, { days, deleted });
    return c.json(okBody(null, `共删除 ${deleted} 条登录日志`), 200);
  },
});

loginLogsRoute.openapiRoutes([listRoute, statsRoute, cleanRoute] as const);

export default loginLogsRoute;
