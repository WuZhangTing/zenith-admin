# 调用统计与调试台

开放网关在每次业务处理后异步写入调用日志，统计页基于明细与每日聚合展示开放 API 使用情况。

---

## 调用日志

明细表 `open_api_call_logs` 记录：

| 字段 | 说明 |
| --- | --- |
| `clientId` / `appName` | 调用应用 |
| `method` / `path` | 请求方法与路径 |
| `statusCode` / `success` | HTTP 状态与成功标记 |
| `durationMs` | 服务端处理耗时 |
| `ip` / `userAgent` | 调用来源 |
| `scope` | 业务端点声明的 Scope |
| `authChannel` | `bearer` 或 `signature` |
| `userId` | 用户授权令牌对应用户；客户端凭证与签名通道为空 |
| `requestId` | 请求 ID |
| `environment` | `production` / `sandbox` |
| `createdAt` | 调用时间 |

计量失败不影响主请求。

## 统计 API

挂载前缀：`/api/open-api-stats`，均需 `open:stats:view`。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/open-api-stats/overview` | 调用总数、成功数、失败数、成功率、平均耗时、P95/P99、活跃应用、今日调用 |
| `GET` | `/api/open-api-stats/trend` | 按小时或按天聚合趋势 |
| `GET` | `/api/open-api-stats/by-app` | 应用调用 Top N |
| `GET` | `/api/open-api-stats/by-endpoint` | 端点调用 Top N |
| `GET` | `/api/open-api-stats/logs` | 调用日志分页列表 |

通用查询参数：

| 参数 | 说明 |
| --- | --- |
| `startTime` / `endTime` | 时间范围，支持 `YYYY-MM-DD` 与 `YYYY-MM-DD HH:mm:ss` |
| `clientId` | 应用过滤 |
| `environment` | `production` / `sandbox` |

日志列表额外支持 `success`、`method`、`statusCode`、`keyword`、`page`、`pageSize`。

统计页中 KPI 与图表按时间范围、应用和环境汇总；关键字、请求方法、调用结果、状态码只作用于日志表。

## 导出

调用日志可通过导出中心实体 `open-platform.call-logs` 导出。导出字段包括：

`ID`、`应用名称`、`Client ID`、`环境`、`方法`、`请求路径`、`Scope`、`状态码`、`是否成功`、`耗时(ms)`、`IP`、`请求 ID`、`错误信息`、`调用时间`。

导出权限为 `open:stats:view`，同步导出上限 5000 行，保留策略为普通文件 7 天、敏感文件 3 天、原始文件 3 天。

## 在线 API 调试台

调试台入口使用开发者 API：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/developer-apps/debug/endpoints` | 获取可调试端点目录 |
| `POST` | `/api/developer-apps/{id}/debug` | 以指定应用发起调试调用 |

调试请求体：

```json
{
  "method": "POST",
  "path": "/api/open/v1/echo",
  "query": { "a": "1" },
  "body": { "hello": "world" }
}
```

调试台行为：

- 只允许调用服务端端点目录中存在的方法与路径。
- 应用启用签名通道且存在密钥时，服务端代算 HMAC 签名并返回 `stringToSign`。
- 应用未启用签名通道时，服务端签发 5 分钟短期调试 access token，并使用 Bearer 调用。
- 响应体最多保留 64 KiB。
- 返回 `requestUrl`、`requestHeaders`、`statusCode`、`responseHeaders`、`responseBody` 与 `durationMs`。

