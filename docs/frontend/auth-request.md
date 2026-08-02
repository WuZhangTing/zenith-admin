# 认证与请求

这一页说明前端如何维护登录态，以及请求层如何与后端接口协作。

## 登录态管理

认证状态集中在 `packages/web/src/providers/AuthProvider.tsx`，由 `main.tsx` 挂载在 `QueryClientProvider` 之内、`App` 之外。页面通过 `useAuth()`（`hooks/useAuth.ts`）读取 context，`usePermission()` 读取由同一 Provider 注入的权限码。

- **会话数据也是服务端状态**：当前用户与权限来自 TanStack Query 查询 `['auth', 'me']`（`hooks/queries/auth.ts` 的 `authSessionQueryOptions`，请求 `GET /api/auth/me`，`staleTime` 5 分钟、`refetchOnWindowFocus: true`）
- `useAuth()` 暴露：`user`、`permissions`、`status`、`login`、`verifyMfaLogin`、`register`、`logout`、`refresh`、`updateUser`
- **状态机**：`anonymous`（本地无 token）→ `checking`（有 token，正在确认会话）→ `authenticated`；会话请求失败但**并非** 401 时进入 `unavailable`（网络故障不清凭证，`App.tsx` 渲染重试页）

Token 存储在 `localStorage`，key 来自 `@zenith/shared/core`：

| 常量 | Key | 说明 |
|------|-----|------|
| `TOKEN_KEY` | `zenith_token` | Access Token |
| `REFRESH_TOKEN_KEY` | `zenith_refresh_token` | Refresh Token，用于自动续期 |
| `PREFERENCES_KEY` | `zenith_preferences` | 用户偏好设置（主题、布局等）|
| `TABS_STORAGE_KEY` | `zenith_tabs` | 多标签页状态 |

此外 `AuthProvider` 维护 `zenith_device_id`（随机 UUID，登录时随 `deviceInfo` 一并上报，用于可信设备识别）。

### 关键行为

- **登录 / MFA 验证 / 注册成功**：先清空身份相关查询缓存（防跨账号数据泄漏，保留 `auth-public` 公开配置查询），写入双 token，再拉取 `/api/auth/me`
- **退出登录**：静默请求 `POST /api/auth/logout`（`skipAuth`，不等待结果），清理 token、偏好设置与标签页缓存，切回 `anonymous`——路由随之切换到登录页，无整页跳转
- **凭证失效**：请求层 401 刷新失败时派发 `auth:invalidated` 事件（常量 `ADMIN_AUTH_INVALIDATED_EVENT`），`AuthProvider` 监听后切回匿名态
- **多标签页同步**：监听 `storage` 事件——另一个浏览器标签页登录/退出时，本标签页同步切换登录态
- **401 与网络故障区分**：只有 `/api/auth/me` 明确返回 401（`AuthRejectedError`）才清除凭证；网络异常保留凭证进入 `unavailable`
- `updateUser`：个人资料修改后回写 `['auth', 'me']` 缓存，头像昵称即时生效

## 请求封装

通用 HTTP 客户端核心在 `packages/web/src/utils/http-client.ts`（`HttpClient` 类），三个入口各自实例化，token 与登录页互相隔离：

| 实例 | 文件 | token key | 401 刷新接口 | 凭证失效后 |
|------|------|-----------|--------------|------------|
| `request`（后台 admin） | `utils/request.ts` | `zenith_token` | `POST /api/auth/refresh` | 派发 `auth:invalidated`，由 `AuthProvider` 切回登录态 |
| `memberRequest`（会员前台） | `member/utils/member-request.ts` | `zenith_member_token` | `POST /api/member/auth/refresh` | 整页跳转 `/member.html#/login` |
| `approvalRequest`（移动审批轻页） | `approval/lib/approval-request.ts` | `zenith_token`（与 admin 共享，同域免登） | `POST /api/auth/refresh` | 整页跳转 `/approval.html#/login` |

`HttpClient` 统一实现：

- 自动附加 `Authorization` 请求头；非 `FormData` 请求自动设置 `Content-Type: application/json`
- Access Token 过期时自动用 Refresh Token 换取新 token 并重试原请求；并发请求共享同一个刷新 Promise（single-flight）
- 刷新失败或重试仍 401：清除本地凭证，执行各端的失效回调/跳转
- 统一错误 Toast；`silent` 静默模式由调用方自行处理错误
- `skipAuth`：401 直接返回响应体，不触发刷新与退出（用于密码校验、登录接口等）
- 429 响应读取 `Retry-After` 头，附加 `retryAfterSeconds` 返回
- 503 维护模式（仅 admin 端启用）：派发 `maintenance:enabled` 事件，`App.tsx` 展示维护覆盖层

