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

1. 路由是否已在对应域的 `packages/server/src/routes/{业务域}/index.ts` 中挂载？（不再改 `src/index.ts`）
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

1. 确认导入写法为域子路径：`import type { Xxx } from '@zenith/shared/{业务域}'`（不是 `from '@zenith/shared'`，也不是已删除的 `/types`、`/validation`、`/constants`、`/seed-data`）
2. 确认符号确实在该域：`packages/shared/src/{业务域}/{types,validation,constants}.ts`
3. 新增业务域时，必须同时做三件事，缺一会报模块找不到：
   - 建 `packages/shared/src/{新域}/index.ts` 并 re-export 域内文件
   - 在 `packages/shared/package.json` 的 `exports` 中登记 `"./{新域}": "./src/{新域}/index.ts"`
   - 域 `index.ts` **不得**导出 seed

### 问题：`z.enum(...)` 报 "Cannot convert undefined or null to object"

**原因**：ESM 值环导致 TDZ —— 某域的 `validation.ts` 引用了另一域 `validation.ts` 里的常量数组，而后者又反向引用前者，初始化期取到 `undefined`。

**解决**：把被跨域 `z.enum()` 引用的常量数组上移到所属域的 `constants.ts`（枚举 SSOT），`validation.ts` 只做 `z.enum(XXX_TYPES)` 引用。定位环路可用 `npx madge --circular --extensions ts packages/shared/src`，但注意它不区分 `import` 与 `import type`——只有**值**导入构成的环才会导致运行时崩溃，`import type` 形成的环编译后被擦除、无害，可忽略。

---

## 缓存与失效问题

### 问题：`npm run lint`（web）报「mutation 失效粒度回退」

**原因**：`scripts/check-invalidation-baseline.mjs` 在某个域 hooks 文件的 mutation `onSuccess` 里发现了超出基线数量的 `xxxKeys.all` 广播失效。

**解决**：

1. 默认做法是**改代码**：按真实副作用列出受影响的 key（`lists` / `detail(id)` / 子键 / 前缀键），而不是广播整域。规范见 [crud-frontend.md 缓存一致性契约](./crud-frontend.md)
2. 确属合法广播（批量覆盖、切租户、全量导入）：在 `onSuccess` 注释写明理由，再执行 `node packages/web/scripts/check-invalidation-baseline.mjs --update`
3. 收敛完一个域后也要 `--update`，把该域额度降下来锁住成果

### 问题：操作成功后页面数据没刷新

**原因**：欠失效 —— 被改动的状态有已挂载的查询在读，但 `onSuccess` 没覆盖到它。典型场景：

- 命令型接口只返回一句提示，实际却改写了 `lastRun`、写了执行日志、变更了概览统计
- 子资源写入（分配成员/角色）改变了列表的派生列（`userCount` / `userPreview`），却只失效了子键
- 下拉源以本域 key 请求了别域资源（藏键），所有者域改动时无人失效它

**解决**：按「有没有已挂载的查询读了这次被改动的状态」逐一补齐失效；藏键改为复用所有者域的共享 lookup hook。失效**未挂载**的缓存代价接近零，宁可多列几个 key，也不要漏。

### 问题：改一条数据，整屏查询全部重拉

**原因**：失效面过大。常见于 `xxxKeys.all` 指向整个业务大域的根、静态 lookup 与列表同前缀、昂贵派生取数（看板数据、聚合分析）与列表同根。

**解决**：按 [crud-frontend.md 的 key 结构设计](./crud-frontend.md#key-结构设计)重新划分命名空间，并把 `onSuccess` 收敛到具体前缀键；用 `test-utils/query-harness.ts` 的 `observeFetches` 断言实际进入 fetching 的查询数量。

### 问题：保存后详情显示异常（菜单勾选被清空 / 出现不该显示的明文字段）

**原因**：`setQueryData(detail(id), saved)` 回填了与详情接口**形状或可见性不一致**的写接口响应。

**解决**：改为 `invalidateQueries({ queryKey: xxxKeys.detail(id) })`。只有写接口与详情接口同源（服务端同一个 `mapXxx`）才可回填；详情做了脱敏、多出关联数据、写接口不回传编辑过的关联字段、列表含聚合字段这四种情形一律不得回填。
