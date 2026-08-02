# Zenith Skill

Zenith Skill 是本项目的专属开发辅助工作流，位于 `.agents/skills/zenith/`，是**开发规范与代码模板的唯一来源**（设计缘由见[概览](/ai/#单一事实来源设计)）。`SKILL.md` 头部声明了 `user-invocable` 与触发描述，在支持 Skills 的 AI 工具（如 GitHub Copilot）中用自然语言描述需求即可自动触发：

```text
实现「商品分类」的 CRUD 管理功能
```

```text
给用户表加字段 / 批量导入要接任务进度 / 发布 v1.2.0
```

---

## 文件清单与职责分工

入口 `SKILL.md` 负责场景识别、Step 编排与验收动作，每次触发都会读取；`references/` 下按职责拆分、按需加载：

| 文件 | 职责 | 何时读取 |
| --- | --- | --- |
| `SKILL.md` | 场景识别、Step 0-11 编排、验收动作 | 每次触发 |
| `references/constraints.md` | **硬约束唯一来源**：按 Schema / Shared / Service / Route / 前端 / 菜单权限 / MSW Mock 分层，外加时间格式、图标库、分页格式等全局约束 | 动手改代码前、完成后核对 |
| `references/step0-checklist.md` | Step 0 信息收集问卷（必填项 + 可选项 + 数据权限、多租户决策表） | 开始新模块前 |
| `references/crud-backend.md` | Step 1-7 后端模板：schema / 迁移 / 共享类型 / service / OpenAPI 路由 / DTO / 路由挂载 | 写后端时 |
| `references/crud-frontend.md` | Step 8 前端模板：域 hooks / 列表页 / 弹窗，含数据获取架构与缓存一致性契约 | 写前端时 |
| `references/seed-config.md` | Step 9-10 菜单权限（ID 分段规则、菜单与权限解耦）与种子数据 | 配菜单 / 种子时 |
| `references/crud-mock.md` | Step 11 MSW Mock 模板（Demo 演示模式） | 需要 Demo 模式时 |
| `references/async-tasks.md` | 任务中心接入模板与选型对照 | 有长耗时 / 批量操作时 |
| `references/module-modification.md` | 加字段 / 改接口 / 加关联 / 改枚举 / 删字段的步骤序列 | 改已有模块时 |
| `references/troubleshooting.md` | 症状 → 定位 → 指回规范 | 报错时 |
| `references/release.md` | 版本发布流程 | 发版时 |

> 规则只在归属文件里写一遍：约束正文在 `constraints.md`，代码写法与展开说明在 `crud-*.md`，文件之间只给指针、不抄内容。

---

## 触发场景

`SKILL.md` 识别四类场景：

| 场景 | 触发词示例 |
| --- | --- |
| CRUD 开发 | 「实现 XXX CRUD」「新增 XXX 模块」「开发 XXX 功能」「新增管理页面」 |
| 修改现有模块 | 「给 XXX 加字段」「修改 XXX 接口」「XXX 添加关联」 |
| 异步任务 / 批量操作 | 「批量导入」「后台任务」「任务进度」「长耗时操作」 |
| 发布新版本 | 「发布 vX.Y.Z」「准备发布」「release X.Y.Z」 |

> **快速模式**：说「帮我实现一个简单的 XXX 管理，用默认配置」，可跳过 Step 0 的可选项询问，用合理默认值直接生成。

---

## CRUD 开发流程（Step 0-11）

### Step 0：信息收集（阻塞门槛，不得跳过）

生成任何代码之前，AI 会按 `references/step0-checklist.md` 逐项向你确认：

- **必须明确**：模块中文名、实体英文名、API 路径前缀、数据库表名、权限前缀、主要字段列表、父菜单 ID（每个一级目录独占 1000 段，如系统管理 = id:1000，以 `packages/shared/src/seed/menus.ts` 的实际占用为准）
- **主动询问的可选项**（不默认开启）：MSW Mock、状态字段、关联实体、数据导出、时间范围筛选、数据权限（dataScope）、表格批量操作、租户隔离

收集完成后展示汇总确认，再进入实现。

### 三阶段实现

**第一阶段：后端（Step 1-7）**，模板见 `crud-backend.md`：

| Step | 任务 | 位置 |
| --- | --- | --- |
| 1 | 数据库 Schema | `packages/server/src/db/schema/{业务域}.ts`（relations 统一在 `relations.ts`） |
| 2 | 生成并执行迁移 | `npm run db:generate && npm run db:migrate` |
| 3 | 共享 Zod Schema | `packages/shared/src/{业务域}/validation.ts` |
| 4 | 共享 TS 类型 | `packages/shared/src/{业务域}/types.ts`（枚举常量放同域 `constants.ts`） |
| 5 | Service 层 | `packages/server/src/services/{业务域}/xxx.service.ts` |
| 6 | OpenAPI 路由 + DTO | `packages/server/src/routes/{业务域}/xxx.ts`；DTO 放 `lib/dtos/`（barrel：`openapi-dtos.ts`） |
| 7 | 注册路由 | `packages/server/src/routes/{业务域}/index.ts`（域 barrel，新增域需同步 `routes/index.ts`）；完成后 `npm run dev:server` 冒烟 |

**第二阶段：前端（Step 8）**，模板见 `crud-frontend.md`，数据获取统一走 TanStack Query v5 域 hooks：

| Step | 任务 | 位置 |
| --- | --- | --- |
| 8a | 域 hooks（查询 / 变更） | `packages/web/src/hooks/queries/xxxs.ts` |
| 8b | 页面组件 | `packages/web/src/pages/xxx/XxxPage.tsx` |

**第三阶段：配置与 Mock（Step 9-11）**，见 `seed-config.md` 与 `crud-mock.md`：

| Step | 任务 | 位置 | 条件 |
| --- | --- | --- | --- |
| 9 | 菜单 / 权限配置 | `packages/shared/src/seed/menus/{段}.ts`（按一级目录 ID 段分片） | 总是 |
| 10 | 种子数据 | `packages/shared/src/seed/{业务域}.ts` + `packages/server/src/db/seed.ts` | 总是 |
| 11 | MSW Mock | `packages/web/src/mocks/data/xxxs.ts` + `handlers/xxxs.ts` | 仅 Step 0 确认需要时 |

### 验收标准

`SKILL.md` 定义了完成标准，全部通过才算完成：迁移已执行并提交、`npm run build` 无报错、`dev:server` 冒烟且新接口在 `/api/docs` 可见可调用、web 包 lint 与测试通过、页面全操作实测（查询 / 重置 / 增删改 / 导出，含移动端窄屏）、需要 Mock 时 Demo 模式（`VITE_DEMO_MODE=true`）功能完整。最后打开 `constraints.md` 按分层逐组核对本次改动。

---

## 需求描述最佳实践

```text
实现「合同管理」CRUD，字段包括：
- 合同编号 string 必填唯一
- 员工（关联 users 表，外键 userId）
- 合同类型 枚举：正式/实习/外包
- 开始日期 date 必填
- 结束日期 date 必填
- 备注 text 可选

菜单挂在「系统管理」下（父菜单 id:1000），需要 MSW Mock
```

- **明确字段**：提前说明字段名、类型、约束，减少来回确认次数
- **明确关联**：外键关联（如关联部门、用户）需要提前说明
- **说清菜单位置**：告知页面挂载在哪个一级菜单下

---

## 其他场景

- **修改现有模块**：按 `module-modification.md` 中对应场景（加字段 / 改接口 / 加关联 / 改枚举 / 删字段）的步骤序列，同步检查 Schema、迁移、共享类型、DTO、Service、路由、前端页面与 MSW Mock。
- **异步任务 / 批量操作**：长耗时操作禁止自建任务表或后台轮询线程，必须按 `async-tasks.md` 接入任务中心（任务记录、实时进度、断点续跑、自动重试、协作式取消、幂等提交等能力框架已内置），详见[任务中心](/backend/task-center)。
- **发布新版本**：按 `release.md` 执行——版本号确认、全包 `package.json` 版本同步、lock 文件同步、lint 与测试（涉及资金链路时须跑 DB 集成测试）、构建验证（含文档站与 Demo）、Changelog、提交打 tag、GitHub Actions 发布。
- **报错排查**：`troubleshooting.md` 按「症状 → 定位 → 指回规范」组织，覆盖迁移失败、Swagger 不更新、MSW 不生效、404、权限、构建报错等。

---

## 规范正文去哪读

本页只描述结构与职责，不复制规则——同一条规则写在多处，重构后必然只改其中一处而留下另一处继续误导。

- 硬约束清单：[`constraints.md`](https://github.com/iwangbowen/zenith-admin/blob/master/.agents/skills/zenith/references/constraints.md)
- 后端写法：[`crud-backend.md`](https://github.com/iwangbowen/zenith-admin/blob/master/.agents/skills/zenith/references/crud-backend.md)；API 形态与审计另见 [API 规范](/backend/api-conventions)、[操作日志与变更记录](/backend/audit-log-changes)
- 前端写法：[`crud-frontend.md`](https://github.com/iwangbowen/zenith-admin/blob/master/.agents/skills/zenith/references/crud-frontend.md)；设计取向另见 [UI 规范](/frontend/ui-conventions)、[公共组件](/frontend/components)、[数据获取](/frontend/data-fetching)

---

## 维护约定

修改代码规范后，同步更新 `references/` 中的对应文件（约束进 `constraints.md`，写法进对应模板文件），确保后续 AI 生成的代码始终与项目一致；新增 reference 文件时，在 `SKILL.md` 的分工表与 `AGENTS.md` 的规范索引各登记一行。
