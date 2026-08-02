# 权限与组织

权限与组织（IAM）覆盖后台管理员的认证与账号安全（登录、MFA、可信设备、OAuth 与企业身份源）、用户、角色、菜单权限、部门、岗位、用户组，以及租户与租户套餐。系统以菜单权限码为核心做 RBAC 鉴权，以部门树和数据权限范围做数据访问约束，并与在线会话、账号锁定、审计日志、多租户隔离等后端能力联动。

---

## 能力总览

| 模块 | 核心表 | 权限码 | 当前能力 |
|------|--------|--------|----------|
| 认证与账号安全 | `users`、`user_mfa_factors`、`user_trusted_devices`、`login_risk_events`、`user_oauth_accounts`、`password_reset_tokens` | 登录态（`authMiddleware`） | 验证码登录、双 token、注册、忘记/重置密码、MFA（TOTP）、可信设备、登录风险策略、个人资料/偏好/收藏菜单、我的会话与日志、OAuth 账号绑定、企业身份源登录 |
| 用户管理 | `users`、`user_roles`、`user_positions`、`user_menus`、`user_dept_scopes` | `system:user:list`、`system:user:create`、`system:user:update`、`system:user:delete`、`system:user:import`、`system:user:export`、`system:user:export-raw`、`system:user:assign` | 用户 CRUD、角色/岗位/部门分配、用户级菜单权限、用户级数据权限、批量删除、批量启停、批量重置密码、Excel 导入、导出中心导出（含明文导出）、账号解锁、在线状态标记 |
| 角色管理 | `roles`、`role_menus`、`role_dept_scopes`、`user_roles` | `system:role:list`、`system:role:create`、`system:role:update`、`system:role:delete`、`system:role:assign` | 角色 CRUD、菜单权限分配、关联用户分配、数据权限范围与指定部门范围 |
| 菜单管理 | `menus`、`role_menus`、`user_menus` | `system:menu:list`、`system:menu:create`、`system:menu:update`、`system:menu:delete` | 目录 / 菜单 / 按钮三级模型、树形维护、权限码、可见性、排序、外链与查询参数 |
| 部门管理 | `departments`、`users` | `system:department:list`、`system:department:create`、`system:department:update`、`system:department:delete` | 部门树、负责人、部门类别、联系方式、成员数量与成员预览、Excel/CSV 导出 |
| 岗位管理 | `positions`、`user_positions` | `system:position:list`、`system:position:create`、`system:position:update`、`system:position:delete` | 岗位 CRUD、批量删除、成员查看、成员全量设置、Excel/CSV 导出 |
| 用户组 | `user_groups`、`user_group_members`、`user_group_roles` | `system:user-groups:list`、`system:user-groups:create`、`system:user-groups:update`、`system:user-groups:delete`、`system:user-groups:assign` | 用户组 CRUD、负责人、所属部门、成员数量与预览、成员全量设置、批量添加、批量移除、批量删除、绑定角色（组内成员自动继承） |
| 租户 / 租户套餐 | `tenants`、`tenant_packages`、`tenant_package_menus` | 平台超管（`platformAdminOnly`） | 租户 CRUD、用量概览、套餐 CRUD、套餐菜单白名单分配、租户视角切换 |
| 身份安全 | `user_mfa_factors`、`user_trusted_devices`、`login_risk_events`、`system_configs` | `system:identity-security:manage` | MFA 策略（off/optional/required）、可信设备免 MFA 天数、登录风险策略、风险事件查询 |
| 企业身份源 | `tenant_identity_providers`、`user_identity_accounts`、`identity_provider_sync_logs` | `system:identity-provider:manage` | LDAP/AD、OIDC、SAML 身份源 CRUD、连接测试、目录搜索、目录用户同步 |
| OAuth 登录配置 | `system_configs` | `system:oauth-config:view`、`system:oauth-config:update` | 各 OAuth provider 的服务端配置查看与更新 |
| 登录日志 | `login_logs` | `system:log:login` | 分页查询、统计、清理、导出中心导出 |

> 管理后台用户与前台会员是两套独立账号体系。本文仅描述后台管理员 IAM；会员体系见[前台会员体系](../member/index.md)。

---

## RBAC 权限模型

### 模型组成

| 层级 | 表 / 字段 | 说明 |
|------|-----------|------|
| 用户 | `users.id`、`users.username`、`users.status` | 后台管理员账号，状态枚举为 `enabled` / `disabled` |
| 角色 | `roles.code`、`roles.status`、`roles.data_scope` | 角色编码参与 JWT `roles` 与超管判断；`data_scope` 控制数据权限 |
| 用户-角色 | `user_roles.user_id`、`user_roles.role_id` | 用户与角色多对多 |
| 菜单 | `menus.type`、`menus.permission`、`menus.visible` | `type` 枚举为 `directory` / `menu` / `button`；权限码仅由按钮承载，目录/菜单是纯显示资源（显示与操作解耦） |
| 角色-菜单 | `role_menus.role_id`、`role_menus.menu_id` | 角色继承的菜单与按钮权限 |
| 用户-菜单 | `user_menus.user_id`、`user_menus.menu_id` | 用户直接授权的菜单与按钮权限 |
| 用户组-角色 | `user_group_roles.group_id`、`user_group_roles.role_id` | 用户组绑定角色，组内成员自动继承（仅启用状态的用户组生效） |

