# 核心规范约束

按 CRUD 开发阶段分组，实现过程中随时对照。带 Step 标注的约束表示该阶段必须检查。

---

## Schema 层（Step 1）

- **审计列必加**（Step 1, Step 10）：所有业务主表必须展开 `...auditColumns()`；例外：纯关联表（`xxx_yyys`）、追加型日志（`*_logs`）、临时凭证（`*_tokens`）、IM 消息等"作者天然就是当前用户"的实体
- **审计字段统一拦截**（Step 1, Step 5, Step 10）：`created_by` / `updated_by` 由 `packages/server/src/db/index.ts` 的 Proxy 自动写入，**禁止**在 service、route、seed 中手动赋值；需指定操作人时用 `runAsUser(userId, fn)` 包裹；DTO 中使用 `...auditFields`（来自 `lib/dtos/_audit.ts`）
- **枚举三端同步**（Step 1）：`pgEnum` / TS union type / Zod enum 保持完全一致
- **updatedAt 自动维护**（Step 1）：schema 中所有表的 `updatedAt` 已配置 `.$onUpdate(() => new Date())`，**禁止**在 `db.update().set({})` 中手动传入 `updatedAt: new Date()`
- **数据权限字段**（Step 1）：`department_id` 字段只添加到需要按部门隔离查看的业务数据表（如员工、订单、客户等）；配置类表、日志表、公共数据表均不需要
- **多租户字段**（Step 1）：业务数据表添加 `tenantId` 字段，查询用 `tenantCondition(table, user)`，创建用 `getCreateTenantId(user)`

---

## Shared 层（Step 3-4）

- **域子路径导入**（Step 3-8）：**禁止**从 `@zenith/shared` 根入口导入（ESLint 报错）。一律使用域入口 `@zenith/shared/{业务域}`（`core` / `identity` / `platform` / `messaging` / `workflow` / `payment` / `member` / `report` / `analytics` / `ai` / `chat` / `mp` / `cms` / `open-platform` / `rules` / `ops` / `tasks` / `biz`），种子数据用 `@zenith/shared/seed`
- **Zod Schema 位置**（Step 3）：创建/更新 schema 定义在 `packages/shared/src/{业务域}/validation.ts`，前后端共用，**禁止**在 server/web 中重复定义
- **枚举 SSOT 在 constants**（Step 3-4）：`XXX_TYPES` 常量数组 + 派生 union type + `XXX_LABELS`/`XXX_OPTIONS` 一并写在 `packages/shared/src/{业务域}/constants.ts`；`validation.ts` 通过 `z.enum(XXX_TYPES)` 引用。**禁止**把会被其他域 `z.enum()` 引用的常量数组放在 `validation.ts` —— validation 之间互引会形成 ESM 值环，`z.enum()` 在初始化期取到 `undefined` 直接崩溃（曾一次崩掉 133 个测试文件）
- **新增业务域时**（Step 3-4）：建 `packages/shared/src/{新域}/{types,validation,constants,index}.ts`，并在 `packages/shared/package.json` 的 `exports` 中登记 `"./{新域}": "./src/{新域}/index.ts"`；域 `index.ts` **不得**导出 seed
- **update = create.partial()**（Step 3）：`updateXxxSchema = createXxxSchema.partial()` 是标准模式；若有不可更改字段，用 `.omit({ field: true })`

---

## Service 层（Step 5）

- **Service 层职责**（Step 5）：业务逻辑、数据映射（`mapXxx`）、前置校验（`ensureXxx`）放在 `packages/server/src/services/{业务域}/xxx.service.ts`；route handler 只负责取参数、调 service、返回响应
- **Service 禁止事项**（Step 5）：**禁止**在 service 中调用 `c.json()`、直接引用 Hono 上下文 `c`、使用 `console.*`
- **HTTPException 抛出**（Step 5）：Service 层业务校验失败统一 `throw new HTTPException(statusCode, { message })`（来自 `hono/http-exception`），由全局 `onError` 统一处理
- **DB 唯一约束**（Step 5）：PG 错误码 `23505` 统一在 service 的写入 `try-catch` 中通过 `rethrowPgUniqueViolation(err, msg)` 映射为 `HTTPException(400)`
- **事务**（Step 5）：多步写操作（replace 模式 delete+insert、写主表+关联表）必须用 `db.transaction()`；辅助写函数接受 `executor: DbTransaction | typeof db` 参数；副作用（WebSocket、邮件）不放入事务
- **计数查询**（Step 5）：单表计数统一使用 `db.$count(table, where)`，禁止 `db.select({ total: count() }).from(table).where(where)`
- **并行查询**（Step 5）：分页列表中 count 和 list 是独立操作，**必须**用 `const [total, rows] = await Promise.all([db.$count(...), db.select()...])` 并行执行，禁止串行 `await`
- **RQB 优先**（Step 5）：关联数据查询优先使用 Drizzle RQB（`db.query.tableName.findMany/findFirst({ with: { relation: true } })`）

