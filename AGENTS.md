# Zenith Admin — AI 协作指南

Zenith Admin 是一个基于 **Hono + React + Drizzle ORM** 的全栈后台管理系统，采用 npm monorepo 结构。

> **本文件的定位**：每次会话自动加载，只提供**项目导航**——项目长什么样、命令怎么跑、各子系统在哪。
>
> **开发规范一律不在此复述**，全部维护在 `.agents/skills/zenith/`。此前两处各写一份，
> 结果是同一条「注册路由」指引在重构后同时失效、AGENTS.md 甚至在教 skill 明令禁止的旧写法。
> 现在规则只有一个来源，本文件只负责**告诉你去哪读**。

---

## ⚠️ 动手改代码前必读

`.agents/skills/zenith/` 里的 skill 只在 CRUD 开发、模块修改、异步任务、版本发布等场景**按需触发**。
但它的规范约束对**所有**改动都适用——包括临时修 bug、重构、调样式。

因此：**在写下第一行代码之前，先读 [`.agents/skills/zenith/references/constraints.md`](.agents/skills/zenith/references/constraints.md)**（分层规范约束清单）。

它涵盖了时间格式、统一响应构造、分页写法、图标库、service 边界、薄路由、DTO 中心化、
LIKE 转义、外呼 HTTP、表格与弹窗布局、菜单权限等硬约束。不读就动手，大概率会在 review 或 CI 被打回。

改动涉及具体场景时，再按文末索引取用对应文件。

---

## 项目结构

```text
packages/
├── server/          Hono HTTP 服务，Drizzle ORM，PostgreSQL，JWT 认证
├── web/             React 19 + Vite + Semi Design 前端（含前台会员 SPA）
├── shared/          前后端共享的 TypeScript 类型 + Zod 验证 schema + 种子数据
├── analytics-sdk/   埋点采集 SDK
└── electron/        桌面客户端封装
```

---

## 常用命令

```bash
npm run dev            # 同时启动 server + web 开发服务器
npm run dev:server     # 仅启动后端
npm run dev:web        # 仅启动前端
npm run build          # 顺序构建：shared → analytics-sdk → server → web
npm run lint           # server + analytics-sdk + web 三包 eslint
npm test               # server + web 全量 vitest
npm run db:generate    # 生成 Drizzle 迁移文件
npm run db:migrate     # 执行数据库迁移
npm run db:seed        # 填充初始种子数据
npm run docs:dev       # 本地预览 VitePress 文档站
```

---

## 架构总览

> 本节只说明**是什么、在哪里**。**怎么写**见 skill（文末索引）。

### 后端（`packages/server`）

- **框架**：Hono v4（`OpenAPIHono`），通过 `@hono/node-server` 运行在 Node.js
- **应用装配**：`src/app.ts` 的 `createApp()` 是**纯函数**（中间件栈 → 路由装配 → OpenAPI 文档 → 兜底与错误处理），不启动服务器、不注册 worker、不订阅事件，因此可在测试中直接构造；`src/index.ts` 只做启动编排；后台 worker 与事件订阅者分别在 `src/bootstrap/workers.ts` 与 `subscribers.ts`
- **路由装配**：路由文件位于 `src/routes/{业务域}/`，每个域在自己的 `index.ts` 中用 `defineRouteDomain`（契约见 `src/routes/_kit.ts`）声明挂载清单，`src/routes/index.ts` 的 `ROUTE_DOMAINS` 只声明域顺序；路由表由 `src/app.routes.test.ts` 快照锁定（不含挂载顺序）
- **Service 层**：业务逻辑、数据映射、前置校验位于 `src/services/{业务域}/`，与路由目录同构
- **认证**：Access Token（2h）+ Refresh Token（30d）双 token；`src/middleware/auth.ts` 的 `authMiddleware` 注入 `c.set('user', payload)`；签发/校验统一走 `src/lib/jwt.ts`
- **请求上下文**：全局挂载 `hono/context-storage`，辅助函数用 `src/lib/context.ts` 的 `currentUser()` / `getCtx()` 零参取值
- **数据库**：Drizzle ORM + PostgreSQL，schema 按业务域拆分在 `src/db/schema/`（`xxxRelations` 统一在 `relations.ts`），由 `src/db/schema.ts` barrel 统一 re-export（导入方式不变：`import { users } from '../db/schema'`）；迁移在 `packages/server/drizzle/`；数据库类型别名在 `src/db/types.ts`
- **DTO**：响应实体 DTO 按业务域拆分在 `src/lib/dtos/`，通过 `src/lib/openapi-dtos.ts` re-export barrel 统一暴露
- **错误处理**：Hono 原生 `HTTPException`，由 `src/app.ts` 的全局 `onError` 统一转为标准 JSON 错误响应
- **验证**：入参通过 `@hono/zod-openapi` 的 `createRoute` 声明 Zod schema 后自动校验，路由内用 `c.req.valid()` 取值