### 权限校验

所有受保护接口通过 `authMiddleware` 注入管理员 JWT Payload，再由 `guard({ permission })` 做权限判断：

```ts
guard({ permission: 'system:user:update' })
```

校验规则：

1. JWT `roles` 包含 `super_admin` 且 `tenantId` 为空（平台侧超管）时直接放行。
2. 非超管通过 `getUserPermissions(userId)` 查询用户有效权限。
3. 有效权限由角色菜单 `role_menus`、用户直接菜单 `user_menus`、用户组绑定角色（`user_group_roles`，仅启用状态的用户组生效）三路合并而成。
4. 仅采集 `menus.permission` 非空字符串作为权限码。
5. 权限缓存按用户维度保存 5 分钟，主存储为 Redis（key `{prefix}perm:{userId}`，保证多实例部署下撤权即时生效），进程内缓存仅作 Redis 不可用时的降级；角色、用户角色、用户菜单、用户组、租户套餐等授权关系变更时清理缓存。

> `guard({ permission })` 的权限码以路由文件实参为准。菜单种子中的按钮权限用于前端按钮展示控制，后端仍以路由守卫为最终准入点。

### 菜单权限与动态菜单

菜单实体字段包括 `parentId`、`title`、`name`、`path`、`component`、`icon`、`type`、`permission`、`query`、`isExternal`、`sort`、`status`、`visible`。

| 接口 | 行为 |
|------|------|
| `GET /api/menus/user` | 当前登录用户菜单树。超管返回全部菜单；普通用户根据角色菜单与用户直接菜单计算，仅从目录/页面节点补齐父级（按钮为纯权限点，不带出所属页面，也不出现在树中） |
| `GET /api/menus` | 管理用菜单树，需登录 |
| `GET /api/menus/flat` | 平铺菜单列表，需 `system:menu:list` |

种子菜单中，IAM 页面分布在「系统管理」与「系统设置」目录下：

| 页面 | 前端路由 | 组件 | 菜单权限码 |
|------|----------|------|------------|
| 用户管理 | `/system/users` | `users/UsersPage` | `system:user:list` |
| 部门管理 | `/system/departments` | `system/departments/DepartmentsPage` | `system:department:list` |
| 岗位管理 | `/system/positions` | `system/positions/PositionsPage` | `system:position:list` |
| 用户组 | `/system/user-groups` | `system/user-groups/UserGroupsPage` | `system:user-groups:list` |
| 菜单管理 | `/system/menus` | `system/menus/MenusPage` | `system:menu:list` |
| 角色管理 | `/system/roles` | `system/roles/RolesPage` | `system:role:list` |
| 租户管理 | `/system/tenants` | `system/tenants/TenantsPage` | `system:tenant:list` |
| 租户套餐 | `/system/tenant-packages` | `system/tenant-packages/TenantPackagesPage` | `system:tenant-package:list` |
| 身份安全 | `/system/identity-security` | `system/identity-security/IdentitySecurityPage` | `system:identity-security:manage` |
| 企业身份源 | `/system/identity-providers` | `system/identity-providers/IdentityProvidersPage` | `system:identity-provider:manage` |
| OAuth 配置 | `/system/oauth-config` | `system/oauth-config/OAuthConfigPage` | `system:oauth-config:view` |
| 在线用户 | `/system/sessions` | `system/sessions/OnlineSessionsPage` | `system:session:list` |
| 登录日志 | `/system/login-logs` | `system/login-logs/LoginLogsPage` | `system:log:login` |

内置角色：

| 角色 | `code` | `dataScope` | 菜单范围 |
|------|--------|-------------|----------|
| 超级管理员 | `super_admin` | `all` | `SEED_MENUS` 全部菜单 |
| 普通用户 | `user` | `all` | `menuIds: [1, 11, 12, 5000, 5001]`（首页、个人中心、公告中心、消息中心及其导出按钮） |
| CMS 编辑 | `cms_editor` | `all` | CMS 目录整棵子树（排除明文导出按钮） |

---

## 数据权限范围（dataScope）

数据权限枚举定义在数据库枚举 `data_scope` 与共享类型 `DataScope` 中：

| 值 | 前端文案 | 过滤含义 |
|----|----------|----------|
| `all` | 全部数据权限 | 不追加数据权限过滤条件 |
| `custom` | 指定部门数据权限 | 按指定部门 ID 过滤；角色使用 `role_dept_scopes`，用户直接设置使用 `user_dept_scopes` |
| `dept_only` | 本部门数据权限 | 仅匹配当前用户所在部门 |
| `dept` | 本部门及以下数据权限 | 匹配当前用户部门及全部子部门 |
| `self` | 仅本人数据权限 | 匹配数据归属人字段为当前用户 ID |

### 角色级数据权限

角色表 `roles.data_scope` 默认值为 `all`。角色创建与更新支持：

- `dataScope`: `all` / `custom` / `dept_only` / `dept` / `self`
- `deptScopeIds`: 指定部门 ID 列表，仅 `custom` 需要配置

角色详情接口返回 `menuIds` 与 `deptScopeIds`，用于角色编辑、菜单权限面板和数据权限面板。

### 用户级数据权限

用户表 `users.user_data_scope` 可为空。为空时表示不单独设置，前端文案为「跟随角色（不单独设置）」。