### WHERE 条件构造（Step 5）

统一使用 `packages/server/src/lib/where-helpers.ts` 的构造函数，**禁止**手写等价样板：

| 场景 | 用 | 禁止 |
| --- | --- | --- |
| 关键字跨列模糊匹配 | `keywordCondition(keyword, [colA, colB], mode?)` | 手写 `or(like(a, \`%${escapeLike(kw)}%\`), ...)` |
| 时间范围过滤 | `dateRangeConditions(column, start, end)` | 手写 `parseXxx` + `gte`/`lte` 两连 |
| 合并条件数组 | `buildWhere(...conditions)` | `conditions.length ? and(...conditions) : undefined` |
| 附加租户/数据权限条件 | `mergeWhere(where, extra)` | — |
| 分页 | `withPagination(qb.$dynamic(), page, pageSize)` | 手写 `.limit().offset()` |

- **条件数组类型必须是 `(SQL | undefined)[]`**：`keywordCondition` 等构造函数在条件不适用时返回
  `undefined`，drizzle 的 `and()` 本就接受并自动过滤。**禁止**为了迁就 `SQL[]` 而加 `!` 非空断言
- **`keywordCondition` 内部已判空**（空串 / 纯空格返回 `undefined`），调用点**不要**再包 `if (keyword)`
- **`like` 与 `ilike` 按各表原有语义指定**，不得一刀切；`mode` 默认 `like`（区分大小写，PostgreSQL 默认行为）
- **时间范围一律用闭区间**（`gte`/`lte`），禁止 `gt`/`lt`——边界时刻的记录会被漏掉

### 时间范围端点的解析口径（Step 5, Step 6）

- **范围端点必须走 `parseDateRangeStart` / `parseDateRangeEnd`**（或直接用 `dateRangeConditions`）。
  传纯日期时起点取当天 `00:00:00`、终点取当天 `23:59:59.999`；
  **禁止**用 `parseDateTimeInput` 解析范围端点——它把 `2026-08-01` 解析成 `00:00:00`，
  「筛选到 8 月 1 日」会漏掉整个 8 月 1 日的数据
- `parseDateTimeInput` 只用于**单点时间**（写入实体字段的 `scheduledAt` / `expireAt` / 广告投放起止等），
  对这些字段套用范围口径会把存储值悄悄挪到 23:59:59
- **范围端点的查询参数必须校验格式**：用 `dateRangeBound('说明')`（来自 `lib/openapi-schemas`），
  同时接受 `YYYY-MM-DD` 与 `YYYY-MM-DD HH:mm:ss`。**禁止**裸 `z.string().optional()`——
  `?endTime=abc` 会被静默当成「无筛选」返回全量数据

---

## Route 层（Step 6-7）

