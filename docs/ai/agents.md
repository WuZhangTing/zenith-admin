# AGENTS.md

`AGENTS.md` 位于仓库根目录，是主流 AI 编程工具（GitHub Copilot、Claude Code、Cursor 等）进入项目时自动加载的上下文文件。

---

## 定位：只做项目导航

`AGENTS.md` 只回答三类问题：**项目长什么样、命令怎么跑、各子系统在哪**。

**开发规范一律不在其中复述**——规则的唯一来源是 [`.agents/skills/zenith/`](./skills)，`AGENTS.md` 只负责告诉 AI 去哪读。skill 仅在 CRUD 开发、模块修改、异步任务、发版等场景按需触发，而 `AGENTS.md` 每次会话都会加载，因此它承担两件事：

1. 把项目导航事实（结构、命令、架构、子系统）一次性交给 AI；
2. 在写下第一行代码之前，把 AI 引到 `references/constraints.md`（分层硬约束清单，对所有改动生效），涉及具体场景时再按文末索引取用对应文件。

## 内容结构

| 章节 | 内容 |
| --- | --- |
| 动手改代码前必读 | 指向 `constraints.md`：涵盖时间格式、统一响应构造、分页写法、图标库、service 边界、薄路由、DTO 中心化、LIKE 转义、外呼 HTTP、表格与弹窗布局、菜单权限等硬约束 |
| 项目结构 | `packages/` 五个子包（server / web / shared / analytics-sdk / electron）的一句话职责 |
| 常用命令 | 开发、构建、lint、测试、数据库迁移与种子、文档站预览 |
| 架构总览 | 后端（Hono / Drizzle / 认证 / 路由装配 / DTO / 错误处理）、前端（Semi Design / TanStack Query / 多入口）、共享层（业务域拆分与导入约定）——只说「是什么、在哪里」，「怎么写」指向 skill |
| 子系统速查 | skill 未覆盖的项目事实（部署形态、连接配置、隔离设计）：文件存储四种模式、数据库连接与迁移基线、Redis 会话、请求防护（限流 / 幂等 / CSRF）、前台会员双用户体系、Demo 演示模式（MSW） |
| 规范索引 | 「场景 → 位置」指针表：skill 各 reference 文件 + 文档站相关页面 |

> 具体条目以仓库根目录的 [`AGENTS.md` 原文](https://github.com/iwangbowen/zenith-admin/blob/master/AGENTS.md)为准，本页不复制其内容。

## 与 Zenith Skill 的分工

| 问题类型 | 去哪找 |
| --- | --- |
| 路由文件放在哪个目录？认证中间件是哪个？ | `AGENTS.md` 架构总览 |
| Redis key 前缀是什么？文件存储怎么切换？ | `AGENTS.md` 子系统速查 |
| 新写一个路由该长什么样？响应怎么构造？ | skill：`constraints.md` + `crud-backend.md` |
| 新写一个列表页该长什么样？失效怎么写？ | skill：`constraints-frontend.md` + `query-cache.md` + `crud-frontend.md` |
| 完整实现一个 CRUD 模块？ | skill：`SKILL.md` Step 0-11 |

## 维护约定

- **项目导航事实变化**（目录调整、新增子系统、命令变更）→ 更新 `AGENTS.md` 对应章节；
- **编码规范变化** → 更新 `.agents/skills/zenith/references/` 中的对应文件，**不要**把规则复制回 `AGENTS.md`；
- **skill 新增 reference 文件** → 在 `AGENTS.md` 文末「规范索引」表登记一行指针。
