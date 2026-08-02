# 多租户

系统支持可选的多租户模式：一套部署服务多个相互隔离的组织。多租户能力由系统配置开关控制，关闭时系统以单租户（平台）模式运行，所有租户过滤自动失效。

代码位置速查：

| 模块 | 位置 |
| --- | --- |
| 租户过滤工具 | `packages/server/src/lib/tenant.ts` |
| 用户配额 | `packages/server/src/lib/tenant-quota.ts` |
| 套餐菜单授权 | `packages/server/src/lib/tenant-package.ts` |
| 租户生命周期 | `packages/server/src/services/identity/tenant-lifecycle.service.ts` |
| 表结构 | `packages/server/src/db/schema/core.ts` |

## 数据模型

### tenants 表

| 字段 | 说明 |
| --- | --- |
| `code` | 租户编码（登录时输入，唯一） |
| `name` | 租户名称 |
| `packageId` | 绑定的租户套餐（引用 `tenant_packages`，`onDelete: restrict`） |
| `maxUsers` | 用户数上限（**强制执行**，见下文配额） |
| `expireAt` | 到期时间（`timestamptz`，空 = 永不过期） |
| `status` | `enabled` / `disabled` |
| `contactName` / `contactPhone` | 联系人信息 |

### 数据归属

业务表通过 `tenantId` 列（引用 `tenants.id`）标记归属：

- `tenantId = NULL` → 平台数据（不属于任何租户）
- `tenantId = n` → 租户 n 的数据

`users` 表的用户名 / 邮箱 / 手机号均为 **(tenantId, 字段) 复合唯一**——不同租户可以有同名用户。

## 租户过滤工具

`src/lib/tenant.ts` 提供五个核心函数，service 层查询必须使用它们而非手写 `eq(t.tenantId, ...)`：

```ts
/** 多租户功能是否开启（读系统配置，带缓存） */
isMultiTenantEnabled(): Promise<boolean>

/** 当前用户可见数据的租户过滤 SQL 片段；单租户模式或平台超管返回 undefined（不过滤） */
tenantFilter(table): Promise<SQL | undefined>

/** 写入数据时应落的 tenantId；平台超管在租户视角下写入该租户 */
currentTenantIdForWrite(): Promise<number | null>

/** 审计等场景取用户的有效租户 ID */
getEffectiveTenantId(user): number | null

/** 校验目标资源租户归属，跨租户访问抛 403 */
assertTenantAccess(resourceTenantId): Promise<void>
```

行为矩阵：

| 场景 | 过滤行为 |
| --- | --- |
| 多租户关闭 | 不过滤，所有数据可见 |
| 平台超管（`tenantId = null`） | 默认可见全部；切换到租户视角后按该租户过滤 |
| 租户用户 | 强制 `tenantId = 自身租户` |

## 登录与租户上下文

登录时可选传 `tenantCode`：

1. 传了 `tenantCode` → 查租户：不存在 → 401；`status = disabled` → 403「租户已停用」；已过期 → 403「租户已过期」；然后**只在该租户内**匹配用户
2. 未传 → 只匹配平台用户（`tenant_id IS NULL`）

登录成功后 JWT payload 携带 `tenantId`，后续所有过滤基于它。

### 租户切换（平台超管）

- `GET /api/auth/tenants` — 获取可切换的租户列表
- `POST /api/auth/switch-tenant` — 切换视角，签发带目标 `tenantId` 的新 token；再次调用传 `tenantId: null` 切回平台视角

## 租户套餐

套餐（`tenant_packages` + `tenant_package_menus` 表）定义一组可用菜单，实现按套餐售卖功能模块：

- 管理端点：`GET /api/tenant-packages`（分页）、`GET /api/tenant-packages/all`（下拉全量）、`GET /{id}`、`POST /`、`PUT /{id}`、`PUT /{id}/menus`（配置套餐菜单）、`DELETE /{id}`、`DELETE /batch`
- 租户通过 `tenants.packageId` 绑定套餐

菜单授权求值（`getTenantPackageMenuIdSet`，`src/lib/tenant-package.ts`）：

| 场景 | 结果 |
| --- | --- |
| 多租户关闭 / 平台用户 / 租户未绑定套餐 | `null` — 不限制 |
| 套餐被禁用 | **空集** — fail-closed，租户所有套餐菜单不可见 |
| 正常绑定 | 套餐勾选的菜单 ID 集合（按钮子节点自动并入） |

租户用户的最终可见菜单 = 角色授权菜单 ∩ 套餐菜单。

## 用户配额

`ensureTenantUserQuota()`（`src/lib/tenant-quota.ts`）在创建用户 / 导入用户时强制校验：租户当前用户数达到 `maxUsers` 时抛 400「租户用户数已达上限」。`maxUsers = 0` 或空表示不限制。

## 租户生命周期

- **到期巡检**：系统调度任务 `tenant-expiry-check`（每天 01:30）自动停用已过期租户并吊销其用户会话；到期前 7 / 3 / 1 天向租户管理员与平台超管发送站内信提醒
- **用量概览**：`GET /api/tenants/{id}/stats` 返回租户的用户数、角色数等用量统计
- 租户管理端点：`GET/POST /api/tenants`、`PUT /api/tenants/{id}`、`DELETE /api/tenants/{id}` 等，权限码 `system:tenant:*`

## Service 层开发约定

```ts
// ✅ 查询：合并租户过滤
const filter = await tenantFilter(articles);
const rows = await db.select().from(articles)
  .where(and(filter, eq(articles.status, 'published')));

// ✅ 写入：落有效租户
await db.insert(articles).values({
  ...input,
  tenantId: await currentTenantIdForWrite(),
});

// ✅ 详情 / 更新 / 删除：先校验归属
const [row] = await db.select().from(articles).where(eq(articles.id, id));
await assertTenantAccess(row.tenantId);
```

审计日志自动按 `getEffectiveTenantId()` 记录归属租户：租户用户记自身租户；平台超管在租户视角下记该租户，平台视角记 `null`。
