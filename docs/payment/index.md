# 支付中心总览

支付中心是平台级的统一支付网关：业务模块不直接对接微信支付 / 支付宝 / 云闪付，而是调用支付中心的统一门面完成下单、查询、关单、退款，渠道差异由适配器层封装。在统一交易链路之上，支付中心还提供资金运营（台账 / 手续费 / 结算 / 分账 / 转账 / 商户账户）、对账、风控与投诉处理、签约代扣、预授权、支付链接收银台、应用维度路由、业务方 Webhook 等完整能力。

## 文档导航

| 文档 | 内容 |
| --- | --- |
| [渠道适配与配置](./channels.md) | 适配器接口与三渠道能力矩阵、新增渠道步骤、渠道配置管理 |
| [业务接入](./integration.md) | 统一下单/查询/关单/退款 API、支付事件订阅、幂等与金额规范 |
| [业务接入实战示例](./integration-example.md) | 以 `biz-pay-demo` 模块为例的完整接入代码走读 |
| [异步通知与对账](./callback.md) | 渠道回调处理、事件 Outbox、定时任务、对账中心、Webhook 投递 |
| [安全设计](./security.md) | 密钥加密存储、验签、幂等、资金一致性、风控、权限与审计 |
| [后台管理页面](./admin.md) | 20 个后台页面的功能清单与操作说明 |

## 能力总览

```text
                        业务模块（会员充值 / VIP 续费 / 订单支付 / …）
                                        │
                          统一门面 createPayment / refund / …
                                        │
        ┌──────────┬────────────┬───────┴──────┬─────────────┬──────────┐
        │ 业务幂等  │  风控引擎   │ 支付方式启停  │  应用路由     │ 优惠券立减 │
        └──────────┴────────────┴───────┬──────┴─────────────┴──────────┘
                                        │
                              适配器注册表（registry）
                     ┌──────────────────┼──────────────────┐
              微信支付 v3           支付宝开放平台        云闪付（银联全渠道）
                     └──────────────────┼──────────────────┘
                                        │ 异步通知 / 查单
                              回调验签 → 订单状态机 → 事件 Outbox
                                        │
        ┌───────────┬───────────┬───────┴────┬───────────┬────────────┐
        │ 业务订阅者 │ 资金台账   │ 手续费计费  │ 分账派发   │ Webhook 投递│
        └───────────┴───────────┴────────────┴───────────┴────────────┘
                                        │
                  结算批次 / 商户账户快照 / 财务报表 / 对账中心
```

按能力域划分：

| 能力域 | 内容 |
| --- | --- |
| 基础交易 | 统一下单（7 种收银台方式）、查单、关单、退款（含金额阈值审批链）、回调验签、订单超时自动关闭 |
| 资金运营 | 资金台账、手续费费率引擎、结算批次、分账（接收方 + 分账单）、转账/代付、渠道资金账户快照 |
| 对账 | 手动上传渠道账单 CSV、自动拉取渠道账单、逐笔比对、差异处理工作流（调账自动记台账） |
| 风控与争议 | 限额/黑白名单规则、拦截（block）与人工审核（review）双动作、命中留痕、交易投诉工单 |
| 进阶交易 | 签约代扣（周期扣款计划 + 协议 + 自动扣款）、预授权（冻结/转支付/解冻） |
| 生态开放 | 支付链接聚合收银台（一码多付）、应用维度路由（appKey）、业务方 Webhook 推送 |
| 可观测 | 回调日志、支付事件 Outbox 管理、运维健康指标、财务报表（日切快照） |

后台共 **20 个管理页面**（`/payment/*`），清单见[后台管理页面](./admin.md)。

## 关键工程决策