- **薄路由约定**（Step 6）：**禁止在路由 handler 中直接调用 `db.*`**。所有 DB 访问与业务逻辑必须放在 `services/{业务域}/xxx.service.ts`
- **DTO 中心化**（Step 6）：实体 DTO 必须定义在 `packages/server/src/lib/dtos/` 对应子文件，通过 `packages/server/src/lib/openapi-dtos.ts` 统一导出；**严禁**在路由文件内本地声明带 `.openapi('EntityName')` 的实体 DTO
- **响应辅助函数**（Step 6）：路由 `responses:` 中的 200 响应统一使用展开语法：`...ok(DTO, desc)`（单对象）、`...okPaginated(DTO, desc)`（分页列表）、`...okMsg(desc)`（仅 message 无 data）；**禁止**直接写 `200: { content: jsonContent(apiResponse(DTO)), description }`
- **响应码规范**（Step 6）：响应体统一使用 `okBody(data, msg?)` / `errBody(msg, code?)` 构造（来自 `'../../lib/openapi-schemas'`），**禁止内联写** `{ code: 0 as const, message, data }` / `{ code: 400, message, data: null }` 字面量对象；每个 `c.json(...)` 第二参数必须显式带状态码 `, 200)` / `, 404)` 等
- **commonErrorResponses**（Step 6）：所有路由的 `responses:` 块必须包含 `...commonErrorResponses`（涵盖 400/401/403/404/500），从 `'../../lib/openapi-schemas'` 导入
- **Path Param 规范**（Step 6）：数值型 `id` 参数统一使用 `IdParam`（`import { IdParam } from '../../lib/openapi-schemas'`）；字符串型或自定义名参数必须在字段上添加 `.openapi({ param: { name: '...', in: 'path' }, example: '...' })`
- **分页查询规范**（Step 6）：列表接口的查询参数统一用 `PaginationQuery.extend({ ... })` 扩展额外字段，**禁止**内联声明 `page: z.coerce.number().optional()`
- **批量操作路由顺序**（Step 6）：`DELETE /batch` 必须注册在 `DELETE /{id}` 之前，防止路由冲突
- **LIKE 查询转义**（Step 5, Step 6）：所有使用 `like()` / `ilike()` 的模糊查询，**必须**通过 `escapeLike(keyword)` 转义用户输入中的 `%`、`_`、`\\`，防止 LIKE 通配符注入；`escapeLike` 来自 `'../../lib/where-helpers'`。关键字跨列匹配请直接用 `keywordCondition()`（内部已转义），只有单列匹配才需要手写 `escapeLike`
- **外呼 HTTP 调用**（Step 5, Step 6）：服务端任何对外 HTTP 请求**必须**通过 `packages/server/src/lib/http-client.ts` 的 `httpRequest` / `httpGet` / `httpPost` 等；**禁止**直接使用全局 `fetch()`

---

## 前端层（Step 8）

- **标准 CRUD 域 hooks**（Step 8）：域文件（`packages/web/src/hooks/queries/xxx.ts`）的
  key 工厂、列表 / 详情 / 保存 / 删除 / 下拉源五件套统一由
  `packages/web/src/lib/crud-queries.ts` 的 `createCrudQueries` 生成，
  **禁止**逐个域手抄 `xxxKeys` 对象、`keepPreviousData` 列表查询、
  「无 id 走 POST、有 id 走 PUT」的保存、「单条走 `/:id`、多条走 `/batch`」的删除。
  手抄的代价不是行数而是失效契约会被漏写：保存后忘记失效 `lists` 表现为「保存成功但列表没变」，
  删除后忘记 `removeQueries(detail(id))` 会让已删记录在重新打开弹窗时闪出旧数据——两者都不报错。
  域内的非标准接口（分配菜单、导入导出、状态切换…）继续在同一文件手写 `useMutation`，
  用工厂导出的 `keys` 做失效即可；**禁止**为了套用工厂去改后端接口形状。
  写法见 [crud-frontend.md 域 hooks 文件模板](./crud-frontend.md)
- **编辑弹窗状态**（Step 8）：新增/编辑弹窗统一使用 `packages/web/src/hooks/useEditModal.ts`，
  **禁止**在页面里手写 `useRef<FormApi | null>` + `editingRecord` 状态 +
  `try { validate() } catch { … }` + `Toast` + 关闭四件套。
  该 hook 焊死了四条**漏写不报错**的契约：校验失败必须抛出（否则确定按钮永远转圈）、
  提示文案区分新增/编辑、保存后关闭并清空 `editing`（否则下次「新增」带出上次记录）、
  以及**表单必须按记录重挂载**——`initValues` 只在挂载时读取一次，
  配了 `useXxxDetail` 却没有 `key` 时，弹窗打开后才到达的详情永远进不了表单。
  展开 `modalProps` 到 `AppModal`、展开 `formProps` 到 `Form`；
  表单值与接口类型不一致（如 DatePicker 的 `Date` → 接口字符串）用 `beforeSave` 转换，
  保存后的副作用（展示初始密码、跳转…）用 `onSaved`，
  保存后另有更强反馈（跳转支付页、弹出含密钥的结果框）时用 `successMessage: () => null` 抑制默认提示。
  标题不符合「新增X / 编辑X」时不要用 `entityName`，展开后单独覆盖 `title`。
  只有新增或只有编辑的单模式弹窗同样适用（只调用对应的 `openCreate` / `openEdit` 即可）。
  一个页面有多个编辑单元时多次调用即可。写法见 [crud-frontend.md 完整页面模板](./crud-frontend.md)
  确有正当理由自持表单实例的少数场景（页面级全局配置表单、登录/找回密码等认证流程、
  工作流设计器与运行时表单、db-admin 行编辑器、保存后不关闭的搭建器工作区）不适用本条，
  但需写注释说明理由；且若该表单同时配了详情查询，
  `<Form>` 的 `key` **必须**用 `formRemountKey(id, detail)`（从 `@/hooks/useEditModal` 导出）——
  `key={record.id}` 在详情到达前后不变，表单不会重挂载，详情永远进不了表单
