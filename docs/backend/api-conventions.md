# API 规范

后端 API 由 `packages/server/src/app.ts` 统一装配，业务路由统一挂载在 `/api` 前缀下。常规业务接口使用 Hono + `@hono/zod-openapi`，以 Zod schema 同时驱动运行时校验与 OpenAPI 文档。

## 统一响应格式

成功响应统一由 `okBody(data, message?)` 构造：

```json
{
  "code": 0,
  "message": "success",
  "data": {}
}
```

失败响应统一由 `errBody(message, code?)` 构造，`code` 与 HTTP 状态码保持同语义，`data` 为 `null`：

```json
{
  "code": 404,
  "message": "资源不存在",
  "data": null
}
```

路由 handler 中使用 `return c.json(okBody(...), 200)` 或 `return c.json(errBody(...), status)`，不要内联 `{ code, message, data }` 字面量。文件下载类响应通过 `okExcel()` / `okCsv()` / `okFile()` 声明 OpenAPI，handler 中使用 `excelBody()` / `excelStreamBody()` / `csvStreamBody()` / `fileBody()` 或直接返回 `Response`。

## 分页返回格式

列表接口返回 `PaginatedResponse<T>`，并放在统一响应的 `data` 字段内：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "list": [],
    "total": 100,
    "page": 1,
    "pageSize": 10
  }
}
```

分页查询参数统一使用 `PaginationQuery.extend({ ... })`。默认 `page=1`、`pageSize=10`，`pageSize` 最大 200。Service 层 SQL-builder 查询使用 `withPagination(query.$dynamic(), page, pageSize)`；RQB 查询使用 `pageOffset(page, pageSize)`。

## 日期时间格式

所有对外 API 响应和业务日期时间入参统一使用 `YYYY-MM-DD HH:mm:ss`，例如：`2026-03-22 20:09:37`。

- DTO 映射、导出和文件时间戳使用 `packages/server/src/lib/datetime.ts` 中的 `formatDateTime()` / `formatNullableDateTime()` / `formatDate()` / `formatFileTimestamp()`。
- 单点时间入参使用 `parseDateTimeInput()`。
- 范围端点使用 `parseDateRangeStart()` / `parseDateRangeEnd()`，或直接使用 `dateRangeConditions()`。
- 路由查询 schema 中的范围端点用 `dateRangeBound('说明')`，接受 `YYYY-MM-DD` 与 `YYYY-MM-DD HH:mm:ss`。
- 业务接口契约不要使用 ISO datetime，DTO 映射不要直接 `toISOString()`。

## 认证方式

管理端使用 Access Token + Refresh Token：

| Token | 前端存储 Key | 说明 |
| --- | --- | --- |
| Access Token | `zenith_token` | 短期凭证，通过请求头传递 |
| Refresh Token | `zenith_refresh_token` | 长期凭证，用于 `/api/auth/refresh` 换发 Access Token |

需要认证的请求携带：

```http
Authorization: Bearer <accessToken>
```

管理端 `authMiddleware` 同时支持以 `zat_` 开头的 API Token。管理员 token 与会员 token 严格隔离：`authMiddleware` 拒绝 `type: 'member'` 的 token，会员接口由 `memberAuthMiddleware` 校验 `type: 'member'`。

认证中间件会在 Hono 上下文中注入 `user`。路由守卫可通过 `c.get('user')` 读取；Service 层统一使用 `currentUser()` / `currentUserOrNull()`，避免在 route handler 与 service 之间透传 Context。

```ts
import { currentUser } from '../lib/context';

const user = currentUser();
```

## 参数校验

所有入参通过 `createRoute(...)` 的 `request.body` / `request.params` / `request.query` 定义 Zod schema，由 `validationHook` 统一转为标准错误响应。

```json
{
  "code": 400,
  "message": "<Zod 校验错误信息>",
  "data": null
}
```

推荐写法：

```ts
import { OpenAPIHono, createRoute, defineOpenAPIRoute } from '@hono/zod-openapi';
import { createXxxSchema } from '@zenith/shared/platform';
import { authMiddleware } from '../../middleware/auth';
import { guard } from '../../middleware/guard';
import { IdParam, PaginationQuery, commonErrorResponses, jsonContent, ok, okBody, validationHook } from '../../lib/openapi-schemas';
import { XxxDTO } from '../../lib/openapi-dtos';

const xxxRouter = new OpenAPIHono({ defaultHook: validationHook });

const createXxxRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post',
    path: '/',
    tags: ['Xxx'],
    summary: '创建 XXX',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'system:xxx:create', audit: { description: '创建 XXX', module: 'XXX 管理' } })] as const,
    request: { body: { content: jsonContent(createXxxSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(XxxDTO, '创建成功') },
  }),
  handler: async (c) => {
    const data = c.req.valid('json');
    const row = await createXxx(data);
    return c.json(okBody(row, '创建成功'), 200);
  },
});

