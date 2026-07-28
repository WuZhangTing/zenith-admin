/**
 * 「部分更新」schema 不得注入默认值——全仓统一守卫。
 *
 * Zod 的 `.partial()` **保留** `.default()`，所以 `createXxxSchema.partial()` 在字段省略时
 * 反而会主动填入默认值。服务层普遍用 `.set({ ...data })` 写库，于是一次
 * `PUT { "remark": "x" }` 会静默改写一批根本没提交的字段。曾实测到的真实后果：
 *
 * - `updateRoleSchema` → `dataScope: 'all'`：把 dept/self 范围的角色提权为全量可见，
 *   且紧接着 `clearUserPermissionCache()` 对所有持有该角色的用户立即生效
 * - `updateTenantIdentityProviderSchema` → `status: 'disabled'`（身份源被停用、
 *   走该 IdP 的用户登录中断）+ `ldapStartTls: false`（LDAP 降级为明文，bind 凭据裸奔）
 * - `updateCmsChannelSchema` → `parentId: 0`（`0 ?? x` 结果是 `0`）：栏目被挂回站点根，
 *   父栏目权限校验与防环检查一并跳过，并级联改写全部子栏目的公开 URL
 * - `updateCmsContentSchema` → `tagIds: []`（JS 里 `[]` 是 truthy）：清空全部标签、
 *   副栏目与相关内容关联
 *
 * 逐个 schema 写用例挡不住新增的 schema，因此这里对**所有导出的 `update*Schema`** 做全扫描。
 */
import { describe, expect, it } from 'vitest';
import * as shared from '@zenith/shared';

/**
 * 整体替换（PUT 全量）语义的例外：表单每次提交全部字段，服务层把相应字段声明为必填，
 * 默认值在这里是有意的兜底而非静默注入。新增例外必须在此显式登记并说明理由。
 */
const FULL_REPLACE_SCHEMAS = new Set([
  // 后台 OAuth 配置表单整体保存 + upsert，updateOauthConfig 要求 clientId / enabled 必填
  'updateOauthConfigSchema',
]);

interface ZodLike { safeParse: (v: unknown) => { success: boolean; data?: unknown } }

function isZodObjectLike(value: unknown): value is ZodLike {
  return !!value && typeof (value as ZodLike).safeParse === 'function';
}

function updateSchemas(): [string, ZodLike][] {
  return Object.entries(shared as Record<string, unknown>)
    .filter((entry): entry is [string, ZodLike] =>
      /^update[A-Z]\w*Schema$/.test(entry[0]) && isZodObjectLike(entry[1]))
    .filter(([name]) => !FULL_REPLACE_SCHEMAS.has(name));
}

describe('部分更新 schema 不得注入默认值', () => {
  it('扫描到足够多的 update schema（防止筛选条件写错导致空跑）', () => {
    expect(updateSchemas().length).toBeGreaterThan(80);
  });

  it('空对象解析后不得凭空多出任何字段', () => {
    const offenders = updateSchemas()
      .map(([name, schema]) => {
        const parsed = schema.safeParse({});
        if (!parsed.success) return null;
        const injected = Object.keys((parsed.data ?? {}) as Record<string, unknown>);
        return injected.length > 0 ? `${name}: ${injected.join(', ')}` : null;
      })
      .filter((x): x is string => x !== null);
    expect(offenders).toEqual([]);
  });

  it('只提交一个字段时，其余字段不得被填充', () => {
    const offenders = updateSchemas()
      .map(([name, schema]) => {
        const parsed = schema.safeParse({ remark: 'x' });
        if (!parsed.success) return null;
        const keys = Object.keys((parsed.data ?? {}) as Record<string, unknown>);
        const injected = keys.filter((k) => k !== 'remark');
        return injected.length > 0 ? `${name}: ${injected.join(', ')}` : null;
      })
      .filter((x): x is string => x !== null);
    expect(offenders).toEqual([]);
  });
});

describe('issue #7 报告的四条高危链路', () => {
  it.each([
    ['updateRoleSchema', { description: '只改说明' }],
    ['updateCmsChannelSchema', { name: '新名字' }],
    ['updateTenantIdentityProviderSchema', { remark: '只改备注' }],
    ['updateCmsContentSchema', { title: '只改标题' }],
  ])('%s 只回传显式提交的字段', (name, input) => {
    const schema = (shared as Record<string, unknown>)[name] as ZodLike;
    expect(schema).toBeDefined();
    const parsed = schema.safeParse(input);
    expect(parsed.success).toBe(true);
    expect(parsed.data).toEqual(input);
  });
});

describe('创建 schema 仍然补齐默认值', () => {
  // 默认值只属于创建语义：创建时字段缺失需要合理初值，更新时缺失的语义是「别动它」
  it('createRoleSchema 仍补 status / dataScope', () => {
    expect(shared.createRoleSchema.parse({ name: '角色', code: 'test_role' }))
      .toMatchObject({ status: 'enabled', dataScope: 'all' });
  });
});