| 决策 | 说明 |
| --- | --- |
| 金额一律整数「分」 | 全链路（DB / API / 前端交互）金额单位为分，仅展示层格式化为元，避免浮点误差 |
| 单表订单 + `bizType`/`bizId` 松耦合 | 支付订单不外键关联业务表，业务方以 `bizType + bizId` 标识来源单据 |
| 适配器模式 | 渠道差异（签名、报文、状态映射）封装在 `packages/server/src/lib/payment/`，服务层只面向统一接口 |
| 事件 Outbox | 支付/退款的成功与失败事件全部先落 `payment_events` 表再派发，进程崩溃后由 cron 补投，保证至少一次送达 |
| 状态机 + 条件更新 | 订单状态流转全部使用「条件 UPDATE」原子推进，回调重复送达天然幂等 |
| 密钥加密落库 | 渠道私钥/密钥 AES-256-GCM 加密存储，API 响应只返回脱敏摘要，解密仅发生在适配器调用瞬间 |
| sandbox 沙箱模式 | 每个渠道配置可开启沙箱：不外呼真实渠道，返回模拟凭据，配合「模拟支付成功」完成全链路演示 |

## 数据模型

支付域共 25+ 张表（`packages/server/src/db/schema/payment.ts`），按能力分组：

### 基础交易

| 表 | 职责 |
| --- | --- |
| `payment_channel_configs` | 渠道配置（微信/支付宝/云闪付密钥、网关、沙箱开关、默认标记），密钥加密存储 |
| `payment_orders` | 支付订单：单号、业务标识、金额（含原价/优惠/手续费/净额）、渠道凭据、状态机、归属应用与部门 |
| `payment_refunds` | 退款单：可退余额校验、审批链（申请人/审批人/审批状态）、渠道退款单号 |
| `payment_notify_logs` | 回调日志（追加型）：原始报文、请求头、验签结果、来源 IP、关联订单号 |
| `payment_events` | 事件 Outbox：5 类支付/退款事件的可靠投递队列（pending/done/failed，最多重试 5 次） |

关键唯一索引：

- `payment_orders_channel_out_trade_no_uq`——渠道侧幂等键
- `payment_orders_active_biz_uq`（部分索引）——同一 `bizType + bizId` 至多一笔进行中订单，业务防重的 DB 兜底
- `payment_ledger_order_type_uq` / `payment_ledger_refund_uq`——记账幂等的 DB 兜底

### 资金运营

| 表 | 职责 |
| --- | --- |
| `payment_ledger_entries` | 资金台账流水：`direction`（in/out）×`type`（payment/refund/fee/settlement/adjust/transfer） |
| `payment_accounts` | 渠道×租户资金账户快照：待结算 / 可用 / 冻结三段余额，随台账流水原子联动 |
| `payment_fee_rules` | 手续费费率规则：万分比 + 固定费 + 上下限，按渠道/方式匹配 |
| `payment_settlement_batches` | 结算批次：按渠道 + 账期聚合，净额 = 收款 − 手续费 − 退款 |
| `payment_transfers` | 转账/代付单：微信零钱 / 支付宝账户，渠道幂等键 `(channel, out_transfer_no)` |
| `payment_sharing_receivers` / `payment_sharing_orders` | 分账接收方与分账单，确定性单号幂等 |

### 对账 / 风控 / 争议

| 表 | 职责 |
| --- | --- |
| `payment_recon_batches` / `payment_recon_items` | 对账批次与逐笔比对结果（含差异处理工作流字段） |
| `payment_risk_rules` | 风控规则：黑名单 / 白名单 / 单笔限额 / 单日限额 / 单日笔数，动作 block 或 review |
| `payment_risk_hits` | 风控命中留痕（追加型） |
| `payment_risk_reviews` | 人工审核队列：同一订单至多一条待审（唯一索引） |
| `payment_disputes` / `payment_dispute_replies` | 交易投诉工单与处理时间线 |

### 进阶交易 / 生态

