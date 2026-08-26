# 数据管理

数据管理页面（`/analytics/data`，权限 `analytics:manage`）提供 8 个 Tab：**事件明细 / 事件字典 / 数据质量 / 事件调试 / 用户分群 / 站点管理 / 数据聚合 / 采集设置**，用于查阅原始埋点、治理事件字典、监控埋点质量、管理分群与站点、查看聚合并配置采集与保留策略。

## 事件明细

`GET /api/analytics/events` —— 原始事件分页列表，支持多维筛选：

- 事件类型、事件名、用户名、页面路径、设备类型
- **日期范围**（`startTime` / `endTime`，接受 `YYYY-MM-DD` 或 `YYYY-MM-DD HH:mm:ss`，纯日期按起止日闭区间处理）

点击某条事件打开详情侧边栏（`GET /api/analytics/events/{id}`），展示完整字段：身份（distinctId / anonymousId）、属性袋 `properties`、来源（referrer / UTM）、环境（浏览器 / 系统 / 设备 / 分辨率 / 语言 / UA）、地域（IP / 国家 / 城市）、性能指标等。

### 导出数据

「导出数据」按钮（权限 `analytics:export`）按当前筛选条件提交到**导出中心**（entity `analytics.events`），同步生成文件后在导出中心下载，文件保留 7 天，单次导出上限 5 万行。

### 数据清理

- 清除数据（权限 `analytics:clean`）：`DELETE /api/analytics/clean?days=N`（删除 N 天前数据，`days=0` 清空），同步清理会话。

## 事件字典（Tracking Plan）

`GET /api/analytics/event-meta` —— 事件元数据管理，登记每个 `eventName` 的显示名、分类、描述、负责人、属性 schema 与状态（启用 / 废弃 / 屏蔽），并统计触发次数与首次/最近时间；支持关键词、状态、分类筛选。

- 采集时自动登记带显式 `eventName` 的事件（`touchEventMeta`，best-effort 不阻塞采集）。
- 支持手动 CRUD：`POST` / `PUT /{id}` / `DELETE /{id}`；事件名全局唯一。
- **属性 schema**：每个事件最多登记 100 个属性，每个属性可声明类型、`required`（必填）、`enumValues`（枚举取值）与 `pii`（敏感标记）。
- **版本管理**：`version` 由服务端维护，对 schema 的结构性变更自动递增，用于排查「事件定义改了但客户端没跟上」类问题。
- **严格模式**（`strictMode`）：开启后该事件的 schema 校验问题会导致事件被拒收（而非仅记录质量问题）。
- 事件字典为**平台级全局分类**（事件名全局唯一，跨租户共享）；将事件置为/移出 `blocked`，以及删除已屏蔽事件，仅允许平台超级管理员。

### 租户级事件覆盖

`GET` / `POST /api/analytics/event-overrides`、`PUT` / `DELETE /{id}` —— 租户维度的事件启停开关（落 `analytics_event_overrides` 表，`tenantId + eventName` 唯一）。全局字典保持共享的同时，单个租户可自行停用某事件：被停用事件的上报会被拒收并记录 `event_disabled` 质量问题。

## 数据质量（埋点质量看板）

`GET /api/analytics/quality` —— 按事件名 × 问题类型 × 日聚合展示埋点质量问题（`analytics_event_quality_daily` 表），支持天数（≤90）、事件名、问题类型筛选。

采集治理管线在事件落库前评估每条事件，问题分 6 类：

| `issueType` | 含义 |
|-------------|------|
| `missing_required` | 缺失 schema 声明的必填属性 |
| `type_mismatch` | 属性类型与 schema 声明不符 |
| `invalid_enum` | 属性取值不在 `enumValues` 枚举内 |
| `event_disabled` | 事件被租户覆盖停用后仍在上报 |
| `origin_rejected` | 匿名站点上报的 `Origin` 不在站点白名单内 |
| `quota_exceeded` | 站点日配额超限被拒收 |

治理语义：全局 `blocked` 事件静默拒收（不记质量问题，避免刷屏）；`strictMode` 事件的 schema 问题导致该事件拒收，非严格模式仅记录、事件照常入库；质量样例只保留脱敏元信息（`{ key, expected, actualType }`，每天每类最多 5 条），不存原始属性值；被拒事件的 `eventId` 有去重缓存，客户端离线重放不会重复累计问题数；治理链路自身故障时降级放行（fail-open），绝不因治理阻断采集。

