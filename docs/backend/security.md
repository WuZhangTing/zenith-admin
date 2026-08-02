# 安全防护

本文介绍后端的整体安全设计：认证体系、请求防护中间件、IP 访问控制、接口级限流与登录安全策略。

代码位置速查：

| 模块 | 位置 |
| --- | --- |
| 中间件栈装配 | `packages/server/src/app.ts` |
| JWT 签发 / 校验 | `packages/server/src/lib/jwt.ts` |
| 认证中间件 | `packages/server/src/middleware/auth.ts` |
| 客户端 IP 解析 | `packages/server/src/lib/request-helpers.ts` |
| IP 访问控制 | `packages/server/src/middleware/ip-access.ts` |
| 接口级限流 | `packages/server/src/middleware/rate-limit.ts` |
| 密码策略 | `packages/server/src/lib/password-policy.ts` |
| 验证码 | `packages/server/src/lib/captcha.ts` |
| MFA / 登录风险策略 | `packages/server/src/services/identity/identity-security.service.ts` |

## 认证体系

### 双 Token

- **Access Token**：有效期 **2 小时**，放在 `Authorization: Bearer <token>` 头
- **Refresh Token**：有效期 **30 天**，用于 `POST /api/auth/refresh` 换取新 Access Token

两者均为 HS256 JWT（基于 `hono/jwt`），密钥来自 `JWT_SECRET` 环境变量。payload 关键字段：

```ts
interface JwtPayload {
  userId: number;
  username: string;
  roles: string[];      // 角色编码列表
  tenantId?: number | null;
  jti: string;          // token 唯一 ID，用于会话管理与黑名单
}
```

### authMiddleware 校验流程

`authMiddleware` 对每个受保护接口执行：

1. 提取 Bearer token：
   - 普通 JWT → 走 JWT 校验
   - **个人 API Token**（`zat_` 前缀）→ 按 SHA-256 哈希查 `user_api_tokens` 表，校验有效期与用户/租户/角色状态，`lastUsedAt` 以 5 分钟节流更新
2. **拒绝会员 token**：payload 带 `type: 'member'` 的前台会员 token 一律 401（双用户体系彻底隔离，反向由 `memberAuthMiddleware` 拒绝管理员 token）
3. 并行执行黑名单检查与会话续期（`touchSession`）：
   - `jti` 在 Redis 黑名单（`zenith:blacklist:{tokenId}`，TTL 2h）中 → 401，实现强制下线
   - 会话 key `zenith:session:{tokenId}`（TTL 8h）每次请求自动续期；会话丢失时懒重注册
   - **Redis 故障时放行**（fail-open），认证不依赖 Redis 可用性
4. 校验通过后 `c.set('user', payload)`，业务代码通过 `currentUser()`（`src/lib/context.ts`）零参取值

## 客户端 IP 与受信代理

`getClientIp()`（`src/lib/request-helpers.ts`）是全系统统一的客户端 IP 来源（限流、审计、登录日志、IP 访问控制均使用）。

为防止伪造 `X-Forwarded-For`，**只有当 TCP 对端地址位于 `TRUSTED_PROXY_CIDRS` 声明的受信代理网段内**，才信任代理头：

- 受信时：从 `X-Forwarded-For` **从右往左**取第一个不属于受信网段的 IP（即真实客户端）；退而信任 `X-Real-IP`
- 不受信（默认，`TRUSTED_PROXY_CIDRS` 为空）：直接使用 TCP 连接对端地址（`getConnInfo`）

```dotenv
# 反向代理部署时必须配置，否则拿到的是代理服务器 IP
TRUSTED_PROXY_CIDRS=10.0.0.0/8,172.16.0.0/12
```

## 请求防护中间件栈

`createApp()`（`src/app.ts`）按以下顺序装配全局中间件：

