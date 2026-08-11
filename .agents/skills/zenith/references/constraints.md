# 核心规范约束（后端与全局）

**所有代码改动的硬约束单一来源**，前端部分在 [constraints-frontend.md](./constraints-frontend.md)。
每条都是一句话可机械核对的「必须 / 禁止」，括号内是漏写的代价或适用 Step。
代码模板与展开说明在各主题文件，本文件只给指针，不放示例。

**按改动涉及的层读取对应章节即可，无需通读：**

| 改动涉及 | 章节 |
| --- | --- |
| 建表、加字段、枚举、审计列 | [Schema 层](#schema-层step-1) |
| 共享类型、Zod schema、常量、新增业务域 | [Shared 层](#shared-层step-3-4) |
| 业务逻辑、查询条件、事务、时间解析 | [Service 层](#service-层step-5) |
| 路由、DTO、响应构造、审计快照 | [Route 层](#route-层step-6-7) |
| 菜单条目、权限码、种子数据 | [菜单与权限配置](#菜单与权限配置step-9-10) |
| MSW mock handler | [MSW Mock 层](#msw-mock-层step-11) |
| 时间格式、图标、分页、依赖引入、异步任务 | [全局约束](#全局约束) |
| 页面、域 hooks、组件、布局 | → [constraints-frontend.md](./constraints-frontend.md) |

---

## Schema 层（Step 1）

- **审计列必加**：业务主表必须展开 `...auditColumns()`。例外（不要加）：纯关联表（`xxx_yyys`）、
  追加型日志（`*_logs`）、临时凭证（`*_tokens`）、IM 消息等「作者天然就是当前用户」的实体
- **审计字段禁止手写**：`created_by` / `updated_by` 由 `db/index.ts` 的 Proxy 自动写入，
  **禁止**在 service / route / seed 中手动赋值；需指定操作人时用 `runAsUser(userId, fn)` 包裹；
  DTO 用 `...auditFields`（`lib/dtos/_audit.ts`）
- **枚举三端同步**：`pgEnum` / TS union type / Zod enum 完全一致
- **updatedAt 自动维护**：schema 已配 `.$onUpdate(() => new Date())`，
  **禁止**在 `db.update().set({})` 中手动传 `updatedAt: new Date()`
- **relations 集中**：`xxxRelations` 一律写在 `db/schema/relations.ts`；缺失时 `db.query.xxx` 无法识别关联
- **数据权限字段**：`department_id` 只加到需按部门隔离查看的业务数据表；配置表、日志表、公共数据表不加
- **多租户字段**：业务数据表加 `tenantId`，查询用 `tenantCondition(table, user)`，创建用 `getCreateTenantId(user)`

## Shared 层（Step 3-4）

- **域子路径导入**：**禁止**从 `@zenith/shared` 根入口导入（ESLint 报错）。一律用
  `@zenith/shared/{业务域}`（`core` / `identity` / `platform` / `messaging` / `workflow` / `payment` /
  `member` / `report` / `analytics` / `ai` / `chat` / `mp` / `cms` / `open-platform` / `rules` / `ops` /
  `tasks` / `biz`），种子数据用 `@zenith/shared/seed`
- **Zod Schema 位置**：创建 / 更新 schema 定义在 `shared/src/{业务域}/validation.ts`，前后端共用，
  **禁止**在 server / web 中重复定义
- **枚举 SSOT 在 constants**：`XXX_TYPES` 常量数组 + 派生 union type + `XXX_LABELS` / `XXX_OPTIONS`
  一并写在 `shared/src/{业务域}/constants.ts`，`validation.ts` 通过 `z.enum(XXX_TYPES)` 引用。
  **禁止**把会被其他域 `z.enum()` 引用的常量数组放在 `validation.ts`——validation 互引形成 ESM 值环，
  `z.enum()` 在初始化期取到 `undefined` 直接崩溃
- **新增业务域**：建 `shared/src/{新域}/{types,validation,constants,index}.ts`，
  并在 `shared/package.json` 的 `exports` 登记 `"./{新域}"`；域 `index.ts` **不得**导出 seed
- **update = create.partial()**：不可更改字段用 `.omit({ field: true })`

## Service 层（Step 5）

- **职责边界**：业务逻辑、数据映射（`mapXxx`）、前置校验（`ensureXxx`）放
  `services/{业务域}/xxx.service.ts`；route handler 只取参数、调 service、返回响应
- **禁止事项**：service 中**禁止** `c.json()`、直接引用 Hono 上下文 `c`、`console.*`
- **HTTPException 抛出**：业务校验失败统一 `throw new HTTPException(statusCode, { message })`
  （`hono/http-exception`），由全局 `onError` 处理
- **DB 唯一约束**：PG 错误码 `23505` 在写入 `try-catch` 中用 `rethrowPgUniqueViolation(err, msg)`
  映射为 `HTTPException(400)`
- **事务**：多步写操作（replace 模式 delete+insert、写主表+关联表）必须 `db.transaction()`；
  辅助写函数接受 `executor: DbExecutor` 参数；副作用（WebSocket、邮件）不放入事务
- **计数查询**：单表计数用 `db.$count(table, where)`，禁止 `db.select({ total: count() })`
- **并行查询**：分页列表的 count 与 list **必须** `Promise.all` 并行，禁止串行 `await`
- **RQB 优先**：关联数据查询优先 `db.query.tableName.findMany/findFirst({ with: { ... } })`，
  仅跨表 WHERE 过滤或聚合计数才手写 JOIN

### WHERE 条件构造

统一使用 `lib/where-helpers.ts`，**禁止**手写等价样板：

| 场景 | 用 | 禁止 |
| --- | --- | --- |
| 关键字跨列模糊匹配 | `keywordCondition(keyword, [colA, colB], mode?)` | 手写 `or(like(a, '%…%'), …)` |
| 时间范围过滤 | `dateRangeConditions(column, start, end)` | 手写 `parseXxx` + `gte`/`lte` |
| 合并条件数组 | `buildWhere(...conditions)` | `conditions.length ? and(...) : undefined` |
| 附加租户 / 数据权限条件 | `mergeWhere(where, extra)` | — |
| 分页 | `withPagination(qb.$dynamic(), page, pageSize)` | 手写 `.limit().offset()` |

- 条件数组类型必须是 `(SQL | undefined)[]`；构造函数不适用时返回 `undefined`，`and()` 自动过滤，
  **禁止**为迁就 `SQL[]` 加 `!` 非空断言
- `keywordCondition` 内部已判空（空串 / 纯空格返回 `undefined`），调用点**不要**再包 `if (keyword)`
- `like` 与 `ilike` 按各表原有语义指定，不得一刀切；`mode` 默认 `like`
- 时间范围一律闭区间（`gte` / `lte`），禁止 `gt` / `lt`——边界时刻记录会被漏掉
- **LIKE 转义**：手写 `like()` / `ilike()` 必须用 `escapeLike(keyword)` 转义 `%`、`_`、`\`；
  跨列匹配直接用 `keywordCondition()`（内部已转义）

### 时间范围端点解析

- **范围端点必须走 `parseDateRangeStart` / `parseDateRangeEnd`**（或直接用 `dateRangeConditions`）：
  纯日期时起点取 `00:00:00`、终点取 `23:59:59.999`。**禁止**用 `parseDateTimeInput` 解析范围端点——
  它把 `2026-08-01` 解析成 `00:00:00`，「筛选到 8 月 1 日」会漏掉整个 8 月 1 日的数据
- `parseDateTimeInput` **只**用于单点时间（`scheduledAt` / `expireAt` / 投放起止等实体字段）
- **范围端点查询参数必须校验格式**：用 `dateRangeBound('说明')`（`lib/openapi-schemas`），
  同时接受 `YYYY-MM-DD` 与 `YYYY-MM-DD HH:mm:ss`。**禁止**裸 `z.string().optional()`——
  `?endTime=abc` 会被静默当成「无筛选」返回全量数据

## Route 层（Step 6-7）

- **薄路由**：**禁止在路由 handler 中直接调用 `db.*`**；DB 访问与业务逻辑全部在 service
- **DTO 中心化**：实体 DTO 必须定义在 `lib/dtos/` 对应子文件，经 `lib/openapi-dtos.ts` 统一导出；
  **严禁**在路由文件内本地声明带 `.openapi('EntityName')` 的实体 DTO（Swagger Components 会冲突）
- **响应辅助函数**：`responses:` 的 200 统一用展开语法 `...ok(DTO, desc)` / `...okPaginated(DTO, desc)` /
  `...okMsg(desc)`；**禁止**直接写 `200: { content: jsonContent(apiResponse(DTO)), description }`
- **响应体构造**：统一 `okBody(data, msg?)` / `errBody(msg, code?)`（`lib/openapi-schemas`），
  **禁止内联** `{ code: 0 as const, message, data }` 字面量；每个 `c.json(...)` 必须显式带状态码
- **commonErrorResponses**：所有路由的 `responses:` 必须包含 `...commonErrorResponses`（400/401/403/404/500）
- **Path Param**：数值型 `id` 统一用 `IdParam`；字符串型或自定义名参数必须在字段上加
  `.openapi({ param: { name: '...', in: 'path' }, example: '...' })`
- **分页查询**：列表接口查询参数统一 `PaginationQuery.extend({ ... })`，
  **禁止**内联声明 `page: z.coerce.number().optional()`
- **批量路由顺序**：`DELETE /batch` 必须注册在 `DELETE /{id}` **之前**，否则 `/batch` 被匹配为 `id="batch"`
- **外呼 HTTP**：服务端任何对外请求**必须**走 `lib/http-client.ts` 的 `httpRequest` / `httpGet` /
  `httpPost` 等，**禁止**全局 `fetch()`（见 [backend-patterns.md](./backend-patterns.md)）
- **写接口的审计快照**：需要 diff 的 PUT / DELETE 在写操作前 `setAuditBeforeData(c, before)`；
  响应 `data` 为 null 但仍需展示变更后状态（成员 / 角色 / 菜单 / 数据权限分配）时，
  写操作后补 `setAuditAfterData(c, after)`

---

## 菜单与权限配置（Step 9-10）

- **显示与操作解耦**：`directory` / `menu` 节点是纯显示资源，**禁止**携带 `permission`；
  全部权限码（含查询）挂在 `button` 节点上。每个页面菜单的第一个按钮固定为「查询」
  （`sort: 0`，权限码 `xxx:list`）
- **菜单 ID 分段**：每个一级目录独占 1000 段（系统管理 = 1000、系统设置 = 2000…）；
  页面落 10 的倍数槽位，按钮从父菜单 ID 顺延 +1..+n。**分配前必读 `SEED_MENUS` 源文件确认段内分布**，
  **严禁**依据任何文档记录的「当前最大 ID」分配
- **菜单种子清空重建**：seed.ts 对 `menus` 及绑定表 TRUNCATE 后全量重建，`SEED_MENUS` 是唯一权威来源；
  角色 / 套餐引用菜单 ID 用 `collectMenuSubtreeIds()` 等结构化推导，**禁止**硬编码魔法数字

## MSW Mock 层（Step 11）

- **响应构造统一**：一律用 `mocks/utils/handlers.ts` 的 `ok` / `fail` / `badRequest` / `unauthorized` /
  `forbidden` / `notFound` / `conflict` / `locked`；**禁止**内联 `HttpResponse.json({ code, message, data })`，
  **也禁止**在 handler 文件内自建同名局部 helper（默认 `message` 会各文件不一致）
- **分页统一**：用 `paginate(list, url, defaultPageSize?)`；页码来自 query 之外时用
  `pageResult(list, page, pageSize)`。**禁止**手写 `Number(url.searchParams.get('page'))` 与 `(page - 1) * pageSize`
- **自增 ID**：用 `nextIdFrom(list)`；**禁止**手写 `Math.max(...list.map((x) => x.id)) + 1`（空列表得 `-Infinity`）
- **HTTP 状态码**：失败响应显式带 `{ status: N }`，与真实后端一致
- **`data` 字段的有无是可观察差异**：`ok(x)` 省略 `data` 时响应体不含该字段，需要 `data: null` 就显式传 `null`
- **数据源对齐**：初始数据从 `@zenith/shared/seed` 的 `SEED_XXXS` 派生，**禁止**在 mock 中重复写静态数组

---

## 全局约束

### 时间格式

- **统一格式**：API 响应、入参、前端显示、MSW Mock 一律 `YYYY-MM-DD HH:mm:ss`
- **前端**：单点时间用 `formatDateTime()` / `formatDateTimeForApi()`；标准 `startTime` / `endTime`
  范围用 `formatDateTimeRangeForApi()`，非标准字段名（`startAt` / `endAt`）用
  `formatDateTimeRangeValuesForApi()` 后显式赋值（均来自 `@/utils/date`）。
  **禁止**在页面中手写 `[0]` / `[1]` 两端转换。仅接收 `YYYY-MM-DD` 的纯日期端点用 `formatDateForApi()`
- **后端格式化**：`lib/datetime.ts` 的 `formatDateTime()` / `formatNullableDateTime()`
- **后端解析**：范围端点 → `parseDateRangeStart()` / `parseDateRangeEnd()`（或 `dateRangeConditions()`）；
  单点时间 → `parseDateTimeInput()`。**不要混用**
- **Mock**：`mockDateTime()`（`mocks/utils/date.ts`）
- **禁止**：`toISOString()` / 原生 `toLocaleString()` / `toLocaleDateString()`

### 图标库

- 统一 `lucide-react`，禁止 `@douyinfe/semi-icons`

### 分页格式

- 列表接口返回 `{ list, total, page, pageSize }`
- SQL-builder 分页用 `withPagination(query.$dynamic(), page, pageSize)`；RQB 分页用 `offset: pageOffset(page, pageSize)`；
  MSW Mock 用 `paginate(list, url)` / `pageResult(list, page, pageSize)`
- 禁止手写 `(page - 1) * pageSize`

### 重型依赖懒加载（Server）

server 启动时加载全部路由 / 服务模块图，任何模块顶层静态 import 的依赖都会计入**每次**冷启动。

- **禁止**在 server 模块顶层静态 import 重型 SDK（首次 import 数百 ms 以上、且仅特定功能使用），
  已知清单：`exceljs`、`pdfkit`、`sharp`、`cheerio`、`dockerode`、`mssql`、`mysql2`、
  `@opentelemetry/sdk-node`、`@alicloud/*`、`tencentcloud-sdk-*`、云存储 SDK
  （`ali-oss` / `@aws-sdk/*` / `cos-nodejs-sdk-v5` / `qiniu` / `@baiducloud/sdk` / `@azure/storage-blob` / `esdk-obs-nodejs`）
- **必须**改为首次使用时经 `createRequire` 惰性加载；类型引用一律 `import type`。
  写法见 [backend-patterns.md](./backend-patterns.md)
- **禁止**在 ESM 模块中使用裸 `require()`；必须 `createRequire(import.meta.url)`
- 新引入第三方依赖先评估加载成本（`node -e "console.time('t');require('pkg');console.timeEnd('t')"`）；
  启动即需要的依赖（`hono`、`drizzle-orm`、`winston`、`pg-boss`、`ioredis`、`zod`）可静态 import

### 异步任务

- 长耗时 / 批量 / 可重试 / 需进度的操作必须接任务中心（`lib/task-center/`），
  **禁止**自建任务表、后台轮询线程或 `setInterval` 驱动的作业。见 [async-tasks.md](./async-tasks.md)