- **中断提交用 `abortSubmit()`**（Step 8）：`beforeSave` 或自定义提交里需要中断时，
  **先给出面向用户的提示，再调用 `@/lib/abort-submit` 的 `abortSubmit()`**。
  不要 `return`（Semi 的确定按钮会一直转圈），也**禁止**抛裸 `Error`：
  `useGlobalErrorHandler` 只放行 `ApiError`、`SubmitAborted` 与单词消息的裸 `Error`，
  `throw new Error('empty content')` 这类多词消息会穿透兜底——
  用户在自己的中文提示之外再吃一个「操作失败：empty content」，
  同时给 `/api/frontend-errors` 灌进一条由正常操作产生的假告警
- **列表页搜索状态**（Step 8）：统一使用 `packages/web/src/hooks/useListSearch.ts`，它整合了 `usePagination`
  与 draft/submitted 双状态，并保证「查询 / 重置」必定 `invalidateQueries(listKey)`。
  **禁止**在页面里手写 `const [draftParams/submittedParams] = useState(...)` 与
  `handleSearch` / `handleReset` 三件套——条件未变化时 query key 不变，漏掉失效则点「查询」
  不会真正回源，且列表仍有数据、不报错，几乎不可能被发现。
  「不经输入框直接筛选」（点部门树 / 标签 / 收藏 / 应用保存的视图）用 `applySearch(params)`；
  **禁止**为此暴露 `submittedParams` 的裸 setter，那会绕过页码重置与失效。
  额外副作用（如查询后清空已选中行）用 `onSearch` / `onReset` 选项。写法见
  [crud-frontend.md 搜索参数与分页联动](./crud-frontend.md)
- **危险操作确认**（Step 8）：破坏性操作（删除、清空、彻底移除、重置密钥、撤销令牌、截断表、
  终止流程…）统一用 `packages/web/src/utils/confirm.ts` 的 `confirmDelete` / `confirmDanger`，
  **禁止**手写 `Modal.confirm({ ..., okButtonProps: { type: 'danger', theme: 'solid' } })`——
  漏写这条样式时确认按钮会渲染成与「确定提交」无异的蓝色主按钮。
  `confirmDelete` 仅比 `confirmDanger` 多一个默认标题「确定要删除吗？」；
  **文案不做统一**，指明删除对象的具体文案（`'确定要删除该标签吗？'`）比通用文案更能防误操作。
  **非破坏性确认**（提交、发布、启用、退出、导出…）继续用原生 `Modal.confirm`，不加 danger。
  写法见 [crud-frontend.md 危险操作确认](./crud-frontend.md)
- **操作列创建**（Step 8）：所有表格操作列通过 `packages/web/src/components/ResponsiveTableActions.tsx` 的 `createOperationColumn` 创建；该工具统一处理 `fixed: 'right'`、列设置不可隐藏、移动端列宽收窄和更多菜单
- **状态列固定**（Step 8）：状态列必须紧靠操作列左侧，并同样设置 `fixed: 'right'`
- **搜索栏布局**（Step 8）：搜索区统一使用 `SearchToolbar`（`packages/web/src/components/SearchToolbar.tsx`）。筛选/操作较多时必须使用结构化模式（`primary` / `filters` / `actions`，必要时用 `mobilePrimary` / `mobileFilters` / `mobileActions` 覆盖移动端）；移动端至少露出一个高频搜索/筛选项（优先关键词，无关键词时选区分度最高的筛选项）、查询与新增，其余筛选进底部抽屉、低频操作进更多菜单。写法见 [crud-frontend.md 完整页面模板](./crud-frontend.md)，参考 `packages/web/src/pages/system/positions/PositionsPage.tsx`
- **搜索栏筛选控件**（Step 8）：关键字、状态、时间范围三类筛选统一使用
  `packages/web/src/components/search-filters.tsx` 的 `KeywordInput` / `StatusSelect` / `DateRangeFilter`，
  **禁止**手写 `prefix={<Search size={14} />}`、`showClear`、`style={{ width: N }}` 这类装饰性属性。
  业务属性（`value` / `onChange` / `placeholder`）仍显式传入，其余 props 原样穿透。
  **例外**：面板/弹窗内需跟随容器自适应的搜索框（如 `NavListPanel` 的 List header）不套用——
  这些控件带固定默认宽度，会改变布局。写法与默认值见
  [crud-frontend.md 搜索工具栏筛选控件](./crud-frontend.md)
