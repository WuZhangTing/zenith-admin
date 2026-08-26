# 求值接入

规则中心的业务接入统一走 `decide()`。业务方只传资产引用、事实数据和调用元信息，不直接读取规则表或解析资产快照。

## decide() 门面

位置：`packages\server\src\services\platform\rules-runtime.service.ts`

```ts
await decide(
  { kind: 'table', key: 'payment_risk' },
  { order, today, hit, subject },
  { caller: 'payment.risk', tenantId, bizRef: 'payment:order:ORD1' },
);
```

### 参数

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `ref.kind` | `'table' \| 'flow' \| 'scorecard' \| 'list'` | 资产类型 |
| `ref.key` | `string` | 资产 key |
| `facts` | `Record<string, unknown>` | 决策表、决策流、评分卡使用的输入 scope |
| `opts.caller` | `string` | 调用方标识，用于留痕与展示名解析 |
| `opts.mode` | `'optional' \| 'required'` | 默认 `optional` |
| `opts.source` | `'runtime' \| 'manual' \| 'test' \| 'open'` | 默认 `runtime` |
| `opts.tenantId` | `number \| null` | 显式租户；未传时取当前登录用户有效租户；无上下文为未指定 |
| `opts.version` | `number` | 仅决策表支持，指定发布版本 |
| `opts.bizRef` | `string \| null` | 业务关联对象，最长 128 字符 |
| `opts.subjects` | `string[]` | 仅名单使用，待检测主体集合 |

### 返回值

```ts
interface RuleDecision {
  matched: boolean;
  outputs: Record<string, unknown>;
  ref: { kind: 'table' | 'flow' | 'scorecard' | 'list'; key: string; version: number | null };
  reason?: 'no_match' | 'unique_conflict' | 'any_conflict' | 'not_found' | 'error';
  usedFallback?: boolean;
}
```

### optional / required

| 模式 | 资产不可用 | 求值异常 | 使用场景 |
| --- | --- | --- | --- |
| `optional` | 返回 `matched=false`、`reason=not_found` | 返回 `matched=false`、`reason=error` | 业务可插拔接入，规则缺失不影响主流程 |
| `required` | 抛 `HTTPException(400)` | 原样上抛 | 开放平台 evaluate、必须配置规则的调用 |

`decide()` 只跑发布快照：决策表支持灰度选版，决策流取 `publishedSteps`，评分卡取 `publishedSnapshot`。名单没有版本号。

## 资产分发语义

| kind | 运行时解析 | 留痕 |
| --- | --- | --- |
| `table` | 按 key 与租户解析发布快照；未指定版本时应用灰度选版 | 每次求值写一条 `refKind=table` |
| `flow` | 按 key 与租户解析已发布流；执行 `publishedSteps`；步骤表取发布快照 | 写一条 `refKind=flow`，未跳过的步骤另写表留痕 |
| `scorecard` | 按 key 与租户解析已发布评分卡；执行 `publishedSnapshot` | 每次求值写一条 `refKind=scorecard` |
| `list` | 按 key 与租户解析启用名单；`subjects` 全量判定 | 仅命中时写 `refKind=list` |

运行时缓存位于 `rules-runtime-cache.ts`，TTL 为 60 秒；资产发布、停用、回滚、更新、删除后会失效缓存。

## 开放平台 evaluate API

路径：`POST /api/open/v1/rules/evaluate`

授权 scope：`rules:evaluate`

请求体：

```json
{
  "kind": "table",
  "key": "payment_risk",
  "facts": {
    "order": { "amount": 10000 },
    "subject": { "userId": 1 }
  },
  "subjects": ["13800000000", "198.51.100.23"]
}
```

- `kind` 默认为 `table`，可选 `table` / `flow` / `scorecard` / `list`。
- `key` 必填。
- `facts` 传给决策表、决策流和评分卡。
- `subjects` 仅名单使用。
- 服务端以 `mode=required`、`source=open` 调用 `decide()`。
- `caller` 写为 `open.{clientId}`，执行记录页会解析为 `open.{应用名}`。
- 开放平台求值固定使用平台级资产语义（`tenantId=null`）。

## 内置业务消费方

| caller | 资产 | facts / subjects | 业务行为 | bizRef |
| --- | --- | --- | --- | --- |
| `payment.risk` | 决策表 `payment_risk` | `order.*`、`today.*`、`hit.*`、`subject.*` | 已发布且命中时输出 `action=block/review/pass`；`pass` 显式放行；未命中回退原生风控维度 | `payment:{bizType}:{bizId}` |
| `member.auth` | 名单 `risk_blacklist` | 手机号、IP | 注册 / 登录前置拦截，命中返回 403 | `member:{subject}` |
| `workflow.gateway` | `decisionRefKind` 指定的决策表 / 决策流 / 评分卡 | `form`、`starter` | 网关节点先求值，输出并入 `formData` 后走出边条件 | `workflow:{instanceId}#{nodeKey}` |
| `workflow.assignee` | 决策表 | `form`、`starter` | 审批人矩阵输出 `type` / `assigneeType` 与 `ids` / `id`，再复用用户、角色、部门、岗位解析 | `workflow:{instanceId}` |
| `member.coupon` | 决策表 `coupon_eligibility` | `member`、`coupon` | 输出 `eligible=false` 时拒绝发券；资产缺失或异常默认放行 | `member:{memberId}` |
| `cms.submit` | 名单 `risk_blacklist`、`cms_watchlist` | IP、会员 ID、email、phone | 黑名单命中 403；灰名单命中放行并写观察标注 | 调用方传入的 CMS 业务引用 |
| `payment.dispute` | 决策表 `dispute_triage` | `dispute.type`、`dispute.amount`、`history.disputeCount90d` | 输出路由、优先级和 SLA；`auto_refund_suggest` 仅作为人工退款建议 | `payment:dispute:{disputeNo}` |
| `open.{clientId}` | 请求体指定资产 | `facts` / `subjects` | 开放平台调用统一求值 | 无显式业务引用 |

## 接入约定

- 优先使用 `optional` 接入，让规则资产可缺省、可停用、可灰度。
- `facts` 使用领域命名空间，例如 `order`、`member`、`coupon`、`form`、`starter`，避免平铺键冲突。
- `bizRef` 使用稳定前缀，便于执行记录页按前缀查询，例如 `workflow:42`、`payment:dispute:DSP001`。
- 决策表输出字段由消费方解释，发布前应通过测试用例覆盖关键输出。
- 名单接入传入去敏后的业务标识或运行时标识集合，空集合直接跳过。
