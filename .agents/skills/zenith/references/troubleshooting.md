# 调试与排错指南

常见问题及其排查步骤。

---

## Drizzle 迁移错误

### 问题：`npm run db:generate` 报错 "Integrity constraint violation"

**原因**：尝试对已有数据的列做不可兼容的修改（如 NOT NULL 列加到已有数据的表）。

**解决**：

1. 先给列设为 nullable，执行迁移
2. 更新已有数据
3. 再将列改为 NOT NULL

### 问题：pgEnum 添加新值失败

**原因**：PostgreSQL 的 `ALTER TYPE ADD VALUE` 有限制（不能放在中间位置）。

**解决**：Drizzle 会自动处理。如果手动写 SQL，新值只能添加到枚举末尾。如需在中间插入，需要创建新枚举并迁移。

### 问题：迁移文件已存在但 schema 有变化

**解决**：删除 `packages/server/drizzle/` 下最新的迁移文件，重新运行 `npm run db:generate`。

---

## Swagger 文档不更新

### 问题：新增路由后 `/api/docs` 不显示

**检查清单**：

1. 路由是否已在对应域的 `packages/server/src/routes/{业务域}/index.ts` 中挂载？（挂载点是域 barrel，不是 `src/index.ts`）
2. 路由文件是否调用了 `xxxRouter.openapiRoutes([...] as const)`？
3. 是否重启了开发服务器？（热更新可能不生效，需要手动重启）
4. 检查浏览器缓存，尝试硬刷新（Ctrl+Shift+R）

### 问题：DTO 在 Swagger 中重复显示

**原因**：在路由文件中本地声明了带 `.openapi('EntityName')` 的 DTO，与 `lib/dtos/` 中的定义冲突。

**解决**：删除路由文件中的本地 DTO 声明，从 `lib/openapi-dtos` 导入。

---

## MSW Mock 不生效

### 问题：前端请求仍然打到真实后端

**检查清单**：

1. 确认环境变量 `VITE_DEMO_MODE=true`（检查 `packages/web/.env.demo` 或 `.env.development`）
2. 确认 `packages/web/src/mocks/index.ts` 中的 `enableMocking()` 被调用
3. 检查浏览器 DevTools → Application → Service Workers，确认 MSW worker 已注册
4. 新 handler 是否在 `packages/web/src/mocks/handlers/index.ts` 中注册？
5. 检查浏览器控制台是否有 MSW 的 warning（如 "passthrough" 表示请求未被拦截）

### 问题：Mock 数据与 seed 数据不一致

**解决**：以 `packages/server/src/db/seed.ts` 为准，同步更新 `packages/web/src/mocks/data/` 中的对应文件。

---

## 前后端类型不匹配

### 问题：前端 `res.data` 类型报错

**原因**：后端 DTO 和前端 `Xxx` 接口字段不一致。

**排查步骤**：

1. 对比 `packages/server/src/lib/dtos/xxx.ts` 中的 `XxxDTO` 和 `packages/shared/src/{业务域}/types.ts` 中的 `Xxx` 接口
2. 确保字段名、类型、可选性一致
3. 时间字段：后端 DTO 为 `z.string()`，前端 interface 为 `string`（`YYYY-MM-DD HH:mm:ss`）

### 问题：请求参数类型报错

**排查步骤**：

1. 检查 `packages/shared/src/{业务域}/validation.ts` 中的 schema 定义
2. 前端 `request.post('/api/xxx', payload)` 的 payload 类型应与 `CreateXxxInput` 匹配
3. 注意 `z.coerce.number()` 和 `z.number()` 的区别（前者自动转换字符串）

---

## 路由 404 错误

### 问题：访问 `/api/xxx` 返回 404

**检查清单**：

1. 路由是否已挂载到对应域的 `packages/server/src/routes/{业务域}/index.ts`？新增域是否已加进 `routes/index.ts` 的 `ROUTE_DOMAINS`？
2. `['/api/xxxs', xxxRoutes]` 的路径前缀是否正确？
3. 路由文件中的 `path` 是否正确？（`/` 表示列表，`/{id}` 表示详情）
4. 检查 `xxxRouter.openapiRoutes([...])` 是否包含了该路由

### 问题：`DELETE /batch` 被匹配为 `DELETE /{id}`

**原因**：路由注册顺序错误。

**解决**：确保 `batchDeleteRoute` 在 `deleteRoute_` **之前**注册到 `openapiRoutes([...])`。

---

## 权限相关

### 问题：403 Forbidden

**排查步骤**：