- **搜索栏公共按钮**（Step 8）：查询 / 重置 / 新增 / 刷新按钮统一使用 `packages/web/src/components/toolbar-controls.tsx` 的 `SearchButton` / `ResetButton` / `CreateButton` / `RefreshButton`，**禁止**手写 `<Button type="primary" icon={<Search size={14} />} onClick={...}>查询</Button>` 这类字面量。文案不同时用 children 覆盖：`<CreateButton onClick={openCreate}>新增规则</CreateButton>`；文案与默认值相同则写自闭合。**例外**：仅仅复用同一图标的独立操作（如「测试发送」「生成链接」「发起分账」）以及视觉本就不同的写法（`theme="borderless"` / `size="small"` / 其他图标）保持原生 `Button`——改「新增」按钮图标时不应连带改掉它们
- **单图上传字段**（Step 8）：表单里的「上传图片 / 封面图」字段统一使用 `packages/web/src/components/ImageUploadField.tsx`（已内置预览、悬浮删除、上传地址与鉴权头、响应取值），**禁止**在页面里重新拼 `<Upload action={...} headers={...}>` + 预览 `<img>` + 删除按钮的组合
- **页面级多 Tab 布局**（Step 8）：页面最外层就是多个业务 Tab 时，根节点写 `<div className="page-container page-tabs-page">`，每个 `<TabPane>` 内自带该 tab 的工具栏、操作按钮、空状态与表格；**禁止**把 TabPane 留空后在 Tabs 外部按 `activeTab` 渲染共用表格/按钮。抽屉、弹窗、卡片内代码示例、左右分栏内部小 tabs 不使用 `page-tabs-page`。结构见 [crud-frontend.md 页面级多 Tab 布局](./crud-frontend.md)
- **移动端更多菜单操作项**（Step 8）：`SearchToolbar` 的 `mobileActions` 中只放低频操作按钮；普通操作按钮统一使用无边框视觉（`theme="borderless"`，危险操作保留 `type="danger"`），导出操作优先使用 `ExportButton variant="flat"`。公共样式会兜底把更多菜单里的按钮渲染成无边框，但页面代码仍应按无边框语义书写。
- **表格样式**（Step 8）：统一 `<ConfigurableTable bordered ... />`
- **表格列公共工具**（Step 8）：`createdAtColumn`（创建时间预置列）和 `renderEllipsis`（省略列 render）从 `'../../utils/table-columns'` 导入；**禁止**内联写 `<Typography.Text ellipsis={{ showTooltip: true }} style={{ maxWidth: '100%' }}>`
- **操作按钮样式**（Step 8）：在 `createOperationColumn` 的 `actions` 中配置 `key` / `label` / `onClick` / `danger` / `disabledReason`；桌面端默认内联全部动作，也可用 `desktopInlineKeys` 只保留高频动作内联、其余动作进入更多菜单；删除等危险操作加 `danger: true`
- **无图标文字按钮**（Step 8）：操作列动作只用纯文字 `label`，不加图标；移动端由公共组件自动收窄操作列并收纳到更多菜单
- **弹窗表单布局**（Step 8）：`Form` 必须加 `labelPosition="left"`，所有 `Modal` 必须加 `closeOnEsc`；`labelWidth` 取值与单列/双列的选取规则见 [crud-frontend.md 弹窗表单布局规范](./crud-frontend.md)
- **枚举标签统一来源**（Step 8）：**禁止**在页面/组件/导出定义中内联定义枚举的 `{ value, label }` 数组或 `Record<value, label>` 中文映射。按优先级选择来源：① 运营可扩展的自由文本枚举（如 `leave_type`、`ai_dislike_reason`）→ 字典（`useDictItems('code')`，种子在 `shared/src/seed/platform.ts`）；② 通用启用/禁用 → `useDictItems('common_status')`（前端）或 `COMMON_STATUS_LABELS`（server 导出，来自 `@zenith/shared/core`）；③ 代码耦合枚举（pg enum / 状态机 / 协议值）→ `packages/shared/src/{业务域}/constants.ts` 的 `XXX_LABELS` / `XXX_OPTIONS` 常量，经 `@zenith/shared/{业务域}` 导入（server 导出中心与前端共用）；工作流实例/任务状态用 `web/components/workflow/workflow-runtime.ts` 的 `INSTANCE_STATUS_MAP` / `TASK_STATUS_MAP`（含 Tag 色）。Tag 颜色、图表 hex 色板、CSS 变量等展示样式留在使用方；外部协议值（如微信 `sex: '1'/'2'`）与视角特化文案（如"我已同意"）不做统一
- **树形表格展开控制**（Step 8）：使用 `children` 字段渲染树形表格时，必须在搜索栏添加「全部展开/全部折叠」按钮，使用受控 `expandedRowKeys` + `onExpandedRowsChange`；图标：已展开用 `ChevronsDownUp`，未展开用 `ChevronsUpDown`
- **批量按钮显示时机**（Step 8）：批量操作按钮仅在 `selectedRowKeys.length > 0` 时显示，放在查询/重置按钮之后
- **mutation 精确失效**（Step 8）：域 hooks 的 `onSuccess` 按真实副作用失效，**禁止**无条件 `invalidateQueries({ queryKey: xxxKeys.all })`；判据是「有没有已挂载的查询读了这次被改动的状态」，而非接口像不像命令。删除用 `removeQueries(detail(id))`；确需全域失效（批量覆盖、切租户、全量导入）须在注释写明理由。策略表与判定推论见 [crud-frontend.md 缓存一致性契约](./crud-frontend.md)
- **query key 结构**（Step 8）：`xxxKeys.all` 只能是本域自己的根；独立生命周期的子资源另起命名空间；同一实体的多变体查询导出 `detailOf(id)` / `dataOf(id)` / `lookupPrefix` 前缀键；静态 lookup、数据库元数据与昂贵的派生取数不与列表同前缀。见 [crud-frontend.md key 结构设计](./crud-frontend.md)
- **下拉源归属所有者域**（Step 8）：**禁止**用本域 key 请求别域资源——所有者域增删改时没有任何来源会失效它，界面会静默显示旧列表。一律复用 `useAllRoles` / `useFlatDepartments` / `useAllUsers` / `useAllPositions` / `useDictItems` 等共享 lookup hook
- **回填的可见性红线**（Step 8）：`setQueryData(detail(id), saved)` 仅限写接口与详情接口同源；详情做了按查看者脱敏、详情多出关联数据、写接口不回传编辑过的关联字段、列表/树含聚合字段这四种情形**必须**改为失效 `detail(id)`
- **失效行为需可证伪**（Step 8）：域 hooks 的测试用 `packages/web/src/test-utils/query-harness.ts`，断言实际请求数、真正进入 fetching 的查询与缓存新鲜度；**禁止**只 spy「调用了 `invalidateQueries(某 key)`」—— `all` 是 `detail` 的前缀，这类断言在冗余的广播写法下同样通过
- **ConfigurableTable 刷新按钮**（Step 8）：所有使用 `ConfigurableTable` 的列表页均必须传入 `onRefresh` 和 `refreshLoading`
- **左右分栏布局**（Step 8）：需要「左侧列表 + 右侧详情」结构时，统一使用 `packages/web/src/components/MasterDetailLayout.tsx`，**禁止**手写 flex 两栏布局。窄屏（容器宽度 < `responsiveBreakpoint`，默认 720）自动转单栏，必须提供返回入口：master 为列表时传 `onBack`，master 为筛选树、detail 才是主体时传 `onMasterBack`；且**禁止**在单栏下自动选中首项（否则根视图落在详情，列表要点返回才能抵达），用 `onResponsiveChange` 区分。master 内部的高度链写法、嵌套 Semi Tabs 与窄屏单栏的完整写法见 [crud-frontend.md 左右分栏布局](./crud-frontend.md)
- **左侧平铺列表**（Step 8）：左侧 master 是**平铺列表**（分类/文件/分组等，非树形）时，统一使用 `NavListPanel<T>` + `NavListItem`（`packages/web/src/components/NavListPanel.tsx`）；树形数据（需展开/折叠）改用 Semi `Tree`。props 与 dataSource / children / rawBody 三种用法见 [crud-frontend.md 左侧平铺列表](./crud-frontend.md)
- **统计卡片**（Step 8）：指标卡（数值 + 标题，可带图标/副文案/环比/可点击筛选）统一使用
  `packages/web/src/components/charts/StatCard.tsx` 的 `StatCard` + `StatGrid`，
  **禁止**在页面里再写一遍 `<Card>` + 大字号数值 + tertiary 标签的组合。
  页面无图表时从 `@/components/charts/StatCard` 直接导入——桶文件 `@/components/charts`
  会连带引入约 2MB 的 vchart。
  环比用 `delta`，`deltaFormat` 区分 `absolute`（差值）与 `ratio`（比率，0.12 → +12.0%）；
  按状态筛选列表的卡片传 `onClick` + `active`，组件会渲染成 `button` 并带 `aria-pressed`
