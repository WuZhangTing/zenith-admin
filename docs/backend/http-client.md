# 外呼 HTTP 客户端

所有出站 HTTP 请求（调第三方 API、Webhook 投递、支付渠道、AI 服务商等）**必须**走统一封装 `src/lib/http-client.ts`，禁止在业务代码中直接使用 `fetch` / `axios`。统一封装带来：超时控制、重试、熔断、代理、SSRF 防护与出站流量日志。

## 基本用法

```ts
import { httpGet, httpPost, httpRequest } from '../lib/http-client';

const data = await httpGet<WeatherResp>('https://api.example.com/weather', {
  query: { city: 'beijing' },
  timeout: 5000,
});

await httpPost('https://open.example.com/webhook', payload, {
  headers: { 'X-Sign': sign },
  retries: 2,
});
```

`httpRequest` 为底层通用入口，`httpGet` / `httpPost` / `httpPut` / `httpDelete` 是便捷封装。响应默认按 JSON 解析，非 2xx 抛 `HttpClientError`（含 `status`、`body`）。

## 选项

| 选项 | 默认 | 说明 |
| --- | --- | --- |
| `timeout` | 10000 | 单次请求超时（ms） |
| `retries` | 0 | 重试次数 |
| `retryDelay` | 1000 | 首次重试延迟（ms），指数退避 `retryDelay * 2^(attempt-1)` |
| `headers` / `query` | — | 请求头 / query 参数 |
| `proxy` | — | 代理地址（undici `ProxyAgent`；**不读取环境变量**，需显式传入） |
| `circuitBreaker` | `true` | 熔断开关，可对单请求关闭 |
| `ssrfProtection` | `false` | SSRF 防护开关 |
| `ssrfAllowlist` | `[]` | SSRF 防护下例外放行的私网目标 |

### 重试

- 触发条件：**5xx 响应或网络错误**（超时 abort 不重试）
- 日志：重试时输出 `[http] retry on 5xx`（warn）

### 熔断

按目标 host 独立熔断：

- 连续 **5 次失败**（非 2xx 或网络错误均计失败）→ 熔断 **30 秒**
- 冷却后半开：放行一次探测，成功则重置计数
- 熔断期间请求立即失败（`status: 0`），不打到远端
- 测试 / 运维可调用 `resetHttpCircuitBreakers()` 清空全部熔断状态

### SSRF 防护

`ssrfProtection: true` 时（处理**用户可控 URL** 的场景必须开启，如报表数据源、CMS 采集、AI 自定义端点）：

1. 请求前用 `assertSafeOutboundUrl()`（`src/lib/outbound-url.ts`）校验目标：
   - 仅允许 `http` / `https` 协议；拒绝 URL 携带用户名密码
   - 拒绝 `localhost`、`.local` 域名
   - 解析后 IP 命中内置 `BLOCKED_RANGES`（IPv4/IPv6 全部私网与保留段：`10/8`、`172.16/12`、`192.168/16`、`127/8`、链路本地、ULA 等）→ 拒绝
2. 使用专用 undici Agent，**每次 DNS 解析结果都重新校验**（防 DNS rebinding）
3. 强制 `redirect: 'error'`（防重定向绕过）
4. **禁止与 `proxy` 同时使用**（组合会绕过 IP 校验，直接抛错）

`ssrfAllowlist` 支持三种形态：精确主机名、`*.domain` 通配、CIDR / IP。各业务域的例外清单通过环境变量下发：

```dotenv
REPORT_OUTBOUND_PRIVATE_ALLOWLIST=          # 报表数据源允许的私网目标
AI_OUTBOUND_PRIVATE_ALLOWLIST=127.0.0.1,localhost  # AI 服务商（默认放行本机 ollama 等）
CMS_CDN_PURGE_HOST_ALLOWLIST=               # CMS CDN 刷新回调
CMS_COLLECT_SSRF_ALLOWLIST=                 # CMS 采集
```

## 出站日志

集成 [HTTP 流量日志](./http-logging.md)（`HTTP_LOG_OUTGOING_*` 配置）。日志行：

- `[http] request`（debug）→ `[http] response`（info）/ `[http] error`（warn）
- URL 中的敏感 query 自动脱敏为 `key=***`，覆盖：`access_token`、`secret`、`appsecret`、`app_secret`、`client_secret`、`password`、`refresh_token`、`api_key`、`apikey`、`token`、`sign`、`signature`

## 何时用任务中心而非直接外呼

外呼耗时长、允许异步、需要重试审计的（批量推送、对账拉取、采集任务），应封装为[异步任务](./task-center.md)投递任务中心执行，而不是在 HTTP 请求周期内同步外呼。