| 顺序 | 中间件 | 说明 |
| --- | --- | --- |
| 1 | `requestId` | 生成请求 ID，贯穿日志与审计 |
| 2 | `contextStorage` | AsyncLocalStorage 请求上下文 |
| 3 | `requestTrace` | 请求级 trace 采集 |
| 4 | `secureHeaders` | 安全响应头（CORP `cross-origin`，COOP / X-Frame-Options 关闭以兼容嵌入场景） |
| 5 | `compress` | 响应压缩（排除流式接口前缀） |
| 6 | `cors` | 跨域配置 |
| 7 | `csrf` | Origin 校验（排除 `/api/auth/enterprise/saml/acs`，SAML 回调由 IdP POST） |
| 8 | `honoLogger` + `httpLoggerMiddleware` | 访问日志与 [HTTP 流量日志](./http-logging.md) |
| 9 | `bodyLimit` | 请求体上限（可选） |
| 10 | `timeout` | 请求超时（可选，仅 `/api/*`） |
| 11 | `ipAccessMiddleware` | IP 黑白名单（仅 `/api/*`） |
| 12 | 命名限流 + `pathBoundRateLimit` | 接口级限流 |
| 13 | `maintenanceMiddleware` | [维护模式](./maintenance-mode.md)（仅 `/api/*`） |

### CSRF 防护

`hono/csrf` 校验 `Origin` 请求头：

- 浏览器跨站表单提交会带上非白名单 Origin → 403
- **无 `Origin` 头的请求直接放行**（curl / Postman / 服务端调用不受影响）
- 白名单通过 `ALLOWED_ORIGINS`（逗号分隔）配置，留空 = 开发模式不限制

### 请求体大小限制

```dotenv
REQUEST_BODY_LIMIT=0   # 字节数，0 = 不限制
```

大于 0 时全局启用 `bodyLimit`，超限返回：

```json
{ "code": 413, "message": "请求体过大", "data": null }
```

### 请求超时

```dotenv
REQUEST_TIMEOUT_MS=0   # 毫秒，0 = 不启用
```

启用后仅对 `/api/*` 生效，超时返回 `{ "code": 408, ... }`。通过 `hono/combine` 的 `except()` 自动排除不适合超时控制的长连接 / 流式 / 大文件接口：

- 前缀排除：`/api/ws`、`/api/files`、`/api/db-backups`、`/api/db-admin`、`/api/log-files`、`/api/monitor/stream`、`/api/ai/conversations`、`/api/ai/arena`、`/api/ai/generations`
- 后缀排除：所有以 `/export` 结尾的导出接口

## IP 访问控制

`ipAccessMiddleware`（`src/middleware/ip-access.ts`）基于数据库规则对 `/api/*` 做黑白名单过滤：

- **黑名单优先**：命中黑名单直接 403；存在启用的白名单规则时，未命中白名单的 IP 也拒绝
- 规则带 30 秒内存缓存，管理端变更后调用 `invalidateIpAccessCache()` 即时生效
- 拦截记录写入 `ip_access_logs` 表，管理端通过 `GET /api/ip-access-logs` 分页查询
- **免检路径**：登录 / 验证码 / 注册 / 刷新 / 忘记密码 / 重置密码，以及 `/api/oauth/`、`/api/auth/oauth/` 前缀（避免把管理员自己锁在门外）

## 接口级限流

基于 `hono-rate-limiter` + Redis 存储（`src/middleware/rate-limit.ts`），多进程共享计数。

### 挂载方式

- 关键认证接口挂载命名限流器：`/api/auth/login` → `auth` 规则、`/api/auth/captcha` → `captcha` 规则、`register` / `forgot-password` / `reset-password` → `sensitive` 规则
- 其余接口由 `pathBoundRateLimit` 按规则的 `pathPatterns` 动态匹配（如 `/api/report/public/*`）

### 内置规则

种子数据内置 12 条规则（`rate_limit_rules` 表，管理端 `/api/rate-limit` 可调）：

| 规则名 | 窗口 / 上限 | 维度 | 默认 |
| --- | --- | --- | --- |
| `auth` | 3 分钟 / 20 次 | IP | **启用** |
| `captcha` | 60s / 30 次 | IP | 启用 |
| `sensitive` | 60 分钟 / 5 次 | IP | 启用 |
| `analytics-ingest` | 60s / 120 次 | IP | 启用 |
| `error-report` | 60s / 60 次 | IP | 启用 |
| `report_public_share` | 60s / 120 次 | IP+路径 | 启用 |
| `chat_send` | 60s / 60 次 | 用户 | 启用 |
| `chatbi_ask` | 60s / 10 次 | 用户 | 启用 |
| `report_chatbi_write` | 60s / 30 次 | 用户 | 启用 |
| `report_fill_write` | 60s / 30 次 | 用户 | 启用 |
| `ai_chat_send` | 60s / 15 次 | 用户 | 启用 |
| `ai_share_view` | 60s / 60 次 | IP | 启用 |