| 字段 | 来源 | 说明 |
|------|------|------|
| `userDataScope` | `users.user_data_scope` | 用户直接数据权限，`null` 表示未设置 |
| `deptScopeIds` | `user_dept_scopes.dept_id` | 用户直接指定部门 |
| `roleDataScope` | 用户角色中的 `roles.data_scope` | 角色侧最宽松数据权限 |
| `roleDeptScopeIds` | `role_dept_scopes.dept_id` | 角色侧指定部门 |

`GET /api/users/{id}/effective-permissions` 返回最终预览：

- `directMenuIds`：用户直接菜单 ID
- `roleMenuIds`：角色继承菜单 ID
- `effectiveMenuIds`：直接菜单与角色菜单并集
- `userDataScope`、`roleDataScope`、`effectiveDataScope`
- `userDeptScopeIds`、`roleDeptScopeIds`、`effectiveDeptScopeIds`

### 过滤规则

`getDataScopeCondition()` 接收业务表的 `deptColumn` 与 `ownerColumn`：

```ts
await getDataScopeCondition({
  currentUserId,
  deptColumn: users.departmentId,
  ownerColumn: users.id,
});
```

- `super_admin` 或命中 `all`：返回 `undefined`，调用方不追加 `WHERE` 条件。
- `dept`：按当前用户部门及子部门过滤；用户无部门时降级为本人。
- `custom`：合并角色指定部门与用户直接指定部门；未配置指定部门时降级为本人。
- `dept_only`：仅当前用户部门；用户无部门时降级为本人。
- `self`：按 `ownerColumn = currentUserId` 过滤。
- 未传 `deptColumn` 时，部门类范围无法生效并降级到本人逻辑。

> 用户列表 `GET /api/users` 已接入数据权限过滤，使用 `users.departmentId` 作为部门列、`users.id` 作为本人列。

---

## 认证与账号安全

### 登录与令牌

- 双 token 机制：`accessToken` 有效期 2 小时，`refreshToken` 有效期 30 天，通过 `POST /api/auth/refresh` 续签。
- JWT Payload 携带 `userId`、`username`、`roles[]`、`tenantId`、`jti`（会话 ID）；平台超管切换租户视角时额外携带 `viewingTenantId`。
- `POST /api/auth/login` 需要图形验证码（`captchaId` + `captchaCode`，由 `GET /api/auth/captcha` 签发），可附带 `tenantCode`（租户登录）、`deviceId`、`deviceInfo`、`rememberDevice`（配合 MFA 可信设备）。
- 登录结果有两种形态：直接返回 token（`LoginResponse`），或命中 MFA 策略时返回 `challengeId`（`MfaLoginChallenge`），需继续调用 `POST /api/auth/mfa/verify` 完成验证。
- 注册 `POST /api/auth/register` 受系统配置 `allow_registration` 控制（默认关闭），密码需通过密码策略校验。
- 忘记密码 `POST /api/auth/forgot-password` 受系统配置 `forgot_password_enabled` 控制，通过邮件发送重置链接（`password_reset_tokens`，30 分钟有效），再由 `POST /api/auth/reset-password` 完成重置。
- 账号锁定、密码策略、验证码等安全细节见[安全体系](../backend/security.md)。

### MFA 与可信设备

身份安全策略按租户维度存储在 `system_configs`，通过身份安全页面维护（权限 `system:identity-security:manage`）：

| 配置 | 说明 |
|------|------|
| `mfa.enabled` | 是否启用 MFA |
| `mfa.mode` | `off` / `optional`（用户自愿绑定）/ `required`（强制验证） |
| `mfa.rememberDeviceDays` | 可信设备免 MFA 天数，默认 30 |
| `risk.enabled` | 是否启用登录风险策略 |
| `risk.newDeviceAction` | 新设备登录动作：`allow`（放行）/ `challenge`（强制 MFA 挑战） |

- MFA 因子存于 `user_mfa_factors`，当前支持 TOTP：`POST /api/auth/mfa/totp/setup` 生成密钥与二维码 → `POST /api/auth/mfa/totp/verify` 确认绑定；`GET /api/auth/mfa/factors` 查看、`DELETE /api/auth/mfa/factors/{id}` 停用。
- 登录命中 MFA 策略时，挑战上下文暂存 Redis（TTL 5 分钟），`POST /api/auth/mfa/verify` 携带 `challengeId` + 动态码完成登录；`rememberDevice` 为 `true` 时记录可信设备。
- 可信设备存于 `user_trusted_devices`（按 `deviceIdHash` 去重、`trustedUntil` 到期），有效期内同设备登录免 MFA；`GET /api/auth/trusted-devices` 查看、`DELETE /api/auth/trusted-devices/{id}` 移除。
- 登录风险事件记录在 `login_risk_events`，管理员通过 `GET /api/identity-security/risk-events` 查询。

### 个人自助能力

登录用户无需额外权限即可使用：

- `GET /api/auth/me` 返回当前用户信息与权限码列表 `permissions[]`。
- `PUT /api/auth/profile` 修改资料、`PUT /api/auth/password` 修改密码、`POST /api/auth/verify-password` 敏感操作前的密码二次验证。
- 偏好设置 `GET/PUT /api/auth/preferences`、收藏菜单 `GET/PUT /api/auth/favorite-menus`。
- 我的会话：`GET /api/auth/my-sessions`、`DELETE /api/auth/my-sessions/{tokenId}` 退出指定设备、`DELETE /api/auth/my-sessions/others` 退出其他设备。
- 我的日志：`GET /api/auth/my-login-logs`、`GET /api/auth/my-operation-logs`。

