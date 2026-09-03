import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import { authMiddleware } from '../../middleware/auth';
import { guard, setAuditBeforeData } from '../../middleware/guard';
import { platformAdminOnly } from '../../middleware/platform-admin';
import type { OAuthProviderType } from '@zenith/shared/identity';
import { jsonContent, validationHook, commonErrorResponses, ok, okBody } from '../../lib/openapi-schemas';
import { OAuthConfigItemDTO } from '../../lib/openapi-dtos';
import { updateOauthConfigSchema } from '@zenith/shared/identity';
import { listOauthConfigs, updateOauthConfig, getOauthConfigBeforeAudit } from '../../services/identity/oauth-config.service';

const oauthConfigRouter = new OpenAPIHono({ defaultHook: validationHook });

// 第三方登录配置是平台级全局资源（单行 / provider，登录时无租户上下文）：
// 多租户模式下只允许平台管理员读写——租户管理员改写 clientId / secret 等于把平台登录入口指向自己的企业应用；
// 单租户部署没有「平台 / 租户」之分，由权限码控制即可
const platformOnly = platformAdminOnly({ message: '多租户模式下仅平台管理员可管理第三方登录配置', onlyInMultiTenant: true });

const listRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/', tags: ['OAuthConfig'], summary: '获取所有 OAuth 配置',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, platformOnly, guard({ permission: 'system:oauth-config:view' })] as const,
    responses: { ...commonErrorResponses, ...ok(z.array(OAuthConfigItemDTO), 'OAuth 配置列表') },
  }),
  handler: async (c) => c.json(okBody(await listOauthConfigs(), 'success'), 200),
});

const updateRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'put', path: '/{provider}', tags: ['OAuthConfig'], summary: '更新指定 provider 的 OAuth 配置',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, platformOnly, guard({ permission: 'system:oauth-config:update', audit: { description: '更新OAuth配置', module: 'OAuth配置' } })] as const,
    request: {
      params: z.object({ provider: z.string().openapi({ param: { name: 'provider', in: 'path' }, example: 'github', description: 'OAuth 提供方' }) }),
      body: { content: jsonContent(updateOauthConfigSchema), required: true },
    },
    responses: { ...commonErrorResponses, ...ok(OAuthConfigItemDTO.nullable(), '保存成功') },
  }),
  handler: async (c) => {
    const provider = c.req.param('provider') as OAuthProviderType;
    const before = await getOauthConfigBeforeAudit(provider);
    if (before) setAuditBeforeData(c, before);
    const result = await updateOauthConfig(provider, c.req.valid('json'));
    return c.json(okBody(result, '保存成功'), 200);
  },
});

oauthConfigRouter.openapiRoutes([listRoute, updateRoute] as const);

export default oauthConfigRouter;
