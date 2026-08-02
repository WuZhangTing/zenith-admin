# 安全设计

支付链路的安全防线，从外到内依次是：验签 → 幂等 → 资金一致性 → 风控与审批 → 权限与审计。

## 安全矩阵

| 风险 | 防线 |
| --- | --- |
| 伪造回调 | 渠道签名验签（微信平台证书 / 支付宝 RSA2 / 银联 SHA256+RSA），验签失败仅记日志返回 401 |
| 重复回调 / 重复事件 | 订单状态条件更新 + Outbox 事件按订单号幂等 + 订阅者幂等履约 |
| 重复提交下单/退款 | HTTP 层 `idempotencyGuard`（15s 窗口）+ 业务层活跃订单复用 + DB 部分唯一索引兜底 |
| 并发超退 | 退款事务内 `SELECT ... FOR UPDATE` 锁单校验可退余额 |
| 转账双付 | 渠道幂等键 `(channel, out_transfer_no)` 唯一 + 仅「渠道未受理」可人工重试（上限 3 次） |
| 重复记账 | 台账唯一索引：同一订单的收款/手续费各至多一条、同一退款单至多一条 |
| 密钥泄露 | 敏感密钥 AES-256-GCM 加密落库，API 只返回脱敏摘要，解密仅在适配器调用瞬间发生 |
| 大额误退 | 退款金额阈值审批链（环境变量控制） |
| 欺诈交易 | 风控引擎：黑/白名单、限额限频、block 拦截或 review 人工审核 |
| 越权操作 | 20 个页面独立权限码 + 订单数据权限（部门 dataScope）+ 多租户隔离 |
| 争议无凭据 | 回调日志存原始报文/请求头/IP、风控命中留痕、Webhook 投递日志 |

## 密钥与证书存储

`payment_channel_configs` 中的敏感字段一律 AES-256-GCM 加密后落库：

| 渠道 | 加密存储字段 | 明文存储字段 |
| --- | --- | --- |
| 微信 | APIv3 密钥、商户私钥 | AppID、商户号、证书序列号、平台证书（公钥性质） |
| 支付宝 | 应用私钥 | AppID、支付宝公钥、签名类型、网关 |
| 云闪付 | 商户私钥 | 商户号、证书序列号、银联公钥、网关 |

- 加密密钥由环境变量 `FIELD_ENCRYPTION_KEY` 提供（未配置时回退 `JWT_SECRET` 派生密钥），密钥不入库。
- 查询接口只返回脱敏摘要（如 `wechatApiV3KeyMasked: "abc***xyz"`）；编辑时留空表示保留原值，前端永远拿不到明文。
- 适配器调用时通过 `AdapterContext.secrets` 临时解密，密钥不落日志。
- 微信平台证书自动经 `GET /v3/certificates` 下载（响应用 APIv3 Key AES-256-GCM 解密），按序列号内存缓存 12h，回调按 `Wechatpay-Serial` 头选证验签。

## 回调验签与防伪

公开回调端点（`/api/public/payment/notify/{channel}`）不做登录鉴权，安全性完全依赖验签：

- 遍历该渠道**所有启用配置**逐个验签，全部失败则记日志（`signatureValid=false`）并返回 401，不触碰任何订单；
- 验签通过后仍校验回调金额与订单金额一致；
- 状态推进走条件更新，重放同一报文无副作用。