### OAuth 账号绑定

第三方社交账号绑定关系存于 `user_oauth_accounts`：`GET /api/oauth/{provider}` 获取授权链接、`POST /api/oauth/{provider}/callback` 回调登录、`POST /api/oauth/bind` 绑定、`DELETE /api/oauth/unbind/{provider}` 解绑、`GET /api/oauth/accounts` 查看当前绑定。各 provider 的服务端凭据由「OAuth 配置」页面维护（`GET /api/oauth-config`、`PUT /api/oauth-config/{provider}`）。流程详解见 [OAuth 登录](../backend/oauth.md)。

### 企业身份源（LDAP / OIDC / SAML）

- 身份源定义存于 `tenant_identity_providers`，外部身份与本地用户的关联存于 `user_identity_accounts`，目录同步记录存于 `identity_provider_sync_logs`。
- 管理接口（权限 `system:identity-provider:manage`）：CRUD、`POST /api/identity-providers/{id}/test` 测试 LDAP/AD 连接、`GET /api/identity-providers/{id}/ldap/users` 搜索目录用户、`POST /api/identity-providers/{id}/sync` 同步目录用户到本地。
- 登录接口（公开，`/api/auth/enterprise/*`）：`GET providers` 发现可用身份源、`GET /{id}` 获取授权链接、`POST callback` OIDC 回调、`POST ldap/login` LDAP 账密登录、`POST saml/acs` SAML 断言回调、`POST saml/exchange` 兑换 SAML 登录票据。

---

## 租户与租户套餐

租户与租户套餐接口全部走 `authMiddleware + platformAdminOnly`，仅平台超管（`roles` 含 `super_admin` 且 `tenantId` 为空）可访问，无独立权限码；种子中的 `system:tenant:*` / `system:tenant-package:*` 按钮码仅用于前端按钮展示控制。

- **租户**（`tenants`）：CRUD、`GET /api/tenants/all` 全量下拉、`GET /api/tenants/{id}/stats` 用量概览。
- **租户套餐**（`tenant_packages` + `tenant_package_menus`）：套餐即菜单白名单（含按钮权限点），通过 `PUT /api/tenant-packages/{id}/menus` 分配；支持批量删除。租户内角色可分配的菜单不能超出所属套餐白名单。
- **租户视角切换**：`POST /api/auth/switch-tenant` 重新签发携带 `viewingTenantId` 的双 token（旧会话移除、新会话注册），`targetTenantId` 为 `null` 时切回平台视角；`GET /api/auth/tenants` 返回可切换的启用租户列表。
- 种子数据内置「租户A / 租户B」示例租户与「基础版 / 标准版」套餐。

租户隔离机制详见[多租户指南](../backend/multi-tenant.md)。

---

## 组织架构

### 部门树

部门表 `departments` 通过 `parent_id` 形成树结构，`parent_id = 0` 表示根节点。主要字段：

| 字段 | 说明 |
|------|------|
| `name`、`code` | 部门名称与编码；`code` 在租户维度唯一 |
| `category` | 部门类别，支持 `group` / `company` / `department` |
| `leader_id` | 部门负责人，引用 `users.id` |
| `phone`、`email` | 联系方式 |
| `sort`、`status` | 排序与状态 |
| `tenant_id` | 多租户隔离字段 |

部门服务保证：

- 上级部门必须存在。
- 上级部门不能选择自身或自身子部门。
- 删除部门前检查是否存在子部门或关联用户。
- 部门树返回 `userCount` 与最多 5 个 `userPreview`。

### 岗位

岗位表 `positions` 保存岗位基础信息，用户通过 `user_positions` 与岗位多对多关联。

| 字段 | 说明 |
|------|------|
| `name`、`code` | 岗位名称与编码；`code` 在租户维度唯一 |
| `sort`、`status` | 排序与状态 |
| `remark` | 备注 |
| `tenant_id` | 多租户隔离字段 |

岗位删除前会检查 `user_positions` 是否存在关联用户；存在关联用户时返回业务错误。岗位列表返回 `userCount` 与最多 5 个 `userPreview`，成员管理接口支持全量覆盖岗位成员。

### 用户组

用户组表 `user_groups` 用于将用户按业务协作关系分组，成员通过 `user_group_members` 维护。

| 字段 | 说明 |
|------|------|
| `name`、`code` | 用户组名称与编码；`code` 在租户维度唯一 |
| `description` | 描述 |
| `owner_id` | 负责人，引用 `users.id` |
| `department_id` | 所属部门，引用 `departments.id` |
| `status` | `enabled` / `disabled` |
| `tenant_id` | 多租户隔离字段 |

用户组支持成员查看、全量设置、批量添加、批量移除。删除用户组时，`user_group_members` 通过外键级联清理。

用户组还可绑定角色（`user_group_roles`，`GET/PUT /api/user-groups/{id}/roles` 全量覆盖）：组内成员自动继承所绑定角色的菜单与按钮权限，仅启用状态的用户组生效，是按团队批量授权的推荐方式。

---

## 用户管理能力

### 用户字段

用户 DTO 与表字段覆盖以下核心信息：