xxxRouter.openapiRoutes([createXxxRoute] as const);
export default xxxRouter;
```

要点：

- 每个 `OpenAPIHono` 实例传入 `{ defaultHook: validationHook }`。
- 每个 OpenAPI 路由用命名常量声明，并通过 `router.openapiRoutes([... ] as const)` 统一注册。
- 需要登录的路由显式声明 `security: [{ BearerAuth: [] }]` 与 `authMiddleware`；公开路由显式 `security: []`。
- `responses` 展开 `...commonErrorResponses`，并用 `ok()` / `okPaginated()` / `okMsg()` 描述 200 响应。
- 数值 path 参数用 `IdParam`；自定义 path 参数必须带 `.openapi({ param: { name, in: 'path' } })`。
- 共享 Zod schema 从 `@zenith/shared/{业务域}` 导入；仅路由私有的一次性 schema 可本地声明。

## Service 层规范

业务逻辑、数据映射、前置校验统一放在 `packages/server/src/services/{业务域}/` 下，目录与 `src/routes/{业务域}/` 对齐。

| 层 | 职责 | 禁止事项 |
| --- | --- | --- |
| route handler | 读取 `c.req.valid()`、调用 service、返回 HTTP 响应、设置必要审计快照 | 直接写业务规则、DTO 映射、DB 查询 |
| service | 业务规则、数据映射、前置校验、复杂查询、事务、关联写操作；通过 `currentUser()` 获取登录用户 | `c.json()`、直接依赖 Hono `Context`、`console.*` |

常用命名：

```ts
export function mapXxx(row: XxxRow) { ... }

