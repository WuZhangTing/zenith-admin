# AI 辅助开发

Zenith Admin 内置一套面向 AI 编程工具（GitHub Copilot、Claude Code、Cursor 等）的协作资产，让 AI 在本仓库工作时能准确理解项目结构，并按项目规范生成代码。

---

## 两件资产

| 资产 | 位置 | 职责 |
| --- | --- | --- |
| [AGENTS.md](./agents) | 仓库根目录 | **项目导航**：项目长什么样、命令怎么跑、各子系统在哪。每次会话自动加载 |
| [Zenith Skill](./skills) | `.agents/skills/zenith/` | **开发规范与工作流的唯一来源**：硬约束清单、CRUD 全流程、代码模板、模块修改 / 异步任务 / 发版 / 排错流程。按场景按需加载 |

---

## 单一事实来源设计

两件资产职责严格分离，**每条规则只写一份**：

- **AGENTS.md 只回答「是什么、在哪里」**，开发规范一律不复述，仅在文末以「规范索引」表指向 skill 中的对应文件；
- **`.agents/skills/zenith/` 是规则的唯一来源**：硬约束正文集中在 `references/constraints.md`（后端与全局）与 `references/constraints-frontend.md`（前端），代码写法与展开说明按场景拆分在各 reference 文件，文件之间只给指针、不抄内容。

这样约定的原因：同一条规则写在两处，重构后必然只改其中一处，另一处会继续误导 AI。本文档站的这组页面同样只描述**结构与职责**，规则正文请直接阅读仓库中的源文件。

---

## 工作方式

```text
会话开始
    ↓
自动加载 AGENTS.md（项目结构、常用命令、架构总览、子系统速查、规范索引）
    ↓
动手改代码前，先读 references/constraints.md（后端与全局）
或 references/constraints-frontend.md（前端）
（分层硬约束清单，对所有改动生效——包括修 bug、重构、调样式）
    ↓
命中具体场景时，按需加载对应 skill 文件
    ├─ 开发新模块          → SKILL.md（Step 0-11）+ crud-intake
    │                        （按需 crud-backend / backend-patterns / query-cache /
    │                         crud-frontend / ui-patterns / seed-config / crud-mock）
    ├─ 修改现有模块        → module-modification.md
    ├─ 长耗时 / 大批量作业 → async-tasks.md
    ├─ 发布新版本          → release.md
    └─ 报错排查            → troubleshooting.md
```

---

## 深入阅读

- **[AGENTS.md](./agents)** —— 项目导航文件的定位、内容结构与维护约定
- **[Zenith Skill](./skills)** —— skill 的文件清单、职责分工、触发场景与 CRUD 全流程
