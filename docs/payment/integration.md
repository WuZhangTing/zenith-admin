# 业务接入

业务模块（会员充值、VIP 续费、订单支付等）通过统一门面接入支付，不直接触碰渠道 SDK。完整可运行的接入代码走读见[业务接入实战示例](./integration-example.md)。

## 服务端统一门面

`packages/server/src/services/payment/payment.service.ts` 导出核心门面：

```ts
import { createPayment, queryPayment, closePayment, refund } from '../payment/payment.service';

// 1. 下单：返回订单号与支付凭据（按 payMethod 返回对应字段）
const { orderNo, payParams } = await createPayment({
  bizType: 'member_recharge',   // 业务类型（自定义，事件路由的依据）
  bizId: String(rechargeId),    // 业务单据 ID
  subject: '钱包充值',
  amount: 9900,                 // 分
  payMethod: 'wechat_native',   // 收银台 7 种方式之一
  openId,                       // wechat_jsapi 必填
  userId,                       // 可选：关联操作用户
  appKey,                       // 可选：按应用路由渠道配置（优先于 channelConfigId）
  channelConfigId,              // 可选：显式指定渠道配置，缺省用该渠道默认配置
  expireMinutes: 30,            // 可选：订单有效期，默认 30 分钟
});

// 2. 查询（按订单号，返回订单 DTO）
const order = await queryPayment(orderNo);

// 3. 关单（未支付订单主动关闭，向渠道关单后本地置 closed）
await closePayment(orderNo);

// 4. 退款（支持多次部分退款；金额达到审批阈值时进入审批流，见下文）
const { refundNo, status } = await refund({ orderNo, refundAmount: 500, reason: '用户申请' });
```

`payParams`（`CreatePaymentResult`）按支付方式返回凭据字段：`codeUrl`（native/unionpay_qr 二维码串）、`jsapiParams`（JSAPI 调起参数）、`payUrl`（H5 跳转链接）、`formHtml`（支付宝网页表单）、`appOrderStr`（支付宝 APP 订单串），以及 `orderNo` / `payMethod` / `channel` / `expiredAt`。

### 下单内部流程

`createPayment` 在落库前后依次执行以下环节（对业务方透明，但影响接入行为，需要了解）：

| 环节 | 行为 |
| --- | --- |
| 渠道路由 | `payMethod → channel` 映射；`appKey`（应用绑定配置）优先于 `channelConfigId`，均缺省时取该渠道默认启用配置 |
| 支付方式启停 | `payment_method_configs` 中被禁用的方式直接拒绝下单 |
| 风控前置 | 存在同订单待审核风控单时拒绝；命中 block 规则拦截并留痕；命中 review 规则时订单挂起等待人工审核（下单接口返回明确错误提示） |
| 业务防重 | 同一 `bizType + bizId` 已有进行中（pending/paying）订单时：参数一致直接**复用原订单**返回凭据；金额或方式变化则先向渠道查单确认未支付，再关旧单建新单；并发场景由部分唯一索引 `payment_orders_active_biz_uq` 兜底 |
| 优惠券立减 | 内部入参支持 `memberCouponId + couponMemberId`（会员侧链路使用）：下单锁券（unused→frozen），实付 = 金额 − 优惠且至少 1 分，订单记录 `originalAmount` / `discountAmount` |
| 渠道下单 | 生成 `PAY` 前缀订单号，调适配器下单成功后 pending→paying；渠道失败置 failed 并发出 `payment.failed` 事件 |

### 退款与审批

- 可退余额在事务内 `SELECT ... FOR UPDATE` 锁单校验（扣除进行中/已成功退款），杜绝并发超退。
- 环境变量 `PAYMENT_REFUND_APPROVAL_THRESHOLD`（单位分，`0`/未设置 = 不启用）设定审批阈值：`refundAmount ≥ 阈值`的退款单进入 `approvalStatus=pending`，**不占用订单 refunding 状态**，由具备 `payment:refund:approve` 权限的人在后台审批；通过后执行渠道退款，驳回置 failed 并发出 `refund.failed` 事件。
- 免审批（低于阈值）的退款立即执行渠道退款。
- 全额退完订单置 refunded；部分退款完成后订单回到 success。

## 字段约定

| 字段 | 约定 |
| --- | --- |
| `amount` / `refundAmount` | **整数，单位分**，正数 |
| `bizType` | 业务类型标识（如 `member_recharge` / `member_renewal` / `biz_pay_demo`），订阅者按它路由事件 |
| `bizId` | 业务单据 ID（字符串），与 `bizType` 组合定位业务单 |
| `orderNo` | 支付中心订单号（`PAY` 前缀），业务表建议冗余存储用于对账与查询 |
| `payMethod` | 统一下单仅接受收银台 7 种方式（`PAYMENT_CASHIER_METHODS`）；`wechat_jsapi` 必须携带 `openId` |
| 时间 | 所有时间字段 `YYYY-MM-DD HH:mm:ss` 字符串 |

## HTTP 接口

