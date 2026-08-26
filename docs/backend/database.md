# 数据库与迁移

项目使用 PostgreSQL + Drizzle ORM 管理数据库结构与迁移。Server 工作区的 Drizzle 配置在 `packages/server/drizzle.config.ts`，schema 入口是 `packages/server/src/db/schema.ts`，迁移目录是 `packages/server/drizzle/`。

## 默认连接

`.env` 通过 `DATABASE_URL` 配置数据库连接：

```ini
DATABASE_URL=postgres://postgres:postgres@localhost:5432/zenith_admin
```

运行时连接池参数由 `config.database` 控制，`db/index.ts` 使用 `postgres` + `drizzle-orm/postgres-js` 创建单例连接。

## 迁移流程

修改 `packages/server/src/db/schema/` 后，在仓库根目录执行：

```bash
npm run db:generate
npm run db:migrate
```

如需初始化演示 / 内置数据：

```bash
npm run db:seed
```

根目录脚本会转发到 `@zenith/server`：

| 根目录脚本 | Server 脚本 |
| --- | --- |
| `npm run db:generate` | `npm run db:generate -w @zenith/server` → `drizzle-kit generate` |
| `npm run db:migrate` | `npm run db:migrate -w @zenith/server` → `tsx src/db/migrate.ts` |
| `npm run db:seed` | `npm run db:seed -w @zenith/server` → `tsx src/db/seed.ts` |

迁移入口 `packages/server/src/db/migrate.ts` 使用 Drizzle migrator 执行 `./drizzle`。开发、生产和容器启动链路都会先执行迁移再启动服务；迁移失败以非零码退出，阻断服务启动。

## 重要约定

### 迁移文件来源

结构变更先改 `src/db/schema/`，再由 `drizzle-kit generate` 生成迁移 SQL。不要手工改写已生成迁移来适配代码。仅 Drizzle schema 无法表达的 DDL 可使用 custom migration，例如扩展、表达式索引、条件 DDL。

### 迁移目录

`packages/server/drizzle/` 包含 `0000_baseline.sql`、`0001_extensions.sql` 和后续增量迁移，执行顺序由 `drizzle/meta/_journal.json` 管理。全新数据库执行 `npm run db:migrate` 会按该顺序建库。

`0001_extensions.sql` 维护 Drizzle schema 无法完整表达的扩展 DDL：

- `pg_trgm` 与相关 trigram 索引；
- 条件启用 pgvector 的 `ai_kb_chunks.embedding_vec` 列；运行时通过 `hasPgVector()` 探测，不可用时回退 JS 余弦相似度。

后续 custom migration 也用于表达式 / 操作符类索引等场景，例如 `async_tasks.payload/result` 内容检索的 `gin_trgm_ops` 表达式索引。

### 枚举同步

枚举必须保持三端一致：

- PostgreSQL `pgEnum`；
- `@zenith/shared/{domain}` 中的 TS union / 常量数组；
- Zod enum。

可被其他域复用的枚举常量放在 `shared/src/{domain}/constants.ts`，不要放在 `validation.ts` 中制造 ESM 值循环。

### LIKE 查询转义

使用 `like()` / `ilike()` 拼接用户输入时必须调用 `escapeLike()`；跨列关键字搜索优先用 `keywordCondition()`。

```ts
import { escapeLike } from '../lib/where-helpers';

like(users.username, `%${escapeLike(keyword)}%`);
```

## Schema 组织（按业务域拆分）

全库约 375 张表，schema 按业务域拆分在 `packages/server/src/db/schema/`。`src/db/schema.ts` 是 barrel，业务代码导入方式保持：

```ts
import { users, roles } from '../db/schema';
```

表间关联统一声明在 `schema/relations.ts`；数据库类型别名在 `src/db/types.ts`。