### 前端（`packages/web`）

- **UI 库**：Semi Design v2（`@douyinfe/semi-ui`）
- **路由**：`react-router-dom` v7，页面组件位于 `src/pages/`；菜单驱动的动态路由由 `src/utils/page-registry.ts` 解析
- **认证状态**：`useAuth` hook，token 存于 `localStorage`，key 为 `zenith_token`（来自 `@zenith/shared` constants）
- **HTTP 请求**：封装在 `src/utils/request.ts`，自动附加 token 并处理 401 跳转（仅作传输层）
- **服务端状态**：统一由 **TanStack Query v5** 管理，域 hooks 位于 `src/hooks/queries/<域>.ts`
- **多入口**：admin（`index.html`）+ 前台会员 SPA（`member.html`）+ 移动端审批页（`approval.html`）
- **环境变量**：`VITE_API_BASE_URL`（API 地址）、`VITE_APP_TITLE`（应用名）

### 共享层（`packages/shared`）

- 直接引用 `.ts` 源文件，**无需编译步骤**——新增类型/schema 后 server 和 web 立即可用
- **已按业务域拆分**（与 server 路由域对齐），每个域固定三件套 + 可选运行时：

  ```text
  packages/shared/src/
  ├── core/          ApiResponse<T> / PaginatedResponse<T> / EntityStatus / TOKEN_KEY 等跨域基础契约
  ├── identity/      用户 / 角色 / 菜单 / 部门 / 岗位 / 用户组 / 租户 / 认证
  ├── platform/      字典 / 系统配置 / 文件 / 日志 / 会话 / 监控 / 备份 / 脱敏
  ├── messaging/     公告 / 邮件 / 短信 / 站内信 / 渠道
  ├── workflow/      流程定义 / 实例 / 任务 / 表单（含 formula、form-runtime、helpers、serial 运行时）
  ├── payment/  member/  report/（含 print、format、embed 等）  analytics/
  ├── ai/  chat/  mp/  cms/（含 link）  open-platform/  rules/（含 cell）  ops/  tasks/  biz/
  └── seed/          DB seed 与 MSW mock 共用的种子数据（menus.ts 单独承载 SEED_MENUS）
  ```

  每个域内：`types.ts`（实体类型）、`validation.ts`（Zod schema）、`constants.ts`（枚举 + LABELS/OPTIONS）、`index.ts`（域入口）
- **必须使用域子路径导入，禁止根入口**（ESLint `no-restricted-imports` 强制）：

  ```ts
  import type { User } from '@zenith/shared/identity';        // ✅
  import { createPaymentOrderSchema } from '@zenith/shared/payment';  // ✅
  import { SEED_MENUS } from '@zenith/shared/seed';           // ✅ 种子数据独立入口
  import type { User } from '@zenith/shared';                 // ❌ 会把 18 个域全部拉进依赖图
  ```

