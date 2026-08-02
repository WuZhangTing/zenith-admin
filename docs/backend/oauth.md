# OAuth

系统同时扮演两个 OAuth 角色：

1. **OAuth 客户端** — 管理员通过 GitHub / 钉钉 / 企业微信第三方账号登录后台
2. **OAuth2 授权服务器** — 开放平台向第三方应用签发令牌，授权访问本系统 API

> 企业级 SSO（SAML / OIDC 身份提供方）是独立模块，挂载在 `/api/auth/enterprise` 与 `/api/identity-providers`，不在本文范围。

## 第三方登录（OAuth 客户端）

代码位置：`src/lib/oauth/`（各提供方实现）、`src/routes/identity/oauth.ts`（登录流程）、`src/routes/identity/oauth-config.ts`（配置管理）、`src/services/identity/oauth.service.ts`。

### 支持的提供方

| provider | 说明 |
| --- | --- |
| `github` | GitHub OAuth App |
| `dingtalk` | 钉钉扫码登录 |
| `wechat_work` | 企业微信扫码登录（需 `agentId` / `corpId`） |

### 配置

提供方配置存 `oauth_configs` 表（`clientId`、`clientSecret`、`agentId`、`corpId`、`enabled`），管理端页面 `/system/oauth-config`（权限 `system:oauth-config:view/update`）维护：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/oauth-config` | 全部提供方配置 |
| PUT | `/api/oauth-config/{provider}` | 更新单个提供方 |

::: warning 明文存储
`clientSecret` 当前为明文存储（无加密），请确保数据库访问受控。
:::

回调地址为 `{OAUTH_CALLBACK_BASE_URL}/oauth/callback/{provider}`，`OAUTH_CALLBACK_BASE_URL` 默认 `http://localhost:5373`（前端开发服务器），生产部署需在环境变量中改为实际前端地址，并在第三方平台登记一致的回调 URL。

### 登录流程

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/auth/oauth/{provider}` | 获取授权跳转 URL（含 `randomBytes(16)` 的 state 防 CSRF） |
| POST | `/api/auth/oauth/{provider}/callback` | 前端回调页带 code 换登录态 |
| GET | `/api/auth/oauth/accounts` | 当前用户已绑定的第三方账号 |
| POST | `/api/auth/oauth/bind` | 登录态下绑定第三方账号 |
| DELETE | `/api/auth/oauth/unbind/{provider}` | 解绑 |

回调处理逻辑（`oauth.service.ts`）：

1. code 换取第三方用户信息
2. `user_oauth_accounts` 表已有绑定 → 直接登录
3. 无绑定但第三方邮箱与系统用户邮箱一致 → **自动绑定**并登录
4. 都不满足 → 返回 `needBind: true` + `oauthInfo`，前端引导用户登录后手动绑定（不自动创建账号）

绑定关系存 `user_oauth_accounts`（含 `unionId`、`accessToken`、`refreshToken`、`expiresAt`、原始 profile `raw`）。

## OAuth2 授权服务器（开放平台）

代码位置：`src/routes/open-platform/oauth2-auth.ts`（标准端点）、`oauth2-clients.ts`（应用管理）、`src/services/open-platform/oauth2-auth.service.ts`。管理页面 `/system/oauth2-apps`（开放平台菜单组，权限 `system:oauth2-apps:view/manage`）。

### 授权模式

遵循 OAuth 2.1 风格收敛：

- **仅支持 `authorization_code`**（不支持 implicit）
- PKCE 仅接受 **S256**
- 刷新令牌需同时满足：授权 scope 含 `offline_access`，且客户端 `grantTypes` 含 `refresh_token`

### 令牌与有效期

常量定义在 `@zenith/shared/open-platform` 的 `OAUTH2_TOKEN_EXPIRY`：

| 令牌 | 前缀 | 有效期 |
| --- | --- | --- |
| 授权码 | — | 10 分钟，**单次使用** |
| Access Token | `oa_` | 2 小时 |
| Refresh Token | `or_` | 30 天 |

Refresh token 采用**旋转 + 家族重放检测**（`oauth2_token_families` 表）：每次刷新旧 token 立即作废；已作废 token 再次使用视为泄露，整个 token 家族标记 `compromised` 并全部吊销。

### 客户端凭证安全

- `client_secret` 存 SHA-256 哈希用于验证，同时存 AES-256-GCM 密文（供开放网关 HMAC 验签场景复用）
- 支持密钥轮换：旧密钥（`previousSecret`）在 `OPEN_SECRET_ROTATION_GRACE_HOURS`（默认 24h）宽限期内仍可用

### 标准端点

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/oauth2/authorize/info` | 授权页信息（应用名、scope 说明） |
| POST | `/api/oauth2/authorize` | 用户确认授权，签发授权码 |
| POST | `/api/oauth2/token` | 授权码 / 刷新令牌换取 token |
| POST | `/api/oauth2/token/revoke` | 吊销令牌 |
| POST | `/api/oauth2/token/introspect` | 令牌自省（RFC 7662） |
| GET | `/api/oauth2/userinfo` | 用户信息（按 scope 裁剪字段） |

### 应用管理

`oauth2_clients` 表除基础字段外还包含开放平台治理字段：`ratePlanId`（限流套餐）、`signEnabled`（HMAC 验签）、`ipAllowlist`、`environment`（`production` / `sandbox`）、`reviewStatus`（`draft` / `pending` / `approved` / `rejected`）、`ownerId` 等。

管理端点（`/api/oauth2/clients`）：CRUD + `GET /{id}/grants`（授权用户列表）、`POST /{id}/review`（审核）、`GET /options`（下拉项）。

`OPEN_GATEWAY_REQUIRE_APPROVAL=true` 时，仅 `reviewStatus = approved` 的应用可通过开放网关调用 API。

## 相关环境变量

```dotenv
OAUTH_CALLBACK_BASE_URL=http://localhost:5373   # 第三方登录回调的前端基址
OPEN_SECRET_ROTATION_GRACE_HOURS=24             # 客户端密钥轮换宽限期
OPEN_GATEWAY_REQUIRE_APPROVAL=true              # 开放网关仅放行审核通过的应用
```