## 事件调试

`GET /api/analytics/debug/events` —— 事件调试列表：按标准分页返回最近入库的事件摘要，可按事件名过滤，用于埋点开发时验证「事件是否上报成功、属性是否正确」，无需去事件明细里翻页。

## 数据聚合

`GET /api/analytics/rollup?days=N`（最长 730 天）—— 展示每日预聚合指标（PV / UV / 会话 / 事件 / 跳出会话 / 总停留时长），来自 `analytics_daily_rollup` 表。

- 定时任务 `analyticsRollupDaily`（每日 01:00）自动重建最近 2 个完整自然日的聚合；除整体指标外，同时按浏览器 / 操作系统 / 设备 / 地域 / 页面五个低基数维度分别聚合，供长周期维度分析提速。
- 可点击「重建聚合」手动触发 `POST /api/analytics/rollup/rebuild?days=N`，经任务中心异步执行（任务类型 `analytics-rollup-rebuild`），同参数同日重复提交由幂等键拦截。
- 趋势查询默认实时计算；聚合表用于长周期 / 大数据量提速。

## 采集设置

`GET` / `PUT /api/analytics/settings` —— 采集与保留配置，可调整：

| 配置 | 说明 |
|------|------|
| `enabled` | 采集总开关 |
| `sampleRate` | 采样率 0–1 |
| `trackPageviews` / `trackClicks` / `trackPerformance` / `trackErrors` / `trackApi` | 页面 / 点击 / 性能 / 错误 / API 采集项开关 |
| `maskInputs` | 采集文本敏感信息脱敏 |
| `anonymizeIp` | IP 匿名化存储（先解析地域再抹除） |
| `respectDnt` | 尊重浏览器 Do Not Track |
| `blacklistPaths` | 路径黑名单 |
| `errorIgnorePatterns` | 错误忽略规则，正则数组；命中错误 `message` 的前端错误上报在服务端丢弃 |
| `retentionDays` / `errorRetentionDays` | 埋点 / 错误数据保留天数（1–3650） |
| `sessionTimeoutMinutes` | 会话闲置超时（1–1440 分钟） |

登录用户读取当前租户配置；匿名 SDK 按站点 `siteKey` 读取站点租户配置，无站点时使用平台级默认配置。

