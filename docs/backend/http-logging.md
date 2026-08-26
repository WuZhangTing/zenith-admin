# HTTP 流量日志

HTTP 流量日志由 `packages/server/src/lib/http-logger.ts` 和 `packages/server/src/middleware/http-logger.ts` 实现，覆盖入站请求与 `http-client` 发起的出站请求。

## 日志级别

`HttpLogLevel` 支持：

| 级别 | 内容 |
| --- | --- |
| `off` | 不记录 |
| `access` | 方法、路径、状态、耗时、大小等访问日志 |
| `headers` | 访问日志 + 请求 / 响应头 |
| `body` | 访问日志 + body 采样 |
| `full` | 访问日志 + headers + body |

格式支持 `json`、`text`、`curl`。

## 入站日志

默认配置：

- level：`access`
- max body bytes：`65536`
- 记录请求 body；默认不记录响应 body

内置排除路径：

- `/api/health`
- `/api/ws`
- `/api/metrics`
- `/docs`
- `/api/ui`
- `/favicon.ico`

入站日志位于全局中间件链路中，早于业务路由执行。请求 body 采样不改变后续业务读取。

## 出站日志

出站日志由 HTTP 客户端触发。默认配置：

- level：`full`
- max body bytes：`4096`
- 记录请求 body 与响应 body

出站日志会记录目标 URL、方法、状态码、耗时、重试、错误和 body 采样。

## 脱敏

日志会对敏感 header 做脱敏处理，例如：

- `authorization`
- `cookie`
- `set-cookie`
- `x-api-key`

body 只做长度采样，不替代业务字段级脱敏；涉及密码、token、密钥的业务接口应避免在响应中返回敏感值。

## 环境变量

配置项按入站和出站分组，位于 `packages/server/src/config.ts`：

- `INCOMING_HTTP_LOG_LEVEL`
- `INCOMING_HTTP_LOG_FORMAT`
- `INCOMING_HTTP_LOG_BODY_LIMIT`
- `INCOMING_HTTP_LOG_RESPONSE_BODY`
- `OUTGOING_HTTP_LOG_LEVEL`
- `OUTGOING_HTTP_LOG_FORMAT`
- `OUTGOING_HTTP_LOG_BODY_LIMIT`
- `OUTGOING_HTTP_LOG_RESPONSE_BODY`

## 使用建议

- 生产环境建议入站使用 `access` 或 `headers`，谨慎开启响应 body。
- 排查第三方接口时可临时提高出站日志级别。
- 长连接、WebSocket、健康检查和文档资源应保持排除，避免噪音和日志膨胀。
