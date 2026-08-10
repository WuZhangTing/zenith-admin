# 定时任务

系统的周期调度基于 **pg-boss**（PostgreSQL `SKIP LOCKED`）实现，天然支持多进程安全与精确一次执行。调度分为两层，共用同一个 pg-boss 实例（`src/lib/pg-boss-scheduler.ts`，schema `pgboss`，时区 `Asia/Shanghai`）：

| 层 | 定位 | 注册方式 | 管理页面 / API |
| --- | --- | --- | --- |
| **业务定时任务**（cron_jobs） | 运营可增删改的任务：绑定预置 handler + 自定义 cron 表达式 | 管理端 CRUD（存 `cron_jobs` 表） | `/api/cron-jobs` |
| **系统调度**（system scheduler） | 代码启动时注册的系统级周期任务与队列 Worker，不可在页面增删 | `registerSystemRecurringJob()` / `registerSystemQueueWorker()` | `/api/system-scheduler` |

启动编排在 `src/bootstrap/workers.ts`：`initCronScheduler()` 启动 pg-boss 并恢复所有 `enabled` 的业务任务，随后 `registerSystemTasks()`（`src/lib/system-tasks.registry.ts`）注册全部系统任务。整块包在 try/catch 中——调度初始化失败只降级后台能力，不影响 HTTP 服务。

## 业务定时任务（cron_jobs）

### 数据模型

`cron_jobs` 表（`src/db/schema/system.ts`）：

| 字段 | 说明 |
| --- | --- |
| `name` | 任务名（唯一，可中文；pg-boss 队列名用 `cron-job-{id}`） |
| `cronExpression` | cron 表达式（支持秒级 6 段） |
| `handler` | 绑定的 handler 名（见下文注册表） |
| `params` | 传给 handler 的字符串参数 |
| `status` | `enabled` / `disabled`（默认 disabled） |
| `retryCount` / `retryInterval` / `retryBackoff` | 失败重试次数 / 间隔（秒）/ 是否指数退避 |
| `monitorTimeout` | 执行超时（秒，映射 pg-boss `expireInSeconds`） |
| `lastRunAt` / `lastRunStatus` / `lastRunMessage` | 最近一次执行快照 |

执行历史写 `cron_job_logs`（每次执行一条：起止时间、耗时、`running/success/fail`、输出）。

### API 端点（`/api/cron-jobs`）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/` | 任务列表 |
| GET | `/{id}` | 详情 |
| POST | `/` | 新增 |
| PUT | `/{id}` | 更新（运行中任务自动重新调度） |
| DELETE | `/{id}` | 删除 |
| PUT | `/{id}/status` | 启用 / 停用 |
| POST | `/{id}/run` | 手动执行一次（等待最多 30s 返回结果，超时转后台） |
| GET | `/handlers` | 已注册 handler 名列表（前端下拉） |
| POST | `/validate` | 校验 cron 表达式 |
| GET | `/logs` / `/{id}/logs` | 执行日志（全部 / 单任务） |
| DELETE | `/logs/clean` / `/{id}/logs/clean` | 清理日志 |
| GET | `/stats` | 任务统计 |

### Handler 注册表

Handler 是预置在代码里的执行单元，注册在 `src/lib/pg-boss-scheduler.ts` 的 `handlerRegistry`。当前内置（按域）：

- **系统**：`cleanExpiredCaptchas`、`cleanExpiredSessions`、`databaseBackup`（params 选 `pg_dump` / `drizzle_export`）、`cleanupTerminalRecordings`、`cleanupUploadSessions`、`sampleSystemMetrics`、`evaluateMonitorAlerts`、`echo`（调试）
- **消息**：`publishScheduledAnnouncements`
- **支付**：`closeExpiredPaymentOrders`、`executeDueDeductions`、`syncPaymentDisputes`、`paymentReconciliation`、`dispatchPaymentEvents`、`retryPaymentWebhooks`、`retryFailedSharing`、`generateDailySettlements`、`syncPaymentTransfers`、`autoPaymentRecon`、`rebuildPaymentReportDaily`
- **数据分析**：`analyticsRollupDaily`、`analyticsSegmentRefresh`、`evaluateErrorAlerts`
- **报表**：`dispatchReportSubscriptions`、`refreshReportMaterializations`、`dispatchReportAlerts`