| 字段 | 说明 |
|------|------|
| `username`、`nickname`、`email`、`phone`、`gender`、`avatar` | 基础资料 |
| `departmentId`、`departmentName` | 所属部门 |
| `positionIds`、`positions` | 岗位分配 |
| `roles` | 角色分配 |
| `status` | `enabled` / `disabled` |
| `passwordUpdatedAt` | 密码更新时间 |
| `lastLoginAt` | 最后登录时间 |
| `isLocked` | 登录失败锁定状态 |
| `isOnline` | 在线会话状态 |

用户列表支持 `keyword`、`phone`、`departmentId`、`status`、`startTime`、`endTime` 查询条件。其中 `keyword` 匹配 `username`、`nickname`、`email`，时间参数使用 `YYYY-MM-DD HH:mm:ss` 格式。

### 创建与更新

创建用户字段：

```json
{
  "username": "zhangsan",
  "nickname": "张三",
  "email": "zhangsan@example.com",
  "password": "StrongPassword1",
  "phone": "13800138000",
  "gender": "male",
  "departmentId": 1,
  "positionIds": [1],
  "roleIds": [2],
  "status": "enabled"
}
```

服务层会校验：

- 密码复杂度策略。
- 部门、角色、岗位 ID 是否存在且在可访问租户范围内。
- 同一租户下 `username` 与 `email` 不重复。
- `admin` 用户不允许删除、禁用或参与批量重置密码。

### 批量与导入

| 能力 | 接口 | 说明 |
|------|------|------|
| 批量删除 | `DELETE /api/users/batch` | 请求体 `ids` |
| 批量启停 | `PUT /api/users/batch-status` | 请求体 `ids`、`status` |
| 批量重置密码 | `PUT /api/users/batch-password` | 请求体 `ids`、`password` |
| 下载导入模板 | `GET /api/users/import-template` | 返回 `user_import_template.xlsx` |
| 导入用户 | `POST /api/users/import` | `multipart/form-data` 上传 `file` |

导入模板列：

| 列 | 说明 |
|----|------|
| `用户名*`、`昵称*`、`邮箱*`、`密码*` | 必填 |
| `部门编码` | 匹配 `departments.code` |
| `岗位编码(逗号分隔)` | 匹配 `positions.code` |
| `角色编码(逗号分隔)` | 匹配 `roles.code` |
| `状态(enabled/disabled)` | 留空默认 `enabled` |

导入结果返回 `total`、`success`、`failed`、`errors`，其中 `errors` 包含 `row` 与 `message`。

用户导出走[导出中心](../backend/export-center.md)（实体 `system.users`）：普通导出需 `system:user:export`，明文导出（不脱敏）需额外的 `system:user:export-raw`。

### 账号解锁与在线状态

- `POST /api/users/{id}/unlock` 根据用户 ID 找到 `username`，清理登录锁定状态。
- 用户列表通过在线会话数据计算 `isOnline`。
- 前端用户列表在用户在线且具备 `system:session:forceLogout` 时，可调用 `DELETE /api/sessions/user/{id}` 强制该用户所有会话下线。
- 在线会话独立接口还支持 `GET /api/sessions`、`DELETE /api/sessions/{tokenId}`。

---

## 接口一览

> 以下路径均已包含 `/api` 前缀。除标注「公开」的接口外，所有接口均要求 Bearer Token；权限列为「仅登录」表示该路由未配置具体权限码。

### 认证（/api/auth）

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| `GET` | `/api/auth/captcha` | 获取图形验证码 | 公开 |
| `POST` | `/api/auth/login` | 登录（可能返回 MFA 挑战） | 公开 |
| `POST` | `/api/auth/mfa/verify` | 登录 MFA 验证 | 公开（凭 `challengeId`） |
| `POST` | `/api/auth/register` | 注册（需开启 `allow_registration`） | 公开 |
| `POST` | `/api/auth/refresh` | 刷新令牌 | 公开（凭 `refreshToken`） |
| `POST` | `/api/auth/forgot-password` | 忘记密码（发送重置邮件） | 公开 |
| `POST` | `/api/auth/reset-password` | 凭重置 token 重置密码 | 公开 |
| `POST` | `/api/auth/logout` | 退出登录 | 仅登录 |
| `GET` | `/api/auth/me` | 当前用户信息与权限码 | 仅登录 |
| `PUT` | `/api/auth/profile` | 修改个人资料 | 仅登录 |
| `PUT` | `/api/auth/password` | 修改密码 | 仅登录 |
| `POST` | `/api/auth/verify-password` | 验证当前用户密码 | 仅登录 |
| `GET` / `PUT` | `/api/auth/preferences` | 偏好设置 | 仅登录 |
| `GET` / `PUT` | `/api/auth/favorite-menus` | 收藏菜单 | 仅登录 |
| `GET` | `/api/auth/my-sessions` | 我的会话 | 仅登录 |
| `DELETE` | `/api/auth/my-sessions/others` | 退出其他设备 | 仅登录 |
| `DELETE` | `/api/auth/my-sessions/{tokenId}` | 退出指定设备 | 仅登录 |
| `GET` | `/api/auth/my-login-logs` | 我的登录记录 | 仅登录 |
| `GET` | `/api/auth/my-operation-logs` | 我的操作记录 | 仅登录 |
| `GET` | `/api/auth/mfa/factors` | 我的 MFA 因子 | 仅登录 |
| `POST` | `/api/auth/mfa/totp/setup` | 开始绑定 TOTP | 仅登录 |
| `POST` | `/api/auth/mfa/totp/verify` | 确认绑定 TOTP | 仅登录 |
| `DELETE` | `/api/auth/mfa/factors/{id}` | 停用 MFA 因子 | 仅登录 |
| `GET` | `/api/auth/trusted-devices` | 我的可信设备 | 仅登录 |
| `DELETE` | `/api/auth/trusted-devices/{id}` | 移除可信设备 | 仅登录 |
| `POST` | `/api/auth/switch-tenant` | 切换租户视角 | 平台超管 |
| `GET` | `/api/auth/tenants` | 可切换租户列表 | 平台超管 |