- **栅格禁止内联写死列数**（Step 8）：**禁止**写
  `style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}` 或 `'1fr 1fr'` 这类固定列数——
  内联样式无法被媒体查询覆盖，窄屏会把内容压到竖排（实测：4 列会员等级卡在 390px 只剩 75px 宽，
  弹窗内两列表单只剩 152px）。按场景选择：
  ① 统计卡片 → `StatGrid`（`minItemWidth` 控制降列阈值）；
  ② 图表分栏 → `.chart-grid`（主图 + 侧栏的非对称布局加 `.chart-grid--aside`）；
  ③ 其余固定列数的卡片栅格 / 表单多列 / 选择器 → `global.css` 的 `.auto-grid`，
  用 `--auto-grid-min`（内容最小宽）、`--auto-grid-cols`（**设计列数上限**）、
  `--auto-grid-gap`（必须是单个长度，参与列数计算；行距另用 `--auto-grid-row-gap`）。
  `--auto-grid-cols` 不可省：纯 `auto-fit` 会在宽屏多拆一列（3 列设计在 1440px 变 4 列）。
  确需保留的 `repeat(auto-*, minmax(Npx, 1fr))` 必须写成 `minmax(min(Npx, 100%), 1fr)`，
  否则容器比单列还窄时会横向溢出。
  **不适用**：固定像素列（`'110px minmax(0,1fr)'`、`'150px 1fr 56px'` 等标签/值布局）、
  等分小方块缩略图（表情、聊天媒体）、以及本身处于固定宽容器内的微指标——这些窄屏不会破碎