详见[异步通知与对账](./callback.md#渠道异步通知)。

## 幂等与防重

| 层次 | 机制 |
| --- | --- |
| HTTP | 下单/退款/发起转账等写接口挂 `idempotencyGuard`：显式 `X-Idempotency-Key` 或按 `userId+method+path+bodyHash` 自动指纹，15s 内重复请求复用首次结果 |
| 业务 | 同一 `bizType+bizId` 的进行中订单复用；部分唯一索引 `payment_orders_active_biz_uq` 兜底并发 |
| 渠道 | `out_trade_no` / `out_refund_no` / `out_transfer_no` / 确定性分账单号（`SHR{订单号}R{接收方}`）作为渠道侧幂等键 |
| 事件 | Outbox at-least-once + 订阅者条件更新履约 |

## 资金一致性

- **金额全链路整数分**，杜绝浮点误差。
- **退款**：事务内锁单（`FOR UPDATE`）校验「可退余额 = 实付 − 成功退款 − 进行中退款」，并发退款请求串行化。
- **台账**：所有资金动作（收款/退款/手续费/结算/调账/转账）落 `payment_ledger_entries`，唯一索引防重复记账；渠道资金账户快照（待结算/可用/冻结）随流水原子联动，「资金台账」页提供核对（快照 vs 流水重算）与一键重建。
- **优惠券**：下单锁券（frozen）→ 成功核销（used）→ 关闭/失败自动释放（unused），实付金额至少 1 分。
- **会员钱包/积分入账**：订阅者以「事务 + 乐观锁（version）+ 原子写流水」入账，按订单号幂等。

## 退款审批

环境变量 `PAYMENT_REFUND_APPROVAL_THRESHOLD`（单位分，`0` 或未设置 = 不启用）设定大额退款审批阈值：

- `refundAmount ≥ 阈值`的退款自动进入审批流（`approvalStatus: pending`），需 `payment:refund:approve` 权限审批；
- 待审批期间**不占用**订单 `refunding` 状态，不阻塞订单其它操作；
- 审批通过才执行渠道退款；驳回置 failed 并发出 `refund.failed` 事件；
- 申请人、审批人、审批时间、审批意见全程留痕。

## 风控引擎

下单前置风控（`payment-risk.service.ts`），规则维度与动作：

| 维度 | 说明 |
| --- | --- |
| `blocklist` 黑名单 | 匹配支付账号（openid）/ 用户 ID / 客户端 IP |
| `single_limit` 单笔限额 | 单笔金额上限（分） |
| `daily_limit` 单日限额 | 同主体单日累计金额上限 |
| `daily_count` 单日笔数 | 同主体单日下单笔数上限 |

- 规则作用域：全局 / 指定渠道 / 指定业务类型（`bizType`）。
- **白名单**（allowlist）：命中白名单的主体跳过该规则。
- 动作二选一：`block`（直接拦截下单）或 `review`（订单挂起生成人工审核单，同一订单至多一条待审）。审核放行后用户重新下单可复用挂起订单；拒绝则本地关单（渠道侧从未下单）。
- 每次命中（无论 block/review）写入 `payment_risk_hits` 留痕，「风控中心 → 拦截记录」可查。

## 权限与数据权限

支付中心 20 个页面各有独立权限码（路由 `guard()` + 前端按钮级控制），完整清单：

| 页面 | 权限码 |
| --- | --- |
| 支付渠道 | `payment:channel:list / create / update / delete` |
| 支付订单 | `payment:order:list / create / close / refund` |
| 退款记录 | `payment:refund:list / approve` |
| 回调日志 | `payment:log:list` |
| 对账中心 | `payment:recon:list / create / delete / handle` |
| 资金台账 | `payment:ledger:list`、`payment:account:adjust` |
| Webhook | `payment:webhook:list / create / update / delete` |
| 支付事件 | `payment:ops:manage` |
| 费率管理 | `payment:fee:list / create / update / delete` |
| 结算管理 | `payment:settlement:list / generate / settle` |
| 分账管理 | `payment:sharing:list / manage / dispatch` |
| 支付链接 | `payment:link:list / create / update / delete` |
| 风控中心 | `payment:risk:list / create / update / delete / review` |
| 支付方式 | `payment:method:list / update` |
| 财务报表 | `payment:report:view` |
| 转账管理 | `payment:transfer:list / create` |
| 应用管理 | `payment:app:list / manage` |
| 签约代扣 | `payment:contract:list / manage / plan` |
| 交易投诉 | `payment:dispute:list / handle` |
| 预授权 | `payment:preauth:list / manage` |

- **数据权限**：支付订单列表按数据权限范围（部门 `departmentId` + 创建人 `createdBy` 的 dataScope 规则）过滤，非管理员只能看到权限范围内的订单。
- **多租户**：全部支付表带 `tenant_id`，查询自动按租户隔离。
- **审计**：渠道配置增删改、发起支付/退款/关单、审批、调账、转账、差异处理等敏感操作均记录操作日志与操作人。

## 相关环境变量

| 变量 | 说明 |
| --- | --- |
| `PAYMENT_REFUND_APPROVAL_THRESHOLD` | 退款审批阈值（分），`0`/未设置 = 不启用审批 |
| `FIELD_ENCRYPTION_KEY` | 字段级 AES-256-GCM 加密密钥（32 字节 hex；未配置回退 `JWT_SECRET` 派生） |
| `PAYMENT_NOTIFY_BASE_URL` / `PUBLIC_BASE_URL` | 回调地址基址（渠道配置未显式填 `notifyUrl` 时拼接使用） |