### OAuth 与企业身份源登录

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| `GET` | `/api/oauth/accounts` | 当前用户绑定列表 | 仅登录 |
| `GET` | `/api/oauth/{provider}` | 获取授权链接 | 公开 |
| `POST` | `/api/oauth/{provider}/callback` | OAuth 回调登录 | 公开 |
| `POST` | `/api/oauth/bind` | 绑定 OAuth 账号 | 仅登录 |
| `DELETE` | `/api/oauth/unbind/{provider}` | 解绑 OAuth 账号 | 仅登录 |
| `GET` | `/api/auth/enterprise/providers` | 发现企业身份源 | 公开 |
| `GET` | `/api/auth/enterprise/{id}` | 获取企业身份源授权链接 | 公开 |
| `POST` | `/api/auth/enterprise/callback` | 企业 OIDC 登录回调 | 公开 |
| `POST` | `/api/auth/enterprise/ldap/login` | 企业 LDAP/AD 登录 | 公开 |
| `POST` | `/api/auth/enterprise/saml/acs` | 企业 SAML ACS 回调 | 公开 |
| `POST` | `/api/auth/enterprise/saml/exchange` | 兑换企业 SAML 登录票据 | 公开 |

### 用户

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| `GET` | `/api/users/all` | 全量用户，下拉框使用 | `system:user:list` |
| `GET` | `/api/users` | 用户分页列表 | `system:user:list` |
| `POST` | `/api/users` | 创建用户 | `system:user:create` |
| `DELETE` | `/api/users/batch` | 批量删除用户 | `system:user:delete` |
| `PUT` | `/api/users/batch-password` | 批量重置用户密码 | `system:user:update` |
| `PUT` | `/api/users/batch-status` | 批量修改用户状态 | `system:user:update` |
| `GET` | `/api/users/import-template` | 下载导入模板 | `system:user:import` |
| `POST` | `/api/users/import` | 导入用户 | `system:user:import` |
| `PUT` | `/api/users/{id}/password` | 修改指定用户密码 | `system:user:update` |
| `POST` | `/api/users/{id}/unlock` | 解锁账号 | `system:user:update` |
| `GET` | `/api/users/{id}` | 用户详情 | `system:user:list` |
| `PUT` | `/api/users/{id}` | 更新用户 | `system:user:update` |
| `DELETE` | `/api/users/{id}` | 删除用户 | `system:user:delete` |
| `PUT` | `/api/users/{id}/roles` | 分配用户角色 | `system:user:assign` |
| `GET` | `/api/users/{id}/menus` | 获取用户菜单权限 | `system:user:assign` |
| `PUT` | `/api/users/{id}/menus` | 分配用户直接菜单权限 | `system:user:assign` |
| `GET` | `/api/users/{id}/data-permission` | 获取用户数据权限 | `system:user:assign` |
| `PUT` | `/api/users/{id}/data-permission` | 设置用户数据权限 | `system:user:assign` |
| `GET` | `/api/users/{id}/effective-permissions` | 获取最终有效权限 | `system:user:assign` |

### 角色

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| `GET` | `/api/roles/all` | 全量角色，下拉框使用 | `system:role:list` |
| `GET` | `/api/roles` | 角色分页列表 | `system:role:list` |
| `GET` | `/api/roles/{id}` | 角色详情，含 `menuIds`、`deptScopeIds` | `system:role:list` |
| `POST` | `/api/roles` | 创建角色 | `system:role:create` |
| `PUT` | `/api/roles/{id}` | 更新角色 | `system:role:update` |
| `DELETE` | `/api/roles/{id}` | 删除角色 | `system:role:delete` |
| `PUT` | `/api/roles/{id}/menus` | 分配角色菜单 | `system:role:assign` |
| `GET` | `/api/roles/{id}/users` | 获取角色关联用户 | `system:role:list` |
| `PUT` | `/api/roles/{id}/users` | 分配角色用户 | `system:role:assign` |

### 菜单

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| `GET` | `/api/menus/user` | 当前用户可见菜单树 | 仅登录 |
| `GET` | `/api/menus` | 管理用全量菜单树 | 仅登录 |
| `GET` | `/api/menus/flat` | 平铺菜单列表 | `system:menu:list` |
| `GET` | `/api/menus/{id}` | 菜单详情 | `system:menu:list` |
| `POST` | `/api/menus` | 创建菜单 | `system:menu:create` |
| `PUT` | `/api/menus/{id}` | 更新菜单 | `system:menu:update` |
| `DELETE` | `/api/menus/{id}` | 删除菜单及子菜单 | `system:menu:delete` |