admin 端 `request` 额外提供 `postForm`（`onProgress` 上传进度，内部走 XMLHttpRequest）与 `download`（二进制文件下载）。

::: tip request 只是传输层
业务代码不直接调用 `request.get` 拉取页面数据。服务端状态（列表、详情、下拉源等）统一通过 TanStack Query 的域 hooks 管理（`hooks/queries/`），queryFn 内部才使用 `request.get(url).then(unwrap)`。完整规范见[数据获取与服务端状态](/frontend/data-fetching)。
:::

## 与后端的协作方式

### 401 刷新流程

请求返回 401 时，请求封装读取 refresh token 并调用刷新接口：

```json
{ "refreshToken": "<refresh-token>" }
```

刷新成功后更新 access token 并重试原请求；失败则清除凭证并按上表处理。

### 响应读取

统一响应格式：

```json
{
  "code": 0,
  "message": "success",
  "data": {}
}
```

### 共享类型

接口类型、实体定义和校验 schema 尽量复用 `@zenith/shared`（按域子路径导入），避免前后端各写一套。

## 开发环境代理配置

开发环境下，前端 Vite Dev Server 通过内置代理将 `/api/*` 请求转发到后端，避免跨域问题，同时让前端无需感知后端地址。

**相关文件：**

- `packages/web/.env.development` — 开发环境变量
- `packages/web/vite.config.ts` — 代理规则定义

**关键环境变量：**

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `VITE_API_PROXY_TARGET` | 代理目标（后端地址），仅在 Vite Dev Server 中生效，**不会**暴露到客户端 | `http://localhost:3300` |
| `VITE_API_BASE_URL` | 客户端 API 基础 URL。**开发时留空**，请求走相对路径 `/api/...` 由代理转发；**生产部署时**填写后端完整地址，如 `https://api.yourdomain.com` | 空（开发）|
| `VITE_WS_BASE_URL` | WebSocket 基础 URL。**开发时留空**，由 `useWebSocket.ts` 自动从当前 Origin 推导并经代理转发；**生产时**填写如 `wss://api.yourdomain.com` | 空（开发）|

**代理规则（`vite.config.ts`）：**

```ts
server: {
  proxy: {
    '/api': {
      target: apiTarget, // 来自 VITE_API_PROXY_TARGET
      changeOrigin: true,
      ws: true, // 同时代理 WebSocket（/api/ws）
    },
  },
},
```

**各环境配置示例：**

::: code-group

```dotenv [.env.development（开发）]
VITE_API_BASE_URL=
VITE_WS_BASE_URL=
VITE_API_PROXY_TARGET=http://localhost:3300
```

```dotenv [生产部署（自行创建 .env.production）]
VITE_API_BASE_URL=https://api.yourdomain.com
VITE_WS_BASE_URL=wss://api.yourdomain.com
# 生产构建无 Dev Server，无需 VITE_API_PROXY_TARGET
```

:::

> **注意**：`VITE_API_PROXY_TARGET` 只在 `vite.config.ts` 中通过 `loadEnv` 读取，用于 Dev Server 代理配置；业务代码不通过 `import.meta.env` 读取它，后端代理地址不会进入生产包。

## 会员端独立请求实例

会员前台（`member.html` 入口）使用独立请求封装 `member/utils/member-request.ts`，会员 token 与后台管理员 token 隔离：

| 常量 | Key | 说明 |
|------|-----|------|
| `MEMBER_TOKEN_KEY` | `zenith_member_token` | 会员 Access Token |
| `MEMBER_REFRESH_TOKEN_KEY` | `zenith_member_refresh_token` | 会员 Refresh Token |

会员端不要复用后台的 `request.ts`。会员端服务端状态同样由 TanStack Query 管理，使用独立的 `memberQueryClient`（`member/lib/member-query.ts`）与域 hooks（`member/hooks/queries.ts`）；登录态由 `member/hooks/useMemberAuth.tsx` 维护，退出登录时清空 `memberQueryClient` 缓存。

## 开发建议

- 新增接口前，先确认是否已有共享类型或校验 schema
- 对需要登录的页面，优先复用现有登录态与跳转机制
- 请求错误处理尽量集中在封装层，不把每个页面都写成“各自为战”
- 页面数据获取遵循[数据获取与服务端状态](/frontend/data-fetching)中的域 hooks 模式，不在组件里手写 fetch 状态机