1. 确认当前用户角色是否有对应权限码（如 `system:xxx:list`）——权限码全部来自**按钮型菜单节点**，仅分配页面菜单不会获得任何权限码（含查询）
2. 检查 `guard({ permission: '...' })` 中的权限码是否与按钮节点定义的 `permission` 一致
3. 超管角色（`role: 'admin'`）自动跳过权限检查

### 问题：页面可见但列表请求 403

**原因**：菜单与操作权限解耦——角色只分配了页面菜单，没有分配其「查询」按钮。

**解决**：在角色授权面板重新勾选该页面（会自动带上「查询」按钮），或单独勾选「查询」按钮。

### 问题：按钮显示了但无权限操作

**原因**：前端没有用 `hasPermission()` 控制按钮显示。

**解决**：在操作按钮外层包裹 `{hasPermission('system:xxx:action') && <Button>...</Button>}`。

---

## 数据库查询问题

### 问题：分页 total 不正确

**排查步骤**：

1. 确认使用了 `db.$count(table, where)` 而非 `count()`
2. 确认 count 和 list 的 `where` 条件一致
3. 如果有 dataScope 或 tenantScope 过滤，count 查询也需要应用相同条件

### 问题：按日期筛选时查不到当天数据

**症状**：时间范围选到「今天」，列表却少了今天的记录；或起止选同一天时结果为空。

**原因**：范围末端用 `parseDateTimeInput` 解析。它把 `2026-08-01` 解析成 `00:00:00`，
`lte(col, 2026-08-01 00:00:00)` 自然排除掉当天绝大部分数据；起止同一天时区间长度为 0。

**修复**：范围端点一律用 `dateRangeConditions(column, start, end)`（`lib/where-helpers`），
内部走 `parseDateRangeStart` / `parseDateRangeEnd`，末端取当天 `23:59:59.999`。
`parseDateTimeInput` 只用于写入实体字段的单点时间。

### 问题：传了非法时间参数却返回全量数据

**症状**：`?endTime=abc` 或 `?endTime=2026/08/01` 不报错，返回的是未经筛选的全量列表。

**原因**：查询参数声明成裸 `z.string().optional()`，Zod 放行后解析函数返回 `null`，
条件被静默丢弃。

**修复**：改用 `dateRangeBound('说明')`（`lib/openapi-schemas`），
只接受 `YYYY-MM-DD` 与 `YYYY-MM-DD HH:mm:ss`，非法输入直接 400。

### 问题：关键字搜索把 `%` 当通配符 / 搜不到含下划线的内容

**原因**：手写 `like(col, \`%${keyword}%\`)` 未转义 LIKE 元字符。

**修复**：跨列关键字匹配统一用 `keywordCondition(keyword, [colA, colB], mode?)`，
内部已 `escapeLike` 并处理空值短路；单列匹配才需要手写 `escapeLike`。

### 问题：RQB 关联查询返回 null

**排查步骤**：

1. 确认 `schema.ts` 中已声明 `xxxRelations`
2. 确认 `db` 实例创建时传入了 `schema`
3. 检查 `with:` 中的关联名是否与 relations 中定义的一致

---

## 构建错误

### 问题：`npm run build` 失败

**排查步骤**：

1. 查看错误信息中的文件路径和行号
2. 常见原因：
   - 导入路径错误（相对路径 `../` 层级不对）
   - 类型不匹配（DTO 和 interface 不一致）
   - 缺少 `.openapi()` 调用（DTO 必须调用 `.openapi('Name')`）
3. 使用 `npm run dev:server` 或 `npm run dev:web` 可以获得更详细的实时错误信息

### 问题：共享包类型找不到

**原因**：`@zenith/shared` 已按业务域拆分，只能通过域子路径导入；根入口被 ESLint 禁用，新增域未登记 `exports` 也会解析失败。

**解决**：

1. 确认导入写法为域子路径：`import type { Xxx } from '@zenith/shared/{业务域}'`。`@zenith/shared` 只暴露各业务域子路径与 `/seed`，根入口被 ESLint 禁用，`/types`、`/validation`、`/constants`、`/seed-data` 均不可用
2. 确认符号确实在该域：`packages/shared/src/{业务域}/{types,validation,constants}.ts`
3. 新增业务域时，必须同时做三件事，缺一会报模块找不到：
   - 建 `packages/shared/src/{新域}/index.ts` 并 re-export 域内文件
   - 在 `packages/shared/package.json` 的 `exports` 中登记 `"./{新域}": "./src/{新域}/index.ts"`
   - 域 `index.ts` **不得**导出 seed

