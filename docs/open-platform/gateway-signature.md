# 签名与网关

开放 API 网关挂载在 `/api/open/v1/*`，所有端点共享鉴权、计量与限流中间件。

---

## 网关链路

```text
openGatewayAuth → openApiMetering → openRateLimit → handler
```

| 阶段 | 行为 |
| --- | --- |
| 鉴权 | 解析 OAuth2 Bearer 或 AppKey + HMAC，检查应用状态、审核状态与 IP 白名单 |
| 计量 | 异步写入 `open_api_call_logs`，记录方法、路径、状态码、耗时、Scope、鉴权通道、用户与环境 |
| 限流 | 生产环境按套餐执行 QPS、每日、每月配额；沙箱环境跳过限流 |

## 鉴权通道

| 通道 | 请求方式 | 有效 Scope |
| --- | --- | --- |
| OAuth2 Bearer | `Authorization: Bearer <access_token>` | token scopes ∩ 应用 `allowedScopes` |
| HMAC 签名 | `X-App-Key` + 签名头 | 应用 `allowedScopes` |

HMAC 通道要求应用 `signEnabled=true`。不存在裸 AppKey 免签调用路径。

## 签名算法

| 项 | 值 |
| --- | --- |
| 算法 | `HMAC-SHA256` |
| 时间戳窗口 | 300 秒 |
| 密钥 | 应用 `clientSecret` |
| 输出 | 十六进制字符串 |

请求头：

```text
X-App-Key: <client_id>
X-Timestamp: <unix_seconds>
X-Nonce: <random_nonce>
X-Signature: <hex_hmac_sha256>
```

待签名字符串：

```text
METHOD
PATH
CANONICAL_QUERY
TIMESTAMP
NONCE
SHA256_HEX(BODY)
```

规则：

- `METHOD` 转为大写。
- `PATH` 使用 URL pathname，例如 `/api/open/v1/echo`。
- `CANONICAL_QUERY` 去掉开头 `?`，按参数名排序；参数名相同时按参数值排序；无 query 时为空行。
- `BODY` 使用原始请求体；`GET` / `HEAD` 按空字符串计算 SHA-256。
- `X-Nonce` 在窗口内防重放，同一应用重复使用会被拒绝。

## 在线签名工具 API

挂载前缀：`/api/open-signature`，需登录并具备 `open:signature:use`。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/open-signature/algorithm` | 获取签名算法说明 |
| `POST` | `/api/open-signature/verify` | 在线计算 / 校验请求签名 |

`POST /api/open-signature/verify` 请求体：

```json
{
  "appKey": "client-id",
  "method": "POST",
  "path": "/api/open/v1/echo",
  "query": "b=2&a=1",
  "body": "{\"hello\":\"world\"}",
  "timestamp": "1790000000",
  "nonce": "nonce-1",
  "signature": "optional-hex"
}
```

返回：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "signature": "hex",
    "stringToSign": "POST\n/api/open/v1/echo\na=1&b=2\n1790000000\nnonce-1\n...",
    "matched": true
  }
}
```

在线工具会校验调用者对该应用的权限：应用 owner、超级管理员或拥有 `system:oauth2-apps:manage` 的用户可代算签名。

## 网关错误

| 场景 | HTTP | `message` |
| --- | --- | --- |
| 缺少鉴权信息 | 401 | `缺少鉴权信息：请提供 Authorization: Bearer ... 或 X-App-Key 与签名请求头` |
| Bearer 无效 | 401 | `invalid_token` |
| AppKey 无效 | 401 | `AppKey 无效` |
| 应用未开启签名通道 | 401 | `该应用未开启签名通道，请改用 OAuth2 Bearer` |
| 缺少签名头 | 401 | `缺少签名请求头（X-Timestamp / X-Nonce / X-Signature）` |
| 时间戳过期 | 401 | `签名时间戳已过期` |
| nonce 重放 | 401 | `重复请求（nonce 已使用）` |
| 签名不匹配 | 401 | `签名校验失败` |
| 应用禁用 | 403 | `应用已禁用` |
| 应用未审核通过 | 403 | `应用尚未审核通过` |
| IP 白名单拒绝 | 403 | `当前 IP 不在应用白名单中` |
| Scope 不足 | 403 | `应用未授权 scope：<scope>` |
| QPS 超限 | 429 | `超出套餐 QPS 限制（N/s）`，响应含 `Retry-After: 1` |
| 日 / 月配额超限 | 429 | `超出套餐每日调用配额（N/天）` / `超出套餐每月调用配额（N/月）` |
| 限流服务不可用且 fail-closed | 503 | `限流服务暂时不可用，请稍后重试` |