维度（`keyType`）支持 `ip` / `user` / `ip_path`。预定义规则名受保护不可删除，可停用或调整窗口与阈值。

超限返回 **429** 并带 `Retry-After` 响应头：

```json
{ "code": 429, "message": "请求过于频繁，请稍后再试", "data": null }
```

### 命中统计

限流统计写入 Redis（`zenith:rlstats:*`）：命中 / 拦截计数、最近拦截记录（zset 保留 200 条）、按小时分布（hash），统计数据保留 7 天，管理端限流页面可视化展示。

## 登录安全

### 验证码

`captcha_enabled` 系统配置开启后，登录需携带验证码：

- SVG 数学题验证码，内存存储，**5 分钟有效、一次性使用**
- 复杂度由 `captcha_complexity` 配置：`low` / `medium`（默认）/ `high`

### 账号锁定

连续登录失败达到 `login_max_attempts`（默认 10 次）后锁定 `login_lock_duration_minutes`（默认 30 分钟）：

- 计数器与锁定标记存 Redis：`zenith:login_attempt:{username}`、`zenith:login_lock:{username}`
- 锁定期间登录返回 **HTTP 423 (Locked)**
- 管理员可通过 `POST /api/users/{id}/unlock` 手动解锁
- 登录支持用户名或手机号

### 密码策略

由系统配置驱动（`src/lib/password-policy.ts`），在注册、改密、重置密码时统一校验：

| 配置项 | 默认 | 说明 |
| --- | --- | --- |
| `password_min_length` | 6 | 最小长度 |
| `password_require_uppercase` | false | 必须包含大写字母 |
| `password_require_special_char` | false | 必须包含特殊字符 |
| `password_expiry_enabled` | false | 密码过期强制重置 |
| `password_expiry_days` | 90 | 过期天数 |

前端可通过公开接口 `GET /api/system-configs/password-policy` 获取策略用于表单提示。

### MFA 与登录风险

身份安全策略模块（`/api/identity-security`，权限 `system:identity-security:manage`）提供：

- **MFA 多因素认证**：TOTP 动态口令（含恢复码），`mfa_mode` 支持 `off` / `optional` / `required`；通过 `mfa_remember_device_days` 支持可信设备免验证。登录命中 MFA 时返回 challenge（Redis 存储，5 分钟有效），前端调用 `POST /api/auth/mfa/verify` 完成第二因素验证
- **登录风险策略**：`login_risk_enabled` 开启后按设备指纹识别新设备，`login_risk_new_device_action` 决定放行（`allow`）或强制 MFA 挑战（`challenge`）
- 风险事件通过 `GET /api/identity-security/risk-events` 审计

相关自助接口：`GET /api/auth/mfa/factors`、`POST /api/auth/mfa/totp/setup`、`POST /api/auth/mfa/totp/verify`、`GET/DELETE /api/auth/trusted-devices`。

## 相关环境变量

```dotenv
JWT_SECRET=change-me                 # JWT 签名密钥（生产必改）
TRUSTED_PROXY_CIDRS=                 # 受信反向代理网段，逗号分隔 CIDR
ALLOWED_ORIGINS=                     # CSRF / CORS 来源白名单，留空 = 开发模式不限制
REQUEST_BODY_LIMIT=0                 # 请求体上限（字节），0 = 不限制
REQUEST_TIMEOUT_MS=0                 # 请求超时（毫秒），0 = 不启用
REDIS_URL=redis://127.0.0.1:6379    # 会话 / 黑名单 / 限流存储
REDIS_KEY_PREFIX=zenith:             # Redis key 命名空间
```

## 相关文档

- [幂等控制](./idempotency.md) — 防重复提交
- [HTTP 流量日志](./http-logging.md) — 请求审计与排障
- [审计日志](./audit-log-changes.md) — 操作日志与数据快照
- [OAuth 登录](./oauth.md) — 第三方登录与 OAuth2 授权服务
