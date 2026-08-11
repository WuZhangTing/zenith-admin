# 数据库与迁移

项目使用 **PostgreSQL + Drizzle ORM** 管理数据库结构与迁移。

## 默认连接

默认连接字符串如下，可通过 `.env` 覆盖：

```ini
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/zenith_admin
```

## 迁移流程

当你修改数据库 schema 后：

```bash
npm run db:generate
npm run db:migrate
```

如果需要初始化演示数据：

```bash
npm run db:seed
```

迁移入口是 `packages/server/src/db/migrate.ts`（纯 Drizzle migrator）。三条启动链路都会先跑迁移、再启动服务，因此它是唯一的 schema 收敛点：

- 开发：`npm run dev` → `scripts/dev.mjs`（migrate → seed → 服务）
- 生产：`npm start` → `node dist/db/migrate.js && node dist/index.js`
- 容器：`docker/entrypoint.sh` → migrate → 服务

**迁移失败以非零码退出并阻断服务启动**，避免带着半迁移状态对外提供服务。

## 重要约定

### 不要直接手改迁移 SQL

正确方式是修改 `src/db/schema/` 下的域文件，然后 `npm run db:generate` 生成新的迁移文件。唯一例外是 `drizzle/0001_extensions.sql`（见下）。

### 迁移基线

当前迁移链以 v1.23.0 重建的基线为起点，`packages/server/drizzle/` 下只有两条迁移：

| 文件 | 内容 |
| --- | --- |
| `0000_baseline.sql` | 全量表结构基线（由 `drizzle-kit generate` 从 schema 生成） |
| `0001_extensions.sql` | 手写扩展 DDL（无法由 Drizzle schema 表达，见下节） |

基线**不保留向后数据兼容**：更早版本的存量库无法原地升级，需要重新初始化（新建库跑 `db:migrate` + `db:seed`，或自行做数据搬迁）。全新环境执行 `npm run db:migrate` 即一步建库。

再次重建基线（未来迁移又积累过多时）的流程：确认 `db:generate` 无漂移 → 删除 `drizzle/` 目录重新 `generate` → **把 `0001_extensions.sql` 原样保留进新迁移链** → 用两个空库（旧链 vs 新基线）做结构化 schema diff 验证。

### 手写扩展 DDL（`0001_extensions.sql`）

两处 DDL 超出 Drizzle 的表达能力，单独维护在 `drizzle/0001_extensions.sql`，`drizzle-kit generate` 不会重新生成它们：

- **pg_trgm**：`CREATE EXTENSION pg_trgm` + `cms_contents.title` 的 `gin_trgm_ops` GIN 索引（CMS 标题模糊检索加速）
- **pgvector（条件启用）**：扩展可用时创建 `ai_kb_chunks.embedding_vec`（无维度 `vector` 列，兼容任意 embedding 模型），不可用时静默跳过；运行时由 `ai-knowledge.service.ts` 的 `hasPgVector()` 探测，不可用则回退 JS 余弦相似度。该列不进入 Drizzle schema，读写走原生 SQL

### 枚举需要三处保持一致

以下三者必须同步：

- PostgreSQL enum
- TypeScript union type
- Zod enum

### LIKE 查询必须使用 escapeLike

所有使用 `like()` / `ilike()` 的模糊查询，**必须**通过 `escapeLike()` 对用户输入进行转义，防止 `%`、`_`、`\` 等通配符被恶意利用：

```ts
import { escapeLike } from '../lib/where-helpers';

// ✅ 正确
like(users.username, `%${escapeLike(keyword)}%`)

