# 异步通知与对账

本页覆盖支付结果可靠送达链路：渠道回调 → 订单状态机 → 事件 Outbox → 业务订阅者 / Webhook 投递，以及查单补偿、定时任务与对账中心。

## 渠道异步通知

### 公开回调端点

```text
POST /api/public/payment/notify/{channel}    # channel: wechat | alipay | unionpay
```

端点为公开路由，渠道服务器不携带管理端 token。安全边界依赖渠道验签、金额校验与状态条件更新。渠道配置的 `notifyUrl` 为空时，按 `PAYMENT_NOTIFY_BASE_URL` 或 `PUBLIC_BASE_URL` 拼接该路径。

### 处理流程

```text
渠道回调
  └─▶ 遍历同渠道启用配置逐个验签
        ├─ 全部失败：写 payment_notify_logs(signatureValid=false)，返回 401
        └─ 任一通过：解析订单/退款信息，校验金额，条件更新状态
              ├─ 成功：写日志，记录 Outbox 事件，返回成功 ACK
              └─ 抛错：写日志，返回渠道失败 ACK，等待渠道重发
```

要点：

- 微信：平台证书 RSA 验签 + AES-256-GCM 回调解密，平台证书按 `Wechatpay-Serial` 自动下载并缓存 12h。
- 支付宝：RSA2/RSA 验签。
- 云闪付：银联全渠道 5.1.0 `signMethod=01`（SHA256+RSA）验签。
- 回调金额必须与本地订单金额一致。
- `applyNotify` 使用条件更新推进订单/退款状态，重复通知无副作用。

## 回调日志

每次渠道回调都会写入 `payment_notify_logs`，后台「回调日志」页可查：

| 字段 | 说明 |
| --- | --- |
| `channel` / `scene` | 渠道、场景（payment/refund） |
| `orderNo` | 解析出的关联订单号 |
| `rawBody` / `headers` | 原始报文与请求头摘要 |
| `signatureValid` | 验签结果 |
| `result` / `message` | 处理结果与说明 |
| `ip` | 来源 IP |

## 事件 Outbox

订单/退款进入终态时，状态更新与 `payment_events` 插入在同一事务内完成；事务提交后立即尝试投递，`dispatchPaymentEvents` cron 每分钟补投 pending/超时事件。

| 事件 | 说明 |
| --- | --- |
| `payment.succeeded` | 订单支付成功 |
| `payment.closed` | 订单关闭 |
| `payment.failed` | 渠道下单失败 |
| `refund.succeeded` | 退款到账 |
| `refund.failed` | 退款失败或审批驳回 |

投递语义：

- `processEvent` 先 claim 事件，再调用 `paymentEventBus.dispatch`；
- handler 全部成功后置 `done`；
- handler 抛错时 `attempts + 1`，未达 5 次保持 `pending`，达到上限置 `failed`；
- 「支付事件」页可调用 `POST /api/payment/ops/events/{id}/redispatch` 将死信重置并重投。

业务订阅者与 Webhook 接收方都必须按 `orderNo`、`refundNo` 或业务键幂等。

## 查单补偿

| 路径 | 说明 |
| --- | --- |
| `paymentReconciliation` cron | 每 10 分钟扫描 `paying` 且创建超过 2 分钟的订单，调用渠道查单同步终态 |
| `POST /api/payment/orders/{id}/query` | 订单详情手动查单 |
| `POST /api/payment/refunds/{id}/query` | 退款详情手动查单 |
| `syncPaymentTransfers` cron | 每 5 分钟同步处理中转账单 |
| `retryFailedSharing` cron | 重试渠道未受理且未达上限的分账单，并同步处理中分账单 |

查单确认支付成功会走与回调相同的状态更新与 Outbox 事件链路。

## 支付域定时任务

种子内置支付相关任务（见 `packages/shared/src/seed/platform.ts`）：

| handler | 频率 | 职责 |
| --- | --- | --- |
| `dispatchPaymentEvents` | 每分钟 | 补投支付/退款 Outbox 事件 |
| `closeExpiredPaymentOrders` | 每 5 分钟 | 查单确认后关闭过期未支付订单 |
| `paymentReconciliation` | 每 10 分钟 | 支付中订单查单补偿 |
| `retryFailedSharing` | 每 10 分钟 | 分账失败重试与处理中分账同步 |
| `generateDailySettlements` | 每日 01:10 | T+1 生成昨日渠道 × 租户结算批次 |
| `syncPaymentTransfers` | 每 5 分钟 | 同步处理中转账单 |
| `autoPaymentRecon` | 每日 02:00 | 拉取昨日渠道账单自动对账 |
| `rebuildPaymentReportDaily` | 每日 00:20 | 重建近 2 天财务报表日切快照 |
| `executeDueDeductions` | 每分钟 | 执行到期签约代扣 |
| `syncPaymentDisputes` | 每 5 分钟 | 拉取/生成交易投诉工单 |

`retryPaymentWebhooks` 已注册为 handler，Webhook 失败重试由投递记录 `nextRetryAt` 驱动，可在定时任务中心配置排期。

## 业务方 Webhook 投递

后台「Webhook」页管理跨系统事件投递：

- 端点表：`payment_webhook_endpoints`；投递日志表：`payment_webhook_deliveries`。
- 订阅事件：5 类支付/退款事件，可按 `bizType` 过滤。
- 签名头：`X-Payment-Signature`，算法为 HMAC-SHA256，密钥加密存储。
- 重试：指数退避 `min(60s × 2^attempts, 1h)`，最多 5 次。
- 手动重投：`POST /api/payment/webhooks/deliveries/{id}/redeliver`。

## 对账中心

入口：`/payment/recon`，接口挂载在 `/api/payment/recon`。

### 创建对账批次

| 方式 | 接口 | 说明 |
| --- | --- | --- |
| 手动上传 | `POST /api/payment/recon/batches` | 上传 CSV，与本地成功/退款订单逐笔比对 |
| 自动拉取 | `POST /api/payment/recon/auto` | 调用适配器 `downloadBill`；微信支持交易账单，沙箱使用本地订单生成模拟账单 |
| 示例账单 | `GET /api/payment/recon/sample-bill` | 生成示例 CSV 便于联调 |

支付宝与云闪付适配器未实现 `downloadBill`，对账以手动上传或沙箱模拟账单为准。

### 比对结果与差异处理

逐笔结果枚举：`matched`、`local_only`、`channel_only`、`amount_diff`、`status_diff`。

差异处理状态：

- `adjusted`：根据差异类型推导调账方向与金额，写入 `payment_ledger_entries` 的 `type=adjust` 流水；
- `suspended`：挂账待查；
- `ignored`：确认无需处理。

处理接口为 `PATCH /api/payment/recon/items/{id}/handle`，记录处理人、处理时间与备注。
