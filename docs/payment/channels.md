# 渠道适配与配置

渠道层代码位于 `packages/server/src/lib/payment/`，通过适配器模式封装各渠道差异：

```text
packages/server/src/lib/payment/
├── types.ts               # PaymentAdapter 接口、AdapterContext、各方法出入参类型
├── registry.ts            # 适配器注册表：registerAdapter / getAdapter
├── index.ts               # initPaymentAdapters()：注册微信/支付宝/云闪付三个适配器
├── wechat.adapter.ts      # 微信支付 v3（RSA-SHA256 签名、AES-256-GCM 回调解密）
├── wechat-certs.ts        # 微信平台证书自动下载与缓存（按 serial 选证，12h TTL）
├── alipay.adapter.ts      # 支付宝开放平台（RSA2/RSA 签名验签）
├── unionpay.adapter.ts    # 云闪付/银联全渠道（5.1.0 signMethod=01，SHA256+RSA）
└── signing.ts             # 共享签名工具
```

`initPaymentAdapters()` 在服务启动时由 `src/bootstrap/subscribers.ts` 调用，将三个适配器注册进 registry；服务层通过 `getAdapter(channel)` 取用，不感知渠道细节。

## 适配器接口

`PaymentAdapter`（`types.ts`）分为**必选基础方法**与**可选扩展方法**，新渠道只需实现基础方法即可接入统一收银台，扩展能力按渠道支持度渐进实现：

```ts
export interface PaymentAdapter {
  channel: PaymentChannel;

  // ── 基础交易（必选）─────────────────────────────────
  createPayment(ctx, order): Promise<CreatePaymentChannelResult>;  // 下单，返回支付凭据
  queryPayment(ctx, order): Promise<PaymentQueryResult>;           // 查单（对账/补单）
  closePayment(ctx, order): Promise<void>;                         // 关单
  refund(ctx, order, refund): Promise<RefundResult>;               // 退款
  queryRefund(ctx, order, refund): Promise<RefundQueryResult>;     // 退款查询
  verifyNotify(ctx, req): Promise<NotifyVerifyResult>;             // 回调验签 + 报文解析

  // ── 可选扩展能力 ────────────────────────────────────
  testConnectivity?(ctx): Promise<void>;                // 连通性测试（配置页「测试连接」）
  profitShare?(ctx, order, receiver, outSharingNo);     // 请求分账
  queryProfitShare?(ctx, order, outSharingNo);          // 分账结果查询
  transfer?(ctx, input): Promise<TransferResult>;       // 转账/代付
  queryTransfer?(ctx, input): Promise<TransferQueryResult>;
  signContract?(ctx, input);                            // 签约（周期扣款协议）
  terminateContract?(ctx, contract);                    // 解约
  deductContract?(ctx, contract, order);                // 按协议发起扣款
  preauthFreeze?(ctx, preauth);                         // 预授权冻结
  preauthCapture?(ctx, preauth, order, amount);         // 预授权转支付
  preauthRelease?(ctx, preauth);                        // 预授权解冻
  downloadBill?(ctx, billDate): Promise<ChannelBillRow[]>;  // 渠道对账单下载
}
```

`AdapterContext` 携带当次调用所需的渠道配置行与**已解密**的密钥（`secrets`：微信 APIv3 Key/商户私钥、支付宝应用私钥、银联商户私钥）。解密仅发生在调用瞬间，密钥不落日志、不进 API 响应。

## 三渠道能力矩阵

| 能力 | 微信支付 v3 | 支付宝 | 云闪付（银联） |
| --- | :-: | :-: | :-: |
| 收银台方式 | native / jsapi / h5 | page / wap / app | qr（二维码申码） |
| 查单 / 关单 / 退款 / 退款查询 | ✅ | ✅（银联无关单接口，超时单由本地状态机 + cron 关闭） | ✅ / 本地关单 / ✅ / ✅ |
| 回调验签 | ✅ 平台证书验签 + AES-256-GCM 解密 | ✅ RSA2/RSA 验签 | ✅ SHA256+RSA（signMethod=01） |
| 连通性测试 | ✅ | ✅ | ✅ |
| 分账 | ✅ 真实 API（接收方未添加时自动 `receivers/add` 后重试） | ⚠️ 模拟实现（`alipay.trade.order.settle` 需签约分账协议，暂未接真实 API），无分账结果查询 | — |
| 转账/代付 | ✅ 商家转账到零钱 | ✅ 单笔转账 `fund.trans.uni.transfer` | — |
| 签约代扣 | ✅（`wechat_papay`） | ✅（`alipay_cycle`） | — |
| 预授权 | ✅（`wechat_preauth`） | ✅（`alipay_preauth`） | — |
| 对账单自动下载 | ✅ 交易账单 `tradebill`（动态解析表头转标准 CSV） | ❌ 账单为 zip 包，暂不支持自动拉取（可手动上传 CSV） | — |