后台/业务前端也可以走 HTTP 接口（均需管理端鉴权与对应权限码，见[安全设计](./security.md)）：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/payment/orders` | 统一下单（挂 `idempotencyGuard`，重复提交 15s 内直接复用首次结果） |
| GET | `/api/payment/orders` | 订单列表（关键字/状态/渠道/时间筛选，受数据权限约束） |
| GET | `/api/payment/orders/{id}` | 订单详情 |
| GET | `/api/payment/orders/by-no/{orderNo}` | 按订单号查询详情 |
| GET | `/api/payment/orders/{id}/refunds` | 订单关联退款单 |
| POST | `/api/payment/orders/{id}/query` | 主动向渠道查单并同步状态（补单） |
| POST | `/api/payment/orders/{id}/close` | 关闭订单 |
| POST | `/api/payment/refunds` | 发起退款（挂 `idempotencyGuard`） |
| GET | `/api/payment/refunds` / `/refunds/{id}` | 退款列表 / 详情 |
| POST | `/api/payment/refunds/{id}/query` | 主动同步退款状态 |
| POST | `/api/payment/refunds/{id}/approve` / `/reject` | 审批通过（执行渠道退款）/ 驳回 |
| GET | `/api/payment/stats` / `/api/payment/trend?days=N` | 统计概览 / 收款趋势 |

会员前台充值接口 `POST /api/member/wallet/recharge`（会员态鉴权 + 幂等，支持 `memberCouponId` 用券）是「前台业务调用统一门面」的标准范例。

## 订阅支付结果事件

支付结果通过**事件总线 + Outbox** 送达业务方，这是接入的核心：业务方**不要**轮询订单状态，而应订阅事件完成履约。

### 事件类型与载荷

`packages/server/src/lib/payment-event-bus.ts` 定义 5 类事件，**全部**经 Outbox（`payment_events` 表）持久化后派发（先与订单状态同事务落库，再由派发器投递，至少一次送达）：

| 事件 | 触发时机 |
| --- | --- |
| `payment.succeeded` | 订单支付成功（回调 / 主动查单 / 运营模拟支付任一路径） |
| `payment.closed` | 订单关闭（主动关单 / 超时自动关单） |
| `payment.failed` | 渠道下单失败 |
| `refund.succeeded` | 退款到账 |
| `refund.failed` | 退款失败 / 退款审批被驳回 |

```ts
export interface PaymentEvent {
  eventId: string;         // 事件唯一 ID
  type: PaymentEventType;
  occurredAt: string;      // YYYY-MM-DD HH:mm:ss
  orderNo: string;         // 支付中心订单号
  outTradeNo: string;
  bizType: string;         // 业务路由依据
  bizId: string;
  channel: PaymentChannel;
  amount: number;          // 分
  refundNo?: string;       // 退款事件携带
  refundAmount?: number;
  userId?: number | null;
  tenantId?: number | null;
}
```

### 订阅示例

订阅者统一在 `packages/server/src/bootstrap/subscribers.ts` 的 `registerEventSubscribers()` 中注册（应用启动时调用一次）：

```ts
// packages/server/src/services/xxx/xxx-subscribers.ts
import { paymentEventBus } from '../../lib/payment-event-bus';

export function registerXxxPaymentSubscribers(): void {
  paymentEventBus.on('payment.succeeded', async (e) => {
    if (e.bizType !== 'xxx_order') return;   // 只处理自己的业务类型
    await fulfillXxxOrder(e.bizId, e.orderNo); // 必须幂等！
  });

  paymentEventBus.on('payment.closed', async (e) => {
    if (e.bizType !== 'xxx_order') return;
    await cancelXxxOrder(e.bizId);
  });
}
```

**订阅者必须幂等**：Outbox 保证「至少一次」送达，事件可能重复投递。推荐用「条件更新」实现（如 `UPDATE ... WHERE status = 'pending'`），或按 `orderNo` 判重。handler 抛错会触发 Outbox 重试（最多 5 次，此后进入 failed 死信，可在「支付事件」页人工重派）。

### WebSocket 前端推送

订单归属用户（`userId`）会收到站内 WebSocket 推送，前端可据此实时刷新界面：`payment:success`、`payment:closed`、`payment:failed`、`payment:refunded`、`payment:refund-failed`。

### 业务方 Webhook（跨系统）

外部系统无法进程内订阅时，可在「支付管理 → Webhook」配置 HTTP 端点接收上述事件（HMAC-SHA256 签名 + 指数退避重试），详见[异步通知与对账](./callback.md#业务方-webhook-投递)。

## 幂等与防重

| 层次 | 机制 |
| --- | --- |
| HTTP 层 | 下单/退款接口挂 `idempotencyGuard`：客户端可显式传 `X-Idempotency-Key`，否则按 `userId+method+path+bodyHash` 自动指纹，15 秒窗口内重复请求直接返回首次结果 |
| 业务层 | 同一 `bizType + bizId` 复用进行中订单（见上文下单流程），部分唯一索引 DB 兜底 |
| 回调层 | 订单状态条件更新，重复回调/重复事件天然幂等 |
| 履约层 | 订阅者自行保证幂等（条件更新 / 按订单号判重） |

## 金额规范

- 全链路整数「分」：DB 列、API 出入参、事件载荷均为分。
- 展示层格式化为元（前端公共工具 `packages/web/src/utils/payment.ts` 的 `formatYuan`）。
- 手续费（`feeAmount`）与净额（`netAmount`）由计费订阅者在支付成功后回写订单，业务方无需处理。

## 进阶交易能力

超出「一次性收款」的场景由独立模块提供，均复用统一订单与事件链路：

- **签约代扣**（周期扣款）：创建扣款计划与签约协议后由 cron 自动按期扣款，扣款单也是 `payment_orders`（`bizType`/`bizId` 继承协议），支付成功事件照常派发——业务方订阅逻辑完全复用。见[后台管理页面 · 签约代扣](./admin.md#签约代扣)。
- **预授权**（押金冻结）：冻结 → 转支付 / 解冻；转支付生成支付订单走完整履约链。见[后台管理页面 · 预授权](./admin.md#预授权)。
- **支付链接**（免开发收款）：后台创建链接即可对外收款，公开收银台自动识别访问环境推荐支付方式。见[后台管理页面 · 支付链接](./admin.md#支付链接)。
