import { OpenAPIHono } from '@hono/zod-openapi';
import { oauthConfigContract, type OAuthProviderType } from '@zenith/shared/identity';
import { authMiddleware } from '../../middleware/auth';
import { guard, setAuditBeforeData } from '../../middleware/guard';
import { platformAdminOnly } from '../../middleware/platform-admin';
import { defineContractRoute } from '../../lib/contract-route';
import { validationHook, okBody } from '../../lib/openapi-schemas';
import { listOauthConfigs, updateOauthConfig, getOauthConfigBeforeAudit } from '../../services/identity/oauth-config.service';

const oauthConfigRouter = new OpenAPIHono({ defaultHook: validationHook });

// 第三方登录配置是平台级全局资源（单行 / provider，登录时无租户上下文）：
// 多租户模式下只允许平台管理员读写——租户管理员改写 clientId / secret 等于把平台登录入口指向自己的企业应用；
// 单租户部署没有「平台 / 租户」之分，由权限码控制即可
const platformOnly = platformAdminOnly({ message: '多租户模式下仅平台管理员可管理第三方登录配置', onlyInMultiTenant: true });

const listRoute = defineContractRoute(oauthConfigContract.list, {
  middleware: [authMiddleware, platformOnly, guard({ permission: 'system:oauth-config:view' })] as const,
  handler: async (c) => c.json(okBody(await listOauthConfigs(), 'success'), 200),
});

const updateRoute = defineContractRoute(oauthConfigContract.update, {
  middleware: [authMiddleware, platformOnly, guard({ permission: 'system:oauth-config:update', audit: { description: '更新OAuth配置', module: 'OAuth配置' } })] as const,
  handler: async (c) => {
    const provider = c.req.valid('param').provider as OAuthProviderType;
    const before = await getOauthConfigBeforeAudit(provider);
    if (before) setAuditBeforeData(c, before);
    const result = await updateOauthConfig(provider, c.req.valid('json'));
    return c.json(okBody(result, '保存成功'), 200);
  },
});

oauthConfigRouter.openapiRoutes([listRoute, updateRoute] as const);

export default oauthConfigRouter;