- **域 index 刻意不导出 seed**：种子数据只服务于 `db/seed.ts` 与 MSW mock，不应进入生产依赖图
- **枚举 SSOT 在 constants**：`XXX_TYPES` 常量数组 + 派生 union type + `XXX_LABELS` 一并定义在域的 `constants.ts`；`validation.ts` 用 `z.enum(XXX_TYPES)` 引用。**禁止**把供跨域 `z.enum()` 使用的常量数组写在 `validation.ts` —— 会在 validation 之间形成 ESM 值环，`z.enum()` 初始化期取到 `undefined` 直接崩溃。排查环路可用 `npx madge --circular --extensions ts packages/shared/src`，但它不区分 `import` 与 `import type`：只有值导入构成的环有害，类型环编译后被擦除、可忽略


---

## 子系统速查

> 以下是 skill 未覆盖的项目事实（部署形态、连接配置、隔离设计）。

### 文件存储

支持四种模式，通过 `file_storage_configs` 表的 `is_default` 切换：**local**（本地文件系统）、**oss**（阿里云）、**s3**（S3 兼容：AWS S3 / MinIO / Cloudflare R2）、**cos**（腾讯云）。相关逻辑在 `packages/server/src/lib/file-storage.ts`。

### 数据库

默认连接 `postgresql://postgres:postgres@localhost:5432/zenith_admin`（可通过 `.env` 覆盖）。

迁移链已在 v1.23.0 重建基线，**不保留向后数据兼容**，存量库需重新初始化。两处手写 DDL（`pg_trgm` 扩展与 trgm 索引、条件启用的 `pgvector` 列）无法由 `drizzle-kit generate` 重新生成，单独维护在 `drizzle/0001_extensions.sql`，重建基线时必须一并保留。

### Redis

会话数据（在线会话、强制下线黑名单）通过 Redis 持久化，服务重启不丢失。默认 `redis://127.0.0.1:6379`。

```dotenv
REDIS_URL=redis://127.0.0.1:6379        # 方式一：URL（支持带密码）
# REDIS_HOST=127.0.0.1                  # 方式二：逐项配置
# REDIS_PORT=6379
# REDIS_PASSWORD=
# REDIS_DB=0
```

key 统一带命名空间前缀（默认 `zenith:`，可用 `REDIS_KEY_PREFIX` 覆盖）：

- `zenith:session:{tokenId}` — SessionInfo JSON，TTL 8h（每次请求自动续期）
- `zenith:blacklist:{tokenId}` — 强制下线标记，TTL 2h（与 accessToken 有效期一致）
- `zenith:member-session:{tokenId}` — 会员会话，与管理员会话隔离

### 请求防护

多层可选防护，通过环境变量控制：

```dotenv
REQUEST_BODY_LIMIT=0     # 请求体上限（字节），0 = 不限制
REQUEST_TIMEOUT_MS=0     # 请求超时（毫秒），0 = 不启用
ALLOWED_ORIGINS=         # CSRF 来源白名单，逗号分隔，留空 = 开发模式不限制
```

- `bodyLimit` 全局生效，超限返回 `{ code: 413, ... }`
- `timeout` 仅对 `/api/*` 生效，用 `hono/combine` 的 `except()` 自动排除 WebSocket、文件、备份、AI 流式及所有 `/export` 结尾的导出接口，超时返回 `{ code: 408, ... }`
- `hono/csrf` 校验 `Origin` 头；无 `Origin`（curl/Postman/服务端）直接放行
- **接口级限流**（`hono-rate-limiter` + Redis）：配置见 `src/middleware/rate-limit.ts`，超限返回 `{ code: 429, ... }`
- **幂等控制**（`idempotencyGuard`）：客户端 `X-Idempotency-Key` 显式模式，或服务端按 `userId+method+path+bodyHash` 自动指纹；在 `createRoute` 的 `middleware` 数组中按路由声明，实现见 `src/middleware/idempotency.ts`
- 中间件栈装配位置：`src/app.ts`

### 前台会员体系（Members）

系统采用**前台 / 后台双用户体系**，彻底隔离：

- **管理员**（后台）：`users` 表 + `/api/auth/*` + JWT(`roles[]`/`tenantId`/`jti`) + `AdminLayout`（`index.html`）
- **会员**（前台 C 端）：`members` 表 + `/api/member/auth/*` + 独立 JWT(`memberId`/`type:'member'`/`jti`) + 独立 SPA（`member.html`）

