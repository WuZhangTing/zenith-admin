import * as z from 'zod';
import { partialForUpdate } from '../core/validation';
import { isSafeOAuthRedirectUri } from '../identity/constants';
import { OAUTH2_GRANT_TYPES, OPEN_APP_ENVIRONMENTS } from './constants';

const ipOrCidrSchema = z.string().min(2).max(64).regex(
  /^((\d{1,3}\.){3}\d{1,3}|[0-9a-fA-F:]+)(\/\d{1,3})?$/,
  '请输入有效的 IP 地址或 CIDR',
);

const redirectUriSchema = z.string().min(1).max(500)
  .refine(isSafeOAuthRedirectUri, '回调 URL 仅允许 HTTPS、localhost HTTP 或安全的自定义协议');

const oauth2ClientFields = {
  name: z.string().trim().min(1).max(64),
  description: z.string().max(256).optional(),
  logoUrl: z.url().optional().or(z.literal('')),
  redirectUris: z.array(redirectUriSchema).max(20),
  allowedScopes: z.array(z.string().min(1).max(64)).min(1),
  grantTypes: z.array(z.enum(OAUTH2_GRANT_TYPES)).min(1),
  isPublic: z.boolean(),
  ratePlanId: z.number().int().positive().nullable().optional(),
  signEnabled: z.boolean().optional(),
  ipAllowlist: z.array(ipOrCidrSchema).max(100),
  environment: z.enum(OPEN_APP_ENVIRONMENTS),
};

const oauth2ClientBaseSchema = z.object(oauth2ClientFields);

const oauth2ClientCreateSchema = z.object({
  ...oauth2ClientFields,
  ipAllowlist: oauth2ClientFields.ipAllowlist.default([]),
  environment: oauth2ClientFields.environment.default('production'),
});

function validateOAuth2Client(value: z.infer<typeof oauth2ClientCreateSchema>, ctx: z.RefinementCtx) {
  if (value.grantTypes.includes('authorization_code') && value.redirectUris.length === 0) {
    ctx.addIssue({ code: 'custom', path: ['redirectUris'], message: '授权码模式至少需要一个回调 URL' });
  }
  if (value.isPublic && value.grantTypes.includes('client_credentials')) {
    ctx.addIssue({ code: 'custom', path: ['grantTypes'], message: '公开客户端不支持客户端凭证模式' });
  }
  if (value.grantTypes.includes('refresh_token') && !value.grantTypes.includes('authorization_code')) {
    ctx.addIssue({ code: 'custom', path: ['grantTypes'], message: '刷新令牌模式必须与授权码模式同时启用' });
  }
  if (value.isPublic && value.signEnabled) {
    ctx.addIssue({ code: 'custom', path: ['signEnabled'], message: '公开客户端没有密钥，无法启用 HMAC 签名' });
  }
}

export const createOAuth2ClientSchema = oauth2ClientCreateSchema.superRefine(validateOAuth2Client);

export const updateOAuth2ClientSchema = partialForUpdate(oauth2ClientBaseSchema).extend({
  status: z.enum(['enabled', 'disabled']).optional(),
});

const developerOAuth2ClientCreateSchema = oauth2ClientCreateSchema.omit({ ratePlanId: true });

export const updateDeveloperOAuth2ClientSchema = oauth2ClientBaseSchema.omit({ ratePlanId: true }).partial();

export const createDeveloperOAuth2ClientSchema = developerOAuth2ClientCreateSchema.superRefine(validateOAuth2Client);

export type CreateOAuth2ClientInput = z.infer<typeof createOAuth2ClientSchema>;

export type UpdateOAuth2ClientInput = z.infer<typeof updateOAuth2ClientSchema>;

export type CreateDeveloperOAuth2ClientInput = z.infer<typeof createDeveloperOAuth2ClientSchema>;

export type UpdateDeveloperOAuth2ClientInput = z.infer<typeof updateDeveloperOAuth2ClientSchema>;

// ─── 开放平台：API Scope ──────────────────────────────────────────────────────
export const createApiScopeSchema = z.object({
  code: z
    .string()
    .min(1, 'scope 编码不能为空')
    .max(64)
    .regex(/^[a-z][a-z0-9_.:-]*$/, 'scope 编码须以小写字母开头，仅含小写字母/数字/:._-'),
  name: z.string().min(1, '名称不能为空').max(100),
  description: z.string().max(500).optional(),
  scopeGroup: z.string().min(1).max(64).default('general'),
  status: z.enum(['enabled', 'disabled']).default('enabled'),
});

export const updateApiScopeSchema = partialForUpdate(createApiScopeSchema).omit({ code: true });

export type CreateApiScopeInput = z.input<typeof createApiScopeSchema>;

export type UpdateApiScopeInput = z.input<typeof updateApiScopeSchema>;

// ─── 开放平台：限流套餐 ───────────────────────────────────────────────────────
export const createRatePlanSchema = z.object({
  code: z
    .string()
    .min(1, '套餐编码不能为空')
    .max(64)
    .regex(/^[a-z][a-z0-9_-]*$/, '套餐编码须以小写字母开头，仅含小写字母/数字/_-'),
  name: z.string().min(1, '名称不能为空').max(100),
  description: z.string().max(500).optional(),
  qpsLimit: z.number().int().min(0).max(1_000_000).default(10),
  dailyQuota: z.number().int().min(0).default(0),
  monthlyQuota: z.number().int().min(0).default(0),
  isDefault: z.boolean().default(false),
  status: z.enum(['enabled', 'disabled']).default('enabled'),
});

export const updateRatePlanSchema = partialForUpdate(createRatePlanSchema).omit({ code: true });

export type CreateRatePlanInput = z.input<typeof createRatePlanSchema>;

export type UpdateRatePlanInput = z.input<typeof updateRatePlanSchema>;

// ─── 开放平台：签名验签工具 ───────────────────────────────────────────────────
export const openSignatureVerifySchema = z.object({
  appKey: z.string().min(1, 'AppKey 不能为空'),
  method: z.string().min(1).default('GET'),
  path: z.string().min(1, '请求路径不能为空'),
  query: z.string().optional(),
  body: z.string().optional(),
  timestamp: z.string().min(1, '时间戳不能为空'),
  nonce: z.string().min(1, '随机串不能为空'),
  /** 待校验的签名（可选；提供时返回 matched） */
  signature: z.string().optional(),
});

export type OpenSignatureVerifyInput = z.input<typeof openSignatureVerifySchema>;

// ─── 开放平台：Webhook 订阅 ───────────────────────────────────────────────────
export const createAppWebhookSchema = z.object({
  clientId: z.string().min(1, '请选择所属应用'),
  name: z.string().min(1, '名称不能为空').max(100),
  url: z.string().regex(/^https?:\/\/.+/, 'URL 必须以 http(s):// 开头').max(512),
  events: z.array(z.string()).default([]),
  signMode: z.enum(['hmacSha256', 'none']).default('hmacSha256'),
  headers: z.record(z.string(), z.string()).optional(),
  status: z.enum(['enabled', 'disabled']).default('enabled'),
});

export const updateAppWebhookSchema = partialForUpdate(createAppWebhookSchema).omit({ clientId: true });

export type CreateAppWebhookInput = z.input<typeof createAppWebhookSchema>;

export type UpdateAppWebhookInput = z.input<typeof updateAppWebhookSchema>;