### 部门

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| `GET` | `/api/departments` | 部门树 | `system:department:list` |
| `GET` | `/api/departments/flat` | 部门扁平列表 | `system:department:list` |
| `GET` | `/api/departments/{id}` | 部门详情 | `system:department:list` |
| `POST` | `/api/departments` | 创建部门 | `system:department:create` |
| `PUT` | `/api/departments/{id}` | 更新部门 | `system:department:update` |
| `DELETE` | `/api/departments/{id}` | 删除部门 | `system:department:delete` |

### 岗位

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| `GET` | `/api/positions/all` | 全量岗位，下拉框使用 | `system:position:list` |
| `GET` | `/api/positions` | 岗位分页列表 | `system:position:list` |
| `GET` | `/api/positions/{id}` | 岗位详情 | `system:position:list` |
| `POST` | `/api/positions` | 创建岗位 | `system:position:create` |
| `PUT` | `/api/positions/{id}` | 更新岗位 | `system:position:update` |
| `DELETE` | `/api/positions/batch` | 批量删除岗位 | `system:position:delete` |
| `DELETE` | `/api/positions/{id}` | 删除岗位 | `system:position:delete` |
| `GET` | `/api/positions/{id}/members` | 获取岗位成员 | `system:position:list` |
| `PUT` | `/api/positions/{id}/members` | 设置岗位成员 | `system:position:update` |

### 用户组

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| `GET` | `/api/user-groups/all` | 全量用户组，下拉框使用 | `system:user-groups:list` |
| `GET` | `/api/user-groups` | 用户组分页列表 | `system:user-groups:list` |
| `GET` | `/api/user-groups/{id}` | 用户组详情 | `system:user-groups:list` |
| `POST` | `/api/user-groups` | 创建用户组 | `system:user-groups:create` |
| `PUT` | `/api/user-groups/{id}` | 更新用户组 | `system:user-groups:update` |
| `DELETE` | `/api/user-groups/batch` | 批量删除用户组 | `system:user-groups:delete` |
| `DELETE` | `/api/user-groups/{id}` | 删除用户组 | `system:user-groups:delete` |
| `GET` | `/api/user-groups/{id}/members` | 获取用户组成员 | `system:user-groups:list` |
| `PUT` | `/api/user-groups/{id}/members` | 设置用户组成员 | `system:user-groups:assign` |
| `POST` | `/api/user-groups/{id}/members` | 添加用户组成员 | `system:user-groups:assign` |
| `DELETE` | `/api/user-groups/{id}/members` | 移除用户组成员 | `system:user-groups:assign` |
| `GET` | `/api/user-groups/{id}/roles` | 获取用户组绑定的角色 | `system:user-groups:list` |
| `PUT` | `/api/user-groups/{id}/roles` | 设置用户组角色（全量覆盖，组内成员自动继承） | `system:user-groups:assign` |

### 租户与租户套餐

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| `GET` | `/api/tenants` | 租户分页列表 | 平台超管 |
| `GET` | `/api/tenants/all` | 全部租户，下拉框使用 | 平台超管 |
| `GET` | `/api/tenants/{id}` | 租户详情 | 平台超管 |
| `POST` | `/api/tenants` | 创建租户 | 平台超管 |
| `PUT` | `/api/tenants/{id}` | 更新租户 | 平台超管 |
| `DELETE` | `/api/tenants/{id}` | 删除租户 | 平台超管 |
| `GET` | `/api/tenants/{id}/stats` | 租户用量概览 | 平台超管 |
| `GET` | `/api/tenant-packages` | 租户套餐分页列表 | 平台超管 |
| `GET` | `/api/tenant-packages/all` | 全部租户套餐 | 平台超管 |
| `GET` | `/api/tenant-packages/{id}` | 租户套餐详情 | 平台超管 |
| `POST` | `/api/tenant-packages` | 创建租户套餐 | 平台超管 |
| `PUT` | `/api/tenant-packages/{id}` | 更新租户套餐 | 平台超管 |
| `PUT` | `/api/tenant-packages/{id}/menus` | 分配套餐菜单白名单 | 平台超管 |
| `DELETE` | `/api/tenant-packages/batch` | 批量删除租户套餐 | 平台超管 |
| `DELETE` | `/api/tenant-packages/{id}` | 删除租户套餐 | 平台超管 |

### 身份安全与身份源

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| `GET` | `/api/identity-security/policy` | 获取身份安全策略 | `system:identity-security:manage` |
| `PUT` | `/api/identity-security/policy` | 更新身份安全策略 | `system:identity-security:manage` |
| `GET` | `/api/identity-security/risk-events` | 登录风险事件 | `system:identity-security:manage` |
| `GET` | `/api/identity-providers` | 企业身份源列表 | `system:identity-provider:manage` |
| `GET` | `/api/identity-providers/{id}` | 企业身份源详情 | `system:identity-provider:manage` |
| `POST` | `/api/identity-providers` | 创建企业身份源 | `system:identity-provider:manage` |
| `PUT` | `/api/identity-providers/{id}` | 更新企业身份源 | `system:identity-provider:manage` |
| `DELETE` | `/api/identity-providers/{id}` | 删除企业身份源 | `system:identity-provider:manage` |
| `POST` | `/api/identity-providers/{id}/test` | 测试 LDAP/AD 身份源连接 | `system:identity-provider:manage` |
| `GET` | `/api/identity-providers/{id}/ldap/users` | 搜索 LDAP/AD 目录用户 | `system:identity-provider:manage` |
| `POST` | `/api/identity-providers/{id}/sync` | 同步 LDAP/AD 目录用户 | `system:identity-provider:manage` |
| `GET` | `/api/oauth-config` | 获取所有 OAuth 配置 | `system:oauth-config:view` |
| `PUT` | `/api/oauth-config/{provider}` | 更新指定 provider 的 OAuth 配置 | `system:oauth-config:update` |

