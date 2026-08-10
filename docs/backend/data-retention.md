# 数据保留

日志与流水表的保留口径由**统一的数据保留框架**管理：策略以代码声明为准，运行期配置存库可调，删除由唯一的执行引擎完成，每天由单个系统任务驱动。

不要为单张日志表新增独立的清理任务或清理函数。

## 组成

| 位置 | 职责 |
| --- | --- |
| `src/lib/retention/policies.ts` | 策略声明（SSOT）：表名、时间列、默认保留天数、清理模式 |
| `src/lib/retention/runner.ts` | 唯一的删除实现：分批删除、逐租户裁剪、预览、执行结果写回 |
| `retention_policies` 表 | 运行期可调配置：启用开关、保留天数、单批行数、上次执行结果 |
| `data-retention` 系统任务 | 每天 03:00 遍历全部启用策略执行 |
| `/system/retention` 页面 | 后台查看与调整策略、预览待清理行数、手动执行 |

## 保留口径

- **单位统一为「天」**，全库不使用月 / 小时口径。
- **`0` 表示永久保留**，不清理。这是全局唯一语义，手动清理入口也不例外。
- 代码声明的 `defaultDays` **只在策略首次注册时写入**数据库；之后管理员在后台调整的值不会被重启覆盖。
- 代码中删除某条策略后，其残留配置行会在下次启动时自动清除。

## 清理模式

| 模式 | 行为 | 适用 |
| --- | --- | --- |
| `age` | 按时间列裁剪超期行 | 绝大多数日志表 |
| `ageAndCap` | 在 `age` 之上，再按 `capColumn` 分组只保留最近 `capLimit` 行 | 运行日志（既限时间也限条数） |
| `expiresAt` | 按行内到期列裁剪 | 到期时间在写入时即确定的表 |

另有两个正交能力：

- `perTenant`：返回各租户各自的保留天数，未覆盖的租户回落到全局配置。用于业务域自带保留设置的场景（如数据分析的埋点 / 错误保留天数）。
- `onDeleted`：删除完成后的副作用钩子，用于回收关联资源（如清理无引用的错误分组）。

## 新增策略

在 `src/lib/retention/policies.ts` 的 `RETENTION_POLICIES` 中追加一条：

```ts
{
  key: 'payment_notify_logs',        // 必须等于物理表名
  title: '支付回调日志',
  module: '支付中心',                 // 后台按模块分组展示
  tableName: 'payment_notify_logs',
  timeColumn: 'created_at',          // 物理列名，注意有些表是 started_at / occurred_at
  defaultDays: 365,
  description: '渠道异步回调原始报文，用于对账与纠纷举证。',
}
```

要点：

- **时间列必须建索引**，否则清理与列表查询都会全表扫描。
- `key` 与 `tableName` 必须一致，`policies.test.ts` 会断言。
- 新增 append-only 表（表名以 `_logs` / `_records` / `_events` / `_runs` / `_history` / `_snapshots` / `_deliveries` / `_hits` / `_samples` 结尾）**必须**登记策略，或在 `policies.test.ts` 的 `EXEMPT` 中写明豁免理由——否则测试失败。

## 分批删除

`runner.ts` 使用 `ctid` 定位 + `LIMIT` 分批，通过 `rowCount` 统计删除量，内存占用与删除行数无关：

```sql
DELETE FROM {table}
WHERE ctid IN (
  SELECT ctid FROM {table}
  WHERE {timeColumn} < {cutoff}
  LIMIT {batchSize}
)
```

删满一批则继续下一批，直到某批不足 `batchSize` 为止；单次执行最多 200 批，避免单表长时间占用清理窗口。

**禁止**在清理逻辑中使用 `.returning({ id })` 统计删除量——它会把全部被删主键载入内存，积压数据量大时会打爆进程。

## 手动清理

登录日志、操作日志、定时任务日志、终端录屏的列表页保留了「清除」入口，统一按天数触发，内部复用同一套分批实现。`/system/retention` 页面则可对任意策略预览待清理行数并立即执行。

手动执行会绕过策略的启用开关（停用状态下仍可手动清理），但不会绕过分批与索引约束。

## API

| 方法 | 路径 | 权限 |
| --- | --- | --- |
| GET | `/api/retention-policies` | `system:retention:view` |
| PUT | `/api/retention-policies/{key}` | `system:retention:edit` |
| GET | `/api/retention-policies/{key}/preview` | `system:retention:view` |
| POST | `/api/retention-policies/{key}/run` | `system:retention:run` |

## 超大表

对每天百万行级的表（如 `operation_logs`、`user_events`），`DELETE` 会产生大量 dead tuple，依赖 autovacuum 回收，表与索引持续膨胀。这类表建议改用 PostgreSQL 原生 RANGE 分区，用 `DROP TABLE` 旧分区替代 `DELETE`——回收是 O(1) 且无膨胀。
