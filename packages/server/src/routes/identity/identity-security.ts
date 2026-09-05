import { OpenAPIHono } from '@hono/zod-openapi';
import { identitySecurityContract } from '@zenith/shared/identity';
import { authMiddleware } from '../../middleware/auth';
import { guard } from '../../middleware/guard';
import { defineContractRoute } from '../../lib/contract-route';
import { validationHook, okBody } from '../../lib/openapi-schemas';
import { getIdentitySecurityPolicy, listLoginRiskEvents, saveIdentitySecurityPolicy } from '../../services/identity/identity-security.service';

const identitySecurity = new OpenAPIHono({ defaultHook: validationHook });

const manage = [authMiddleware, guard({ permission: 'system:identity-security:manage' })] as const;

const getPolicyRoute = defineContractRoute(identitySecurityContract.policy, {
  middleware: manage,
  handler: async (c) => c.json(okBody(await getIdentitySecurityPolicy()), 200),
});

const updatePolicyRoute = defineContractRoute(identitySecurityContract.updatePolicy, {
  middleware: [authMiddleware, guard({ permission: 'system:identity-security:manage', audit: { module: '身份安全', description: '更新身份安全策略' } })] as const,
  handler: async (c) => c.json(okBody(await saveIdentitySecurityPolicy(c.req.valid('json')), '更新成功'), 200),
});

const riskEventsRoute = defineContractRoute(identitySecurityContract.riskEvents, {
  middleware: manage,
  handler: async (c) => c.json(okBody(await listLoginRiskEvents(c.req.valid('query'))), 200),
});

identitySecurity.openapiRoutes([getPolicyRoute, updatePolicyRoute, riskEventsRoute] as const);

export default identitySecurity;
