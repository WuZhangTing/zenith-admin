import { z } from 'zod';
import { DATE_TIME_PATTERN } from './constants';

/**
 * 自引用递归 schema 的 lazy 包装：**内部实例必须缓存**。
 *
 * `z.lazy(() => z.object({...}))` 每次取值都会新建一个 schema 实例，
 * OpenAPI 生成器只能靠实例标识判断环路，拿到的永远是新对象 → 无限展开 →
 * `/api/openapi.json` 栈溢出返回 500（整个 Swagger 文档不可用）。
 * 缓存后自引用命中同一实例，生成器改为输出 `$ref`，递归即终止。
 */
export function lazyRecursive<T extends z.ZodType>(build: () => T) {
  let cached: T | undefined;
  return z.lazy(() => (cached ??= build()));
}


/** `.default()` 剥离后的字段类型（用于保持 partialForUpdate 的类型推导） */
type StripDefault<T> = T extends z.ZodDefault<infer Inner> ? Inner : T;


/**
 * 由 create schema 派生「部分更新」schema：**先剥离 `.default()`，再 `.partial()`**。
 *
 * Zod 的 `.partial()` 会**保留** `.default()`，所以 `createXxxSchema.partial()` 在字段省略时
 * 反而会主动填入默认值。服务层普遍用 `.set({ ...data })` 写库，于是一次
 * `PUT { "remark": "x" }` 会静默改写一批根本没提交的字段——实测注入过：
 *
 * - `updateRoleSchema` → `dataScope: 'all'`：把 dept/self 范围的角色提权为全量可见
 * - `updateTenantIdentityProviderSchema` → `status: 'disabled'` + `ldapStartTls: false`：
 *   身份源被停用（登录中断）并把 LDAP 降级为明文
 * - `updateCmsChannelSchema` → `parentId: 0`：栏目被挂回站点根并级联改写子栏目 URL
 * - `updateCmsContentSchema` → `tagIds: []`（JS 里 `[]` 是 truthy）：清空全部标签与关联
 *
 * 默认值只属于**创建**语义：创建时字段缺失需要一个合理初值，更新时字段缺失的语义是
 * 「别动它」。两者不能共用一份 shape。
 */
export function partialForUpdate<T extends z.ZodObject<z.ZodRawShape>>(
  schema: T,
): z.ZodObject<{ [K in keyof T['shape']]: z.ZodOptional<StripDefault<T['shape'][K]>> }> {
  const shape = schema.shape as Record<string, z.ZodType>;
  const stripped: Record<string, z.ZodType> = {};
  for (const key of Object.keys(shape)) {
    let field = shape[key];
    // 循环而非单次：理论上可能出现 .default().default() 的叠加包装
    while (field instanceof z.ZodDefault) {
      field = (field as unknown as { def: { innerType: z.ZodType } }).def.innerType;
    }
    stripped[key] = field;
  }
  return z.object(stripped).partial() as unknown as z.ZodObject<{
    [K in keyof T['shape']]: z.ZodOptional<StripDefault<T['shape'][K]>>
  }>;
}


export const dateTimeStringSchema = z.string().regex(DATE_TIME_PATTERN, '日期时间格式必须为 YYYY-MM-DD HH:mm:ss');


// ─── 埋点事件上报 ─────────────────────────────────────────────────────────────
function jsonDepth(value: unknown): number {
  if (value === null || typeof value !== 'object') return 0;
  const stack: Array<{ value: object; depth: number }> = [{ value, depth: 1 }];
  const seen = new WeakSet<object>();
  let maxDepth = 0;
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (seen.has(current.value)) continue;
    seen.add(current.value);
    maxDepth = Math.max(maxDepth, current.depth);
    const children = Array.isArray(current.value) ? current.value : Object.values(current.value);
    for (const child of children) {
      if (child !== null && typeof child === 'object') stack.push({ value: child, depth: current.depth + 1 });
    }
  }
  return maxDepth;
}


function jsonByteLength(value: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}


export function boundedJsonRecord(label: string, maxKeys: number, maxBytes: number, maxDepth = 6) {
  return z.record(z.string(), z.unknown()).superRefine((value, ctx) => {
    if (Object.keys(value).length > maxKeys) {
      ctx.addIssue({ code: 'custom', message: `${label}最多允许 ${maxKeys} 个字段` });
    }
    if (jsonDepth(value) > maxDepth) {
      ctx.addIssue({ code: 'custom', message: `${label}嵌套层级不能超过 ${maxDepth} 层` });
    }
    if (jsonByteLength(value) > maxBytes) {
      ctx.addIssue({ code: 'custom', message: `${label}序列化后不能超过 ${maxBytes} 字节` });
    }
  });
}


// ─── 告警规则 ─────────────────────────────────────────────────────────────────
export const webhookUrlSchema = z.url().max(512).refine(
  (value) => ['http:', 'https:'].includes(new URL(value).protocol),
  'Webhook URL 仅支持 HTTP/HTTPS',
);


export function validateAlertDelivery(
  value: { enabled?: boolean; channels?: string[]; webhookUrl?: string | null; recipients?: string[] },
  ctx: z.RefinementCtx,
) {
  if (value.enabled === false) return;
  const channels = value.channels ?? [];
  if (channels.length === 0) {
    ctx.addIssue({ code: 'custom', path: ['channels'], message: '启用告警时至少选择一个通知渠道' });
  }
  if (channels.includes('webhook') && !value.webhookUrl) {
    ctx.addIssue({ code: 'custom', path: ['webhookUrl'], message: 'Webhook 渠道必须配置有效 URL' });
  }
  if ((channels.includes('email') || channels.includes('inapp')) && !(value.recipients?.length)) {
    ctx.addIssue({ code: 'custom', path: ['recipients'], message: '邮件或站内通知渠道必须配置接收人' });
  }
}
