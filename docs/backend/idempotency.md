# 幂等控制

`idempotencyGuard` 中间件（`packages/server/src/middleware/idempotency.ts`）为写操作提供防重复提交能力：同一请求在 TTL 窗口内重复到达时，要么**原样回放首次成功响应**，要么返回 429 拒绝。

适用场景：支付下单、钱包充值、审批提交、批量操作等「重复执行会产生脏数据或资损」的接口。

## 使用方式

在 `createRoute` 的 `middleware` 数组中按路由声明：

```ts
import { idempotencyGuard } from '../../middleware/idempotency';

const submitRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post',
    path: '/',
    middleware: [authMiddleware, idempotencyGuard({ ttlSeconds: 60 })] as const,
    // ...
  }),
  handler: async (c) => { /* ... */ },
});
```

选项：

| 选项 | 默认 | 说明 |
| --- | --- | --- |
| `ttlSeconds` | 60 | 幂等窗口时长 |

## 两种识别模式

### 显式模式：X-Idempotency-Key

客户端主动生成幂等键并放入请求头：

```http
POST /api/payment/orders
X-Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
```

服务端按 `sha256(identity + "|" + key前128字符)` 取前 32 位作为存储 key（幂等键按身份隔离，不同用户使用相同 key 互不影响）。

### 自动指纹模式

客户端未传 key 时，服务端按请求特征自动生成指纹：

```text
fingerprint = identity + method + pathname + search + sha256(body)前16位
```

- **包含 query string**（`pathname + search`），同路径不同参数视为不同请求
- 空请求体的 bodyHash 记为 `nobody`

### 身份命名空间

指纹中的 `identity` 按优先级取：

1. 开放平台网关注入的 `openApp.clientId` → `app:{clientId}`
2. 已认证用户 → `u{userId}`
3. `X-Forwarded-For` 首个 IP（未认证请求）
4. 兜底 `0.0.0.0`

## 执行流程与响应回放

```text
请求到达
  → 计算幂等 key
  → Redis SET NX EX：写入 { state: 'processing' }
      ├─ 写入成功（首次请求）→ 执行 handler
      │     ├─ 响应 2xx 且 Content-Type 为 application/json
      │     │   → 把 { status, contentType, body } 写回同 key（保留 TTL）
      │     └─ 其他情况 → 保留 processing 占位（TTL 内到期自动释放）
      └─ 写入失败（key 已存在）
            ├─ 已缓存成功响应 → 原样回放（相同状态码与响应体）
            └─ 仍在 processing / 非 JSON 成功 → 429
```

要点：

- **成功响应会被缓存并回放**：TTL 窗口内的重复请求收到与首次完全一致的响应，客户端重试逻辑无需特殊处理
- **失败不缓存但占用窗口**：handler 抛错或返回非 2xx 时，processing 占位保留至 TTL 到期，期间重复请求返回 429（防止失败后立刻重试打穿下游）
- 429 响应体：

```json
{ "code": 429, "message": "请求正在处理或已提交，请勿重复操作", "data": null }
```

- **Redis 不可用时 fail-open**：跳过幂等检查直接放行，幂等是「尽力而为」的防护层，不是业务正确性的唯一保障——资金类操作仍需数据库唯一约束 / 乐观锁兜底

## 已接入的接口

按业务域（以代码为准，可 grep `idempotencyGuard(` 查看全量）：

| 业务域 | 典型接口 |
| --- | --- |
| 支付中心 | 下单、转账、预授权、代扣签约、争议处理、账户操作（`routes/payment/*`） |
| 会员中心 | 钱包充值、积分调整、优惠券领取/核销、会员自助操作、续费（`routes/member/*`） |
| 工作流 | 实例发起、任务审批/转办/加签、批量操作（`routes/workflow/instances/*`） |
| CMS | 发布、静态化、站群分发（`routes/cms/*`） |
| 公众号 | 群发任务、带参二维码（`routes/mp/*`） |
| 开放平台 | 开放 CMS 写接口（`routes/open-platform/open-cms.ts`） |
| 其他 | 业务示例（请假单）、意见反馈提交 |

## 客户端建议

- 对资金类操作**始终显式传 `X-Idempotency-Key`**（UUID），并在网络超时后用同一 key 重试——会拿到首次结果的回放而非重复扣款
- 前端表单防重可依赖自动指纹模式，无需额外代码
- 收到 429 时提示用户「操作处理中，请勿重复提交」，稍后刷新状态而非立即重试
