# 请求上下文与当前用户工具

`packages/server/src/lib/context.ts` 提供了一套基于 `hono/context-storage` 的零参工具函数，可在 Service 层任意位置获取当前登录用户信息，无需将 Hono `Context` 或 `user` 对象层层传递。

## 前提条件

`contextStorage()` 中间件已在 `src/app.ts` 的 `createApp()` 中全局挂载，所有工具函数在认证请求的生命周期内均可直接调用。

`AppEnv` 类型别名（等价于 `AuthEnv`）也由 `context.ts` 导出，供需要显式泛型的场景使用。

---

## 基础上下文函数

### `getCtx()`

获取当前请求的 Hono Context。脱离请求作用域（如定时任务、后台 Worker）时会抛出错误。

### `currentUser()`

获取当前已登录用户的 JWT Payload，若未登录则抛出错误。

```ts
import { currentUser } from '../lib/context';

const user = currentUser();
// { userId, username, roles: string[], tenantId, viewingTenantId?, jti?, authType?, apiTokenId? }
```

### `currentUserOrNull()`

与 `currentUser()` 相同，但未登录时返回 `undefined`，适用于匿名可访问接口。若处于 `runWithCurrentUser()` 作用域内，优先返回指定的用户身份。

管理员 JWT Payload 来自 `packages/server/src/middleware/auth.ts`：

```ts
interface JwtPayload {
  userId: number;
  username: string;
  roles: string[];
  tenantId: number | null;
  /** 超管切换租户视角时，存放目标租户 ID */
  viewingTenantId?: number | null;
  jti?: string;
  authType?: 'jwt' | 'apiToken';
  apiTokenId?: number;
}
```

管理员 `authMiddleware` 会拒绝会员 token（`type: 'member'`），避免后台接口被会员身份访问。

### `runWithCurrentUser(user, fn)`

在请求上下文**之外**以指定用户身份执行逻辑，供后台 Worker / 定时任务复用依赖 `currentUser()` 的 service（如任务中心以任务创建者身份运行 handler、`db:seed` 以管理员身份写入审计字段）：

```ts
import { runWithCurrentUser } from '../lib/context';

await runWithCurrentUser(creatorPayload, async () => {
  await someService.doWork(); // 内部的 currentUser() 返回 creatorPayload
});
```

### `currentTraceId()` / `runWithTraceId(traceId, fn)`

链路关联 ID 工具，用于把一次操作的全部异步副作用（作业、事件 fan-out）串成同一条链路：

- `currentTraceId()` — 返回当前操作的 traceId；由请求中间件（每个 HTTP 请求一枚）或 Worker 执行作业时（继承作业自身 traceId）建立，脱离作用域时返回 `undefined`
- `runWithTraceId(traceId, fn)` — 在给定 traceId 作用域内执行 `fn`，其内部新入队的作业 / 发射的事件自动继承该 traceId
- `enqueueJob` 与事件 outbox 会自动继承当前 traceId，业务代码通常无需手动调用

---

## 会员上下文函数

会员前台使用独立的 `packages/server/src/lib/member-context.ts`，与管理员 `currentUser()` 并存。会员路由经 `memberAuthMiddleware` 注入 `c.set('member', payload)` 后，Service 层可零参读取当前会员。

### `currentMember()`

获取当前已登录会员的 JWT Payload，若不存在则抛出错误。

```ts
import { currentMember } from '../lib/member-context';

const member = currentMember();
// { memberId, identifier, type: 'member', tenantId, jti? }
```

### `currentMemberOrNull()`

与 `currentMember()` 相同，但未登录时返回 `undefined`。

### `currentMemberId()`

快捷获取当前登录会员 ID。

```ts
import { currentMemberId } from '../lib/member-context';

const memberId = currentMemberId(); // 等价于 currentMember().memberId
```

会员 JWT Payload 来自 `packages/server/src/middleware/member-auth.ts`：

```ts
interface MemberJwtPayload {
  memberId: number;
  identifier: string;
  type: 'member';
  tenantId: number | null;
  jti?: string;
}
```

`memberAuthMiddleware` 强制校验 `type: 'member'`，管理员 token 不能访问会员接口。

---

## 角色判断工具（无需 DB）

以下函数直接读取 JWT Payload 中的 `roles` 字段，**无需查询数据库**，适合在 Service 层高频调用。

### `currentUserId()`

快捷获取当前登录用户 ID。

```ts
const id = currentUserId(); // 等价于 currentUser().userId
```

### `currentUserRoles()`

获取当前用户的角色 code 数组（来自 JWT）。

```ts
const roles = currentUserRoles(); // ['admin', 'editor']
```

### `hasRole(...codes)`

判断当前用户是否拥有指定角色（任意一个匹配即返回 `true`）。

```ts
if (hasRole('admin')) {
  // 仅管理员可执行
}

if (hasRole('admin', 'editor')) {
  // 管理员或编辑均可执行
}
```

### `isSuperAdmin()`

