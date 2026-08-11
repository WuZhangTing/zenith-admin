# Zenith Skill

Zenith Skill 位于 `.agents/skills/zenith/`，是本项目开发规范、工作流与代码模板的权威入口。
在支持 Skills 的 AI 工具中，直接描述需求即可触发：

```text
实现「商品分类」CRUD
给用户表增加合同到期时间
将批量导入接入任务中心
发布 v1.2.0
```

## 渐进式披露结构

入口 `SKILL.md` 只负责识别场景、编排步骤和定义完成标准；具体内容按当前任务加载：

| 文件 | 职责 | 读取时机 |
| --- | --- | --- |
| `SKILL.md` | 场景路由、Step 0-11 编排、完成标准 | 每次触发 |
| `references/constraints.md` | 后端、菜单、Mock 与全局硬约束 | 改动对应层前后 |
| `references/constraints-frontend.md` | 前端硬约束 | 改前端前后 |
| `references/crud-intake.md` | CRUD Step 0 信息收集 | 从零开发 CRUD 时 |
| `references/crud-backend.md` | Step 1-7 后端主链路模板 | 写后端时 |
| `references/backend-patterns.md` | 数据权限、多租户、审计 diff、附件、导出、HTTP、懒加载 | 用到对应能力时 |
| `references/query-cache.md` | 数据获取、缓存一致性与 query key | 写域 hooks 时 |
| `references/crud-frontend.md` | Step 8 标准列表页模板 | 写前端时 |
| `references/ui-patterns.md` | 多 Tab、左右分栏、统计卡、栅格、虚拟化表格 | 页面结构超出标准列表页时 |
| `references/seed-config.md` | Step 9-10 菜单权限与种子数据 | 配菜单 / seed 时 |
| `references/crud-mock.md` | Step 11 MSW Mock | 需要 Demo 模式时 |
| `references/async-tasks.md` | 任务中心接入与设施选型 | 大数据量、长耗时或需进度 / 重试 / 取消时 |
| `references/module-modification.md` | 修改现有模块的步骤序列 | 加字段、改接口、改关联、改枚举或删字段时 |
| `references/troubleshooting.md` | 按症状排查并指回规范 | 报错时 |
| `references/release.md` | 版本发布流程 | 发版时 |

场景触发词、CRUD 步骤顺序、条件分支和完成标准均以
[`SKILL.md`](https://github.com/iwangbowen/zenith-admin/blob/master/.agents/skills/zenith/SKILL.md)
为准，本页不维护副本。

## 单一事实来源

- 后端与全局约束：[`constraints.md`](https://github.com/iwangbowen/zenith-admin/blob/master/.agents/skills/zenith/references/constraints.md)
- 前端约束：[`constraints-frontend.md`](https://github.com/iwangbowen/zenith-admin/blob/master/.agents/skills/zenith/references/constraints-frontend.md)
- 后端写法：[`crud-backend.md`](https://github.com/iwangbowen/zenith-admin/blob/master/.agents/skills/zenith/references/crud-backend.md)、
  [`backend-patterns.md`](https://github.com/iwangbowen/zenith-admin/blob/master/.agents/skills/zenith/references/backend-patterns.md)
- 前端写法：[`crud-frontend.md`](https://github.com/iwangbowen/zenith-admin/blob/master/.agents/skills/zenith/references/crud-frontend.md)、
  [`query-cache.md`](https://github.com/iwangbowen/zenith-admin/blob/master/.agents/skills/zenith/references/query-cache.md)、
  [`ui-patterns.md`](https://github.com/iwangbowen/zenith-admin/blob/master/.agents/skills/zenith/references/ui-patterns.md)

架构与设计背景另见 [AI 协作概览](/ai/)、[API 规范](/backend/api-conventions)、
[UI 规范](/frontend/ui-conventions)和[数据获取](/frontend/data-fetching)。

## 维护约定

- 一条规范只保留一个正文；其他文件只给简短判定或链接
- 硬约束写入对应 `constraints*.md`，代码模板写入对应主题文件
- 新增 reference 文件时，在 `SKILL.md` 与本页的文件表登记
- 单个 reference 文件保持在可一次读入的体量（约 20KB 以内）；超出时按职责拆分
