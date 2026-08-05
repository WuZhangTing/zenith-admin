---
name: zenith
description: "Zenith Admin 项目专属开发辅助。Use when: 开发新模块、实现 CRUD、新增页面、配置菜单权限、增删改查、新建后台功能、新增管理功能、异步任务、批量操作、任务进度、发布新版本、db migration、seed data、MSW mock、修改现有模块、添加字段。包含完整的 CRUD 代码生成流程（Step 0-11）、异步任务接入、模块修改流程与版本发布流程。"
argument-hint: "部门管理 CRUD | 公告管理（含 MSW Mock）| 发布 v1.2.0 | 给用户表加字段"
user-invocable: true
---

# Zenith Admin 开发辅助 Skill

你是 Zenith Admin 项目的专属开发辅助 Agent。本项目是一个基于 **Hono + React + Drizzle ORM** 的全栈后台管理系统，采用 npm monorepo 结构（`packages/server` + `packages/web` + `packages/shared`）。

## 参考文件分工（按需读取，规则只在各自归属处维护一份）

| 文件 | 里面有什么 | 什么时候读 |
| --- | --- | --- |
| 本文件 `SKILL.md` | 场景识别、Step 编排、验收动作 | 每次触发 |
| [constraints.md](./references/constraints.md) | 硬约束单一来源：一句话可核对的「必须 / 禁止」 | 动手改代码前、完成后核对 |
| [step0-checklist.md](./references/step0-checklist.md) | Step 0 信息收集问卷 | 开始新模块前 |
| [crud-backend.md](./references/crud-backend.md) | Step 1-7 后端模板与展开说明 | 写后端时 |
| [crud-frontend.md](./references/crud-frontend.md) | Step 8 前端模板、数据获取与缓存一致性契约 | 写前端时 |
| [seed-config.md](./references/seed-config.md) | Step 9-10 菜单权限与种子数据 | 配菜单/种子时 |
| [crud-mock.md](./references/crud-mock.md) | Step 11 MSW Mock 模板 | 需要 Demo 模式时 |
| [async-tasks.md](./references/async-tasks.md) | 任务中心接入模板与选型对照 | 有长耗时/批量操作时 |
| [module-modification.md](./references/module-modification.md) | 加字段/改接口/加关联等场景的步骤序列 | 改已有模块时 |
| [troubleshooting.md](./references/troubleshooting.md) | 症状 → 定位 → 指回规范 | 报错时 |
| [release.md](./references/release.md) | 版本发布流程 | 发版时 |

> 规则只在归属文件里写一遍：约束正文在 `constraints.md`，代码写法与展开说明在 `crud-*.md`。
> 需要引用时给指针，**不要把内容抄到第二处**。

## 场景识别

- **CRUD 开发**：触发词「实现 XXX CRUD」「新增 XXX 模块」「开发 XXX 功能」「新增管理页面」
- **修改现有模块**：触发词「给 XXX 加字段」「修改 XXX 接口」「XXX 添加关联」
- **异步任务/批量操作**：触发词「批量导入」「批量处理」「后台任务」「任务进度」「长耗时操作」「异步执行」
- **发布新版本**：触发词「发布 vX.Y.Z」「准备发布」「release X.Y.Z」

> **快速模式**：如果用户说「帮我实现一个简单的 XXX 管理，用默认配置」，可以跳过 Step 0 中的可选项（MSW Mock、数据权限、租户隔离等），使用合理默认值直接生成。

---

## CRUD 开发流程（Step 0 → Step 11）

### ⛔ BLOCKING GATE — Step 0：信息收集（不得跳过）

**在生成任何代码之前，必须先完成 Step 0。**

读取 [references/step0-checklist.md](./references/step0-checklist.md)，通过 `vscode_askQuestions` 向用户逐项收集信息，展示汇总后用户确认，再进入 Step 1。

Step 0 中必须同时确认以下可选项（决定后续步骤是否执行）：
- 是否需要 MSW Mock？→ 影响 Step 11 是否执行
- 是否有状态字段 / 关联实体 / 数据权限（dataScope）/ 租户隔离 / 批量操作 / 数据导出？

---

### 第一阶段：后端实现（Step 1-7）

按顺序执行，每步的代码模板和规范见 [crud-backend.md](./references/crud-backend.md)。