### 问题：`z.enum(...)` 报 "Cannot convert undefined or null to object"

**原因**：ESM 值环导致 TDZ —— 某域的 `validation.ts` 引用了另一域 `validation.ts` 里的常量数组，而后者又反向引用前者，初始化期取到 `undefined`。

**解决**：把被跨域 `z.enum()` 引用的常量数组上移到所属域的 `constants.ts`（枚举 SSOT），`validation.ts` 只做 `z.enum(XXX_TYPES)` 引用。定位环路可用 `npx madge --circular --extensions ts packages/shared/src`，但注意它不区分 `import` 与 `import type`——只有**值**导入构成的环才会导致运行时崩溃，`import type` 形成的环编译后被擦除、无害，可忽略。

---

## 测试超时

### 问题：`npm test` 报 `Test timed out in 120000ms` / `Hook timed out in 300000ms`，但单独跑那几个文件却能通过

**原因**：vitest 默认 worker 数 = 核数−1，而每个 worker 都要独立转译整套 app（267 个路由文件）。核数越多，重复转译的开销越是反超并行收益；装配整个 app 的重用例（`app.contract.test.ts` 建 app + 1800 次进程内请求、`app.routes.test.ts` 建 app 取路由表）本就贴近超时线，被饿死后直接撞破。

**特征**（据此与真 bug 区分）：失败全是**超时**而非断言失败；单独跑同样的文件能过；`Duration` 里 transform 累计远大于墙钟（16 核实测默认档 transform 1432s / 墙钟 307s，限到 8 后为 231s / 121s）。

**解决**：按症状出现的场景调对应旋钮，二者缺一都会复发：

| 场景 | 旋钮 | 实测 |
| --- | --- | --- |
| 单独跑 `npm test` 就超时 | 调低 `packages/server/vitest.config.ts` 的 `maxWorkers`（现为 `8`，16 核实测最优，12 已开始劣化） | 307s ❌ → 113s ✅ |
| 只在发布流程的四路并行下超时 | 放宽该用例超时——它与 lint / build / docs 争抢同一种（转译）资源，如 `src/app.routes.test.ts` 的 `300_000` | 120s 撞线 ❌ → 全绿 ✅ |

`maxWorkers` 是**上限**不是目标值，核数少的机器（如 CI 的 4 核 runner）不受影响。放宽超时前先确认它属于「慢但有效」——独占跑能过、且失败是超时而非断言失败；真卡死（如顶层 await 死锁）仍应快速失败。

> ⚠️ 不要因此把发布流程的四路并行改回串行——单独跑 `npm test`（零外层并发）同样会超时，外层并行不是根因。详见 [release.md → Step 4](./release.md)。

---

## 启动缓慢

### 问题：`npm run dev:server` seed 完成后长时间无输出才打印首行日志 / 服务冷启动明显变慢

**原因**：某模块把重型 SDK（exceljs、sharp、cheerio、云厂商 SDK 等）写成了顶层静态 import，被计入每次启动的模块图加载。

**定位**：`cd packages/server && npx tsx -e` 计时 `import('./src/app')`，或对可疑包运行 `node -e "console.time('t');require('pkg');console.timeEnd('t')"`。

