# 评分卡

评分卡用于把多个变量转换为分段得分，按权重汇总为总分，并映射等级与建议决策。运行时只读取已发布的 `publishedSnapshot`。

## 数据结构

| 字段 | 说明 |
| --- | --- |
| `key` | 评分卡唯一键，字母开头，支持字母、数字、下划线、短横线 |
| `status` | `draft` / `published` / `disabled` |
| `baseScore` | 基础分，变量得分之外的起始分 |
| `variables` | 变量数组，每个变量包含取值表达式、类型、权重、未命中分与分段 |
| `grades` | 等级映射数组，按 `minScore` 从高到低匹配 |
| `publishedSnapshot` | 服务端表字段，保存已发布的 `baseScore`、`variables`、`grades` |
| `version` / `publishedAt` | 版本号与发布时间 |
| `dirty` | 已发布评分卡的编辑态与发布快照不一致 |

## 变量与分段

变量结构：

```ts
interface RuleScorecardVariable {
  key: string;
  label: string;
  expr: string;
  type: 'number' | 'string' | 'boolean';
  weight?: number;
  missingScore?: number;
  bands: RuleScorecardBand[];
}
```

分段操作：

| `op` | 说明 |
| --- | --- |
| `range` | 数值区间 `[min, max)`；`min` 为空表示负无穷，`max` 为空表示正无穷 |
| `eq` | 字符串等值比较 |
| `in` | 字符串集合比较 |
| `default` | 兜底恒命中 |

每个变量命中首个分段：

```text
变量加权分 = 分段 score × weight（缺省 1）
总分 = baseScore + 所有变量加权分
等级 = grades 按 minScore 降序，取首个 totalScore >= minScore
```

浮点得分保留 4 位小数。

## 求值结果

```ts
interface RuleScorecardEvaluateResult {
  totalScore: number;
  baseScore: number;
  grade: string | null;
  decision: string | null;
  variables: Array<{
    key: string;
    label: string;
    raw: unknown;
    matchedBand: string | null;
    score: number;
    weight: number;
    weighted: number;
    missed: boolean;
  }>;
}
```

`decision` 来自命中的等级映射，可由业务方解释为 `approve`、`review`、`reject` 等动作。

## 生命周期与版本

| 操作 | 行为 |
| --- | --- |
| 创建 / 更新 | 写编辑态配置；`key` 不可更新 |
| 发布 | 要求至少一个变量、每个变量至少一个分段、等级 `minScore` 不重复；固化 `publishedSnapshot`，写 `rule_asset_versions` 快照 |
| 启用 / 停用 | 启用要求存在发布快照；停用后运行时不可用 |
| 回滚 | 从 `rule_asset_versions` 读取快照，覆盖编辑态并置为 `draft`，线上发布快照不变 |
| 测试 | `/{id}/evaluate` 按编辑态求值，记录 source=`test` |
| 手动按 key 求值 | `/evaluate-by-key` 只取已发布快照，记录 source=`manual` |

## 删除保护

评分卡删除前扫描工作流网关节点：`decisionRuleKey` 与 `decisionRefKind=scorecard` 精确匹配时视为引用。存在引用时拒绝删除。

## 管理 API

| 方法 | 路径 | 说明 | 权限 |
| --- | --- | --- | --- |
| GET | `/api/rules/scorecards` | 分页列表，支持 `keyword`、`status` | `rule:scorecard:list` |
| GET | `/api/rules/scorecards/{id}` | 详情 | `rule:scorecard:list` |
| POST | `/api/rules/scorecards` | 创建 | `rule:scorecard:create` |
| PUT | `/api/rules/scorecards/{id}` | 更新，支持 `expectedUpdatedAt` | `rule:scorecard:update` |
| DELETE | `/api/rules/scorecards/{id}` | 删除 | `rule:scorecard:delete` |
| POST | `/api/rules/scorecards/{id}/publish` | 发布并固化快照 | `rule:scorecard:publish` |
| POST | `/api/rules/scorecards/{id}/toggle` | 启用 / 停用 | `rule:scorecard:update` |
| POST | `/api/rules/scorecards/{id}/evaluate` | 编辑态测试求值 | `rule:scorecard:evaluate` |
| POST | `/api/rules/scorecards/evaluate-by-key` | 按 key 运行时求值 | `rule:scorecard:evaluate` |
| GET | `/api/rules/scorecards/{id}/versions` | 版本历史 | `rule:scorecard:list` |
| POST | `/api/rules/scorecards/{id}/rollback/{version}` | 回滚到历史版本 | `rule:scorecard:update` |
