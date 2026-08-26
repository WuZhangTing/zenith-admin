# 请求上下文与当前用户工具

`packages/server/src/lib/context.ts` 基于 `hono/context-storage` 提供零参上下文工具，Service 层可在请求生命周期内读取登录用户、traceId 与审计快照，不需要把 Hono `Context` 或 `user` 层层传递。

## 前提条件

`contextStorage()` 中间件在 `src/app.ts` 的 `createApp()` 中全局挂载。`requestTraceMiddleware` 紧随其后，为每个请求建立 `X-Trace-Id`。需要当前用户的 API 必须先经过 `authMiddleware` 或会员侧 `memberAuthMiddleware`。

`AppEnv` 类型别名由 `context.ts` 导出，等价于 `AuthEnv`，供需要显式泛型的场景使用。

---

## 基础上下文函数

### `getCtx()`

获取当前请求的 Hono Context。脱离请求作用域（定时任务、后台 Worker、脚本）时会抛出错误。

### `currentUser()`

获取已登录管理员用户的 JWT Payload，未登录时抛出错误。

```ts
import { currentUser } from '../lib/context';

const user = currentUser();
// { userId, username, roles, tenantId, viewingTenantId?, jti?, authType?, apiTokenId? }
```

管理员 JWT Payload 定义在 `packages/server/src/middleware/auth.ts`：

```ts
interface JwtPayload {
  userId: number;
  username: string;
  roles: string[];
  tenantId: number | null;
  viewingTenantId?: number | null;
  jti?: string;
  authType?: 'jwt' | 'apiToken';
  apiTokenId?: number;
}
```

`authMiddleware` 支持普通 JWT 与以 `zat_` 开头的 API Token，并拒绝会员 token（`type: 'member'`）。

### `currentUserOrNull()`

读取已登录管理员用户；未登录或匿名接口返回 `undefined`。若处于 `runWithCurrentUser()` 作用域内，优先返回覆盖的用户身份。

### `runWithCurrentUser(user, fn)`

在请求上下文之外以指定用户身份执行逻辑，供 Worker / 定时任务复用依赖 `currentUser()` 的 service。

```ts
import { runWithCurrentUser } from '../lib/context';

await runWithCurrentUser(creatorPayload, async () => {
  await someService.doWork();
});
```

任务中心和导出中心都会在 Worker 执行时还原任务创建者身份。

### `currentTraceId()` / `runWithTraceId(traceId, fn)`

链路关联 ID 工具：

- `currentTraceId()` 返回本次操作的 traceId；脱离作用域返回 `undefined`。
- `runWithTraceId(traceId, fn)` 在指定 traceId 作用域内执行异步逻辑。
- 请求入口读取 `X-Trace-Id`（长度 ≤ 64）或生成 UUID，并在响应头回写 `X-Trace-Id`。
- 作业入队和事件 outbox 会继承 traceId，便于串联 HTTP 请求、后台作业与事件 fan-out。

---

## 会员上下文函数

会员前台使用独立的 `packages/server/src/lib/member-context.ts`。会员路由经 `memberAuthMiddleware` 注入 `c.set('member', payload)` 后，Service 层可零参读取会员身份。

### `currentMember()`

获取已登录会员的 JWT Payload，未登录时抛出错误。

```ts
import { currentMember } from '../lib/member-context';

const member = currentMember();
// { memberId, identifier, type: 'member', tenantId, jti? }
```

会员 JWT Payload 定义在 `packages/server/src/middleware/member-auth.ts`：

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

### `currentMemberOrNull()`

读取已登录会员；未登录返回 `undefined`。

### `currentMemberId()`

快捷获取当前会员 ID。

```ts
const memberId = currentMemberId();
```

---

## 角色判断工具（无需 DB）

以下函数直接读取 JWT Payload 中的 `roles` 字段。

### `currentUserId()`

快捷获取管理员用户 ID。

### `currentUserRoles()`

获取管理员用户角色 code 数组。

### `hasRole(...codes)`

判断是否拥有任意一个指定角色。

### `hasAllRoles(...codes)`

判断是否同时拥有所有指定角色。

### `isSuperAdmin()`

判断平台超级管理员：必须同时满足 `roles` 包含 `super_admin` 且 `tenantId === null`。不要只用角色 code 判断超管能力。

---

## 完整用户详情（需要 DB 查询）

### `currentUserDetail()`

按需查询数据库，返回用户、部门、岗位和角色详情；用户不存在时返回 `null`。

```ts
const detail = await currentUserDetail();
if (!detail) return;

console.log(detail.department);  // { id, name, code, parentId } | null
console.log(detail.positions);   // [{ id, name, code }, ...]
console.log(detail.roles);       // [{ id, name, code, dataScope }, ...]
```

返回类型：

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

该函数每次调用都会查询数据库。同一请求内重复使用时，在 Service 层用局部变量缓存。

### `hasPosition(...codes)`

判断用户是否拥有任意一个指定岗位，需要查询完整用户详情。

### `isInDepartment(departmentId, includeDescendants = false)`

判断用户是否属于指定部门；`includeDescendants=true` 时包含目标部门后代节点。

---

## 多租户工具（无需 DB）

### `currentTenantId()`

返回登录用户所属租户 ID；平台超管返回 `null`。

### `currentViewingTenantId()`

返回平台超管切换视角时的目标租户 ID；普通用户或未切换视角返回 `undefined` / `null`。

### `effectiveTenantId()`

返回用于当前请求数据过滤的生效租户 ID：超管切换视角时取 `viewingTenantId`，否则取 `tenantId`。

多租户查询条件优先使用 `packages/server/src/lib/tenant.ts`：

```ts
import { tenantScope, currentCreateTenantId } from '../lib/tenant';

const where = tenantScope(table);
const tenantId = currentCreateTenantId();
```

已有显式传参函数 `tenantCondition(table, user)` 与 `getCreateTenantId(user)` 保持可用。

---

## 其他常用快捷工具

### `currentUsername()`

返回 `currentUser().username`。

### `isAuthenticated()`

判断请求中是否有管理员登录用户，适合匿名可访问接口中区分登录态。

### `hasPermission(...codes)`

判断用户是否拥有任意一个菜单权限标识。实现位于 `permissions.ts`，按用户缓存权限 5 分钟；平台超管直接返回 `true`。

```ts
if (await hasPermission('system:user:delete')) {
  // 有权限
}
```

---

## 审计日志快照

### `setAuditBefore(data)` / `setAuditAfter(data)`

Service 层可用这两个函数写入操作前 / 操作后实体快照。函数会把快照裁剪为合法 JSON，避免大字段或批量数组导致审计日志膨胀；脱离请求上下文调用会静默忽略。

```ts
const before = await getUser(id);
setAuditBefore(before);
const after = await updateUser(id, body);
setAuditAfter(after);
```

Route 层也可使用 `middleware/guard.ts` 中的兼容函数 `setAuditBeforeData(c, data)` / `setAuditAfterData(c, data)`。写接口如果响应体 `data` 为实体对象，`guard` 会自动把成功响应的 `data` 作为 after 快照；响应体为 `null` 且仍需 diff 时手动补充 after 快照。

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

import { currentMember, currentMemberOrNull, currentMemberId } from '../lib/member-context';
import { runAsUser } from '../lib/audit-context';
import { tenantScope, currentCreateTenantId } from '../lib/tenant';
```
