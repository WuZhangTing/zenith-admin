# HTTP 流量日志

用于排障与联调的双向 HTTP 流量记录：

- **入站**（incoming）：`src/middleware/http-logger.ts` 拦截进入系统的请求
- **出站**（outgoing）：`src/lib/http-client.ts` 集成，记录[外呼请求](./http-client.md)

共享工具（脱敏、截断、格式化、写入）在 `src/lib/http-logger.ts`。默认**全部关闭**，按需通过环境变量开启。

## 日志级别

| 级别 | 记录内容 |
| --- | --- |
| `off` | 不记录 |
| `access` | 方法、路径、状态码、耗时（一行访问日志） |
| `headers` | access + 请求/响应 Header（脱敏后） |
| `body` | access + 请求/响应 Body（脱敏 + 截断） |
| `full` | 全部 |

级别解析优先级：**路由级覆盖 > 方法级配置 > 全局默认**。

### 路由级覆盖

```ts
import { withHttpLog } from '../../middleware/http-logger';

// 单独对该路由开全量日志（联调支付回调等场景）
middleware: [authMiddleware, withHttpLog('full')] as const

// 敏感路由强制关闭
middleware: [authMiddleware, withHttpLog('off')] as const
```

## 环境变量

入站与出站配置同构，前缀分别为 `HTTP_LOG_INCOMING_` 与 `HTTP_LOG_OUTGOING_`：

| 变量 | 入站默认 | 出站默认 | 说明 |
| --- | --- | --- | --- |
| `..._ENABLED` | `false` | `false` | 开关 |
| `..._LEVEL` | `access` | `full` | 全局级别 |
| `..._FORMAT` | `json` | `json` | 输出格式：`json` / `text` / `curl` |
| `..._MAX_BODY` | `65536` | `4096` | body 截断阈值（字节） |
| `..._RESPONSE_BODY` | `false` | `true` | 是否捕获响应体 |
| `..._FILE` | `false` | `false` | 写入独立文件 `logs/http-traffic-%DATE%.log` |
| `..._METHOD_GET` 等 | — | — | 按方法覆盖级别（`GET/POST/PUT/PATCH/DELETE/OPTIONS/HEAD`） |
| `HTTP_LOG_INCOMING_EXCLUDE` | 空 | —（无此项） | 额外排除的路径前缀，逗号分隔 |

示例：

```dotenv
# 联调期：入站 POST/PUT 记 body，出站全量
HTTP_LOG_INCOMING_ENABLED=true
HTTP_LOG_INCOMING_METHOD_POST=body
HTTP_LOG_INCOMING_METHOD_PUT=body
HTTP_LOG_OUTGOING_ENABLED=true
```

### 内置排除路径（入站）

以下前缀始终不记录：`/api/health`、`/api/ws`、`/api/metrics`、`/docs`、`/api/ui`、`/favicon.ico`。`HTTP_LOG_INCOMING_EXCLUDE` 在此基础上追加。

## 输出格式

每次请求产生 request / response 两条日志（通过 `requestId` 关联，字段 `correlation`）：

- `json`：结构化 `HttpLogEntry`（direction、phase、method、url、statusCode、durationMs、headers、body、timestamp），适合采集分析
- `text`：人读格式
- `curl`：请求阶段输出可直接复制重放的 curl 命令（响应阶段自动降级 text）

写入独立文件时按天滚动（`http-traffic-%DATE%.log`，zip 归档，保留份数跟随全局日志 `maxFiles` 配置）；否则并入主应用日志。

## 脱敏与截断

- **Header 脱敏**：精确匹配 `authorization`、`cookie`、`set-cookie`、`proxy-authorization`、`x-auth-token`、`x-api-key`，及模糊匹配含 `token` / `secret` / `password` / `api-key` / `api_key` 的 Header → 值替换为 `***`
- **Body 脱敏**：JSON body 深度遍历，命中敏感键名（`password`、`secret`、`token`、`accessKey`、`privateKey`、`apiKey`、`clientSecret`、`refreshToken`、`credential` 等，见 `src/lib/sanitize.ts` 的 `SENSITIVE_KEYS`）的字段替换为 `***`
- **非 JSON 载荷**：FormData / Blob / ArrayBuffer / TypedArray / ReadableStream 不读取内容，只记录类型占位符
- **截断**：超过 `MAX_BODY` 的 body 替换为 `[truncated, N bytes > limit M]`
- 出站 URL 的敏感 query 参数（`access_token`、`sign` 等）替换为 `key=***`

::: warning 生产环境建议
`body` / `full` 级别即使有脱敏也可能记录业务敏感数据且影响吞吐，生产环境建议入站保持 `access`，仅在排障时临时提级或用 `withHttpLog` 精准放大单个路由。
:::

## 与其他日志的关系

| 能力 | 本模块 | [审计日志](./audit-log-changes.md) |
| --- | --- | --- |
| 定位 | 排障 / 联调（技术视角） | 合规追溯（业务视角） |
| 存储 | 日志文件 | `operation_logs` 表 |
| 范围 | 全部流量（按级别） | 声明了 `guard({ audit })` 的写操作 |

在线查看日志文件可用运维中心的日志查看器（`GET /api/log-viewer/content|stream|download`，尾部读取默认 500 行、上限 5000 行，下载上限 100MB）。
