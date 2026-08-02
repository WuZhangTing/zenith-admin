# 异步通知与对账

本页覆盖支付结果的可靠送达链路：渠道回调 → 订单状态机 → 事件 Outbox → 业务订阅者 / Webhook 投递，以及查单补偿、定时任务与对账中心。

## 渠道异步通知

### 公开回调端点

```text
POST /api/public/payment/notify/{channel}    # channel: wechat | alipay | unionpay
```

端点为公开路由（渠道服务器无法携带管理端 token），安全性完全依赖**验签**。渠道配置的 `notifyUrl` 留空时，按 `PAYMENT_NOTIFY_BASE_URL`（或 `PUBLIC_BASE_URL`）自动拼接该路径。

### 处理流程

```text
渠道回调 ──▶ 遍历该渠道所有启用配置逐个验签 ──▶ 解析报文（订单号/金额/状态）
                    │ 全部失败                        │ 任一通过
                    ▼                                ▼
        落回调日志(signatureValid=false)      applyNotify 条件更新订单状态
        返回 401 ACK                                 │
                                        ┌────────────┴────────────┐
                                        ▼                         ▼
                                  处理成功：                业务处理失败：
                                  落日志 + 成功 ACK         落日志 + 失败 ACK
                                                           （渠道将按自身策略重发）
```

要点：

- **多配置验签**：同一渠道可能存在多份启用配置（多商户号），`handleNotify` 逐个尝试验签，任一通过即按该配置处理，天然支持多商户号并存。
- **验签细节**：微信为平台证书 RSA 验签 + 报文 AES-256-GCM 解密（平台证书自动下载、按 serial 缓存 12h）；支付宝为 RSA2/RSA 验签；云闪付为银联全渠道 5.1.0 `signMethod=01`（SHA256+RSA）验签。
- **失败 ACK**：验签失败返回 401；验签通过但业务处理抛错时返回渠道约定的失败应答（微信 `500 {code:"FAIL"}`、支付宝 `"failure"`），促使渠道重发通知，避免丢单。
- **幂等**：`applyNotify` 用条件更新推进订单状态（如 `paying → success` 仅在当前状态允许时生效），重复通知不产生副作用。
- 金额校验：回调金额与订单金额不一致时拒绝处理并记日志。

### 回调日志

每次回调（无论成败）都写入 `payment_notify_logs`（追加型），后台「回调日志」页可查：

| 字段 | 说明 |
| --- | --- |
| `channel` / `scene` | 渠道、场景（payment/refund） |
| `orderNo` | 解析出的关联订单号（可按单追溯全部回调） |
| `rawBody` / `headers` | 原始报文（截断至 8000 字符）与请求头（2000 字符），争议取证用 |
| `signatureValid` | 验签结果 |
| `result` / `message` | 处理结果与说明 |
| `ip` | 来源 IP |

## 事件 Outbox：可靠投递

订单/退款到达终态时**不直接**触发业务履约，而是走 Outbox 模式（`payment-outbox.service.ts`）：

1. **同事务落事件**：状态更新与 `payment_events` 插入在同一事务——状态已变则事件必已持久化；
2. **低延迟投递**：事务提交后立即尝试派发（`paymentEventBus.dispatch` 同步等待全部 handler，任一抛错记失败）；
3. **cron 兜底补投**：`dispatchPaymentEvents` 每分钟扫描 pending/超时事件重投（每批 200 条，认领超时 5 分钟，防多实例重复消费）；
4. **重试上限**：最多 5 次，仍失败置 `failed`（死信），在后台「支付事件」页可人工重派（`POST /api/payment/ops/events/{id}/redispatch`）。

5 类事件（`payment.succeeded` / `payment.closed` / `payment.failed` / `refund.succeeded` / `refund.failed`）**全部**经 Outbox 投递，业务订阅者与 Webhook 投递均由此驱动，因此订阅者必须幂等（at-least-once 语义）。

## 查单补偿（回调丢失兜底）

回调可能因网络问题永远不到达，两条补偿路径：

- **自动**：cron `paymentReconciliation` 每 10 分钟扫描 `paying` 且创建超过 2 分钟的订单（每批 500），调渠道查单接口同步终态；确认支付成功走与回调完全相同的 `markOrderPaid` 链路（事件照发）。
- **手动**：订单详情「主动查单」按钮（`POST /api/payment/orders/{id}/query`）；退款同理（`POST /api/payment/refunds/{id}/query`）。