- **抽屉/弹窗宽度**（Step 8）：`SideSheet` / `Modal` 的窄屏适配已由 `global.css` 全局兜底
  （Modal 在 `--sm-down` 取 95vw；SideSheet 在 `--lg-down` 取 `max-width: 95vw`、
  在 `--xs-down` 取 `width: 100vw`），**无需**再在页面里写 `width={isMobile ? '100%' : 720}`——
  这类判断在所有区间都被全局规则覆盖，是无效代码

---

## 菜单与权限配置（Step 9）

- **显示与操作解耦**（Step 9）：`directory` / `menu` 节点是纯显示资源，**禁止**携带 `permission`；全部权限码（含查询）挂在 `button` 节点上。每个页面菜单的第一个按钮固定为「查询」（`sort: 0`，权限码 `xxx:list`）
- **菜单 ID 分段**（Step 9）：每个一级目录独占 1000 段（系统管理 = 1000、系统设置 = 2000…）；页面落 10 的倍数槽位，按钮从父菜单 ID 顺延 +1..+n；分配前必读 `SEED_MENUS` 源文件确认段内分布
- **菜单种子清空重建**（Step 10）：seed.ts 对 `menus` 及绑定表采用 TRUNCATE 后全量重建，`SEED_MENUS` 是唯一权威来源；角色/套餐引用菜单 ID 用 `collectMenuSubtreeIds()` 等结构化推导，**禁止**硬编码魔法数字

---

## MSW Mock 层（Step 11）

- **响应构造统一**：一律用 `packages/web/src/mocks/utils/handlers.ts` 的
  `ok` / `fail` / `badRequest` / `unauthorized` / `forbidden` / `notFound` / `conflict` / `locked`；
  **禁止**在 handler 里内联 `HttpResponse.json({ code, message, data })`，
  **也禁止**在 handler 文件内自建同名局部 helper（默认 `message` 会各文件不一致）
- **分页统一**：用 `paginate(list, url, defaultPageSize?)`；页码来自 query 之外时用 `pageResult(list, page, pageSize)`。
  **禁止**手写 `Number(url.searchParams.get('page'))` 与 `(page - 1) * pageSize`