| 表 | 职责 |
| --- | --- |
| `payment_deduct_plans` / `payment_contracts` | 周期扣款计划与签约协议（自动扣款、失败重试、达上限自动暂停） |
| `payment_preauths` | 预授权单：冻结 → 转支付 / 解冻 |
| `payment_links` | 支付链接：token 公开收银台，一码多付 |
| `payment_apps` | 应用维度：`appKey` 唯一，绑定三渠道配置，下单时按应用路由 |
| `payment_method_configs` | 支付方式启停与展示配置（收银台 7 种方式） |
| `payment_webhook_endpoints` / `payment_webhook_deliveries` | 业务方 Webhook 端点与投递日志（HMAC 签名、指数退避重试） |
| `payment_report_daily` | 财务报表日切快照（历史整日走快照、今日实时聚合） |

## 订单状态机

```text
pending ──(渠道下单成功)──▶ paying ──(回调/查单成功)──▶ success
   │                          │                          │
   │(渠道下单失败)             │(超时/主动关单)            │(发起退款)
   ▼                          ▼                          ▼
 failed                    closed                    refunding ──▶ refunded（全额退完）
                                                         │
                                                         └──▶ success（部分退款后回到成功态）
```

- 超时关单由 cron `closeExpiredPaymentOrders` 兜底（先向渠道查单确认未支付，防误关边界支付）。
- 所有状态推进都通过条件更新完成，任何路径（同步返回 / 异步回调 / 主动查单 / 运营模拟支付）重复触发均幂等。

## 渠道与支付方式

支付渠道 3 个：`wechat`（微信支付 v3）、`alipay`（支付宝开放平台）、`unionpay`（云闪付/银联全渠道）。

支付方式共 11 种，其中 7 种为收银台方式（统一下单入参仅接受这 7 种），4 种由签约代扣 / 预授权模块内部使用：

| 分类 | 方式 | 说明 |
| --- | --- | --- |
| 收银台 | `wechat_native` | 微信扫码（返回 `codeUrl`） |
| 收银台 | `wechat_jsapi` | 微信公众号/小程序（需 `openId`，返回 `jsapiParams`） |
| 收银台 | `wechat_h5` | 微信 H5（返回 `payUrl`） |
| 收银台 | `alipay_page` | 支付宝电脑网站（返回 `formHtml`） |
| 收银台 | `alipay_wap` | 支付宝手机网站（返回 `formHtml`） |
| 收银台 | `alipay_app` | 支付宝 APP（返回 `appOrderStr`） |
| 收银台 | `unionpay_qr` | 云闪付二维码（返回 `codeUrl`） |
| 签约代扣 | `wechat_papay` / `alipay_cycle` | 周期扣款单使用，见[后台管理页面 · 签约代扣](./admin.md#签约代扣) |
| 预授权 | `wechat_preauth` / `alipay_preauth` | 预授权转支付单使用，见[后台管理页面 · 预授权](./admin.md#预授权) |

枚举的单一事实来源在 `packages/shared/src/payment/constants.ts`（`PAYMENT_CHANNELS` / `PAYMENT_METHODS` / `PAYMENT_CASHIER_METHODS` 等），前后端与 Zod 校验均从此派生。

## 与会员体系的联动

支付中心与前台会员体系有两条内置联动链路（订阅者注册于 `packages/server/src/bootstrap/subscribers.ts`）：

**钱包充值**（`bizType='member_recharge'`）：

1. 会员在前台发起充值：`POST /api/member/wallet/recharge`（会员态鉴权 + `idempotencyGuard` 幂等，支持传 `memberCouponId` 用券立减）；
2. 服务端调用统一门面 `createPayment` 创建支付订单，返回支付凭据；
3. 支付成功回调后，`payment.succeeded` 事件订阅者以「事务 + 乐观锁 + 原子写流水」为会员钱包入账（按订单号幂等，重复事件不会重复入账）。

**VIP 自动续费**（`bizType='member_renewal'`）：会员续费订单支付成功后，订阅者自动延长会员有效期。

用券支付时订单会记录 `originalAmount` / `discountAmount` / `memberCouponId`，优惠券在下单时锁定（frozen）、支付成功核销（used）、订单关闭或失败自动释放回可用（unused）。