判断当前用户是否为**平台超级管理员**：同时满足拥有 `super_admin` 角色**且**归属平台（`tenantId` 为 `null`）。仅凭角色 code 判定会被租户自建同名角色伪造，因此两个条件缺一不可。

```ts
if (isSuperAdmin()) {
  // 超管专属逻辑
}
```

---

## 完整用户详情（需要 DB 查询）

以下函数需要查询数据库，用于获取 JWT 中未携带的信息（部门、岗位等）。

### `currentUserDetail()`

获取当前用户的完整信息，包含部门、岗位列表和角色完整信息（含 dataScope）。

```ts
const detail = await currentUserDetail();
if (!detail) return; // 用户已被删除等异常情况

console.log(detail.department);  // { id, name, code, parentId } | null
console.log(detail.positions);   // [{ id, name, code }, ...]
console.log(detail.roles);       // [{ id, name, code, dataScope }, ...]
```

**返回类型 `CurrentUserDetail`：**

```ts
interface CurrentUserDetail {
  id: number;
  username: string;
  nickname: string;
  department: { id: number; name: string; code: string; parentId: number } | null;
  positions: { id: number; name: string; code: string }[];
  roles: { id: number; name: string; code: string; dataScope: string }[];
}
```

> **性能提示：** 每次调用均执行一次 DB 查询。同一请求内多次使用时，建议在 Service 层将结果缓存到局部变量。

### `hasPosition(...codes)`

判断当前用户是否拥有指定岗位（任意一个匹配即返回 `true`）。

```ts
if (await hasPosition('hr_manager', 'cto')) {
  // HR 经理或 CTO 可执行
}
```

### `isInDepartment(departmentId, includeDescendants?)`

判断当前用户是否属于指定部门。

```ts
// 精确匹配（仅本部门）
if (await isInDepartment(5)) { ... }

// 包含子部门
if (await isInDepartment(5, true)) { ... }
```

---

## 多租户工具（无需 DB）

### `currentTenantId()`

快捷获取当前登录用户所属租户 ID。平台超管（无租户归属）时返回 `null`。

```ts
const tId = currentTenantId(); // number | null
```

### `currentViewingTenantId()`

超管切换租户视角时，返回目标租户 ID；未切换时返回 `undefined` 或 `null`。

### `effectiveTenantId()`

**推荐在多租户数据过滤时统一使用此函数。** 超管切换视角时返回 `viewingTenantId`，否则返回 `tenantId`：

```ts
const tId = effectiveTenantId();
if (tId) where.push(eq(table.tenantId, tId));
```

---

## 其他常用快捷工具

### `currentUsername()`

快捷获取当前登录用户的用户名（等价于 `currentUser().username`）。

```ts
const name = currentUsername();
```

### `isAuthenticated()`

判断当前请求是否已认证（有登录用户）。适用于匿名可访问接口中区分登录/未登录状态。

```ts
if (isAuthenticated()) {
  // 已登录用户专属逻辑
}
```

### `hasAllRoles(...codes)`

判断当前用户是否**同时拥有所有**指定角色（全匹配），与 `hasRole`（任意匹配）互补。

```ts
if (hasAllRoles('admin', 'auditor')) {
  // 必须同时拥有 admin 和 auditor 角色
}
```

### `hasPermission(...codes)`

判断当前用户是否拥有指定菜单权限标识（任意一个匹配即 `true`）。
通过 `permissions.ts` 带 5 分钟内存缓存，同一用户多次调用只查一次 DB。
**超管自动返回 `true`，无需权限查询。**

```ts
if (await hasPermission('system:user:delete')) {
  // 有删除用户权限
}

if (await hasPermission('system:user:export', 'system:user:import')) {
  // 有导出或导入权限之一
}
```

---

## 审计日志快照

### `setAuditBefore(data)`

在 Service 层写入"操作前实体快照"，供审计日志 diff 展示使用。仅在请求上下文内可用（脱离请求栈调用会静默忽略）。

```ts
const before = await getUser(id);
setAuditBefore(before); // 路由完成后自动 diff
await updateUser(id, body);
```

### `setAuditAfter(data)`

写入"操作后实体快照"，用于响应体 `data` 为 `null` 但仍需要审计 diff 的场景（如成员分配、权限分配）：

```ts
await setUserRoles(userId, roleIds);
setAuditAfter({ userId, roleIds }); // 响应体无 data，手动补充操作后快照
```

---

## 完整导入示例

```ts
import {
  getCtx,
  currentUser,
  currentUserOrNull,
  runWithCurrentUser,
  currentTraceId,
  runWithTraceId,
  currentUserId,
  currentUsername,
  currentUserRoles,
  currentTenantId,
  currentViewingTenantId,
  effectiveTenantId,
  hasRole,
  hasAllRoles,
  isSuperAdmin,
  isAuthenticated,
  hasPermission,
  currentUserDetail,
  hasPosition,
  isInDepartment,
  setAuditBefore,
  setAuditAfter,
} from '../lib/context';

import {
  currentMember,
  currentMemberOrNull,
  currentMemberId,
} from '../lib/member-context';
```