// ❌ 错误 - 未转义，可能匹配任意记录
like(users.username, `%${keyword}%`)
```

`escapeLike` 定义在 `packages/server/src/lib/where-helpers.ts`，同时处理 `%`、`_`、`\` 三种元字符。

## Schema 组织（按业务域拆分）

全库超过 330 张表，schema 按业务域拆分在 `packages/server/src/db/schema/` 下，由 `src/db/schema.ts` barrel 统一 re-export——**导入方式不变**：`import { users } from '../db/schema'`。表间关联（250+ 个 `relations()`）统一声明在 `schema/relations.ts`，数据库类型别名（`Db` / `DbTransaction` / `DbExecutor`）在 `src/db/types.ts`。

| Schema 文件 | 业务域 | 代表性表 |
| --- | --- | --- |
| `core.ts` | 租户 / 组织 / 权限 | `tenants`、`tenant_packages`、`departments`、`positions`、`users`、`menus`、`roles`、`user_roles`、`role_menus`、`user_groups` 及数据范围关联表 |
| `auth.ts` | 认证与安全 | `user_oauth_accounts`、`oauth_configs`、`user_api_tokens`、`password_reset_tokens`、`user_mfa_factors`、`user_trusted_devices`、`login_risk_events`、`rate_limit_rules` |
| `identity-providers.ts` | 企业 SSO | `tenant_identity_providers`、`user_identity_accounts`、`identity_provider_sync_logs` |
| `system.ts` | 系统配置与调度 | `system_configs`、`cron_jobs`、`cron_job_logs`、`system_scheduler_*`、`regions`、`maintenance_mode`、`user_feedbacks` |
| `dicts.ts` | 数据字典 | `dicts`、`dict_items` |
| `files.ts` | 文件存储 | `file_storage_configs`、`managed_files`（主键 UUIDv7，应用层生成；`url` 由服务端动态拼接不入库）、`upload_sessions`、`upload_chunks`、`business_files` |
| `logs.ts` | 审计日志 | `login_logs`、`operation_logs`（含 `before_data` / `after_data` JSON 快照）、`ip_access_logs` |
| `announcements.ts` | 通知公告 | `announcements`、`announcement_reads`、`announcement_recipients` |
| `messaging.ts` | 邮件 / 短信 / 站内信 | `email_configs`、`email_templates`、`email_send_logs`、`sms_*`、`in_app_*` |
| `channels.ts` | 消息渠道 | 渠道接入与投递相关表 |
| `tasks.ts` | 任务中心 / 导出中心 | `async_tasks`、`async_task_items`、`async_task_type_configs`、`export_jobs`、`export_job_downloads` |
| `db-admin.ts` | 数据库运维 | `db_backups`、`db_admin_query_history`、`db_query_favorites` |
| `monitor.ts` | 监控告警 | `system_metric_samples`、`monitor_alert_rules`、`monitor_alert_events`、`ssl_certificates` |
| `terminal.ts` | 终端 / SSH | `terminal_recordings`、`ssh_profiles` |
| `data-mask.ts` | 数据脱敏 | `data_mask_configs` |
| `tags.ts` | 通用标签 | `tags` |
| `workflow.ts` | 工作流 | 流程定义 / 版本 / 实例 / 任务 / 委托 / 自动化 / 触发器等 29 张表 |
| `payment.ts` | 支付中心 | 应用、订单、退款、对账、分账、结算、风控等 28 张表 |
| `member.ts` | 会员体系 | `members`、`member_levels`、积分 / 钱包账户与流水（含 `version` 乐观锁，金额单位为分）、优惠券、签到 |
| `chat.ts` | 聊天 | 会话、成员、消息、表情反应、机器人、Webhook |
| `ai.ts` | AI | 提供方配置、对话、消息、提示词、知识库、评测 |
| `analytics.ts` | 埋点分析 / 前端错误 | 事件、会话、聚合、`error_groups`、`error_events`、`source_maps` |
| `report.ts` / `report-platform.ts` | 报表中心 | 数据源、数据集、仪表盘、订阅、投递、打印等 39 张表 |
| `cms.ts` | CMS | 站点、栏目、内容、素材、发布、采集、评论等 55 张表 |
| `mp.ts` | 微信公众号 | 粉丝、菜单、素材、群发、模板消息、客服等 18 张表 |
| `open-platform.ts` | 开放平台 | 开发者应用、API 授权范围、签名、调用统计 |
| `rules.ts` | 规则引擎 | 决策表、决策流、名单库 |
| `biz.ts` | 业务示例 | `biz_leaves`、`biz_pay_demos` |
| `common.ts` | 公共枚举 | 无表，提供 `statusEnum` 等跨域共享枚举 |
| `relations.ts` | 关联关系 | 无表，统一声明全部 `xxxRelations` |

> 新增表时：在对应域文件（或新建域文件）中声明 `pgTable`，关联写进 `relations.ts`，新建域文件需在 `src/db/schema.ts` barrel 中补一行 re-export。

### 通用审计字段（`created_by` / `updated_by`）

带审计字段的业务表均通过 schema 中的 [`auditColumns()`](https://github.com/iwangbowen/zenith-admin/blob/master/packages/server/src/db/schema/core.ts) 展开 `created_by` / `updated_by` 两列（指向 `users.id`，`ON DELETE SET NULL`）。赋值由 [`db/index.ts`](https://github.com/iwangbowen/zenith-admin/blob/master/packages/server/src/db/index.ts) 的 Proxy 统一拦截：

- **读取顺序**：`overrideStore`（`runAsUser()` 包裹）→ 请求上下文中的当前用户（`auth` 中间件设置）→ `null`。
- **拦截点**：`db.insert(t).values(d)` / `db.update(t).set(d)` / `db.insert(t).values(d).onConflictDoUpdate({set})` 及其在 `db.transaction()` 中的子事务版本。
- **严禁**：service / route / seed / cron 任意位置手动赋值 `createdBy` / `updatedBy`。
- **不加审计列的典型表**：
  - 多对多关联表：`user_roles`、`user_positions`、`role_menus`、`announcement_reads`、`announcement_recipients`、`chat_conversation_members`、`chat_message_reactions`
  - 追加型日志：`login_logs`、`operation_logs`、`cron_job_logs`、`email_send_logs`、`sms_send_logs`、`in_app_messages`
  - 用户自身/临时凭证：`user_oauth_accounts`、`password_reset_tokens`、`chat_messages`
  - 工作流运行时：`workflow_tasks`
- **种子数据**：`db/seed.ts` 主函数被 `runAsUser(adminId, ...)` 包裹，所有种子记录的创建人 / 修改人默认为 admin。

## 数据库备份

系统内置数据库备份功能，支持 `pg_dump` 完整 SQL 压缩备份与 Drizzle 逻辑 JSON 导出两种类型。

### 菜单入口

**系统设置 → 数据库备份**（路由：`/system/db-backups`，权限：`system:db-backup:list`）

### 操作说明

- **立即备份**：手动触发 `pg_dump` 或 Drizzle 逻辑导出，创建异步备份任务
- **删除备份**：删除指定备份记录

### 前置条件

使用 `pg_dump` 类型时，服务器环境必须安装 `pg_dump` 工具（PostgreSQL 客户端工具包），且版本需与数据库服务端版本兼容：

```bash
# Ubuntu / Debian
apt-get install postgresql-client

