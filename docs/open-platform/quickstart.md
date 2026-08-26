# 快速接入

第三方系统接入开放平台通常分为：创建应用、选择鉴权方式、申请 Scope、调用开放 API、配置 Webhook 与观察调用数据。

---

## 1. 创建应用

1. 登录管理后台。
2. 进入「开放平台 → 我的应用」。
3. 创建应用并选择：
   - 环境：`production` 或 `sandbox`
   - 授权类型：`authorization_code`、`client_credentials`、`refresh_token`
   - 客户端类型：公开客户端或机密客户端
   - 允许的 Scope
   - 是否启用 HMAC 签名通道
   - IP/CIDR 白名单
4. 保存创建结果中的 `clientId` 与一次性返回的 `clientSecret`。
5. 需要走审核链路时提交应用审核；审核通过后可通过 OAuth2 标准端点与生产网关稳定调用。

> 公开客户端不返回 secret，不支持 `client_credentials`，也不能启用 HMAC 签名。

## 2. 选择调用方式

| 场景 | 推荐方式 | 请求头 / 参数 |
| --- | --- | --- |
| 用户授权后访问用户数据 | OAuth2 授权码 + PKCE | `Authorization: Bearer <access_token>` |
| 服务端到服务端调用 | OAuth2 `client_credentials` | `client_id` + `client_secret` 换 token |
| 机器调用且要求请求完整性 | HMAC 签名通道 | `X-App-Key`、`X-Timestamp`、`X-Nonce`、`X-Signature` |

两种网关鉴权都会归一为同一个调用主体，业务端点只检查有效 Scope。

## 3. OAuth2 client_credentials 示例

```bash
curl -X POST "https://admin.example.com/api/oauth2/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials" \
  -d "client_id=<client_id>" \
  -d "client_secret=<client_secret>" \
  -d "scope=data:read rules:evaluate"
```

返回体为 OAuth2 标准顶层格式：

```json
{
  "access_token": "oat_xxx",
  "token_type": "Bearer",
  "expires_in": 7200,
  "scope": "data:read rules:evaluate"
}
```

调用开放网关：

```bash
curl "https://admin.example.com/api/open/v1/ping" \
  -H "Authorization: Bearer <access_token>"
```

## 4. HMAC 签名示例

签名通道使用应用 `clientSecret` 作为 HMAC 密钥，请求头为：

| Header | 说明 |
| --- | --- |
| `X-App-Key` | 应用 `clientId` |
| `X-Timestamp` | 秒级 Unix 时间戳，允许偏移窗口 300 秒 |
| `X-Nonce` | 随机串，同一应用同一 nonce 在窗口内只能使用一次 |
| `X-Signature` | HMAC-SHA256 十六进制签名 |

TypeScript / Node.js 计算示例：

```ts
import { createHash, createHmac, randomUUID } from 'node:crypto';

function canonicalizeQuery(query = '') {
  const qs = query.startsWith('?') ? query.slice(1) : query;
  if (!qs) return '';
  return qs
    .split('&')
    .filter(Boolean)
    .map((pair) => {
      const idx = pair.indexOf('=');
      return idx >= 0 ? [pair.slice(0, idx), pair.slice(idx + 1)] : [pair, ''];
    })
    .sort(([ak, av], [bk, bv]) => (ak === bk ? av.localeCompare(bv) : ak.localeCompare(bk)))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
}

function signOpenRequest(secret: string, input: {
  method: string;
  path: string;
  query?: string;
  body?: string;
}) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = randomUUID();
  const bodyHash = createHash('sha256').update(input.body ?? '').digest('hex');
  const stringToSign = [
    input.method.toUpperCase(),
    input.path,
    canonicalizeQuery(input.query),
    timestamp,
    nonce,
    bodyHash,
  ].join('\n');
  const signature = createHmac('sha256', secret).update(stringToSign).digest('hex');
  return { timestamp, nonce, signature, stringToSign };
}
```

调用示例：

```bash
curl "https://admin.example.com/api/open/v1/echo?a=1&b=2" \
  -H "X-App-Key: <client_id>" \
  -H "X-Timestamp: <timestamp>" \
  -H "X-Nonce: <nonce>" \
  -H "X-Signature: <signature>"
```

## 5. 调用规则求值 API

应用需要包含 `rules:evaluate` scope。

```bash
curl -X POST "https://admin.example.com/api/open/v1/rules/evaluate" \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "table",
    "key": "risk_score",
    "facts": { "amount": 1200, "memberLevel": "gold" }
  }'
```

`kind` 必须是规则中心支持的资产类型；名单类资产可传 `subjects`。

## 6. 响应格式

开放网关与管理端业务 API 使用统一业务信封：

```json
{ "code": 0, "message": "success", "data": {} }
```

失败响应为：

```json
{ "code": 403, "message": "应用未授权 scope：data:read", "data": null }
```

OAuth2 协议端点中的 `/api/oauth2/token`、`/api/oauth2/token/revoke`、`/api/oauth2/token/introspect`、`/api/oauth2/userinfo` 返回 RFC 顶层格式，不套业务信封。