| Schema 文件 | 业务域 | 代表性表 |
| --- | --- | --- |
| `core.ts` | 租户 / 组织 / 权限 | `tenants`、`tenant_packages`、`departments`、`positions`、`users`、`menus`、`roles`、`user_roles`、`user_groups` |
| `licensing.ts` | 授权许可 | `system_installations`、`licenses`、`license_events` |
| `auth.ts` | 认证与账号安全 | `user_oauth_accounts`、`oauth_configs`、`user_api_tokens`、`password_reset_tokens`、`user_mfa_factors`、`user_trusted_devices`、`login_risk_events`、`rate_limit_rules` |
| `identity-providers.ts` | 企业 SSO | `tenant_identity_providers`、`user_identity_accounts`、`identity_provider_sync_logs` |
| `directory-sync.ts` | 通讯录同步 | `directory_sync_sources`、`directory_sync_runs`、`directory_sync_run_items`、`directory_sync_conflicts`、`directory_sync_user_links`、`directory_sync_dept_links` |
| `system.ts` | 系统配置与调度 | `system_configs`、`cron_jobs`、`cron_job_logs`、`system_scheduler_*`、`retention_policies`、`regions`、`maintenance_mode`、`user_feedbacks` |
| `dicts.ts` | 数据字典 | `dicts`、`dict_items` |
| `files.ts` | 文件存储 | `file_storage_configs`、`managed_files`、`upload_sessions`、`upload_chunks`、`business_files` |
| `logs.ts` | 审计日志 | `login_logs`、`operation_logs`、`ip_access_logs` |
| `announcements.ts` | 通知公告 | `announcements`、`announcement_reads`、`announcement_recipients` |
| `messaging.ts` | 邮件 / 短信 / 站内信 | `email_configs`、`email_templates`、`email_send_logs`、`sms_*`、`in_app_*`、通知策略与偏好表 |
| `channels.ts` | 消息渠道 | 频道、订阅、消息、菜单、自动回复、客服会话等表 |
| `tasks.ts` | 任务中心 / 导出中心 | `async_tasks`、`async_task_items`、`async_task_type_configs`、`export_jobs`、`export_job_downloads` |
| `db-admin.ts` | 数据库运维 | `db_backups`、`db_admin_query_history`、`db_query_favorites` |
| `monitor.ts` | 监控告警 | `system_metric_samples`、`monitor_alert_rules`、`monitor_alert_events`、`ssl_certificates` |
| `terminal.ts` | 终端 / SSH | `terminal_sessions`、`terminal_recordings`、`ssh_profiles` |
| `data-mask.ts` | 数据脱敏 | `data_mask_configs` |
| `tags.ts` | 通用标签 | `tags` |
| `workflow.ts` | 工作流 | 流程分类、表单、定义、版本、实例、任务、作业、事件订阅、调度、健康快照等表 |
| `payment.ts` | 支付中心 | 应用、订单、退款、回调、事件、对账、分账、结算、风控、合约等表 |
| `member.ts` | 会员体系 | `members`、`member_levels`、`member_tags`、积分 / 钱包账户与流水、优惠券、签到、充值、登录日志 |
| `chat.ts` | 聊天 | 会话、成员、消息、反应、收藏、Webhook、快捷回复、定时消息、坐席等表 |
| `ai.ts` | AI | 提供方配置、会话、消息、提示词、知识库、评测、Arena、分享等表 |
| `analytics.ts` | 埋点分析 / 前端错误 | 事件、身份映射、会话、聚合、Tracking Plan、实验、错误组、错误事件、Source Map、告警历史 |
| `report.ts` / `report-platform.ts` | 报表中心 | 文件夹、数据源、数据集、仪表盘、订阅、投递、打印、质量规则、资产、填报等表 |
| `cms.ts` | CMS | 站点、模型、栏目、内容、素材、发布、采集、评论、页面搭建、表单、订阅、互动等表 |
| `mp.ts` | 微信公众号 | 账号、粉丝、标签、菜单、素材、群发、模板消息、客服、网页授权等表 |
| `open-platform.ts` | 开放平台 | OAuth2 客户端、授权、Token、API Scope、限流套餐、调用日志、统计、Webhook 等表 |
| `rules.ts` | 规则引擎 | 决策表、版本、测试用例、执行记录、资产版本、决策流、名单库 |
| `biz.ts` | 业务示例 | `biz_leaves`、`biz_pay_demos` |
| `app-releases.ts` | 应用发布 | `client_apps`、`app_releases`、`app_artifacts`、`app_release_events` |
| `wiki.ts` | 知识中心 | 空间、成员、文档、版本、模板、标签、评论、导入导出、治理表 |
| `common.ts` | 公共枚举 | 无表，提供 `statusEnum` 等跨域共享枚举 |
| `relations.ts` | 关联关系 | 无表，统一声明全部 `xxxRelations` |

新增表时在对应域文件声明 `pgTable`，关联写进 `relations.ts`，新建域文件时同步 `src/db/schema.ts` re-export。

### 通用审计字段（`created_by` / `updated_by`）

业务主表通过 `auditColumns()` 展开 `created_by` / `updated_by`。赋值由 `db/index.ts` 的 Proxy 统一注入：

- `runAsUser(userId, fn)` 覆盖优先；
- 其次读取请求上下文中的 `currentUserOrNull()`；
- 没有可用身份时写入 `null`；
- 拦截 `db.insert(table).values(...)`、`db.update(table).set(...)`、`db.insert(...).onConflictDoUpdate({ set })`，事务内 `tx` 同样生效。

Service、route、seed、cron 不手动赋值 `createdBy` / `updatedBy`。需要指定操作人时使用：

```ts
import { runAsUser } from '../lib/audit-context';

await runAsUser(adminId, async () => {
  await db.insert(xxxs).values(data);
});
```

典型不加审计列的表：纯关联表、追加型日志、临时凭证、IM 消息、天然已有操作者语义的运行时表。

## 数据库备份

系统内置数据库备份功能，路由在 `packages/server/src/routes/ops/db-backups.ts`，服务在 `services/ops/db-backups.service.ts` 与 `lib/db-backup.ts`。

### 菜单入口

系统设置 → 数据库备份（路由 `/system/db-backups`，权限 `system:db-backup:list`）。

### 操作说明

- 立即备份：创建 `pg_dump` 完整 SQL 压缩备份或 Drizzle 逻辑 JSON 导出。
- 删除备份：删除指定备份记录。
- 文件归档：配置默认 `file_storage_configs` 后，备份文件保存到文件存储，并在 `db_backups.file_id` 记录 `managed_files.id`。

### 前置条件

使用 `pg_dump` 类型时，服务器环境必须安装 PostgreSQL 客户端工具，并保证版本与数据库服务端兼容。