三个适配器均支持 `sandbox` 沙箱模式：不外呼真实渠道，返回模拟凭据（如 `SBX` 前缀单号、演示二维码串），配合后台「模拟支付成功」完成全链路演示；扩展能力在沙箱下同样返回模拟成功结果。

## 渠道配置管理

后台页面：**支付管理 → 支付渠道**（`/payment/channels`）。同一渠道可建多份配置（如多商户号），通过「设为默认」切换统一下单的缺省路由。

### 配置字段

| 渠道 | 字段 | 说明 |
| --- | --- | --- |
| 通用 | `name` / `channel` / `status` / `isDefault` / `sandbox` / `notifyUrl` / `remark` | `notifyUrl` 留空时按 `PAYMENT_NOTIFY_BASE_URL`（或 `PUBLIC_BASE_URL`）+ 固定路径拼接 |
| 微信 | `wechatAppId` / `wechatMchId` / `wechatApiV3Key`🔒 / `wechatPrivateKey`🔒 / `wechatSerialNo` / `wechatPlatformCert` | 平台证书可留空——回调验签时自动经 `GET /v3/certificates` 下载并按 serial 缓存（12h） |
| 支付宝 | `alipayAppId` / `alipayPrivateKey`🔒 / `alipayPublicKey` / `alipaySignType`（RSA2/RSA） / `alipayGateway` | 网关留空默认官方正式网关 |
| 云闪付 | `unionpayMerId` / `unionpayCertId` / `unionpayPrivateKey`🔒 / `unionpayPublicKey` / `unionpayGateway` | 银联全渠道 5.1.0 规范，`certId` 为签名证书序列号 |

🔒 标记的字段 AES-256-GCM 加密落库；列表与详情接口只返回脱敏摘要（如 `wechatApiV3KeyMasked`），编辑时留空表示不修改原值。

### 配置解析优先级

统一下单时渠道配置按以下优先级解析（`resolveChannelConfig`）：

1. **`appKey`**——按应用路由：取 `payment_apps` 中该应用绑定的对应渠道配置（优先级最高，与 `channelConfigId` 互斥）；
2. **`channelConfigId`**——显式指定配置；
3. **默认配置**——该渠道 `isDefault=true` 且 `enabled` 的配置（多租户环境按租户过滤）。

回调验签不依赖单一配置：`handleNotify` 会**遍历该渠道所有启用配置逐个验签**，任一配置验签通过即处理，天然支持多商户号并存。

### 连通性测试

配置页「测试连接」调用适配器 `testConnectivity`：微信请求平台证书接口、支付宝调用网关探活、银联走申码接口探测，验证密钥/证书配置正确性；沙箱配置直接返回成功。

## 新增渠道步骤

1. **枚举**：在 `packages/shared/src/payment/constants.ts` 的 `PAYMENT_CHANNELS` / `PAYMENT_METHODS`（及 `PAYMENT_CASHIER_METHODS`、`PAYMENT_METHOD_CHANNEL` 映射、LABELS）中登记新渠道与支付方式；同步 `packages/server/src/db/schema/payment.ts` 的 pg enum（需迁移）。
2. **配置字段**：在 `payment_channel_configs` 表与 `createPaymentChannelConfigSchema` 中增加该渠道的密钥字段，密钥字段走加密存储与脱敏返回。
3. **适配器**：新建 `xxx.adapter.ts` 实现 `PaymentAdapter` 基础 6 方法（扩展方法按需），在 `lib/payment/index.ts` 的 `initPaymentAdapters()` 中注册。
4. **回调端点**：`POST /api/public/payment/notify/{channel}` 的 channel 枚举加入新值（`routes/payment/payment-public.ts`）。
5. **前端**：渠道配置页新增表单区块；`PAYMENT_CHANNEL_TAG_COLOR` 等展示映射补充新渠道。
6. **种子与 Mock**：支付方式种子（`payment_method_configs`）与 MSW mock 数据同步。