新增 handler：在 `handlerRegistry.set('name', async (params) => '结果消息')` 登记后即可在页面绑定。handler 返回的字符串会写入执行日志。

### 失败处理

- 按任务配置自动重试（次数 / 间隔 / 指数退避）
- 最终失败向任务创建者（无则平台 admin）推送**聊天告警卡片**「定时任务执行失败」
- `monitorTimeout` 到期由 pg-boss 判定过期失败

### 种子任务

种子数据（`SEED_CRON_JOBS`）预置并默认启用：清理过期验证码（每 30 分钟）、清理过期会话（每小时）、定时公告自动发布（每 5 分钟）、清理过期终端录屏（每天 04:00）、补投支付事件（每分钟）等。

## 系统调度（system scheduler）

系统级周期任务在启动时通过代码注册，元数据与运行日志独立于 cron_jobs：

```ts
// src/lib/system-tasks.registry.ts —— 新增系统后台任务优先放这里
await registerSystemRecurringJob({
  name: 'export-file-cleanup',        // 唯一名（pg-boss 队列名）
  title: '导出文件自动清理',
  module: '导出中心',
  cronExpression: '0 3 * * *',
  description: '每天清理已过期的导出文件。',
  allowManualRun: true,
  run: async () => `清理了 ${n} 个过期导出文件`,
});
```

当前注册约 30 个任务，覆盖：导出文件清理、开放平台（配额告警补偿、Webhook 重试、调用日志聚合）、工作流（定时发起扫描、作业兜底、引擎健康采集、token 清理）、任务中心（兜底扫描、记录清理）、报表（填报对账、数据质量 / SLA 扫描、物化快照清理、资产弃用扫描）、CMS（定时发布、站群分发、回收站 / 统计日志 / 广告事件清理）、公众号（客服会话维护、群发扫描）、消息（频道 / 聊天定时消息）、租户到期巡检、会员例行维护等。

### 运行时策略与可观测

- 每个任务的运行策略可在页面调整（存 `system_scheduler_task_configs`）：启用开关、日志保留（天数 / 条数）、超时、失败告警阈值、告警渠道（站内信 / 邮件 / Webhook）与接收人、手动执行互斥（`manualSingleton`）
- 每次执行写 `system_scheduler_runs`（触发方式 `schedule/manual/queue`、执行节点、耗时、结果 / 错误、告警回执与确认）
- 多实例部署时各节点心跳登记在 `system_scheduler_nodes`，页面可见每个任务由哪个节点执行

### API 端点（`/api/system-scheduler`）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/tasks` | 任务列表（注册元数据 + 运行统计 + 队列指标） |
| POST | `/tasks/{name}/run` | 手动执行 |
| PUT | `/tasks/{name}/config` | 更新运行策略 |
| GET | `/runs` / `/runs/{id}` | 运行日志（分页 / 详情） |
| POST | `/runs/{id}/ack-alert` | 确认告警 |
| POST | `/runs/cleanup` | 手动清理运行日志 |
| GET | `/nodes` | 调度节点列表 |

## 选型指引

| 需求 | 用哪层 |
| --- | --- |
| 运营希望自己调整执行频率 / 启停 | 业务定时任务（写 handler + 页面配置） |
| 模块自带的后台维护逻辑（清理、扫描、补偿） | 系统调度（`registerSystemRecurringJob`） |
| 用户触发的长耗时批量操作（带进度 / 可取消） | [任务中心](./task-center.md)（`registerSystemQueueWorker` 属于其底层） |