**认证隔离（安全关键）**：

- 会员 JWT payload **必须**带 `type:'member'`，`memberAuthMiddleware` 强制校验；管理员 `authMiddleware` 反向拒绝带该标记的 token，杜绝两套 token 互窜
- 会员会话走独立 Redis key 前缀；上下文用 `src/lib/member-context.ts` 的 `currentMember()` / `currentMemberId()`
- 前台自助接口全部按 `currentMemberId()` 过滤防越权；后台管理接口走 `authMiddleware` + `guard('member:*')` + 审计

**资金一致性**：积分、钱包账户均带 `version` 乐观锁，记账走**事务 + 乐观锁 + 原子写流水**防并发超扣；**金额单位统一为分**（整数）。钱包充值接入支付中心（`bizType='member_recharge'`），监听支付成功事件入账，充值接口带 `idempotencyGuard` 幂等。

**前台 SPA**（`packages/web/src/member/`）：独立请求实例 `utils/member-request.ts`（**勿与 admin 的 `utils/request.ts` 混用**）、独立 `memberQueryClient`、HashRouter、移动优先样式。

### Demo 演示模式（MSW Mock）

`VITE_DEMO_MODE=true` 时前端通过 [MSW](https://mswjs.io/) 拦截所有 API 请求，无需后端即可完整运行。Mock 代码在 `packages/web/src/mocks/`（`data/` 静态数据、`handlers/` 每业务模块一个文件、`utils/handlers.ts` 共享响应信封与分页构造、`browser.ts` + `index.ts` 入口）。

构建 Demo：`npm run build:demo`（使用 `packages/web/.env.demo`）。GitHub Pages 部署由 `.github/workflows/pages.yml` 自动完成（推送 master 触发，文档站与 Demo 统一部署）。

---

## 规范索引

规则只有一个来源。需要展开内容时按下表查阅，**不要**把这些内容复制回本文件。

| 场景 | 位置 |
| --- | --- |
| **动手前必读**：分层规范约束清单 | [`.agents/skills/zenith/references/constraints.md`](.agents/skills/zenith/references/constraints.md) |
| CRUD 开发全流程（Step 0-11） | [`.agents/skills/zenith/SKILL.md`](.agents/skills/zenith/SKILL.md) |
| 后端代码模板（schema / service / route / 路由挂载） | [`.agents/skills/zenith/references/crud-backend.md`](.agents/skills/zenith/references/crud-backend.md) |
| 前端代码模板（域 hooks / 页面 / 表格 / 弹窗） | [`.agents/skills/zenith/references/crud-frontend.md`](.agents/skills/zenith/references/crud-frontend.md) |
| MSW Mock 编写模板与种子数据同步 | [`.agents/skills/zenith/references/crud-mock.md`](.agents/skills/zenith/references/crud-mock.md) |
| 菜单 / 权限 / 种子数据配置 | [`.agents/skills/zenith/references/seed-config.md`](.agents/skills/zenith/references/seed-config.md) |
| 修改现有模块（加字段 / 改接口 / 加关联） | [`.agents/skills/zenith/references/module-modification.md`](.agents/skills/zenith/references/module-modification.md) |
| 异步任务 / 批量操作接入任务中心 | [`.agents/skills/zenith/references/async-tasks.md`](.agents/skills/zenith/references/async-tasks.md) |
| 版本发布流程 | [`.agents/skills/zenith/references/release.md`](.agents/skills/zenith/references/release.md) |
| 迁移 / Swagger / 404 / 权限 / 构建报错排查 | [`.agents/skills/zenith/references/troubleshooting.md`](.agents/skills/zenith/references/troubleshooting.md) |
| 数据获取（TanStack Query）详解 | `docs/frontend/data-fetching.md` |
| API 约定 / Swagger / 安全 / 多租户 | `docs/backend/` |
| 目录结构详解 | `docs/guide/project-structure.md` |
| 文档写作与贡献约定 | `docs/guide/contributing.md` |