设置保存后**运行时热更新**：服务端广播 WebSocket `analytics:config-updated`（仅带 `tenantId`），已打开的页面匹配租户后自动重拉配置；SDK 另有 60 秒兜底轮询与跨标签页 storage 事件同步，详见 [埋点采集 SDK · 远程配置与热更新](./tracking#远程配置与热更新)。

## 数据保留策略

定时任务 `analyticsRetention`（每日 02:00）逐租户读取 `retentionDays` / `errorRetentionDays`，分别清理各租户过期埋点、会话、错误数据与埋点质量日聚合（`analytics_event_quality_daily`，跟随 `retentionDays`），并删除已无事件的空错误分组。没有配置记录的租户使用 180 / 90 天默认值。

## 用户分群

权限 `analytics:manage`。用户分群用于圈定满足特定事件 / 属性条件的 `distinctId` 集合，供漏斗分析（`segmentId`）与事件分析工作台（`segmentId`）复用，并作为分群触达的收件人来源。

- `GET` / `POST /api/analytics/segments`：分群列表 / 创建；`GET` / `PUT` / `DELETE /api/analytics/segments/{id}`：详情 / 更新 / 删除。
- 规则 `rules: { operator: 'AND'|'OR', conditions: [...] }`，最多 10 条条件，仅支持两类条件：
  - **事件条件**（`type: 'event'`）：`eventName` + 观察窗口天数（1–365）+ 最少发生次数 `minCount`（≤100000）+ 属性过滤（最多 20 条，`{ key, op, value }`）。
  - **属性条件**（`type: 'attribute'`）：针对 `analytics_user_profiles` 的 `identityType` / `userId` / `memberId` 或任意 `property.<key>`（`key` 经严格正则校验，禁止拼接任意列名）。
  - 不支持分群嵌套分群（规则条件中不能引用其他 `segmentId`），避免循环依赖与未受控的联表爆炸。
  - AND 语义使用 SQL `INTERSECT`、OR 语义使用 SQL `UNION` 合并各条件命中的 `distinctId` 集合，全程不在 Node 侧加载全量 ID 到内存后再比对。
- **物化**：`POST /api/analytics/segments/{id}/materialize` 通过任务中心异步执行（任务类型 `analytics-segment-materialize`，`allowConcurrent: false`，`maxAttempts: 2`），事务内先清空既有快照再 `INSERT ... SELECT` 写入新成员（含 `tenantId` / `identityType` / `userId` / `memberId`），完成后更新 `estimatedSize` 与 `snapshotAt`。幂等键由「任务类型 + 分群 ID + 规则版本 + 分钟桶」构成：同一分钟内的重复提交被拦截，规则更新后上一幂等键自动失效可立即重算。任务执行时会重新校验分群仍属于创建者租户。
- `GET /api/analytics/segments/{id}/members`：分页查看物化后的成员快照。
- 前端「用户分群」Tab：列表 + 状态/关键词搜索、创建/编辑弹窗（可视化规则编辑器，支持 AND/OR 与事件/属性两类条件的可视化拼装）、「重算成员」按钮（提交后跳转任务中心跟踪进度）、「触达」操作（见 [行为分析 · 分群触达](./behavior#分群触达)）、成员侧边栏。

## 站点管理与 site key

`analytics_sites` 站点模型标识匿名采集来源。站点使用服务端生成的 `siteKey`（格式 `zk_` + 32 位随机 hex）并绑定 `tenantId` 与 `appId`；平台级站点的 `tenantId` 为 `null`。

- 端点（均 `analytics:manage`）：`GET` / `POST /api/analytics/sites`、`PUT` / `DELETE /sites/{id}`、`POST /sites/{id}/regenerate-key`（重新生成 `siteKey`，泄露时轮换）。
- SDK 在请求头 `X-Analytics-Site-Key`（或 `?siteKey=` 参数）携带 site key。匿名请求解析成功后，公开配置按站点租户读取并返回 `siteId`/`appId`；事件上报归属到站点租户，并强制使用站点 `appId`。登录态请求始终身份优先，会忽略 site key。
- 种子数据包含两个平台默认站点：管理后台（`appId=admin`，`zk_admin_default_0000000000000000`）和会员端（`appId=member`，`zk_member_default_000000000000000`）。

**来源白名单** `allowedOrigins`（最多 100 个，须为纯 origin）为空或 `null` 表示不限制；配置后仅匿名且命中 site key 的事件/错误上报会校验请求 `Origin`，按 trim、去尾斜杠、大小写不敏感后的 origin 精确匹配。缺失或不匹配会整批静默成功但拒收，并在数据质量看板记录 `origin_rejected`。

**日配额** `dailyEventQuota` 为空表示不限；配置后按应用时区自然日使用 Redis 计数（key `analytics:quota:{siteId}:{YYYYMMDD}`，带全局命名空间前缀），事件采集在 Tracking Plan 治理后按实际新落库事件数消费配额。超限批次整批静默成功但拒收，并在数据质量看板记录 `quota_exceeded`。站点列表展示 Redis 中的今日用量；Redis 不可用时采集 fail-open，避免影响业务。

## 报表中心复用

行为分析数据无需新建报表数据源或执行器：直接复用内置主库数据源（`datasourceId=1`），在种子数据 `SEED_REPORT_DATASETS` 中提供 3 个只读参数化 SQL 数据集（行为事件趋势 / 来源分布 / 埋点质量趋势），并提供配套「行为分析概览」看板（`SEED_REPORT_DASHBOARDS`），从而直接获得报表中心已有的分享、订阅、导出能力，无需为行为数据重复实现。

- 数据集 SQL 均通过系统参数 `${__tenantId}` 与 `(${__tenantId}::int IS NULL OR tenant_id = ${__tenantId})` 模式支持「平台超管全局视角（`__tenantId` 为 `NULL`）」与「租户视角（`__tenantId` 为具体租户 ID）」双重语义，与报表中心其余数据集写法保持一致。
- `report-dataset.service.ts` 的 `buildSystemParams` 通过 `getEffectiveTenantId(user)` 计算 `__tenantId`：平台超级管理员在切换租户视角浏览时，注入的是「当前选中的租户视角」而非管理员自身租户，避免视角切换时误泄露/误过滤其他租户数据。
