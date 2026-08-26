# OAuth 第三方登录

本文只描述管理后台第三方登录与账号绑定，不描述开放平台 OAuth2 授权服务器。

## 支持的 Provider

`packages/shared/src/identity` 中定义的管理端第三方登录 provider 为：

- `github`
- `dingtalk`
- `wechat_work`
- `feishu`

服务端适配器位于 `packages/server/src/lib/oauth/`，统一由 `OAuthService` 调用。

## 数据表

| 表 | 用途 |
| --- | --- |
| `oauth_configs` | provider 配置：`provider`、`client_id`、`client_secret`、`agent_id`、`corp_id`、`enabled` |
| `user_oauth_accounts` | 用户第三方账号绑定：`user_id`、`provider`、`open_id`、`union_id`、昵称、头像、token 与原始信息 |

`oauth_configs.client_secret` 按明文落库；接口响应通过 DTO 映射为 `******`。账号绑定表中的第三方 access token、refresh token 与原始响应也按字段保存。

## 登录与绑定接口

认证路由挂载在 `/api/auth/oauth`：

| 方法 | 路径 | 鉴权 | 说明 |
| --- | --- | --- | --- |
| `GET` | `/{provider}` | 无 | 生成 provider 授权地址并返回 `state` |
| `POST` | `/{provider}/callback` | 无 | 使用授权码换取第三方用户信息，匹配已绑定账号并签发管理端 token |
| `GET` | `/accounts` | 管理员 | 查询当前用户已绑定账号 |
| `POST` | `/bind` | 管理员 | 绑定第三方账号 |
| `DELETE` | `/unbind/{provider}` | 管理员 | 解绑第三方账号 |

回调请求体使用授权码 `code`。服务端会生成并返回 `state`，回调处理不读取或校验 `state`。

## 配置接口

配置路由挂载在 `/api/oauth-config`：

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| `GET` | `/` | `system:oauth-config:view` | 查询所有 provider 配置 |
| `PUT` | `/{provider}` | `system:oauth-config:update` | 更新指定 provider 配置，记录操作日志 |

回调基地址由环境变量 `OAUTH_CALLBACK_BASE_URL` 决定，默认 `http://localhost:5373`。provider 回调地址格式为：

```text
${OAUTH_CALLBACK_BASE_URL}/oauth/callback/{provider}
```

## 登录签发

第三方回调命中已绑定账号后，服务端按管理端登录流程签发 access token 与 refresh token，并返回用户信息。签发后同样进入 Redis 会话、JWT 黑名单、租户状态和登录日志体系。

## Provider 字段

| Provider | 关键配置 |
| --- | --- |
| GitHub | `clientId`、`clientSecret` |
| 钉钉 | `clientId`、`clientSecret`、可选 `corpId` |
| 企业微信 | `clientId`、`clientSecret`、`agentId`、`corpId` |
| 飞书 | `clientId`、`clientSecret` |

## 安全边界

- 未启用或未配置完整的 provider 不能发起授权。
- 第三方账号必须先绑定到本地管理员账号，回调登录才会签发管理端 token。
- 解绑操作按 provider 删除当前用户绑定关系。
- 第三方登录不替代本地权限系统；登录成功后仍由角色、菜单、租户和 License 控制访问范围。