**解决**：改为 `createRequire` 惰性加载 + `import type`。约束与禁用清单见 [constraints.md → 重型依赖懒加载](./constraints.md#重型依赖懒加载server-全局)，写法模板见 [crud-backend.md → 重型依赖懒加载](./crud-backend.md#重型依赖懒加载重-sdk)。

### 问题：某功能首次调用报 `require is not defined`

**原因**：ESM 模块中使用了裸 `require()`（多见于照抄旧代码的懒加载写法）。

**解决**：文件顶部 `const require = createRequire(import.meta.url)`（来自 `node:module`）后再调用。

---

## 缓存与失效问题

### 问题：操作成功后页面数据没刷新

**原因**：欠失效 —— 被改动的状态有已挂载的查询在读，但 `onSuccess` 没覆盖到它。典型场景：

- 命令型接口只返回一句提示，实际却改写了 `lastRun`、写了执行日志、变更了概览统计
- 子资源写入（分配成员/角色）改变了列表的派生列（`userCount` / `userPreview`），却只失效了子键
- 下拉源以本域 key 请求了别域资源（藏键），所有者域改动时无人失效它

**解决**：按「有没有已挂载的查询读了这次被改动的状态」逐一补齐失效；藏键改为复用所有者域的共享 lookup hook。失效**未挂载**的缓存代价接近零，宁可多列几个 key，也不要漏。

### 问题：编辑弹窗打开后，详情数据进不了表单

**现象**：列表行的字段显示正常，但详情接口独有的字段是空的；保存后这些字段被静默清空。

**原因**：Semi 的 `initValues` 只在 `Form` **挂载时**读取一次。弹窗打开瞬间详情还没回来，
表单先拿列表行占位；详情到达后**记录 id 没变**，若 `key` 只含 id（`key={record.id}`），
React 不会重挂载，详情数据就永远进不了表单。

列表与详情恰好返回同一组字段时该缺陷**不会暴露**，直到详情多出一个字段——所以它常年潜伏。

**解决**：用 `@/hooks/useEditModal`，其 `formProps.key` 已按构造处理。
确有正当理由自持表单实例（搭建器、设计器等保存后不关闭的工作区）时，
`key` 直接调用同一个 `formRemountKey(id, detail)`，不要手写模板串。

### 问题：校验没过时弹出两个提示，其中一个是英文「操作失败：xxx」

**现象**：表单校验失败，除了自己写的中文提示，还多出一个 `操作失败：empty content`
之类的英文提示；同时 `/api/frontend-errors` 里堆积由用户正常操作产生的假告警。

**原因**：用抛裸 `Error` 的方式中断提交。`useGlobalErrorHandler` 只放行三类拒绝——
`ApiError`、`SubmitAborted`、以及**单词消息**的裸 `Error`（历史写法，向后兼容）。
`throw new Error('empty content')`（带空格）、`'save-failed'`（带连字符）都不满足单词判据，
会被当成真实故障：弹兜底 Toast + 上报错误监控。Semi 的 Modal 不吞 `onOk` 的拒绝，
自定义 footer 里 `void modal.modalProps.onOk()` 更是直接落到 window。

**解决**：先给出面向用户的提示，再调用 `@/lib/abort-submit` 的 `abortSubmit()`。
不要改成 `return`——那样 Semi 的确定按钮会一直转圈。

```ts
beforeSave: (values) => {
  if (!contentHtml) {
    Toast.warning('请输入公告内容');  // 面向用户的提示由调用方负责
    abortSubmit();                    // 中断提交，不弹兜底 Toast、不上报
  }
  return { ...values, content: contentHtml };
}
```

> 反过来也要留意：**真实的不变量违反不要用 `abortSubmit()` 吞掉**。
> 「编辑态却没有 id」这类本不该发生的情况应当继续抛 `Error` 并被上报，
> 只需把消息写成用户看得懂的中文。

### 问题：改一条数据，整屏查询全部重拉

**原因**：失效面过大。常见于 `xxxKeys.all` 指向整个业务大域的根、静态 lookup 与列表同前缀、昂贵派生取数（看板数据、聚合分析）与列表同根。

**解决**：按 [crud-frontend.md 的 key 结构设计](./crud-frontend.md#key-结构设计)重新划分命名空间，并把 `onSuccess` 收敛到具体前缀键；用 `test-utils/query-harness.ts` 的 `observeFetches` 断言实际进入 fetching 的查询数量。

### 问题：保存后详情显示异常（菜单勾选被清空 / 出现不该显示的明文字段）

**原因**：`setQueryData(detail(id), saved)` 回填了与详情接口**形状或可见性不一致**的写接口响应。

**解决**：改为 `invalidateQueries({ queryKey: xxxKeys.detail(id) })`。可回填的判定条件与四种禁止回填的情形见 [crud-frontend.md 回填红线](./crud-frontend.md#落地要求)。

### 问题：编辑弹窗里详情数据不显示（只有列表已有的字段有值）

**原因**：Semi 的 `initValues` 只在 `Form` **挂载时**读取一次。弹窗打开的瞬间详情请求还没返回，
表单先拿列表行占位；详情到达后 `initValues` 表达式虽然变了，但 Form 已经挂载，不会重新读取。
典型写法是 `initValues={editing ?? {...}}` 且 `<Form>` 上没有 `key`。

危害具有延迟性：列表与详情返回同一组字段时完全看不出异常（只是白白多发一次详情请求），
一旦详情新增一个列表没有的字段，编辑就会把它静默提交为空。

**解决**：改用 `useEditModal`（`packages/web/src/hooks/useEditModal.ts`）并展开 `formProps`——
它的 `key` 由 `${id}:${详情是否已到达}` 派生，详情到达时强制重挂载。
确需手写时，必须自行给 `<Form>` 加上随详情变化的 `key`，或在详情到达后 `formApi.setValues(...)`。
