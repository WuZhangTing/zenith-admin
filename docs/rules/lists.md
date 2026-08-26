# 名单库

名单库维护可复用的黑名单、白名单和灰名单。业务侧通过 `checkRuleListsBatch()` 或 `decide({ kind: 'list' })` 执行批量命中判定；名单命中时写入统一执行留痕。

## 名单类型

| 类型 | 枚举值 | 典型语义 |
| --- | --- | --- |
| 黑名单 | `black` | 命中即拒绝或触发风控动作 |
| 白名单 | `white` | 命中即放行或跳过部分检查 |
| 灰名单 | `grey` | 命中后标注观察，不一定阻断 |

名单状态为 `enabled` / `disabled`。禁用名单不会参与运行时判定。

## 条目匹配模式

| 模式 | 枚举值 | 行为 |
| --- | --- | --- |
| 精确 | `exact` | 输入值与条目值完全相等；走索引批查 |
| 前缀 | `prefix` | 输入值以条目值开头 |
| 正则 | `regex` | 使用条目值构造 `RegExp` 后匹配输入值 |

正则条目创建时会校验可编译，且长度最多 128 字符。条目支持 `expiresAt`，过期条目不命中，可通过接口清理。

## 批量判定语义

`checkRuleListsBatch(keys, values, meta)` 的运行时行为：

1. 对 `keys` 与 `values` 去重、去空。
2. 按租户精确匹配优先，回退平台级名单；无上下文且单一候选时兼容使用。
3. 只使用 `enabled` 名单。
4. 过滤过期条目。
5. 精确条目批量等值查询，前缀 / 正则条目一次加载后逐条匹配。
6. 每个 `key × value` 至多返回一条命中，精确命中优先。

单 key 单值接口 `checkRuleList()` 是批量判定的薄封装。

## 删除保护

删除名单前会扫描支付风控规则中的 `blockListKeys` 与 `allowListKeys`。存在引用时拒绝删除；停用名单不受删除保护限制，可作为临时开关。

## 内置名单

| key | 名称 | 类型 | 用途 |
| --- | --- | --- | --- |
| `risk_blacklist` | 风控黑名单 | `black` | 会员认证、支付风控、CMS 提交守卫共用 |
| `vip_whitelist` | VIP 白名单 | `white` | 可信主体放行示例 |
| `cms_watchlist` | CMS 观察灰名单 | `grey` | CMS 公开提交命中后标注观察主体 |

## 管理 API

| 方法 | 路径 | 说明 | 权限 |
| --- | --- | --- | --- |
| GET | `/api/rules/lists` | 分页列表，支持 `keyword`、`type` | `rule:list:list` |
| POST | `/api/rules/lists/check` | 单 key 单值命中检测 | `rule:list:list` |
| POST | `/api/rules/lists` | 创建名单 | `rule:list:create` |
| PUT | `/api/rules/lists/{id}` | 更新名单，含启停 | `rule:list:update` |
| DELETE | `/api/rules/lists/{id}` | 删除名单，级联删除条目 | `rule:list:delete` |
| GET | `/api/rules/lists/{id}/usages` | 引用分析 | `rule:list:list` |
| GET | `/api/rules/lists/{id}/items` | 条目分页列表，支持 `keyword` | `rule:list:list` |
| POST | `/api/rules/lists/{id}/items` | 新增条目 | `rule:list:item` |
| POST | `/api/rules/lists/{id}/items/batch` | 批量导入条目，最多 500 条，重复值跳过 | `rule:list:item` |
| DELETE | `/api/rules/lists/{id}/items/{itemId}` | 删除条目 | `rule:list:item` |
| POST | `/api/rules/lists/{id}/items/purge-expired` | 清理已过期条目 | `rule:list:item` |