export async function ensureXxxExists(id: number) {
  const [row] = await db.select().from(xxxs).where(eq(xxxs.id, id)).limit(1);
  if (!row) throw new HTTPException(404, { message: 'XXX 不存在' });
  return row;
}
```

业务错误抛 `HTTPException(statusCode, { message })`，由 `app.onError()` 转为统一 JSON。唯一约束冲突使用 `rethrowPgUniqueViolation(err, message, byConstraint?)` 映射为 400。

## 响应实体 DTO（中心化）

响应 DTO 按业务域维护在 `packages/server/src/lib/dtos/`，并由 `packages/server/src/lib/openapi-dtos.ts` 统一 re-export。路由文件只引用中心化 DTO：

```ts
import { UserDTO } from '../../lib/openapi-dtos';
```

约束：

- 不在路由文件内本地声明带 `.openapi('EntityName')` 的实体 DTO，避免 OpenAPI Components 同名冲突。
- 新增实体 DTO 时放入对应 `lib/dtos/*.ts` 文件，再经 `lib/dtos/index.ts` 与 `lib/openapi-dtos.ts` 导出。
- 请求体 schema 和非复用匿名对象可保留在路由文件内。

## 常用错误码

| code | 含义 |
| --- | --- |
| `0` | 成功 |
| `400` | 参数校验失败或业务前置条件不满足 |
| `401` | 未登录、token 无效或会话失效 |
| `403` | 权限不足、账号禁用、功能授权不满足 |
| `404` | 资源不存在 |
| `408` | 请求处理超时（启用 `REQUEST_TIMEOUT_MS` 时） |
| `409` | 并发冲突、乐观锁重试耗尽 |
| `410` | 导出文件等资源已过期 |
| `413` | 请求体超出大小限制（启用 `REQUEST_BODY_LIMIT` 时） |
| `423` | 登录账号被锁定 |
| `429` | 触发接口级限流 |
| `500` | 服务端内部错误 |

## 路由组织

- 路由文件位于 `packages/server/src/routes/{业务域}/`，每个文件导出一个子路由器。
- 每个业务域在 `routes/{业务域}/index.ts` 中用 `defineRouteDomain` 声明挂载清单。
- `routes/index.ts` 的 `ROUTE_DOMAINS` 声明域顺序：`ops → identity → member → platform → files → tasks → analytics → report → messaging → payment → open-platform → workflow → chat → mp → biz-demo → ai → cms → wiki`。
- `src/app.ts` 的 `createApp()` 按域装配常规 API，再挂载 `/api/mastra/*`，再注册 Swagger 文档和 fallback 路由。
- CMS 前台 SSR 等兜底路由放在域的 `fallback()` 中，保证晚于全部 API 与文档路由。
- 全量 method + path 由 `src/app.contract.test.ts` 快照锁定；增删接口需更新该快照。

## 数据删除与批量操作规范

- 单条删除：`DELETE /api/resource/{id}`。
- 批量删除：`DELETE /api/resource/batch` 或按领域既有约定使用 `POST /batch-delete`，body 传 `{ ids: number[] }`。
- 批量修改状态：`PUT /api/resource/batch-status`，body 传 `{ ids: number[], status: 'enabled' | 'disabled' }`。
- `DELETE /batch` 必须注册在 `DELETE /{id}` 之前，避免被动态参数捕获。

## 文件上传

标准文件上传由文件域提供。小文件使用 `POST /api/files/upload`（`multipart/form-data`）；大文件使用上传会话与分片接口。文件下载、预览和业务附件关系由 `packages/server/src/routes/files/` 与 `services/files/` 收口。

## 健康检查

`GET /api/health` 无需鉴权，返回服务状态、版本、运行时长，以及数据库 / Redis 连通性：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "status": "ok",
    "version": "1.90.0",
    "uptimeSeconds": 12345,
    "checks": { "database": "ok", "redis": "ok" }
  }
}
```

## Prometheus 指标

`GET /metrics` 无需鉴权，返回 Prometheus 文本格式指标，不属于 OpenAPI 文档。指标来源包括：

- `@hono/prometheus` HTTP RED 指标；
- `prom-client` 默认进程指标；
- `registerZenithMetrics()` 注册的 Zenith 业务 / 系统指标（CPU、内存、HTTP、WebSocket、DB、Redis 等）。

## OpenTelemetry Trace

服务端通过 `@hono/otel` 接入 Hono 请求 Trace。`OTEL_ENABLED=true` 时启用；未显式设置 `OTEL_ENABLED` 但配置了 `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` 或 `OTEL_EXPORTER_OTLP_ENDPOINT` 时也会启用。采集请求 / 响应头包括 `x-request-id`、`user-agent`。

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `OTEL_ENABLED` | `false` | 是否启用 Trace |
| `OTEL_SERVICE_NAME` | `zenith-admin-server` | 服务名 |
| `OTEL_SERVICE_VERSION` | npm package version | 服务版本 |
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` | 空 | OTLP traces 专用导出地址 |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | 空 | 通用 OTLP 导出地址 |
| `OTEL_EXPORTER_OTLP_HEADERS` | 空 | 导出请求头 |

## 共享约定

- 类型、Zod schema、枚举和常量按域放到 `@zenith/shared/{业务域}` 子路径。
- 禁止从 `@zenith/shared` 根入口导入。
- 种子数据统一从 `@zenith/shared/seed` 导入。

## Server-Timing 性能分析头

`SERVER_TIMING_ENABLED=true` 时，服务端通过 `hono/timing` 为响应附加 `Server-Timing` 头。默认关闭。

```http
Server-Timing: total;dur=45.2;desc="Total Response Time"
```

路由内部可使用 `startTime(c, name)` / `endTime(c, name)` 标记关键阶段。

## 请求防护

服务端在 `createApp()` 中装配以下中间件：

| 能力 | 实现 | 说明 |
| --- | --- | --- |
| Request ID | `hono/request-id` | 为请求设置 `requestId` 上下文 |
| Trace ID | `requestTraceMiddleware` | 接收 `X-Trace-Id`（≤64 字符）或生成 UUID，并回写响应头 |
| 安全响应头 | `hono/secure-headers` | API 场景下放开 CORP / COOP / X-Frame-Options 的不适用限制 |
| 压缩 | `hono/compress` | WebSocket、文件、日志流、监控流、AI 流式、公开制品等长连接 / 二进制端点排除 |
| CORS | `hono/cors` | `/api/mastra/*` 反射 Origin 并允许 credentials，其余路径使用 `CORS_ORIGIN` |
| CSRF | `hono/csrf` | 按 `ALLOWED_ORIGINS` 校验 Origin；SAML ACS、OAuth2 authorize/token、开放网关 `/api/open/*` 豁免 |
| Body Limit | `hono/body-limit` | `REQUEST_BODY_LIMIT > 0` 时启用，超限返回 413 |
| Timeout | `hono/timeout` | `REQUEST_TIMEOUT_MS > 0` 时对 `/api/*` 启用，WebSocket / 文件 / DB 管理 / 日志 / 监控流 / AI 流 / 应用发布制品 / `*/export` 排除 |
| IP 访问控制 | `ipAccessMiddleware` | 对 `/api/*` 生效 |
| 限流 | `rate-limit.ts` | 登录、验证码、注册 / 找回 / 重置密码和路径绑定限流 |
| 维护模式 | `maintenanceMiddleware` | 对 `/api/*` 生效，认证与公开维护接口除外 |
| License 门控 | `licenseFeatureGate` | 域挂载声明 `feature` 时整体套功能授权 |