### 登录日志

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| `GET` | `/api/login-logs` | 登录日志分页查询 | `system:log:login` |
| `GET` | `/api/login-logs/stats` | 登录日志统计 | `system:log:login` |
| `DELETE` | `/api/login-logs/clean` | 清除登录日志 | `system:log:login` |

### 在线会话联动

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| `GET` | `/api/sessions` | 在线会话列表 | `system:session:list` |
| `DELETE` | `/api/sessions/{tokenId}` | 强制指定会话下线 | `system:session:forceLogout` |
| `DELETE` | `/api/sessions/user/{id}` | 强制指定用户所有会话下线 | `system:session:forceLogout` |

---

## 前端页面

| 页面 | 路由 | 主要交互 |
|------|------|----------|
| 用户管理 | `/system/users` | 部门主从布局、用户列表、创建/编辑、头像、角色/岗位/部门分配、批量删除、批量启停、批量重置密码、导入导出、解锁、强制下线入口 |
| 用户菜单权限弹窗 | 用户管理弹窗 | 读取 `/api/menus` 与 `/api/users/{id}/effective-permissions`，展示角色继承、用户直接授权与最终菜单权限 |
| 用户数据权限弹窗 | 用户管理弹窗 | 读取和保存 `/api/users/{id}/data-permission`，支持用户级 `dataScope` 与指定部门 |
| 角色管理 | `/system/roles` | 角色列表、创建/编辑、状态切换、菜单权限分配、数据权限设置、关联用户分配、导出 |
| 菜单管理 | `/system/menus` | 菜单树维护、目录/菜单/按钮类型、状态切换、可见性、权限码 |
| 部门管理 | `/system/departments` | 部门树、负责人、部门成员预览、创建/编辑/删除、状态切换、导出 |
| 岗位管理 | `/system/positions` | 岗位列表、成员管理、批量删除、状态切换、导出 |
| 用户组管理 | `/system/user-groups` | 用户组列表、负责人/部门、成员管理、角色绑定、批量删除、状态切换 |
| 租户管理 | `/system/tenants` | 租户列表、创建/编辑/删除、用量概览（平台超管专属） |
| 租户套餐 | `/system/tenant-packages` | 套餐列表、菜单白名单分配、批量删除（平台超管专属） |
| 身份安全 | `/system/identity-security` | MFA 策略与登录风险策略配置、风险事件列表 |
| 企业身份源 | `/system/identity-providers` | LDAP/OIDC/SAML 身份源维护、连接测试、目录搜索与同步 |
| OAuth 配置 | `/system/oauth-config` | 各 OAuth provider 服务端配置查看与保存 |
| 登录日志 | `/system/login-logs` | 登录日志查询、统计、清理、导出 |

在线用户页面（`/system/sessions`）属系统运维范畴，见[系统运维](../ops/index.md)。

### 认证状态与权限刷新

- 认证状态由 `AuthProvider`（`src/providers/AuthProvider.tsx`）集中管理：登录/注册/MFA 验证成功后写入双 token 并激活会话，当前用户与权限码通过 TanStack Query 拉取 `GET /api/auth/me`（返回用户信息 + `permissions[]`），对外暴露 `anonymous` / `checking` / `authenticated` / `unavailable` 四种状态。
- 登录请求自动附带图形验证码、设备指纹（`deviceId` + 屏幕/GPU/CPU 等 `deviceInfo`）与 `rememberDevice`，命中 MFA 策略时进入 `challengeId` 验证流程。
- 多标签页通过 `storage` 事件同步登录/登出；请求层触发认证失效事件时自动清理身份缓存并回到匿名态。
- 菜单加载走 TanStack Query（`useCurrentUserMenuTree` → `GET /api/menus/user`）；角色分配菜单、用户授权等权限变更操作会调用 `invalidateCurrentUserAccess` 同时失效用户菜单树与当前会话缓存，当前用户的可见菜单与按钮即时刷新，无需重新登录。
- 按钮展示通过 `usePermission()` 读取 `AuthProvider` 下发的权限码控制，例如 `system:user:create` 控制用户创建按钮，`system:role:assign` 控制角色菜单权限与关联用户操作。后端路由守卫仍是最终权限校验来源。

---

## 相关文档

- [安全体系](../backend/security.md)：账号锁定、密码策略、验证码、CSRF、限流等安全能力。
- [OAuth 登录](../backend/oauth.md)：第三方社交登录接入与回调流程详解。
- [请求上下文与当前用户工具](../backend/request-context.md)：`currentUser()`、JWT Payload 与管理员/会员上下文隔离。
- [多租户指南](../backend/multi-tenant.md)：`tenant_id` 隔离与租户视角。
- [API 约定](../backend/api-conventions.md)：统一响应结构、分页、OpenAPI 与校验规范。
- [操作日志变更记录](../backend/audit-log-changes.md)：配置了 `audit` 的 IAM 变更接口会写入操作日志。
- [功能模块](../product/features.md)：产品能力全景。