| Step | 任务 | 文件 |
|------|------|------|
| 1 | 数据库 Schema | `packages/server/src/db/schema/{业务域}.ts`（relations 在 `relations.ts`） |
| 2 | 生成并执行迁移 | `npm run db:generate && npm run db:migrate` |
| 3 | 共享 Zod Schema | `packages/shared/src/{业务域}/validation.ts` |
| 4 | 共享 TS Interface | `packages/shared/src/{业务域}/types.ts`（枚举常量放同域 `constants.ts`） |
| 5 | Service 层 | `packages/server/src/services/{业务域}/xxx.service.ts` |
| 6 | OpenAPI Route | `packages/server/src/routes/{业务域}/xxx.ts` |
| 7 | 注册路由 | `packages/server/src/routes/{业务域}/index.ts`（域 barrel，新增域需同步 `routes/index.ts`） |

> Step 7 完成后执行 `npm run dev:server` 冒烟验证，无编译错误再继续。

> ⚠️ **三条跨步骤强制约束**（详规见括号内文档，按需读取）：
> 1. `@zenith/shared` 一律走域子路径导入，新增域需建 `index.ts` 并登记 `exports`，枚举常量放 `constants.ts`
>    （[constraints.md → Shared 层](./references/constraints.md)）
> 2. 服务端对外 HTTP 请求必须用 `lib/http-client.ts`，禁止直接 `fetch()`
>    （[constraints.md → Route 层](./references/constraints.md)、[crud-backend.md](./references/crud-backend.md)）
> 3. 长耗时/批量操作必须接任务中心，禁止自建任务表或后台轮询线程
>    （[async-tasks.md](./references/async-tasks.md)）

---

### 第二阶段：前端实现（Step 8）

代码模板和规范见 [crud-frontend.md](./references/crud-frontend.md)。数据获取统一使用 **TanStack Query v5**（域 hooks + `unwrap`），禁止手写 `loading`/`fetchXxx`/`useEffect` 拉取模式。

| Step | 任务 | 文件 |
|------|------|------|
| 8a | 域 hooks（查询/变更） | `packages/web/src/hooks/queries/xxxs.ts` |
| 8b | 页面组件 | `packages/web/src/pages/xxx/XxxPage.tsx` |

---

### 第三阶段：配置与 Mock（Step 9-11）

代码模板和规范见 [seed-config.md](./references/seed-config.md)。

| Step | 任务 | 文件 | 条件 |
|------|------|------|------|
| 9 | 菜单/权限配置 | `packages/shared/src/seed/menus/{段}.ts`（按一级目录 ID 段分片） | 总是 |
| 10 | 种子数据 | `packages/shared/src/seed/{业务域}.ts` + `packages/server/src/db/seed.ts` | 总是 |
| 11 | MSW Mock | `packages/web/src/mocks/data/xxxs.ts` + `handlers/xxxs.ts` | 仅 Step 0 确认需要时 |

MSW Mock 的详细代码模板见 [crud-mock.md](./references/crud-mock.md)。

---

### ✅ CRUD 完成标准

**验收动作**（全部通过才算完成）：

- [ ] `npm run db:generate && npm run db:migrate` 已执行，迁移文件已提交
- [ ] `npm run build` 无报错
- [ ] `npm run dev:server` 冒烟通过，新接口在 `/api/docs` 中可见且可调用
- [ ] `npm run lint -w @zenith/web` 通过（含 ESLint 与 stylelint）
- [ ] `npm run test -w @zenith/web` 通过；域 hooks 的失效行为测试已补充
- [ ] 页面实测一遍：查询 / 重置 / 新增 / 编辑 / 删除 / 导出，确认操作后相关列、统计与面板都刷新
      （欠失效比多失效更危险），移动端窄屏同样走一遍
- [ ] Step 0 确认需要 MSW Mock 时，Demo 模式（`VITE_DEMO_MODE=true`）下页面功能完整

**规范核对**：打开 [constraints.md](./references/constraints.md)，按 Schema 层 → Shared 层 → Service 层 →
Route 层 → 前端层 → 菜单与权限 → 全局章节，逐组对照本次改动涉及的文件。约束条目本身即核对项，
此处不再复制第二份。

---

## 其他场景

| 场景 | 做法 |
| --- | --- |
| 修改已有模块（加字段 / 改接口 / 加关联 / 改枚举 / 删字段） | 读 [module-modification.md](./references/module-modification.md)，按对应场景的步骤序列执行 |
| 长耗时 / 批量操作 | 读 [async-tasks.md](./references/async-tasks.md)，按模板接任务中心（含与导出中心、cron_jobs 等的选型对照） |
| 构建错误 / 迁移失败 / 类型不匹配 / 缓存不刷新 | 读 [troubleshooting.md](./references/troubleshooting.md) |
| 发布新版本 | 读 [release.md](./references/release.md) 并严格按步骤执行 |