- **自增 ID**：用 `nextIdFrom(list)`；**禁止**手写 `Math.max(...list.map((x) => x.id)) + 1`（空列表会得到 `-Infinity`）
- **HTTP 状态码**：失败响应显式带 `{ status: N }`（如 `notFound('XXX 不存在', { status: 404 })`），与真实后端一致
- **`data` 字段的有无是可观察差异**：`ok(x)` 省略 `data` 时响应体不含该字段，需要 `data: null` 就显式传 `null`
- 详细模板见 [crud-mock.md](./crud-mock.md)

---

## 时间格式（全局）

- **统一格式**：API 响应、入参、前端显示、MSW Mock 统一使用 `YYYY-MM-DD HH:mm:ss`
- **前端**：单点时间用 `formatDateTime()` / `formatDateTimeForApi()`；标准
  `startTime` / `endTime` 日期时间范围用 `formatDateTimeRangeForApi()`，非标准字段名
  （如 `startAt` / `endAt`）用 `formatDateTimeRangeValuesForApi()` 后显式赋值
  （均来自 `@/utils/date`）。**禁止**在页面中重复手写 `[0]` / `[1]` 两端转换。
  仅接收 `YYYY-MM-DD` 的纯日期端点继续逐端使用 `formatDateForApi()`，不要套日期时间范围 helper
- **后端格式化**：用 `packages/server/src/lib/datetime.ts` 的 `formatDateTime()` / `formatNullableDateTime()`
- **后端解析**：按用途二选一，**不要混用**
  - 时间范围端点（筛选用）→ `parseDateRangeStart()` / `parseDateRangeEnd()`，或直接用 `dateRangeConditions()`
  - 单点时间（写入实体字段）→ `parseDateTimeInput()`
- **Mock**：用 `mockDateTime()`（来自 `packages/web/src/mocks/utils/date.ts`）
- **禁止**：`toISOString()` / 原生 `toLocaleString()` / `toLocaleDateString()` 等

---

## 图标库（全局）

- 统一使用 `lucide-react`，禁止 `@douyinfe/semi-icons`

---

## 分页格式（全局）

- 列表接口返回 `{ list, total, page, pageSize }`
- SQL-builder 分页统一使用 `withPagination(query.$dynamic(), page, pageSize)`
- RQB 分页统一使用 `offset: pageOffset(page, pageSize)`
- MSW Mock 分页统一使用 `paginate(list, url)` / `pageResult(list, page, pageSize)`
- 禁止手写 `(page - 1) * pageSize`

---

## 重型依赖懒加载（Server 全局）

> 背景：server 启动时加载全部路由/服务模块图，任何模块顶层静态 import 的依赖都会计入**每次**冷启动。
> v1.38 曾因重 SDK 全部随启动加载，导致 dev/prod 冷启动多耗约 20s（27.1s → 懒加载后 8.2s），勿回退。

- **禁止**在 server 模块顶层静态 import 重型 SDK（首次 import 数百 ms 以上、且仅特定功能使用），已知清单：
  `exceljs`、`pdfkit`、`sharp`、`cheerio`、`dockerode`、`mssql`、`mysql2`、`@opentelemetry/sdk-node`、
  `@alicloud/*`、`tencentcloud-sdk-*`、云存储 SDK（`ali-oss` / `@aws-sdk/*` / `cos-nodejs-sdk-v5` / `qiniu` / `@baiducloud/sdk` / `@azure/storage-blob` / `esdk-obs-nodejs`）
- **必须**改为首次使用时经 `createRequire` 惰性加载；类型引用一律 `import type`（编译期擦除，不产生运行时加载）。写法模板见 [crud-backend.md → 重型依赖懒加载](./crud-backend.md#重型依赖懒加载重-sdk)
- 新引入第三方依赖时先评估加载成本（`node -e "console.time('t');require('pkg');console.timeEnd('t')"`）；仅启动即需要的依赖（如 `hono`、`drizzle-orm`、`winston`、`pg-boss`、`ioredis`、`zod`）可静态 import
- **禁止**在 ESM 模块中使用裸 `require()`（运行时 `require is not defined`）；必须 `createRequire(import.meta.url)`
- 懒加载 CJS 包时注意导出形状与类型声明一致（named vs default），用 `as typeof import('pkg')` 收敛类型；不确定时 `node -e` 探测运行时形状
