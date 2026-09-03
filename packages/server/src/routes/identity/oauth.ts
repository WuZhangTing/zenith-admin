import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import { authMiddleware } from '../../middleware/auth';
import { ErrorResponse, jsonContent, validationHook, commonErrorResponses, ok, okMsg, okBody } from '../../lib/openapi-schemas';
import { OAuthAccountDTO, OAuthAuthUrlDTO, OAuthEnabledProvidersDTO, LoginResultDTO } from '../../lib/openapi-dtos';
import { getClientInfo } from '../../lib/request-helpers';
import { oauthBindSchema, oauthCallbackSchema } from '@zenith/shared/identity';
import {
  listOAuthAccounts, listEnabledOAuthProviders, generateAuthUrl, generateBindAuthUrl, handleOAuthCallback,
  bindOAuthAccount, unbindOAuthAccount,
} from '../../services/identity/oauth.service';

const oauth = new OpenAPIHono({ defaultHook: validationHook });

const providerParam = z.object({ provider: z.string().openapi({ param: { name: 'provider', in: 'path' }, example: 'github', description: 'OAuth 提供方' }) });

const accountsRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/accounts', tags: ['OAuth'], summary: '当前用户绑定列表',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware] as const,
    responses: { ...commonErrorResponses, ...ok(z.array(OAuthAccountDTO), 'ok') },
  }),
  handler: async (c) => c.json(okBody(await listOAuthAccounts()), 200),
});

// 登录页据此决定是否渲染「其他方式登录」；必须注册在 GET /{provider} 之前，否则被当成 provider="providers"
const providersRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/providers', tags: ['OAuth'], summary: '已启用的第三方登录提供方',
    description: '返回已启用且凭据配置完整、可发起登录的提供方 key，不含任何凭据；未配置任何提供方时为空数组',
    security: [],
    responses: { ...commonErrorResponses, ...ok(OAuthEnabledProvidersDTO, 'ok') },
  }),
  handler: async (c) => c.json(okBody(await listEnabledOAuthProviders()), 200),
});

const OAuthNeedBindDTO = z.object({
  needBind: z.literal(true),
  oauthInfo: z.object({
    provider: z.string(),
    openId: z.string(),
    nickname: z.string(),
    avatar: z.string().nullable().optional(),
  }),
});

const authUrlRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/{provider}', tags: ['OAuth'], summary: '获取登录授权链接',
    description: '返回的 state 为一次性登录凭据：前端须在跳转前暂存并在回调时原样带回，服务端单次消费',
    security: [],
    request: { params: providerParam },
    responses: {
      ...commonErrorResponses,
      ...ok(OAuthAuthUrlDTO, 'ok'),
      400: { content: jsonContent(ErrorResponse), description: '参数错误' },
    },
  }),
  handler: async (c) => {
    const { provider } = c.req.valid('param');
    return c.json(okBody(await generateAuthUrl(provider)), 200);
  },
});

const bindUrlRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/{provider}/bind', tags: ['OAuth'], summary: '获取绑定授权链接（当前用户）',
    description: 'state 绑定到当前登录用户，回调时只能由同一用户经 POST /bind 完成，不会替换当前会话',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware] as const,
    request: { params: providerParam },
    responses: {
      ...commonErrorResponses,
      ...ok(OAuthAuthUrlDTO, 'ok'),
      400: { content: jsonContent(ErrorResponse), description: '参数错误' },
    },
  }),
  handler: async (c) => {
    const { provider } = c.req.valid('param');
    return c.json(okBody(await generateBindAuthUrl(provider)), 200);
  },
});

const callbackRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/{provider}/callback', tags: ['OAuth'], summary: 'OAuth 登录回调',
    security: [],
    request: {
      params: providerParam,
      body: { content: jsonContent(oauthCallbackSchema.openapi('OAuthCallbackBody')), required: true },
    },
    responses: {
      ...commonErrorResponses,
      ...ok(z.union([LoginResultDTO, OAuthNeedBindDTO]), 'ok'),
      400: { content: jsonContent(ErrorResponse), description: '参数错误 / state 无效' },
      403: { content: jsonContent(ErrorResponse), description: '账号已禁用' },
    },
  }),
  handler: async (c) => {
    const { provider } = c.req.valid('param');
    const body = c.req.valid('json');
    const { ip, ua } = getClientInfo(c);
    const result = await handleOAuthCallback(provider, body, { ip, ua });
    return c.json(okBody(result.data, result.message), 200);
  },
});

const bindRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/bind', tags: ['OAuth'], summary: '绑定 OAuth 账号',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware] as const,
    request: { body: { content: jsonContent(oauthBindSchema.openapi('OAuthBindBody')), required: true } },
    responses: {
      ...commonErrorResponses,
      ...okMsg('ok'),
      400: { content: jsonContent(ErrorResponse), description: '参数错误 / state 无效' },
      403: { content: jsonContent(ErrorResponse), description: '绑定请求不属于当前用户' },
    },
  }),
  handler: async (c) => {
    const { provider, code, state } = c.req.valid('json');
    await bindOAuthAccount(provider, code, state);
    return c.json(okBody(null, '绑定成功'), 200);
  },
});

const unbindRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'delete', path: '/unbind/{provider}', tags: ['OAuth'], summary: '解绑 OAuth 账号',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware] as const,
    request: { params: providerParam },
    responses: {
      ...commonErrorResponses,
      ...okMsg('ok'),
      400: { content: jsonContent(ErrorResponse), description: '参数错误' },
      404: { content: jsonContent(ErrorResponse), description: '未找到' },
    },
  }),
  handler: async (c) => {
    const { provider } = c.req.valid('param');
    await unbindOAuthAccount(provider);
    return c.json(okBody(null, '已解绑'), 200);
  },
});

oauth.openapiRoutes([accountsRoute, providersRoute, authUrlRoute, bindUrlRoute, callbackRoute, bindRoute, unbindRoute] as const);

export default oauth;