## 支付域定时任务

种子内置 10 个支付相关任务（「系统管理 → 定时任务」可启停与调整频率）：

| 任务 | 频率 | 职责 |
| --- | --- | --- |
| `dispatchPaymentEvents` | 每分钟 | 补投 Outbox 支付/退款事件，进程崩溃后履约不丢失 |
| `closeExpiredPaymentOrders` | 每 5 分钟 | 关闭已过期未支付订单（每批 500；关单前先向渠道查单确认未支付，防误关边界支付） |
| `paymentReconciliation` | 每 10 分钟 | 支付中订单主动查单纠正状态（回调兜底） |
| `retryFailedSharing` | 每 10 分钟 | 重试渠道调用失败的分账单（仅渠道未受理且未达 3 次上限），并同步渠道已受理分账单终态 |
| `generateDailySettlements` | 每日 01:10 | T+1 按渠道×租户生成昨日账期结算批次（无交易跳过，已生成幂等跳过） |
| `syncPaymentTransfers` | 每 5 分钟 | 查询渠道转账结果，同步处理中转账单终态 |
| `autoPaymentRecon` | 每日 02:00 | 拉取昨日渠道账单自动对账（沙箱生成模拟账单；已有批次跳过） |
| `rebuildPaymentReportDaily` | 每日 00:20 | 重建近 2 天财务报表日切快照 |
| `executeDueDeductions` | 每分钟 | 扫描已签约且到期的代扣协议执行周期扣款（失败次日重试，达上限自动暂停） |
| `syncPaymentDisputes` | 每 5 分钟 | 拉取渠道交易投诉单（沙箱对近期成功订单生成模拟投诉） |

另有已注册但未默认排期的 handler `retryPaymentWebhooks`（Webhook 补投），需要时可在定时任务中心自行添加排期——Webhook 失败重试主要靠投递记录自身的 `nextRetryAt` 指数退避驱动（见下节）。

## 业务方 Webhook 投递

跨系统集成（外部系统无法进程内订阅事件总线）通过「支付管理 → Webhook」配置 HTTP 端点：

- **订阅范围**：按事件类型（5 类支付/退款事件）与可选 `bizType` 过滤。
- **签名**：请求头携带 `X-Payment-Signature`（HMAC-SHA256，密钥加密存储），接收方验签防伪造。
- **重试**：投递失败按指数退避重试——`min(60s × 2^attempts, 1h)`，最多 5 次后置 failed；投递日志记录 HTTP 状态码、响应体摘要与错误信息。
- **手动重投**：投递日志页可对单条记录重新投递（`POST /api/payment/webhooks/deliveries/{id}/redeliver`）。
- 接收端应以 2xx 响应确认，并对重复投递幂等。

## 对账中心

对账验证「本地订单 ↔ 渠道账单」的一致性，入口为后台「对账中心」页（`/payment/recon`）。

### 创建对账批次

| 方式 | 说明 |
| --- | --- |
| 手动上传 | 选择渠道与账期日期，上传渠道账单 CSV（列：订单号、渠道交易号、金额分、状态），与本地成功/退款订单逐笔比对 |
| 自动拉取 | `POST /api/payment/recon/auto` 或 cron `autoPaymentRecon`：调用适配器 `downloadBill` 拉取渠道账单——**微信**已实现交易账单（tradebill）自动下载解析；**支付宝**账单为 zip 包暂不支持自动拉取（请走手动上传）；**沙箱配置**用本地订单生成模拟账单演示闭环 |
| 模拟账单 | `GET /api/payment/recon/sample-bill` 按本地订单生成示例 CSV，便于体验手动对账流程 |

### 比对结果与差异处理

逐笔比对产出 5 类结果：`matched`（一致）、`local_only`（本地有渠道无）、`channel_only`（渠道有本地无）、`amount_diff`（金额不一致）、`status_diff`（状态不一致）。

差异项进入处理工作流：`pending →（人工处理）→ adjusted / suspended / ignored`：

- **已调账（adjusted）**：按差异类型自动推导调账方向与金额，写入一条资金台账（`type=adjust`），完成资金闭环；
- **挂账（suspended）**：暂挂待查；
- **已忽略（ignored）**：确认无需处理。

处理动作走条件更新防重复处理，记录处理人与处理时间。