# 验证安装
pg_dump --version
```

### 备份文件存储位置

备份任务会先在后端服务工作目录的 `storage/backups/` 下生成文件：

- `pg_dump`：`pgdump-YYYYMMDD_HHmmss.sql.gz`
- `drizzle_export`：`drizzle-export-YYYYMMDD_HHmmss.json`

若已配置默认 `file_storage_configs`，备份完成后会上传到默认文件存储，并在 `db_backups.file_id` 记录对应的 `managed_files.id`（UUIDv7）。

### 相关接口

- `GET /api/db-backups`：获取备份列表，支持 `status` 与 `type` 查询参数
- `POST /api/db-backups`：触发立即备份，body 为 `{ type: 'pg_dump' | 'drizzle_export', name?: string }`
- `DELETE /api/db-backups/{id}`：删除指定备份记录

### 定期自动备份建议

定期自动备份可通过**定时任务模块**实现：

1. 在「定时任务」页面创建任务，Handler 填写 `databaseBackup`
2. 参数填写 `pg_dump` 或 `drizzle_export`
3. 设置适合的 Cron 表达式（如每天凌晨 2 点）

> **生产建议**：建议将备份文件定期同步到对象存储（如阿里云 OSS、AWS S3），避免仅依赖本地磁盘存储。
